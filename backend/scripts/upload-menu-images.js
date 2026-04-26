/**
 * Upload generated menu images to Cloudflare R2 and update image_url in the DB.
 *
 * Mapping logic:
 *   - Original xlsx (Menu items for 海鮮家.xlsx) has rows 2..N, each with an embedded image.
 *   - The .fld folder extracted those images as image001.png, image002.png, ...
 *     so row 2 → image001, row 3 → image002, etc.
 *   - The generation script produced image001_menu.png, image002_menu.png, etc.
 *   - We match by English item name (column C in original xlsx) to items in the DB.
 */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const pg = require('../node_modules/pg');
const XLSX = require('../node_modules/xlsx');
const { S3Client, PutObjectCommand } = require('../node_modules/@aws-sdk/client-s3');

// ── Config ────────────────────────────────────────────────────────────────────
const DB_URL = 'postgresql://chuio_dev_db_user:lWTUcKLtvMHSyCs47FC9ckXK9o92Pyt0@dpg-d7gq5j4p3tds73a44eo0-a.singapore-postgres.render.com/chuio_dev_db';
const R2_ACCOUNT_ID = '49f8af5b11822d65e24c84292670d8d3';
const R2_ACCESS_KEY_ID = 'a45698f5b25fcf2fae23cca898b03397';
const R2_SECRET_ACCESS_KEY = 'd162a98c8e8d884bde23a76840ec0545d533f7cb5456482c7a73f6ac598b26be';
const R2_BUCKET_NAME = 'chuio-uploads';
const R2_PUBLIC_URL = ''; // not configured — will use /uploads/ proxy path

const RESTAURANT_ID = 4;
const ORIGINAL_XLSX = '/Users/user/Documents/Chuio/Reference Images/海鮮家/Menu items for 海鮮家.xlsx';
const IMAGES_DIR = '/Users/user/Documents/Chuio/Reference Images/海鮮家/generated-menu-images-poe';
// ─────────────────────────────────────────────────────────────────────────────

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
});

async function uploadToR2(filePath) {
  const buffer = fs.readFileSync(filePath);
  const filename = crypto.randomBytes(16).toString('hex') + '.png';
  const key = `restaurants/${RESTAURANT_ID}/menu/${filename}`;

  await s3.send(new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: 'image/png',
  }));

  return R2_PUBLIC_URL ? `${R2_PUBLIC_URL}/${key}` : `/uploads/${key}`;
}

(async () => {
  const pool = new pg.Pool({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });

  // 1. Read original xlsx to build { imageIndex → englishName } map
  //    Columns: A=Category, B=Name ZH, C=Name EN, D=Image, E=Price
  //    Row 2 (data row 1) → image001, row 3 → image002, etc.
  const wb = XLSX.readFile(ORIGINAL_XLSX);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

  const indexToName = {}; // image number (1-based) → English name
  for (let i = 1; i < rows.length; i++) {
    const nameEn = (rows[i][2] ?? '').toString().trim();
    if (nameEn) indexToName[i] = nameEn;
  }
  console.log(`Original xlsx: ${Object.keys(indexToName).length} named items`);

  // 2. Get all menu items for restaurant 4 from DB
  const dbItems = await pool.query(
    `SELECT mi.id, mi.name, mi.image_url
     FROM menu_items mi
     JOIN menu_categories mc ON mi.category_id = mc.id
     WHERE mc.restaurant_id = $1`,
    [RESTAURANT_ID]
  );
  const dbMap = {}; // lower(name) → { id, image_url }
  for (const row of dbItems.rows) {
    dbMap[row.name.trim().toLowerCase()] = row;
  }
  console.log(`DB: ${dbItems.rows.length} items for restaurant ${RESTAURANT_ID}`);

  // 3. Process each generated image
  const imageFiles = fs.readdirSync(IMAGES_DIR)
    .filter(f => /^image\d+_menu\.png$/.test(f))
    .sort();

  console.log(`Found ${imageFiles.length} generated images\n`);

  const stats = { uploaded: 0, skipped_no_match: 0, skipped_already_has_image: 0, errors: 0 };

  for (const imgFile of imageFiles) {
    // Extract the image index number from filename (e.g. image016_menu.png → 16)
    const match = imgFile.match(/^image(\d+)_menu\.png$/);
    if (!match) continue;
    const imgIndex = parseInt(match[1], 10);

    const nameEn = indexToName[imgIndex];
    if (!nameEn) {
      console.log(`  [SKIP] image${imgIndex}: no item at this index in xlsx`);
      stats.skipped_no_match++;
      continue;
    }

    const dbItem = dbMap[nameEn.toLowerCase()];
    if (!dbItem) {
      console.log(`  [SKIP] image${imgIndex}: "${nameEn}" not found in DB`);
      stats.skipped_no_match++;
      continue;
    }

    if (dbItem.image_url) {
      console.log(`  [SKIP] image${imgIndex}: "${nameEn}" already has image`);
      stats.skipped_already_has_image++;
      continue;
    }

    const imgPath = path.join(IMAGES_DIR, imgFile);
    try {
      const url = await uploadToR2(imgPath);
      await pool.query('UPDATE menu_items SET image_url = $1 WHERE id = $2', [url, dbItem.id]);
      console.log(`  [OK]   image${imgIndex}: "${nameEn}" → ${url}`);
      stats.uploaded++;
    } catch (err) {
      console.error(`  [ERR]  image${imgIndex}: "${nameEn}" — ${err.message}`);
      stats.errors++;
    }
  }

  console.log('\n─────────────────────────────');
  console.log('Summary:', stats);
  pool.end();
})().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
