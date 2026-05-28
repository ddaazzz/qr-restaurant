import { Router } from "express";
import pool from "../config/db";
import { PKPass } from "passkit-generator";
import * as fs from "fs";
import * as path from "path";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { sendPassUpdatePush } from "../utils/xish-apns";
import { sendVerificationCode } from "../services/emailService";

const router = Router();

const GUEST_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function generateGuestUsername(): string {
  let s = 'User_';
  for (let i = 0; i < 6; i++) s += GUEST_CHARS[Math.floor(Math.random() * GUEST_CHARS.length)];
  return s;
}

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

// ─── Shared pass builder — rich content + geofencing ─────────────────────────
async function buildPassJson(
  m: {
    id: number;
    xish_id: string;
    points_balance: number;
    tier: string;
    customer_name: string;
    wallet_id?: string | null;
    restaurant_id: number;
  },
  s: Record<string, any>,
  restaurantName: string
): Promise<{ passJson: any; serial: string; authToken: string }> {
  const baseUrl = process.env.APP_BASE_URL || "https://chuio.io";
  const pts     = m.points_balance || 0;
  const tier    = m.tier || "basic";

  // Fetch stored serial+token AND tier/discount/gift/venue data in parallel
  const [existingPass, tierRows, discountRows, giftRows, venueRows] = await Promise.all([
    pool.query(
      `SELECT pass_serial, pass_auth_token FROM xish_wallet_passes
       WHERE member_id = $1 AND pass_type = 'apple'`,
      [m.id]
    ),
    pool.query(
      `SELECT tier, points_threshold, discount_percent
       FROM xish_tier_settings
       WHERE restaurant_id = $1 AND is_active = true
       ORDER BY points_threshold ASC`,
      [m.restaurant_id]
    ),
    pool.query(
      `SELECT discount_percent, valid_until
       FROM xish_discount_settings
       WHERE restaurant_id = $1 AND tier = $2 AND is_active = true
         AND (valid_until IS NULL OR valid_until > NOW())
       ORDER BY discount_percent DESC`,
      [m.restaurant_id, tier]
    ),
    pool.query(
      `SELECT item_name, quantity, redemption_end
       FROM xish_gift_settings
       WHERE restaurant_id = $1 AND is_active = true
         AND (redemption_end IS NULL OR redemption_end > NOW())
       ORDER BY id ASC`,
      [m.restaurant_id]
    ),
    pool.query(
      `SELECT name, lat::float AS lat, lng::float AS lng
       FROM restaurants
       WHERE xish_enabled = true AND lat IS NOT NULL AND lng IS NOT NULL
       ORDER BY id ASC LIMIT 10`
    ),
  ]);

  const tiers      = tierRows.rows;
  const discounts  = discountRows.rows;
  const gifts      = giftRows.rows;
  const venues     = venueRows.rows;

  // ─── Serial + auth token: stable per member, only created once ────────────
  // A stable serial is required so iOS device registrations remain valid after
  // every push update. The auth token is equally stable.
  const serial:    string = existingPass.rows[0]?.pass_serial    || `XISH-${m.xish_id}`;
  const authToken: string = existingPass.rows[0]?.pass_auth_token || crypto.randomUUID();

  // ─── Tier progression ────────────────────────────────────────────────────
  const currentTierIdx = tiers.findIndex((t: any) => t.tier === tier);
  const currentTierRow = tiers[currentTierIdx >= 0 ? currentTierIdx : 0];
  const nextTierRow    = tiers[currentTierIdx + 1] || null;
  const discountPct    = Number(currentTierRow?.discount_percent || 0);

  // Unicode progress bar — iOS Wallet renders these block characters visually.
  // e.g. "████░░░░░░ 40%"  (10-block scale)
  let progressBar: string;
  let progressLabel: string;
  if (nextTierRow) {
    const start   = Number(currentTierRow?.points_threshold || 0);
    const end     = Number(nextTierRow.points_threshold);
    const pct     = end > start ? Math.min(1, Math.max(0, (pts - start) / (end - start))) : 1;
    const filled  = Math.round(pct * 10);
    progressBar   = "\u2588".repeat(filled) + "\u2591".repeat(10 - filled) + ` ${Math.round(pct * 100)}%`;
    progressLabel = `TO ${capitalize(nextTierRow.tier).toUpperCase()}`;
  } else {
    progressBar   = "\u2588".repeat(10) + " 100%";
    progressLabel = "STATUS";
  }

  // ─── Front-of-card layout ─────────────────────────────────────────────────
  // logoText  → "Restaurant Name · XISH"   (top-left, establishment branding)
  // header    → tier badge                 (top-right)
  // primary   → "XISH" label + pts value   (centre — makes XISH the focal brand)
  // secondary → member name + XISH ID
  // auxiliary → progress bar | discount | gifts | venues   (4 info tiles)

  const passJson: any = {
    formatVersion: 1,
    passTypeIdentifier: process.env.APPLE_PASS_TYPE_ID || "pass.io.xish.loyalty",
    serialNumber: serial,
    teamIdentifier: process.env.APPLE_TEAM_ID || "5V7D5PUU8D",
    organizationName: s.organization_name || restaurantName,
    description: s.description || `${restaurantName} Loyalty Card`,
    // Only use logo_text if it has been customised away from the generic "XISH" default.
    // This prevents "XISH · XISH" when the merchant hasn't set a custom logo text.
    logoText: (s.logo_text && s.logo_text !== "XISH")
      ? `${s.logo_text} \u00b7 XISH`
      : `${restaurantName} \u00b7 XISH`,
    foregroundColor: s.foreground_color || "rgb(255,255,255)",
    backgroundColor: s.background_color || "rgb(15,15,20)",
    labelColor: s.label_color || "rgb(161,0,53)",
    storeCard: {
      headerFields: [
        { key: "tier", label: s.header_field_label || "TIER", value: tier.toUpperCase() },
      ],
      primaryFields: [
        // "XISH" label places the brand name prominently in the centre of the card
        { key: "points", label: "XISH", value: `${pts.toLocaleString()} pts` },
      ],
      // iOS storeCard: secondary + auxiliary are rendered in one combined row,
      // max 4 fields total. We use exactly 2+2=4.
      secondaryFields: [
        { key: "member_name", label: s.secondary1_label || "MEMBER",  value: m.customer_name || "—" },
        { key: "xish_id",    label: s.secondary2_label || "XISH ID", value: m.xish_id },
      ],
      auxiliaryFields: [
        // Visual progress bar toward next tier (unicode blocks render fine in iOS Wallet)
        { key: "progress", label: progressLabel, value: progressBar },
        // Active discount for current tier
        { key: "discount", label: "DISCOUNT",  value: discountPct > 0 ? `${discountPct}% off` : "Earn to unlock" },
      ],
      backFields: [] as any[],
    },
    barcodes: [{
      message: m.xish_id,
      format: s.barcode_format || "PKBarcodeFormatQR",
      messageEncoding: "iso-8859-1",
      altText: m.xish_id,
    }],
  };

  // ─── Back fields ───────────────────────────────────────────────────────────

  // 1. Membership tier ladder (with current position marker)
  if (tiers.length > 0) {
    const tierLines = tiers.map((t: any) => {
      const threshold = t.points_threshold === 0 ? "0+" : `${Number(t.points_threshold).toLocaleString()}+`;
      const disc      = Number(t.discount_percent) > 0 ? `  ·  ${t.discount_percent}% off` : "";
      const current   = t.tier === tier ? "  ◀" : "";
      return `${capitalize(t.tier)}  ${threshold} pts${disc}${current}`;
    }).join("\n");
    // Append how many pts to next tier
    const ptsToNext = nextTierRow
      ? `\n\n${(Number(nextTierRow.points_threshold) - pts).toLocaleString()} pts until ${capitalize(nextTierRow.tier)}`
      : "\n\nMax tier reached 🎉";
    passJson.storeCard.backFields.push({ key: "tier_table", label: "MEMBERSHIP TIERS", value: tierLines + ptsToNext });
  }

  // 2. Discounts: tier built-in discount + any explicit xish_discount_settings rows
  {
    const discountLines: string[] = [];
    // Always show the tier's built-in discount if > 0
    if (discountPct > 0) {
      discountLines.push(`${discountPct}% off all orders (${capitalize(tier)} tier)`);
    }
    // Additional one-off discounts from xish_discount_settings
    for (const d of discounts) {
      let line = `${d.discount_percent}% discount`;
      if (d.valid_until) line += `  ·  Until ${new Date(d.valid_until).toLocaleDateString("en-GB")}`;
      discountLines.push(line);
    }
    if (discountLines.length > 0) {
      passJson.storeCard.backFields.push({ key: "discounts", label: "YOUR DISCOUNTS", value: discountLines.join("\n") });
    }
  }

  // 3. Available gifts (from xish_gift_settings)
  if (gifts.length > 0) {
    const giftLines = gifts.map((g: any) => {
      let line = `${g.quantity}× ${g.item_name}`;
      if (g.redemption_end) line += `  ·  Redeem by ${new Date(g.redemption_end).toLocaleDateString("en-GB")}`;
      return line;
    }).join("\n");
    passJson.storeCard.backFields.push({ key: "gifts", label: "AVAILABLE GIFTS", value: giftLines });
  }

  // 4. Custom back fields from wallet settings
  //    For "Order Online"-style fields: auto-generate a URL to the pickup menu
  //    with a long-lived XISH JWT so the member is auto-logged in on tap.
  if (s.back1_label) {
    let back1Val = s.back1_value || "";
    // If the label looks like an order/menu link AND no value is set, build the pickup URL
    const isOrderLink = /order|menu|pickup|pick.?up/i.test(s.back1_label);
    if (!back1Val && isOrderLink) {
      const JWT_SECRET = process.env.JWT_SECRET || "";
      const orderToken = jwt.sign(
        { memberId: m.id, restaurantId: m.restaurant_id, type: "wallet" },
        JWT_SECRET,
        { expiresIn: "365d" }
      );
      back1Val = `${baseUrl}/order-now/${m.restaurant_id}?token=${orderToken}`;
    }
    passJson.storeCard.backFields.push({ key: "back1", label: s.back1_label, value: back1Val || baseUrl });
  }
  if (s.back2_label) passJson.storeCard.backFields.push({ key: "back2", label: s.back2_label, value: s.back2_value || "" });
  if (s.back3_label) passJson.storeCard.backFields.push({ key: "back3", label: s.back3_label, value: s.back3_value || "" });

  // 5. XISH network — all connected restaurants
  if (venues.length > 0) {
    passJson.storeCard.backFields.push({
      key: "xish_network",
      label: "EARN POINTS AT",
      value: venues.map((r: any) => r.name).join("\n"),
    });
  }

  // ─── Geofencing: all XISH restaurants (Apple Wallet limit: 10) ────────────
  const geoLocations: any[] = [];

  // Wallet-settings location first (if explicitly configured)
  if (s.location_lat && s.location_lng) {
    geoLocations.push({
      latitude: parseFloat(s.location_lat),
      longitude: parseFloat(s.location_lng),
      relevantText: s.location_label || (s.program_name || restaurantName),
    });
  }

  for (const r of venues) {
    if (geoLocations.length >= 10) break;
    // Skip if nearly identical to the wallet-settings location
    if (s.location_lat && s.location_lng &&
        Math.abs(r.lat - parseFloat(s.location_lat)) < 0.0002 &&
        Math.abs(r.lng - parseFloat(s.location_lng)) < 0.0002) continue;
    geoLocations.push({
      latitude: r.lat,
      longitude: r.lng,
      relevantText: `${r.name} — Tap to view your XISH card`,
    });
  }

  if (geoLocations.length > 0) passJson.locations = geoLocations;

  // ─── Auth token (stable per member — used for PassKit web service auth) ──────
  const baseUrlForService = process.env.APP_BASE_URL || "https://chuio.io";
  passJson.webServiceURL       = `${baseUrlForService}/api/xish/wallet/passkit`;
  passJson.authenticationToken = authToken;

  return { passJson, serial, authToken };
}

function capitalize(str: string): string {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : str;
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
        label_color: "rgb(161,0,53)",
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
      `SELECT m.*, c.name AS customer_name, c.restaurant_id, r.name AS restaurant_name
       FROM xish_members m
       JOIN crm_customers c ON c.id = m.crm_customer_id
       JOIN restaurants r ON r.id = c.restaurant_id
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

    const baseUrl = process.env.APP_BASE_URL || "https://chuio.io";
    const passUrl = `${baseUrl}/xish/wallet/member/${m.wallet_id || member_id}`;

    const { passJson, serial, authToken } = await buildPassJson(
      {
        id: m.id,
        xish_id: m.xish_id || String(member_id),
        points_balance: m.points_balance || 0,
        tier: m.tier || "basic",
        customer_name: m.customer_name || "—",
        wallet_id: m.wallet_id,
        restaurant_id: m.restaurant_id,
      },
      s,
      m.restaurant_name || (s.organization_name || "XISH Loyalty")
    );

    // Record serial + auth token in DB (auth token preserved if already set)
    await pool.query(
      `INSERT INTO xish_wallet_passes (member_id, pass_type, pass_serial, pass_auth_token, last_updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (member_id, pass_type)
       DO UPDATE SET pass_serial = $3,
                     pass_auth_token = COALESCE(xish_wallet_passes.pass_auth_token, $4),
                     last_updated_at = NOW()`,
      [member_id, pass_type, serial, authToken]
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
      `SELECT m.*, c.name AS customer_name, c.restaurant_id, r.name AS restaurant_name
       FROM xish_members m
       JOIN crm_customers c ON c.id = m.crm_customer_id
       JOIN restaurants r ON r.id = c.restaurant_id
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

    if (!certExists()) {
      return res.status(503).json({ error: "PassKit certificates not configured on server" });
    }

    const { passJson, serial, authToken } = await buildPassJson(
      {
        id: m.id,
        xish_id: m.xish_id || String(m.id),
        points_balance: m.points_balance || 0,
        tier: m.tier || "basic",
        customer_name: m.customer_name || "—",
        wallet_id: m.wallet_id,
        restaurant_id: m.restaurant_id,
      },
      s,
      m.restaurant_name || "Restaurant"
    );

    const pkpassBuffer = await signPassJson(passJson);

    // Persist serial + auth token so PassKit web service can verify + push
    await pool.query(
      `INSERT INTO xish_wallet_passes (member_id, pass_type, pass_serial, pass_auth_token, last_updated_at)
       VALUES ($1, 'apple', $2, $3, NOW())
       ON CONFLICT (member_id, pass_type)
       DO UPDATE SET pass_serial = $2,
                     pass_auth_token = COALESCE(xish_wallet_passes.pass_auth_token, $3),
                     last_updated_at = NOW()`,
      [m.id, serial, authToken]
    );

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
               WHEN points_balance + $2 >= 2000  THEN 'gold'
               WHEN points_balance + $2 >= 500   THEN 'silver'
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

      // Push pass update to all registered devices for this member (non-blocking)
      sendPassUpdatePush(member.id).catch(() => {});
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
      pool.query(`SELECT id, name, feature_flags FROM restaurants WHERE id = $1`, [restaurantId]),
      pool.query(`SELECT * FROM xish_wallet_settings WHERE restaurant_id = $1`, [restaurantId]),
    ]);
    if (!rRes.rows[0]) return res.status(404).json({ error: "Restaurant not found" });
    const r = rRes.rows[0];
    const s = sRes.rows[0] || {};
    res.json({
      restaurant_name:  r.name,
      feature_flags:    r.feature_flags || {},
      program_name:     s.program_name      || "Loyalty Rewards",
      logo_text:        s.logo_text         || r.name,
      background_color: s.background_color  || "rgb(15,15,20)",
      foreground_color: s.foreground_color  || "rgb(255,255,255)",
      label_color:      s.label_color       || "rgb(161,0,53)",
      description:      s.description       || `Join ${r.name}'s loyalty programme and earn points on every visit.`,
    });
  } catch (err) {
    console.error("[XISH join-info]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /api/xish/send-verification ─────────────────────────────────────────
// Send a 6-digit verification code to an email address for XISH sign-up.
// Body: { restaurant_id, method: 'email'|'phone', contact: string }
router.post("/xish/send-verification", async (req, res) => {
  try {
    const { restaurant_id, method, contact } = req.body;

    if (!restaurant_id) {
      return res.status(400).json({ error: "restaurant_id is required" });
    }
    if (!method || !["email", "phone"].includes(method)) {
      return res.status(400).json({ error: "method must be 'email' or 'phone'" });
    }
    if (!contact) {
      return res.status(400).json({ error: "contact is required" });
    }

    if (method === "email") {
      const email = String(contact).trim().toLowerCase();
      if (!email.includes("@")) {
        return res.status(400).json({ error: "Valid email address is required" });
      }

      // Generate 6-digit code
      const code = String(Math.floor(100000 + Math.random() * 900000));
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Invalidate any existing codes for this contact
      await pool.query(
        `DELETE FROM email_verifications WHERE email = $1`,
        [email]
      );

      // Store new code
      await pool.query(
        `INSERT INTO email_verifications (email, code, expires_at) VALUES ($1, $2, $3)`,
        [email, code, expiresAt]
      );

      // Send email
      const sent = await sendVerificationCode(email, code);
      if (!sent) {
        // In non-production environments, return the code directly so dev/staging can be tested
        // without SMTP credentials being configured on the server.
        if (process.env.NODE_ENV !== "production") {
          console.warn(`[XISH send-verification] SMTP failed in dev mode — returning code in response for ${email}`);
          return res.json({ message: "Verification code sent (dev: SMTP unavailable)", dev_code: code });
        }
        return res.status(500).json({ error: "Failed to send verification email. Please try again." });
      }

      return res.json({ message: "Verification code sent" });
    }

    if (method === "phone") {
      // SMS not yet implemented — return error so frontend can show a useful message
      return res.status(501).json({ error: "Phone verification is not yet available. Please use email sign-up." });
    }

    return res.status(400).json({ error: "Unsupported method" });
  } catch (err) {
    console.error("[XISH send-verification]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /api/xish/join-email ────────────────────────────────────────────────
// Create (or retrieve) a XISH member account via verified email.
// Body: { restaurant_id, email, code, name?, gender?, dob? }
// Returns: { success, member_id, xish_id, download_url }
router.post("/xish/join-email", async (req, res) => {
  try {
    const { restaurant_id, email: rawEmail, code, name, gender, dob } = req.body;

    if (!restaurant_id) return res.status(400).json({ error: "restaurant_id is required" });
    if (!rawEmail || !code) return res.status(400).json({ error: "email and code are required" });

    const email = String(rawEmail).trim().toLowerCase();
    if (!email.includes("@")) {
      return res.status(400).json({ error: "Valid email address is required" });
    }

    // Verify code
    const verifyRes = await pool.query(
      `SELECT id FROM email_verifications WHERE email = $1 AND code = $2 AND expires_at > NOW() AND verified = FALSE`,
      [email, String(code)]
    );
    if (verifyRes.rowCount === 0) {
      return res.status(400).json({ error: "Invalid or expired verification code" });
    }

    // Mark code as verified
    await pool.query(
      `UPDATE email_verifications SET verified = TRUE WHERE email = $1 AND code = $2`,
      [email, String(code)]
    );

    const cleanName = name ? String(name).trim() : null;

    // Upsert CRM customer by email
    const existingCrm = await pool.query(
      `SELECT id FROM crm_customers WHERE restaurant_id = $1 AND email = $2`,
      [restaurant_id, email]
    );

    let crmId: number;
    if (existingCrm.rows[0]) {
      crmId = existingCrm.rows[0].id;
      await pool.query(
        `UPDATE crm_customers SET
           name = COALESCE($1, name),
           updated_at = NOW()
         WHERE id = $2`,
        [cleanName, crmId]
      );
    } else {
      const insertRes = await pool.query(
        `INSERT INTO crm_customers (restaurant_id, email, name, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW()) RETURNING id`,
        [restaurant_id, email, cleanName || generateGuestUsername()]
      );
      crmId = insertRes.rows[0].id;
    }

    // Update optional fields on CRM record
    if (gender || dob) {
      await pool.query(
        `UPDATE crm_customers SET
           gender = COALESCE($1, gender),
           date_of_birth = COALESCE($2, date_of_birth),
           updated_at = NOW()
         WHERE id = $3`,
        [gender || null, dob || null, crmId]
      );
    }

    // Upsert XISH member
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

    // Clean up verification code
    await pool.query(`DELETE FROM email_verifications WHERE email = $1`, [email]);

    const baseUrl = process.env.APP_BASE_URL || "https://chuio.io";
    const downloadUrl = `${baseUrl}/api/xish/wallet/download/${memberId}`;
    return res.json({ success: true, member_id: memberId, xish_id: xishId, download_url: downloadUrl });
  } catch (err: any) {
    console.error("[XISH join-email]", err);
    // Unique constraint on (restaurant_id, email) already handled by ON CONFLICT above.
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
        [restaurant_id, cleanPhone, cleanName || generateGuestUsername()]
      );
      crmId = crmRes.rows[0].id;
    } else {
      // Anonymous — create a new CRM placeholder (no phone)
      const crmRes = await pool.query(
        `INSERT INTO crm_customers (restaurant_id, name, created_at, updated_at)
         VALUES ($1, $2, NOW(), NOW())
         RETURNING id`,
        [restaurant_id, cleanName || generateGuestUsername()]
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

    const baseUrl = process.env.APP_BASE_URL || "https://chuio.io";
    // Pass is signed at /api/xish/wallet/download/:memberId when the user opens the link.
    const downloadUrl = `${baseUrl}/api/xish/wallet/download/${memberId}`;
    return res.json({ success: true, member_id: memberId, xish_id: xishId, download_url: downloadUrl });
  } catch (err) {
    console.error("[XISH join]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── PassKit Web Service (Apple Wallet update protocol) ──────────────────────
// Apple calls these endpoints using the webServiceURL in the pass JSON.
// Spec: https://developer.apple.com/library/archive/documentation/PassKit/Reference/PassKit_WebService/WebService.html

/** Extract and verify ApplePass auth token against our DB. Returns member_id or null. */
async function verifyPassAuth(serialNumber: string, authHeader: string | undefined): Promise<number | null> {
  const token = (authHeader || "").replace(/^ApplePass\s+/i, "").trim();
  if (!token) return null;
  const r = await pool.query(
    `SELECT member_id FROM xish_wallet_passes
     WHERE pass_serial = $1 AND pass_auth_token = $2 AND pass_type = 'apple'`,
    [serialNumber, token]
  );
  return r.rows[0]?.member_id ?? null;
}

// 1. Device registers for push updates
router.post(
  "/xish/wallet/passkit/v1/devices/:deviceId/registrations/:passTypeId/:serialNumber",
  async (req, res) => {
    try {
      const { deviceId, passTypeId, serialNumber } = req.params;
      const { pushToken } = req.body;
      if (!pushToken) return res.status(400).send();

      const memberId = await verifyPassAuth(serialNumber, req.headers.authorization as string);
      if (!memberId) return res.status(401).send();

      const existing = await pool.query(
        `SELECT id FROM xish_wallet_device_registrations WHERE device_library_id = $1 AND pass_serial = $2`,
        [deviceId, serialNumber]
      );

      await pool.query(
        `INSERT INTO xish_wallet_device_registrations
           (device_library_id, push_token, pass_type_id, pass_serial, member_id)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (device_library_id, pass_serial)
         DO UPDATE SET push_token = $2`,
        [deviceId, pushToken, passTypeId, serialNumber, memberId]
      );

      res.status(existing.rows.length > 0 ? 200 : 201).send();
    } catch (err) {
      console.error("[PassKit register]", err);
      res.status(500).send();
    }
  }
);

// 2. Device unregisters
router.delete(
  "/xish/wallet/passkit/v1/devices/:deviceId/registrations/:passTypeId/:serialNumber",
  async (req, res) => {
    try {
      const { deviceId, serialNumber } = req.params;
      const memberId = await verifyPassAuth(serialNumber, req.headers.authorization as string);
      if (!memberId) return res.status(401).send();

      await pool.query(
        `DELETE FROM xish_wallet_device_registrations
         WHERE device_library_id = $1 AND pass_serial = $2`,
        [deviceId, serialNumber]
      );
      res.status(200).send();
    } catch (err) {
      console.error("[PassKit unregister]", err);
      res.status(500).send();
    }
  }
);

// 3. List serials updated since a given tag (iOS polls this on reconnect)
router.get(
  "/xish/wallet/passkit/v1/devices/:deviceId/registrations/:passTypeId",
  async (req, res) => {
    try {
      const { deviceId } = req.params;
      const since = req.query.passesUpdatedSince as string | undefined;

      const params: any[] = [deviceId];
      const sinceClause   = since ? `AND wp.last_updated_at > $2` : "";
      if (since) params.push(since);

      const result = await pool.query(
        `SELECT wp.pass_serial, wp.last_updated_at
         FROM xish_wallet_device_registrations dr
         JOIN xish_wallet_passes wp
           ON wp.member_id = dr.member_id AND wp.pass_type = 'apple'
         WHERE dr.device_library_id = $1 ${sinceClause}
         ORDER BY wp.last_updated_at DESC`,
        params
      );

      if (result.rows.length === 0) return res.status(204).send();

      res.json({
        lastUpdated:   result.rows[0].last_updated_at.toISOString(),
        serialNumbers: result.rows.map((r: any) => r.pass_serial),
      });
    } catch (err) {
      console.error("[PassKit list-passes]", err);
      res.status(500).send();
    }
  }
);

// 4. Return the latest signed .pkpass for a serial (iOS fetches this after push)
router.get(
  "/xish/wallet/passkit/v1/passes/:passTypeId/:serialNumber",
  async (req, res) => {
    try {
      const { serialNumber } = req.params;

      // Look up member via current pass serial OR stale serial still in device_registrations
      const memberLookup = await pool.query(
        `SELECT member_id FROM xish_wallet_passes
         WHERE pass_serial = $1 AND pass_type = 'apple'
         UNION
         SELECT member_id FROM xish_wallet_device_registrations
         WHERE pass_serial = $1
         LIMIT 1`,
        [serialNumber]
      );
      if (!memberLookup.rows[0]) return res.status(404).send();
      const memberId = memberLookup.rows[0].member_id;

      // Verify auth token
      const token = (req.headers.authorization as string || "").replace(/^ApplePass\s+/i, "").trim();
      if (token) {
        const check = await pool.query(
          `SELECT 1 FROM xish_wallet_passes
           WHERE member_id = $1 AND pass_auth_token = $2 AND pass_type = 'apple'`,
          [memberId, token]
        );
        if (!check.rows[0]) return res.status(401).send();
      }

      if (!certExists()) return res.status(503).send();

      const mRes = await pool.query(
        `SELECT m.*, c.name AS customer_name, c.restaurant_id, r.name AS restaurant_name
         FROM xish_members m
         JOIN crm_customers c ON c.id = m.crm_customer_id
         JOIN restaurants r   ON r.id = c.restaurant_id
         WHERE m.id = $1`,
        [memberId]
      );
      if (!mRes.rows[0]) return res.status(404).send();
      const m = mRes.rows[0];

      const sRes = await pool.query(
        `SELECT * FROM xish_wallet_settings WHERE restaurant_id = $1`,
        [m.restaurant_id]
      );
      const s = sRes.rows[0] || {};

      const { passJson, serial, authToken } = await buildPassJson(
        {
          id: m.id,
          xish_id: m.xish_id || String(m.id),
          points_balance: m.points_balance || 0,
          tier: m.tier || "basic",
          customer_name: m.customer_name || "—",
          wallet_id: m.wallet_id,
          restaurant_id: m.restaurant_id,
        },
        s,
        m.restaurant_name || "Restaurant"
      );

      // Update pass serial + timestamp (device will re-register with new serial)
      await pool.query(
        `INSERT INTO xish_wallet_passes (member_id, pass_type, pass_serial, pass_auth_token, last_updated_at)
         VALUES ($1, 'apple', $2, $3, NOW())
         ON CONFLICT (member_id, pass_type)
         DO UPDATE SET pass_serial = $2, last_updated_at = NOW()`,
        [memberId, serial, authToken]
      );

      const pkpassBuffer = await signPassJson(passJson);
      res.set("Content-Type",    "application/vnd.apple.pkpass");
      res.set("Last-Modified",   new Date().toUTCString());
      res.send(pkpassBuffer);
    } catch (err) {
      console.error("[PassKit get-pass]", err);
      res.status(500).send();
    }
  }
);

// 5. Apple sends error logs here — just acknowledge
router.post("/xish/wallet/passkit/v1/log", (req, res) => {
  if (req.body?.logs?.length) {
    console.log("[PassKit log]", JSON.stringify(req.body.logs));
  }
  res.status(200).send();
});

export default router;

