import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
    View,
    TouchableOpacity,
    PermissionsAndroid,
    Platform,
    StyleSheet,
    Dimensions,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
    withDelay,
    runOnJS,
    cancelAnimation,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';

interface VoiceChatControlProps {
    channelId: string;
    uid: number;
    isLeader: boolean;
    style?: any; // To accept parent opacity/visibility styles
}

const VoiceChatControl = ({ channelId, style }: VoiceChatControlProps) => {
    const webViewRef = useRef<WebView>(null);
    const [joined, setJoined] = useState(false);
    const [isMuted, setIsMuted] = useState(true);
    const [hasPermission, setHasPermission] = useState(false);

    // --- ANIMATION STATE ---
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const contextX = useSharedValue(0);
    const contextY = useSharedValue(0);
    const localOpacity = useSharedValue(1); // Internal opacity (dims when idle)

    // --- IDLE TIMER LOGIC ---
    const resetIdleTimer = useCallback(() => {
        'worklet';
        cancelAnimation(localOpacity);
        localOpacity.value = withTiming(1, { duration: 200 }); // Wake up
        // Auto-dim after 3000ms
        localOpacity.value = withDelay(3000, withTiming(0.3, { duration: 500 }));
    }, []);

    const { width: screenW, height: screenH } = Dimensions.get('window');
    const BUTTON_SIZE = 56;
    const PEEK_OFFSET = 28; // How much it hides (50%)
    const INITIAL_RIGHT = 80;
    const INITIAL_TOP = 50;

    // Initial Absolute X (relative to left 0)
    // defined by: right: 80 means x = screenW - 80 - BUTTON_SIZE
    const initialAbsX = screenW - INITIAL_RIGHT - BUTTON_SIZE;

    const pan = Gesture.Pan()
        .onStart(() => {
            contextX.value = translateX.value;
            contextY.value = translateY.value;
            resetIdleTimer();
        })
        .onUpdate((event) => {
            translateX.value = contextX.value + event.translationX;
            translateY.value = contextY.value + event.translationY;
            resetIdleTimer();
        })
        .onEnd(() => {
            const currentAbsX = initialAbsX + translateX.value;
            const threshold = 50; // Distance to edge to trigger magnet

            // Left Edge Snap
            if (currentAbsX < threshold) {
                const targetTranslateX = -initialAbsX - (BUTTON_SIZE - PEEK_OFFSET); // Snap to left edge + peek
                translateX.value = withSpring(targetTranslateX, { damping: 15 });
            }
            // Right Edge Snap
            else if (currentAbsX > screenW - BUTTON_SIZE - threshold) {
                const targetTranslateX = (screenW - initialAbsX - BUTTON_SIZE) + (BUTTON_SIZE - PEEK_OFFSET); // Snap to right edge + peek
                translateX.value = withSpring(targetTranslateX, { damping: 15 });
            }

            resetIdleTimer();
        });

    // Tap gesture to just wake it up without dragging
    const tap = Gesture.Tap()
        .onStart(() => {
            resetIdleTimer();
        });

    const composed = Gesture.Simultaneous(pan, tap);

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [
                { translateX: translateX.value },
                { translateY: translateY.value },
            ],
            opacity: localOpacity.value,
        };
    });

    // --- RE-TRIGGER IDLE TIMER ON MOUNT ---
    useEffect(() => {
        // Start fading out after initial mount
        localOpacity.value = withDelay(3000, withTiming(0.3, { duration: 500 }));
    }, []);

    // Unique Room Name logic
    const roomName = `doodlemovies_v1_${channelId.replace(/[^a-zA-Z0-9]/g, '')}`;

    // Jitsi Config: Start Audio Only, Start Muted
    const jitsiUrl = `https://meet.jit.si/${roomName}#config.startAudioOnly=true&config.startWithAudioMuted=true&config.disableDeepLinking=true&interfaceConfig.TOOLBAR_BUTTONS=['microphone']`;

    useEffect(() => {
        let isMounted = true;
        const checkPerms = async () => {
            if (Platform.OS === 'android') {
                try {
                    const granted = await PermissionsAndroid.request(
                        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
                        {
                            title: "Voice Chat Permission",
                            message: "Doodle needs access to your microphone for watch party voice chat.",
                            buttonNeutral: "Ask Me Later",
                            buttonNegative: "Cancel",
                            buttonPositive: "OK"
                        }
                    );
                    if (isMounted) {
                        setHasPermission(granted === PermissionsAndroid.RESULTS.GRANTED);
                    }
                } catch (err) {
                    console.warn(err);
                }
            } else {
                if (isMounted) setHasPermission(true);
            }
        };
        checkPerms();
        return () => { isMounted = false; };
    }, []);

    const toggleMute = () => {
        // Wake up UI
        cancelAnimation(localOpacity);
        localOpacity.value = 1;
        localOpacity.value = withDelay(3000, withTiming(0.3));

        if (!webViewRef.current) return;
        const newMuteState = !isMuted;
        // Inject Jitsi Command
        const script = `try { APP.conference.toggleAudioMuted(); } catch(e) { console.log(e); }`;
        webViewRef.current.injectJavaScript(script);
        setIsMuted(newMuteState);
    };

    if (!hasPermission) return null;

    return (
        <GestureDetector gesture={composed}>
            <Animated.View
                style={[
                    styles.floatingContainer,
                    style, // External styles (e.g. visibility from Player)
                    animatedStyle, // Draggable + Dimming
                ]}
            >
                <TouchableOpacity
                    onPress={toggleMute}
                    activeOpacity={0.8}
                    className="bg-black/80 rounded-full flex-row items-center justify-center elevation-5 shadow-lg"
                    style={{ borderColor: isMuted ? '#EF4444' : '#22C55E', borderWidth: 2, width: 56, height: 56 }}
                >
                    <MaterialCommunityIcons
                        name={isMuted ? 'microphone-off' : 'microphone'}
                        size={28}
                        color={isMuted ? '#EF4444' : '#22C55E'}
                    />
                </TouchableOpacity>

                {/* Hidden WebView Logic */}
                <View style={{ height: 0, width: 0, opacity: 0, overflow: 'hidden' }}>
                    <WebView
                        ref={webViewRef}
                        source={{ uri: jitsiUrl }}
                        userAgent="Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.181 Mobile Safari/537.36"
                        mediaPlaybackRequiresUserAction={false}
                        allowsInlineMediaPlayback={true}
                        javaScriptEnabled={true}
                        domStorageEnabled={true}
                        onLoadEnd={() => setJoined(true)}
                        originWhitelist={['*']}
                    />
                </View>
            </Animated.View>
        </GestureDetector>
    );
};

const styles = StyleSheet.create({
    floatingContainer: {
        position: 'absolute',
        top: 50,
        right: 80,
        zIndex: 9999, // Ensure it's on top of controls
    },
});

export default VoiceChatControl;
