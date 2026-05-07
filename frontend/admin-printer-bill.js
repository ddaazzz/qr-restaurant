/**
 * Bill Receipt Printer Module
 * Handles multi-printer configuration with per-printer table + order-type routing
 */

// Global state
if (typeof window.billPrinters === 'undefined') window.billPrinters = [];

const BILL_ORDER_TYPES = [
  { id: 'table',     label: 'Dine In (Table)' },
  { id: 'order_now', label: 'Order Now' },
  { id: 'to_go',     label: 'To-Go / Takeaway' }
];

// ─── Initialise ────────────────────────────────────────────────────────────────

/**
 * Called by admin-printer.js when settings load from the API.
 */
function loadBillPrintersFromAPI(printersArray) {
  if (Array.isArray(printersArray) && printersArray.length > 0) {
    window.billPrinters = printersArray.map(p => ({
      ...p,
      id:          p.id || _billGenId(),
      tables:      Array.isArray(p.tables) ? p.tables : 'all',
      order_types: Array.isArray(p.order_types) ? p.order_types : ['table', 'order_now', 'to_go']
    }));
  }
}

/**
 * Called by selectPrinterType('bill').
 */
async function loadBillFormatUI_v2() {
  try {
    console.log('[admin-printer-bill.js] loadBillFormatUI_v2');

    const saved = window.currentPrinterSettings?.bill_printers;
    if (Array.isArray(saved) && saved.length > 0) {
      window.billPrinters = saved.map(p => ({
        id:           p.id || _billGenId(),
        name:         p.name || 'Bill Printer',
        type:         p.type || 'network',
        host:         p.host || '',
        bluetoothDevice: p.bluetoothDevice || '',
        tables:       Array.isArray(p.tables) ? p.tables : 'all',
        order_types:  Array.isArray(p.order_types) ? p.order_types : ['table', 'order_now', 'to_go']
      }));
    } else {
      window.billPrinters = [];
    }

    // Tables list is shared with QR module — load if not already loaded
    if (!window.availableTablesForPrinting || window.availableTablesForPrinting.length === 0) {
      await _loadTablesForBill();
    }

    renderBillPrintersList();
    _updateAddBillPrinterButton();
  } catch (err) {
    console.error('[admin-printer-bill.js] loadBillFormatUI_v2 error:', err);
    renderBillPrintersList();
    _updateAddBillPrinterButton();
  }
}

async function _loadTablesForBill() {
  try {
    const restaurantId = localStorage.getItem('restaurantId');
    if (!restaurantId) return;
    const resp = await fetch(`${API}/restaurants/${restaurantId}/tables`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    if (!resp.ok) return;
    const data = await resp.json();
    window.availableTablesForPrinting = Array.isArray(data) ? data : (data.tables || []);
  } catch (err) {
    console.warn('[admin-printer-bill.js] Could not load tables:', err);
  }
}

// ─── Add / Remove ──────────────────────────────────────────────────────────────

function addBillPrinter() {
  if (window.billPrinters.length >= 5) {
    alert('⚠️ Maximum 5 bill printers per restaurant');
    return;
  }
  window.billPrinters.push({
    id:           _billGenId(),
    name:         `Bill Printer ${window.billPrinters.length + 1}`,
    type:         'network',
    host:         '',
    bluetoothDevice: '',
    tables:       'all',
    order_types:  ['table', 'order_now', 'to_go']
  });
  renderBillPrintersList();
  _updateAddBillPrinterButton();
}

function removeBillPrinter(printerId) {
  window.billPrinters = window.billPrinters.filter(p => p.id !== printerId);
  renderBillPrintersList();
  _updateAddBillPrinterButton();
}

// ─── Field updates ─────────────────────────────────────────────────────────────

function updateBillPrinterName(printerId, val) {
  const p = window.billPrinters.find(p => p.id === printerId);
  if (p) p.name = val;
}

function updateBillPrinterType(printerId, val) {
  const p = window.billPrinters.find(p => p.id === printerId);
  if (p) { p.type = val; renderBillPrintersList(); }
}

function updateBillPrinterHost(printerId, val) {
  const p = window.billPrinters.find(p => p.id === printerId);
  if (p) p.host = val;
}

// Table routing
function setBillPrinterTablesAll(printerId) {
  const p = window.billPrinters.find(p => p.id === printerId);
  if (p) { p.tables = 'all'; renderBillPrintersList(); }
}

function setBillPrinterTablesSpecific(printerId) {
  const p = window.billPrinters.find(p => p.id === printerId);
  if (p) { p.tables = []; renderBillPrintersList(); }
}

function toggleBillPrinterTable(printerId, tableId) {
  const p = window.billPrinters.find(p => p.id === printerId);
  if (!p || p.tables === 'all') return;
  const id = Number(tableId);
  const idx = p.tables.findIndex(t => Number(t) === id);
  if (idx > -1) p.tables.splice(idx, 1); else p.tables.push(id);
  renderBillPrintersList();
}

// Order type routing
function toggleBillPrinterOrderType(printerId, orderType) {
  const p = window.billPrinters.find(p => p.id === printerId);
  if (!p) return;
  if (!Array.isArray(p.order_types)) p.order_types = [];
  const idx = p.order_types.indexOf(orderType);
  if (idx > -1) p.order_types.splice(idx, 1); else p.order_types.push(orderType);
  renderBillPrintersList();
}

// ─── Bluetooth ────────────────────────────────────────────────────────────────

async function scanBluetoothForBill(printerId) {
  try {
    if (!navigator.bluetooth) { alert('❌ Bluetooth not supported in this browser'); return; }
    const device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: ['generic_access']
    });
    if (device && device.name) {
      const p = window.billPrinters.find(p => p.id === printerId);
      if (p) { p.bluetoothDevice = device.name; renderBillPrintersList(); }
    }
  } catch (err) {
    if (err.name !== 'NotFoundError') console.error('[admin-printer-bill.js] BT scan error:', err);
  }
}

// ─── Render ────────────────────────────────────────────────────────────────────

function renderBillPrintersList() {
  const container = document.getElementById('bill-printers-list');
  if (!container) return;

  if (window.billPrinters.length === 0) {
    container.innerHTML = '<p class="kitchen-empty-state">No printers added yet. Click "+ Add Printer" to get started.</p>';
    return;
  }

  let html = '';
  window.billPrinters.forEach((printer, idx) => {
    const isAllTables = printer.tables === 'all';
    const tableCount  = isAllTables ? window.availableTablesForPrinting.length : (printer.tables || []).length;
    const orderTypes  = Array.isArray(printer.order_types) ? printer.order_types : ['table', 'order_now', 'to_go'];

    const networkFields = `
      <div class="kitchen-printer-field">
        <label>Network Address</label>
        <input type="text" placeholder="192.168.1.100 or printer.local"
          value="${printer.host || ''}"
          onchange="updateBillPrinterHost('${printer.id}', this.value)" />
        <p class="field-hint">IP address or hostname of the network printer</p>
      </div>`;

    const bluetoothFields = `
      <div class="kitchen-printer-field">
        <label>Bluetooth Device</label>
        <button onclick="scanBluetoothForBill('${printer.id}')" class="btn-secondary" style="width:100%;">🔵 Scan Bluetooth Device</button>
        ${printer.bluetoothDevice ? `<p class="field-hint success">✓ Connected: ${printer.bluetoothDevice}</p>` : ''}
      </div>`;

    // Table routing
    const tableGrid = window.availableTablesForPrinting.length > 0
      ? `<div class="kitchen-categories-grid">
          ${window.availableTablesForPrinting.map(tbl => {
            const checked = !isAllTables && (printer.tables || []).some(t => Number(t) === Number(tbl.id));
            return `<label class="kitchen-category-label">
              <input type="checkbox" ${checked ? 'checked' : ''} ${isAllTables ? 'disabled' : ''}
                onchange="toggleBillPrinterTable('${printer.id}', ${tbl.id})" />
              <span>${tbl.name}</span>
            </label>`;
          }).join('')}
        </div>`
      : `<div class="kitchen-categories-loading">⏳ Loading tables...</div>`;

    const tableStatus = isAllTables
      ? '<p class="category-status-ok">✓ Tables: All</p>'
      : (tableCount === 0
          ? '<p class="category-status-warning">⚠️ Select at least one table</p>'
          : `<p class="category-status-ok">✓ Tables: ${tableCount} selected</p>`);

    // Order type routing
    const orderTypeGrid = BILL_ORDER_TYPES.map(ot => {
      const checked = orderTypes.includes(ot.id);
      return `<label class="kitchen-category-label">
        <input type="checkbox" ${checked ? 'checked' : ''}
          onchange="toggleBillPrinterOrderType('${printer.id}', '${ot.id}')" />
        <span>${ot.label}</span>
      </label>`;
    }).join('');

    const orderTypeStatus = orderTypes.length === 0
      ? '<p class="category-status-warning">⚠️ Select at least one order type</p>'
      : orderTypes.length === BILL_ORDER_TYPES.length
        ? '<p class="category-status-ok">✓ Order types: All</p>'
        : `<p class="category-status-ok">✓ Order types: ${orderTypes.map(id => BILL_ORDER_TYPES.find(t => t.id === id)?.label || id).join(', ')}</p>`;

    html += `
      <div class="kitchen-printer-card">
        <div class="kitchen-printer-card-header">
          <div class="kitchen-printer-header-left">
            <input type="text" class="kitchen-printer-name-input" value="${printer.name}"
              onchange="updateBillPrinterName('${printer.id}', this.value)" />
            <span class="kitchen-printer-index">#${idx + 1}</span>
          </div>
          <button onclick="removeBillPrinter('${printer.id}')" class="btn-danger">Remove</button>
        </div>

        <div class="kitchen-printer-field">
          <label>Printer Type</label>
          <select onchange="updateBillPrinterType('${printer.id}', this.value)">
            <option value="network"   ${printer.type === 'network'   ? 'selected' : ''}>Network Printer</option>
            <option value="bluetooth" ${printer.type === 'bluetooth' ? 'selected' : ''}>Bluetooth Printer</option>
          </select>
        </div>

        ${printer.type === 'network' ? networkFields : bluetoothFields}

        <div class="kitchen-printer-field">
          <label>📍 Table Routing</label>
          <div style="display:flex;gap:8px;margin-bottom:10px;">
            <button onclick="setBillPrinterTablesAll('${printer.id}')"
              class="${isAllTables ? 'btn-primary' : 'btn-secondary'}" style="flex:1;padding:6px;font-size:13px;">
              All Tables
            </button>
            <button onclick="setBillPrinterTablesSpecific('${printer.id}')"
              class="${!isAllTables ? 'btn-primary' : 'btn-secondary'}" style="flex:1;padding:6px;font-size:13px;">
              Specific Tables
            </button>
          </div>
          ${!isAllTables ? tableGrid : ''}
          ${tableStatus}
        </div>

        <div class="kitchen-printer-field">
          <label>🧾 Order Type Routing</label>
          <div class="kitchen-categories-grid">${orderTypeGrid}</div>
          ${orderTypeStatus}
        </div>
      </div>`;
  });

  container.innerHTML = html;
}

// ─── Get config for saving ─────────────────────────────────────────────────────

function getBillPrinterConfig() {
  return window.billPrinters.map(p => ({
    id:             p.id,
    name:           p.name,
    type:           p.type,
    host:           p.type === 'network'    ? (p.host || '') : null,
    bluetoothDevice: p.type === 'bluetooth' ? (p.bluetoothDevice || '') : null,
    tables:         p.tables,
    order_types:    Array.isArray(p.order_types) ? p.order_types : ['table', 'order_now', 'to_go']
  }));
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function _updateAddBillPrinterButton() {
  const btn = document.getElementById('add-bill-printer-btn');
  if (!btn) return;
  const full = window.billPrinters.length >= 5;
  btn.disabled      = full;
  btn.style.opacity = full ? '0.5' : '1';
  btn.style.cursor  = full ? 'not-allowed' : 'pointer';
  btn.textContent   = full
    ? '✓ Maximum Printers Added (5)'
    : `+ Add Printer (${window.billPrinters.length}/5)`;
}

function _billGenId() {
  return `bill-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
