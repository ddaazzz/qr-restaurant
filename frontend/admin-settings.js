// ============= SETTINGS MANAGEMENT =============

// Initialization gate
let settingsInitialized = false;

let ADMIN_SETTINGS_CACHE = {};
let SETTINGS_EDIT_MODE = {};
let STAGED_LOGO = null;

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
      case 'pos-integration':
        await loadPOSIntegrationModal();
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
  const modal = document.getElementById(`modal-${modalName}`);
  if (modal) {
    modal.classList.add('hidden');
  }
}

// ============= PRINTER SETTINGS PAGE MANAGEMENT =============
function showPrinterSettings() {
  // Hide settings grid
  const settingsGrid = document.querySelector('.settings-cards-grid');
  if (settingsGrid) {
    settingsGrid.style.display = 'none';
  }

  // Show printer settings page
  const printerPage = document.getElementById('printer-settings-page');
  if (printerPage) {
    printerPage.classList.remove('hidden');
    
    // Load printer settings content
    loadPrinterSettings().then(() => {
      // After printer settings load, initialize QR preview
      setTimeout(() => {
        fetchRestaurantDataForQRFormat().then(() => {
          updateQRPreview();
        });
      }, 100);
    });
  }
}

function hidePrinterSettings() {
  // Hide printer settings page
  const printerPage = document.getElementById('printer-settings-page');
  if (printerPage) {
    printerPage.classList.add('hidden');
  }

  // Show settings grid
  const settingsGrid = document.querySelector('.settings-cards-grid');
  if (settingsGrid) {
    settingsGrid.style.display = '';
  }

  // Reset any edit mode
  const editBtn = document.getElementById('edit-printer-btn');
  const saveBtn = document.getElementById('save-printer-btn');
  if (editBtn && saveBtn && saveBtn.classList.contains('hidden') === false) {
    cancelEditModePrinter();
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
      updateQRPreview();
      fetchRestaurantDataForQRFormat();
    }, 50);
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
    colorSwatch.style.backgroundColor = settings.theme_color || '#000';
    document.getElementById('view-color').innerHTML = '';
    document.getElementById('view-color').appendChild(colorSwatch);
    
    // Populate input fields for edit mode
    document.getElementById('restaurant-name').value = settings.name || '';
    document.getElementById('restaurant-phone').value = settings.phone || '';
    document.getElementById('restaurant-address').value = settings.address || '';
    document.getElementById('timezone-select').value = settings.timezone || 'UTC';
    document.getElementById('serviceChargeInput').value = settings.service_charge_percent || 0;
    document.getElementById('colorInput').value = settings.theme_color || '#4a90e2';
    
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

// Load POS Integration Modal
async function loadPOSIntegrationModal() {
  try {
    const res = await fetch(`${API}/restaurants/${restaurantId}/settings`);
    const settings = await res.json();
    
    document.getElementById('view-webhook-url').textContent = settings.pos_webhook_url ? settings.pos_webhook_url.substring(0, 50) + '...' : 'Not configured';
    document.getElementById('view-api-key').textContent = settings.pos_api_key ? '••••••••••••••••' : 'Not configured';
    document.getElementById('view-pos-system').textContent = settings.pos_system_type || 'Not selected';
    
    document.getElementById('pos-webhook-url').value = settings.pos_webhook_url || '';
    document.getElementById('pos-api-key').value = settings.pos_api_key || '';
    document.getElementById('pos-system-type').value = settings.pos_system_type || '';
    
    // Update connection status
    const statusDiv = document.getElementById('pos-connection-status');
    const hasConfig = settings.pos_webhook_url && settings.pos_api_key;
    
    // Use POS status template
    const statusTemplate = document.getElementById('pos-status-template');
    const statusElement = statusTemplate.content.cloneNode(true);
    const statusContent = statusElement.querySelector('div');
    
    if (hasConfig) {
      statusContent.textContent = '🟢 Configured';
      statusContent.style.background = '#f0fdf4';
      statusContent.style.color = '#166534';
    } else {
      statusContent.textContent = '🔴 Not Configured';
      statusContent.style.background = '#fef2f2';
      statusContent.style.color = '#991b1b';
    }
    
    statusDiv.innerHTML = '';
    statusDiv.appendChild(statusElement);
  } catch (err) {
    console.error("Failed to load POS settings:", err);
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
  const qrElement = document.getElementById(qrElementId);
  const canvas = qrElement.querySelector('canvas');
  
  if (!canvas) {
    alert('❌ QR code not generated yet. Please reload the modal.');
    return;
  }
  
  const printWindow = window.open();
  const img = canvas.toDataURL('image/png');
  printWindow.document.write(`<img src="${img}" style="max-width: 100%; margin: 20px;" />`);
  printWindow.document.close();
  printWindow.print();
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
  } catch (err) {
    console.error("Failed to load QR settings:", err);
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
      
      // Use coupon list template
      const couponTemplate = document.getElementById('coupon-list-template');
      couponsList.innerHTML = '';
      
      coupons.forEach(coupon => {
        const couponElement = couponTemplate.content.cloneNode(true);
        couponElement.querySelector('[data-coupon-code]').textContent = coupon.code;
        couponElement.querySelector('[data-coupon-discount]').textContent = 
          coupon.discount_type === 'percentage' ? coupon.discount_value + '%' : '$' + coupon.discount_value + ' off';
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

// Toggle Coupon Edit/Add Mode
function toggleCouponEditMode() {
  const editView = document.getElementById('coupon-edit-view');
  const editBtn = document.getElementById('coupon-edit-btn');
  
  if (!editView) {
    console.warn('coupon-edit-view not found');
    return;
  }
  
  if (editView.style.display === 'none' || !editView.style.display) {
    editView.style.display = 'flex';
    editBtn.style.display = 'none';
    document.getElementById('new-coupon-code').focus();
  } else {
    editView.style.display = 'none';
    editBtn.style.display = 'block';
  }
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
function enterEditModePOS() {
  document.getElementById('view-webhook-url').classList.add('hidden');
  document.getElementById('view-api-key').classList.add('hidden');
  document.getElementById('view-pos-system').classList.add('hidden');
  
  document.getElementById('pos-webhook-url').classList.remove('hidden');
  document.getElementById('pos-api-key').classList.remove('hidden');
  document.getElementById('pos-system-type').classList.remove('hidden');
  
  document.getElementById('edit-pos-btn').classList.add('hidden');
  document.getElementById('save-pos-btn').classList.remove('hidden');
  document.getElementById('test-pos-btn').classList.remove('hidden');
  document.getElementById('cancel-pos-btn').classList.remove('hidden');
}

function cancelEditModePOS() {
  document.getElementById('view-webhook-url').classList.remove('hidden');
  document.getElementById('view-api-key').classList.remove('hidden');
  document.getElementById('view-pos-system').classList.remove('hidden');
  
  document.getElementById('pos-webhook-url').classList.add('hidden');
  document.getElementById('pos-api-key').classList.add('hidden');
  document.getElementById('pos-system-type').classList.add('hidden');
  
  document.getElementById('edit-pos-btn').classList.remove('hidden');
  document.getElementById('save-pos-btn').classList.add('hidden');
  document.getElementById('test-pos-btn').classList.add('hidden');
  document.getElementById('cancel-pos-btn').classList.add('hidden');
}

async function savePOSSettings() {
  const payload = {
    pos_webhook_url: document.getElementById('pos-webhook-url').value,
    pos_api_key: document.getElementById('pos-api-key').value,
    pos_system_type: document.getElementById('pos-system-type').value
  };
  
  try {
    const res = await fetch(`${API}/restaurants/${restaurantId}/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!res.ok) throw new Error('Failed to save');
    
    alert('POS settings saved successfully!');
    cancelEditModePOS();
    await loadPOSIntegrationModal();
  } catch (err) {
    console.error("Error saving POS settings:", err);
    alert('Failed to save POS settings');
  }
}

async function testPOSConnection() {
  const webhookUrl = document.getElementById('pos-webhook-url').value;
  const apiKey = document.getElementById('pos-api-key').value;
  
  if (!webhookUrl || !apiKey) {
    alert('Please enter both webhook URL and API key');
    return;
  }
  
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({ test: true })
    });
    
    if (res.ok) {
      alert('✓ POS Connection Successful!');
    } else {
      alert('✗ POS Connection Failed - Check credentials');
    }
  } catch (err) {
    alert('✗ Connection Error - Check URL and network');
  }
}

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

// Coupons Management
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

async function createCoupon() {
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
    const res = await fetch(`${API}/restaurants/${restaurantId}/coupons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        discount_type: type,
        discount_value: value,
        minimum_order_value: minOrder,
        max_uses: maxUses,
        valid_until: validUntil || null,
        description
      })
    });
    
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create coupon');
    }
    
    alert('Coupon created successfully!');
    clearCouponForm();
    toggleCouponEditMode(); // Hide the form after successful creation
    await loadCouponsModal();
  } catch (err) {
    console.error("Error creating coupon:", err);
    alert('Failed to create coupon: ' + err.message);
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
  if (printerType === 'thermal' || printerType === 'usb') {
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
                    <div style="font-size: 12px; color: #666; margin-top: 2px;">ID: ${device.deviceId.substring(0, 16)}...</div>
                    ${device.lastConnected ? '<div style="font-size: 11px; color: #999; margin-top: 2px;">Last used: ' + new Date(device.lastConnected).toLocaleDateString() + '</div>' : ''}
                  </div>
                  ${selectedBadge}
                </div>
              </div>`;
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
    scanBtn.textContent = '🔍 Scan New Device';  }
}