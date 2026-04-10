import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Image,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  StyleSheet,
  Pressable,
  DeviceEventEmitter,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {userSession, User} from '../lib/services/login';

interface ProfileAvatarProps {
  size?: number;
  editable?: boolean;
  onPhotoChanged?: (uri: string) => void;
  user?: User | null;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('');
}

function getAvatarColor(seed: string): string {
  const colors = ['#e53e3e', '#dd6b20', '#d69e2e', '#38a169', '#319795', '#3182ce', '#805ad5', '#d53f8c'];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export default function ProfileAvatar({
  size = 72,
  editable = true,
  onPhotoChanged,
  user: userProp,
}: ProfileAvatarProps) {
  const user = userProp ?? userSession.getCurrentUser();
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);

  useEffect(() => {
    // In a real app, userSession would have a method getBestPhotoUri
    // For now I'll just use the user object
    setPhotoUri(user?.photo ?? null);
  }, [user?.id]);

  const avatarColor = getAvatarColor(user?.email ?? user?.name ?? 'user');
  const initials = getInitials(user?.name ?? user?.email ?? 'U');

  const pickImage = async () => {
    setMenuVisible(false);
    const {status} = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow gallery access.');
      return;
    }

    setLoading(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        const dataUri = `data:image/jpeg;base64,${result.assets[0].base64}`;
        // userSession.updateProfilePhoto(dataUri); // Implementation depends on MMKV
        setPhotoUri(dataUri);
        onPhotoChanged?.(dataUri);
        DeviceEventEmitter.emit('profilePhotoChanged', dataUri);
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to pick image.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <TouchableOpacity
        onPress={() => editable && setMenuVisible(true)}
        activeOpacity={editable ? 0.8 : 1}
        style={[styles.container, {width: size, height: size, borderRadius: size / 2}]}>
        {photoUri ? (
          <Image source={{uri: photoUri}} style={[styles.image, {borderRadius: size / 2}]} />
        ) : (
          <View style={[styles.initialsCircle, {backgroundColor: avatarColor, borderRadius: size / 2}]}>
            <Text style={[styles.initials, {fontSize: size * 0.4}]}>{initials}</Text>
          </View>
        )}
        {loading && <View style={[styles.loadingOverlay, {borderRadius: size / 2}]}><ActivityIndicator color="#fff" /></View>}
        {editable && !loading && (
          <View style={[styles.editBadge, {width: size * 0.3, height: size * 0.3, borderRadius: size * 0.15}]}>
            <Text style={{fontSize: 10}}>✎</Text>
          </View>
        )}
      </TouchableOpacity>

      <Modal visible={menuVisible} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setMenuVisible(false)}>
          <View style={styles.sheet}>
            <TouchableOpacity style={styles.sheetOption} onPress={pickImage}>
              <Text style={styles.sheetOptionText}>Choose from Library</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sheetCancel} onPress={() => setMenuVisible(false)}>
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { position: 'relative', justifyContent: 'center', alignItems: 'center' },
  image: { width: '100%', height: '100%' },
  initialsCircle: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  initials: { color: '#fff', fontWeight: 'bold' },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  editBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#000' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#1a1a1a', padding: 24, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  sheetOption: { paddingVertical: 16, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#2d2d2d' },
  sheetOptionText: { color: '#fff', fontSize: 16 },
  sheetCancel: { marginTop: 12, paddingVertical: 14, alignItems: 'center' },
  sheetCancelText: { color: '#ef4444', fontSize: 16, fontWeight: 'bold' },
});
