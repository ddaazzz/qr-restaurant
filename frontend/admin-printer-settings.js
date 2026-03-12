/**
 * Admin Settings - Printer Configuration
 * Allows restaurants to configure automatic order printing
 */

let currentPrinterSettings = null;

/**
 * Load and display current printer settings
 */
async function loadPrinterSettings() {
  try {
    const restaurantId = localStorage.getItem("restaurantId");
    if (!restaurantId) {
      console.warn("⚠️ No restaurantId found");
      return;
    }

    const response = await fetch(
      `${API}/restaurants/${restaurantId}/printer-settings`
    );

    if (!response.ok) {
      console.warn("⚠️ No printer settings found, using defaults");
      currentPrinterSettings = {
        printer_type: "none",
        kitchen_auto_print: false,
        bill_auto_print: false,
        print_logo: true,
      };
      return;
    }

    currentPrinterSettings = await response.json();
    updatePrinterSettingsUI();
  } catch (err) {
    console.error("❌ Failed to load printer settings:", err);
  }
}

/**
 * Update the UI based on loaded settings
 */
function updatePrinterSettingsUI() {
  if (!currentPrinterSettings) return;

  const type = currentPrinterSettings.printer_type || "none";
  
  // Safely update elements that exist
  const printerTypeEl = document.getElementById("printer-type");
  if (printerTypeEl) printerTypeEl.value = type;
  
  const printerHostEl = document.getElementById("printer-host");
  if (printerHostEl) printerHostEl.value = currentPrinterSettings.printer_host || "";
  
  const printerPortEl = document.getElementById("printer-port");
  if (printerPortEl) printerPortEl.value = currentPrinterSettings.printer_port || 9100;
  
  const kitchenAutoPrintEl = document.getElementById("kitchen-auto-print");
  if (kitchenAutoPrintEl) kitchenAutoPrintEl.checked = currentPrinterSettings.kitchen_auto_print || false;
  
  const billAutoPrintEl = document.getElementById("bill-auto-print");
  if (billAutoPrintEl) billAutoPrintEl.checked = currentPrinterSettings.bill_auto_print || false;
  
  const printLogoEl = document.getElementById("print-logo");
  if (printLogoEl) printLogoEl.checked = currentPrinterSettings.print_logo !== false;

  updatePrinterTypeUI(type);
}

/**
 * Update UI visibility based on printer type
 */
function updatePrinterTypeUI(type) {
  const networkDiv = document.getElementById("network-printer-config");
  const usbDiv = document.getElementById("usb-printer-config");
  const autoSettings = document.getElementById("auto-print-settings");

  if (networkDiv) {
    networkDiv.style.display = type === "network" ? "block" : "none";
  }
  if (usbDiv) {
    usbDiv.style.display = type === "usb" ? "block" : "none";
  }
  if (autoSettings) {
    autoSettings.style.display = type !== "none" ? "block" : "none";
  }
}

/**
 * Handle printer type selection change
 */
function onPrinterTypeChanged() {
  const typeEl = document.getElementById("printer-type");
  if (typeEl) {
    const type = typeEl.value;
    updatePrinterTypeUI(type);
  }
}

/**
 * Save printer settings to server
 */
async function savePrinterSettings() {
  try {
    const restaurantId = localStorage.getItem("restaurantId");
    if (!restaurantId) {
      alert("Restaurant ID not found");
      return;
    }

    const printerTypeEl = document.getElementById("printer-type");
    const printerType = printerTypeEl ? printerTypeEl.value : "none";
    
    const printerHostEl = document.getElementById("printer-host");
    const printerPortEl = document.getElementById("printer-port");
    const kitchenAutoPrintEl = document.getElementById("kitchen-auto-print");
    const billAutoPrintEl = document.getElementById("bill-auto-print");
    const printLogoEl = document.getElementById("print-logo");
    
    const settings = {
      printer_type: printerType,
      printer_host:
        printerType === "network" && printerHostEl
          ? printerHostEl.value
          : null,
      printer_port:
        printerType === "network" && printerPortEl
          ? parseInt(printerPortEl.value) || 9100
          : null,
      printer_usb_vendor_id: null,
      printer_usb_product_id: null,
      kitchen_auto_print: kitchenAutoPrintEl ? kitchenAutoPrintEl.checked : false,
      bill_auto_print: billAutoPrintEl ? billAutoPrintEl.checked : false,
      print_logo: printLogoEl ? printLogoEl.checked !== false : true,
    };

    const response = await fetch(
      `${API}/restaurants/${restaurantId}/printer-settings`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      }
    );

    if (!response.ok) {
      throw new Error("Failed to save settings");
    }

    currentPrinterSettings = await response.json();
    alert("✅ Printer settings saved successfully!");
  } catch (err) {
    console.error("❌ Failed to save printer settings:", err);
    alert("Failed to save printer settings: " + err.message);
  }
}

/**
 * Test printer connection
 */
async function testPrinterConnection() {
  try {
    const restaurantId = localStorage.getItem("restaurantId");
    if (!restaurantId) {
      alert("Restaurant ID not found");
      return;
    }

    const printerType = document.getElementById("printer-type").value;

    if (printerType === "none") {
      alert("Please select a printer type first");
      return;
    }

    // First save the settings
    await savePrinterSettings();

    const testBtn = event.target;
    testBtn.disabled = true;
    testBtn.textContent = "Testing...";

    const response = await fetch(
      `${API}/restaurants/${restaurantId}/printer-test`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }
    );

    const result = await response.json();

    if (result.success) {
      alert("✅ Printer connection successful!");
    } else {
      alert("❌ Failed to connect to printer:\n" + (result.error || "Unknown error"));
    }

    testBtn.disabled = false;
    testBtn.textContent = "🖨️ Test Connection";
  } catch (err) {
    console.error("❌ Printer test failed:", err);
    alert("Printer test failed: " + err.message);
    const testBtn = document.querySelector('button[onclick="testPrinterConnection()"]');
    if (testBtn) {
      testBtn.disabled = false;
      testBtn.textContent = "🖨️ Test Connection";
    }
  }
}

/**
 * Initialize printer settings when admin loads
 */
window.addEventListener("DOMContentLoaded", () => {
  // Only initialize if we're in the settings section
  const timeout = setTimeout(() => {
    if (document.getElementById("printer-type")) {
      loadPrinterSettings();
    }
    // Initialize QR format preview
    if (document.getElementById("qr-format-name")) {
      updateQRPreview();
      // Add event listeners for real-time preview updates
      document.getElementById("qr-format-name").addEventListener("input", updateQRPreview);
      document.getElementById("qr-format-show-time").addEventListener("change", updateQRPreview);
      document.getElementById("qr-format-table-layout").addEventListener("change", updateQRPreview);
      document.getElementById("qr-format-footer").addEventListener("input", updateQRPreview);
    }
  }, 500);

  // Also listen for when admin settings are opened
  window.addEventListener("settingsOpened", () => {
    loadPrinterSettings();
    setTimeout(() => {
      if (document.getElementById("qr-format-name")) {
        updateQRPreview();
      }
    }, 100);
  });
});

// Export for use in admin-settings.js
window.printerSettings = {
  load: loadPrinterSettings,
  save: savePrinterSettings,
  test: testPrinterConnection,
  onTypeChanged: onPrinterTypeChanged,
};

/**
 * Switch between printer settings tabs
 */
function switchPrinterTab(tabName) {
  // Hide all tabs
  const tabs = document.querySelectorAll('.modal-tab-content');
  tabs.forEach(tab => tab.classList.remove('active'));

  // Remove active class from all buttons
  const buttons = document.querySelectorAll('.modal-tab-btn');
  buttons.forEach(btn => btn.classList.remove('active'));

  // Show selected tab
  const selectedTab = document.getElementById(`tab-${tabName}`);
  if (selectedTab) {
    selectedTab.classList.add('active');
  }

  // Mark button as active
  const selectedBtn = document.querySelector(`[data-tab="${tabName}"]`);
  if (selectedBtn) {
    selectedBtn.classList.add('active');
  }
}

/**
 * Update QR format preview based on editor inputs
 */
function updateQRPreview() {
  const restaurantName = document.getElementById('qr-format-name')?.value || 'Restaurant';
  const showTime = document.getElementById('qr-format-show-time')?.checked || false;
  const tableLayout = document.getElementById('qr-format-table-layout')?.value || 'both';
  const qrSize = document.getElementById('qr-format-qr-size')?.value || 'medium';
  const footerText = document.getElementById('qr-format-footer')?.value || 'Powered by Chuio.io';

  const sizeMap = { small: '180px', medium: '240px', large: '280px' };
  const qrSizePixels = sizeMap[qrSize] || '240px';

  let tableHtml = '';
  if (tableLayout === 'both') {
    tableHtml = '<div style="display: flex; justify-content: space-between; font-size: 13px; margin: 12px 0;"><div>Table: T02</div><div>Pax: 4</div></div>';
  } else if (tableLayout === 'table-only') {
    tableHtml = '<div style="font-size: 13px; margin: 12px 0;">Table: T02</div>';
  } else if (tableLayout === 'vertical') {
    tableHtml = '<div style="font-size: 13px; margin: 12px 0;">Table: T02<br>Pax: 4</div>';
  }

  const preview = document.getElementById('qr-format-preview');
  if (preview) {
    preview.innerHTML = `
      <div style="font-weight: bold; font-size: 16px; margin-bottom: 8px;">${restaurantName}</div>
      ${showTime ? '<div style="font-size: 12px; margin-bottom: 12px;">Time: 4:20 PM</div>' : ''}
      ${tableHtml}
      <div style="border-bottom: 1px dashed #000; margin: 12px 0;"></div>
      <div style="width: ${qrSizePixels}; height: ${qrSizePixels}; margin: 16px auto; background: #f0f0f0; border: 1px solid #ccc; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #999;">QR Code</div>
      <div style="font-weight: bold; font-size: 13px; margin: 12px 0;">Scan to Order</div>
      <div style="border-top: 1px dashed #000; padding-top: 12px; margin-top: 12px; font-size: 11px;">${footerText}</div>
    `;
  }
}

/**
 * Reset QR format to default
 */
function resetQRFormat() {
  document.getElementById('qr-format-name').value = 'My Restaurant';
  document.getElementById('qr-format-show-time').checked = true;
  document.getElementById('qr-format-table-layout').value = 'both';
  document.getElementById('qr-format-qr-size').value = 'medium';
  document.getElementById('qr-format-footer').value = 'Powered by Chuio.io';
  updateQRPreview();
}

/**
 * Save QR format settings
 */
async function saveQRFormat() {
  try {
    const restaurantId = localStorage.getItem("restaurantId");
    if (!restaurantId) {
      alert("Restaurant ID not found");
      return;
    }

    const formatData = {
      restaurant_name: document.getElementById('qr-format-name').value,
      show_time: document.getElementById('qr-format-show-time').checked,
      table_layout: document.getElementById('qr-format-table-layout').value,
      qr_size: document.getElementById('qr-format-qr-size').value,
      footer_text: document.getElementById('qr-format-footer').value,
    };

    const response = await fetch(
      `${API}/restaurants/${restaurantId}/qr-format`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formatData),
      }
    );

    if (!response.ok) {
      throw new Error("Failed to save QR format");
    }

    alert("✅ QR Code format saved successfully!");
  } catch (err) {
    console.error("❌ Failed to save QR format:", err);
    alert("Failed to save QR format: " + err.message);
  }
}
