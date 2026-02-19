import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// --- Supabase Client Initialization ---
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
// Ensure these environment variables are correctly loaded in your Expo/React Native setup
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase URL or Anon Key is missing in environment variables.');
  // Potentially throw an error or handle this gracefully in a production app
}
const supabase = createClient(supabaseUrl, supabaseAnonKey);


// --- Backend API Communication ---
// FIX: Changed API_BASE_URL to include '/v1' to match backend index.js routing https://replayd-app-backend.vercel.app/api
const API_BASE_URL = 'https://replayd-app-backend.vercel.app/api'; // <-- CRITICAL FIX

// Add a default timeout duration (e.g., 10 seconds)
const API_TIMEOUT = 10000; // 10 seconds in milliseconds

export const getAuthToken = async () => {
  return await AsyncStorage.getItem('userToken');
};

export const setAuthToken = async (token) => {
  if (token) {
    await AsyncStorage.setItem('userToken', token);
  } else {
    await AsyncStorage.removeItem('userToken');
  }
};

const authenticatedFetch = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  console.log("Fetching URL:", url); // For debugging
  
  const token = await getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // --- Timeout logic ---
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), API_TIMEOUT);

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal // Associate the signal with the fetch request
    });

    clearTimeout(id); // Clear the timeout if the fetch completes
    
    if (!response.ok) {
      // Attempt to parse error as JSON, but if it's HTML, catch the error
      const errorText = await response.text(); // Get raw text first
      let errorData;
      try {
        errorData = JSON.parse(errorText); // Try to parse as JSON
      } catch (e) {
        // If it's not JSON (e.g., HTML error page), use a generic message
        errorData = { message: `Server responded with ${response.status} ${response.statusText}. Response was not valid JSON.` };
        console.error("Non-JSON error response from server (HTML or malformed JSON):", errorText); // Log the HTML for inspection
      }
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    clearTimeout(id); // Ensure timeout is cleared even on error

    if (error.name === 'AbortError') {
      console.error(`API Error on ${options.method || 'GET'} ${endpoint}: Request timed out after ${API_TIMEOUT / 1000} seconds`);
      throw new Error(`Network request timed out. Please check your connection or server.`);
    } else if (error instanceof TypeError && error.message === 'Failed to fetch') {
      // This specific error often means no network connection or server unreachable
      console.error(`API Error on ${options.method || 'GET'} ${endpoint}: TypeError: Failed to fetch (likely network issue or incorrect BASE_URL)`);
      throw new Error(`Could not connect to the server. Please check your internet connection and ensure the server is running.`);
    }
    console.error(`API Error on ${options.method || 'GET'} ${endpoint}:`, error);
    throw error; // Re-throw the original error
  }
};


export const api = {
  // --- Search Function (Now uses Supabase Directly) ---
  searchMusicBrainz: async (query) => {
    try {
      const { data, error } = await supabase
        .from('mb_curated_recordings')
        .select('*')
        // This uses the 'fts' column you created for fast, simple search
        .textSearch('fts', `'${query}'`, {
          type: 'websearch',
          config: 'simple'
        })
        .limit(20);

      if (error) throw error;
      
      // Map the data to ensure property names are consistent for the frontend
      return data.map(song => ({
        ...song,
        artist_name: song.primary_artist_name,
        release_group_name: song.primary_release_group_name,
      }));

    } catch (error) {
      console.error('Error searching Supabase:', error);
      throw new Error('Failed to search songs.');
    }
  },

  // All other functions still talk to your backend API
  register: (email, password, username) => authenticatedFetch('/auth/register', { method: 'POST', body: JSON.stringify({ email, password, username }) }),
  login: (email, password) => authenticatedFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  logout: () => setAuthToken(null),
  getUserProfile: () => authenticatedFetch('/users/profile'),
  updateUserProfile: (profileData) => authenticatedFetch('/users/profile', { method: 'PUT', body: JSON.stringify(profileData) }),
  archiveSong: (songData) => authenticatedFetch('/music/archive-song', { method: 'POST', body: JSON.stringify(songData) }),
  getUserFeed: () => authenticatedFetch('/music/user-feed'),
  getMyPlaylists: () => authenticatedFetch('/playlists/my'),
  getMyLibraryDetails: () => authenticatedFetch('/music/my-library-details'),
  getPlaylistDetails: (playlistId) => authenticatedFetch(`/playlists/${playlistId}`),
  createPlaylist: (playlistData) => authenticatedFetch('/playlists', { method: 'POST', body: JSON.stringify(playlistData) }),
  updatePlaylist: (playlistId, updates) => authenticatedFetch(`/playlists/${playlistId}`, { method: 'PUT', body: JSON.stringify(updates) }),
  addSongsToPlaylist: (playlistId, song_ids) => authenticatedFetch(`/playlists/${playlistId}/songs`, { method: 'POST', body: JSON.stringify({ song_ids }) }),
  deletePlaylist: (playlistId) => authenticatedFetch(`/playlists/${playlistId}`, { method: 'DELETE' }),
  getPublicPlaylists: () => authenticatedFetch('/playlists/public'),
  getRecentBillboardChart: () => authenticatedFetch('/music/billboard/recent'),
  getSpecificBillboardChart: (date) => authenticatedFetch(`/music/billboard/date/${date}`),
  getValidBillboardDates: () => authenticatedFetch('/music/billboard/valid-dates'),
  getArtistDetails: (mbArtistId) => authenticatedFetch(`/music/artist/${mbArtistId}`),
  getArtistSongs: (mbArtistId) => authenticatedFetch(`/music/artist/${mbArtistId}/songs`),
};