import { Pressable, Text, View } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import React, { useMemo } from 'react';
import type { Post } from '../lib/providers/types';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { HomeStackParamList } from '../App';
import useContentStore from '../lib/zustand/contentStore';
import SkeletonLoader from './Skeleton';
import { Image } from 'expo-image';
import { FlashList } from '@shopify/flash-list';

// import useWatchHistoryStore from '../lib/zustand/watchHistrory';
import useThemeStore from '../lib/zustand/themeStore';


const SKELETON_DATA = Array.from({ length: 10 }).map((_, i) => ({ link: `skeleton-${i}`, title: '', image: '', type: 'skeleton' as const }));

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

  const displayData = useMemo(() => {
    if (isLoading && (!posts || posts.length === 0)) {
        return SKELETON_DATA;
    }
    return posts || [];
  }, [isLoading, posts]);

  return (
    <View className="gap-3 mt-3 px-2">
      <View className="flex flex-row items-center justify-between">
        <Text className="text-xl font-bold" style={{ color: primary }}>
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
      <View style={{ minHeight: 180 }}>
        <FlashList
          showsHorizontalScrollIndicator={false}
          data={displayData}
          horizontal
          estimatedItemSize={116}
          contentContainerStyle={{ paddingHorizontal: 3, paddingTop: 7 }}
          renderItem={({ item }) => {
            if ('type' in item && item.type === 'skeleton') {
                return (
                    <View className="mx-2 gap-0 flex mb-3 justify-center items-center">
                        <SkeletonLoader height={150} width={100} />
                        <SkeletonLoader height={12} width={97} />
                    </View>
                );
            }
            return (
                <SliderItem
                  item={item as Post}
                  navigation={navigation}
                  providerValue={providerValue}
                  provider={provider}
                />
            );
          }}
          ListFooterComponent={
            !isLoading && displayData.length === 0 ? (
              <View className="flex flex-row w-96 justify-center h-10 items-center">
                <Text className="text-whiter text-center text-white">
                  No content found
                </Text>
              </View>
            ) : null
          }
          keyExtractor={item => item.link}
        />
      </View>
    </View>
  );
}

export default React.memo(Slider);

const SliderItem = React.memo(({
  item,
  navigation,
  providerValue,
  provider
}: {
  item: Post;
  navigation: any;
  providerValue?: string;
  provider: any;
}) => {
  const isPerson = item.type === 'person';

  return (
    <View className="flex flex-col mx-2 items-center">
      <TouchableOpacity
        onPress={e => {
          if (e && e.stopPropagation) {
            e.stopPropagation();
          }
          if (isPerson) {
            const name = item.title;
            const linkParts = item.link.split(':');
            // Check if it's a direct person reference (e.g. person_id:1234:Name)
            if (item.link.startsWith('person_id:')) {
              const personId = linkParts[1];
              navigation.navigate('CastDetail', {
                personId: personId,
                name: name,
              });
            } else {
              //@ts-ignore
              navigation.navigate('SearchStack', {
                screen: 'ScrollList',
                params: {
                  filter: item.link,
                  title: name,
                  isSearch: true,
                  providerValue: item.provider || providerValue || provider?.value,
                },
              });
            }
            return;
          }
          navigation.navigate('Info', {
            link: item.link,
            provider: item.provider || providerValue || provider?.value,
            poster: item?.image,
          });
        }}>
        <Image
          className={isPerson ? "rounded-full" : "rounded-md"}
          source={{
            uri:
              item?.image ||
              (isPerson 
                ? 'https://placehold.jp/24/363636/ffffff/150x150.png?text=Actor'
                : 'https://placehold.jp/24/363636/ffffff/100x150.png?text=doodle'),
          }}
          style={isPerson ? { width: 80, height: 80 } : { width: 100, height: 150 }}
          cachePolicy="memory-disk"
          contentFit="cover"
        />
      </TouchableOpacity>
      <Text 
        className="text-white text-center truncate w-24 text-[10px] mt-1" 
        numberOfLines={1}
      >
        {item.title}
      </Text>
    </View>
  );
});
