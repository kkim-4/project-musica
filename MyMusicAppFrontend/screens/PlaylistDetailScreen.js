import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Alert, Image, TouchableOpacity, Switch, RefreshControl, Platform } from 'react-native'; // <-- Platform imported here
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api, getAuthToken } from '../utils/api';
// --- ULTIMATE ROBUST JWT-DECODE IMPORT ---
import * as jwtDecodeLibrary from 'jwt-decode';
// --- END ULTIMATE ROBUST JWT-DECODE IMPORT ---
import { COLORS } from '../constants/theme'; // Assuming COLORS is defined here

const PlaylistDetailScreen = ({ route, navigation }) => {
  const { playlistId } = route.params;
  const [playlist, setPlaylist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);

  const loadPlaylistData = useCallback(async () => {
    try {
      const token = await getAuthToken();
      if (token) {
        let decodeFunction;
        if (typeof jwtDecodeLibrary.jwtDecode === 'function') {
          decodeFunction = jwtDecodeLibrary.jwtDecode;
        } else if (typeof jwtDecodeLibrary.default === 'function') {
          decodeFunction = jwtDecodeLibrary.default;
        } else if (typeof jwtDecodeLibrary === 'function') {
          decodeFunction = jwtDecodeLibrary;
        } else {
          console.error("Critical Error: jwt-decode function not found.");
          throw new Error("Failed to initialize JWT decoder.");
        }
        setCurrentUserId(decodeFunction(token).id);
      }
      
      const details = await api.getPlaylistDetails(playlistId);
      setPlaylist(details);

    } catch (error) {
      Alert.alert("Error", `Could not load playlist: ${error.message}`);
      setPlaylist(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [playlistId]);

  useFocusEffect(useCallback(() => { setLoading(true); loadPlaylistData(); }, [loadPlaylistData]));
  
  const onRefresh = useCallback(() => { setRefreshing(true); loadPlaylistData(); },[loadPlaylistData]);

  const handleTogglePublicStatus = async (newValue) => {
    if (!playlist) return;
    try {
      const updated = await api.updatePlaylist(playlist.id, { is_public: newValue });
      setPlaylist(updated.playlist);
      Alert.alert("Success", `Playlist is now ${newValue ? 'Public' : 'Private'}.`);
    } catch (error) {
      Alert.alert("Error", "Could not update playlist status.");
    }
  };

  const isCurrentUserCreator = currentUserId && playlist?.user_id === currentUserId;

  if (loading && !refreshing) {
    return <View style={styles.loaderContainer}><ActivityIndicator size="large" color={COLORS.textPrimary} /></View>;
  }

  if (!playlist) {
    return (
        <View style={styles.container}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                <Ionicons name="chevron-back" size={32} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.noDataText}>Playlist not found or you do not have permission to view it.</Text>
        </View>
    );
  }

  const renderPlaylistSong = ({ item }) => (
    <View style={styles.songItem}>
      <Image source={item.album_art_url ? { uri: item.album_art_url } : require('../assets/default-album-art.png')} style={styles.albumArt} />
      <View style={styles.songInfo}>
        <Text style={styles.songTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.songArtist} numberOfLines={1}>{item.artist_name}</Text>
        {item.display_album_name ? <Text style={styles.songAlbumName} numberOfLines={1}>{item.display_album_name}</Text> : null}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
       <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={32} color={COLORS.textPrimary} />
        </TouchableOpacity>
      <FlatList
        ListHeaderComponent={
          <>
            <Text style={styles.title}>{playlist.name}</Text>
            {playlist.description ? <Text style={styles.description}>{playlist.description}</Text> : null}
            {!isCurrentUserCreator && <Text style={styles.creatorText}>By {playlist.creator_username}</Text>}
            
            {isCurrentUserCreator && (
              <View style={styles.controlsContainer}>
                <View style={styles.publicToggleContainer}>
                  <Text style={styles.publicToggleLabel}>Public Playlist</Text>
                  <Switch 
                    onValueChange={handleTogglePublicStatus} 
                    value={playlist.is_public}
                    trackColor={{ false: COLORS.inactive, true: COLORS.accent }} // Custom track colors
                    thumbColor={Platform.OS === 'android' ? COLORS.textPrimary : ''} // White thumb for Android
                  />
                </View>
              </View>
            )}
            <Text style={styles.subtitle}>Songs</Text>
          </>
        }
        data={playlist.songs}
        renderItem={renderPlaylistSong}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={styles.noDataText}>This playlist is empty.</Text>}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.textPrimary} colors={[COLORS.textPrimary]} />}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60, backgroundColor: COLORS.primary }, // Navy background
  loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.primary }, // Navy background
  backButton: { position: 'absolute', top: 55, left: 10, zIndex: 1, padding: 5 },
  title: { fontSize: 28, fontWeight: 'bold', textAlign: 'center', marginHorizontal: 40, marginTop: 10, color: COLORS.textPrimary }, // White text
  description: { fontSize: 16, color: COLORS.inactive, textAlign: 'center', marginTop: 5, marginBottom: 15 }, // Light grey text
  creatorText: { fontSize: 14, color: COLORS.inactive, fontStyle: 'italic', textAlign: 'center', marginBottom: 20 }, // Light grey text
  controlsContainer: { paddingHorizontal: 20, marginVertical: 15 },
  publicToggleContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 15, backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: 10 }, // Darker background for toggle
  publicToggleLabel: { fontSize: 16, color: COLORS.textPrimary }, // White text
  subtitle: { fontSize: 22, fontWeight: 'bold', paddingHorizontal: 20, marginTop: 10, marginBottom: 5, color: COLORS.textPrimary }, // White text
  songItem: { flexDirection: 'row', alignItems: 'center', padding: 10, marginHorizontal: 15, borderBottomWidth: 1, borderBottomColor: 'rgba(255, 255, 255, 0.1)' }, // Light separator
  albumArt: { width: 50, height: 50, borderRadius: 4, marginRight: 15, backgroundColor: 'rgba(255, 255, 255, 0.1)' }, // Light background for art
  songInfo: { flex: 1 },
  songTitle: { fontSize: 16, fontWeight: '500', color: COLORS.textPrimary }, // White text
  songArtist: { fontSize: 14, color: COLORS.inactive }, // Light grey text
  songAlbumName: { fontSize: 12, color: COLORS.inactive }, // Light grey text
  noDataText: { padding: 20, textAlign: 'center', color: COLORS.inactive }, // Light grey text
});

export default PlaylistDetailScreen;