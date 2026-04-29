/**
 * Fix image assignments for the 8 affected Seafood items (IDs 251-258).
 *
 * Background:
 *   - The original upload script was name-based.
 *   - Items 251-254 (prawn items) were NOT in DB at upload time → skipped.
 *   - Items 255-258 (scallop/squid/lobster) WERE in DB → got correct images.
 *   - A previous "fix" script mistakenly moved images from 255-258 → 251-254
 *     and cleared 255-258.
 *
 * This script:
 *   1. Copies image_urls from 251-254 back to 255-258 (restoring scallop items).
 *   2. Sets 251-254 to NULL (prawn images were never generated; correct images needed).
 *   3. Reports on items 316-317 which also have no images (image files missing).
 *
 * Other categories (positions 31-87, 90-105) are confirmed correct — no action needed.
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  const client = await pool.connect();
  try {
    // Get current image_urls for IDs 251-258
    const { rows: items } = await client.query(
      `SELECT id, name, image_url FROM menu_items WHERE id IN (251,252,253,254,255,256,257,258) ORDER BY id`
    );

    console.log('--- Current state ---');
    for (const it of items) {
      console.log(`  id=${it.id} "${it.name}" → ${it.image_url ? it.image_url.split('/').pop().substring(0,16) : 'NO_IMAGE'}`);
    }

    const byId = {};
    for (const it of items) byId[it.id] = it;

    // Validate that 251-254 have images (from the previous fix) and 255-258 are NULL
    const prawnItems = [251, 252, 253, 254];
    const scallopItems = [255, 256, 257, 258];

    const prawnHaveImages = prawnItems.every(id => byId[id] && byId[id].image_url);
    const scallopAreNull = scallopItems.every(id => byId[id] && !byId[id].image_url);

    if (!prawnHaveImages) {
      console.log('\n⚠ WARNING: Expected IDs 251-254 to have images (from previous fix), but some are NULL.');
      console.log('  Check DB state before proceeding.');
    }
    if (!scallopAreNull) {
      console.log('\n⚠ WARNING: Expected IDs 255-258 to be NULL, but some have images.');
      console.log('  The fix may have already been applied or state is unexpected.');
    }

    if (!prawnHaveImages || !scallopAreNull) {
      console.log('\nAborted — unexpected state. Please check manually.');
      return;
    }

    // Map: prawn item → scallop item (shift back: move image from prawn to scallop)
    const pairs = [
      [251, 255],  // "Sautéed Prawn with Seasonal Green" image → "Stir Fried Scallop & Prawn with Black Truffle & Mushroom"
      [252, 256],  // "Scrambled Egg White with Prawn" image → "Stir Fried Scallop with Seasonal Green"
      [253, 257],  // "Pan Fried Prawn – Hot" image → "Deep Fried Squid in Spicy Salt"
      [254, 258],  // "Sauteed Shrimp with Scrambled Egg" image → "Baked Twin Lobsters in Supreme Broth with E-Fu Noodles"
    ];

    await client.query('BEGIN');

    for (const [sourceId, targetId] of pairs) {
      const url = byId[sourceId].image_url;
      await client.query('UPDATE menu_items SET image_url = $1 WHERE id = $2', [url, targetId]);
      console.log(`\n  ✓ Copied image from id=${sourceId} ("${byId[sourceId].name.substring(0,30)}...")`);
      console.log(`      → id=${targetId} ("${byId[targetId].name.substring(0,30)}...")`);
    }

    // Clear 251-254 (prawn items — correct prawn images were never generated)
    await client.query('UPDATE menu_items SET image_url = NULL WHERE id IN (251,252,253,254)');
    console.log('\n  ✓ Cleared image_url for ids 251-254 (prawn items — images need to be generated)');

    await client.query('COMMIT');
    console.log('\n✅ Transaction committed.');

    // Verify
    const { rows: after } = await client.query(
      `SELECT id, name, image_url FROM menu_items WHERE id IN (251,252,253,254,255,256,257,258) ORDER BY id`
    );
    console.log('\n--- After state ---');
    for (const it of after) {
      const status = it.image_url ? '✓ HAS IMAGE' : '✗ NO_IMAGE';
      console.log(`  ${status}  id=${it.id} "${it.name.substring(0,45)}"`);
    }

    // Report on other missing items
    const { rows: missing } = await client.query(
      `SELECT mi.id, mi.name FROM menu_items mi
       JOIN menu_categories mc ON mi.category_id = mc.id
       WHERE mc.restaurant_id = 4 AND mi.image_url IS NULL
       ORDER BY mc.sort_order, mi.sort_order, mi.id`
    );
    console.log(`\n--- All items still missing images (${missing.length} total) ---`);
    for (const it of missing) {
      console.log(`  id=${it.id} "${it.name}"`);
    }
    console.log('\nThese items need new images to be generated manually.');

  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('❌ Error — rolled back:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
