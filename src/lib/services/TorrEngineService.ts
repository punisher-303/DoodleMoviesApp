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
      console.warn('[TorrEngineService] Native TorrServerModule not found.');
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
      ToastAndroid.show('Starting Torrent Engine...', ToastAndroid.SHORT);
      console.log('[TorrEngineService] Starting local engine via NativeModule...');
      
      try {
        await TorrServerModule.startServer(PORT);
      } catch (e: any) {
        const errorMsg = e.message || 'Unknown Error';
        console.error('[TorrEngineService] Native start failed:', errorMsg);
        
        if (errorMsg.includes('code 127')) {
            ToastAndroid.show('Engine Error: Incompatible Device ABI', ToastAndroid.LONG);
        } else {
            ToastAndroid.show(`Engine Start Error: ${errorMsg}`, ToastAndroid.LONG);
        }
        return false;
      }
      
      // 3. Wait for echo with progression logging
      const ready = await this.waitForEcho(25000); // Increased to 25s
      if (ready) {
        console.log('[TorrEngineService] Engine is UP and responding.');
        await this.configureSettings();
        ToastAndroid.show('Torrent Engine Ready', ToastAndroid.SHORT);
        return true;
      }

      console.error('[TorrEngineService] Engine failed to respond within timeout.');
      ToastAndroid.show('Engine Timeout: Try Clearing Data', ToastAndroid.LONG);
      return false;
    } catch (error) {
      console.error('[TorrEngineService] Failed to ensure engine:', error);
      return false;
    }
  }

  async clearEngineData(): Promise<boolean> {
    if (Platform.OS !== 'android' || !TorrServerModule) return false;
    try {
      await this.stopEngine();
      await TorrServerModule.clearData();
      ToastAndroid.show('Engine Data Cleared', ToastAndroid.SHORT);
      return true;
    } catch (e) {
      console.error('[TorrEngineService] Failed to clear data:', e);
      return false;
    }
  }

  private async isAlive(): Promise<boolean> {
    const urls = [
      `http://127.0.0.1:${PORT}/echo`,
      `http://localhost:${PORT}/echo`,
      `http://[::1]:${PORT}/echo` // Add IPv6 loopback
    ];

    for (const url of urls) {
      try {
        const resp = await axios.get(url, { 
          timeout: 2500, // Increased timeout for slower physical devices
          headers: { 'Cache-Control': 'no-cache' }
        });
        if (resp.status === 200) return true;
      } catch (e) {
        // Continue to next URL
      }
    }
    return false;
  }

  private async waitForEcho(timeoutMs = 15000): Promise<boolean> {
    const start = Date.now();
    let attempts = 0;
    while (Date.now() - start < timeoutMs) {
      attempts++;
      if (await this.isAlive()) return true;
      if (attempts % 4 === 0) {
        console.log(`[TorrEngineService] Still waiting... (${Math.round((Date.now() - start)/1000)}s)`);
      }
      await new Promise(resolve => setTimeout(resolve, 800));
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
        CacheSize: 200 * 1024 * 1024, // 200MB RAM Cache
        PreloadCache: 3,               // 3% Preload
        ReaderReadAHead: 80,          // 80% Read ahead
        ResponsiveMode: true,         
        Strategy: 0,                  // 0 = Fast Strategy
        ConnectionsLimit: 200,        // Bumping to 200 for faster swarming
        DisableUpload: true,          
        RetrackersMode: 1,            
        TorrentDisconnectTimeout: 86400,
        DhtEndpoints: [
          "router.bittorrent.com:6881",
          "router.utorrent.com:6881",
          "dht.transmissionbt.com:6881",
          "dht.libtorrent.org:25401"
        ],
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
