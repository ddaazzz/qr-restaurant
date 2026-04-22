"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const cors_1 = __importDefault(require("cors"));
const os_1 = require("os");
const restaurants_routes_1 = __importDefault(require("./routes/restaurants.routes"));
const tables_routes_1 = __importDefault(require("./routes/tables.routes"));
const scan_routes_1 = __importDefault(require("./routes/scan.routes"));
const menu_routes_1 = __importDefault(require("./routes/menu.routes"));
const orders_routes_1 = __importDefault(require("./routes/orders.routes"));
const sessions_routes_1 = __importDefault(require("./routes/sessions.routes"));
const staff_routes_1 = __importDefault(require("./routes/staff.routes"));
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const coupons_routes_1 = __importDefault(require("./routes/coupons.routes"));
const bookings_routes_1 = __importDefault(require("./routes/bookings.routes"));
const waitlist_routes_1 = __importDefault(require("./routes/waitlist.routes"));
const settings_routes_1 = __importDefault(require("./routes/settings.routes"));
const printer_routes_1 = __importDefault(require("./routes/printer.routes"));
const customerReceipts_routes_1 = __importDefault(require("./routes/customerReceipts.routes"));
const addons_routes_1 = __importDefault(require("./routes/addons.routes"));
const presets_routes_1 = __importDefault(require("./routes/presets.routes"));
const payment_terminals_routes_1 = __importDefault(require("./routes/payment-terminals.routes"));
const payment_transactions_routes_1 = __importDefault(require("./routes/payment-transactions.routes"));
const crm_routes_1 = __importDefault(require("./routes/crm.routes"));
const serviceRequests_routes_1 = __importDefault(require("./routes/serviceRequests.routes"));
const storage_1 = require("./config/storage");
const client_s3_1 = require("@aws-sdk/client-s3");
const app = (0, express_1.default)();
/* ======================
   MIDDLEWARE
====================== */
// Parse JSON and form-encoded request bodies
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true, limit: '50mb' }));
app.use((0, cors_1.default)({
    origin: "*",
    credentials: true,
}));
/* ======================
   MIDDLEWARE - SECURITY HEADERS
====================== */
app.use((req, res, next) => {
    // Security headers for SEO and protection
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Referrer-Policy", "no-referrer-when-downgrade");
    // Allow camera access for local development (testing on phone via IP address)
    res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=*");
    next();
});
/* ======================
   HEALTH
====================== */
app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
});
/* ======================
   NETWORK INFO (for dev)
====================== */
app.get("/network-info", (_req, res) => {
    const interfaces = (0, os_1.networkInterfaces)();
    let serverIP = "localhost";
    // Try to find the local network IP (not localhost or 127.0.0.1)
    for (const [name, addrs] of Object.entries(interfaces)) {
        if (!addrs)
            continue;
        for (const addr of addrs) {
            // Skip internal and non-IPv4 addresses  
            if (addr.family === "IPv4" && !addr.internal) {
                serverIP = addr.address;
                break;
            }
        }
        if (serverIP !== "localhost")
            break;
    }
    res.json({
        serverIP,
        port: process.env.PORT || 10000,
        apiUrl: `http://${serverIP}:${process.env.PORT || 10000}`,
        timestamp: new Date().toISOString(),
    });
});
/* ======================
   SEO & SITEMAP FILES
====================== */
app.get("/robots.txt", (_req, res) => {
    const FRONTEND_PATH = path_1.default.join(__dirname, "../../frontend");
    res.setHeader("Content-Type", "text/plain");
    res.sendFile(path_1.default.join(FRONTEND_PATH, "robots.txt"));
});
app.get("/sitemap.xml", (_req, res) => {
    const FRONTEND_PATH = path_1.default.join(__dirname, "../../frontend");
    res.setHeader("Content-Type", "application/xml");
    res.sendFile(path_1.default.join(FRONTEND_PATH, "sitemap.xml"));
});
/* ======================
   STATIC UPLOADS
====================== */
// Debug endpoint to check R2 configuration
app.get("/api/debug/storage", (_req, res) => {
    res.json({
        r2Configured: (0, storage_1.isR2Configured)(),
        r2AccountId: process.env.R2_ACCOUNT_ID ? "set" : "missing",
        r2AccessKey: process.env.R2_ACCESS_KEY_ID ? "set" : "missing",
        r2SecretKey: process.env.R2_SECRET_ACCESS_KEY ? "set" : "missing",
        r2Bucket: process.env.R2_BUCKET_NAME || "chuio-uploads (default)",
    });
});
// Serve from local disk first, fall back to R2 if configured
app.use("/uploads", express_1.default.static(path_1.default.join(process.cwd(), "uploads")));
if ((0, storage_1.isR2Configured)()) {
    // R2 proxy fallback: if file not found locally, fetch from R2
    app.use("/uploads", async (req, res, next) => {
        try {
            const key = req.path.startsWith("/") ? req.path.slice(1) : req.path;
            const response = await storage_1.s3Client.send(new client_s3_1.GetObjectCommand({ Bucket: storage_1.R2_BUCKET_NAME, Key: key }));
            if (response.ContentType) {
                res.setHeader("Content-Type", response.ContentType);
            }
            res.setHeader("Cache-Control", "public, max-age=31536000");
            const stream = response.Body;
            stream.pipe(res);
        }
        catch (err) {
            if (err.name === "NoSuchKey") {
                return res.status(404).json({ error: "File not found" });
            }
            next(err);
        }
    });
}
/* ======================
   PAYMENT GATEWAY STATIC FILES
====================== */
app.use(express_1.default.static(path_1.default.join(__dirname, "../../public")));
/* ======================
   NODE_MODULES LIBS (QR Scanner)
====================== */
app.use("/lib", express_1.default.static(path_1.default.join(__dirname, "../../node_modules/html5-qrcode")));
/* ======================
   API ROUTES (FIRST)
====================== */
app.use("/api", settings_routes_1.default);
app.use("/api", printer_routes_1.default);
app.use("/api", payment_terminals_routes_1.default);
app.use("/api", payment_transactions_routes_1.default);
// Also mount payment transaction routes at root for webhook callbacks (e.g., /payment-callback)
app.use("/", payment_transactions_routes_1.default);
app.use("/api", customerReceipts_routes_1.default);
app.use("/api", addons_routes_1.default);
app.use("/api", presets_routes_1.default);
app.use("/api/restaurants", restaurants_routes_1.default);
app.use("/api/restaurants", staff_routes_1.default);
app.use("/api", tables_routes_1.default);
app.use("/api", scan_routes_1.default);
app.use("/api", menu_routes_1.default);
app.use("/api", orders_routes_1.default);
app.use("/api", sessions_routes_1.default);
app.use("/api", auth_routes_1.default);
app.use("/api", coupons_routes_1.default);
app.use("/api", bookings_routes_1.default);
app.use("/api", waitlist_routes_1.default);
app.use("/api", crm_routes_1.default);
app.use("/api", serviceRequests_routes_1.default);
/* ======================
   FRONTEND STATIC FILES
   (CRITICAL — DO NOT MOVE)
====================== */
const FRONTEND_PATH = path_1.default.join(__dirname, "../../frontend");
app.use(express_1.default.static(FRONTEND_PATH, {
    index: false,
    setHeaders: (res, filePath) => {
        // Prevent browser caching of JS/CSS so deploys take effect immediately
        if (filePath.endsWith('.js') || filePath.endsWith('.css')) {
            res.setHeader('Cache-Control', 'no-cache, must-revalidate');
        }
    },
}));
/* ======================
   PAGE ROUTES
====================== */
app.get("/", (_req, res) => {
    res.sendFile(path_1.default.join(FRONTEND_PATH, "home.html"));
});
app.get("/zh", (_req, res) => {
    res.sendFile(path_1.default.join(FRONTEND_PATH, "home.html"));
});
app.get("/en", (_req, res) => {
    res.sendFile(path_1.default.join(FRONTEND_PATH, "home.html"));
});
app.get("/login", (_req, res) => {
    res.sendFile(path_1.default.join(FRONTEND_PATH, "login.html"));
});
app.get("/register", (_req, res) => {
    res.sendFile(path_1.default.join(FRONTEND_PATH, "register.html"));
});
app.get("/forgot-password", (_req, res) => {
    res.sendFile(path_1.default.join(FRONTEND_PATH, "forgot-password.html"));
});
app.get("/reset-password", (_req, res) => {
    res.sendFile(path_1.default.join(FRONTEND_PATH, "reset-password.html"));
});
/* ======================
   QR TOKEN ROUTE (LAST)
====================== */
app.get("/:qrToken", (req, res, next) => {
    const { qrToken } = req.params;
    // ❌ Never allow asset files here
    if (qrToken.includes("."))
        return next();
    // ✅ Only allow real QR tokens
    if (!/^[a-f0-9]{32}$/.test(qrToken))
        return next();
    res.sendFile(path_1.default.join(FRONTEND_PATH, "landing.html"));
});
exports.default = app;
//# sourceMappingURL=app.js.map