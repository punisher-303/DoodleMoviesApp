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
import { settingsStorage } from '../lib/storage';
import { ToastAndroid, Linking } from 'react-native';
import axios from 'axios';
import MarqueeText from './MarqueeText';
import * as Clipboard from 'expo-clipboard';

interface TorrentListProps {
  tmdbId: string;
  imdbId: string;
  type: string;
  title: string;
  mainTitle?: string; // The Show/Movie name (for filtering)
  year?: string;      // The release year (for filtering)
  season?: number;
  episode?: number;
  providerValue: string;
  link: string; // The link payload to fetch streams
}

const TorrentList: React.FC<TorrentListProps> = ({
  providerValue,
  link,
  type,
  title,
  mainTitle,
  year,
  season,
  episode,
}) => {
  const { primary } = useThemeStore(state => state);
  const [searchText, setSearchText] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [sortOrder, setSortOrder] = useState<'seeders' | 'size' | 'quality'>('seeders');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [streams, setStreams] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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

  const normalize = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const cleanTitle = (t: string) => (t || '').toLowerCase().replace(/^(the|a|an)\s+/i, '').replace(/[^a-z0-9]/g, '');

  const shouldInclude = (torrentName: string) => {
    // If it's a manual search, don't apply strict filtering
    if (searchText.trim()) return true;

    const nName = normalize(torrentName);
    const targetTitle = mainTitle || title;
    
    const nTitle = normalize(targetTitle);
    const cTitle = cleanTitle(targetTitle);

    // 1. Basic Title Match (Allow match even if "The/A/An" is missing in either)
    if (!nName.includes(nTitle) && !nName.includes(cTitle)) {
        // One more check: if targetTitle is "The Batman" -> "batman"
        // But what if torrent name is "Batman.Begin.2005"? 
        // We only want to match if it's the START of a word or similar.
        // For now, nName.includes(cTitle) is a good relaxation.
        return false;
    }

    // 2. Year Match for Movies (Flexible & Optional if Title is Strong)
    if (year && type === 'movie' && /^\d{4}$/.test(year)) {
        const y = parseInt(year);
        const yearsToCheck = [year, String(y + 1), String(y - 1)];
        
        const hasAnyYear = /\d{4}/.test(torrentName);
        const hasMatchYear = yearsToCheck.some(y => torrentName.includes(y));
        
        // If the torrent HAS a year but it's the WRONG year, filter it out.
        // If the torrent DOESN'T have a year, allow it (don't be too strict).
        if (hasAnyYear && !hasMatchYear) return false;
    }

    // 3. Season/Episode Match for Series (Keep strict)
    if (type === 'series' && season !== undefined) {
        const sTag = `S${season.toString().padStart(2, '0')}`;
        const sTagShort = `S${season}`;
        const hasSeason = torrentName.toUpperCase().includes(sTag) || torrentName.toUpperCase().includes(sTagShort);
        
        if (!hasSeason) return false;

        if (episode !== undefined) {
            const epTag = `E${episode.toString().padStart(2, '0')}`;
            const epTagShort = `E${episode}`;
            const xTag = `${season}X${episode}`;
            const hasEpisode = 
                torrentName.toUpperCase().includes(epTag) || 
                torrentName.toUpperCase().includes(epTagShort) ||
                torrentName.toUpperCase().includes(xTag);
            
            if (!hasEpisode) return false;
        }
    }

    return true;
  };

  const filteredAndSortedStreams = useMemo(() => {
    let result = parsedStreams;

    // Apply Strict Filtering first (if not manual search)
    if (!searchText.trim()) {
      const strictResults = result.filter(s => shouldInclude(s.name));
      // Fallback to original results if strict filtering is too aggressive
      if (strictResults.length > 0) {
          result = strictResults;
      }
    }

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
  }, [parsedStreams, searchText, sortOrder, sortDirection, mainTitle, title, year, season, episode]);


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

  const handleDownloadPress = async (item: any) => {
    try {
      Linking.openURL(item.link).catch(() => {
        ToastAndroid.show('No app found to handle torrent links', ToastAndroid.SHORT);
      });
    } catch (error) {
      ToastAndroid.show('Failed to open link', ToastAndroid.SHORT);
    }
  };

  const renderTorrentItem = ({ item }: { item: any }) => (
    <View 
      className="bg-[#121212] border border-white/10 rounded-2xl p-4 mb-4 shadow-sm"
    >
      {/* Title & Quality Badge */}
      <View className="flex-row justify-between items-start mb-3">
        <View className="flex-1 mr-2">
          <Text 
            className="text-white font-bold text-base leading-tight"
            numberOfLines={2}
          >
            {item.name}
          </Text>
        </View>
        <View style={{ backgroundColor: getQualityColor(item.qualityTag) + '20', borderColor: getQualityColor(item.qualityTag), borderWidth: 1 }} className="px-2 py-0.5 rounded-md">
          <Text style={{ color: getQualityColor(item.qualityTag) }} className="text-[10px] font-black uppercase">{item.qualityTag}</Text>
        </View>
      </View>
      
      {/* Metadata Row: Source, Size, Seeders */}
      <View className="flex-row items-center gap-3 mb-4">
        <View className="flex-row items-center bg-white/5 px-2 py-1 rounded-lg">
          <MaterialCommunityIcons name="earth" size={12} color="#94A3B8" />
          <Text className="text-zinc-400 text-[10px] ml-1.5 font-bold uppercase tracking-tight">{item.source}</Text>
        </View>
        
        <View className="flex-row items-center bg-white/5 px-2 py-1 rounded-lg">
          <MaterialCommunityIcons name="database-outline" size={12} color="#94A3B8" />
          <Text className="text-zinc-300 text-[10px] ml-1.5 font-bold">{item.size}</Text>
        </View>

        <View className="flex-row items-center bg-green-500/10 px-2 py-1 rounded-lg border border-green-500/10">
          <MaterialCommunityIcons name="arrow-up-bold" size={12} color="#22C55E" />
          <Text className="text-green-500 text-[10px] ml-1.5 font-black">{item.seeders}</Text>
        </View>
      </View>

      {/* Action Buttons */}
      <View className="flex-row gap-2">
        <TouchableOpacity 
          onPress={async () => {
            await Clipboard.setStringAsync(item.link);
            ToastAndroid.show('Link copied', ToastAndroid.SHORT);
          }}
          className="bg-white/5 h-12 w-12 rounded-xl items-center justify-center border border-white/10"
        >
          <Ionicons name="copy-outline" size={20} color="#CBD5E1" />
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={() => {
            Linking.openURL(item.link).catch(() => {
                ToastAndroid.show('No app found to handle torrent links', ToastAndroid.SHORT);
            });
          }}
          style={{ backgroundColor: primary }}
          className="flex-1 h-12 rounded-xl flex-row items-center justify-center px-4"
        >
          <Ionicons name="download" size={20} color="black" />
          <Text className="text-black font-black ml-2 text-sm">Download Now</Text>
        </TouchableOpacity>
      </View>
    </View>
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

      <View className="mb-4" />
    </View>
  );
};

export default TorrentList;
