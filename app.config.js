// Dynamic Expo config to make Firebase optional for public clones
// If google-services.json / GoogleService-Info.plist are absent, we skip RNFirebase plugins
// and android/ios google services config so the app still builds and runs without Firebase.

const fs = require('fs');

const hasAndroidGoogleServicesRaw =
  fs.existsSync('./google-services.json') ||
  fs.existsSync('./android/app/google-services.json');
const androidGoogleServicesFile = fs.existsSync('./google-services.json')
  ? './google-services.json'
  : './android/app/google-services.json';
const hasAndroidGoogleServices = hasAndroidGoogleServicesRaw; // Keep variable name for compatibility
const hasIosGooglePlist = fs.existsSync('./GoogleService-Info.plist');

module.exports = () => {
  const plugins = [
    './plugins/android-native-config.js',
    './plugins/with-android-notification-icons.js',
    [
      'expo-notifications',
      {
        icon: './assets/icon.png',
        color: '#ffffff',
      },
    ],
    [
      'react-native-video',
      {
        enableNotificationControls: true,
        enableAndroidPictureInPicture: true,
        androidExtensions: {
          useExoplayerRtsp: false,
          useExoplayerSmoothStreaming: true,
          useExoplayerHls: true,
          useExoplayerDash: true,
        },
      },
    ],
    [
      'react-native-edge-to-edge',
      {
        android: {
          parentTheme: 'Default',
          enforceNavigationBarContrast: false,
        },
      },
    ],
    [
      'react-native-bootsplash',
      {
        assetsDir: 'assets/bootsplash',
        android: {
          parentTheme: 'EdgeToEdge',
        },
      },
    ],
    [
      'expo-build-properties',
      {
        android: {
          extraMavenRepos: [
            '../../node_modules/@notifee/react-native/android/libs',
          ],
          // enableProguardInReleaseBuilds: true,
          // splits: {
          //   abi: {enable: true, universalApk: true},
          // },
          // buildVariants: {
          //   release: {
          //     minifyEnabled: true,
          //     shrinkResources: true,
          //     splits: {
          //       abi: {
          //         enable: true,
          //         reset: false,
          //         include: ['armeabi-v7a', 'arm64-v8a'],
          //       },
          //     },
          //   },
          //   debug: {minifyEnabled: false, debuggable: true},
          // },
        },
        ios: {},
      },
    ],
  ];

  return {
    expo: {
      name: 'Doodle',
      displayName: 'Doodle',
      newArchEnabled: true,
      autolinking: { exclude: ['expo-splash-screen'] },
      plugins,
      slug: 'doodle-movies',
      version: '10.0.1', // UPDATED VERSION TO MATCH GRADLE
      sdkVersion: '52.0.0',
      userInterfaceStyle: 'dark',
      // NEW: EAS Update configuration
      updates: {
        enabled: true,
        checkAutomatically: 'ON_LOAD',
        fallbackToCacheTimeout: 0,
        url: 'https://u.expo.dev/a223475f-349c-4f99-89d4-e051c1f3b282',
      },
      android: {
        ...(hasAndroidGoogleServices
          ? { googleServicesFile: androidGoogleServicesFile }
          : {}),
        minSdkVersion: 24,
        edgeToEdgeEnabled: true,
        package: 'com.doodle.movies',
        versionCode: 183, // UPDATED TO MATCH GRADLE
        permissions: [
          'FOREGROUND_SERVICE',
          'FOREGROUND_SERVICE_MEDIA_PLAYBACK',
          'INTERNET',
          'READ_EXTERNAL_STORAGE',
          'READ_MEDIA_VIDEO',
          'WRITE_EXTERNAL_STORAGE',
          'WRITE_SETTINGS',
        ],
        manifestPermissions: [
          { name: 'READ_EXTERNAL_STORAGE', maxSdkVersion: 32 },
          { name: 'WRITE_EXTERNAL_STORAGE', maxSdkVersion: 32 },
        ],
        intentFilters: [
          { action: 'VIEW', category: 'BROWSABLE', data: { scheme: 'com.doodle.movies' } },
        ],
        queries: [
          { action: 'VIEW', data: { scheme: 'http' } },
          { action: 'VIEW', data: { scheme: 'https' } },
          { action: 'VIEW', data: { scheme: 'vlc' } },
        ],
        config: { requestLegacyExternalStorage: true },
        allowBackup: true,
        icon: './assets/icon.png',
        adaptiveIcon: {
          foregroundImage: './assets/adaptive_icon.png',
          backgroundColor: '#000000',
        },
        launchMode: 'singleTask',
        supportsPictureInPicture: true,
      },
      ios: {
        ...(hasIosGooglePlist
          ? { googleServicesFile: './GoogleService-Info.plist' }
          : {}),
      },
      platforms: ['ios', 'android'], // FIXED: Use strings instead of variables
      // NEW: EAS project configuration
      extra: {
        eas: {
          projectId: 'a223475f-349c-4f99-89d4-e051c1f3b282'
        },
        hasFirebase: hasAndroidGoogleServices || hasIosGooglePlist,
      },
      owner: 'ghost404',
      runtimeVersion: '1.0.0',
    },
  };
};