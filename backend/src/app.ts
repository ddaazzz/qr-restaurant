import express from "express";
import path from "path";
import cors from "cors";

import restaurantRoutes from "./routes/restaurants.routes";
import tableRoutes from "./routes/tables.routes";
import scanRoutes from "./routes/scan.routes";
import menuRoutes from "./routes/menu.routes";
import ordersRoutes from "./routes/orders.routes";
import sessionsRoutes from "./routes/sessions.routes";
import staffRoutes from "./routes/staff.routes";
import authRoutes from "./routes/auth.routes";
import couponsRoutes from "./routes/coupons.routes";

const app = express();

/* ======================
   MIDDLEWARE
====================== */
app.use(express.json());

app.use(
  cors({
    origin: "*",
    credentials: true,
  })
);

/* ======================
   HEALTH
====================== */
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

/* ======================
   STATIC UPLOADS
====================== */
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
app.use("/uploads", express.static("uploads"));

/* ======================
   API ROUTES (FIRST)
====================== */
app.use("/api/restaurants", restaurantRoutes);
app.use("/api", tableRoutes);
app.use("/api", scanRoutes);
app.use("/api", menuRoutes);
app.use("/api", ordersRoutes);
app.use("/api", sessionsRoutes);
app.use("/api", staffRoutes);
app.use("/api", authRoutes);
app.use("/api", couponsRoutes);

/* ======================
   FRONTEND STATIC FILES
   (CRITICAL — DO NOT MOVE)
====================== */
const FRONTEND_PATH = path.join(__dirname, "../../frontend");
app.use(express.static(FRONTEND_PATH, {    
  index: false, // 🔥 THIS IS THE FIX
})
);

/* ======================
   PAGE ROUTES
====================== */
app.get("/", (_req, res) => {
  res.sendFile(path.join(FRONTEND_PATH, "home.html"));
});

app.get("/login", (_req, res) => {
  res.sendFile(path.join(FRONTEND_PATH, "login.html"));
});

/* ======================
   DEBUG ROUTES
====================== */
app.get("/__debug/version", (_req, res) => {
  res.json({
    service: "qr-restaurant-backend",
    env: process.env.NODE_ENV,
    version: "2026-01-21-01",
    time: new Date().toISOString(),
  });
});

app.get("/__debug/source", (_req, res) => {
  res.json({
    source: "LOCAL BACKEND",
    port: process.env.PORT,
    time: new Date().toISOString(),
  });
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
