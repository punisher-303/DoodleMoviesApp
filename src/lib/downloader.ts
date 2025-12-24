import {ifExists} from './file/ifExists';
import * as RNFS from '@dr.pogodin/react-native-fs';
import {Alert} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {downloadFolder} from './constants';
import requestStoragePermission from './file/getStoragePermission';
import {hlsDownloader2, cancelHlsDownload} from './hlsDownloader2';
import {notificationService} from './services/Notification';

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

// 🟡 Pause/Resume Logic - Your friend's addition
async function togglePauseResume(fileName: string) {
  const task = Array.from(activeDownloads.values()).find(d => d.fileName === fileName);
  if (!task) return;

  if (task.type === 'hls') {
    if (task.paused) {
      hlsDownloader2({
        videoUrl: task.url,
        setDownloadActive: val => {},
        path: task.path,
        fileName: task.fileName,
        title: '',
        setAlreadyDownloaded: val => {},
        setDownloadId: val => {},
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
}

// 🔁 Resume download (RNFS) - Your friend's addition
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
      
      const progress = res.bytesWritten / res.contentLength;
      const body = res.contentLength < 1024 * 1024 * 1024
        ? Math.round(res.bytesWritten / 1024 / 1024) + ' / ' + Math.round(res.contentLength / 1024 / 1024) + ' MB'
        : parseFloat((res.bytesWritten / 1024 / 1024 / 1024).toFixed(2)) + ' / ' + parseFloat((res.contentLength / 1024 / 1024 / 1024).toFixed(2)) + ' GB';
      
      notificationService.showDownloadProgress(
        task.fileName,
        task.fileName,
        progress,
        body,
        task.jobId
      );
    },
  });

  ret.promise.then(async res => {
    activeDownloads.delete(task.jobId);
    await removeTaskState(task.fileName);
    notificationService.showDownloadComplete(task.fileName, task.fileName);
  }).catch(async err => {
    activeDownloads.delete(task.jobId);
    await saveTaskState(task);
    notificationService.showDownloadFailed(task.fileName, task.fileName);
  });
}

// ❌ Cancel Logic - Your friend's addition
async function cancelDownload(fileName: string) {
  const task = Array.from(activeDownloads.values()).find(d => d.fileName === fileName);
  if (!task) return;

  if (task.type === 'hls') cancelHlsDownload(task.jobId);
  else if (!task.paused) RNFS.stopDownload(task.jobId as number);

  task.canceled = true;
  await saveTaskState(task);

  activeDownloads.delete(task.jobId);

  if (await RNFS.exists(task.path)) {
    try {
      await RNFS.unlink(task.path);
    } catch {}
  }

  await removeTaskState(fileName); // permanent remove after cancel
}

export const downloadManager = async ({
  title,
  url,
  fileName,
  fileType,
  setDownloadActive,
  setAlreadyDownloaded,
  setDownloadId,
  headers,
  deleteDownload,
}: {
  title: string;
  url: string;
  fileName: string;
  fileType: string;
  canceled?: boolean;
  setDownloadActive: (value: boolean) => void;
  headers?: any;
  setAlreadyDownloaded: (value: boolean) => void;
  setDownloadId: (value: number) => void;
  deleteDownload: () => void;
}) => {
  await requestStoragePermission();

  // Check for previous state - Your friend's addition
  const oldState = await AsyncStorage.getItem(`download_${fileName}`);
  if (oldState) {
    const prev: DownloadTask = JSON.parse(oldState);
    if (prev.canceled === true) await AsyncStorage.removeItem(`download_${fileName}`);
  }

  await notificationService.showDownloadStarting(title, fileName);
  if (await ifExists(fileName)) {
    console.log('File already exists');
    setAlreadyDownloaded(true);
    setDownloadActive(false);
    return;
  }
  setDownloadActive(true);

  try {
    if (!(await RNFS.exists(downloadFolder))) {
      await RNFS.mkdir(downloadFolder);
    }
    await notificationService.requestPermission();

    if (fileType === 'm3u8') {
      const hlsId = nextHlsId++;
      hlsDownloader2({
        videoUrl: url,
        setDownloadActive,
        path: `${downloadFolder}/${fileName}.mp4`,
        fileName,
        title,
        setAlreadyDownloaded,
        setDownloadId: setDownloadId,
        headers,
      });
      
      // Your friend's addition - Save HLS task state
      const task: DownloadTask = {
        jobId: hlsId,
        fileName,
        url,
        path: `${downloadFolder}/${fileName}.mp4`,
        downloadedBytes: 0,
        totalBytes: 0,
        paused: false,
        type: 'hls',
        headers,
      };
      activeDownloads.set(hlsId, task);
      await saveTaskState(task);
      
      console.log('Downloading HLS');
      return hlsId;
    }

    const downloadDest = `${downloadFolder}/${fileName}.${fileType}`;
    
    // Your friend's addition - Create task object
    const task: DownloadTask = {
      jobId: 0,
      fileName,
      url,
      path: downloadDest,
      downloadedBytes: 0,
      totalBytes: 0,
      paused: false,
      canceled: false,
      type: 'normal',
      headers,
    };
    
    await saveTaskState(task);

    const ret = RNFS.downloadFile({
      fromUrl: url,
      progressInterval: 1000,
      backgroundTimeout: 1000 * 60 * 60,
      progressDivider: 1,
      headers: headers ? headers : {},
      toFile: downloadDest,
      background: true,
      begin: (res: any) => {
        console.log('Download has started', res);
        task.jobId = res.jobId;
        activeDownloads.set(res.jobId, task);
        setDownloadId(ret.jobId);
        // Your friend's addition - Save state on begin
        saveTaskState(task);
      },
      progress: async (res: any) => { // Your friend's addition - async
        const progress = res.bytesWritten / res.contentLength;
        const body =
          res.contentLength < 1024 * 1024 * 1024
            ? Math.round(res.bytesWritten / 1024 / 1024) +
              ' / ' +
              Math.round(res.contentLength / 1024 / 1024) +
              ' MB'
            : parseFloat((res.bytesWritten / 1024 / 1024 / 1024).toFixed(2)) +
              ' / ' +
              parseFloat((res.contentLength / 1024 / 1024 / 1024).toFixed(2)) +
              ' GB';
              
        // Your friend's addition - Update task state
        task.downloadedBytes = res.bytesWritten;
        task.totalBytes = res.contentLength;
        await saveTaskState(task); // Your friend's addition
        
        notificationService.showDownloadProgress(
          title,
          fileName,
          progress,
          body,
          ret.jobId,
        );
      },
    });

    ret.promise.then(async res => { // Your friend's addition - async
      console.log('Download complete', res);
      activeDownloads.delete(task.jobId); // Your friend's addition
      setAlreadyDownloaded(true);
      notificationService.showDownloadComplete(title, fileName);
      setDownloadActive(false);
      await removeTaskState(task.fileName); // Your friend's addition
    });

    ret.promise.catch(async err => { // Your friend's addition - async
      deleteDownload();
      console.log('Download error:', err);
      activeDownloads.delete(task.jobId); // Your friend's addition
      task.canceled = true; // Your friend's addition
      await saveTaskState(task); // Your friend's addition
      Alert.alert('Download failed', err.message || 'Failed to download');
      notificationService.showDownloadFailed(title, fileName);
      setDownloadActive(false);
      setAlreadyDownloaded(false);
    });

    return ret.jobId;
  } catch (error: any) {
    console.error('Download error:', error);
    deleteDownload();
    Alert.alert('Download failed', 'Failed to download');
    setDownloadActive(false);
    setAlreadyDownloaded(false);
  }
};

// Export the new functions your friend added
export { togglePauseResume, cancelDownload, loadPreviousDownloads };