import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, FlatList, ActivityIndicator,
  TouchableOpacity, Image, RefreshControl, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../utils/api';
import { COLORS } from '../constants/theme';
import { useNavigation } from '@react-navigation/native'; // Import useNavigation

const SearchScreen = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const navigation = useNavigation(); // Get navigation object

  const handleSearch = useCallback(async () => {
    if (query.trim() === '') {
      setResults([]);
      return;
    }
    setLoading(true);
    setInitialLoad(false);
    try {
      const searchResults = await api.searchMusicBrainz(query);
      setResults(searchResults);
    } catch (error) {
      console.error('Search failed:', error);
      Alert.alert('Search Error', error.message || 'Failed to perform search.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [query]);

  useFocusEffect(
    useCallback(() => {
      // Potentially clear search on focus or re-fetch based on requirements
      // For now, only fetch if not initial load and query is present
      if (!initialLoad && query.trim() !== '') {
          handleSearch();
      }
      return () => {
        // Optional cleanup
      };
    }, [query, initialLoad, handleSearch])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    handleSearch();
  }, [handleSearch]);

  const renderSongItem = ({ item }) => (
    <View style={styles.songItem}>
      <Image
        source={{ uri: item.album_art_url || 'https://via.placeholder.com/100/CCCCCC/808080?text=No+Art' }}
        style={styles.albumArt}
      />
      <View style={styles.songDetails}>
        <Text style={styles.songTitle} numberOfLines={1}>{item.title}</Text>
        {/* FIX START: Make artist name clickable */}
        <TouchableOpacity
  onPress={() =>
    navigation.navigate('ArtistDetail', {
      mbArtistId: item.primary_artist_id,
      artistName: item.artist_name,
    })
  }
>
  <Text style={styles.artistName} numberOfLines={1}>
    {item.artist_name}
  </Text>
</TouchableOpacity>
        {/* FIX END */}
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
    <View style={styles.container}>
      <Text style={styles.title}>Search Music</Text>
      <View style={styles.searchBar}>
        <Ionicons name="search" size={24} color={COLORS.inactive} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search songs or artists..."
          placeholderTextColor={COLORS.inactive}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
        {loading && <ActivityIndicator size="small" color={COLORS.accent} style={styles.spinner} />}
      </View>

      {initialLoad ? (
        <View style={styles.initialLoadContainer}>
          <Text style={styles.initialLoadText}>Start typing to search for music!</Text>
          <Ionicons name="musical-notes-outline" size={80} color={COLORS.inactive} />
        </View>
      ) : results.length > 0 ? (
        <FlatList
          data={results}
          renderItem={renderSongItem}
          keyExtractor={(item) => item.mb_recording_id}
          style={styles.list}
          contentContainerStyle={styles.listContentContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.textPrimary} colors={[COLORS.textPrimary]} />}
        />
      ) : (
        <View style={styles.noResultsContainer}>
          <Text style={styles.noResultsText}>No results found for "{query}".</Text>
          <Ionicons name="sad-outline" size={80} color={COLORS.inactive} />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 20, // Adjust as needed
    backgroundColor: COLORS.primary,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: COLORS.textPrimary,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF', // White background for search bar
    borderRadius: 10,
    paddingHorizontal: 15,
    marginHorizontal: 20,
    marginBottom: 20,
    height: 50,
  },
  searchIcon: {
    marginRight: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.1)', // Light background for icon
    padding: 5,
    borderRadius: 5,
  },
  searchInput: {
    flex: 1,
    color: COLORS.textContrast,
    fontSize: 16,
  },
  spinner: {
    marginLeft: 10,
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
  artistName: {
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
  initialLoadContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  initialLoadText: {
    fontSize: 18,
    color: COLORS.inactive,
    textAlign: 'center',
    marginBottom: 20,
  },
  noResultsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  noResultsText: {
    fontSize: 18,
    color: COLORS.inactive,
    textAlign: 'center',
    marginBottom: 20,
  },
});

export default SearchScreen;