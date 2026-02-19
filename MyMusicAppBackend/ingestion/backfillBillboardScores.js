// ingestion/backfillBillboardScores.js

const { queryMusicBrainz, connectDatabases, getMusicBrainzDbPool } = require('../db');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const BILLBOARD_API_BASE_URL = 'https://raw.githubusercontent.com/mhollingshead/billboard-hot-100/main';

async function loadBillboardData() {
    console.log("Loading Billboard popularity data...");
    const response = await fetch(`${BILLBOARD_API_BASE_URL}/all.json`);
    if (!response.ok) throw new Error("Failed to fetch Billboard data");
    
    const allCharts = await response.json();
    const songPopularity = new Map();

    for (const chart of allCharts) {
        for (const item of chart.data) {
            const key = `${item.song}_BY_${item.artist}`.toLowerCase();
            const current = songPopularity.get(key) || { total_weeks: 0, best_peak_pos: Infinity };
            songPopularity.set(key, {
                total_weeks: current.total_weeks + 1,
                best_peak_pos: Math.min(current.best_peak_pos, item.peak_position)
            });
        }
    }
    console.log(`Loaded ${songPopularity.size} unique songs from Billboard charts.`);
    return songPopularity;
}

async function main() {
    await connectDatabases();
    const pool = getMusicBrainzDbPool();
    const billboardData = await loadBillboardData();

    console.log("Starting backfill process...");
    let updatedCount = 0;
    const batchSize = 100; // Process in batches to be kind to the DB

    const allBillboardSongs = Array.from(billboardData.entries());

    for (let i = 0; i < allBillboardSongs.length; i += batchSize) {
        const batch = allBillboardSongs.slice(i, i + batchSize);
        
        const updatePromises = batch.map(async ([key, pop]) => {
            const [title, artist] = key.split('_by_');
            if (!title || !artist) return;

            // Find the recording in our DB that matches the title and artist
            const { rows } = await pool.query(
                `SELECT r.gid FROM musicbrainz.recording r
                 JOIN musicbrainz.artist_credit ac ON r.artist_credit = ac.id
                 WHERE r.name ILIKE $1 AND ac.name ILIKE $2 LIMIT 1`,
                [title, artist]
            );

            if (rows.length > 0) {
                const recordingGid = rows[0].gid;
                // Update the recording with its Billboard stats
                await pool.query(
                    `UPDATE musicbrainz.recording 
                     SET billboard_peak_pos = $1, billboard_weeks_on_chart = $2 
                     WHERE gid = $3`,
                    [pop.best_peak_pos, pop.total_weeks, recordingGid]
                );
                updatedCount++;
            }
        });
        
        await Promise.all(updatePromises);
        console.log(`Processed batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(allBillboardSongs.length / batchSize)}...`);
    }

    console.log(`Backfill complete! Updated ${updatedCount} recordings with Billboard data.`);
    await pool.end();
}

main().catch(console.error);