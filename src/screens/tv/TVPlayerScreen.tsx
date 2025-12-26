import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  Text,
  ToastAndroid,
  TouchableOpacity,
  View,
  StatusBar,
  TouchableNativeFeedback,
  Dimensions,
  StyleSheet,
  ActivityIndicator,
  PanResponder,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  Layout,
} from 'react-native-reanimated';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DoodleTVStackParamList } from '../../App';
import Video, {
  VideoRef,
  SelectedTrackType,
  ResizeMode,
  OnLoadData,
  OnProgressData,
  OnVideoErrorData,
} from 'react-native-video';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import FullScreenChz from 'react-native-fullscreen-chz';
import OrientationLocker from 'react-native-orientation-locker';
import useThemeStore from '../../lib/zustand/themeStore';

// --- Local Hooks ---

const useStream = (options: { activeEpisode: any; routeParams: any }) => {
  const { streamUrl } = options.routeParams;
  const [selectedStream, setSelectedStream] = useState({
    link: streamUrl,
    quality: 'auto',
  });
  const [streamData, setStreamData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (streamUrl) {
      setTimeout(() => {
        setIsLoading(false);
        setStreamData([{ link: streamUrl, quality: 'auto' }]);
      }, 500);
    } else {
      setIsLoading(false);
      setError('No stream URL provided');
    }
  }, [streamUrl]);
  const switchToNextStream = useCallback(() => {
    console.log('No next stream to switch to.');
    return false;
  }, []);
  return {
    streamData,
    selectedStream,
    setSelectedStream,
    externalSubs: [],
    setExternalSubs: () => { },
    isLoading,
    error,
    switchToNextStream,
  };
};

const useVideoSettings = () => {
  const [audioTracks, setAudioTracks] = useState([]);
  const [textTracks, setTextTracks] = useState([]);
  const [videoTracks, setVideoTracks] = useState([]);
  const [selectedAudioTrackIndex, setSelectedAudioTrackIndex] = useState(-1);
  const [selectedQualityIndex, setSelectedQualityIndex] = useState(-1);
  const [selectedTextTrack, setSelectedTextTrack] = useState<any>(null);

  const processAudioTracks = useCallback((tracks: any[]) => {
    setAudioTracks(tracks);
    if (tracks.length > 0) {
      setSelectedAudioTrackIndex(0);
    } else {
      setSelectedAudioTrackIndex(-1);
    }
  }, []);

  const processTextTracks = useCallback((tracks: any[]) => {
    setTextTracks(tracks);
    setSelectedTextTrack(null);
  }, []);

  const processVideoTracks = useCallback((tracks: any[]) => {
    setVideoTracks(tracks);
    setSelectedQualityIndex(-1);
  }, []);

  const handleSelectSubtitle = useCallback((index: number) => {
    if (index === -1) {
      setSelectedTextTrack(null);
    } else {
      setSelectedTextTrack({ type: 'index', value: index } as any);
    }
  }, []);

  const selectedAudioTrack = useMemo(() => {
    if (
      selectedAudioTrackIndex !== -1 &&
      audioTracks[selectedAudioTrackIndex]
    ) {
      return {
        type: 'index',
        value: selectedAudioTrackIndex,
      } as any;
    }
    return undefined;
  }, [selectedAudioTrackIndex, audioTracks]);

  const selectedVideoTrack = useMemo(() => {
    if (selectedQualityIndex !== -1 && videoTracks[selectedQualityIndex]) {
      return {
        type: 'index',
        value: selectedQualityIndex,
      } as any;
    }
    return { type: 'auto' } as any;
  }, [selectedQualityIndex, videoTracks]);

  return {
    audioTracks,
    textTracks,
    videoTracks,
    selectedAudioTrackIndex,
    selectedQualityIndex,
    setSelectedAudioTrackIndex,
    setSelectedQualityIndex,
    processAudioTracks,
    setTextTracks: processTextTracks,
    processVideoTracks,
    selectedAudioTrack,
    selectedTextTrack,
    selectedVideoTrack,
    handleSelectSubtitle,
  };
};

const usePlayerSettings = () => {
  const [showControls, setShowControls] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab] = useState('quality');
  const [resizeMode, setResizeMode] = useState<ResizeMode>(ResizeMode.CONTAIN);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [isPlayerLocked, setIsPlayerLocked] = useState(false);
  const [showUnlockButton, setShowUnlockButton] = useState(false);
  const unlockButtonTimerRef = useRef(null);
  const handleResizeMode = useCallback(() => {
    setResizeMode(prevMode => (prevMode === ResizeMode.CONTAIN ? ResizeMode.COVER : ResizeMode.CONTAIN));
  }, []);
  const togglePlayerLock = useCallback(() => {
    setIsPlayerLocked(prev => !prev);
    setShowUnlockButton(false);
    if (unlockButtonTimerRef.current) {
      clearTimeout(unlockButtonTimerRef.current);
    }
  }, []);
  const handleLockedScreenTap = useCallback(() => {
    if (isPlayerLocked) {
      setShowUnlockButton(true);
      if (unlockButtonTimerRef.current) {
        clearTimeout(unlockButtonTimerRef.current);
      }
      unlockButtonTimerRef.current = setTimeout(() => {
        setShowUnlockButton(false);
      }, 3000);
    }
  }, [isPlayerLocked]);
  return {
    showControls,
    setShowControls,
    showSettings,
    setShowSettings,
    activeTab,
    setActiveTab,
    resizeMode,
    playbackRate,
    setPlaybackRate,
    isPlayerLocked,
    showUnlockButton,
    handleResizeMode,
    togglePlayerLock,
    handleLockedScreenTap,
    unlockButtonTimerRef,
  };
};

const usePlayerProgress = (options: {
  activeEpisode: any;
  routeParams: any;
  playbackRate: number;
}) => {
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPaused, setIsPaused] = useState(true);
  const videoPositionRef = useRef(0);
  const handleProgress = useCallback((data: OnProgressData) => {
    videoPositionRef.current = data.currentTime;
    setCurrentTime(data.currentTime);
  }, []);
  const handleLoad = useCallback((data: OnLoadData) => {
    setDuration(data.duration);
    setIsPaused(false);
  }, []);
  return {
    videoPositionRef,
    handleProgress,
    handleLoad,
    currentTime,
    duration,
    isPaused,
    setIsPaused,
  };
};

const usePlayerGestures = ({
  playerRef,
  currentTime,
  duration,
  setIsPaused,
  setShowControls,
}: any) => {
  const { width, height } = Dimensions.get('window');
  const [volume, setVolume] = useState(0.5);
  const [brightness, setBrightness] = useState(0.5);
  const [showVolumeIndicator, setShowVolumeIndicator] = useState(false);
  const [showBrightnessIndicator, setShowBrightnessIndicator] = useState(false);
  const [showSeekIndicator, setShowSeekIndicator] = useState(false);
  const [seekTime, setSeekTime] = useState(0);
  const volumeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const brightnessTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const seekTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleSeek = useCallback(
    (time: number) => {
      if (playerRef.current) {
        const newTime = Math.max(0, Math.min(duration, currentTime + time));
        playerRef.current.seek(newTime);
        setSeekTime(newTime);
        setShowSeekIndicator(true);
        if (seekTimeoutRef.current) {
          clearTimeout(seekTimeoutRef.current);
        }
        seekTimeoutRef.current = setTimeout(() => {
          setShowSeekIndicator(false);
        }, 1000);
      }
    },
    [playerRef, currentTime, duration],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderMove: (evt, gestureState) => {
          const { dx, dy, x0 } = gestureState;

          // Horizontal swipe for seeking
          if (Math.abs(dx) > Math.abs(dy) * 2 && Math.abs(dx) > 10) {
            const seekDelta = dx > 0 ? 10 : -10;
            handleSeek(seekDelta);
            setShowControls(false);
            gestureState.dx = 0;
          }
          // Vertical swipe for volume/brightness
          else if (Math.abs(dy) > Math.abs(dx) * 2 && Math.abs(dy) > 5) {
            // Right for volume
            if (x0 > width / 2) {
              const newVolume = Math.max(0, Math.min(1, volume - dy / height));
              setVolume(newVolume);
              setShowVolumeIndicator(true);
              if (volumeTimeoutRef.current) {
                clearTimeout(volumeTimeoutRef.current);
              }
              volumeTimeoutRef.current = setTimeout(() => {
                setShowVolumeIndicator(false);
              }, 1000);
            }
            // Left for brightness
            else {
              const newBrightness = Math.max(
                0,
                Math.min(1, brightness - dy / height),
              );
              setBrightness(newBrightness);
              setShowBrightnessIndicator(true);
              if (brightnessTimeoutRef.current) {
                clearTimeout(brightnessTimeoutRef.current);
              }
              brightnessTimeoutRef.current = setTimeout(() => {
                setShowBrightnessIndicator(false);
              }, 1000);
            }
            setShowControls(false);
          }
        },
        onPanResponderRelease: () => {
          setTimeout(() => setShowControls(true), 1500);
        },
        onPanResponderGrant: () => {
          setIsPaused(false);
        },
      }),
    [volume, brightness, width, height, playerRef, currentTime, duration],
  );

  return {
    panResponder,
    volume,
    brightness,
    showVolumeIndicator,
    showBrightnessIndicator,
    showSeekIndicator,
    seekTime,
    handleSeek,
  };
};

type TVPlayerScreenProps = NativeStackScreenProps<
  DoodleTVStackParamList,
  'TVPlayerScreen'
>;

const TVPlayerScreen: React.FC<TVPlayerScreenProps> = ({ route }) => {
  const { primary } = useThemeStore(state => state);
  const { streamUrl } = route.params;

  const navigation = useNavigation();
  const playerRef: React.RefObject<VideoRef> = useRef(null);

  const loadingOpacity = useSharedValue(0);
  const loadingScale = useSharedValue(0.8);
  const loadingRotation = useSharedValue(0);
  const controlsOpacity = useSharedValue(0);
  const settingsTranslateY = useSharedValue(Dimensions.get('window').height);
  const settingsOpacity = useSharedValue(0);
  const lockButtonOpacity = useSharedValue(0);
  const lockButtonTranslateX = useSharedValue(150);

  const loadingContainerStyle = useAnimatedStyle(() => ({
    opacity: loadingOpacity.value,
    transform: [{ scale: loadingScale.value }],
  }));

  const loadingIconStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${loadingRotation.value}deg` }],
  }));

  const controlsStyle = useAnimatedStyle(() => ({
    opacity: controlsOpacity.value,
  }));

  const lockButtonStyle = useAnimatedStyle(() => ({
    opacity: lockButtonOpacity.value,
    transform: [{ translateX: lockButtonTranslateX.value }],
  }));

  const [activeEpisode] = useState({ link: streamUrl });
  const {
    selectedStream,
    isLoading: streamLoading,
    error: streamError,
    switchToNextStream,
  } = useStream({
    activeEpisode: activeEpisode,
    routeParams: route.params,
  });

  const {
    audioTracks,
    textTracks,
    videoTracks,
    selectedAudioTrackIndex,
    selectedQualityIndex,
    processAudioTracks,
    setTextTracks,
    processVideoTracks,
    selectedAudioTrack,
    selectedTextTrack,
    selectedVideoTrack,
  } = useVideoSettings();

  const {
    showControls,
    setShowControls,
    showSettings,
    setShowSettings,
    resizeMode,
    playbackRate,
    isPlayerLocked,
    showUnlockButton,
    togglePlayerLock,
    handleLockedScreenTap,
  } = usePlayerSettings();

  const {
    handleProgress,
    handleLoad,
    currentTime,
    duration,
    isPaused,
    setIsPaused,
  } = usePlayerProgress({
    activeEpisode,
    routeParams: route.params,
    playbackRate,
  });

  const {
    panResponder,
    volume,
    brightness,
    showVolumeIndicator,
    showBrightnessIndicator,
    showSeekIndicator,
    seekTime,
    handleSeek,
  } = usePlayerGestures({
    playerRef,
    currentTime,
    duration,
    setIsPaused,
    setShowControls,
  });

  const formatTime = (timeInSeconds: number) => {
    const totalMinutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = Math.floor(totalMinutes % 60);

    const pad = (num: number) => (num < 10 ? '0' + num : num);

    if (hours > 0) {
      return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    }
    return `${pad(minutes)}:${pad(seconds)}`;
  };

  const handleRewind = useCallback(() => {
    handleSeek(-10);
  }, [handleSeek]);

  const handleForward = useCallback(() => {
    handleSeek(10);
  }, [handleSeek]);

  const handlePlayPause = useCallback(() => {
    setIsPaused(prev => !prev);
  }, [setIsPaused]);

  const handleVideoError = useCallback(
    (e: OnVideoErrorData) => {
      console.log('PlayerError', e);

      if (
        e.error?.errorString ===
        'ExoPlaybackException: ERROR_CODE_BEHIND_LIVE_WINDOW' ||
        e.error?.errorCode === '21002'
      ) {
        ToastAndroid.show(
          'Lost connection to live stream. Reconnecting...',
          ToastAndroid.SHORT,
        );
        setTimeout(() => {
          playerRef.current?.seek(duration);
        }, 100);
        return;
      }

      const hasNext = switchToNextStream();
      if (!hasNext) {
        ToastAndroid.show(
          'Video could not be played, try again later',
          ToastAndroid.SHORT,
        );
        navigation.goBack();
      }
      setShowControls(true);
    },
    [switchToNextStream, navigation, setShowControls, duration, playerRef],
  );

  useEffect(() => {
    FullScreenChz.enable();

    if (OrientationLocker && OrientationLocker.lockToLandscape) {
      OrientationLocker.lockToLandscape();
    }

    const unsubscribe = navigation.addListener('beforeRemove', () => {
      FullScreenChz.disable();
      if (OrientationLocker && OrientationLocker.lockToPortrait) {
        OrientationLocker.lockToPortrait();
      }
    });
    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    if (streamLoading) {
      loadingOpacity.value = withTiming(1, { duration: 800 });
      loadingScale.value = withTiming(1, { duration: 800 });
      loadingRotation.value = withRepeat(
        withSequence(
          withDelay(500, withTiming(180, { duration: 900 })),
          withTiming(180, { duration: 600 }),
          withTiming(360, { duration: 900 }),
          withTiming(360, { duration: 600 }),
        ),
        -1,
      );
    } else {
      loadingOpacity.value = withTiming(0, { duration: 250 });
      loadingScale.value = withTiming(0.8, { duration: 250 });
    }
  }, [streamLoading, loadingOpacity, loadingScale, loadingRotation]);

  useEffect(() => {
    const shouldShowLock = isPlayerLocked && showUnlockButton;
    lockButtonTranslateX.value = withTiming(shouldShowLock ? 0 : 150, {
      duration: 250,
    });
    lockButtonOpacity.value = withTiming(shouldShowLock ? 1 : 0, {
      duration: 250,
    });
    controlsOpacity.value = withTiming(
      showControls && !isPlayerLocked && !showSettings ? 1 : 0,
      { duration: 250 },
    );
  }, [
    isPlayerLocked,
    showUnlockButton,
    showControls,
    showSettings,
    lockButtonOpacity,
    lockButtonTranslateX,
    controlsOpacity,
  ]);

  const handleVideoLoad = useCallback(
    (data: OnLoadData) => {
      handleLoad(data);
      if (data.audioTracks.length > 0) processAudioTracks(data.audioTracks);
      if (data.textTracks.length > 0) setTextTracks(data.textTracks);
      if (data.videoTracks.length > 0) processVideoTracks(data.videoTracks);
    },
    [processAudioTracks, setTextTracks, processVideoTracks, handleLoad],
  );

  if (streamError) {
    return (
      <View style={styles.container}>
        <Text style={styles.messageText}>{streamError}</Text>
      </View>
    );
  }

  if (streamLoading || !selectedStream) {
    return (
      <View style={styles.container}>
        <Animated.View style={[styles.loadingContainer, loadingContainerStyle]}>
          <Animated.View style={loadingIconStyle}>
            <ActivityIndicator size="large" color={primary} />
          </Animated.View>
        </Animated.View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar hidden />

      <View style={styles.videoWrapper}>
        <Video
          ref={playerRef}
          source={{ uri: selectedStream?.link }}
          style={styles.backgroundVideo}
          controls={false}
          paused={isPaused}
          onLoad={handleVideoLoad}
          onProgress={handleProgress}
          onError={handleVideoError}
          resizeMode={resizeMode}
          rate={playbackRate}
          selectedTextTrack={selectedTextTrack}
          selectedAudioTrack={selectedAudioTrack}
          selectedVideoTrack={selectedVideoTrack}
        />
        <TouchableNativeFeedback
          onPress={
            isPlayerLocked
              ? handleLockedScreenTap
              : () => setShowControls(!showControls)
          }>
          <View style={styles.gestureOverlay} {...panResponder.panHandlers}>
            {showVolumeIndicator && (
              <View style={styles.centerIndicator}>
                <Ionicons
                  name={volume === 0 ? 'volume-mute' : 'volume-high'}
                  size={40}
                  color="white"
                />
                <View style={styles.volumeBar}>
                  <View
                    style={[styles.volumeFill, { height: `${volume * 100}%` }]}
                  />
                </View>
              </View>
            )}

            {showBrightnessIndicator && (
              <View style={styles.centerIndicator}>
                <Ionicons name="sunny" size={40} color="white" />
                <View style={styles.volumeBar}>
                  <View
                    style={[
                      styles.volumeFill,
                      {
                        height: `${brightness * 100}%`,
                        backgroundColor: 'white',
                      },
                    ]}
                  />
                </View>
              </View>
            )}

            {showSeekIndicator && (
              <View style={styles.seekIndicatorContainer}>
                <Ionicons
                  name={seekTime > currentTime ? 'play-forward' : 'play-back'}
                  size={40}
                  color="white"
                />
                <Text style={styles.seekIndicatorText}>
                  {formatTime(seekTime)}
                </Text>
              </View>
            )}

            <Animated.View
              style={[styles.controlsOverlay, controlsStyle]}
              layout={Layout}>
              <View style={styles.controlsHeader}>
                <TouchableOpacity
                  onPress={() => navigation.goBack()}
                  style={styles.headerButton}>
                  <Ionicons
                    name="chevron-back-outline"
                    size={30}
                    color="white"
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={togglePlayerLock}
                  style={[styles.headerButton, styles.lockButton]}>
                  <Ionicons
                    name={
                      isPlayerLocked
                        ? 'lock-closed-outline'
                        : 'lock-open-outline'
                    }
                    size={24}
                    color="white"
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.middleControls}>
                <TouchableOpacity
                  onPress={handleRewind}
                  style={styles.middleButton}>
                  <Ionicons
                    name="refresh-circle-outline"
                    size={50}
                    color="white"
                    style={styles.rotateLeft}
                  />
                  <Text style={styles.middleButtonText}>10</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handlePlayPause}
                  style={styles.middleButton}>
                  <Ionicons
                    name={
                      isPaused ? 'play-circle-outline' : 'pause-circle-outline'
                    }
                    size={80}
                    color="white"
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleForward}
                  style={styles.middleButton}>
                  <Ionicons
                    name="refresh-circle-outline"
                    size={50}
                    color="white"
                    style={styles.rotateRight}
                  />
                  <Text style={styles.middleButtonText}>10</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.bottomControls}>
                <Text style={styles.timeText}>
                  {formatTime(currentTime)} / {formatTime(duration)}
                </Text>
              </View>
            </Animated.View>

            <Animated.View
              style={[styles.lockButtonContainer, lockButtonStyle]}>
              <TouchableOpacity
                onPress={togglePlayerLock}
                style={styles.floatingLockButton}>
                <Ionicons name="lock-closed" size={24} color="black" />
              </TouchableOpacity>
            </Animated.View>
          </View>
        </TouchableNativeFeedback>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  videoWrapper: {
    flex: 1,
    backgroundColor: 'black',
  },
  backgroundVideo: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
  },
  gestureOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
    justifyContent: 'space-between',
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  controlsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerButton: {
    padding: 10,
  },
  lockButton: {
    alignSelf: 'flex-end',
  },
  middleControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 40,
  },
  middleButton: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  middleButtonText: {
    color: 'white',
    fontSize: 12,
    marginTop: -15,
    fontWeight: 'bold',
  },
  rotateLeft: {
    transform: [{ rotateY: '180deg' }],
  },
  rotateRight: {},
  bottomControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageText: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
  },
  centerIndicator: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 20,
    borderRadius: 15,
  },
  volumeBar: {
    width: 6,
    height: 100,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 3,
    marginTop: 10,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  volumeFill: {
    width: '100%',
    backgroundColor: 'white',
  },
  seekIndicatorContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 20,
    borderRadius: 15,
  },
  seekIndicatorText: {
    color: 'white',
    fontSize: 16,
    marginTop: 10,
    fontWeight: 'bold',
  },
  lockButtonContainer: {
    position: 'absolute',
    right: 50,
    top: '40%',
  },
  floatingLockButton: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 50,
  },
});

export default TVPlayerScreen;