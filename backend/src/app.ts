import express from "express";
import path from "path";
import cors from "cors";
import { networkInterfaces } from "os";

import restaurantRoutes from "./routes/restaurants.routes";
import tableRoutes from "./routes/tables.routes";
import scanRoutes from "./routes/scan.routes";
import menuRoutes from "./routes/menu.routes";
import ordersRoutes from "./routes/orders.routes";
import sessionsRoutes from "./routes/sessions.routes";
import staffRoutes from "./routes/staff.routes";
import authRoutes from "./routes/auth.routes";
import couponsRoutes from "./routes/coupons.routes";
import bookingsRoutes from "./routes/bookings.routes";
import waitlistRoutes from "./routes/waitlist.routes";
import settingsRoutes from "./routes/settings.routes";
import printerRoutes from "./routes/printer.routes";
import customerReceiptsRoutes from "./routes/customerReceipts.routes";
import addonsRoutes from "./routes/addons.routes";
import presetsRoutes from "./routes/presets.routes";
import paymentTerminalsRoutes from "./routes/payment-terminals.routes";
import paymentTransactionsRoutes from "./routes/payment-transactions.routes";
import crmRoutes from "./routes/crm.routes";
import serviceRequestsRoutes from "./routes/serviceRequests.routes";
import { isR2Configured, s3Client, R2_BUCKET_NAME } from "./config/storage";
import { GetObjectCommand } from "@aws-sdk/client-s3";

const app = express();

/* ======================
   MIDDLEWARE
====================== */
// Parse JSON and form-encoded request bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use(
  cors({
    origin: "*",
    credentials: true,
  })
);

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
  const interfaces = networkInterfaces();
  let serverIP = "localhost";
  
  // Try to find the local network IP (not localhost or 127.0.0.1)
  for (const [name, addrs] of Object.entries(interfaces)) {
    if (!addrs) continue;
    for (const addr of addrs) {
      // Skip internal and non-IPv4 addresses  
      if (addr.family === "IPv4" && !addr.internal) {
        serverIP = addr.address;
        break;
      }
    }
    if (serverIP !== "localhost") break;
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
  const FRONTEND_PATH = path.join(__dirname, "../../frontend");
  res.setHeader("Content-Type", "text/plain");
  res.sendFile(path.join(FRONTEND_PATH, "robots.txt"));
});

app.get("/sitemap.xml", (_req, res) => {
  const FRONTEND_PATH = path.join(__dirname, "../../frontend");
  res.setHeader("Content-Type", "application/xml");
  res.sendFile(path.join(FRONTEND_PATH, "sitemap.xml"));
});

/* ======================
   STATIC UPLOADS
====================== */
// Debug endpoint to check R2 configuration
app.get("/api/debug/storage", (_req, res) => {
  res.json({
    r2Configured: isR2Configured(),
    r2AccountId: process.env.R2_ACCOUNT_ID ? "set" : "missing",
    r2AccessKey: process.env.R2_ACCESS_KEY_ID ? "set" : "missing",
    r2SecretKey: process.env.R2_SECRET_ACCESS_KEY ? "set" : "missing",
    r2Bucket: process.env.R2_BUCKET_NAME || "chuio-uploads (default)",
  });
});
// Serve from local disk first, fall back to R2 if configured
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

if (isR2Configured()) {
  // R2 proxy fallback: if file not found locally, fetch from R2
  app.use("/uploads", async (req, res, next) => {
    try {
      const key = req.path.startsWith("/") ? req.path.slice(1) : req.path;
      const response = await s3Client.send(
        new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key })
      );
      if (response.ContentType) {
        res.setHeader("Content-Type", response.ContentType);
      }
      res.setHeader("Cache-Control", "public, max-age=31536000");
      const stream = response.Body as NodeJS.ReadableStream;
      stream.pipe(res);
    } catch (err: any) {
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
app.use(express.static(path.join(__dirname, "../../public")));

/* ======================
   NODE_MODULES LIBS (QR Scanner)
====================== */
app.use("/lib", express.static(path.join(__dirname, "../../node_modules/html5-qrcode")));

/* ======================
   API ROUTES (FIRST)
====================== */
app.use("/api", settingsRoutes);
app.use("/api", printerRoutes);
app.use("/api", paymentTerminalsRoutes);
app.use("/api", paymentTransactionsRoutes);
// Also mount payment transaction routes at root for webhook callbacks (e.g., /payment-callback)
app.use("/", paymentTransactionsRoutes);
app.use("/api", customerReceiptsRoutes);
app.use("/api", addonsRoutes);
app.use("/api", presetsRoutes);
app.use("/api/restaurants", restaurantRoutes);
app.use("/api/restaurants", staffRoutes);
app.use("/api", tableRoutes);
app.use("/api", scanRoutes);
app.use("/api", menuRoutes);
app.use("/api", ordersRoutes);
app.use("/api", sessionsRoutes);
app.use("/api", authRoutes);
app.use("/api", couponsRoutes);
app.use("/api", bookingsRoutes);
app.use("/api", waitlistRoutes);
app.use("/api", crmRoutes);
app.use("/api", serviceRequestsRoutes);

/* ======================
   FRONTEND STATIC FILES
   (CRITICAL — DO NOT MOVE)
====================== */
const FRONTEND_PATH = path.join(__dirname, "../../frontend");

app.use(express.static(FRONTEND_PATH, {    
  index: false,
  setHeaders: (res, filePath) => {
    // Prevent browser caching of JS/CSS so deploys take effect immediately
    if (filePath.endsWith('.js') || filePath.endsWith('.css')) {
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    }
  },
})
);

/* ======================
   PAGE ROUTES
====================== */
app.get("/", (_req, res) => {
  res.sendFile(path.join(FRONTEND_PATH, "home.html"));
});

app.get("/support", (_req, res) => {
  res.sendFile(path.join(FRONTEND_PATH, "support", "index.html"));
});

app.get("/support/", (_req, res) => {
  res.sendFile(path.join(FRONTEND_PATH, "support", "index.html"));
});

app.get("/support/topic", (_req, res) => {
  res.sendFile(path.join(FRONTEND_PATH, "support", "topic.html"));
});

app.get("/zh", (_req, res) => {
  res.sendFile(path.join(FRONTEND_PATH, "home.html"));
});

app.get("/en", (_req, res) => {
  res.sendFile(path.join(FRONTEND_PATH, "home.html"));
});

app.get("/login", (_req, res) => {
  res.sendFile(path.join(FRONTEND_PATH, "login.html"));
});

app.get("/register", (_req, res) => {
  res.sendFile(path.join(FRONTEND_PATH, "register.html"));
});

app.get("/forgot-password", (_req, res) => {
  res.sendFile(path.join(FRONTEND_PATH, "forgot-password.html"));
});

app.get("/reset-password", (_req, res) => {
  res.sendFile(path.join(FRONTEND_PATH, "reset-password.html"));
});

/* ======================
   QR TOKEN ROUTE (LAST)
====================== */
app.get("/:qrToken", (req, res, next) => {
  const { qrToken } = req.params;

  // ❌ Never allow asset files here
  if (qrToken.includes(".")) return next();

  // ✅ Only allow real QR tokens
  if (!/^[a-f0-9]{32}$/.test(qrToken)) return next();

  res.sendFile(path.join(FRONTEND_PATH, "landing.html"));
});

export default app;
