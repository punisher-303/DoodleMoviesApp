import { mainStorage } from './StorageService';

/**
 * Storage keys for settings
 */
export enum SettingsKeys {
  // UI preferences
  PRIMARY_COLOR = 'primaryColor',
  IS_CUSTOM_THEME = 'isCustomTheme',
  SHOW_TAB_BAR_LABELS = 'showTabBarLabels',
  CUSTOM_COLOR = 'customColor',
  // Feedback settings
  HAPTIC_FEEDBACK = 'hapticFeedback',
  NOTIFICATIONS_ENABLED = 'notificationsEnabled',

  // Update settings
  AUTO_CHECK_UPDATE = 'autoCheckUpdate',
  AUTO_DOWNLOAD = 'autoDownload',

  // Player settings
  SHOW_MEDIA_CONTROLS = 'showMediaControls',
  SHOW_HAMBURGER_MENU = 'showHamburgerMenu',
  HIDE_SEEK_BUTTONS = 'hideSeekButtons',
  ENABLE_2X_GESTURE = 'enable2xGesture',
  ENABLE_SWIPE_GESTURE = 'enableSwipeGesture',

  // Quality settings
  EXCLUDED_QUALITIES = 'excludedQualities',

  // Subtitle settings
  SUBTITLE_FONT_SIZE = 'subtitleFontSize',
  SUBTITLE_OPACITY = 'subtitleOpacity',
  SUBTITLE_BOTTOM_PADDING = 'subtitleBottomPadding',

  LIST_VIEW_TYPE = 'viewType',

  // Telemetry (privacy)
  // Telemetry (privacy)
  TELEMETRY_OPT_IN = 'telemetryOptIn',

  // Custom Provider Source
  CUSTOM_PROVIDER_BASE_URL = 'customProviderBaseUrl',
  USE_CUSTOM_PROVIDER_BASE_URL = 'useCustomProviderBaseUrl',

  // TorrServer / Debrid
  TORR_SERVER_URL = 'torrServerUrl',
  USE_DEBRID = 'useDebrid',
  DEBRID_SERVICE = 'debridService',
  RD_ACCESS_TOKEN = 'rdAccessToken',
  RD_REFRESH_TOKEN = 'rdRefreshToken',
  RD_TOKEN_EXPIRY = 'rdTokenExpiry',
  TORBOX_KEY = 'torboxKey',
}

/**
 * Settings storage manager
 */
export class SettingsStorage {
  // Theme settings
  getPrimaryColor(): string {
    return mainStorage.getString(SettingsKeys.PRIMARY_COLOR) || '#E50914';
  }

  setPrimaryColor(color: string): void {
    mainStorage.setString(SettingsKeys.PRIMARY_COLOR, color);
  }

  isCustomTheme(): boolean {
    return mainStorage.getBool(SettingsKeys.IS_CUSTOM_THEME);
  }

  setCustomTheme(isCustom: boolean): void {
    mainStorage.setBool(SettingsKeys.IS_CUSTOM_THEME, isCustom);
  }

  getCustomColor(): string {
    return mainStorage.getString(SettingsKeys.CUSTOM_COLOR) || '#E50914';
  }

  setCustomColor(color: string): void {
    mainStorage.setString(SettingsKeys.CUSTOM_COLOR, color);
  }

  // UI preferences
  showTabBarLabels(): boolean {
    return this.getBool(SettingsKeys.SHOW_TAB_BAR_LABELS, true);
  }

  setShowTabBarLabels(show: boolean): void {
    mainStorage.setBool(SettingsKeys.SHOW_TAB_BAR_LABELS, show);
  }

  isHapticFeedbackEnabled(): boolean {
    return mainStorage.getBool(SettingsKeys.HAPTIC_FEEDBACK) === null
      ? true
      : mainStorage.getBool(SettingsKeys.HAPTIC_FEEDBACK);
  }
  setHapticFeedbackEnabled(enabled: boolean): void {
    mainStorage.setBool(SettingsKeys.HAPTIC_FEEDBACK, enabled);
  }

  isNotificationsEnabled(): boolean {
    return mainStorage.getBool(SettingsKeys.NOTIFICATIONS_ENABLED) === null
      ? true
      : mainStorage.getBool(SettingsKeys.NOTIFICATIONS_ENABLED);
  }

  setNotificationsEnabled(enabled: boolean): void {
    mainStorage.setBool(SettingsKeys.NOTIFICATIONS_ENABLED, enabled);
  }

  // Update settings
  isAutoCheckUpdateEnabled(): boolean {
    return mainStorage.getBool(SettingsKeys.AUTO_CHECK_UPDATE) === null
      ? true
      : mainStorage.getBool(SettingsKeys.AUTO_CHECK_UPDATE);
  }

  setAutoCheckUpdateEnabled(enabled: boolean): void {
    mainStorage.setBool(SettingsKeys.AUTO_CHECK_UPDATE, enabled);
  }

  isAutoDownloadEnabled(): boolean {
    return mainStorage.getBool(SettingsKeys.AUTO_DOWNLOAD);
  }

  setAutoDownloadEnabled(enabled: boolean): void {
    mainStorage.setBool(SettingsKeys.AUTO_DOWNLOAD, enabled);
  }

  // Player settings
  showMediaControls(): boolean {
    return mainStorage.getBool(SettingsKeys.SHOW_MEDIA_CONTROLS) === null
      ? true
      : mainStorage.getBool(SettingsKeys.SHOW_MEDIA_CONTROLS);
  }

  setShowMediaControls(show: boolean): void {
    mainStorage.setBool(SettingsKeys.SHOW_MEDIA_CONTROLS, show);
  }

  showHamburgerMenu(): boolean {
    return mainStorage.getBool(SettingsKeys.SHOW_HAMBURGER_MENU) === null
      ? true
      : mainStorage.getBool(SettingsKeys.SHOW_HAMBURGER_MENU);
  }

  setShowHamburgerMenu(show: boolean): void {
    mainStorage.setBool(SettingsKeys.SHOW_HAMBURGER_MENU, show);
  }

  hideSeekButtons(): boolean {
    return mainStorage.getBool(SettingsKeys.HIDE_SEEK_BUTTONS);
  }

  setHideSeekButtons(hide: boolean): void {
    mainStorage.setBool(SettingsKeys.HIDE_SEEK_BUTTONS, hide);
  }

  isEnable2xGestureEnabled(): boolean {
    return mainStorage.getBool(SettingsKeys.ENABLE_2X_GESTURE);
  }

  setEnable2xGesture(enabled: boolean): void {
    mainStorage.setBool(SettingsKeys.ENABLE_2X_GESTURE, enabled);
  }

  isSwipeGestureEnabled(): boolean {
    return mainStorage.getBool(SettingsKeys.ENABLE_SWIPE_GESTURE, true) === null
      ? true
      : mainStorage.getBool(SettingsKeys.ENABLE_SWIPE_GESTURE, true);
  }

  setSwipeGestureEnabled(enabled: boolean): void {
    mainStorage.setBool(SettingsKeys.ENABLE_SWIPE_GESTURE, enabled);
  }

  // Quality settings
  getExcludedQualities(): string[] {
    return mainStorage.getArray<string>(SettingsKeys.EXCLUDED_QUALITIES) || [];
  }

  setExcludedQualities(qualities: string[]): void {
    mainStorage.setArray(SettingsKeys.EXCLUDED_QUALITIES, qualities);
  }

  // Subtitle settings
  getSubtitleFontSize(): number {
    return mainStorage.getNumber(SettingsKeys.SUBTITLE_FONT_SIZE) || 16;
  }

  setSubtitleFontSize(size: number): void {
    mainStorage.setNumber(SettingsKeys.SUBTITLE_FONT_SIZE, size);
  }

  getSubtitleOpacity(): number {
    const opacityStr = mainStorage.getString(SettingsKeys.SUBTITLE_OPACITY);
    return opacityStr ? parseFloat(opacityStr) : 1;
  }

  setSubtitleOpacity(opacity: number): void {
    mainStorage.setString(SettingsKeys.SUBTITLE_OPACITY, opacity.toString());
  }

  getSubtitleBottomPadding(): number {
    return mainStorage.getNumber(SettingsKeys.SUBTITLE_BOTTOM_PADDING) || 10;
  }

  setSubtitleBottomPadding(padding: number): void {
    mainStorage.setNumber(SettingsKeys.SUBTITLE_BOTTOM_PADDING, padding);
  }

  getListViewType(): number {
    return parseInt(
      mainStorage.getString(SettingsKeys.LIST_VIEW_TYPE) || '1',
      10,
    );
  }

  setListViewType(type: number): void {
    mainStorage.setString(SettingsKeys.LIST_VIEW_TYPE, type.toString());
  }

  // Telemetry / Privacy
  // Telemetry (privacy)
  isTelemetryOptIn(): boolean {
    const val = mainStorage.getBool(SettingsKeys.TELEMETRY_OPT_IN);
    // Default to true (opted in) unless explicitly disabled
    return val === null ? true : (val as boolean);
  }

  setTelemetryOptIn(enabled: boolean): void {
    mainStorage.setBool(SettingsKeys.TELEMETRY_OPT_IN, enabled);
  }

  // Network Settings
  getUserAgent(): string {
    return mainStorage.getString('UserAgent') || '';
  }

  setUserAgent(ua: string): void {
    mainStorage.setString('UserAgent', ua);
  }

  getDnsUrl(): string {
    return mainStorage.getString('DnsUrl') || '';
  }

  setDnsUrl(url: string): void {
    mainStorage.setString('DnsUrl', url);
  }

  getCustomProviderBaseUrl(): string {
    return mainStorage.getString(SettingsKeys.CUSTOM_PROVIDER_BASE_URL) ||
      'https://raw.githubusercontent.com/punisher-303/doodle-providers/refs/heads/main';
  }

  setCustomProviderBaseUrl(url: string): void {
    mainStorage.setString(SettingsKeys.CUSTOM_PROVIDER_BASE_URL, url);
  }

  isUsingCustomProviderBaseUrl(): boolean {
    return mainStorage.getBool(SettingsKeys.USE_CUSTOM_PROVIDER_BASE_URL) === true;
  }

  setUseCustomProviderBaseUrl(enabled: boolean): void {
    mainStorage.setBool(SettingsKeys.USE_CUSTOM_PROVIDER_BASE_URL, enabled);
  }

  // Generic get/set methods for settings not covered by specific methods
  getBool(key: string, defaultValue = false): boolean {
    return mainStorage.getBool(key, defaultValue);
  }

  setBool(key: string, value: boolean): void {
    mainStorage.setBool(key, value);
  }

  getTorrServerUrl(): string {
    const savedUrl = mainStorage.getString(SettingsKeys.TORR_SERVER_URL);
    if (savedUrl && savedUrl !== 'http://localhost:8090') {
      return savedUrl;
    }
    // Zero-Config Fallback: If local is default or empty, return localhost but hint at bridge
    return savedUrl || 'http://127.0.0.1:8090';
  }

  getPublicTorrServerBridge(): string {
    // Return a reliable public bridge as a fallback
    return 'https://torr.pw'; // Example public bridge
  }

  setTorrServerUrl(url: string): void {
    mainStorage.setString(SettingsKeys.TORR_SERVER_URL, url);
  }

  isDebridEnabled(): boolean {
    return mainStorage.getBool(SettingsKeys.USE_DEBRID) === true;
  }

  setDebridEnabled(enabled: boolean): void {
    mainStorage.setBool(SettingsKeys.USE_DEBRID, enabled);
  }

  getDebridService(): string {
    return mainStorage.getString(SettingsKeys.DEBRID_SERVICE) || 'None';
  }

  setDebridService(service: string): void {
    mainStorage.setString(SettingsKeys.DEBRID_SERVICE, service);
  }

  getRealDebridToken(): string | null {
    return mainStorage.getString(SettingsKeys.RD_ACCESS_TOKEN);
  }

  setRealDebridToken(token: string): void {
    mainStorage.setString(SettingsKeys.RD_ACCESS_TOKEN, token);
  }

  getRealDebridRefreshToken(): string | null {
    return mainStorage.getString(SettingsKeys.RD_REFRESH_TOKEN);
  }

  setRealDebridRefreshToken(token: string): void {
    mainStorage.setString(SettingsKeys.RD_REFRESH_TOKEN, token);
  }

  getRealDebridExpiry(): string | null {
    return mainStorage.getString(SettingsKeys.RD_TOKEN_EXPIRY);
  }

  setRealDebridExpiry(expiry: string): void {
    mainStorage.setString(SettingsKeys.RD_TOKEN_EXPIRY, expiry);
  }

  getTorBoxKey(): string | null {
    return mainStorage.getString(SettingsKeys.TORBOX_KEY);
  }

  setTorBoxKey(key: string): void {
    mainStorage.setString(SettingsKeys.TORBOX_KEY, key);
  }
}

// Export a singleton instance
export const settingsStorage = new SettingsStorage();