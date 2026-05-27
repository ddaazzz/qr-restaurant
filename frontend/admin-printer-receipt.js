/**
 * Payment Receipt Printer Module
 * Handles multi-printer configuration for post-payment receipts.
 * Simpler than the bill printer — no per-table or order-type routing.
 */

if (typeof window.receiptPrinters === 'undefined') window.receiptPrinters = [];

// ─── Init ──────────────────────────────────────────────────────────────────────

function loadReceiptFormatUI() {
  try {
    const saved = window.currentPrinterSettings?.receipt_printers;
    if (Array.isArray(saved) && saved.length > 0) {
      window.receiptPrinters = saved.map(p => ({
        id:              p.id || _rcptGenId(),
        name:            p.name || 'Receipt Printer',
        type:            p.type || 'network',
        host:            p.host || '',
        port:            p.port || 9100,
        bluetoothDevice: p.bluetoothDevice || '',
      }));
    } else {
      window.receiptPrinters = [];
    }
    renderReceiptPrintersList();
    _updateAddReceiptPrinterButton();

    // Restore format fields
    const s = window.currentPrinterSettings || {};
    const headerInput = document.getElementById('receipt-header-text');
    const footerInput = document.getElementById('receipt-footer-text');
    if (headerInput) headerInput.value = s.receipt_header_text || 'Thank You';
    if (footerInput) footerInput.value = s.receipt_footer_text || '';
    setReceiptFontSize(s.receipt_font_size || 'medium');
    updateReceiptPreview();
  } catch (err) {
    console.error('[admin-printer-receipt.js] loadReceiptFormatUI error:', err);
  }
}

// ─── Add / Remove ──────────────────────────────────────────────────────────────

function addReceiptPrinter() {
  if (window.receiptPrinters.length >= 5) {
    alert('⚠️ Maximum 5 receipt printers per restaurant');
    return;
  }
  window.receiptPrinters.push({
    id:              _rcptGenId(),
    name:            `Receipt Printer ${window.receiptPrinters.length + 1}`,
    type:            'network',
    host:            '',
    port:            9100,
    bluetoothDevice: '',
  });
  renderReceiptPrintersList();
  _updateAddReceiptPrinterButton();
  // If not in detail view, navigate there
  if (document.getElementById('printer-detail-view')?.style.display === 'none') {
    selectPrinterType('receipt');
  }
}

function removeReceiptPrinter(printerId) {
  window.receiptPrinters = window.receiptPrinters.filter(p => p.id !== printerId);
  renderReceiptPrintersList();
  _updateAddReceiptPrinterButton();
}

// ─── Field updates ─────────────────────────────────────────────────────────────

function updateReceiptPrinterName(printerId, val) {
  const p = window.receiptPrinters.find(p => p.id === printerId);
  if (p) p.name = val;
}

function updateReceiptPrinterType(printerId, val) {
  const p = window.receiptPrinters.find(p => p.id === printerId);
  if (p) { p.type = val; renderReceiptPrintersList(); }
}

function updateReceiptPrinterHost(printerId, val) {
  const p = window.receiptPrinters.find(p => p.id === printerId);
  if (p) p.host = val;
}

// ─── Bluetooth ────────────────────────────────────────────────────────────────

async function scanBluetoothForReceipt(printerId) {
  try {
    if (!navigator.bluetooth) { alert('❌ Bluetooth not supported in this browser'); return; }
    const device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: ['generic_access']
    });
    if (device && device.name) {
      const p = window.receiptPrinters.find(p => p.id === printerId);
      if (p) { p.bluetoothDevice = device.name; renderReceiptPrintersList(); }
    }
  } catch (err) {
    if (err.name !== 'NotFoundError') console.error('[admin-printer-receipt.js] BT scan error:', err);
  }
}

// ─── Render ────────────────────────────────────────────────────────────────────

function renderReceiptPrintersList() {
  const container = document.getElementById('receipt-printers-list');
  if (!container) return;

  if (window.receiptPrinters.length === 0) {
    container.innerHTML = '<p style="font-size:12px; color:#9ca3af; margin:0 0 4px 0; font-style:italic;">No printers added yet.</p>';
    return;
  }

  let html = '';
  window.receiptPrinters.forEach((printer) => {
    const networkFields = `
      <div style="margin-top:8px;">
        <label style="font-size:12px; color:#374151; font-weight:600;">Network Address</label>
        <input type="text" placeholder="192.168.1.100"
          value="${printer.host || ''}"
          onchange="updateReceiptPrinterHost('${printer.id}', this.value)"
          style="width:100%; padding:6px; border:1px solid #d1d5db; border-radius:4px; font-size:13px; box-sizing:border-box; margin-top:4px;" />
      </div>`;

    const bluetoothFields = `
      <div style="margin-top:8px; display:flex; gap:8px; align-items:center;">
        <span style="font-size:12px; color:#374151;">${printer.bluetoothDevice ? '✓ ' + printer.bluetoothDevice : 'No device selected'}</span>
        <button onclick="scanBluetoothForReceipt('${printer.id}')"
          style="padding:4px 10px; border:1px solid #d1d5db; border-radius:4px; background:#fff; font-size:12px; cursor:pointer;">
          🔵 Scan
        </button>
      </div>`;

    html += `
      <div style="background:#fff; border:1px solid #e5e7eb; border-radius:8px; padding:12px; margin-bottom:8px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <input type="text" value="${printer.name}"
            onchange="updateReceiptPrinterName('${printer.id}', this.value)"
            style="font-weight:600; font-size:13px; border:1px solid #e5e7eb; border-radius:4px; padding:4px 8px; flex:1; margin-right:8px;" />
          <button onclick="removeReceiptPrinter('${printer.id}')"
            style="padding:4px 10px; background:#fee2e2; color:#dc2626; border:1px solid #fca5a5; border-radius:4px; cursor:pointer; font-size:12px;">Remove</button>
        </div>
        <div>
          <label style="font-size:12px; color:#374151; font-weight:600;">Connection Type</label>
          <select onchange="updateReceiptPrinterType('${printer.id}', this.value)"
            style="width:100%; padding:6px; border:1px solid #d1d5db; border-radius:4px; font-size:13px; margin-top:4px;">
            <option value="network" ${printer.type === 'network' ? 'selected' : ''}>Network (TCP/IP)</option>
            <option value="bluetooth" ${printer.type === 'bluetooth' ? 'selected' : ''}>Bluetooth</option>
          </select>
        </div>
        ${printer.type === 'bluetooth' ? bluetoothFields : networkFields}
      </div>`;
  });

  container.innerHTML = html;
}

function _updateAddReceiptPrinterButton() {
  const btn = document.getElementById('add-receipt-printer-btn');
  if (btn) btn.disabled = window.receiptPrinters.length >= 5;
}

function _rcptGenId() {
  return 'rcpt-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
}

// ─── Font size helpers ─────────────────────────────────────────────────────────

function setReceiptFontSize(size) {
  ['small', 'medium', 'large'].forEach(s => {
    const btn = document.getElementById(`receipt-font-${s}`);
    if (btn) {
      btn.style.background = s === size ? '#3b82f6' : '';
      btn.style.color = s === size ? '#fff' : '';
      btn.style.borderColor = s === size ? '#3b82f6' : '#d1d5db';
    }
  });
}

function getCurrentReceiptFontSize() {
  if (document.getElementById('receipt-font-small')?.style.background === 'rgb(59, 130, 246)') return 'small';
  if (document.getElementById('receipt-font-large')?.style.background === 'rgb(59, 130, 246)') return 'large';
  return 'medium';
}

function updateReceiptPreview() {
  const headerPreview = document.getElementById('receipt-header-preview');
  const footerPreview = document.getElementById('receipt-footer-preview');
  if (headerPreview) headerPreview.textContent = document.getElementById('receipt-header-text')?.value || 'Thank You';
  if (footerPreview) footerPreview.textContent = document.getElementById('receipt-footer-text')?.value || 'Follow us on social media';
}

// ─── Get config for save ───────────────────────────────────────────────────────

function getReceiptPrinterConfig() {
  return window.receiptPrinters.map(p => ({
    id:              p.id,
    name:            p.name,
    type:            p.type,
    host:            p.type === 'network' ? p.host : null,
    port:            p.type === 'network' ? (p.port || 9100) : null,
    bluetoothDevice: p.type === 'bluetooth' ? p.bluetoothDevice : null,
  }));
}

// ─── Save ──────────────────────────────────────────────────────────────────────

async function saveReceiptPrinterConfiguration() {
  try {
    const restaurantId = localStorage.getItem('restaurantId');
    if (!restaurantId) { alert('Restaurant ID not found'); return; }

    const receiptPrinters = getReceiptPrinterConfig();
    const fontSize = getCurrentReceiptFontSize();
    const headerText = document.getElementById('receipt-header-text')?.value || 'Thank You';
    const footerText = document.getElementById('receipt-footer-text')?.value || '';

    const payload = {
      type: 'Receipt',
      printer_type: 'none',
      settings: {
        printers: receiptPrinters,
        font_size: fontSize,
        header_text: headerText,
        footer_text: footerText,
      },
    };

    const response = await fetch(
      `${API}/restaurants/${restaurantId}/printer-settings`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) throw new Error('Failed to save receipt printer configuration');
    const result = await response.json();

    if (!window.currentPrinterSettings) window.currentPrinterSettings = {};
    window.currentPrinterSettings.receipt_printers = result.settings?.printers || receiptPrinters;
    window.currentPrinterSettings.receipt_font_size = result.settings?.font_size || fontSize;
    window.currentPrinterSettings.receipt_header_text = result.settings?.header_text || headerText;
    window.currentPrinterSettings.receipt_footer_text = result.settings?.footer_text || footerText;

    if (typeof updateStatusCards === 'function') updateStatusCards();
    alert('Receipt Printers saved successfully!');
    if (typeof backToSelection === 'function') backToSelection();
  } catch (err) {
    console.error('[admin-printer-receipt.js] Failed to save:', err);
    alert('Failed to save: ' + err.message);
  }
}
