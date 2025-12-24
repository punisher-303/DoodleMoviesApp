import {useQuery} from '@tanstack/react-query';
import {useState, useEffect} from 'react';
import {ToastAndroid} from 'react-native';
import {providerManager} from '../services/ProviderManager';
import {settingsStorage} from '../storage';
import {ifExists} from '../file/ifExists';
import {Stream} from '../providers/types';

interface UseStreamOptions {
  activeEpisode: any;
  routeParams: any;
  provider: string;
  enabled?: boolean;
}

// Timeout duration in milliseconds for stream fetching
const STREAM_FETCH_TIMEOUT = 10000; // 10 seconds

export const useStream = ({
  activeEpisode,
  routeParams,
  provider,
  enabled = true,
}: UseStreamOptions) => {
  const [selectedStream, setSelectedStream] = useState<Stream>({
    server: '',
    link: '',
    type: '',
  });
  const [externalSubs, setExternalSubs] = useState<any[]>([]);
  
  // State to manage automatic skipping attempts for the current selected stream
  const [skipAttemptCount, setSkipAttemptCount] = useState(0);

  const {
    data: streamData = [],
    isLoading,
    error,
    refetch,
  } = useQuery<Stream[], Error>({
    queryKey: ['stream', activeEpisode?.link, routeParams?.type, provider],
    queryFn: async ({signal}) => {
      if (!activeEpisode?.link) {
        return [];
      }

      console.log('Fetching stream for:', activeEpisode);

      // Handle direct URL (downloaded content)
      if (routeParams?.directUrl) {
        return [
          {server: 'Downloaded', link: routeParams.directUrl, type: 'mp4'},
        ];
      }

      // Check for local downloaded file
      if (routeParams?.primaryTitle && routeParams?.secondaryTitle) {
        const file = (
          routeParams.primaryTitle +
          routeParams.secondaryTitle +
          activeEpisode.title
        ).replaceAll(/[^a-zA-Z0-9]/g, '_');

        const exists = await ifExists(file);
        if (exists) {
          return [{server: 'downloaded', link: exists, type: 'mp4'}];
        }
      }

      // Fetch streams from provider with a timeout
      const fetchController = new AbortController();
      // Use the useQuery signal in case the query is cancelled
      signal.addEventListener('abort', () => fetchController.abort()); 

      const timeoutId = setTimeout(() => {
        fetchController.abort();
      }, STREAM_FETCH_TIMEOUT);

      try {
        const data = await providerManager.getStream({
          link: activeEpisode.link,
          type: routeParams?.type,
          signal: fetchController.signal,
          providerValue: routeParams?.providerValue || provider,
        });
        
        clearTimeout(timeoutId); // Clear timeout on successful fetch

        // Filter out excluded qualities
        const excludedQualities = settingsStorage.getExcludedQualities() || [];
        const filteredQualities = data?.filter(
          streamItem => !excludedQualities.includes(streamItem?.quality + 'p'),
        );

        const filteredData =
          filteredQualities?.length > 0 ? filteredQualities : data;

        if (!filteredData || filteredData.length === 0) {
          throw new Error('No streams available');
        }

        return filteredData;
      } catch (err: any) {
        clearTimeout(timeoutId);
        throw err;
      }
    },
    enabled: enabled && !!activeEpisode?.link,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    // We remove the automatic retry logic in favor of manual server switching/refetch
    // by the component when a stream fails/times out.
    retry: false, 
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  // 1. Auto-skip 'hubcloud' and initialize selected stream
  useEffect(() => {
    if (streamData && streamData.length > 0) {
      let initialStream = streamData[0];
      let streamIndex = 0;
      let skippedHubcloud = false;

      // Check for 'hubcloud' and skip if found
      while (
        initialStream &&
        initialStream.server?.toLowerCase() === 'hubcloud' &&
        streamIndex < streamData.length - 1
      ) {
        streamIndex++;
        initialStream = streamData[streamIndex];
        skippedHubcloud = true;
      }

      if (initialStream) {
        setSelectedStream(initialStream);
        setSkipAttemptCount(0); // Reset attempt count for new stream data
        
        if (skippedHubcloud) {
          ToastAndroid.show('Skipped hubcloud server', ToastAndroid.SHORT);
        }
      }

      // Extract external subtitles (existing logic)
      const subs: any[] = [];
      streamData.forEach(track => {
        if (track?.subtitles?.length && track.subtitles.length > 0) {
          subs.push(...track.subtitles);
        }
      });
      setExternalSubs(subs);
    }
  }, [streamData]);


  // Handle errors (existing logic)
  useEffect(() => {
    if (error) {
      console.error('Stream fetch error:', error);
      ToastAndroid.show('No stream found, try again later', ToastAndroid.SHORT);
    }
  }, [error]);

  // Helper function to switch to the next stream
  const switchToNextStream = (showToast = true): boolean => {
    if (streamData && streamData.length > 0) {
      const currentIndex = streamData.findIndex(
        (s) => s.link === selectedStream.link && s.server === selectedStream.server,
      );
      
      // We need to handle the hubcloud skip here too, just in case the streamData list has 
      // other 'hubcloud' entries further down.
      let nextIndex = currentIndex + 1;
      let nextStream = streamData[nextIndex];
      let skippedHubcloud = false;

      while (
        nextStream &&
        nextStream.server?.toLowerCase() === 'hubcloud' &&
        nextIndex < streamData.length - 1
      ) {
        nextIndex++;
        nextStream = streamData[nextIndex];
        skippedHubcloud = true;
      }

      if (nextStream) {
        setSelectedStream(nextStream);
        setSkipAttemptCount(0); // Reset attempt count for the new stream
        
        if (showToast) {
          ToastAndroid.show(
            'Video could not be played, Trying next server',
            ToastAndroid.SHORT,
          );
        }
        if (skippedHubcloud) {
          ToastAndroid.show('Skipped hubcloud server', ToastAndroid.SHORT);
        }

        return true;
      }
    }
    return false;
  };

  // 2. Auto-skip to next stream if selected stream link doesn't load within 10 seconds
  // This requires an external mechanism (like a video player's state/events) 
  // to call a function when the video fails to load, but we can simulate the 10-second skip
  // based on an external trigger for the *currently selected* stream.

  // NOTE: The request mentions "if any server not provide data within 10 second then auto skip ton next server".
  // The first part of the `queryFn` already handles the fetch timeout. 
  // This second part likely refers to the video player failing to load the *selected stream link* in time. 
  // Since we don't have the player's events here, I'll provide a hook's return value 
  // to be used by the component (e.g., the video player) to signal a timeout/failure.

  /**
   * Public function to be called when the selected stream fails to load 
   * (e.g., a 10-second timeout on the video player)
   * @returns true if there was a next stream to switch to, false otherwise.
   */
  const handleStreamLoadFailure = () => {
    // Only attempt to skip once per selected stream link/server
    if (skipAttemptCount === 0) {
      setSkipAttemptCount(1); // Mark as attempted
      console.log('Stream load failure detected, attempting to switch stream.');
      return switchToNextStream();
    }
    console.log('Already attempted to skip this stream, or no more streams.');
    return false;
  };


  return {
    streamData,
    selectedStream,
    setSelectedStream,
    externalSubs,
    setExternalSubs,
    isLoading,
    error,
    refetch,
    switchToNextStream: handleStreamLoadFailure, // Renamed to reflect its new use for external call
  };
};

// Hook for managing video tracks and settings (Unchanged)
export const useVideoSettings = () => {
  const [audioTracks, setAudioTracks] = useState<any[]>([]);
  const [textTracks, setTextTracks] = useState<any[]>([]);
  const [videoTracks, setVideoTracks] = useState<any[]>([]);

  const [selectedAudioTrackIndex, setSelectedAudioTrackIndex] = useState(0);
  const [selectedTextTrackIndex, setSelectedTextTrackIndex] = useState(1000);
  const [selectedQualityIndex, setSelectedQualityIndex] = useState(1000);

  const processAudioTracks = (tracks: any[]) => {
    const uniqueMap = new Map();
    const uniqueTracks = tracks.filter(track => {
      const key = `${track.type}-${track.title}-${track.language}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, true);
        return true;
      }
      return false;
    });
    setAudioTracks(uniqueTracks);
  };

  const processVideoTracks = (tracks: any[]) => {
    const uniqueMap = new Map();
    const uniqueTracks = tracks.filter(track => {
      const key = `${track.bitrate}-${track.height}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, true);
        return true;
      }
      return false;
    });
    setVideoTracks(uniqueTracks);
  };

  return {
    audioTracks,
    textTracks,
    videoTracks,
    selectedAudioTrackIndex,
    selectedTextTrackIndex,
    selectedQualityIndex,
    setAudioTracks,
    setTextTracks,
    setVideoTracks,
    setSelectedAudioTrackIndex,
    setSelectedTextTrackIndex,
    setSelectedQualityIndex,
    processAudioTracks,
    processVideoTracks,
  };
};