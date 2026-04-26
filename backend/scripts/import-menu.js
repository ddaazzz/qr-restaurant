const pg = require('../node_modules/pg');
const XLSX = require('../node_modules/xlsx');
const pool = new pg.Pool({
  connectionString: 'postgresql://chuio_dev_db_user:lWTUcKLtvMHSyCs47FC9ckXK9o92Pyt0@dpg-d7gq5j4p3tds73a44eo0-a.singapore-postgres.render.com/chuio_dev_db',
  ssl: { rejectUnauthorized: false }
});

const RESTAURANT_ID = 4;
const FILE = '/Users/user/Documents/Chuio/Reference Images/海鮮家/Menu items for 海鮮家 final.xlsx';

const workbook = XLSX.readFile(FILE);
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
const dataRows = rows.slice(1).filter(r => r[0] || r[3]);
console.log('Data rows to import:', dataRows.length);

(async () => {
  const catMap = {};
  const created = { categories: 0, items: 0, skipped: 0 };

  for (const row of dataRows) {
    const catNameEn = (row[0] ?? '').toString().trim();
    const catNameZh = (row[1] ?? '').toString().trim() || null;
    const itemNameZh = (row[2] ?? '').toString().trim() || null;
    const itemNameEn = (row[3] ?? '').toString().trim();
    const priceRaw = row[5];
    const priceCents = priceRaw != null ? Math.round(Number(priceRaw) * 100) : 0;

    if (!catNameEn && !itemNameEn) continue;

    const catKey = catNameEn.toLowerCase();
    let categoryId = catMap[catKey];
    if (!categoryId) {
      const r = await pool.query(
        `INSERT INTO menu_categories (restaurant_id, name, name_zh) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING id`,
        [RESTAURANT_ID, catNameEn, catNameZh]
      );
      if (r.rows.length > 0) {
        categoryId = r.rows[0].id;
        created.categories++;
      } else {
        const r2 = await pool.query('SELECT id FROM menu_categories WHERE restaurant_id=$1 AND lower(name)=$2', [RESTAURANT_ID, catKey]);
        if (!r2.rows.length) continue;
        categoryId = r2.rows[0].id;
      }
      catMap[catKey] = categoryId;
    }

    if (!itemNameEn) { created.skipped++; continue; }

    const exists = await pool.query(
      'SELECT id FROM menu_items WHERE category_id=$1 AND lower(name)=lower($2)',
      [categoryId, itemNameEn]
    );
    if (exists.rows.length > 0) { created.skipped++; continue; }

    await pool.query(
      `INSERT INTO menu_items (category_id, name, name_zh, price_cents, available) VALUES ($1, $2, $3, $4, true)`,
      [categoryId, itemNameEn, itemNameZh, priceCents]
    );
    created.items++;
    console.log(`  + [${catNameEn}] ${itemNameEn}`);
  }

  console.log('\nDone:', created);
  pool.end();
})().catch(e => { console.error('Error:', e.message); pool.end(); });
