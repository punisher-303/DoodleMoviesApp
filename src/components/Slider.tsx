import { Image, Pressable, Text, TouchableOpacity, View } from 'react-native';
import React from 'react';
import type { Post } from '../lib/providers/types';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { HomeStackParamList } from '../App';
import useContentStore from '../lib/zustand/contentStore';
import { FlashList } from '@shopify/flash-list';
import SkeletonLoader from './Skeleton';

// import useWatchHistoryStore from '../lib/zustand/watchHistrory';
import useThemeStore from '../lib/zustand/themeStore';


export default function Slider({
  isLoading,
  title,
  posts,
  filter,
  providerValue,
  isSearch = false,
}: {
  isLoading: boolean;
  title: string;
  posts: Post[];
  filter: string;
  providerValue?: string;
  isSearch?: boolean;
}): JSX.Element {
  const { provider } = useContentStore(state => state);
  const { primary } = useThemeStore(state => state);
  const navigation =
    useNavigation<NativeStackNavigationProp<HomeStackParamList>>();
  const [isSelected, setSelected] = React.useState('');
  // const {removeItem} = useWatchHistoryStore(state => state);

  return (
    <Pressable onPress={() => setSelected('')} className="gap-3 mt-3 px-2">
      <View className="flex flex-row items-center justify-between">
        <Text className="text-2xl font-semibold" style={{ color: primary }}>
          {title}
        </Text>
        {filter !== 'recent' && (
          <TouchableOpacity
            onPress={() =>
              navigation.navigate('ScrollList', {
                title: title,
                filter: filter,
                providerValue: providerValue,
                isSearch: isSearch,
              })
            }>
            <Text className="text-white text-sm">more</Text>
          </TouchableOpacity>
        )}
      </View>
      {isLoading ? (
        <View className="flex flex-row gap-2 overflow-hidden">
          {Array.from({ length: 20 }).map((_, index) => (
            <View
              className="mx-3 gap-0 flex mb-3 justify-center items-center"
              key={index}>
              <SkeletonLoader height={150} width={100} />
              <SkeletonLoader height={12} width={97} />
            </View>
          ))}
        </View>
      ) : (
        <FlashList
          estimatedItemSize={30}
          showsHorizontalScrollIndicator={false}
          data={posts}
          extraData={isSelected}
          horizontal
          contentContainerStyle={{ paddingHorizontal: 3, paddingTop: 7 }}
          renderItem={({ item }) => (
            <SliderItem
              item={item}
              isSelected={isSelected}
              setSelected={setSelected}
              navigation={navigation}
              providerValue={providerValue}
              provider={provider}
            />
          )}
          ListFooterComponent={
            !isLoading && posts.length === 0 ? (
              <View className="flex flex-row w-96 justify-center h-10 items-center">
                <Text className="text-whiter text-center text-white">
                  No content found
                </Text>
              </View>
            ) : null
          }
          keyExtractor={item => item.link}
        />
      )}
    </Pressable>
  );
}
