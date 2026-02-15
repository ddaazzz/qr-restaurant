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

    // Log the login activity with timestamp
    await logStaffActivity({
      restaurantId: defaultRestaurantId,
      staffId: user.id,
      action: STAFF_ACTIONS.STAFF_LOGIN,
      meta: {
        email: email,
        role: user.role,
        ipAddress: req.ip || req.connection.remoteAddress || "unknown",
        userAgent: req.get("user-agent") || "unknown",
        loginTime: new Date().toISOString(),
      }
    });

    res.json({
      token,
      userId: user.id,
      role: user.role,
      restaurantId: defaultRestaurantId,
      restaurants: user.role === "superadmin" ? restaurants : [],
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});;

// GET /api/auth/restaurants - for superadmin
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

// GET /api/auth/admin-restaurants - for admin with multiple restaurants
router.get("/auth/admin-restaurants", async (req, res) => {
  try {
    // Get the current user's restaurants from their token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing or invalid token" });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "devsecret") as any;

    if (decoded.role === "superadmin") {
      // Superadmin gets all restaurants
      const result = await pool.query(
        "SELECT id, name FROM restaurants ORDER BY id"
      );
      return res.json(result.rows);
    } else if (decoded.role === "admin") {
      // Admin gets their assigned restaurants
      const result = await pool.query(
        "SELECT id, name FROM restaurants WHERE id = (SELECT restaurant_id FROM users WHERE id = $1) ORDER BY id",
        [decoded.id]
      );
      return res.json(result.rows);
    } else {
      return res.status(403).json({ error: "Only admin and superadmin can access this endpoint" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/restaurants/:restaurantId/staff", async (req, res) => {
  const { name, pin, role = "staff", access_rights = [] } = req.body;
  const { restaurantId } = req.params;

  // Validate all required fields
  if (!name || !pin) {
    return res.status(400).json({ error: "Name and PIN are required" });
  }

  // Ensure PIN is 6 digits
  if (!/^\d{6}$/.test(pin)) {
    return res.status(400).json({ error: "PIN must be 6 digits" });
  }

  // Default role is staff
  const staffRole = role === "kitchen" ? "kitchen" : "staff";

  try {
    // Verify restaurant exists
    const restaurantCheck = await pool.query(
      `SELECT id FROM restaurants WHERE id = $1`,
      [restaurantId]
    );

    if (restaurantCheck.rowCount === 0) {
      return res.status(404).json({ error: "Restaurant not found" });
    }

    // Check if PIN already exists for this restaurant
    const pinCheck = await pool.query(
      `SELECT id FROM users WHERE restaurant_id = $1 AND pin = $2`,
      [restaurantId, pin]
    );

    if (pinCheck.rowCount && pinCheck.rowCount > 0) {
      return res.status(400).json({ error: "PIN already exists for another staff member in this restaurant" });
    }

    const result = await pool.query(
      `INSERT INTO users (name, email, role, pin, restaurant_id, access_rights)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, role, pin, access_rights`,
      [name, null, staffRole, pin, restaurantId, JSON.stringify(access_rights)]
    );

    console.log(`✅ Staff created for restaurant ${restaurantId}: ${name}`);
    res.json({ staff: result.rows[0], success: true });
  } catch (err: any) {
    console.error("❌ Staff creation failed:", err);
    res.status(500).json({ error: "Failed to create staff", details: err.message });
  }
});

router.get("/restaurants/:restaurantId/staff", async (req, res) => {
  const { restaurantId } = req.params;

  try {
    const result = await pool.query(
      `SELECT id, name, email, role, pin, access_rights FROM users WHERE restaurant_id = $1 AND (role = 'staff' OR role = 'kitchen')`,
      [restaurantId]
    );

    // Parse access_rights JSON
    const staff = result.rows.map(s => ({
      ...s,
      access_rights: s.access_rights ? (typeof s.access_rights === 'string' ? JSON.parse(s.access_rights) : s.access_rights) : []
    }));

    res.json(staff);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch staff" });
  }
});

// ✅ GET single staff member (for editing)
router.get("/restaurants/:restaurantId/staff/:staffId", async (req, res) => {
  const { restaurantId, staffId } = req.params;

  try {
    const result = await pool.query(
      `SELECT id, name, email, role, pin, access_rights FROM users WHERE id = $1 AND restaurant_id = $2 AND (role = 'staff' OR role = 'kitchen')`,
      [staffId, restaurantId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Staff member not found" });
    }

    const staff = result.rows[0];
    // Parse access_rights JSON
    staff.access_rights = staff.access_rights ? (typeof staff.access_rights === 'string' ? JSON.parse(staff.access_rights) : staff.access_rights) : [];

    res.json(staff);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch staff member" });
  }
});

// ✅ PATCH staff member (update)
router.patch("/restaurants/:restaurantId/staff/:staffId", async (req, res) => {
  const { restaurantId, staffId } = req.params;
  const { name, pin, role, access_rights } = req.body;

  try {
    // Verify staff belongs to restaurant
    const staffCheck = await pool.query(
      `SELECT id, role FROM users WHERE id = $1 AND restaurant_id = $2 AND (role = 'staff' OR role = 'kitchen')`,
      [staffId, restaurantId]
    );

    if (staffCheck.rowCount === 0) {
      return res.status(404).json({ error: "Staff member not found" });
    }

    const existingStaff = staffCheck.rows[0];

    // If PIN is being changed, verify uniqueness
    if (pin && pin !== (await pool.query(`SELECT pin FROM users WHERE id = $1`, [staffId])).rows[0].pin) {
      if (!/^\d{6}$/.test(pin)) {
        return res.status(400).json({ error: "PIN must be 6 digits" });
      }

      const pinCheck = await pool.query(
        `SELECT id FROM users WHERE restaurant_id = $1 AND pin = $2 AND id != $3`,
        [restaurantId, pin, staffId]
      );

      if (pinCheck.rowCount && pinCheck.rowCount > 0) {
        return res.status(400).json({ error: "PIN already exists for another staff member" });
      }
    }

    // Build update query
    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (name) {
      updates.push(`name = $${paramIndex}`);
      params.push(name);
      paramIndex++;
    }

    if (pin) {
      updates.push(`pin = $${paramIndex}`);
      params.push(pin);
      paramIndex++;
    }

    if (role) {
      updates.push(`role = $${paramIndex}`);
      params.push(role);
      paramIndex++;
    }

    if (access_rights !== undefined) {
      updates.push(`access_rights = $${paramIndex}`);
      params.push(JSON.stringify(access_rights));
      paramIndex++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    // Add WHERE clause
    updates.push(`id = $${paramIndex}`);
    params.push(staffId);

    const query = `UPDATE users SET ${updates.join(', ')} RETURNING id, name, role, pin, access_rights`;
    const result = await pool.query(query, params);

    console.log(`✅ Staff updated: ${staffId} in restaurant ${restaurantId}`);

    const staff = result.rows[0];
    // Parse access_rights JSON
    staff.access_rights = staff.access_rights ? (typeof staff.access_rights === 'string' ? JSON.parse(staff.access_rights) : staff.access_rights) : [];

    res.json({ staff, success: true });
  } catch (err) {
    console.error("Failed to update staff:", err);
    res.status(500).json({ error: "Failed to update staff" });
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
  const { pin, restaurantId, role: requestedRole } = req.body;
  if (!pin) return res.status(400).json({ error: "PIN required" });

  try {
    const result = await pool.query(
      "SELECT id, role, access_rights FROM users WHERE pin=$1 AND restaurant_id=$2 AND (role='staff' OR role='kitchen')",
      [pin, restaurantId]
    );

    const user = result.rows[0];
    if (!user) {
      return res.status(401).json({ error: "Invalid PIN" });
    }

    // Validate that the PIN's role matches the requested role
    // This prevents kitchen staff from logging into staff.html and vice versa
    if (requestedRole && user.role !== requestedRole) {
      return res.status(403).json({ 
        error: `PIN does not match requested role. Expected ${requestedRole} but found ${user.role}` 
      });
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
      meta: { method: "PIN", role: user.role }
    });

    // Parse access_rights if it's a string (from database)
    let accessRights = {};
    if (user.access_rights) {
      accessRights = typeof user.access_rights === 'string' ? JSON.parse(user.access_rights) : user.access_rights;
    }

    res.json({ token, role: user.role, restaurantId, access_rights: accessRights });
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

// POST /api/auth/logout - Log user logout activity
router.post("/auth/logout", async (req, res) => {
  const { userId, restaurantId, role } = req.body;

  if (!userId || !restaurantId) {
    return res.status(400).json({ error: "User ID and Restaurant ID required" });
  }

  try {
    await logStaffActivity({
      restaurantId: restaurantId,
      staffId: userId,
      action: STAFF_ACTIONS.STAFF_LOGOUT,
      meta: {
        role: role,
        logoutTime: new Date().toISOString(),
      }
    });
    res.json({ message: "Logged out successfully" });
  } catch (err) {
    console.error("Error logging out:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
