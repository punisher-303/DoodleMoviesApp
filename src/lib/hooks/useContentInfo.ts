import {useQuery} from '@tanstack/react-query';
import {providerManager} from '../services/ProviderManager';
import {cacheStorage} from '../storage';
import axios from 'axios';

// Hook for fetching content info/metadata
export const useContentInfo = (link: string, providerValue: string) => {
  return useQuery({
    queryKey: ['contentInfo', link, providerValue],
    queryFn: async () => {
      console.log('Fetching content info for:', link);

      const data = await providerManager.getMetaData({
        link,
        provider: providerValue,
      });
      if (!data || (!data?.title && !data?.synopsis && !data?.image)) {
        throw new Error('Error: No data returned from provider');
      }

      return data;
    },
    enabled: !!link && !!providerValue,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
    retry: 2,
    // Use cached data as initial data
    initialData: () => {
      const cached = cacheStorage.getString(link);
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch {
          return undefined;
        }
      }
      return undefined;
    },
    // Cache successful responses
    meta: {
      onSuccess: (data: any) => {
        if (data) {
          cacheStorage.setString(link, JSON.stringify(data));
        }
      },
    },
  });
};

const TMDB_API_KEY = '9d2bff12ed955c7f1f74b83187f188ae';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

// Hook for fetching enhanced metadata from Stremio
export const useEnhancedMetadata = (imdbId: string, type: string) => {
  return useQuery({
    queryKey: ['enhancedMeta', imdbId, type],
    queryFn: async () => {
      console.log('Fetching enhanced metadata for:', imdbId);
      try {
        // Validate imdbId and type
        if (!imdbId || !type) {
          throw new Error('Invalid imdbId or type');
        }
      } catch (error) {
        console.log('Error validating imdbId or type:', error);
        return {};
      }
      const response = await axios.get(
        `https://v3-cinemeta.strem.io/meta/${type}/${imdbId}.json`,
        {timeout: 10000},
      );

      return response.data?.meta;
    },
    enabled: !!imdbId && !!type,
    staleTime: 30 * 60 * 1000, // 30 minutes - metadata changes rarely
    gcTime: 2 * 60 * 60 * 1000, // 2 hours
    retry: 1, // Don't retry too much for external API
    // Use cached data as initial data
    initialData: () => {
      const cached = cacheStorage.getString(imdbId);
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch {
          return undefined;
        }
      }
      return undefined;
    },
    // Cache successful responses
    meta: {
      onSuccess: (data: any) => {
        if (data && imdbId) {
          cacheStorage.setString(imdbId, JSON.stringify(data));
        }
      },
    },
  });
};

// Hook for fetching cast from TMDB (Universal Cast Fix)
export const useTmdbCredits = (imdbId: string, type: string) => {
  return useQuery({
    queryKey: ['tmdbCredits', imdbId, type],
    queryFn: async () => {
      if (!imdbId) return null;
      console.log('Fetching TMDB credits for:', imdbId);
      try {
        const searchType = type === 'series' || type === 'tv' ? 'tv' : 'movie';
        
        // 1. Find TMDB ID by IMDB ID
        const findUrl = `${TMDB_BASE_URL}/find/${imdbId}?api_key=${TMDB_API_KEY}&external_source=imdb_id`;
        const findRes = await axios.get(findUrl);
        const findData = findRes.data;
        const results = searchType === 'movie' ? findData.movie_results : findData.tv_results;
        
        if (!results || results.length === 0) return null;
        const tmdbId = results[0].id;

        // 2. Fetch credits
        const creditsUrl = `${TMDB_BASE_URL}/${searchType}/${tmdbId}/credits?api_key=${TMDB_API_KEY}`;
        const creditsRes = await axios.get(creditsUrl);
        const cast = creditsRes.data?.cast?.slice(0, 40).map((c: any) => ({
          id: c.id,
          name: c.name,
          character: c.character,
          image: c.profile_path ? `https://image.tmdb.org/t/p/w185${c.profile_path}` : undefined,
        }));

        return cast || [];
      } catch (error) {
        console.error('Error fetching TMDB credits:', error);
        return null;
      }
    },
    enabled: !!imdbId && (type === 'movie' || type === 'series' || type === 'tv'),
    staleTime: 60 * 60 * 1000, // 1 hour
  });
};

// Combined hook for both info and metadata
export const useContentDetails = (link: string, providerValue: string) => {
  // First, get the basic content info
  const {
    data: info,
    isLoading: infoLoading,
    error: infoError,
    refetch: refetchInfo,
  } = useContentInfo(link, providerValue);

  // Then, get enhanced metadata if imdbId is available
  const {
    data: meta,
    isLoading: metaLoading,
    error: metaError,
    refetch: refetchMeta,
  } = useEnhancedMetadata(info?.imdbId || '', info?.type || '');

  // Finally, get high-quality cast if imdbId is available
  const {
    data: tmdbCast,
    isLoading: tmdbLoading,
    refetch: refetchTmdb,
  } = useTmdbCredits(info?.imdbId || '', info?.type || '');

  return {
    info,
    meta: meta ? { ...meta, tmdbCast } : (tmdbCast ? { tmdbCast } : null),
    isLoading: infoLoading || metaLoading || tmdbLoading,
    error: infoError || metaError,
    refetch: async () => {
      await Promise.all([refetchInfo(), refetchMeta(), refetchTmdb()]);
    },
  };
};