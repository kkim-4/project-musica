// MyMusicAppBackend/routes/music.js
const fetch = require('node-fetch');
const express = require('express');
const { ObjectId } = require('mongodb');
const { getMongoDb, getSupabaseClientAnon } = require('../db'); // Get DB functions, including Supabase client getter
const { authenticateToken } = require('../middleware/auth');
// Removed: require('dotenv').config(); -> should be in index.js or db.js

// --- Helper for COALESCE function (for popularity calculation) ---
// Defined only ONCE at the top of the file
const COALESCE = (...args) => args.find(arg => arg !== null && arg !== undefined);
// --- End COALESCE Helper ---

const router = express.Router();

// --- Billboard Routes (Remain unchanged as they hit external API) ---
const BILLBOARD_API_BASE_URL = 'https://raw.githubusercontent.com/mhollingshead/billboard-hot-100/main';

async function fetchBillboardChart(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            const errorText = await response.text();
            if (response.status === 404) throw new Error(`BILLBOARD_CHART_NOT_FOUND: ${url}`);
            throw new Error(`Failed to fetch Billboard data: ${response.status} - ${errorText}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`Backend: Error during Billboard fetch from ${url}:`, error);
        throw error;
    }
}

router.get('/billboard/recent', async (req, res) => {
    try {
        const chartData = await fetchBillboardChart(`${BILLBOARD_API_BASE_URL}/recent.json`);
        res.status(200).json(chartData);
    } catch (error) {
        if (error.message?.startsWith('BILLBOARD_CHART_NOT_FOUND')) {
            return res.status(404).json({ message: `Recent chart not found.` });
        }
        res.status(500).json({ message: 'Failed to fetch recent Billboard chart', error: error.message });
    }
});

router.get('/billboard/date/:date', async (req, res) => {
    const { date } = req.params;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ message: 'Invalid date format. Use YYYY-MM-DD.' });
    }
    try {
        const chartData = await fetchBillboardChart(`${BILLBOARD_API_BASE_URL}/date/${date}.json`);
        res.status(200).json(chartData);
    } catch (error) {
        if (error.message?.startsWith('BILLBOARD_CHART_NOT_FOUND')) {
            return res.status(404).json({ message: `Chart not found for date ${date}` });
        }
        res.status(500).json({ message: `Failed to fetch Billboard chart for date ${date}`, error: error.message });
    }
});

router.get('/billboard/valid-dates', async (req, res) => {
    try {
        const validDates = await fetchBillboardChart(`${BILLBOARD_API_BASE_URL}/valid_dates.json`);
        res.status(200).json(validDates);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch valid Billboard dates', error: error.message });
    }
});

// GET /api/music/artist/:mbArtistId
router.get('/artist/:mbArtistId', async (req, res) => {
    const { mbArtistId } = req.params;

    try {
        const supabase = getSupabaseClientAnon(); // Retrieve Supabase client from db.js
        if (!supabase) { // Defensive check
            throw new Error("Supabase client is not initialized.");
        }

        const { data, error } = await supabase
            .from('mb_curated_recordings')
            .select('primary_artist_id, primary_artist_name') // Add more fields if needed
            .eq('primary_artist_id', mbArtistId)
            .limit(1);

        if (error) {
            console.error(`Error fetching artist details from Supabase:`, error.message);
            return res.status(500).json({ message: 'Failed to fetch artist details', error: error.message });
        }

        if (!data || data.length === 0) {
            return res.status(404).json({ message: 'Artist not found' });
        }

        // Return first matching artist
        res.status(200).json(data[0]);
    } catch (err) {
        console.error('Unexpected error fetching artist details:', err);
        res.status(500).json({ message: 'Server error fetching artist details' });
    }
});

// GET /api/music/artist/:mbArtistId/songs
router.get('/artist/:mbArtistId/songs', async (req, res) => {
    const { mbArtistId } = req.params;

    try {
        const supabase = getSupabaseClientAnon(); // Retrieve Supabase client from db.js
        if (!supabase) { // Defensive check
            throw new Error("Supabase client is not initialized.");
        }

        const { data, error } = await supabase
            .from('mb_curated_recordings')
            .select(`
                mb_recording_id,
                title,
                primary_artist_name,
                mb_release_group_id,
                album_art_url,
                billboard_peak_pos,
                billboard_weeks_on_chart,
                app_popularity
            `)
            .eq('primary_artist_id', mbArtistId)
            .limit(100); // Optional: limit result size

        if (error) {
            console.error('Error fetching artist songs from Supabase:', error.message);
            return res.status(500).json({ message: 'Failed to fetch songs for artist', error: error.message });
        }

        const formatted = data.map(song => ({
            ...song,
            artist_name: song.primary_artist_name,
            album_art_url: song.album_art_url || (song.mb_release_group_id
              ? `https://coverartarchive.org/release-group/${song.mb_release_group_id}/front-250`
              : null),
        }));

        res.status(200).json(formatted);
    } catch (err) {
        console.error('Unexpected error fetching artist songs:', err);
        res.status(500).json({ message: 'Server error fetching artist songs' });
    }
});


// --- User Feed Route (NOW USES SUPABASE FOR MUSICBRAINZ DATA) ---
router.get('/user-feed', authenticateToken, async (req, res) => {
    console.log('BACKEND /user-feed: Received request for user:', req.user ? req.user.id : 'N/A (unauthenticated)');
    const startTime = process.hrtime(); // Start overall timer

    try {
        const mongoDb = await getMongoDb(); // FIX: AWAIT the database connection

        const step1Start = process.hrtime();
        const userPlaylists = await mongoDb.collection('playlists').find({ user_id: req.user.id }).toArray();
        const step1End = process.hrtime(step1Start);
        console.log(`BACKEND /user-feed: Step 1 (MongoDB userPlaylists) completed in ${(step1End[0] * 1000 + step1End[1] / 1e6).toFixed(2)} ms. Count: ${userPlaylists.length}`);

        if (userPlaylists.length === 0) {
            console.log('BACKEND /user-feed: No user playlists found. Returning empty.');
            const overallEnd = process.hrtime(startTime);
            console.log(`BACKEND /user-feed: Overall request finished in ${(overallEnd[0] * 1000 + overallEnd[1] / 1e6).toFixed(2)} ms.`);
            return res.status(200).json([]);
        }
        
        const allSongIds = userPlaylists.flatMap(p => p.songs.map(id => new ObjectId(id)));
        const songsInPlaylists = await mongoDb.collection('songs').find({ _id: { $in: allSongIds } }).toArray();
        
        const artistGids = [...new Set(songsInPlaylists.map(song => song.mb_artist_id).filter(Boolean))];
        
        if (artistGids.length === 0) {
            console.log('BACKEND /user-feed: No artist GIDs found from archived songs. Returning empty.');
            const overallEnd = process.hrtime(startTime);
            console.log(`BACKEND /user-feed: Overall request finished in ${(overallEnd[0] * 1000 + overallEnd[1] / 1e6).toFixed(2)} ms.`);
            return res.status(200).json([]);
        }

        console.log(`BACKEND /user-feed: Querying Supabase for ${artistGids.length} artist GIDs. GIDs:`, artistGids);
        const step2Start = process.hrtime();
        
        const supabase = getSupabaseClientAnon(); // Retrieve Supabase client from db.js
        if (!supabase) { // Defensive check
            throw new Error("Supabase client is not initialized.");
        }

        let query = supabase
            .from('mb_curated_recordings')
            .select(`mb_recording_id,title,primary_artist_name,primary_artist_id,mb_release_group_id,album_art_url,billboard_peak_pos,billboard_weeks_on_chart`);
            
        if (artistGids.length > 0) {
            query = query.in('primary_artist_id', artistGids);
        }
        
        query = query.limit(100); // Set Supabase query limit to 100

        const { data: rawFeedResults, error: supabaseError } = await query;

        if (supabaseError) {
            console.error('Backend /user-feed: Supabase query error:', supabaseError.message);
            throw new Error(`Supabase query failed: ${supabaseError.message}`);
        }

        const step2End = process.hrtime(step2Start);
        console.log(`BACKEND /user-feed: Step 2 (Supabase MusicBrainz query) completed in ${(step2End[0] * 1000 + step2End[1] / 1e6).toFixed(2)} ms. Results: ${rawFeedResults.length}`);
        
        // Calculate popularity score and sort in Node.js
        const feedResultsWithPopularity = rawFeedResults.map(song => {
            const popularity = (COALESCE(song.billboard_weeks_on_chart, 0) * 10) - COALESCE(song.billboard_peak_pos, 101);
            return { ...song, calculated_popularity: popularity };
        });

        const sortedFeedResults = feedResultsWithPopularity.sort((a, b) => b.calculated_popularity - a.calculated_popularity);

        const enhancedResults = sortedFeedResults.slice(0, 50).map(song => ({ // Limit to 50 AFTER sorting
            ...song,
            artist_name: song.primary_artist_name,
            album_art_url: song.album_art_url || (song.mb_release_group_id ? `https://coverartarchive.org/release-group/${song.mb_release_group_id}/front-250` : null),
            display_album_name: null, // mb_release_group_name is not available
        }));
        
        res.status(200).json(enhancedResults);
        console.log(`BACKEND /user-feed: Final enhancedResults count sent to frontend: ${enhancedResults.length}`);
        const overallEnd = process.hrtime(startTime);
        console.log(`BACKEND /user-feed: Overall request finished successfully in ${(overallEnd[0] * 1000 + overallEnd[1] / 1e6).toFixed(2)} ms.`);

    } catch (error) {
        console.error('BACKEND /user-feed: Error generating user feed:', error);
        res.status(500).json({ message: 'Failed to generate user feed', error: error.message });
        const overallEnd = process.hrtime(startTime);
        console.log(`BACKEND /user-feed: Overall request FAILED in ${(overallEnd[0] * 1000 + overallEnd[1] / 1e6).toFixed(2)} ms.`);
    }
});


// Archived Song Routes
router.post('/archive-song', authenticateToken, async (req, res) => {
    console.log('BACKEND /archive-song: Received request for user:', req.user ? req.user.id : 'N/A');
    try {
        const mongoDb = await getMongoDb(); // FIX: AWAIT the database connection
        
        const { title, artist_name, mb_recording_id } = req.body;
        if (!title || !artist_name || !mb_recording_id) {
            console.log('BACKEND /archive-song: Missing required fields.');
            return res.status(400).json({ message: 'Title, artist name, and MusicBrainz Recording ID are required.' });
        }
        
        const supabase = getSupabaseClientAnon(); // Retrieve Supabase client from db.js
        if (!supabase) { // Defensive check
            throw new Error("Supabase client is not initialized.");
        }

        console.log(`BACKEND /archive-song: Fetching mb_artist_id and mb_release_group_id for recording ${mb_recording_id} from Supabase.`);
        const { data: recordingDetails, error: detailsError } = await supabase
            .from('mb_curated_recordings')
            .select('mb_recording_id, primary_artist_id, mb_release_group_id') // Select primary_artist_id and mb_release_group_id
            .eq('mb_recording_id', mb_recording_id)
            .single();

        if (detailsError && detailsError.code !== 'PGRST116') { // PGRST116 is 'No rows found' - handle specifically if recording not found
            console.error('Backend /archive-song: Supabase details fetch error:', detailsError.message);
            throw new Error(`Supabase details fetch failed: ${detailsError.message}`);
        }
        if (!recordingDetails) {
            console.log(`BACKEND /archive-song: MusicBrainz Recording ID ${mb_recording_id} not found in Supabase.`);
            return res.status(404).json({ message: 'MusicBrainz Recording ID not found in curated data.' });
        }
        
        const mb_artist_id = recordingDetails.primary_artist_id;
        const mb_release_group_id = recordingDetails.mb_release_group_id; // Get the release group ID

        console.log(`BACKEND /archive-song: Storing mb_artist_id: ${mb_artist_id} and mb_release_group_id: ${mb_release_group_id} to MongoDB.`);
        const newArchivedSong = { 
            ...req.body, 
            user_id: req.user.id, 
            archived_at: new Date(),
            mb_artist_id: mb_artist_id, // Store the artist ID
            mb_release_group_id: mb_release_group_id // Store release group ID
        };

        console.log('BACKEND /archive-song: Inserting song into MongoDB.');
        const result = await mongoDb.collection('songs').insertOne(newArchivedSong);
        
        console.log('BACKEND /archive-song: Song archived successfully.');
        res.status(201).json({ message: 'Song archived successfully', song: { id: result.insertedId.toHexString(), ...newArchivedSong } });
    } catch (error) {
        console.error('BACKEND /archive-song: Error archiving song:', error);
        if (error.code === 11000) { // MongoDB duplicate key error
            return res.status(409).json({ message: 'This song is already in your library.' });
        }
        res.status(500).json({ message: 'Failed to archive song', error: error.message });
    }
});

router.get('/my-archived-songs', authenticateToken, async (req, res) => {
    console.log('BACKEND /my-archived-songs: Received request for user:', req.user ? req.user.id : 'N/A');
    try {
        const db = await getMongoDb(); // AWAIT the database connection
        console.log('BACKEND /my-archived-songs: Fetching archived songs from MongoDB for user:', req.user.id);
        const result = await db.collection('songs').find({ user_id: req.user.id }).sort({ archived_at: -1 }).toArray();
        console.log(`BACKEND /my-archived-songs: Fetched ${result.length} archived songs from MongoDB.`);
        res.status(200).json(result.map(s => ({ ...s, id: s._id.toHexString() })));
    } catch (error) {
        console.error('Backend /my-archived-songs: Error fetching archived songs:', error);
        res.status(500).json({ message: 'Failed to fetch archived songs', error: error.message });
    }
});


// GET /api/music/my-library-details
router.get('/my-library-details', authenticateToken, async (req, res) => {
    console.log('BACKEND /my-library-details: Request received for user:', req.user ? req.user.id : 'N/A (unauthenticated)');
    const startTime = process.hrtime(); // Start overall timer

    try {
        const mongoDb = await getMongoDb(); // AWAIT the database connection
        const supabase = getSupabaseClientAnon(); // Get the initialized Supabase client

        if (!supabase) {
            throw new Error("Supabase client is not initialized. Check db.js and Vercel env vars.");
        }

        // 1. Get basic archived song info from MongoDB
        const step1Start = process.hrtime();
        const archivedSongs = await mongoDb.collection('songs')
            .find({ user_id: req.user.id })
            .sort({ archived_at: -1 }) // Sort by most recently archived
            .toArray();
        const step1End = process.hrtime(step1Start);
        console.log(`BACKEND /my-library-details: Step 1 (MongoDB archivedSongs) completed in ${(step1End[0] * 1000 + step1End[1] / 1e6).toFixed(2)} ms. Count: ${archivedSongs.length}`);

        if (archivedSongs.length === 0) {
            console.log('BACKEND /my-library-details: No archived songs found. Returning empty.');
            const overallEnd = process.hrtime(startTime);
            console.log(`BACKEND /my-library-details: Overall request finished in ${(overallEnd[0] * 1000 + overallEnd[1] / 1e6).toFixed(2)} ms.`);
            return res.status(200).json([]);
        }

        // 2. Get the MusicBrainz GIDs to look up
        // Filter out any songs that might not have an mb_recording_id
        const mbRecordingGids = archivedSongs.map(s => s.mb_recording_id).filter(Boolean);
        console.log(`BACKEND /my-library-details: Found ${mbRecordingGids.length} MusicBrainz GIDs for lookup.`);

        let rawDetailedMbRecordings = [];
        if (mbRecordingGids.length > 0) {
            // 3. Get all details from Supabase in one query
            const step2Start = process.hrtime();
            const { data, error: supabaseError } = await supabase
                .from('mb_curated_recordings') // Your Supabase table name for MusicBrainz data
                .select(`mb_recording_id,title,primary_artist_name,primary_artist_id,mb_release_group_id,album_art_url,billboard_peak_pos,billboard_weeks_on_chart`)
                .in('mb_recording_id', mbRecordingGids);

            if (supabaseError) {
                console.error('Backend /my-library-details: Supabase query error:', supabaseError.message);
                throw new Error(`Supabase query failed: ${supabaseError.message}`);
            }
            rawDetailedMbRecordings = data || []; // Ensure data is an array
            const step2End = process.hrtime(step2Start);
            console.log(`BACKEND /my-library-details: Step 2 (Supabase MusicBrainz query) completed in ${(step2End[0] * 1000 + step2End[1] / 1e6).toFixed(2)} ms. Results: ${rawDetailedMbRecordings.length}`);
        } else {
            console.log('BACKEND /my-library-details: No MusicBrainz GIDs available, skipping Supabase lookup.');
        }


        // Calculate popularity score and prepare for mapping
        const mbDetailsMap = new Map();
        rawDetailedMbRecordings.forEach(song => {
            // Use nullish coalescing `??` for numbers to ensure 0 is not treated as falsey
            const popularity = ( (song.billboard_weeks_on_chart ?? 0) * 10) - (song.billboard_peak_pos ?? 101);
            mbDetailsMap.set(song.mb_recording_id, { ...song, calculated_popularity: popularity });
        });

        // 4. Combine MongoDB data with Supabase data
        const step3Start = process.hrtime();
        const enrichedSongs = archivedSongs.map(archivedSong => {
            const mbDetail = mbDetailsMap.get(archivedSong.mb_recording_id);
            return {
                id: archivedSong._id.toHexString(), // Convert MongoDB ObjectId to string for frontend
                ...archivedSong, // Include all original MongoDB fields
                // Overlay/use MusicBrainz data if available, otherwise fallback to MongoDB data
                display_title: mbDetail?.title || archivedSong.title,
                display_artist: mbDetail?.primary_artist_name || archivedSong.artist_name,
                display_album_art: mbDetail?.album_art_url || archivedSong.album_art_url,
                display_album_name: mbDetail?.mb_release_group_id || null, // Assuming this maps to album name
                // Add popularity score if available
                popularity_score: mbDetail?.calculated_popularity ?? null,
            };
        });
        const step3End = process.hrtime(step3Start);
        console.log(`BACKEND /my-library-details: Step 3 (Combining data) completed in ${(step3End[0] * 1000 + step3End[1] / 1e6).toFixed(2)} ms.`);

        res.status(200).json(enrichedSongs);
        const overallEnd = process.hrtime(startTime);
        console.log(`BACKEND /my-library-details: Overall request finished successfully in ${(overallEnd[0] * 1000 + overallEnd[1] / 1e6).toFixed(2)} ms.`);

    } catch (error) {
        console.error('BACKEND /my-library-details: Error fetching library details:', error);
        const overallEnd = process.hrtime(startTime);
        console.log(`BACKEND /my-library-details: Overall request FAILED in ${(overallEnd[0] * 1000 + overallEnd[1] / 1e6).toFixed(2)} ms.`);
        res.status(500).json({ message: 'Failed to fetch library details' });
    }
});

module.exports = router;