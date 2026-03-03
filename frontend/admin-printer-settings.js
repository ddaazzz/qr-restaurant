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
  document.getElementById("printer-type").value = type;
  document.getElementById("printer-host").value =
    currentPrinterSettings.printer_host || "";
  document.getElementById("printer-port").value =
    currentPrinterSettings.printer_port || 9100;
  document.getElementById("kitchen-auto-print").checked =
    currentPrinterSettings.kitchen_auto_print || false;
  document.getElementById("bill-auto-print").checked =
    currentPrinterSettings.bill_auto_print || false;
  document.getElementById("print-logo").checked =
    currentPrinterSettings.print_logo !== false;

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
  const type = document.getElementById("printer-type").value;
  updatePrinterTypeUI(type);
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

    const printerType = document.getElementById("printer-type").value;
    const settings = {
      printer_type: printerType,
      printer_host:
        printerType === "network"
          ? document.getElementById("printer-host").value
          : null,
      printer_port:
        printerType === "network"
          ? parseInt(document.getElementById("printer-port").value) || 9100
          : null,
      printer_usb_vendor_id:
        printerType === "usb"
          ? document.getElementById("printer-usb-vendor").value
          : null,
      printer_usb_product_id:
        printerType === "usb"
          ? document.getElementById("printer-usb-product").value
          : null,
      kitchen_auto_print:
        document.getElementById("kitchen-auto-print").checked || false,
      bill_auto_print:
        document.getElementById("bill-auto-print").checked || false,
      print_logo: document.getElementById("print-logo").checked !== false,
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
  }, 500);

  // Also listen for when admin settings are opened
  window.addEventListener("settingsOpened", () => {
    loadPrinterSettings();
  });
});

// Export for use in admin-settings.js
window.printerSettings = {
  load: loadPrinterSettings,
  save: savePrinterSettings,
  test: testPrinterConnection,
  onTypeChanged: onPrinterTypeChanged,
};
