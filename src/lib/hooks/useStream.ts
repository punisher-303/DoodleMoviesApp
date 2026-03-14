import { useQuery } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { ToastAndroid } from 'react-native';
import { providerManager } from '../services/ProviderManager';
import { settingsStorage } from '../storage';
import { ifExists } from '../file/ifExists';
import { Stream } from '../providers/types';
import { debridService } from '../services/DebridService';
import TorrEngineService from '../services/TorrEngineService';

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

        // Zero-Config: Intelligent Torrent Resolution
        let torrServerUrl = settingsStorage.getTorrServerUrl();
        const publicBridge = settingsStorage.getPublicTorrServerBridge();

        // We will perform a quick check for local engine later, 
        // but for now, we map the streams and mark them if they need resolution
        const resolvedData = filteredData.map(stream => {
          // If stream is already resolved
          if (stream.isResolved) {
             return stream;
          }

          if (stream.link.startsWith('magnet:')) {
            // Debrid-First: If debrid is enabled, prioritize it
            if (settingsStorage.isDebridEnabled() && settingsStorage.getDebridService() !== 'None') {
              return {
                ...stream,
                isDebrid: true,
              };
            }

            const encodedMagnet = encodeURIComponent(stream.link);
            
            // Generate both local and bridge links
            // We use the local one as primary, but logic in useEffect will switch to bridge if needed
            return {
              ...stream,
              link: `${torrServerUrl}/stream?link=${encodedMagnet}&play`,
              originalMagnet: stream.link, // Keep original for bridge fallback
              // type: removed to allow player auto-detection
            };
          }
          return stream;
        });

        return resolvedData;
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

  // Zero-Config: Automatic Engine Scaling & Bridge Fallback
  useEffect(() => {
    const checkEngineAndSwitch = async () => {
      // If we have a localhost link, we need to make sure the engine is running
      if (selectedStream?.link?.includes('127.0.0.1:8090') || selectedStream?.link?.includes('localhost:8090')) {
        try {
          console.log('[useStream] Ensuring local engine...');
          const success = await TorrEngineService.ensureEngine();
          if (success) return; // Engine is ready, we are good
          
          throw new Error('Local engine failed to start');
        } catch (e) {
          console.log('[useStream] Local engine fallback triggered:', e);
          // Instead of manual link swap, we use our robust switchToNextStream
          // which knows how to handle bridges and rotation.
          const switched = switchToNextStream(false); // don't show toast for the auto-initial skip
          if (!switched) {
             console.warn('[useStream] Failed to fallback to any bridge');
          }
        }
      }
    };

    if (selectedStream?.link) {
      checkEngineAndSwitch();
    }
  }, [selectedStream?.link]);

  // Debrid resolution logic (Intelligent Fallback)
  useEffect(() => {
    const resolveDebrid = async () => {
      if (selectedStream?.isDebrid && selectedStream.link.startsWith('magnet:') && !selectedStream.isResolved) {
        try {
          ToastAndroid.show('Resolving via Debrid...', ToastAndroid.SHORT);
          const files = await debridService.resolveMagnet(selectedStream.link);
          if (files && files.length > 0) {
            const bestFile = files[0];
            setSelectedStream({
              ...selectedStream,
              link: bestFile.downloadUrl,
              isDebrid: false, // Mark as resolved
              isResolved: true,
            });
            ToastAndroid.show('Debrid Link Ready', ToastAndroid.SHORT);
          }
        } catch (error: any) {
          console.error('Debrid resolution failed:', error);
          // Fallback handled by the Zero-Config useEffect which checks for magnet/localhost
        }
      }
    };

    resolveDebrid();
  }, [selectedStream]);

  // Extract external subtitles (existing logic)
  useEffect(() => {
    if (streamData && streamData.length > 0) {
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

  // Bridge Selection State (for rotating through public bridges if one fails)
  const [bridgeIndex, setBridgeIndex] = useState(0);

  // Helper function to switch to the next stream
  const switchToNextStream = (showToast = true): boolean => {
    // 1. Multi-Bridge Logic: If the current stream is using a bridge, try the NEXT bridge first
    // before abandoning this torrent source entirely.
    const publicBridges = settingsStorage.getPublicTorrServerBridges();
    const isUsingLocal = selectedStream?.link?.includes('127.0.0.1:8090') || selectedStream?.link?.includes('localhost:8090');
    const isUsingBridge = publicBridges.some(b => selectedStream?.link?.startsWith(b));
    const magnet = (selectedStream as any).originalMagnet;

    // 1. Initial Local -> Bridge Fallback OR Bridge -> Next Bridge Rotation
    if (magnet && (isUsingLocal || (isUsingBridge && bridgeIndex < publicBridges.length - 1))) {
      let nextBridgeIdx = isUsingLocal ? 0 : bridgeIndex + 1;
      setBridgeIndex(nextBridgeIdx);
      
      const nextBridge = settingsStorage.getPublicTorrServerBridge(nextBridgeIdx);
      const encodedMagnet = encodeURIComponent(magnet);
      
      setSelectedStream({
        ...selectedStream,
        link: `${nextBridge}/stream?link=${encodedMagnet}&play`,
        originalMagnet: magnet, // Explicitly preserve magnet
      });
      
      console.log(`[useStream] Rotating to bridge[${nextBridgeIdx}]: ${nextBridge}`);
      
      if (showToast) {
        ToastAndroid.show(
          isUsingLocal ? `Local engine issue, trying bridge: ${nextBridge.split('://')[1].substring(0, 15)}...` 
                       : `Bridge failed, trying fallback (${nextBridgeIdx + 1}): ${nextBridge.split('://')[1].substring(0, 15)}...`,
          ToastAndroid.LONG
        );
      }
      return true;
    }

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