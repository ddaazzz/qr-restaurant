import QRCode from "qrcode";
import pool from "../src/config/db";

async function generateQRCodes() {
  const result = await pool.query("SELECT id, qr_token FROM tables");

  for (const table of result.rows) {
    const url = `http://localhost:3000/scan/${table.qr_token}`;
    await QRCode.toFile(`qrs/table-${table.id}.png`, url);
    console.log(`Generated QR for table ${table.id}`);
  }
 
  process.exit();
}

generateQRCodes();
