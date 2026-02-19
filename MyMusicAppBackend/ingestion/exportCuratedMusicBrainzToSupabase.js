const { queryMusicBrainz, connectDatabases, getMusicBrainzDbPool } = require('../db');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

async function exportCuratedTable(tableName, dataRows, outputDir) {
    console.log(`Exporting ${tableName}...`);
    if (!dataRows || dataRows.length === 0) {
        console.log(`No data to export for ${tableName}.`);
        return;
    }
    const filePath = path.join(outputDir, `${tableName}.json`);
    fs.writeFileSync(filePath, JSON.stringify(dataRows, null, 2));
    console.log(`Exported ${dataRows.length} rows to ${filePath}`);
}

async function main() {
    await connectDatabases();
    console.log("Starting new popularity-based ingestion process...");

    const outputDir = path.join(__dirname, 'exported_popular_mb_data');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

    const MAX_SONGS_TO_IMPORT = 200000;

    try {
        console.log(`Fetching the top ${MAX_SONGS_TO_IMPORT} most popular unique songs...`);
        const { rows: topSongs } = await queryMusicBrainz(
            `WITH ranked_recordings AS (
                SELECT
                    r.id, r.gid, r.name, r.length, r.comment as disambiguation, r.video,
                    ac.name as primary_artist_name, a.gid as primary_artist_id,
                    r.app_popularity, r.billboard_peak_pos, r.billboard_weeks_on_chart,
                    (COALESCE(r.app_popularity, 0) * 10) + (COALESCE(r.billboard_weeks_on_chart, 0) * 2) - COALESCE(r.billboard_peak_pos, 101) AS composite_popularity
                FROM musicbrainz.recording r
                JOIN musicbrainz.artist_credit ac ON r.artist_credit = ac.id
                JOIN musicbrainz.artist_credit_name acn ON acn.artist_credit = ac.id AND acn.position = 0
                JOIN musicbrainz.artist a ON acn.artist = a.id
            ),
            most_popular_version AS (
                SELECT DISTINCT ON (LOWER(name), LOWER(primary_artist_name)) *
                FROM ranked_recordings
                ORDER BY LOWER(name), LOWER(primary_artist_name), composite_popularity DESC
            ),
            top_popular_songs AS (
                SELECT * FROM most_popular_version
                ORDER BY composite_popularity DESC
                LIMIT $1
            )
            SELECT
                tps.gid AS mb_recording_id, tps.name AS title, tps.length, tps.disambiguation, tps.video,
                tps.primary_artist_name, tps.primary_artist_id,
                tps.app_popularity, tps.billboard_peak_pos, tps.billboard_weeks_on_chart,
                album_info.mb_release_group_id, -- Keep this for general group info if needed
                album_info.mb_earliest_release_id, -- NEW: The specific release GID
                album_info.earliest_release_date,  -- NEW: The year of the earliest release
                (SELECT array_agg(isrc) FROM musicbrainz.isrc WHERE recording = tps.id) as isrcs
            FROM top_popular_songs tps
            LEFT JOIN LATERAL (
                SELECT 
                    rel.gid AS mb_earliest_release_id, -- Select the GID of the specific earliest release
                    rg.gid AS mb_release_group_id,    -- Keep release group ID if needed for other purposes
                    rfrd.year AS earliest_release_date -- Select the earliest release year
                FROM musicbrainz.track t
                JOIN musicbrainz.medium m ON t.medium = m.id
                JOIN musicbrainz.release rel ON m.release = rel.id
                JOIN musicbrainz.release_group rg ON rel.release_group = rg.id -- Join to get release group too
                JOIN musicbrainz.release_meta rm ON rel.id = rm.id -- For cover_art_presence
                LEFT JOIN musicbrainz.recording_first_release_date rfrd ON t.recording = rfrd.recording
                WHERE t.recording = tps.id
                ORDER BY
                    -- 1. Use the release date (year) for primary ordering to find the earliest
                    rfrd.year ASC NULLS LAST,
                    -- 2. Prioritize "Official" releases
                    CASE WHEN rel.status = 1 THEN 0 ELSE 1 END,
                    -- 3. Prioritize releases that HAVE cover art
                    CASE WHEN rm.cover_art_presence = 'present' THEN 0 ELSE 1 END,
                    -- 4. Break ties by smallest release GID (arbitrary, but consistent)
                    rel.gid ASC
                LIMIT 1
            ) AS album_info ON TRUE;
            `, [MAX_SONGS_TO_IMPORT]
        );
        
        const curatedRecordings = topSongs.map(song => ({
            ...song,
            // Construct album_art_url using the specific earliest release GID
            earliest_album_art_url: song.mb_earliest_release_id ? `https://coverartarchive.org/release/${song.mb_earliest_release_id}/front-250` : null,
            // If you still need a fallback for album_art_url based on release_group, you can add it here.
            // For now, only using the earliest release URL.
            album_art_url: song.mb_earliest_release_id ? `https://coverartarchive.org/release/${song.mb_earliest_release_id}/front-250` : null
        }));
        
        await exportCuratedTable('mb_curated_recordings', curatedRecordings, outputDir);

        const artistGids = [...new Set(curatedRecordings.map(r => r.primary_artist_id).filter(Boolean))];
        const releaseGroupGids = [...new Set(curatedRecordings.map(r => r.mb_release_group_id).filter(Boolean))]; // Still collect release group GIDs

        console.log(`Fetching details for ${artistGids.length} unique artists...`);
        const { rows: artistsDetails } = await queryMusicBrainz(
            `SELECT gid as mb_artist_id, name, sort_name, comment as disambiguation, type, gender FROM musicbrainz.artist WHERE gid = ANY($1::uuid[])`,
            [artistGids]
        );
        await exportCuratedTable('mb_curated_artists', artistsDetails, outputDir);

        console.log(`Fetching details for ${releaseGroupGids.length} unique release groups...`);
        const { rows: releaseGroupsDetails } = await queryMusicBrainz(
            `SELECT rg.gid as mb_release_group_id, rg.name as title, rgpt.name as primary_type, rg.comment as disambiguation FROM musicbrainz.release_group rg
             LEFT JOIN musicbrainz.release_group_primary_type rgpt ON rg.type = rgpt.id
             WHERE rg.gid = ANY($1::uuid[])`,
            [releaseGroupGids]
        );
        await exportCuratedTable('mb_curated_release_groups', releaseGroupsDetails, outputDir);

        console.log("Ingestion complete. You can now run the upload script.");

    } catch (e) {
        console.error("Fatal error during ingestion process:", e);
    } finally {
        getMusicBrainzDbPool().end();
    }
}

main().catch(console.error);