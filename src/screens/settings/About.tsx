import {
  View,
  Text,
  TouchableNativeFeedback,
  ToastAndroid,
  Linking,
  Alert,
  Switch,
} from 'react-native';
// import pkg from '../../../package.json';
import React, { useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { settingsStorage } from '../../lib/storage';
import * as RNFS from '@dr.pogodin/react-native-fs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import useThemeStore from '../../lib/zustand/themeStore';
import * as Application from 'expo-application';
import { notificationService } from '../../lib/services/Notification';
import IOSModal from '../../components/IOSModal';

// download update
export const downloadUpdate = async (url: string, name: string) => {
  console.log('downloading', url, name);
  await notificationService.requestPermission();

  try {
    if (await RNFS.exists(`${RNFS.DownloadDirectoryPath}/${name}`)) {
      await notificationService.displayUpdateNotification({
        id: 'downloadComplete',
        title: 'Download Completed',
        body: 'Tap to install',
        data: { name: `${name}`, action: 'install' },
      });
      return;
    }
  } catch (error) { }
  const { promise } = RNFS.downloadFile({
    fromUrl: url,
    background: true,
    progressInterval: 1000,
    progressDivider: 1,
    toFile: `${RNFS.DownloadDirectoryPath}/${name}`,
    begin: res => {
      console.log('begin', res.jobId, res.statusCode, res.headers);
    },
    progress: res => {
      console.log('progress', res.bytesWritten, res.contentLength);
      notificationService.showUpdateProgress(
        'Downloading Update',
        `Version ${Application.nativeApplicationVersion} -> ${name}`,
        {
          current: res.bytesWritten,
          max: res.contentLength,
          indeterminate: false,
        },
      );
    },
  });
  promise.then(async res => {
    if (res.statusCode === 200) {
      await notificationService.cancelNotification('updateProgress');
      await notificationService.displayUpdateNotification({
        id: 'downloadComplete',
        title: 'Download Complete',
        body: 'Tap to install',
        data: { name, action: 'install' },
      });
    }
  });
};

// handle check for update
// handle check for update
export const checkForUpdate = async (
  setUpdateLoading: React.Dispatch<React.SetStateAction<boolean>>,
  showToast: boolean = true,
): Promise<any | null> => {
  setUpdateLoading(true);
  try {
    // First get the dynamic Play Store URL
    const urlRes = await fetch(
      'https://raw.githubusercontent.com/punisher-303/Doodle-Movie-App/main/updateurl/update_url.json'
    );
    const { play_store_url } = await urlRes.json();
    const res = await fetch(
      'https://api.github.com/repos/punisher-303/Doodle-Movie-App/releases/latest',
    );
    const data = await res.json();
    const localVersion = Application.nativeApplicationVersion;
    const remoteVersion = Number(
      data.tag_name.replace('v', '')?.split('.').join(''),
    );

    if (compareVersions(localVersion || '', data.tag_name.replace('v', ''))) {
      if (showToast) ToastAndroid.show('New update available', ToastAndroid.SHORT);
      console.log('local', localVersion, 'remote', remoteVersion);
      setUpdateLoading(false);

      // Return the update data including the play_store_url we fetched
      return { ...data, play_store_url };
    } else {
      showToast && ToastAndroid.show('App is up to date', ToastAndroid.SHORT);
      console.log('App is up to date', localVersion, remoteVersion);
    }
  } catch (error) {
    if (showToast) ToastAndroid.show('Failed to check for update', ToastAndroid.SHORT);
    console.log('Update error', error);
  }
  setUpdateLoading(false);
  return null;
};

const About = () => {
  const { primary } = useThemeStore(state => state);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [autoDownload, setAutoDownload] = useState(
    settingsStorage.isAutoDownloadEnabled(),
  );
  const [autoCheckUpdate, setAutoCheckUpdate] = useState<boolean>(
    settingsStorage.isAutoCheckUpdateEnabled(),
  );

  const [updateData, setUpdateData] = useState<any>(null);

  const handleManualCheck = async () => {
    const data = await checkForUpdate(setUpdateLoading, true);
    if (data) {
      setUpdateData(data);
    }
  };

  const performUpdate = () => {
    if (!updateData) return;

    setUpdateData(null); // Close modal

    if (autoDownload) {
      downloadUpdate(
        updateData?.assets?.[2]?.browser_download_url,
        updateData.assets?.[2]?.name,
      );
    } else {
      Linking.openURL(updateData.play_store_url || 'https://doodlemovies.vercel.app');
    }
  };

  return (
    <View className="flex-1 bg-black mt-8">
      <View className="px-4 py-3 border-b border-white/10">
        <Text className="text-2xl font-bold text-white">About</Text>
        <Text className="text-gray-400 mt-1 text-sm">
          App information and updates
        </Text>
      </View>

      <View className="p-4 space-y-4 pb-24">
        {/* Version */}
        <View className="bg-white/10 p-4 rounded-lg flex-row justify-between items-center">
          <Text className="text-white text-base">Version</Text>
          <Text className="text-white/70">
            v{Application.nativeApplicationVersion}
          </Text>
        </View>

        {/* Auto Install Updates */}
        {/* <View className="bg-white/10 p-4 rounded-lg flex-row justify-between items-center">
          <Text className="text-white text-base">Auto Install Updates</Text>
          <Switch
            value={autoDownload}
            onValueChange={() => {
              setAutoDownload(!autoDownload);
              settingsStorage.setAutoDownloadEnabled(!autoDownload);
            }}
            thumbColor={autoDownload ? primary : 'gray'}
          />
        </View> */}

        {/* Auto Check Updates */}
        <View className="bg-white/10 p-3 rounded-lg flex-row justify-between items-center">
          <View className="flex-1 mr-2">
            <Text className="text-white text-base">Check Updates on Start</Text>
            <Text className="text-gray-400 text-sm">
              Automatically check for updates when app starts
            </Text>
          </View>
          <Switch
            value={autoCheckUpdate}
            onValueChange={() => {
              setAutoCheckUpdate(!autoCheckUpdate);
              settingsStorage.setAutoCheckUpdateEnabled(!autoCheckUpdate);
            }}
            thumbColor={autoCheckUpdate ? primary : 'gray'}
          />
        </View>

        {/* Check Updates Button */}
        <TouchableNativeFeedback
          onPress={handleManualCheck}
          disabled={updateLoading}
          background={TouchableNativeFeedback.Ripple('#ffffff20', false)}>
          <View className="bg-white/10 p-4 rounded-lg flex-row justify-between items-center mt-4">
            <View className="flex-row items-center space-x-3">
              <MaterialCommunityIcons name="update" size={22} color="white" />
              <Text className="text-white text-base">Check for Updates</Text>
            </View>
            <Feather name="chevron-right" size={20} color="white" />
          </View>
        </TouchableNativeFeedback>
      </View>

      <IOSModal
        visible={!!updateData}
        title={`Update Available: ${updateData?.tag_name}`}
        message={updateData?.body || 'A new version of the app is available.'}
        actions={[
          { text: "Update Now", onPress: performUpdate },
          { text: "Cancel", style: 'cancel', onPress: () => setUpdateData(null) }
        ]}
        onClose={() => setUpdateData(null)}
      />
    </View>
  );
};

export default About;

function compareVersions(localVersion: string, remoteVersion: string): boolean {
  try {
    // Split versions into arrays and convert to numbers
    const local = localVersion.split('.').map(Number);
    const remote = remoteVersion.split('.').map(Number);

    // Compare major version
    if (remote[0] > local[0]) {
      return true;
    }
    if (remote[0] < local[0]) {
      return false;
    }

    // Compare minor version
    if (remote[1] > local[1]) {
      return true;
    }
    if (remote[1] < local[1]) {
      return false;
    }

    // Compare patch version
    if (remote[2] > local[2]) {
      return true;
    }

    return false;
  } catch (error) {
    console.error('Invalid version format');
    return false;
  }
}
