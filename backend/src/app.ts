import express from "express";
import path from "path";

import restaurantRoutes from "./routes/restaurants.routes";
import tableRoutes from "./routes/tables.routes";
import scanRoutes from "./routes/scan.routes";
import menuRoutes from "./routes/menu.routes";
import ordersRoutes from "./routes/orders.routes";
import sessionsRoutes from "./routes/sessions.routes";
import staffRoutes from "./routes/staff.routes";


const app = express();

app.use(express.json());

/* ======================
   API ROUTES (FIRST)
====================== */

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/restaurants", restaurantRoutes);
app.use("/api", tableRoutes);
app.use("/api", scanRoutes);
app.use("/api", menuRoutes);
app.use("/api", ordersRoutes);
app.use("/api", sessionsRoutes);
app.use("/api", staffRoutes);

/* ======================
   FRONTEND (AFTER APIs)
====================== */

// Serve static frontend files
app.use(express.static(path.join(__dirname, "../../frontend")));

// QR entry point (MUST BE LAST)
app.get("/:qrToken", (_req, res) => {
  res.sendFile(path.join(__dirname, "../../frontend/index.html"));
});

export default app;
