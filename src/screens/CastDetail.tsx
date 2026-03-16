import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SearchStackParamList } from '../App';
import Ionicons from '@expo/vector-icons/Ionicons';
import useThemeStore from '../lib/zustand/themeStore';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

type Props = NativeStackScreenProps<SearchStackParamList, 'CastDetail'>;

const TMDB_API_KEY = '9d2bff12ed955c7f1f74b83187f188ae';
const BASE_IMAGE_URL = 'https://image.tmdb.org/t/p/w500';

const CastDetail = ({ route, navigation }: Props) => {
  const { personId, name: initialName } = route.params as any;
  const insets = useSafeAreaInsets();
  const { primary } = useThemeStore();
  const [loading, setLoading] = useState(true);
  const [castData, setCastData] = useState<any>(null);
  const [knownFor, setKnownFor] = useState<any[]>([]);
  const [expandedBio, setExpandedBio] = useState(false);

  useEffect(() => {
    fetchCastDetails();
  }, [personId]);

  const fetchCastDetails = async () => {
    try {
      setLoading(true);
      const res = await fetch(`https://api.themoviedb.org/3/person/${personId}?api_key=${TMDB_API_KEY}&append_to_response=combined_credits`);
      const data = await res.json();
      setCastData(data);
      if (data.combined_credits?.cast) {
        const sorted = data.combined_credits.cast
          .sort((a: any, b: any) => (b.popularity || 0) - (a.popularity || 0))
          .slice(0, 15);
        setKnownFor(sorted);
      }
    } catch (error) {
      console.error('Error fetching cast details:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 bg-black justify-center items-center">
        <ActivityIndicator size="large" color={primary} />
      </View>
    );
  }

  if (!castData) {
      return (
          <View className="flex-1 bg-black justify-center items-center">
              <Text className="text-white">Failed to load actor data.</Text>
          </View>
      )
  }

  return (
    <View className="flex-1 bg-black">
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40, paddingTop: insets.top + 10 }}
      >
        <View className="flex-row items-center px-4 mb-6">
           <TouchableOpacity onPress={() => navigation.goBack()} className="mr-4">
              <Ionicons name="chevron-back" size={28} color="white" />
           </TouchableOpacity>
           <Text className="text-white text-xl font-bold">{castData.name}</Text>
        </View>

        <View className="flex-row px-4 mb-8">
            <Animated.View entering={FadeIn.duration(500)} className="w-1/3">
                <Image 
                    source={{ uri: castData.profile_path ? `${BASE_IMAGE_URL}${castData.profile_path}` : 'https://placehold.jp/24/363636/ffffff/150x150.png?text=Actor' }}
                    className="w-full h-44 rounded-2xl"
                    contentFit="cover"
                />
            </Animated.View>
            <View className="flex-1 ml-4 justify-center">
                <Text className="text-white text-2xl font-bold mb-1">{castData.name}</Text>
                <View className="bg-zinc-800 self-start px-2 py-1 rounded-md mb-3">
                    <Text className="text-gray-400 text-xs font-semibold">{castData.known_for_department || 'Acting'}</Text>
                </View>
                {castData.birthday && (
                    <View className="mb-1">
                        <Text className="text-white text-sm font-bold">Born: <Text className="text-gray-400 font-normal">{castData.birthday}</Text></Text>
                    </View>
                )}
                {castData.place_of_birth && (
                    <View>
                        <Text className="text-white text-sm font-bold">From: <Text className="text-gray-400 font-normal">{castData.place_of_birth}</Text></Text>
                    </View>
                )}
            </View>
        </View>

        <View className="px-4 mb-8">
            <Text className="text-white text-xl font-bold mb-3">Biography</Text>
            <Text 
                className="text-gray-400 text-sm leading-5"
                numberOfLines={expandedBio ? undefined : 6}
            >
                {castData.biography || 'No biography available.'}
            </Text>
            {castData.biography && castData.biography.length > 200 && (
                <TouchableOpacity onPress={() => setExpandedBio(!expandedBio)} className="mt-2">
                    <Text style={{ color: primary }} className="font-bold">
                        {expandedBio ? 'Read Less' : 'Read More'}
                    </Text>
                </TouchableOpacity>
            )}
        </View>

        {knownFor.length > 0 && (
            <View className="mb-8">
                <Text className="text-white text-xl font-bold px-4 mb-4">Known For</Text>
                <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 16 }}
                >
                    {knownFor.map((item: any, index: number) => (
                        <TouchableOpacity 
                            key={item.id} 
                            className="mr-4 w-28"
                            onPress={() => {
                                // Navigate to Info screen
                                // We need the provider logic here or default to tmdb if possible
                                navigation.navigate('Info' as any, {
                                    link: `tmdb_id:${item.id}:${item.media_type || 'movie'}`,
                                    provider: 'tmdb', // Assuming a tmdb provider exists or handling this in Info
                                    poster: `${BASE_IMAGE_URL}${item.poster_path}`
                                });
                            }}
                        >
                            <Animated.View entering={FadeInDown.delay(index * 100)}>
                                <Image 
                                    source={{ uri: item.poster_path ? `${BASE_IMAGE_URL}${item.poster_path}` : 'https://placehold.jp/24/363636/ffffff/100x150.png?text=Doodle' }}
                                    className="w-full h-40 rounded-xl mb-2"
                                    contentFit="cover"
                                />
                                <Text className="text-white text-xs font-semibold" numberOfLines={2}>
                                    {item.title || item.name}
                                </Text>
                                <Text className="text-gray-500 text-[10px]" numberOfLines={1}>
                                    {item.character ? `as ${item.character}` : ''}
                                </Text>
                            </Animated.View>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>
        )}
      </ScrollView>
    </View>
  );
};

export default CastDetail;
