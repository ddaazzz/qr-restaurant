/**
 * Kitchen Order Printer Module
 * Handles multi-printer configuration with category routing
 */

// Global state for kitchen printers - only declare if not already present
if (typeof window.kitchenPrinters === 'undefined') {
  window.kitchenPrinters = [];
}
if (typeof window.availableMenuCategories === 'undefined') {
  window.availableMenuCategories = [];
}

/**
 * Load kitchen printers from API response (called during initial settings load)
 */
function loadKitchenPrintersFromAPI(printersArray) {
  try {
    console.log('[admin-printer-kitchen.js] loadKitchenPrintersFromAPI called with:', printersArray);
    if (Array.isArray(printersArray) && printersArray.length > 0) {
      window.kitchenPrinters = printersArray.map(printer => ({
        ...printer,
        id: printer.id || `printer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      }));
      console.log('[admin-printer-kitchen.js] Loaded', window.kitchenPrinters.length, 'kitchen printers');
    }
  } catch (err) {
    console.error('[admin-printer-kitchen.js] Error loading kitchen printers from API:', err);
  }
}

/**
 * Load kitchen format UI
 */
async function loadKitchenFormatUI() {
  try {
    console.log('[admin-printer-kitchen.js] loadKitchenFormatUI called');
    
    // First, try to load saved printers from currentPrinterSettings if available
    if (window.currentPrinterSettings && Array.isArray(window.currentPrinterSettings.kitchen_printers) && window.currentPrinterSettings.kitchen_printers.length > 0) {
      console.log('[admin-printer-kitchen.js] Loading saved kitchen printers from currentPrinterSettings');
      window.kitchenPrinters = window.currentPrinterSettings.kitchen_printers.map(p => ({
        id: p.id || `printer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: p.name || 'Kitchen Printer',
        type: p.type || 'network',
        host: p.host || '',
        bluetoothDevice: p.bluetoothDevice || '',
        categories: Array.isArray(p.categories) ? p.categories : []
      }));
      console.log('[admin-printer-kitchen.js] Loaded', window.kitchenPrinters.length, 'kitchen printers from settings');
    } else {
      // Initialize empty array if no saved printers
      window.kitchenPrinters = [];
      console.log('[admin-printer-kitchen.js] No saved kitchen printers, starting fresh');
    }
    
    // Fetch menu categories from API (MUST wait for this to complete)
    await loadMenuCategories();
    console.log('[admin-printer-kitchen.js] Categories loaded, now rendering UI');
    
    // Now render with categories available
    renderKitchenPrintersList();
    updateAddPrinterButton();
    
    console.log('[admin-printer-kitchen.js] Kitchen UI fully loaded');
  } catch (err) {
    console.error('[admin-printer-kitchen.js] Error loading kitchen format UI:', err);
    // Still render even if categories fail (will use fallback)
    renderKitchenPrintersList();
    updateAddPrinterButton();
  }
}

/**
 * Fetch available menu categories from API
 */
async function loadMenuCategories() {
  try {
    const restaurantId = localStorage.getItem('restaurantId');
    if (!restaurantId) {
      console.warn('[admin-printer-kitchen.js] No restaurantId found, using fallback categories');
      setFallbackCategories();
      return;
    }
    
    // Fetch menu categories from the correct API endpoint
    const response = await fetch(`${API}/restaurants/${restaurantId}/menu_categories`);
    
    if (!response.ok) {
      console.warn('[admin-printer-kitchen.js] Failed to fetch categories, using fallback');
      setFallbackCategories();
      return;
    }
    
    const data = await response.json();
    
    // Handle both array and object responses
    if (Array.isArray(data)) {
      window.availableMenuCategories = data.map(cat => ({
        id: cat.id,
        name: cat.name
      }));
    } else if (data && Array.isArray(data.categories)) {
      window.availableMenuCategories = data.categories.map(cat => ({
        id: cat.id,
        name: cat.name
      }));
    } else {
      window.availableMenuCategories = [];
    }
    
    if (window.availableMenuCategories.length === 0) {
      console.warn('[admin-printer-kitchen.js] No categories returned, using fallback');
      setFallbackCategories();
    } else {
      console.log('[admin-printer-kitchen.js] Menu categories loaded:', window.availableMenuCategories);
    }
  } catch (err) {
    console.error('[admin-printer-kitchen.js] Error loading categories:', err);
    setFallbackCategories();
  }
}

/**
 * Set fallback categories when API fails
 */
function setFallbackCategories() {
  window.availableMenuCategories = [
    { id: 1, name: 'Appetizers' },
    { id: 2, name: 'Main Courses' },
    { id: 3, name: 'Soups' },
    { id: 4, name: 'Desserts' },
    { id: 5, name: 'Beverages' }
  ];
  console.log('[admin-printer-kitchen.js] Using fallback categories:', window.availableMenuCategories);
}

/**
 * Add a new kitchen printer
 */
function addKitchenPrinter() {
  if (window.kitchenPrinters.length >= 3) {
    alert('⚠️ Maximum 3 printers per restaurant');
    return;
  }
  
  const newPrinter = {
    id: Math.random().toString(36).substr(2, 9),
    name: `Printer ${window.kitchenPrinters.length + 1}`,
    categories: [],
    type: 'network',
    host: '',
    bluetoothDevice: ''
  };
  
  window.kitchenPrinters.push(newPrinter);
  renderKitchenPrintersList();
  updateAddPrinterButton();
  console.log('[admin-printer-kitchen.js] Added printer:', newPrinter);
}

/**
 * Remove a kitchen printer
 */
function removeKitchenPrinter(printerId) {
  window.kitchenPrinters = window.kitchenPrinters.filter(p => p.id !== printerId);
  renderKitchenPrintersList();
  updateAddPrinterButton();
  console.log('[admin-printer-kitchen.js] Removed printer:', printerId);
}

/**
 * Toggle category for a printer
 */
function togglePrinterCategory(printerId, categoryId) {
  const printer = window.kitchenPrinters.find(p => p.id === printerId);
  if (!printer) {
    console.warn(`[admin-printer-kitchen.js] Printer ${printerId} not found`);
    return;
  }
  
  // Ensure categoryId is a number for consistency
  const catId = Number(categoryId);
  
  // Toggle category in array
  const idx = printer.categories.findIndex(c => Number(c) === catId);
  if (idx > -1) {
    printer.categories.splice(idx, 1);
    console.log(`[admin-printer-kitchen.js] Removed category ${catId} from printer ${printerId}`);
  } else {
    printer.categories.push(catId);
    console.log(`[admin-printer-kitchen.js] Added category ${catId} to printer ${printerId}`);
  }
  
  console.log(`[admin-printer-kitchen.js] Updated categories for ${printerId}:`, printer.categories);
  renderKitchenPrintersList();
}

/**
 * Render the list of kitchen printers with category selection
 */
function renderKitchenPrintersList() {
  const container = document.getElementById('kitchen-printers-list');
  if (!container) return;
  
  console.log('[admin-printer-kitchen.js] renderKitchenPrintersList - categories available:', window.availableMenuCategories.length, 'printers:', window.kitchenPrinters.length);
  
  if (window.kitchenPrinters.length === 0) {
    container.innerHTML = '<p class="kitchen-empty-state">No printers added yet. Click "+ Add Printer" to get started.</p>';
    return;
  }
  
  let html = ''; 
  
  window.kitchenPrinters.forEach((printer, idx) => {
    const selectedCategoriesDisplay = printer.categories.length > 0 
      ? printer.categories.map(catId => window.availableMenuCategories.find(c => c.id === catId)?.name || `ID ${catId}`).join(', ')
      : 'None selected';
    
    const networkFields = `
      <div class="kitchen-printer-field">
        <label>Network Address</label>
        <input type="text" placeholder="192.168.1.100 or printer.local" value="${printer.host || ''}" onchange="updatePrinterHost('${printer.id}', this.value)" />
        <p class="field-hint">IP address or hostname of the network printer</p>
      </div>
    `;

    const bluetoothFields = `
      <div class="kitchen-printer-field">
        <label>Bluetooth Device</label>
        <button onclick="scanBluetoothDeviceForKitchen('${printer.id}')" class="btn-secondary" style="width:100%;">🔵 Scan Bluetooth Device</button>
        ${printer.bluetoothDevice ? `<p class="field-hint success">✓ Connected: ${printer.bluetoothDevice}</p>` : ''}
      </div>
    `;

    const categoryGrid = window.availableMenuCategories.length > 0
      ? `<div class="kitchen-categories-grid">
          ${window.availableMenuCategories.map(cat => {
            const isChecked = printer.categories.some(c => Number(c) === Number(cat.id));
            return `<label class="kitchen-category-label">
              <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="togglePrinterCategory('${printer.id}', ${cat.id})" />
              <span>${cat.name}</span>
            </label>`;
          }).join('')}
        </div>`
      : `<div class="kitchen-categories-loading">⏳ Loading menu categories...</div>`;

    const categoryStatus = printer.categories.length === 0
      ? '<p class="category-status-warning">⚠️ Select at least one category for this printer</p>'
      : `<p class="category-status-ok">✓ Routing: ${selectedCategoriesDisplay}</p>`;

    html += `
      <div class="kitchen-printer-card">
        <div class="kitchen-printer-card-header">
          <div class="kitchen-printer-header-left">
            <input type="text" class="kitchen-printer-name-input" value="${printer.name}" onchange="updatePrinterName('${printer.id}', this.value)" />
            <span class="kitchen-printer-index">#${idx + 1}</span>
          </div>
          <button onclick="removeKitchenPrinter('${printer.id}')" class="btn-danger">Remove</button>
        </div>

        <div class="kitchen-printer-field">
          <label>Printer Type</label>
          <select onchange="updatePrinterType('${printer.id}', this.value)">
            <option value="network" ${printer.type === 'network' ? 'selected' : ''}>Network Printer</option>
            <option value="bluetooth" ${printer.type === 'bluetooth' ? 'selected' : ''}>Bluetooth Printer</option>
          </select>
        </div>

        ${printer.type === 'network' ? networkFields : bluetoothFields}

        <div class="kitchen-printer-field">
          <label>📍 Route Categories (${printer.categories.length}/${window.availableMenuCategories.length})</label>
          ${categoryGrid}
          ${categoryStatus}
        </div>
      </div>
    `;
  });
  
  container.innerHTML = html;
}

/**
 * Update printer name
 */
function updatePrinterName(printerId, newName) {
  const printer = window.kitchenPrinters.find(p => p.id === printerId);
  if (printer) {
    printer.name = newName;
    console.log('[admin-printer-kitchen.js] Updated printer name:', printerId, newName);
  }
}

/**
 * Update printer type
 */
function updatePrinterType(printerId, newType) {
  const printer = window.kitchenPrinters.find(p => p.id === printerId);
  if (printer) {
    printer.type = newType;
    renderKitchenPrintersList();
    console.log('[admin-printer-kitchen.js] Updated printer type:', printerId, newType);
  }
}

/**
 * Update printer network host
 */
function updatePrinterHost(printerId, newHost) {
  const printer = window.kitchenPrinters.find(p => p.id === printerId);
  if (printer) {
    printer.host = newHost;
    console.log('[admin-printer-kitchen.js] Updated printer host:', printerId, newHost);
  }
}

/**
 * Scan Bluetooth device for kitchen printer
 */
async function scanBluetoothDeviceForKitchen(printerId) {
  try {
    if (!navigator.bluetooth) {
      alert('❌ Bluetooth not supported on this browser');
      return;
    }
    
    const device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: ['generic_access']
    });
    
    if (device && device.name) {
      const printer = window.kitchenPrinters.find(p => p.id === printerId);
      if (printer) {
        printer.bluetoothDevice = device.name;
        renderKitchenPrintersList();
        console.log('[admin-printer-kitchen.js] Selected Bluetooth device:', device.name);
      }
    }
  } catch (err) {
    if (err.name !== 'NotFoundError') {
      console.error('[admin-printer-kitchen.js] Bluetooth scan error:', err);
    }
  }
}

/**
 * Update the "Add Printer" button state
 */
function updateAddPrinterButton() {
  const btn = document.getElementById('add-kitchen-printer-btn');
  if (!btn) return;
  
  if (window.kitchenPrinters.length >= 3) {
    btn.disabled = true;
    btn.style.opacity = '0.5';
    btn.style.cursor = 'not-allowed';
    btn.textContent = '✓ Maximum Printers Added (3)';
  } else {
    btn.disabled = false;
    btn.style.opacity = '1';
    btn.style.cursor = 'pointer';
    btn.textContent = `+ Add Printer (${window.kitchenPrinters.length}/3)`;
  }
}

/**
 * Get kitchen printer configuration for saving
 */
function getKitchenPrinterConfig() {
  // Validate all printers have at least one category
  const invalid = window.kitchenPrinters.filter(p => p.categories.length === 0);
  if (invalid.length > 0) {
    throw new Error('Each printer must have at least one category assigned');
  }
  
  // Build kitchen_printers array
  const configuredPrinters = window.kitchenPrinters.map(p => ({
    name: p.name,
    type: p.type,
    host: p.type === 'network' ? p.host : null,
    bluetooth_device: p.type === 'bluetooth' ? p.bluetoothDevice : null,
    categories: p.categories
  }));
  
  // Return config with kitchen_printer_type indicator and full printers array
  return {
    kitchen_printer_type: 'configured',
    kitchen_printers: configuredPrinters
  };
}
