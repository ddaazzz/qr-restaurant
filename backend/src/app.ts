import express from "express";
import path from "path";
import bcrypt from "bcrypt";
import cors from "cors";
import restaurantRoutes from "./routes/restaurants.routes";
import tableRoutes from "./routes/tables.routes";
import scanRoutes from "./routes/scan.routes";
import menuRoutes from "./routes/menu.routes";
import ordersRoutes from "./routes/orders.routes";
import sessionsRoutes from "./routes/sessions.routes";
import staffRoutes from "./routes/staff.routes";
import authRoutes from "./routes/auth.routes";



const app = express();

app.use(express.json());

// CORS configuration
app.use(
  cors({
    origin: "*",
    credentials: true, // allow cookies if you use them
  })
);

/* ======================
   API ROUTES (FIRST)
====================== */

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/uploads", express.static(path.join(__dirname, "../uploads")));
app.use("/api/restaurants", restaurantRoutes);
app.use("/api", tableRoutes);
app.use("/api", scanRoutes);
app.use("/api", menuRoutes);
app.use("/api", ordersRoutes);
app.use("/api", sessionsRoutes);
app.use("/api", staffRoutes);
app.use("/api", authRoutes);

/* ======================
   FRONTEND (AFTER APIs)
====================== */

// Serve static frontend files
app.use(
  express.static(path.join(__dirname, "../../frontend"), {
    index: false
  })
);

const FRONTEND_PATH = path.join(__dirname, "../../frontend");

app.use(
  "/qrs",
  express.static(path.join(__dirname, "..", "qrs"))
);

app.get("/", (_req, res) => {
  res.sendFile(path.join(FRONTEND_PATH, "home.html"));
});

app.get("/login", (_req, res) => {
  res.sendFile(path.join(FRONTEND_PATH, "login.html"));
});

// QR entry point (MUST BE LAST)
app.get("/:qrToken", (_req, res) => {
  res.sendFile(path.join(__dirname, "../../frontend/index.html"));
});

export default app;
