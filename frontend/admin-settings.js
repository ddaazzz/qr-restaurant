// ============= SETTINGS MANAGEMENT =============

console.log('[admin-settings.js] Module loading...');

// Initialization gate
let settingsInitialized = false;

let ADMIN_SETTINGS_CACHE = {};
let SETTINGS_EDIT_MODE = {};
let STAGED_LOGO = null;
let EDITING_COUPON_ID = null;

// Setup button listeners when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupPaymentTestButton);
} else {
  setupPaymentTestButton();
}

function setupPaymentTestButton() {
  console.log('[admin-settings.js] Setting up payment test button listener');
  const btn = document.querySelector('button[onclick="testPaymentTerminal()"]');
  if (btn) {
    console.log('[admin-settings.js] Found test button, attaching listener');
    btn.addEventListener('click', function(e) {
      console.log('[BUTTON ONCLICK] Test connection button clicked');
      e.preventDefault();
      testPaymentTerminal();
    });
  } else {
    console.log('[admin-settings.js] Test button not found yet');
  }
}

// ========== INITIALIZE SETTINGS ==========
async function initializeSettings() {
  // Always load and cache settings when section is switched to
  try {
    const res = await fetch(`${API}/restaurants/${restaurantId}/settings`);
    if (res.ok) {
      ADMIN_SETTINGS_CACHE = await res.json();
      applyThemeColor(ADMIN_SETTINGS_CACHE.theme_color);
    }
  } catch (err) {
    console.error("Failed to initialize settings:", err);
  }
  
  // Attach event listeners only once
  if (!settingsInitialized) {
    settingsInitialized = true;
    attachEventListeners();
  }
}

// ========== ATTACH EVENT LISTENERS ==========
function attachEventListeners() {
  // Currently no module-specific event listeners for settings
  // This function is placeholder for consistency with other modules
}

// Load and render settings (stub - modals are used now)
async function loadAdminSettings() {
  // This function is kept for backward compatibility
  // Modals are initialized when opened via openSettingsModal()
}

// Fetch and cache settings (called from admin.js)
async function initializeSettingsOnPageLoad() {
  try {
    const res = await fetch(`${API}/restaurants/${restaurantId}/settings`);
    const settings = await res.json();
    ADMIN_SETTINGS_CACHE = { ...settings };
    
    if (typeof serviceChargeFee !== 'undefined') {
      serviceChargeFee = settings.service_charge_percent;
    }
    applyThemeColor(settings.theme_color);
    
    // Apply language preference if stored in backend
    if (settings.language_preference) {
      console.log('[Settings] Applying restaurant language preference:', settings.language_preference);
      localStorage.setItem('restaurantLanguage', settings.language_preference);
      if (typeof setLanguage === 'function') {
        setLanguage(settings.language_preference);
      }
    }

    // Show/hide Service Requests card based on feature flag
    const srCard = document.getElementById('service-requests-card');
    if (srCard) {
      const featureFlags = settings.feature_flags || {};
      srCard.style.display = featureFlags.service_requests ? '' : 'none';
    }
  } catch (err) {
    console.error("Failed to initialize settings on page load:", err);
  }
}

function applyThemeColor(color) {
  if (!color) return;
  document.documentElement.style.setProperty("--primary-color", color);
}

// Save language preference (called when language buttons are clicked)
function saveLanguagePreference(language) {
  try {
    // Always save to localStorage first
    localStorage.setItem('language', language);
    localStorage.setItem('restaurantLanguage', language);
    console.log('[Settings] Language preference saved locally:', language);
    
    // Try to save to backend (optional - graceful fallback if fails)
    fetch(`${API}/restaurants/${restaurantId}/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language_preference: language })
    }).then(res => {
      if (res.ok) {
        return res.json();
      } else {
        console.warn('[Settings] Backend language save failed (code ' + res.status + ') - local setting preserved');
      }
    }).then(updated => {
      if (updated) {
        console.log('[Settings] Language preference saved to backend:', language);
        ADMIN_SETTINGS_CACHE = { ...ADMIN_SETTINGS_CACHE, ...updated };
      }
    }).catch(err => {
      console.warn('[Settings] Backend language save error (graceful fallback):', err.message);
    });
  } catch (err) {
    console.error('Failed to save language preference:', err);
  }
}

// Load coupons (stub - modals load coupons when opened)
async function loadCoupons() {
  // This function is kept for backward compatibility
  // Coupons are loaded in loadCouponsModal() when the modal is opened
}

// ============= MODAL MANAGEMENT =============
async function openSettingsModal(modalName) {
  const modal = document.getElementById(`modal-${modalName}`);
  if (modal) {
    modal.classList.remove('hidden');
    
    // Initialize modal content based on type
    switch(modalName) {
      case 'restaurant-info':
        await loadRestaurantInfoModal();
        break;
      case 'printer-settings':
        await loadPrinterSettings();
        break;
      case 'staff-login-links':
        await loadStaffLoginLinksModal();
        break;
      case 'qr-settings':
        await loadQRSettingsModal();
        break;
      case 'coupons':
        await loadCouponsModal();
        break;
      case 'payment-terminals':
        await loadPaymentTerminals();
        break;
      case 'booking-settings':
        await loadBookingSettingsModal();
        break;
      case 'addon-presets':
        await loadAddonPresets();
        break;
      case 'variant-presets':
        await loadVariantPresets();
        break;
    }
  }
}

function closeSettingsModal(modalName) {
  // Redirect to page-based hiding
  hideSettingsPage(modalName);
}

// ============= SETTINGS PAGE MANAGEMENT =============
async function showSettingsPage(pageName) {
  // Hide the settings cards grid
  const grid = document.querySelector('.settings-cards-grid');
  if (grid) grid.style.display = 'none';

  // Hide edit-settings-header button while in a subpage
  const editBtn = document.getElementById('edit-settings-header');
  if (editBtn) editBtn.style.display = 'none';

  // Show the settings page element
  const page = document.getElementById(`page-${pageName}`);
  if (page) {
    page.classList.remove('hidden');
    page.classList.add('active');

    // Load page data
    switch (pageName) {
      case 'restaurant-info':
        await loadRestaurantInfoModal();
        break;
      case 'staff-login-links':
        await loadStaffLoginLinksModal();
        break;
      case 'qr-settings':
        await loadQRSettingsModal();
        break;
      case 'coupons':
        await loadCouponsModal();
        break;
      case 'payment-terminals':
        await loadPaymentTerminals();
        break;
      case 'booking-settings':
        await loadBookingSettingsModal();
        break;
      case 'addon-presets':
        await loadAddonPresets();
        break;
      case 'variant-presets':
        await loadVariantPresets();
        break;
      case 'service-requests':
        await loadServiceRequestItems();
        await loadMenuSettingsPage(); // also loads custom_sr_items toggle
        break;
      case 'menu-settings':
        await loadMenuSettingsPage();
        break;
    }
  }
}

function hideSettingsPage(pageName) {
  // Hide the page
  const page = document.getElementById(`page-${pageName}`);
  if (page) {
    page.classList.add('hidden');
    page.classList.remove('active');
  }

  // Restore settings cards grid
  const grid = document.querySelector('.settings-cards-grid');
  if (grid) grid.style.display = '';

  // Restore edit-settings-header button
  const editBtn = document.getElementById('edit-settings-header');
  if (editBtn) editBtn.style.display = '';
}

// ============= PRINTER SETTINGS PAGE MANAGEMENT =============
async function showPrinterSettings() {
  // Hide settings grid
  const settingsGrid = document.querySelector('.settings-cards-grid');
  if (settingsGrid) {
    settingsGrid.style.display = 'none';
  }

  // Get the container slot
  const containerSlot = document.getElementById('printer-settings-container-slot');
  if (!containerSlot) {
    console.error('[admin-settings.js] Printer settings container slot not found');
    alert('Printer settings container not found');
    return;
  }
  
  // Show the container
  containerSlot.style.display = 'block';
  
  // Load printer HTML if not already loaded
  if (!containerSlot.hasChildNodes()) {
    try {
      console.log('[admin-settings.js] Loading printer HTML module');
      const response = await fetch('/admin-printer.html');
      const html = await response.text();
      containerSlot.innerHTML = html;
      console.log('[admin-settings.js] Printer HTML loaded');
      
      // Load printer CSS if not already loaded
      if (!document.getElementById('admin-printer-css')) {
        const link = document.createElement('link');
        link.id = 'admin-printer-css';
        link.rel = 'stylesheet';
        link.href = '/admin-printer.css';
        document.head.appendChild(link);
        console.log('[admin-settings.js] Printer CSS loaded');
      }
      
      // Load required JavaScript files for printer module
      if (!window.adminPrinterJSLoaded) {
        console.log('[admin-settings.js] Loading admin-printer.js');
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = '/admin-printer.js';
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
        window.adminPrinterJSLoaded = true;
        console.log('[admin-settings.js] admin-printer.js loaded');
      }
      
      if (!window.adminPrinterKitchenJSLoaded) {
        console.log('[admin-settings.js] Loading admin-printer-kitchen.js');
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = '/admin-printer-kitchen.js';
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
        window.adminPrinterKitchenJSLoaded = true;
        console.log('[admin-settings.js] admin-printer-kitchen.js loaded');
      }
      
      // Initialize printer settings module
      if (typeof initializePrinterSettings === 'function') {
        console.log('[admin-settings.js] Calling initializePrinterSettings()');
        await initializePrinterSettings();
      } else {
        console.error('[admin-settings.js] initializePrinterSettings function not found');
      }
      // Apply translations to dynamically loaded HTML
      if (typeof reTranslateContent === 'function') reTranslateContent();
    } catch (err) {
      console.error('[admin-settings.js] Failed to load printer settings module:', err);
      alert('Failed to load printer settings: ' + err.message);
    }
  } else {
    console.log('[admin-settings.js] Printer HTML already loaded, reinitializing');
    // Module already loaded, just reinitialize
    if (typeof initializePrinterSettings === 'function') {
      await initializePrinterSettings();
    }
    if (typeof reTranslateContent === 'function') reTranslateContent();
  }
}

function hidePrinterSettings() {
  console.log('[admin-settings.js] Hiding printer settings');
  // Hide printer settings container
  const containerSlot = document.getElementById('printer-settings-container-slot');
  if (containerSlot) {
    containerSlot.style.display = 'none';
  }

  // Show settings grid
  const settingsGrid = document.querySelector('.settings-cards-grid');
  if (settingsGrid) {
    settingsGrid.style.display = '';
  }
}

function switchTab(tabName, buttonElement) {
  // Hide all tabs
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.remove('active');
  });

  // Remove active class from buttons
  document.querySelectorAll('.tab-button').forEach(btn => {
    btn.classList.remove('active');
  });

  // Show selected tab - try printer page first, then modal
  let selectedTab = document.getElementById(`printer-page-tab-${tabName}`);
  if (!selectedTab) {
    selectedTab = document.getElementById(`tab-${tabName}`);
  }
  
  if (selectedTab) {
    selectedTab.classList.add('active');
  }

  // Mark button as active
  if (buttonElement && buttonElement.classList) {
    buttonElement.classList.add('active');
  }

  // Update preview when switching to QR Format tab
  if (tabName === 'qr-format') {
    setTimeout(() => {
      updateQRCodePreview();
      fetchRestaurantDataForQRFormat();
    }, 50);
  }

  // Update preview when switching to Bill Format tab
  if (tabName === 'bill-format') {
    setTimeout(() => {
      updateBillFormatPreview();
    }, 50);
  }
}

// ============= RESTAURANT DATA FETCHER =============
async function fetchRestaurantDataForQRFormat() {
  try {
    const res = await fetch(`${API}/restaurants/${restaurantId}/settings`);
    if (res.ok) {
      const data = await res.json();
      window.restaurantData = {
        name: data.name || 'Restaurant Name',
        phone: data.phone || '+1 (555) 123-4567',
        address: data.address || '123 Main Street, City, State 12345'
      };
    }
  } catch (err) {
    console.error('Error fetching restaurant data:', err);
    window.restaurantData = {
      name: 'Restaurant Name',
      phone: '+1 (555) 123-4567',
      address: '123 Main Street, City, State 12345'
    };
  }
}

// ============= QR CODE FORMAT PREVIEW =============
function updateQRCodePreview() {
  const qrSize = document.getElementById('qr-code-size')?.value || 'medium';
  const textAbove = document.getElementById('qr-text-above')?.value || 'Scan to Order';
  const textBelow = document.getElementById('qr-text-below')?.value || 'Let us know how we did!';
  
  const sizeMap = { small: '180px', medium: '220px', large: '260px' };
  const qrSizePixels = sizeMap[qrSize] || '220px';
  
  // Sample restaurant data
  const restaurantName = window.restaurantData?.name || 'La Cave (Sai Ying Pun)';
  const tableNumber = 'T02';
  const startTime = '2026-03-13 18:24:42';
  
  const divider = '-'.repeat(40);
  
  const preview = `
    <div style="font-weight: bold; font-size: 14px; margin-bottom: 4px;">${restaurantName}</div>
    <div style="font-size: 11px; margin-bottom: 2px;">Table: ${tableNumber}</div>
    <div style="font-size: 11px; margin-bottom: 8px;">Time: ${startTime}</div>
    <div style="font-size: 10px; margin: 8px 0; letter-spacing: 0.5px;">${divider}</div>
    
    <div style="margin: 12px 0;">
      <div style="width: ${qrSizePixels}; height: ${qrSizePixels}; margin: 0 auto; background: #f0f0f0; border: 1px solid #ccc; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #999;">QR Code</div>
    </div>
    
    <div style="font-weight: bold; font-size: 12px; margin: 10px 0;">${textAbove}</div>
    <div style="font-size: 11px; margin-bottom: 10px;">${textBelow}</div>
    <div style="font-size: 10px; margin-top: 8px; color: #666;">Powered by Chuio</div>
  `;
  
  const previewEl = document.getElementById('qr-preview');
  if (previewEl) {
    previewEl.innerHTML = preview;
  }
}

// ============= BILL FORMAT PREVIEW =============
function updateBillFormatPreview() {
  const paperWidth = document.getElementById('bill-format-paper-width')?.value || '80';
  const showPhone = document.getElementById('bill-format-show-phone')?.checked || false;
  const showAddress = document.getElementById('bill-format-show-address')?.checked || false;
  const showTime = document.getElementById('bill-format-show-time')?.checked || false;
  const showItems = document.getElementById('bill-format-show-items')?.checked || false;
  const showTotal = document.getElementById('bill-format-show-total')?.checked || false;
  const footerMsg = document.getElementById('bill-format-footer-msg')?.value || 'Thank you for your business!';
  
  // Set font sizes based on paper width
  const fontSizes = paperWidth === '58' 
    ? { header: '14px', details: '9px', footer: '8px', divider: '9px' }
    : { header: '18px', details: '11px', footer: '10px', divider: '11px' };
  
  // Get restaurant data
  const restaurantName = window.restaurantData?.name || 'Restaurant Name';
  const phone = window.restaurantData?.phone || '+1 (555) 123-4567';
  const address = window.restaurantData?.address || '123 Main Street, City, State 12345';
  
  // Divider lines that fit the page width (58mm ≈ 40 chars, 80mm ≈ 50 chars)
  const dividerLength = paperWidth === '58' ? 40 : 50;
  const divider = '='.repeat(dividerLength);
  const subDivider = '-'.repeat(dividerLength);
  
  let preview = `<strong style="font-size: ${fontSizes.header}; display: block; margin-bottom: 2px; text-align: center;">${restaurantName}</strong>`;
  
  if (showPhone) {
    preview += `<div style="font-size: ${fontSizes.details}; margin-bottom: 1px; text-align: center;">Phone: ${phone}</div>`;
  }
  
  if (showAddress) {
    preview += `<div style="font-size: ${fontSizes.details}; margin-bottom: 4px; text-align: center;">${address}</div>`;
  }
  
  preview += `<div style="font-size: ${fontSizes.divider}; margin: 4px 0; letter-spacing: 0.5px; text-align: center;">${divider}</div>`;
  
  if (showTime) {
    preview += `<div style="font-size: ${fontSizes.details}; margin: 2px 0; text-align: center;">Order Time: 2026-03-13 18:24:42</div>`;
  }
  
  // Table and PAX - left and right aligned
  preview += `
    <div style="font-size: ${fontSizes.details}; margin: 2px 0; display: flex; justify-content: space-between;">
      <span>Table: T02</span>
      <span>Pax: 4</span>
    </div>
  `;
  
  if (showItems) {
    preview += `
    <div style="font-size: ${fontSizes.divider}; margin: 4px 0; letter-spacing: 0.5px; text-align: center;">${subDivider}</div>
    <div style="font-size: ${fontSizes.details}; margin: 4px 0;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
        <span>1x Domaine Rolet, Chardonnay</span>
        <span>$450.0</span>
      </div>
      <div style="font-size: 8px; color: #666; margin-left: 10px; margin-bottom: 2px;">"L'Etoile", 2022</div>
    </div>
    <div style="font-size: ${fontSizes.divider}; margin: 4px 0; letter-spacing: 0.5px; text-align: center;">${subDivider}</div>
    `;
  }
  
  if (showTotal) {
    // Calculate avg per person: 450 / 4 = 112.5
    const total = 450.0;
    const pax = 4;
    const avgPerPerson = (total / pax).toFixed(2);
    
    preview += `
    <div style="font-size: ${fontSizes.details}; text-align: right; margin: 2px 0;">
      <div>Subtotal: $${total.toFixed(1)}</div>
      <div style="font-weight: bold; font-size: ${fontSizes.header}; margin: 2px 0;">Total: $${total.toFixed(1)}</div>
      <div>Avg Per Person: $${avgPerPerson}</div>
    </div>
    <div style="font-size: ${fontSizes.divider}; margin: 4px 0; letter-spacing: 0.5px; text-align: center;">${divider}</div>
    `;
  }
  
  preview += `<div style="font-weight: bold; font-size: ${fontSizes.details}; margin: 6px 0; text-align: center;">Thank You</div><div style="font-size: ${fontSizes.footer}; text-align: center; margin-bottom: 4px;">${footerMsg}</div><div style="font-size: ${fontSizes.footer}; text-align: center; color: #666;">Powered by Chuio</div>`;
  
  const previewEl = document.getElementById('bill-format-preview');
  if (previewEl) {
    previewEl.innerHTML = preview;
  }
}

// ============= MODAL INITIALIZATION FUNCTIONS =============

// Load Restaurant Information Modal
async function loadRestaurantInfoModal() {
  try {
    const res = await fetch(`${API}/restaurants/${restaurantId}/settings`);
    const settings = await res.json();
    
    document.getElementById('view-name').textContent = settings.name || 'Not set';
    document.getElementById('view-phone').textContent = settings.phone || 'Not set';
    document.getElementById('view-address').textContent = settings.address || 'Not set';
    document.getElementById('view-timezone').textContent = settings.timezone || 'UTC';
    document.getElementById('view-service-charge').textContent = (settings.service_charge_percent || 0) + '%';
    
    // Use color swatch template
    const colorTemplate = document.getElementById('color-swatch-template');
    const colorSwatch = colorTemplate.content.cloneNode(true).querySelector('div');
    const hex = settings.theme_color || '#2c3e50';
    colorSwatch.style.backgroundColor = hex;
    document.getElementById('view-color').innerHTML = '';
    document.getElementById('view-color').appendChild(colorSwatch);
    const hexLabel = document.createElement('span');
    hexLabel.textContent = hex.toUpperCase();
    hexLabel.style.cssText = 'margin-left:10px;font-size:13px;font-weight:600;color:#374151;vertical-align:middle;font-family:monospace;';
    document.getElementById('view-color').appendChild(hexLabel);
    
    // Populate input fields for edit mode
    document.getElementById('restaurant-name').value = settings.name || '';
    document.getElementById('restaurant-phone').value = settings.phone || '';
    document.getElementById('restaurant-address').value = settings.address || '';
    document.getElementById('timezone-select').value = settings.timezone || 'UTC';
    document.getElementById('serviceChargeInput').value = settings.service_charge_percent || 0;
    document.getElementById('colorInput').value = settings.theme_color || '#2c3e50';
    
    if (settings.logo_url) {
      document.getElementById('restaurant-logo').src = settings.logo_url;
      document.getElementById('restaurant-logo').classList.remove('hidden');
    }

    if (settings.background_url) {
      document.getElementById('restaurant-background').src = settings.background_url;
      document.getElementById('restaurant-background').classList.remove('hidden');
    }
  } catch (err) {
    console.error("Failed to load restaurant info:", err);
  }
}

// Load Staff Login Links Modal - Generate QR Codes
async function loadStaffLoginLinksModal() {
  try {
    const rid = restaurantId || localStorage.getItem('restaurantId');
    if (!rid) {
      console.warn('restaurantId not found');
      return;
    }
    
    // Clear previous QR codes
    const qrStaffEl = document.getElementById('qr-staff');
    const qrKitchenEl = document.getElementById('qr-kitchen');
    const staffLinkDisplay = document.getElementById('staff-link-display');
    const kitchenLinkDisplay = document.getElementById('kitchen-link-display');
    
    if (!qrStaffEl || !qrKitchenEl) {
      console.warn('QR code container elements not found');
      return;
    }
    
    // Clear containers
    qrStaffEl.innerHTML = '';
    qrKitchenEl.innerHTML = '';
    
    // Generate deep links for mobile app or web fallback
    const staffLink = `${window.location.origin}/staff.html?rid=${rid}`;
    const kitchenLink = `${window.location.origin}/kitchen.html?rid=${rid}`;
    
    // For mobile deep linking (if app is installed)
    // const staffDeepLink = `chuio://staff-login?rid=${rid}`;
    // const kitchenDeepLink = `chuio://kitchen-login?rid=${rid}`;
    
    // Generate QR codes
    try {
      // Generate Staff QR Code
      new QRCode(qrStaffEl, {
        text: staffLink,
        width: 160,
        height: 160,
        colorDark: '#000000',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.H
      });
      if (staffLinkDisplay) {
        staffLinkDisplay.textContent = `Link: ${staffLink}`;
      }
      
      // Generate Kitchen QR Code
      new QRCode(qrKitchenEl, {
        text: kitchenLink,
        width: 160,
        height: 160,
        colorDark: '#2C3E50',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.H
      });
      if (kitchenLinkDisplay) {
        kitchenLinkDisplay.textContent = `Link: ${kitchenLink}`;
      }
      
      console.log('✅ Staff login QR codes generated:', { staffLink, kitchenLink });
    } catch (err) {
      console.error('Failed to generate QR codes:', err);
      qrStaffEl.innerHTML = '<p style="color: #f44336;">Failed to generate QR code. Please check if QRCode library is loaded.</p>';
      qrKitchenEl.innerHTML = '<p style="color: #f44336;">Failed to generate QR code. Please check if QRCode library is loaded.</p>';
    }
  } catch (err) {
    console.error("Failed to load staff login links:", err);
  }
}

// Download QR Code as image
function downloadQRCode(qrElementId, filename) {
  const qrElement = document.getElementById(qrElementId);
  const canvas = qrElement.querySelector('canvas');
  
  if (!canvas) {
    alert('❌ QR code not generated yet. Please reload the modal.');
    return;
  }
  
  const link = document.createElement('a');
  link.href = canvas.toDataURL('image/png');
  link.download = filename;
  link.click();
}

// Print QR Code
function printQRCode(qrElementId) {
  try {
    console.log('[PrintQRCode] Starting QR code print from:', qrElementId);
    
    const qrElement = document.getElementById(qrElementId);
    
    if (!qrElement) {
      alert('❌ QR element not found. Please reload the modal.');
      return;
    }
    
    const canvas = qrElement.querySelector('canvas');
    
    if (!canvas) {
      alert('❌ QR code not generated yet. Please reload the modal.');
      return;
    }
    
    const img = canvas.toDataURL('image/png');
    // Fallback to browser print for QR codes in settings
    handleBrowserPrint(`<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <title>QR Code</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: 'Courier New', monospace; display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #fff; padding: 20px; }
      .qr-container { text-align: center; }
      img { max-width: 400px; height: auto; margin: 20px 0; }
      @media print { 
        body { margin: 0; padding: 0; } 
        .qr-container { width: 100%; }
      }
    </style>
  </head>
  <body>
    <div class="qr-container">
      <img src="${img}" alt="QR Code" />
    </div>
  </body>
</html>`);
    console.log('[PrintQRCode] QR code print completed');
  } catch (err) {
    console.error('[PrintQRCode] Error:', err);
    alert('⚠️ Print error: ' + err.message);
  }
}

// Load QR Settings Modal
async function loadQRSettingsModal() {
  try {
    const res = await fetch(`${API}/restaurants/${restaurantId}/settings`);
    const settings = await res.json();
    
    const qrModeSelect = document.getElementById('qr-mode-select');
    if (qrModeSelect && settings.qr_mode) {
      qrModeSelect.value = settings.qr_mode;
    }

    const showStatusToggle = document.getElementById('show-item-status-toggle');
    if (showStatusToggle) {
      const enabled = settings.show_item_status_to_diners !== false; // default true
      showStatusToggle.checked = enabled;
    }
  } catch (err) {
    console.error("Failed to load QR settings:", err);
  }
}

async function saveShowItemStatusSetting(enabled) {
  try {
    const res = await fetch(`${API}/restaurants/${restaurantId}/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ show_item_status_to_diners: enabled })
    });
    if (!res.ok) throw new Error('Failed to save setting');
  } catch (err) {
    console.error("Error saving show item status setting:", err);
    alert('Failed to save setting');
  }
}

// ============= MENU SETTINGS =============
async function loadMenuSettingsPage() {
  try {
    const res = await fetch(`${API}/restaurants/${restaurantId}/settings`);
    if (!res.ok) throw new Error('Failed to load settings');
    const settings = await res.json();
    const flags = settings.feature_flags || {};

    const customMenuToggle = document.getElementById('custom-menu-items-toggle');
    if (customMenuToggle) customMenuToggle.checked = !!flags.custom_menu_items;

    const customSrToggle = document.getElementById('custom-sr-items-toggle');
    if (customSrToggle) customSrToggle.checked = !!flags.custom_sr_items;
  } catch (err) {
    console.error('Failed to load menu settings:', err);
  }
}

async function saveMenuFeatureFlag(flagName, enabled) {
  try {
    const currentRes = await fetch(`${API}/restaurants/${restaurantId}/settings`);
    if (!currentRes.ok) throw new Error('Failed to load settings');
    const settings = await currentRes.json();
    const flags = { ...(settings.feature_flags || {}), [flagName]: enabled };

    const res = await fetch(`${API}/restaurants/${restaurantId}/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feature_flags: flags })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      if (res.status === 403) {
        alert('This is a premium feature. Please contact support to enable it.');
      } else {
        alert('Failed to save setting: ' + (err.error || res.status));
      }
      // Revert toggle
      const toggle = document.getElementById(
        flagName === 'custom_menu_items' ? 'custom-menu-items-toggle' : 'custom-sr-items-toggle'
      );
      if (toggle) toggle.checked = !enabled;
    }
  } catch (err) {
    console.error('Error saving feature flag:', err);
    alert('Failed to save setting');
    const toggle = document.getElementById(
      flagName === 'custom_menu_items' ? 'custom-menu-items-toggle' : 'custom-sr-items-toggle'
    );
    if (toggle) toggle.checked = !enabled;
  }
}

// Load Coupons Modal
async function loadCouponsModal() {
  try {
    const res = await fetch(`${API}/restaurants/${restaurantId}/coupons`);
    const coupons = await res.json();
    
    const couponsList = document.getElementById('coupons-list');
    if (coupons.length === 0) {
      document.getElementById('no-coupons-msg').style.display = 'block';
      couponsList.innerHTML = '';
    } else {
      document.getElementById('no-coupons-msg').style.display = 'none';
      
      const couponTemplate = document.getElementById('coupon-list-template');
      couponsList.innerHTML = '';
      
      coupons.forEach(coupon => {
        const couponElement = couponTemplate.content.cloneNode(true);
        couponElement.querySelector('[data-coupon-code]').textContent = coupon.code;
        couponElement.querySelector('[data-coupon-discount]').textContent = 
          coupon.discount_type === 'percentage' ? coupon.discount_value + '%' : '$' + coupon.discount_value + ' off';
        couponElement.querySelector('[data-coupon-edit]').onclick = () => editCoupon(coupon);
        couponElement.querySelector('[data-coupon-delete]').onclick = () => deleteCoupon(coupon.id);
        couponsList.appendChild(couponElement);
      });
    }
  } catch (err) {
    console.error("Failed to load coupons:", err);
  }
}

// Load Booking Settings Modal
async function loadBookingSettingsModal() {
  try {
    const res = await fetch(`${API}/restaurants/${restaurantId}/settings`);
    const settings = await res.json();
    
    const input = document.getElementById('booking-time-allowance');
    if (input) {
      input.value = settings.booking_time_allowance_mins || 15;
    }
  } catch (err) {
    console.error("Failed to load booking settings:", err);
  }
}

// ============= EDIT MODE FUNCTIONS =============

function enterEditMode() {
  document.getElementById('view-name').classList.add('hidden');
  document.getElementById('view-phone').classList.add('hidden');
  document.getElementById('view-address').classList.add('hidden');
  document.getElementById('view-timezone').classList.add('hidden');
  document.getElementById('view-service-charge').classList.add('hidden');
  document.getElementById('view-color').classList.add('hidden');
  
  document.getElementById('restaurant-name').classList.remove('hidden');
  document.getElementById('restaurant-phone').classList.remove('hidden');
  document.getElementById('restaurant-address').classList.remove('hidden');
  document.getElementById('timezone-select').classList.remove('hidden');
  document.getElementById('serviceChargeInput').classList.remove('hidden');
  document.getElementById('colorInput').classList.remove('hidden');
  document.getElementById('logoInput').classList.remove('hidden');
  document.getElementById('upload-background-btn').classList.remove('hidden');
  
  document.getElementById('edit-settings-btn').classList.add('hidden');
  document.getElementById('save-settings-btn').classList.remove('hidden');
  document.getElementById('cancel-settings-btn').classList.remove('hidden');
}

function cancelEditMode() {
  document.getElementById('view-name').classList.remove('hidden');
  document.getElementById('view-phone').classList.remove('hidden');
  document.getElementById('view-address').classList.remove('hidden');
  document.getElementById('view-timezone').classList.remove('hidden');
  document.getElementById('view-service-charge').classList.remove('hidden');
  document.getElementById('view-color').classList.remove('hidden');
  
  document.getElementById('restaurant-name').classList.add('hidden');
  document.getElementById('restaurant-phone').classList.add('hidden');
  document.getElementById('restaurant-address').classList.add('hidden');
  document.getElementById('timezone-select').classList.add('hidden');
  document.getElementById('serviceChargeInput').classList.add('hidden');
  document.getElementById('colorInput').classList.add('hidden');
  document.getElementById('logoInput').classList.add('hidden');
  document.getElementById('upload-background-btn').classList.add('hidden');
  
  document.getElementById('edit-settings-btn').classList.remove('hidden');
  document.getElementById('save-settings-btn').classList.add('hidden');
  document.getElementById('cancel-settings-btn').classList.add('hidden');
}

// Clear coupon form
function clearCouponForm() {
  document.getElementById('new-coupon-code').value = '';
  document.getElementById('new-coupon-type').value = 'percentage';
  document.getElementById('new-coupon-value').value = '';
  document.getElementById('new-coupon-min-order').value = '0';
  document.getElementById('new-coupon-max-uses').value = '';
  document.getElementById('new-coupon-valid-until').value = '';
  document.getElementById('new-coupon-description').value = '';
}

// Open form to add a new coupon
function openAddCouponForm() {
  EDITING_COUPON_ID = null;
  clearCouponForm();
  const title = document.getElementById('coupon-form-title');
  const submitBtn = document.getElementById('coupon-submit-btn');
  if (title) title.textContent = 'Add New Coupon';
  if (submitBtn) { submitBtn.textContent = 'Create Coupon'; submitBtn.setAttribute('data-i18n', 'admin.create-coupon'); }
  document.getElementById('coupon-form-section').style.display = 'block';
  document.getElementById('new-coupon-code').focus();
}

// Load existing coupon into form for editing
function editCoupon(coupon) {
  EDITING_COUPON_ID = coupon.id;
  document.getElementById('new-coupon-code').value = coupon.code || '';
  document.getElementById('new-coupon-type').value = coupon.discount_type || 'percentage';
  document.getElementById('new-coupon-value').value = coupon.discount_value || '';
  document.getElementById('new-coupon-min-order').value = coupon.minimum_order_value || 0;
  document.getElementById('new-coupon-max-uses').value = coupon.max_uses || '';
  document.getElementById('new-coupon-valid-until').value = coupon.valid_until ? coupon.valid_until.split('T')[0] : '';
  document.getElementById('new-coupon-description').value = coupon.description || '';
  const title = document.getElementById('coupon-form-title');
  const submitBtn = document.getElementById('coupon-submit-btn');
  if (title) title.textContent = `Edit Coupon: ${coupon.code}`;
  if (submitBtn) { submitBtn.textContent = 'Save Changes'; submitBtn.removeAttribute('data-i18n'); }
  document.getElementById('coupon-form-section').style.display = 'block';
  document.getElementById('new-coupon-code').focus();
}

// Close/hide coupon form
function closeCouponForm() {
  document.getElementById('coupon-form-section').style.display = 'none';
  EDITING_COUPON_ID = null;
  clearCouponForm();
}

// Submit coupon form (create or update)
async function submitCouponForm() {
  const code = document.getElementById('new-coupon-code').value.toUpperCase().trim();
  const type = document.getElementById('new-coupon-type').value;
  const value = parseFloat(document.getElementById('new-coupon-value').value);
  const minOrder = parseFloat(document.getElementById('new-coupon-min-order').value) || 0;
  const maxUses = document.getElementById('new-coupon-max-uses').value ? parseInt(document.getElementById('new-coupon-max-uses').value) : null;
  const validUntil = document.getElementById('new-coupon-valid-until').value;
  const description = document.getElementById('new-coupon-description').value;

  if (!code || !type || isNaN(value)) {
    alert('Please fill in all required fields (code, type, value)');
    return;
  }

  try {
    let res;
    if (EDITING_COUPON_ID) {
      res = await fetch(`${API}/coupons/${EDITING_COUPON_ID}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, discount_type: type, discount_value: value, minimum_order_value: minOrder, max_uses: maxUses, valid_until: validUntil || null, description, restaurantId })
      });
    } else {
      res = await fetch(`${API}/restaurants/${restaurantId}/coupons`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, discount_type: type, discount_value: value, minimum_order_value: minOrder, max_uses: maxUses, valid_until: validUntil || null, description })
      });
    }

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || (EDITING_COUPON_ID ? 'Failed to update coupon' : 'Failed to create coupon'));
    }

    alert(EDITING_COUPON_ID ? 'Coupon updated successfully!' : 'Coupon created successfully!');
    closeCouponForm();
    await loadCouponsModal();
  } catch (err) {
    console.error("Error saving coupon:", err);
    alert('Failed to save coupon: ' + err.message);
  }
}

// Save Restaurant Settings
async function saveAdminSettings() {
  const payload = {
    name: document.getElementById('restaurant-name').value,
    phone: document.getElementById('restaurant-phone').value,
    address: document.getElementById('restaurant-address').value,
    timezone: document.getElementById('timezone-select').value || 'UTC',
    service_charge_percent: parseFloat(document.getElementById('serviceChargeInput').value) || 0,
    theme_color: document.getElementById('colorInput').value
  };
  
  try {
    const res = await fetch(`${API}/restaurants/${restaurantId}/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!res.ok) throw new Error('Failed to save');
    
    alert('Restaurant information saved successfully!');
    applyThemeColor(payload.theme_color);
    cancelEditMode();
    await loadRestaurantInfoModal();
  } catch (err) {
    console.error("Error saving settings:", err);
    alert('Failed to save restaurant information');
  }
}

function uploadRestaurantLogo(file) {
  if (!file) return;
  
  const formData = new FormData();
  formData.append('image', file);
  
  fetch(`${API}/restaurants/${restaurantId}/logo`, {
    method: 'POST',
    body: formData
  })
  .then(res => res.json())
  .then(data => {
    if (data.logo_url) {
      document.getElementById('restaurant-logo').src = data.logo_url;
      document.getElementById('restaurant-logo').classList.remove('hidden');
      alert('Logo uploaded successfully!');
    }
  })
  .catch(err => {
    console.error("Logo upload error:", err);
    alert('Failed to upload logo');
  });
}

function uploadRestaurantBackground(file) {
  if (!file) return;
  
  const formData = new FormData();
  formData.append('image', file);
  
  fetch(`${API}/restaurants/${restaurantId}/background`, {
    method: 'POST',
    body: formData
  })
  .then(res => res.json())
  .then(data => {
    if (data.background_url) {
      document.getElementById('restaurant-background').src = data.background_url;
      document.getElementById('restaurant-background').classList.remove('hidden');
      alert('Background image uploaded successfully!');
    }
  })
  .catch(err => {
    console.error("Background upload error:", err);
    alert('Failed to upload background image');
  });
}

// Edit POS Settings
// Copy to Clipboard
function copyToClipboard(elementId) {
  const element = document.getElementById(elementId);
  navigator.clipboard.writeText(element.value).then(() => {
    const oldText = element.placeholder;
    element.placeholder = 'Copied!';
    setTimeout(() => {
      element.placeholder = oldText;
    }, 2000);
  });
}

// Save Booking Settings
async function saveBookingSettings() {
  const allowanceMins = parseInt(document.getElementById('booking-time-allowance').value) || 15;
  
  try {
    const res = await fetch(`${API}/restaurants/${restaurantId}/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ booking_time_allowance_mins: allowanceMins })
    });
    
    if (!res.ok) throw new Error('Failed to save');
    
    alert('Booking settings saved successfully!');
    closeSettingsModal('booking-settings');
  } catch (err) {
    console.error("Error saving booking settings:", err);
    alert('Failed to save booking settings');
  }
}

async function deleteCoupon(couponId) {
  if (!confirm('Are you sure you want to delete this coupon?')) return;
  
  try {
    const res = await fetch(`${API}/coupons/${couponId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete');
    
    alert('Coupon deleted successfully!');
    await loadCouponsModal();
  } catch (err) {
    console.error("Error deleting coupon:", err);
    alert('Failed to delete coupon');
  }
}

// QR Mode Management
async function changeQRMode() {
  const newMode = document.getElementById('qr-mode-select').value;
  if (!newMode) return;
  
  try {
    const res = await fetch(`${API}/restaurants/${restaurantId}/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ qr_mode: newMode })
    });
    
    if (!res.ok) throw new Error('Failed to update QR mode');
    
    alert('QR mode updated successfully!');
  } catch (err) {
    console.error("Error changing QR mode:", err);
    alert('Failed to update QR mode');
  }
}

// ========== PRINTER SETTINGS ==========
async function loadPrinterSettings() {
  try {
    const res = await fetch(`${API}/restaurants/${restaurantId}/printer-settings`);
    if (!res.ok) throw new Error('Failed to fetch printer settings');
    
    const settings = await res.json();
    
    // Display mode
    document.getElementById('view-printer-type').textContent = settings.printer_type || 'None';
    document.getElementById('view-printer-host').textContent = settings.printer_host || '—';
    document.getElementById('view-printer-port').textContent = settings.printer_port || '9100';
    document.getElementById('view-bluetooth-device').textContent = settings.bluetooth_device_name ? 
      '📱 ' + settings.bluetooth_device_name : '—';
    
    const status = settings.printer_type && settings.printer_type !== 'none' ? '🟢 Configured' : '⚠️ Not Configured';
    document.getElementById('printer-connection-status').textContent = status;
    document.getElementById('printer-connection-status').style.background = settings.printer_type && settings.printer_type !== 'none' ? '#f0fdf4' : '#fef3c7';
    document.getElementById('printer-connection-status').style.color = settings.printer_type && settings.printer_type !== 'none' ? '#166534' : '#92400e';
    
    // Edit mode
    document.getElementById('printer-type').value = settings.printer_type || 'none';
    document.getElementById('printer-host').value = settings.printer_host || '';
    document.getElementById('printer-port').value = settings.printer_port || '9100';
    document.getElementById('bluetooth-device-id').value = settings.bluetooth_device_id || '';
    document.getElementById('kitchen-auto-print').checked = settings.kitchen_auto_print || false;
    document.getElementById('bill-auto-print').checked = settings.bill_auto_print || false;
    
    // Customer receipts
    if (settings.customer_receipt_type) {
      const types = settings.customer_receipt_type.split(',').map(t => t.trim());
      document.getElementById('receipt-email').checked = types.includes('email');
      document.getElementById('receipt-printer').checked = types.includes('printer');
      document.getElementById('receipt-qr').checked = types.includes('qr');
    }
    
    // Update preview
    const printerPreview = settings.printer_type && settings.printer_type !== 'none' ? 
      '🟢 ' + (settings.printer_type.charAt(0).toUpperCase() + settings.printer_type.slice(1)) :
      '⚠️ Not Configured';
    document.getElementById('printer-status-preview').textContent = printerPreview;
    
    updatePrinterTypeFields();
    
    // Load Bluetooth devices if Bluetooth printer is selected
    if (settings.printer_type === 'bluetooth') {
      await refreshConnectedDevices();
    }
  } catch (err) {
    console.error('Error loading printer settings:', err);
  }
}

function updatePrinterTypeFields() {
  const printerType = document.getElementById('printer-type').value;
  const hostGroup = document.getElementById('printer-host-group');
  const portGroup = document.getElementById('printer-port-group');
  const bluetoothGroup = document.getElementById('bluetooth-device-group');
  
  // Show/hide fields based on printer type
  if (printerType === 'network') {
    hostGroup.style.display = 'block';
    portGroup.style.display = 'block';
    bluetoothGroup.style.display = 'none';
  } else if (printerType === 'bluetooth') {
    hostGroup.style.display = 'none';
    portGroup.style.display = 'none';
    bluetoothGroup.style.display = 'block';
  } else {
    hostGroup.style.display = 'none';
    portGroup.style.display = 'none';
    bluetoothGroup.style.display = 'none';
  }
}

/**
 * Scan for available Bluetooth devices
 */
async function scanBluetoothDevices() {
  const scanBtn = event.target;
  const originalText = scanBtn.textContent;
  
  try {
    scanBtn.disabled = true;
    scanBtn.textContent = '🔍 Scanning...';
    
    // Try to use Web Bluetooth API if available
    if (!navigator.bluetooth) {
      alert('Bluetooth scanning not available in this browser. Please use Chrome/Edge with Bluetooth enabled, or manually enter the device ID below.');
      return;
    }
    
    // Request Bluetooth device
    const device = await navigator.bluetooth.requestDevice({
      filters: [{ services: ['000018f0-0000-1000-8000-00805f9b34fb'] }], // Thermal printer service UUID
      optionalServices: ['generic_access']
    });
    
    if (device) {
      const select = document.getElementById('bluetooth-device-id');
      
      // Check if device already in list
      const exists = Array.from(select.options).some(opt => opt.value === device.id);
      
      if (!exists) {
        const option = document.createElement('option');
        option.value = device.id;
        option.textContent = device.name || 'Unknown Device';
        select.appendChild(option);
      }
      
      // Select the device
      select.value = device.id;
    }
  } catch (err) {
    if (err.name !== 'NotFoundError') {
      console.error('Bluetooth scan error:', err);
      alert('Bluetooth scan failed. Please try again or manually enter device ID.');
    }
  } finally {
    scanBtn.disabled = false;
    scanBtn.textContent = originalText;
  }
}

async function enterEditModePrinter() {
  document.getElementById('view-printer-type').style.display = 'none';
  document.getElementById('view-printer-host').style.display = 'none';
  document.getElementById('view-printer-port').style.display = 'none';
  document.getElementById('view-bluetooth-device').style.display = 'none';
  
  document.getElementById('printer-type').classList.remove('hidden');
  document.getElementById('printer-host').classList.remove('hidden');
  document.getElementById('printer-port').classList.remove('hidden');
  
  document.getElementById('edit-printer-btn').classList.add('hidden');
  document.getElementById('save-printer-btn').classList.remove('hidden');
  document.getElementById('test-printer-btn').classList.remove('hidden');
  document.getElementById('cancel-printer-btn').classList.remove('hidden');
  
  updatePrinterTypeFields();
  
  // Load Bluetooth devices if available
  if (document.getElementById('printer-type').value === 'bluetooth') {
    await refreshConnectedDevices();
  }
}

function cancelEditModePrinter() {
  document.getElementById('view-printer-type').style.display = 'block';
  document.getElementById('view-printer-host').style.display = 'block';
  document.getElementById('view-printer-port').style.display = 'block';
  document.getElementById('view-bluetooth-device').style.display = 'block';
  
  document.getElementById('printer-type').classList.add('hidden');
  document.getElementById('printer-host').classList.add('hidden');
  document.getElementById('printer-port').classList.add('hidden');
  
  document.getElementById('edit-printer-btn').classList.remove('hidden');
  document.getElementById('save-printer-btn').classList.add('hidden');
  document.getElementById('test-printer-btn').classList.add('hidden');
  document.getElementById('cancel-printer-btn').classList.add('hidden');
  
  loadPrinterSettings(); // Reload to discard changes
}

async function savePrinterSettings() {
  const printerType = document.getElementById('printer-type').value;
  const printerHost = document.getElementById('printer-host').value;
  const printerPort = parseInt(document.getElementById('printer-port').value) || 9100;
  const bluetoothDeviceId = document.getElementById('bluetooth-device-id').value;
  
  // Get Bluetooth device name from the select element
  let bluetoothDeviceName = null;
  if (bluetoothDeviceId) {
    const select = document.getElementById('bluetooth-device-id');
    const option = select.querySelector(`option[value="${bluetoothDeviceId}"]`);
    if (option) bluetoothDeviceName = option.textContent;
  }
  
  const kitchenAutoPrint = document.getElementById('kitchen-auto-print').checked;
  const billAutoPrint = document.getElementById('bill-auto-print').checked;
  
  // Validate Bluetooth selection
  if (printerType === 'bluetooth' && !bluetoothDeviceId) {
    alert('⚠️ Please scan for and select a Bluetooth device first');
    return;
  }
  
  // Collect customer receipt types
  const receiptTypes = [];
  if (document.getElementById('receipt-email').checked) receiptTypes.push('email');
  if (document.getElementById('receipt-printer').checked) receiptTypes.push('printer');
  if (document.getElementById('receipt-qr').checked) receiptTypes.push('qr');
  
  try {
    const res = await fetch(`${API}/restaurants/${restaurantId}/printer-settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        printer_type: printerType,
        printer_host: printerHost || null,
        printer_port: printerPort,
        bluetooth_device_id: bluetoothDeviceId || null,
        bluetooth_device_name: bluetoothDeviceName || null,
        kitchen_auto_print: kitchenAutoPrint,
        bill_auto_print: billAutoPrint,
        customer_receipt_type: receiptTypes.join(', ')
      })
    });
    
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to save settings');
    }
    
    alert('✓ Printer settings saved successfully!');
    await loadPrinterSettings();
    cancelEditModePrinter();
  } catch (err) {
    console.error('Error saving printer settings:', err);
    alert('Failed to save printer settings: ' + err.message);
  }
}

async function testPrinterConnection() {
  try {
    const res = await fetch(`${API}/restaurants/${restaurantId}/printer-test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    const result = await res.json();
    
    if (result.success) {
      alert('✓ Printer connection test passed!');
      document.getElementById('printer-connection-status').textContent = '🟢 Connected';
      document.getElementById('printer-connection-status').style.background = '#f0fdf4';
      document.getElementById('printer-connection-status').style.color = '#166534';
    } else {
      alert('✗ Printer connection failed: ' + (result.error || 'Unknown error'));
      document.getElementById('printer-connection-status').textContent = '❌ Connection Failed';
      document.getElementById('printer-connection-status').style.background = '#fee2e2';
      document.getElementById('printer-connection-status').style.color = '#991b1b';
    }
  } catch (err) {
    console.error('Error testing printer:', err);
    alert('Failed to test printer connection');
  }
}

// ========== BLUETOOTH RECEIPT PRINTER SUPPORT ==========

// Store bluetooth device history per restaurant
let bluetoothDeviceHistory = [];
let currentBluetoothDevice = null;

/**
 * Check if browser supports Web Bluetooth API
 */
function isBluetoothSupported() {
  return !!(navigator.bluetooth && typeof navigator.bluetooth.requestDevice === 'function');
}

/**
 * Get browser-specific Bluetooth support info
 */
function getBluetoothSupportInfo() {
  const ua = navigator.userAgent.toLowerCase();
  
  if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod')) {
    return {
      supported: false,
      device: 'iOS',
      message: 'Web Bluetooth is not supported on iOS Safari. Use Chrome on Android or desktop browser instead.',
      recommendation: 'Android Chrome, Desktop Chrome/Edge/Firefox'
    };
  }
  
  if (ua.includes('android')) {
    const hasChrome = ua.includes('chrome') || ua.includes('crios');
    return {
      supported: hasChrome,
      device: 'Android',
      message: hasChrome ? 'Bluetooth supported (Chrome on Android)' : 'Use Chrome browser on Android for Bluetooth support.',
      recommendation: 'Chrome, Edge, or Samsung Internet'
    };
  }
  
  // Desktop
  const hasSupport = ua.includes('chrome') || ua.includes('edge') || ua.includes('firefox');
  return {
    supported: hasSupport,
    device: 'Desktop',
    message: hasSupport ? 'Bluetooth supported (Chrome/Edge/Firefox)' : 'Use Chrome, Edge, or Firefox for Bluetooth support.',
    recommendation: 'Chrome, Edge, or Firefox'
  };
}

/**
 * Load and display connected/previously paired Bluetooth devices
 */
async function refreshConnectedDevices() {
  const deviceList = document.getElementById('bluetooth-connected-devices');
  deviceList.innerHTML = '<div style="padding: 16px; text-align: center; color: #999; font-size: 13px;">🔄 Checking for connected devices...</div>';

  try {
    // Try to load saved devices for this restaurant
    const res = await fetch(`${API}/restaurants/${restaurantId}/bluetooth-devices`);
    if (!res.ok) {
      bluetoothDeviceHistory = [];
    } else {
      bluetoothDeviceHistory = await res.json();
    }

    if (bluetoothDeviceHistory.length === 0) {
      deviceList.innerHTML = '<div style="padding: 16px; text-align: center; color: #999; font-size: 13px;">No paired devices yet.<br>Use "Scan New Device" to add a printer.</div>';
      return;
    }

    // Display available devices
    let html = '';
    for (const device of bluetoothDeviceHistory) {
      const isSelected = document.getElementById('bluetooth-device-id').value === device.deviceId;
      const selectedClass = isSelected ? 'background: #dbeafe; border-left: 4px solid #0284c7;' : '';
      const selectedBadge = isSelected ? '<span style="margin-left: 8px; background: #0284c7; color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600;">✓ SELECTED</span>' : '';

      html += `<div style="padding: 12px; border-bottom: 1px solid var(--border-color); cursor: pointer; ${selectedClass}" 
                   onclick="selectBluetoothDeviceFromHistory('${device.deviceId}', '${device.deviceName}')">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <div>
                    <div style="font-weight: 600; color: #333; font-size: 14px;">📱 ${device.deviceName}</div>
                    <div style="font-size: 12px; color: #666; margin-top: 2px;">ID: ${device.deviceId.substring(0, 16)}...</div>\n                    ${device.lastConnected ? '<div style="font-size: 11px; color: #999; margin-top: 2px;">Last used: ' + new Date(device.lastConnected).toLocaleDateString() + '</div>' : ''}\n                  </div>\n                  ${selectedBadge}\n                </div>\n              </div>`;
    }

    deviceList.innerHTML = html;
  } catch (err) {
    console.error('Error loading Bluetooth devices:', err);
    bluetoothDeviceHistory = [];
    deviceList.innerHTML = '<div style="padding: 16px; text-align: center; color: #666; font-size: 13px;">Could not load device list. Try scanning for a new device.</div>';
  }
}

function selectBluetoothDeviceFromHistory(deviceId, deviceName) {
  // Store selection
  document.getElementById('bluetooth-device-id').value = deviceId;
  document.getElementById('bluetooth-device-name').value = deviceName;
  document.getElementById('view-bluetooth-device').textContent = '📱 ' + deviceName;

  // Update UI - highlight selected device
  refreshConnectedDevices();

  console.log('[Bluetooth] Selected device from history:', deviceId, deviceName);
}

async function scanBluetoothDevices() {
  // Check browser support
  const support = getBluetoothSupportInfo();
  
  if (!isBluetoothSupported()) {
    const msg = `❌ Web Bluetooth Not Supported\n\n${support.message}\n\nRecommended: ${support.recommendation}`;
    alert(msg);
    console.warn('[Bluetooth] Support check:', support);
    return;
  }

  const scanBtn = document.getElementById('scan-bluetooth-btn');
  const deviceList = document.getElementById('bluetooth-connected-devices');

  scanBtn.disabled = true;
  scanBtn.textContent = '⏳ Scanning...';
  deviceList.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">🔍 Searching for Bluetooth devices...</div>';

  try {
    // Request Bluetooth device - filter for generic devices
    const device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: ['generic_attribute']
    });

    if (device) {
      // Store device globally for later reference
      currentBluetoothDevice = device;

      // Display the newly found device
      const deviceName = device.name || 'Unknown Device';
      const deviceId = device.id;

      // Add to history if not already there
      if (!bluetoothDeviceHistory.find(d => d.deviceId === deviceId)) {
        bluetoothDeviceHistory.push({
          deviceId: deviceId,
          deviceName: deviceName,
          lastConnected: new Date().toISOString()
        });

        // Save to server
        await fetch(`${API}/restaurants/${restaurantId}/bluetooth-devices`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deviceId: deviceId,
            deviceName: deviceName
          })
        }).catch(err => console.warn('Could not save device to server:', err));
      }

      // Select this device
      selectBluetoothDeviceFromHistory(deviceId, deviceName);
      alert('Device found and added: ' + deviceName);

      console.log('[Bluetooth] New device scanned and added:', deviceId, deviceName);
    }
  } catch (err) {
    const deviceList = document.getElementById('bluetooth-connected-devices');
    const support = getBluetoothSupportInfo();
    
    if (err.name === 'NotFoundError') {
      deviceList.innerHTML = '<div style="padding: 20px; text-align: center; color: #ef4444; font-size: 13px;">🔍 No Bluetooth devices found.<br><br>Make sure:<br>• Receipt printer is powered on<br>• Printer is in pairing/discovery mode<br>• Bluetooth is enabled on this device</div>';
    } else if (err.name === 'NotSupportedError') {
      deviceList.innerHTML = `<div style="padding: 20px; text-align: center; color: #ef4444; font-size: 13px;">❌ ${support.message}<br><br>Recommended: ${support.recommendation}</div>`;
    } else if (err.name === 'NotAllowedError') {
      deviceList.innerHTML = '<div style="padding: 20px; text-align: center; color: #ef4444; font-size: 13px;">🔒 Bluetooth permission denied.<br><br>Enable Bluetooth permissions in:<br>Settings → Browser → Permissions → Bluetooth</div>';
    } else if (err.name === 'AbortError') {
      // User cancelled - just refresh the list
      await refreshConnectedDevices();
    } else {
      console.error('Bluetooth scan error:', err);
      deviceList.innerHTML = '<div style="padding: 20px; text-align: center; color: #ef4444; font-size: 13px;">❌ Error: ' + (err.message || 'Unknown error') + '</div>';
    }
  } finally {
    scanBtn.disabled = false;
    scanBtn.textContent = '🔍 Scan New Device';
  }
}

// ============= QR CODE FORMAT SAVE/RESET FUNCTIONS =============
function resetQRCode() {
  document.getElementById('qr-code-size').value = 'medium';
  document.getElementById('qr-text-above').value = 'Scan to Order';
  document.getElementById('qr-text-below').value = 'Let us know how we did!';
  updateQRCodePreview();
}

async function saveQRCode() {
  try {
    const qrSettings = {
      qr_code_size: document.getElementById('qr-code-size').value,
      qr_text_above: document.getElementById('qr-text-above').value,
      qr_text_below: document.getElementById('qr-text-below').value
    };
    
    const res = await fetch(`${API}/restaurants/${restaurantId}/printer-settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(qrSettings)
    });
    
    if (res.ok) {
      alert('QR Code format settings saved successfully!');
    } else {
      alert('Error saving QR Code format settings');
    }
  } catch (err) {
    console.error('Error saving QR Code format:', err);
    alert('Error saving QR Code format settings');
  }
}

// ============= BILL FORMAT SAVE/RESET FUNCTIONS =============
function resetBillFormat() {
  document.getElementById('bill-format-paper-width').value = '80';
  document.getElementById('bill-format-show-phone').checked = true;
  document.getElementById('bill-format-show-address').checked = true;
  document.getElementById('bill-format-show-time').checked = true;
  document.getElementById('bill-format-show-items').checked = true;
  document.getElementById('bill-format-show-total').checked = true;
  document.getElementById('bill-format-footer-msg').value = 'Thank you for your business!';
  updateBillFormatPreview();
}

async function saveBillFormat() {
  try {
    const billSettings = {
      bill_format_paper_width: document.getElementById('bill-format-paper-width').value,
      bill_format_show_phone: document.getElementById('bill-format-show-phone').checked,
      bill_format_show_address: document.getElementById('bill-format-show-address').checked,
      bill_format_show_time: document.getElementById('bill-format-show-time').checked,
      bill_format_show_items: document.getElementById('bill-format-show-items').checked,
      bill_format_show_total: document.getElementById('bill-format-show-total').checked,
      bill_format_footer_msg: document.getElementById('bill-format-footer-msg').value
    };
    
    const res = await fetch(`${API}/restaurants/${restaurantId}/printer-settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(billSettings)
    });
    
    if (res.ok) {
      alert('Bill format settings saved successfully!');
    } else {
      alert('Error saving bill format settings');
    }
  } catch (err) {
    console.error('Error saving bill format:', err);
    alert('Error saving bill format settings');
  }
}

// ============= PAYMENT TERMINALS MANAGEMENT =============

let PAYMENT_TERMINALS_CACHE = [];
let EDITING_TERMINAL_ID = null;

async function loadPaymentTerminals() {
  try {
    const res = await fetch(`${API}/restaurants/${restaurantId}/payment-terminals`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      PAYMENT_TERMINALS_CACHE = await res.json();
    } else {
      PAYMENT_TERMINALS_CACHE = [];
    }
  } catch (err) {
    console.error('Failed to load payment terminals:', err);
    PAYMENT_TERMINALS_CACHE = [];
  }

  // Gate: non-superadmins without terminals see paid service notice
  const paidNotice = document.getElementById('terminal-paid-notice');
  const mainContent = document.getElementById('terminal-main-content');
  const addBtn = document.getElementById('terminal-add-btn');

  if (!IS_SUPERADMIN && (!PAYMENT_TERMINALS_CACHE || PAYMENT_TERMINALS_CACHE.length === 0)) {
    // No terminals and not superadmin: show paid service notice
    if (paidNotice) paidNotice.style.display = 'block';
    if (mainContent) mainContent.style.display = 'none';
    if (addBtn) addBtn.style.display = 'none';
    return;
  }

  // Has terminals or is superadmin: show main content
  if (paidNotice) paidNotice.style.display = 'none';
  if (mainContent) mainContent.style.display = '';
  if (addBtn) addBtn.style.display = IS_SUPERADMIN ? '' : 'none';

  renderPaymentTerminalsList();
  await loadOrderPayStatus();
}

function renderPaymentTerminalsList() {
  const listContainer = document.getElementById('payment-terminals-list');
  const noMsg = document.getElementById('no-terminals-msg');
  
  if (!PAYMENT_TERMINALS_CACHE || PAYMENT_TERMINALS_CACHE.length === 0) {
    listContainer.style.display = 'none';
    noMsg.style.display = 'block';
    return;
  }
  
  listContainer.style.display = 'flex';
  noMsg.style.display = 'none';
  listContainer.innerHTML = '';
  
  PAYMENT_TERMINALS_CACHE.forEach(terminal => {
    const card = document.createElement('div');
    card.className = 'terminal-card' + (terminal.is_active ? ' terminal-card-active' : '');
    
    let html = '<div style="flex: 1;">';
    html += '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">';
    
    const vendorDisplay = terminal.vendor_name === 'payment-asia' ? 'Payment Asia' : terminal.vendor_name.toUpperCase();
    html += '<span style="font-weight: bold; font-size: 14px;">' + vendorDisplay + '</span>';
    
    if (terminal.is_active) {
      html += '<span style="background: #059669; color: white; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">ACTIVE</span>';
    }
    html += '</div>';
    
    // Show different info based on vendor type
    if (terminal.vendor_name === 'payment-asia') {
      html += '<div style="font-size: 12px; color: #666; margin-bottom: 4px;">Token: ' + (terminal.merchant_token || terminal.app_id || '').substring(0, 20) + '...</div>';
      html += '<div style="font-size: 12px; color: #666; margin-bottom: 4px;">Environment: ' + (terminal.payment_gateway_env || 'sandbox') + '</div>';
    } else {
      html += '<div style="font-size: 12px; color: #666; margin-bottom: 4px;">ID: ' + (terminal.app_id || '') + '</div>';
      if (terminal.terminal_ip && terminal.terminal_port) {
        html += '<div style="font-size: 12px; color: #666; margin-bottom: 4px;">' + terminal.terminal_ip + ':' + terminal.terminal_port + '</div>';
      }
    }
    
    if (terminal.last_tested_at) {
      html += '<div style="font-size: 11px; color: #059669; margin-top: 4px;">✓ Tested: ' + new Date(terminal.last_tested_at).toLocaleDateString() + '</div>';
    }
    if (terminal.last_error_message) {
      html += '<div style="font-size: 11px; color: #dc2626; margin-top: 4px;">⚠️ ' + terminal.last_error_message + '</div>';
    }
    html += '</div>';
    html += '<div style="display: flex; flex-direction: column; gap: 8px; margin-left: 12px;">';
    
    // Activate button - only show for superadmin if not already active
    if (!terminal.is_active && IS_SUPERADMIN) {
      html += '<button onclick="activatePaymentTerminal(' + terminal.id + ')" class="btn-primary" style="padding: 6px 12px; font-size: 12px;">✓ Activate</button>';
    }
    
    html += '<button onclick="editPaymentTerminal(' + terminal.id + ')" class="btn-secondary" style="padding: 6px 12px; font-size: 12px;">✎ Edit</button>';
    
    // Delete button - only for superadmin
    if (IS_SUPERADMIN) {
      html += '<button onclick="deletePaymentTerminal(' + terminal.id + ')" class="btn-danger" style="padding: 6px 12px; font-size: 12px;">🗑️ Delete</button>';
    }
    html += '</div>';
    
    card.innerHTML = html;
    listContainer.appendChild(card);
  });
}

function openPaymentTerminalForm() {
  EDITING_TERMINAL_ID = null;
  document.getElementById('payment-terminal-form-view').style.display = 'block';
  document.getElementById('payment-terminal-list-view').style.display = 'none';
  clearPaymentTerminalForm();
}

function closePaymentTerminalForm() {
  document.getElementById('payment-terminal-form-view').style.display = 'none';
  document.getElementById('payment-terminal-list-view').style.display = 'block';
  clearPaymentTerminalForm();
}

function clearPaymentTerminalForm() {
  document.getElementById('new-terminal-vendor').value = 'kpay';
  document.getElementById('new-terminal-app-id').value = '';
  document.getElementById('new-terminal-app-secret').value = '';
  document.getElementById('new-terminal-ip').value = '';
  document.getElementById('new-terminal-port').value = '18080';
  document.getElementById('new-terminal-endpoint').value = '/v2/pos/sign';
  document.getElementById('new-terminal-merchant-token').value = '';
  document.getElementById('new-terminal-secret-code').value = '';
  document.getElementById('new-terminal-gateway-env').value = 'sandbox';
  document.getElementById('terminal-error').style.display = 'none';
  document.getElementById('terminal-success').style.display = 'none';
  document.getElementById('terminal-test-result').style.display = 'none';
  updatePaymentTerminalFields(); // Update field visibility
  EDITING_TERMINAL_ID = null;
}

function updatePaymentTerminalFields() {
  const vendor = document.getElementById('new-terminal-vendor').value;
  const kpayFields = document.getElementById('kpay-fields');
  const paymentAsiaFields = document.getElementById('payment-asia-fields');
  const kpayBtn = document.getElementById('kpay-test-btn');
  const paymentAsiaBtn = document.getElementById('payment-asia-test-btn');
  
  if (vendor === 'payment-asia') {
    kpayFields.style.display = 'none';
    paymentAsiaFields.style.display = 'block';
    kpayBtn.style.display = 'none';
    paymentAsiaBtn.style.display = 'block';
  } else {
    kpayFields.style.display = 'block';
    paymentAsiaFields.style.display = 'none';
    kpayBtn.style.display = 'block';
    paymentAsiaBtn.style.display = 'none';
  }
}

async function editPaymentTerminal(terminalId) {
  try {
    // Fetch full terminal details including app_secret
    const res = await fetch(`${API}/restaurants/${restaurantId}/payment-terminals/${terminalId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) {
      showError('terminal-error', 'Failed to load terminal details');
      return;
    }
    const terminal = await res.json();
    
    EDITING_TERMINAL_ID = terminalId;
    document.getElementById('new-terminal-vendor').value = terminal.vendor_name;
    
    if (terminal.vendor_name === 'payment-asia') {
      // Load Payment Asia fields
      document.getElementById('new-terminal-merchant-token').value = terminal.merchant_token || terminal.app_id || '';
      document.getElementById('new-terminal-secret-code').value = terminal.secret_code || terminal.app_secret || '';
      document.getElementById('new-terminal-gateway-env').value = terminal.payment_gateway_env || 'sandbox';
    } else {
      // Load KPay fields
      document.getElementById('new-terminal-app-id').value = terminal.app_id || '';
      document.getElementById('new-terminal-app-secret').value = terminal.app_secret || '';
      document.getElementById('new-terminal-ip').value = terminal.terminal_ip || '';
      document.getElementById('new-terminal-port').value = terminal.terminal_port || '18080';
      document.getElementById('new-terminal-endpoint').value = terminal.endpoint_path || '/v2/pos/sign';
    }
    
    // Non-superadmins can only edit connection details (IP, port, endpoint path)
    if (!IS_SUPERADMIN) {
      document.getElementById('new-terminal-vendor').disabled = true;
      document.getElementById('new-terminal-app-id').disabled = true;
      document.getElementById('new-terminal-app-secret').disabled = true;
      document.getElementById('new-terminal-merchant-token').disabled = true;
      document.getElementById('new-terminal-secret-code').disabled = true;
      document.getElementById('new-terminal-gateway-env').disabled = true;
    } else {
      document.getElementById('new-terminal-vendor').disabled = false;
      document.getElementById('new-terminal-app-id').disabled = false;
      document.getElementById('new-terminal-app-secret').disabled = false;
      document.getElementById('new-terminal-merchant-token').disabled = false;
      document.getElementById('new-terminal-secret-code').disabled = false;
      document.getElementById('new-terminal-gateway-env').disabled = false;
    }

    document.getElementById('payment-terminal-form-view').style.display = 'block';
    document.getElementById('payment-terminal-list-view').style.display = 'none';
    document.getElementById('terminal-error').style.display = 'none';
    document.getElementById('terminal-success').style.display = 'none';
    document.getElementById('terminal-test-result').style.display = 'none';
    updatePaymentTerminalFields(); // Update field visibility based on vendor
  } catch (err) {
    showError('terminal-error', 'Error loading terminal: ' + err.message);
  }
}

async function savePaymentTerminal() {
  const vendor = document.getElementById('new-terminal-vendor').value;
  
  // Non-superadmins can only update connection details on existing terminals
  if (!IS_SUPERADMIN && !EDITING_TERMINAL_ID) {
    showError('terminal-error', 'Only superadmins can create new terminals');
    return;
  }

  let payload;
  
  if (!IS_SUPERADMIN) {
    // Non-superadmin: only send connection detail fields
    const terminalIp = document.getElementById('new-terminal-ip').value.trim();
    const terminalPort = document.getElementById('new-terminal-port').value.trim();
    const endpointPath = document.getElementById('new-terminal-endpoint').value.trim();
    payload = {};
    if (terminalIp) payload.terminal_ip = terminalIp;
    if (terminalPort) payload.terminal_port = parseInt(terminalPort);
    if (endpointPath) payload.endpoint_path = endpointPath;
  } else if (vendor === 'payment-asia') {
    // Payment Asia validation
    const merchantToken = document.getElementById('new-terminal-merchant-token').value.trim();
    const secretCode = document.getElementById('new-terminal-secret-code').value.trim();
    const env = document.getElementById('new-terminal-gateway-env').value;
    
    if (!merchantToken || !secretCode) {
      showError('terminal-error', 'Merchant Token and Secret Code are required for Payment Asia');
      return;
    }
    
    payload = {
      vendor_name: vendor,
      app_id: merchantToken, // Merchant Token stored in app_id
      app_secret: secretCode, // Secret Code stored in app_secret
      payment_gateway_env: env
    };
  } else {
    // KPay validation
    const appId = document.getElementById('new-terminal-app-id').value.trim();
    const appSecret = document.getElementById('new-terminal-app-secret').value;
    const terminalIp = document.getElementById('new-terminal-ip').value.trim();
    const terminalPort = document.getElementById('new-terminal-port').value.trim();
    const endpointPath = document.getElementById('new-terminal-endpoint').value.trim();
    
    if (!appId || !appSecret || !terminalIp || !terminalPort) {
      showError('terminal-error', 'All KPay fields are required (App ID, Secret, IP, Port)');
      return;
    }
    
    payload = {
      vendor_name: vendor,
      app_id: appId,
      app_secret: appSecret,
      terminal_ip: terminalIp,
      terminal_port: parseInt(terminalPort),
      endpoint_path: endpointPath
    };
  }
  
  try {
    const method = EDITING_TERMINAL_ID ? 'PATCH' : 'POST';
    const url = EDITING_TERMINAL_ID 
      ? `${API}/restaurants/${restaurantId}/payment-terminals/${EDITING_TERMINAL_ID}`
      : `${API}/restaurants/${restaurantId}/payment-terminals`;
    
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(payload)
    });
    
    if (res.ok) {
      const savedTerminal = await res.json();
      showSuccess('terminal-success', EDITING_TERMINAL_ID ? 'Terminal updated!' : 'Terminal created!');
      
      // For KPay terminals, automatically test the connection
      if (payload.vendor_name === 'kpay') {
        console.log('[Save] KPay terminal saved, now testing connection...');
        
        // Show testing message
        const testMsg = document.getElementById('terminal-success');
        testMsg.textContent = 'Terminal saved! Now testing KPay connection...';
        
        // Test the terminal
        try {
          const testRes = await fetch(`${API}/restaurants/${restaurantId}/payment-terminals/${savedTerminal.id}/test`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
          });
          
          const testResult = await testRes.json();
          
          if (testResult.success) {
            // Success!
            showSuccess('terminal-success', '✅ KPay terminal saved and connection verified! Keys exchanged successfully.');
            console.log('[Save] ✅ KPay connection successful');
          } else {
            // Connection test failed but terminal was saved
            showError('terminal-error', '⚠️ Terminal saved but connection test failed: ' + (testResult.message || testResult.error || 'Unknown error'));
            console.error('[Save] ❌ KPay connection test failed:', testResult);
          }
        } catch (testErr) {
          showError('terminal-error', '⚠️ Terminal saved but connection test error: ' + testErr.message);
          console.error('[Save] KPay connection test error:', testErr);
        }
      }
      
      await loadPaymentTerminals();
      setTimeout(() => closePaymentTerminalForm(), 1500);
    } else {
      const err = await res.json();
      showError('terminal-error', err.error || err.message || 'Failed to save terminal');
    }
  } catch (err) {
    showError('terminal-error', 'Network error: ' + err.message);
  }
}

async function testPaymentTerminal() {
  console.log('\n🚀 [KPay TEST] Initiating KPay terminal test');
  
  const terminalId = EDITING_TERMINAL_ID;
  const vendorName = document.getElementById('new-terminal-vendor').value;
  
  console.log('🏪 Terminal ID:', terminalId);
  console.log('🏢 Restaurant ID:', restaurantId);
  console.log('🔧 Vendor:', vendorName);
  
  if (vendorName !== 'kpay') {
    showError('terminal-error', '❌ This is NOT a KPay terminal! Selected vendor: ' + vendorName.toUpperCase() + '. Use the "Test Payment" button for ' + vendorName.toUpperCase() + ' terminals.');
    return;
  }
  
  if (!terminalId) {
    console.error('[KPay TEST] No terminal ID set');
    showError('terminal-error', 'Save terminal first before testing');
    return;
  }

  try {
    const btn = event.target;
    const originalText = btn.textContent;
    
    btn.disabled = true;
    btn.textContent = '🔄 Opening KPay Payment...';
    
    // Open the payment popup with terminal and restaurant info
    const paymentPageUrl = `${window.location.origin}/payment-popup.html?terminalId=${terminalId}&restaurantId=${restaurantId}`;
    console.log('📱 Opening KPay payment page:', paymentPageUrl);
    console.log('🏪 Terminal:', terminalId);
    
    const popupWindow = window.open(paymentPageUrl, 'KPayPayment', 'width=700,height=900,toolbar=no,menubar=no,scrollbars=yes');
    
    if (!popupWindow) {
      throw new Error('Popup blocked. Please allow popups for this site.');
    }
    
    console.log('✅ KPay payment window opened');
    
    btn.disabled = false;
    btn.textContent = originalText;
    
    // Show info message in original window
    const resultDiv = document.getElementById('terminal-test-result');
    resultDiv.style.background = '#d1ecf1';
    resultDiv.style.borderLeft = '4px solid #0c5460';
    resultDiv.style.color = '#0c5460';
    resultDiv.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px;">
        <div style="font-size: 20px;">🔄</div>
        <div>
          <strong>KPay Payment Window Opened (Terminal #${terminalId})</strong>
          <div style="font-size: 13px; margin-top: 4px; opacity: 0.9;">
            A new window has opened. Please complete the payment in the popup window. The terminal should process the payment.
          </div>
        </div>
      </div>
    `;
    resultDiv.style.display = 'block';
  } catch (err) {
    console.error('❌ [KPay TEST] Exception');
    console.error('❌ [KPay TEST] Error:', err.message);
    showError('terminal-error', 'Failed to open KPay payment window: ' + err.message);
    event.target.disabled = false;
    event.target.textContent = originalText;
  }
}

async function testPaymentAsia() {
  console.log('\n🚀 [PAYMENT ASIA TEST] Initiating Payment Asia terminal test');
  
  const terminalId = EDITING_TERMINAL_ID;
  const vendorName = document.getElementById('new-terminal-vendor').value;
  
  console.log('🏪 Terminal ID:', terminalId);
  console.log('🏢 Restaurant ID:', restaurantId);
  console.log('🔧 Vendor:', vendorName);
  
  if (vendorName !== 'payment-asia') {
    showError('terminal-error', 'This test is for Payment Asia only. Use "Test Connection" button for KPay.');
    return;
  }
  
  if (!terminalId) {
    console.error('[PAYMENT ASIA TEST] No terminal ID set');
    showError('terminal-error', 'Save terminal first before testing');
    return;
  }
  
  try {
    const btn = event.target;
    const originalText = btn.textContent;
    
    btn.disabled = true;
    btn.textContent = '🔄 Opening...';
    
    const resultDiv = document.getElementById('terminal-test-result');
    
    // Get merchant token from form if available
    const merchantToken = document.getElementById('new-terminal-merchant-token')?.value || 
                          'ae476881-7bfc-4da8-bc7d-8203ad0fb28c';
    
    console.log('📱 Opening payment test page in new tab...');
    
    // Open custom payment test page in new tab (only pass merchant token and terminal ID)
    const paymentTestUrl = `${window.location.origin}/payment-test.html?merchantToken=${encodeURIComponent(merchantToken)}&terminalId=${terminalId}&restaurantId=${restaurantId}`;
    console.log('🔗 Payment Test URL:', paymentTestUrl);
    
    // Open in new tab
    window.open(paymentTestUrl, '_blank');
    console.log('✅ Payment test page opened in new tab');
    
    // Show success message
    resultDiv.style.background = '#d4edda';
    resultDiv.style.borderLeft = '4px solid #28a745';
    resultDiv.style.color = '#155724';
    resultDiv.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px;">
        <div style="font-size: 24px;">✅</div>
        <div>
          <strong>Payment test page opened in new tab!</strong>
          <div style="font-size: 13px; margin-top: 4px; opacity: 0.9;">
            A new tab has opened. Select your payment method and click "Make Payment" to proceed to Payment Asia.
          </div>
        </div>
      </div>
    `;
    resultDiv.style.display = 'block';
    
    btn.disabled = false;
    btn.textContent = originalText;
    
  } catch (err) {
    console.error('❌ [PAYMENT ASIA TEST] Exception');
    console.error('❌ [PAYMENT ASIA TEST] Error:', err.message);
    showError('terminal-error', 'Failed to open payment test page: ' + err.message);
    if (event.target) {
      event.target.disabled = false;
      event.target.textContent = 'Test Payment';
    }
  }
}

async function activatePaymentTerminal(terminalId) {
  try {
    const res = await fetch(`${API}/restaurants/${restaurantId}/payment-terminals/${terminalId}/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({})
    });

    if (res.ok) {
      const result = await res.json();
      showSuccess('terminal-success', '✅ Terminal activated! ' + (result.message || 'Payment method is now active'));
      await loadPaymentTerminals();
    } else {
      const err = await res.json();
      showError('terminal-error', 'Failed to activate terminal: ' + (err.error || err.message || 'Unknown error'));
    }
  } catch (err) {
    showError('terminal-error', 'Network error: ' + err.message);
  }
}

async function deletePaymentTerminal(terminalId) {
  if (!confirm('Delete this payment terminal?')) return;
  
  try {
    const res = await fetch(`${API}/restaurants/${restaurantId}/payment-terminals/${terminalId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (res.ok) {
      await loadPaymentTerminals();
      showSuccess('terminal-success', 'Terminal deleted');
    } else {
      showError('terminal-error', 'Failed to delete terminal');
    }
  } catch (err) {
    showError('terminal-error', 'Delete failed: ' + err.message);
  }
}

function showError(elementId, message) {
  const el = document.getElementById(elementId);
  el.textContent = message;
  el.style.display = 'block';
  el.style.background = '#fef2f2';
  el.style.color = '#991b1b';
  el.style.borderLeft = '4px solid #dc2626';
  el.style.padding = '12px';
  el.style.borderRadius = '4px';
}

function showSuccess(elementId, message) {
  const el = document.getElementById(elementId);
  el.textContent = message;
  el.style.display = 'block';
  el.style.background = '#f0fdf4';
  el.style.color = '#166534';
  el.style.borderLeft = '4px solid #22c55e';
  el.style.padding = '12px';
  el.style.borderRadius = '4px';
}

// ============= ORDER & PAY FEATURE TOGGLE =============

/**
 * Load Order & Pay feature status
 */
async function loadOrderPayStatus() {
  try {
    const res = await fetch(`${API}/restaurants/${restaurantId}/settings`);
    if (!res.ok) {
      console.warn('[Order & Pay] Failed to load status');
      return;
    }

    const settings = await res.json();
    const isEnabled = settings.order_pay_enabled === true;
    // hasPATerminal: true if active_payment_vendor is already set, OR if any PA terminal is active in cache
    const hasPATerminal = settings.active_payment_vendor === 'payment-asia' ||
      !!(PAYMENT_TERMINALS_CACHE && PAYMENT_TERMINALS_CACHE.some(t => t.vendor_name === 'payment-asia' && t.is_active));
    
    // Update button and status display
    const toggleBtn = document.getElementById('order-pay-toggle-btn');
    const statusDiv = document.getElementById('order-pay-status');

    if (toggleBtn) {
      toggleBtn.textContent = isEnabled ? '✓ Enabled' : 'Enable';
      toggleBtn.className = isEnabled ? 'btn-success' : 'btn-secondary';
      toggleBtn.disabled = false;
    }

    if (statusDiv) {
      if (!hasPATerminal) {
        statusDiv.innerHTML = '⚠️ No Payment Asia terminal active — activate one below for this to take effect';
        statusDiv.style.color = '#92400e';
      } else if (isEnabled) {
        statusDiv.innerHTML = '🟢 Enabled - Customers can pay via Payment Asia';
        statusDiv.style.color = '#166534';
      } else {
        statusDiv.innerHTML = '⚠️ Disabled - Customers cannot pay via Payment Asia';
        statusDiv.style.color = '#92400e';
      }
    }

    console.log('[Order & Pay] Status loaded:', isEnabled, '| PA terminal active:', hasPATerminal);
  } catch (err) {
    console.error('[Order & Pay] Failed to load status:', err);
    const toggleBtn = document.getElementById('order-pay-toggle-btn');
    if (toggleBtn) {
      toggleBtn.textContent = 'Error';
      toggleBtn.disabled = true;
    }
  }
}

/**
 * Toggle Order & Pay feature on/off
 */
async function toggleOrderPayFeature() {
  try {
    const toggleBtn = document.getElementById('order-pay-toggle-btn');
    const statusDiv = document.getElementById('order-pay-status');

    // Disable button while toggling
    if (toggleBtn) {
      toggleBtn.disabled = true;
      toggleBtn.textContent = '⏳ Updating...';
    }

    // Fetch current status
    const getRes = await fetch(`${API}/restaurants/${restaurantId}/settings`);
    if (!getRes.ok) {
      throw new Error('Failed to load current status');
    }

    const settings = await getRes.json();
    const currentState = settings.order_pay_enabled === true;
    const newState = !currentState;

    // If enabling and PA terminal exists in cache but not yet the active vendor, activate it first
    if (newState && settings.active_payment_vendor !== 'payment-asia') {
      const paTerminal = PAYMENT_TERMINALS_CACHE && PAYMENT_TERMINALS_CACHE.find(t => t.vendor_name === 'payment-asia' && t.is_active);
      if (paTerminal) {
        const activateRes = await fetch(`${API}/restaurants/${restaurantId}/payment-terminals/${paTerminal.id}/activate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({})
        });
        if (!activateRes.ok) {
          throw new Error('Failed to activate Payment Asia terminal');
        }
      }
    }

    // Update status on backend
    const patchRes = await fetch(`${API}/restaurants/${restaurantId}/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_pay_enabled: newState })
    });

    if (!patchRes.ok) {
      const error = await patchRes.json();
      throw new Error(error.error || 'Failed to update setting');
    }

    await patchRes.json();

    // Reload actual state from backend (avoids optimistic mismatch if PA terminal not active)
    await loadOrderPayStatus();

    console.log('[Order & Pay] Feature toggled:', newState ? 'ENABLED' : 'DISABLED');
    showSuccess('terminal-success', `Order & Pay ${newState ? 'enabled' : 'disabled'} successfully`);
  } catch (err) {
    console.error('[Order & Pay] Toggle failed:', err);
    const toggleBtn = document.getElementById('order-pay-toggle-btn');
    if (toggleBtn) {
      toggleBtn.disabled = false;
      toggleBtn.textContent = 'Retry';
    }
    showError('terminal-error', 'Failed to toggle Order & Pay: ' + err.message);
  }
}

// ============= SERVICE REQUEST ITEMS =============

let editingServiceItemId = null;

async function loadServiceRequestItems() {
  const list = document.getElementById('service-items-list');
  const noMsg = document.getElementById('no-service-items-msg');
  if (!list) return;
  list.innerHTML = '<p style="color:#999;font-size:13px;">Loading...</p>';
  try {
    const res = await fetch(`${API}/restaurants/${restaurantId}/service-request-items/all`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to load');
    const items = await res.json();
    if (items.length === 0) {
      list.innerHTML = '';
      if (noMsg) noMsg.style.display = 'block';
      return;
    }
    if (noMsg) noMsg.style.display = 'none';
    list.innerHTML = items.map(item => `
      <div style="display:flex;align-items:center;gap:10px;padding:12px;background:#fff;border:1px solid var(--border-color);border-radius:8px;">
        <div style="flex:1;min-width:0;">
          <div style="font-weight:600;font-size:14px;">${escapeHtml(item.label_en)}${item.label_zh ? ` / ${escapeHtml(item.label_zh)}` : ''}</div>
          <div style="font-size:12px;color:#888;font-family:monospace;">${escapeHtml(item.request_type)}</div>
        </div>
        <span style="font-size:11px;padding:2px 8px;border-radius:999px;background:${item.is_active ? '#dcfce7' : '#f3f4f6'};color:${item.is_active ? '#16a34a' : '#6b7280'};">${item.is_active ? 'Active' : 'Hidden'}</span>
        <button onclick="editServiceItem(${item.id}, '${escapeHtml(item.request_type)}', '${escapeHtml(item.label_en)}', '${escapeHtml(item.label_zh || '')}', ${item.sort_order}, ${item.is_active})" class="btn-secondary" style="padding:4px 10px;font-size:12px;">Edit</button>
        <button onclick="deleteServiceItem(${item.id})" style="background:none;border:none;color:#dc2626;font-size:18px;cursor:pointer;padding:4px 6px;" title="Delete">✕</button>
      </div>
    `).join('');
  } catch (err) {
    list.innerHTML = `<p style="color:#dc2626;font-size:13px;">Failed to load items.</p>`;
  }
}

function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function openAddServiceItemForm() {
  editingServiceItemId = null;
  document.getElementById('service-item-form-title').textContent = 'Add Service Item';
  document.getElementById('service-item-submit-btn').textContent = 'Add Item';
  document.getElementById('service-item-label-en').value = '';
  document.getElementById('service-item-label-zh').value = '';
  document.getElementById('service-item-type').value = '';
  document.getElementById('service-item-sort').value = '0';
  document.getElementById('service-item-type').readOnly = false;
  document.getElementById('service-item-form-error').style.display = 'none';
  document.getElementById('service-item-form-section').style.display = 'block';
}

function editServiceItem(id, type, labelEn, labelZh, sortOrder, isActive) {
  editingServiceItemId = id;
  document.getElementById('service-item-form-title').textContent = 'Edit Service Item';
  document.getElementById('service-item-submit-btn').textContent = 'Save Changes';
  document.getElementById('service-item-label-en').value = labelEn;
  document.getElementById('service-item-label-zh').value = labelZh;
  document.getElementById('service-item-type').value = type;
  document.getElementById('service-item-type').readOnly = true;
  document.getElementById('service-item-sort').value = sortOrder;
  document.getElementById('service-item-form-error').style.display = 'none';
  document.getElementById('service-item-form-section').style.display = 'block';
}

function closeServiceItemForm() {
  document.getElementById('service-item-form-section').style.display = 'none';
  editingServiceItemId = null;
}

async function submitServiceItemForm() {
  const labelEn = document.getElementById('service-item-label-en').value.trim();
  const labelZh = document.getElementById('service-item-label-zh').value.trim();
  const type = document.getElementById('service-item-type').value.trim().replace(/\s+/g, '_').toLowerCase();
  const sortOrder = parseInt(document.getElementById('service-item-sort').value) || 0;
  const errEl = document.getElementById('service-item-form-error');

  if (!labelEn || (!editingServiceItemId && !type)) {
    errEl.textContent = 'English label and internal key are required.';
    errEl.style.display = 'block';
    return;
  }

  const btn = document.getElementById('service-item-submit-btn');
  btn.disabled = true;
  btn.textContent = 'Saving...';

  try {
    let res;
    if (editingServiceItemId) {
      res = await fetch(`${API}/restaurants/${restaurantId}/service-request-items/${editingServiceItemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ label_en: labelEn, label_zh: labelZh || null, sort_order: sortOrder })
      });
    } else {
      res = await fetch(`${API}/restaurants/${restaurantId}/service-request-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ request_type: type, label_en: labelEn, label_zh: labelZh || null, sort_order: sortOrder })
      });
    }
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Save failed');
    }
    closeServiceItemForm();
    await loadServiceRequestItems();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = editingServiceItemId ? 'Save Changes' : 'Add Item';
  }
}

async function deleteServiceItem(id) {
  if (!confirm('Delete this service request item?')) return;
  try {
    const res = await fetch(`${API}/restaurants/${restaurantId}/service-request-items/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Delete failed');
    await loadServiceRequestItems();
  } catch (err) {
    alert('Failed to delete item: ' + err.message);
  }
}

// ============= CRM =============
let crmSearchTimer = null;

function hideCRMPage() {
  showCRMMain();
  hideSettingsPage('crm');
}

function showCRMMain() {
  document.getElementById('crm-main-view').style.display  = '';
  document.getElementById('crm-detail-view').style.display = 'none';
}

function onCRMSearch() {
  clearTimeout(crmSearchTimer);
  crmSearchTimer = setTimeout(loadCRMCustomers, 300);
}

async function loadCRMCustomers() {
  const search  = (document.getElementById('crm-search-input')?.value  || '').trim();
  const sort_by = document.getElementById('crm-sort-select')?.value || 'last_visit';

  const params = new URLSearchParams({ sort_by, limit: '100' });
  if (search) params.set('search', search);

  const listEl = document.getElementById('crm-customers-list');
  if (!listEl) return;
  listEl.innerHTML = '<p style="color:#999;text-align:center;padding:24px;">Loading…</p>';

  try {
    const res = await fetch(`${API}/restaurants/${restaurantId}/crm/customers?${params}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to load customers');
    const customers = await res.json();

    if (!customers.length) {
      listEl.innerHTML = '<p style="color:#999;text-align:center;padding:24px;">No customers found.</p>';
      return;
    }

    const fmt = v => v != null ? (Number(v) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';
    const fmtDate = v => v ? new Date(v).toLocaleDateString() : '—';

    const table = `
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="background:#f9fafb;text-align:left;">
            <th style="padding:10px 12px;border-bottom:2px solid #e5e7eb;">Name</th>
            <th style="padding:10px 12px;border-bottom:2px solid #e5e7eb;">Phone</th>
            <th style="padding:10px 12px;border-bottom:2px solid #e5e7eb;">Email</th>
            <th style="padding:10px 12px;border-bottom:2px solid #e5e7eb;text-align:center;">Visits</th>
            <th style="padding:10px 12px;border-bottom:2px solid #e5e7eb;text-align:right;">Total Spent</th>
            <th style="padding:10px 12px;border-bottom:2px solid #e5e7eb;">Last Visit</th>
            <th style="padding:10px 12px;border-bottom:2px solid #e5e7eb;">Joined</th>
          </tr>
        </thead>
        <tbody>
          ${customers.map(c => `
            <tr class="crm-customer-row" onclick="loadCRMCustomerDetail(${c.id})" style="cursor:pointer;border-bottom:1px solid #f3f4f6;transition:background 0.15s;">
              <td style="padding:10px 12px;font-weight:600;color:var(--primary-color);">${escapeHtml(c.name)}</td>
              <td style="padding:10px 12px;color:#6b7280;">${escapeHtml(c.phone || '—')}</td>
              <td style="padding:10px 12px;color:#6b7280;">${escapeHtml(c.email || '—')}</td>
              <td style="padding:10px 12px;text-align:center;">${c.total_visits || 0}</td>
              <td style="padding:10px 12px;text-align:right;">$${fmt(c.total_spent_cents)}</td>
              <td style="padding:10px 12px;">${fmtDate(c.last_visit_at)}</td>
              <td style="padding:10px 12px;">${fmtDate(c.created_at)}</td>
            </tr>`).join('')}
        </tbody>
      </table>`;
    listEl.innerHTML = table;
  } catch (err) {
    listEl.innerHTML = `<p style="color:#dc2626;text-align:center;padding:24px;">Failed to load customers: ${err.message}</p>`;
  }
}

async function loadCRMCustomerDetail(customerId) {
  document.getElementById('crm-main-view').style.display  = 'none';
  document.getElementById('crm-detail-view').style.display = '';

  const profileEl  = document.getElementById('crm-profile-card');
  const ordersEl   = document.getElementById('crm-orders-list');
  const futureBEl  = document.getElementById('crm-future-bookings');
  const pastBEl    = document.getElementById('crm-past-bookings');
  const couponsEl  = document.getElementById('crm-coupons-list');

  profileEl.innerHTML  = '<p style="color:#999;padding:16px;">Loading…</p>';
  ordersEl.innerHTML   = '<p style="color:#999;">Loading…</p>';
  futureBEl.innerHTML  = '<p style="color:#999;">Loading…</p>';
  pastBEl.innerHTML    = '<p style="color:#999;">Loading…</p>';
  couponsEl.innerHTML  = '<p style="color:#999;">Loading…</p>';

  try {
    const res = await fetch(`${API}/restaurants/${restaurantId}/crm/customers/${customerId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to load customer');
    const data = await res.json();
    const c = data.customer;

    const fmt     = v => v != null ? (Number(v) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00';
    const fmtDT   = v => v ? new Date(v).toLocaleString() : '—';
    const fmtDate = v => v ? new Date(v).toLocaleDateString() : '—';

    // Profile card
    profileEl.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;padding:16px;background:white;border-radius:8px;border:1px solid var(--border-color);">
        <div><div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">Name</div><div style="font-weight:700;font-size:16px;">${escapeHtml(c.name)}</div></div>
        <div><div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">Phone</div><div>${escapeHtml(c.phone || '—')}</div></div>
        <div><div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">Email</div><div>${escapeHtml(c.email || '—')}</div></div>
        <div><div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">Joined</div><div>${fmtDT(c.created_at)}</div></div>
        <div><div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">Total Orders</div><div style="font-size:20px;font-weight:700;color:var(--primary-color);">${c.total_visits || 0}</div></div>
        <div><div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">Total Transacted</div><div style="font-size:20px;font-weight:700;color:#059669;">$${fmt(data.total_transacted_cents)}</div></div>
        <div><div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">Last Visit</div><div>${fmtDate(c.last_visit_at)}</div></div>
        ${c.notes ? `<div style="grid-column:1/-1;"><div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">Notes</div><div style="color:#374151;">${escapeHtml(c.notes)}</div></div>` : ''}
      </div>`;

    // Orders
    if (data.orders && data.orders.length) {
      ordersEl.innerHTML = `
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead><tr style="background:#f9fafb;">
            <th style="padding:8px 10px;border-bottom:2px solid #e5e7eb;text-align:left;">Order #</th>
            <th style="padding:8px 10px;border-bottom:2px solid #e5e7eb;text-align:left;">Date</th>
            <th style="padding:8px 10px;border-bottom:2px solid #e5e7eb;text-align:left;">Type</th>
            <th style="padding:8px 10px;border-bottom:2px solid #e5e7eb;text-align:left;">Table</th>
            <th style="padding:8px 10px;border-bottom:2px solid #e5e7eb;text-align:center;">Pax</th>
            <th style="padding:8px 10px;border-bottom:2px solid #e5e7eb;text-align:left;">Status</th>
            <th style="padding:8px 10px;border-bottom:2px solid #e5e7eb;text-align:left;">Payment</th>
            <th style="padding:8px 10px;border-bottom:2px solid #e5e7eb;text-align:right;">Amount</th>
          </tr></thead>
          <tbody>
            ${data.orders.map(o => `
              <tr style="border-bottom:1px solid #f3f4f6;">
                <td style="padding:8px 10px;font-weight:600;">#${o.restaurant_order_number || o.order_id}</td>
                <td style="padding:8px 10px;color:#6b7280;">${fmtDT(o.created_at)}</td>
                <td style="padding:8px 10px;">${escapeHtml(o.order_type || '—')}</td>
                <td style="padding:8px 10px;">${escapeHtml(o.table_label || '—')}</td>
                <td style="padding:8px 10px;text-align:center;">${o.pax || '—'}</td>
                <td style="padding:8px 10px;">${escapeHtml(o.status || '—')}</td>
                <td style="padding:8px 10px;">${escapeHtml(o.payment_method || '—')}</td>
                <td style="padding:8px 10px;text-align:right;font-weight:600;">$${fmt(o.total_cents)}</td>
              </tr>`).join('')}
          </tbody>
        </table>`;
    } else {
      ordersEl.innerHTML = '<p style="color:#9ca3af;font-size:13px;">No orders on record.</p>';
    }

    // Helper: render bookings table
    const renderBookings = (bookings, container) => {
      if (!bookings || !bookings.length) {
        container.innerHTML = '<p style="color:#9ca3af;font-size:13px;">None.</p>';
        return;
      }
      container.innerHTML = `
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead><tr style="background:#f9fafb;">
            <th style="padding:8px 10px;border-bottom:2px solid #e5e7eb;text-align:left;">Date</th>
            <th style="padding:8px 10px;border-bottom:2px solid #e5e7eb;text-align:left;">Time</th>
            <th style="padding:8px 10px;border-bottom:2px solid #e5e7eb;text-align:left;">Table</th>
            <th style="padding:8px 10px;border-bottom:2px solid #e5e7eb;text-align:center;">Pax</th>
            <th style="padding:8px 10px;border-bottom:2px solid #e5e7eb;text-align:left;">Status</th>
            <th style="padding:8px 10px;border-bottom:2px solid #e5e7eb;text-align:left;">Notes</th>
          </tr></thead>
          <tbody>
            ${bookings.map(b => `
              <tr style="border-bottom:1px solid #f3f4f6;">
                <td style="padding:8px 10px;">${fmtDate(b.booking_date)}</td>
                <td style="padding:8px 10px;">${b.booking_time || '—'}</td>
                <td style="padding:8px 10px;">${escapeHtml(b.table_label || '—')}</td>
                <td style="padding:8px 10px;text-align:center;">${b.pax || '—'}</td>
                <td style="padding:8px 10px;"><span class="crm-status-badge crm-status-${b.status}">${b.status}</span></td>
                <td style="padding:8px 10px;color:#6b7280;">${escapeHtml(b.notes || '')}</td>
              </tr>`).join('')}
          </tbody>
        </table>`;
    };

    renderBookings(data.future_bookings, futureBEl);
    renderBookings(data.past_bookings,   pastBEl);

    // Eligible coupons
    if (data.eligible_coupons && data.eligible_coupons.length) {
      couponsEl.innerHTML = data.eligible_coupons.map(cp => {
        const disc = cp.discount_type === 'percentage'
          ? `${cp.discount_value}% off`
          : `$${(Number(cp.discount_value) || 0).toFixed(2)} off`;
        const expiry = cp.valid_until ? `Expires ${fmtDate(cp.valid_until)}` : 'No expiry';
        const minOrder = cp.min_order_cents ? `Min order $${fmt(cp.min_order_cents)}` : '';
        return `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px 14px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:8px;">
          <div><strong style="font-family:monospace;font-size:15px;letter-spacing:1px;">${escapeHtml(cp.code)}</strong></div>
          <div style="font-size:13px;color:#166534;">${disc}</div>
          ${minOrder ? `<div style="font-size:12px;color:#6b7280;">${minOrder}</div>` : ''}
          <div style="font-size:12px;color:#6b7280;">${expiry}</div>
        </div>`;
      }).join('');
    } else {
      couponsEl.innerHTML = '<p style="color:#9ca3af;font-size:13px;">No eligible coupons.</p>';
    }

  } catch (err) {
    profileEl.innerHTML = `<p style="color:#dc2626;padding:16px;">Failed to load: ${err.message}</p>`;
  }
}