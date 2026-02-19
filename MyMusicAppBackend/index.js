// MyMusicAppBackend/index.js
const express = require('express');
const cors = require('cors'); // Ensure 'cors' package is installed (npm install cors)
require('dotenv').config();

const { connectDatabases } = require('./db');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const musicRoutes = require('./routes/music');
const playlistRoutes = require('./routes/playlists');

const app = express();
// PORT is not used directly on Vercel, but good to keep for local dev
const PORT = process.env.PORT || 3000;

// --- FIX START: Configure CORS properly ---
// Define allowed origins
const allowedOrigins = [
  'https://replayd--fcxi5umif7.expo.app', // Your Expo app's production URL
  'https://replayd--hd2ifnh7p5.expo.app',
  'http://localhost:19006', // Expo Go default port for local development
  'http://localhost:8081', // Another common Expo/React Native dev server port
  'http://localhost:3000', // If you have a separate local web client
  // Add any other origins your frontend might run on
];

const corsOptions = {
  origin: function (origin, callback) {
    // allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE', // Allowed HTTP methods
  credentials: true, // Allow cookies to be sent
  optionsSuccessStatus: 204 // For preflight requests
};

// Apply CORS middleware with options
app.use(cors(corsOptions));
// --- FIX END ---

app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/music', musicRoutes);
app.use('/api/playlists', playlistRoutes);

// Optional: A fallback for unhandled routes (should return JSON, not HTML)
app.use((req, res, next) => {
    res.status(404).json({ message: 'API endpoint not found on this server. Check URL.' });
});

// Optional: Global error handler (should be last app.use)
app.use((err, req, res, next) => {
    console.error("Backend Error:", err.stack);
    res.status(500).json({ message: 'Something broke on the server!', error: err.message });
});

async function initializeApp() {
  try {
    await connectDatabases();
    console.log('Databases connected successfully.');
  } catch (error) {
    console.error('Failed to connect to databases:', error);
  }
}

// Call initialize app immediately
initializeApp();

// Export the app for Vercel's serverless function handler
module.exports = app;