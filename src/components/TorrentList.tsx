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
        } catch (error) {
            console.error("Resolution failed:", error);
            ToastAndroid.show('Engine resolution failed, playing direct', ToastAndroid.SHORT);
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
      className="bg-zinc-900/50 border border-white/10 rounded-xl p-3 mb-2 flex-row items-center"
    >
      <View className="flex-1 mr-2">
        <MarqueeText 
            text={item.name} 
            style={{ color: 'white', fontWeight: '500', fontSize: 13 }} 
        />
        
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
            <View className="flex-1">
                <MarqueeText 
                    text={`Source: ${item.source}`}
                    style={{ color: '#71717A', fontSize: 10, fontWeight: 'bold' }}
                />
            </View>
        </View>
      </View>
      
      <View className="ml-2 flex-row items-center gap-1.5">
        <TouchableOpacity 
            onPress={async () => {
                await Clipboard.setStringAsync(item.link);
                ToastAndroid.show('Magnet copied to clipboard', ToastAndroid.SHORT);
            }}
            className="bg-white/5 p-2 rounded-full"
        >
            <Ionicons name="copy-outline" size={16} color="#A1A1AA" />
        </TouchableOpacity>

        <TouchableOpacity 
            onPress={() => {
                Linking.openURL(item.link).catch(() => {
                    ToastAndroid.show('No app found to handle this link', ToastAndroid.SHORT);
                });
            }}
            className="bg-white/5 p-2 rounded-full"
        >
            <MaterialCommunityIcons name="rocket-launch-outline" size={16} color="#A1A1AA" />
        </TouchableOpacity>

        <TouchableOpacity 
            onPress={() => {
                // If it's a resolved HTTP link, open in browser/downloader
                // If magnet, open in torrent app
                Linking.openURL(item.link).catch(() => {
                    ToastAndroid.show('Download failed to start', ToastAndroid.SHORT);
                });
            }}
            className="bg-white/5 p-2 rounded-full"
        >
            <Ionicons name="download-outline" size={16} color="#A1A1AA" />
        </TouchableOpacity>

        <View className="bg-white/5 p-2 rounded-full ml-1">
            {isResolving && selectedTorrent?.link === item.link ? (
                <ActivityIndicator size="small" color={primary} />
            ) : (
                <Ionicons name="play" size={18} color={primary} />
            )}
        </View>
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
      <View className="flex-row justify-between items-center mb-1 px-1">
        <Text className="text-white font-bold text-lg">Torrent Results</Text>
        <View className="flex-row items-center gap-2">
            <TouchableOpacity 
                onPress={() => setIsSearchVisible(!isSearchVisible)}
                className="p-1.5 bg-white/5 rounded-full mr-1"
            >
                <Ionicons name="search" size={18} color={isSearchVisible ? primary : '#A1A1AA'} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setSortOrder('seeders')}>
                <Text style={{ color: sortOrder === 'seeders' ? primary : '#A1A1AA' }} className="text-[10px] font-bold uppercase">Seeders</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setSortOrder('quality')}>
                <Text style={{ color: sortOrder === 'quality' ? primary : '#A1A1AA' }} className="text-[10px] font-bold uppercase">Quality</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setSortOrder('size')}>
                <Text style={{ color: sortOrder === 'size' ? primary : '#A1A1AA' }} className="text-[10px] font-bold uppercase">Size</Text>
            </TouchableOpacity>
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
