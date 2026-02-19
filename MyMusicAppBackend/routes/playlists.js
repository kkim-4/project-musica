// MyMusicAppBackend/routes/playlists.js
const express = require('express');
const { ObjectId } = require('mongodb');
const { getMongoDb, getSupabaseClientAnon } = require('../db'); // Get DB functions, including Supabase client getter
const { authenticateToken, softAuthenticateToken } = require('../middleware/auth');
// Removed: require('dotenv').config(); -> should be in index.js or db.js

const router = express.Router();

// --- STATIC ROUTES FIRST ---

// GET all playlists for the logged-in user
router.get('/my', authenticateToken, async (req, res) => {
  console.log('BACKEND /playlists/my: Received request. User ID:', req.user ? req.user.id : 'N/A');
  try {
    const db = await getMongoDb(); // Correctly AWAITED
    const playlists = await db.collection('playlists').find({ user_id: req.user.id }).sort({ created_at: -1 }).toArray();
    console.log(`BACKEND /playlists/my: Found ${playlists.length} playlists.`);
    res.status(200).json(playlists.map(p => ({ ...p, id: p._id.toHexString() })));
  } catch (error) {
    console.error('BACKEND /playlists/my: Error fetching user playlists:', error);
    res.status(500).json({ message: 'Failed to fetch playlists', error: error.message });
  }
});

// GET all public playlists
router.get('/public', async (req, res) => {
  console.log('BACKEND /playlists/public: Received request.');
  try {
    const db = await getMongoDb(); // Correctly AWAITED
    const publicPlaylists = await db.collection('playlists').find({ is_public: true }).sort({ created_at: -1 }).toArray();
    const creatorIds = publicPlaylists.map(p => new ObjectId(p.user_id));
    const creators = await db.collection('users').find({ _id: { $in: creatorIds } }, { projection: { username: 1 } }).toArray();
    const creatorMap = new Map(creators.map(u => [u._id.toHexString(), u.username]));

    const enrichedPlaylists = publicPlaylists.map(p => ({
      ...p,
      id: p._id.toHexString(),
      creator_username: creatorMap.get(p.user_id) || 'Anonymous',
    }));
    console.log(`BACKEND /playlists/public: Found ${enrichedPlaylists.length} public playlists.`);
    res.status(200).json(enrichedPlaylists);
  } catch (error) {
    console.error('BACKEND /playlists/public: Error fetching public playlists:', error);
    res.status(500).json({ message: 'Failed to fetch public playlists', error: error.message });
  }
});


// --- DYNAMIC ROUTES AFTER ---

// GET a single playlist with full song details (NOW USES SUPABASE FOR MUSICBRAINZ DATA)
router.get('/:id', softAuthenticateToken, async (req, res) => {
    console.log('BACKEND /playlists/:id: Received request for playlist ID:', req.params.id, 'User ID:', req.user ? req.user.id : 'N/A');
    try {
        const { id: playlistId } = req.params;
        if (!ObjectId.isValid(playlistId)) {
            console.log('BACKEND /playlists/:id: Invalid Playlist ID format:', playlistId);
            return res.status(400).json({ message: 'Invalid Playlist ID format.' });
        }
        
        const mongoDb = await getMongoDb(); // FIX: AWAIT the database connection
        const supabase = getSupabaseClientAnon(); // Retrieve Supabase client from db.js
        if (!supabase) { // Defensive check
            throw new new Error("Supabase client is not initialized.");
        }

        const playlist = await mongoDb.collection('playlists').findOne({ _id: new ObjectId(playlistId) });
        if (!playlist) {
            console.log('BACKEND /playlists/:id: Playlist not found:', playlistId);
            return res.status(404).json({ message: 'Playlist not found.' });
        }

        if (!playlist.is_public && playlist.user_id !== req.user?.id) {
            console.log('BACKEND /playlists/:id: Permission denied for playlist:', playlistId, 'by user:', req.user?.id);
            return res.status(403).json({ message: 'You do not have permission to view this playlist.' });
        }
        
        const creator = await mongoDb.collection('users').findOne({ _id: new ObjectId(playlist.user_id) }, { projection: { username: 1 } });
        let detailedSongs = [];

        if (Array.isArray(playlist.songs) && playlist.songs.length > 0) {
            const validSongIds = playlist.songs.filter(id => id && ObjectId.isValid(id)).map(id => new ObjectId(id));
            if (validSongIds.length > 0) {
                const archivedSongs = await mongoDb.collection('songs').find({ _id: { $in: validSongIds } }).toArray();
                const mbRecordingGids = archivedSongs.map(s => s.mb_recording_id).filter(Boolean);

                if (mbRecordingGids.length > 0) {
                    console.log(`BACKEND /playlists/:id: Querying Supabase for ${mbRecordingGids.length} recording GIDs. GIDs:`, mbRecordingGids);
                    const { data: mbDetails, error: supabaseError } = await supabase
                        .from('mb_curated_recordings')
                        .select(`
                            mb_recording_id,
                            title,
                            primary_artist_name,
                            album_art_url,
                            mb_release_group_id
                        `) // Removed app_popularity_score, billboard_peak_pos, billboard_weeks_on_chart, mb_release_group_name
                        .in('mb_recording_id', mbRecordingGids);

                    if (supabaseError) {
                        console.error('BACKEND /playlists/:id: Supabase query error:', supabaseError.message);
                        throw new Error(`Supabase query failed: ${supabaseError.message}`);
                    }
                    
                    const mbDetailsMap = new Map(mbDetails.map(r => [r.mb_recording_id, r]));
                    detailedSongs = archivedSongs.map(song => {
                        const mbDetail = mbDetailsMap.get(song.mb_recording_id);
                        return {
                            id: song._id.toHexString(), 
                            title: mbDetail?.title || song.title,
                            artist_name: mbDetail?.primary_artist_name || song.artist_name,
                            album_art_url: mbDetail?.album_art_url || (mbDetail?.mb_release_group_id ? `https://coverartarchive.org/release-group/${mbDetail.mb_release_group_id}/front-250` : null),
                            mb_recording_id: song.mb_recording_id, // Keep original MB ID
                        };
                    });
                }
            }
        }
        
        res.status(200).json({ 
            ...playlist, 
            id: playlist._id.toHexString(), 
            songs: detailedSongs, 
            creator_username: creator?.username || 'Anonymous' 
        });
    } catch (error) {
        console.error('BACKEND /playlists/:id: Error fetching playlist details:', error);
        res.status(500).json({ message: 'A server error occurred while fetching playlist details.' });
    }
});

// CREATE a new playlist
router.post('/', authenticateToken, async (req, res) => {
  console.log('BACKEND /playlists/: Create new playlist request for user:', req.user ? req.user.id : 'N/A');
  const { name, description, is_public = false } = req.body;
  if (!name) {
    console.log('BACKEND /playlists/: Missing playlist name.');
    return res.status(400).json({ message: 'Playlist name is required.' });
  }
  try {
    const db = await getMongoDb(); // Correctly AWAITED
    const newPlaylist = {
      user_id: req.user.id, name, description,
      is_public, songs: [], created_at: new Date(),
    };
    const result = await db.collection('playlists').insertOne(newPlaylist);
    console.log('BACKEND /playlists/: Playlist created:', result.insertedId.toHexString());
    res.status(201).json({ message: 'Playlist created successfully', playlist: { id: result.insertedId.toHexString(), ...newPlaylist } });
  } catch (error) {
    console.error('BACKEND /playlists/: Error creating playlist:', error);
    res.status(500).json({ message: 'Failed to create playlist', error: error.message });
  }
});

// ADD songs to a playlist
router.post('/:id/songs', authenticateToken, async (req, res) => {
  console.log('BACKEND /playlists/:id/songs: Add songs request for playlist ID:', req.params.id, 'User ID:', req.user ? req.user.id : 'N/A');
  const { song_ids } = req.body;
  if (!Array.isArray(song_ids) || song_ids.length === 0) {
    console.log('BACKEND /playlists/:id/songs: No song_ids provided.');
    return res.status(400).json({ message: 'Array of song_ids is required.' });
  }
  try {
    const db = await getMongoDb(); // Correctly AWAITED
    const playlist = await db.collection('playlists').findOne({ _id: new ObjectId(req.params.id) });
    if (!playlist || playlist.user_id !== req.user.id) {
      console.log('BACKEND /playlists/:id/songs: Unauthorized attempt to add songs to playlist:', req.params.id);
      return res.status(403).json({ message: 'You can only add songs to your own playlists.' });
    }
    await db.collection('playlists').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $addToSet: { songs: { $each: song_ids } } }
    );
    console.log(`BACKEND /playlists/:id/songs: Added ${song_ids.length} songs to playlist ${req.params.id}.`);
    res.status(200).json({ message: `Song(s) added successfully.` });
  } catch (error) {
    console.error('BACKEND /playlists/:id/songs: Error adding songs to playlist:', error);
    res.status(500).json({ message: 'Failed to add songs to playlist', error: error.message });
  }
});

// UPDATE a playlist
router.put('/:id', authenticateToken, async (req, res) => {
  console.log('BACKEND /playlists/:id: Update request for playlist ID:', req.params.id, 'User ID:', req.user ? req.user.id : 'N/A');
  const { name, description, is_public } = req.body;
  if (name === undefined && description === undefined && is_public === undefined) {
    console.log('BACKEND /playlists/:id: No fields provided for update.');
    return res.status(400).json({ message: 'No fields provided for update.' });
  }
  try {
    const db = await getMongoDb(); // Correctly AWAITED
    const playlist = await db.collection('playlists').findOne({ _id: new ObjectId(req.params.id) });
    if (!playlist || playlist.user_id !== req.user.id) {
      console.log('BACKEND /playlists/:id: Unauthorized attempt to update playlist:', req.params.id);
      return res.status(403).json({ message: 'You can only update your own playlists.' });
    }

    const updateFields = {};
    if (name !== undefined) updateFields.name = name;
    if (description !== undefined) updateFields.description = description;
    if (is_public !== undefined) updateFields.is_public = is_public;

    await db.collection('playlists').updateOne({ _id: new ObjectId(req.params.id) }, { $set: updateFields });
    const updatedPlaylist = await db.collection('playlists').findOne({ _id: new ObjectId(req.params.id) });
    console.log('BACKEND /playlists/:id: Playlist updated:', req.params.id);
    res.status(200).json({ message: 'Playlist updated successfully.', playlist: { id: updatedPlaylist._id.toHexString(), ...updatedPlaylist } });
  } catch (error) {
    console.error('BACKEND /playlists/:id: Error updating playlist:', error);
    res.status(500).json({ message: 'Failed to update playlist', error: error.message });
  }
});

// DELETE a playlist
router.delete('/:id', authenticateToken, async (req, res) => {
  console.log('BACKEND /playlists/:id: Delete request for playlist ID:', req.params.id, 'User ID:', req.user ? req.user.id : 'N/A');
  try {
    const db = await getMongoDb(); // Correctly AWAITED
    const playlist = await db.collection('playlists').findOne({ _id: new ObjectId(req.params.id) });
    if (!playlist || playlist.user_id !== req.user.id) {
      console.log('BACKEND /playlists/:id: Unauthorized attempt to delete playlist:', req.params.id);
      return res.status(403).json({ message: 'You can only delete your own playlists.' });
    }
    await db.collection('playlists').deleteOne({ _id: new ObjectId(req.params.id) });
    console.log('BACKEND /playlists/:id: Playlist deleted:', req.params.id);
    res.status(200).json({ message: 'Playlist deleted successfully.' });
  } catch (error) {
    console.error('BACKEND /playlists/:id: Error deleting playlist:', error);
    res.status(500).json({ message: 'Failed to delete playlist', error: error.message });
  }
});

module.exports = router;