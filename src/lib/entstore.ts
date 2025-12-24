import AsyncStorage from '@react-native-async-storage/async-storage';

// --- Storage Keys ---
const DOWNLOADS_KEY = 'downloads:files';
const THUMBNAILS_KEY = 'downloads:thumbnails';
const EXTERNAL_FILES_KEY = 'downloads:external_files';
const HAPTIC_KEY = 'settings:haptics';
const WATCH_HISTORY_KEY = 'downloads:watch_history';

// --- Type Definitions ---
export interface MediaItem {
  uri: string;
  title: string;
  size: number;
  isManagedDownload: boolean;
}

// --- Downloads Storage ---
const downloadsStorage = {
  /**
   * Save app-managed download files.
   */
  saveFilesInfo: async (files: MediaItem[]): Promise<void> => {
    try {
      await AsyncStorage.setItem(DOWNLOADS_KEY, JSON.stringify(files));
    } catch (error) {
      console.error('❌ Failed to save downloads info:', error);
    }
  },

  /**
   * Get list of app-managed download files.
   */
  getFilesInfo: async (): Promise<MediaItem[]> => {
    try {
      const jsonValue = await AsyncStorage.getItem(DOWNLOADS_KEY);
      return jsonValue ? JSON.parse(jsonValue) : [];
    } catch (error) {
      console.error('❌ Failed to retrieve downloads info:', error);
      return [];
    }
  },

  /**
   * Save thumbnails for videos.
   */
  saveThumbnails: async (thumbnails: Record<string, string>): Promise<void> => {
    try {
      await AsyncStorage.setItem(THUMBNAILS_KEY, JSON.stringify(thumbnails));
    } catch (error) {
      console.error('❌ Failed to save thumbnails:', error);
    }
  },

  /**
   * Get thumbnails map.
   */
  getThumbnails: async (): Promise<Record<string, string>> => {
    try {
      const jsonValue = await AsyncStorage.getItem(THUMBNAILS_KEY);
      return jsonValue ? JSON.parse(jsonValue) : {};
    } catch (error) {
      console.error('❌ Failed to retrieve thumbnails:', error);
      return {};
    }
  },

  /**
   * Save external file references (URIs from DocumentPicker).
   */
  saveExternalFiles: async (files: MediaItem[]): Promise<void> => {
    try {
      await AsyncStorage.setItem(EXTERNAL_FILES_KEY, JSON.stringify(files));
    } catch (error) {
      console.error('❌ Failed to save external files info:', error);
    }
  },

  /**
   * Retrieve list of external file references.
   */
  getExternalFiles: async (): Promise<MediaItem[]> => {
    try {
      const jsonValue = await AsyncStorage.getItem(EXTERNAL_FILES_KEY);
      return jsonValue ? JSON.parse(jsonValue) : [];
    } catch (error) {
      console.error('❌ Failed to retrieve external files info:', error);
      return [];
    }
  },

  /**
   * Save watch history for played videos.
   */
  saveWatchHistory: async (history: any[]): Promise<void> => {
    try {
      await AsyncStorage.setItem(WATCH_HISTORY_KEY, JSON.stringify(history));
    } catch (error) {
      console.error('❌ Failed to save watch history:', error);
    }
  },

  /**
   * Retrieve watch history list.
   */
  getWatchHistory: async (): Promise<any[]> => {
    try {
      const jsonValue = await AsyncStorage.getItem(WATCH_HISTORY_KEY);
      return jsonValue ? JSON.parse(jsonValue) : [];
    } catch (error) {
      console.error('❌ Failed to retrieve watch history:', error);
      return [];
    }
  },
};

// --- Settings Storage ---
const settingsStorage = {
  /**
   * Mock for haptic feedback toggle.
   */
  isHapticFeedbackEnabled: (): boolean => {
    return true;
  },
};

export { settingsStorage, downloadsStorage };