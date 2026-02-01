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

    // For superadmin, fetch all restaurants
    let restaurants = [];
    let defaultRestaurantId = user.restaurant_id;
    
    if (user.role === "superadmin") {
      const restaurantsResult = await pool.query(
        "SELECT id, name FROM restaurants ORDER BY id"
      );
      restaurants = restaurantsResult.rows;
      // Default to first restaurant if available
      defaultRestaurantId = restaurants.length > 0 ? restaurants[0].id : 1;
    }

    res.json({
      token,
      role: user.role,
      restaurantId: defaultRestaurantId,
      restaurants: user.role === "superadmin" ? restaurants : [],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});;

// GET /api/auth/restaurants
router.get("/auth/restaurants", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name FROM restaurants ORDER BY id"
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/restaurants/:restaurantId/staff", async (req, res) => {
  const { name, email, password, pin, role } = req.body;
  const { restaurantId } = req.params;

  // Validate all required fields
  if (!name || !email || !password || !pin) {
    return res.status(400).json({ error: "All fields required" });
  }

  // Ensure PIN is 6 digits
  if (!/^\d{6}$/.test(pin)) {
    return res.status(400).json({ error: "PIN must be 6 digits" });
  }

  // Validate email format
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Invalid email format" });
  }

  // Determine role - only allow 'staff' or 'kitchen'
  const staffRole = role === 'kitchen' ? 'kitchen' : 'staff';

  try {
    // Verify restaurant exists
    const restaurantCheck = await pool.query(
      `SELECT id FROM restaurants WHERE id = $1`,
      [restaurantId]
    );

    if (restaurantCheck.rowCount === 0) {
      return res.status(404).json({ error: "Restaurant not found" });
    }

    // Check if email already exists for this restaurant
    const emailCheck = await pool.query(
      `SELECT id FROM users WHERE email = $1 AND restaurant_id = $2`,
      [email, restaurantId]
    );

    if (emailCheck.rowCount && emailCheck.rowCount > 0) {
      return res.status(400).json({ error: "Email already exists in this restaurant" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, pin, restaurant_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, email, role, pin`,
      [name, email, hashedPassword, staffRole, pin, restaurantId]
    );

    console.log(`✅ Staff created for restaurant ${restaurantId}: ${email} (${staffRole})`);
    res.json({ staff: result.rows[0] });
  } catch (err: any) {
    console.error("❌ Staff creation failed:", err);
    
    // Handle duplicate email error (system-wide)
    if (err.code === '23505' && err.constraint === 'users_email_key') {
      return res.status(400).json({ error: "Email already exists in system" });
    }

    res.status(500).json({ error: "Failed to create staff" });
  }
});

router.get("/restaurants/:restaurantId/staff", async (req, res) => {
  const { restaurantId } = req.params;

  try {
    const result = await pool.query(
      `SELECT id, name, email, role, pin FROM users WHERE restaurant_id = $1 AND (role = 'staff' OR role = 'kitchen')`,
      [restaurantId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch staff" });
  }
});

router.delete("/restaurants/:restaurantId/staff/:staffId", async (req, res) => {
  const { restaurantId, staffId } = req.params;

  try {
    // Ensure the staff member belongs to this restaurant
    const staffCheck = await pool.query(
      `SELECT id FROM users WHERE id = $1 AND restaurant_id = $2 AND (role = 'staff' OR role = 'kitchen')`,
      [staffId, restaurantId]
    );

    if (!staffCheck.rowCount) {
      return res.status(404).json({ error: "Staff member not found in this restaurant" });
    }

    await pool.query(
      `DELETE FROM users WHERE id = $1 AND restaurant_id = $2`,
      [staffId, restaurantId]
    );

    console.log(`✅ Staff deleted: ${staffId} from restaurant ${restaurantId}`);
    res.json({ success: true });
  } catch (err) {
    console.error("Failed to delete staff:", err);
    res.status(500).json({ error: "Failed to delete staff" });
  }
});

router.post("/auth/staff-login", async (req, res) => {
  const { pin, restaurantId } = req.body;
  if (!pin) return res.status(400).json({ error: "PIN required" });

  try {
    const result = await pool.query(
      "SELECT id, role FROM users WHERE pin=$1 AND restaurant_id=$2 AND (role='staff' OR role='kitchen')",
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

    res.json({ token, role: user.role, restaurantId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/auth/create-restaurant - Create new restaurant (SUPERADMIN ONLY)
router.post("/auth/create-restaurant", async (req, res) => {
  const { restaurant_name, admin_email, admin_password, address, phone } = req.body;
  
  // Get user from token to verify superadmin
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "Unauthorized - no token" });
  }

  try {
    let decoded: any;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || "devsecret");
    } catch {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    // Check if user is superadmin
    const userResult = await pool.query(
      "SELECT role FROM users WHERE id = $1",
      [decoded.id]
    );

    if (!userResult.rows.length || userResult.rows[0].role !== "superadmin") {
      return res.status(403).json({ message: "Only superadmin can create restaurants" });
    }

    // Validate inputs
    if (!restaurant_name || !admin_email || !admin_password) {
      return res.status(400).json({ message: "Restaurant name, admin email, and password are required" });
    }

    if (admin_password.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters" });
    }

    // Check if email already exists
    const emailCheck = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [admin_email]
    );

    if (emailCheck.rows.length > 0) {
      return res.status(400).json({ message: "Email already in use" });
    }

    // Start transaction
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Create restaurant
      const restaurantResult = await client.query(
        "INSERT INTO restaurants (name, address, phone) VALUES ($1, $2, $3) RETURNING id, name",
        [restaurant_name, address || null, phone || null]
      );

      const restaurantId = restaurantResult.rows[0].id;

      // Hash password
      const passwordHash = await bcrypt.hash(admin_password, 10);

      // Create admin user
      const userResult = await client.query(
        "INSERT INTO users (email, password_hash, role, restaurant_id) VALUES ($1, $2, $3, $4) RETURNING id",
        [admin_email, passwordHash, "admin", restaurantId]
      );

      const userId = userResult.rows[0].id;

      // Log activity
      await client.query(
        "INSERT INTO staff_activity (restaurant_id, staff_id, action, metadata) VALUES ($1, $2, $3, $4)",
        [restaurantId, userId, "RESTAURANT_CREATED", JSON.stringify({ created_by_superadmin: decoded.id })]
      );

      await client.query("COMMIT");
      client.release();

      res.status(201).json({
        message: "Restaurant created successfully",
        restaurant_id: restaurantId,
        admin_id: userId,
        admin_email: admin_email
      });

    } catch (err) {
      await client.query("ROLLBACK");
      client.release();
      throw err;
    }

  } catch (err) {
    console.error("Error creating restaurant:", err);
    res.status(500).json({ message: "Failed to create restaurant" });
  }
});

export default router;
