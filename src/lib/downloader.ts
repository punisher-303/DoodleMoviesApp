import { ifExists } from './file/ifExists';
import * as RNFS from '@dr.pogodin/react-native-fs';
import { Alert, Platform } from 'react-native';
import notifee, { AndroidImportance, EventType } from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { downloadFolder } from './constants';
import requestStoragePermission from './file/getStoragePermission';
import { hlsDownloader2, cancelHlsDownload } from './hlsDownloader2';
import { notificationService } from './services/Notification';

interface DownloadTask {
  jobId: number | string;
  fileName: string;
  url: string;
  path: string;
  headers?: any;
  downloadedBytes: number;
  totalBytes: number;
  paused: boolean;
  canceled?: boolean;
  type: 'normal' | 'hls';
}

const activeDownloads = new Map<number | string, DownloadTask>();
let nextHlsId = 1000;

// 🧠 Notification button handler
notifee.onForegroundEvent(async ({ type, detail }) => {
  if (type === EventType.ACTION_PRESS) {
    const actionId = detail.pressAction?.id;
    if (actionId?.startsWith('toggle_')) {
      const fileName = actionId.replace('toggle_', '');
      togglePauseResume(fileName);
    } else if (actionId?.startsWith('cancel_')) {
      const fileName = actionId.replace('cancel_', '');
      cancelDownload(fileName);
    }
  }
});

// 🧠 Persist Download State - Your friend's addition
async function saveTaskState(task: DownloadTask) {
  await AsyncStorage.setItem(`download_${task.fileName}`, JSON.stringify(task));
}

async function removeTaskState(fileName: string) {
  await AsyncStorage.removeItem(`download_${fileName}`);
}

// 🧩 Load previous state (for future resume support) - Your friend's addition
export async function loadPreviousDownloads() {
  const keys = await AsyncStorage.getAllKeys();
  const downloads = keys.filter(k => k.startsWith('download_'));
  for (const key of downloads) {
    const data = await AsyncStorage.getItem(key);
    if (data) {
      const task: DownloadTask = JSON.parse(data);
      if (!task.canceled && !task.paused) {
        // You can add notification logic here if needed
        console.log('Found previous download:', task.fileName);
      }
    }
  }
}


// 🚀 Download manager entry point
export const downloadManager = async ({
  url,
  fileName,
  fileType,
  title,
  setDownloadActive,
  setAlreadyDownloaded,
  setDownloadId,
  headers,
  deleteDownload,
}: {
  url: string;
  fileName: string;
  fileType: string;
  title: string;
  setDownloadActive: (val: boolean) => void;
  setAlreadyDownloaded: (val: boolean) => void;
  setDownloadId: (val: number) => void;
  deleteDownload?: () => void;
  headers?: any;
}) => {
  await requestStoragePermission();
  await initDownloadChannel();

  const oldState = await AsyncStorage.getItem(`download_${fileName}`);
  if (oldState) {
    const prev: DownloadTask = JSON.parse(oldState);
    if (prev.canceled === true) await AsyncStorage.removeItem(`download_${fileName}`);
  }

  if (await ifExists(fileName)) {
    setAlreadyDownloaded(true);
    setDownloadActive(false);
    return;
  }

  setDownloadActive(true);
  if (!(await RNFS.exists(downloadFolder))) await RNFS.mkdir(downloadFolder);

  const downloadPath = `${downloadFolder}/${fileName}.${fileType}`;

  if (fileType === 'm3u8') {
    const hlsId = nextHlsId++;
    hlsDownloader2({
      videoUrl: url,
      path: downloadPath,
      fileName,
      title,
      setDownloadActive,
      setAlreadyDownloaded,
      setDownloadId,
      headers,
    });
    const task: DownloadTask = { jobId: hlsId, fileName, url, path: downloadPath, downloadedBytes: 0, totalBytes: 0, paused: false, type: 'hls' };
    activeDownloads.set(hlsId, task);
    await saveTaskState(task);
    return hlsId;
  }

  const task: DownloadTask = {
    jobId: 0,
    fileName,
    url,
    path: downloadPath,
    downloadedBytes: 0,
    totalBytes: 0,
    paused: false,
    canceled: false,
    type: 'normal',
    headers,
  };
  setDownloadId(0);
  await saveTaskState(task);
};

// 📱 Notification setup
async function initDownloadChannel() {
  if (Platform.OS === 'android') {
    await notifee.createChannel({
      id: 'download',
      name: 'Downloads',
      importance: AndroidImportance.HIGH,
    });
  }
}

// 🎯 Notification with actions
async function showDownloadNotification(task: DownloadTask) {
  const progress = task.totalBytes ? (task.downloadedBytes / task.totalBytes) * 100 : 0;

  await notifee.displayNotification({
    id: task.fileName,
    title: task.fileName,
    body: `${Math.floor(progress)}% - ${formatBytes(task.downloadedBytes)} / ${formatBytes(task.totalBytes)}`,
    android: {
      channelId: 'download',
      smallIcon: 'ic_notification',
      color: task.paused ? '#FFA000' : '#FF6347',
      progress: { max: 100, current: Math.floor(progress), indeterminate: false },
      actions: [
        { title: task.paused ? 'Resume' : 'Pause', pressAction: { id: `toggle_${task.fileName}` } },
        { title: 'Cancel', pressAction: { id: `cancel_${task.fileName}` } },
      ],
      onlyAlertOnce: true,
    },
  });
}

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}


// 🟡 Pause / Resume Logic
async function togglePauseResume(fileName: string) {
  const task = Array.from(activeDownloads.values()).find(d => d.fileName === fileName);
  if (!task) return;

  if (task.type === 'hls') {
    if (task.paused) {
      hlsDownloader2({
        videoUrl: task.url,
        path: task.path,
        fileName: task.fileName,
        title: task.fileName, // Added fallback title
        setDownloadActive: val => { },
        setAlreadyDownloaded: val => { },
        setDownloadId: val => { },
        headers: task.headers,
      });
      task.paused = false;
    } else {
      cancelHlsDownload(task.jobId);
      task.paused = true;
    }
  } else {
    task.paused = !task.paused;
    if (task.paused) {
      RNFS.stopDownload(task.jobId as number);
    } else {
      resumeDownload(task);
    }
  }

  await saveTaskState(task);
  showDownloadNotification(task);
}

// ❌ Cancel Logic
async function cancelDownload(fileName: string) {
  const task = Array.from(activeDownloads.values()).find(d => d.fileName === fileName);
  if (!task) return;

  if (task.type === 'hls') cancelHlsDownload(task.jobId);
  else if (!task.paused) RNFS.stopDownload(task.jobId as number);

  task.canceled = true;
  await saveTaskState(task);

  activeDownloads.delete(task.jobId);
  await notifee.cancelNotification(fileName);

  if (await RNFS.exists(task.path)) {
    try {
      await RNFS.unlink(task.path);
    } catch { }
  }

  await removeTaskState(fileName); // permanent remove after cancel
}

// 🔁 Resume download (RNFS)
async function resumeDownload(task: DownloadTask) {
  if (task.canceled) return; // Prevent auto resume

  const headers = task.headers || {};
  if (task.downloadedBytes > 0) {
    headers['Range'] = `bytes=${task.downloadedBytes}-`;
  }

  const ret = RNFS.downloadFile({
    fromUrl: task.url,
    toFile: task.path,
    headers,
    background: true,
    progressInterval: 1000,
    begin: res => {
      task.jobId = res.jobId;
      activeDownloads.set(res.jobId, task);
    },
    progress: async res => {
      task.downloadedBytes = res.bytesWritten;
      task.totalBytes = res.contentLength;
      await saveTaskState(task);
      showDownloadNotification(task);
    },
  });

  ret.promise.then(async () => {
    activeDownloads.delete(task.jobId);
    await removeTaskState(task.fileName);

    notifee.displayNotification({
      id: `complete_${task.fileName}`,
      title: 'Download Complete',
      body: task.fileName,
      android: { channelId: 'download', smallIcon: 'ic_notification', color: '#00C853' },
    });
  }).catch(async err => {
    activeDownloads.delete(task.jobId);
    await saveTaskState(task);
    notifee.displayNotification({
      id: `failed_${task.fileName}`,
      title: 'Download Failed',
      body: task.fileName,
      android: { channelId: 'download', smallIcon: 'ic_notification', color: '#D50000' },
    });
  });
}



// Export the new functions your friend added
export { togglePauseResume, cancelDownload, loadPreviousDownloads };