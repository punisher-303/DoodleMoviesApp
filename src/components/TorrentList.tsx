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
import { debridService } from '../lib/services/DebridService';
import { settingsStorage, cacheStorage } from '../lib/storage';
import TorrentFileModal from './TorrentFileModal';
import { ToastAndroid, ActivityIndicator, Alert, Linking } from 'react-native';
import axios from 'axios';
import MarqueeText from './MarqueeText';
import * as Clipboard from 'expo-clipboard';

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
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [sortOrder, setSortOrder] = useState<'seeders' | 'size' | 'quality'>('seeders');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [streams, setStreams] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isResolving, setIsResolving] = useState(false);
  const [selectedTorrent, setSelectedTorrent] = useState<any>(null);
  const [resolvedFiles, setResolvedFiles] = useState<any[]>([]);
  const [showFileModal, setShowFileModal] = useState(false);
  const { fetchStreams } = useStreamData();

  const loadStreams = async (searchKeyword?: string) => {
    setIsLoading(true);
    setStreams([]); // Clear previous results
    try {
      let finalLink = link;
      if (searchKeyword) {
          const payload = JSON.parse(link);
          finalLink = JSON.stringify({ ...payload, keyword: searchKeyword });
      }
      const results = await fetchStreams(finalLink, type, providerValue);
      setStreams(results);
    } catch (err) {
      console.error("Failed to load torrent streams:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
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
      const multiplier = sortDirection === 'asc' ? 1 : -1;
      
      if (sortOrder === 'seeders') {
        return (a.seedersCount - b.seedersCount) * multiplier;
      }
      if (sortOrder === 'size') {
        return (a.sizeInBytes - b.sizeInBytes) * multiplier;
      }
      if (sortOrder === 'quality') {
        const qVal = (q: string) => q.includes('4K') ? 2160 : parseInt(q) || 0;
        return (qVal(a.qualityTag) - qVal(b.qualityTag)) * multiplier;
      }
      return 0;
    });

    return result;
  }, [parsedStreams, searchText, sortOrder, sortDirection]);

  // Background Pre-fetch: Start peer discovery for top results early
  useEffect(() => {
    const prefetch = async () => {
        // Only pre-fetch on local engine to avoid bridge abuse
        const engineUrl = settingsStorage.getTorrServerUrl() || 'http://127.0.0.1:8090';
        const isLocal = engineUrl.includes('127.0.0.1') || engineUrl.includes('localhost');
        
        if (!isLocal || filteredAndSortedStreams.length === 0 || isLoading) return;

        // Take top 3 magnets and "add" them to start metadata fetching
        const topMagnets = filteredAndSortedStreams
            .filter(s => s.link.startsWith('magnet:'))
            .slice(0, 3);

        topMagnets.forEach(async (item) => {
            try {
                await axios.post(`${engineUrl}/torrent/add`, {
                    link: item.link,
                    save: false 
                }, { timeout: 3000 });
            } catch (e) {
                // Silently skip if engine is busy
            }
        });
    };
    
    // Small delay to let UI settle
    const timer = setTimeout(prefetch, 1000);
    return () => clearTimeout(timer);
  }, [filteredAndSortedStreams, isLoading]);

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

  const handlePlayPress = async (item: any) => {
    // If Debrid is enabled and it's a magnet, resolve it first to check for multiple files
    if (item.link.startsWith('magnet:')) {
        const isDebrid = settingsStorage.isDebridEnabled() && settingsStorage.getDebridService() !== 'None';
        
        setIsResolving(true);
        setSelectedTorrent(item);
        
        try {
            if (isDebrid) {
                ToastAndroid.show('Resolving via Debrid...', ToastAndroid.SHORT);
                const files = await debridService.resolveMagnet(item.link);
                if (files && files.length > 0) {
                    if (files.length === 1) {
                        onPlay({ ...item, link: files[0].downloadUrl, isResolved: true });
                    } else {
                        setResolvedFiles(files);
                        setShowFileModal(true);
                    }
                } else {
                    ToastAndroid.show('No playable files found', ToastAndroid.SHORT);
                }
            } else {
                // TorrServer Logic: Check if it's a pack and get files
                const torrServerUrl = settingsStorage.getTorrServerUrl() || 'http://127.0.0.1:8090';
                ToastAndroid.show('Checking torrent files...', ToastAndroid.SHORT);
                
                // Add to TorrServer but don't play yet to get file list
                const res = await axios.post(`${torrServerUrl}/torrent/add`, {
                    link: item.link,
                    save: true
                }, { timeout: 10000 });
                
                if (res.data?.hash) {
                    const hash = res.data.hash;
                    // Get files list
                    const statsRes = await axios.post(`${torrServerUrl}/torrent/view`, {
                        hash: hash
                    });
                    
                    const files = statsRes.data?.file_stats || [];
                    const videoFiles = files.filter((f: any) => /\.(mp4|mkv|avi|mov|m4v|flv|wmv)$/i.test(f.path));
                    
                    if (videoFiles.length > 1) {
                        setResolvedFiles(videoFiles.map((f: any) => ({
                            filename: f.path.split('/').pop() || f.path,
                            filesize: f.size,
                            downloadUrl: `${torrServerUrl}/stream/video.mp4?link=${encodeURIComponent(item.link)}&index=${f.id}&play`,
                            id: f.id
                        })));
                        setShowFileModal(true);
                    } else {
                        // Just one file or too complex, let the engine handle it
                        onPlay(item);
                    }
                } else {
                    onPlay(item); // Fallback
                }
            }
        } catch (error: any) {
            console.log("[TorrentList] Local engine check skipped or failed:", error.message);
            // In Zero-Config mode, we don't treat local engine failure as a hard error
            // We just let onPlay handle it via the Public Bridge fallback in useStream
            onPlay(item); 
        } finally {
            setIsResolving(false);
        }
    } else {
        onPlay(item);
    }
  };

  const renderTorrentItem = ({ item }: { item: any }) => (
    <TouchableOpacity 
      onPress={() => handlePlayPress(item)}
      disabled={isResolving}
      className="bg-zinc-900/50 border border-white/10 rounded-xl p-3 mb-3"
    >
      <View className="flex-col">
        {/* Row 1: Source & Actions */}
        <View className="flex-row items-center justify-between mb-2">
            <View className="flex-row items-center bg-white/5 px-2 py-0.5 rounded-md">
                <MaterialCommunityIcons name="earth" size={12} color={primary} />
                <Text className="text-zinc-400 text-[10px] ml-1.5 font-bold uppercase tracking-wider" numberOfLines={1}>
                    {item.source}
                </Text>
            </View>
            
            <View className="flex-row items-center gap-2">
                <TouchableOpacity 
                    onPress={async () => {
                        await Clipboard.setStringAsync(item.link);
                        ToastAndroid.show('Magnet copied', ToastAndroid.SHORT);
                    }}
                    className="bg-white/5 p-1.5 rounded-full"
                >
                    <Ionicons name="copy-outline" size={14} color="#A1A1AA" />
                </TouchableOpacity>

                <TouchableOpacity 
                    onPress={() => {
                        Linking.openURL(item.link).catch(() => {
                            ToastAndroid.show('Download failed', ToastAndroid.SHORT);
                        });
                    }}
                    className="bg-white/5 p-1.5 rounded-full"
                >
                    <Ionicons name="download-outline" size={14} color="#A1A1AA" />
                </TouchableOpacity>

                <View className="bg-white/5 p-1.5 rounded-full">
                    {isResolving && selectedTorrent?.link === item.link ? (
                        <ActivityIndicator size="small" color={primary} />
                    ) : (
                        <Ionicons name="play" size={16} color={primary} />
                    )}
                </View>
            </View>
        </View>

        {/* Row 2: File Name (Modern Standard Font) */}
        <Text 
            className="text-white font-semibold text-base mb-2"
            numberOfLines={3}
        >
            {item.name}
        </Text>
        
        {/* Row 3: Metadata Badges */}
        <View className="flex-row flex-wrap mb-2">
          {renderBadge(item.qualityTag, getQualityColor(item.qualityTag))}
          {item.audioTags.slice(0, 3).map((tag: string) => renderBadge(tag, getAudioColor(tag)))}
        </View>

        {/* Row 4: Stats (Size, Seeders) */}
        <View className="flex-row items-center justify-between pt-2 border-t border-white/5">
            <View className="flex-row items-center bg-white/5 px-3 py-1 rounded-lg">
                <MaterialCommunityIcons name="database-outline" size={14} color="#A1A1AA" />
                <Text className="text-white text-[11px] ml-2 font-bold">{item.size}</Text>
            </View>

            <View className="flex-row items-center bg-green-500/10 px-3 py-1 rounded-lg border border-green-500/20">
                <MaterialCommunityIcons name="arrow-up-bold" size={14} color="#22C55E" />
                <Text className="text-green-500 text-[11px] ml-1.5 font-bold">{item.seeders}</Text>
            </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  const handleSortPress = (order: 'seeders' | 'size' | 'quality') => {
    if (sortOrder === order) {
      setSortDirection(prev => (prev === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortOrder(order);
      setSortDirection('desc');
    }
  };

  const renderSortOption = (label: string, order: 'seeders' | 'size' | 'quality') => {
    const isActive = sortOrder === order;
    return (
      <TouchableOpacity 
        onPress={() => handleSortPress(order)}
        className="flex-row items-center gap-1"
      >
        <Text 
          style={{ color: isActive ? primary : '#A1A1AA' }} 
          className="text-[10px] font-bold uppercase"
        >
          {label}
        </Text>
        {isActive && (
          <Ionicons 
            name={sortDirection === 'desc' ? 'arrow-down' : 'arrow-up'} 
            size={10} 
            color={primary} 
          />
        )}
      </TouchableOpacity>
    );
  };

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
      <View className="flex-row justify-between items-center mb-1 px-1">
        <Text className="text-white font-bold text-lg">Torrent Results</Text>
        <View className="flex-row items-center gap-2">
            <TouchableOpacity 
                onPress={() => setIsSearchVisible(!isSearchVisible)}
                className="p-1.5 bg-white/5 rounded-full mr-1"
            >
                <Ionicons name="search" size={18} color={isSearchVisible ? primary : '#A1A1AA'} />
            </TouchableOpacity>
            {renderSortOption('Seeders', 'seeders')}
            {renderSortOption('Quality', 'quality')}
            {renderSortOption('Size', 'size')}
        </View>
      </View>

      {isSearchVisible && (
        <View className="flex-row items-center mb-3">
            <TextInput
            placeholder="Search keywords or filter..."
            placeholderTextColor="#52525B"
            autoFocus
            className="flex-1 bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
            value={searchText}
            onChangeText={setSearchText}
            onSubmitEditing={() => loadStreams(searchText)}
            />
            <TouchableOpacity 
                onPress={() => loadStreams(searchText)}
                className="ml-2 bg-white/10 p-2 rounded-lg items-center justify-center"
            >
                <Ionicons name="globe-outline" size={20} color={primary} />
            </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={filteredAndSortedStreams}
        renderItem={renderTorrentItem}
        keyExtractor={(item, index) => index.toString()}
        ListEmptyComponent={
          <View className="items-center justify-center py-20 px-10">
            <MaterialCommunityIcons name="magnify-scan" size={48} color="#3F3F46" />
            <Text className="text-zinc-500 text-center mt-4 mb-6">
                {isLoading ? "Fetching streams..." : "No torrents found for this title automatically."}
            </Text>
            {!isLoading && (
                <TouchableOpacity 
                    onPress={() => {
                        setIsSearchVisible(true);
                        if (searchText) loadStreams(searchText);
                    }}
                    style={{ backgroundColor: primary }}
                    className="px-6 py-3 rounded-xl flex-row items-center"
                >
                    <Ionicons name="search" size={20} color="black" />
                    <Text className="text-black font-bold ml-2">Manual Search</Text>
                </TouchableOpacity>
            )}
          </View>
        }
        scrollEnabled={false} // Since it's inside ScrollView in Info.tsx
      />

      <TorrentFileModal 
        visible={showFileModal}
        files={resolvedFiles}
        torrentName={selectedTorrent?.name || ''}
        onClose={() => setShowFileModal(false)}
        onSelect={(file) => {
            setShowFileModal(false);
            onPlay({ ...selectedTorrent, link: file.downloadUrl, isResolved: true });
        }}
      />
    </View>
  );
};

export default TorrentList;
