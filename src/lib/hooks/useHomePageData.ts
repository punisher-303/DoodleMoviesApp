import { useQuery } from '@tanstack/react-query';
import { getHomePageData, HomePageData } from '../getHomepagedata';
import { Content } from '../zustand/contentStore';
import { cacheStorage } from '../storage';

interface UseHomePageDataOptions {
  provider: Content['provider'];
  enabled?: boolean;
}

export const useHomePageData = ({
  provider,
  enabled = true,
}: UseHomePageDataOptions) => {
  return useQuery<HomePageData[], Error>({
    queryKey: ['homePageData', provider.value],
    queryFn: async ({ signal }) => {
      // Fetch fresh data - cache is handled by React Query
      const data = await getHomePageData(provider, signal);
      return data;
    },
    enabled: enabled && !!provider?.value,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    retry: (failureCount, error) => {
      if (error.name === 'AbortError') {
        return false;
      }
      return failureCount < 3;
    },
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
    // Add initial data from cache for instant loading
    initialData: () => {
      const cache = cacheStorage.getString('homeData' + provider.value);
      if (cache) {
        try {
          return JSON.parse(cache);
        } catch {
          return undefined;
        }
      }
      return undefined;
    },
    // Cache successful responses
    meta: {
      onSuccess: (data: HomePageData[]) => {
        if (data && data.length > 0) {
          cacheStorage.setString(
            'homeData' + provider.value,
            JSON.stringify(data),
          );
        }
      },
    },
  });
};

// Memoized hero selection with stable reference
export const getRandomHeroPost = (
  homeData: HomePageData[],
  providerValue?: string,
) => {
  if (!homeData || homeData.length === 0) {
    return null;
  }

  // 1. Try to get cached hero for stability
  if (providerValue) {
    const cachedHero = cacheStorage.getString(`hero_selection_${providerValue}`);
    if (cachedHero) {
      try {
        return JSON.parse(cachedHero);
      } catch (e) {
        // failed to parse
      }
    }
  }

  // 2. Selection Logic: Filter out people-only categories
  // We prefer the first category (usually "Trending" or "Featured")
  // because the hero should be impactful.
  const validCategories = homeData.filter(cat => 
    cat.Posts && 
    cat.Posts.length > 0 && 
    cat.Posts.some(post => post.type !== 'person')
  );

  if (validCategories.length === 0) return null;

  // Pick the first valid category (usually the most important one)
  const heroCategory = validCategories[0];
  
  // Filter out any people in that category just in case
  const moviePosts = heroCategory.Posts.filter(post => post.type !== 'person');
  
  if (moviePosts.length === 0) return null;

  const randomIndex = Math.floor(Math.random() * Math.min(moviePosts.length, 5)); // Pick from top 5 for better quality
  const selectedHero = moviePosts[randomIndex];

  if (providerValue && selectedHero) {
    cacheStorage.setString(
      `hero_selection_${providerValue}`,
      JSON.stringify(selectedHero),
    );
  }

  return selectedHero;
};

export const clearHeroCache = (providerValue: string) => {
  cacheStorage.delete(`hero_selection_${providerValue}`);
};

// New hook for hero metadata with React Query
export const useHeroMetadata = (heroLink: string, providerValue: string) => {
  return useQuery({
    queryKey: ['heroMetadata', heroLink, providerValue],
    queryFn: async () => {
      const { providerManager } = await import('../services/ProviderManager');
      const { default: axios } = await import('axios');

      const info = await providerManager.getMetaData({
        link: heroLink,
        provider: providerValue,
      });

      // Try to get enhanced metadata from Stremio if imdbId is available
      if (info.imdbId) {
        try {
          const response = await axios.get(
            `https://v3-cinemeta.strem.io/meta/${info.type}/${info.imdbId}.json`,
            { timeout: 5000 },
          );
          return response.data?.meta || info;
        } catch {
          return info; // Fallback to original info if Stremio fails
        }
      }

      return info;
    },
    enabled: !!heroLink && !!providerValue,
    staleTime: 10 * 60 * 1000, // 10 minutes - hero metadata changes less frequently
    gcTime: 60 * 60 * 1000, // 1 hour
    retry: 2,
    // Cache hero metadata separately
    meta: {
      onSuccess: (data: any) => {
        cacheStorage.setString(heroLink, JSON.stringify(data));
      },
    },
    // Use cached data as initial data
    initialData: () => {
      const cached = cacheStorage.getString(heroLink);
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch {
          return undefined;
        }
      }
      return undefined;
    },
  });
};