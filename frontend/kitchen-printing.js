/**
 * Kitchen Order Printing Functions
 * Enables automatic and manual printing of orders in the kitchen
 */

/**
 * Generate HTML for kitchen order receipt
 */
function generateKitchenOrderHTML(order, restaurantName = "Restaurant") {
  const lang = localStorage.getItem('language') || 'en';
  const labels = {
    'order': lang === 'zh' ? '訂單' : 'ORDER',
    'to-go': lang === 'zh' ? '外帶' : 'TO-GO',
    'table': lang === 'zh' ? '座位' : 'TABLE'
  };

  const itemsHTML = order.items
    .map(
      (item) => `
    <div class="item">
      <div class="item-name">${item.menu_item_name || "Item"}</div>
      <div class="item-qty">×${item.quantity || 1}</div>
    </div>
    ${
      item.variants
        ? `<div class="item-variants">${item.variants}</div>`
        : ""
    }
    ${
      item.notes
        ? `<div class="item-notes" style="color:#e65100;font-style:italic;font-size:12px;margin-top:2px;">📝 ${item.notes}</div>`
        : ""
    }
    ${
      (item._addons || []).map(addon => `
        <div class="item addon-print-item">
          <div class="item-name" style="font-size:13px;padding-left:4mm;">+ ${addon.menu_item_name || "Addon"}</div>
          <div class="item-qty" style="font-size:13px;">×${addon.quantity || 1}</div>
        </div>
        ${addon.variants ? `<div class="item-variants" style="margin-left:4mm;">${addon.variants}</div>` : ""}
        ${addon.notes ? `<div class="item-notes" style="color:#e65100;font-style:italic;font-size:11px;margin-top:2px;margin-left:4mm;">📝 ${addon.notes}</div>` : ""}
      `).join("")
    }
  `
    )
    .join("");

  const tableDisplay = order.table || labels['to-go'];

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>Kitchen Order #${order.restaurantOrderNumber || order.orderId}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: ${lang === 'zh' ? "'Microsoft YaHei', 'Arial Unicode MS'" : "'Courier New'"}, monospace;
            background: white;
            color: #000;
            padding: 0;
            margin: 0;
          }
          .receipt {
            width: 80mm;
            margin: 0 auto;
            padding: 5mm;
            background: white;
          }
          .receipt-header {
            text-align: center;
            font-weight: bold;
            font-size: 16px;
            margin-bottom: 3mm;
            border-bottom: 3px solid #000;
            padding-bottom: 3mm;
          }
          .table-number {
            font-size: 20px;
            font-weight: bold;
            text-align: center;
            margin: 3mm 0 3mm 0;
            padding: 3mm;
            border: 2px solid #000;
            background: #f0f0f0;
          }
          .order-number {
            font-size: 12px;
            font-weight: bold;
            margin: 2mm 0;
            text-align: center;
            color: #666;
          }
          .order-items {
            margin: 5mm 0;
            border-top: 2px solid #000;
            border-bottom: 2px solid #000;
            padding: 4mm 0;
          }
          .item {
            padding: 3mm 2mm;
            font-size: 14px;
            font-weight: bold;
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            line-height: 1.4;
          }
          .item-name {
            flex: 1;
            word-wrap: break-word;
            max-width: 50mm;
            font-size: 16px;
            font-weight: bold;
          }
          .item-qty {
            font-weight: bold;
            margin-left: 3mm;
            min-width: 15mm;
            text-align: right;
            font-size: 16px;
          }
          .item-variants {
            font-size: 12px;
            color: #000;
            padding: 2mm 2mm;
            margin: 1mm 0 2mm 0;
            font-style: italic;
            border-left: 2px solid #333;
            padding-left: 3mm;
            font-weight: normal;
          }
          .footer {
            text-align: center;
            font-size: 8px;
            margin-top: 2mm;
            padding-top: 1mm;
            border-top: 1px solid #000;
            color: #999;
            display: none;
          }
          .timestamp {
            font-size: 8px;
            color: #999;
            margin: 1mm 0 0 0;
            display: none;
          }
          @media print {
            body { margin: 0; padding: 0; }
            .receipt { width: 100%; margin: 0; page-break-after: always; }
          }
        </style>
      </head>
      <body>
        <div class="receipt">
          <div class="receipt-header">${labels.order}</div>
          <div class="table-number">${tableDisplay}</div>
          
          <div class="order-items">
            ${itemsHTML}
          </div>

          <div class="order-number">#${order.restaurantOrderNumber || order.orderId} • ${new Date(order.createdAt).toLocaleTimeString()}</div>
        </div>
      </body>
    </html>
  `;
}

/**
 * Print kitchen order using browser print dialog
 */
async function printKitchenOrder(order, restaurantName = "Restaurant") {
  try {
    console.log('[PrintKitchenOrder] Starting kitchen order print for order:', order.id);
    
    const restaurantId = localStorage.getItem('restaurantId');
    
    // Call backend endpoint - it handles HTML generation and printer routing
    await printOrderViaAPI(restaurantId, order.id, 0);
    console.log('[PrintKitchenOrder] Kitchen order print completed');
  } catch (err) {
    console.error('[PrintKitchenOrder] Error:', err);
    alert('⚠️ Print error: ' + err.message);
  }
}

/**
 * Send print job to server (for thermal printer integration)
 */
async function sendPrintJobToServer(orderId, restaurantId, orderType = "kitchen") {
  try {
    const response = await fetch(
      `${API_BASE}/restaurants/${restaurantId}/print-order`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          orderType,
        }),
      }
    );

    const result = await response.json();

    if (!response.ok || !result.success) {
      console.error("❌ Print server error:", result.error);
      return { success: false, error: result.error };
    }

    // If server returned HTML for browser printing, use it
    if (result.html) {
      const printWindow = window.open("", "", "height=600,width=400");
      if (printWindow) {
        printWindow.document.write(result.html);
        printWindow.document.close();
        setTimeout(() => printWindow.print(), 250);
      }
    }

    console.log("✅ Print job sent successfully");
    return { success: true };
  } catch (err) {
    console.error("❌ Failed to send print job:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Load printer settings for the restaurant
 */
async function loadPrinterSettings(restaurantId) {
  try {
    const response = await fetch(
      `${API_BASE}/restaurants/${restaurantId}/printer-settings`
    );

    if (!response.ok) {
      console.warn("⚠️ Could not load printer settings");
      return null;
    }

    return await response.json();
  } catch (err) {
    console.error("❌ Failed to load printer settings:", err);
    return null;
  }
}

/**
 * Auto-print new kitchen orders if enabled
 */
async function autoPrintKitchenOrder(order, restaurantId, restaurantName) {
  try {
    const settingsResponse = await loadPrinterSettings(restaurantId);

    // loadPrinterSettings returns the raw API response which is an array of printer rows
    // e.g. [{ type: 'QR', ... }, { type: 'Kitchen', settings: { auto_print: true, printers: [...] } }]
    let kitchenSettings = null;
    if (Array.isArray(settingsResponse)) {
      const kitchenRow = settingsResponse.find(p => p.type === 'Kitchen');
      if (kitchenRow) {
        kitchenSettings = {
          auto_print: kitchenRow.settings?.auto_print,
          printer_type: kitchenRow.printer_type,
          printer_host: kitchenRow.printer_host,
          printer_port: kitchenRow.printer_port,
          bluetooth_device_id: kitchenRow.bluetooth_device_id,
          bluetooth_device_name: kitchenRow.bluetooth_device_name,
          printers: kitchenRow.settings?.printers || [],
        };
      }
    } else if (settingsResponse && typeof settingsResponse === 'object') {
      // Legacy flat format fallback
      kitchenSettings = {
        auto_print: settingsResponse.kitchen_auto_print,
        printer_type: settingsResponse.kitchen_printer_type,
        printer_host: settingsResponse.kitchen_printer_host,
        printer_port: settingsResponse.kitchen_printer_port,
        bluetooth_device_id: settingsResponse.kitchen_bluetooth_device_id,
        bluetooth_device_name: settingsResponse.kitchen_bluetooth_device_name,
      };
    }

    if (!kitchenSettings || !kitchenSettings.auto_print) {
      console.log("ℹ️ Auto-print not enabled or settings unavailable");
      return;
    }

    if (order.items.some((item) => item.status === "pending")) {
      console.log(`🖨️ Auto-printing order #${order.orderId}`);

      if (kitchenSettings.printer_type === "browser" || !kitchenSettings.printer_type || kitchenSettings.printer_type === 'none') {
        // Browser print
        printKitchenOrder(order, restaurantName);
      } else {
        // Send to thermal printer (server handles multi-printer routing)
        await sendPrintJobToServer(order.orderId, restaurantId, "kitchen");
      }
    }
  } catch (err) {
    console.error("⚠️ Auto-print failed:", err);
  }
}

/**
 * Export functions for use in kitchen.js
 */
window.kitchenPrinting = {
  generateHTML: generateKitchenOrderHTML,
  print: printKitchenOrder,
  sendToServer: sendPrintJobToServer,
  autoPrint: autoPrintKitchenOrder,
  loadSettings: loadPrinterSettings,
};
