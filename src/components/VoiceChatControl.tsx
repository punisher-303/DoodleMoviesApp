import React, { useEffect, useRef, useState } from 'react';
import {
    View,
    TouchableOpacity,
    PermissionsAndroid,
    Platform,
    Alert,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface VoiceChatControlProps {
    channelId: string;
    uid: number;
    isLeader: boolean;
}

const VoiceChatControl = ({ channelId }: VoiceChatControlProps) => {
    const webViewRef = useRef<WebView>(null);
    const [joined, setJoined] = useState(false);
    const [isMuted, setIsMuted] = useState(true);
    const [hasPermission, setHasPermission] = useState(false);

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
        if (!webViewRef.current) return;
        const newMuteState = !isMuted;
        // Inject Jitsi Command
        const script = `try { APP.conference.toggleAudioMuted(); } catch(e) { console.log(e); }`;
        webViewRef.current.injectJavaScript(script);
        setIsMuted(newMuteState);
    };

    if (!hasPermission) return null;

    return (
        <View className="items-center justify-center">
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
        </View>
    );
};

export default VoiceChatControl;
