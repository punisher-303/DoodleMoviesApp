const BASE_URL = 'https://jiosaavn-api-privatecvc2.vercel.app';

async function fetchSaavnData(endpoint: string, params: Record<string, any> = {}) {
  try {
    const queryString = new URLSearchParams(params).toString();
    const url = `${BASE_URL}${endpoint}?${queryString}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`API call failed with status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`Error fetching data from Jiosaavn API at ${endpoint}:`, error);
    throw error;
  }
}

export const searchSaavn = async (query: string) => {
  return fetchSaavnData('/search', { query });
};

export const getHomePageData = async () => {
  return fetchSaavnData('/modules');
};

export const getSongDetails = async (songId: string) => {
  return fetchSaavnData('/song', { id: songId });
};

export const getAlbumDetails = async (albumId: string) => {
  return fetchSaavnData('/album', { id: albumId });
};

export const getPlaylistDetails = async (playlistId: string) => {
  return fetchSaavnData('/playlist', { id: playlistId });
};

export const getArtistDetails = async (artistId: string) => {
  return fetchSaavnData('/artist', { id: artistId });
};

export const getTrendingSongs = async () => {
  return fetchSaavnData('/modules?language=english');
};

export const getQuickPicks = async () => {
  return fetchSaavnData('/modules?language=english');
};

export const getSearchHints = async (query: string) => {
  return fetchSaavnData('/search/suggestions', { query });
};
