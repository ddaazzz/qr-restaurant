"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const app_1 = __importDefault(require("./app"));
const os_1 = __importDefault(require("os"));
const https_1 = __importDefault(require("https"));
const http_1 = __importDefault(require("http"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const printer_routes_1 = require("./routes/printer.routes");
const sessionNotifier_1 = require("./services/sessionNotifier");
const orderNotifier_1 = require("./services/orderNotifier");
const websocket_1 = require("./services/websocket");
const kitchenAutoPrintService_1 = require("./services/kitchenAutoPrintService");
const runMigrations_1 = require("./scripts/runMigrations");
const PORT = Number(process.env.PORT) || 10000;
// Get local IP address for local network access
function getLocalIP() {
    const interfaces = os_1.default.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === "IPv4" && !iface.internal) {
                return iface.address;
            }
        }
    }
    return "localhost";
}
const localIP = getLocalIP();
// Load SSL certificates for HTTPS (required for Web Bluetooth API)
const certPath = path_1.default.join(__dirname, "../localhost-cert.pem");
const keyPath = path_1.default.join(__dirname, "../localhost-key.pem");
let server;
// Try HTTPS with certificates
if (fs_1.default.existsSync(certPath) && fs_1.default.existsSync(keyPath)) {
    try {
        const httpsOptions = {
            cert: fs_1.default.readFileSync(certPath),
            key: fs_1.default.readFileSync(keyPath),
        };
        server = https_1.default.createServer(httpsOptions, app_1.default);
        server.listen(PORT, "0.0.0.0", async () => {
            console.log(`🔒 HTTPS Backend running on https://localhost:${PORT}`);
            console.log(`📱 Secure access: https://${localIP}:${PORT}`);
            console.log(`   ✅ Web Bluetooth API enabled!`);
            // Run pending database migrations
            try {
                await (0, runMigrations_1.runAllMigrations)();
            }
            catch (err) {
                console.warn(`⚠️  Migration runner failed: ${err.message}`);
            }
            // Initialize WebSocket server
            try {
                websocket_1.webSocketServer.initialize(server);
                console.log(`✅ WebSocket server initialized`);
            }
            catch (err) {
                console.warn(`⚠️  WebSocket initialization failed: ${err.message}`);
            }
            // Initialize session notifier for real-time auto-print
            try {
                await sessionNotifier_1.sessionNotifier.start();
                console.log(`✅ Session notifier started (listening to PostgreSQL NOTIFY)`);
            }
            catch (err) {
                console.warn(`⚠️  Session notifier failed to start: ${err.message}`);
            }
            // Initialize order notifier for real-time kitchen auto-print
            try {
                await orderNotifier_1.orderNotifier.start();
                console.log(`✅ Order notifier started (listening to PostgreSQL NOTIFY)`);
            }
            catch (err) {
                console.warn(`⚠️  Order notifier failed to start: ${err.message}`);
            }
            // Initialize kitchen auto-print service (auto-prints all orders to configured kitchen printers)
            try {
                await kitchenAutoPrintService_1.kitchenAutoPrintService.initialize();
                console.log(`✅ Kitchen auto-print service started (always auto-prints orders)`);
            }
            catch (err) {
                console.warn(`⚠️  Kitchen auto-print service failed to start: ${err.message}`);
            }
            // Initialize printer queue service
            try {
                const printerQueue = (0, printer_routes_1.initializePrinterQueue)();
                console.log(`✅ Printer queue service started`);
            }
            catch (err) {
                console.warn(`⚠️  Printer queue initialization failed: ${err.message}`);
            }
        });
    }
    catch (err) {
        console.error("❌ Failed to initialize HTTPS:", err);
        process.exit(1);
    }
}
else {
    // No local SSL certs — fall back to HTTP (production: SSL terminated at reverse proxy)
    server = http_1.default.createServer(app_1.default);
    server.listen(PORT, "0.0.0.0", async () => {
        console.log(`🌐 HTTP Backend running on http://localhost:${PORT}`);
        // Run pending database migrations
        try {
            await (0, runMigrations_1.runAllMigrations)();
        }
        catch (err) {
            console.warn(`⚠️  Migration runner failed: ${err.message}`);
        }
        // Initialize WebSocket server
        try {
            websocket_1.webSocketServer.initialize(server);
            console.log(`✅ WebSocket server initialized`);
        }
        catch (err) {
            console.warn(`⚠️  WebSocket initialization failed: ${err.message}`);
        }
        // Initialize session notifier for real-time auto-print
        try {
            await sessionNotifier_1.sessionNotifier.start();
            console.log(`✅ Session notifier started (listening to PostgreSQL NOTIFY)`);
        }
        catch (err) {
            console.warn(`⚠️  Session notifier failed to start: ${err.message}`);
        }
        // Initialize order notifier for real-time kitchen auto-print
        try {
            await orderNotifier_1.orderNotifier.start();
            console.log(`✅ Order notifier started (listening to PostgreSQL NOTIFY)`);
        }
        catch (err) {
            console.warn(`⚠️  Order notifier failed to start: ${err.message}`);
        }
        // Initialize kitchen auto-print service
        try {
            kitchenAutoPrintService_1.kitchenAutoPrintService.initialize();
            console.log(`✅ Kitchen auto-print service started`);
        }
        catch (err) {
            console.warn(`⚠️  Kitchen auto-print service failed to start: ${err.message}`);
        }
        // Initialize printer queue
        try {
            const printerQueue = (0, printer_routes_1.initializePrinterQueue)();
            console.log(`✅ Printer queue service started`);
        }
        catch (err) {
            console.warn(`⚠️  Printer queue initialization failed: ${err.message}`);
        }
    });
}
server.on("error", (err) => {
    console.error("❌ Server error:", err.message);
    if (err.code === "EADDRINUSE") {
        console.error(`   Port ${PORT} is already in use. Kill existing process and try again.`);
        setTimeout(() => process.exit(1), 100);
    }
});
// Handle unhandled errors  
process.on("unhandledRejection", (reason) => {
    console.error("❌ Unhandled Rejection:", reason);
});
process.on("uncaughtException", (error) => {
    console.error("❌ Uncaught Exception:", error.message);
});
// Graceful shutdown
process.on("SIGTERM", async () => {
    console.log("📴 SIGTERM received, shutting down gracefully");
    // Stop session notifier
    try {
        await sessionNotifier_1.sessionNotifier.stop();
        console.log("✅ Session notifier stopped");
    }
    catch (err) {
        console.warn("⚠️  Error stopping session notifier:", err);
    }
    // Stop order notifier
    try {
        await orderNotifier_1.orderNotifier.stop();
        console.log("✅ Order notifier stopped");
    }
    catch (err) {
        console.warn("⚠️  Error stopping order notifier:", err);
    }
    // Stop kitchen auto-print service
    try {
        kitchenAutoPrintService_1.kitchenAutoPrintService.stop();
        console.log("✅ Kitchen auto-print service stopped");
    }
    catch (err) {
        console.warn("⚠️  Error stopping kitchen auto-print service:", err);
    }
    // Stop printer queue
    try {
        const { getPrinterQueueInstance } = require("./routes/printer.routes");
        const queue = getPrinterQueueInstance();
        await queue.stop();
        console.log("✅ Printer queue stopped");
    }
    catch (err) {
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
        await sessionNotifier_1.sessionNotifier.stop();
        console.log("✅ Session notifier stopped");
    }
    catch (err) {
        console.warn("⚠️  Error stopping session notifier:", err);
    }
    // Stop order notifier
    try {
        await orderNotifier_1.orderNotifier.stop();
        console.log("✅ Order notifier stopped");
    }
    catch (err) {
        console.warn("⚠️  Error stopping order notifier:", err);
    }
    // Stop kitchen auto-print service
    try {
        kitchenAutoPrintService_1.kitchenAutoPrintService.stop();
        console.log("✅ Kitchen auto-print service stopped");
    }
    catch (err) {
        console.warn("⚠️  Error stopping kitchen auto-print service:", err);
    }
    // Stop printer queue
    try {
        const { getPrinterQueueInstance } = require("./routes/printer.routes");
        const queue = getPrinterQueueInstance();
        await queue.stop();
        console.log("✅ Printer queue stopped");
    }
    catch (err) {
        console.warn("⚠️  Error stopping printer queue:", err);
    }
    server?.close(() => {
        console.log("Server closed");
        process.exit(0);
    });
});
//# sourceMappingURL=server.js.map