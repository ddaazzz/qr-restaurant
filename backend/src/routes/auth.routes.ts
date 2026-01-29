import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import pool from "../config/db"; // adjust if you use your pool setup
import { logStaffActivity } from "../services/logStaffActivity";
import { STAFF_ACTIONS } from "../constants/staffActions";

const router = Router();
// POST /api/auth/login
router.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password required" });
  }

  try {
    const result = await pool.query(
      "SELECT id, password_hash, role, restaurant_id FROM users WHERE email = $1",
      [email]
    );

    if (!result.rows.length) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = result.rows[0];
    const restaurantId = user.restaurant_id;
console.log (restaurantId);
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Create JWT token
    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET || "devsecret",
      { expiresIn: "8h" }
    );

    res.json({ token, role: user.role, restaurantId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/restaurants/:restaurantId/staff", async (req, res) => {
  const { name, email, password, pin } = req.body;
  const { restaurantId } = req.params;

  if (!name || !email || !password || !pin) {
    return res.status(400).json({ error: "All fields required" });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, pin, restaurant_id)
       VALUES ($1, $2, $3, 'staff', $4, $5) RETURNING id, name, email, pin`,
      [name, email, hashedPassword, pin, restaurantId]
    );

    res.json({ staff: result.rows[0] });
  } catch (err: any) {
    console.error(err);
    
    // Handle duplicate email error
    if (err.code === '23505' && err.constraint === 'users_email_key') {
      return res.status(400).json({ error: "Email already exists. Please use a different email address." });
    }

    res.status(500).json({ error: "Failed to create staff" });
  }
});

router.get("/restaurants/:restaurantId/staff", async (req, res) => {
  const { restaurantId } = req.params;

  try {
    const result = await pool.query(
      `SELECT id, name, email, role, pin FROM users WHERE restaurant_id = $1 AND role = 'staff'`,
      [restaurantId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch staff" });
  }
});

router.delete("/staff/:id", async (req, res) => {
  try {
    await pool.query(`DELETE FROM users WHERE id = $1 AND role='staff'`, [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete staff" });
  }
});

router.post("/auth/staff-login", async (req, res) => {
  const { pin, restaurantId } = req.body;
  if (!pin) return res.status(400).json({ error: "PIN required" });

  try {
    const result = await pool.query(
      "SELECT id, role FROM users WHERE pin=$1 AND restaurant_id=$2 AND role='staff'",
      [pin, restaurantId]
    );

    const user = result.rows[0];
    if (!user) {
      return res.status(401).json({ error: "Invalid PIN" });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET || "devsecret",
      { expiresIn: "8h" }
    );

    // ✅ LOG HERE (canonical action)
    await logStaffActivity({
      restaurantId,
      staffId: user.id,
      action: STAFF_ACTIONS.STAFF_LOGIN,
      meta: { method: "PIN" }
    });

    res.json({ token, role: user.role });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
