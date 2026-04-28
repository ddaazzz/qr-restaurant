/**
 * Admin Printer Settings Module
 * Handles printer configuration for QR, Bill, and Kitchen printing
 */

// Safe global initialization for multiple script loads
if (typeof window.currentPrinterSettings === 'undefined') {
  window.currentPrinterSettings = null;
}
if (typeof window.currentEditingPrinterType === 'undefined') {
  window.currentEditingPrinterType = null;
}

/**
 * Initialize printer settings module
 */
async function initializePrinterSettings() {
  console.log('[admin-printer.js] Initializing printer settings module');
  await loadPrinterSettings();
  await checkKPayPrinterVisibility();
  console.log('[admin-printer.js] Initialization complete, settings loaded');
}

/**
 * Check if KPay printer card should be shown
 * Only visible when an active KPay payment terminal is configured
 */
async function checkKPayPrinterVisibility() {
  try {
    const restaurantId = window.currentRestaurantId;
    if (!restaurantId) return;
    
    const response = await fetch(`/api/restaurants/${restaurantId}/payment-terminals`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    
    if (response.ok) {
      const terminals = await response.json();
      const hasActiveKpay = Array.isArray(terminals) && terminals.some(t => t.vendor_name === 'kpay' && t.is_active);
      const kpayCard = document.getElementById('kpay-printer-card');
      if (kpayCard) {
        kpayCard.style.display = hasActiveKpay ? '' : 'none';
      }
    }
  } catch (err) {
    console.log('[admin-printer.js] Could not check KPay terminal status:', err);
  }
}

/**
 * Navigate back to the printer type selection menu
 */
async function backToSelection() {
  console.log('[admin-printer.js] backToSelection called - reloading printer settings');
  
  // Reload settings from API before going back
  await loadPrinterSettings();
  
  const selectionView = document.getElementById('printer-type-selection');
  const detailView = document.getElementById('printer-detail-view');
  
  if (selectionView) selectionView.style.display = 'block';
  if (detailView) detailView.style.display = 'none';
  
  updateStatusCards();
}

/**
 * Select a printer type and show its configuration
 */
function selectPrinterType(type) {
  console.log('[admin-printer.js] selectPrinterType called:', type);
  console.log('[admin-printer.js] Current settings from database:', window.currentPrinterSettings);
  
  // Show the database state before showing UI
  const prefix = type === 'qr' ? 'qr_' : type === 'bill' ? 'bill_' : type === 'kpay' ? 'kpay_' : 'kitchen_';
  const dbDevice = window.currentPrinterSettings ? window.currentPrinterSettings[`${prefix}bluetooth_device`] : null;
  const dbPrinterType = window.currentPrinterSettings ? window.currentPrinterSettings[`${prefix}printer_type`] : null;
  
  console.log(`[admin-printer.js] Database state for ${type}:`, {
    printer_type: dbPrinterType,
    bluetooth_device: dbDevice,
    device_exists: dbDevice !== null && dbDevice !== undefined
  });
  
  
  const selectionView = document.getElementById('printer-type-selection');
  const detailView = document.getElementById('printer-detail-view');
  const detailTitle = document.getElementById('detail-title');
  const qrFormatSection = document.getElementById('qr-format-section');
  const billFormatSection = document.getElementById('bill-format-section');
  const printerConfigCard = document.getElementById('printer-config-card');
  
  if (!detailView) {
    console.error('[admin-printer.js] Detail view not found');
    return;
  }
  
  // Hide selection, show detail
  if (selectionView) selectionView.style.display = 'none';
  detailView.style.display = 'block';
  
  // Update title
  const titles = {
    'qr': t('admin.printer-qr-title') || 'QR Code Printing',
    'bill': t('admin.printer-bill-title') || 'Bill Receipt Printing',
    'kitchen': t('admin.printer-kitchen-title') || 'Kitchen Order Printing',
    'kpay': t('admin.printer-kpay-title') || 'KPay Receipt Printing'
  };
  
  if (detailTitle) detailTitle.textContent = titles[type] || 'Configuration';
  
  // Handle QR format section
  if (qrFormatSection) {
    if (type === 'qr') {
      qrFormatSection.style.display = 'block';
    } else {
      qrFormatSection.style.display = 'none';
    }
  }
  
  // Handle Bill format section
  if (billFormatSection) {
    if (type === 'bill') {
      console.log('[admin-printer.js] Showing bill format section');
      billFormatSection.style.display = 'block';
      console.log('[admin-printer.js] Bill section display style:', billFormatSection.style.display);
      console.log('[admin-printer.js] Bill section computed display:', window.getComputedStyle(billFormatSection).display);
    } else {
      billFormatSection.style.display = 'none';
    }
  } else {
    console.warn('[admin-printer.js] Bill format section element not found');
  }
  
  // Handle Kitchen format section
  const kitchenFormatSection = document.getElementById('kitchen-format-section');
  if (kitchenFormatSection) {
    if (type === 'kitchen') {
      kitchenFormatSection.style.display = 'block';
      if (typeof loadKitchenFormatUI === 'function') {
        // Call async function without blocking
        loadKitchenFormatUI().catch(err => {
          console.error('[admin-printer.js] Error loading kitchen format UI:', err);
        });
      }
    } else {
      kitchenFormatSection.style.display = 'none';
    }
  }

  // Handle KPay format section
  const kpayFormatSection = document.getElementById('kpay-format-section');
  if (kpayFormatSection) {
    if (type === 'kpay') {
      kpayFormatSection.style.display = 'block';
      loadKPayFormatUI();
    } else {
      kpayFormatSection.style.display = 'none';
    }
  }

  // Store current type
  window.currentEditingPrinterType = type;
  
  // Kitchen and KPay manage their own printer config inside their format sections
  if (type !== 'kitchen' && type !== 'kpay') {
    // QR and Bill use the shared printer-config-card
    if (printerConfigCard) {
      printerConfigCard.style.display = 'block';
      console.log(`[admin-printer.js] Calling renderPrinterConfigCard for type: ${type}`);
      renderPrinterConfigCard(type, printerConfigCard);
      // Load format UI AFTER renderPrinterConfigCard so auto-print checkbox exists in DOM
      if (type === 'qr') loadQRCodeFormatUI();
      if (type === 'bill') loadBillFormatUI();
      // Check if there's an active session and display status
      const sessionStatus = document.getElementById(`bluetooth-session-status-${type}`);
      if (sessionStatus && window.bluetoothSessions && window.bluetoothSessions[type.toUpperCase()]) {
        const session = window.bluetoothSessions[type.toUpperCase()];
        if (session.connected && session.device) {
          displayBluetoothSessionStatus(type, session.device.name);
        }
      }
    } else {
      console.error('[admin-printer.js] CRITICAL: printer-config-card element not found!');
    }
  } else {
    // Kitchen and KPay hide the shared config card — their own section handles it
    if (printerConfigCard) {
      printerConfigCard.style.display = 'none';
      printerConfigCard.innerHTML = '';
    }
    console.log('[admin-printer.js] ' + type + ' type selected - using dedicated format section');
  }
  
  console.log('[admin-printer.js] Detail view shown for type:', type);
}

/**
 * Update live QR preview as user types (calls backend to ensure accuracy)
 */
async function updateLivePreview() {
  try {
    const textAbove = document.getElementById('qr-text-above')?.value || 'Scan to Order';
    const textBelow = document.getElementById('qr-text-below')?.value || 'Let us know how we did!';
    const restaurantId = localStorage.getItem('restaurantId');

    if (!restaurantId) {
      console.warn('[admin-printer.js] Restaurant ID not found for preview');
      return;
    }

    // Call backend to generate preview using actual thermalPrinterService
    const response = await fetch(`${API}/restaurants/${restaurantId}/preview-qr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tableName: 'T02',
        pax: 4,
        qrTextAbove: textAbove,
        qrTextBelow: textBelow
      })
    });

    if (!response.ok) {
      console.error('[admin-printer.js] Failed to generate preview');
      return;
    }

    const data = await response.json();
    const previewText = data.previewText;

    // Update the preview display with monospace text
    const previewDiv = document.getElementById('qr-preview-box');
    const previewAbove = document.getElementById('qr-preview-above');
    const previewBelow = document.getElementById('qr-preview-below');

    if (previewAbove) previewAbove.textContent = textAbove || 'Scan to Order';
    if (previewBelow) previewBelow.textContent = textBelow || 'Let us know how we did!';
  } catch (err) {
    console.error('[admin-printer.js] Error updating preview:', err);
  }
}

/**
 * Get currently selected QR code size
 */
function getCurrentQRSize() {
  if (document.getElementById('qr-size-small')?.classList.contains('active')) return 'small';
  if (document.getElementById('qr-size-large')?.classList.contains('active')) return 'large';
  return 'medium';
}

/**
 * Render the printer configuration card for a specific type
 */
/**
 * Render the printer configuration card for a specific type
 */
function renderPrinterConfigCard(type, container) {
  if (!container) {
    console.error(`[admin-printer.js] Container not found for type: ${type}`);
    return;
  }

  const settings = window.currentPrinterSettings || {};
  const prefix = type === 'qr' ? 'qr_' : type === 'bill' ? 'bill_' : type === 'kpay' ? 'kpay_' : 'kitchen_';
  const printerType = settings[`${prefix}printer_type`] || 'none';
  const printerHost = settings[`${prefix}printer_host`] || '';
  
  // Check for device: first saved in database, then temporarily scanned in this session
  const savedDevice = settings[`${prefix}bluetooth_device`] || '';
  const temporaryDevice = (window.selectedBluetoothDevices && window.selectedBluetoothDevices[type]) || '';
  const bluetoothDevice = savedDevice || temporaryDevice;
  
  console.log(`[admin-printer.js] renderPrinterConfigCard(${type}):`, {
    savedDevice,
    temporaryDevice,
    bluetoothDevice,
    printerType,
    rawSettings: settings
  });
  
  const labels = {
    'qr': 'QR Code Printer',
    'bill': 'Bill Receipt Printer',
    'kitchen': 'Kitchen Order Printer',
    'kpay': 'KPay Receipt Printer'
  };

  let html = `
    <div style="background: white; border: 1px solid var(--border-color, #e5e7eb); border-radius: 8px; padding: 20px;">
      <h3 style="margin: 0 0 20px 0; font-size: 16px; font-weight: 600; color: var(--text-dark, #1f2937);">${t('admin.printer-config-heading') || 'Printer Configuration'}</h3>
      <div style="margin-bottom: 20px;">
        <label style="display: block; margin-bottom: 12px; font-weight: 600; color: var(--text-dark, #1f2937);">${t('admin.printer-type') || 'Printer Type'}</label>
        <select id="printer-type-select-${type}" onchange="updatePrinterTypeSelection('${type}')" style="width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 14px;">
          <option value="none" ${printerType === 'none' ? 'selected' : ''}>No Printer</option>
          <option value="network" ${printerType === 'network' ? 'selected' : ''}>Network Printer (LAN/WiFi)</option>
          <option value="bluetooth" ${printerType === 'bluetooth' ? 'selected' : ''}>Bluetooth Printer</option>
        </select>
      </div>
      
      <div id="printer-config-${type}" style="margin-bottom: 20px;">
  `;
  
  if (printerType === 'network') {
    html += `
      <div class="form-group">
        <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #1f2937;">Printer IP Address</label>
        <input id="printer-host-${type}" type="text" placeholder="192.168.1.100 or printer.local" value="${printerHost}" style="width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 14px; margin-bottom: 8px;" />
        <p style="font-size: 12px; color: #6b7280; margin: 8px 0 0 0;">Format: IP address or hostname (e.g., 192.168.1.100 or printer.local)</p>
      </div>
    `;
  } else if (printerType === 'bluetooth') {
    // Determine if device is from database (configured) or newly scanned
    const isConfigured = savedDevice && savedDevice.length > 0;
    const deviceStatusHTML = bluetoothDevice 
      ? `<div style="background: #d1fae5; border: 1px solid #6ee7b7; border-radius: 6px; padding: 12px; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
          <div style="flex: 1;">
            <p style="margin: 0; font-weight: 600; color: #047857;">${bluetoothDevice}</p>
            <p style="margin: 2px 0 0 0; font-size: 12px; color: #10b981;">${isConfigured ? '(Configured) Saved from database' : 'Newly scanned'}</p>
          </div>
        </div>`
      : `<div style="background: #f3f4f6; border: 1px solid #d1d5db; border-radius: 6px; padding: 12px; margin-bottom: 12px;">
          <p style="margin: 0; color: #6b7280; font-size: 14px;">No device selected</p>
        </div>`;
    
    html += `
      <div class="form-group">
        <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #1f2937;">Bluetooth Device</label>
        <div id="bluetooth-device-status-${type}">${deviceStatusHTML}</div>
        <div id="bluetooth-session-status-${type}" style="margin-bottom: 12px;"></div>
        <button onclick="scanBluetoothDevices('${type}')" class="btn-secondary" style="width: 100%; padding: 10px; margin-bottom: 8px;">Scan for Devices</button>
        <p style="font-size: 12px; color: #6b7280; margin: 0;">Works on Chrome, Edge, Opera. Or use the mobile app to scan.</p>
      </div>
    `;
  }
  
  const saveFn = type === 'qr' ? 'saveQRPrinterConfiguration' :
                  type === 'bill' ? 'saveBillPrinterConfiguration' :
                  type === 'kpay' ? 'saveKPayPrinterConfiguration' : 'saveKitchenPrinterConfiguration';

  const testFns = { 'qr': 'testPrintQRCode', 'bill': 'testPrintBillCode' };

  // Only QR printer has auto-print toggle; bill auto-print was removed in favour of manual print button
  const qrAutoPrint = type === 'qr' ? (settings.qr_auto_print || false) : false;
  const autoSection = type === 'qr' ? `
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
          <input id="qr-auto-print" type="checkbox" ${qrAutoPrint ? 'checked' : ''} style="width: 18px; height: 18px; cursor: pointer; flex-shrink: 0;" />
          <label for="qr-auto-print" style="cursor: pointer; font-weight: 500; color: var(--text-dark, #1f2937); margin: 0;">${t('admin.printer-auto-qr') || 'Auto-Print QR Codes'}</label>
        </div>` : '';

  html += `
      </div>
      <div style="border-top: 1px solid var(--border-color, #e5e7eb); padding-top: 20px; margin-top: 10px;">
        ${autoSection}
        <div style="display: flex; gap: 12px;">
          <button onclick="${saveFn}()" class="btn-primary" style="flex: 1; padding: 12px; font-weight: 600;">${t('admin.printer-save-' + type) || 'Save ' + (labels[type] || type)}</button>
          <button onclick="${testFns[type] || 'testPrintQRCode'}()" class="btn-secondary" style="flex: 1; padding: 12px; font-weight: 600;">${t('admin.printer-test-print') || 'Test Print'}</button>
        </div>
      </div>
    </div>
  `;
  
  container.innerHTML = html;
}

/**
 * Update the printer type when dropdown changes
 */
function updatePrinterTypeSelection(type) {
  const select = document.getElementById(`printer-type-select-${type}`);
  if (select) {
    const selectedType = select.value;
    const configDiv = document.getElementById(`printer-config-${type}`);
    
    if (configDiv) {
      configDiv.innerHTML = '';
      
      if (selectedType === 'network') {
        const settings = window.currentPrinterSettings || {};
        const typeKey = type === 'qr' ? 'qr' : type === 'bill' ? 'bill' : type === 'kpay' ? 'kpay' : 'kitchen';
        const savedHost = settings[`${typeKey}_printer_host`] || '';
        configDiv.innerHTML = `
          <div class="form-group">
            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #1f2937;">Printer IP Address</label>
            <input id="printer-host-${type}" type="text" placeholder="192.168.1.100 or printer.local" value="${savedHost}" style="width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 14px; margin-bottom: 8px;" />
            <p style="font-size: 12px; color: #6b7280; margin: 8px 0 0 0;">Format: IP address or hostname</p>
          </div>
        `;
      } else if (selectedType === 'bluetooth') {
        const settings = window.currentPrinterSettings || {};
        const typeKey = type === 'qr' ? 'qr' : type === 'bill' ? 'bill' : type === 'kpay' ? 'kpay' : 'kitchen';
        const savedDevice = settings[`${typeKey}_bluetooth_device`] || '';
        const temporaryDevice = (window.selectedBluetoothDevices && window.selectedBluetoothDevices[type]) || '';
        const currentDevice = savedDevice || temporaryDevice;
        
        const deviceStatusHTML = currentDevice 
          ? `<div style="background: #d1fae5; border: 1px solid #6ee7b7; border-radius: 6px; padding: 12px; margin-bottom: 12px;">
              <p style="margin: 0; font-weight: 600; color: #047857;">${currentDevice}</p>
              <p style="margin: 2px 0 0 0; font-size: 12px; color: #10b981;">Connected</p>
            </div>`
          : `<div style="background: #f3f4f6; border: 1px solid #d1d5db; border-radius: 6px; padding: 12px; margin-bottom: 12px;">
              <p style="margin: 0; color: var(--text-light, #6b7280); font-size: 14px;">No device selected</p>
            </div>`;
        
        configDiv.innerHTML = `
          <div class="form-group">
            <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--text-dark, #1f2937);">Bluetooth Device</label>
            <div id="bluetooth-device-status-${type}">${deviceStatusHTML}</div>
            <div id="bluetooth-session-status-${type}" style="margin-bottom: 12px;"></div>
            <button onclick="scanBluetoothDevices('${type}')" class="btn-secondary" style="width: 100%; padding: 10px; margin-bottom: 8px;">Scan for Devices</button>
            <p style="font-size: 12px; color: var(--text-light, #6b7280); margin: 0;">Works on Chrome, Edge, Opera. Or use the mobile app.</p>
          </div>
        `;
      }
    }
  }
}

/**
 * Update the status cards on the selection view
 */
function updateStatusCards() {
  const settings = window.currentPrinterSettings || {};
  console.log('[admin-printer.js] updateStatusCards called with settings:', settings);
  
  const statuses = {
    'qr': {
      element: document.getElementById('qr-status'),
      check: () => {
        const hasFormat = settings.qr_text_above || settings.qr_text_below || settings.qr_code_size;
        const hasPrinter = settings.qr_printer_type && settings.qr_printer_type !== 'none';
        const result = hasFormat || hasPrinter;
        console.log('[admin-printer.js] QR Status Check:', {qr_printer_type: settings.qr_printer_type, hasFormat, hasPrinter, result});
        return result;
      }
    },
    'bill': {
      element: document.getElementById('bill-status'),
      check: () => {
        const result = settings.bill_printer_type && settings.bill_printer_type !== 'none';
        console.log('[admin-printer.js] Bill Status Check:', {bill_printer_type: settings.bill_printer_type, result});
        return result;
      }
    },
    'kitchen': {
      element: document.getElementById('kitchen-status'),
      check: () => {
        // Kitchen is configured if it has printers with assigned categories
        const hasKitchenPrinters = settings.kitchen_printers && Array.isArray(settings.kitchen_printers) && settings.kitchen_printers.length > 0;
        const result = hasKitchenPrinters && settings.kitchen_printers.some(p => p.categories && p.categories.length > 0);
        console.log('[admin-printer.js] Kitchen Status Check:', {
          has_printers: hasKitchenPrinters,
          printer_count: settings.kitchen_printers?.length || 0,
          configured: result,
          printers: settings.kitchen_printers
        });
        return result;
      }
    },
    'kpay': {
      element: document.getElementById('kpay-status'),
      check: () => {
        const autoPrint = settings.kpay_auto_print;
        const hasPrinter = settings.kpay_printer_type && settings.kpay_printer_type !== 'none';
        const result = autoPrint || hasPrinter;
        console.log('[admin-printer.js] KPay Status Check:', { auto_print: autoPrint, printer_type: settings.kpay_printer_type, result });
        return result;
      }
    }
  };
  
  for (const [type, status] of Object.entries(statuses)) {
    if (status.element) {
      const isConfigured = status.check();
      const printerType = type === 'qr' ? settings.qr_printer_type :
                         type === 'bill' ? settings.bill_printer_type :
                         type === 'kpay' ? settings.kpay_printer_type :
                         settings.kitchen_printer_type;
      
      // Get device info to display (for QR, Bill, KPay)
      let deviceDisplay = '';
      if (isConfigured && type !== 'kitchen') {
        if (printerType === 'bluetooth') {
          const deviceName = type === 'qr' ? settings.qr_bluetooth_device :
                            type === 'bill' ? settings.bill_bluetooth_device :
                            type === 'kpay' ? settings.kpay_bluetooth_device : null;
          if (deviceName) {
            deviceDisplay = deviceName;
            console.log(`[admin-printer.js] ${type} Bluetooth device:`, deviceName);
          }
        } else if (printerType === 'network') {
          const printerHost = type === 'qr' ? settings.qr_printer_host :
                             type === 'bill' ? settings.bill_printer_host :
                             type === 'kpay' ? settings.kpay_printer_host : null;
          if (printerHost) {
            deviceDisplay = printerHost;
            console.log(`[admin-printer.js] ${type} Network device:`, printerHost);
          }
        }
        // For kpay, also show auto-print status
        if (type === 'kpay' && settings.kpay_auto_print) {
          deviceDisplay = (deviceDisplay ? deviceDisplay + ' · ' : '') + 'Auto-print ON';
        }
      }
      
      // Build status HTML
      let statusHTML = '';
      if (isConfigured) {
        if (type === 'kitchen') {
          // For kitchen, show number of printers and categories
          const printerCount = settings.kitchen_printers?.length || 0;
          const totalCategories = settings.kitchen_printers?.reduce((sum, p) => sum + (p.categories?.length || 0), 0) || 0;
          let html = `${printerCount} Printer${printerCount !== 1 ? 's' : ''}`;
          if (totalCategories > 0) {
            html += `<div style="font-size: 11px; color: #059669; margin-top: 4px; font-weight: 500;">${totalCategories} categor${totalCategories !== 1 ? 'ies' : 'y'} routed</div>`;
          }
          statusHTML = html;
        } else {
          let html = `Configured`;
          if (deviceDisplay) {
            html += `<div style="font-size: 11px; color: #059669; margin-top: 4px; font-weight: 500;">${deviceDisplay}</div>`;
          }
          statusHTML = html;
        }
        status.element.style.background = '#dcfce7';
        status.element.style.color = '#166534';
        status.element.style.minHeight = 'auto';
        status.element.style.lineHeight = '1.4';
      } else {
        statusHTML = 'Not configured';
        status.element.style.background = '#f3f4f6';
        status.element.style.color = '#666';
      }
      
      status.element.innerHTML = statusHTML;
      console.log('[admin-printer.js] Updated status for', type, ':', statusHTML);
    }
  }
}

/**
 * Load QR code format settings UI
 */
function loadQRCodeFormatUI() {
  try {
    const qrSize = window.currentPrinterSettings?.qr_code_size || 'medium';
    const qrTextAbove = window.currentPrinterSettings?.qr_text_above || 'Scan to Order';
    const qrTextBelow = window.currentPrinterSettings?.qr_text_below || 'Let us know how we did!';
    const qrAutoPrint = window.currentPrinterSettings?.qr_auto_print || false;

    const textAboveInput = document.getElementById('qr-text-above');
    const textBelowInput = document.getElementById('qr-text-below');
    const autoPrintCheckbox = document.getElementById('qr-auto-print');
    
    if (textAboveInput) textAboveInput.value = qrTextAbove;
    if (textBelowInput) textBelowInput.value = qrTextBelow;
    if (autoPrintCheckbox) autoPrintCheckbox.checked = qrAutoPrint;

    // Set active button for size
    document.getElementById('qr-size-small')?.classList.remove('active');
    document.getElementById('qr-size-medium')?.classList.remove('active');
    document.getElementById('qr-size-large')?.classList.remove('active');

    const activeBtn = document.getElementById(`qr-size-${qrSize}`);
    if (activeBtn) activeBtn.classList.add('active');

    updateQRPreview(qrTextAbove, qrTextBelow, qrSize);
  } catch (err) {
    console.error('[admin-printer.js] Failed to load QR code format UI:', err);
  }
}

/**
 * Update QR code format preview
 */
function updateQRPreview(textAbove, textBelow, size) {
  const sizeMap = { 'small': 80, 'medium': 100, 'large': 120 };
  const previewSize = sizeMap[size] || 100;

  const previewBox = document.getElementById('qr-preview-box');
  const previewAbove = document.getElementById('qr-preview-above');
  const previewBelow = document.getElementById('qr-preview-below');
  const sizeDisplay = document.getElementById('qr-size-display');

  if (previewBox) {
    previewBox.style.width = previewSize + 'px';
    previewBox.style.height = previewSize + 'px';
  }
  if (previewAbove) previewAbove.textContent = textAbove || 'Scan to Order';
  if (previewBelow) previewBelow.textContent = textBelow || 'Let us know how we did!';
  if (sizeDisplay) sizeDisplay.textContent = 'Selected: ' + (size.charAt(0).toUpperCase() + size.slice(1));
}

/**
 * Set QR code size
 */
function setQRCodeSize(size) {
  const qrTextAbove = document.getElementById('qr-text-above').value || 'Scan to Order';
  const qrTextBelow = document.getElementById('qr-text-below').value || 'Let us know how we did!';

  document.getElementById('qr-size-small')?.classList.remove('active');
  document.getElementById('qr-size-medium')?.classList.remove('active');
  document.getElementById('qr-size-large')?.classList.remove('active');
  document.getElementById(`qr-size-${size}`)?.classList.add('active');

  updateQRPreview(qrTextAbove, qrTextBelow, size);
}

/**
 * Save QR code format settings
 */
async function saveQRCodeFormat() {
  try {
    const restaurantId = localStorage.getItem('restaurantId');
    if (!restaurantId) {
      alert('Restaurant ID not found');
      return;
    }

    const qrSize = getCurrentQRSize();
    const qrTextAbove = document.getElementById('qr-text-above').value || 'Scan to Order';
    const qrTextBelow = document.getElementById('qr-text-below').value || 'Let us know how we did!';
    const qrAutoPrint = document.getElementById('qr-auto-print').checked || false;
    const qrBluetoothDevice = window.selectedBluetoothDevices ? window.selectedBluetoothDevices.qr : null;
    
    // Get printer type from the config card dropdown
    const printerTypeSelect = document.getElementById('printer-type-select-qr');
    const qrPrinterType = printerTypeSelect ? printerTypeSelect.value : window.currentPrinterSettings?.qr_printer_type || 'none';

    // Format settings as JSONB object for database storage
    const payload = {
      type: 'QR',
      printer_type: qrPrinterType,
      bluetooth_device_id: qrBluetoothDevice?.id || null,
      bluetooth_device_name: qrBluetoothDevice?.name || null,
      settings: {
        code_size: qrSize,
        text_above: qrTextAbove,
        text_below: qrTextBelow,
        auto_print: qrAutoPrint
      }
    };

    const response = await fetch(
      `${API}/restaurants/${restaurantId}/printer-settings`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to save QR code format');
    }

    window.currentPrinterSettings = await response.json();
    alert('QR Code Format saved successfully!');
  } catch (err) {
    console.error('[admin-printer.js] Failed to save QR format:', err);
    alert('Failed to save: ' + err.message);
  }
}

/**
 * Test print QR code to connected Bluetooth printer
 */
async function testPrintQRCode() {
  try {
    const restaurantId = localStorage.getItem('restaurantId');
    if (!restaurantId) {
      alert('Restaurant ID not found');
      return;
    }

    const qrTextAbove = document.getElementById('qr-text-above')?.value || 'Scan to Order';
    const qrTextBelow = document.getElementById('qr-text-below')?.value || 'Let us know how we did!';

    // Get test print ESC/POS from backend (uses actual thermalPrinterService)
    const response = await fetch(`${API}/restaurants/${restaurantId}/test-print-qr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tableName: 'T02',
        pax: 4
      })
    });

    if (!response.ok) {
      throw new Error('Failed to generate test print');
    }

    const data = await response.json();
    const escposArray = data.escposArray;

    // Send to connected Bluetooth printer
    if (window.bluetoothSessions && window.bluetoothSessions.QR && window.bluetoothSessions.QR.connected) {
      console.log('[admin-printer.js] Sending test print to connected Bluetooth printer');
      const payload = {
        type: 'qr',
        data: {
          escposArray: escposArray,
          escposBase64: data.escposBase64
        }
      };
      
      const success = await window.handleBluetoothPrint(payload);
      if (success) {
        alert('Test print sent to printer!');
      } else {
        alert('Failed to send test print');
      }
    } else {
      alert('No Bluetooth printer connected. Please connect a printer first.');
    }
  } catch (err) {
    console.error('[admin-printer.js] Failed to test print:', err);
    alert('Test print failed: ' + err.message);
  }
}

/**
 * Test print bill to connected Bluetooth printer
 */
async function testPrintBillCode() {
  try {
    const restaurantId = localStorage.getItem('restaurantId');
    if (!restaurantId) {
      alert('Restaurant ID not found');
      return;
    }

    const headerText = document.getElementById('bill-header-text')?.value || 'Thank You';
    const footerText = document.getElementById('bill-footer-text')?.value || 'Follow us on social media';

    // Get test print ESC/POS from backend (uses actual thermalPrinterService)
    const response = await fetch(`${API}/restaurants/${restaurantId}/test-print-bill`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        headerText,
        footerText,
        orderNumber: 'ORD-TEST-001',
        tableNumber: 'T01',
        items: [
          { name: 'Sample Item 1', quantity: 2, price: 1000 },
          { name: 'Sample Item 2', quantity: 1, price: 1500 }
        ],
        subtotal: 3500,
        serviceCharge: 525,
        tax: 350,
        total: 4375
      })
    });

    if (!response.ok) {
      throw new Error('Failed to generate bill test print');
    }

    const data = await response.json();
    const escposArray = data.escposArray;

    // Send to connected Bluetooth printer
    if (window.bluetoothSessions && window.bluetoothSessions.BILL && window.bluetoothSessions.BILL.connected) {
      console.log('[admin-printer.js] Sending bill test print to connected Bluetooth printer');
      const payload = {
        type: 'bill',
        data: {
          escposArray: escposArray,
          escposBase64: data.escposBase64
        }
      };
      
      const success = await window.handleBluetoothPrint(payload);
      if (success) {
        alert('Bill test print sent to printer!');
      } else {
        alert('Failed to send bill test print');
      }
    } else {
      alert('No Bluetooth printer connected. Please connect a printer first.');
    }
  } catch (err) {
    console.error('[admin-printer.js] Failed to test print bill:', err);
    alert('Bill test print failed: ' + err.message);
  }
}

/**
 * Load Bill Format UI with saved settings
 */
function loadBillFormatUI() {
  try {
    console.log('[admin-printer.js] loadBillFormatUI called');
    const billFontSize = window.currentPrinterSettings?.bill_font_size || 'medium';
    const billHeaderText = window.currentPrinterSettings?.bill_header_text || 'Thank You';
    const billFooterText = window.currentPrinterSettings?.bill_footer_text || 'Follow us on social media';

    console.log('[admin-printer.js] Bill format UI - fontSize:', billFontSize, 'header:', billHeaderText, 'footer:', billFooterText);

    const headerInput = document.getElementById('bill-header-text');
    const footerInput = document.getElementById('bill-footer-text');
    
    if (headerInput) {
      headerInput.value = billHeaderText;
      console.log('[admin-printer.js] Set header input value');
    }
    if (footerInput) {
      footerInput.value = billFooterText;
      console.log('[admin-printer.js] Set footer input value');
    }

    // Set active button for font size
    document.getElementById('bill-font-small')?.classList.remove('active');
    document.getElementById('bill-font-medium')?.classList.remove('active');
    document.getElementById('bill-font-large')?.classList.remove('active');

    const activeBtn = document.getElementById(`bill-font-${billFontSize}`);
    if (activeBtn) {
      activeBtn.classList.add('active');
      console.log('[admin-printer.js] Set active button for size:', billFontSize);
    }

    updateBillPreview(billHeaderText, billFooterText, billFontSize);
    console.log('[admin-printer.js] Bill format UI loaded successfully');
  } catch (err) {
    console.error('[admin-printer.js] Failed to load bill format UI:', err);
  }
}

/**
 * Save Bill Format settings to database
 */
async function saveBillFormat() {
  try {
    const restaurantId = localStorage.getItem('restaurantId');
    if (!restaurantId) {
      alert('Restaurant ID not found');
      return;
    }

    const billFontSize = getCurrentBillFontSize();
    const billHeaderText = document.getElementById('bill-header-text').value || 'Thank You';
    const billFooterText = document.getElementById('bill-footer-text').value || 'Follow us on social media';
    const billBluetoothDevice = window.selectedBluetoothDevices ? window.selectedBluetoothDevices.bill : null;

    // Get printer type from the config card dropdown
    const printerTypeSelect = document.getElementById('printer-type-select-bill');
    const billPrinterType = printerTypeSelect ? printerTypeSelect.value : window.currentPrinterSettings?.bill_printer_type || 'none';

    // Format settings as JSONB object for database storage
    const payload = {
      type: 'Bill',
      printer_type: billPrinterType,
      bluetooth_device_id: billBluetoothDevice?.id || null,
      bluetooth_device_name: billBluetoothDevice?.name || null,
      settings: {
        font_size: billFontSize,
        header_text: billHeaderText,
        footer_text: billFooterText
      }
    };

    const response = await fetch(
      `${API}/restaurants/${restaurantId}/printer-settings`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to save bill format');
    }

    window.currentPrinterSettings = await response.json();
    alert('Bill Format saved successfully!');
  } catch (err) {
    console.error('[admin-printer.js] Failed to save bill format:', err);
    alert('Failed to save: ' + err.message);
  }
}

/**
 * Update Bill preview as user types (calls backend to ensure accuracy)
 */
async function updateBillPreview() {
  try {
    const headerText = document.getElementById('bill-header-text')?.value || 'Thank You';
    const footerText = document.getElementById('bill-footer-text')?.value || 'Follow us on social media';
    const restaurantId = localStorage.getItem('restaurantId');

    if (!restaurantId) {
      console.warn('[admin-printer.js] Restaurant ID not found for preview');
      return;
    }

    // Call backend to generate preview using actual thermalPrinterService
    const response = await fetch(`${API}/restaurants/${restaurantId}/preview-bill`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderNumber: 'ORD-123',
        tableNumber: 'T02',
        items: [
          { name: 'Item 1', quantity: 1, price: 1000 },
          { name: 'Item 2', quantity: 1, price: 800 }
        ],
        subtotal: 1800,
        serviceCharge: 300,
        total: 2100
      })
    });

    if (!response.ok) {
      console.error('[admin-printer.js] Failed to generate bill preview');
      return;
    }

    const data = await response.json();

    // Update the preview display
    const headerPreview = document.getElementById('bill-header-preview');
    const footerPreview = document.getElementById('bill-footer-preview');

    if (headerPreview) headerPreview.textContent = headerText || 'Thank You';
    if (footerPreview) footerPreview.textContent = footerText || 'Follow us on social media';
  } catch (err) {
    console.error('[admin-printer.js] Error updating bill preview:', err);
  }
}

/**
 * Set Bill font size
 */
function setBillFontSize(size) {
  const billHeaderText = document.getElementById('bill-header-text').value || 'Thank You';
  const billFooterText = document.getElementById('bill-footer-text').value || 'Follow us on social media';

  document.getElementById('bill-font-small')?.classList.remove('active');
  document.getElementById('bill-font-medium')?.classList.remove('active');
  document.getElementById('bill-font-large')?.classList.remove('active');
  document.getElementById(`bill-font-${size}`)?.classList.add('active');

  // Update preview zoom to reflect font size visually
  const zoomMap = { small: 0.85, medium: 1.0, large: 1.2 };
  const previewContainer = document.getElementById('bill-preview-container');
  if (previewContainer) previewContainer.style.zoom = zoomMap[size] ?? 1.0;

  updateBillPreview();
}

/**
 * Get current Bill font size
 */
function getCurrentBillFontSize() {
  if (document.getElementById('bill-font-small')?.classList.contains('active')) return 'small';
  if (document.getElementById('bill-font-large')?.classList.contains('active')) return 'large';
  return 'medium';
}

/**
 * Save Bill Format
 */
async function saveBillFormat() {
  try {
    const restaurantId = localStorage.getItem('restaurantId');
    if (!restaurantId) {
      alert('Restaurant ID not found');
      return;
    }

    const billFontSize = getCurrentBillFontSize();
    const billHeaderText = document.getElementById('bill-header-text').value || 'Thank You';
    const billFooterText = document.getElementById('bill-footer-text').value || 'Follow us on social media';
    const billBluetoothDevice = window.selectedBluetoothDevices ? window.selectedBluetoothDevices.bill : null;

    // Get printer type from the config card dropdown
    const printerTypeSelect = document.getElementById('printer-type-select-bill');
    const billPrinterType = printerTypeSelect ? printerTypeSelect.value : window.currentPrinterSettings?.bill_printer_type || 'none';

    // Format settings as JSONB object for database storage (matches new unified schema)
    const payload = {
      type: 'Bill',
      printer_type: billPrinterType,
      bluetooth_device_id: billBluetoothDevice?.id || null,
      bluetooth_device_name: billBluetoothDevice?.name || null,
      settings: {
        font_size: billFontSize,
        header_text: billHeaderText,
        footer_text: billFooterText
      }
    };

    const response = await fetch(
      `${API}/restaurants/${restaurantId}/printer-settings`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to save bill format');
    }

    window.currentPrinterSettings = await response.json();
    alert('Bill Format saved successfully!');
  } catch (err) {
    console.error('[admin-printer.js] Failed to save bill format:', err);
    alert('Failed to save: ' + err.message);
  }
}

/**
 * Scan for Bluetooth devices
 */
async function scanBluetoothDevices(printerType) {
  try {
    // Check if Web Bluetooth API is supported
    if (!navigator.bluetooth) {
      alert('Web Bluetooth API is not supported on this browser.\n\nSupported browsers:\n• Chrome/Edge (desktop & Android)\n• Opera\n\nPlease try on a supported browser or use the mobile app.');
      return;
    }

    const type = printerType || window.currentEditingPrinterType;
    console.log('[admin-printer.js] Starting Bluetooth scan for type:', type);

    // Request Bluetooth device with known printer service UUIDs
    // This allows the device to expose those services to us
    const device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [
        '49535343-fe7d-4ae5-8fa9-9fafd205e455',  // MPT-2/3 series
        '0000ffe0-0000-1000-8000-00805f9b34fb',  // Common BLE UART
        '0000fff0-0000-1000-8000-00805f9b34fb',  // Alternative BLE UART
        'generic_access'                          // Fallback
      ]
    });

    if (device && device.name) {
      console.log('[admin-printer.js] New device selected:', device.name, 'for printer type:', type);
      
      // Update the device status display
      const statusDiv = document.getElementById(`bluetooth-device-status-${type}`);
      if (statusDiv) {
        statusDiv.innerHTML = `
          <div style="background: #d1fae5; border: 1px solid #6ee7b7; border-radius: 6px; padding: 12px; display: flex; align-items: center; gap: 8px;">
            <div style="flex: 1;">
              <p style="margin: 0; font-weight: 600; color: #047857;">${device.name}</p>
              <p style="margin: 2px 0 0 0; font-size: 12px; color: #10b981;">Connected</p>
            </div>
          </div>
        `;
      }
      
      // Store selected device in a temporary variable for saving (replaces any previous device for this type)
      if (!window.selectedBluetoothDevices) window.selectedBluetoothDevices = {};
      window.selectedBluetoothDevices[type] = device.name;
      
      console.log('[admin-printer.js] Temporary device selection updated:', window.selectedBluetoothDevices);
      
      // Initialize persistent session with the selected device
      // This will keep connection open for continuous printing
      const sessionReady = await initializeBluetoothSession(device, type.toUpperCase());
      if (!sessionReady) {
        // Session initialization failed, keep device name but session not active
        console.warn('[admin-printer.js] Session init failed, will use on-demand connection');
      }
    }
  } catch (err) {
    if (err.name === 'NotFoundError') {
      console.log('[admin-printer.js] Bluetooth device selection cancelled by user');
    } else if (err.name === 'SecurityError') {
      console.error('[admin-printer.js] Bluetooth security error:', err);
    } else {
      console.error('[admin-printer.js] Bluetooth scan error:', err);
    }
  }
}

/**
 * Initialize Bluetooth session - establish persistent connection after device selection
 * This keeps the device connected for continuous printing without additional prompts
 */
async function initializeBluetoothSession(device, printerType) {
  try {
    if (!window.bluetoothSessions) window.bluetoothSessions = {};
    
    // Initialize session object with uppercase type key
    window.bluetoothSessions[printerType.toUpperCase()] = {
      device: device,
      server: null,
      service: null,
      characteristic: null,
      connected: false,
      lastUsed: Date.now()
    };

    console.log('[admin-printer.js] Connecting to device for session:', device.name);

    // Connect to GATT
    const server = await device.gatt.connect();
    window.bluetoothSessions[printerType].server = server;
    window.bluetoothSessions[printerType].connected = true;

    console.log('[admin-printer.js] GATT connected for session');

    // Get service - try known printer service UUIDs first
    let service;
    const knownUUIDs = [
      '49535343-fe7d-4ae5-8fa9-9fafd205e455',  // MPT-2/3 series
      '0000ffe0-0000-1000-8000-00805f9b34fb',  // Common BLE UART
      '0000fff0-0000-1000-8000-00805f9b34fb'   // Alternative BLE UART
    ];

    for (const uuid of knownUUIDs) {
      try {
        service = await server.getPrimaryService(uuid);
        console.log('[admin-printer.js] Found printer service with UUID:', uuid);
        break;
      } catch (e) {
        // Try next UUID
      }
    }

    // Fallback: if none of the known UUIDs work, get all services and find one with a writable characteristic
    if (!service) {
      console.log('[admin-printer.js] Known UUIDs not found, scanning for any service with writable characteristic...');
      const services = await server.getPrimaryServices();
      
      for (const svc of services) {
        try {
          const characteristics = await svc.getCharacteristics();
          const writable = characteristics.find(c => c.properties.writeWithoutResponse || c.properties.write);
          if (writable) {
            service = svc;
            console.log('[admin-printer.js] Found service with writable characteristic:', svc.uuid);
            break;
          }
        } catch (e) {
          // Continue to next service
        }
      }
    }

    if (!service) {
      throw new Error('Could not find any printer service on this device');
    }

    window.bluetoothSessions[printerType].service = service;

    // Get writable characteristic
    const characteristics = await service.getCharacteristics();
    const writableChar = characteristics.find(c => 
      c.properties.writeWithoutResponse || c.properties.write
    );

    if (!writableChar) {
      throw new Error('No writable characteristic found in service');
    }

    window.bluetoothSessions[printerType].characteristic = writableChar;

    // Register device and service UUID in database
    try {
      const restaurantId = localStorage.getItem('restaurantId');
      if (restaurantId) {
        const registerResponse = await fetch(
          `/api/restaurants/${restaurantId}/register-bluetooth-device`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              printerType: printerType.toUpperCase(),
              deviceId: device.id,
              deviceName: device.name,
              serviceUuid: service.uuid
            })
          }
        );
        if (registerResponse.ok) {
          console.log('[admin-printer.js] Device registered in database:', device.name, service.uuid);
        } else {
          console.warn('[admin-printer.js] Failed to register device in database');
        }
      }
    } catch (e) {
      console.warn('[admin-printer.js] Error registering device:', e.message);
    }

    // Send PIN
    const pinBytes = [48, 48, 48, 48, 13, 10]; // "0000\r\n"
    try {
      if (writableChar.properties.writeWithoutResponse) {
        await writableChar.writeValue(new Uint8Array(pinBytes));
      } else {
        await writableChar.writeValue(new Uint8Array(pinBytes));
      }
      await new Promise(resolve => setTimeout(resolve, 1500));
    } catch (e) {
      console.warn('[admin-printer.js] PIN auth warning:', e.message);
    }

    // Initialize printer
    const initCommands = [
      0x10, 0x04,
      0x1B, 0x40,
      0x1B, 0x33, 0x1E,
      0x1B, 0x4D, 0x00,
      0x1B, 0x61, 0x01
    ];

    try {
      if (writableChar.properties.writeWithoutResponse) {
        await writableChar.writeValue(new Uint8Array(initCommands));
      } else {
        await writableChar.writeValue(new Uint8Array(initCommands));
      }
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (e) {
      console.warn('[admin-printer.js] Printer init warning:', e.message);
    }

    console.log('[admin-printer.js] Bluetooth session ready for', printerType, 'on device:', device.name);
    displayBluetoothSessionStatus(printerType, device.name);
    
    return true;
  } catch (err) {
    console.error('[admin-printer.js] Failed to initialize session:', err);
    alert(`Failed to establish session with ${device.name}: ${err.message}`);
    if (window.bluetoothSessions && window.bluetoothSessions[printerType]) {
      delete window.bluetoothSessions[printerType];
    }
    return false;
  }
}

/**
 * Display Bluetooth session status in UI
 */
function displayBluetoothSessionStatus(printerType, deviceName) {
  // Update status in printer card
  const statusElement = document.getElementById(`bluetooth-session-status-${printerType}`);
  if (statusElement) {
    statusElement.innerHTML = `
      <div style="margin-top: 10px; padding: 10px; background-color: #d4edda; border: 1px solid #c3e6cb; border-radius: 4px; color: #155724;">
        <strong>Session Active</strong><br>
        Connected to: ${deviceName}<br>
        <small>Continuous printing enabled</small>
      </div>
    `;
  }
}

/**
 * Close Bluetooth session when switching devices or settings
 */
async function closeBluetoothSession(printerType) {
  if (!window.bluetoothSessions || !window.bluetoothSessions[printerType]) {
    return;
  }

  try {
    const session = window.bluetoothSessions[printerType];
    if (session.device && session.device.gatt) {
      await session.device.gatt.disconnect();
      console.log('[admin-printer.js] Disconnected session for:', printerType);
    }
    delete window.bluetoothSessions[printerType];
  } catch (e) {
    console.warn('[admin-printer.js] Error closing session:', e);
  }
}

/**
 * Save printer configuration for the currently editing printer type
 */
async function savePrinterConfig(printerType) {
  try {
    if (!printerType) {
      alert("No printer type selected");
      return;
    }
    
    const restaurantId = localStorage.getItem("restaurantId");
    if (!restaurantId) {
      alert("Restaurant ID not found");
      return;
    }

    const printerTypeSelect = document.getElementById(`printer-type-select-${printerType}`);
    const printerHostInput = document.getElementById(`printer-host-${printerType}`);
    
    if (!printerTypeSelect) {
      alert("Printer type selector not found");
      return;
    }
    
    const selectedType = printerTypeSelect.value;
    
    // For Bluetooth: check if session is active, store device name from session
    let bluetoothDevice = null;
    if (selectedType === 'bluetooth') {
      if (window.bluetoothSessions && window.bluetoothSessions[printerType] && 
          window.bluetoothSessions[printerType].device) {
        bluetoothDevice = window.bluetoothSessions[printerType].device.name;
      } else if (window.selectedBluetoothDevices && window.selectedBluetoothDevices[printerType]) {
        bluetoothDevice = window.selectedBluetoothDevices[printerType];
      } else {
        alert('Please select a Bluetooth device first using "Scan Devices"');
        return;
      }
    }
    
    // Use new unified printers table schema
    const settings = {
      type: printerType.toUpperCase(),  // 'QR', 'BILL', 'KITCHEN'
      printer_type: selectedType,
      printer_host: selectedType === 'network' && printerHostInput ? printerHostInput.value : null,
      printer_port: selectedType === 'network' ? 9100 : null,
      bluetooth_device_name: bluetoothDevice,  // Device name from session or scan
      bluetooth_device_id: null,  // Will be populated on next connection
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

    const result = await response.json();
    window.currentPrinterSettings = result;
    updateStatusCards();
    alert("Printer settings saved successfully!");
  } catch (err) {
    console.error("[admin-printer.js] Failed to save printer settings:", err);
    alert("Failed to save printer settings: " + err.message);
  }
}

/**
 * Save QR Code Printer Configuration (Format + Printer Type in one button)
 */
async function saveQRPrinterConfiguration() {
  try {
    const restaurantId = localStorage.getItem('restaurantId');
    if (!restaurantId) {
      alert('Restaurant ID not found');
      return;
    }

    // Get format settings
    const qrSize = getCurrentQRSize();
    const qrTextAbove = document.getElementById('qr-text-above').value || 'Scan to Order';
    const qrTextBelow = document.getElementById('qr-text-below').value || 'Let us know how we did!';
    
    // Get printer config
    const printerTypeSelect = document.getElementById('printer-type-select-qr');
    let qrPrinterType = printerTypeSelect ? printerTypeSelect.value : window.currentPrinterSettings?.qr_printer_type || 'none';
    const printerHostInput = document.getElementById('printer-host-qr');
    const qrPrinterHost = qrPrinterType === 'network' && printerHostInput ? printerHostInput.value : null;
    const qrBluetoothDevice = (window.selectedBluetoothDevices && window.selectedBluetoothDevices.qr) || window.currentPrinterSettings?.qr_bluetooth_device || null;

    // FIX: If a Bluetooth device is selected but printer type is 'none', force it to 'bluetooth'
    if (qrBluetoothDevice && qrPrinterType === 'none') {
      qrPrinterType = 'bluetooth';
      console.log('[admin-printer.js] Auto-changed printer type to bluetooth since device is selected');
    }

    // Build settings JSON
    const settings = {
      code_size: qrSize,
      text_above: qrTextAbove,
      text_below: qrTextBelow,
      auto_print: document.getElementById('qr-auto-print')?.checked ?? (window.currentPrinterSettings?.qr_auto_print || false)
    };

    // New unified printers table format
    const payload = {
      type: 'QR',  // Printer type (QR, Bill, Kitchen)
      printer_type: qrPrinterType,
      printer_host: qrPrinterHost,
      printer_port: 9100,
      bluetooth_device_id: qrBluetoothDevice || null,
      bluetooth_device_name: qrBluetoothDevice || null,
      settings
    };

    console.log('[admin-printer.js] saveQRPrinterConfiguration:', payload);

    const response = await fetch(
      `${API}/restaurants/${restaurantId}/printer-settings`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to save QR printer configuration');
    }

    const result = await response.json();
    console.log('[admin-printer.js] QR save response:', result);
    
    // Update local settings from response
    const prefix = 'qr_';
    window.currentPrinterSettings[`${prefix}printer_type`] = result.printer_type;
    window.currentPrinterSettings[`${prefix}printer_host`] = result.printer_host;
    window.currentPrinterSettings[`${prefix}bluetooth_device_id`] = result.bluetooth_device_id;
    window.currentPrinterSettings[`${prefix}bluetooth_device_name`] = result.bluetooth_device_name;
    window.currentPrinterSettings[`${prefix}bluetooth_device`] = result.bluetooth_device_name || result.bluetooth_device_id;
    
    if (result.settings) {
      Object.entries(result.settings).forEach(([key, value]) => {
        window.currentPrinterSettings[`${prefix}${key}`] = value;
      });
    }
    
    // Update device memory
    if (!window.selectedBluetoothDevices) window.selectedBluetoothDevices = {};
    if (result.bluetooth_device_id || result.bluetooth_device_name) {
      window.selectedBluetoothDevices.qr = result.bluetooth_device_name || result.bluetooth_device_id;
    }
    
    updateStatusCards();
    alert('QR Code Printer saved successfully!');
    backToSelection();
  } catch (err) {
    console.error('[admin-printer.js] Failed to save QR printer configuration:', err);
    alert('Failed to save: ' + err.message);
  }
}

/**
 * Save Bill Receipt Printer Configuration (Format + Printer Type in one button)
 */
async function saveBillPrinterConfiguration() {
  try {
    const restaurantId = localStorage.getItem('restaurantId');
    if (!restaurantId) {
      alert('Restaurant ID not found');
      return;
    }

    // Get format settings
    const billFontSize = getCurrentBillFontSize();
    const billHeaderText = document.getElementById('bill-header-text').value || 'Thank You';
    const billFooterText = document.getElementById('bill-footer-text').value || 'Follow us on social media';
    
    // Get printer config
    const printerTypeSelect = document.getElementById('printer-type-select-bill');
    let billPrinterType = printerTypeSelect ? printerTypeSelect.value : window.currentPrinterSettings?.bill_printer_type || 'none';
    const printerHostInput = document.getElementById('printer-host-bill');
    const billPrinterHost = billPrinterType === 'network' && printerHostInput ? printerHostInput.value : null;
    const billBluetoothDevice = (window.selectedBluetoothDevices && window.selectedBluetoothDevices.bill) || window.currentPrinterSettings?.bill_bluetooth_device || null;

    // FIX: If a Bluetooth device is selected but printer type is 'none', force it to 'bluetooth'
    if (billBluetoothDevice && billPrinterType === 'none') {
      billPrinterType = 'bluetooth';
      console.log('[admin-printer.js] Auto-changed printer type to bluetooth since device is selected');
    }

    // Build settings JSON
    const settings = {
      font_size: billFontSize,
      header_text: billHeaderText,
      footer_text: billFooterText,
      auto_print: document.getElementById('bill-auto-print')?.checked ?? (window.currentPrinterSettings?.bill_auto_print || false)
    };

    // New unified printers table format
    const payload = {
      type: 'Bill',  // Printer type (QR, Bill, Kitchen)
      printer_type: billPrinterType,
      printer_host: billPrinterHost,
      printer_port: 9100,
      bluetooth_device_id: billBluetoothDevice || null,
      bluetooth_device_name: billBluetoothDevice || null,
      settings
    };

    console.log('[admin-printer.js] saveBillPrinterConfiguration:', payload);

    const response = await fetch(
      `${API}/restaurants/${restaurantId}/printer-settings`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to save bill printer configuration');
    }

    const result = await response.json();
    console.log('[admin-printer.js] Bill save response:', result);
    
    // Update local settings from response
    const prefix = 'bill_';
    window.currentPrinterSettings[`${prefix}printer_type`] = result.printer_type;
    window.currentPrinterSettings[`${prefix}printer_host`] = result.printer_host;
    window.currentPrinterSettings[`${prefix}bluetooth_device_id`] = result.bluetooth_device_id;
    window.currentPrinterSettings[`${prefix}bluetooth_device_name`] = result.bluetooth_device_name;
    window.currentPrinterSettings[`${prefix}bluetooth_device`] = result.bluetooth_device_name || result.bluetooth_device_id;
    
    if (result.settings) {
      Object.entries(result.settings).forEach(([key, value]) => {
        window.currentPrinterSettings[`${prefix}${key}`] = value;
      });
    }
    
    // Update device memory
    if (!window.selectedBluetoothDevices) window.selectedBluetoothDevices = {};
    if (result.bluetooth_device_id || result.bluetooth_device_name) {
      window.selectedBluetoothDevices.bill = result.bluetooth_device_name || result.bluetooth_device_id;
    }
    
    updateStatusCards();
    alert('Bill Receipt Printer saved successfully!');
    backToSelection();
  } catch (err) {
    console.error('[admin-printer.js] Failed to save bill printer configuration:', err);
    alert('Failed to save: ' + err.message);
  }
}

/**
 * Save Kitchen Order Printer Configuration (Multi-Printer with Category Routing)
 */
async function saveKitchenPrinterConfiguration() {
  try {
    const restaurantId = localStorage.getItem('restaurantId');
    if (!restaurantId) {
      alert('Restaurant ID not found');
      return;
    }

    // Validate that at least one printer exists and each has categories selected
    if (!window.kitchenPrinters || window.kitchenPrinters.length === 0) {
      alert('Please add at least one printer');
      return;
    }

    for (const printer of window.kitchenPrinters) {
      if (!printer.categories || printer.categories.length === 0) {
        alert(`Printer "${printer.name}" must have at least one category assigned`);
        return;
      }
    }

    // Prepare printer data for storage in settings
    const printersToSave = window.kitchenPrinters.map(printer => ({
      id: printer.id,
      name: printer.name,
      type: printer.type,
      host: printer.type === 'network' ? printer.host : null,
      bluetoothDevice: printer.type === 'bluetooth' ? printer.bluetoothDevice : null,
      categories: printer.categories.map(c => Number(c))
    }));

    console.log('[admin-printer.js] Saving kitchen printers:', printersToSave);

    // Store the array of kitchen printers in the settings JSON field
    // Kitchen type in printers table stores: { printers: [...], auto_print: ... }
    const payload = {
      type: 'Kitchen',
      printer_type: 'none',  // Multi-printer config indicated by presence of printers array in settings
      settings: {
        printers: printersToSave,
        auto_print: false
      }
    };

    console.log('[admin-printer.js] saveKitchenPrinterConfiguration payload:', payload);

    const response = await fetch(
      `${API}/restaurants/${restaurantId}/printer-settings`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to save kitchen printer configuration');
    }

    const result = await response.json();
    console.log('[admin-printer.js] Kitchen save response:', result);
    
    // Update local settings from response
    window.currentPrinterSettings.kitchen_printer_type = result.printer_type;
    
    if (result.settings) {
      window.currentPrinterSettings.kitchen_printers = result.settings.printers || [];
      console.log('[admin-printer.js] Updated kitchen_printers:', window.currentPrinterSettings.kitchen_printers);
    }
    
    updateStatusCards();
    alert('Kitchen Printers saved successfully!');
    backToSelection();
  } catch (err) {
    console.error('[admin-printer.js] Failed to save kitchen printer configuration:', err);
    alert('Failed to save: ' + err.message);
  }
}

/**
 * Load KPay Receipt Format UI with saved settings
 */
function loadKPayFormatUI() {
  const settings = window.currentPrinterSettings || {};

  // Auto-print toggle
  const autoPrintCheckbox = document.getElementById('kpay-auto-print');
  if (autoPrintCheckbox) autoPrintCheckbox.checked = settings.kpay_auto_print || false;

  // Printer type selector (static HTML in kpay-format-section)
  const printerTypeSelect = document.getElementById('printer-type-select-kpay');
  if (printerTypeSelect) {
    printerTypeSelect.value = settings.kpay_printer_type || 'none';
    updatePrinterTypeSelection('kpay');
  }

  // If there is an active bluetooth session for kpay, show status
  if (window.bluetoothSessions && window.bluetoothSessions['KPAY']) {
    const session = window.bluetoothSessions['KPAY'];
    if (session.connected && session.device) {
      if (typeof displayBluetoothSessionStatus === 'function') {
        displayBluetoothSessionStatus('kpay', session.device.name);
      }
    }
  }

  // Update preview restaurant name from cache
  const restaurantNameEl = document.getElementById('kpay-preview-restaurant-name');
  if (restaurantNameEl && window.ADMIN_SETTINGS_CACHE?.name) {
    restaurantNameEl.textContent = window.ADMIN_SETTINGS_CACHE.name;
  }

  // Update preview date
  const previewDateEl = document.getElementById('kpay-preview-date');
  if (previewDateEl) previewDateEl.textContent = new Date().toLocaleString();
}

/**
 * Called when auto-print toggle is changed - updates local state without saving
 */
function onKPayAutoPrintToggle() {
  if (!window.currentPrinterSettings) window.currentPrinterSettings = {};
  const checkbox = document.getElementById('kpay-auto-print');
  window.currentPrinterSettings.kpay_auto_print = checkbox ? checkbox.checked : false;
}

/**
 * Save KPay Printer Configuration
 */
async function saveKPayPrinterConfiguration() {
  try {
    const restaurantId = localStorage.getItem('restaurantId');
    if (!restaurantId) {
      alert('Restaurant ID not found');
      return;
    }

    const autoPrint = document.getElementById('kpay-auto-print')?.checked || false;

    // Get printer config from config card
    const printerTypeSelect = document.getElementById('printer-type-select-kpay');
    let kpayPrinterType = printerTypeSelect ? printerTypeSelect.value : window.currentPrinterSettings?.kpay_printer_type || 'none';
    const printerHostInput = document.getElementById('printer-host-kpay');
    const kpayPrinterHost = kpayPrinterType === 'network' && printerHostInput ? printerHostInput.value : null;
    const kpayBluetoothDevice = (window.selectedBluetoothDevices && window.selectedBluetoothDevices.kpay) || window.currentPrinterSettings?.kpay_bluetooth_device || null;

    if (kpayBluetoothDevice && kpayPrinterType === 'none') {
      kpayPrinterType = 'bluetooth';
    }

    const settings = { auto_print: autoPrint };

    const payload = {
      type: 'KPAY',
      printer_type: kpayPrinterType,
      printer_host: kpayPrinterHost,
      printer_port: 9100,
      bluetooth_device_id: kpayBluetoothDevice || null,
      bluetooth_device_name: kpayBluetoothDevice || null,
      settings,
    };

    console.log('[admin-printer.js] saveKPayPrinterConfiguration:', payload);

    const response = await fetch(
      `${API}/restaurants/${restaurantId}/printer-settings`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to save KPay printer configuration');
    }

    const result = await response.json();
    console.log('[admin-printer.js] KPay save response:', result);

    const prefix = 'kpay_';
    window.currentPrinterSettings[`${prefix}printer_type`] = result.printer_type;
    window.currentPrinterSettings[`${prefix}printer_host`] = result.printer_host;
    window.currentPrinterSettings[`${prefix}bluetooth_device_id`] = result.bluetooth_device_id;
    window.currentPrinterSettings[`${prefix}bluetooth_device_name`] = result.bluetooth_device_name;
    window.currentPrinterSettings[`${prefix}bluetooth_device`] = result.bluetooth_device_name || result.bluetooth_device_id;
    window.currentPrinterSettings[`${prefix}auto_print`] = autoPrint;

    if (result.settings) {
      Object.entries(result.settings).forEach(([key, value]) => {
        window.currentPrinterSettings[`${prefix}${key}`] = value;
      });
    }

    if (!window.selectedBluetoothDevices) window.selectedBluetoothDevices = {};
    if (result.bluetooth_device_id || result.bluetooth_device_name) {
      window.selectedBluetoothDevices.kpay = result.bluetooth_device_name || result.bluetooth_device_id;
    }

    updateStatusCards();
    alert('KPay Receipt Printer saved successfully!');
    backToSelection();
  } catch (err) {
    console.error('[admin-printer.js] Failed to save KPay printer configuration:', err);
    alert('Failed to save: ' + err.message);
  }
}

/**
 * Test KPay receipt print
 */
async function testPrintKPayReceipt() {
  try {
    const restaurantId = localStorage.getItem('restaurantId');
    if (!restaurantId) {
      alert('Restaurant ID not found');
      return;
    }

    const response = await fetch(`${API}/restaurants/${restaurantId}/test-print-kpay-receipt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      throw new Error('Failed to generate KPay test print');
    }

    const data = await response.json();
    const escposArray = data.escposArray;

    // Send to connected KPay Bluetooth printer, or fall back to bill/qr printer
    const kpaySession = window.bluetoothSessions && window.bluetoothSessions.KPAY;
    const fallbackSession = window.bluetoothSessions && (window.bluetoothSessions.BILL || window.bluetoothSessions.QR);
    const session = (kpaySession && kpaySession.connected) ? kpaySession : (fallbackSession && fallbackSession.connected ? fallbackSession : null);

    if (session && session.connected) {
      const payload = {
        type: 'kpay',
        data: { escposArray, escposBase64: data.escposBase64 }
      };
      const success = await window.handleBluetoothPrint(payload);
      if (success) {
        alert('KPay receipt test print sent!');
      } else {
        alert('Failed to send KPay test print');
      }
    } else {
      alert('No Bluetooth printer connected. Please connect a printer first.');
    }
  } catch (err) {
    console.error('[admin-printer.js] Failed to test print KPay receipt:', err);
    alert('KPay test print failed: ' + err.message);
  }
}

/**
 * Load and display current printer settings for all printer types
 */
async function loadPrinterSettings() {
  try {
    const restaurantId = localStorage.getItem("restaurantId");
    if (!restaurantId) {
      console.warn("[admin-printer.js] No restaurantId found");
      return;
    }

    console.log('[admin-printer.js] Fetching printer settings from API...');
    const response = await fetch(
      `${API}/restaurants/${restaurantId}/printer-settings`
    );

    if (!response.ok) {
      console.warn("[admin-printer.js] No printer settings found, using defaults");
      window.currentPrinterSettings = {
        qr_printer_type: 'none',
        bill_printer_type: 'none',
        kitchen_printer_type: 'none',
      };
      updateStatusCards();
      return;
    }

    let apiData = await response.json();
    console.log('[admin-printer.js] Raw API Response:', apiData);
    
    // API now returns array of printers from unified printers table
    if (Array.isArray(apiData)) {
      console.log('[admin-printer.js] Received array of printers from new printers table');
      
      // Convert array format to flat object format for backward compatibility
      window.currentPrinterSettings = {};
      
      apiData.forEach(printer => {
        const prefix = printer.type.toLowerCase() + '_';
        
        console.log(`[admin-printer.js] Converting printer type: "${printer.type}" → prefix: "${prefix}"`, {
          type: printer.type,
          printer_type: printer.printer_type,
          printer_host: printer.printer_host,
          bluetooth_device_id: printer.bluetooth_device_id,
          bluetooth_device_name: printer.bluetooth_device_name
        });
        
        // Special handling for Kitchen printers - they use multi-printer system in settings
        if (printer.type.toLowerCase() === 'kitchen') {
          window.currentPrinterSettings[`${prefix}printer_type`] = printer.printer_type || 'none';
          
          // Load the array of kitchen printers from settings
          if (printer.settings && Array.isArray(printer.settings.printers)) {
            window.currentPrinterSettings.kitchen_printers = printer.settings.printers;
            console.log('[admin-printer.js] Loaded kitchen_printers array from settings:', printer.settings.printers);
          } else {
            window.currentPrinterSettings.kitchen_printers = [];
          }
          
          // Extract other settings
          if (printer.settings) {
            Object.entries(printer.settings).forEach(([key, value]) => {
              if (key !== 'printers') { // Skip the printers array, we already handled it
                window.currentPrinterSettings[`${prefix}${key}`] = value;
              }
            });
          }
        } else {
          // For QR and Bill, use the standard format
          window.currentPrinterSettings[`${prefix}printer_type`] = printer.printer_type || 'none';
          window.currentPrinterSettings[`${prefix}printer_host`] = printer.printer_host;
          window.currentPrinterSettings[`${prefix}printer_port`] = printer.printer_port;
          window.currentPrinterSettings[`${prefix}bluetooth_device_id`] = printer.bluetooth_device_id;
          window.currentPrinterSettings[`${prefix}bluetooth_device_name`] = printer.bluetooth_device_name;
          window.currentPrinterSettings[`${prefix}bluetooth_device`] = printer.bluetooth_device_name || printer.bluetooth_device_id;
          
          // Extract settings from JSON
          if (printer.settings) {
            Object.entries(printer.settings).forEach(([key, value]) => {
              window.currentPrinterSettings[`${prefix}${key}`] = value;
            });
          }
        }
      });
      
      console.log('[admin-printer.js] Converted to flat format:', window.currentPrinterSettings);
    } else {
      // Old format fallback (for backward compatibility with old schema)
      console.log('[admin-printer.js] Received old format, converting...');
      window.currentPrinterSettings = apiData;
    }
    
    // Initialize selectedBluetoothDevices with any saved devices from DATABASE
    if (!window.selectedBluetoothDevices) window.selectedBluetoothDevices = {};
    
    // Load devices from database
    if (window.currentPrinterSettings.qr_bluetooth_device) {
      window.selectedBluetoothDevices.qr = window.currentPrinterSettings.qr_bluetooth_device;
      console.log('[admin-printer.js] ✓ QR device loaded from DB:', window.currentPrinterSettings.qr_bluetooth_device);
    }
    
    if (window.currentPrinterSettings.bill_bluetooth_device) {
      window.selectedBluetoothDevices.bill = window.currentPrinterSettings.bill_bluetooth_device;
      console.log('[admin-printer.js] ✓ Bill device loaded from DB:', window.currentPrinterSettings.bill_bluetooth_device);
    }
    
    if (window.currentPrinterSettings.kitchen_bluetooth_device) {
      window.selectedBluetoothDevices.kitchen = window.currentPrinterSettings.kitchen_bluetooth_device;
      console.log('[admin-printer.js] ✓ Kitchen device loaded from DB:', window.currentPrinterSettings.kitchen_bluetooth_device);
    }

    if (window.currentPrinterSettings.kpay_bluetooth_device) {
      window.selectedBluetoothDevices.kpay = window.currentPrinterSettings.kpay_bluetooth_device;
      console.log('[admin-printer.js] ✓ KPay device loaded from DB:', window.currentPrinterSettings.kpay_bluetooth_device);
    }
    
    // Ensure all defaults are set
    if (!window.currentPrinterSettings.qr_printer_type) window.currentPrinterSettings.qr_printer_type = 'none';
    if (!window.currentPrinterSettings.bill_printer_type) window.currentPrinterSettings.bill_printer_type = 'none';
    if (!window.currentPrinterSettings.kitchen_printer_type) window.currentPrinterSettings.kitchen_printer_type = 'none';
    if (!window.currentPrinterSettings.kpay_printer_type) window.currentPrinterSettings.kpay_printer_type = 'none';
    
    updateStatusCards();
    window.currentPrinterSettings = window.currentPrinterSettings;
    console.log('[admin-printer.js] Printer settings loaded successfully');
  } catch (err) {
    console.error('[admin-printer.js] Failed to load printer settings:', err);
    window.currentPrinterSettings = {
      qr_printer_type: 'none',
      bill_printer_type: 'none',
      kitchen_printer_type: 'none',
    };
    window.currentPrinterSettings = window.currentPrinterSettings;
    updateStatusCards();
  }
}

// Initialize when module loads
console.log('[admin-printer.js] Module loaded, ready to initialize');

/**
 * Test print Kitchen order to connected Bluetooth printer
 */
async function testPrintKitchenOrder() {
  try {
    if (!window.bluetoothSessions || !window.bluetoothSessions.KITCHEN || !window.bluetoothSessions.KITCHEN.connected) {
      alert('No Bluetooth printer connected. Please initialize the kitchen printer session first.');
      return;
    }

    // Generate sample kitchen order for testing
    const sampleOrder = {
      order_id: 'TEST-001',
      table_name: 'Test Table',
      items_display: 'Grilled Fish (qty: 2), Rice (qty: 1)',
      items: [
        { id: 1, name: 'Grilled Fish', quantity: 2 },
        { id: 2, name: 'Rice', quantity: 1 }
      ]
    };

    console.log('[admin-printer.js] Sending kitchen test print to connected Bluetooth printer');
    const payload = {
      printerConfig: {
        bluetoothDeviceName: window.bluetoothSessions.KITCHEN.device.name,
      },
      data: {
        type: 'order',
        orderNumber: sampleOrder.order_id,
        tableNumber: sampleOrder.table_name,
        items: sampleOrder.items,
        timestamp: new Date().toLocaleTimeString(),
        restaurantName: 'Your Restaurant'
      }
    };
    
    const success = await window.handleBluetoothPrint(payload);
    if (success) {
      alert('Kitchen test print sent to printer!');
    } else {
      alert('Failed to send kitchen test print');
    }
  } catch (err) {
    console.error('[admin-printer.js] Failed to test print kitchen:', err);
    alert('Kitchen test print failed: ' + err.message);
  }
}
