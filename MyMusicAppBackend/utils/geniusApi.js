// MyMusicAppBackend/utils/geniusApi.js
require('dotenv').config();

const GENIUS_CLIENT_ACCESS_TOKEN = process.env.GENIUS_CLIENT_ACCESS_TOKEN;
const GENIUS_API_BASE_URL = 'https://api.genius.com';

const commonHeaders = {
  'Authorization': `Bearer ${GENIUS_CLIENT_ACCESS_TOKEN}`,
};

const makeGeniusRequest = async (path) => {
  if (!GENIUS_CLIENT_ACCESS_TOKEN) {
    throw new Error("Genius API Token is not configured in .env");
  }
  try {
    const response = await fetch(`${GENIUS_API_BASE_URL}${path}`, {
      headers: commonHeaders,
    });
    if (!response.ok) {
      const errorData = await response.json();
      console.error(`Genius API Error for ${path}:`, errorData);
      throw new Error(`Genius API Error: ${response.status} - ${errorData.meta.message || 'Unknown error'}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch from Genius API:', error);
    throw error;
  }
};

const searchGenius = async (query) => {
  return makeGeniusRequest(`/search?q=${encodeURIComponent(query)}`);
};

const getSongDetails = async (songId) => {
  return makeGeniusRequest(`/songs/${songId}`);
};

module.exports = { searchGenius, getSongDetails };