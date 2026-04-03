import app from "./app";
import dotenv from "dotenv";
import bcrypt from "bcrypt";
import os from "os";
import https from "https";
import http from "http";
import fs from "fs";
import path from "path";
import pool from "./config/db";
import { initializePrinterQueue } from "./routes/printer.routes";
import { sessionNotifier } from "./services/sessionNotifier";
import { orderNotifier } from "./services/orderNotifier";
import { webSocketServer } from "./services/websocket";
import { kitchenAutoPrintService } from "./services/kitchenAutoPrintService";

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

// Load SSL certificates for HTTPS (required for Web Bluetooth API)
const certPath = path.join(__dirname, "../localhost-cert.pem");
const keyPath = path.join(__dirname, "../localhost-key.pem");

let server: https.Server | http.Server;

// Try HTTPS with certificates
if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
  try {
    const httpsOptions = {
      cert: fs.readFileSync(certPath),
      key: fs.readFileSync(keyPath),
    };
    
    server = https.createServer(httpsOptions, app);
    
    server.listen(PORT, "0.0.0.0", async () => {
      console.log(`🔒 HTTPS Backend running on https://localhost:${PORT}`);
      console.log(`📱 Secure access: https://${localIP}:${PORT}`);
      console.log(`   ✅ Web Bluetooth API enabled!`);

      // Initialize WebSocket server
      try {
        webSocketServer.initialize(server);
        console.log(`✅ WebSocket server initialized`);
      } catch (err: any) {
        console.warn(`⚠️  WebSocket initialization failed: ${err.message}`);
      }

      // Initialize session notifier for real-time auto-print
      try {
        await sessionNotifier.start();
        console.log(`✅ Session notifier started (listening to PostgreSQL NOTIFY)`);
      } catch (err: any) {
        console.warn(`⚠️  Session notifier failed to start: ${err.message}`);
      }

      // Initialize order notifier for real-time kitchen auto-print
      try {
        await orderNotifier.start();
        console.log(`✅ Order notifier started (listening to PostgreSQL NOTIFY)`);
      } catch (err: any) {
        console.warn(`⚠️  Order notifier failed to start: ${err.message}`);
      }

      // Initialize kitchen auto-print service (auto-prints all orders to configured kitchen printers)
      try {
        await kitchenAutoPrintService.initialize();
        console.log(`✅ Kitchen auto-print service started (always auto-prints orders)`);
      } catch (err: any) {
        console.warn(`⚠️  Kitchen auto-print service failed to start: ${err.message}`);
      }

      // Initialize printer queue service
      try {
        const printerQueue = initializePrinterQueue();
        console.log(`✅ Printer queue service started`);
      } catch (err: any) {
        console.warn(`⚠️  Printer queue initialization failed: ${err.message}`);
      }
    });
  } catch (err) {
    console.error("❌ Failed to initialize HTTPS:", err);
    process.exit(1);
  }
} else {
  console.error("❌ SSL certificates not found!");
  console.error(`   Expected: ${certPath}`);
  console.error(`   Expected: ${keyPath}`);
  console.error("\n   Generate them with:");
  console.error("   cd /Users/user/Documents/qr-restaurant-ai/backend");
  console.error('   openssl req -x509 -newkey rsa:2048 -keyout localhost-key.pem -out localhost-cert.pem -days 365 -nodes -subj "/CN=localhost"');
  process.exit(1);
}

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
  
  // Stop session notifier
  try {
    await sessionNotifier.stop();
    console.log("✅ Session notifier stopped");
  } catch (err) {
    console.warn("⚠️  Error stopping session notifier:", err);
  }

  // Stop order notifier
  try {
    await orderNotifier.stop();
    console.log("✅ Order notifier stopped");
  } catch (err) {
    console.warn("⚠️  Error stopping order notifier:", err);
  }

  // Stop kitchen auto-print service
  try {
    kitchenAutoPrintService.stop();
    console.log("✅ Kitchen auto-print service stopped");
  } catch (err) {
    console.warn("⚠️  Error stopping kitchen auto-print service:", err);
  }

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
  
  // Stop session notifier
  try {
    await sessionNotifier.stop();
    console.log("✅ Session notifier stopped");
  } catch (err) {
    console.warn("⚠️  Error stopping session notifier:", err);
  }

  // Stop order notifier
  try {
    await orderNotifier.stop();
    console.log("✅ Order notifier stopped");
  } catch (err) {
    console.warn("⚠️  Error stopping order notifier:", err);
  }

  // Stop kitchen auto-print service
  try {
    kitchenAutoPrintService.stop();
    console.log("✅ Kitchen auto-print service stopped");
  } catch (err) {
    console.warn("⚠️  Error stopping kitchen auto-print service:", err);
  }

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

