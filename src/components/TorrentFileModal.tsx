import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Modal,
  StyleSheet,
} from 'react-native';
import { BlurView } from 'expo-blur';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import useThemeStore from '../lib/zustand/themeStore';

interface TorrentFile {
  filename: string;
  filesize: number;
  downloadUrl: string;
}

interface TorrentFileModalProps {
  visible: boolean;
  files: TorrentFile[];
  onSelect: (file: TorrentFile) => void;
  onClose: () => void;
  torrentName: string;
}

const formatSize = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const TorrentFileModal: React.FC<TorrentFileModalProps> = ({
  visible,
  files,
  onSelect,
  onClose,
  torrentName,
}) => {
  const { primary } = useThemeStore(state => state);

  const renderItem = ({ item }: { item: TorrentFile }) => {
    // Check if it's a video file based on extension
    const isVideo = /\.(mp4|mkv|avi|mov|m4v|flv|wmv)$/i.test(item.filename);

    return (
      <TouchableOpacity
        onPress={() => onSelect(item)}
        className="bg-white/5 border border-white/10 rounded-xl p-4 mb-3 flex-row items-center"
      >
        <View className="mr-3 bg-white/10 p-2 rounded-lg">
          <MaterialCommunityIcons 
            name={isVideo ? "movie-play" : "file-outline"} 
            size={24} 
            color={isVideo ? primary : "#A1A1AA"} 
          />
        </View>
        <View className="flex-1">
          <Text className="text-white font-medium text-sm leading-tight" numberOfLines={2}>
            {item.filename}
          </Text>
          <Text className="text-zinc-500 text-xs mt-1">
            {formatSize(item.filesize)}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#52525B" />
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-center items-center bg-black/80 p-4">
        <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
        
        <View className="bg-zinc-900 w-full max-h-[80%] rounded-3xl border border-white/10 overflow-hidden">
          {/* Header */}
          <View className="p-5 border-b border-white/10 flex-row items-center justify-between">
            <View className="flex-1 mr-4">
              <Text className="text-white font-bold text-lg">Select File</Text>
              <Text className="text-zinc-500 text-xs mt-0.5" numberOfLines={1}>
                {torrentName}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} className="bg-white/10 p-2 rounded-full">
              <Ionicons name="close" size={20} color="white" />
            </TouchableOpacity>
          </View>

          {/* List */}
          <FlatList
            data={files}
            renderItem={renderItem}
            keyExtractor={(item, index) => index.toString()}
            contentContainerStyle={{ padding: 20 }}
            ListEmptyComponent={
              <View className="items-center justify-center py-20">
                <Text className="text-zinc-500">No files found in this torrent.</Text>
              </View>
            }
          />
          
          <View className="p-4 bg-zinc-950/50 items-center">
            <Text className="text-zinc-600 text-[10px] uppercase font-bold tracking-widest">
              {files.length} Files Total
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default TorrentFileModal;
