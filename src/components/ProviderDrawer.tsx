import { View, Text } from 'react-native';
import React from 'react';
import useContentStore from '../lib/zustand/contentStore';
import { ScrollView } from 'moti';
import useThemeStore from '../lib/zustand/themeStore';
import { TouchableOpacity, GestureResponderEvent } from 'react-native';
import { DrawerLayout } from 'react-native-gesture-handler';
import { BlurView } from 'expo-blur';
import { MaterialIcons } from '@expo/vector-icons';
import TVFocusWrapper from './TVFocusWrapper';

const ProviderDrawer = ({
  drawerRef,
}: {
  drawerRef: React.RefObject<DrawerLayout>;
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
          <TVFocusWrapper
            key={item.value}
            onPress={() => {
              setProvider(item);
              drawerRef.current?.closeDrawer();
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
            <View className="flex-row items-center">
              <MaterialIcons
                name="movie"
                size={20}
                color={provider.value === item.value ? primary : '#888'}
              />
              <Text
                className={`ml-3 text-base ${provider.value === item.value
                    ? 'text-white font-medium'
                    : 'text-gray-400'
                  }`}>
                {item.display_name}
              </Text>
            </View>
            {provider.value === item.value && (
              <MaterialIcons name="check" size={20} color={primary} />
            )}
          </TVFocusWrapper>
        ))}
        <View className="h-16" />
      </ScrollView>
    </BlurView>
  );
};

export default ProviderDrawer;
