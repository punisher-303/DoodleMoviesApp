import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { MMKVLoader } from 'react-native-mmkv-storage';

// Initialize MMKV storage specifically for app mode
const appModeMMKVStorage = new MMKVLoader().withInstanceID('app-mode-storage').initialize();

// Create a custom storage for Zustand using the MMKV instance
const zustandStorage = {
  setItem: (name: string, value: string) => {
    return appModeMMKVStorage.setString(name, value);
  },
  getItem: (name: string) => {
    const value = appModeMMKVStorage.getString(name);
    return value ?? null;
  },
  removeItem: (name: string) => {
    return appModeMMKVStorage.removeItem(name);
  },
};

type AppMode = 'video' | 'doodleTv';

interface AppModeState {
  appMode: AppMode;
  setAppMode: (mode: AppMode) => void;
}

const useAppModeStore = create<AppModeState>()(
  persist(
    set => ({
      appMode: 'video', // Default app mode is 'video'
      setAppMode: (mode: AppMode) => set({ appMode: mode }),
    }),
    {
      name: 'app-mode-storage', // unique name for the persisted state
      storage: createJSONStorage(() => zustandStorage), // Use the custom zustandStorage adapter
    },
  ),
);

export default useAppModeStore;
