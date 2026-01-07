import { create } from 'zustand';
import { settingsStorage } from '../storage';

interface SettingsState {
    showTabBarLabels: boolean;
    setShowTabBarLabels: (show: boolean) => void;
}

const useSettingsStore = create<SettingsState>((set) => ({
    showTabBarLabels: settingsStorage.showTabBarLabels(),
    setShowTabBarLabels: (show: boolean) => {
        set({ showTabBarLabels: show });
        settingsStorage.setShowTabBarLabels(show);
    },
}));

export default useSettingsStore;