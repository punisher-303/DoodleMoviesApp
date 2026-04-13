// Suggestion.tsx
import React, {useEffect, useState, useCallback} from 'react';
import {View, Text, FlatList, TouchableOpacity, Image} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import Animated, {FadeInDown, Layout} from 'react-native-reanimated';
import {Ionicons} from '@expo/vector-icons';
import useThemeStore from '../lib/zustand/themeStore';
import useWatchHistoryStore from '../lib/zustand/watchHistrory';
import {MMKV} from '../lib/Mmkv';
import {SearchStackParamList} from '../App';

// --- Type Definitions ---
interface SuggestItem {
  Title: string;
  Year?: string;
  imdbID: string;
  querySourceTitle: string;
  Poster?: string;
  Type: 'movie' | 'series' | 'episode';
  // Index of the history query that generated this suggestion (0 is most recent)
  sourceQueryIndex: number;
}

interface IMDBApiResult {
  id: string; // imdbID
  l: string; // title
  y?: number; // year
  i?: {imageUrl: string; height: number; width: number}; // image/poster
  q?: 'feature' | 'tv_series' | 'video' | 'short'; // query type
}

const FALLBACK_QUERIES = ['top rated movies', 'latest series'];
const MAX_RESULTS_PER_QUERY = 12; // Max results to fetch for each history title source

// 💡 NEW: Common genre keywords for inference
const GENRE_KEYWORDS = [
  'Action',
  'Comedy',
  'Thriller',
  'Horror',
  'Sci-Fi',
  'Fantasy',
  'Drama',
  'Adventure',
  'Romance',
];

// Function to clean and shorten the title for the IMDb API
const cleanTitleForImdbApi = (title: string): string => {
  let cleaned = title.split(':')[0].split('(')[0].trim();
  cleaned = cleaned.replace(/[^a-zA-Z0-9\s]/g, '');
  const words = cleaned.split(/\s+/).slice(0, 3);
  return words.join(' ').trim();
};

const Suggestion = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<SearchStackParamList>>();
  const {primary} = useThemeStore(state => state);

  const watchHistoryZustand = useWatchHistoryStore(state => state.history);

  const [suggestions, setSuggestions] = useState<SuggestItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());

  /**
   * Helper function to execute a single IMDb suggestion query.
   */
  const executeImdbQuery = async (
    query: string,
    sourceTitle: string,
    resultLimit: number,
    sourceQueryIndex: number,
  ): Promise<SuggestItem[]> => {
    if (!query) return [];

    const firstLetter = query[0] ? query[0].toLowerCase() : 'a';
    const url = `https://v2.sg.media-imdb.com/suggestion/${firstLetter}/${encodeURIComponent(
      query,
    )}.json`;

    try {
      const resp = await fetch(url);
      const text = await resp.text();
      const m = text.match(/\{[\s\S]*\}$/);
      const json = m ? JSON.parse(m[0]) : JSON.parse(text);

      if (json.d) {
        return json.d
          .slice(0, resultLimit)
          .filter(
            (item: IMDBApiResult) =>
              // Filter out the original search title itself
              item.l.toLowerCase().trim() !== sourceTitle.toLowerCase().trim(),
          )
          .map((item: IMDBApiResult) => ({
            Title: item.l,
            Year: item.y?.toString(),
            imdbID: item.id,
            querySourceTitle: sourceTitle, // Use the original history title
            Poster: item.i?.imageUrl,
            Type: item.q === 'tv_series' ? 'series' : 'movie',
            sourceQueryIndex: sourceQueryIndex, // Assign the index
          }));
      }
    } catch (e) {
      // console.warn('IMDb Suggest fetch failed for:', query, e);
    }
    return [];
  };

  /**
   * Function to fetch suggestions using a multi-step query strategy.
   */
  const fetchSuggestionsFromHistoryTitle = async (
    queryTitle: string,
    historyIndex: number, // Accept the index of the history item (0 = most recent)
  ): Promise<SuggestItem[]> => {
    const coreQuery = cleanTitleForImdbApi(queryTitle);
    if (!coreQuery) return [];

    const lowerCoreQuery = coreQuery.toLowerCase();
    const queryTitleLower = queryTitle.toLowerCase();

    // 1. Genre Inference: Check if the full history title contains a genre keyword
    const inferredGenre = GENRE_KEYWORDS.find(genre =>
      queryTitleLower.includes(genre.toLowerCase()),
    );

    // 2. Determine the base query for fallback and enhancement
    const isAnime =
      lowerCoreQuery.includes('anime') ||
      lowerCoreQuery.includes('man') ||
      lowerCoreQuery.includes('kaiju') ||
      lowerCoreQuery.includes('leveling');

    let enhancedQuery = isAnime
      ? `${coreQuery} similar action anime`
      : `${coreQuery} similar movie`;

    // 💡 FIX: Inject inferred genre into the enhanced query
    if (inferredGenre) {
      // e.g., "The Matrix" is in history. Query: "The Matrix similar sci-fi movie"
      enhancedQuery = `${coreQuery} similar ${inferredGenre} ${
        queryTitle.includes('series') ? 'series' : 'movie'
      }`;
    }

    const genreFallback = inferredGenre
      ? `best ${inferredGenre} titles` // Use the inferred genre for a broad search
      : isAnime
      ? 'top action anime'
      : 'top rated movies';

    let finalSuggestions: SuggestItem[] = [];
    const collectedIds = new Set<string>();

    // 💡 FIX: Prioritized queries to ensure the best matches and genre matches are attempted first
    const queriesToRun = [
      enhancedQuery, // 1. Enhanced, title + genre query (best match potential)
      coreQuery, // 2. Simple core title query (good for direct sequel/prequel/related title match)
      genreFallback, // 3. Broad genre/type query (high success rate, high diversity)
    ];

    for (const query of queriesToRun) {
      const newResults = await executeImdbQuery(
        query,
        queryTitle,
        MAX_RESULTS_PER_QUERY - finalSuggestions.length, // Only fetch what we still need
        historyIndex, // Pass the history index
      );

      // Add unique new results to the final list
      for (const item of newResults) {
        if (item.imdbID && !collectedIds.has(item.imdbID)) {
          finalSuggestions.push(item);
          collectedIds.add(item.imdbID);
        }
      }

      // If we have enough results, stop iterating
      if (finalSuggestions.length >= MAX_RESULTS_PER_QUERY) {
        break;
      }
    }

    return finalSuggestions;
  };

  const generateSuggestionsFromHistory = useCallback(async () => {
    setIsLoading(true);

    try {
      // 1. Get Search History (from MMKV)
      const searchHistory: string[] =
        MMKV.getArray<string>('searchHistory') || [];

      // 2. Get Watch History TITLES (from Zustand)
      const watchHistoryTitles: string[] = watchHistoryZustand
        .map(item => item.title)
        .filter(title => title && title.length > 2) as string[];

      // Combine and process titles
      const allHistoryTitles = [...searchHistory, ...watchHistoryTitles];

      // 3. Create Unique & Recency-Ordered Queries
      // The uniqueHistoryQueries array is ordered from MOST RECENT to LEAST RECENT.
      const uniqueHistoryQueries = allHistoryTitles
        .filter(item => typeof item === 'string' && item.length > 2)
        .reverse() // Reverse to process most recent first
        .reduce((acc, current) => {
          if (!acc.includes(current)) {
            acc.push(current);
          }
          return acc;
        }, [] as string[])
        .slice(0, 8); // Top 8 history titles as sources

      const queries =
        uniqueHistoryQueries.length > 0
          ? uniqueHistoryQueries
          : FALLBACK_QUERIES;

      // 4. Fetch suggestions concurrently (map the query with its index)
      // Index 0 will be the most recent query, Index 7 the least recent.
      const fetchPromises = queries.map((query, index) =>
        fetchSuggestionsFromHistoryTitle(query, index),
      );
      const dynamicResults = await Promise.all(fetchPromises);

      const allRecs = dynamicResults.flat();

      // 5. Deduplicate and Final Sort
      let finalSuggestions = allRecs.reduce((acc, current) => {
        // Find existing item by imdbID
        const existingItemIndex = acc.findIndex(
          item => item.imdbID === current.imdbID,
        );

        if (existingItemIndex === -1) {
          // If not a duplicate, add it.
          acc.push(current);
        } else {
          // If duplicate, keep the one generated by the *most recent* history query (lower index)
          if (
            current.sourceQueryIndex < acc[existingItemIndex].sourceQueryIndex
          ) {
            acc[existingItemIndex] = current; // Replace older item with newer item
          }
        }
        return acc;
      }, [] as SuggestItem[]);

      // 💡 FIX: FINAL SORT - Guarantee most recent suggestions are at the top.
      // Sort by sourceQueryIndex ASCENDING (0 = most recent, so it comes first)
      finalSuggestions.sort((a, b) => a.sourceQueryIndex - b.sourceQueryIndex);

      // Slice the final list down to a reasonable number
      setSuggestions(finalSuggestions.slice(0, 30));

      // Reset removed IDs on new fetch
      setRemovedIds(new Set());
    } catch (e) {
      console.error(
        'Error during history analysis or fetching suggestions:',
        e,
      );
      setSuggestions([]);
      setRemovedIds(new Set());
    } finally {
      setIsLoading(false);
    }
  }, [watchHistoryZustand]);

  useEffect(() => {
    generateSuggestionsFromHistory();
  }, [generateSuggestionsFromHistory]);

  const handleClick = (title: string) => {
    navigation.navigate('SearchResults', {filter: title});
  };

  // Handler to remove a suggestion
  const handleRemoveSuggestion = (imdbID: string) => {
    setRemovedIds(prev => {
      const newSet = new Set(prev);
      newSet.add(imdbID);
      return newSet;
    });
  };

  // Filter the suggestions based on removedIds before rendering
  const filteredSuggestions = suggestions.filter(
    item => !removedIds.has(item.imdbID),
  );

  const renderItem = ({item, index}: {item: SuggestItem; index: number}) => (
    <Animated.View
      entering={FadeInDown.delay(index * 70)}
      layout={Layout.springify()}
      className="mb-3 px-4">
      <TouchableOpacity
        className="bg-[#141414] p-3 rounded-xl border border-white/10 flex-row items-center"
        onPress={() => handleClick(item.Title)}
        activeOpacity={0.7}>
        {item.Poster ? (
          <Image
            source={{uri: item.Poster}}
            className="w-12 h-16 rounded mr-3"
            resizeMode="cover"
          />
        ) : (
          <View className="w-12 h-16 mr-3 bg-white/10 rounded items-center justify-center">
            <Ionicons name="film-outline" size={24} color={primary} />
          </View>
        )}
        <View className="flex-1 pr-2">
          <Text
            className="text-white text-base font-semibold"
            numberOfLines={1}>
            {item.Title}
          </Text>
          <Text className="text-white/50 text-xs" numberOfLines={1}>
            {`${
              item.Type === 'series' ? 'TV SERIES' : 'MOVIE'
            } · Suggested from: ${item.querySourceTitle} · ${
              item.Year || 'N/A'
            }`}
          </Text>
        </View>

        {/* Remove button */}
        <TouchableOpacity
          onPress={() => handleRemoveSuggestion(item.imdbID)}
          className="p-2 ml-2"
          hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
          <Ionicons name="close-circle-outline" size={24} color="#FF6347" />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <View className="flex-1 bg-black">
      <View className="px-4 pt-4">
        <Text className="text-white text-xl font-bold mb-1">
          🍿 Recommendations
        </Text>
        <Text className="text-white/60 text-sm mb-4">
          Based on your search & watch history
        </Text>
      </View>
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <Animated.Text
            entering={FadeInDown}
            className="text-white/60 text-base">
            Analyzing preferences...
          </Animated.Text>
        </View>
      ) : filteredSuggestions.length > 0 ? (
        <FlatList
          data={filteredSuggestions}
          keyExtractor={(item, idx) => `${item.imdbID || item.Title}-${idx}`}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{paddingBottom: 20}}
        />
      ) : suggestions.length > 0 ? (
        // State for when all suggestions have been removed
        <View className="flex-1 items-center justify-center px-6">
          <Ionicons name="thumbs-up-outline" size={30} color={primary} />
          <Text className="text-white/60 text-sm mt-2 text-center">
            You've cleared all visible suggestions! Keep watching and searching
            to get more.
          </Text>
        </View>
      ) : (
        // Original empty state
        <View className="flex-1 items-center justify-center px-6">
          <Ionicons name="sparkles-outline" size={30} color={primary} />
          <Text className="text-white/60 text-sm mt-2 text-center">
            No suggestions yet — start searching, watching, or marking your
            favorites!
          </Text>
        </View>
      )}
    </View>
  );
};

export default Suggestion;
