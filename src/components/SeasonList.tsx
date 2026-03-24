import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ToastAndroid,
  Modal,
  FlatList,
  ActivityIndicator,
  Pressable,
  ScrollView,
  TextInput,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Feather from '@expo/vector-icons/Feather';
import { Dropdown } from 'react-native-element-dropdown';
import { MotiView } from 'moti';
import { Skeleton } from 'moti/skeleton';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import * as IntentLauncher from 'expo-intent-launcher';
import RNReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { EpisodeLink, Link } from '../lib/providers/types';
import { RootStackParamList } from '../App';
import Downloader from './Downloader';
import { cacheStorage, mainStorage, settingsStorage } from '../lib/storage';
import { ifExists } from '../lib/file/ifExists';
import { useEpisodes, useStreamData } from '../lib/hooks/useEpisodes';
import useWatchHistoryStore from '../lib/zustand/watchHistrory';
import useThemeStore from '../lib/zustand/themeStore';
import { BlurView } from 'expo-blur';
import MarqueeText from './MarqueeText';


interface SeasonListProps {
  LinkList: Link[];
  poster: {
    logo?: string;
    poster?: string;
    background?: string;
  };
  type: string;
  metaTitle: string;
  providerValue: string;
  refreshing?: boolean;
  routeParams: Readonly<{
    link: string;
    provider?: string;
    poster?: string;
  }>;
  onSelectTorrent?: (link: string, title: string, season?: number, episode?: number) => void;
}

interface PlayHandlerProps {
  linkIndex: number;
  type: string;
  primaryTitle: string;
  secondaryTitle?: string;
  seasonTitle: string;
  episodeData: EpisodeLink[] | Link['directLinks'];
}

interface StickyMenuState {
  active: boolean;
  link?: string;
  type?: string;
}

const SeasonList: React.FC<SeasonListProps> = ({
  LinkList,
  poster,
  type,
  metaTitle,
  providerValue,
  refreshing: _refreshing,
  routeParams,
  onSelectTorrent,
}) => {
  const { primary } = useThemeStore(state => state);
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { addItem } = useWatchHistoryStore(state => state);
  const { fetchStreams } = useStreamData();

  // Early return if no LinkList provided
  if (!LinkList || LinkList.length === 0) {
    return (
      <View className="p-4">
        <Text className="text-white text-center">No Streams Available</Text>
      </View>
    );
  }

  // Memoized initial active season
  const [activeSeason, setActiveSeason] = useState<Link>(() => {
    if (!LinkList || LinkList.length === 0) {
      return {} as Link;
    }

    const cached = cacheStorage.getString(
      `ActiveSeason${metaTitle + providerValue}`,
    );

    if (cached) {
      try {
        const parsedSeason = JSON.parse(cached);
        // Verify the cached season still exists in LinkList
        const seasonExists = LinkList.find(
          link => link.title === parsedSeason.title,
        );
        if (seasonExists) {
          return parsedSeason;
        }
      } catch (error) {
        console.warn('Failed to parse cached season:', error);
      }
    }

    return LinkList[0];
  });

  // React Query for episodes
  const {
    data: episodeList = [],
    isLoading: episodeLoading,
    error: episodeError,
    refetch: refetchEpisodes,
  } = useEpisodes(
    activeSeason?.episodesLink,
    providerValue,
    activeSeason?.episodesLink ? true : false,
  );

  // UI state
  const [vlcLoading, setVlcLoading] = useState<boolean>(false);

  // Reanimated shared value for VLC loading
  const rotation = useSharedValue(0);

  const animatedStyles = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${rotation.value}deg` }],
    };
  });

  useEffect(() => {
    if (vlcLoading) {
      rotation.value = withRepeat(
        withTiming(360, {
          duration: 1000,
          easing: Easing.linear,
        }),
        -1,
      );
    } else {
      cancelAnimation(rotation);
      rotation.value = 0;
    }
  }, [vlcLoading]);

  const [stickyMenu, setStickyMenu] = useState<StickyMenuState>({
    active: false,
  });

  // Search and sorting state - memoized initial values
  const [searchText, setSearchText] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(() =>
    mainStorage.getString('episodeSortOrder') === 'desc' ? 'desc' : 'asc',
  );

  // Horizontal state
  const [selectedEpisodeIndex, setSelectedEpisodeIndex] = useState<number | null>(null);
  const flatListRef = useRef<FlatList>(null);

  // External player state
  const [showServerModal, setShowServerModal] = useState<boolean>(false);
  const [externalPlayerStreams, setExternalPlayerStreams] = useState<any[]>([]);
  const [isLoadingStreams, setIsLoadingStreams] = useState<boolean>(false);

  // Memoized filtering and sorting logic for episodes
  const filteredAndSortedEpisodes = useMemo(() => {
    if (!episodeList || !Array.isArray(episodeList)) {
      return [];
    }

    let episodes = episodeList.filter(
      episode => episode && episode.title && episode.link,
    );

    // Apply search filter
    if (searchText.trim()) {
      episodes = episodes.filter(
        episode =>
          episode?.title?.toLowerCase().includes(searchText.toLowerCase()),
      );
    }

    // Apply sorting
    if (sortOrder === 'desc') {
      episodes = [...episodes].reverse();
    }

    return episodes;
  }, [episodeList, searchText, sortOrder]);

  // Memoized direct links processing
  const filteredAndSortedDirectLinks = useMemo(() => {
    if (
      !activeSeason?.directLinks ||
      !Array.isArray(activeSeason.directLinks)
    ) {
      return [];
    }

    let links = activeSeason.directLinks.filter(
      link => link && link.title && link.link,
    );

    // Apply search filter
    if (searchText.trim()) {
      links = links.filter(
        link => link?.title?.toLowerCase().includes(searchText.toLowerCase()),
      );
    }

    // Apply sorting
    if (sortOrder === 'desc') {
      links = [...links].reverse();
    }

    return links;
  }, [activeSeason?.directLinks, searchText, sortOrder]);

  // Memoized title alignment
  const titleAlignment = useMemo(() => {
    const hasLongTitles =
      filteredAndSortedEpisodes.some(ep => ep?.title && ep.title.length > 27) ||
      filteredAndSortedDirectLinks.some(
        link => link?.title && link.title.length > 27,
      );

    return hasLongTitles ? 'justify-start' : 'justify-center';
  }, [filteredAndSortedEpisodes, filteredAndSortedDirectLinks]);

  // Memoized completion checker
  const isCompleted = useCallback((link: string) => {
    const watchProgress = JSON.parse(cacheStorage.getString(link) || '{}');
    const percentage =
      (watchProgress?.position / watchProgress?.duration) * 100;
    return percentage > 85;
  }, []);

  // Memoized toggle sort order
  const toggleSortOrder = useCallback(() => {
    const newOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    setSortOrder(newOrder);
    mainStorage.setString('episodeSortOrder', newOrder);
  }, [sortOrder]);

  // Memoized season change handler
  const handleSeasonChange = useCallback(
    (item: Link) => {
      setActiveSeason(item);
      cacheStorage.setString(
        `ActiveSeason${metaTitle + providerValue}`,
        JSON.stringify(item),
      );
    },
    [metaTitle, providerValue],
  );

  // Memoized external player handler
  const handleExternalPlayer = useCallback(
    async (link: string, type: string) => {
      setVlcLoading(true);
      setIsLoadingStreams(true);

      try {
        const streams = await fetchStreams(link, type, providerValue);

        if (!streams || streams.length === 0) {
          ToastAndroid.show('No stream available', ToastAndroid.SHORT);
          return;
        }

        console.log('Available Streams Count:', streams.length);
        setExternalPlayerStreams([...streams]);
        setIsLoadingStreams(false);
        setVlcLoading(false);
        setShowServerModal(true);

        ToastAndroid.show(
          `Found ${streams.length} servers`,
          ToastAndroid.SHORT,
        );
      } catch (error) {
        console.error('Error fetching streams:', error);
        ToastAndroid.show('Failed to load streams', ToastAndroid.SHORT);
      } finally {
        setVlcLoading(false);
        setIsLoadingStreams(false);
      }
    },
    [fetchStreams, providerValue],
  );

  // Memoized external player opener
  const openExternalPlayer = useCallback(async (streamUrl: string) => {
    setShowServerModal(false);
    setVlcLoading(true);

    try {
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: streamUrl,
        type: 'video/*',
      });
    } catch (error) {
      console.error('Error opening external player:', error);
      ToastAndroid.show('Failed to open external player', ToastAndroid.SHORT);
    } finally {
      setVlcLoading(false);
    }
  }, []);

  // Memoized play handler
  const playHandler = useCallback(
    async ({
      linkIndex,
      type,
      primaryTitle,
      secondaryTitle,
      seasonTitle,
      episodeData,
    }: PlayHandlerProps) => {
      addItem({
        id: routeParams.link,
        link: routeParams.link,
        title: primaryTitle,
        poster: poster?.poster,
        provider: providerValue,
        lastPlayed: Date.now(),
        episodeTitle: secondaryTitle,
        playbackRate: 1,
        currentTime: 0,
        duration: 1,
      });

      if (!episodeData || episodeData.length === 0) {
        return;
      }

      const link = episodeData[linkIndex].link;
      const file = (
        metaTitle +
        seasonTitle +
        episodeData[linkIndex]?.title
      ).replaceAll(/[^a-zA-Z0-9]/g, '_');

      const externalPlayer = settingsStorage.getBool('useExternalPlayer');
      const dwFile = await ifExists(file);

      if (externalPlayer) {
        if (dwFile) {
          await IntentLauncher.startActivityAsync(
            'android.intent.action.VIEW',
            {
              data: dwFile,
              type: 'video/*',
            },
          );
          return;
        }

        if (onSelectTorrent && providerValue.toLowerCase() === 'torrent') {
          onSelectTorrent(
            link, 
            secondaryTitle || primaryTitle, 
            activeSeason?.seasonNumber || (activeSeason?.title?.match(/Season (\d+)/i)?.[1] ? parseInt(activeSeason.title.match(/Season (\d+)/i)![1]) : undefined), 
            episodeData[linkIndex]?.episodeNumber || (episodeData[linkIndex]?.title?.match(/Episode (\d+)/i)?.[1] ? parseInt(episodeData[linkIndex].title.match(/Episode (\d+)/i)![1]) : undefined)
          );
          return;
        }

        handleExternalPlayer(link, type);
        return;
      }

      if (onSelectTorrent && providerValue.toLowerCase() === 'torrent') {
        onSelectTorrent(
            link, 
            secondaryTitle || primaryTitle,
            activeSeason?.seasonNumber || (activeSeason?.title?.match(/Season (\d+)/i)?.[1] ? parseInt(activeSeason.title.match(/Season (\d+)/i)![1]) : undefined), 
            episodeData[linkIndex]?.episodeNumber || (episodeData[linkIndex]?.title?.match(/Episode (\d+)/i)?.[1] ? parseInt(episodeData[linkIndex].title.match(/Episode (\d+)/i)![1]) : undefined)
        );
        return;
      }

      navigation.navigate('Player', {
        linkIndex,
        episodeList: episodeData,
        type: type,
        primaryTitle: primaryTitle,
        secondaryTitle: seasonTitle,
        poster: poster,
        providerValue: providerValue,
        infoUrl: routeParams.link,
      });
    },
    [
      addItem,
      routeParams.link,
      poster,
      providerValue,
      metaTitle,
      handleExternalPlayer,
      navigation,
    ],
  );

  // Memoized long press handler
  const onLongPressHandler = useCallback(
    (active: boolean, link: string, type?: string) => {
      if (settingsStorage.isHapticFeedbackEnabled()) {
        RNReactNativeHapticFeedback.trigger('effectTick', {
          enableVibrateFallback: true,
          ignoreAndroidSystemSettings: false,
        });
      }
      setStickyMenu({ active: active, link: link, type: type });
    },
    [],
  );

  // Memoized mark as watched handler
  const markAsWatched = useCallback(() => {
    if (stickyMenu.link) {
      cacheStorage.setString(
        stickyMenu.link,
        JSON.stringify({
          position: 10000,
          duration: 1,
        }),
      );
      setStickyMenu({ active: false });
    }
  }, [stickyMenu.link]);

  // Memoized mark as unwatched handler
  const markAsUnwatched = useCallback(() => {
    if (stickyMenu.link) {
      cacheStorage.setString(
        stickyMenu.link,
        JSON.stringify({
          position: 0,
          duration: 1,
        }),
      );
      setStickyMenu({ active: false });
    }
  }, [stickyMenu.link]);

  // Memoized sticky menu external player handler
  const handleStickyMenuExternalPlayer = useCallback(() => {
    setStickyMenu({ active: false });
    if (stickyMenu.link && stickyMenu.type) {
      handleExternalPlayer(stickyMenu.link, stickyMenu.type);
    }
  }, [stickyMenu.link, stickyMenu.type, handleExternalPlayer]);

  // Memoized episode render item
  const renderEpisodeItem = useCallback(
    ({ item, index }: { item: EpisodeLink; index: number }) => {
      if (!item || !item.link || !item.title) {
        console.warn('Invalid episode item at index', index, item);
        return null; // Skip rendering if item is invalid
      }

      return (
        <View
          key={item.link + index}
          className={`w-full justify-center items-center gap-2 flex-row my-1
          ${isCompleted(item.link) || stickyMenu.link === item.link
              ? 'opacity-60'
              : ''
            }
        `}>
          <View className="flex-row w-full justify-between gap-1 items-center">
            {providerValue.toLowerCase() === 'torrent' ? (
              <View className="flex-row gap-2 h-12 flex-1">
                <TouchableOpacity 
                  className={`bg-zinc-900 rounded-xl h-12 px-4 flex-row items-center gap-x-2 border border-white/40 flex-1 ${titleAlignment}`}
                  onPress={() => 
                    playHandler({
                      linkIndex: index,
                      type: item.episodesLink ? 'series' : type,
                      primaryTitle: metaTitle,
                      secondaryTitle: item.title,
                      seasonTitle: activeSeason?.title || '',
                      episodeData: filteredAndSortedEpisodes,
                    })
                  }
                >
                  <Ionicons name="cloud-download" size={24} color={primary} />
                  <View className="flex-1 ml-1">
                    <MarqueeText 
                        text={'Download - ' + item.title} 
                        style={{ color: 'white', fontWeight: '500', fontSize: 13 }} 
                    />
                  </View>
                </TouchableOpacity>

                <TouchableOpacity 
                  onPress={async () => {
                    await Clipboard.setStringAsync(item.link);
                    ToastAndroid.show('Link copied', ToastAndroid.SHORT);
                  }}
                  className="bg-white/5 w-12 rounded-xl items-center justify-center border border-white/10"
                >
                  <Ionicons name="copy-outline" size={20} color="#CBD5E1" />
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <TouchableOpacity
                  className={`bg-zinc-900 rounded-xl h-12 px-4 flex-row items-center gap-x-2 border border-white/40 ${titleAlignment}`}
                  style={{ flex: 1 }}
                  onPress={() =>
                    playHandler({
                      linkIndex: index,
                      type: item.episodesLink ? 'series' : type,
                      primaryTitle: metaTitle,
                      secondaryTitle: item.title,
                      seasonTitle: activeSeason?.title || '',
                      episodeData: filteredAndSortedEpisodes,
                    })
                  }
                  onLongPress={() => onLongPressHandler(true, item.link, 'series')}>
                  <Ionicons 
                    name="play-circle" 
                    size={26} 
                    color={primary} 
                  />
                  <View className="flex-1 ml-1">
                    <MarqueeText 
                        text={item.title} 
                        style={{ color: 'white', fontWeight: '500', fontSize: 13 }} 
                    />
                  </View>
                </TouchableOpacity>

                <Downloader
                  providerValue={providerValue}
                  link={item.link}
                  type={type}
                  className="h-12 w-11"
                  title={
                    metaTitle.length > 30
                      ? metaTitle.slice(0, 30) + '... ' + item.title
                      : metaTitle + ' ' + item.title
                  }
                  fileName={(
                    metaTitle +
                    activeSeason.title +
                    item.title
                  ).replaceAll(/[^a-zA-Z0-9]/g, '_')}
                />
              </>
            )}
          </View>
        </View>
      );
    },
    [
      isCompleted,
      stickyMenu.link,
      titleAlignment,
      playHandler,
      metaTitle,
      activeSeason?.title,
      filteredAndSortedEpisodes,
      onLongPressHandler,
      primary,
      providerValue,
    ],
  );

  // Memoized direct link render item
  const renderDirectLinkItem = useCallback(
    ({ item, index }: { item: any; index: number }) => {
      if (!item || !item.link || !item.title) {
        console.warn('Invalid direct link item at index', index, item);
        return null; // Skip rendering if item is invalid
      }

      return (
        <View
          key={item.link + index}
          className={`w-full justify-center items-center my-2 gap-2 flex-row
          ${isCompleted(item.link) || stickyMenu.link === item.link
              ? 'opacity-60'
              : ''
            }
        `}>
          <View className="flex-row w-full justify-between gap-1 items-center">
            {providerValue.toLowerCase() === 'torrent' ? (
              <View className="flex-row gap-2 h-12 flex-1">
                <TouchableOpacity
                  className={`bg-zinc-900 rounded-xl h-12 px-4 flex-row items-center gap-x-2 border border-white/40 flex-1 ${titleAlignment}`}
                  onPress={() =>
                    playHandler({
                      linkIndex: index,
                      type: type,
                      primaryTitle: metaTitle,
                      secondaryTitle: item.title,
                      seasonTitle: activeSeason?.title || '',
                      episodeData: filteredAndSortedDirectLinks,
                    })
                  }
                >
                  <Ionicons name="cloud-download" size={24} color={primary} />
                  <View className="flex-1 ml-1">
                    <MarqueeText
                        text={'Download - ' + item.title}
                        style={{ color: 'white', fontWeight: '500', fontSize: 13 }}
                    />
                  </View>
                </TouchableOpacity>

                <TouchableOpacity 
                  onPress={async () => {
                    await Clipboard.setStringAsync(item.link);
                    ToastAndroid.show('Link copied', ToastAndroid.SHORT);
                  }}
                  className="bg-white/5 w-12 rounded-xl items-center justify-center border border-white/10"
                >
                  <Ionicons name="copy-outline" size={20} color="#CBD5E1" />
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <TouchableOpacity
                  className={`bg-zinc-900 rounded-xl h-12 px-4 flex-row items-center gap-x-2 border border-white/40 ${titleAlignment}`}
                  style={{ flex: 1 }}
                  onPress={() =>
                    playHandler({
                      linkIndex: index,
                      type: type,
                      primaryTitle: metaTitle,
                      secondaryTitle: item.title,
                      seasonTitle: activeSeason?.title || '',
                      episodeData: filteredAndSortedDirectLinks,
                    })
                  }
                  onLongPress={() =>
                    onLongPressHandler(true, item.link, item?.type || 'series')
                  }>
                  <Ionicons 
                    name="play-circle" 
                    size={26} 
                    color={primary} 
                  />
                  <View className="flex-1 ml-1">
                    <MarqueeText
                        text={activeSeason?.directLinks?.length && activeSeason?.directLinks?.length > 1 ? item.title : 'Play'}
                        style={{ color: 'white', fontWeight: '500', fontSize: 13 }}
                    />
                  </View>
                </TouchableOpacity>

                <Downloader
                  providerValue={providerValue}
                  link={item.link}
                  type={item?.type || type}
                  className="h-12 w-11"
                  title={
                    metaTitle.length > 30
                      ? metaTitle.slice(0, 30) + '... ' + item.title
                      : metaTitle + ' ' + item.title
                  }
                  fileName={(
                    metaTitle +
                    activeSeason.title +
                    item.title
                  ).replaceAll(/[^a-zA-Z0-9]/g, '_')}
                />
              </>
            )}
          </View>
        </View>
      );
    },
    [
      isCompleted,
      stickyMenu.link,
      titleAlignment,
      playHandler,
      metaTitle,
      activeSeason?.title,
      activeSeason?.directLinks,
      filteredAndSortedDirectLinks,
      onLongPressHandler,
      primary,
      providerValue,
    ],
  );

  // Memoized server render item
  const renderServerItem = useCallback(
    (item: any, index: number) => (
      <TouchableOpacity
        key={`server-${index}-${item.server}`}
        className="bg-black/30 p-3 rounded-lg mb-2 flex-row justify-between items-center"
        style={{ borderColor: primary, borderWidth: 1 }}
        onPress={() => openExternalPlayer(item.link)}>
        <View>
          <Text className="text-white text-lg capitalize font-bold">
            {item.server || `Server ${index + 1}`}
          </Text>
          <Text className="text-white text-xs opacity-80">
            {item.type ? `Format: ${item.type.toUpperCase()}` : ''}
          </Text>
        </View>
        <MaterialCommunityIcons name="vlc" size={24} color={primary} />
      </TouchableOpacity>
    ),
    [primary, openExternalPlayer],
  );

  // Show loading skeleton while episodes are loading
  if (episodeLoading) {
    return (
      <View>
        {LinkList.length > 1 && (
          <Dropdown
            selectedTextStyle={{
              color: primary,
              overflow: 'hidden',
              height: 20,
              fontWeight: 'bold',
            }}
            labelField={'title'}
            valueField={
              LinkList[0]?.episodesLink ? 'episodesLink' : 'directLinks'
            }
            onChange={handleSeasonChange}
            value={activeSeason}
            data={LinkList}
            style={{
              overflow: 'hidden',
              borderWidth: 1,
              borderColor: '#2f302f',
              paddingHorizontal: 12,
              borderRadius: 8,
              backgroundColor: 'black',
            }}
            containerStyle={{
              overflow: 'hidden',
              borderWidth: 1,
              borderColor: 'gray',
              borderRadius: 8,
              backgroundColor: 'black',
            }}
            renderItem={item => (
              <View
                className={`px-3 py-2 bg-black text-white flex-row justify-start items-center border-b border-gray-500 text-center ${activeSeason === item ? 'bg-quaternary' : ''
                  }`}>
                <Text className="text-white">{item?.title || 'Unknown'}</Text>
              </View>
            )}
          />
        )}

        <MotiView
          animate={{ backgroundColor: '#0000' }}
          delay={0}
          //@ts-ignore
          transition={{
            type: 'timing',
          }}
          style={{
            width: '100%',
            padding: 10,
            alignItems: 'flex-start',
            gap: 20,
          }}>
          <Skeleton colorMode={'dark'} width={'85%'} height={48} />
          <Skeleton colorMode={'dark'} width={'85%'} height={48} />
          <Skeleton colorMode={'dark'} width={'85%'} height={48} />
          <Skeleton colorMode={'dark'} width={'85%'} height={48} />
          <Skeleton colorMode={'dark'} width={'85%'} height={48} />
          <Skeleton colorMode={'dark'} width={'85%'} height={48} />
        </MotiView>
      </View>
    );
  }

  // Show error state
  if (episodeError) {
    return (
      <View className="p-4">
        <Text className="text-red-500 text-center">
          Failed to load episodes. Please try again.
        </Text>
        <TouchableOpacity
          className="mt-2 bg-red-600 p-2 rounded-md"
          onPress={() => refetchEpisodes()}>
          <Text className="text-white text-center">Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View>
      {/* Season Selector */}
      {LinkList.length > 1 ? (
        <Dropdown
          selectedTextStyle={{
            color: primary,
            overflow: 'hidden',
            height: 20,
            fontWeight: 'bold',
          }}
          labelField={'title'}
          valueField={
            LinkList[0]?.episodesLink ? 'episodesLink' : 'directLinks'
          }
          onChange={handleSeasonChange}
          value={activeSeason}
          data={LinkList}
          style={{
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: '#2f302f',
            paddingHorizontal: 12,
            borderRadius: 8,
            backgroundColor: 'black',
          }}
          containerStyle={{
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: 'gray',
            borderRadius: 8,
            backgroundColor: 'black',
          }}
          renderItem={item => (
            <View
              className={`px-3 py-2 bg-black text-white flex-row justify-start items-center border-b border-gray-500 text-center ${activeSeason === item ? 'bg-quaternary' : ''
                }`}>
              <Text className="text-white">{item?.title || 'Unknown'}</Text>
            </View>
          )}
        />
      ) : (
        <Text className="text-red-600 text-lg font-semibold px-2">
          {LinkList[0]?.title || 'Unknown Season'}
        </Text>
      )}

      {/* Search and Sort Controls */}
      {(filteredAndSortedEpisodes.length > 8 ||
        filteredAndSortedDirectLinks.length > 8) && (
          <View className="flex-row justify-between items-center mt-2">
            <TextInput
              placeholder="Search..."
              className="bg-black/30 text-white rounded-md p-2 h-10 w-[80%] border-collapse border border-white/10"
              value={searchText}
              onChangeText={setSearchText}
            />
            <TouchableOpacity
              className="bg-black/30 rounded-md p-2 h-10 w-[15%] flex-row justify-center items-center"
              onPress={toggleSortOrder}>
              <MaterialCommunityIcons
                name={sortOrder === 'asc' ? 'sort-ascending' : 'sort-descending'}
                size={24}
                color={primary}
              />
            </TouchableOpacity>
          </View>
        )}

      {/* Episode/Direct Links List */}
      <View className="mt-4">
        {providerValue.toLowerCase() === 'torrent' ? (
          <View>
            <FlatList
              ref={flatListRef}
              data={filteredAndSortedEpisodes.length > 0 ? filteredAndSortedEpisodes : filteredAndSortedDirectLinks}
              keyExtractor={(item, index) => `ep-box-${item.link}-${index}`}
              contentContainerStyle={{ gap: 12 }}
              renderItem={({ item, index }) => {
                const isSelected = selectedEpisodeIndex === index;
                return (
                  <View 
                    style={{ backgroundColor: isSelected ? primary + '10' : '#121212' }}
                    className="flex-row items-center gap-3 p-3 rounded-2xl border border-white/10"
                  >
                    <View className="flex-1">
                      <Text 
                        className="text-white font-bold text-sm"
                        numberOfLines={1}
                      >
                        {item.title}
                      </Text>
                    </View>

                    <View className="flex-row gap-2">
                      <TouchableOpacity 
                        onPress={async () => {
                          await Clipboard.setStringAsync(item.link);
                          ToastAndroid.show('Link copied', ToastAndroid.SHORT);
                        }}
                        className="bg-white/5 h-10 w-10 rounded-xl items-center justify-center border border-white/10"
                      >
                        <Ionicons name="copy-outline" size={18} color="#CBD5E1" />
                      </TouchableOpacity>

                      <TouchableOpacity 
                        onPress={() => {
                          setSelectedEpisodeIndex(index);
                          playHandler({
                              linkIndex: index,
                              type: item.episodesLink ? 'series' : type,
                              primaryTitle: metaTitle,
                              secondaryTitle: item.title,
                              seasonTitle: activeSeason?.title || '',
                              episodeData: filteredAndSortedEpisodes.length > 0 ? filteredAndSortedEpisodes : filteredAndSortedDirectLinks,
                          });
                        }}
                        style={{ backgroundColor: isSelected ? primary : '#262626' }}
                        className="h-10 px-4 rounded-xl flex-row items-center justify-center"
                      >
                        <Ionicons name="download" size={18} color={isSelected ? "black" : "white"} />
                        <Text style={{ color: isSelected ? "black" : "white" }} className="font-black ml-2 text-xs">Download</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              }}
            />
          </View>
        ) : (
          <View className="flex-row flex-wrap justify-center gap-x-2 gap-y-2">
            {/* Episodes List */}
            {filteredAndSortedEpisodes.length > 0 && (
              <FlatList
                data={filteredAndSortedEpisodes}
                keyExtractor={(item, index) => `episode-${item.link}-${index}`}
                renderItem={renderEpisodeItem}
                maxToRenderPerBatch={10}
                windowSize={10}
                removeClippedSubviews={true}
                getItemLayout={(data, index) => ({
                    length: 60,
                    offset: 60 * index,
                    index,
                })}
              />
            )}
            
            {/* Direct Links List */}
            {filteredAndSortedDirectLinks.length > 0 && (
              <FlatList
                data={filteredAndSortedDirectLinks}
                keyExtractor={(item, index) => `direct-${item.link}-${index}`}
                renderItem={renderDirectLinkItem}
                maxToRenderPerBatch={10}
                windowSize={10}
                removeClippedSubviews={true}
                getItemLayout={(data, index) => ({
                    length: 60,
                    offset: 60 * index,
                    index,
                })}
              />
            )}
          </View>
        )}
      </View>

        {/* No Content Available */}
        {filteredAndSortedEpisodes.length === 0 &&
          filteredAndSortedDirectLinks.length === 0 &&
          LinkList?.length === 0 && (
            <Text className="text-white text-lg font-semibold min-h-20">
              No stream found
            </Text>
          )}

      {/* VLC Loading Indicator */}
      {vlcLoading && (
        <View className="absolute top-0 left-0 w-full h-full bg-black/60 bg-opacity-50 justify-center items-center">
          <Animated.View style={animatedStyles}>
            <MaterialCommunityIcons name="loading" size={48} color={primary} />
          </Animated.View>
        </View>
      )}


      {/* Server Selection Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showServerModal}
        onRequestClose={() => setShowServerModal(false)}>
        <Pressable
          onPress={() => setShowServerModal(false)}
          className="flex-1 justify-center items-center bg-black/80">
          <View className="bg-tertiary rounded-xl p-4 w-[90%] max-w-[350px]">
            <Text className="text-white text-xl font-bold mb-2 text-center">
              Select External Player Server
            </Text>
            <Text className="text-white text-sm mb-4 text-center opacity-70">
              {externalPlayerStreams.length} servers available
            </Text>

            {isLoadingStreams ? (
              <ActivityIndicator size="large" color={primary} />
            ) : (
              <>
                <ScrollView style={{ maxHeight: 300 }}>
                  {externalPlayerStreams.map((item, index) =>
                    renderServerItem(item, index),
                  )}
                  {externalPlayerStreams.length === 0 && (
                    <Text className="text-white text-center p-4">
                      No servers available
                    </Text>
                  )}
                </ScrollView>

                <TouchableOpacity
                  className="mt-4 bg-black/30 py-2 rounded-md"
                  onPress={() => setShowServerModal(false)}>
                  <Text className="text-white text-center font-bold">
                    Cancel
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </Pressable>
      </Modal>

      {/* Sticky Menu Modal */}
      <Modal
        animationType="fade"
        visible={stickyMenu.active}
        transparent={true}
        onRequestClose={() => setStickyMenu({ active: false })}>
        <Pressable
          className="flex-1 justify-end items-center"
          onPress={() => setStickyMenu({ active: false })}>
          <View className="w-full h-14 bg-quaternary flex-row justify-evenly items-center pt-2">
            {isCompleted(stickyMenu.link || '') ? (
              <TouchableOpacity
                className="flex-row justify-center items-center gap-2 p-2"
                onPress={markAsUnwatched}>
                <Text className="text-white">Marked as Unwatched</Text>
                <Ionicons name="checkmark-done" size={30} color={primary} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                className="flex-row justify-center items-center gap-2 pt-0 pb-2 px-2 bg-tertiary rounded-md"
                onPress={markAsWatched}>
                <Text className="text-white">Mark as Watched</Text>
                <Ionicons name="checkmark" size={25} color={primary} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              className="flex-row justify-center bg-tertiary rounded-md items-center pt-0 pb-2 px-2 gap-2"
              onPress={handleStickyMenuExternalPlayer}>
              <Text className="text-white font-bold text-base">
                External Player
              </Text>
              <Feather name="external-link" size={20} color={primary} />
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View >
  );
};

export default React.memo(SeasonList);