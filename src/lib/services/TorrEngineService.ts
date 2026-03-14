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
      `http://127.0.0.1:${PORT}/api/echo`,
      `http://localhost:${PORT}/echo`,
      `http://[::1]:${PORT}/echo`
    ];

    for (const url of urls) {
      try {
        const resp = await axios.get(url, { 
          timeout: 4000, // Increased for stability on slower physical devices
          headers: { 'Cache-Control': 'no-cache' }
        });
        if (resp.status === 200) return true;
      } catch (e: any) {
        if (e.code === 'ECONNREFUSED') {
           // This is expected if the server isn't started yet, don't spam
        } else {
           console.log(`[TorrEngineService] Ping ${url} failed: ${e.code || e.message}`);
        }
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
      const getResp = await axios.get(`${BASE_URL}/api/settings`);
      const current = getResp.data || {};

      const optimized = {
        ...current,
        CacheSize: 200 * 1024 * 1024, // 200MB RAM Cache
        PreloadCache: 3,               // 3% Preload
        ReaderReadAHead: 80,          // 80% Read ahead
        ResponsiveMode: true,         
        Strategy: 2,                  // 2 = RequestStrategyFastest (Picks fastest peers immediately)
        ConnectionsLimit: 250,        // Balanced for modern mobile devices (prevents overhead)
        DisableUpload: true,          
        RetrackersMode: 1,            
        DhtConnectionLimit: 0,        // 0 = Unlimited (Faster peer discovery)
        PeersListenPort: 0,           // 0 = Random (Avoids firewall blocks)
        TorrentDisconnectTimeout: 86400,
        DhtEndpoints: [
          "router.bittorrent.com:6881",
          "router.utorrent.com:6881",
          "dht.transmissionbt.com:6881",
          "dht.libtorrent.org:25401",
          "dht.aelitis.com:6881"
        ],
      };

      await axios.post(`${BASE_URL}/api/settings`, optimized);

      this.isConfigured = true;
      console.log('[TorrEngineService] Settings applied successfully');
    } catch (error) {
      console.error('[TorrEngineService] Failed to configure settings:', error);
    }
  }

  // --- NEW STABLE FLOW METHODS ---

  private extractHash(magnet: string): string | null {
    if (!magnet) return null;
    if (magnet.length === 40 || magnet.length === 64) return magnet.toLowerCase();
    const match = magnet.match(/xt=urn:btih:([a-zA-Z0-9]+)/i);
    return match ? match[1].toLowerCase() : null;
  }

  async addTorrent(link: string): Promise<string | null> {
    const hash = this.extractHash(link);
    try {
      console.log(`[TorrEngineService] Adding torrent: ${hash}`);
      await axios.post(`${BASE_URL}/api/torrents`, {
        action: 'add',
        link: link,
        save: false
      }, { timeout: 10000 });
      return hash;
    } catch (e: any) {
      // If 400, it might already exist
      if (e.response?.status === 400 && hash) return hash;
      console.error('[TorrEngineService] Add torrent failed:', e.message);
      return null;
    }
  }

  async getTorrent(hash: string): Promise<any> {
    try {
      const resp = await axios.get(`${BASE_URL}/api/torrents/status`, {
        params: { hash: hash },
        timeout: 5000
      });
      return resp.data;
    } catch (e) {
      return null;
    }
  }

  async setPriority(hash: string, fileId: number, totalFiles: number): Promise<boolean> {
    try {
      const priorities = Array(totalFiles).fill(0);
      priorities[fileId] = 1;
      await axios.post(`${BASE_URL}/api/torrents`, {
        action: 'set',
        hash: hash,
        priority: priorities
      }, { timeout: 5000 });
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Stremio-grade stream preparation:
   * 1. Ensure engine
   * 2. Add torrent
   * 3. Wait for metadata (files)
   * 4. Select best file
   * 5. Set priority
   * 6. Generate final play URL
   */
  async prepareTorrentStream(magnet: string, season?: number, episode?: number): Promise<string | null> {
    const ready = await this.ensureEngine();
    if (!ready) throw new Error('Engine not ready');

    const hash = await this.addTorrent(magnet);
    if (!hash) throw new Error('Failed to add torrent');

    console.log(`[TorrEngineService] Polling metadata for ${hash}...`);
    let fileInfo: { id: number, name: string } | null = null;
    const startTime = Date.now();
    
    // Poll for up to 30 seconds
    while (Date.now() - startTime < 30000) {
      const data = await this.getTorrent(hash);
      const files = data?.file_stats || data?.files;
      
      if (files && files.length > 0) {
        // Find best video file
        let bestFile = null;
        let largestSize = 0;

        for (const f of files) {
          const name = (f.path || f.name || '').toLowerCase();
          const isVideo = /\.(mkv|mp4|avi|mov|flv|wmv|m4v)$/.test(name);
          if (!isVideo) continue;

          // If season/episode provided, try to match
          if (season !== undefined && episode !== undefined) {
             const seMatch = name.includes(`s${season.toString().padStart(2, '0')}e${episode.toString().padStart(2, '0')}`) ||
                            name.includes(`${season}x${episode.toString().padStart(2, '0')}`);
             if (seMatch) {
                bestFile = f;
                break; 
             }
          }

          // Otherwise, track largest
          if (f.length > largestSize) {
            largestSize = f.length;
            bestFile = f;
          }
        }

        if (bestFile) {
          fileInfo = { id: bestFile.id, name: bestFile.path || bestFile.name };
          await this.setPriority(hash, bestFile.id, files.length);
          break;
        }
      }
      await new Promise(r => setTimeout(r, 800));
    }

    if (!fileInfo) throw new Error('Metadata timeout or no video file found');

    const encodedName = encodeURIComponent(fileInfo.name);
    return `${BASE_URL}/play/${hash}/${fileInfo.id}`;
  }

  async stopEngine() {
    if (Platform.OS === 'android') {
      await TorrServerModule.stopServer();
      this.isConfigured = false;
    }
  }

  async getEngineLogs(): Promise<string> {
    if (Platform.OS !== 'android' || !TorrServerModule) return 'Engine not available on this platform';
    try {
      return await TorrServerModule.getLogs();
    } catch (e) {
      return `Failed to fetch logs: ${e}`;
    }
  }
}

export default TorrEngineService.getInstance();
