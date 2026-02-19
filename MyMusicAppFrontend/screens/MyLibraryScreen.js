// MyLibraryScreen.js

import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Button, TextInput, TouchableOpacity, Image, RefreshControl, Platform, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api, getAuthToken, setAuthToken } from '../utils/api';
// --- ULTIMATE ROBUST JWT-DECODE IMPORT: Only import the library itself ---
import * as jwtDecodeLibrary from 'jwt-decode'; // Import the entire library under a new name
// --- END ULTIMATE ROBUST JWT-DECODE IMPORT ---
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';

const MyLibraryScreen = ({ navigation }) => {
  const [sections, setSections] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState(null);
  const [newPlaylistName, setNewPlaylistName] = useState('');

  const loadLibraryData = useCallback(async () => {
    try {
      const token = await getAuthToken();
      let currentUserId = null;
      if (token) {
        // --- CRUCIAL USAGE FIX: Determine the decode function at runtime ---
        let decodeFunction;
        if (typeof jwtDecodeLibrary.jwtDecode === 'function') { // Preferred modern named export
          decodeFunction = jwtDecodeLibrary.jwtDecode;
        } else if (typeof jwtDecodeLibrary.default === 'function') { // CommonJS default export
          decodeFunction = jwtDecodeLibrary.default;
        } else if (typeof jwtDecodeLibrary === 'function') { // Some older builds might export directly
          decodeFunction = jwtDecodeLibrary;
        } else {
          // If none of the above work, log a critical error
          console.error("Critical Error: jwt-decode function not found in any expected format. Please check your npm package and bundler configuration.");
          throw new Error("Failed to initialize JWT decoder.");
        }
        
        const decoded = decodeFunction(token); // Use the determined function
        // --- END CRUCIAL USAGE FIX ---

        if (decoded.exp * 1000 > Date.now()) {
          currentUserId = decoded.id;
        } else {
          await setAuthToken(null);
        }
      }

      setUserId(currentUserId);

      let myPlaylists = [];
      let archivedSongs = [];

      if (currentUserId) {
        const [songsData, playlistsData] = await Promise.all([
          api.getMyLibraryDetails(),
          api.getMyPlaylists(),
        ]);
        archivedSongs = songsData;
        myPlaylists = playlistsData;
      }

      const newSections = [
        { type: 'create_playlist', id: 'create_playlist_form' },
        { type: 'header', title: 'Your Playlists', id: 'my_playlists_header' },
        ...(myPlaylists.length > 0 ? myPlaylists.map(p => ({ type: 'playlist', data: p, id: p.id })) : [{ type: 'empty', id: 'empty_playlists', message: 'No playlists yet.' }]),
        { type: 'header', title: 'Your Archived Songs', id: 'archived_songs_header' },
        ...(archivedSongs.length > 0 ? archivedSongs.map(s => ({ type: 'song', data: s, id: s.id })) : [{ type: 'empty', id: 'empty_songs', message: 'No archived songs yet.' }]),
      ];

      setSections(newSections);

    } catch (error) {
      console.error('MyLibraryScreen: Error loading library data:', error);
      Alert.alert('Error', 'Failed to load your library. ' + error.message);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      loadLibraryData();
    }, [loadLibraryData])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadLibraryData();
  }, [loadLibraryData]);

  const createPlaylist = async () => {
    if (!newPlaylistName.trim()) return Alert.alert('Error', 'Playlist name is required.');
    try {
      await api.createPlaylist({ name: newPlaylistName, is_public: false });
      Alert.alert('Success', `Playlist "${newPlaylistName}" created!`);
      setNewPlaylistName('');
      onRefresh();
    } catch (error) {
      Alert.alert('Error', 'Could not create playlist: ' + error.message);
    }
  };

  const renderItem = ({ item }) => {
    switch (item.type) {
      case 'create_playlist':
        if (!userId) return <Text style={styles.noDataText}>Log in to create and manage playlists.</Text>;
        return (
          <View style={styles.createPlaylistForm}>
            <TextInput
              style={styles.input} placeholder="New Playlist Name" value={newPlaylistName}
              onChangeText={setNewPlaylistName}
              placeholderTextColor={COLORS.inactive}
            />
            <Button
              title="Create Playlist"
              onPress={createPlaylist}
              color={Platform.OS === 'ios' ? COLORS.textPrimary : COLORS.accent}
            />
          </View>
        );
      case 'header':
        return <Text style={styles.subtitle}>{item.title}</Text>;
      case 'playlist':
        return (
          <TouchableOpacity
            style={styles.listItem}
            onPress={() => navigation.navigate('PlaylistDetail', { playlistId: item.data.id })}
          >
            <Ionicons
              name={item.data.is_public ? 'globe-outline' : 'lock-closed-outline'}
              size={24} color={COLORS.inactive} style={styles.iconSpacing}
            />
            <Text style={styles.listItemName}>{item.data.name}</Text>
            <Ionicons name="chevron-forward" size={24} color={COLORS.inactive} />
          </TouchableOpacity>
        );
      case 'song':
        return (
          <View style={styles.listItem}>
            <Image
              source={item.data.display_album_art ? { uri: item.data.display_album_art } : require('../assets/default-album-art.png')}
              style={styles.albumArtSmall}
            />
            <View style={styles.songInfo}>
              <Text style={styles.listItemName} numberOfLines={1}>{item.data.display_title}</Text>
              <Text style={styles.listItemSubtext} numberOfLines={1}>
                {item.data.display_artist} {item.data.release_date ? `(${item.data.release_date})` : ''}
              </Text>
            </View>
          </View>
        );
      case 'empty':
        if (!userId) return null;
        return <Text style={styles.noDataText}>{item.message}</Text>;
      default:
        return null;
    }
  };

  if (isLoading && !refreshing) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={COLORS.textPrimary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Library</Text>
      <FlatList
        data={sections}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.textPrimary} />}
        ListEmptyComponent={!isLoading && !refreshing && userId ? <Text style={styles.noDataText}>Start archiving songs and creating playlists!</Text> : null}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.primary, paddingTop: 60 },
  loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.primary },
  title: { fontSize: 32, fontWeight: 'bold', marginBottom: 10, paddingHorizontal: 20, color: COLORS.textPrimary },
  subtitle: { fontSize: 22, fontWeight: 'bold', marginTop: 20, marginBottom: 10, paddingHorizontal: 20, color: COLORS.textPrimary },
  createPlaylistForm: { padding: 20, marginHorizontal: 20, marginBottom: 20, backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: 10 },
  input: { borderWidth: 1, borderColor: COLORS.inactive, padding: 12, marginBottom: 10, borderRadius: 8, color: COLORS.textPrimary, fontSize: 16 },
  noDataText: { paddingHorizontal: 20, color: COLORS.inactive, marginVertical: 10, fontStyle: 'italic', textAlign: 'center' },
  listItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255, 255, 255, 0.1)' },
  albumArtSmall: { width: 50, height: 50, borderRadius: 4, marginRight: 15 },
  songInfo: { flex: 1 },
  listItemName: { fontSize: 18, color: COLORS.textPrimary, flex: 1 },
  listItemSubtext: { fontSize: 14, color: COLORS.inactive, marginTop: 3 },
  iconSpacing: { marginRight: 10 },
});

export default MyLibraryScreen;