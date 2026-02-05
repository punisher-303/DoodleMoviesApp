import { View, Text, Image } from 'react-native';
import RenderProviderFlagIcon from './RenderProviderFLagIcon';
import React from 'react';
import useContentStore from '../lib/zustand/contentStore';
import { ScrollView } from 'moti';
import useThemeStore from '../lib/zustand/themeStore';
import { TouchableOpacity, GestureResponderEvent } from 'react-native';
import { DrawerLayout } from 'react-native-gesture-handler';
import { BlurView } from 'expo-blur';
import { MaterialIcons } from '@expo/vector-icons';


const ProviderDrawer = ({
  closeDrawer,
}: {
  closeDrawer: () => void;
}) => {
  const { provider, setProvider, installedProviders } = useContentStore(
    state => state,
  );
  const { primary } = useThemeStore(state => state);

  return (
    <BlurView
      intensity={90}
      experimentalBlurMethod="dimezisBlurView"
      blurReductionFactor={5}
      tint="dark"
      className="flex-1">
      <View className="mt-8 px-4 pb-4 border-b border-white/10">
        <Text className="text-white text-2xl font-bold">Select Provider</Text>
        <Text className="text-gray-400 mt-1 text-sm">doodle movies source</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1 px-2">
        {installedProviders.map(item => (
          <TouchableOpacity
            key={item.value}
            onPress={() => {
              setProvider(item);
              closeDrawer();
            }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 16,
              marginVertical: 4,
              borderRadius: 8,
              backgroundColor: provider.value === item.value ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
            }}
            focusedStyle={{
              borderColor: 'white',
              borderWidth: 1,
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
            }}>
            <View className="flex-row items-center flex-1">
              {item.icon ? (
                <Image
                  source={{ uri: item.icon }}
                  className="w-10 h-10 rounded-md bg-zinc-800"
                  style={{
                    resizeMode: 'cover',
                    borderColor: provider.value === item.value ? primary : 'gray',
                    borderWidth: 1,
                  }}
                />
              ) : (
                <View
                  className="w-10 h-10 bg-zinc-800 rounded-md items-center justify-center"
                  style={{
                    borderColor: provider.value === item.value ? primary : 'gray',
                    borderWidth: 1,
                  }}>
                  <RenderProviderFlagIcon type={item.type} />
                </View>
              )}
              <View className="ml-3 flex-1">
                <Text className="text-white font-bold text-base">
                  {item.display_name}
                </Text>
                <Text className="text-gray-400 text-xs mt-0.5">
                  {item.type?.toUpperCase()} • V{item.version?.toUpperCase()}
                </Text>
              </View>
            </View>
            {provider.value === item.value && (
              <MaterialIcons name="check" size={20} color={primary} />
            )}
          </TouchableOpacity>
        ))}
        <View className="h-16" />
      </ScrollView>
    </BlurView>
  );
};

export default ProviderDrawer;
