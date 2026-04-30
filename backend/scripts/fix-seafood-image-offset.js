/**
 * Fix seafood image offset for restaurant 4.
 *
 * During the original upload, 4 items (ids 251-254) were absent from the DB
 * when images were mapped, so their images ended up assigned to the next 4
 * items (ids 255-258). This script moves those images back by 4 positions.
 *
 * Before:
 *   251 (Sautéed Prawn with Seasonal Green)            -> NO IMAGE
 *   252 (Scrambled Egg White with Prawn)               -> NO IMAGE
 *   253 (Pan Fried Prawn – Hot)                        -> NO IMAGE
 *   254 (Sauteed Shrimp with Scrambled Egg)            -> NO IMAGE
 *   255 (Stir Fried Scallop & Prawn w/ Black Truffle)  -> f8cd96ff…  ← belongs to 251
 *   256 (Stir Fried Scallop with Seasonal Green)       -> b60c8f40…  ← belongs to 252
 *   257 (Deep Fried Squid in Spicy Salt)               -> 08b1181a…  ← belongs to 253
 *   258 (Baked Twin Lobsters)                          -> 727151fb…  ← belongs to 254
 *
 * After:
 *   251  -> f8cd96ff…
 *   252  -> b60c8f40…
 *   253  -> 08b1181a…
 *   254  -> 727151fb…
 *   255  -> NULL  (image not yet uploaded)
 *   256  -> NULL
 *   257  -> NULL
 *   258  -> NULL
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Source → destination pairs: take image_url FROM source and put it ON dest, then clear source.
const SHIFTS = [
  { from: 255, to: 251 },
  { from: 256, to: 252 },
  { from: 257, to: 253 },
  { from: 258, to: 254 },
];

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Fetch current image_urls for the source items
    const sourceIds = SHIFTS.map(s => s.from);
    const { rows: sources } = await client.query(
      'SELECT id, name, image_url FROM menu_items WHERE id = ANY($1::int[])',
      [sourceIds]
    );

    console.log('Current state of source items:');
    sources.forEach(r => console.log(`  id=${r.id} | ${r.name} | ${r.image_url?.split('/').pop() || 'NULL'}`));

    // Apply each shift
    for (const { from, to } of SHIFTS) {
      const src = sources.find(r => r.id === from);
      if (!src) {
        console.error(`Source item id=${from} not found, aborting.`);
        await client.query('ROLLBACK');
        return;
      }
      const imageUrl = src.image_url;

      // Assign to destination
      await client.query('UPDATE menu_items SET image_url = $1 WHERE id = $2', [imageUrl, to]);
      console.log(`  ✓ id=${to} ← image from id=${from} (${imageUrl?.split('/').pop()})`);

      // Clear source
      await client.query('UPDATE menu_items SET image_url = NULL WHERE id = $1', [from]);
      console.log(`  ✓ id=${from} image_url cleared`);
    }

    await client.query('COMMIT');
    console.log('\n✅ Done. Verifying result...');

    const allIds = [...sourceIds, ...SHIFTS.map(s => s.to)];
    const { rows: result } = await pool.query(
      'SELECT id, name, image_url FROM menu_items WHERE id = ANY($1::int[]) ORDER BY id',
      [allIds]
    );
    result.forEach(r =>
      console.log(`  id=${r.id} | ${r.name} | ${r.image_url?.split('/').pop() || 'NO IMAGE'}`)
    );
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error, rolled back:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
