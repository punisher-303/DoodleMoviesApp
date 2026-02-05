import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  FlatList,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Image,
  TextInput,
  Modal,
  ScrollView,
  TouchableWithoutFeedback,
  Dimensions,
  Switch,
} from 'react-native';

import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SettingsStackParamList } from '../../App';
import {
  MaterialCommunityIcons,
  MaterialIcons,
  Feather,
  AntDesign,
} from '@expo/vector-icons';
import useThemeStore from '../../lib/zustand/themeStore';
import useContentStore from '../../lib/zustand/contentStore';
import {
  extensionStorage,
  ProviderExtension,
} from '../../lib/storage/extensionStorage';
import { extensionManager } from '../../lib/services/ExtensionManager';
import {
  updateProvidersService,
  UpdateInfo,
} from '../../lib/services/UpdateProviders';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { settingsStorage } from '../../lib/storage';
import RenderProviderFlagIcon from '../../components/RenderProviderFLagIcon';

type Props = NativeStackScreenProps<SettingsStackParamList, 'Extensions'>;

type TabType = 'installed' | 'available';

const Extensions = ({ navigation }: Props) => {
  const { primary } = useThemeStore(state => state);
  const {
    provider: activeExtensionProvider,
    setProvider: setActiveExtensionProvider,
    installedProviders,
    availableProviders,
    setInstalledProviders,
    setAvailableProviders,
  } = useContentStore(state => state);
  const [activeTab, setActiveTab] = useState<TabType>(
    installedProviders?.length > 0 ? 'installed' : 'available',
  );
  const [installingProvider, setInstallingProvider] = useState<string | null>(
    null,
  );
  const [updatingProvider, setUpdatingProvider] = useState<string | null>(null);
  const [updateInfos, setUpdateInfos] = useState<UpdateInfo[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [isPerformingBulkAction, setIsPerformingBulkAction] = useState(false);

  const [useCustomBaseUrl, setUseCustomBaseUrl] = useState(
    settingsStorage.isUsingCustomProviderBaseUrl(),
  );
  const [customBaseUrl, setCustomBaseUrl] = useState(
    settingsStorage.getCustomProviderBaseUrl(),
  );
  const [showBaseUrlSettings, setShowBaseUrlSettings] = useState(false);

  // New States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('All');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isCategoryModalVisible, setCategoryModalVisible] = useState(false);

  // Use a ref to track if the component is mounted to prevent state updates on unmounted components
  const isMounted = useRef(true);

  // Load providers on component mount
  useEffect(() => {
    isMounted.current = true;
    const initializeExtensions = async () => {
      try {
        await extensionManager.initialize();
        if (isMounted.current) {
          loadProviders();
          await checkForUpdates();
        }
        // Try to fetch latest providers if we don't have any
        if (
          isMounted.current &&
          (!availableProviders || availableProviders.length === 0)
        ) {
          await handleRefresh();
        }
      } catch (error) {
        // Still try to load from cache if initialization fails
        if (isMounted.current) {
          loadProviders();
        }
      }
    };

    initializeExtensions();

    // Cleanup function to set the ref to false when the component unmounts
    return () => {
      isMounted.current = false;
    };
  }, []);

  const loadProviders = () => {
    const installed = extensionStorage.getInstalledProviders() || [];
    const available = extensionStorage.getAvailableProviders() || [];
    setInstalledProviders(installed);
    setAvailableProviders(available.filter(item => item && !item.disabled));
  };

  const checkForUpdates = async () => {
    try {
      const updates = await updateProvidersService.checkForUpdatesManual();
      if (isMounted.current) {
        setUpdateInfos(updates);
      }
    } catch (error) {
      console.error('Error checking for updates:', error);
    }
  };

  const handleUpdateProvider = async (provider: ProviderExtension) => {
    if (!provider || !provider.value) {
      Alert.alert('Error', 'Invalid provider data');
      return;
    }

    if (settingsStorage.isHapticFeedbackEnabled()) {
      ReactNativeHapticFeedback.trigger('effectClick', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
    }

    if (isMounted.current) {
      setUpdatingProvider(provider.value);
    }

    try {
      const success = await updateProvidersService.updateProvider(provider);
      if (success && isMounted.current) {
        loadProviders();
        await checkForUpdates();

        Alert.alert(
          'Success',
          `${provider.display_name} has been updated successfully!`,
        );

        // Update the active provider if it was the one being updated
        if (activeExtensionProvider?.value === provider.value) {
          setActiveExtensionProvider(provider);
        }
      } else if (isMounted.current) {
        Alert.alert('Error', 'Failed to update provider. Please try again.');
      }
    } catch (error) {
      console.error('Update error:', error);
      if (isMounted.current) {
        Alert.alert('Error', 'Failed to update provider. Please try again.');
      }
    } finally {
      if (isMounted.current) {
        setUpdatingProvider(null);
      }
    }
  };

  const handleTabChange = (tab: TabType) => {
    if (settingsStorage.isHapticFeedbackEnabled()) {
      ReactNativeHapticFeedback.trigger('effectTick', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
    }
    setActiveTab(tab);
  };

  const handleInstallProvider = async (provider: ProviderExtension) => {
    if (!provider || !provider.value) {
      Alert.alert('Error', 'Invalid provider data');
      return;
    }

    if (settingsStorage.isHapticFeedbackEnabled()) {
      ReactNativeHapticFeedback.trigger('effectClick', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
    }

    if (isMounted.current) {
      setInstallingProvider(provider.value);
    }

    try {
      await extensionManager.installProvider(provider);
      if (isMounted.current) {
        loadProviders();
        Alert.alert(
          'Success',
          `${provider.display_name} has been installed successfully!`,
        );
        setInstalledProviders(extensionStorage.getInstalledProviders() || []);
        if (
          !activeExtensionProvider ||
          activeExtensionProvider.value !== provider.value
        ) {
          setActiveExtensionProvider(provider);
        }
      }
    } catch (error) {
      console.error('Installation error:', error);
      if (isMounted.current) {
        Alert.alert('Error', 'Failed to install provider. Please try again.');
      }
    } finally {
      if (isMounted.current) {
        setInstallingProvider(null);
      }
    }
  };

  const handleUninstallProvider = (provider: ProviderExtension) => {
    if (!provider || !provider.value) {
      Alert.alert('Error', 'Invalid provider data');
      return;
    }

    Alert.alert(
      'Uninstall Provider',
      `Are you sure you want to uninstall ${provider.display_name || 'this provider'
      }?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Uninstall',
          style: 'destructive',
          onPress: () => {
            extensionStorage.uninstallProvider(provider.value);
            loadProviders();
            setInstalledProviders(
              extensionStorage.getInstalledProviders() || [],
            );

            // If this was the active provider, clear it
            if (activeExtensionProvider?.value === provider?.value) {
              setActiveExtensionProvider(
                extensionStorage.getInstalledProviders()[0] || {
                  value: '',
                  display_name: '',
                  type: '',
                  version: '',
                  category: '',
                  icon: '',
                  disabled: false,
                  installed: false,
                } as ProviderExtension,
              );
            }
          },
        },
      ],
    );
  };

  const handleSetActiveProvider = (provider: ProviderExtension) => {
    if (!provider || !provider.value) {
      Alert.alert('Error', 'Invalid provider data');
      return;
    }

    if (settingsStorage.isHapticFeedbackEnabled()) {
      ReactNativeHapticFeedback.trigger('effectClick', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
    }
    setActiveExtensionProvider(provider);
  };

  const handleToggleCustomBaseUrl = (enabled: boolean) => {
    if (enabled) {
      // Show warning when enabling custom URL
      Alert.alert(
        '⚠️ Security Warning',
        'Custom provider sources can run arbitrary code in the app. Only use provider URLs from sources you absolutely trust.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'I Understand',
            style: 'destructive',
            onPress: () => {
              setUseCustomBaseUrl(true);
              settingsStorage.setUseCustomProviderBaseUrl(true);
            },
          },
        ],
      );
    } else {
      setUseCustomBaseUrl(false);
      settingsStorage.setUseCustomProviderBaseUrl(false);
    }
  };

  const handleSaveCustomBaseUrl = () => {
    if (!customBaseUrl.trim()) {
      Alert.alert('Error', 'Please enter a valid URL');
      return;
    }

    // Basic URL validation
    const isValidUrl = (url: string): boolean => {
      try {
        const parsed = new URL(url);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
      } catch {
        return false;
      }
    };

    if (!isValidUrl(customBaseUrl)) {
      Alert.alert('Error', 'Please enter a valid URL');
      return;
    }

    settingsStorage.setCustomProviderBaseUrl(customBaseUrl.trim());
    Alert.alert(
      'Success',
      'Provider base URL updated. Pull to refresh to load providers from the new source.',
    );
  };

  const handleRefresh = async () => {
    if (isMounted.current) {
      setRefreshing(true);
    }
    try {
      const providers = await extensionManager.fetchManifest(true);
      if (isMounted.current) {
        // Update available providers in storage and state
        extensionStorage.setAvailableProviders(providers);
        setAvailableProviders(providers);
        loadProviders();
        await checkForUpdates();
      }
    } catch (error) {
      console.error('Refresh error:', error);
      if (isMounted.current) {
        Alert.alert(
          'Error',
          'Failed to refresh providers list. Please check your internet connection.',
        );
      }
    } finally {
      if (isMounted.current) {
        setRefreshing(false);
      }
    }
  };

  // --- BULK ACTION FUNCTIONS ---
  const handleEnableAllProviders = async () => {
    if (settingsStorage.isHapticFeedbackEnabled()) {
      ReactNativeHapticFeedback.trigger('effectClick', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
    }

    const availableToInstall = (availableProviders || []).filter(
      provider =>
        provider &&
        provider.value &&
        !extensionStorage.isProviderInstalled(provider.value),
    );

    if (availableToInstall.length === 0) {
      Alert.alert('Info', 'All available providers are already installed.');
      return;
    }

    Alert.alert(
      'Enable All',
      `Are you sure you want to install ${availableToInstall.length} providers?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Install All',
          style: 'default',
          onPress: async () => {
            if (isMounted.current) {
              setIsPerformingBulkAction(true);
            }
            try {
              // Use Promise.all to install all providers in parallel
              await Promise.all(
                availableToInstall.map(provider =>
                  extensionManager.installProvider(provider),
                ),
              );
              if (isMounted.current) {
                loadProviders();
                Alert.alert(
                  'Success',
                  'All available providers have been installed!',
                );
                setActiveTab('installed');
              }
            } catch (error) {
              console.error('Bulk installation error:', error);
              if (isMounted.current) {
                Alert.alert(
                  'Error',
                  'Failed to install all providers. Please try again.',
                );
              }
            } finally {
              if (isMounted.current) {
                setIsPerformingBulkAction(false);
              }
            }
          },
        },
      ],
    );
  };

  const handleDisableAllProviders = () => {
    if (settingsStorage.isHapticFeedbackEnabled()) {
      ReactNativeHapticFeedback.trigger('effectClick', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
    }

    if ((installedProviders || []).length === 0) {
      Alert.alert('Info', 'No providers are currently installed.');
      return;
    }

    Alert.alert(
      'Disable All',
      `Are you sure you want to uninstall all installed providers?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Uninstall All',
          style: 'destructive',
          onPress: () => {
            // Create a new function to uninstall without alerts to prevent multiple dialogs
            const uninstallWithoutAlert = (provider: ProviderExtension) => {
              if (!provider || !provider.value) return;
              extensionStorage.uninstallProvider(provider.value);
            };
            installedProviders?.forEach(uninstallWithoutAlert);
            loadProviders();
            setActiveExtensionProvider(undefined);
            Alert.alert('Success', 'All providers have been uninstalled!');
          },
        },
      ],
    );
  };

  // --- Derived Data ---
  const uniqueTypes = useMemo(() => {
    const allProviders = [...(installedProviders || []), ...(availableProviders || [])];
    const types = new Set(allProviders.map(p => p.type).filter(Boolean));
    return ['All', ...Array.from(types)];
  }, [installedProviders, availableProviders]);

  const uniqueCategories = useMemo(() => {
    const allProviders = [...(installedProviders || []), ...(availableProviders || [])];
    const categories = new Set(allProviders.map(p => p.category).filter(Boolean));
    return ['All', ...Array.from(categories)];
  }, [installedProviders, availableProviders]);

  const currentData = useMemo(() => {
    let data =
      activeTab === 'installed'
        ? (installedProviders || []).filter(item => item && item.value)
        : (availableProviders || []).filter(item => item && item.value);

    // Apply Search Filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      data = data.filter(item =>
        item.display_name?.toLowerCase().includes(query) ||
        item.type?.toLowerCase().includes(query) ||
        item.category?.toLowerCase().includes(query)
      );
    }

    // Apply Type Filter
    if (selectedType !== 'All') {
      data = data.filter(item => item.type === selectedType);
    }

    // Apply Category Filter
    if (selectedCategory !== 'All') {
      data = data.filter(item => item.category === selectedCategory);
    }

    return data;
  }, [activeTab, installedProviders, availableProviders, searchQuery, selectedType, selectedCategory]);

  const renderProviderCard = ({ item }: { item: ProviderExtension }) => {
    if (!item || !item.value) return null;
    const isActive = activeExtensionProvider?.value === item.value;
    const isInstalled = extensionStorage.isProviderInstalled(item.value);
    const isInstalling = installingProvider === item.value;
    const isUpdating = updatingProvider === item.value;
    const updateInfo = updateInfos.find(
      info => info.provider.value === item.value,
    );
    const hasUpdate = updateInfo?.hasUpdate || false;

    return (
      <View
        className="bg-tertiary rounded-xl p-3 py-2 mb-2 mx-4 shadow-sm border border-quaternary"
        style={{ elevation: 2 }}>
        <View className="flex-row items-center mb-4 gap-4 justify-between">
          {/* Left: Icon */}
          {item.icon ? (
            <Image
              source={{ uri: item.icon }}
              className="w-12 h-12 rounded-xl border-2 border-primary bg-quaternary"
              style={{ resizeMode: 'cover' }}
            />
          ) : (
            <View className="px-3 py-2 bg-quaternary rounded-xl border border-gray-700">
              <RenderProviderFlagIcon type={item.type} />
            </View>
          )}
          {/* Middle: Info */}
          <View className="flex-1 mx-3">
            <View className="flex-row items-center flex-wrap">
              <Text className="text-white text-lg font-bold tracking-wide">
                {item.display_name || 'Unknown Provider'}
              </Text>
              {hasUpdate && updateInfo && (
                <View
                  style={{ backgroundColor: primary }}
                  className="px-2 py-0.5 rounded-full ml-1">
                  <Text className="text-xs text-white font-semibold bg-gray-800">
                    Update
                  </Text>
                </View>
              )}
            </View>
            <View className="flex-row items-center gap-2 mt-0.5">
              <Text className="text-gray-400 text-xs font-medium">
                v{item.version || '0.0'}
              </Text>
              <View className="w-1 h-1 rounded-full bg-gray-600" />
              <Text className="text-gray-300 text-[10px] font-bold tracking-wider">
                {item.type?.toUpperCase() || 'GLOBAL'}
              </Text>
              <View className="w-1 h-1 rounded-full bg-gray-600" />
              <View className="bg-[#333333] px-1.5 py-0.5 rounded border border-gray-600">
                <Text className="text-gray-300 text-[8px] font-medium uppercase tracking-wider">
                  {item.category || 'MOVIE/TVSHOW'}
                </Text>
              </View>
            </View>



          </View>
          {/* Right: Buttons */}
          <View className="flex-row gap-3 items-center">
            {activeTab === 'installed' ? (
              <>
                <TouchableOpacity
                  onPress={() => handleSetActiveProvider(item)}
                  className={`w-9 h-9 rounded-full items-center justify-center ${isActive ? 'bg-green-600' : 'bg-gray-700'
                    }`}
                  style={{ opacity: isActive ? 1 : 0.9 }}>
                  <MaterialIcons
                    name={isActive ? 'check-circle' : 'radio-button-unchecked'}
                    size={20}
                    color="white"
                  />
                </TouchableOpacity>
                {hasUpdate && (
                  <TouchableOpacity
                    onPress={() => handleUpdateProvider(updateInfo!.provider)}
                    disabled={isUpdating}
                    className="w-9 h-9 rounded-full items-center justify-center"
                    style={{
                      backgroundColor: primary,
                      opacity: isUpdating ? 0.7 : 1,
                    }}>
                    {isUpdating ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <MaterialCommunityIcons
                        name="update"
                        size={20}
                        color="white"
                      />
                    )}
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => handleUninstallProvider(item)}
                  className="w-9 h-9 rounded-full items-center justify-center bg-red-600">
                  <MaterialCommunityIcons
                    name="delete"
                    size={20}
                    color="white"
                  />
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                onPress={() => handleInstallProvider(item)}
                disabled={isInstalled || isInstalling}
                className={'w-9 h-9 rounded-full items-center justify-center'}
                style={{
                  opacity: isInstalling ? 0.7 : 1,
                  backgroundColor: isInstalled ? 'gray' : primary,
                }}>
                {isInstalling ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <MaterialCommunityIcons
                    name={isInstalled ? 'check' : 'download'}
                    size={20}
                    color="white"
                  />
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View className="flex-1 bg-black pt-10 pb-16">
      <StatusBar backgroundColor="black" barStyle="light-content" />
      {/* Header with bulk action options */}
      <View className="flex-row items-center justify-between p-4 border-b border-gray-800">
        <TouchableOpacity onPress={() => navigation.navigate('Settings')}>
          <AntDesign name="arrow-left" size={24} color="white" />
        </TouchableOpacity>
        <Text className="text-white text-xl font-semibold">Providers</Text>
        <View className="flex-row items-center space-x-2">
          {isPerformingBulkAction ? (
            <ActivityIndicator size="small" color={primary} />
          ) : (
            <>
              {activeTab === 'available' && (
                <TouchableOpacity onPress={handleEnableAllProviders}>
                  <MaterialCommunityIcons
                    name="download-multiple"
                    size={24}
                    color={primary}
                  />
                </TouchableOpacity>
              )}
              {activeTab === 'installed' && (
                <TouchableOpacity onPress={handleDisableAllProviders}>
                  <MaterialCommunityIcons
                    name="delete-sweep"
                    size={24}
                    color="red"
                  />
                </TouchableOpacity>
              )}
            </>
          )}
          <TouchableOpacity onPress={handleRefresh}>
            <Feather name="refresh-cw" size={24} color={primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Custom Provider Base URL Settings */}
      <View className="mx-4 mt-4">
        <TouchableOpacity
          className="flex-row items-center justify-between bg-tertiary rounded-xl px-4 py-3 border border-quaternary"
          onPress={() => setShowBaseUrlSettings(!showBaseUrlSettings)}>
          <View className="flex-row items-center">
            <MaterialCommunityIcons
              name="cog-outline"
              size={22}
              color="#9CA3AF"
            />
            <Text className="text-white ml-3 font-medium">
              Provider Source Settings
            </Text>
          </View>
          <MaterialIcons
            name={showBaseUrlSettings ? 'expand-less' : 'expand-more'}
            size={24}
            color="#9CA3AF"
          />
        </TouchableOpacity>

        {showBaseUrlSettings && (
          <View className="bg-tertiary rounded-xl mt-2 p-4 border border-quaternary">
            {/* Warning Banner */}
            <View className="bg-yellow-900/30 border border-yellow-600/50 rounded-lg p-3 mb-4">
              <View className="flex-row items-center mb-2">
                <MaterialCommunityIcons
                  name="alert-outline"
                  size={20}
                  color="#F59E0B"
                />
                <Text className="text-yellow-500 font-bold ml-2">
                  Security Warning
                </Text>
              </View>
              <Text className="text-yellow-600/90 text-xs leading-5">
                Providers can execute arbitrary code in the app. Only use
                sources you trust.
              </Text>
            </View>

            {/* Toggle for Custom URL */}
            <View className="flex-row items-center justify-between mb-4">
              <View className="flex-1">
                <Text className="text-white font-medium">
                  Use Custom Provider Source
                </Text>
                <Text className="text-gray-400 text-xs mt-1">
                  Override the default provider repository
                </Text>
              </View>
              <Switch
                value={useCustomBaseUrl}
                onValueChange={handleToggleCustomBaseUrl}
                trackColor={{ false: '#374151', true: primary }}
                thumbColor={useCustomBaseUrl ? '#fff' : '#9CA3AF'}
              />
            </View>

            {/* Custom URL Input */}
            {useCustomBaseUrl && (
              <View>
                <Text className="text-gray-400 text-sm mb-2">
                  Provider Base URL
                </Text>
                <View className="flex-row items-center">
                  <TextInput
                    className="flex-1 bg-quaternary rounded-lg px-4 py-3 text-white border border-gray-700"
                    placeholder="https://example.com/providers"
                    placeholderTextColor="#6B7280"
                    value={customBaseUrl}
                    onChangeText={setCustomBaseUrl}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                  />
                  <TouchableOpacity
                    onPress={handleSaveCustomBaseUrl}
                    className="ml-2 px-4 py-3 rounded-lg"
                    style={{ backgroundColor: primary }}>
                    <Text className="text-white font-medium">Save</Text>
                  </TouchableOpacity>
                </View>
                <Text className="text-gray-500 text-xs mt-2">
                  URL should point to a repository containing manifest.json
                </Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Tabs */}
      <View className="flex-row bg-zinc-900 mx-4 mt-4 rounded-xl p-1 h-14 items-center">
        <TouchableOpacity
          onPress={() => handleTabChange('installed')}
          className="flex-1 h-full justify-center items-center rounded-xl"
          style={{
            flex: 1,
            paddingRight: 4,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor:
              activeTab === 'installed' ? primary : 'transparent',
          }}>
          <Text
            style={{
              color: activeTab === 'installed' ? 'white' : '#9CA3AF',
              fontSize: 16,
              fontWeight: '600',
              textAlign: 'center',
            }}>
            Installed ({(installedProviders || []).length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => handleTabChange('available')}
          className="flex-1 h-full justify-center items-center rounded-xl"
          style={{
            flex: 1,
            paddingLeft: 4,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor:
              activeTab === 'available' ? primary : 'transparent',
          }}>
          <Text
            style={{
              color: activeTab === 'available' ? 'white' : '#9CA3AF',
              fontSize: 16,
              fontWeight: '600',
              textAlign: 'center',
            }}>
            Available ({(availableProviders || []).length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View className="mx-4 mt-2">
        <View className="flex-row items-center bg-[#1A1A1A] rounded-xl px-3 py-2 border border-[#333333]">
          <Feather name="search" size={18} color="gray" />
          <TextInput
            className="flex-1 text-white ml-2 text-sm"
            placeholder="Search provider name or type..."
            placeholderTextColor="#666666"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Feather name="x" size={18} color="gray" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter Section */}
      {/* Filter Section */}
      <View className="mx-4 mt-4 mb-2 flex-row items-center gap-x-2">
        {/* Horizontal Type Filters - Grows to fill space */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="flex-1"
          contentContainerStyle={{ paddingRight: 10 }}>
          {uniqueTypes.map((type, index) => (
            <TouchableOpacity
              key={`type-${index}`}
              onPress={() => setSelectedType(type)}
              className={`px-3 py-1.5 rounded-full mr-2 border ${selectedType === type
                ? 'bg-' + primary
                : 'bg-[#1A1A1A] border-[#333333]'
                }`}
              style={{
                backgroundColor: selectedType === type ? primary : '#1A1A1A',
                borderColor: selectedType === type ? primary : '#333333',
              }}>
              <Text
                className={`text-xs font-medium ${selectedType === type ? 'text-white' : 'text-gray-400'
                  }`}>
                {type === 'All' ? 'All' : type.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Category Filter Icon Button */}
        <TouchableOpacity
          onPress={() => setCategoryModalVisible(true)}
          className={`h-8 w-8 items-center justify-center rounded-full border ${selectedCategory !== 'All'
            ? 'bg-' + primary + ' border-' + primary
            : 'bg-[#1A1A1A] border-[#333333]'
            }`}
          style={{
            backgroundColor: selectedCategory !== 'All' ? primary : '#1A1A1A',
            borderColor: selectedCategory !== 'All' ? primary : '#333333',
          }}>
          <Feather
            name="filter"
            size={14}
            color={selectedCategory !== 'All' ? 'white' : 'gray'}
          />
        </TouchableOpacity>
      </View>

      {/* Provider list */}
      <FlatList
        data={currentData}
        keyExtractor={(item, index) => item?.value || `provider-${index}`}
        renderItem={renderProviderCard}
        className="flex-1"
        contentContainerStyle={{ paddingTop: 8 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[primary]}
            tintColor={primary}
            progressBackgroundColor="black"
          />
        }
        ListEmptyComponent={
          <View className="flex-1 justify-center items-center py-20">
            <MaterialCommunityIcons
              name="package-variant"
              size={64}
              color="gray"
            />
            <Text className="text-gray-400 text-lg mt-4">
              {searchQuery ||
                selectedType !== 'All' ||
                selectedCategory !== 'All'
                ? 'No matching providers found'
                : activeTab === 'installed'
                  ? 'No providers installed'
                  : 'No providers available'}
            </Text>
            <Text className="text-gray-500 text-sm mt-2 text-center px-8">
              {searchQuery ||
                selectedType !== 'All' ||
                selectedCategory !== 'All'
                ? 'Try adjusting your filters'
                : activeTab === 'installed'
                  ? 'Install providers from the Available tab to get started'
                  : 'Pull to refresh to check for available providers'}
            </Text>
          </View>
        }
      />

      {/* Category Selection Modal */}
      <Modal
        visible={isCategoryModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setCategoryModalVisible(false)}>
        <TouchableWithoutFeedback
          onPress={() => setCategoryModalVisible(false)}>
          <View className="flex-1 justify-end bg-black/50">
            <TouchableWithoutFeedback onPress={e => e.stopPropagation()}>
              <View
                className="bg-[#1A1A1A] rounded-t-3xl h-[50%] w-full"
                style={{
                  borderTopLeftRadius: 24,
                  borderTopRightRadius: 24,
                  overflow: 'hidden',
                  backgroundColor: '#1A1A1A',
                }}>
                {/* Modal Header */}
                <View className="flex-row items-center justify-between p-4 border-b border-[#333333]">
                  <Text className="text-white text-lg font-bold">
                    Select Category
                  </Text>
                  <TouchableOpacity
                    onPress={() => setCategoryModalVisible(false)}>
                    <Feather name="x" size={24} color="gray" />
                  </TouchableOpacity>
                </View>
                {/* Modal Content */}
                <ScrollView
                  contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
                  {uniqueCategories.map((item, index) => (
                    <TouchableOpacity
                      key={`modal-cat-${index}`}
                      onPress={() => {
                        setSelectedCategory(item);
                        setCategoryModalVisible(false);
                      }}
                      className="py-3 border-b border-[#333333]">
                      <View className="flex-row items-center justify-between">
                        <Text
                          className={`text-sm font-medium ${selectedCategory === item
                            ? 'text-white'
                            : 'text-gray-400'
                            }`}>
                          {item.toUpperCase()}
                        </Text>
                        {selectedCategory === item && (
                          <Feather name="check" size={18} color={primary} />
                        )}
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

    </View>
  );
};

export default Extensions;