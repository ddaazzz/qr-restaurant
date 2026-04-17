import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import pool from "../config/db"; // adjust if you use your pool setup
import { logStaffActivity } from "../services/logStaffActivity";
import { STAFF_ACTIONS } from "../constants/staffActions";
import { uploadDocuments } from "../config/upload";
import { sendVerificationCode, sendPasswordResetEmail } from "../services/emailService";

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

    // Fetch custom deployment URL if restaurant has one
    const apiBaseUrlResult = await pool.query(
      "SELECT api_base_url FROM restaurants WHERE id = $1",
      [defaultRestaurantId]
    );
    const apiBaseUrl = apiBaseUrlResult.rows[0]?.api_base_url || null;

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
      apiBaseUrl,
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
  const { name, pin, role = "staff", access_rights = [], hourly_rate_cents } = req.body;
  const { restaurantId } = req.params;

  // Validate all required fields
  if (!name || !pin) {
    return res.status(400).json({ error: "Name and PIN are required" });
  }

  // Ensure PIN is 6 digits
  if (!/^\d{6}$/.test(pin)) {
    return res.status(400).json({ error: "PIN must be 6 digits" });
  }

  // Validate hourly rate if provided
  if (hourly_rate_cents !== undefined && hourly_rate_cents !== null && hourly_rate_cents < 0) {
    return res.status(400).json({ error: "Hourly rate cannot be negative" });
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
      `INSERT INTO users (name, email, role, pin, restaurant_id, access_rights, hourly_rate_cents)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, name, role, pin, access_rights, hourly_rate_cents`,
      [name, null, staffRole, pin, restaurantId, JSON.stringify(access_rights), hourly_rate_cents || null]
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
      `SELECT 
        id, name, email, role, pin, access_rights, hourly_rate_cents,
        (SELECT COUNT(*) FROM staff_timekeeping WHERE user_id = users.id AND clock_out_at IS NULL) as currently_clocked_in
      FROM users 
      WHERE restaurant_id = $1 AND (role = 'staff' OR role = 'kitchen')`,
      [restaurantId]
    );

    // Parse access_rights JSON
    const staff = result.rows.map(s => ({
      ...s,
      access_rights: s.access_rights ? (typeof s.access_rights === 'string' ? JSON.parse(s.access_rights) : s.access_rights) : [],
      currently_clocked_in: s.currently_clocked_in > 0
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
      `SELECT 
        id, name, email, role, pin, access_rights, hourly_rate_cents,
        (SELECT COUNT(*) FROM staff_timekeeping WHERE user_id = users.id AND clock_out_at IS NULL) > 0 as currently_clocked_in
      FROM users WHERE id = $1 AND restaurant_id = $2 AND (role = 'staff' OR role = 'kitchen')`,
      [staffId, restaurantId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Staff member not found" });
    }

    const staff = result.rows[0];
    // Parse access_rights JSON
    staff.access_rights = staff.access_rights ? (typeof staff.access_rights === 'string' ? JSON.parse(staff.access_rights) : staff.access_rights) : [];
    
    // Fetch recent timekeeping records (last 30 days)
    const timekeepingResult = await pool.query(
      `SELECT 
        id, clock_in_at, clock_out_at, duration_minutes 
      FROM staff_timekeeping 
      WHERE user_id = $1 AND restaurant_id = $2 AND clock_in_at >= NOW() - INTERVAL '30 days'
      ORDER BY clock_in_at DESC
      LIMIT 30`,
      [staffId, restaurantId]
    );
    
    staff.timekeeping = timekeepingResult.rows;
    
    // Calculate stats
    const statsResult = await pool.query(
      `SELECT 
        COUNT(*) as total_shifts,
        COALESCE(SUM(duration_minutes), 0) as total_minutes
      FROM staff_timekeeping 
      WHERE user_id = $1 AND restaurant_id = $2 AND clock_in_at >= NOW() - INTERVAL '30 days' AND clock_out_at IS NOT NULL`,
      [staffId, restaurantId]
    );
    
    const stats = statsResult.rows[0];
    staff.stats = {
      total_shifts: parseInt(stats.total_shifts),
      total_hours: Math.round((parseInt(stats.total_minutes) / 60) * 100) / 100
    };

    res.json(staff);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch staff member" });
  }
});

// ✅ PATCH staff member (update)
router.patch("/restaurants/:restaurantId/staff/:staffId", async (req, res) => {
  const { restaurantId, staffId } = req.params;
  const { name, pin, role, access_rights, hourly_rate_cents } = req.body;

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

    // Get current PIN from database
    const currentPinResult = await pool.query(
      `SELECT pin FROM users WHERE id = $1`,
      [staffId]
    );
    const currentPin = currentPinResult.rows.length > 0 ? currentPinResult.rows[0].pin : null;

    // If PIN is being changed, verify uniqueness
    if (pin && pin !== currentPin) {
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

    if (hourly_rate_cents !== undefined) {
      // Validate hourly rate
      if (hourly_rate_cents !== null && hourly_rate_cents < 0) {
        return res.status(400).json({ error: "Hourly rate cannot be negative" });
      }
      updates.push(`hourly_rate_cents = $${paramIndex}`);
      params.push(hourly_rate_cents);
      paramIndex++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    // Add WHERE clause parameters (separate from SET updates)
    params.push(staffId);

    const query = `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING id, name, role, pin, access_rights`;
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
      `SELECT id, role, access_rights,
        (SELECT COUNT(*) FROM staff_timekeeping WHERE user_id = users.id AND restaurant_id = $2 AND clock_out_at IS NULL) > 0 AS currently_clocked_in
       FROM users WHERE pin=$1 AND restaurant_id=$2 AND role='staff'`,
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
      meta: { method: "PIN", role: user.role }
    });

    // Parse access_rights if it's a string (from database)
    let accessRights = {};
    if (user.access_rights) {
      accessRights = typeof user.access_rights === 'string' ? JSON.parse(user.access_rights) : user.access_rights;
    }

    // Fetch custom deployment URL if restaurant has one
    const apiBaseUrlResult = await pool.query(
      "SELECT api_base_url FROM restaurants WHERE id = $1",
      [restaurantId]
    );
    const apiBaseUrl = apiBaseUrlResult.rows[0]?.api_base_url || null;

    res.json({ token, role: user.role, restaurantId, access_rights: accessRights, user_id: user.id, currently_clocked_in: user.currently_clocked_in, apiBaseUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/auth/kitchen-login", async (req, res) => {
  const { pin, restaurantId } = req.body;
  if (!pin) return res.status(400).json({ error: "PIN required" });

  try {
    const result = await pool.query(
      `SELECT id, role, access_rights,
        (SELECT COUNT(*) FROM staff_timekeeping WHERE user_id = users.id AND restaurant_id = $2 AND clock_out_at IS NULL) > 0 AS currently_clocked_in
       FROM users WHERE pin=$1 AND restaurant_id=$2 AND role='kitchen'`,
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
      meta: { method: "PIN", role: user.role }
    });

    // Parse access_rights if it's a string (from database)
    let accessRights = {};
    if (user.access_rights) {
      accessRights = typeof user.access_rights === 'string' ? JSON.parse(user.access_rights) : user.access_rights;
    }

    // Fetch custom deployment URL if restaurant has one
    const apiBaseUrlResult = await pool.query(
      "SELECT api_base_url FROM restaurants WHERE id = $1",
      [restaurantId]
    );
    const apiBaseUrl = apiBaseUrlResult.rows[0]?.api_base_url || null;

    res.json({ token, role: user.role, restaurantId, access_rights: accessRights, user_id: user.id, currently_clocked_in: user.currently_clocked_in, apiBaseUrl });
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

// ✅ POST clock in
router.post("/restaurants/:restaurantId/staff/:staffId/clock-in", async (req, res) => {
  const { restaurantId, staffId } = req.params;
  
  try {
    // Verify staff exists and belongs to restaurant
    const staffCheck = await pool.query(
      `SELECT id FROM users WHERE id = $1 AND restaurant_id = $2 AND (role = 'staff' OR role = 'kitchen')`,
      [staffId, restaurantId]
    );
    
    if (staffCheck.rowCount === 0) {
      return res.status(404).json({ error: "Staff member not found" });
    }
    
    // Check if already clocked in
    const activeCheck = await pool.query(
      `SELECT id FROM staff_timekeeping WHERE user_id = $1 AND restaurant_id = $2 AND clock_out_at IS NULL`,
      [staffId, restaurantId]
    );
    
    if ((activeCheck.rowCount ?? 0) > 0) {
      return res.status(400).json({ error: "Staff member already clocked in" });
    }
    
    const result = await pool.query(
      `INSERT INTO staff_timekeeping (user_id, restaurant_id, clock_in_at) 
       VALUES ($1, $2, NOW())
       RETURNING id, clock_in_at`,
      [staffId, restaurantId]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to clock in" });
  }
});

// ✅ POST clock out
router.post("/restaurants/:restaurantId/staff/:staffId/clock-out", async (req, res) => {
  const { restaurantId, staffId } = req.params;
  
  try {
    // Verify staff exists and belongs to restaurant
    const staffCheck = await pool.query(
      `SELECT id FROM users WHERE id = $1 AND restaurant_id = $2 AND (role = 'staff' OR role = 'kitchen')`,
      [staffId, restaurantId]
    );
    
    if (staffCheck.rowCount === 0) {
      return res.status(404).json({ error: "Staff member not found" });
    }
    
    // Find active timekeeping record
    const activeRecord = await pool.query(
      `SELECT id, clock_in_at FROM staff_timekeeping 
       WHERE user_id = $1 AND restaurant_id = $2 AND clock_out_at IS NULL
       ORDER BY clock_in_at DESC LIMIT 1`,
      [staffId, restaurantId]
    );
    
    if (activeRecord.rowCount === 0) {
      return res.status(400).json({ error: "No active clock-in found" });
    }
    
    const recordId = activeRecord.rows[0].id;
    const clockInTime = new Date(activeRecord.rows[0].clock_in_at);
    const clockOutTime = new Date();
    const durationMinutes = Math.round((clockOutTime.getTime() - clockInTime.getTime()) / 60000); // Convert ms to minutes
    
    const result = await pool.query(
      `UPDATE staff_timekeeping 
       SET clock_out_at = NOW(), duration_minutes = $1
       WHERE id = $2 AND restaurant_id = $3
       RETURNING id, clock_in_at, clock_out_at, duration_minutes`,
      [Math.max(1, durationMinutes), recordId, restaurantId]
    );
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to clock out" });
  }
});

// ✅ GET staff timekeeping history
router.get("/restaurants/:restaurantId/staff/:staffId/timekeeping", async (req, res) => {
  const { restaurantId, staffId } = req.params;
  const { limit = 30, offset = 0 } = req.query;
  
  try {
    // Verify staff exists
    const staffCheck = await pool.query(
      `SELECT id FROM users WHERE id = $1 AND restaurant_id = $2 AND (role = 'staff' OR role = 'kitchen')`,
      [staffId, restaurantId]
    );
    
    if (staffCheck.rowCount === 0) {
      return res.status(404).json({ error: "Staff member not found" });
    }
    
    // Fetch timekeeping records (only completed shifts)
    const result = await pool.query(
      `SELECT 
        id, clock_in_at, clock_out_at, duration_minutes,
        TO_CHAR(clock_in_at::date, 'YYYY-MM-DD') as work_date
       FROM staff_timekeeping 
       WHERE user_id = $1 AND restaurant_id = $2 AND clock_out_at IS NOT NULL
       ORDER BY clock_in_at DESC
       LIMIT $3 OFFSET $4`,
      [staffId, restaurantId, limit, offset]
    );
    
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch timekeeping history" });
  }
});

// POST /api/auth/register - Public registration (Google sign-up flow)
router.post("/auth/register", async (req, res) => {
  const {
    email,
    google_id,
    restaurant_name,
    address,
    phone,
    service_charge_percent,
    language_preference,
    timezone,
  } = req.body;

  if (!email || !restaurant_name) {
    return res.status(400).json({ error: "Email and restaurant name are required" });
  }

  try {
    // Check if email or google_id already exists
    const emailCheck = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [email]
    );
    if (emailCheck.rows.length > 0) {
      return res.status(400).json({ error: "Email already in use" });
    }

    if (google_id) {
      const googleCheck = await pool.query(
        "SELECT id FROM users WHERE google_id = $1",
        [google_id]
      );
      if (googleCheck.rows.length > 0) {
        return res.status(400).json({ error: "Google account already registered" });
      }
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Create restaurant
      const restaurantResult = await client.query(
        `INSERT INTO restaurants (name, address, phone, service_charge_percent, language_preference, timezone)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name`,
        [
          restaurant_name,
          address || null,
          phone || null,
          service_charge_percent != null ? service_charge_percent : 0,
          language_preference || "en",
          timezone || "UTC",
        ]
      );

      const restaurantId = restaurantResult.rows[0].id;
      const restaurantName = restaurantResult.rows[0].name;

      // Create admin user (no password since Google auth)
      const userResult = await client.query(
        `INSERT INTO users (email, password_hash, role, restaurant_id, google_id, name)
         VALUES ($1, NULL, 'admin', $2, $3, $4) RETURNING id`,
        [email, restaurantId, google_id || null, email.split("@")[0]]
      );

      const userId = userResult.rows[0].id;

      // Log activity
      await client.query(
        "INSERT INTO staff_activity (restaurant_id, staff_id, action, metadata) VALUES ($1, $2, $3, $4)",
        [restaurantId, userId, "RESTAURANT_CREATED", JSON.stringify({ method: "google_signup" })]
      );

      await client.query("COMMIT");
      client.release();

      // Generate JWT
      const token = jwt.sign(
        { id: userId, role: "admin" },
        process.env.JWT_SECRET || "devsecret",
        { expiresIn: "8h" }
      );

      res.status(201).json({
        token,
        role: "admin",
        restaurantId,
        restaurantName,
        userId: String(userId),
      });
    } catch (err) {
      await client.query("ROLLBACK");
      client.release();
      throw err;
    }
  } catch (err: any) {
    console.error("Register error:", err);
    res.status(500).json({ error: err.message || "Registration failed" });
  }
});

// POST /api/auth/send-verification - Send 6-digit verification code to email
router.post("/auth/send-verification", async (req, res) => {
  const { email } = req.body;

  if (!email || !email.includes("@")) {
    return res.status(400).json({ error: "Valid email is required" });
  }

  try {
    // Check if email already has an account
    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: "Email already in use" });
    }

    // Generate 6-digit code
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Invalidate any previous codes for this email
    await pool.query("DELETE FROM email_verifications WHERE email = $1", [email]);

    // Store the code
    await pool.query(
      "INSERT INTO email_verifications (email, code, expires_at) VALUES ($1, $2, $3)",
      [email, code, expiresAt]
    );

    // Send email
    const sent = await sendVerificationCode(email, code);
    if (!sent) {
      return res.status(500).json({ error: "Failed to send verification email. Please try again." });
    }

    res.json({ message: "Verification code sent" });
  } catch (err: any) {
    console.error("Send verification error:", err);
    res.status(500).json({ error: "Failed to send verification code" });
  }
});

// POST /api/auth/verify-code - Verify the 6-digit code
router.post("/auth/verify-code", async (req, res) => {
  const { email, code } = req.body;

  if (!email || !code) {
    return res.status(400).json({ error: "Email and code are required" });
  }

  try {
    const result = await pool.query(
      "SELECT id FROM email_verifications WHERE email = $1 AND code = $2 AND expires_at > NOW() AND verified = FALSE",
      [email, code]
    );

    if (!result.rows.length) {
      return res.status(400).json({ error: "Invalid or expired verification code" });
    }

    // Mark as verified
    await pool.query(
      "UPDATE email_verifications SET verified = TRUE WHERE email = $1 AND code = $2",
      [email, code]
    );

    res.json({ message: "Email verified", verified: true });
  } catch (err: any) {
    console.error("Verify code error:", err);
    res.status(500).json({ error: "Verification failed" });
  }
});

// POST /api/auth/register-email - Register with verified email + password + restaurant info
router.post("/auth/register-email", async (req, res) => {
  const { email, password, restaurant_name, address, phone, service_charge_percent, language_preference, timezone } = req.body;

  if (!email || !password || !restaurant_name) {
    return res.status(400).json({ error: "Email, password, and restaurant name are required" });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters" });
  }

  try {
    // Verify that the email was verified
    const verResult = await pool.query(
      "SELECT id FROM email_verifications WHERE email = $1 AND verified = TRUE",
      [email]
    );
    if (!verResult.rows.length) {
      return res.status(400).json({ error: "Email has not been verified" });
    }

    // Check email not already taken
    const emailCheck = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
    if (emailCheck.rows.length > 0) {
      return res.status(400).json({ error: "Email already in use" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Create restaurant
      const restaurantResult = await client.query(
        `INSERT INTO restaurants (name, address, phone, service_charge_percent, language_preference, timezone)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name`,
        [restaurant_name, address || null, phone || null, service_charge_percent != null ? service_charge_percent : 0, language_preference || "en", timezone || "UTC"]
      );

      const restaurantId = restaurantResult.rows[0].id;
      const restaurantName = restaurantResult.rows[0].name;

      // Create admin user with password
      const userResult = await client.query(
        `INSERT INTO users (email, password_hash, role, restaurant_id, name)
         VALUES ($1, $2, 'admin', $3, $4) RETURNING id`,
        [email, passwordHash, restaurantId, email.split("@")[0]]
      );

      const userId = userResult.rows[0].id;

      // Clean up verification records
      await client.query("DELETE FROM email_verifications WHERE email = $1", [email]);

      await client.query("COMMIT");
      client.release();

      // Generate JWT
      const token = jwt.sign(
        { id: userId, role: "admin" },
        process.env.JWT_SECRET || "devsecret",
        { expiresIn: "8h" }
      );

      res.status(201).json({
        token,
        role: "admin",
        restaurantId,
        restaurantName,
        userId: String(userId),
      });
    } catch (err) {
      await client.query("ROLLBACK");
      client.release();
      throw err;
    }
  } catch (err: any) {
    console.error("Register email error:", err);
    res.status(500).json({ error: err.message || "Registration failed" });
  }
});

// POST /api/auth/forgot-password - Send password reset email
router.post("/auth/forgot-password", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  try {
    // Find user — always return success to prevent email enumeration
    const result = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
    if (!result.rows.length) {
      return res.json({ message: "If an account exists with that email, a reset link has been sent" });
    }

    const userId = result.rows[0].id;
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Invalidate previous tokens
    await pool.query("UPDATE password_reset_tokens SET used = TRUE WHERE user_id = $1 AND used = FALSE", [userId]);

    // Store token
    await pool.query(
      "INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)",
      [userId, token, expiresAt]
    );

    // Build reset URL
    const baseUrl = process.env.APP_BASE_URL || `${req.protocol}://${req.get("host")}`;
    const resetUrl = `${baseUrl}/reset-password?token=${token}`;

    await sendPasswordResetEmail(email, resetUrl);

    res.json({ message: "If an account exists with that email, a reset link has been sent" });
  } catch (err: any) {
    console.error("Forgot password error:", err);
    res.status(500).json({ error: "Failed to process request" });
  }
});

// POST /api/auth/reset-password - Reset password with token
router.post("/auth/reset-password", async (req, res) => {
  const { token, password } = req.body;

  if (!token || !password) {
    return res.status(400).json({ error: "Token and password are required" });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters" });
  }

  try {
    const result = await pool.query(
      "SELECT id, user_id FROM password_reset_tokens WHERE token = $1 AND expires_at > NOW() AND used = FALSE",
      [token]
    );

    if (!result.rows.length) {
      return res.status(400).json({ error: "Invalid or expired reset token" });
    }

    const { user_id } = result.rows[0];
    const passwordHash = await bcrypt.hash(password, 10);

    // Update password
    await pool.query("UPDATE users SET password_hash = $1 WHERE id = $2", [passwordHash, user_id]);

    // Mark token as used
    await pool.query("UPDATE password_reset_tokens SET used = TRUE WHERE token = $1", [token]);

    res.json({ message: "Password has been reset successfully" });
  } catch (err: any) {
    console.error("Reset password error:", err);
    res.status(500).json({ error: "Failed to reset password" });
  }
});

// GET /api/auth/validate-reset-token - Check if a reset token is still valid
router.get("/auth/validate-reset-token", async (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.status(400).json({ error: "Token is required", valid: false });
  }

  try {
    const result = await pool.query(
      "SELECT id FROM password_reset_tokens WHERE token = $1 AND expires_at > NOW() AND used = FALSE",
      [token]
    );

    res.json({ valid: result.rows.length > 0 });
  } catch (err) {
    res.status(500).json({ error: "Failed to validate token", valid: false });
  }
});

// POST /api/auth/google-login - Login with Google (returning users)
router.post("/auth/google-login", async (req, res) => {
  const { email, google_id } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  try {
    // Find user by google_id or email
    let result;
    if (google_id) {
      result = await pool.query(
        "SELECT id, role, restaurant_id FROM users WHERE google_id = $1",
        [google_id]
      );
    }
    if (!result?.rows.length) {
      result = await pool.query(
        "SELECT id, role, restaurant_id FROM users WHERE email = $1",
        [email]
      );
    }

    if (!result.rows.length) {
      return res.status(404).json({ error: "No account found. Please create an account first." });
    }

    const user = result.rows[0];

    // Update google_id if not set
    if (google_id && !user.google_id) {
      await pool.query("UPDATE users SET google_id = $1 WHERE id = $2", [google_id, user.id]);
    }

    // Get restaurant name and custom deployment URL
    const restaurantResult = await pool.query(
      "SELECT name, api_base_url FROM restaurants WHERE id = $1",
      [user.restaurant_id]
    );
    const restaurantName = restaurantResult.rows[0]?.name || "";
    const apiBaseUrl = restaurantResult.rows[0]?.api_base_url || null;

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET || "devsecret",
      { expiresIn: "8h" }
    );

    res.json({
      token,
      role: user.role,
      restaurantId: user.restaurant_id,
      restaurantName,
      userId: String(user.id),
      apiBaseUrl,
    });
  } catch (err: any) {
    console.error("Google login error:", err);
    res.status(500).json({ error: "Login failed" });
  }
});

// GET /api/restaurants/:restaurantId/info - Get restaurant name (public, for PIN login display)
router.get("/restaurants/:restaurantId/info", async (req, res) => {
  const { restaurantId } = req.params;
  try {
    const result = await pool.query(
      "SELECT id, name FROM restaurants WHERE id = $1",
      [restaurantId]
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: "Restaurant not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch restaurant info" });
  }
});

// ========== PROFILE (Self) ==========

// GET /api/me - Get current user's own profile
router.get("/me", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Not authenticated" });
  try {
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET || "devsecret");
    const result = await pool.query(
      "SELECT id, name, email, role, pin, restaurant_id, access_rights, hourly_rate_cents FROM users WHERE id = $1",
      [decoded.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: "User not found" });
    const user = result.rows[0];
    user.access_rights = user.access_rights
      ? typeof user.access_rights === "string" ? JSON.parse(user.access_rights) : user.access_rights
      : [];
    res.json(user);
  } catch (err) {
    console.error("Failed to fetch profile:", err);
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

// PATCH /api/me - Update current user's own profile
router.patch("/me", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Not authenticated" });
  try {
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET || "devsecret");
    const userCheck = await pool.query("SELECT id, role, restaurant_id FROM users WHERE id = $1", [decoded.id]);
    if (!userCheck.rows.length) return res.status(404).json({ error: "User not found" });

    const currentUser = userCheck.rows[0];
    const { name, email, password, pin } = req.body;

    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (name !== undefined) { updates.push(`name = $${paramIndex++}`); params.push(name); }
    if (email !== undefined) {
      if (email) {
        const emailCheck = await pool.query("SELECT id FROM users WHERE email = $1 AND id != $2", [email, decoded.id]);
        if (emailCheck.rows.length > 0) return res.status(400).json({ error: "Email already in use" });
      }
      updates.push(`email = $${paramIndex++}`); params.push(email || null);
    }
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      updates.push(`password_hash = $${paramIndex++}`); params.push(hash);
    }
    if (pin !== undefined) {
      if (pin && !/^\d{6}$/.test(pin)) return res.status(400).json({ error: "PIN must be 6 digits" });
      if (pin) {
        const pinCheck = await pool.query("SELECT id FROM users WHERE restaurant_id = $1 AND pin = $2 AND id != $3", [currentUser.restaurant_id, pin, decoded.id]);
        if (pinCheck.rows.length > 0) return res.status(400).json({ error: "PIN already in use" });
      }
      updates.push(`pin = $${paramIndex++}`); params.push(pin || null);
    }

    if (updates.length === 0) return res.status(400).json({ error: "No fields to update" });

    params.push(decoded.id);
    const query = `UPDATE users SET ${updates.join(", ")} WHERE id = $${paramIndex}
      RETURNING id, name, email, role, pin, restaurant_id, access_rights, hourly_rate_cents`;
    const result = await pool.query(query, params);

    res.json({ user: result.rows[0], success: true });
  } catch (err: any) {
    console.error("Failed to update profile:", err);
    res.status(500).json({ error: "Failed to update profile", details: err.message });
  }
});

// ========== USER MANAGEMENT (Admin/Superadmin) ==========

// Helper: verify caller is admin/superadmin from token
const verifyAdminRole = async (req: any): Promise<{ id: number; role: string; restaurant_id: number | null } | null> => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return null;
  try {
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET || "devsecret");
    const result = await pool.query("SELECT id, role, restaurant_id FROM users WHERE id = $1", [decoded.id]);
    if (!result.rows.length) return null;
    const user = result.rows[0];
    if (user.role !== "admin" && user.role !== "superadmin") return null;
    return user;
  } catch {
    return null;
  }
};

// GET /api/users - List all users (superadmin sees all, admin sees own restaurant)
router.get("/users", async (req, res) => {
  const caller = await verifyAdminRole(req);
  if (!caller) return res.status(403).json({ error: "Admin access required" });

  try {
    let result;
    if (caller.role === "superadmin") {
      result = await pool.query(
        `SELECT u.id, u.name, u.email, u.role, u.pin, u.restaurant_id, u.access_rights, u.hourly_rate_cents, u.google_id,
                r.name as restaurant_name
         FROM users u
         LEFT JOIN restaurants r ON r.id = u.restaurant_id
         ORDER BY u.id`
      );
    } else {
      result = await pool.query(
        `SELECT u.id, u.name, u.email, u.role, u.pin, u.restaurant_id, u.access_rights, u.hourly_rate_cents, u.google_id,
                r.name as restaurant_name
         FROM users u
         LEFT JOIN restaurants r ON r.id = u.restaurant_id
         WHERE u.restaurant_id = $1
         ORDER BY u.id`,
        [caller.restaurant_id]
      );
    }

    const users = result.rows.map((u: any) => ({
      ...u,
      access_rights: u.access_rights
        ? typeof u.access_rights === "string" ? JSON.parse(u.access_rights) : u.access_rights
        : [],
    }));

    res.json(users);
  } catch (err) {
    console.error("Failed to fetch users:", err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// POST /api/users - Create a user (admin can create staff/kitchen for their restaurant, superadmin can create any role for any restaurant)
router.post("/users", async (req, res) => {
  const caller = await verifyAdminRole(req);
  if (!caller) return res.status(403).json({ error: "Admin access required" });

  const { name, email, password, role, pin, restaurant_id, access_rights, hourly_rate_cents } = req.body;

  if (!name) return res.status(400).json({ error: "Name is required" });
  if (!role) return res.status(400).json({ error: "Role is required" });
  if (!["superadmin", "admin", "staff", "kitchen"].includes(role)) {
    return res.status(400).json({ error: "Invalid role" });
  }

  // Only superadmin can create admin/superadmin
  if ((role === "admin" || role === "superadmin") && caller.role !== "superadmin") {
    return res.status(403).json({ error: "Only superadmin can create admin/superadmin users" });
  }

  // Determine target restaurant
  const targetRestaurantId = caller.role === "superadmin" ? (restaurant_id || caller.restaurant_id) : caller.restaurant_id;

  // superadmin can exist without restaurant; others need one
  if (role !== "superadmin" && !targetRestaurantId) {
    return res.status(400).json({ error: "Restaurant ID is required for non-superadmin users" });
  }

  // Staff/kitchen need PIN
  if ((role === "staff" || role === "kitchen") && !pin) {
    return res.status(400).json({ error: "PIN is required for staff/kitchen users" });
  }
  if (pin && !/^\d{6}$/.test(pin)) {
    return res.status(400).json({ error: "PIN must be 6 digits" });
  }

  // Admin/superadmin need email+password
  if ((role === "admin" || role === "superadmin") && (!email || !password)) {
    return res.status(400).json({ error: "Email and password required for admin/superadmin" });
  }

  try {
    // Check email uniqueness if provided
    if (email) {
      const emailCheck = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
      if (emailCheck.rows.length > 0) {
        return res.status(400).json({ error: "Email already in use" });
      }
    }

    // Check PIN uniqueness within restaurant if provided
    if (pin && targetRestaurantId) {
      const pinCheck = await pool.query(
        "SELECT id FROM users WHERE restaurant_id = $1 AND pin = $2",
        [targetRestaurantId, pin]
      );
      if (pinCheck.rows.length > 0) {
        return res.status(400).json({ error: "PIN already in use at this restaurant" });
      }
    }

    const passwordHash = password ? await bcrypt.hash(password, 10) : null;

    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, pin, restaurant_id, access_rights, hourly_rate_cents)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, name, email, role, pin, restaurant_id, access_rights, hourly_rate_cents`,
      [
        name,
        email || null,
        passwordHash,
        role,
        pin || null,
        role === "superadmin" ? (targetRestaurantId || null) : targetRestaurantId,
        JSON.stringify(access_rights || []),
        hourly_rate_cents || null,
      ]
    );

    res.status(201).json({ user: result.rows[0], success: true });
  } catch (err: any) {
    console.error("Failed to create user:", err);
    res.status(500).json({ error: "Failed to create user", details: err.message });
  }
});

// PATCH /api/users/:userId - Update a user
router.patch("/users/:userId", async (req, res) => {
  const caller = await verifyAdminRole(req);
  if (!caller) return res.status(403).json({ error: "Admin access required" });

  const { userId } = req.params;
  const { name, email, password, role, pin, restaurant_id, access_rights, hourly_rate_cents } = req.body;

  try {
    // Get target user
    const userCheck = await pool.query("SELECT id, role, restaurant_id FROM users WHERE id = $1", [userId]);
    if (!userCheck.rows.length) return res.status(404).json({ error: "User not found" });

    const targetUser = userCheck.rows[0];

    // Admin can only edit users in their own restaurant (not other admins/superadmins)
    if (caller.role !== "superadmin") {
      if (targetUser.restaurant_id !== caller.restaurant_id) {
        return res.status(403).json({ error: "Cannot edit users from another restaurant" });
      }
      if (targetUser.role === "superadmin" || targetUser.role === "admin") {
        return res.status(403).json({ error: "Cannot edit admin/superadmin users" });
      }
    }

    // Only superadmin can change role to admin/superadmin
    if (role && (role === "admin" || role === "superadmin") && caller.role !== "superadmin") {
      return res.status(403).json({ error: "Only superadmin can assign admin/superadmin roles" });
    }

    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (name !== undefined) { updates.push(`name = $${paramIndex++}`); params.push(name); }
    if (email !== undefined) {
      // Check email uniqueness
      if (email) {
        const emailCheck = await pool.query("SELECT id FROM users WHERE email = $1 AND id != $2", [email, userId]);
        if (emailCheck.rows.length > 0) return res.status(400).json({ error: "Email already in use" });
      }
      updates.push(`email = $${paramIndex++}`); params.push(email || null);
    }
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      updates.push(`password_hash = $${paramIndex++}`); params.push(hash);
    }
    if (role !== undefined) { updates.push(`role = $${paramIndex++}`); params.push(role); }
    if (pin !== undefined) {
      if (pin && !/^\d{6}$/.test(pin)) return res.status(400).json({ error: "PIN must be 6 digits" });
      if (pin) {
        const rid = restaurant_id || targetUser.restaurant_id;
        const pinCheck = await pool.query("SELECT id FROM users WHERE restaurant_id = $1 AND pin = $2 AND id != $3", [rid, pin, userId]);
        if (pinCheck.rows.length > 0) return res.status(400).json({ error: "PIN already in use" });
      }
      updates.push(`pin = $${paramIndex++}`); params.push(pin || null);
    }
    if (restaurant_id !== undefined && caller.role === "superadmin") {
      updates.push(`restaurant_id = $${paramIndex++}`); params.push(restaurant_id);
    }
    if (access_rights !== undefined) { updates.push(`access_rights = $${paramIndex++}`); params.push(JSON.stringify(access_rights)); }
    if (hourly_rate_cents !== undefined) { updates.push(`hourly_rate_cents = $${paramIndex++}`); params.push(hourly_rate_cents); }

    if (updates.length === 0) return res.status(400).json({ error: "No fields to update" });

    params.push(userId);
    const query = `UPDATE users SET ${updates.join(", ")} WHERE id = $${paramIndex}
      RETURNING id, name, email, role, pin, restaurant_id, access_rights, hourly_rate_cents`;
    const result = await pool.query(query, params);

    res.json({ user: result.rows[0], success: true });
  } catch (err: any) {
    console.error("Failed to update user:", err);
    res.status(500).json({ error: "Failed to update user", details: err.message });
  }
});

// DELETE /api/users/:userId - Delete a user
router.delete("/users/:userId", async (req, res) => {
  const caller = await verifyAdminRole(req);
  if (!caller) return res.status(403).json({ error: "Admin access required" });

  const { userId } = req.params;

  try {
    const userCheck = await pool.query("SELECT id, role, restaurant_id FROM users WHERE id = $1", [userId]);
    if (!userCheck.rows.length) return res.status(404).json({ error: "User not found" });

    const targetUser = userCheck.rows[0];

    // Cannot delete yourself
    if (targetUser.id === caller.id) {
      return res.status(400).json({ error: "Cannot delete yourself" });
    }

    // Admin can only delete staff/kitchen in own restaurant
    if (caller.role !== "superadmin") {
      if (targetUser.restaurant_id !== caller.restaurant_id) {
        return res.status(403).json({ error: "Cannot delete users from another restaurant" });
      }
      if (targetUser.role === "superadmin" || targetUser.role === "admin") {
        return res.status(403).json({ error: "Cannot delete admin/superadmin users" });
      }
    }

    await pool.query("DELETE FROM users WHERE id = $1", [userId]);
    res.json({ success: true });
  } catch (err) {
    console.error("Failed to delete user:", err);
    res.status(500).json({ error: "Failed to delete user" });
  }
});

// ========== RESTAURANT MANAGEMENT (Admin/Superadmin) ==========

// GET /api/manage/restaurants - List all restaurants
router.get("/manage/restaurants", async (req, res) => {
  const caller = await verifyAdminRole(req);
  if (!caller) return res.status(403).json({ error: "Admin access required" });

  try {
    let result;
    if (caller.role === "superadmin") {
      result = await pool.query(
        `SELECT r.id, r.name, r.address, r.phone, r.timezone, r.service_charge_percent, r.language_preference,
                r.is_customized, r.app_version, r.custom_branch, r.render_service_id, r.api_base_url,
                (SELECT COUNT(*) FROM users WHERE restaurant_id = r.id) as user_count
         FROM restaurants r ORDER BY r.id`
      );
    } else {
      result = await pool.query(
        `SELECT r.id, r.name, r.address, r.phone, r.timezone, r.service_charge_percent, r.language_preference,
                r.is_customized, r.app_version, r.custom_branch, r.render_service_id, r.api_base_url,
                (SELECT COUNT(*) FROM users WHERE restaurant_id = r.id) as user_count
         FROM restaurants r WHERE r.id = $1`,
        [caller.restaurant_id]
      );
    }
    res.json(result.rows);
  } catch (err) {
    console.error("Failed to fetch restaurants:", err);
    res.status(500).json({ error: "Failed to fetch restaurants" });
  }
});

// POST /api/manage/restaurants - Create a new restaurant (superadmin only)
router.post("/manage/restaurants", async (req, res) => {
  const caller = await verifyAdminRole(req);
  if (!caller || caller.role !== "superadmin") {
    return res.status(403).json({ error: "Superadmin access required" });
  }

  const { name, address, phone, timezone, service_charge_percent, language_preference } = req.body;
  if (!name) return res.status(400).json({ error: "Restaurant name is required" });

  try {
    const result = await pool.query(
      `INSERT INTO restaurants (name, address, phone, timezone, service_charge_percent, language_preference)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, address, phone, timezone, service_charge_percent, language_preference`,
      [name, address || null, phone || null, timezone || "UTC", service_charge_percent || 0, language_preference || "en"]
    );
    res.status(201).json({ restaurant: result.rows[0], success: true });
  } catch (err: any) {
    console.error("Failed to create restaurant:", err);
    res.status(500).json({ error: "Failed to create restaurant", details: err.message });
  }
});

// PATCH /api/manage/restaurants/:restaurantId - Update restaurant
router.patch("/manage/restaurants/:restaurantId", async (req, res) => {
  const caller = await verifyAdminRole(req);
  if (!caller) return res.status(403).json({ error: "Admin access required" });

  const { restaurantId } = req.params;

  // Admin can only edit their own restaurant
  if (caller.role !== "superadmin" && String(caller.restaurant_id) !== restaurantId) {
    return res.status(403).json({ error: "Cannot edit another restaurant" });
  }

  const { name, address, phone, timezone, service_charge_percent, language_preference, is_customized, app_version, custom_branch, render_service_id, api_base_url } = req.body;

  // Only superadmin can change customization fields
  if (caller.role !== "superadmin" && (is_customized !== undefined || app_version !== undefined || custom_branch !== undefined || render_service_id !== undefined || api_base_url !== undefined)) {
    return res.status(403).json({ error: "Only superadmin can change customization settings" });
  }

  try {
    const updates: string[] = [];
    const params: any[] = [];
    let i = 1;

    if (name !== undefined) { updates.push(`name = $${i++}`); params.push(name); }
    if (address !== undefined) { updates.push(`address = $${i++}`); params.push(address); }
    if (phone !== undefined) { updates.push(`phone = $${i++}`); params.push(phone); }
    if (timezone !== undefined) { updates.push(`timezone = $${i++}`); params.push(timezone); }
    if (service_charge_percent !== undefined) { updates.push(`service_charge_percent = $${i++}`); params.push(service_charge_percent); }
    if (language_preference !== undefined) { updates.push(`language_preference = $${i++}`); params.push(language_preference); }
    if (is_customized !== undefined) { updates.push(`is_customized = $${i++}`); params.push(is_customized); }
    if (app_version !== undefined) { updates.push(`app_version = $${i++}`); params.push(app_version); }
    if (custom_branch !== undefined) { updates.push(`custom_branch = $${i++}`); params.push(custom_branch); }
    if (render_service_id !== undefined) { updates.push(`render_service_id = $${i++}`); params.push(render_service_id); }
    if (api_base_url !== undefined) { updates.push(`api_base_url = $${i++}`); params.push(api_base_url); }

    if (updates.length === 0) return res.status(400).json({ error: "No fields to update" });

    params.push(restaurantId);
    const query = `UPDATE restaurants SET ${updates.join(", ")} WHERE id = $${i} RETURNING id, name, address, phone, timezone, service_charge_percent, language_preference, is_customized, app_version, custom_branch, render_service_id, api_base_url`;
    const result = await pool.query(query, params);

    if (!result.rows.length) return res.status(404).json({ error: "Restaurant not found" });
    res.json({ restaurant: result.rows[0], success: true });
  } catch (err) {
    console.error("Failed to update restaurant:", err);
    res.status(500).json({ error: "Failed to update restaurant" });
  }
});

// DELETE /api/manage/restaurants/:restaurantId - Delete restaurant (superadmin only)
router.delete("/manage/restaurants/:restaurantId", async (req, res) => {
  const caller = await verifyAdminRole(req);
  if (!caller || caller.role !== "superadmin") {
    return res.status(403).json({ error: "Superadmin access required" });
  }

  const { restaurantId } = req.params;

  try {
    // Check restaurant exists and has no users (safety check)
    const userCount = await pool.query("SELECT COUNT(*) FROM users WHERE restaurant_id = $1", [restaurantId]);
    if (parseInt(userCount.rows[0].count) > 0) {
      return res.status(400).json({ error: "Cannot delete restaurant with existing users. Remove all users first." });
    }

    const result = await pool.query("DELETE FROM restaurants WHERE id = $1 RETURNING id", [restaurantId]);
    if (!result.rows.length) return res.status(404).json({ error: "Restaurant not found" });

    res.json({ success: true });
  } catch (err) {
    console.error("Failed to delete restaurant:", err);
    res.status(500).json({ error: "Failed to delete restaurant" });
  }
});

// POST /api/manage/restaurants/:restaurantId/toggle-customization - Enable/disable restaurant customization
router.post("/manage/restaurants/:restaurantId/toggle-customization", async (req, res) => {
  const caller = await verifyAdminRole(req);
  if (!caller || caller.role !== "superadmin") {
    return res.status(403).json({ error: "Superadmin access required" });
  }

  const { restaurantId } = req.params;
  const { enable } = req.body;

  try {
    // Get current restaurant info
    const restResult = await pool.query("SELECT id, name, is_customized, custom_branch, render_service_id FROM restaurants WHERE id = $1", [restaurantId]);
    if (!restResult.rows.length) return res.status(404).json({ error: "Restaurant not found" });

    const restaurant = restResult.rows[0];
    const branchName = "restaurant/" + restaurant.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

    if (enable && !restaurant.is_customized) {
      // Enable customization: create git branch + Render service
      const steps: string[] = [];
      const errors: string[] = [];

      // Step 1: Create git branch
      try {
        const { execSync } = require("child_process");
        execSync(`git fetch origin main && git branch ${branchName} origin/main && git push origin ${branchName}`, {
          cwd: process.cwd(),
          timeout: 30000,
        });
        steps.push("Git branch created: " + branchName);
      } catch (gitErr: any) {
        // Branch might already exist
        if (gitErr.message && gitErr.message.includes("already exists")) {
          steps.push("Git branch already exists: " + branchName);
        } else {
          errors.push("Git branch creation failed: " + (gitErr.message || "Unknown error"));
        }
      }

      // Step 2: Create Render service (if RENDER_API_KEY is set)
      let renderServiceId = restaurant.render_service_id;
      let apiBaseUrl = null;
      const renderApiKey = process.env.RENDER_API_KEY;
      const renderOwnerId = process.env.RENDER_OWNER_ID;

      if (renderApiKey && renderOwnerId && !renderServiceId) {
        try {
          const serviceName = "chuio-" + restaurant.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
          const renderResponse = await fetch("https://api.render.com/v1/services", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${renderApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              type: "web_service",
              name: serviceName,
              ownerId: renderOwnerId,
              repo: process.env.RENDER_REPO_URL || "https://github.com/chuio/qr-restaurant-ai",
              branch: branchName,
              rootDir: "backend",
              runtime: "node",
              buildCommand: "npm install && npm run build",
              startCommand: "npm start",
              plan: "starter",
              envVars: [
                { key: "NODE_ENV", value: "production" },
                { key: "DATABASE_URL", value: process.env.DATABASE_URL || "" },
              ],
            }),
          });

          if (renderResponse.ok) {
            const renderData = await renderResponse.json() as any;
            renderServiceId = renderData.service?.id || renderData.id;
            // Construct the URL from the service
            const serviceSlug = renderData.service?.slug || serviceName;
            apiBaseUrl = `https://${serviceSlug}.onrender.com`;
            steps.push("Render service created: " + serviceName);
          } else {
            const errBody = await renderResponse.text();
            errors.push("Render service creation failed: " + errBody);
          }
        } catch (renderErr: any) {
          errors.push("Render API error: " + (renderErr.message || "Unknown error"));
        }
      } else if (!renderApiKey) {
        steps.push("Skipped Render deployment (RENDER_API_KEY not set - configure manually)");
      }

      // Step 3: Update restaurant record
      await pool.query(
        `UPDATE restaurants SET is_customized = TRUE, custom_branch = $1, render_service_id = $2, api_base_url = $3 WHERE id = $4`,
        [branchName, renderServiceId || null, apiBaseUrl || null, restaurantId]
      );
      steps.push("Restaurant marked as customized");

      const updatedResult = await pool.query(
        `SELECT id, name, is_customized, app_version, custom_branch, render_service_id, api_base_url FROM restaurants WHERE id = $1`,
        [restaurantId]
      );

      res.json({
        success: true,
        restaurant: updatedResult.rows[0],
        steps,
        errors: errors.length > 0 ? errors : undefined,
        manual_steps: !renderApiKey ? [
          "1. Deploy branch '" + branchName + "' to your hosting provider",
          "2. Set up a PostgreSQL database for this restaurant",
          "3. Run all migrations on the new database",
          "4. Update api_base_url: UPDATE restaurants SET api_base_url = 'https://YOUR_URL' WHERE id = " + restaurantId,
        ] : undefined,
      });
    } else if (!enable && restaurant.is_customized) {
      // Disable customization: reset to default (keep branch for safety, don't delete Render service)
      await pool.query(
        `UPDATE restaurants SET is_customized = FALSE, api_base_url = NULL WHERE id = $1`,
        [restaurantId]
      );

      const updatedResult = await pool.query(
        `SELECT id, name, is_customized, app_version, custom_branch, render_service_id, api_base_url FROM restaurants WHERE id = $1`,
        [restaurantId]
      );

      res.json({
        success: true,
        restaurant: updatedResult.rows[0],
        steps: ["Customization disabled. Restaurant will use main platform."],
        note: "Git branch and Render service preserved for safety. Delete manually if needed.",
      });
    } else {
      res.json({ success: true, message: "No change needed" });
    }
  } catch (err) {
    console.error("Failed to toggle customization:", err);
    res.status(500).json({ error: "Failed to toggle customization" });
  }
});

// ========== PAYMENT TERMINAL APPLICATIONS ==========

// POST /api/restaurants/:restaurantId/payment-terminal-applications - Submit application
router.post("/restaurants/:restaurantId/payment-terminal-applications",
  uploadDocuments.fields([
    { name: 'br_certificate', maxCount: 1 },
    { name: 'restaurant_license', maxCount: 1 },
  ]),
  async (req, res) => {
    const caller = await verifyAdminRole(req);
    if (!caller) return res.status(403).json({ error: "Admin access required" });

    const { restaurantId } = req.params;

    // Admin can only submit for their own restaurant
    if (caller.role !== "superadmin" && String(caller.restaurant_id) !== restaurantId) {
      return res.status(403).json({ error: "Cannot submit application for another restaurant" });
    }

    const { company_name, contact_number, contact_email, br_license_no } = req.body;

    if (!company_name || !contact_number || !contact_email || !br_license_no) {
      return res.status(400).json({ error: "All fields are required: company_name, contact_number, contact_email, br_license_no" });
    }

    try {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      const brCertUrl = files?.br_certificate?.[0]
        ? `/${files.br_certificate[0].path.replace(/\\/g, '/')}`
        : null;
      const restaurantLicenseUrl = files?.restaurant_license?.[0]
        ? `/${files.restaurant_license[0].path.replace(/\\/g, '/')}`
        : null;

      const result = await pool.query(
        `INSERT INTO payment_terminal_applications
          (restaurant_id, company_name, contact_number, contact_email, br_license_no, br_certificate_url, restaurant_license_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [restaurantId, company_name, contact_number, contact_email, br_license_no, brCertUrl, restaurantLicenseUrl]
      );

      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error("Failed to submit payment terminal application:", err);
      res.status(500).json({ error: "Failed to submit application" });
    }
  }
);

// GET /api/restaurants/:restaurantId/payment-terminal-applications - Get applications for a restaurant
router.get("/restaurants/:restaurantId/payment-terminal-applications", async (req, res) => {
  const caller = await verifyAdminRole(req);
  if (!caller) return res.status(403).json({ error: "Admin access required" });

  const { restaurantId } = req.params;

  // Admin can only see their own restaurant's applications
  if (caller.role !== "superadmin" && String(caller.restaurant_id) !== restaurantId) {
    return res.status(403).json({ error: "Access denied" });
  }

  try {
    const result = await pool.query(
      `SELECT pta.*, u.name as reviewer_name
       FROM payment_terminal_applications pta
       LEFT JOIN users u ON u.id = pta.reviewed_by
       WHERE pta.restaurant_id = $1
       ORDER BY pta.submitted_at DESC`,
      [restaurantId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Failed to fetch payment terminal applications:", err);
    res.status(500).json({ error: "Failed to fetch applications" });
  }
});

// GET /api/manage/payment-terminal-applications - List all applications (superadmin only)
router.get("/manage/payment-terminal-applications", async (req, res) => {
  const caller = await verifyAdminRole(req);
  if (!caller || caller.role !== "superadmin") {
    return res.status(403).json({ error: "Superadmin access required" });
  }

  try {
    const result = await pool.query(
      `SELECT pta.*, r.name as restaurant_name, u.name as reviewer_name
       FROM payment_terminal_applications pta
       JOIN restaurants r ON r.id = pta.restaurant_id
       LEFT JOIN users u ON u.id = pta.reviewed_by
       ORDER BY pta.submitted_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Failed to fetch all payment terminal applications:", err);
    res.status(500).json({ error: "Failed to fetch applications" });
  }
});

// PATCH /api/manage/payment-terminal-applications/:id - Update application status (superadmin only)
router.patch("/manage/payment-terminal-applications/:id", async (req, res) => {
  const caller = await verifyAdminRole(req);
  if (!caller || caller.role !== "superadmin") {
    return res.status(403).json({ error: "Superadmin access required" });
  }

  const { id } = req.params;
  const { status, admin_notes } = req.body;

  if (status && !["pending", "approved", "rejected"].includes(status)) {
    return res.status(400).json({ error: "Invalid status. Must be: pending, approved, or rejected" });
  }

  try {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (status) {
      updates.push(`status = $${paramIndex++}`);
      values.push(status);
      updates.push(`reviewed_at = NOW()`);
      updates.push(`reviewed_by = $${paramIndex++}`);
      values.push(caller.id);
    }
    if (admin_notes !== undefined) {
      updates.push(`admin_notes = $${paramIndex++}`);
      values.push(admin_notes);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    values.push(id);
    const result = await pool.query(
      `UPDATE payment_terminal_applications SET ${updates.join(", ")} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Application not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Failed to update payment terminal application:", err);
    res.status(500).json({ error: "Failed to update application" });
  }
});

export default router;
