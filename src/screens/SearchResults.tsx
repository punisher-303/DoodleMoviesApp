import {
  SafeAreaView,
  ActivityIndicator,
  Text,
  View,
  FlatList,
  ListRenderItem,
} from 'react-native';
import Slider from '../components/Slider';
import React, {useEffect, useState, useRef, useCallback, useMemo} from 'react';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {SearchStackParamList} from '../App';
import useThemeStore from '../lib/zustand/themeStore';
import {providerManager} from '../lib/services/ProviderManager';
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
  }: {
    filter: string;
    isAllLoaded: boolean;
    primary: string;
  }) => (
    <View className="mt-14 px-4 flex flex-row justify-between items-center gap-x-3 mb-4">
      <Text className="text-white text-2xl font-semibold ">
        {isAllLoaded ? 'Searched for' : 'Searching for'}{' '}
        <Text style={{color: primary}}>"{filter}"</Text>
      </Text>
      {!isAllLoaded && (
        <View className="flex justify-center items-center h-10">
          <ActivityIndicator size="small" color={primary} animating={true} />
        </View>
      )}
    </View>
  ),
);

const SearchResults = ({route}: Props): React.ReactElement => {
  const {primary} = useThemeStore(state => state);
  const {installedProviders} = useContentStore(state => state);
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

    const fetchProviderData = async (item: (typeof installedProviders)[0]) => {
      try {
        const data = await providerManager.getSearchPosts({
          searchQuery: route.params.filter,
          page: 1,
          providerValue: item.value,
          signal: signal,
        });

        if (signal.aborted || !isMounted.current) return;

        // Mark this specific provider as finished loading immediately
        setLoadingProviders(prev => {
          const next = new Set(prev);
          next.delete(item.value);
          return next;
        });

        if (data && data.length > 0) {
          const newData: SearchPageData = {
            title: item.display_name,
            Posts: data,
            filter: route.params.filter,
            providerValue: item.value,
            value: item.value,
            name: item.display_name,
          };

          // Functional update to ensure we don't miss concurrent updates
          setSearchData(prev => [...prev, newData]);
        }
      } catch (error) {
        if (!signal.aborted && isMounted.current) {
          console.error(`Error fetching ${item.display_name}:`, error);
          // Even on error, stop loading spinner for this provider
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
    ({item}) => {
      // Logic Fix: No need to search 'searchData' or 'loading' arrays here.
      // 'item' already contains the Posts.
      // We pass specific loading state if needed, or just false since we only render results when data exists.

      return (
        <View className="mb-4">
          <Slider
            isLoading={false} // Data is present, so it's not loading anymore
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
    [route.params.filter],
  );

  const isAllLoaded = loadingProviders.size === 0;

  return (
    <SafeAreaView className="bg-black h-full w-full">
      <FlatList
        data={searchData}
        renderItem={renderItem}
        keyExtractor={item => item.value}
        showsVerticalScrollIndicator={false}
        // Header Component containing the title and global loader
        ListHeaderComponent={
          <SearchHeader
            filter={route.params.filter}
            isAllLoaded={isAllLoaded}
            primary={primary}
          />
        }
        // Padding for the bottom
        ListFooterComponent={<View className="h-16" />}
        contentContainerStyle={{paddingHorizontal: 16}}
        // Performance settings for FlatList
        initialNumToRender={3}
        maxToRenderPerBatch={5}
        windowSize={5}
        removeClippedSubviews={true}
      />
    </SafeAreaView>
  );
};

export default SearchResults;