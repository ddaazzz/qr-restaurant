import app from "./app";
import dotenv from "dotenv";
import bcrypt from "bcrypt";
import os from "os";
import pool from "./config/db";
import { initializePrinterQueue } from "./routes/printer.routes";

dotenv.config();

const PORT = Number(process.env.PORT) || 10000;

// Get local IP address for local network access
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]!) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "localhost";
}

const localIP = getLocalIP();

// Create HTTP server
const server = app.listen(PORT, "0.0.0.0", async () => {
  console.log(`🚀 Backend running on http://localhost:${PORT}`);
  console.log(`📱 Local Network: http://${localIP}:${PORT}`);
  console.log(`   Open these URLs in your browser`);

  // Initialize printer queue service
  try {
    const printerQueue = initializePrinterQueue();
    console.log(`✅ Printer queue service started`);
  } catch (err: any) {
    console.warn(`⚠️  Printer queue initialization failed: ${err.message}`);
  }
});

server.on("error", (err: any) => {
  console.error("❌ Server error:", err.message);
  if (err.code === "EADDRINUSE") {
    console.error(`   Port ${PORT} is already in use. Kill existing process and try again.`);
    setTimeout(() => process.exit(1), 100);
  }
});

// Handle unhandled errors  
process.on("unhandledRejection", (reason: any) => {
  console.error("❌ Unhandled Rejection:", reason);
});

process.on("uncaughtException", (error: any) => {
  console.error("❌ Uncaught Exception:", error.message);
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("📴 SIGTERM received, shutting down gracefully");
  
  // Stop printer queue
  try {
    const { getPrinterQueueInstance } = require("./routes/printer.routes");
    const queue = getPrinterQueueInstance();
    await queue.stop();
    console.log("✅ Printer queue stopped");
  } catch (err) {
    console.warn("⚠️  Error stopping printer queue:", err);
  }

  server?.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

process.on("SIGINT", async () => {
  console.log("📴 SIGINT received, shutting down gracefully");
  
  // Stop printer queue
  try {
    const { getPrinterQueueInstance } = require("./routes/printer.routes");
    const queue = getPrinterQueueInstance();
    await queue.stop();
    console.log("✅ Printer queue stopped");
  } catch (err) {
    console.warn("⚠️  Error stopping printer queue:", err);
  }

  server?.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

