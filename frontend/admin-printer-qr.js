/**
 * QR Code Printer Module
 * Handles multi-printer configuration with per-printer table routing
 */

// Global state
if (typeof window.qrPrinters === 'undefined') window.qrPrinters = [];
if (typeof window.availableTablesForPrinting === 'undefined') window.availableTablesForPrinting = [];

// ─── Initialise ────────────────────────────────────────────────────────────────

/**
 * Called by admin-printer.js when settings load from the API.
 * Populates window.qrPrinters from the saved printers array.
 */
function loadQRPrintersFromAPI(printersArray) {
  if (Array.isArray(printersArray) && printersArray.length > 0) {
    window.qrPrinters = printersArray.map(p => ({
      ...p,
      id: p.id || _qrGenId(),
      tables: Array.isArray(p.tables) ? p.tables : 'all'
    }));
  }
}

/**
 * Called by selectPrinterType('qr').
 * Loads saved printers from currentPrinterSettings and renders the list.
 */
async function loadQRFormatUI() {
  try {
    console.log('[admin-printer-qr.js] loadQRFormatUI');

    // Load from settings
    const saved = window.currentPrinterSettings?.qr_printers;
    if (Array.isArray(saved) && saved.length > 0) {
      window.qrPrinters = saved.map(p => ({
        id:            p.id || _qrGenId(),
        name:          p.name || 'QR Printer',
        type:          p.type || 'network',
        host:          p.host || '',
        bluetoothDevice: p.bluetoothDevice || '',
        tables:        Array.isArray(p.tables) ? p.tables : 'all'
      }));
    } else {
      window.qrPrinters = [];
    }

    await _loadTablesForPrinting();
    renderQRPrintersList();
    _updateAddQRPrinterButton();
  } catch (err) {
    console.error('[admin-printer-qr.js] loadQRFormatUI error:', err);
    renderQRPrintersList();
    _updateAddQRPrinterButton();
  }
}

// ─── Table loading ─────────────────────────────────────────────────────────────

async function _loadTablesForPrinting() {
  try {
    const restaurantId = localStorage.getItem('restaurantId');
    if (!restaurantId) return;
    const resp = await fetch(`${API}/restaurants/${restaurantId}/tables`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    if (!resp.ok) return;
    const data = await resp.json();
    window.availableTablesForPrinting = Array.isArray(data) ? data : (data.tables || []);
    console.log('[admin-printer-qr.js] Tables loaded:', window.availableTablesForPrinting.length);
  } catch (err) {
    console.warn('[admin-printer-qr.js] Could not load tables:', err);
    window.availableTablesForPrinting = [];
  }
}

// ─── Add / Remove ──────────────────────────────────────────────────────────────

function addQRPrinter() {
  if (window.qrPrinters.length >= 5) {
    alert('⚠️ Maximum 5 QR printers per restaurant');
    return;
  }
  window.qrPrinters.push({
    id: _qrGenId(),
    name: `QR Printer ${window.qrPrinters.length + 1}`,
    type: 'network',
    host: '',
    bluetoothDevice: '',
    tables: 'all'
  });
  renderQRPrintersList();
  _updateAddQRPrinterButton();
}

function removeQRPrinter(printerId) {
  window.qrPrinters = window.qrPrinters.filter(p => p.id !== printerId);
  renderQRPrintersList();
  _updateAddQRPrinterButton();
}

// ─── Field updates ─────────────────────────────────────────────────────────────

function updateQRPrinterName(printerId, val) {
  const p = window.qrPrinters.find(p => p.id === printerId);
  if (p) p.name = val;
}

function updateQRPrinterType(printerId, val) {
  const p = window.qrPrinters.find(p => p.id === printerId);
  if (p) { p.type = val; renderQRPrintersList(); }
}

function updateQRPrinterHost(printerId, val) {
  const p = window.qrPrinters.find(p => p.id === printerId);
  if (p) p.host = val;
}

function setQRPrinterTablesAll(printerId) {
  const p = window.qrPrinters.find(p => p.id === printerId);
  if (p) { p.tables = 'all'; renderQRPrintersList(); }
}

function setQRPrinterTablesSpecific(printerId) {
  const p = window.qrPrinters.find(p => p.id === printerId);
  if (p) { p.tables = []; renderQRPrintersList(); }
}

function toggleQRPrinterTable(printerId, tableId) {
  const p = window.qrPrinters.find(p => p.id === printerId);
  if (!p || p.tables === 'all') return;
  const id = Number(tableId);
  const idx = p.tables.findIndex(t => Number(t) === id);
  if (idx > -1) p.tables.splice(idx, 1); else p.tables.push(id);
  renderQRPrintersList();
}

// ─── Bluetooth ────────────────────────────────────────────────────────────────

async function scanBluetoothForQR(printerId) {
  try {
    if (!navigator.bluetooth) { alert('❌ Bluetooth not supported in this browser'); return; }
    const device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: ['generic_access']
    });
    if (device && device.name) {
      const p = window.qrPrinters.find(p => p.id === printerId);
      if (p) { p.bluetoothDevice = device.name; renderQRPrintersList(); }
    }
  } catch (err) {
    if (err.name !== 'NotFoundError') console.error('[admin-printer-qr.js] BT scan error:', err);
  }
}

// ─── Render ────────────────────────────────────────────────────────────────────

function renderQRPrintersList() {
  const container = document.getElementById('qr-printers-list');
  if (!container) return;

  if (window.qrPrinters.length === 0) {
    container.innerHTML = '<p class="kitchen-empty-state">No printers added yet. Click "+ Add Printer" to get started.</p>';
    return;
  }

  let html = '';
  window.qrPrinters.forEach((printer, idx) => {
    const isAllTables = printer.tables === 'all';
    const selectedCount = isAllTables ? window.availableTablesForPrinting.length : (printer.tables || []).length;

    const networkFields = `
      <div class="kitchen-printer-field">
        <label>Network Address</label>
        <input type="text" placeholder="192.168.1.100 or printer.local"
          value="${printer.host || ''}"
          onchange="updateQRPrinterHost('${printer.id}', this.value)" />
        <p class="field-hint">IP address or hostname of the network printer</p>
      </div>`;

    const bluetoothFields = `
      <div class="kitchen-printer-field">
        <label>Bluetooth Device</label>
        <button onclick="scanBluetoothForQR('${printer.id}')" class="btn-secondary" style="width:100%;">🔵 Scan Bluetooth Device</button>
        ${printer.bluetoothDevice ? `<p class="field-hint success">✓ Connected: ${printer.bluetoothDevice}</p>` : ''}
      </div>`;

    // Table routing section
    const tableGrid = window.availableTablesForPrinting.length > 0
      ? `<div class="kitchen-categories-grid">
          ${window.availableTablesForPrinting.map(tbl => {
            const checked = !isAllTables && (printer.tables || []).some(t => Number(t) === Number(tbl.id));
            return `<label class="kitchen-category-label">
              <input type="checkbox" ${checked ? 'checked' : ''} ${isAllTables ? 'disabled' : ''}
                onchange="toggleQRPrinterTable('${printer.id}', ${tbl.id})" />
              <span>${tbl.name}</span>
            </label>`;
          }).join('')}
        </div>`
      : `<div class="kitchen-categories-loading">⏳ Loading tables...</div>`;

    const tableStatus = isAllTables
      ? '<p class="category-status-ok">✓ Routing: All tables</p>'
      : (selectedCount === 0
          ? '<p class="category-status-warning">⚠️ Select at least one table</p>'
          : `<p class="category-status-ok">✓ Routing: ${selectedCount} table(s)</p>`);

    html += `
      <div class="kitchen-printer-card">
        <div class="kitchen-printer-card-header">
          <div class="kitchen-printer-header-left">
            <input type="text" class="kitchen-printer-name-input" value="${printer.name}"
              onchange="updateQRPrinterName('${printer.id}', this.value)" />
            <span class="kitchen-printer-index">#${idx + 1}</span>
          </div>
          <button onclick="removeQRPrinter('${printer.id}')" class="btn-danger">Remove</button>
        </div>

        <div class="kitchen-printer-field">
          <label>Printer Type</label>
          <select onchange="updateQRPrinterType('${printer.id}', this.value)">
            <option value="network"   ${printer.type === 'network'   ? 'selected' : ''}>Network Printer</option>
            <option value="bluetooth" ${printer.type === 'bluetooth' ? 'selected' : ''}>Bluetooth Printer</option>
          </select>
        </div>

        ${printer.type === 'network' ? networkFields : bluetoothFields}

        <div class="kitchen-printer-field">
          <label>📍 Table Routing</label>
          <div style="display:flex;gap:8px;margin-bottom:10px;">
            <button onclick="setQRPrinterTablesAll('${printer.id}')"
              class="${isAllTables ? 'btn-primary' : 'btn-secondary'}" style="flex:1;padding:6px;font-size:13px;">
              All Tables
            </button>
            <button onclick="setQRPrinterTablesSpecific('${printer.id}')"
              class="${!isAllTables ? 'btn-primary' : 'btn-secondary'}" style="flex:1;padding:6px;font-size:13px;">
              Specific Tables
            </button>
          </div>
          ${!isAllTables ? tableGrid : ''}
          ${tableStatus}
        </div>
      </div>`;
  });

  container.innerHTML = html;
}

// ─── Get config for saving ─────────────────────────────────────────────────────

function getQRPrinterConfig() {
  return window.qrPrinters.map(p => ({
    id:             p.id,
    name:           p.name,
    type:           p.type,
    host:           p.type === 'network'    ? (p.host || '') : null,
    bluetoothDevice: p.type === 'bluetooth' ? (p.bluetoothDevice || '') : null,
    tables:         p.tables   // 'all' or array of table IDs
  }));
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function _updateAddQRPrinterButton() {
  const btn = document.getElementById('add-qr-printer-btn');
  if (!btn) return;
  const full = window.qrPrinters.length >= 5;
  btn.disabled      = full;
  btn.style.opacity = full ? '0.5' : '1';
  btn.style.cursor  = full ? 'not-allowed' : 'pointer';
  btn.textContent   = full
    ? '✓ Maximum Printers Added (5)'
    : `+ Add Printer (${window.qrPrinters.length}/5)`;
}

function _qrGenId() {
  return `qr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
