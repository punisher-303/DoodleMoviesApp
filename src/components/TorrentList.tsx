import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  TextInput,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Skeleton } from 'moti/skeleton';
import useThemeStore from '../lib/zustand/themeStore';
import { useStreamData } from '../lib/hooks/useEpisodes';

interface TorrentListProps {
  tmdbId: string;
  imdbId: string;
  type: string;
  title: string;
  season?: number;
  episode?: number;
  providerValue: string;
  link: string; // The link payload to fetch streams
  onPlay: (stream: any) => void;
}

const TorrentList: React.FC<TorrentListProps> = ({
  providerValue,
  link,
  type,
  onPlay,
}) => {
  const { primary } = useThemeStore(state => state);
  const [searchText, setSearchText] = useState('');
  const [sortOrder, setSortOrder] = useState<'seeders' | 'size' | 'quality'>('seeders');
  const [streams, setStreams] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { fetchStreams } = useStreamData();

  useEffect(() => {
    const loadStreams = async () => {
      setIsLoading(true);
      try {
        const results = await fetchStreams(link, type, providerValue);
        setStreams(results);
      } catch (err) {
        console.error("Failed to load torrent streams:", err);
      } finally {
        setIsLoading(false);
      }
    };
    loadStreams();
  }, [link, type, providerValue]);

  const parsedStreams = useMemo(() => {
    return streams.map(stream => {
      // Server format: Source | Quality | Audio | Size | Seeders
      const parts = stream.server.split(' | ');
      return {
        ...stream,
        source: parts[0] || 'Unknown',
        qualityTag: parts[1] || 'HD',
        audioTags: parts[2] ? parts[2].split(', ') : [],
        size: parts[3] || 'Unknown',
        seeders: parts[4] || '0S',
        seedersCount: parseInt(parts[4]) || 0,
        sizeInBytes: parseFloat(parts[3]) * (parts[3]?.includes('GB') ? 1024 : 1),
      };
    });
  }, [streams]);

  const filteredAndSortedStreams = useMemo(() => {
    let result = parsedStreams;

    if (searchText.trim()) {
      result = result.filter(s => 
        s.name.toLowerCase().includes(searchText.toLowerCase()) ||
        s.server.toLowerCase().includes(searchText.toLowerCase())
      );
    }

    result.sort((a, b) => {
      if (sortOrder === 'seeders') return b.seedersCount - a.seedersCount;
      if (sortOrder === 'size') return b.sizeInBytes - a.sizeInBytes;
      if (sortOrder === 'quality') {
          const qVal = (q: string) => q.includes('4K') ? 2160 : parseInt(q) || 0;
          return qVal(b.qualityTag) - qVal(a.qualityTag);
      }
      return 0;
    });

    return result;
  }, [parsedStreams, searchText, sortOrder]);

  const renderBadge = (text: string, color: string) => (
    <View style={{ backgroundColor: color + '20', borderColor: color, borderWidth: 1 }} className="px-2 py-0.5 rounded-md mr-2 mb-1">
      <Text style={{ color: color }} className="text-[10px] font-bold uppercase">{text}</Text>
    </View>
  );

  const getQualityColor = (quality: string) => {
    if (quality.includes('4K') || quality.includes('2160')) return '#A855F7'; // Purple
    if (quality.includes('1080')) return '#3B82F6'; // Blue
    if (quality.includes('720')) return '#0EA5E9'; // Sky
    return '#71717A'; // Zinc
  };

  const getAudioColor = (tag: string) => {
    const t = tag.toUpperCase();
    if (t.includes('ATMOS')) return '#EAB308'; // Gold
    if (t.includes('TRUEHD')) return '#10B981'; // Emerald
    if (t.includes('DTS:X') || t.includes('DTSX')) return '#F97316'; // Orange
    if (t.includes('DTS-HD') || t.includes('DTSHD')) return '#EF4444'; // Red
    if (t.includes('DTS')) return '#F43F5E'; // Rose
    if (t.includes('DD+') || t.includes('EAC3')) return '#34D399'; // Mint
    if (t.includes('DD') || t.includes('AC3')) return '#2DD4BF'; // Teal
    if (t.includes('AAC')) return '#60A5FA'; // Blue
    if (t.includes('7.1')) return '#8B5CF6'; // Violet
    if (t.includes('5.1')) return '#A78BFA'; // Light Violet
    if (t.includes('2.0')) return '#94A3B8'; // Slate
    return '#A1A1AA'; // Zinc
  };

  const renderTorrentItem = ({ item }: { item: any }) => (
    <TouchableOpacity 
      onPress={() => onPlay(item)}
      className="bg-zinc-900/50 border border-white/10 rounded-xl p-3 mb-2 flex-row items-center"
    >
      <View className="flex-1">
        <Text className="text-white font-medium text-sm mb-1 leading-tight" numberOfLines={2}>
          {item.name}
        </Text>
        
        <View className="flex-row flex-wrap mt-1">
          {renderBadge(item.qualityTag, getQualityColor(item.qualityTag))}
          {item.audioTags.map((tag: string) => renderBadge(tag, getAudioColor(tag)))}
        </View>

        <View className="flex-row items-center mt-1 space-x-3 gap-2">
            <View className="flex-row items-center">
                <MaterialCommunityIcons name="database" size={12} color="#A1A1AA" />
                <Text className="text-zinc-400 text-[11px] ml-1">{item.size}</Text>
            </View>
            <View className="flex-row items-center">
                <MaterialCommunityIcons name="arrow-up" size={12} color="#22C55E" />
                <Text className="text-green-500 text-[11px] ml-0.5">{item.seeders}</Text>
            </View>
            <Text className="text-zinc-500 text-[11px] font-bold">Source: {item.source}</Text>
        </View>
      </View>
      
      <View className="ml-2 bg-white/5 p-2 rounded-full">
        <Ionicons name="play" size={20} color={primary} />
      </View>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <View className="p-2">
        <View className="flex-row items-center justify-between mb-4">
             <Skeleton colorMode="dark" width={100} height={20} />
             <Skeleton colorMode="dark" width={60} height={20} />
        </View>
        {[1, 2, 3, 4, 5].map(i => (
          <View key={i} className="mb-2 p-3 bg-zinc-900/30 rounded-xl">
             <Skeleton colorMode="dark" width="90%" height={20} />
             <View className="flex-row mt-2">
                <Skeleton colorMode="dark" width={40} height={15} />
                <View className="w-2" />
                <Skeleton colorMode="dark" width={40} height={15} />
             </View>
          </View>
        ))}
      </View>
    );
  }

  return (
    <View className="flex-1">
      <View className="flex-row justify-between items-center mb-3 px-1">
        <Text className="text-white font-bold text-lg">Torrent Results</Text>
        <View className="flex-row gap-2">
            <TouchableOpacity onPress={() => setSortOrder('seeders')}>
                <Text style={{ color: sortOrder === 'seeders' ? primary : '#A1A1AA' }} className="text-xs font-bold">Seeders</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setSortOrder('quality')}>
                <Text style={{ color: sortOrder === 'quality' ? primary : '#A1A1AA' }} className="text-xs font-bold">Quality</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setSortOrder('size')}>
                <Text style={{ color: sortOrder === 'size' ? primary : '#A1A1AA' }} className="text-xs font-bold">Size</Text>
            </TouchableOpacity>
        </View>
      </View>

      <TextInput
        placeholder="Filter results..."
        placeholderTextColor="#52525B"
        className="bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-white text-sm mb-3"
        value={searchText}
        onChangeText={setSearchText}
      />

      <FlatList
        data={filteredAndSortedStreams}
        renderItem={renderTorrentItem}
        keyExtractor={(item, index) => index.toString()}
        ListEmptyComponent={
          <View className="items-center justify-center py-20">
            <Text className="text-zinc-500">No torrents found matching search.</Text>
          </View>
        }
        scrollEnabled={false} // Since it's inside ScrollView in Info.tsx
      />
    </View>
  );
};

export default TorrentList;
