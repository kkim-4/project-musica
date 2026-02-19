// MyMusicAppBackend/dbMusicBrainz.js
const { Pool } = require('pg');
require('dotenv').config();

const poolMusicBrainz = new Pool({
  connectionString: process.env.MUSICBRAINZ_DATABASE_URL,
  // ssl: { rejectUnauthorized: false }
});

module.exports = {
  query: (text, params) => poolMusicBrainz.query(text, params),
};