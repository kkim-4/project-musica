import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Image, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../utils/api';
import { COLORS } from '../constants/theme'; 

const SongItem = ({ item }) => (
    <View style={styles.songItem}>
        <Image
            source={item.album_art_url ? { uri: item.album_art_url } : require('../assets/default-album-art.png')}
            style={styles.songAlbumArt}
        />
        <View style={styles.songDetails}>
            <Text style={styles.songTitle} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.songArtist} numberOfLines={1}>
                {/* Ensure item.primary_artist_name is used if that's what backend sends */}
                {/* Assuming release_date is formatted as (YYYY) or similar if available */}
                {item.primary_artist_name || item.artist_name} {item.release_date ? `(${item.release_date})` : ''}
            </Text>
        </View>
    </View>
);

const HomeScreen = ({ navigation }) => {
    const [feed, setFeed] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchFeed = useCallback(async () => {
        try {
            const feedData = await api.getUserFeed();
            
            // --- CRUCIAL DEBUGGING LOGS ---
            console.log("HomeScreen: Fetched feed data (first 5 items):", feedData.slice(0, 5));
            console.log("HomeScreen: Total feed items fetched:", feedData.length);
            // --- END CRUCIAL DEBUGGING LOGS ---

            // --- TEMPORARY TEST: LIMIT TO FEWER ITEMS FOR RENDERING ---
            // If 1000 items is too much, try rendering only 20 or 50 first
            const limitedFeedData = feedData.slice(0, 50); // Adjust this limit as needed for testing
            setFeed(limitedFeedData);
            // --- END TEMPORARY TEST ---

            // Original: setFeed(feedData); // This line is now commented out for testing
        } catch (error) {
            console.error("HomeScreen: Failed to fetch feed:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            setLoading(true);
            fetchFeed();
        }, [fetchFeed])
    );

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchFeed();
    }, [fetchFeed]);

    if (loading && !refreshing) {
        return (
            <View style={styles.loaderContainer}>
                <ActivityIndicator size="large" color={COLORS.textPrimary} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <FlatList
                ListHeaderComponent={<Text style={styles.feedTitle}>From Your Artists</Text>}
                data={feed}
                renderItem={({ item }) => <SongItem item={item} />}
                // Ensure keyExtractor uses a unique string ID from your data
                keyExtractor={(item) => item.mb_recording_id || item.id || Math.random().toString()}
                style={styles.feedList}
                ListEmptyComponent={
                    // Only show empty message if not loading and feed is truly empty
                    !loading && !refreshing && feed.length === 0 ? (
                        <Text style={styles.emptyFeedText}>Add songs to playlists to build your feed!</Text>
                    ) : null
                }
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.textPrimary]} tintColor={COLORS.textPrimary}/>}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.primary, // Changed back to navy
    },
    loaderContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.primary, // Changed back to navy
    },
    feedTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        marginTop: 20,
        marginBottom: 10,
        paddingHorizontal: 20,
        color: COLORS.textPrimary, // Changed back to white
    },
    feedList: {
        flex: 1,
    },
    songItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.1)', // Changed to a light separator
    },
    songAlbumArt: {
        width: 50,
        height: 50,
        borderRadius: 5,
        marginRight: 15,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
    songDetails: {
        flex: 1,
    },
    songTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.textPrimary,
    },
    songArtist: {
        fontSize: 14,
        color: COLORS.inactive,
        marginTop: 3,
    },
    emptyFeedText: {
        textAlign: 'center',
        marginTop: 50,
        fontSize: 16,
        color: COLORS.inactive,
    },
});

export default HomeScreen;