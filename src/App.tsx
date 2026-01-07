import React, { useEffect } from 'react';
import Home from './screens/home/Home';
import Info from './screens/home/Info';
import Player from './screens/home/Player';
import Settings from './screens/settings/Settings';
import WatchList from './screens/WatchList';
import Search from './screens/Search';
import ScrollList from './screens/ScrollList';
import {
  NavigationContainer,
  createNavigationContainerRef,
  NavigatorScreenParams
} from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Ionicons from '@expo/vector-icons/Ionicons';
import Entypo from '@expo/vector-icons/Entypo';
import 'react-native-reanimated';
import 'react-native-gesture-handler';
import WebView from './screens/WebView';
import SearchResults from './screens/SearchResults';
import * as SystemUI from 'expo-system-ui';
// import DisableProviders from './screens/settings/DisableProviders';
import About, { checkForUpdate, downloadUpdate } from './screens/settings/About';
import BootSplash from 'react-native-bootsplash';
import { enableFreeze, enableScreens } from 'react-native-screens';
import Preferences from './screens/settings/Preference';
import Production from './screens/settings/Production';
import useThemeStore from './lib/zustand/themeStore';
import { Dimensions, LogBox, ViewStyle, AppState, Linking, Alert, View, Text, Modal, TouchableOpacity, Image, Platform, StatusBar } from 'react-native';
import IOSModal from './components/IOSModal';
import { EpisodeLink } from './lib/providers/types';
import RNReactNativeHapticFeedback from 'react-native-haptic-feedback';
import TabBarBackgound from './components/TabBarBackgound';
import { BlurView } from 'expo-blur';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StyleProp } from 'react-native';
import Animated from 'react-native-reanimated';
import Downloads from './screens/settings/Downloads';
import SeriesEpisodes from './screens/settings/SeriesEpisodes';
import WatchHistory from './screens/WatchHistory';
import SubtitlePreference from './screens/settings/SubtitleSettings';
import Extensions from './screens/settings/Extensions';
import Constants from 'expo-constants';
import { settingsStorage } from './lib/storage';
import { updateProvidersService } from './lib/services/UpdateProviders';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/client';
import GlobalErrorBoundary from './components/GlobalErrorBoundary';
import notifee, { EventDetail, EventType } from '@notifee/react-native';
import notificationService from './lib/services/Notification';
import Suggestion from './screens/Suggestion';
import { OneSignal } from 'react-native-onesignal';
import { checkNotifications, openSettings, RESULTS, check, request, PERMISSIONS } from 'react-native-permissions';
import { MaterialIcons } from '@expo/vector-icons';
import useAppModeStore from './lib/zustand/appModeStore';
import DoodleTVStack from './navigation/DoodleTVStack';
import TVFocusWrapper from './components/TVFocusWrapper';
import useSettingsStore from './lib/zustand/settingsStore';

// Lazy-load Firebase modules so app runs without google-services files
// eslint-disable-next-line @typescript-eslint/no-explicit-any


enableScreens(true);
enableFreeze(true);

const isLargeScreen = Dimensions.get('window').width > 768;
import { initDownloadChannel } from './lib/downloader';


export type HomeStackParamList = {
  Home: undefined;
  Info: { link: string; provider?: string; poster?: string };
  ScrollList: {
    filter: string;
    title?: string;
    providerValue?: string;
    isSearch: boolean;
  };
  GenreList: {
    filter: string;
    title?: string;
    providerValue?: string;
    genre: string;
  };
  Webview: { link: string };
};

export type RootStackParamList = {
  TabStack:
  | {
    screen?: keyof TabStackParamList;
    params?: {
      screen?: string;
      params?: {
        screen?: string;
        params?: any;
      };
    };
  }
  | undefined;
  Player: {
    linkIndex: number;
    episodeList: EpisodeLink[];
    directUrl?: string;
    type: string;
    primaryTitle?: string;
    secondaryTitle?: string;
    poster: {
      logo?: string;
      poster?: string;
      background?: string;
    };
    file?: string;
    providerValue?: string;
    infoUrl?: string;
    roomId?: string;
    syncLink?: boolean;
    server?: any;
  };
};

export type DoodleTVStackParamList = {
  LiveTVScreen: undefined;
  TVPlayerScreen: {
    streamUrl: string;
    poster: string;
    title: string;
    subtitle?: string;
  };
  DoodleTVSettingsScreen: undefined;
};

export type DoodleTVRootStackParamList = {
  DoodleTVStack: NavigatorScreenParams<DoodleTVStackParamList>;
};

export type SearchStackParamList = {
  Search: undefined;
  ScrollList: {
    filter: string;
    title?: string;
    providerValue?: string;
    isSearch: boolean;
  };
  GenreList: {
    filter: string;
    title?: string;
    providerValue?: string;
    genre: string;
  };
  Info: { link: string; provider?: string; poster?: string };
  SearchResults: { filter: string; availableProviders?: string[] };
};

export type WatchListStackParamList = {
  WatchList: undefined;
  Info: { link: string; provider?: string; poster?: string };
};

export type WatchHistoryStackParamList = {
  WatchHistory: undefined;
  Info: { link: string; provider?: string; poster?: string };
  SeriesEpisodes: {
    series: string;
    episodes: Array<{ uri: string; size: number }>;
    thumbnails: Record<string, string>;
  };
};

export type SettingsStackParamList = {
  Settings: undefined;
  DisableProviders: undefined;
  About: undefined;
  Preferences: undefined;
  Downloads: undefined;
  WatchHistoryStack: undefined;
  SubTitlesPreferences: undefined;
  Extensions: undefined;
  Production: undefined;
};

export type TabStackParamList = {
  HomeStack: undefined;
  SearchStack: undefined;
  WatchListStack: undefined;
  SettingsStack: undefined;
};
const Tab = createBottomTabNavigator<TabStackParamList>();
const DoodleTVRootStack = createNativeStackNavigator<DoodleTVRootStackParamList>();

export const navigationRef = createNavigationContainerRef<RootStackParamList>();
const App = () => {
  LogBox.ignoreLogs([
    'You have passed a style to FlashList',
    'new NativeEventEmitter()',
  ]);
  const HomeStack = createNativeStackNavigator<HomeStackParamList>();
  const Stack = createNativeStackNavigator<RootStackParamList>();
  const SearchStack = createNativeStackNavigator<SearchStackParamList>();
  const WatchListStack = createNativeStackNavigator<WatchListStackParamList>();
  const SettingsStack = createNativeStackNavigator<SettingsStackParamList>();
  const WatchHistoryStack =
    createNativeStackNavigator<WatchHistoryStackParamList>();
  const { primary } = useThemeStore(state => state);
  const { appMode } = useAppModeStore(state => state);
  const hasFirebase = Boolean(Constants?.expoConfig?.extra?.hasFirebase);

  const [showNotificationModal, setShowNotificationModal] = React.useState(false);
  const [updateData, setUpdateData] = React.useState<any>(null);

  const performUpdate = () => {
    if (!updateData) return;

    setUpdateData(null); // Close modal

    const autoDownload = settingsStorage.isAutoDownloadEnabled();

    if (autoDownload) {
      downloadUpdate(
        updateData?.assets?.[2]?.browser_download_url,
        updateData.assets?.[2]?.name,
      );
    } else {
      Linking.openURL(updateData.play_store_url || 'https://doodlemovies.vercel.app');
    }
  };
  const showTabBarLabels = settingsStorage.showTabBarLabels();

  SystemUI.setBackgroundColorAsync('black');

  useEffect(() => {
    const checkNotificationPermission = async () => {
      try {
        const status = await check(PERMISSIONS.ANDROID.POST_NOTIFICATIONS);
        if (status === RESULTS.DENIED) {
          setShowNotificationModal(true);
        }
      } catch (e) {
        console.log('Permission check failed:', e);
      }
    };
    checkNotificationPermission();
  }, []);

  const handleAllowNotifications = async () => {
    const result = await request(PERMISSIONS.ANDROID.POST_NOTIFICATIONS);
    if (result === RESULTS.GRANTED) {
      setShowNotificationModal(false);
      settingsStorage.setNotificationsEnabled(true);
    } else {
      setShowNotificationModal(false); // Close modal even if denied
    }
    // Request Microphone Permission for Voice Chat
    if (Platform.OS === 'android') {
      await request(PERMISSIONS.ANDROID.RECORD_AUDIO);

      // Request Photos & Videos Permission
      if (Number(Platform.Version) >= 33) {
        await request(PERMISSIONS.ANDROID.READ_MEDIA_IMAGES);
        await request(PERMISSIONS.ANDROID.READ_MEDIA_VIDEO);
      } else {
        await request(PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE);
        await request(PERMISSIONS.ANDROID.WRITE_EXTERNAL_STORAGE);
      }
    }
  };

  // OneSignal initialization for push notifications
  useEffect(() => {
    try {
      // Replace with your own OneSignal App ID
      const ONESIGNAL_APP_ID = '33555240-9f97-4e91-8543-bbdd2f15fe38';

      // Initialize OneSignal
      OneSignal.initialize(ONESIGNAL_APP_ID);

      // Explicitly opt-in to ensure "Unsubscribed" status is cleared
      OneSignal.User.pushSubscription.optIn();

      // Debug: Log subscription state changes
      OneSignal.User.pushSubscription.addEventListener('change', subscription => {
        console.log('OneSignal subscription changed:', subscription);
      });

      // When a notification is received in foreground
      OneSignal.Notifications.addEventListener('foregroundWillDisplay', (event: any) => {
        const notif = event.getNotification();

        // Android small icon override (Match VegaNext logic)
        if (Platform.OS === 'android') {
          if (notif.android) {
            notif.android.smallIcon = 'ic_stat_onesignal_default';
          }
        }

        console.log('OneSignal foreground notification:', notif);
      });

      // When a notification is opened by the user
      OneSignal.Notifications.addEventListener('click', (event: any) => {
        console.log('OneSignal notification opened:', event);
      });

      console.log('OneSignal initialized with app id:', ONESIGNAL_APP_ID);
    } catch (err) {
      console.error('OneSignal init error:', err);
    }
  }, []); // runs once only

  /* ----------------- UUID & user ping ----------------- */
  const generateUUID = () => {
    const S4 = () =>
      (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
    return (
      S4() +
      S4() +
      '-' +
      S4() +
      '-' +
      S4() +
      '-' +
      S4() +
      '-' +
      S4() +
      S4() +
      S4()
    );
  };

  const sendUserPing = async () => {
    const API_URL = 'http://10.0.2.2:3000/api/user-ping';
    try {
      let userId = null;
      // Note: Application.androidId might need different import or Expo equivalent
      // VegaNext uses expo-application, assuming we have it.
      if (Platform.OS === 'android') {
        userId = Constants.installationId; // Use Expo constants as fallback or Application.androidId if available
      } else if (Platform.OS === 'ios') {
        userId = await Constants.getWebViewUserAgentAsync(); // Placeholder, normally Application.getIosIdForVendorAsync()
      }

      if (!userId) userId = generateUUID();

      const pingData = { userId, platform: Platform.OS };

      // Ensure fetch doesn't crash if no server
      await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pingData),
      }).catch(e => console.log("User ping failed (expected if no local server)", e.message));

      console.log('User activity logged successfully.');
    } catch (error) {
      console.error('Failed to log user activity:', error);
    }
  };

  useEffect(() => {
    try {
      sendUserPing();
    } catch (e) { }
  }, []);

  // Initialize update service
  useEffect(() => {
    // Start automatic update checking at app startup
    updateProvidersService.startAutomaticUpdateCheck();

    // Cleanup on unmount
    return () => {
      updateProvidersService.stopAutomaticUpdateCheck();
    };
  }, []);



  function HomeStackScreen() {
    return (
      <HomeStack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'ios_from_right',
          animationDuration: 200,
          freezeOnBlur: true,
        }}>
        <HomeStack.Screen name="Home" component={Home} />
        <HomeStack.Screen name="Info" component={Info} />
        <HomeStack.Screen name="ScrollList" component={ScrollList} />
        <HomeStack.Screen name="GenreList" component={ScrollList} />
        <HomeStack.Screen name="Webview" component={WebView} />
      </HomeStack.Navigator>
    );
  }

  function SearchStackScreen() {
    return (
      <SearchStack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'ios_from_right',
          animationDuration: 200,
          freezeOnBlur: true,
        }}>
        <SearchStack.Screen name="Search" component={Search} />
        <SearchStack.Screen name="ScrollList" component={ScrollList} />
        <HomeStack.Screen name="GenreList" component={ScrollList} />
        <SearchStack.Screen name="Info" component={Info} />
        <Stack.Screen name="Suggestion" component={Suggestion} />
        <SearchStack.Screen name="SearchResults" component={SearchResults} />
        <HomeStack.Screen name="Webview" component={WebView} />
      </SearchStack.Navigator>
    );
  }

  function WatchListStackScreen() {
    return (
      <WatchListStack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'ios_from_right',
          animationDuration: 200,
          freezeOnBlur: true,
        }}>
        <WatchListStack.Screen name="WatchList" component={WatchList} />
        <WatchListStack.Screen name="Info" component={Info} />
      </WatchListStack.Navigator>
    );
  }

  function WatchHistoryStackScreen() {
    return (
      <WatchHistoryStack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'ios_from_right',
          animationDuration: 200,
          freezeOnBlur: true,
        }}>
        <WatchHistoryStack.Screen
          name="WatchHistory"
          component={WatchHistory}
        />
        <WatchHistoryStack.Screen name="Info" component={Info} />
        <WatchHistoryStack.Screen
          name="SeriesEpisodes"
          component={SeriesEpisodes}
        />
      </WatchHistoryStack.Navigator>
    );
  }

  function SettingsStackScreen() {
    return (
      <SettingsStack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'ios_from_right',
          animationDuration: 200,
          freezeOnBlur: true,
        }}>
        <SettingsStack.Screen name="Settings" component={Settings} />
        {/* <SettingsStack.Screen
          name="DisableProviders"
          component={DisableProviders}
        /> */}
        <SettingsStack.Screen name="Production" component={Production} />
        <SettingsStack.Screen name="About" component={About} />
        <SettingsStack.Screen name="Preferences" component={Preferences} />
        <SettingsStack.Screen name="Downloads" component={Downloads} />
        <SettingsStack.Screen name="Extensions" component={Extensions} />
        <SettingsStack.Screen
          name="WatchHistoryStack"
          component={WatchHistoryStackScreen}
        />
        <SettingsStack.Screen
          name="SubTitlesPreferences"
          component={SubtitlePreference}
        />
      </SettingsStack.Navigator>
    );
  }
  function TabStack() {
    return (
      <Tab.Navigator
        detachInactiveScreens={true}
        screenOptions={{
          animation: 'shift',
          tabBarLabelPosition: 'below-icon',
          tabBarVariant: isLargeScreen ? 'material' : 'uikit',
          popToTopOnBlur: false,
          tabBarPosition: isLargeScreen ? 'left' : 'bottom',
          headerShown: false,
          freezeOnBlur: true,
          tabBarActiveTintColor: primary,
          tabBarInactiveTintColor: '#dadde3',
          tabBarShowLabel: showTabBarLabels,
          tabBarStyle: !isLargeScreen
            ? {
              // Re-adding absolute positioning properties
              position: 'absolute', // <--- Re-add
              bottom: 0, // <--- Re-add
              left: 0, // <--- Ensure coverage
              right: 0, // <--- Ensure coverage

              height: 72, // Use adjusted height
              borderRadius: 0,
              // backgroundColor: 'rgba(0, 0, 0, 0.8)',
              overflow: 'hidden',
              elevation: 0,
              borderTopWidth: 0,
              paddingHorizontal: 0,
              paddingTop: 5,
            }
            : {},
          tabBarBackground: () => <TabBarBackgound />,
          tabBarHideOnKeyboard: true,
          tabBarButton: props => {
            return (
              <TVFocusWrapper
                accessibilityRole="button"
                accessibilityState={props.accessibilityState}
                style={props.style as StyleProp<ViewStyle>}
                onPress={e => {
                  props.onPress && props.onPress(e);
                  if (
                    !props?.accessibilityState?.selected &&
                    settingsStorage.isHapticFeedbackEnabled()
                  ) {
                    RNReactNativeHapticFeedback.trigger('effectTick', {
                      enableVibrateFallback: true,
                      ignoreAndroidSystemSettings: false,
                    });
                  }
                }}>
                {props.children}
              </TVFocusWrapper>
            );
          },
        }}>
        <Tab.Screen
          name="HomeStack"
          component={HomeStackScreen}
          options={{
            title: 'Home',
            tabBarIcon: ({ focused, color, size }) => (
              <Animated.View
                style={{
                  transform: [{ scale: focused ? 1.1 : 1 }],
                }}>
                {focused ? (
                  <Ionicons name="home" color={color} size={size} />
                ) : (
                  <Ionicons name="home-outline" color={color} size={size} />
                )}
              </Animated.View>
            ),
          }}
        />
        <Tab.Screen
          name="SearchStack"
          component={SearchStackScreen}
          options={{
            title: 'Search',
            tabBarIcon: ({ focused, color, size }) => (
              <Animated.View
                style={{
                  transform: [{ scale: focused ? 1.1 : 1 }],
                }}>
                {focused ? (
                  <Ionicons name="search" color={color} size={size} />
                ) : (
                  <Ionicons name="search-outline" color={color} size={size} />
                )}
              </Animated.View>
            ),
          }}
        />
        <Tab.Screen
          name="WatchListStack"
          component={WatchListStackScreen}
          options={{
            title: 'Watch List',
            tabBarIcon: ({ focused, color, size }) => (
              <Animated.View
                style={{
                  transform: [{ scale: focused ? 1.1 : 1 }],
                }}>
                {focused ? (
                  <Entypo name="folder-video" color={color} size={size} />
                ) : (
                  <Entypo name="folder-video" color={color} size={size} />
                )}
              </Animated.View>
            ),
          }}
        />
        <Tab.Screen
          name="SettingsStack"
          component={SettingsStackScreen}
          options={{
            title: 'Settings',
            tabBarIcon: ({ focused, color, size }) => (
              <Animated.View
                style={{
                  transform: [{ scale: focused ? 1.1 : 1 }],
                }}>
                {focused ? (
                  <Ionicons name="settings" color={color} size={size} />
                ) : (
                  <Ionicons name="settings-outline" color={color} size={size} />
                )}
              </Animated.View>
            ),
          }}
        />
      </Tab.Navigator>
    );
  }

  useEffect(() => {
    if (settingsStorage.isAutoCheckUpdateEnabled()) {
      checkForUpdate((loading) => { }, false).then((data) => {
        if (data) {
          setUpdateData(data);
        }
      });
    }
  }, []);

  function DoodleTVRootStackScreen() {
    return (
      <DoodleTVRootStack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'ios_from_right',
          animationDuration: 200,
          freezeOnBlur: true,
          contentStyle: { backgroundColor: 'transparent' },
        }}>
        <DoodleTVRootStack.Screen
          name="DoodleTVStack"
          component={DoodleTVStack}
        />
      </DoodleTVRootStack.Navigator>
    );
  }

  function VideoRootStackScreen() {
    return (
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'ios_from_right',
          animationDuration: 200,
          freezeOnBlur: true,
          contentStyle: { backgroundColor: 'transparent' },
        }}>
        <Stack.Screen name="TabStack" component={TabStack} />
        <Stack.Screen
          name="Player"
          component={Player}
          options={{ orientation: 'landscape' }}
        />
      </Stack.Navigator>
    );
  }

  return (
    <GlobalErrorBoundary>
      <SafeAreaProvider>
        <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
        <QueryClientProvider client={queryClient}>
          <SafeAreaView
            edges={{
              right: 'off',
              top: 'off',
              left: 'off',
              bottom: 'additive',
            }}
            className="flex-1"
            style={{ backgroundColor: 'black' }}>
            <NavigationContainer
              ref={navigationRef}
              onReady={async () => {
                // Hide bootsplash
                await BootSplash.hide({ fade: true });
                // Track initial screen
                if (hasFirebase) {
                  try {
                    const route = navigationRef.getCurrentRoute();
                    if (route?.name) {
                      // const analytics = getAnalytics();
                      // analytics &&
                      //   (await analytics().logScreenView({
                      //     screen_name: route.name,
                      //     screen_class: 'Navigation',
                      //   }));
                    }
                  } catch { }
                }
              }}
              onStateChange={async () => {
                if (hasFirebase) {
                  try {
                    const route = navigationRef.getCurrentRoute();
                    if (route?.name) {
                      // const analytics = getAnalytics();
                      // analytics &&
                      //   (await analytics().logScreenView({
                      //     screen_name: route.name,
                      //     screen_class: 'Navigation',
                      //   }));
                    }
                  } catch { }
                }
              }}
              theme={{
                fonts: {
                  regular: {
                    fontFamily: 'Inter_400Regular',
                    fontWeight: '400',
                  },
                  medium: {
                    fontFamily: 'Inter_500Medium',
                    fontWeight: '500',
                  },
                  bold: {
                    fontFamily: 'Inter_700Bold',
                    fontWeight: '700',
                  },
                  heavy: {
                    fontFamily: 'Inter_800ExtraBold',
                    fontWeight: '800',
                  },
                },
                dark: true,
                colors: {
                  background: 'transparent',
                  card: 'black',
                  primary: primary,
                  text: 'white',
                  border: 'black',
                  notification: primary,
                },
              }}>
              {appMode === 'doodleTv' ? (
                <DoodleTVRootStackScreen />
              ) : (
                <VideoRootStackScreen />
              )}
            </NavigationContainer>
          </SafeAreaView>
        </QueryClientProvider>
      </SafeAreaProvider>
      <IOSModal
        visible={showNotificationModal}
        title="DoodleMovies Needs Some Permissions"
        message="For the best experience (Voice Chat, Downloads, Updates), please allow access to Notifications, Microphone, and Photos/Videos."
        actions={[
          { text: "Allow", onPress: handleAllowNotifications },
          { text: "Don't Allow", style: 'cancel', onPress: () => setShowNotificationModal(false) }
        ]}
        onClose={() => setShowNotificationModal(false)}
      />

      {/* App Update Modal */}
      <IOSModal
        visible={!!updateData}
        title={`Update Available: ${updateData?.tag_name}`}
        message={updateData?.body || 'A new version of the app is available.'}
        actions={[
          { text: "Update Now", onPress: performUpdate },
          { text: "Later", style: 'cancel', onPress: () => setUpdateData(null) }
        ]}
        onClose={() => setUpdateData(null)}
      />
    </GlobalErrorBoundary>
  );
};

export default App;
