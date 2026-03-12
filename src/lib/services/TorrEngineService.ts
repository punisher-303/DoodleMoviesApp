import { NativeModules, Platform } from 'react-native';
import axios from 'axios';

const { TorrServerModule } = NativeModules;

const PORT = 8090;
const BASE_URL = `http://127.0.0.1:${PORT}`;

class TorrEngineService {
  private static instance: TorrEngineService;
  private isConfigured = false;

  private constructor() {}

  static getInstance(): TorrEngineService {
    if (!TorrEngineService.instance) {
      TorrEngineService.instance = new TorrEngineService();
    }
    return TorrEngineService.instance;
  }

  async ensureEngine(): Promise<boolean> {
    if (Platform.OS !== 'android') return false;

    if (!TorrServerModule) {
      console.warn('[TorrEngineService] Native TorrServerModule not found. A fresh build is required for local engine.');
      return false;
    }

    try {
      // 1. Check if already running
      const alive = await this.isAlive();
      if (alive) {
        if (!this.isConfigured) await this.configureSettings();
        return true;
      }

      // 2. Start via native module
      console.log('[TorrEngineService] Starting local engine...');
      await TorrServerModule.startServer(PORT);

      // 3. Wait for echo
      const ready = await this.waitForEcho();
      if (ready) {
        await this.configureSettings();
        return true;
      }

      return false;
    } catch (error) {
      console.error('[TorrEngineService] Failed to ensure engine:', error);
      return false;
    }
  }

  private async isAlive(): Promise<boolean> {
    try {
      const resp = await axios.get(`${BASE_URL}/echo`, { timeout: 1000 });
      return resp.status === 200;
    } catch {
      return false;
    }
  }

  private async waitForEcho(timeoutMs = 15000): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (await this.isAlive()) return true;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    return false;
  }

  private async configureSettings() {
    console.log('[TorrEngineService] Applying optimized settings...');
    try {
      // Get current settings first
      const getResp = await axios.post(`${BASE_URL}/settings`, { action: 'get' });
      const current = getResp.data || {};

      const optimized = {
        ...current,
        CacheSize: 512 * 1024 * 1024, // 512MB RAM Cache
        PreloadCache: 2,               // 2% Preload (Fast start)
        ReaderReadAHead: 95,          // 95% Read ahead
        ResponsiveMode: true,         // Priority for reader pieces
        Strategy: 2,                  // Fastest strategy
        ConnectionsLimit: 200,
        DisableUpload: true,          // Leech mode for max speed
        RetrackersMode: 1,            // Add retrackers
        TorrentDisconnectTimeout: 86400, // Stay alive
      };

      await axios.post(`${BASE_URL}/settings`, {
        action: 'set',
        sets: optimized
      });

      this.isConfigured = true;
      console.log('[TorrEngineService] Settings applied successfully');
    } catch (error) {
      console.error('[TorrEngineService] Failed to configure settings:', error);
    }
  }

  async stopEngine() {
    if (Platform.OS === 'android') {
      await TorrServerModule.stopServer();
      this.isConfigured = false;
    }
  }
}

export default TorrEngineService.getInstance();
