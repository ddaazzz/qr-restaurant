/**
 * upload-fld-images.js
 *
 * Uploads the correct source images from the final .fld folder to R2 and updates
 * image_url for every menu item in restaurant 4.
 *
 * Mapping derived from HTML analysis of:
 *   /Users/user/Documents/Chuio/Reference Images/hxj/Menu items for 海鮮家 final.fld/sheet001.html
 *
 * Each DB item (ordered by category sort_order, item sort_order/id) maps to:
 *   .fld image index = first unique image reference in the corresponding HTML row.
 *
 * Some .fld image numbers are skipped (025, 026, 039, 089, 090, 091, 111, 112)
 * because they are secondary/decorative images in the spreadsheet export.
 */

const path = require('path');
const fs   = require('fs');
const crypto = require('crypto');
const { Pool } = require('pg');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
require('dotenv').config();

// ── Config ────────────────────────────────────────────────────────────────────
const FLD_DIR      = '/Users/user/Documents/Chuio/Reference Images/hxj/Menu items for 海鮮家 final.fld';
const RESTAURANT_ID = 4;
const R2_ACCOUNT_ID       = '49f8af5b11822d65e24c84292670d8d3';
const R2_ACCESS_KEY_ID    = 'a45698f5b25fcf2fae23cca898b03397';
const R2_SECRET_ACCESS_KEY= 'd162a98c8e8d884bde23a76840ec0545d533f7cb5456482c7a73f6ac598b26be';
const R2_BUCKET_NAME      = 'chuio-uploads';
// ─────────────────────────────────────────────────────────────────────────────

// Mapping: 1-based data-row index → fld image filename (derived from HTML analysis)
// Rows with skipped numbers are because those image numbers are decorative/spanning
const DATA_ROW_TO_FLD = {
   1:'image001.png',  2:'image002.png',  3:'image003.png',  4:'image004.png',
   5:'image005.png',  6:'image006.png',  7:'image007.png',  8:'image008.png',
   9:'image009.png', 10:'image010.png', 11:'image011.png', 12:'image012.png',
  13:'image013.png', 14:'image014.png', 15:'image015.png', 16:'image016.png',
  17:'image017.png', 18:'image018.png', 19:'image019.png', 20:'image020.png',
  21:'image021.png', 22:'image022.png', 23:'image023.png',
  24:'image024.png', // Sautéed Prawn with Seasonal Green       (025 is decorative)
  25:'image027.png', // Scrambled Egg White with Prawn          (026 is decorative)
  26:'image028.png', // Pan Fried Prawn – Hot
  27:'image029.png', // Sauteed Shrimp with Scrambled Egg
  28:'image030.png', // Stir Fried Scallop & Prawn with Black Truffle & Mushroom
  29:'image031.png', // Stir Fried Scallop with Seasonal Green
  30:'image032.png', // Deep Fried Squid in Spicy Salt
  31:'image033.png', // Baked Twin Lobsters
  32:'image034.png', 33:'image035.png', 34:'image036.png', 35:'image037.png',
  36:'image038.png',
  37:'image040.png', // Marinated Chicken                       (039 is decorative)
  38:'image041.png', 39:'image042.png',
  40:'image043.png', 41:'image044.png', 42:'image045.png', 43:'image046.png',
  44:'image047.png', 45:'image048.png', 46:'image049.png',
  47:'image050.png', 48:'image051.png', 49:'image052.png', 50:'image053.png',
  51:'image054.png', 52:'image055.png', 53:'image056.png', 54:'image057.png',
  55:'image058.png',
  56:'image059.png', 57:'image060.png', 58:'image061.png', 59:'image062.png',
  60:'image063.png', 61:'image064.png', 62:'image065.png', 63:'image066.png',
  64:'image067.png', 65:'image068.png', 66:'image069.png', 67:'image070.png',
  68:'image071.png', 69:'image072.png', 70:'image073.png', 71:'image074.png',
  72:'image075.png', 73:'image076.png', 74:'image077.png', 75:'image078.png',
  76:'image079.png', 77:'image080.png', 78:'image081.png', 79:'image082.png',
  80:'image083.png', 81:'image084.png',
  82:'image085.png', 83:'image086.png', 84:'image087.png',
  85:'image088.png', // Beef Chow Mein                          (089,090 are decorative)
  86:'image092.png', // Shredded Pork Chow Mein                 (091 is decorative)
  87:'image093.png', 88:'image094.png', 89:'image095.png', 90:'image096.png',
  91:'image097.png',
  92:'image098.png', 93:'image099.png', 94:'image100.png', 95:'image101.png',
  96:'image102.png', 97:'image103.png', 98:'image104.png', 99:'image105.png',
 100:'image106.png',101:'image107.png',102:'image108.png',
 103:'image109.png',104:'image110.png',
 105:'image111.png', // Coca-Cola
 106:'image112.png', // Sprite
};

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
});

async function uploadToR2(buffer, filename) {
  const key = `restaurants/${RESTAURANT_ID}/menu/${filename}`;
  await s3.send(new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: 'image/png',
  }));
  return `/uploads/${key}`;
}

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();

  try {
    // Get all items for restaurant 4 in canonical order
    const { rows: cats } = await client.query(
      'SELECT id FROM menu_categories WHERE restaurant_id = $1 ORDER BY sort_order, id',
      [RESTAURANT_ID]
    );

    let allItems = [];
    for (const cat of cats) {
      const { rows: items } = await client.query(
        'SELECT id, name FROM menu_items WHERE category_id = $1 ORDER BY sort_order, id',
        [cat.id]
      );
      allItems = allItems.concat(items);
    }

    console.log(`Total DB items: ${allItems.length}`);
    console.log(`Total mapped data rows: ${Object.keys(DATA_ROW_TO_FLD).length}`);

    if (allItems.length !== Object.keys(DATA_ROW_TO_FLD).length) {
      console.log('⚠ WARNING: item count mismatch — check mapping');
    }

    // Dry-run first: show what will happen
    console.log('\n--- DRY RUN (first 10 + last 5) ---');
    for (let i = 0; i < allItems.length; i++) {
      const dataRow = i + 1;
      const fldFile = DATA_ROW_TO_FLD[dataRow];
      const fldPath = path.join(FLD_DIR, fldFile || '');
      const exists = fldFile ? fs.existsSync(fldPath) : false;
      if (i < 10 || i >= allItems.length - 5) {
        console.log(`  [${dataRow}] "${allItems[i].name.substring(0,40)}" → ${fldFile || 'NO MAPPING'} (${exists ? 'OK' : 'MISSING'})`);
      }
    }

    // Check all fld files exist
    let missing = 0;
    for (let i = 0; i < allItems.length; i++) {
      const fldFile = DATA_ROW_TO_FLD[i + 1];
      if (!fldFile) { console.log(`  MISSING MAPPING for row ${i + 1}: ${allItems[i].name}`); missing++; continue; }
      if (!fs.existsSync(path.join(FLD_DIR, fldFile))) {
        console.log(`  MISSING FILE ${fldFile} for row ${i + 1}: ${allItems[i].name}`);
        missing++;
      }
    }
    if (missing > 0) {
      console.log(`\n❌ ${missing} missing files/mappings — aborting.`);
      return;
    }

    // Upload all
    console.log('\n--- UPLOADING ---');
    let uploaded = 0, errors = 0;

    await client.query('BEGIN');

    for (let i = 0; i < allItems.length; i++) {
      const dataRow = i + 1;
      const item = allItems[i];
      const fldFile = DATA_ROW_TO_FLD[dataRow];
      const fldPath = path.join(FLD_DIR, fldFile);

      try {
        const buffer = fs.readFileSync(fldPath);
        const filename = crypto.randomBytes(16).toString('hex') + '.png';
        const url = await uploadToR2(buffer, filename);
        await client.query('UPDATE menu_items SET image_url = $1 WHERE id = $2', [url, item.id]);
        console.log(`  [${dataRow}/${allItems.length}] ✓ id=${item.id} "${item.name.substring(0,40)}" → ${fldFile}`);
        uploaded++;
      } catch (err) {
        console.error(`  [${dataRow}] ✗ id=${item.id} "${item.name.substring(0,40)}" — ${err.message}`);
        errors++;
      }
    }

    if (errors > 0) {
      await client.query('ROLLBACK');
      console.log(`\n❌ ${errors} errors — ROLLED BACK. Fix errors and retry.`);
    } else {
      await client.query('COMMIT');
      console.log(`\n✅ COMMITTED. ${uploaded} items updated.`);
    }

  } finally {
    client.release();
    await pool.end();
  }
})().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
