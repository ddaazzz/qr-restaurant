import { Router } from "express";
import pool from "../config/db";
import { PKPass } from "passkit-generator";
import * as fs from "fs";
import * as path from "path";

const router = Router();

// ─── Cert loading: prefer env vars (Render), fall back to local files ─────────
const CERTS_DIR = path.resolve(__dirname, "../../certs");

function loadCert(envKey: string, fileName: string): Buffer | null {
  const b64 = process.env[envKey];
  if (b64) return Buffer.from(b64, "base64");
  const filePath = path.join(CERTS_DIR, fileName);
  if (fs.existsSync(filePath)) return fs.readFileSync(filePath);
  return null;
}

function certExists(): boolean {
  return !!(
    loadCert("APPLE_PASS_CERT_B64", "pass.pem") &&
    loadCert("APPLE_PASS_KEY_B64", "passkit.key.pem") &&
    loadCert("APPLE_WWDR_B64", "wwdr.pem")
  );
}

// ─── Build + sign a .pkpass Buffer from a pass JSON object ───────────────────
async function signPassJson(passJson: any, logoBuffer?: Buffer): Promise<Buffer> {
  const signerCert = loadCert("APPLE_PASS_CERT_B64", "pass.pem");
  const signerKey  = loadCert("APPLE_PASS_KEY_B64", "passkit.key.pem");
  const wwdr       = loadCert("APPLE_WWDR_B64", "wwdr.pem");
  if (!signerCert || !signerKey || !wwdr) throw new Error("PassKit certificates not configured");

  // Minimal 1×1 transparent PNG placeholder for icon/logo
  const transparentPng = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "base64"
  );
  const logo = logoBuffer || transparentPng;

  const buffers: Record<string, Buffer> = {
    "pass.json":    Buffer.from(JSON.stringify(passJson)),
    "logo.png":     logo,
    "logo@2x.png":  logo,
    "icon.png":     logo,
    "icon@2x.png":  logo,
  };

  const certs = { wwdr, signerCert, signerKey };

  const pass = new PKPass(buffers, certs, passJson);
  return pass.getAsBuffer();
}

// Haversine formula — returns distance in metres between two lat/lng points
function haversineMetres(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── GET /api/xish/wallet-settings/:restaurantId ─────────────────────────────
router.get("/xish/wallet-settings/:restaurantId", async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const result = await pool.query(
      `SELECT * FROM xish_wallet_settings WHERE restaurant_id = $1`,
      [restaurantId]
    );

    if (result.rows.length === 0) {
      // Return defaults (no row yet)
      return res.json({
        restaurant_id: parseInt(restaurantId),
        program_name: "XISH Loyalty",
        description: "XISH Loyalty Card",
        logo_text: "XISH",
        organization_name: "XISH Loyalty",
        background_color: "rgb(15,15,20)",
        foreground_color: "rgb(255,255,255)",
        label_color: "rgb(201,168,76)",
        header_field_label: "TIER",
        primary_field_label: "POINTS BALANCE",
        secondary1_label: "MEMBER",
        secondary2_label: "XISH ID",
        back1_label: "Order Online",
        back1_value: "",
        back2_label: "About XISH",
        back2_value: "Asia's national loyalty network — xish.io",
        back3_label: "",
        back3_value: "",
        barcode_format: "PKBarcodeFormatQR",
        location_lat: null,
        location_lng: null,
        location_label: null,
      });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("[XISH wallet-settings GET]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── PATCH /api/xish/wallet-settings/:restaurantId ───────────────────────────
router.patch("/xish/wallet-settings/:restaurantId", async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const {
      program_name, description, logo_text, organization_name,
      background_color, foreground_color, label_color,
      header_field_label, primary_field_label, secondary1_label, secondary2_label,
      back1_label, back1_value, back2_label, back2_value, back3_label, back3_value,
      barcode_format, location_lat, location_lng, location_label,
    } = req.body;

    await pool.query(
      `INSERT INTO xish_wallet_settings (
         restaurant_id, program_name, description, logo_text, organization_name,
         background_color, foreground_color, label_color,
         header_field_label, primary_field_label, secondary1_label, secondary2_label,
         back1_label, back1_value, back2_label, back2_value, back3_label, back3_value,
         barcode_format, location_lat, location_lng, location_label, updated_at
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,NOW()
       )
       ON CONFLICT (restaurant_id) DO UPDATE SET
         program_name       = EXCLUDED.program_name,
         description        = EXCLUDED.description,
         logo_text          = EXCLUDED.logo_text,
         organization_name  = EXCLUDED.organization_name,
         background_color   = EXCLUDED.background_color,
         foreground_color   = EXCLUDED.foreground_color,
         label_color        = EXCLUDED.label_color,
         header_field_label = EXCLUDED.header_field_label,
         primary_field_label = EXCLUDED.primary_field_label,
         secondary1_label   = EXCLUDED.secondary1_label,
         secondary2_label   = EXCLUDED.secondary2_label,
         back1_label        = EXCLUDED.back1_label,
         back1_value        = EXCLUDED.back1_value,
         back2_label        = EXCLUDED.back2_label,
         back2_value        = EXCLUDED.back2_value,
         back3_label        = EXCLUDED.back3_label,
         back3_value        = EXCLUDED.back3_value,
         barcode_format     = EXCLUDED.barcode_format,
         location_lat       = EXCLUDED.location_lat,
         location_lng       = EXCLUDED.location_lng,
         location_label     = EXCLUDED.location_label,
         updated_at         = NOW()`,
      [
        restaurantId, program_name, description, logo_text, organization_name,
        background_color, foreground_color, label_color,
        header_field_label, primary_field_label, secondary1_label, secondary2_label,
        back1_label, back1_value, back2_label, back2_value, back3_label, back3_value,
        barcode_format, location_lat || null, location_lng || null, location_label || null,
      ]
    );

    const updated = await pool.query(
      `SELECT * FROM xish_wallet_settings WHERE restaurant_id = $1`,
      [restaurantId]
    );
    res.json(updated.rows[0]);
  } catch (err) {
    console.error("[XISH wallet-settings PATCH]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET /api/xish/wallet/nearby-merchants ───────────────────────────────────
// Returns up to 10 nearest XISH-enabled restaurants for a given GPS coordinate.
router.get("/xish/wallet/nearby-merchants", async (req, res) => {
  try {
    const { lat, lng, limit = "10" } = req.query as Record<string, string>;
    if (!lat || !lng) return res.status(400).json({ error: "lat and lng required" });

    const userLat = parseFloat(lat);
    const userLng = parseFloat(lng);

    const all = await pool.query(
      `SELECT id, name, lat, lng, logo_url FROM restaurants
       WHERE xish_enabled = true AND lat IS NOT NULL AND lng IS NOT NULL`
    );

    const withDist = all.rows
      .map((r: any) => ({
        ...r,
        distance_m: haversineMetres(userLat, userLng, parseFloat(r.lat), parseFloat(r.lng)),
      }))
      .sort((a: any, b: any) => a.distance_m - b.distance_m)
      .slice(0, parseInt(limit));

    res.json(withDist);
  } catch (err) {
    console.error("[XISH nearby-merchants]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /api/xish/wallet/update-nearby ─────────────────────────────────────
router.post("/xish/wallet/update-nearby", async (req, res) => {
  try {
    const { member_id, lat, lng } = req.body;
    if (!member_id || !lat || !lng) {
      return res.status(400).json({ error: "member_id, lat, lng required" });
    }

    const userLat = parseFloat(lat);
    const userLng = parseFloat(lng);

    const all = await pool.query(
      `SELECT id, name, lat, lng FROM restaurants
       WHERE xish_enabled = true AND lat IS NOT NULL AND lng IS NOT NULL`
    );

    const nearby = all.rows
      .map((r: any) => ({
        id: r.id,
        name: r.name,
        lat: parseFloat(r.lat),
        lng: parseFloat(r.lng),
        distance_m: haversineMetres(userLat, userLng, parseFloat(r.lat), parseFloat(r.lng)),
      }))
      .sort((a: any, b: any) => a.distance_m - b.distance_m)
      .slice(0, 10);

    const nearbyIds = nearby.map((r: any) => r.id);

    await pool.query(
      `INSERT INTO xish_wallet_passes (member_id, pass_type, nearby_merchant_ids, last_updated_at)
       VALUES ($1, 'apple', $2, NOW())
       ON CONFLICT (member_id, pass_type)
       DO UPDATE SET nearby_merchant_ids = $2, last_updated_at = NOW()`,
      [member_id, JSON.stringify(nearbyIds)]
    );

    res.json({ ok: true, nearby });
  } catch (err) {
    console.error("[XISH update-nearby]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /api/xish/wallet/generate-pass ─────────────────────────────────────
// Returns the signed .pkpass bundle if certs are present, otherwise pass JSON.
router.post("/xish/wallet/generate-pass", async (req, res) => {
  try {
    const { member_id, pass_type = "apple" } = req.body;
    if (!member_id) return res.status(400).json({ error: "member_id required" });

    const memberRes = await pool.query(
      `SELECT m.*, c.name AS customer_name, c.restaurant_id
       FROM xish_members m
       JOIN crm_customers c ON c.id = m.crm_customer_id
       WHERE m.id = $1`,
      [member_id]
    );
    if (!memberRes.rows[0]) return res.status(404).json({ error: "Member not found" });
    const m = memberRes.rows[0];

    // Load wallet settings for this restaurant (fall back to defaults)
    const settingsRes = await pool.query(
      `SELECT * FROM xish_wallet_settings WHERE restaurant_id = $1`,
      [m.restaurant_id]
    );
    const s = settingsRes.rows[0] || {};

    const programName    = s.program_name     || "XISH Loyalty";
    const logoText       = s.logo_text        || "XISH";
    const orgName        = s.organization_name || "XISH Loyalty";
    const desc           = s.description      || "XISH Loyalty Card";
    const bgColor        = s.background_color || "rgb(15,15,20)";
    const fgColor        = s.foreground_color || "rgb(255,255,255)";
    const lblColor       = s.label_color      || "rgb(201,168,76)";
    const headerLbl      = s.header_field_label   || "TIER";
    const primaryLbl     = s.primary_field_label  || "POINTS BALANCE";
    const sec1Lbl        = s.secondary1_label || "MEMBER";
    const sec2Lbl        = s.secondary2_label || "XISH ID";
    const barcodeFormat  = s.barcode_format   || "PKBarcodeFormatQR";

    const serial = `XISH-${m.xish_id || member_id}-${Date.now()}`;
    const baseUrl = process.env.APP_BASE_URL || "https://chuio.io";
    const passUrl = `${baseUrl}/xish/wallet/member/${m.wallet_id || member_id}`;

    const passJson: any = {
      formatVersion: 1,
      passTypeIdentifier: process.env.APPLE_PASS_TYPE_ID || "pass.io.xish.loyalty",
      serialNumber: serial,
      teamIdentifier: process.env.APPLE_TEAM_ID || "TEAMID",
      organizationName: orgName,
      description: desc,
      logoText: logoText,
      foregroundColor: fgColor,
      backgroundColor: bgColor,
      labelColor: lblColor,
      webServiceURL: `${baseUrl}/api/xish/wallet/passkit`,
      authenticationToken: m.wallet_id || `token-${member_id}`,
      storeCard: {
        headerFields: [
          { key: "tier", label: headerLbl, value: (m.tier || "basic").toUpperCase() },
        ],
        primaryFields: [
          { key: "points", label: primaryLbl, value: `${(m.points_balance || 0).toLocaleString()} pts` },
        ],
        secondaryFields: [
          { key: "member_name", label: sec1Lbl, value: m.customer_name || "—" },
          { key: "xish_id",    label: sec2Lbl, value: m.xish_id || String(member_id) },
        ],
        backFields: [] as any[],
      },
      barcodes: [
        {
          message: m.xish_id || String(member_id),
          format: barcodeFormat,
          messageEncoding: "iso-8859-1",
          altText: m.xish_id || String(member_id),
        },
      ],
    };

    // Back fields from settings
    if (s.back1_label) {
      passJson.storeCard.backFields.push({
        key: "back1", label: s.back1_label,
        value: s.back1_value || passUrl,
      });
    }
    if (s.back2_label) {
      passJson.storeCard.backFields.push({
        key: "back2", label: s.back2_label,
        value: s.back2_value || `Asia's national loyalty network — xish.io`,
      });
    }
    if (s.back3_label) {
      passJson.storeCard.backFields.push({
        key: "back3", label: s.back3_label,
        value: s.back3_value || "",
      });
    }

    // Location relevance
    if (s.location_lat && s.location_lng) {
      passJson.locations = [
        {
          latitude: parseFloat(s.location_lat),
          longitude: parseFloat(s.location_lng),
          relevantText: s.location_label || programName,
        },
      ];
    }

    // Record serial in DB
    await pool.query(
      `INSERT INTO xish_wallet_passes (member_id, pass_type, pass_serial, last_updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (member_id, pass_type)
       DO UPDATE SET pass_serial = $3, last_updated_at = NOW()`,
      [member_id, pass_type, serial]
    );

    if (certExists()) {
      // Return a real signed .pkpass binary
      try {
        const pkpassBuffer = await signPassJson(passJson);
        res.set("Content-Type", "application/vnd.apple.pkpass");
        res.set("Content-Disposition", `attachment; filename="xish-${m.xish_id || member_id}.pkpass"`);
        return res.send(pkpassBuffer);
      } catch (signErr) {
        console.error("[XISH sign-pass] signing failed, falling back to JSON:", signErr);
      }
    }

    // Fallback: return pass JSON + metadata
    res.json({
      pass_serial: serial,
      pass_json: passJson,
      pass_url: passUrl,
      wallet_id: m.wallet_id || member_id,
      apple_cert_required: false,
    });
  } catch (err) {
    console.error("[XISH generate-pass]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET /api/xish/wallet/download/:memberId ─────────────────────────────────
// Direct browser download of a signed .pkpass for a member.
router.get("/xish/wallet/download/:memberId", async (req, res) => {
  try {
    const { memberId } = req.params;

    const memberRes = await pool.query(
      `SELECT m.*, c.name AS customer_name, c.restaurant_id
       FROM xish_members m
       JOIN crm_customers c ON c.id = m.crm_customer_id
       WHERE m.id = $1::int OR m.xish_id = $1::text`,
      [memberId]
    );
    if (!memberRes.rows[0]) return res.status(404).json({ error: "Member not found" });
    const m = memberRes.rows[0];

    const settingsRes = await pool.query(
      `SELECT * FROM xish_wallet_settings WHERE restaurant_id = $1`,
      [m.restaurant_id]
    );
    const s = settingsRes.rows[0] || {};

    const baseUrl = process.env.APP_BASE_URL || "https://chuio.io";
    const passUrl = `${baseUrl}/xish/wallet/member/${m.wallet_id || m.id}`;
    const serial  = `XISH-${m.xish_id || m.id}-${Date.now()}`;

    const passJson: any = {
      formatVersion: 1,
      passTypeIdentifier: process.env.APPLE_PASS_TYPE_ID || "pass.io.xish.loyalty",
      serialNumber: serial,
      teamIdentifier: process.env.APPLE_TEAM_ID || "5V7D5PUU8D",
      organizationName: s.organization_name || "XISH Loyalty",
      description: s.description || "XISH Loyalty Card",
      logoText: s.logo_text || "XISH",
      foregroundColor: s.foreground_color || "rgb(255,255,255)",
      backgroundColor: s.background_color || "rgb(15,15,20)",
      labelColor: s.label_color || "rgb(201,168,76)",
      storeCard: {
        headerFields: [
          { key: "tier", label: s.header_field_label || "TIER", value: (m.tier || "basic").toUpperCase() },
        ],
        primaryFields: [
          { key: "points", label: s.primary_field_label || "POINTS BALANCE", value: `${(m.points_balance || 0).toLocaleString()} pts` },
        ],
        secondaryFields: [
          { key: "member_name", label: s.secondary1_label || "MEMBER", value: m.customer_name || "—" },
          { key: "xish_id",    label: s.secondary2_label || "XISH ID",  value: m.xish_id || String(m.id) },
        ],
        backFields: [] as any[],
      },
      barcodes: [{
        message: m.xish_id || String(m.id),
        format: s.barcode_format || "PKBarcodeFormatQR",
        messageEncoding: "iso-8859-1",
        altText: m.xish_id || String(m.id),
      }],
    };

    if (s.back1_label) passJson.storeCard.backFields.push({ key: "back1", label: s.back1_label, value: s.back1_value || passUrl });
    if (s.back2_label) passJson.storeCard.backFields.push({ key: "back2", label: s.back2_label, value: s.back2_value || "" });
    if (s.back3_label) passJson.storeCard.backFields.push({ key: "back3", label: s.back3_label, value: s.back3_value || "" });

    if (s.location_lat && s.location_lng) {
      passJson.locations = [{
        latitude: parseFloat(s.location_lat),
        longitude: parseFloat(s.location_lng),
        relevantText: s.location_label || (s.program_name || "XISH"),
      }];
    }

    if (!certExists()) {
      return res.status(503).json({ error: "PassKit certificates not configured on server" });
    }

    const pkpassBuffer = await signPassJson(passJson);
    res.set("Content-Type", "application/vnd.apple.pkpass");
    res.set("Content-Disposition", `attachment; filename="xish-${m.xish_id || m.id}.pkpass"`);
    res.send(pkpassBuffer);
  } catch (err) {
    console.error("[XISH download-pass]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET /api/xish/wallet/member-pass/:memberId ──────────────────────────────
// Returns pass preview data for displaying in the dashboard or generating a QR.
router.get("/xish/wallet/member-pass/:memberId", async (req, res) => {
  try {
    const { memberId } = req.params;

    const memberRes = await pool.query(
      `SELECT m.*, c.name AS customer_name, c.restaurant_id
       FROM xish_members m
       JOIN crm_customers c ON c.id = m.crm_customer_id
       WHERE m.id = $1::int OR m.xish_id = $1::text`,
      [memberId]
    );
    if (!memberRes.rows[0]) return res.status(404).json({ error: "Member not found" });
    const m = memberRes.rows[0];

    const settingsRes = await pool.query(
      `SELECT * FROM xish_wallet_settings WHERE restaurant_id = $1`,
      [m.restaurant_id]
    );
    const s = settingsRes.rows[0] || {};

    const baseUrl = process.env.APP_BASE_URL || "https://chuio.io";
    const downloadUrl = `${baseUrl}/api/xish/wallet/download/${m.id}`;

    res.json({
      member: {
        id: m.id,
        xish_id: m.xish_id,
        customer_name: m.customer_name,
        tier: m.tier,
        points_balance: m.points_balance,
        wallet_id: m.wallet_id,
      },
      settings: s,
      pass_url: downloadUrl,
      qr_data: downloadUrl,
      cert_ready: certExists(),
    });
  } catch (err) {
    console.error("[XISH member-pass]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /api/xish/pos-sync ──────────────────────────────────────────────────
router.post("/xish/pos-sync", async (req, res) => {
  try {
    const { session_id, restaurant_id, wallet_id, total_cents } = req.body;
    if (!session_id || !restaurant_id || !total_cents) {
      return res.status(400).json({ error: "session_id, restaurant_id, total_cents required" });
    }

    let memberRes;
    if (wallet_id) {
      memberRes = await pool.query(
        `SELECT m.id, m.points_balance FROM xish_members m WHERE m.wallet_id = $1`,
        [wallet_id]
      );
    } else {
      memberRes = await pool.query(
        `SELECT m.id, m.points_balance
         FROM table_sessions s
         JOIN crm_customers c ON c.phone = s.customer_phone AND c.restaurant_id = s.restaurant_id
         JOIN xish_members m ON m.crm_customer_id = c.id
         WHERE s.id = $1`,
        [session_id]
      );
    }

    if (!memberRes || memberRes.rows.length === 0) {
      return res.json({ ok: true, points_awarded: 0, reason: "no_member_found" });
    }

    const member = memberRes.rows[0];
    const pointsToAward = Math.floor(total_cents / 1000);

    if (pointsToAward > 0) {
      await pool.query(
        `INSERT INTO xish_point_transactions (member_id, restaurant_id, session_id, points_delta, reason)
         VALUES ($1, $2, $3, $4, 'purchase')`,
        [member.id, restaurant_id, session_id, pointsToAward]
      );

      await pool.query(
        `UPDATE xish_members
         SET points_balance = points_balance + $2,
             tier = CASE
               WHEN points_balance + $2 >= 10000 THEN 'platinum'
               WHEN points_balance + $2 >= 5000  THEN 'gold'
               WHEN points_balance + $2 >= 2000  THEN 'silver'
               ELSE 'basic'
             END,
             updated_at = NOW()
         WHERE id = $1`,
        [member.id, pointsToAward]
      );

      await pool.query(
        `UPDATE crm_customers c
         SET xish_member_status = m.tier,
             is_previous_diner  = true,
             xish_discount_usage_count = xish_discount_usage_count + 1,
             updated_at = NOW()
         FROM xish_members m
         WHERE m.id = $1 AND m.crm_customer_id = c.id`,
        [member.id]
      );
    }

    res.json({ ok: true, points_awarded: pointsToAward, member_id: member.id });
  } catch (err) {
    console.error("[XISH pos-sync]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET /api/xish/join-info/:restaurantId ────────────────────────────────────
// Public endpoint — returns program branding for the customer-facing join page.
router.get("/xish/join-info/:restaurantId", async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const [rRes, sRes] = await Promise.all([
      pool.query(`SELECT id, name FROM restaurants WHERE id = $1`, [restaurantId]),
      pool.query(`SELECT * FROM xish_wallet_settings WHERE restaurant_id = $1`, [restaurantId]),
    ]);
    if (!rRes.rows[0]) return res.status(404).json({ error: "Restaurant not found" });
    const r = rRes.rows[0];
    const s = sRes.rows[0] || {};
    res.json({
      restaurant_name:  r.name,
      program_name:     s.program_name      || "Loyalty Rewards",
      logo_text:        s.logo_text         || r.name,
      background_color: s.background_color  || "rgb(15,15,20)",
      foreground_color: s.foreground_color  || "rgb(255,255,255)",
      label_color:      s.label_color       || "rgb(201,168,76)",
      description:      s.description       || `Join ${r.name}'s loyalty programme and earn points on every visit.`,
    });
  } catch (err) {
    console.error("[XISH join-info]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /api/xish/join ──────────────────────────────────────────────────────
// Public endpoint — customer taps "Add to Wallet". Name + phone are optional;
// a placeholder CRM record is created so the member can be claimed later.
// Returns JSON { success, member_id, xish_id, download_url } — the frontend
// then does window.location.href = download_url so iOS shows the Wallet sheet
// in the same tab without opening a new one.
router.post("/xish/join", async (req, res) => {
  try {
    const { restaurant_id, name, phone } = req.body;
    if (!restaurant_id) {
      return res.status(400).json({ error: "restaurant_id is required" });
    }

    const cleanPhone = phone ? String(phone).replace(/\s/g, "") : null;
    const cleanName  = name  ? String(name).trim() : null;

    let crmId: number;

    if (cleanPhone) {
      // Known customer — upsert by phone
      const crmRes = await pool.query(
        `INSERT INTO crm_customers (restaurant_id, phone, name, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())
         ON CONFLICT (restaurant_id, phone) DO UPDATE
           SET name       = COALESCE(EXCLUDED.name, crm_customers.name),
               updated_at = NOW()
         RETURNING id`,
        [restaurant_id, cleanPhone, cleanName || "Loyalty Member"]
      );
      crmId = crmRes.rows[0].id;
    } else {
      // Anonymous — create a new CRM placeholder (no phone)
      const crmRes = await pool.query(
        `INSERT INTO crm_customers (restaurant_id, name, created_at, updated_at)
         VALUES ($1, $2, NOW(), NOW())
         RETURNING id`,
        [restaurant_id, cleanName || "Loyalty Member"]
      );
      crmId = crmRes.rows[0].id;
    }

    // 2. Upsert XISH member
    const memberCheckRes = await pool.query(
      `SELECT id, xish_id FROM xish_members WHERE crm_customer_id = $1`,
      [crmId]
    );

    let memberId: number;
    let xishId: string;

    if (memberCheckRes.rows[0]) {
      memberId = memberCheckRes.rows[0].id;
      xishId   = memberCheckRes.rows[0].xish_id;
    } else {
      // Generate a unique XISH ID
      const countRes = await pool.query(`SELECT COUNT(*) AS c FROM xish_members`);
      const seq = String(parseInt(countRes.rows[0].c) + 1).padStart(6, "0");
      xishId = `XSH-${seq}`;
      const newMember = await pool.query(
        `INSERT INTO xish_members (crm_customer_id, xish_id, tier, points_balance)
         VALUES ($1, $2, 'basic', 0) RETURNING id`,
        [crmId, xishId]
      );
      memberId = newMember.rows[0].id;
    }

    // 3. Load wallet settings
    const sRes = await pool.query(
      `SELECT * FROM xish_wallet_settings WHERE restaurant_id = $1`,
      [restaurant_id]
    );
    const s = sRes.rows[0] || {};

    const rRes = await pool.query(`SELECT name FROM restaurants WHERE id = $1`, [restaurant_id]);
    const restaurantName = rRes.rows[0]?.name || "Restaurant";

    const baseUrl    = process.env.APP_BASE_URL || "https://chuio.io";
    const serial     = `XISH-${xishId}-${Date.now()}`;
    const memberName = cleanName || (cleanPhone ? cleanPhone : "Loyalty Member");

    const passJson: any = {
      formatVersion: 1,
      passTypeIdentifier: process.env.APPLE_PASS_TYPE_ID || "pass.io.xish.loyalty",
      serialNumber: serial,
      teamIdentifier: process.env.APPLE_TEAM_ID || "5V7D5PUU8D",
      organizationName: s.organization_name || restaurantName,
      description: s.description || `${restaurantName} Loyalty Card`,
      logoText: s.logo_text || restaurantName,
      foregroundColor: s.foreground_color || "rgb(255,255,255)",
      backgroundColor: s.background_color || "rgb(15,15,20)",
      labelColor: s.label_color || "rgb(201,168,76)",
      storeCard: {
        headerFields: [
          { key: "tier", label: s.header_field_label || "TIER", value: "BASIC" },
        ],
        primaryFields: [
          { key: "points", label: s.primary_field_label || "POINTS BALANCE", value: "0 pts" },
        ],
        secondaryFields: [
          { key: "member_name", label: s.secondary1_label || "MEMBER",  value: memberName },
          { key: "xish_id",    label: s.secondary2_label || "XISH ID", value: xishId },
        ],
        backFields: [] as any[],
      },
      barcodes: [{
        message: xishId,
        format: s.barcode_format || "PKBarcodeFormatQR",
        messageEncoding: "iso-8859-1",
        altText: xishId,
      }],
    };

    if (s.back1_label) passJson.storeCard.backFields.push({ key: "back1", label: s.back1_label, value: s.back1_value || baseUrl });
    if (s.back2_label) passJson.storeCard.backFields.push({ key: "back2", label: s.back2_label, value: s.back2_value || "" });
    if (s.back3_label) passJson.storeCard.backFields.push({ key: "back3", label: s.back3_label, value: s.back3_value || "" });

    if (s.location_lat && s.location_lng) {
      passJson.locations = [{
        latitude: parseFloat(s.location_lat),
        longitude: parseFloat(s.location_lng),
        relevantText: s.location_label || (s.program_name || restaurantName),
      }];
    }

    if (!certExists()) {
      return res.status(503).json({ error: "Wallet pass signing not configured on server" });
    }

    // Return the download URL — client navigates to it in the same tab so iOS shows the Wallet sheet
    const downloadUrl = `${baseUrl}/api/xish/wallet/download/${memberId}`;
    return res.json({ success: true, member_id: memberId, xish_id: xishId, download_url: downloadUrl });
  } catch (err) {
    console.error("[XISH join]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

