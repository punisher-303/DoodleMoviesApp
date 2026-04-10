import {MMKVLoader} from 'react-native-mmkv-storage';

/**
 * Interface for the StorageService class
 */
export interface IStorageService {
  getString(key: string): string | undefined;
  setString(key: string, value: string): void;
  getBool(key: string, defaultValue?: boolean): boolean;
  setBool(key: string, value: boolean): void;
  getNumber(key: string): number | undefined;
  setNumber(key: string, value: number): void;
  getObject<T>(key: string): T | undefined;
  setObject<T>(key: string, value: T): void;
  getArray<T>(key: string): T[] | undefined;
  setArray<T>(key: string, value: T[]): void;
  delete(key: string): void;
  contains(key: string): boolean;
  clearAll(): void;
}

/**
 * Base storage service that wraps MMKV operations
 */
export class StorageService implements IStorageService {
  private storage;

  constructor(instanceId?: string) {
    const loader = new MMKVLoader();
    this.storage = instanceId
      ? loader.withInstanceID(instanceId).initialize()
      : loader.initialize();
  }

  getString(key: string): string | undefined {
    return this.storage.getString(key);
  }

  setString(key: string, value: string): void {
    this.storage.setString(key, value);
  }

  getBool(key: string, defaultValue?: boolean): boolean {
    const value = this.storage.getBool(key);
    return value === undefined ? defaultValue || false : value;
  }

  setBool(key: string, value: boolean): void {
    this.storage.setBool(key, value);
  }

  getNumber(key: string): number | undefined {
    return this.storage.getInt(key);
  }

  setNumber(key: string, value: number): void {
    this.storage.setInt(key, value);
  }

  getObject<T>(key: string): T | undefined {
    const json = this.storage.getString(key);
    if (!json) return undefined;
    try {
      return JSON.parse(json) as T;
    } catch (e) {
      console.error(`Failed to parse stored object for key ${key}:`, e);
      return undefined;
    }
  }

  setObject<T>(key: string, value: T): void {
    this.storage.setString(key, JSON.stringify(value));
  }

  getArray<T>(key: string): T[] | undefined {
    return this.getObject<T[]>(key);
  }

  setArray<T>(key: string, value: T[]): void {
    this.setObject(key, value);
  }

  delete(key: string): void {
    this.storage.removeItem(key);
  }

  contains(key: string): boolean {
    return (
      this.storage.getString(key) !== undefined ||
      this.storage.getBool(key) !== undefined ||
      this.storage.getInt(key) !== undefined
    );
  }

  clearAll(): void {
    this.storage.clearStore();
  }
}

// ─────────────────────────────────────────────────────────────
// Per-user storage manager (Performance & Security Imporvement from VegaNext)
// ─────────────────────────────────────────────────────────────

const GUEST_PARTITION = 'main';
const CACHE_PARTITION = 'cache';

class UserStorageService {
  private _userId: string | null = null;
  private _main: IStorageService = new StorageService(GUEST_PARTITION);
  private _cache: IStorageService = new StorageService(CACHE_PARTITION);

  setCurrentUser(userId: string | null): void {
    this._userId = userId;
    if (userId) {
      this._main = new StorageService(`user-main-${userId}`);
      this._cache = new StorageService(`user-cache-${userId}`);
    } else {
      this._main = new StorageService(GUEST_PARTITION);
      this._cache = new StorageService(CACHE_PARTITION);
    }
  }

  get main(): IStorageService { return this._main; }
  get cache(): IStorageService { return this._cache; }
}

export const storageService = new UserStorageService();

// Proxy re-exports to ensure zero changes needed in other files
export const mainStorage: IStorageService = new Proxy({} as IStorageService, {
  get(_target, prop: keyof IStorageService) {
    const target = storageService.main;
    const value = target[prop];
    return typeof value === 'function' ? value.bind(target) : value;
  }
});

export const cacheStorage: IStorageService = new Proxy({} as IStorageService, {
  get(_target, prop: keyof IStorageService) {
    const target = storageService.cache;
    const value = target[prop];
    return typeof value === 'function' ? value.bind(target) : value;
  }
});