import React, { useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    PermissionsAndroid,
    Platform,
    Alert,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface VoiceChatControlProps {
    channelId: string; // The Room ID
    uid: number; // Not heavily used in Jitsi URL but good for consistency
    isLeader: boolean;
}

const VoiceChatControl = ({ channelId, uid }: VoiceChatControlProps) => {
    const webViewRef = useRef<WebView>(null);
    const [joined, setJoined] = useState(false);
    const [isMuted, setIsMuted] = useState(true); // Start muted by default
    const [hasPermission, setHasPermission] = useState(false);

    // Sanitized Room Name for Jitsi
    const roomName = `doodlemovies_v1_${channelId.replace(/[^a-zA-Z0-9]/g, '')}`;

    // connection URL with config params
    // startAudioOnly=true: disables video request
    // startWithAudioMuted=true: start muted
    // disableDeepLinking=true: prevent opening the app
    const jitsiUrl = `https://meet.jit.si/${roomName}#config.startAudioOnly=true&config.startWithAudioMuted=true&config.disableDeepLinking=true&interfaceConfig.TOOLBAR_BUTTONS=['microphone']`;

    useEffect(() => {
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
                    if (granted === PermissionsAndroid.RESULTS.GRANTED) {
                        setHasPermission(true);
                    } else {
                        Alert.alert("Permission Denied", "Voice chat requires microphone access.");
                    }
                } catch (err) {
                    console.warn(err);
                }
            } else {
                setHasPermission(true);
            }
        };

        checkPerms();
    }, []);

    // Inject JS to toggle mute
    // This is a "best effort" hack since Jitsi DOM changes. 
    // Ideally we use the Jitsi IFrame API but that's for web.
    // In RN WebView, we can try sending key commands or finding buttons.
    // BUT, simply toggling the WebView's "media access" or just reloading might be safer?
    // Let's rely on the URL param for initial state.
    // For toggling: 
    // We can inject: `APP.conference.toggleAudioMuted();` -> This is the internal Jitsi API!
    const toggleMute = () => {
        if (!webViewRef.current) return;
        const newMuteState = !isMuted;

        // Jitsi Internal API command
        const script = `try { APP.conference.toggleAudioMuted(); } catch(e) { console.log(e); }`;
        webViewRef.current.injectJavaScript(script);

        setIsMuted(newMuteState);
    };

    if (!hasPermission) return null;

    return (
        <View className="items-center justify-center">
            {/* Button UI */}
            <TouchableOpacity
                onPress={toggleMute}
                className="bg-black/60 p-3 rounded-full flex-row items-center gap-2"
                style={{ borderColor: isMuted ? '#EF4444' : '#22C55E', borderWidth: 1 }}
            >
                <MaterialCommunityIcons
                    name={isMuted ? 'microphone-off' : 'microphone'}
                    size={24}
                    color={isMuted ? '#EF4444' : '#22C55E'}
                />
            </TouchableOpacity>

            {/* Hidden WebView for Audio Engine */}
            <View style={{ height: 1, width: 1, opacity: 0, overflow: 'hidden' }}>
                <WebView
                    ref={webViewRef}
                    source={{ uri: jitsiUrl }}
                    userAgent="Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.181 Mobile Safari/537.36"
                    mediaPlaybackRequiresUserAction={false}
                    allowsInlineMediaPlayback={true}
                    javaScriptEnabled={true}
                    domStorageEnabled={true}
                    onLoadEnd={() => setJoined(true)}
                    // Necessary to allow mic access
                    originWhitelist={['*']}
                    permissionStatus="granted" // iOS specific
                />
            </View>
        </View>
    );
};

export default VoiceChatControl;
