import { useQuery } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { ToastAndroid } from 'react-native';
import { providerManager } from '../services/ProviderManager';
import { settingsStorage } from '../storage';
import { ifExists } from '../file/ifExists';
import { Stream } from '../providers/types';
import { TextTracks, TextTrackType } from '../../types/video';

// Ultra-Stable Tracker List (Feb 2026) - Appended to magnets for faster peer discovery
const TOP_TRACKERS = [
  'udp://tracker.opentrackr.org:1337/announce',
  'udp://open.tracker.cl:1337/announce',
  'udp://open.stealth.si:80/announce',
  'udp://tracker.torrent.eu.org:451/announce',
  'udp://tracker.moeking.me:6969/announce',
  'udp://exodus.desync.com:6969/announce',
  'udp://tracker.tiny-vps.com:6969/announce',
  'udp://tracker.openbittorrent.com:6969/announce',
  'udp://p4p.arenabg.com:1337/announce',
  'udp://tracker.cyberia.is:6969/announce',
  'udp://explodie.org:6969/announce',
  'udp://tracker.dler.org:6969/announce',
  'udp://opentracker.i2p.rocks:6969/announce',
  'udp://bt.oiia.moe:6969/announce',
  'udp://tracker1.bt.moack.co.kr:80/announce',
  'udp://tracker.bitsearch.to:1337/announce',
  'http://tracker.openbittorrent.com:80/announce',
  'http://tracker.opentrackr.org:1337/announce',
];

const boostMagnet = (magnet: string): string => {
  if (!magnet || !magnet.startsWith('magnet:?')) return magnet;
  let boosted = magnet;
  TOP_TRACKERS.forEach(tr => {
    if (!magnet.includes(encodeURIComponent(tr))) {
      boosted += `&tr=${encodeURIComponent(tr)}`;
    }
  });
  return boosted;
};

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
  const [isResolving, setIsResolving] = useState(false);
  const [externalSubs, setExternalSubs] = useState<TextTracks>([]);

  // State to manage automatic skipping attempts for the current selected stream
  const [skipAttemptCount, setSkipAttemptCount] = useState(0);

  const {
    data: streamData = [],
    isLoading,
    error,
    refetch,
  } = useQuery<Stream[], Error>({
    queryKey: ['stream', activeEpisode?.link, routeParams?.type, provider],
    queryFn: async ({ signal }) => {
      if (!activeEpisode?.link) {
        return [];
      }

      console.log('Fetching stream for:', activeEpisode);

      // Handle direct URL (downloaded content)
      if (routeParams?.directUrl) {
        return [
          { server: 'Downloaded', link: routeParams.directUrl, type: 'mp4' },
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
          return [{ server: 'downloaded', link: exists, type: 'mp4' }];
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

        // Return streams directly (Magnets will be handled by Downloader)
        return filteredData.map(stream => {
          if (stream.link.startsWith('magnet:')) {
            return {
              ...stream,
              link: boostMagnet(stream.link),
            };
          }
          return stream;
        });
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
        setSkipAttemptCount(0);

        if (skippedHubcloud) {
          ToastAndroid.show('Skipped hubcloud server', ToastAndroid.SHORT);
        }
      }
    }
  }, [streamData]);


  // Pre-resolution logic REMOVED (using magnets directly for external download)


  // Debrid resolution logic REMOVED

  // Extract external subtitles (existing logic)
  useEffect(() => {
    if (streamData && streamData.length > 0) {
      const subs: TextTracks = [];
      streamData.forEach(track => {
        if (track?.subtitles?.length && track.subtitles.length > 0) {
          // Map to internal TextTrack format if needed, but for now assuming compatible
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

  // Bridge Selection State (for rotating through public bridges if one fails)
  const [bridgeIndex, setBridgeIndex] = useState(0);

  // Helper function to switch to the next stream
  const switchToNextStream = (showToast = true): boolean => {

    // 2. Standard Stream Skipping (If all bridges failed or not a bridge stream)
    if (streamData && streamData.length > 0) {
      const currentIndex = streamData.findIndex(
        (s) => s.link === selectedStream.link || s.originalMagnet === (selectedStream as any).originalMagnet,
      );

      let nextIndex = currentIndex + 1;
      let nextStream = streamData[nextIndex];
      let skippedHubcloud = false;

      // Skip dead servers like hubcloud
      while (
        nextStream &&
        (nextStream.server?.toLowerCase() === 'hubcloud' || nextStream.server?.toLowerCase() === 'null') &&
        nextIndex < streamData.length - 1
      ) {
        nextIndex++;
        nextStream = streamData[nextIndex];
        skippedHubcloud = true;
      }

      if (nextStream) {
        setBridgeIndex(0); // Reset bridge index for new torrent source
        setSelectedStream(nextStream);
        setSkipAttemptCount(0); 

        if (showToast) {
          ToastAndroid.show('Trying next available server...', ToastAndroid.SHORT);
          if (skippedHubcloud) ToastAndroid.show('Skipped offline server', ToastAndroid.SHORT);
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
    // We increase skipAttemptCount but allow multiple attempts if multi-bridge is working
    console.log('Stream load failure detected, attempting bridge rotation or stream switch.');
    return switchToNextStream();
  };


  return {
    streamData,
    selectedStream,
    setSelectedStream,
    externalSubs,
    setExternalSubs,
    isLoading: isLoading || isResolving,
    isResolving,
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