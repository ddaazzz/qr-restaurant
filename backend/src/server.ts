import app from "./app";
import dotenv from "dotenv";
import bcrypt from "bcrypt";
import os from "os";
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

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Backend running on http://localhost:${PORT}`);
  console.log(`📱 Local Network: http://${localIP}:${PORT}`);
  console.log(`   (Access from iPad/phone on same WiFi network)`);
});

// Handle unhandled errors
process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught Exception:", error);
  process.exit(1);
});

if (process.env.NODE_ENV !== "production") {
  
  console.log("ENV:", {
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT
  });
}

// Schema validation is only enforced during development
if (process.env.APP_STAGE === "development") {
  console.log("✅ Running in development mode");
}

