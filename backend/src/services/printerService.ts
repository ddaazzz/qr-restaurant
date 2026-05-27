import type { Request, Response } from "express";

// ESC/POS printer support is OPTIONAL
// Install with: npm install escpos escpos-network
// These will be loaded dynamically only if thermal printing is needed

let escpos: any;
let TcpConnection: any;
let USBConnection: any;

// Try to lazy-load ESC/POS support
const loadEscposSupport = async () => {
  if (escpos) return; // Already loaded
  
  try {
    // @ts-expect-error - ESC/POS is optional dependency
    escpos = (await import("escpos")).default;
    // @ts-expect-error - ESC/POS is optional dependency
    const tcp = await import("escpos/connection/tcp");
    // @ts-expect-error - ESC/POS is optional dependency
    const usb = await import("escpos/connection/usb");
    TcpConnection = tcp.default;
    USBConnection = usb.default;
  } catch (e) {
    console.warn("⚠️  ESC/POS printer support not installed. Thermal printing disabled.");
    console.warn("   To enable: npm install escpos escpos-network");
  }
};

export interface PrinterConfig {
  type: "network" | "usb" | "browser";
  host?: string;
  port?: number;
  vendorId?: string;
  productId?: string;
}

export interface PrintJobPayload {
  orderNumber: string;
  tableNumber: string;
  items: { name: string; quantity: number; variants?: string; isAddon?: boolean }[];
  timestamp: string;
  restaurantName: string;
  type: "kitchen" | "bill";
  // Optional payment details (for receipt printing post-payment)
  paymentMethod?: string;
  amountReceived?: number;   // in cents
  changeAmount?: number;     // in cents
  paymentReference?: string;
  paidAt?: string;           // ISO timestamp
  subtotal?: number;         // in cents
  serviceCharge?: number;    // in cents
  total?: number;            // in cents
}

/**
 * Generate receipt HTML for browser printing
 */
export const generateReceiptHTML = (payload: PrintJobPayload): string => {
  const hasPayment = !!(payload.paymentMethod);
  const hasTotals = payload.total !== undefined || payload.subtotal !== undefined;

  const fmtCents = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  const paymentMethodLabel: Record<string, string> = {
    cash: 'Cash',
    card: 'Card',
    kpay: 'KPay Terminal',
    'payment-asia': 'Payment Asia',
    'payment-asia-offline': 'UnionPay Terminal',
  };

  const paidAtFormatted = payload.paidAt
    ? (() => { try { return new Date(payload.paidAt!).toLocaleString('en-HK', { timeZone: 'Asia/Hong_Kong' }); } catch (_) { return payload.paidAt!; } })()
    : payload.timestamp;

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${payload.type === 'bill' ? 'BILL' : 'RECEIPT'} #${payload.orderNumber}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Courier New', monospace; background: white; color: #000; }
          .receipt { width: 80mm; margin: 0 auto; padding: 2mm; background: white; }
          .receipt-header { text-align: center; font-weight: bold; font-size: 14px; margin-bottom: 3mm; border-bottom: 1px dashed #000; padding-bottom: 2mm; }
          .order-number { font-size: 16px; font-weight: bold; margin: 2mm 0; }
          .order-meta { font-size: 10px; color: #333; margin: 1mm 0; line-height: 1.6; }
          .order-items { margin: 3mm 0; border-top: 1px dashed #000; padding: 2mm 0; }
          .item { padding: 1mm 0; font-size: 10px; display: flex; justify-content: space-between; }
          .item-name { flex: 1; padding-right: 2mm; }
          .item-price { font-weight: bold; text-align: right; white-space: nowrap; }
          .item-variants { font-size: 8px; color: #666; padding-left: 5mm; margin: 0.5mm 0; }
          .totals { border-top: 1px dashed #000; padding-top: 2mm; margin-top: 0; }
          .total-row { display: flex; justify-content: space-between; font-size: 10px; padding: 0.5mm 0; }
          .total-row.grand { font-weight: bold; font-size: 13px; border-top: 1px solid #000; margin-top: 1mm; padding-top: 1mm; }
          .payment-section { border-top: 1px dashed #000; margin-top: 3mm; padding-top: 2mm; }
          .payment-section .section-title { font-size: 10px; font-weight: bold; text-transform: uppercase; margin-bottom: 1.5mm; }
          .payment-row { display: flex; justify-content: space-between; font-size: 10px; padding: 0.5mm 0; }
          .payment-row.change { font-weight: bold; }
          .payment-ref { font-size: 9px; color: #333; word-break: break-all; }
          .footer { text-align: center; font-size: 9px; margin-top: 2mm; padding-top: 1mm; border-top: 1px dashed #000; }
          .thank-you { font-weight: bold; margin-top: 1mm; }
          @media print { body { margin: 0; padding: 0; } .receipt { width: 100%; margin: 0; } }
        </style>
      </head>
      <body>
        <div class="receipt">
          <div class="receipt-header">${payload.restaurantName}<br><span style="font-size:11px;font-weight:normal">${hasPayment ? 'RECEIPT' : 'BILL'}</span></div>
          <div class="order-meta">
            <div>Order #${payload.orderNumber}</div>
            <div>${payload.tableNumber}</div>
            <div>${payload.timestamp}</div>
          </div>

          <div class="order-items">
            ${payload.items.map(item => `
              <div class="item" ${item.isAddon ? 'style="padding-left:4mm;font-size:9px;color:#555;"' : ''}>
                <div class="item-name">${item.isAddon ? '+ ' : ''}${item.name.substring(0, 38)}<span style="margin-left:2mm;color:#555;">x${item.quantity}</span></div>
                <div class="item-price">${item.isAddon ? '' : ''}</div>
              </div>
              ${item.variants ? `<div class="item-variants">${item.variants.substring(0, 45)}</div>` : ''}
            `).join('')}
          </div>

          ${hasTotals ? `
          <div class="totals">
            ${payload.subtotal !== undefined ? `<div class="total-row"><span>Subtotal</span><span>${fmtCents(payload.subtotal)}</span></div>` : ''}
            ${payload.serviceCharge !== undefined && payload.serviceCharge > 0 ? `<div class="total-row"><span>Service Charge</span><span>${fmtCents(payload.serviceCharge)}</span></div>` : ''}
            ${payload.total !== undefined ? `<div class="total-row grand"><span>TOTAL</span><span>${fmtCents(payload.total)}</span></div>` : ''}
          </div>` : ''}

          ${hasPayment ? `
          <div class="payment-section">
            <div class="section-title">Payment</div>
            <div class="payment-row"><span>${paymentMethodLabel[payload.paymentMethod!.toLowerCase()] || payload.paymentMethod}</span></div>
            ${payload.amountReceived !== undefined && payload.amountReceived > 0 ? `<div class="payment-row"><span>Received</span><span>${fmtCents(payload.amountReceived)}</span></div>` : ''}
            ${payload.changeAmount !== undefined && payload.changeAmount >= 0 ? `<div class="payment-row change"><span>Change</span><span>${fmtCents(payload.changeAmount)}</span></div>` : ''}
            ${payload.paymentReference ? `<div class="payment-ref">Ref: ${payload.paymentReference}</div>` : ''}
            <div class="payment-row" style="font-size:9px;color:#555;"><span>Paid</span><span>${paidAtFormatted}</span></div>
          </div>` : ''}

          <div class="footer">
            <div class="thank-you">Thank You!</div>
            <div style="margin-top:1mm;font-size:8px;">Powered by Chuio.io</div>
          </div>
        </div>
        <script>window.onload = function() { window.print(); }</script>
      </body>
    </html>
  `;
};

/**
 * Print to thermal printer using ESC/POS
 */
export const printOrder = async (
  config: PrinterConfig,
  payload: PrintJobPayload
): Promise<{ success: boolean; error?: string }> => {
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

    let connection: any;

    if (config.type === "network" && config.host && config.port) {
      if (!TcpConnection) {
        return { success: false, error: "Network printer support not available" };
      }
      connection = new TcpConnection(config.host, config.port);
    } else if (config.type === "usb" && config.vendorId && config.productId) {
      if (!USBConnection) {
        return { success: false, error: "USB printer support not available" };
      }
      connection = new USBConnection(config.vendorId, config.productId);
    } else {
      return { success: false, error: "Invalid printer configuration" };
    }

    // Open connection
    await new Promise<void>((resolve, reject) => {
      connection.open((error: any) => {
        if (error) reject(error);
        else resolve();
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
      printer.text(
        `${item.name.substring(0, 35).padEnd(35)}x${item.quantity}`.substring(0, 49)
      );
      if (item.variants) {
        printer.text(`  ${item.variants.substring(0, 47)}`);
      }
    });

    // Print footer
    printer.feed(1).align("CT").text("Thank You!").feed(2).cut().close();

    return { success: true };
  } catch (error) {
    console.error("❌ Thermal printer error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown printer error",
    };
  }
};

/**
 * Test printer connection
 */
export const testPrinterConnection = async (
  config: PrinterConfig
): Promise<{ success: boolean; error?: string }> => {
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

    let connection: any;

    if (config.type === "network" && config.host && config.port) {
      if (!TcpConnection) {
        return { success: false, error: "Network printer support not available" };
      }
      connection = new TcpConnection(config.host, config.port);
    } else if (config.type === "usb" && config.vendorId && config.productId) {
      if (!USBConnection) {
        return { success: false, error: "USB printer support not available" };
      }
      connection = new USBConnection(config.vendorId, config.productId);
    } else {
      return { success: false, error: "Invalid printer configuration" };
    }

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () => {
          reject(new Error("Connection timeout"));
        },
        5000
      );

      connection.open((error: any) => {
        clearTimeout(timeout);
        if (error) reject(error);
        else {
          connection.close();
          resolve();
        }
      });
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Connection failed",
    };
  }
};
