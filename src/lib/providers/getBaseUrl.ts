import { cacheStorageService } from '../storage';
import { extensionStorage } from '../storage';
import axios from 'axios';

// 1 hour
const expireTime = 60 * 60 * 1000;

export const getBaseUrl = async (providerValue: string) => {
  try {
    let baseUrl = '';
    const cacheKey = 'CacheBaseUrl' + providerValue;
    const timeKey = 'baseUrlTime' + providerValue;

    const cachedUrl = cacheStorageService.getString(cacheKey);
    const cachedTime = cacheStorageService.getObject<number>(timeKey);

    if (cachedUrl && cachedTime && Date.now() - cachedTime < expireTime) {
      baseUrl = cachedUrl;
    } else {
      const source = extensionStorage.getProviderSource();
      if (!source) {
        return '';
      }

      const res = await axios.get(`${source.url}/base_url.json`, {
        timeout: 10000,
      });
      
      const baseUrlData = res.data;
      if (baseUrlData && baseUrlData[providerValue]) {
        baseUrl = baseUrlData[providerValue].url;
        cacheStorageService.setString(cacheKey, baseUrl);
        cacheStorageService.setObject(timeKey, Date.now());
      }
    }
    return baseUrl;
  } catch (error) {
    console.error(`Error fetching baseUrl: ${providerValue}`, error);
    return '';
  }
};