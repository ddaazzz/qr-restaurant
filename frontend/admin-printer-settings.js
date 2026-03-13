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
  
  // Update form elements
  const printerTypeEl = document.getElementById("printer-type");
  if (printerTypeEl) printerTypeEl.value = type;
  
  const printerHostEl = document.getElementById("printer-host");
  if (printerHostEl) printerHostEl.value = currentPrinterSettings.printer_host || "";
  
  const printerPortEl = document.getElementById("printer-port");
  if (printerPortEl) printerPortEl.value = currentPrinterSettings.printer_port || 9100;
  
  // Update view-mode displays
  const typeLabel = {
    'none': 'No Printer',
    'network': '🌐 Network Printer (Thermal over IP)',
    'bluetooth': '📱 Bluetooth Receipt Printer'
  }[type] || 'Not Configured';
  
  const viewTypeEl = document.getElementById("view-printer-type");
  if (viewTypeEl) viewTypeEl.textContent = typeLabel;
  
  const viewHostEl = document.getElementById("view-printer-host");
  if (viewHostEl) viewHostEl.textContent = currentPrinterSettings.printer_host || 'Not set';
  
  const viewPortEl = document.getElementById("view-printer-port");
  if (viewPortEl) viewPortEl.textContent = currentPrinterSettings.printer_port || '9100';
  
  // Update checkboxes
  const kitchenAutoPrintEl = document.getElementById("kitchen-auto-print");
  if (kitchenAutoPrintEl) kitchenAutoPrintEl.checked = currentPrinterSettings.kitchen_auto_print || false;
  
  const billAutoPrintEl = document.getElementById("bill-auto-print");
  if (billAutoPrintEl) billAutoPrintEl.checked = currentPrinterSettings.bill_auto_print || false;
  
  const printLogoEl = document.getElementById("print-logo");
  if (printLogoEl) printLogoEl.checked = currentPrinterSettings.print_logo !== false;

  // Load Bluetooth device if selected
  if (type === 'bluetooth' && currentPrinterSettings.bluetooth_device_id) {
    const bluetoothSelect = document.getElementById('bluetooth-device-id');
    if (bluetoothSelect) {
      // Check if device is already in the list
      const exists = Array.from(bluetoothSelect.options).some(opt => opt.value === currentPrinterSettings.bluetooth_device_id);
      if (!exists && currentPrinterSettings.bluetooth_device_name) {
        const option = document.createElement('option');
        option.value = currentPrinterSettings.bluetooth_device_id;
        option.textContent = currentPrinterSettings.bluetooth_device_name;
        bluetoothSelect.appendChild(option);
      }
      bluetoothSelect.value = currentPrinterSettings.bluetooth_device_id;
    }
  }

  // Show/hide network/bluetooth fields
  updatePrinterTypeFields();
}

/**
 * Update UI based on selected printer type
 */
function updatePrinterTypeFields() {
  const printerType = document.getElementById('printer-type')?.value || 'none';
  const printerHostGroup = document.getElementById('printer-host-group');
  const printerPortGroup = document.getElementById('printer-port-group');
  const bluetoothDeviceGroup = document.getElementById('bluetooth-device-group');

  // Show/hide fields based on printer type
  if (printerHostGroup) printerHostGroup.style.display = (printerType === 'thermal' || printerType === 'network') ? 'block' : 'none';
  if (printerPortGroup) printerPortGroup.style.display = (printerType === 'thermal' || printerType === 'network') ? 'block' : 'none';
  if (bluetoothDeviceGroup) bluetoothDeviceGroup.style.display = printerType === 'bluetooth' ? 'block' : 'none';
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
    if (document.getElementById("qr-format-text-above")) {
      updateQRPreview();
      // Fetch restaurant data to populate defaults
      fetchRestaurantDataForQRFormat();
      
      // Add event listeners for real-time preview updates
      const updateFields = [
        'qr-format-name-size', 'qr-format-show-phone', 'qr-format-show-address',
        'qr-format-show-time', 'qr-format-details-size', 'qr-format-qr-size',
        'qr-format-text-above', 'qr-format-text-below',
        'qr-format-footer-size'
      ];
      
      const customFooterEl = document.getElementById('qr-format-custom-footer');
      if (customFooterEl) {
        customFooterEl.addEventListener('change', () => {
          updateQRPreview();
          updateFontSizeDisplay();
        });
      }

      updateFields.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
          el.addEventListener(el.type === 'range' ? 'input' : 'change', () => {
            updateQRPreview();
            updateFontSizeDisplay();
          });
        }
      });
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
 * Fetch restaurant data and populate form defaults
 */
async function fetchRestaurantDataForQRFormat() {
  try {
    const restaurantId = localStorage.getItem("restaurantId");
    if (!restaurantId) return;

    const response = await fetch(`${API}/restaurants/${restaurantId}/settings`);
    const restaurant = await response.json();

    const nameInput = document.getElementById('qr-format-name');
    const phoneInput = document.getElementById('qr-format-show-phone');
    const addressInput = document.getElementById('qr-format-show-address');

    if (nameInput && !nameInput.value.includes('Restaurant')) {
      nameInput.value = restaurant.name || 'Restaurant';
    }

    // Store restaurant data for preview
    window.restaurantData = {
      name: restaurant.name || 'Restaurant',
      phone: restaurant.phone || '+1 (555) 123-4567',
      address: restaurant.address || '123 Main St',
    };

    updateQRPreview();
  } catch (err) {
    console.error('Error fetching restaurant data:', err);
  }
}

/**
 * Update font size display values
 */
function updateFontSizeDisplay() {
  const nameSize = document.getElementById('qr-format-name-size')?.value || 18;
  const detailsSize = document.getElementById('qr-format-details-size')?.value || 11;
  const footerSize = document.getElementById('qr-format-footer-size')?.value || 10;

  const nameSizeDisplay = document.getElementById('qr-name-size-display');
  const detailsSizeDisplay = document.getElementById('qr-details-size-display');
  const footerSizeDisplay = document.getElementById('qr-footer-size-display');

  if (nameSizeDisplay) nameSizeDisplay.textContent = nameSize + 'px';
  if (detailsSizeDisplay) detailsSizeDisplay.textContent = detailsSize + 'px';
  if (footerSizeDisplay) footerSizeDisplay.textContent = footerSize + 'px';
}

/**
 * Update QR format preview based on editor inputs - Professional Receipt Format
 */
function updateQRPreview() {
  // Get all form values
  const nameSize = document.getElementById('qr-format-name-size')?.value || 18;
  const showPhone = document.getElementById('qr-format-show-phone')?.checked || false;
  const showAddress = document.getElementById('qr-format-show-address')?.checked || false;
  const showTime = document.getElementById('qr-format-show-time')?.checked || false;
  const detailsSize = document.getElementById('qr-format-details-size')?.value || 11;
  const qrSize = document.getElementById('qr-format-qr-size')?.value || 'medium';
  const textAbove = document.getElementById('qr-format-text-above')?.value || 'Scan to Order';
  const textBelow = document.getElementById('qr-format-text-below')?.value || 'Let us know how we did!';
  const customFooter = document.getElementById('qr-format-custom-footer')?.value || '';
  const footerSize = document.getElementById('qr-format-footer-size')?.value || 10;

  // Restaurant data (from database or defaults)
  const restaurantName = window.restaurantData?.name || 'La Cave (Sai Ying Pun)';
  const phone = window.restaurantData?.phone || '+852 9442 0275';
  const address = window.restaurantData?.address || 'SHOP E G/F FOOK MOON BLDG 56-72 THIRD ST';

  const sizeMap = { small: '180px', medium: '220px', large: '260px' };
  const qrSizePixels = sizeMap[qrSize] || '220px';

  const divider = '='.repeat(40);
  const smallDivider = '-'.repeat(40);

  let preview = `<strong style="font-size: ${nameSize}px; display: block; margin-bottom: 4px;">${restaurantName}</strong>`;

  if (showPhone) {
    preview += `<div style="font-size: 11px; margin-bottom: 2px;">Phone: ${phone}</div>`;
  }

  if (showAddress) {
    preview += `<div style="font-size: 11px; margin-bottom: 8px;">${address}</div>`;
  }

  preview += `<div style="font-size: 10px; margin: 8px 0; letter-spacing: 0.5px;">${divider}</div>`;

  if (showTime) {
    preview += `<div style="font-size: ${detailsSize}px; margin: 4px 0;">Order Time: 2026-03-13 18:24:42</div>`;
  }

  preview += `
    <div style="font-size: ${detailsSize}px; margin: 4px 0;">Served By: server</div>
    <div style="font-size: ${detailsSize}px; margin-bottom: 8px;">Order No.: C2</div>
    <div style="font-size: 10px; margin: 8px 0; letter-spacing: 0.5px;">${divider}</div>
    
    <div style="font-size: 11px; margin: 8px 0; text-align: left;">
      <div>1    Domaine Rolet, Chardonnay    $450.0</div>
      <div style="font-size: 10px; color: #666;">     "L'Etoile", 2022</div>
    </div>
    
    <div style="font-size: 10px; margin: 8px 0; letter-spacing: 0.5px;">${smallDivider}</div>
    
    <div style="font-size: 11px; text-align: right; margin: 4px 0;">
      <div>Subtotal: $450.0</div>
      <div style="font-weight: bold; font-size: 14px; margin: 4px 0;">Amount: $450.0</div>
      <div>Avg. per Person: $450.0</div>
    </div>
    <div style="font-size: 10px; margin: 8px 0; letter-spacing: 0.5px;">${divider}</div>
    
    <div style="font-weight: bold; font-size: 12px; margin: 12px 0;">Thank You</div>
    <div style="font-size: 11px; margin-bottom: 12px;">Thank you for coming!</div>
    
    <div style="width: ${qrSizePixels}; height: ${qrSizePixels}; margin: 12px auto; background: #f0f0f0; border: 1px solid #ccc; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #999;">QR Code</div>
    
    <div style="font-weight: bold; font-size: ${detailsSize}px; margin: 8px 0;">${textAbove}</div>
    <div style="font-size: 11px; margin-bottom: 8px;">${textBelow}</div>
    ${customFooter ? `<div style="font-size: ${footerSize}px; margin-bottom: 4px; color: #666;">${customFooter}</div>` : ''}
    <div style="font-size: ${footerSize}px; margin-top: 8px; color: #666;">Powered by Chuio.io</div>
  `;

  const preview_el = document.getElementById('qr-format-preview');
  if (preview_el) {
    preview_el.innerHTML = preview;
  }

  updateFontSizeDisplay();
}

/**
 * Reset QR format to default
 */
function resetQRFormat() {
  document.getElementById('qr-format-name-size').value = 18;
  document.getElementById('qr-format-show-phone').checked = true;
  document.getElementById('qr-format-show-address').checked = true;
  document.getElementById('qr-format-show-time').checked = true;
  document.getElementById('qr-format-details-size').value = 11;
  document.getElementById('qr-format-qr-size').value = 'medium';
  document.getElementById('qr-format-text-above').value = 'Scan to Order';
  document.getElementById('qr-format-text-below').value = 'Let us know how we did!';
  const customFooterEl = document.getElementById('qr-format-custom-footer');
  if (customFooterEl) customFooterEl.value = '';
  document.getElementById('qr-format-footer-size').value = 10;
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
      name_font_size: parseInt(document.getElementById('qr-format-name-size').value),
      show_phone: document.getElementById('qr-format-show-phone').checked,
      show_address: document.getElementById('qr-format-show-address').checked,
      show_time: document.getElementById('qr-format-show-time').checked,
      details_font_size: parseInt(document.getElementById('qr-format-details-size').value),
      qr_size: document.getElementById('qr-format-qr-size').value,
      text_above_qr: document.getElementById('qr-format-text-above').value,
      text_below_qr: document.getElementById('qr-format-text-below').value,
      custom_footer: document.getElementById('qr-format-custom-footer')?.value || '',
      powered_by_text: 'Powered by Chuio.io',
      footer_font_size: parseInt(document.getElementById('qr-format-footer-size').value),
    };

    const response = await fetch(
      `${API}/restaurants/${restaurantId}/qr-receipt-format`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formatData),
      }
    );

    if (!response.ok) {
      throw new Error("Failed to save QR format");
    }

    alert("✅ QR Code receipt format saved successfully!");
  } catch (err) {
    console.error("❌ Failed to save QR format:", err);
    alert("Failed to save QR format: " + err.message);
  }
}
