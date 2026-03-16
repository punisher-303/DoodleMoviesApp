import React, { useState, useEffect, useRef, useMemo, memo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
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
import { FlashList } from '@shopify/flash-list';

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

const ProviderCard = memo(({ 
  item, 
  activeTab, 
  activeExtensionProvider, 
  installingProvider, 
  updatingProvider, 
  updateInfos, 
  primary,
  onInstall,
  onUninstall,
  onUpdate,
  onSetActive
}: { 
  item: ProviderExtension, 
  activeTab: TabType, 
  activeExtensionProvider: any, 
  installingProvider: string | null, 
  updatingProvider: string | null, 
  updateInfos: UpdateInfo[], 
  primary: string,
  onInstall: (item: any) => void,
  onUninstall: (item: any) => void,
  onUpdate: (item: any) => void,
  onSetActive: (item: any) => void
}) => {
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
        <View className="flex-row items-center gap-4 justify-between">
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
              {hasUpdate && (
                <View
                  style={{ backgroundColor: primary }}
                  className="px-2 py-0.5 rounded-full ml-1">
                  <Text className="text-[10px] text-white font-semibold">
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
                  onPress={() => onSetActive(item)}
                  className={`w-9 h-9 rounded-full items-center justify-center ${isActive ? 'bg-green-600' : 'bg-gray-700'
                    }`}>
                  <MaterialIcons
                    name={isActive ? 'check-circle' : 'radio-button-unchecked'}
                    size={20}
                    color="white"
                  />
                </TouchableOpacity>
                {hasUpdate && (
                  <TouchableOpacity
                    onPress={() => onUpdate(updateInfo!.provider)}
                    disabled={isUpdating}
                    className="w-9 h-9 rounded-full items-center justify-center"
                    style={{
                      backgroundColor: primary,
                      opacity: isUpdating ? 0.7 : 1,
                    }}>
                    {isUpdating ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <MaterialCommunityIcons name="update" size={20} color="white" />
                    )}
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => onUninstall(item)}
                  className="w-9 h-9 rounded-full items-center justify-center bg-red-600">
                  <MaterialCommunityIcons name="delete" size={20} color="white" />
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                onPress={() => onInstall(item)}
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
});

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

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('All');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isCategoryModalVisible, setCategoryModalVisible] = useState(false);

  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    const initializeExtensions = async () => {
      try {
        await extensionManager.initialize();
        if (isMounted.current) {
          loadProviders();
          await checkForUpdates();
        }
        if (
          isMounted.current &&
          (!availableProviders || availableProviders.length === 0)
        ) {
          await handleRefresh();
        }
      } catch (error) {
        if (isMounted.current) {
          loadProviders();
        }
      }
    };

    initializeExtensions();

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
    if (!provider || !provider.value) return;
    if (settingsStorage.isHapticFeedbackEnabled()) {
      ReactNativeHapticFeedback.trigger('effectClick', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
    }
    if (isMounted.current) setUpdatingProvider(provider.value);
    try {
      const success = await updateProvidersService.updateProvider(provider);
      if (success && isMounted.current) {
        loadProviders();
        await checkForUpdates();
        Alert.alert('Success', `${provider.display_name} updated successfully!`);
        if (activeExtensionProvider?.value === provider.value) {
          setActiveExtensionProvider(provider);
        }
      }
    } catch (error) {
      console.error('Update error:', error);
    } finally {
      if (isMounted.current) setUpdatingProvider(null);
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
    if (!provider || !provider.value) return;
    if (settingsStorage.isHapticFeedbackEnabled()) {
      ReactNativeHapticFeedback.trigger('effectClick', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
    }
    if (isMounted.current) setInstallingProvider(provider.value);
    try {
      await extensionManager.installProvider(provider);
      if (isMounted.current) {
        loadProviders();
        Alert.alert('Success', `${provider.display_name} installed successfully!`);
        setInstalledProviders(extensionStorage.getInstalledProviders() || []);
        if (!activeExtensionProvider || activeExtensionProvider.value !== provider.value) {
          setActiveExtensionProvider(provider);
        }
      }
    } catch (error) {
      console.error('Installation error:', error);
    } finally {
      if (isMounted.current) setInstallingProvider(null);
    }
  };

  const handleUninstallProvider = (provider: ProviderExtension) => {
    if (!provider || !provider.value) return;
    Alert.alert(
      'Uninstall Provider',
      `Are you sure you want to uninstall ${provider.display_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Uninstall',
          style: 'destructive',
          onPress: () => {
            extensionStorage.uninstallProvider(provider.value);
            loadProviders();
            setInstalledProviders(extensionStorage.getInstalledProviders() || []);
            if (activeExtensionProvider?.value === provider?.value) {
              setActiveExtensionProvider(extensionStorage.getInstalledProviders()[0]);
            }
          },
        },
      ],
    );
  };

  const handleSetActiveProvider = (provider: ProviderExtension) => {
    if (!provider || !provider.value) return;
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
      Alert.alert(
        '⚠️ Security Warning',
        'Custom provider sources can run arbitrary code. Only use trusted sources.',
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
    if (!customBaseUrl.trim()) return;
    settingsStorage.setCustomProviderBaseUrl(customBaseUrl.trim());
    Alert.alert('Success', 'Provider base URL updated. Refresh to apply.');
  };

  const handleRefresh = async () => {
    if (isMounted.current) setRefreshing(true);
    try {
      const providers = await extensionManager.fetchManifest(true);
      if (isMounted.current) {
        extensionStorage.setAvailableProviders(providers);
        setAvailableProviders(providers);
        loadProviders();
        await checkForUpdates();
      }
    } catch (error) {
      console.error('Refresh error:', error);
    } finally {
      if (isMounted.current) setRefreshing(false);
    }
  };

  const handleEnableAllProviders = async () => {
    const availableToInstall = (availableProviders || []).filter(
      p => p && p.value && !extensionStorage.isProviderInstalled(p.value),
    );
    if (availableToInstall.length === 0) return;
    Alert.alert(
      'Enable All',
      `Install ${availableToInstall.length} providers?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Install All',
          onPress: async () => {
            if (isMounted.current) setIsPerformingBulkAction(true);
            try {
              await Promise.all(availableToInstall.map(p => extensionManager.installProvider(p)));
              if (isMounted.current) {
                loadProviders();
                setActiveTab('installed');
              }
            } finally {
              if (isMounted.current) setIsPerformingBulkAction(false);
            }
          },
        },
      ],
    );
  };

  const handleDisableAllProviders = () => {
    if ((installedProviders || []).length === 0) return;
    Alert.alert(
      'Disable All',
      'Uninstall all providers?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Uninstall All',
          style: 'destructive',
          onPress: () => {
            installedProviders?.forEach(p => p && p.value && extensionStorage.uninstallProvider(p.value));
            loadProviders();
            setActiveExtensionProvider(undefined);
          },
        },
      ],
    );
  };

  const uniqueTypes = useMemo(() => {
    const all = [...(installedProviders || []), ...(availableProviders || [])];
    const types = new Set(all.map(p => p.type).filter(Boolean));
    return ['All', ...Array.from(types)];
  }, [installedProviders, availableProviders]);

  const uniqueCategories = useMemo(() => {
    const all = [...(installedProviders || []), ...(availableProviders || [])];
    const cats = new Set(all.map(p => p.category).filter(Boolean));
    return ['All', ...Array.from(cats)];
  }, [installedProviders, availableProviders]);

  const currentData = useMemo(() => {
    let data = activeTab === 'installed'
        ? (installedProviders || []).filter(item => item && item.value)
        : (availableProviders || []).filter(item => item && item.value);

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      data = data.filter(p =>
        p.display_name?.toLowerCase().includes(q) ||
        p.type?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q)
      );
    }
    if (selectedType !== 'All') data = data.filter(p => p.type === selectedType);
    if (selectedCategory !== 'All') data = data.filter(p => p.category === selectedCategory);
    return data;
  }, [activeTab, installedProviders, availableProviders, searchQuery, selectedType, selectedCategory]);

  return (
    <View className="flex-1 bg-black pt-10 pb-16">
      <StatusBar backgroundColor="black" barStyle="light-content" />
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
                  <MaterialCommunityIcons name="download-multiple" size={24} color={primary} />
                </TouchableOpacity>
              )}
              {activeTab === 'installed' && (
                <TouchableOpacity onPress={handleDisableAllProviders}>
                  <MaterialCommunityIcons name="delete-sweep" size={24} color="red" />
                </TouchableOpacity>
              )}
            </>
          )}
          <TouchableOpacity onPress={handleRefresh}>
            <Feather name="refresh-cw" size={24} color={primary} />
          </TouchableOpacity>
        </View>
      </View>

      <View className="mx-4 mt-4">
        <TouchableOpacity
          className="flex-row items-center justify-between bg-tertiary rounded-xl px-4 py-3 border border-quaternary"
          onPress={() => setShowBaseUrlSettings(!showBaseUrlSettings)}>
          <View className="flex-row items-center">
            <MaterialCommunityIcons name="cog-outline" size={22} color="#9CA3AF" />
            <Text className="text-white ml-3 font-medium">Provider Source Settings</Text>
          </View>
          <MaterialIcons name={showBaseUrlSettings ? 'expand-less' : 'expand-more'} size={24} color="#9CA3AF" />
        </TouchableOpacity>

        {showBaseUrlSettings && (
          <View className="bg-tertiary rounded-xl mt-2 p-4 border border-quaternary">
            <View className="bg-yellow-900/30 border border-yellow-600/50 rounded-lg p-3 mb-4">
              <View className="flex-row items-center mb-2">
                <MaterialCommunityIcons name="alert-outline" size={20} color="#F59E0B" />
                <Text className="text-yellow-500 font-bold ml-2">Security Warning</Text>
              </View>
              <Text className="text-yellow-600/90 text-xs leading-5">Providers can execute arbitrary code. Only use trusted sources.</Text>
            </View>

            <View className="flex-row items-center justify-between mb-4">
              <View className="flex-1">
                <Text className="text-white font-medium">Use Custom Provider Source</Text>
                <Text className="text-gray-400 text-xs mt-1">Override the default provider repository</Text>
              </View>
              <Switch
                value={useCustomBaseUrl}
                onValueChange={handleToggleCustomBaseUrl}
                trackColor={{ false: '#374151', true: primary }}
                thumbColor={useCustomBaseUrl ? '#fff' : '#9CA3AF'}
              />
            </View>

            {useCustomBaseUrl && (
              <View>
                <Text className="text-gray-400 text-sm mb-2">Provider Base URL</Text>
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
              </View>
            )}
          </View>
        )}
      </View>

      <View className="flex-row bg-zinc-900 mx-4 mt-4 rounded-xl p-1 h-14 items-center">
        <TouchableOpacity
          onPress={() => handleTabChange('installed')}
          className="flex-1 h-full justify-center items-center rounded-xl"
          style={{ backgroundColor: activeTab === 'installed' ? primary : 'transparent' }}>
          <Text style={{ color: activeTab === 'installed' ? 'white' : '#9CA3AF', fontSize: 16, fontWeight: '600' }}>
            Installed ({(installedProviders || []).length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => handleTabChange('available')}
          className="flex-1 h-full justify-center items-center rounded-xl"
          style={{ backgroundColor: activeTab === 'available' ? primary : 'transparent' }}>
          <Text style={{ color: activeTab === 'available' ? 'white' : '#9CA3AF', fontSize: 16, fontWeight: '600' }}>
            Available ({(availableProviders || []).length})
          </Text>
        </TouchableOpacity>
      </View>

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

      <View className="mx-4 mt-4 mb-2 flex-row items-center gap-x-2">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-1">
          {uniqueTypes.map((type, index) => (
            <TouchableOpacity
              key={`type-${index}`}
              onPress={() => setSelectedType(type)}
              className="px-3 py-1.5 rounded-full mr-2 border"
              style={{
                backgroundColor: selectedType === type ? primary : '#1A1A1A',
                borderColor: selectedType === type ? primary : '#333333',
              }}>
              <Text className={`text-xs font-medium ${selectedType === type ? 'text-white' : 'text-gray-400'}`}>
                {type === 'All' ? 'All' : type.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <TouchableOpacity
          onPress={() => setCategoryModalVisible(true)}
          className="h-8 w-8 items-center justify-center rounded-full border"
          style={{
            backgroundColor: selectedCategory !== 'All' ? primary : '#1A1A1A',
            borderColor: selectedCategory !== 'All' ? primary : '#333333',
          }}>
          <Feather name="filter" size={14} color={selectedCategory !== 'All' ? 'white' : 'gray'} />
        </TouchableOpacity>
      </View>

      <FlashList
        data={currentData}
        estimatedItemSize={110}
        keyExtractor={(item) => item.value}
        renderItem={({ item }) => (
          <ProviderCard 
            item={item}
            activeTab={activeTab}
            activeExtensionProvider={activeExtensionProvider}
            installingProvider={installingProvider}
            updatingProvider={updatingProvider}
            updateInfos={updateInfos}
            primary={primary}
            onInstall={handleInstallProvider}
            onUninstall={handleUninstallProvider}
            onUpdate={handleUpdateProvider}
            onSetActive={handleSetActiveProvider}
          />
        )}
        ListEmptyComponent={
          <View className="flex-1 justify-center items-center py-20">
            <MaterialCommunityIcons name="package-variant" size={64} color="gray" />
            <Text className="text-gray-400 text-lg mt-4">
              {searchQuery || selectedType !== 'All' || selectedCategory !== 'All'
                ? 'No matching providers found'
                : activeTab === 'installed' ? 'No providers installed' : 'No providers available'}
            </Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[primary]}
            tintColor={primary}
            progressBackgroundColor="black"
          />
        }
      />

      <Modal
        visible={isCategoryModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setCategoryModalVisible(false)}>
        <TouchableWithoutFeedback onPress={() => setCategoryModalVisible(false)}>
          <View className="flex-1 justify-end bg-black/50">
            <TouchableWithoutFeedback onPress={e => e.stopPropagation()}>
              <View className="bg-[#1A1A1A] rounded-t-3xl h-[50%] w-full">
                <View className="flex-row items-center justify-between p-4 border-b border-[#333333]">
                  <Text className="text-white text-lg font-bold">Select Category</Text>
                  <TouchableOpacity onPress={() => setCategoryModalVisible(false)}>
                    <Feather name="x" size={24} color="gray" />
                  </TouchableOpacity>
                </View>
                <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
                  {uniqueCategories.map((item, index) => (
                    <TouchableOpacity
                      key={`modal-cat-${index}`}
                      onPress={() => {
                        setSelectedCategory(item);
                        setCategoryModalVisible(false);
                      }}
                      className="py-3 border-b border-[#333333]">
                      <View className="flex-row items-center justify-between">
                        <Text className={`text-sm font-medium ${selectedCategory === item ? 'text-white' : 'text-gray-400'}`}>
                          {item.toUpperCase()}
                        </Text>
                        {selectedCategory === item && <Feather name="check" size={18} color={primary} />}
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