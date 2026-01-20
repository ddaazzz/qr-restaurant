import { Router } from "express";
import pool from "../config/db";

const router = Router();

router.post("/scan/:qrToken", async (req, res) => {
  const { qrToken } = req.params;

  const tableResult = await pool.query(
    "SELECT * FROM tables WHERE qr_token = $1",
    [qrToken]
  );

  if (tableResult.rowCount === 0) {
    return res.status(404).json({ error: "Invalid QR" });
  }

  const table = tableResult.rows[0];

  // Check active session
  let sessionResult = await pool.query(
    "SELECT * FROM table_sessions WHERE table_id = $1 AND ended_at IS NULL",
    [table.id]
  );
  

  let session;

  if (sessionResult?.rowCount > 0) {
    session = sessionResult.rows[0];
  } else {
    // Create session
    const newSession = await pool.query(
      "INSERT INTO table_sessions (table_id) VALUES ($1) RETURNING *",
      [table.id]
    );
    session = newSession.rows[0];
  }
// Return session info + restaurant_id
  res.json({
  session_id: session.id,
  table_id: table.id,
  restaurant_id: table.restaurant_id
});

});
export default router;
/*// QR scan entry point
router.get("/scan/:token", async (req, res) => {
  const { token } = req.params;

  const result = await pool.query(
    "SELECT * FROM tables WHERE qr_token = $1",
    [token]
  );

  if (result.rowCount === 0) {
    return res.status(404).json({ error: "Invalid QR code" });
  }

  //After finding table
  const table = result.rows[0];

  // Check for active session
  const sessionResult = await pool.query(
    "SELECT * FROM table_sessions WHERE table_id = $1 AND ended_at IS NULL",
    [table.id]
  );

  // Start a new session or find existing session
  let session;

  if (sessionResult.rowCount === 0){
    const newSession = await pool.query(
        "INSERT INTO table_sessions (table_id) VALUES ($1) RETURNING *",
        [table.id]
    );
    session = newSession.rows[0];
  } else {
    session = sessionResult.rows[0];
  }


  res.json({
    message: "Session active",
    table_id: table.id,
    restaurant_id: table.restaurant_id,
    session_id : session.id,
  });
});
*/

