import {useState, useEffect, useCallback} from 'react';
import Pusher from 'pusher-js/react-native'; // Requires install: npm install pusher-js

// NOTE: In a real app, these values must be stored securely (e.g., in .env)
// Replace these placeholders with your actual Pusher credentials.
const PUSHER_APP_KEY = '4e845a4b31453918068e';
const PUSHER_APP_CLUSTER = 'ap2';

interface SyncEvent {
  type: 'play' | 'pause' | 'seek';
  time: number; // Current playback time in seconds
  senderId: string;
}

interface ChatMessage {
  senderId: string;
  message: string;
}

/**
 * Custom hook to handle real-time video synchronization and chat using Pusher.
 * It connects to a unique channel based on the video ID.
 *
 * @param videoId The ID used to create the unique Pusher channel.
 * @param watchTogetherMode Boolean flag to enable/disable the functionality.
 * @param playerRef A React ref to the video player instance (e.g., VideoPlayer from @8man/react-native-media-console).
 * @param setChatLog State setter function for updating the chat display.
 */
const useWatchTogether = (
  videoId: string | undefined,
  watchTogetherMode: boolean,
  playerRef: any,
  setChatLog: React.Dispatch<React.SetStateAction<string[]>>,
) => {
  const [pusher, setPusher] = useState<Pusher | null>(null);
  const [channel, setChannel] = useState<any>(null);
  const [senderId] = useState(
    Math.random().toString(36).substring(2, 9),
  ); // Unique ID for this client

  useEffect(() => {
    if (!watchTogetherMode || !videoId) return;

    // 1. Initialize Pusher
    const pusherClient = new Pusher(PUSHER_APP_KEY, {
      cluster: PUSHER_APP_CLUSTER,
      // For private channels, add authEndpoint: 'YOUR_AUTH_ENDPOINT'
    });

    setPusher(pusherClient);

    // 2. Subscribe to the unique channel based on the videoId
    // Using a 'presence-' channel allows you to track users in the room
    const newChannel = pusherClient.subscribe(`presence-video-${videoId}`);
    setChannel(newChannel);

    // 3. Bind to Synchronization Events (Other users are controlling the video)
    newChannel.bind('client-sync-event', (data: SyncEvent) => {
      // Ignore events sent by self
      if (data.senderId === senderId) return;

      const {type, time} = data;
      const player = playerRef.current;

      if (player) {
        setChatLog(prev => [
          `[Sync: ${data.senderId}] ${type.toUpperCase()} to ${time.toFixed(1)}s`,
          ...prev, // Prepend to the log for LIFO display
        ]);
        switch (type) {
          case 'seek':
            // Only seek if the difference is significant (> 2s) to prevent sync loops
            const currentPosition = player.state.currentTime;
            if (Math.abs(currentPosition - time) > 2) {
              player.seek(time);
            }
            break;
          case 'play':
            player.resume();
            break;
          case 'pause':
            player.pause();
            break;
        }
      }
    });

    // 4. Bind to Chat Events
    newChannel.bind('client-chat-message', (data: ChatMessage) => {
      if (data.senderId === senderId) return;
      setChatLog(prev => [`Friend [${data.senderId}]: ${data.message}`, ...prev]);
    });

    // 5. Cleanup on unmount/mode change
    return () => {
      if (newChannel) {
        newChannel.unbind_all();
        pusherClient.unsubscribe(`presence-video-${videoId}`);
        pusherClient.disconnect();
      }
    };
  }, [videoId, watchTogetherMode, senderId, playerRef, setChatLog]); // Added playerRef and setChatLog to dependency array

  // Function to send a synchronization event
  const sendSyncEvent = useCallback(
    (type: SyncEvent['type'], time: number) => {
      if (channel) {
        const data: SyncEvent = {type, time, senderId};
        // client- events are only supported on presence/private channels
        channel.trigger('client-sync-event', data);
        // Log self-initiated sync events
        setChatLog(prev => [
          `[Sync: You] ${type.toUpperCase()} to ${time.toFixed(1)}s`,
          ...prev,
        ]);
      }
    },
    [channel, senderId, setChatLog],
  );

  // Function to send a chat message
  const sendChat = useCallback(
    (message: string) => {
      if (channel) {
        const data: ChatMessage = {senderId, message};
        channel.trigger('client-chat-message', data);
        // Add self message to the log instantly
        setChatLog(prev => [`You [${senderId}]: ${message}`, ...prev]);
      }
    },
    [channel, senderId, setChatLog],
  );

  return {
    sendSyncEvent,
    sendChat,
    isPusherConnected: !!pusher && !!channel,
    senderId,
  };
};

export default useWatchTogether;