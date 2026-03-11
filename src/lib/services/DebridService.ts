import axios from 'axios';
import { settingsStorage } from '../storage';
import { Linking } from 'react-native';

const RD_CLIENT_ID = 'X245A4XAIBGVM';
const RD_BASE_URL = 'https://api.real-debrid.com/oauth/v2';
const RD_REST_URL = 'https://api.real-debrid.com/rest/1.0';
const TORBOX_BASE_URL = 'https://api.torbox.app/v1/api';

export interface DebridFile {
  filename: string;
  filesize: number;
  downloadUrl: string;
}

class DebridService {
  // --- REAL-DEBRID OAUTH ---

  async startRDLogin() {
    try {
      const response = await axios.get(`${RD_BASE_URL}/device/code?client_id=${RD_CLIENT_ID}&new_credentials=yes`);
      const data = response.data;
      
      if (data.verification_url) {
        Linking.openURL(data.verification_url);
      }
      return data; // { device_code, user_code, interval, expires_in, verification_url }
    } catch (error) {
      console.error('Error starting RD login:', error);
      throw error;
    }
  }

  async pollRDCredentials(deviceCode: string) {
    try {
      const response = await axios.get(`${RD_BASE_URL}/device/credentials?client_id=${RD_CLIENT_ID}&code=${deviceCode}`);
      if (response.status === 200) {
        const data = response.data; // { client_id, client_secret }
        return await this.exchangeRDToken(deviceCode, data.client_id, data.client_secret);
      }
    } catch (error: any) {
      // 403 means still waiting
      if (error.response?.status !== 403) {
        console.error('Error polling RD credentials:', error);
      }
    }
    return false;
  }

  private async exchangeRDToken(deviceCode: string, clientId: string, clientSecret: string) {
    try {
      const params = new URLSearchParams();
      params.append('client_id', clientId);
      params.append('client_secret', clientSecret);
      params.append('code', deviceCode);
      params.append('grant_type', 'http://oauth.net/grant_type/device/1.0');

      const response = await axios.post(`${RD_BASE_URL}/token`, params.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });

      if (response.status === 200) {
        const data = response.data;
        settingsStorage.setRealDebridToken(data.access_token);
        settingsStorage.setRealDebridRefreshToken(data.refresh_token);
        const expiry = new Date();
        expiry.setSeconds(expiry.getSeconds() + data.expires_in);
        settingsStorage.setRealDebridExpiry(expiry.toISOString());
        return true;
      }
    } catch (error) {
      console.error('Error exchanging RD token:', error);
    }
    return false;
  }

  // --- MAGNET RESOLUTION ---

  async resolveMagnet(magnet: string): Promise<DebridFile[]> {
    const service = settingsStorage.getDebridService();
    
    if (service === 'Real-Debrid') {
      return this.resolveRealDebrid(magnet);
    } else if (service === 'TorBox') {
      return this.resolveTorBox(magnet);
    }
    
    throw new Error('No debrid service selected');
  }

  private async resolveRealDebrid(magnet: string): Promise<DebridFile[]> {
    const token = settingsStorage.getRealDebridToken();
    if (!token) throw new Error('Real-Debrid not logged in');

    const headers = { Authorization: `Bearer ${token}` };

    // 1. Add Magnet
    const formData = new URLSearchParams();
    formData.append('magnet', magnet);
    const addRes = await axios.post(`${RD_REST_URL}/torrents/addMagnet`, formData.toString(), { 
        headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' } 
    });
    const torrentId = addRes.data.id;

    // 2. Select all files
    const selectData = new URLSearchParams();
    selectData.append('files', 'all');
    await axios.post(`${RD_REST_URL}/torrents/selectFiles/${torrentId}`, selectData.toString(), { 
        headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' } 
    });

    // 3. Poll for status (short poll for cached content)
    let info;
    for (let i = 0; i < 5; i++) {
      const infoRes = await axios.get(`${RD_REST_URL}/torrents/info/${torrentId}`, { headers });
      info = infoRes.data;
      if (info.status === 'downloaded') break;
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    if (info.status !== 'downloaded') throw new Error('Torrent not cached or download timed out');

    // 4. Unrestrict links
    const resolvedFiles: DebridFile[] = [];
    for (const link of info.links) {
      const unrestrictData = new URLSearchParams();
      unrestrictData.append('link', link);
      const unRes = await axios.post(`${RD_REST_URL}/unrestrict/link`, unrestrictData.toString(), { 
          headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' } 
      });
      resolvedFiles.push({
        filename: unRes.data.filename,
        filesize: unRes.data.filesize,
        downloadUrl: unRes.data.download,
      });
    }

    return resolvedFiles;
  }

  private async resolveTorBox(magnet: string): Promise<DebridFile[]> {
    const apiKey = settingsStorage.getTorBoxKey();
    if (!apiKey) throw new Error('TorBox API Key not set');

    const headers = { Authorization: `Bearer ${apiKey}` };

    // 1. Create Torrent
    const formData = new URLSearchParams();
    formData.append('magnet', magnet);
    const createRes = await axios.post(`${TORBOX_BASE_URL}/torrents/createtorrent`, formData.toString(), { 
        headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' } 
    });
    
    if (!createRes.data.success) throw new Error(`TorBox error: ${createRes.data.detail}`);
    const torrentId = createRes.data.data.torrent_id;

    // 2. Poll for status
    let info;
    for (let i = 0; i < 5; i++) {
      const infoRes = await axios.get(`${TORBOX_BASE_URL}/torrents/mylist?id=${torrentId}&bypass_cache=true`, { headers });
      info = infoRes.data.data;
      if (info.download_finished || info.download_state === 'cached') break;
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // 3. Get links
    const resolvedFiles: DebridFile[] = [];
    for (const file of info.files) {
      const downloadUrl = `${TORBOX_BASE_URL}/torrents/requestdl?token=${apiKey}&torrent_id=${torrentId}&file_id=${file.id}&redirect=true`;
      resolvedFiles.push({
        filename: file.name,
        filesize: file.size,
        downloadUrl,
      });
    }

    return resolvedFiles;
  }
}

export const debridService = new DebridService();
