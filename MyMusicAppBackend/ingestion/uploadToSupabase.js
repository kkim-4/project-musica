const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const BATCH_SIZE = 500;

async function uploadFile(tableName, filePath) {
  console.log(`\nUploading data for table: ${tableName}`);
  
  if (!fs.existsSync(filePath)) {
    console.warn(`Warning: File not found at ${filePath}. Skipping.`);
    return;
  }
  
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  console.log(`Found ${data.length} rows to upload.`);

  if (data.length === 0) {
    return;
  }

  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    const batch = data.slice(i, i + BATCH_SIZE);
    console.log(`Uploading batch ${i / BATCH_SIZE + 1} of ${Math.ceil(data.length / BATCH_SIZE)}...`);
    
    const { error } = await supabase.from(tableName).insert(batch, { returning: 'minimal' });

    if (error) {
      console.error(`Error uploading batch to ${tableName}:`, error);
      throw new Error(`Failed to upload to ${tableName}.`); 
    }
  }
  console.log(`Successfully uploaded all data to ${tableName}!`);
}

async function main() {
  const dataDir = path.join(__dirname, 'exported_popular_mb_data');
  
  try {
    console.log("Starting Supabase upload process...");
    
    // The script now assumes the tables have already been cleared.
    await uploadFile('mb_curated_artists', path.join(dataDir, 'mb_curated_artists.json'));
    await uploadFile('mb_curated_tags', path.join(dataDir, 'mb_curated_tags.json'));
    await uploadFile('mb_curated_release_groups', path.join(dataDir, 'mb_curated_release_groups.json'));
    await uploadFile('mb_curated_recordings', path.join(dataDir, 'mb_curated_recordings.json'));
    
    console.log("\nAll uploads complete!");
  } catch (error) {
    console.error("\nAn error occurred during the upload process. Halting.", error.message);
  }
}

main();