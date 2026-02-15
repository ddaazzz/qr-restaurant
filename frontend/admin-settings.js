// ============= SETTINGS MANAGEMENT =============

let ADMIN_SETTINGS_CACHE = {};
let SETTINGS_EDIT_MODE = {};
let STAGED_LOGO = null;

// Load and render settings (stub - modals are used now)
async function loadAdminSettings() {
  // This function is kept for backward compatibility
  // Modals are initialized when opened via openSettingsModal()
}

// Fetch and cache settings (called from admin.js)
async function initializeSettingsOnPageLoad() {
  try {
    const res = await fetch(`${API}/${restaurantId}/settings`);
    const settings = await res.json();
    ADMIN_SETTINGS_CACHE = { ...settings };
    
    if (typeof serviceChargeFee !== 'undefined') {
      serviceChargeFee = settings.service_charge_percent;
    }
    applyThemeColor(settings.theme_color);
  } catch (err) {
    console.error("Failed to initialize settings on page load:", err);
  }
}

function applyThemeColor(color) {
  if (!color) return;
  document.documentElement.style.setProperty("--primary-color", color);
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
    }
  }
}

function closeSettingsModal(modalName) {
  const modal = document.getElementById(`modal-${modalName}`);
  if (modal) {
    modal.classList.add('hidden');
  }
}

// ============= MODAL INITIALIZATION FUNCTIONS =============

// Load Restaurant Information Modal
async function loadRestaurantInfoModal() {
  try {
    const res = await fetch(`${API}/${restaurantId}/settings`);
    const settings = await res.json();
    
    document.getElementById('view-name').textContent = settings.name || 'Not set';
    document.getElementById('view-phone').textContent = settings.phone || 'Not set';
    document.getElementById('view-address').textContent = settings.address || 'Not set';
    document.getElementById('view-service-charge').textContent = (settings.service_charge_percent || 0) + '%';
    document.getElementById('view-color').innerHTML = `<div style="width: 40px; height: 40px; background: ${settings.theme_color || '#000'}; border-radius: 4px;"></div>`;
    
    // Populate input fields for edit mode
    document.getElementById('restaurant-name').value = settings.name || '';
    document.getElementById('restaurant-phone').value = settings.phone || '';
    document.getElementById('restaurant-address').value = settings.address || '';
    document.getElementById('serviceChargeInput').value = settings.service_charge_percent || 0;
    document.getElementById('colorInput').value = settings.theme_color || '#4a90e2';
    
    if (settings.logo_url) {
      document.getElementById('restaurant-logo').src = settings.logo_url;
      document.getElementById('restaurant-logo').classList.remove('hidden');
    }
  } catch (err) {
    console.error("Failed to load restaurant info:", err);
  }
}

// Load POS Integration Modal
async function loadPOSIntegrationModal() {
  try {
    const res = await fetch(`${API}/${restaurantId}/settings`);
    const settings = await res.json();
    
    document.getElementById('view-webhook-url').textContent = settings.pos_webhook_url ? settings.pos_webhook_url.substring(0, 50) + '...' : 'Not configured';
    document.getElementById('view-api-key').textContent = settings.pos_api_key ? '••••••••••••••••' : 'Not configured';
    document.getElementById('view-pos-system').textContent = settings.pos_system_type || 'Not selected';
    
    document.getElementById('pos-webhook-url').value = settings.pos_webhook_url || '';
    document.getElementById('pos-api-key').value = settings.pos_api_key || '';
    document.getElementById('pos-system-type').value = settings.pos_system_type || '';
    
    // Update connection status
    const statusDiv = document.getElementById('pos-connection-status');
    if (settings.pos_webhook_url && settings.pos_api_key) {
      statusDiv.innerHTML = '🟢 Configured';
      statusDiv.style.background = '#f0fdf4';
      statusDiv.style.color = '#166534';
    } else {
      statusDiv.innerHTML = '🔴 Not Configured';
      statusDiv.style.background = '#fef2f2';
      statusDiv.style.color = '#991b1b';
    }
  } catch (err) {
    console.error("Failed to load POS settings:", err);
  }
}

// Load Staff Login Links Modal
async function loadStaffLoginLinksModal() {
  try {
    const rid = restaurantId || localStorage.getItem('restaurantId');
    if (!rid) {
      console.warn('restaurantId not found');
      return;
    }
    
    const staffLinkEl = document.getElementById('staff-link');
    const kitchenLinkEl = document.getElementById('kitchen-link');
    
    if (!staffLinkEl || !kitchenLinkEl) {
      console.warn('Staff link input elements not found');
      return;
    }
    
    const staffLink = `${window.location.origin}/staff.html?rid=${rid}`;
    const kitchenLink = `${window.location.origin}/kitchen.html?rid=${rid}`;
    
    staffLinkEl.value = staffLink;
    kitchenLinkEl.value = kitchenLink;
    
    console.log('Staff login links loaded:', { staffLink, kitchenLink });
  } catch (err) {
    console.error("Failed to load staff login links:", err);
  }
}

// Load QR Settings Modal
async function loadQRSettingsModal() {
  try {
    const res = await fetch(`${API}/${restaurantId}/settings`);
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
      couponsList.innerHTML = coupons.map(coupon => `
        <div style="background: #f5f5f5; padding: 12px; border-radius: 6px; border-left: 4px solid #4a90e2;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <strong>${coupon.code}</strong><br>
              <small style="color: #666;">
                ${coupon.discount_type === 'percentage' ? coupon.discount_value + '%' : '$' + coupon.discount_value} off
              </small>
            </div>
            <button onclick="deleteCoupon(${coupon.id})" class="btn-danger" style="padding: 6px 12px; font-size: 12px;">Delete</button>
          </div>
        </div>
      `).join('');
    }
  } catch (err) {
    console.error("Failed to load coupons:", err);
  }
}

// Load Booking Settings Modal
async function loadBookingSettingsModal() {
  try {
    const res = await fetch(`${API}/${restaurantId}/settings`);
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
  document.getElementById('view-service-charge').classList.add('hidden');
  document.getElementById('view-color').classList.add('hidden');
  
  document.getElementById('restaurant-name').classList.remove('hidden');
  document.getElementById('restaurant-phone').classList.remove('hidden');
  document.getElementById('restaurant-address').classList.remove('hidden');
  document.getElementById('serviceChargeInput').classList.remove('hidden');
  document.getElementById('colorInput').classList.remove('hidden');
  document.getElementById('logoInput').classList.remove('hidden');
  
  document.getElementById('edit-settings-btn').classList.add('hidden');
  document.getElementById('save-settings-btn').classList.remove('hidden');
  document.getElementById('cancel-settings-btn').classList.remove('hidden');
}

function cancelEditMode() {
  document.getElementById('view-name').classList.remove('hidden');
  document.getElementById('view-phone').classList.remove('hidden');
  document.getElementById('view-address').classList.remove('hidden');
  document.getElementById('view-service-charge').classList.remove('hidden');
  document.getElementById('view-color').classList.remove('hidden');
  
  document.getElementById('restaurant-name').classList.add('hidden');
  document.getElementById('restaurant-phone').classList.add('hidden');
  document.getElementById('restaurant-address').classList.add('hidden');
  document.getElementById('serviceChargeInput').classList.add('hidden');
  document.getElementById('colorInput').classList.add('hidden');
  document.getElementById('logoInput').classList.add('hidden');
  
  document.getElementById('edit-settings-btn').classList.remove('hidden');
  document.getElementById('save-settings-btn').classList.add('hidden');
  document.getElementById('cancel-settings-btn').classList.add('hidden');
}

// Toggle Coupon Edit/Add Mode
function toggleCouponEditMode() {
  const addForm = document.getElementById('add-coupon-form');
  const editBtn = document.getElementById('coupon-edit-btn');
  
  if (!addForm) {
    console.warn('add-coupon-form not found');
    return;
  }
  
  if (addForm.classList.contains('hidden')) {
    addForm.classList.remove('hidden');
    editBtn.classList.add('hidden');
  } else {
    addForm.classList.add('hidden');
    editBtn.classList.remove('hidden');
  }
}

// Save Restaurant Settings
async function saveAdminSettings() {
  const payload = {
    name: document.getElementById('restaurant-name').value,
    phone: document.getElementById('restaurant-phone').value,
    address: document.getElementById('restaurant-address').value,
    service_charge_percent: parseFloat(document.getElementById('serviceChargeInput').value) || 0,
    theme_color: document.getElementById('colorInput').value
  };
  
  try {
    const res = await fetch(`${API}/${restaurantId}/settings`, {
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
  
  fetch(`${API}/${restaurantId}/logo`, {
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
    const res = await fetch(`${API}/${restaurantId}/settings`, {
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
    const res = await fetch(`${API}/${restaurantId}/settings`, {
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
  const code = document.getElementById('new-coupon-code').value.toUpperCase();
  const type = document.getElementById('new-coupon-type').value;
  const value = parseFloat(document.getElementById('new-coupon-value').value);
  const minOrder = parseFloat(document.getElementById('new-coupon-min-order').value) || 0;
  const maxUses = document.getElementById('new-coupon-max-uses').value ? parseInt(document.getElementById('new-coupon-max-uses').value) : null;
  const validUntil = document.getElementById('new-coupon-valid-until').value;
  const description = document.getElementById('new-coupon-description').value;
  
  if (!code || !type || !value) {
    alert('Please fill in all required fields');
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
        valid_until: validUntil,
        description
      })
    });
    
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create coupon');
    }
    
    alert('Coupon created successfully!');
    document.getElementById('new-coupon-code').value = '';
    document.getElementById('new-coupon-value').value = '';
    document.getElementById('new-coupon-description').value = '';
    document.getElementById('new-coupon-valid-until').value = '';
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
    const res = await fetch(`${API}/${restaurantId}/settings`, {
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
