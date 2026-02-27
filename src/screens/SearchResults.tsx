import {
  SafeAreaView,
  ActivityIndicator,
  Text,
  FlatList,
  View,
  ListRenderItem,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Slider from '../components/Slider';
import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { TouchableOpacity, ScrollView } from 'react-native';
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
    activeCategory,
    setActiveCategory,
  }: {
    filter: string;
    isAllLoaded: boolean;
    primary: string;
    topPadding: number;
    activeCategory: string;
    setActiveCategory: (category: string) => void;
  }) => {
    const categories = ['All', 'Movies', 'Series', 'Anime'];

    return (
      <View className="mb-4" style={{ paddingTop: topPadding }}>
        <View className="flex flex-row justify-between items-center gap-x-3 mb-4">
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

        {/* Horizontal Category Filters */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="flex-row"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ gap: 8 }}
        >
          {categories.map((category) => {
            const isActive = activeCategory === category;
            return (
              <TouchableOpacity
                key={category}
                onPress={() => setActiveCategory(category)}
                style={{
                  backgroundColor: isActive ? primary : '#2A2A2A',
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: isActive ? primary : '#3A3A3A',
                }}
              >
                <Text style={{
                  color: isActive ? 'black' : 'white',
                  fontWeight: isActive ? 'bold' : 'normal',
                }}>
                  {category}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  },
);

const SearchResults = ({ route }: Props): React.ReactElement => {
  const insets = useSafeAreaInsets();
  const { primary } = useThemeStore(state => state);
  const { installedProviders } = useContentStore(state => state);
  const [searchData, setSearchData] = useState<SearchPageData[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('All');

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

    // Removed verifyStreamExistence function here to vastly accelerate search speeds.
    // Making deep metadata/episode queries for every single search result caused massive
    // UI latency and network throttling on the providers. We will assume search results
    // are valid until the user clicks into them.

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
          // Filter out dummy error posts injected by providers,
          // AND force strictly match the searched title keyword.
          const searchKeywordLower = route.params.filter.toLowerCase();
          const cleanRawData = rawData.filter((post) => {
            if (!post || !post.title) return false;

            const titleLower = post.title.toLowerCase();

            // 1. Drop dummy provider placeholders
            const isDummy =
              titleLower.includes('no stream') ||
              titleLower.includes('no result') ||
              titleLower.includes('not found');

            if (isDummy) return false;

            if (isDummy) return false;

            // 2. Strict Title Match: Only keep posters that actually contain the searched keyword
            // (Many providers return loosely related garbage that bloats the UI)

            // If the search keyword is short (like 'IT'), do a strict full string check
            let hasMatch = false;

            if (searchKeywordLower.length <= 3) {
              hasMatch = titleLower === searchKeywordLower || titleLower.includes(` ${searchKeywordLower} `);
            } else {
              // Otherwise, we split by spaces to allow partial title matches 
              // (e.g. searching "Iron Man" matches "Iron Man 2")
              const searchWords = searchKeywordLower.split(' ').filter(w => w.length > 2); // Ignore 'a', 'to', etc

              if (searchWords.length === 0) {
                hasMatch = true; // Fallback if query was only stop-words
              } else {
                // At least ONE of the significant search words must exist in the returned title
                hasMatch = searchWords.some(word => titleLower.includes(word));
              }
            }

            return hasMatch;
          });

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

          // Instead of batching and verifying streams which takes awful amounts of time,
          // instantly push the cleaned raw search results to the screen.
          setSearchData(prev => {
            return prev.map(providerBlock => {
              if (providerBlock.value === item.value) {
                return {
                  ...providerBlock,
                  Posts: cleanRawData, // Instantly inject the cleaned payload
                };
              }
              return providerBlock;
            });
          });
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

    // Trigger all fetches with a slight microscopic stagger instead of a pure forEach.
    // Firing 15+ parallel provider scrapers on the exact same millisecond completely 
    // chokes the Javascript UI thread, causing React Native to drop touch/pointer events
    // until the queue clears out. Staggering them by 50ms gives the UI thread room to breathe.
    installedProviders.forEach((item, index) => {
      setTimeout(() => {
        if (!signal.aborted && isMounted.current) {
          fetchProviderData(item);
        }
      }, index * 100); // 100ms stagger between each provider
    });

    return () => {
      abortController.abort();
    };
  }, [route.params.filter, installedProviders]); // Note: DO NOT add activeCategory here, it will trigger an accidental re-fetch

  // Memoize and sort the data so loaded providers appear first, 
  // currently loading providers are in the middle, and empty providers are hidden/discarded.
  const sortedSearchData = useMemo(() => {
    return searchData.map(providerBlock => {
      // 1. INSTANT CATEGORY FILTERING:
      // Filter the existing posts according to the selected button instantly 
      // without needing to query the network scraper.
      const filteredPosts = providerBlock.Posts.filter(post => {
        if (activeCategory === 'All') return true;

        const postTypeLower = post.type ? post.type.toLowerCase() : '';
        const titleLower = post.title ? post.title.toLowerCase() : '';
        const providerNameLower = providerBlock.name.toLowerCase();

        // Providers are notoriously bad at tagging content. 
        // 1. Anime overrides: If the provider is explicitly an anime provider, 
        // force it into the Anime category regardless of its missing tags.
        const isAnimeProvider = providerNameLower.includes('anime') || providerNameLower.includes('gogo') || providerNameLower.includes('zoro');

        if (activeCategory === 'Anime') {
          if (isAnimeProvider) return true;
          if (postTypeLower.includes('anime')) return true;
          // Fallback for badly tagged anime scraping
          if (titleLower.includes('dub') || titleLower.includes('sub')) return true;
          return false;
        }

        // If we get here and the provider is strictly an Anime provider, and the user 
        // clicked "Movies" or "Series", drop it so anime doesn't pollute western UI searches
        if (isAnimeProvider) return false;

        if (activeCategory === 'Movies') {
          // If no type is provided, we lean towards showing it rather than hiding it, 
          // but if it explicitly says tv/series/episode we drop it.
          if (postTypeLower.includes('tv') || postTypeLower.includes('series') || postTypeLower.includes('season') || postTypeLower.includes('episode')) return false;

          return postTypeLower.includes('movie') || postTypeLower === '';
        }

        if (activeCategory === 'Series') {
          return postTypeLower.includes('tv') || postTypeLower.includes('series') || postTypeLower.includes('season') || postTypeLower.includes('episode') || postTypeLower.includes('show');
        }

        return false;
      });

      return {
        ...providerBlock,
        Posts: filteredPosts
      };
    }).sort((a, b) => {
      const aLoading = loadingProviders.has(a.providerValue);
      const bLoading = loadingProviders.has(b.providerValue);

      const aHasPosts = a.Posts && a.Posts.length > 0;
      const bHasPosts = b.Posts && b.Posts.length > 0;

      // 1. If A has posts and B does not, A goes first (Prioritize loaded content)
      if (aHasPosts && !bHasPosts) return -1;
      if (!aHasPosts && bHasPosts) return 1;

      // 2. If both have posts OR both do not have posts, sort by loading state
      // (Prioritize currently loading skeletons over finished empty results)
      if (aLoading && !bLoading) return -1;
      if (!aLoading && bLoading) return 1;

      // 3. If they are equal in both categories, sort alphabetically by provider name
      // This prevents the arrays from randomly jumping around the screen during React re-renders
      return a.name.localeCompare(b.name);
    });
  }, [searchData, loadingProviders, activeCategory]);

  const renderItem: ListRenderItem<SearchPageData> = useCallback(
    ({ item }) => {
      // Check if this specific provider is still loading / verifying streams
      const isProviderLoading = loadingProviders.has(item.providerValue);

      // Never hide a slider that is still loading, so we can see the skeleton!
      // Only hide it if it explicitly finished loading and found 0 posts.
      if (!isProviderLoading && (!item.Posts || item.Posts.length === 0)) {
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
    <View className="bg-black flex-1 w-full relative">
      <FlatList
        data={sortedSearchData}
        keyExtractor={(item, index) =>
          `${item.providerValue}-${index}`
        }
        keyboardShouldPersistTaps="handled"
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <SearchHeader
            filter={route.params.filter}
            isAllLoaded={loadingProviders.size === 0}
            primary={primary}
            topPadding={insets.top + 16}
            activeCategory={activeCategory}
            setActiveCategory={setActiveCategory}
          />
        }
        ListFooterComponent={<View className="h-16" />}
        contentContainerStyle={{ paddingHorizontal: 16 }}
        initialNumToRender={5}
        maxToRenderPerBatch={5}
        windowSize={11}
        updateCellsBatchingPeriod={50}
        removeClippedSubviews={false}
      />
    </View>
  );
};

export default SearchResults;