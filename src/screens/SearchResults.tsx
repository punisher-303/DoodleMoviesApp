import {
  SafeAreaView,
  ActivityIndicator,
  Text,
  View,
  FlatList,
  ListRenderItem,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Slider from '../components/Slider';
import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SearchStackParamList } from '../App';
import useThemeStore from '../lib/zustand/themeStore';
import { providerManager } from '../lib/services/ProviderManager';
import useContentStore from '../lib/zustand/contentStore';

type Props = NativeStackScreenProps<SearchStackParamList, 'SearchResults'>;

interface SearchPageData {
  title: string;
  Posts: any[];
  filter: string;
  providerValue: string;
  value: string;
  name: string;
}

// Extract header to a separate component to prevent re-rendering the whole list when loading changes
const SearchHeader = React.memo(
  ({
    filter,
    isAllLoaded,
    primary,
    topPadding,
  }: {
    filter: string;
    isAllLoaded: boolean;
    primary: string;
    topPadding: number;
  }) => (
    <View
      className="flex flex-row justify-between items-center gap-x-3 mb-4"
      style={{ paddingTop: topPadding }}>
      <Text className="text-white text-xl font-bold ">
        {isAllLoaded ? 'Searched for' : 'Searching for'}{' '}
        <Text style={{ color: primary }}>"{filter}"</Text>
      </Text>
      {!isAllLoaded && (
        <View className="flex justify-center items-center h-10">
          <ActivityIndicator size="small" color={primary} animating={true} />
        </View>
      )}
    </View>
  ),
);

const SearchResults = ({ route }: Props): React.ReactElement => {
  const insets = useSafeAreaInsets();
  const { primary } = useThemeStore(state => state);
  const { installedProviders } = useContentStore(state => state);
  const [searchData, setSearchData] = useState<SearchPageData[]>([]);

  // Using a Set or Map for loading states is faster than array.find(),
  // but strictly for this UI, a simple counter or boolean is often enough.
  // Keeping your logic but simplified:
  const [loadingProviders, setLoadingProviders] = useState<Set<string>>(
    new Set(),
  );

  // Ref to track mounted state to avoid updating state on unmounted component
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    const abortController = new AbortController();
    const signal = abortController.signal;

    // Reset State
    setSearchData([]);

    // Initialize loading state with all provider values
    const initialLoading = new Set(installedProviders.map(p => p.value));
    setLoadingProviders(initialLoading);

    const verifyStreamExistence = async (
      post: any,
      providerValue: string,
      signal: AbortSignal,
    ): Promise<boolean> => {
      try {
        // 1. Fetch metadata to get linkList or episodes
        const meta = await providerManager.getMetaData({
          link: post.link,
          provider: providerValue,
        });

        if (signal.aborted || !isMounted.current) return false;

        if (!meta || !meta.linkList || meta.linkList.length === 0) {
          return false;
        }

        // 2. Check direct links first (fastest)
        const hasDirectLinks = meta.linkList.some(
          (linkItem: any) =>
            linkItem.directLinks && linkItem.directLinks.length > 0,
        );

        if (hasDirectLinks) {
          return true;
        }

        // 3. Fallback to checking episodes/streams
        // We just need ONE valid stream to prove it's playable
        for (const linkItem of meta.linkList) {
          if (signal.aborted) break;

          if (linkItem.episodesLink) {
            try {
              const episodes = await providerManager.getEpisodes({
                url: linkItem.episodesLink,
                providerValue: providerValue,
              });

              if (episodes && episodes.length > 0 && episodes[0].link) {
                // Technically, we should fetch streams for the episode, 
                // but just having an episode link is a very strong indicator
                // of playability compared to empty results.
                return true;
              }
            } catch (epError) {
              console.warn(`Error checking episode for ${post.title}:`, epError);
            }
          }
        }

        return false;
      } catch (err) {
        console.warn(`Stream verification failed for ${post.title}:`, err);
        return false;
      }
    };

    const fetchProviderData = async (item: (typeof installedProviders)[0]) => {
      try {
        const rawData = await providerManager.getSearchPosts({
          searchQuery: route.params.filter,
          page: 1,
          providerValue: item.value,
          signal: signal,
        });

        if (signal.aborted || !isMounted.current) return;

        if (rawData && rawData.length > 0) {
          // Initialize empty provider block so it shows up in UI as tracking
          const newDataBlock: SearchPageData = {
            title: item.display_name,
            Posts: [],
            filter: route.params.filter,
            providerValue: item.value,
            value: item.value,
            name: item.display_name,
          };

          // Add empty block to state so users see something is happening
          setSearchData(prev => {
            const exists = prev.find(p => p.value === item.value);
            if (exists) return prev;
            return [...prev, newDataBlock];
          });

          // Process in small batches to avoid overloading device/network
          const CONCURRENCY_LIMIT = 3;
          const verifiedPosts: any[] = [];

          for (let i = 0; i < rawData.length; i += CONCURRENCY_LIMIT) {
            if (signal.aborted || !isMounted.current) break;

            const batch = rawData.slice(i, i + CONCURRENCY_LIMIT);
            const batchPromises = batch.map(async post => {
              const isPlayable = await verifyStreamExistence(
                post,
                item.value,
                signal,
              );
              return { post, isPlayable };
            });

            const results = await Promise.all(batchPromises);

            const validPosts = results
              .filter(r => r.isPlayable)
              .map(r => r.post);

            verifiedPosts.push(...validPosts);

            // Incrementally update UI as items clear verification
            setSearchData(prev => {
              return prev.map(providerBlock => {
                if (providerBlock.value === item.value) {
                  return {
                    ...providerBlock,
                    Posts: [...verifiedPosts],
                  };
                }
                return providerBlock;
              });
            });
          }
        }
      } catch (error) {
        if (!signal.aborted && isMounted.current) {
          console.error(`Error fetching ${item.display_name}:`, error);
        }
      } finally {
        if (!signal.aborted && isMounted.current) {
          setLoadingProviders(prev => {
            const next = new Set(prev);
            next.delete(item.value);
            return next;
          });
        }
      }
    };

    // Trigger all fetches in parallel
    installedProviders.forEach(item => {
      fetchProviderData(item);
    });

    return () => {
      abortController.abort();
    };
  }, [route.params.filter, installedProviders]);

  const renderItem: ListRenderItem<SearchPageData> = useCallback(
    ({ item }) => {
      // Check if this specific provider is still loading / verifying streams
      const isProviderLoading = loadingProviders.has(item.providerValue);

      // Only hide the slider entirely if it's done loading AND has no results.
      // If it's still loading but has no results *yet*, we want to show the Skeletons.
      if (!isProviderLoading && item.Posts.length === 0) {
        return null;
      }

      return (
        <View className="mb-4">
          <Slider
            isLoading={isProviderLoading}
            key={`${item.value}-slider`}
            title={item.name}
            posts={item.Posts}
            filter={route.params.filter}
            providerValue={item.value}
            isSearch={true}
          />
        </View>
      );
    },
    [route.params.filter, loadingProviders],
  );

  const isAllLoaded = loadingProviders.size === 0;

  return (
    <View className="bg-black h-full w-full">
      <FlatList
        data={searchData}
        keyExtractor={(item, index) =>
          `${item.providerValue}-${item.title}-${index}`
        }
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        // Header Component containing the title and global loader
        ListHeaderComponent={
          <SearchHeader
            filter={route.params.filter}
            isAllLoaded={loadingProviders.size === 0}
            primary={primary}
            topPadding={insets.top + 16}
          />
        }
        // Padding for the bottom
        ListFooterComponent={<View className="h-16" />}
        contentContainerStyle={{ paddingHorizontal: 16 }}
        // Performance settings for FlatList
        initialNumToRender={3}
        maxToRenderPerBatch={5}
        windowSize={5}
        removeClippedSubviews={true}
      />
    </View>
  );
};

export default SearchResults;