import {
  SafeAreaView,
  ActivityIndicator,
  Text,
  View,
  ListRenderItem,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
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
    loadingCount,
  }: {
    filter: string;
    isAllLoaded: boolean;
    primary: string;
    topPadding: number;
    activeCategory: string;
    setActiveCategory: (category: string) => void;
    loadingCount: number;
  }) => {
    const categories = ['All', 'Movies', 'Series', 'Anime', 'Cartoon', 'Cdrama', 'Donghua', 'Drama', 'Kdrama', 'Movie/tvshow', 'Tvshow'];

    return (
      <View className="mb-4" style={{ paddingTop: topPadding }}>
        <View className="mb-4">
          <View className="flex-row items-center">
            <Text className="text-white text-xl font-bold">
              {isAllLoaded ? 'Searched' : 'Searching'}{' '}
              <Text style={{ color: primary }}>
                "{filter.startsWith('person_id:') ? filter.split(':')[2] : filter}"
              </Text>
            </Text>
            {!isAllLoaded && (
              <ActivityIndicator size="small" color={primary} className="ml-3" />
            )}
          </View>
          {!isAllLoaded && (
            <Text className="text-gray-400 text-xs mt-0.5 font-medium">
              Waiting for {loadingCount} sources...
            </Text>
          )}
        </View>

        {/* Horizontal Category Filters */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ gap: 10, paddingRight: 20 }}
        >
          {categories.map((category) => {
            const isActive = activeCategory === category;
            return (
              <TouchableOpacity
                key={category}
                onPress={() => setActiveCategory(category)}
                className={`rounded-full px-5 py-2 border ${
                  isActive ? '' : 'bg-[#131722] border-[#282d3a]'
                }`}
                style={isActive ? { backgroundColor: primary, borderColor: primary } : {}}
              >
                <Text
                  className="text-sm"
                  style={{
                    color: isActive ? 'white' : '#94a3b8',
                    fontWeight: isActive ? '700' : '500',
                  }}
                >
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

  const resultsQueue = useRef<SearchPageData[]>([]);
  const updateInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const abortController = new AbortController();
    const signal = abortController.signal;

    // Reset State
    setSearchData([]);
    resultsQueue.current = [];

    // Initialize loading state with all provider values
    const initialLoading = new Set(installedProviders.map(p => p.value));
    setLoadingProviders(initialLoading);

    // Start batch update interval - pushes queued results to state every 400ms
    // to prevent JS thread congestion and keep UI interactive (tapable).
    updateInterval.current = setInterval(() => {
        if (resultsQueue.current.length > 0 && isMounted.current) {
            const batch = [...resultsQueue.current];
            resultsQueue.current = [];
            setSearchData(prev => {
                // Merge batch results carefully
                const next = [...prev];
                batch.forEach(newBlock => {
                    const idx = next.findIndex(p => p.value === newBlock.value);
                    if (idx === -1) {
                        next.push(newBlock);
                    } else {
                        next[idx] = newBlock;
                    }
                });
                return next;
            });
        }
    }, 400);

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
          const searchKeywordLower = route.params.filter.toLowerCase();
          const cleanRawData = rawData.filter((post) => {
            if (!post || !post.title) return false;
            const titleLower = post.title.toLowerCase();
            const isDummy =
              titleLower.includes('no stream') ||
              titleLower.includes('no result') ||
              titleLower.includes('not found');

            if (isDummy) return false;
            if (route.params.filter.startsWith('person_id:')) return true;

            const searchWords = searchKeywordLower.split(' ').filter(w => w.length >= 2);
            if (searchWords.length === 0) return true;
            return titleLower.includes(searchKeywordLower) || searchWords.every(word => titleLower.includes(word));
          });

          // Queue the results instead of direct setState
          resultsQueue.current.push({
            title: item.display_name,
            Posts: cleanRawData,
            filter: route.params.filter,
            providerValue: item.value,
            value: item.value,
            name: item.display_name,
          });
        }
      } catch (error) {
        if (!signal.aborted && isMounted.current) {
          // Silent error for better UX
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

    installedProviders.forEach((item, index) => {
      setTimeout(() => {
        if (!signal.aborted && isMounted.current) {
          fetchProviderData(item);
        }
      }, index * 80); // Staggered delay to keep UI interactive
    });

    return () => {
      abortController.abort();
      if (updateInterval.current) clearInterval(updateInterval.current);
    };
  }, [route.params.filter, installedProviders]);
 // Note: DO NOT add activeCategory here, it will trigger an accidental re-fetch

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

        // 1. ANIME: Strict collection of Anime and Cartoons
        const isAnimeProvider = providerNameLower.includes('anime') || providerNameLower.includes('gogo') || providerNameLower.includes('zoro') || providerNameLower.includes('ani');
        const isAnimeContent = postTypeLower.includes('anime') || postTypeLower.includes('cartoon') || postTypeLower.includes('animation') || titleLower.includes('dub') || titleLower.includes('sub');
        const isActuallyAnime = isAnimeProvider || isAnimeContent;

        // 2. SERIES: Strict collection of episodic content
        const isSeriesContent = postTypeLower.includes('tv') || postTypeLower.includes('series') || postTypeLower.includes('season') || postTypeLower.includes('episode') || postTypeLower.includes('show') || titleLower.includes('season') || titleLower.includes('episode');

        // 3. MOVIES: Single films
        const isMovieContent = postTypeLower.includes('movie') || postTypeLower.includes('film') || (postTypeLower === '' && !isSeriesContent);

        // 4. DRAMA / KDRAMA
        const isKdrama = titleLower.includes('kdrama') || providerNameLower.includes('asian') || titleLower.includes('korean');
        const isDrama = postTypeLower.includes('drama') || titleLower.includes('drama') || isKdrama;

        if (activeCategory === 'Anime') return isActuallyAnime;
        if (activeCategory === 'Cartoon') return postTypeLower.includes('cartoon') || titleLower.includes('cartoon');
        if (activeCategory === 'Cdrama') return titleLower.includes('cdrama') || (isDrama && (titleLower.includes('chinese') || providerNameLower.includes('asian')));
        if (activeCategory === 'Donghua') return titleLower.includes('donghua');
        if (activeCategory === 'Drama') return isDrama;
        if (activeCategory === 'Kdrama') return isKdrama;
        if (activeCategory === 'Movie/tvshow') return isMovieContent || isSeriesContent;
        if (activeCategory === 'Tvshow') return isSeriesContent;

        // CRITICAL STRICT GATES: If we are sorting for Western Movies or Series, 
        // completely block ANY content that was flagged as Anime or Cartoon.
        if (isActuallyAnime && (activeCategory === 'Movies' || activeCategory === 'Series')) return false;

        if (activeCategory === 'Series') return isSeriesContent;
        if (activeCategory === 'Movies') return isMovieContent && !isSeriesContent;

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
      <FlashList
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
            loadingCount={loadingProviders.size}
          />
        }
        ListFooterComponent={<View className="h-16" />}
        contentContainerStyle={{ paddingHorizontal: 16 }}
        estimatedItemSize={220}
        removeClippedSubviews={true}
      />
    </View>
  );
};

export default SearchResults;