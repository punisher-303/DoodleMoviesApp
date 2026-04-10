import {
  FlatList,
  RefreshControl,
  View,
  Text,
  Dimensions,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Slider from '../../components/Slider';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import HeroOptimized from '../../components/Hero';
import { mainStorage } from '../../lib/storage';
import useContentStore from '../../lib/zustand/contentStore';
import useHeroStore from '../../lib/zustand/herostore';
import {
  useHomePageData,
  getRandomHeroPost,
  clearHeroCache,
} from '../../lib/hooks/useHomePageData';
import useThemeStore from '../../lib/zustand/themeStore';
import ProviderDrawer from '../../components/ProviderDrawer';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { HomeStackParamList } from '../../App';
import { Drawer } from 'react-native-drawer-layout';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import ContinueWatching from '../../components/ContinueWatching';
import { providerManager } from '../../lib/services/ProviderManager';
import Tutorial from '../../components/Touturial';
import { QueryErrorBoundary } from '../../components/ErrorBoundary';
import { StatusBar } from 'expo-status-bar';

type Props = NativeStackScreenProps<HomeStackParamList, 'Home'>;

const Home = ({ }: Props) => {
  const { primary } = useThemeStore(state => state);
  const [backgroundColor, setBackgroundColor] = useState('transparent');
  const [open, setOpen] = useState(false);

  // Memoize static values
  const disableDrawer = useMemo(
    () => mainStorage.getBool('disableDrawer') || false,
    [],
  );

  const { provider, installedProviders } = useContentStore(state => state);
  const { setHero } = useHeroStore(state => state);

  // React Query for home page data with better error handling
  const {
    data: homeData = [],
    isLoading,
    error,
    refetch,
    isRefetching,
    // isStale,
  } = useHomePageData({
    provider,
    enabled: !!(installedProviders?.length && provider?.value),
  });

  // Memoized data for FlashList to prevent unstable references
  const memoizedHomeData = useMemo(() => {
    if (isLoading && provider?.value) {
      try {
        return providerManager.getCatalog({ providerValue: provider.value });
      } catch (e) {
        console.error('Home Page Catalog Fetch Error:', e);
        return [];
      }
    }
    return homeData;
  }, [homeData, isLoading, provider?.value]);

  // Memoized scroll handler with state-change guard for better performance
  const handleScroll = useCallback((event: any) => {
    const scrollY = event.nativeEvent.contentOffset.y;
    const newBackgroundColor = scrollY > 10 ? 'black' : 'transparent';
    
    // Only update state if the value changed
    if (backgroundColor !== newBackgroundColor) {
      setBackgroundColor(newBackgroundColor);
    }
  }, [backgroundColor]);

  // Stable hero post calculation
  const heroPost = useMemo(() => {
    if (!homeData || homeData.length === 0) {
      return null;
    }
    return getRandomHeroPost(homeData, provider?.value);
  }, [homeData, provider?.value]);

  // Update hero only when hero post actually changes
  React.useEffect(() => {
    if (heroPost) {
      setHero(heroPost);
    } else {
      setHero({ link: '', image: '', title: '' });
    }
  }, [heroPost, setHero]);

  // Optimized refresh handler
  const handleRefresh = useCallback(async () => {
    try {
      if (provider?.value) {
        clearHeroCache(provider.value);
      }
      await refetch();
    } catch (refreshError) {
      console.error('Error refreshing home data:', refreshError);
    }
  }, [refetch, provider?.value]);

  // Virualized sliders handled directly in FlatList's renderItem

  // Memoized error message
  const errorComponent = useMemo(() => {
    if (!error && (isLoading || homeData.length > 0)) {
      return null;
    }

    return (
      <View className="p-4 m-4 bg-red-500/20 rounded-lg min-h-64 flex-1 justify-center items-center">
        <Text className="text-red-400 text-center font-medium">
          {error?.message || 'Failed to load content'}
        </Text>
        <Text className="text-gray-400 text-center text-sm mt-1">
          Pull to refresh and try again
        </Text>
      </View>
    );
  }, [error, isLoading, homeData.length]);

  // Early return for no providers
  if (
    !installedProviders ||
    installedProviders.length === 0 ||
    !provider?.value
  ) {
    return <Tutorial />;
  }

  return (
    <QueryErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View className="bg-black flex-1">
          <Drawer
            open={open}
            onOpen={() => setOpen(true)}
            onClose={() => setOpen(false)}
            drawerType="front"
            drawerStyle={{ backgroundColor: 'transparent', width: '70%' }}
            swipeEdgeWidth={50}
            swipeEnabled={!disableDrawer}
            renderDrawerContent={() =>
              !disableDrawer && <ProviderDrawer closeDrawer={() => setOpen(false)} />
            }>
            <StatusBar
              style="auto"
              animated={true}
              translucent={true}
              backgroundColor={backgroundColor}
            />

            <FlashList
              onScroll={handleScroll}
              scrollEventThrottle={16}
              showsVerticalScrollIndicator={false}
              className="bg-black"
              refreshControl={
                <RefreshControl
                  colors={[primary]}
                  tintColor={primary}
                  progressBackgroundColor="black"
                  refreshing={isRefetching}
                  onRefresh={handleRefresh}
                />
              }
              ListHeaderComponent={
                <>
                  <HeroOptimized
                    onOpenDrawer={() => setOpen(true)}
                    isDrawerOpen={open}
                  />
                  <ContinueWatching />
                </>
              }
              data={memoizedHomeData}
              keyExtractor={(item, index) => `${item.filter}-${index}`}
              renderItem={({ item, index }) => (
                <View className={index === 0 ? '-mt-6 relative z-20' : 'relative z-20'}>
                  <Slider
                    isLoading={isLoading}
                    title={item.title}
                    posts={isLoading ? [] : (item as any).Posts}
                    filter={item.filter}
                  />
                </View>
              )}
              ListFooterComponent={
                <>
                  {errorComponent}
                  <View className="h-16" />
                </>
              }
              estimatedItemSize={210}
              removeClippedSubviews={Platform.OS === 'android'}
              maxToRenderPerBatch={3}
              windowSize={5}
              initialNumToRender={2}
            />
          </Drawer>
        </View>
      </GestureHandlerRootView>
    </QueryErrorBoundary>
  );
};

export default React.memo(Home);