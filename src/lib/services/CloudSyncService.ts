import 'react-native-url-polyfill/auto';
import { supabase } from './supabaseClient';
import { watchHistoryStorage } from '../storage/WatchHistoryStorage';
import { watchListStorage } from '../storage/WatchListStorage';
import { settingsStorage } from '../storage/SettingsStorage';

export interface CloudUserData {
  watchHistory: any[];
  watchList: any[];
  settings: { primaryColor: string; isCustomTheme: boolean };
  profile?: { email: string; name: string; photo?: string };
  lastSyncedAt: number;
}

function sanitise<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

class CloudSyncService {
  private client = supabase;

  private async fetchCloudData(userId: string): Promise<CloudUserData | null> {
    const { data, error } = await this.client
      .from('user_data')
      .select('data')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }
    return (data?.data as CloudUserData) ?? null;
  }

  private async upsertCloudData(
    userId: string,
    partial: Partial<CloudUserData>,
  ): Promise<void> {
    let current: CloudUserData | null = null;
    try {
      current = await this.fetchCloudData(userId);
    } catch (_) {}

    const merged: CloudUserData = sanitise({
      ...(current ?? {}),
      ...partial,
      lastSyncedAt: Date.now(),
    });

    const { error } = await this.client.from('user_data').upsert(
      { user_id: userId, data: merged, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    );
    if (error) throw error;
  }

  async pullUserData(userId: string): Promise<void> {
    try {
      const cloud = await this.fetchCloudData(userId);
      if (!cloud) {
        console.log('[CloudSync] No cloud data found.');
        return;
      }

      // Restore Watch History
      if (cloud.watchHistory?.length) {
        // Implementation depends on how addToWatchHistory handles duplicates
        cloud.watchHistory.forEach(item => {
            watchHistoryStorage.addToWatchHistory(item);
        });
      }

      // Restore Watch List
      if (cloud.watchList?.length) {
        cloud.watchList.forEach(item => {
            watchListStorage.addToWatchList(item);
        });
      }

      // Restore Settings
      if (cloud.settings) {
        if (cloud.settings.primaryColor)
          settingsStorage.setPrimaryColor(cloud.settings.primaryColor);
        if (typeof cloud.settings.isCustomTheme === 'boolean')
          settingsStorage.setCustomTheme(cloud.settings.isCustomTheme);
      }

      console.log('[CloudSync] Sync complete.');
    } catch (error) {
      console.error('[CloudSync] Pull failed:', error);
    }
  }

  async pushUserData(userId: string): Promise<void> {
    try {
      await this.upsertCloudData(userId, {
        watchHistory: watchHistoryStorage.getWatchHistory(),
        watchList: watchListStorage.getWatchList(),
        settings: {
          primaryColor: settingsStorage.getPrimaryColor(),
          isCustomTheme: settingsStorage.isCustomTheme(),
        },
      });
      console.log('[CloudSync] Push complete.');
    } catch (error) {
      console.error('[CloudSync] Push failed:', error);
    }
  }

  async saveUserProfile(
    userId: string,
    profile: { email: string; name: string; photo?: string },
  ): Promise<void> {
    try {
      await this.upsertCloudData(userId, { profile });
    } catch (error) {
      console.error('[CloudSync] Profile save failed:', error);
    }
  }
}

export const cloudSyncService = new CloudSyncService();
