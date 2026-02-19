// MyMusicAppBackend/db.js
const { MongoClient } = require('mongodb');
const { Pool } = require('pg');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

// Ensure environment variables are loaded from the root .env file
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

let mongoClient;
let mongoDb;
let pgPoolMusicBrainz; // Renamed for clarity: PostgreSQL pool for MusicBrainz
let supabaseClientAnon;
let supabaseClientService;

/**
 * Connects to all necessary databases.
 * Designed to be called once on application startup in serverless environments.
 * It is idempotent, meaning it won't try to reconnect if already connected.
 * Errors during connection will be logged but will not cause process.exit(1)
 * to allow for more graceful startup or retries on subsequent requests.
 */
async function connectDatabases() {
  // --- Connect to MongoDB Atlas ---
  if (!mongoClient || !mongoClient.topology || !mongoClient.topology.isConnected()) {
    try {
      console.log('Attempting to connect to MongoDB Atlas...');
      mongoClient = new MongoClient(process.env.DATABASE_URL); // Ensure DATABASE_URL is correct in Vercel env vars
      await mongoClient.connect();
      mongoDb = mongoClient.db(); // Assumes DB name is in the connection string
      console.log(`Connected to MongoDB Atlas (User & Playlists DB): ${mongoDb.databaseName}`);
    } catch (error) {
      console.error("Failed to connect to MongoDB Atlas during initialization:", error);
      // Reset clients so subsequent calls will retry
      mongoClient = null;
      mongoDb = null;
      // Re-throw the error so `initializeApp` in index.js can catch it
      throw error;
    }
  }

  // --- Conditionally Connect to MusicBrainz PostgreSQL Database ---
  // Only attempt connection if ENABLE_MUSICBRAINZ_DB is explicitly 'true'
  if (process.env.ENABLE_MUSICBRAINZ_DB === 'true' && !pgPoolMusicBrainz) {
      try {
          console.log('Attempting to connect to MusicBrainz PostgreSQL...'); // This log will only appear if ENABLE_MUSICBRAINZ_DB is 'true'
          pgPoolMusicBrainz = new Pool({
            host: process.env.MUSICBRAINZ_DB_HOST,
            port: parseInt(process.env.MUSICBRAINZ_DB_PORT || '5432', 10),
            user: process.env.MUSICBRAINZ_DB_USER,
            password: process.env.MUSICBRAINZ_DB_PASSWORD,
            database: process.env.MUSICBRAINZ_DB_NAME,
            ssl: process.env.MUSICBRAINZ_DB_SSLMODE === 'disable' ? false : undefined // Use undefined for default SSL behavior
          });
          // Test the connection
          await pgPoolMusicBrainz.query('SELECT 1');
          console.log("Connected to MusicBrainz PostgreSQL Database!");
      } catch (error) {
          console.error("Failed to connect to MusicBrainz PostgreSQL Database:", error);
          pgPoolMusicBrainz = null; // Reset pool to retry on next attempt
          // DO NOT process.exit(1) here if this DB is not strictly critical for app startup
          throw error; // Re-throw to propagate, let main app decide criticality
      }
  } else if (process.env.ENABLE_MUSICBRAINZ_DB !== 'true') {
      console.log('Skipping MusicBrainz PostgreSQL connection (ENABLE_MUSICBRAINZ_DB not true).');
  }


  // --- Initialize Supabase Clients ---
  // Ensure SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY are clean in Vercel env vars
  if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY && !supabaseClientAnon) {
    try {
      console.log('Initializing Supabase Anon Client...');
      supabaseClientAnon = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
      // Optional: Test Supabase connection if there's a simple query
      // const { data, error } = await supabaseClientAnon.from('some_table').select('*').limit(1);
      // if (error) throw error;
      console.log("Initialized Supabase Client (Anon Key)!");
    } catch (error) {
      console.error("Failed to initialize Supabase Client (Anon Key):", error);
      supabaseClientAnon = null;
      throw error;
    }
  }
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY && !supabaseClientService) {
    try {
      console.log('Initializing Supabase Service Client...');
      supabaseClientService = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
      console.log("Initialized Supabase Client (Service Role Key)!");
    } catch (error) {
      console.error("Failed to initialize Supabase Service Client (Service Role Key):", error);
      supabaseClientService = null;
      throw error;
    }
  }
}

/**
 * Gets the connected MongoDB instance. If not connected, attempts to reconnect.
 * @returns {Db} The MongoDB database instance.
 * @throws {Error} If MongoDB connection cannot be established.
 */
async function getMongoDb() {
  if (!mongoDb || !mongoClient || !mongoClient.topology || !mongoClient.topology.isConnected()) {
    console.warn("MongoDB connection requested but not active. Attempting to reconnect...");
    try {
      await connectDatabases(); // This will attempt to connect only if not already connected
    } catch (error) {
      throw new Error(`MongoDB connection failed on demand: ${error.message}`);
    }
  }
  return mongoDb;
}

/**
 * Gets the MusicBrainz PostgreSQL connection pool. If not connected, attempts to reconnect.
 * @returns {Pool} The PostgreSQL connection pool.
 * @throws {Error} If PostgreSQL pool is not initialized or connection failed.
 */
async function getMusicBrainzDbPool() {
    if (!pgPoolMusicBrainz) {
        console.warn("MusicBrainz DB pool requested but not initialized. Attempting to connect (if enabled)...");
        try {
            await connectDatabases(); // This will attempt to connect only if not already connected AND enabled
        } catch (error) {
            throw new Error(`MusicBrainz DB pool initialization failed on demand: ${error.message}`);
        }
        // After attempting to connect, if it's still null, it means it's disabled or failed.
        if (!pgPoolMusicBrainz) {
            throw new Error("MusicBrainz DB pool is not enabled or failed to connect.");
        }
    }
    return pgPoolMusicBrainz;
};

/**
 * Executes a query against the MusicBrainz PostgreSQL database.
 * @param {string} text - The SQL query text.
 * @param {Array<any>} params - Parameters for the query.
 * @returns {Promise<QueryResult>} Query result.
 * @throws {Error} If the DB pool is not initialized or query fails.
 */
async function queryMusicBrainz(text, params) {
    const pool = await getMusicBrainzDbPool(); // Ensure pool is ready
    const client = await pool.connect();
    try {
        return await client.query(text, params);
    } finally {
        client.release();
    }
};

function getSupabaseClientAnon() {
  if (!supabaseClientAnon) {
    console.warn("Supabase Anon client requested but not initialized. Check Supabase env vars and app startup.");
    // Decide if you want to throw or return null/undefined. Throwing makes issues explicit.
    throw new Error("Supabase Anon client not initialized.");
  }
  return supabaseClientAnon;
}

function getSupabaseClientService() {
  if (!supabaseClientService) {
    console.warn("Supabase Service client requested but not initialized. Check Supabase env vars and app startup.");
    throw new Error("Supabase Service client not initialized.");
  }
  return supabaseClientService;
}

module.exports = {
  connectDatabases,
  getMongoDb,
  queryMusicBrainz,
  getMusicBrainzDbPool, // Exporting pool directly for advanced use cases if needed
  getSupabaseClientAnon,
  getSupabaseClientService,
};