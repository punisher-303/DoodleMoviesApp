import {
  View,
  Text,
  Switch,
  ScrollView,
  TouchableOpacity,
  ToastAndroid,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React, { useState } from 'react';
import { settingsStorage } from '../../lib/storage';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import RNReactNativeHapticFeedback from 'react-native-haptic-feedback';
import useThemeStore from '../../lib/zustand/themeStore';
import { Dropdown } from 'react-native-element-dropdown';
import TVFocusWrapper from '../../components/TVFocusWrapper';
import { themes } from '../../lib/constants';
import { TextInput } from 'react-native';
import { DevSettings } from 'react-native'; // ✅ Add at top
import Constants from 'expo-constants';
// Lazy-load Firebase to allow running without google-services.json
// eslint-disable-next-line @typescript-eslint/no-explicit-any


const Preferences = () => {
  const insets = useSafeAreaInsets();
  const hasFirebase = Boolean(Constants?.expoConfig?.extra?.hasFirebase);
  const { primary, setPrimary, isCustom, setCustom } = useThemeStore(
    state => state,
  );
  const [showRecentlyWatched, setShowRecentlyWatched] = useState(
    settingsStorage.getBool('showRecentlyWatched') || true,
  );
  const [disableDrawer, setDisableDrawer] = useState(
    settingsStorage.getBool('disableDrawer') || false,
  );

  const [ExcludedQualities, setExcludedQualities] = useState(
    settingsStorage.getExcludedQualities(),
  );

  const [customColor, setCustomColor] = useState(
    settingsStorage.getCustomColor(),
  );

  const [showMediaControls, setShowMediaControls] = useState<boolean>(
    settingsStorage.showMediaControls(),
  );

  const [showHamburgerMenu, setShowHamburgerMenu] = useState<boolean>(
    settingsStorage.showHamburgerMenu(),
  );

  const [hideSeekButtons, setHideSeekButtons] = useState<boolean>(
    settingsStorage.hideSeekButtons(),
  );

  const [_enable2xGesture, _setEnable2xGesture] = useState<boolean>(
    settingsStorage.isEnable2xGestureEnabled(),
  );

  const [enableSwipeGesture, setEnableSwipeGesture] = useState<boolean>(
    settingsStorage.isSwipeGestureEnabled(),
  );

  const [showTabBarLabels, setShowTabBarLabels] = useState<boolean>(
    settingsStorage.showTabBarLabels(),
  );

  const [OpenExternalPlayer, setOpenExternalPlayer] = useState(
    settingsStorage.getBool('useExternalPlayer', false),
  );

  const [hapticFeedback, setHapticFeedback] = useState(
    settingsStorage.isHapticFeedbackEnabled(),
  );

  const [alwaysUseExternalDownload, setAlwaysUseExternalDownload] = useState(
    settingsStorage.getBool('alwaysExternalDownloader') || false,
  );

  const [telemetryOptIn, setTelemetryOptIn] = useState<boolean>(
    settingsStorage.isTelemetryOptIn(),
  );

  return (
    <ScrollView
      className="w-full h-full bg-black"
      contentContainerStyle={{
        paddingTop: insets.top,
      }}>
      <View className="p-5">
        <Text className="text-2xl font-bold text-white mb-6">Preferences</Text>

        {/* Theme Section */}
        <View className="mb-6">
          <Text className="text-gray-400 text-sm mb-3">Appearance</Text>
          <View className="bg-[#1A1A1A] rounded-xl overflow-hidden">
            {/* Theme Selector */}
            <View className="flex-row items-center px-4 justify-between p-4 border-b border-[#262626]">
              <Text className="text-white text-base">Theme</Text>
              <View className="w-36">
                {isCustom ? (
                  <View className="flex-row items-center gap-2">
                    <TextInput
                      style={{
                        color: 'white',
                        backgroundColor: '#262626',
                        borderRadius: 8,
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        fontSize: 14,
                      }}
                      placeholder="Hex Color"
                      placeholderTextColor="gray"
                      value={customColor}
                      onChangeText={setCustomColor}
                      onSubmitEditing={e => {
                        if (e.nativeEvent.text.length < 7) {
                          ToastAndroid.show(
                            'Invalid Color',
                            ToastAndroid.SHORT,
                          );
                          return;
                        }
                        settingsStorage.setCustomColor(e.nativeEvent.text);
                        setPrimary(e.nativeEvent.text);
                      }}
                    />
                    <TVFocusWrapper
                      onPress={() => {
                        setCustom(false);
                        setPrimary('#FF6347');
                      }}>
                      <MaterialCommunityIcons
                        name="close"
                        size={20}
                        color="gray"
                      />
                    </TVFocusWrapper>
                  </View>
                ) : (
                  <Dropdown
                    selectedTextStyle={{
                      color: 'white',
                      fontSize: 14,
                      fontWeight: '500',
                    }}
                    containerStyle={{
                      backgroundColor: '#262626',
                      borderRadius: 8,
                      borderWidth: 0,
                      marginTop: 4,
                    }}
                    itemTextStyle={{ color: 'white' }}
                    activeColor="#3A3A3A"
                    itemContainerStyle={{
                      backgroundColor: '#262626',
                      borderWidth: 0,
                    }}
                    style={{
                      backgroundColor: '#262626',
                      borderWidth: 0,
                    }}
                    iconStyle={{ tintColor: 'white' }}
                    placeholderStyle={{ color: 'white' }}
                    labelField="name"
                    valueField="color"
                    data={themes}
                    value={primary}
                    onChange={value => {
                      if (value.name === 'Custom') {
                        setCustom(true);
                        setPrimary(customColor);
                        return;
                      }
                      setPrimary(value.color);
                    }}
                  />
                )}
              </View>
            </View>

            {/* Haptic Feedback */}
            <View className="flex-row items-center justify-between p-4 border-b border-[#262626]">
              <Text className="text-white text-base">Haptic Feedback</Text>
              <TVFocusWrapper
                onPress={() => {
                  settingsStorage.setHapticFeedbackEnabled(!hapticFeedback);
                  setHapticFeedback(!hapticFeedback);
                }}>
                <Switch
                  thumbColor={hapticFeedback ? primary : 'gray'}
                  value={hapticFeedback}
                  onValueChange={() => {
                    settingsStorage.setHapticFeedbackEnabled(!hapticFeedback);
                    setHapticFeedback(!hapticFeedback);
                  }}
                />
              </TVFocusWrapper>
            </View>

            {/* Analytics & Crashlytics Opt-In */}
            <View className="flex-row items-center justify-between p-4 border-b border-[#262626]">
              <Text className="text-white text-base">
                Usage & Crash Reports
              </Text>
              <TVFocusWrapper
                onPress={async () => {
                  const next = !telemetryOptIn;
                  setTelemetryOptIn(next);
                  settingsStorage.setTelemetryOptIn(next);
                  if (hasFirebase) {
                    try {
                      // const analytics = getAnalytics();
                      // analytics &&
                      //   (await analytics().setAnalyticsCollectionEnabled(next));
                      // // Also update consent for completeness
                      // analytics &&
                      //   (await analytics().setConsent({
                      //     analytics_storage: next,
                      //     ad_storage: next,
                      //     ad_user_data: next,
                      //     ad_personalization: next,
                      //   }));
                    } catch { }
                  }
                }}>
                <Switch
                  thumbColor={telemetryOptIn ? primary : 'gray'}
                  value={telemetryOptIn}
                  onValueChange={async () => {
                    const next = !telemetryOptIn;
                    setTelemetryOptIn(next);
                    settingsStorage.setTelemetryOptIn(next);
                    if (hasFirebase) {
                      try {
                        // const analytics = getAnalytics();
                        // analytics &&
                        //   (await analytics().setAnalyticsCollectionEnabled(next));
                        // // Also update consent for completeness
                        // analytics &&
                        //   (await analytics().setConsent({
                        //     analytics_storage: next,
                        //     ad_storage: next,
                        //     ad_user_data: next,
                        //     ad_personalization: next,
                        //   }));
                      } catch { }
                    }
                  }}
                />
              </TVFocusWrapper>
            </View>

            {/* Show Tab Bar Labels */}
            <View className="flex-row items-center justify-between p-4 border-b border-[#262626]">
              <Text className="text-white text-base">Show Tab Bar Labels</Text>
              <TVFocusWrapper
                onPress={() => {
                  settingsStorage.setShowTabBarLabels(!showTabBarLabels);
                  setShowTabBarLabels(!showTabBarLabels);
                  ToastAndroid.show(
                    'Restart App to Apply Changes',
                    ToastAndroid.SHORT,
                  );
                  // ✅ Soft restart the app
                  setTimeout(() => {
                    DevSettings.reload(); // ⚠️ Only works in development or with dev menu enabled
                  }, 500);
                }}>
                <Switch
                  thumbColor={showTabBarLabels ? primary : 'gray'}
                  value={showTabBarLabels}
                  onValueChange={() => {
                    settingsStorage.setShowTabBarLabels(!showTabBarLabels);
                    setShowTabBarLabels(!showTabBarLabels);
                    ToastAndroid.show(
                      'Restart App to Apply Changes',
                      ToastAndroid.SHORT,
                    );
                    // ✅ Soft restart the app
                    setTimeout(() => {
                      DevSettings.reload(); // ⚠️ Only works in development or with dev menu enabled
                    }, 500);
                  }}
                />
              </TVFocusWrapper>
            </View>

            {/* Show Hamburger Menu */}
            <View className="flex-row items-center justify-between p-4 border-b border-[#262626]">
              <Text className="text-white text-base">Show Hamburger Menu</Text>
              <TVFocusWrapper
                onPress={() => {
                  settingsStorage.setShowHamburgerMenu(!showHamburgerMenu);
                  setShowHamburgerMenu(!showHamburgerMenu);
                }}>
                <Switch
                  thumbColor={showHamburgerMenu ? primary : 'gray'}
                  value={showHamburgerMenu}
                  onValueChange={() => {
                    settingsStorage.setShowHamburgerMenu(!showHamburgerMenu);
                    setShowHamburgerMenu(!showHamburgerMenu);
                  }}
                />
              </TVFocusWrapper>
            </View>

            {/* Show Recently Watched */}
            <View className="flex-row items-center justify-between p-4 border-b border-[#262626]">
              <Text className="text-white text-base">
                Show Recently Watched
              </Text>
              <TVFocusWrapper
                onPress={() => {
                  settingsStorage.setBool(
                    'showRecentlyWatched',
                    !showRecentlyWatched,
                  );
                  setShowRecentlyWatched(!showRecentlyWatched);
                }}>
                <Switch
                  thumbColor={showRecentlyWatched ? primary : 'gray'}
                  value={showRecentlyWatched}
                  onValueChange={() => {
                    settingsStorage.setBool(
                      'showRecentlyWatched',
                      !showRecentlyWatched,
                    );
                    setShowRecentlyWatched(!showRecentlyWatched);
                  }}
                />
              </TVFocusWrapper>
            </View>

            {/* Disable Drawer */}
            <View className="flex-row items-center justify-between p-4 border-b border-[#262626]">
              <Text className="text-white text-base">Disable Drawer</Text>
              <TVFocusWrapper
                onPress={() => {
                  settingsStorage.setBool('disableDrawer', !disableDrawer);
                  setDisableDrawer(!disableDrawer);
                }}>
                <Switch
                  thumbColor={disableDrawer ? primary : 'gray'}
                  value={disableDrawer}
                  onValueChange={() => {
                    settingsStorage.setBool('disableDrawer', !disableDrawer);
                    setDisableDrawer(!disableDrawer);
                  }}
                />
              </TVFocusWrapper>
            </View>

            {/* Always Use External Downloader */}
            <View className="flex-row items-center justify-between p-4">
              <Text className="text-white text-base">
                Always Use External Downloader
              </Text>
              <TVFocusWrapper
                onPress={() => {
                  settingsStorage.setBool(
                    'alwaysExternalDownloader',
                    !alwaysUseExternalDownload,
                  );
                  setAlwaysUseExternalDownload(!alwaysUseExternalDownload);
                }}>
                <Switch
                  thumbColor={alwaysUseExternalDownload ? primary : 'gray'}
                  value={alwaysUseExternalDownload}
                  onValueChange={() => {
                    settingsStorage.setBool(
                      'alwaysExternalDownloader',
                      !alwaysUseExternalDownload,
                    );
                    setAlwaysUseExternalDownload(!alwaysUseExternalDownload);
                  }}
                />
              </TVFocusWrapper>
            </View>
          </View>
        </View>

        {/* Player Settings */}
        <View className="mb-6">
          <Text className="text-gray-400 text-sm mb-3">Player</Text>
          <View className="bg-[#1A1A1A] rounded-xl overflow-hidden">
            {/* External Player */}
            <View className="flex-row items-center justify-between p-4 border-b border-[#262626]">
              <Text className="text-white text-base">
                Always Use External Player
              </Text>
              <TVFocusWrapper
                onPress={() => {
                  settingsStorage.setBool('useExternalPlayer', !OpenExternalPlayer);
                  setOpenExternalPlayer(!OpenExternalPlayer);
                }}>
                <Switch
                  thumbColor={OpenExternalPlayer ? primary : 'gray'}
                  value={OpenExternalPlayer}
                  onValueChange={val => {
                    settingsStorage.setBool('useExternalPlayer', val);
                    setOpenExternalPlayer(val);
                  }}
                />
              </TVFocusWrapper>
            </View>

            {/* Media Controls */}
            <View className="flex-row items-center justify-between p-4 border-b border-[#262626]">
              <Text className="text-white text-base">Media Controls</Text>
              <TVFocusWrapper
                onPress={() => {
                  settingsStorage.setShowMediaControls(!showMediaControls);
                  setShowMediaControls(!showMediaControls);
                }}>
                <Switch
                  thumbColor={showMediaControls ? primary : 'gray'}
                  value={showMediaControls}
                  onValueChange={() => {
                    settingsStorage.setShowMediaControls(!showMediaControls);
                    setShowMediaControls(!showMediaControls);
                  }}
                />
              </TVFocusWrapper>
            </View>

            {/* Hide Seek Buttons */}
            <View className="flex-row items-center justify-between p-4 border-b border-[#262626]">
              <Text className="text-white text-base">Hide Seek Buttons</Text>
              <TVFocusWrapper
                onPress={() => {
                  settingsStorage.setHideSeekButtons(!hideSeekButtons);
                  setHideSeekButtons(!hideSeekButtons);
                }}>
                <Switch
                  thumbColor={hideSeekButtons ? primary : 'gray'}
                  value={hideSeekButtons}
                  onValueChange={() => {
                    settingsStorage.setHideSeekButtons(!hideSeekButtons);
                    setHideSeekButtons(!hideSeekButtons);
                  }}
                />
              </TVFocusWrapper>
            </View>

            {/* Swipe Gestures */}
            <View className="flex-row items-center justify-between p-4">
              <Text className="text-white text-base">
                Enable Swipe Gestures
              </Text>
              <TVFocusWrapper
                onPress={() => {
                  settingsStorage.setSwipeGestureEnabled(!enableSwipeGesture);
                  setEnableSwipeGesture(!enableSwipeGesture);
                }}>
                <Switch
                  thumbColor={enableSwipeGesture ? primary : 'gray'}
                  value={enableSwipeGesture}
                  onValueChange={() => {
                    settingsStorage.setSwipeGestureEnabled(!enableSwipeGesture);
                    setEnableSwipeGesture(!enableSwipeGesture);
                  }}
                />
              </TVFocusWrapper>
            </View>
          </View>
        </View>

        {/* Quality Settings */}
        <View className="mb-6">
          <Text className="text-gray-400 text-sm mb-3">Quality</Text>
          <View className="bg-[#1A1A1A] rounded-xl p-4">
            <Text className="text-white text-base mb-3">
              Excluded Qualities
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {['360p', '480p', '720p'].map((quality, index) => (
                <TVFocusWrapper
                  key={index}
                  onPress={() => {
                    if (settingsStorage.isHapticFeedbackEnabled()) {
                      RNReactNativeHapticFeedback.trigger('effectTick');
                    }
                    const newExcluded = ExcludedQualities.includes(quality)
                      ? ExcludedQualities.filter(q => q !== quality)
                      : [...ExcludedQualities, quality];
                    setExcludedQualities(newExcluded);
                    settingsStorage.setExcludedQualities(newExcluded);
                  }}
                  style={{
                    backgroundColor: ExcludedQualities.includes(quality)
                      ? primary
                      : '#262626',
                  }}
                  className="px-4 py-2 rounded-lg">
                  <Text className="text-white text-sm">{quality}</Text>
                </TVFocusWrapper>
              ))}
            </View>
          </View>
        </View>

        <View className="h-16" />
      </View>
    </ScrollView>
  );
};

export default Preferences;
