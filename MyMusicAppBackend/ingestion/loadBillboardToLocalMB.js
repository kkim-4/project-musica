// MyMusicAppBackend/ingestion/loadBillboardToLocalMB.js
const { Pool } = require('pg');
const fs = require('fs');
const readline = require('readline');
const path = require('path');

// FIX START: Ensure dotenv loads and confirm variables
const dotenvResult = require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

if (dotenvResult.error) {
    console.error("ERROR: Failed to load .env file:", dotenvResult.error);
    process.exit(1); // Exit if .env can't be loaded
}
// Check if the variable is defined *after* dotenv attempts to load
if (!process.env.MUSICBRAINZ_LOCAL_DB_URL) {
    console.error("ERROR: MUSICBRAINZ_LOCAL_DB_URL is not defined in your .env file!");
    console.error("Please ensure your .env file is in the MyMusicAppBackend directory and contains MUSICBRAINZ_LOCAL_DB_URL.");
    process.exit(1);
}
// DEBUG LOG: Reconfirm the value after explicit check
console.log('DEBUG (loadBillboardToLocalMB.js): MUSICBRAINZ_LOCAL_DB_URL:', process.env.MUSICBRAINZ_LOCAL_DB_URL);
// FIX END

// PostgreSQL Pool for local MusicBrainz DB
const poolMusicBrainzDb = new Pool({
  connectionString: process.env.MUSICBRAINZ_LOCAL_DB_URL,
});

const BILLBOARD_API_BASE_URL = 'https://raw.githubusercontent.com/mhollingshead/billboard-hot-100/main';
let popularBillboardSongsMap = new Map();

async function loadBillboardData() {
    console.log("Starting to load Billboard data into local MusicBrainz DB...");
    try {
        // --- ADDED THIS SECTION TO HANDLE LOCAL DB CONNECTION HERE ---
        const client = await poolMusicBrainzDb.connect();
        try {
            await client.query(`
                CREATE TABLE IF NOT EXISTS billboard_charts (
                    date TEXT PRIMARY KEY,
                    chart_data JSONB NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_billboard_charts_date ON billboard_charts (date);
            `);
            console.log("Checked/created billboard_charts table in local MusicBrainz DB.");
        } finally {
            client.release();
        }
        // --- END ADDED SECTION ---

        const response = await fetch(`${BILLBOARD_API_BASE_URL}/all.json`);
        if (!response.ok) {
            throw new Error(`Failed to fetch Billboard all charts: ${response.status}`);
        }
        const allCharts = await response.json();

        if (!allCharts || !Array.isArray(allCharts)) {
            throw new Error("Billboard API returned invalid data (not an array of charts).");
        }

        let insertedCount = 0;
        const insertClient = await poolMusicBrainzDb.connect(); // Get client for inserts
        try {
            for (const chart of allCharts) {
                const { date, data } = chart;
                const query = `
                    INSERT INTO billboard_charts (date, chart_data)
                    VALUES ($1, $2::jsonb)
                    ON CONFLICT (date) DO UPDATE SET
                        chart_data = EXCLUDED.chart_data;
                `;
                await insertClient.query(query, [date, JSON.stringify(data)]);
                insertedCount++;
                if (insertedCount % 100 === 0) {
                    console.log(`Processed ${insertedCount} charts...`);
                }
            }
            console.log(`Finished loading Billboard data. Total charts processed/upserted: ${insertedCount}`);
        } finally {
            insertClient.release();
        }
    } catch (error) {
        console.error("Fatal error loading Billboard data to local MB DB:", error);
        throw error; // Re-throw to propagate failure
    } finally {
        // Do not end pool here if main() needs it later
    }
}

async function main() {
    try {
        await loadBillboardData();
        // This script focuses only on loading Billboard data to local MB DB.
        // It does not proceed with the JSON dump ingestion to Supabase itself.
        // The previous code had a mix where this script tried to do both.
        // The exportCuratedMusicBrainzToSupabase.js script should call loadBillboardPopularityData,
        // but this script (loadBillboardToLocalMB.js) should only focus on its job.
        console.log("Billboard data loaded into local MusicBrainz DB successfully.");
    } catch (e) {
        console.error("Fatal error during Billboard data load to local MB DB:", e);
    } finally {
        poolMusicBrainzDb.end(); // Ensure pool is ended after main script completes
    }
}

main().catch(console.error);