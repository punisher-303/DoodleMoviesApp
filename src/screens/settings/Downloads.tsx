import { View, Text, Image, Platform, TouchableOpacity, FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import requestStoragePermission from '../../lib/file/getStoragePermission';
import * as FileSystem from 'expo-file-system';
import { downloadFolder } from '../../lib/constants';
import * as VideoThumbnails from 'expo-video-thumbnails';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { settingsStorage, downloadsStorage } from '../../lib/entstore';
import useThemeStore from '../../lib/zustand/themeStore';
import * as RNFS from '@dr.pogodin/react-native-fs';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import RNReactNativeHapticFeedback from 'react-native-haptic-feedback';
import * as DocumentPicker from 'expo-document-picker';

// Define supported video extensions
const VIDEO_EXTENSIONS = [
  '.mp4',
  '.mov',
  '.avi',
  '.mkv',
  '.wmv',
  '.flv',
  '.webm',
  '.m4v',
];

const isVideoFile = (filename: string): boolean => {
  const extension = filename.toLowerCase().slice(filename.lastIndexOf('.'));
  return VIDEO_EXTENSIONS.includes(extension);
};

// Interface for a single file item (used in FlashList data)
interface MediaItem {
  uri: string;
  title: string;
  size: number;
  // Flag to distinguish files managed by RNFS (local downloads)
  // from files only referenced by URI (external selection)
  isManagedDownload: boolean;
}

// Function to extract a readable title from the filename
const getReadableTitle = (fileName: string): string => {
  let title = fileName; // 1. Remove Extension

  title = title.replace(/\.(mp4|mkv|avi|mov|wmv|flv|webm|m4v)$/i, ''); // 2. Replace common separators with spaces

  title = title.replace(/[\._-]/g, ' ').replace(/\s{2,}/g, ' '); // 3. Trim extra whitespace

  return title.trim();
};

// Function to get episode/season information
const getEpisodeInfo = (
  fileName: string,
): { season: number; episode: number } => {
  // Try SxxExx
  let match = fileName.match(/s(\d{1,3})e(\d{1,3})/i);
  if (match) {
    return { season: parseInt(match[1], 10), episode: parseInt(match[2], 10) };
  } // Try "Episode Y" or "Ep Y"

  match = fileName.match(/(?:episode|ep)[\s._-]*(\d{1,3})/i);
  if (match) {
    let seasonMatch = fileName.match(/season[\s._-]*(\d{1,3})/i);
    const season = seasonMatch ? parseInt(seasonMatch[1], 10) : 1;
    return { season, episode: parseInt(match[1], 10) };
  } // Try finding a number at the end, often used for single-digit episode

  match = fileName.match(/[\s._-](\d{1,3})[\s._-]*$/);
  if (match) {
    return { season: 1, episode: parseInt(match[1], 10) };
  } // Default case

  return { season: 0, episode: 0 }; // Use 0 for "not an episode"
};

const Downloads = () => {
  const insets = useSafeAreaInsets();
  // Existing state for app-managed download files
  const [downloadFiles, setDownloadFiles] = useState<MediaItem[]>([]);
  // State for externally selected files (multiple selection support)
  const [externalFiles, setExternalFiles] = useState<MediaItem[]>([]);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  // NEW: State to manage the visual dimming effect during deletion
  const [isDeleting, setIsDeleting] = useState(false);

  const { primary } = useThemeStore(state => state);
  // groupSelected now tracks selected individual file URIs (can include external URIs)

  const [groupSelected, setGroupSelected] = useState<string[]>([]);
  const [isSelecting, setIsSelecting] = useState(false);

  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const getFiles = useCallback(async () => {
    setLoading(true);
    const granted = await requestStoragePermission();

    // --- 1. Load Managed Downloads (Requires Storage Permission) ---
    if (granted) {
      try {
        const properPath =
          Platform.OS === 'android'
            ? `file://${downloadFolder}`
            : downloadFolder;

        const allFiles = await FileSystem.readDirectoryAsync(properPath);

        const videoFiles = allFiles.filter(file => isVideoFile(file));

        const filesInfo = await Promise.all(
          videoFiles.map(async file => {
            const filePath =
              Platform.OS === 'android'
                ? `file://${downloadFolder}/${file}`
                : `${downloadFolder}/${file}`;

            const fileInfo = await FileSystem.getInfoAsync(filePath);
            // Map FileSystem.FileInfo to our custom MediaItem structure
            if (fileInfo.exists) {
              return {
                uri: fileInfo.uri,
                title: getReadableTitle(file.split('/').pop() || ''),
                size: fileInfo.size || 0,
                isManagedDownload: true,
              } as MediaItem;
            }
            return null;
          }),
        );

        const validFiles = filesInfo.filter((f): f is MediaItem => f !== null);
        // Save managed files (already exists)

        downloadsStorage.saveFilesInfo(validFiles);
        setDownloadFiles(validFiles);
      } catch (error) {
        console.error('Error reading managed files:', error);
        setDownloadFiles([]); // Clear if read fails
      }
    } else {
      setDownloadFiles([]); // Clear if permission denied
    }

    // --- 2. Load External File References from Storage (Persistence) ---
    try {
      // FIX: Ensure correct use of await for the now-async storage function
      const persistedExternal = await downloadsStorage.getExternalFiles();
      setExternalFiles(persistedExternal);
    } catch (error) {
      console.error('Error loading external file references:', error);
      setExternalFiles([]);
    }

    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      getFiles();
      return () => {
        setGroupSelected([]);
        setIsSelecting(false);
        setIsDeleting(false); // Reset deletion state on blur
      };
    }, [getFiles]),
  );

  async function getThumbnail(fileUri: string) {
    // Only attempt to get thumbnails for app-managed local files for reliability
    // expo-video-thumbnails may not handle 'content://' URIs from DocumentPicker
    if (!fileUri.startsWith('file:///')) return null;

    try {
      const fileName = fileUri.split('/').pop();
      if (!fileName || !isVideoFile(fileName)) {
        return null;
      }

      const { uri } = await VideoThumbnails.getThumbnailAsync(fileUri, {
        time: 100000,
      });
      return uri;
    } catch (error) {
      return null;
    }
  } // Generate and cache thumbnails

  useEffect(() => {
    const getThumbnails = async () => {
      const cachedThumbnails = downloadsStorage.getThumbnails() || {};
      // Only process app-managed downloads for thumbnail generation
      const filesToProcess = downloadFiles.filter(
        file => !cachedThumbnails[file.uri],
      );

      if (filesToProcess.length === 0) {
        setThumbnails(cachedThumbnails);
        return;
      }

      try {
        const thumbnailPromises = filesToProcess.map(async file => {
          const thumbnail = await getThumbnail(file.uri);
          return thumbnail ? { [file.uri]: thumbnail } : null;
        });

        const thumbnailResults = await Promise.all(thumbnailPromises);
        const newThumbnails = thumbnailResults.reduce((acc, curr) => {
          return curr ? { ...acc, ...curr } : acc;
        }, cachedThumbnails);

        downloadsStorage.saveThumbnails(newThumbnails);
        setThumbnails(newThumbnails);
      } catch (error) {
        console.error('Error generating thumbnails:', error);
      }
    };

    getThumbnails();
  }, [downloadFiles]);

  // Real file selection using expo-document-picker
  const handleSelectExternal = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'video/*', // Restricts selection to video MIME types
        copyToCacheDirectory: false, // Important: avoids copying large external files to cache
        multiple: true, // Allows selection of many video files
      });

      if (result.canceled) {
        RNReactNativeHapticFeedback.trigger('notificationWarning');
        return;
      }

      const newSelectedFiles: MediaItem[] = [];
      // Combined list of existing URIs for de-duplication
      const existingUris = new Set(
        [...downloadFiles, ...externalFiles].map(f => f.uri),
      );

      for (const asset of result.assets) {
        if (asset.uri && !existingUris.has(asset.uri)) {
          // Perform a quick check to see if the file reference is still valid
          const fileInfo = await FileSystem.getInfoAsync(asset.uri);
          if (fileInfo.exists) {
            newSelectedFiles.push({
              uri: asset.uri,
              title: getReadableTitle(asset.name),
              size: asset.size || 0,
              isManagedDownload: false, // External file reference
            });
          }
        }
      }

      if (newSelectedFiles.length > 0) {
        setExternalFiles(prev => {
          const updatedList = [...newSelectedFiles, ...prev];
          // FIX: Add defensive check to prevent crash if function is still undefined
          if (downloadsStorage.saveExternalFiles) {
            downloadsStorage.saveExternalFiles(updatedList);
          }
          return updatedList;
        });
        RNReactNativeHapticFeedback.trigger('notificationSuccess');
      } else if (result.assets.length > 0) {
        // Selected files but they were all duplicates or didn't exist
        RNReactNativeHapticFeedback.trigger('notificationWarning');
      }
    } catch (error) {
      console.error('Error selecting external files:', error);
      RNReactNativeHapticFeedback.trigger('notificationError');
    }
  }, [downloadFiles, externalFiles]);

  // Function to delete selected files
  const deleteFiles = async () => {
    const allUrisToDelete = groupSelected;

    if (allUrisToDelete.length === 0) return;

    // 1. START VISUAL DELETION EFFECT
    setIsDeleting(true);
    RNReactNativeHapticFeedback.trigger('impactMedium');

    // Introduce a slight artificial delay to allow the visual dimming to register
    // before the items are removed from the list.
    await new Promise(resolve => setTimeout(resolve, 200));

    try {
      // Separate URIs into managed downloads (actual deletion) and external selections (reference removal)
      const managedUrisToDelete = allUrisToDelete.filter(uri =>
        downloadFiles.some(f => f.uri === uri && f.isManagedDownload),
      );
      const externalUrisToExclude = allUrisToDelete.filter(uri =>
        externalFiles.some(f => f.uri === uri && !f.isManagedDownload),
      );

      // 2. Delete actual files (only managed downloads)
      await Promise.all(
        managedUrisToDelete.map(async fileUri => {
          try {
            const path =
              Platform.OS === 'android'
                ? fileUri.replace('file://', '')
                : fileUri;

            // RNFS.unlink is used for deletion in the managed folder
            await RNFS.unlink(path);
          } catch (error) {
            console.error(`Error deleting managed file ${fileUri}.`, error);
          }
        }),
      );

      // 3. Update state for managed downloads
      const newDownloadFiles = downloadFiles.filter(
        file => !managedUrisToDelete.includes(file.uri),
      );
      setDownloadFiles(newDownloadFiles);
      downloadsStorage.saveFilesInfo(newDownloadFiles);

      // 4. Update state for external files (simply remove reference)
      const newExternalFiles = externalFiles.filter(
        file => !externalUrisToExclude.includes(file.uri),
      );
      setExternalFiles(newExternalFiles);
      // FIX: Add defensive check to prevent crash if function is still undefined
      if (downloadsStorage.saveExternalFiles) {
        downloadsStorage.saveExternalFiles(newExternalFiles);
      }

      // 5. Update thumbnails
      const newThumbnails = { ...thumbnails };
      managedUrisToDelete.forEach(uri => delete newThumbnails[uri]);
      setThumbnails(newThumbnails);
      downloadsStorage.saveThumbnails(newThumbnails);

      // 6. Reset selection states and complete visual effect
      setGroupSelected([]);
      setIsSelecting(false);
      setIsDeleting(false);
      RNReactNativeHapticFeedback.trigger('notificationSuccess');
    } catch (error) {
      console.error('Overall error deleting files:', error);
      setIsDeleting(false); // Ensure state resets on error
      RNReactNativeHapticFeedback.trigger('notificationError');
    }
  };

  // Combined list for rendering (Downloads + External Selections)
  const allMediaItems: MediaItem[] = useMemo(() => {
    // Ensure external files are marked correctly
    const external = externalFiles.map(f => ({ ...f, isManagedDownload: false }));
    // Ensure download files are marked correctly
    const downloads = downloadFiles.map(f => ({ ...f, isManagedDownload: true }));
    // Display downloads first, then external files
    return [...downloads, ...external];
  }, [downloadFiles, externalFiles]);

  // Function to handle a single item selection/deselection
  const toggleSelection = (fileUri: string) => {
    const isCurrentlySelected = groupSelected.includes(fileUri);

    if (settingsStorage.isHapticFeedbackEnabled()) {
      RNReactNativeHapticFeedback.trigger('effectTick');
    }

    if (isCurrentlySelected) {
      const newSelection = groupSelected.filter(f => f !== fileUri);
      setGroupSelected(newSelection);
      if (newSelection.length === 0) {
        setIsSelecting(false);
      }
    } else {
      setGroupSelected([...groupSelected, fileUri]);
    }
  };

  // Function to handle item press (navigation)
  const handleItemPress = (item: MediaItem) => {
    if (isSelecting) {
      toggleSelection(item.uri);
    } else {
      // If it's a file URI (local download), prepend file:// if necessary
      // If it's a content URI (external selection), use it directly
      const directUrl =
        item.uri.startsWith('file://') || item.uri.startsWith('content://')
          ? item.uri
          : `file://${item.uri}`;

      navigation.navigate('Player', {
        episodeList: [{ title: item.title, link: directUrl }],
        linkIndex: 0,
        type: 'download',
        directUrl: directUrl,
        primaryTitle: item.title,
        poster: thumbnails[item.uri] ? { poster: thumbnails[item.uri] } : {},
        providerValue: 'doodle',
      });
    }
  };

  return (
    <View className="px-2 w-full h-full bg-black" style={{ paddingTop: insets.top + 10 }}>
      <View className="flex-row justify-between items-center mb-4">
        <Text className="text-2xl text-white">Downloads</Text>
        <View className="flex-row gap-x-7 items-center">
          {/* Button calls the real file picker using expo-document-picker */}
          {!isSelecting && (
            <TouchableOpacity onPress={handleSelectExternal} className="p-1">
              <MaterialCommunityIcons
                name="folder-plus-outline"
                size={28}
                color={primary}
              />
            </TouchableOpacity>
          )}

          {isSelecting && (
            <TouchableOpacity
              onPress={() => {
                setGroupSelected([]);
                setIsSelecting(false);
                setIsDeleting(false); // Ensure deletion state is off when canceling
              }}>
              <MaterialCommunityIcons name="close" size={28} color={primary} />
            </TouchableOpacity>
          )}

          {isSelecting && groupSelected.length > 0 && (
            <TouchableOpacity onPress={deleteFiles}>
              <MaterialCommunityIcons
                name="delete-outline"
                size={28}
                color={primary}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        data={allMediaItems}
        numColumns={3}
        ListEmptyComponent={() =>
          !loading && (
            <View className="flex-1 justify-center items-center mt-10">
              <Text className="text-center text-lg text-white opacity-80">
                Looks Empty Here!
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => {
          const isSelected = isSelecting && groupSelected.includes(item.uri);
          // NEW: Check if this item is selected AND we are in the deletion phase
          const isDimmingForDeletion = isDeleting && isSelected;

          const fileName = item.uri.split('/').pop() || '';
          const episodeInfo = getEpisodeInfo(fileName);
          const isEpisode = episodeInfo.episode > 0;
          const episodeLabel = isEpisode ? `E${episodeInfo.episode}` : '';

          return (
            <TouchableOpacity
              key={item.uri}
              // Use an array for style to combine dynamic border and the new opacity effect
              style={[
                { flex: 1 },
                { borderColor: isSelected ? primary : 'transparent' },
                isDimmingForDeletion && { opacity: 0.3 }, // Dim selected items briefly during delete action
              ]}
              className={`flex-1 m-0.5 rounded-lg overflow-hidden border-2 ${isSelected
                ? 'bg-quaternary/50'
                : 'border-transparent bg-tertiary'
                }`}
              onLongPress={() => {
                if (!isSelecting) {
                  RNReactNativeHapticFeedback.trigger('impactHeavy');
                  setIsSelecting(true);
                  setGroupSelected([item.uri]);
                }
              }}
              onPress={() => handleItemPress(item)}>
              <View className="relative aspect-[2/3]">
                {/* THUMBNAIL RENDERING LOGIC */}
                {thumbnails[item.uri] ? (
                  /* Display generated thumbnail */
                  <Image
                    source={{ uri: thumbnails[item.uri] }}
                    className="w-full h-full rounded-lg"
                    resizeMode="cover"
                  />
                ) : (
                  /* Display fallback icon (since content:// URIs don't support thumbnail generation) */
                  <View className="w-full h-full bg-quaternary rounded-lg justify-center items-center">
                    <MaterialCommunityIcons
                      /* Different icons for managed vs. external files */
                      name={item.isManagedDownload ? 'movie-roll' : 'video-box'}
                      size={40}
                      color="gray"
                    />
                  </View>
                )}

                {/* EPISODE NUMBER CIRCLE */}
                {isEpisode && (
                  <View
                    // FIX: Using 'style' for the dynamic border color
                    style={{ borderColor: primary }}
                    className={`absolute top-1 left-1 bg-black/70 rounded-full w-8 h-8 justify-center items-center border`}>
                    <Text className="text-white text-xs font-bold">
                      {episodeLabel}
                    </Text>
                  </View>
                )}

                {/* EXTERNAL FILE BADGE */}
                {!item.isManagedDownload && (
                  <View
                    className={`absolute top-1 right-1 bg-purple-700/70 rounded-full px-2 py-0.5 justify-center items-center border border-purple-500`}>
                    <Text className="text-white text-[10px] font-bold">
                      EXTERNAL
                    </Text>
                  </View>
                )}

                {/* SELECTION CHECKMARK */}
                {isSelecting && (
                  <View className="absolute top-1 left-1">
                    <MaterialCommunityIcons
                      name="check-circle"
                      size={28}
                      color={primary}
                    />
                  </View>
                )}

                {/* TITLE BAR */}
                <View className="absolute bottom-0 left-0 right-0 bg-black/70 p-1 rounded-b-lg">
                  <Text
                    className="text-white text-xs font-bold"
                    numberOfLines={1}>
                    {item.title}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
};

export default Downloads;