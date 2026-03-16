import { View, Text, TouchableOpacity, GestureResponderEvent } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React, { useEffect, useState, useRef, ReactElement, memo } from 'react';
// ... existing imports ...
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { HomeStackParamList, SearchStackParamList } from '../App';
import { Post } from '../lib/providers/types';
import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import useContentStore from '../lib/zustand/contentStore';
import { MaterialIcons } from '@expo/vector-icons';
import { settingsStorage } from '../lib/storage';
import SkeletonLoader from '../components/Skeleton';
import useThemeStore from '../lib/zustand/themeStore';
import { providerManager } from '../lib/services/ProviderManager';

const ScrollListItem = memo(({ 
  item, 
  viewType, 
  navigation, 
  providerValue, 
  currentProviderValue 
}: { 
  item: Post, 
  viewType: number, 
  navigation: any, 
  providerValue?: string, 
  currentProviderValue: string 
}) => {
  return (
    <TouchableOpacity
      style={{
        flexDirection: viewType === 1 ? 'column' : 'row',
        margin: 12,
        alignItems: viewType === 1 ? 'stretch' : 'center',
      }}
      onPress={() => {
        if (item.type === 'person') {
          const linkParts = item.link.split(':');
          if (linkParts[0] === 'person_id' && linkParts[1]) {
            //@ts-ignore
            navigation.navigate('SearchStack', {
              screen: 'CastDetail',
              params: {
                personId: linkParts[1],
                name: item.title,
              },
            });
            return;
          }
          navigation.navigate('SearchStack', {
            screen: 'ScrollList',
            params: {
              filter: item.link,
              title: item.title,
              isSearch: true,
              providerValue: providerValue || currentProviderValue,
            },
          });
          return;
        }
        navigation.navigate('Info', {
          link: item.link,
          provider: providerValue || currentProviderValue,
          poster: item?.image,
        });
      }}>
      <Image
        className={item.type === 'person' ? "rounded-full" : "rounded-md"}
        source={{
          uri:
            item.image ||
            (item.type === 'person'
              ? 'https://placehold.jp/24/363636/ffffff/150x150.png?text=Actor'
              : 'https://placehold.jp/24/363636/ffffff/100x150.png?text=Doodle'),
        }}
        style={
          item.type === 'person'
            ? { width: 80, height: 80, marginLeft: viewType === 1 ? 10 : 0 }
            : (viewType === 1
              ? { width: 100, height: 150 }
              : { width: 70, height: 100 })
        }
        cachePolicy="memory-disk"
        contentFit="cover"
      />
      <View style={viewType === 1 ? { width: 100 } : { flex: 1, marginLeft: 12 }}>
        <Text
          numberOfLines={2}
          className={
            viewType === 1
              ? 'text-white text-center text-[10px] mt-1'
              : 'text-white font-semibold text-base'
          }>
          {item.title}
        </Text>
      </View>
    </TouchableOpacity>
  );
});

const ScrollList = ({ route }: Props): ReactElement => {
// ...
  const insets = useSafeAreaInsets();
  const { primary } = useThemeStore(state => state);
  const navigation =
    useNavigation<NativeStackNavigationProp<SearchStackParamList>>();
  const [posts, setPosts] = useState<Post[]>([]);
  // Fix: Safely destructure route.params with a default empty object to prevent crashes
  const { filter, providerValue } = route.params || {};
  const [page, setPage] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isEnd, setIsEnd] = useState<boolean>(false);
  const { provider } = useContentStore(state => state);
  const [viewType, setViewType] = useState<number>(
    settingsStorage.getListViewType(),
  );
  // Add abort controller to cancel API requests when unmounting
  const abortController = useRef<AbortController | null>(null);
  const isMounted = useRef(true);
  const isLoadingMore = useRef(false);

  // Set up cleanup effect that runs on component unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
      if (abortController.current) {
        abortController.current.abort();
      }
    };
  }, []);

  useEffect(() => {
    // Clean up the previous controller if it exists
    if (abortController.current) {
      abortController.current.abort();
    }

    // Create a new controller for this effect
    abortController.current = new AbortController();
    const signal = abortController.current.signal;

    const fetchPosts = async () => {
      // Don't fetch if we're already at the end
      if (isEnd) return;

      try {
        // Prevent concurrent loading calls
        if (isLoadingMore.current) return;
        isLoadingMore.current = true;

        setIsLoading(true);

        // Simulate network delay to reduce rapid API calls
        // Remove this in production if not needed
        await new Promise(resolve => setTimeout(resolve, 300));

        // Skip if component unmounted or request was aborted
        if (!isMounted.current || signal.aborted) return;

        // Use optional chaining for safe access to route.params properties
        const getNewPosts = route.params?.isSearch
          ? providerManager.getSearchPosts({
            searchQuery: filter,
            page,
            providerValue: providerValue || provider.value,
            signal,
          })
          : providerManager.getPosts({
            filter,
            page,
            providerValue: providerValue || provider.value,
            signal,
          });

        const newPosts = await getNewPosts;

        // Skip if component unmounted or request was aborted
        if (!isMounted.current || signal.aborted) return;

        if (!newPosts || newPosts.length === 0) {
          console.log('end', page);
          setIsEnd(true);
          setIsLoading(false);
          isLoadingMore.current = false;
          return;
        }

        setPosts(prev => [...prev, ...newPosts]);
      } catch (error) {
        // Skip handling if component unmounted or request was aborted
        if (!isMounted.current || (error as any)?.name === 'AbortError') return;
        console.error('Error fetching posts:', error);
      } finally {
        if (isMounted.current) {
          setIsLoading(false);
          isLoadingMore.current = false;
        }
      }
    };

    fetchPosts();
  }, [page, route.params, filter, provider.value]);

  const onEndReached = async () => {
    // Don't trigger more loading if we're already loading or at the end
    if (isLoading || isEnd || isLoadingMore.current) {
      return;
    }
    setIsLoading(true);
    setPage(prevPage => prevPage + 1);
  };

  // Limit the number of skeletons to prevent unnecessary renders
  const renderSkeletons = () => {
    const skeletonCount = viewType === 1 ? 6 : 3;
    return Array.from({ length: skeletonCount }).map((_, i) => (
      <View
        className="mx-3 gap-0 flex mb-3 justify-center items-center"
        key={i}>
        <SkeletonLoader height={150} width={100} />
        <SkeletonLoader height={12} width={97} />
      </View>
    ));
  };

  return (
    <View className="h-full w-full bg-black items-center p-4" style={{ paddingTop: insets.top }}>
      <View className="w-full px-4 font-semibold my-6 flex-row justify-between items-center">
        <Text className="text-2xl font-bold" style={{ color: primary }}>
          {route.params?.title}
        </Text>
        <TouchableOpacity
          onPress={() => {
            const newViewType = viewType === 1 ? 2 : 1;
            setViewType(newViewType);
            settingsStorage.setListViewType(newViewType);
          }}>
          <MaterialIcons
            name={viewType === 1 ? 'view-module' : 'view-list'}
            size={27}
            color="white"
          />
        </TouchableOpacity>
      </View>
      <View className="justify-center flex-row w-full flex-1">
        <FlashList
          ListFooterComponent={
            <>
              {isLoading && (
                <View
                  className={`flex ${viewType === 1 ? 'flex-row flex-wrap' : 'flex-col'
                    } gap-1 justify-center items-center mb-16`}>
                  {renderSkeletons()}
                </View>
              )}
              <View className="h-32" />
            </>
          }
          data={posts}
          numColumns={viewType === 1 ? 3 : 1}
          removeClippedSubviews={true}
          key={`view-type-${viewType}`}
          contentContainerStyle={{ paddingBottom: 80 }}
          keyExtractor={(item, i) => `${item.link}-${i}`}
          renderItem={({ item }) => (
            <ScrollListItem 
              item={item} 
              viewType={viewType} 
              navigation={navigation} 
              providerValue={providerValue} 
              currentProviderValue={provider.value} 
            />
          )}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.4}
          estimatedItemSize={viewType === 1 ? 200 : 120}
        />
        {!isLoading && posts.length === 0 ? (
          <View className="w-full h-full flex items-center justify-center">
            <Text className="text-white text-center font-semibold text-lg">
              No Content Found
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
};

export default ScrollList;
