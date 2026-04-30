"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.testPrinterConnection = exports.printOrder = exports.generateReceiptHTML = void 0;
// ESC/POS printer support is OPTIONAL
// Install with: npm install escpos escpos-network
// These will be loaded dynamically only if thermal printing is needed
let escpos;
let TcpConnection;
let USBConnection;
// Try to lazy-load ESC/POS support
const loadEscposSupport = async () => {
    if (escpos)
        return; // Already loaded
    try {
        // @ts-expect-error - ESC/POS is optional dependency
        escpos = (await Promise.resolve().then(() => __importStar(require("escpos")))).default;
        // @ts-expect-error - ESC/POS is optional dependency
        const tcp = await Promise.resolve().then(() => __importStar(require("escpos/connection/tcp")));
        // @ts-expect-error - ESC/POS is optional dependency
        const usb = await Promise.resolve().then(() => __importStar(require("escpos/connection/usb")));
        TcpConnection = tcp.default;
        USBConnection = usb.default;
    }
    catch (e) {
        console.warn("⚠️  ESC/POS printer support not installed. Thermal printing disabled.");
        console.warn("   To enable: npm install escpos escpos-network");
    }
};
/**
 * Generate receipt HTML for browser printing
 */
const generateReceiptHTML = (payload) => {
    return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${payload.type.toUpperCase()} Order #${payload.orderNumber}</title>
        <style>
          * { margin: 0; padding: 0; }
          body { 
            font-family: 'Courier New', monospace; 
            background: white; 
            color: #000;
          }
          .receipt { 
            width: 80mm; 
            margin: 0 auto; 
            padding: 2mm;
            background: white;
          }
          .receipt-header { 
            text-align: center; 
            font-weight: bold; 
            font-size: 14px; 
            margin-bottom: 3mm;
            border-bottom: 1px dashed #000;
            padding-bottom: 2mm;
          }
          .order-number { 
            font-size: 16px; 
            font-weight: bold; 
            margin: 2mm 0;
          }
          .order-meta {
            font-size: 10px;
            color: #333;
            margin: 1mm 0;
            line-height: 1.4;
          }
          .order-items { 
            margin: 3mm 0; 
            border-top: 1px dashed #000;
            border-bottom: 1px dashed #000;
            padding: 2mm 0;
          }
          .item { 
            padding: 1mm 0; 
            font-size: 10px;
            display: flex;
            justify-content: space-between;
          }
          .item-name { flex: 1; }
          .item-qty { font-weight: bold; text-align: right; min-width: 15mm; }
          .item-variants {
            font-size: 8px;
            color: #666;
            padding-left: 5mm;
            margin: 0.5mm 0;
          }
          .footer { 
            text-align: center; 
            font-size: 9px; 
            margin-top: 2mm;
            padding-top: 1mm;
          }
          .thank-you {
            font-weight: bold;
            margin-top: 1mm;
          }
          @media print { 
            body { margin: 0; padding: 0; }
            .receipt { width: 100%; margin: 0; }
          }
        </style>
      </head>
      <body>
        <div class="receipt">
          <div class="receipt-header">${payload.type.toUpperCase()} ORDER</div>
          <div class="order-number">#${payload.orderNumber}</div>
          <div class="order-meta">
            <div>Table: ${payload.tableNumber}</div>
            <div>Time: ${payload.timestamp}</div>
            <div>${payload.restaurantName}</div>
          </div>
          
          <div class="order-items">
            ${payload.items
        .map((item) => `
              <div class="item" ${item.isAddon ? 'style="padding-left: 5mm; font-size: 9px; color: #555;"' : ''}>
                <div class="item-name">${item.isAddon ? '+ ' : ''}${item.name.substring(0, 40)}</div>
                <div class="item-qty">x${item.quantity}</div>
              </div>
              ${item.variants
        ? `<div class="item-variants">${item.variants.substring(0, 45)}</div>`
        : ""}
            `)
        .join("")}
          </div>

          <div class="footer">
            <div class="thank-you">Thank You!</div>
            <div>${new Date().toLocaleString()}</div>
          </div>
        </div>
      </body>
    </html>
  `;
};
exports.generateReceiptHTML = generateReceiptHTML;
/**
 * Print to thermal printer using ESC/POS
 */
const printOrder = async (config, payload) => {
    try {
        if (config.type === "browser") {
            return { success: true };
        }
        if (!TcpConnection && !USBConnection) {
            return {
                success: false,
                error: "ESC/POS printer support not installed. Run: npm install escpos escpos-network",
            };
        }
        let connection;
        if (config.type === "network" && config.host && config.port) {
            if (!TcpConnection) {
                return { success: false, error: "Network printer support not available" };
            }
            connection = new TcpConnection(config.host, config.port);
        }
        else if (config.type === "usb" && config.vendorId && config.productId) {
            if (!USBConnection) {
                return { success: false, error: "USB printer support not available" };
            }
            connection = new USBConnection(config.vendorId, config.productId);
        }
        else {
            return { success: false, error: "Invalid printer configuration" };
        }
        // Open connection
        await new Promise((resolve, reject) => {
            connection.open((error) => {
                if (error)
                    reject(error);
                else
                    resolve();
            });
        });
        const printer = new escpos.Printer(connection);
        // Print receipt
        printer
            .align("CT")
            .text(payload.restaurantName, { width: 2 })
            .align("CT")
            .text(payload.type.toUpperCase())
            .text(`Order #${payload.orderNumber}`)
            .align("CT")
            .text(`Table: ${payload.tableNumber}`)
            .text(payload.timestamp)
            .feed(1)
            .align("LT");
        // Print items
        payload.items.forEach((item) => {
            printer.text(`${item.name.substring(0, 35).padEnd(35)}x${item.quantity}`.substring(0, 49));
            if (item.variants) {
                printer.text(`  ${item.variants.substring(0, 47)}`);
            }
        });
        // Print footer
        printer.feed(1).align("CT").text("Thank You!").feed(2).cut().close();
        return { success: true };
    }
    catch (error) {
        console.error("❌ Thermal printer error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown printer error",
        };
    }
};
exports.printOrder = printOrder;
/**
 * Test printer connection
 */
const testPrinterConnection = async (config) => {
    try {
        if (config.type === "browser") {
            return { success: true };
        }
        if (!TcpConnection && !USBConnection) {
            return {
                success: false,
                error: "ESC/POS printer support not installed",
            };
        }
        let connection;
        if (config.type === "network" && config.host && config.port) {
            if (!TcpConnection) {
                return { success: false, error: "Network printer support not available" };
            }
            connection = new TcpConnection(config.host, config.port);
        }
        else if (config.type === "usb" && config.vendorId && config.productId) {
            if (!USBConnection) {
                return { success: false, error: "USB printer support not available" };
            }
            connection = new USBConnection(config.vendorId, config.productId);
        }
        else {
            return { success: false, error: "Invalid printer configuration" };
        }
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error("Connection timeout"));
            }, 5000);
            connection.open((error) => {
                clearTimeout(timeout);
                if (error)
                    reject(error);
                else {
                    connection.close();
                    resolve();
                }
            });
        });
        return { success: true };
    }
    catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Connection failed",
        };
    }
};
exports.testPrinterConnection = testPrinterConnection;
//# sourceMappingURL=printerService.js.map