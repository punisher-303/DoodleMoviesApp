import {
  Text,
  View,
  StatusBar,
  RefreshControl,
  FlatList,
  Linking,
  TouchableOpacity,
  Modal,
  Pressable,
  Animated,
  Easing,
  useWindowDimensions,
  PanResponder,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Image } from 'expo-image';
import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';
import { HomeStackParamList, TabStackParamList } from '../../App';
import LinearGradient from 'react-native-linear-gradient';
import SeasonList from '../../components/SeasonList';
import TorrentList from '../../components/TorrentList';
import { Skeleton } from 'moti/skeleton';
import Ionicons from '@expo/vector-icons/Ionicons';
import { settingsStorage, watchListStorage } from '../../lib/storage';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import useContentStore from '../../lib/zustand/contentStore';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import useThemeStore from '../../lib/zustand/themeStore';
import { useNavigation } from '@react-navigation/native';
import useWatchListStore from '../../lib/zustand/watchListStore';
import { useContentDetails } from '../../lib/hooks/useContentInfo';
import { QueryErrorBoundary } from '../../components/ErrorBoundary';
import { Switch } from 'react-native';
import YoutubePlayer from 'react-native-youtube-iframe';

// --- CONFIGURATION ---
const TMDB_API_KEY = '9d2bff12ed955c7f1f74b83187f188ae';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

// --- UTILITIES (TRAILER SEARCH) ---
const getTmdbTrailer = async (
  title: string,
  type: string = 'movie',
  year?: string,
  imdbId?: string,
): Promise<string | null> => {
  if (!TMDB_API_KEY) return null;

  try {
    const searchType = type === 'series' || type === 'tv' ? 'tv' : 'movie';
    let tmdbId: number | null = null;

    // 1. Find by IMDB ID
    if (imdbId) {
      try {
        const findUrl = `${TMDB_BASE_URL}/find/${imdbId}?api_key=${TMDB_API_KEY}&external_source=imdb_id`;
        const findRes = await fetch(findUrl);
        const findData = await findRes.json();
        const results =
          searchType === 'movie' ? findData.movie_results : findData.tv_results;
        if (results && results.length > 0) tmdbId = results[0].id;
      } catch (e) {
        console.warn('IMDB lookup failed');
      }
    }

    // 2. Search by Title + Year
    if (!tmdbId) {
      const query = encodeURIComponent(title);
      let yearParam = '';
      if (year) {
        yearParam =
          searchType === 'movie'
            ? `&year=${year}`
            : `&first_air_date_year=${year}`;
      }
      const searchUrl = `${TMDB_BASE_URL}/search/${searchType}?api_key=${TMDB_API_KEY}&query=${query}${yearParam}`;
      const searchRes = await fetch(searchUrl);
      const searchData = await searchRes.json();
      if (searchData.results && searchData.results.length > 0)
        tmdbId = searchData.results[0].id;
    }

    // 3. Search by Title Only (Fallback)
    if (!tmdbId && year) {
      const query = encodeURIComponent(title);
      const looseUrl = `${TMDB_BASE_URL}/search/${searchType}?api_key=${TMDB_API_KEY}&query=${query}`;
      const looseRes = await fetch(looseUrl);
      const looseData = await looseRes.json();
      if (looseData.results && looseData.results.length > 0)
        tmdbId = looseData.results[0].id;
    }

    if (!tmdbId) return null;

    const videoUrl = `${TMDB_BASE_URL}/${searchType}/${tmdbId}/videos?api_key=${TMDB_API_KEY}`;
    const videoRes = await fetch(videoUrl);
    const videoData = await videoRes.json();

    if (videoData.results && videoData.results.length > 0) {
      const trailer = videoData.results.find(
        (v: any) =>
          v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser'),
      );
      return trailer ? trailer.key : videoData.results[0].key;
    }
    return null;
  } catch (error) {
    console.error('Error fetching trailer:', error);
    return null;
  }
};

// --- FLIP HEADER COMPONENT ---
const FlipHeader = ({
  posterImage,
  trailerId,
  meta,
  info,
  infoLoading,
  setLogoError,
  displayTitle,
  logoError,
  isFetchingTrailer,
}: any) => {
  const [showVideo, setShowVideo] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const animatedValue = useRef(new Animated.Value(0)).current;
  const { width } = useWindowDimensions();
  const videoHeight = width * (9 / 16);

  const flipToVideo = useCallback(() => {
    setShowVideo(true);
    Animated.timing(animatedValue, {
      toValue: 180,
      duration: 600,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setIsPlaying(true);
    });
  }, [animatedValue]);

  const flipToPoster = useCallback(() => {
    setIsPlaying(false);
    setShowVideo(false);
    Animated.timing(animatedValue, {
      toValue: 0,
      duration: 600,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [animatedValue]);

  const onStateChange = useCallback((state: string) => {
    if (state === 'ended') setIsPlaying(false);
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dy) < 10;
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx > 50 && showVideo) flipToPoster();
        else if (gestureState.dx < -50 && !showVideo && trailerId)
          flipToVideo();
      },
    }),
  ).current;

  const frontInterpolate = animatedValue.interpolate({
    inputRange: [0, 180],
    outputRange: ['0deg', '180deg'],
  });
  const backInterpolate = animatedValue.interpolate({
    inputRange: [0, 180],
    outputRange: ['180deg', '360deg'],
  });
  const frontOpacity = animatedValue.interpolate({
    inputRange: [89, 90],
    outputRange: [1, 0],
  });
  const backOpacity = animatedValue.interpolate({
    inputRange: [89, 90],
    outputRange: [0, 1],
  });

  return (
    <View
      style={{ height: 256, width: '100%', position: 'relative' }}
      {...panResponder.panHandlers}>
      {/* FRONT (Poster) */}
      <Animated.View
        style={{
          width: '100%',
          height: '100%',
          position: 'absolute',
          backfaceVisibility: 'hidden',
          transform: [{ rotateY: frontInterpolate }, { perspective: 1000 }],
          opacity: frontOpacity,
          zIndex: showVideo ? 0 : 1,
        }}>
        <Skeleton
          show={infoLoading}
          colorMode="dark"
          height={'100%'}
          width={'100%'}>
          <Image
            source={{ uri: posterImage }}
            className="h-[256] w-full"
            contentFit="cover"
            transition={300}
            cachePolicy="memory-disk"
            onError={e => console.warn('Background image failed:', e)}
          />
        </Skeleton>
        <LinearGradient
          colors={['transparent', 'black']}
          className="absolute h-full w-full"
        />
        <View className="absolute bottom-0 right-0 w-screen flex-row justify-between items-baseline px-2">
          {(meta?.logo && !logoError) || infoLoading ? (
            <Image
              onError={() => setLogoError(true)}
              source={{ uri: meta?.logo }}
              style={{ width: 200, height: 100 }}
              contentFit="contain"
            />
          ) : (
            <Text className="text-white text-2xl mt-3 capitalize font-semibold w-3/4 truncate">
              {displayTitle}
            </Text>
          )}
          {(meta?.imdbRating || info?.rating) && (
            <Text className="text-white text-2xl font-semibold">
              {meta?.imdbRating || info?.rating}
              <Text className="text-white text-lg">/10</Text>
            </Text>
          )}
        </View>
        {/* Indicators */}
        <View className="absolute bottom-2 w-full flex-row justify-center items-center gap-2 z-50">
          <View className="w-2 h-2 rounded-full bg-white scale-125" />
          {trailerId ? (
            <TouchableOpacity onPress={flipToVideo}>
              <View className="w-2 h-2 rounded-full bg-white/30" />
            </TouchableOpacity>
          ) : null}
        </View>
      </Animated.View>

      {/* BACK (Video) */}
      <Animated.View
        style={{
          width: '100%',
          height: '100%',
          position: 'absolute',
          backfaceVisibility: 'hidden',
          backgroundColor: 'black',
          transform: [{ rotateY: backInterpolate }, { perspective: 1000 }],
          opacity: backOpacity,
          zIndex: showVideo ? 1 : 0,
        }}>
        {trailerId ? (
          <View className="flex-1 bg-black justify-center items-center">
            <View style={{ height: videoHeight, width: width }}>
              <YoutubePlayer
                height={videoHeight}
                width={width}
                play={playerReady && isPlaying}
                videoId={trailerId}
                mute={false}
                onReady={() => setPlayerReady(true)}
                onChangeState={onStateChange}
                initialPlayerParams={{
                  controls: true,
                  modestbranding: true,
                  rel: false,
                }}
              />
            </View>
            <View className="absolute bottom-2 w-full flex-row justify-center items-center gap-2 z-50">
              <TouchableOpacity onPress={flipToPoster}>
                <View className="w-2 h-2 rounded-full bg-white/30" />
              </TouchableOpacity>
              <View className="w-2 h-2 rounded-full bg-white scale-125" />
            </View>
          </View>
        ) : (
          <View className="flex-1 justify-center items-center bg-zinc-900">
            {isFetchingTrailer ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text className="text-white/50 text-xs">No Trailer Found</Text>
            )}
            <TouchableOpacity onPress={flipToPoster} className="p-2 mt-2">
              <View className="w-2 h-2 rounded-full bg-white/30" />
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>
    </View>
  );
};

// --- MAIN COMPONENT ---

type Props = NativeStackScreenProps<HomeStackParamList, 'Info'>;
export default function Info({ route, navigation }: Props): React.JSX.Element {
  const searchNavigation =
    useNavigation<NativeStackNavigationProp<TabStackParamList>>();
  const { primary } = useThemeStore(state => state);
  const { addItem, removeItem } = useWatchListStore(state => state);
  const { provider } = useContentStore(state => state);

  // React Query for optimized data fetching
  const {
    info,
    meta,
    isLoading: infoLoading,
    error,
    refetch,
  } = useContentDetails(
    route.params.link,
    route.params.provider || provider.value,
  );

  // UI state
  const [threeDotsMenuOpen, setThreeDotsMenuOpen] = useState(false);
  const [readMore, setReadMore] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: -1000, right: 0 });
  const [backgroundColor, setBackgroundColor] = useState('transparent');
  const [logoError, setLogoError] = useState(false);
  const [OpenExternalPlayer, setOpenExternalPlayer] = useState(
    settingsStorage.getBool('useExternalPlayer', false),
  );
  const [alwaysUseExternalDownload, setAlwaysUseExternalDownload] = useState(
    settingsStorage.getBool('alwaysExternalDownloader', false),
  );
  const [selectedTorrentLink, setSelectedTorrentLink] = useState<string | null>(null);
  const [selectedTorrentTitle, setSelectedTorrentTitle] = useState<string>('');

  // Trailer State
  const [ytVideoId, setYtVideoId] = useState<string | null>(null);
  const [isFetchingTrailer, setIsFetchingTrailer] = useState(false);
  const isMounted = useRef(true);

  const threeDotsRef = useRef<any>();

  // Memoized values
  const [inLibrary, setInLibrary] = useState(() =>
    watchListStorage.isInWatchList(route.params.link),
  );

  // Memoized handlers
  const openThreeDotsMenu = useCallback(() => {
    if (threeDotsRef.current) {
      threeDotsRef.current.measure(
        (
          x: number,
          y: number,
          width: number,
          height: number,
          pageX: number,
          pageY: number,
        ) => {
          setMenuPosition({ top: pageY - 35, right: 35 });
          setThreeDotsMenuOpen(true);
        },
      );
    }
  }, []);

  const handleScroll = useCallback((event: any) => {
    setBackgroundColor(
      event.nativeEvent.contentOffset.y > 150 ? 'black' : 'transparent',
    );
  }, []);

  // Optimized library management
  const addLibrary = useCallback(() => {
    ReactNativeHapticFeedback.trigger('effectClick', {
      enableVibrateFallback: true,
      ignoreAndroidSystemSettings: false,
    });
    addItem({
      title: meta?.name || info?.title,
      poster: meta?.poster || route.params.poster || info?.image,
      link: route.params.link,
      provider: route.params.provider || provider.value,
    });
    setInLibrary(true);
  }, [meta, info, route.params, provider.value, addItem]);

  const removeLibrary = useCallback(() => {
    if (settingsStorage.isHapticFeedbackEnabled()) {
      ReactNativeHapticFeedback.trigger('effectClick', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
    }
    removeItem(route.params.link);
    setInLibrary(false);
  }, [route.params.link, removeItem]);

  // Memoized computed values
  const synopsis = useMemo(() => {
    return meta?.description || info?.synopsis || 'No synopsis available';
  }, [meta?.description, info?.synopsis]);

  const displayTitle = useMemo(() => {
    return meta?.name || info?.title;
  }, [meta?.name, info?.title]);

  const posterImage = useMemo(() => {
    return (
      meta?.poster ||
      route.params.poster ||
      info?.image ||
      'https://placehold.jp/24/363636/ffffff/500x500.png?text=Doodle'
    );
  }, [meta?.poster, route.params.poster, info?.image]);

  const backgroundImage = useMemo(() => {
    return (
      meta?.background ||
      info?.image ||
      'https://placehold.jp/24/363636/ffffff/500x500.png?text=Doodle'
    );
  }, [meta?.background, info?.image]);

  const filteredLinkList = useMemo(() => {
    if (!info?.linkList) {
      return [];
    }

    const excludedQualities = settingsStorage.getExcludedQualities();
    const filtered = info.linkList.filter(
      (item: any) =>
        !item.quality || !excludedQualities.includes(item.quality as string),
    );

    return filtered.length > 0 ? filtered : info.linkList;
  }, [info?.linkList]);

  // Auto-select torrent search for movies (PlayTorrio style)
  useEffect(() => {
    const isTorrentProvider = (route.params.provider || provider.value) === 'torrent';
    if (isTorrentProvider && info?.type === 'movie' && !selectedTorrentLink && filteredLinkList.length > 0) {
      const movieItem = filteredLinkList.find((item: any) => item.title === 'Movie');
      if (movieItem && movieItem.directLinks && movieItem.directLinks[0]) {
        setSelectedTorrentLink(movieItem.directLinks[0].link);
        setSelectedTorrentTitle(displayTitle);
      }
    }
  }, [info, filteredLinkList, selectedTorrentLink, route.params.provider, provider.value, displayTitle]);

  // Optimized refresh handler
  const handleRefresh = useCallback(async () => {
    try {
      await refetch();
    } catch (refreshError) {
      console.error('Error refreshing content:', refreshError);
    }
  }, [refetch]);

  // --- TRAILER FETCHING LOGIC ---
  useEffect(() => {
    isMounted.current = true;
    const fetchTrailer = async () => {
      // 1. Try Provider Trailer
      const providerTrailer = meta?.trailers?.[0]?.source;
      if (providerTrailer) {
        if (isMounted.current) setYtVideoId(providerTrailer);
        return;
      }
      // 2. Try TMDB Search
      if (displayTitle && !infoLoading) {
        if (isMounted.current) setIsFetchingTrailer(true);
        const videoId = await getTmdbTrailer(
          displayTitle,
          info?.type,
          meta?.year,
          meta?.imdbId || meta?.imdb_id,
        );
        if (isMounted.current) {
          setYtVideoId(videoId);
          setIsFetchingTrailer(false);
        }
      }
    };
    fetchTrailer();
    return () => {
      isMounted.current = false;
    };
  }, [
    displayTitle,
    meta?.year,
    meta?.trailers,
    meta?.imdbId,
    meta?.imdb_id,
    infoLoading,
    info?.type,
  ]);

  // Error handling
  if (error) {
    return (
      <View className="h-full w-full bg-black justify-center items-center p-4">
        <StatusBar
          showHideTransition={'slide'}
          animated={true}
          translucent={true}
          backgroundColor="black"
        />
        <Text className="text-red-400 text-lg font-bold mb-4 text-center">
          Failed to load content
        </Text>
        <Text className="text-gray-400 text-sm mb-6 text-center">
          {error.message ||
            'An unexpected error occurred while loading the content'}
        </Text>
        <TouchableOpacity
          onPress={handleRefresh}
          className="bg-red-600 px-6 py-3 rounded-lg mb-4">
          <Text className="text-white font-semibold">Try Again</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="bg-gray-600 px-6 py-3 rounded-lg">
          <Text className="text-white font-semibold">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <QueryErrorBoundary>
      <View className="h-full w-full">
        <StatusBar
          showHideTransition={'slide'}
          animated={true}
          translucent={true}
          backgroundColor={backgroundColor}
        />
        <View>
          <FlatList
            data={[]}
            keyExtractor={(_, i) => i.toString()}
            renderItem={() => <View />}
            ListHeaderComponent={
              <>
                {/* --- NEW FLIP HEADER REPLACING OLD IMAGE HEADER --- */}
                <FlipHeader
                  posterImage={backgroundImage}
                  trailerId={ytVideoId}
                  meta={meta}
                  info={info}
                  infoLoading={infoLoading}
                  setLogoError={setLogoError}
                  displayTitle={displayTitle}
                  logoError={logoError}
                  isFetchingTrailer={isFetchingTrailer}
                />

                <View className="p-4 bg-black">
                  <View className="flex-row gap-x-3 gap-y-1 flex-wrap items-center mb-4">
                    {/* badges */}
                    {meta?.year && (
                      <Text className="text-white text-lg bg-tertiary px-2 rounded-md">
                        {meta?.year}
                      </Text>
                    )}
                    {meta?.runtime && (
                      <Text className="text-white text-lg bg-tertiary px-2 rounded-md">
                        {meta?.runtime}
                      </Text>
                    )}
                    {meta?.genres?.slice(0, 2).map((genre: string) => (
                      <Text
                        key={genre}
                        className="text-white text-lg bg-tertiary px-2 rounded-md">
                        {genre}
                      </Text>
                    ))}
                    {info?.tags?.slice(0, 3)?.map((tag: string) => (
                      <Text
                        key={tag}
                        className="text-white text-lg bg-tertiary px-2 rounded-md">
                        {tag}
                      </Text>
                    ))}
                  </View>
                  {/* Awards */}
                  {meta?.awards && (
                    <View className="mb-2 w-full flex-row items-baseline gap-2">
                      <Text className="text-white text- font-semibold">
                        Awards:
                      </Text>
                      <Text className="text-white text-xs px-1 bg-tertiary rounded-sm">
                        {meta?.awards?.length > 50
                          ? meta?.awards.slice(0, 50) + '...'
                          : meta?.awards}
                      </Text>
                    </View>
                  )}
                  {/* cast  */}
                  {(meta?.cast?.length! > 0 || (info?.cast && Array.isArray(info.cast) && info.cast.length > 0)) && (
                    <View className="mb-4">
                      <Text className="text-white text-lg font-semibold mb-2">
                        Cast
                      </Text>
                      <FlatList
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        initialNumToRender={10}
                        maxToRenderPerBatch={20}
                        windowSize={5}
                        data={(() => {
                          const providerCast = info?.cast && Array.isArray(info.cast) && info.cast.length > 0 ? info.cast : [];
                          const cinemetaCast = meta?.cast && Array.isArray(meta.cast) ? meta.cast : [];
                          const tmdbCast = meta?.tmdbCast && Array.isArray(meta.tmdbCast) ? meta.tmdbCast : [];
                          
                          // Prioritize TMDB cast as it's most likely to have high-quality images
                          if (tmdbCast.length > 0) return tmdbCast;

                          // If provider cast has detailed objects (images), prioritize it next
                          const hasDetailedProviderCast = providerCast.some((c: any) => typeof c === 'object' && c.image);
                          return hasDetailedProviderCast ? providerCast : (cinemetaCast.length > 0 ? cinemetaCast : providerCast);
                        })() as any[]}
                        keyExtractor={(actor, index) => (typeof actor === 'object' ? String(actor.id || index) : String(index))}
                        renderItem={({ item: actor }) => {
                          const isDetailed = typeof actor === 'object';
                          const name = isDetailed ? actor.name : actor;
                          const image = isDetailed ? actor.image : null;
                          const character = isDetailed ? actor.character : null;

                          return (
                            <TouchableOpacity
                              onPress={() => {
                                //@ts-ignore
                                searchNavigation.navigate('SearchStack', {
                                  screen: 'ScrollList',
                                  params: {
                                    filter: isDetailed ? `person_id:${actor.id}:${name}` : name,
                                    title: name,
                                    isSearch: true,
                                    providerValue: route.params.provider || provider.value,
                                  },
                                });
                              }}
                              className="mr-4 items-center w-20"
                            >
                              <View className="w-16 h-16 rounded-full overflow-hidden bg-zinc-800 border border-white/10 mb-1">
                                {image ? (
                                  <Image
                                    source={{ uri: image }}
                                    className="w-full h-full"
                                    contentFit="cover"
                                  />
                                ) : (
                                  <View className="flex-1 justify-center items-center">
                                    <Ionicons name="person" size={24} color="gray" />
                                  </View>
                                )}
                              </View>
                              <Text className="text-white text-[10px] text-center font-medium" numberOfLines={1}>
                                {name}
                              </Text>
                              {character && (
                                <Text className="text-gray-400 text-[8px] text-center" numberOfLines={1}>
                                  {character}
                                </Text>
                              )}
                            </TouchableOpacity>
                          );
                        }}
                      />
                    </View>
                  )}
                  {/* synopsis */}
                  <View className="mb-2 w-full flex-row items-center justify-between">
                    <Skeleton show={infoLoading} colorMode="dark" width={180}>
                      <View className="flex-row items-center gap-2">
                        <Text className="text-white text-lg font-semibold">
                          Synopsis
                        </Text>
                        <Text className="text-white text-[10px] bg-tertiary p-1 px-2 rounded-md font-bold uppercase tracking-wider">
                          {route.params.provider || provider.value}
                        </Text>
                      </View>
                    </Skeleton>
                    <View className="flex-row items-center gap-4 mb-1">
                      {/* Kept existing button, but now you also have the Flip Header */}
                      {inLibrary ? (
                        <TouchableOpacity
                          className="p-1 rounded-sm"
                          onPress={() => removeLibrary()}>
                          <Ionicons
                            name="bookmark"
                            size={24}
                            color={primary}
                          />
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          className="p-1 rounded-sm"
                          onPress={() => addLibrary()}>
                          <Ionicons
                            name="bookmark-outline"
                            size={24}
                            color={primary}
                          />
                        </TouchableOpacity>
                      )}

                      <TouchableOpacity
                        className="p-1 rounded-full"
                        onPress={() => {
                          const newVal = !OpenExternalPlayer;
                          settingsStorage.setBool('useExternalPlayer', newVal);
                          setOpenExternalPlayer(newVal);
                        }}>
                        <MaterialCommunityIcons
                          name="vlc"
                          size={26}
                          color={OpenExternalPlayer ? primary : 'rgb(156 163 175)'}
                        />
                      </TouchableOpacity>

                      <TouchableOpacity
                        className="p-1 rounded-full"
                        onPress={() => {
                          const newVal = !alwaysUseExternalDownload;
                          settingsStorage.setBool(
                            'alwaysExternalDownloader',
                            newVal,
                          );
                          setAlwaysUseExternalDownload(newVal);
                        }}>
                        <MaterialCommunityIcons
                          name="download"
                          size={25}
                          color={
                            alwaysUseExternalDownload
                              ? primary
                              : 'rgb(156 163 175)'
                          }
                        />
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => openThreeDotsMenu()}
                        ref={threeDotsRef}>
                        <MaterialCommunityIcons
                          name="dots-vertical"
                          size={25}
                          color="rgb(156 163 175)"
                        />
                      </TouchableOpacity>
                      {
                        <Modal
                          animationType="none"
                          transparent={true}
                          visible={threeDotsMenuOpen}
                          onRequestClose={() => {
                            setThreeDotsMenuOpen(false);
                          }}>
                          <Pressable
                            onPress={() => setThreeDotsMenuOpen(false)}
                            className="flex-1 bg-opacity-50">
                            <View
                              className="rounded-md p-2 w-48 bg-quaternary absolute right-10 top-[330px]"
                              style={{
                                top: menuPosition.top,
                                right: menuPosition.right,
                              }}>
                              {/* open in web  */}
                              <TouchableOpacity
                                className="flex-row items-center gap-2"
                                onPress={async () => {
                                  setThreeDotsMenuOpen(false);
                                  navigation.navigate('Webview', {
                                    link: route.params.link,
                                  });
                                }}>
                                <MaterialCommunityIcons
                                  name="web"
                                  size={21}
                                  color="rgb(156 163 175)"
                                />
                                <Text className="text-white text-base">
                                  Open in Web
                                </Text>
                              </TouchableOpacity>
                              {/* search */}
                              <TouchableOpacity
                                className="flex-row items-center gap-2 mt-1"
                                onPress={async () => {
                                  setThreeDotsMenuOpen(false);
                                  //@ts-ignore
                                  searchNavigation.navigate('SearchStack', {
                                    screen: 'SearchResults',
                                    params: {
                                      filter: displayTitle,
                                    },
                                  });
                                }}>
                                <Ionicons
                                  name="search"
                                  size={21}
                                  color="rgb(156 163 175)"
                                />
                                <Text className="text-white text-base">
                                  Search Title
                                </Text>
                              </TouchableOpacity>
                            </View>
                          </Pressable>
                        </Modal>
                      }
                    </View>
                  </View>
                  <Skeleton show={infoLoading} colorMode="dark" height={85}>
                    <Text className="text-gray-200 text-sm px-2 py-1 bg-tertiary rounded-md">
                      {synopsis.length > 180 && !readMore
                        ? synopsis.slice(0, 180) + '... '
                        : synopsis}
                      {synopsis.length > 180 && !readMore && (
                        <TouchableOpacity
                          onPress={() => setReadMore(!readMore)}
                          className="px-2 bg-tertiary rounded-md"
                          style={{ alignSelf: 'flex-start' }}>
                          <Text className="text-white font-extrabold text-xs">
                            read more
                          </Text>
                        </TouchableOpacity>
                      )}
                    </Text>
                  </Skeleton>
                  {/* cast */}
                </View>

                {/* Main container */}
                <View className="px-4 pb-1 bg-black">

                  {infoLoading ? (
                    <View className="gap-y-3 items-start mb-4 p-3">
                      <Skeleton
                        show={true}
                        colorMode="dark"
                        height={30}
                        width={80}
                      />
                      {[...Array(1)].map((_, i) => (
                        <View
                          className="bg-tertiary p-1 rounded-md gap-3 mt-3"
                          key={i}>
                          <Skeleton
                            show={true}
                            colorMode="dark"
                            height={20}
                            width={'100%'}
                          />
                        </View>
                      ))}
                    </View>
                  ) : (
                    <View>
                    <View>
                        {(route.params.provider || provider.value) === 'torrent' && info?.type === 'series' ? (
                            <View>
                                <SeasonList
                                    refreshing={false}
                                    providerValue={route.params.provider || provider.value}
                                    LinkList={filteredLinkList}
                                    poster={{
                                        logo: meta?.logo,
                                        poster: posterImage,
                                        background: backgroundImage,
                                    }}
                                    type={info?.type || 'series'}
                                    metaTitle={displayTitle}
                                    routeParams={route.params}
                                    onSelectTorrent={(link, title) => {
                                        setSelectedTorrentLink(link);
                                        setSelectedTorrentTitle(title);
                                    }}
                                />
                                {selectedTorrentLink && (
                                    <View className="mt-4 p-1">
                                        <TorrentList
                                            providerValue={route.params.provider || provider.value}
                                            link={selectedTorrentLink}
                                            type={info?.type || 'series'}
                                            tmdbId={String(route.params.tmdbId || '')}
                                            imdbId={info?.imdbId || ''}
                                            title={selectedTorrentTitle}
                                            onPlay={(stream) => {
                                                navigation.navigate('Player', {
                                                    linkIndex: 0,
                                                    episodeList: [{ title: stream.name, link: stream.link }],
                                                    type: info?.type || 'series',
                                                    primaryTitle: displayTitle,
                                                    secondaryTitle: selectedTorrentTitle,
                                                    poster: posterImage,
                                                    providerValue: route.params.provider || provider.value,
                                                    infoUrl: route.params.link,
                                                });
                                            }}
                                        />
                                    </View>
                                )}
                            </View>
                        ) : (
                            <View>
                                {selectedTorrentLink ? (
                                    <View className="p-1">
                                        <TouchableOpacity 
                                            onPress={() => setSelectedTorrentLink(null)}
                                            className="flex-row items-center mb-3 px-2 py-1 bg-zinc-900 border border-white/10 rounded-lg self-start"
                                        >
                                            <Ionicons name="arrow-back" size={18} color={primary} />
                                            <Text className="text-white ml-2 text-xs font-bold">Back to Seasons</Text>
                                        </TouchableOpacity>
                                        <TorrentList
                                            providerValue={route.params.provider || provider.value}
                                            link={selectedTorrentLink}
                                            type={info?.type || 'series'}
                                            tmdbId={String(route.params.tmdbId || '')}
                                            imdbId={info?.imdbId || ''}
                                            title={selectedTorrentTitle}
                                            onPlay={(stream) => {
                                                navigation.navigate('Player', {
                                                    linkIndex: 0,
                                                    episodeList: [{ title: stream.name, link: stream.link }],
                                                    type: info?.type || 'series',
                                                    primaryTitle: displayTitle,
                                                    secondaryTitle: selectedTorrentTitle,
                                                    poster: posterImage,
                                                    providerValue: route.params.provider || provider.value,
                                                    infoUrl: route.params.link,
                                                });
                                            }}
                                        />
                                    </View>
                                ) : (
                                    <SeasonList
                                        refreshing={false}
                                        providerValue={route.params.provider || provider.value}
                                        LinkList={filteredLinkList}
                                        poster={{
                                            logo: meta?.logo,
                                            poster: posterImage,
                                            background: backgroundImage,
                                        }}
                                        type={info?.type || 'series'}
                                        metaTitle={displayTitle}
                                        routeParams={route.params}
                                        onSelectTorrent={(link, title) => {
                                            setSelectedTorrentLink(link);
                                            setSelectedTorrentTitle(title);
                                        }}
                                    />
                                )}
                            </View>
                        )}
                    </View>
                    </View>
                  )}
                </View>
              </>
            }
            ListFooterComponent={<View className="h-16" />}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16} // Optimize scroll performance
            refreshControl={
              <RefreshControl
                colors={[primary]}
                tintColor={primary}
                progressBackgroundColor={'black'}
                refreshing={false}
                onRefresh={handleRefresh}
              />
            }
          />
        </View>
      </View>
    </QueryErrorBoundary>
  );
}