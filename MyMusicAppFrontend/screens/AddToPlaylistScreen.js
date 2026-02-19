import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TextInput, Button, Alert, TouchableOpacity, Switch } from 'react-native';
import { api } from '../utils/api';
import { Ionicons } from '@expo/vector-icons';

const AddToPlaylistScreen = ({ route, navigation }) => {
  const { songsToAdd = [] } = route.params || {};
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState(null);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [showNewPlaylistForm, setShowNewPlaylistForm] = useState(false);

  useEffect(() => {
    const fetchPlaylists = async () => {
      setLoading(true);
      try {
        const myPlaylists = await api.getMyPlaylists();
        setPlaylists(myPlaylists);
      } catch (error) {
        Alert.alert("Error", "Could not load your playlists: " + error.message);
      } finally {
        setLoading(false);
      }
    };
    fetchPlaylists();
  }, []);

  const handleCreateNewPlaylist = async () => {
    if (!newPlaylistName.trim()) return Alert.alert("Error", "Playlist name cannot be empty.");
    setLoading(true);
    try {
      const response = await api.createPlaylist({ name: newPlaylistName, is_public: isPublic });
      setPlaylists(prev => [response.playlist, ...prev]);
      setSelectedPlaylistId(response.playlist.id);
      setShowNewPlaylistForm(false);
      setNewPlaylistName('');
      setIsPublic(false);
      Alert.alert("Success", `Playlist "${response.playlist.name}" created and selected!`);
    } catch (error) {
      Alert.alert("Error", "Could not create playlist: " + error.message);
    } finally {
      setLoading(false);
    }
  };
  
  const handleAddSongsToSelectedPlaylist = async () => {
    if (!selectedPlaylistId) return Alert.alert("No Playlist Selected", "Please select a playlist.");
    if (songsToAdd.length === 0) return Alert.alert("No Songs", "No songs to add.");

    setLoading(true);
    try {
      const archivePromises = songsToAdd.map(song => 
        api.archiveSong({
            title: song.title, artist_name: song.artist_name, mb_recording_id: song.mb_recording_id,
            mb_artist_id: song.mb_artist_id, mb_release_group_id: song.mb_release_group_id,
            album_art_url: song.album_art_url, release_date: song.release_date
        })
      );
      const archivedResponses = await Promise.all(archivePromises);
      const songIdsForPlaylist = archivedResponses.map(res => res.song.id);

      await api.addSongsToPlaylist(selectedPlaylistId, songIdsForPlaylist);
      Alert.alert("Success", `${songIdsForPlaylist.length} song(s) added to playlist!`);
      navigation.goBack();
    } catch (error) {
      Alert.alert("Error", `Could not add songs: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
       <TouchableOpacity style={styles.cancelButton} onPress={() => navigation.goBack()}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Add to Playlist</Text>
      <Text style={styles.subtitle}>{songsToAdd.length} song(s) selected</Text>

      <Button title={showNewPlaylistForm ? "Cancel" : "+ Create New Playlist"} onPress={() => setShowNewPlaylistForm(p => !p)} />

      {showNewPlaylistForm && (
        <View style={styles.newPlaylistForm}>
          <TextInput style={styles.input} placeholder="New Playlist Name" value={newPlaylistName} onChangeText={setNewPlaylistName} />
          <View style={styles.switchContainer}>
              <Text>Make Public</Text>
              <Switch value={isPublic} onValueChange={setIsPublic} />
          </View>
          <Button title="Create and Select" onPress={handleCreateNewPlaylist} disabled={loading} />
        </View>
      )}

      {loading && playlists.length === 0 ? <ActivityIndicator/> : 
        <FlatList
            data={playlists}
            renderItem={({ item }) => (
            <TouchableOpacity style={[styles.playlistItem, item.id === selectedPlaylistId && styles.selectedPlaylist]} onPress={() => setSelectedPlaylistId(item.id)}>
                <Ionicons name={item.is_public ? 'globe-outline' : 'lock-closed-outline'} size={20} color="gray" />
                <Text style={styles.playlistName}>{item.name}</Text>
                <Ionicons name={item.id === selectedPlaylistId ? "radio-button-on" : "radio-button-off"} size={24} color="#673ab7" />
            </TouchableOpacity>
            )}
            keyExtractor={item => item.id}
            style={styles.playlistsList}
        />
      }
      
      <TouchableOpacity style={[styles.bottomButton, (!selectedPlaylistId || loading) && styles.disabledButton]} onPress={handleAddSongsToSelectedPlaylist} disabled={!selectedPlaylistId || loading}>
          <Text style={styles.bottomButtonText}>Add to Selected Playlist</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
    container: { flex: 1, paddingTop: 50, paddingHorizontal: 20, backgroundColor: '#fff' },
    cancelButton: { position: 'absolute', top: 60, right: 20, zIndex: 1, padding: 5 },
    cancelButtonText: { fontSize: 16, color: '#673ab7' },
    title: { fontSize: 28, fontWeight: 'bold', textAlign: 'center', marginBottom: 5 },
    subtitle: { fontSize: 16, textAlign: 'center', color: 'gray', marginBottom: 20 },
    newPlaylistForm: { marginVertical: 15, backgroundColor: '#f5f5f5', padding: 15, borderRadius: 10 },
    input: { borderWidth: 1, borderColor: '#ddd', padding: 12, marginBottom: 15, borderRadius: 8, backgroundColor: '#fff', fontSize: 16 },
    switchContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    playlistsList: { width: '100%', marginTop: 15 },
    playlistItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9f9f9', padding: 15, marginVertical: 5, borderRadius: 10, borderWidth: 2, borderColor: 'transparent' },
    selectedPlaylist: { borderColor: '#673ab7' },
    playlistName: { fontSize: 18, flex: 1, marginLeft: 10, marginRight: 10 },
    bottomButton: { backgroundColor: '#673ab7', padding: 15, borderRadius: 30, alignItems: 'center', marginVertical: 10 },
    disabledButton: { backgroundColor: '#c7b2e6' },
    bottomButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
});

export default AddToPlaylistScreen;