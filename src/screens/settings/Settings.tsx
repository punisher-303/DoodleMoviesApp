import {
  View,
  Text,
  Linking,
  TouchableOpacity,
  TouchableNativeFeedback,
  ScrollView,
  Dimensions,
  Switch,
  TextInput,

  Clipboard,
  ToastAndroid,
  ActivityIndicator,
} from 'react-native';

import React, { useCallback, useMemo, useEffect, useState } from 'react';
import {
  settingsStorage,
  cacheStorageService,
  ProviderExtension,
  SettingsKeys,
} from '../../lib/storage';
import { debridService } from '../../lib/services/DebridService';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import useContentStore from '../../lib/zustand/contentStore';
import { socialLinks } from '../../lib/constants';
import {
  NativeStackScreenProps,
  NativeStackNavigationProp,
} from '@react-navigation/native-stack';
import {
  SettingsStackParamList,
  TabStackParamList,
  RootStackParamList,
} from '../../App';
import {
  MaterialCommunityIcons,
  AntDesign,
  Feather,
  MaterialIcons,
  Ionicons,
} from '@expo/vector-icons';
import useThemeStore from '../../lib/zustand/themeStore';
import useAppModeStore from '../../lib/zustand/appModeStore';
import useWatchHistoryStore from '../../lib/zustand/watchHistrory';
import Animated, { FadeInDown, FadeInUp, Layout } from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import RenderProviderFlagIcon from '../../components/RenderProviderFLagIcon';

type Props = NativeStackScreenProps<SettingsStackParamList, 'Settings'>;

// --- WATCH TOGETHER PERSISTENCE ---
const KEY_WATCH_TOGETHER = 'watchTogetherMode';

const getWatchTogetherMode = () => {
  const modeStr = cacheStorageService.getString(KEY_WATCH_TOGETHER);
  return modeStr === 'true' ? true : false;
};

const setWatchTogetherModeStorage = (mode: boolean) => {
  cacheStorageService.setString(KEY_WATCH_TOGETHER, String(mode));
};
// -----------------------------------------------------------

// --- NETWORK PROXY PERSISTENCE ---
const KEY_NETWORK_PROXY = 'networkProxyMode';

const getNetworkProxyMode = () => {
  const modeStr = cacheStorageService.getString(KEY_NETWORK_PROXY);
  return modeStr === 'true' ? true : false;
};

const setNetworkProxyModeStorage = (mode: boolean) => {
  cacheStorageService.setString(KEY_NETWORK_PROXY, String(mode));
};
// -----------------------------------------------------------


// Helper for Internal Navigation
type IconElement = React.ReactElement<{
  size?: number;
  color?: string;
  name: string;
}>;

const InternalOptionRow = React.memo(
  ({
    icon,
    text,
    onPress,
    primaryColor,
    isLast = false,
  }: {
    icon: IconElement;
    text: string;
    onPress: () => void;
    primaryColor: string;
    isLast?: boolean;
  }) => (
    <TouchableOpacity
      onPress={onPress}
      className={`flex-row items-center justify-between p-4 ${!isLast ? 'border-b border-[#262626]' : ''
        }`}>
      <View className="flex-row items-center">
        {React.cloneElement(icon, { size: 22, color: primaryColor })}
        <Text className="text-white ml-3 text-base">{text}</Text>
      </View>
      <Feather name="chevron-right" size={20} color="gray" />
    </TouchableOpacity>
  ),
);

// Helper for External Links
const ExternalLinkRow = React.memo(
  ({
    icon,
    text,
    url,
    iconColor,
    isLast = false,
  }: {
    icon: IconElement;
    text: string;
    url: string;
    iconColor: string;
    isLast?: boolean;
  }) => (
    <TouchableOpacity
      onPress={() => Linking.openURL(url)}
      className={`flex-row items-center justify-between p-4 ${!isLast ? 'border-b border-[#262626]' : ''
        }`}>
      <View className="flex-row items-center">
        {React.cloneElement(icon, { size: 22, color: iconColor })}
        <Text className="text-white ml-3 text-base">{text}</Text>
      </View>
      <Feather name="external-link" size={20} color="gray" />
    </TouchableOpacity>
  ),
);

const Settings = ({ navigation }: Props) => {
  const tabNavigation =
    useNavigation<NativeStackNavigationProp<TabStackParamList>>();
  const rootNavigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { primary } = useThemeStore(state => state);
  const { provider, setProvider, installedProviders } = useContentStore(
    state => state,
  );
  const { clearHistory } = useWatchHistoryStore(state => state);
  const { appMode, setAppMode } = useAppModeStore(state => state);

  const saveTorrServerUrl = useCallback((url: string) => {
    setTorrServerUrl(url);
    settingsStorage.setTorrServerUrl(url);
  }, []);

  const [engineError, setEngineError] = useState<string | null>(null);

  const checkEngine = useCallback(async (url: string) => {
    if (!url) return;
    console.log('[Settings] Checking engine at:', url);
    setEngineStatus('checking');
    setEngineError(null);
    try {
      // If it's the local address, we can try to start it ourselves
      if (url.includes('127.0.0.1') || url.includes('localhost')) {
        const TorrEngineService = require('../../lib/services/TorrEngineService').default;
        try {
          console.log('[Settings] Triggering ensureEngine for local address');
          const success = await TorrEngineService.ensureEngine();
          setEngineStatus(success ? 'active' : 'offline');
          if (!success) setEngineError('Engine started but not responding (Timeout)');
        } catch (err: any) {
          console.error('[Settings] engine start error:', err);
          setEngineStatus('offline');
          setEngineError(err.message || 'Start Exception');
        }
        return;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);
      const res = await fetch(`${url}/echo`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        setEngineStatus('active');
        setEngineError(null);
      } else {
        setEngineStatus('offline');
        setEngineError(`HTTP Error: ${res.status}`);
      }
    } catch (e: any) {
      setEngineStatus('offline');
      setEngineError(e.message || 'Connection Refused');
    }
  }, []);

  useEffect(() => {
    checkEngine(torrServerUrl);
  }, [torrServerUrl, checkEngine]);

  // Real-Debrid Polling
  useEffect(() => {
    let interval: any;
    if (isPollingRD && rdUserCode) {
      interval = setInterval(async () => {
        const success = await debridService.pollRDCredentials(rdUserCode);
        if (success) {
          setIsRDLoggedIn(true);
          setRdUserCode(null);
          setIsPollingRD(false);
          ToastAndroid.show('Real-Debrid Login Successful!', ToastAndroid.SHORT);
          clearInterval(interval);
        }
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [isPollingRD, rdUserCode]);

  const handleRDLogin = async () => {
    try {
      const data = await debridService.startRDLogin();
      if (data) {
        setRdUserCode(data.user_code);
        setIsPollingRD(true);
        Clipboard.setString(data.user_code);
        ToastAndroid.show(`Code ${data.user_code} copied to clipboard!`, ToastAndroid.SHORT);
      }
    } catch (error) {
       ToastAndroid.show('Failed to start login', ToastAndroid.SHORT);
    }
  };

  const logoutRD = () => {
    settingsStorage.setRealDebridToken('');
    settingsStorage.setRealDebridRefreshToken('');
    settingsStorage.setRealDebridExpiry('');
    setIsRDLoggedIn(false);
    ToastAndroid.show('Logged out from Real-Debrid', ToastAndroid.SHORT);
  };

  const handleTorBoxSave = () => {
    settingsStorage.setTorBoxKey(torboxKey);
    ToastAndroid.show('TorBox Key Saved', ToastAndroid.SHORT);
  };

  const [watchTogetherMode, setWatchTogetherMode] = useState(
    getWatchTogetherMode(),
  );
  const [networkProxyMode, setNetworkProxyMode] = useState(
    getNetworkProxyMode(),
  );
  const [syncLink, setSyncLink] = useState('');
  const [torrServerUrl, setTorrServerUrl] = useState(
    settingsStorage.getTorrServerUrl(),
  );
  const [engineStatus, setEngineStatus] = useState<'checking' | 'active' | 'offline'>('checking');
  
  // Debrid State
  const [useDebrid, setUseDebrid] = useState(settingsStorage.isDebridEnabled());
  const [selectedDebrid, setSelectedDebrid] = useState(settingsStorage.getDebridService());
  const [torboxKey, setTorboxKey] = useState(settingsStorage.getTorBoxKey() || '');
  const [rdUserCode, setRdUserCode] = useState<string | null>(null);
  const [isRDLoggedIn, setIsRDLoggedIn] = useState(!!settingsStorage.getRealDebridToken());
  const [isPollingRD, setIsPollingRD] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState('');
  const [isBridgeActive, setIsBridgeActive] = useState(false);

  useEffect(() => {
    const { NativeModules } = require('react-native');
    setIsBridgeActive(!!(NativeModules && NativeModules['TorrServerModule']));
  }, []);
  // ---------------------------------

  // --- PROVIDER LATENCY Check ---
  const [pingStatus, setPingStatus] = useState<Record<string, number | null>>({});

  useEffect(() => {
    const checkAllProviders = async () => {
      const results: Record<string, number | null> = {};

      const checkProvider = async (p: ProviderExtension) => {
        if (!p.sourceUrl) {
          results[p.value] = null;
          return;
        }

        const start = Date.now();
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s timeout

          await fetch(p.sourceUrl, {
            method: 'HEAD',
            signal: controller.signal,
            cache: 'no-cache'
          });
          clearTimeout(timeoutId);
          const end = Date.now();
          results[p.value] = end - start;
        } catch (e) {
          results[p.value] = -1; // Error/Timeout
        }
      };

      await Promise.all(installedProviders.map(checkProvider));
      setPingStatus(results);
    };

    if (installedProviders.length > 0) {
      checkAllProviders();
    }
  }, [installedProviders]);

  const getLatencyColor = (latency: number | null | undefined) => {
    if (latency === undefined || latency === null) return 'gray';
    if (latency === -1) return '#EF4444'; // Red (Error)
    if (latency < 300) return '#22C55E'; // Green (Good)
    if (latency < 800) return '#EAB308'; // Yellow (Okay)
    return '#EF4444'; // Red (Slow)
  };

  const handleProviderSelect = useCallback(
    (item: ProviderExtension) => {
      setProvider(item);
      // Add haptic feedback
      if (settingsStorage.isHapticFeedbackEnabled()) {
        ReactNativeHapticFeedback.trigger('virtualKey', {
          enableVibrateFallback: true,
          ignoreAndroidSystemSettings: false,
        });
      }
      // Navigate to home screen
      tabNavigation.navigate('HomeStack');
    },
    [setProvider, tabNavigation],
  );

  const renderProviderItem = useCallback(
    (item: ProviderExtension, isSelected: boolean) => (
      <TouchableOpacity
        key={item.value}
        onPress={() => handleProviderSelect(item)}
        className={`mr-3 rounded-lg ${isSelected ? 'bg-[#333333]' : 'bg-[#262626]'
          }`}
        style={{
          width: Dimensions.get('window').width * 0.3, // Shows 2.5 items
          height: 65, // Increased height
          borderWidth: 1.5,
          borderColor: isSelected ? primary : '#333333',
        }}>
        <View className="flex-col items-center justify-center h-full p-2 relative">
          {/* Latency Dot */}
          <View
            style={{
              position: 'absolute',
              top: 6,
              left: 6,
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: getLatencyColor(pingStatus[item.value])
            }}
          />

          <RenderProviderFlagIcon type={item.type} />
          <Text
            numberOfLines={1}
            className="text-white text-xs font-medium text-center mt-2">
            {item.display_name}
          </Text>
          {isSelected && (
            <Text style={{ position: 'absolute', top: 6, right: 6 }}>
              <MaterialIcons name="check-circle" size={16} color={primary} />
            </Text>
          )}
        </View>
      </TouchableOpacity>
    ),
    [handleProviderSelect, primary, pingStatus],
  );

  const providersList = useMemo(
    () =>
      installedProviders.map(item =>
        renderProviderItem(item, provider.value === item.value),
      ),
    [installedProviders, provider.value, renderProviderItem],
  );


  const clearCacheHandler = useCallback(() => {
    if (settingsStorage.isHapticFeedbackEnabled()) {
      ReactNativeHapticFeedback.trigger('virtualKey', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
    }
    cacheStorageService.clearAll();
    ToastAndroid.show('Cache Cleared', ToastAndroid.SHORT);
    // Also clear extension cache to force manifest refresh (needed for latency fix)
    extensionStorage.clearAll();
    ToastAndroid.show('Cache cleared', ToastAndroid.SHORT);
  }, []);

  const clearHistoryHandler = useCallback(() => {
    if (settingsStorage.isHapticFeedbackEnabled()) {
      ReactNativeHapticFeedback.trigger('virtualKey', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
    }
    clearHistory();
    ToastAndroid.show('History Cleared', ToastAndroid.SHORT);
  }, [clearHistory]);

  const toggleWatchTogether = useCallback(() => {
    const newState = !watchTogetherMode;
    setWatchTogetherMode(newState);
    setWatchTogetherModeStorage(newState);

    if (settingsStorage.isHapticFeedbackEnabled()) {
      ReactNativeHapticFeedback.trigger('virtualKey', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
    }
  }, [watchTogetherMode]);

  const toggleAppMode = useCallback(() => {
    const newMode = appMode === 'doodleTv' ? 'video' : 'doodleTv';
    setAppMode(newMode);

    if (settingsStorage.isHapticFeedbackEnabled()) {
      ReactNativeHapticFeedback.trigger('virtualKey', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
    }
  }, [appMode, setAppMode]);

  // --- PROXY TOGGLE ---
  const toggleNetworkProxy = useCallback(() => {
    const newState = !networkProxyMode;
    setNetworkProxyMode(newState);
    setNetworkProxyModeStorage(newState);

    if (settingsStorage.isHapticFeedbackEnabled()) {
      ReactNativeHapticFeedback.trigger('impactMedium', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
    }

    ToastAndroid.show(
      newState ? 'Secure Proxy Enabled' : 'Secure Proxy Disabled',
      ToastAndroid.SHORT,
    );
  }, [networkProxyMode]);
  // --------------------

  // --- UPDATED PARSING LOGIC TO PREVENT CRASH ---
  const parseSyncLink = (link: string) => {
    // Helper to extract value by key from a complex URL string
    const getParam = (key: string) => {
      // Matches key=value up to the next & or end of string
      const regex = new RegExp(`${key}=([^&\\n]+)`, 'i');
      const match = link.match(regex);
      return match ? match[1] : null;
    };

    const videoId = getParam('video_id');
    const time = getParam('time');
    const roomId = getParam('roomId');
    const leader = getParam('leader');
    const infoUrl = getParam('infoUrl');
    const providerValue = getParam('providerValue');
    const primaryTitle = getParam('primaryTitle');

    if (videoId && time !== null) {
      return {
        videoId,
        time: parseInt(time, 10),
        roomId,
        leader,
        infoUrl,
        providerValue,
        primaryTitle: primaryTitle
          ? decodeURIComponent(primaryTitle)
          : 'Shared Content',
      };
    }
    return null;
  };

  const handleJoinSession = useCallback(() => {
    const linkToJoin = syncLink.trim();
    if (!linkToJoin) {
      ToastAndroid.show(
        'Please paste a sync link to join.',
        ToastAndroid.SHORT,
      );
      return;
    }

    const parsedData = parseSyncLink(linkToJoin);

    if (parsedData) {
      // Robust Mock Params for Player
      const mockPlayerParams = {
        id: parsedData.videoId,
        // CRITICAL: Pass title from link or fallback
        primaryTitle: parsedData.primaryTitle,
        title: parsedData.primaryTitle,
        link: parsedData.videoId,
        poster: { logo: 'mock_poster_url' },
        linkIndex: 0,
        episodeList: [
          { link: parsedData.videoId, title: parsedData.primaryTitle },
        ],

        // CRITICAL: Pass the provider value from the link so Player uses the correct extractor
        providerValue: parsedData.providerValue || provider.value,
        infoUrl: parsedData.infoUrl,

        // Pass the fallback provider object to satisfy TS, but providerValue above takes precedence in Player
        provider: {
          value: parsedData.providerValue || provider.value,
          type: provider.type,
          display_name: provider.display_name,
          icon: provider.icon,
        } as ProviderExtension,

        type: 'Movie',

        // Watch Together Specifics
        syncLink: true, // Boolean true to trigger join logic
        roomId: parsedData.roomId, // CRITICAL: Must pass this!
        leader: parsedData.leader,
        time: parsedData.time,
      };

      try {
        rootNavigation.navigate('Player' as any, mockPlayerParams as any);

        setSyncLink('');
        ToastAndroid.show(
          `Joining session at ${parsedData.time}s`,
          ToastAndroid.LONG,
        );
      } catch (error) {
        console.error('Navigation Crash Error:', error);
        ToastAndroid.show('Failed to join session.', ToastAndroid.LONG);
      }
    } else {
      ToastAndroid.show('Invalid sync link format.', ToastAndroid.LONG);
    }
  }, [syncLink, rootNavigation, provider]);

  const handlePasteLink = useCallback(async () => {
    try {
      const text = await Clipboard.getString();
      if (text && text.includes('video_id=') && text.includes('time=')) {
        setSyncLink(text);
        ToastAndroid.show(
          `Pasted link: ${text.substring(0, 30)}...`,
          ToastAndroid.SHORT,
        );
      } else {
        ToastAndroid.show('No valid sync link found.', ToastAndroid.SHORT);
      }
    } catch (error) {
      ToastAndroid.show('Failed to read from clipboard.', ToastAndroid.SHORT);
    }
  }, []);

  const AnimatedSection = ({
    delay,
    children,
  }: {
    delay: number;
    children: React.ReactNode;
  }) => (
    <Animated.View
      entering={FadeInDown.delay(delay).springify()}
      layout={Layout.springify()}>
      {children}
    </Animated.View>
  );

  return (
    <Animated.ScrollView
      className="w-full h-full bg-black"
      showsVerticalScrollIndicator={false}
      bounces={true}
      overScrollMode="always"
      entering={FadeInUp.springify()}
      layout={Layout.springify()}
      contentContainerStyle={{
        paddingTop: 15,
        paddingBottom: 24,
        flexGrow: 1,
      }}>
      <View className="p-5">
        <Animated.View entering={FadeInUp.springify()}>
          <Text className="text-2xl font-bold text-white mb-6">Settings</Text>
        </Animated.View>

        {/* Content provider section */}
        <AnimatedSection delay={100}>
          <View className="mb-6 flex-col gap-3">
            <Text className="text-gray-400 text-sm mb-1">Content Provider</Text>
            <View className="bg-[#1A1A1A] rounded-xl py-4">
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{
                  paddingHorizontal: 10,
                }}>
                {providersList}
                {installedProviders.length === 0 && (
                  <Text className="text-gray-500 text-sm">
                    No providers installed
                  </Text>
                )}
              </ScrollView>
            </View>
            {/* Extensions */}
            <View className="bg-[#1A1A1A] rounded-xl overflow-hidden mb-3">
              <InternalOptionRow
                icon={<MaterialCommunityIcons name="puzzle" />}
                text="Provider Manager"
                onPress={() => navigation.navigate('Extensions')}
                primaryColor={primary}
                isLast={true}
              />
            </View>
          </View>
        </AnimatedSection>

        {/* --- NEW NETWORK / PROXY SECTION --- */}
        <AnimatedSection delay={120}>
          <View className="mb-6 flex-col gap-3">
            <Text className="text-gray-400 text-sm mb-1">
              Network & Connection
            </Text>
            <View className="bg-[#1A1A1A] rounded-xl overflow-hidden">
              <View className="flex-row items-center justify-between p-4">
                <View className="flex-row items-center flex-1 pr-2">
                  <MaterialCommunityIcons
                    name="shield-check-outline"
                    size={22}
                    color={primary}
                  />
                  <View className="flex-col ml-3 flex-1">
                    <Text className="text-white text-base">
                      Secure Proxy (VPN Mode)
                    </Text>
                    <Text className="text-gray-400 text-xs mt-0.5">
                      Bypass ISP blocks (Jio, etc) via DoH.
                    </Text>
                  </View>
                </View>
                <Switch
                  trackColor={{ false: '#767577', true: primary }}
                  thumbColor={networkProxyMode ? '#f4f3f4' : '#f4f3f4'}
                  ios_backgroundColor="#3e3e3e"
                  onValueChange={toggleNetworkProxy}
                  value={networkProxyMode}
                />
              </View>
            </View>
          </View>
        </AnimatedSection>
        {/* ----------------------------------- */}

        {/* App Mode */}
        <AnimatedSection delay={50}>
          <View className="mb-6 flex-col gap-3">
            <Text className="text-gray-400 text-sm mb-1">App Mode</Text>
            <View className="bg-[#1A1A1A] rounded-xl overflow-hidden">
              <TouchableOpacity
                className="flex-row items-center justify-between p-4"
                onPress={toggleAppMode}>
                <View className="flex-row items-center">
                  <MaterialCommunityIcons
                    name="television-play"
                    size={22}
                    color={primary}
                  />
                  <Text className="text-white ml-3 text-base">
                    Doodle-TV Mode
                  </Text>
                </View>
                <Switch
                  trackColor={{ false: '#3f3f46', true: primary }}
                  thumbColor={'white'}
                  ios_backgroundColor="#3e3e3e"
                  value={appMode === 'doodleTv'}
                  onValueChange={toggleAppMode}
                />
              </TouchableOpacity>
            </View>
          </View>
        </AnimatedSection>

        {/* Watch Together Section */}
        <AnimatedSection delay={150}>
          <View className="mb-6 flex-col gap-3">
            <Text className="text-gray-400 text-sm mb-1">Watch Together</Text>
            <View className="bg-[#1A1A1A] rounded-xl overflow-hidden">
              <TouchableOpacity
                className="flex-row items-center justify-between p-4 border-b border-[#262626]"
                onPress={toggleWatchTogether}>
                <View className="flex-row items-center">
                  <MaterialIcons name="group" size={22} color={primary} />
                  <Text className="text-white ml-3 text-base">
                    Enable Watch Together Mode
                  </Text>
                </View>
                <Switch
                  trackColor={{ false: '#3f3f46', true: primary }}
                  thumbColor={'white'}
                  ios_backgroundColor="#3e3e3e"
                  value={watchTogetherMode}
                  onValueChange={toggleWatchTogether}
                />
              </TouchableOpacity>

              {watchTogetherMode && (
                <View className="flex-col p-4">
                  <Text className="text-gray-400 text-sm mb-2">
                    Paste Sync Link to Join
                  </Text>
                  <View className="flex-row items-center">
                    <TextInput
                      className="flex-1 bg-white/10 text-white rounded-l-md p-2 h-10"
                      placeholder="e.g., doodlemovies://watch/video_id=..."
                      placeholderTextColor="#9CA3AF"
                      value={syncLink}
                      onChangeText={setSyncLink}
                    />
                    <TouchableOpacity
                      className="bg-gray-500 p-2 h-10 justify-center items-center"
                      onPress={handlePasteLink}>
                      <MaterialIcons
                        name="content-paste"
                        size={20}
                        color="white"
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      className="bg-blue-600 rounded-r-md p-2 h-10 justify-center items-center"
                      onPress={handleJoinSession}>
                      <Text className="text-white font-semibold">Join</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          </View>
        </AnimatedSection>
        <AnimatedSection delay={200}>
          <View className="mb-6 flex-col gap-3">
            <View className="flex-row items-center justify-between px-1">
                 <Text className="text-gray-400 text-sm">Torrent Engine (TorrServer)</Text>
                 <View className="flex-row items-center">
                    <View 
                       style={{ 
                         width: 6, 
                         height: 6, 
                         borderRadius: 3, 
                         marginRight: 4,
                         backgroundColor: isBridgeActive ? '#22C55E' : '#EF4444'
                       }} 
                    />
                    <Text className="text-[8px] text-gray-500 mr-2">Bridge: {isBridgeActive ? 'OK' : 'FAIL'}</Text>
                    <View 
                       style={{ 
                         width: 8, 
                         height: 8, 
                         borderRadius: 4, 
                         backgroundColor: engineStatus === 'active' ? '#22C55E' : (engineStatus === 'checking' ? '#EAB308' : '#EF4444')
                       }} 
                    />
                    <Text className="text-[10px] ml-1.5" style={{ color: engineStatus === 'active' ? '#22C55E' : (engineStatus === 'checking' ? '#EAB308' : '#EF4444') }}>
                        {engineStatus === 'active' ? 'Engine Active' : (engineStatus === 'checking' ? 'Checking...' : 'Engine Undetected')}
                    </Text>
                </View>
            </View>
            <View className="bg-[#1A1A1A] rounded-xl p-4">
              <Text className="text-gray-400 text-xs mb-2">
                Base URL (Auto-detected if local)
              </Text>
              <View className="flex-row items-center bg-white/5 rounded-lg border border-white/10 px-3 mb-3">
                <MaterialCommunityIcons name="server" size={20} color={primary} />
                <TextInput
                  className="flex-1 text-white p-2 h-11"
                  placeholder="http://127.0.0.1:8090"
                  placeholderTextColor="#666"
                  value={torrServerUrl}
                  onChangeText={saveTorrServerUrl}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <TouchableOpacity 
                disabled={engineStatus === 'checking'}
                onPress={async () => {
                    const TorrEngineService = require('../../lib/services/TorrEngineService').default;
                    await TorrEngineService.clearEngineData();
                    checkEngine(torrServerUrl);
                }}
                className="flex-row items-center justify-center p-3 rounded-lg border border-[#333] bg-[#222] mb-2">
                <MaterialCommunityIcons name="refresh" size={18} color="white" />
                <Text className="text-white ml-2 text-xs font-medium">Reset & Restart Engine</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={async () => {
                   const TorrEngineService = require('../../lib/services/TorrEngineService').default;
                   const engineLogs = await TorrEngineService.getEngineLogs();
                   setLogs(engineLogs);
                   setShowLogs(true);
                }}
                className="flex-row items-center justify-center p-3 rounded-lg border border-[#333] bg-[#222]">
                <MaterialCommunityIcons name="text-box-search-outline" size={18} color={primary} />
                <Text className="text-white ml-2 text-xs font-medium">View Engine Logs</Text>
              </TouchableOpacity>

              {engineError && (
                <Text className="text-[#EF4444] text-[10px] mt-2 text-center italic">
                    {engineError}
                </Text>
              )}

              <Text className="text-gray-500 text-[10px] mt-3 italic text-center">
                {engineError ? (
                  <Text className="text-red-400 font-bold">{engineError}</Text>
                ) : (
                  engineStatus === 'active' 
                    ? 'Successfully connected to the torrent engine.' 
                    : 'Engine offline? Try "Reset & Restart" to clear corrupt data.'
                )}
              </Text>
            </View>
          </View>
        </AnimatedSection>
        <AnimatedSection delay={210}>
          <View className="mb-6 flex-col gap-3">
            <View className="flex-row items-center justify-between px-1">
                <Text className="text-gray-400 text-sm">Debrid Support</Text>
                <Switch
                  trackColor={{ false: '#3f3f46', true: primary }}
                  thumbColor={'white'}
                  value={useDebrid}
                  onValueChange={(val) => {
                    setUseDebrid(val);
                    settingsStorage.setDebridEnabled(val);
                  }}
                />
            </View>
            
            {useDebrid && (
              <View className="bg-[#1A1A1A] rounded-xl p-4 gap-y-4">
                <View className="flex-row items-center justify-between bg-white/5 p-3 rounded-lg">
                    <Text className="text-white">Service</Text>
                    <View className="flex-row gap-2">
                        {['None', 'Real-Debrid', 'TorBox'].map(s => (
                            <TouchableOpacity 
                                key={s}
                                onPress={() => {
                                    setSelectedDebrid(s);
                                    settingsStorage.setDebridService(s);
                                }}
                                className={`px-3 py-1.5 rounded-md ${selectedDebrid === s ? 'bg-blue-600' : 'bg-zinc-800'}`}
                            >
                                <Text className="text-white text-xs font-bold">{s}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {selectedDebrid === 'Real-Debrid' && (
                  <View className="gap-y-3">
                    {isRDLoggedIn ? (
                        <TouchableOpacity 
                            onPress={logoutRD}
                            className="bg-red-500/10 border border-red-500/20 p-3 rounded-lg flex-row items-center justify-center"
                        >
                            <MaterialCommunityIcons name="logout" size={18} color="#EF4444" />
                            <Text className="text-[#EF4444] ml-2 font-bold">Logout from Real-Debrid</Text>
                        </TouchableOpacity>
                    ) : (
                        <View className="gap-y-3">
                            {rdUserCode ? (
                                <View className="bg-white/5 p-4 rounded-lg items-center">
                                    <Text className="text-gray-400 text-xs mb-1">Enter this code at real-debrid.com/device:</Text>
                                    <Text className="text-white text-3xl font-bold tracking-[8px] my-2">{rdUserCode}</Text>
                                    <ActivityIndicator color={primary} size="small" className="mt-2" />
                                    <Text className="text-gray-500 text-[10px] mt-2 italic">Waiting for approval...</Text>
                                </View>
                            ) : (
                                <TouchableOpacity 
                                    onPress={handleRDLogin}
                                    className="bg-blue-600 p-3 rounded-lg flex-row items-center justify-center"
                                >
                                    <MaterialCommunityIcons name="login" size={18} color="white" />
                                    <Text className="text-white ml-2 font-bold">Login with Real-Debrid</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    )}
                  </View>
                )}

                {selectedDebrid === 'TorBox' && (
                  <View className="gap-y-2">
                    <Text className="text-gray-400 text-xs">TorBox API Key</Text>
                    <View className="flex-row items-center bg-white/5 rounded-lg px-3">
                        <TextInput
                            className="flex-1 text-white p-2 h-11"
                            placeholder="Enter API Key"
                            placeholderTextColor="#666"
                            value={torboxKey}
                            onChangeText={setTorboxKey}
                            secureTextEntry
                        />
                        <TouchableOpacity onPress={handleTorBoxSave} className="bg-blue-600 px-3 py-1.5 rounded-md">
                            <Text className="text-white text-xs font-bold">Save</Text>
                        </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            )}
          </View>
        </AnimatedSection>

        <AnimatedSection delay={250}>
          <View className="mb-6">
            <Text className="text-gray-400 text-sm mb-3">Options</Text>
            <View className="bg-[#1A1A1A] rounded-xl overflow-hidden">
              {/* Downloads */}
              <InternalOptionRow
                icon={<MaterialCommunityIcons name="folder-download" />}
                text="Downloads"
                onPress={() => navigation.navigate('Downloads')}
                primaryColor={primary}
              />

              {/* Subtitle Style */}
              <InternalOptionRow
                icon={<MaterialCommunityIcons name="subtitles" />}
                text="Subtitle Style"
                onPress={() => navigation.navigate('SubTitlesPreferences')}
                primaryColor={primary}
              />

              {/* Watch History */}
              <InternalOptionRow
                icon={<MaterialCommunityIcons name="history" />}
                text="Watch History"
                onPress={() => navigation.navigate('WatchHistoryStack')}
                primaryColor={primary}
              />

              {/* Preferences */}
              <InternalOptionRow
                icon={<MaterialIcons name="room-preferences" />}
                text="Preferences"
                onPress={() => navigation.navigate('Preferences')}
                primaryColor={primary}
                isLast={true}
              />
            </View>
          </View>
        </AnimatedSection>

        {/* Data Management section (delay 350) */}
        <AnimatedSection delay={350}>
          <View className="mb-6">
            <Text className="text-gray-400 text-sm mb-3">Data Management</Text>
            <View className="bg-[#1A1A1A] rounded-xl overflow-hidden">
              {/* Clear Cache */}
              <View className="flex-row items-center justify-between p-4 border-b border-[#262626]">
                <Text className="text-white text-base">Clear Cache</Text>
                <TouchableOpacity
                  className="bg-[#262626] px-4 py-2 rounded-lg"
                  onPress={clearCacheHandler}>
                  <MaterialCommunityIcons
                    name="delete-outline"
                    size={20}
                    color={primary}
                  />
                </TouchableOpacity>
              </View>

              {/* Clear Watch History */}
              <View className="flex-row items-center justify-between p-4">
                <Text className="text-white text-base">
                  Clear Watch History
                </Text>
                <TouchableOpacity
                  className="bg-[#262626] px-4 py-2 rounded-lg"
                  onPress={clearHistoryHandler}>
                  <MaterialCommunityIcons
                    name="delete-outline"
                    size={20}
                    color={primary}
                  />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </AnimatedSection>

        {/* About & GitHub section (delay 450) */}
        <AnimatedSection delay={450}>
          <View className="mb-6">
            <Text className="text-gray-400 text-sm mb-3">About</Text>
            <View className="bg-[#1A1A1A] rounded-xl overflow-hidden">
              {/* About */}
              <InternalOptionRow
                icon={<Feather name="info" />}
                text="About"
                onPress={() => navigation.navigate('About')}
                primaryColor={primary}
              />

              {/* Our Productions */}
              <InternalOptionRow
                icon={<Feather name="smartphone" />}
                text="Check Our Softwares"
                onPress={() => navigation.navigate('Production')}
                primaryColor={primary}
              />

              {/* GitHub */}
              <ExternalLinkRow
                icon={<AntDesign name="github" />}
                text="Give a star"
                url="https://github.com/punisher-303/Doodle-Movie-App"
                iconColor={primary}
              />

              {/* sponsore */}
              <ExternalLinkRow
                icon={<AntDesign name="heart" />}
                text="About the Developer"
                url="https://instagram.com/appuz.404/"
                iconColor="#ff69b4"
                isLast={true}
              />
            </View>
          </View>
        </AnimatedSection>
      </View>
      {/* Engine Logs Modal */}
      {showLogs && (
        <View className="absolute top-0 left-0 right-0 bottom-0 z-[999] bg-black/90 p-5 pt-12">
            <View className="flex-row items-center justify-between mb-4">
                <Text className="text-white text-lg font-bold">Engine Diagnostics</Text>
                <TouchableOpacity onPress={() => setShowLogs(false)}>
                    <AntDesign name="close" size={24} color="white" />
                </TouchableOpacity>
            </View>
            <ScrollView className="flex-1 bg-[#111] rounded-lg p-3 border border-[#333]">
                <Text className="text-[#00FF00] font-mono text-[10px]">
                    {logs || "No logs available"}
                </Text>
            </ScrollView>
            <TouchableOpacity 
               onPress={() => {
                  Clipboard.setString(logs);
                  ToastAndroid.show('Logs copied to clipboard', ToastAndroid.SHORT);
               }}
               className="bg-blue-600 p-4 rounded-xl mt-4 items-center">
                <Text className="text-white font-bold">Copy Logs to Clipboard</Text>
            </TouchableOpacity>
        </View>
      )}
    </Animated.ScrollView>
  );
};

export default Settings;
