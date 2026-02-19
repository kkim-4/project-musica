import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, Text, StyleSheet, Image, FlatList, ActivityIndicator, Alert, 
  RefreshControl, SafeAreaView, TouchableOpacity 
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../utils/api';
import { COLORS } from '../constants/theme';

const ArtistDetailScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { mbArtistId, artistName } = route.params;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [artistDetails, setArtistDetails] = useState(null);
  const [artistSongs, setArtistSongs] = useState([]);

  const fetchArtistData = useCallback(async () => {
    setLoading(true);
    try {
      const details = await api.getArtistDetails(mbArtistId);
      setArtistDetails(details);

      const songs = await api.getArtistSongs(mbArtistId);
      setArtistSongs(songs);
    } catch (error) {
      console.error(`Failed to fetch data for artist ${artistName}:`, error);
      Alert.alert('Error', `Failed to load details for ${artistName}.`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [mbArtistId, artistName]);

  useEffect(() => {
    fetchArtistData();
  }, [fetchArtistData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchArtistData();
  }, [fetchArtistData]);

  const renderSongItem = ({ item }) => (
    <View style={styles.songItem}>
      <Image
        source={{ uri: item.album_art_url || 'https://via.placeholder.com/100/CCCCCC/808080?text=No+Art' }}
        style={styles.albumArt}
      />
      <View style={styles.songDetails}>
        <Text style={styles.songTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.artistNameSmall} numberOfLines={1}>{item.artist_name}</Text>
        {item.release_group_name && <Text style={styles.albumName} numberOfLines={1}>{item.release_group_name}</Text>}
      </View>
      <View style={styles.chartInfo}>
        {item.billboard_peak_pos && <Text style={styles.chartStat}>Peak: {item.billboard_peak_pos}</Text>}
        {item.billboard_weeks_on_chart && <Text style={styles.chartStat}>WOC: {item.billboard_weeks_on_chart}</Text>}
        {item.app_popularity && <Text style={styles.chartStat}>App Pop: {item.app_popularity}</Text>}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeAreaContainer}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={28} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.artistNameHeader}>{artistName}</Text>
        <View style={{ width: 28 }} /> {/* Placeholder for alignment */}
      </View>

      {loading && !refreshing ? (
        <ActivityIndicator size="large" color={COLORS.textPrimary} style={styles.loader} />
      ) : (
        <FlatList
          ListHeaderComponent={() => (
            <>
              <View style={styles.profilePictureContainer}>
                {artistDetails?.profile_picture_url ? (
                  <Image source={{ uri: artistDetails.profile_picture_url }} style={styles.profilePicture} />
                ) : (
                  <Ionicons name="person-circle-outline" size={120} color={COLORS.inactive} style={styles.blankProfileIcon} />
                )}
              </View>
              {artistSongs.length > 0 && (
                <Text style={styles.songsHeader}>Popular Songs by {artistName}</Text>
              )}
            </>
          )}
          data={artistSongs}
          renderItem={renderSongItem}
          keyExtractor={(item) => item.mb_recording_id}
          style={styles.list}
          contentContainerStyle={styles.listContentContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.textPrimary} colors={[COLORS.textPrimary]} />
          }
          ListEmptyComponent={() => (
            <Text style={styles.noDataText}>No popular songs found for this artist.</Text>
          )}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeAreaContainer: {
    flex: 1,
    backgroundColor: COLORS.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 15,
    backgroundColor: COLORS.primary,
  },
  backButton: {
    padding: 5,
  },
  artistNameHeader: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    textAlign: 'center',
    flex: 1,
  },
  profilePictureContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  profilePicture: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: COLORS.inputBackground,
    borderWidth: 2,
    borderColor: COLORS.inactive,
  },
  blankProfileIcon: {
    marginBottom: 10,
  },
  songsHeader: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginLeft: 20,
    marginTop: 20,
    marginBottom: 10,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    width: '100%',
  },
  listContentContainer: {
    paddingBottom: 20,
  },
  songItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  albumArt: {
    width: 60,
    height: 60,
    borderRadius: 5,
    marginRight: 15,
  },
  songDetails: {
    flex: 1,
  },
  songTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  artistNameSmall: {
    fontSize: 14,
    color: COLORS.inactive,
    marginTop: 2,
  },
  albumName: {
    fontSize: 12,
    color: COLORS.inactive,
    marginTop: 2,
  },
  chartInfo: {
    alignItems: 'flex-end',
    marginLeft: 10,
  },
  chartStat: {
    fontSize: 12,
    color: COLORS.inactive,
  },
  noDataText: {
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
    color: COLORS.inactive,
    paddingHorizontal: 20,
  },
});

export default ArtistDetailScreen;
