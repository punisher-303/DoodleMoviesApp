import { View, Text, Platform, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React, { memo } from 'react';
import { useNavigation } from '@react-navigation/native';
import { WatchListStackParamList } from '../App';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { FlashList } from '@shopify/flash-list';

import useThemeStore from '../lib/zustand/themeStore';
import useWatchListStore from '../lib/zustand/watchListStore';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { StatusBar } from 'expo-status-bar';

const WatchListItem = memo(({ item, itemWidth, navigation }: { item: any, itemWidth: number, navigation: any }) => (
    <TouchableOpacity
      onPress={() =>
        navigation.navigate('Info', {
          link: item.link,
          provider: item.provider,
          poster: item.poster,
        })
      }
      style={{
        width: itemWidth,
        marginBottom: 16,
      }}>
      <View className="relative overflow-hidden">
        <Image
          className="rounded-xl"
          style={{
            width: itemWidth,
            height: 155,
            borderRadius: 10,
          }}
          source={{ uri: item.poster }}
          cachePolicy="memory-disk"
        />
        <Text
          className="text-white text-xs truncate text-center mt-1"
          style={{ maxWidth: itemWidth }}
          numberOfLines={1}>
          {item.title}
        </Text>
      </View>
    </TouchableOpacity>
));

const WatchList = () => {
  const { primary } = useThemeStore(state => state);
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<WatchListStackParamList>>();
  const { watchList } = useWatchListStore(state => state);

  const screenWidth = Dimensions.get('window').width;
  const containerPadding = 12;
  const itemSpacing = 10;
  const availableWidth = screenWidth - containerPadding * 2;
  const numColumns = Math.floor(
    (availableWidth + itemSpacing) / (100 + itemSpacing),
  );
  const itemWidth =
    (availableWidth - itemSpacing * (numColumns - 1)) / numColumns;

  return (
    <View className="flex-1 bg-black justify-center items-center">
      <StatusBar translucent backgroundColor="transparent" />

      <View
        className="w-full bg-black"
        style={{
          paddingTop: insets.top,
        }}
      />

      <View className="flex-1 w-full px-3">
        <Text
          className="text-2xl text-center font-bold mb-6 mt-4"
          style={{ color: primary }}>
          Watchlist
        </Text>

        {watchList.length > 0 ? (
          <FlashList
            data={watchList}
            renderItem={({ item }) => <WatchListItem item={item} itemWidth={itemWidth} navigation={navigation} />}
            keyExtractor={(item, index) => item.link + index}
            numColumns={numColumns}
            estimatedItemSize={180}
            contentContainerStyle={{
              paddingBottom: 50,
            }}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <View className="flex-1">
            <View className="items-center justify-center mt-20 mb-12">
              <MaterialCommunityIcons
                name="playlist-remove"
                size={80}
                color={primary}
              />
              <Text className="text-white/70 text-base mt-4 text-center">
                Your WatchList is empty
              </Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );
};

export default WatchList;
