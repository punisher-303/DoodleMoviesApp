import axios from 'axios';
import {getBaseUrl} from './getBaseUrl';
import {headers} from './headers';
import * as cheerio from 'cheerio';
import {hubcloudExtracter} from './hubcloudExtractor';
import {gofileExtracter} from './gofileExtracter';
import {superVideoExtractor} from './superVideoExtractor';
import {gdFlixExtracter} from './gdflixExtractor';
import {ProviderContext} from './types';
import * as Crypto from 'expo-crypto';
import TorrEngineService from '../services/TorrEngineService';
import { settingsStorage } from '../storage';

// --- SECURE PROXY INTERCEPTOR ---
// Rewrites requests to blocked domains through a raw proxy if enabled.
axios.interceptors.request.use((config) => {
  const isProxyEnabled = settingsStorage.isNetworkProxyEnabled();
  
  if (isProxyEnabled && config.url && config.url.startsWith('http')) {
     const blocked = ['torrentio.strem.fun', 'knaben.org', 'torrentgalaxy.to', 'bitsearch.to', '1337x.to', 'yts.mx'];
     const isTrackers = blocked.some(domain => config.url?.includes(domain));
     
     if (isTrackers) {
        config.url = `https://api.allorigins.win/raw?url=${encodeURIComponent(config.url)}`;
        console.log(`[Proxy] Rewriting to: ${config.url}`);
     }
  }
  return config;
}, (error) => Promise.reject(error));
// --------------------------------

/**
 * Context for provider functions.
 * This context is used to pass common dependencies to provider functions.
 */

const extractors = {
  hubcloudExtracter,
  gofileExtracter,
  superVideoExtractor,
  gdFlixExtracter,
};

export const providerContext: ProviderContext = {
  axios,
  getBaseUrl,
  commonHeaders: headers,
  Crypto,
  cheerio,
  extractors,
  nativeLog: (msg: string) => TorrEngineService.logMessage(msg),
};
