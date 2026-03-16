import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  Platform,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React, { useEffect, useState, memo } from 'react';
import useWatchHistoryStore from '../lib/zustand/watchHistrory';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { WatchHistoryStackParamList } from '../App';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import useThemeStore from '../lib/zustand/themeStore';
import { mainStorage } from '../lib/storage';

type Props = NativeStackScreenProps<WatchHistoryStackParamList, 'WatchHistory'>;

const HistoryItem = memo(({ 
  item, 
  progress, 
  primary, 
  onPress 
}: { 
  item: any, 
  progress: number, 
  primary: string, 
  onPress: (item: any) => void 
}) => {
  return (
    <View className="flex-1 m-1">
      <TouchableOpacity onPress={() => onPress(item)}>
        <View className="relative overflow-hidden">
          <Image
            source={{ uri: item.poster }}
            className="w-full aspect-[2/3] rounded-lg"
            cachePolicy="memory-disk"
          />

          <View
            className="absolute bottom-0 left-0 right-0 h-2"
            style={{
              backgroundColor: 'rgba(0,0,0,0.6)',
              zIndex: 10,
            }}>
            <View
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                height: '100%',
                width: `${progress}%`,
                backgroundColor: primary,
                zIndex: 20,
                elevation: 5,
              }}
            />
          </View>

          {progress > 0 && (
            <View
              className="absolute bottom-0 left-0 right-0 h-16"
              style={{
                backgroundColor: 'rgba(0,0,0,0.8)',
                zIndex: 10,
              }}
            />
          )}

          {progress > 0 && progress < 100 && (
            <View className="absolute bottom-3 right-2" style={{ zIndex: 15 }}>
              <View
                style={{
                  width: 45,
                  height: 18,
                  backgroundColor: 'rgba(0,0,0,0.7)',
                  borderRadius: 9,
                  overflow: 'hidden',
                  borderLeftWidth: 2,
                  borderLeftColor: primary,
                  flexDirection: 'row',
                  alignItems: 'center',
                }}>
                <View
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: `${progress}%`,
                    backgroundColor: `${primary}CC`,
                  }}
                />
                <Text className="text-white text-[10px] font-medium w-full text-center" style={{ zIndex: 20 }}>
                  {Math.round(progress)}%
                </Text>
              </View>
            </View>
          )}

          {progress >= 100 && (
            <View
              className="absolute top-2 right-2 p-1 rounded-full"
              style={{
                backgroundColor: 'rgba(0,0,0,0.6)',
                borderWidth: 1.5,
                borderColor: primary,
                zIndex: 15,
              }}>
              <MaterialCommunityIcons name="check-circle" size={18} color={primary} />
            </View>
          )}
        </View>

        <Text numberOfLines={2} className="text-white text-sm mt-1">
          {item.title}
        </Text>
        {item.episodeTitle && (
          <Text numberOfLines={1} className="text-white/60 text-xs">
            {item.episodeTitle}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
});

const WatchHistory = ({ navigation }: Props) => {
  const insets = useSafeAreaInsets();
  const { primary } = useThemeStore(state => state);
  const { history, clearHistory } = useWatchHistoryStore(state => state);
  const [progressData, setProgressData] = useState<Record<string, number>>({});

  const uniqueHistory = React.useMemo(() => {
    const seen = new Set();
    return history.filter(item => {
      if (seen.has(item.link)) return false;
      seen.add(item.link);
      return true;
    });
  }, [history]);

  useEffect(() => {
    const loadProgressData = () => {
      const progressMap: Record<string, number> = {};
      uniqueHistory.forEach(item => {
        try {
          const historyKey = item.link;
          const historyProgressKey = `watch_history_progress_${historyKey}`;
          const storedProgress = mainStorage.getString(historyProgressKey);

          if (storedProgress) {
            const parsed = JSON.parse(storedProgress);
            if (parsed.percentage) {
              progressMap[item.link] = Math.min(Math.max(parsed.percentage, 0), 100);
              return;
            } else if (parsed.currentTime && parsed.duration) {
              const percentage = (parsed.currentTime / parsed.duration) * 100;
              progressMap[item.link] = Math.min(Math.max(percentage, 0), 100);
              return;
            }
          }
          if (item.episodeTitle) {
            const episodeKey = `watch_history_progress_${historyKey}_${item.episodeTitle.replace(/\s+/g, '_')}`;
            const episodeData = mainStorage.getString(episodeKey);
            if (episodeData) {
              const parsed = JSON.parse(episodeData);
              if (parsed.percentage) {
                progressMap[item.link] = Math.min(Math.max(parsed.percentage, 0), 100);
                return;
              }
            }
          }
          const cachedProgress = mainStorage.getString(item.link);
          if (cachedProgress) {
            const parsed = JSON.parse(cachedProgress);
            if (parsed.position && parsed.duration) {
              const percentage = (parsed.position / parsed.duration) * 100;
              progressMap[item.link] = Math.min(Math.max(percentage, 0), 100);
              return;
            }
          }
          if (item.currentTime && item.duration) {
            const percentage = (item.currentTime / item.duration) * 100;
            progressMap[item.link] = Math.min(Math.max(percentage, 0), 100);
            return;
          }
        } catch (e) {
          console.error('Error processing progress:', e);
        }
      });
      setProgressData(progressMap);
    };
    loadProgressData();
  }, [uniqueHistory]);

  const handleNavigateToInfo = (item: any) => {
    navigation.navigate('Info', {
      link: item.link,
      provider: item.provider || 'multiStream',
      poster: item.image || '',
    });
  };

  return (
    <View className="flex-1 bg-black">
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
      <View className="w-full bg-black" style={{ paddingTop: insets.top }} />
      <View className="flex-row justify-between items-center p-4">
        <Text className="text-white text-2xl font-bold">Watch History</Text>
        {uniqueHistory.length > 0 && (
          <TouchableOpacity onPress={() => clearHistory()} className="bg-white/10 px-3 py-1 rounded-full">
            <Text className="text-white">Clear</Text>
          </TouchableOpacity>
        )}
      </View>
      <FlashList
        data={uniqueHistory}
        numColumns={3}
        estimatedItemSize={210}
        ListEmptyComponent={() => (
          <View className="flex-1 justify-center items-center mt-10">
            <MaterialCommunityIcons name="history" size={80} color={primary} />
            <Text className="text-white/70 text-base mt-4">No watch history</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <HistoryItem 
            item={item} 
            progress={progressData[item.link] || 0} 
            primary={primary} 
            onPress={handleNavigateToInfo} 
          />
        )}
        keyExtractor={(item, index) => item.link + index}
      />
    </View>
  );
};

export default WatchHistory;
