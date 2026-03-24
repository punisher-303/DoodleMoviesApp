import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import { extensionStorage, ProviderSource } from '../../../lib/storage';
import { extensionManager } from '../../../lib/services/ExtensionManager';
import { createProviderSource } from '../../../lib/utils/helpers';
import useThemeStore from '../../../lib/zustand/themeStore';
import { socialLinks } from '../../../lib/constants';

const ProviderSourceManager: React.FC = () => {
  const { primary } = useThemeStore();
  const [sources, setSources] = useState<ProviderSource[]>(
    extensionStorage.getProviderSources(),
  );
  const [newSourceValue, setNewSourceValue] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState<string | null>(null);

  const activeSourceAuthor = useMemo(() => {
    return extensionStorage.getProviderSource()?.author;
  }, []);

  const refreshSources = useCallback(() => {
    setSources(extensionStorage.getProviderSources());
  }, []);

  const handleAddSource = async () => {
    const value = newSourceValue.trim();
    if (!value) {
      return;
    }

    setIsAdding(true);
    try {
      const newSource = createProviderSource(value);
      
      // Check if already exists
      if (sources.some(s => s.author === newSource.author)) {
        Alert.alert('Source Exists', 'This provider source is already added.');
        setIsAdding(false);
        return;
      }

      // Try to fetch manifest to validate
      await extensionManager.fetchManifest(newSource, true);
      
      extensionStorage.addProviderSources(newSource.author, newSource.url);
      setNewSourceValue('');
      refreshSources();
      Alert.alert('Success', `Added provider source from ${newSource.author}`);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to add provider source. Make sure the URL or author is valid.');
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveSource = (author: string) => {
    Alert.alert(
      'Remove Source',
      `Are you sure you want to remove the source from ${author}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            extensionStorage.removeProviderSource(author);
            refreshSources();
          },
        },
      ],
    );
  };

  const handleSetDefault = (author: string) => {
    extensionStorage.setDefaultProviderSource(author);
    refreshSources();
    
    // Refresh manifest for the new default source
    const source = extensionStorage.getProviderSource();
    if (source) {
      setIsRefreshing(author);
      extensionManager.fetchManifest(source, true)
        .catch(console.error)
        .finally(() => setIsRefreshing(null));
    }
  };

  const handleRefreshSource = async (source: ProviderSource) => {
    setIsRefreshing(source.author);
    try {
      await extensionManager.fetchManifest(source, true);
      Alert.alert('Success', `Refreshed manifest for ${source.author}`);
    } catch (error: any) {
      Alert.alert('Error', `Failed to refresh manifest: ${error.message}`);
    } finally {
      setIsRefreshing(null);
    }
  };

  return (
    <View className="flex-1 bg-black p-4">
      <View className="flex-row items-center mb-6">
        <Text className="text-white text-xl font-bold flex-1">Provider Sources</Text>
        <TouchableOpacity
          onPress={() => Linking.openURL(`${socialLinks.github}/doodle-providers`)}
          className="p-2 bg-white/10 rounded-full">
          <Feather name="help-circle" size={20} color="lightgray" />
        </TouchableOpacity>
      </View>

      <Text className="text-gray-400 mb-4 text-sm leading-5">
        Add multiple sources for providers. You can provide a GitHub username (e.g., @punisher-303) or a full GitHub repository URL.
      </Text>

      <View className="flex-row items-center mb-8">
        <TextInput
          value={newSourceValue}
          onChangeText={setNewSourceValue}
          placeholder="GitHub Username or Repo URL"
          placeholderTextColor="#666"
          className="flex-1 bg-white/10 text-white p-3 rounded-l-lg border border-white/5"
        />
        <TouchableOpacity
          onPress={handleAddSource}
          disabled={isAdding || !newSourceValue.trim()}
          style={{ backgroundColor: primary }}
          className="p-3 rounded-r-lg min-w-[80px] items-center justify-center">
          {isAdding ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text className="text-white font-bold">Add</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {sources.length === 0 ? (
          <View className="items-center py-12">
            <Feather name="layers" size={48} color="#333" />
            <Text className="text-gray-500 mt-4 text-center">
              No custom sources added yet.
            </Text>
          </View>
        ) : (
          sources.map((source) => (
            <View
              key={source.author}
              className={`mb-4 p-4 rounded-xl border ${
                source.isDefault ? 'bg-white/10 border-white/20' : 'bg-white/5 border-transparent'
              }`}>
              <View className="flex-row items-center">
                <View className="flex-1">
                  <View className="flex-row items-center">
                    <Text className="text-white font-bold text-lg">{source.author}</Text>
                    {source.isDefault && (
                      <View 
                        style={{ backgroundColor: `${primary}20` }}
                        className="ml-2 px-2 py-0.5 rounded border border-white/10">
                        <Text style={{ color: primary }} className="text-[10px] font-bold uppercase">Active</Text>
                      </View>
                    )}
                  </View>
                  <Text className="text-gray-500 text-xs mt-1" numberOfLines={1}>
                    {source.url.replace('https://raw.githubusercontent.com/', '')}
                  </Text>
                </View>

                <View className="flex-row items-center">
                  <TouchableOpacity
                    onPress={() => handleRefreshSource(source)}
                    disabled={isRefreshing === source.author}
                    className="p-2 mr-2">
                    {isRefreshing === source.author ? (
                      <ActivityIndicator size="small" color="lightgray" />
                    ) : (
                      <Feather name="refresh-cw" size={18} color="lightgray" />
                    )}
                  </TouchableOpacity>

                  {!source.isDefault && (
                    <TouchableOpacity
                      onPress={() => handleSetDefault(source.author)}
                      className="p-2 mr-2">
                      <Feather name="check-circle" size={18} color="gray" />
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    onPress={() => handleRemoveSource(source.author)}
                    className="p-2">
                    <Feather name="trash-2" size={18} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
};

export default ProviderSourceManager;
