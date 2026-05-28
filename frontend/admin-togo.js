// ================================================================
// admin-togo.js — To-Go Orders management panel
// ================================================================

var TOGO_FILTER = 'active'; // 'active' | 'ready' | 'all'
var TOGO_TIMERANGE = 'today'; // 'today' | 'yesterday' | 'week' | 'month' | 'all'
var TOGO_SELECTED_ORDER_ID = null;
var _togoRefreshInterval = null;

// ──────────────────────────────────────────────────────────────
// Initialization
// ──────────────────────────────────────────────────────────────
async function initializeToGo() {
  TOGO_FILTER = 'active';
  TOGO_TIMERANGE = 'today';
  TOGO_SELECTED_ORDER_ID = null;

  // Reset filter button states
  document.querySelectorAll('.togo-filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === 'active');
  });
  var labelEl = document.getElementById('togo-timerange-label');
  if (labelEl) labelEl.textContent = 'All Today';

  await loadToGoOrders();

  // Auto-refresh every 15 seconds while panel is active
  if (_togoRefreshInterval) clearInterval(_togoRefreshInterval);
  _togoRefreshInterval = setInterval(() => {
    if (CURRENT_SECTION === 'togo') loadToGoOrders(true);
  }, 15000);
}

// ──────────────────────────────────────────────────────────────
// Load & render order list
// ──────────────────────────────────────────────────────────────
async function loadToGoOrders(silent) {
  const listEl = document.getElementById('togo-order-list');
  if (!listEl) return;
  if (!silent) listEl.innerHTML = '<p class="togo-empty-msg">Loading…</p>';

  try {
    const res = await fetch(`${API}/restaurants/${restaurantId}/orders?limit=100&order_type=to-go`);
    if (!res.ok) throw new Error('Failed');
    let orders = await res.json();

    // Client-side filter
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    // Client-side filter — include 'to-go', 'counter', and 'takeaway' order types
    orders = orders.filter(o => o.order_type === 'to-go' || o.order_type === 'counter' || o.order_type === 'takeaway');

    if (TOGO_FILTER === 'active') {
      // Active = no pickup_ready_at and not ended
      orders = orders.filter(o => !o.pickup_ready_at && !o.session_ended_at);
    } else if (TOGO_FILTER === 'ready') {
      orders = orders.filter(o => !!o.pickup_ready_at);
    } else {
      // 'all' with time range
      if (TOGO_TIMERANGE === 'today') {
        orders = orders.filter(o => new Date(o.created_at).getTime() >= todayStart);
      } else if (TOGO_TIMERANGE === 'yesterday') {
        const yesterdayStart = todayStart - 86400000;
        orders = orders.filter(o => new Date(o.created_at).getTime() >= yesterdayStart);
      } else if (TOGO_TIMERANGE === 'week') {
        orders = orders.filter(o => new Date(o.created_at).getTime() >= todayStart - 7 * 86400000);
      } else if (TOGO_TIMERANGE === 'month') {
        orders = orders.filter(o => new Date(o.created_at).getTime() >= todayStart - 30 * 86400000);
      }
      // 'all' = no date filter
    }

    if (!orders.length) {
      const labels = { active: 'No active to-go orders', ready: 'No orders marked ready', all: 'No orders found' };
      listEl.innerHTML = `<p class="togo-empty-msg">${labels[TOGO_FILTER] || 'No orders'}</p>`;
      return;
    }

    let html = '';
    orders.forEach((order, idx) => {
      const isReady = !!order.pickup_ready_at;
      const isSelected = order.id === TOGO_SELECTED_ORDER_ID;
      const isEatHere = order.order_type === 'counter';
      const timeStr = formatTimeWithTimezone
        ? formatTimeWithTimezone(order.created_at, restaurantTimezone || 'Asia/Hong_Kong', 'time')
        : new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      const customer = order.customer_name || order.customer_phone || '—';
      const itemCount = order.item_count || (order.items ? order.items.length : '?');
      const total = order.total_cents != null ? `$${(order.total_cents / 100).toFixed(2)}` : '—';
      const eatHereIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:10px;height:10px;display:inline;vertical-align:middle;margin-right:2px;"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 002-2V2"></path><path d="M7 2v20"></path><path d="M21 15V2"></path><path d="M18 2c0 0 3 4 3 7s-3 7-3 7"></path></svg>`;
      const takeawayIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:10px;height:10px;display:inline;vertical-align:middle;margin-right:2px;"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 01-8 0"></path></svg>`;
      const typeBadge = isEatHere
        ? `<span style="font-size:10px;font-weight:700;padding:2px 6px;border-radius:10px;background:#dbeafe;color:#1d4ed8;">${eatHereIcon} Eat Here</span>`
        : `<span style="font-size:10px;font-weight:700;padding:2px 6px;border-radius:10px;background:#d1fae5;color:#065f46;">${takeawayIcon} Takeaway</span>`;

      html += `
        <div class="togo-order-row${isReady ? ' ready' : ''}${isSelected ? ' selected' : ''}"
             data-order-id="${order.id}"
             onclick="selectToGoOrder(${order.id})">
          <div class="togo-order-num">#${order.restaurant_order_number || order.id} ${typeBadge}</div>
          <div class="togo-order-customer">${escToGo(customer)}</div>
          <div class="togo-order-meta">
            <span>${timeStr} · ${itemCount} item${itemCount !== 1 ? 's' : ''} · ${total}</span>
            <span class="${isReady ? 'togo-ready-badge' : 'togo-pending-badge'}">${isReady ? '✓ Ready' : 'Pending'}</span>
          </div>
        </div>
      `;
    });

    listEl.innerHTML = html;

    // Re-highlight if previously selected
    if (TOGO_SELECTED_ORDER_ID) {
      const selectedRow = listEl.querySelector(`[data-order-id="${TOGO_SELECTED_ORDER_ID}"]`);
      if (selectedRow) selectedRow.classList.add('selected');
    } else if (window.innerWidth > 768 && orders.length > 0) {
      // Auto-select first on wide screens
      selectToGoOrder(orders[0].id);
    }

  } catch (err) {
    listEl.innerHTML = '<p class="togo-empty-msg" style="color:#ef4444;">Error loading orders</p>';
    console.error('[ToGo] Load error:', err);
  }
}

// ──────────────────────────────────────────────────────────────
// Select & display order details
// ──────────────────────────────────────────────────────────────
async function selectToGoOrder(orderId) {
  TOGO_SELECTED_ORDER_ID = orderId;

  // Highlight row
  document.querySelectorAll('.togo-order-row').forEach(r => {
    r.classList.toggle('selected', r.dataset.orderId == orderId);
  });

  const placeholder = document.getElementById('togo-detail-placeholder');
  const content = document.getElementById('togo-detail-content');
  if (placeholder) placeholder.style.display = 'none';
  if (content) { content.style.display = 'block'; content.innerHTML = '<p style="color:#9ca3af;text-align:center;padding:32px;">Loading…</p>'; }

  try {
    const res = await fetch(`${API}/restaurants/${restaurantId}/orders/${orderId}`);
    if (!res.ok) throw new Error('Failed to load order');
    const order = await res.json();
    renderToGoDetail(order);
  } catch (err) {
    if (content) content.innerHTML = '<p style="color:#ef4444;text-align:center;padding:32px;">Error loading order</p>';
  }
}

function renderToGoDetail(order) {
  const content = document.getElementById('togo-detail-content');
  if (!content) return;

  const isReady = !!order.pickup_ready_at;
  const createdStr = new Date(order.created_at).toLocaleString();
  const customer = order.customer_name || '—';
  const phone = order.customer_phone || '—';
  const isEatHere = order.order_type === 'counter';

  // Determine payment state
  const isPaid = order.payment_received || order.cp_status === 'completed';
  const isVoided = order.cp_status === 'voided';
  const isRefunded = order.cp_status === 'refunded' || order.cp_status === 'partial_refund';
  const sessionId = order.session_id;

  let itemsHtml = '';
  let subtotal = 0;
  if (order.items && order.items.length > 0) {
    order.items.forEach(item => {
      subtotal += item.item_total_cents || 0;
      itemsHtml += `
        <div style="display:flex; justify-content:space-between; align-items:start; padding:10px 12px; background:#f9fafb; border-radius:8px; margin-bottom:8px; border-left:3px solid #667eea;">
          <div>
            <div style="font-size:16px; font-weight:700; color:#1f2937;">${escToGo(item.menu_item_name)} <span style="color:#6b7280;">×${item.quantity}</span></div>
            ${item.variants ? `<div style="font-size:12px;color:#9ca3af;margin-top:2px;">${escToGo(item.variants)}</div>` : ''}
            ${item.addons && item.addons.length > 0 ? item.addons.map(a => `<div style="font-size:12px;color:#667eea;">+ ${escToGo(a.menu_item_name)} ×${a.quantity}</div>`).join('') : ''}
          </div>
          <div style="font-size:15px;font-weight:700;color:#667eea;margin-left:12px;white-space:nowrap;">$${((item.item_total_cents || 0) / 100).toFixed(2)}</div>
        </div>
      `;
    });
  } else {
    itemsHtml = '<p style="color:#9ca3af;font-size:14px;">No items</p>';
  }

  const serviceChargePct = window.serviceChargeFee || 0;
  const serviceCharge = Math.round(subtotal * serviceChargePct / 100);
  const grandTotal = subtotal + serviceCharge;

  // Payment status badge
  let paymentBadge = '';
  if (isRefunded) {
    paymentBadge = `<span style="padding:3px 10px;background:#fee2e2;color:#dc2626;border-radius:20px;font-size:12px;font-weight:700;">↩ Refunded</span>`;
  } else if (isVoided) {
    paymentBadge = `<span style="padding:3px 10px;background:#fef3c7;color:#b45309;border-radius:20px;font-size:12px;font-weight:700;">Voided</span>`;
  } else if (isPaid) {
    paymentBadge = `<span style="padding:3px 10px;background:#d1fae5;color:#065f46;border-radius:20px;font-size:12px;font-weight:700;">✓ Paid</span>`;
  } else {
    paymentBadge = `<span style="padding:3px 10px;background:#fef9c3;color:#854d0e;border-radius:20px;font-size:12px;font-weight:700;">Unpaid</span>`;
  }

  // Ready / pickup section
  const readySection = isReady
    ? `<div style="background:#d1fae5;border:1px solid #6ee7b7;border-radius:10px;padding:14px;text-align:center;">
         <div style="font-size:18px;font-weight:800;color:#065f46;">✓ Ready for Pickup</div>
         <div style="font-size:12px;color:#6b7280;margin-top:4px;">${new Date(order.pickup_ready_at).toLocaleString()}</div>
       </div>`
    : `<button class="togo-ready-btn" onclick="markOrderReady(${order.id})" id="togo-ready-btn-${order.id}">
         <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;display:inline;vertical-align:middle;margin-right:6px;"><path d="M18 8h1a4 4 0 010 8h-1"></path><path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z"></path><line x1="6" y1="1" x2="6" y2="4"></line><line x1="10" y1="1" x2="10" y2="4"></line><line x1="14" y1="1" x2="14" y2="4"></line></svg> Mark as Ready for Pickup
       </button>
       <p style="font-size:12px;color:#9ca3af;text-align:center;margin-top:6px;">This will notify the customer their order is ready.</p>`;

  // Payment action buttons
  let paymentActions = '';
  if (!isPaid && !isVoided && !isRefunded) {
    paymentActions = `
      <button onclick="togoOpenSettleBill(${order.id}, ${sessionId})" style="width:100%; padding:14px; background:#667eea; color:white; border:none; border-radius:10px; font-size:16px; font-weight:700; cursor:pointer; margin-top:16px; display:flex; align-items:center; justify-content:center; gap:8px;">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>
        Settle Bill
      </button>`;
  } else if (isPaid && !isVoided && !isRefunded) {
    paymentActions = `
      <button onclick="togoVoidOrder(${order.id})" style="flex:1; padding:14px; background:#f9fafb; color:#374151; border:1px solid #d1d5db; border-radius:10px; font-size:15px; font-weight:600; cursor:pointer; margin-top:16px;">
        Void
      </button>
      <button onclick="togoRefundOrder(${order.id})" style="flex:1; padding:14px; background:#fee2e2; color:#dc2626; border:1px solid #fca5a5; border-radius:10px; font-size:15px; font-weight:600; cursor:pointer; margin-top:16px;">
        Refund
      </button>`;
  }

  content.innerHTML = `
    <div style="background:white; border-radius:10px; padding:20px; margin-bottom:16px; border:1px solid #e5e7eb;">
      <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:16px; padding-bottom:14px; border-bottom:2px solid #f3f4f6;">
        <div>
          <div style="font-size:11px;color:#9ca3af;font-weight:600;text-transform:uppercase;margin-bottom:4px;">Order</div>
          <div style="font-size:26px;font-weight:800;color:#1f2937;">#${order.restaurant_order_number || order.id}</div>
          <div style="margin-top:4px;">
            ${isEatHere
              ? `<span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:12px;background:#dbeafe;color:#1d4ed8;"><svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' style='width:10px;height:10px;display:inline;vertical-align:middle;margin-right:2px;'><path d='M3 2v7c0 1.1.9 2 2 2h4a2 2 0 002-2V2'></path><path d='M7 2v20'></path><path d='M21 15V2'></path><path d='M18 2c0 0 3 4 3 7s-3 7-3 7'></path></svg> Eat Here</span>`
              : `<span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:12px;background:#d1fae5;color:#065f46;"><svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' style='width:10px;height:10px;display:inline;vertical-align:middle;margin-right:2px;'><path d='M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z'></path><line x1='3' y1='6' x2='21' y2='6'></line><path d='M16 10a4 4 0 01-8 0'></path></svg> Takeaway</span>`}
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:11px;color:#9ca3af;font-weight:600;text-transform:uppercase;margin-bottom:4px;">Total</div>
          <div style="font-size:22px;font-weight:800;color:#667eea;">$${(grandTotal / 100).toFixed(2)}</div>
        </div>
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:0;">
        <div>
          <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;font-weight:600;margin-bottom:2px;">Customer</div>
          <div style="font-size:14px;font-weight:600;color:#1f2937;">${escToGo(customer)}</div>
        </div>
        <div>
          <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;font-weight:600;margin-bottom:2px;">Phone</div>
          <div style="font-size:14px;color:#374151;">${escToGo(phone)}</div>
        </div>
        <div>
          <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;font-weight:600;margin-bottom:2px;">Ordered</div>
          <div style="font-size:13px;color:#374151;">${createdStr}</div>
        </div>
        <div>
          <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;font-weight:600;margin-bottom:2px;">Payment</div>
          <div style="margin-top:2px;">${paymentBadge}</div>
        </div>
      </div>
    </div>

    <div style="background:white; border-radius:10px; padding:20px; margin-bottom:16px; border:1px solid #e5e7eb;">
      <div style="font-size:14px;font-weight:700;color:#1f2937;margin-bottom:12px;">Order Items</div>
      ${itemsHtml}
      <div style="border-top:2px solid #f3f4f6; margin-top:12px; padding-top:12px;">
        <div style="display:flex;justify-content:space-between;font-size:13px;color:#6b7280;margin-bottom:6px;"><span>Subtotal</span><span>$${(subtotal/100).toFixed(2)}</span></div>
        ${serviceChargePct > 0 ? `<div style="display:flex;justify-content:space-between;font-size:13px;color:#6b7280;margin-bottom:10px;"><span>Service Charge (${serviceChargePct}%)</span><span>$${(serviceCharge/100).toFixed(2)}</span></div>` : ''}
        <div style="display:flex;justify-content:space-between;font-size:18px;font-weight:800;color:#1f2937;"><span>Total</span><span>$${(grandTotal/100).toFixed(2)}</span></div>
      </div>
    </div>

    <div style="display:flex; gap:10px; margin-bottom:12px;">
      <div style="flex:1; min-width:0;">
        ${readySection}
      </div>
      ${paymentActions ? `<div style="flex:1; display:flex; gap:8px;">${paymentActions}</div>` : ''}
    </div>
  `;
}

// ──────────────────────────────────────────────────────────────
// Mark order ready for pickup
// ──────────────────────────────────────────────────────────────
async function markOrderReady(orderId) {
  const btn = document.getElementById(`togo-ready-btn-${orderId}`);
  if (btn) { btn.disabled = true; btn.textContent = 'Marking…'; }

  try {
    const res = await fetch(`${API}/restaurants/${restaurantId}/orders/${orderId}/ready`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed');

    // Find next order in the list before reloading
    const rows = Array.from(document.querySelectorAll('.togo-order-row'));
    const currentIndex = rows.findIndex(r => r.dataset.orderId == orderId);
    const nextRow = rows[currentIndex + 1] || rows[currentIndex - 1];
    const nextOrderId = nextRow ? parseInt(nextRow.dataset.orderId) : null;

    // Reload the list first
    await loadToGoOrders(true);

    // Select next order if there is one; otherwise show placeholder
    if (nextOrderId) {
      await selectToGoOrder(nextOrderId);
    } else {
      TOGO_SELECTED_ORDER_ID = null;
      const placeholder = document.getElementById('togo-detail-placeholder');
      const content = document.getElementById('togo-detail-content');
      if (content) content.style.display = 'none';
      if (placeholder) placeholder.style.display = '';
    }
  } catch (err) {
    if (btn) { btn.disabled = false; btn.textContent = '🛎️ Mark as Ready for Pickup'; }
    alert('Error marking order as ready: ' + err.message);
  }
}

// ──────────────────────────────────────────────────────────────
// Filter
// ──────────────────────────────────────────────────────────────
function setToGoFilter(filterType) {
  TOGO_FILTER = filterType;
  TOGO_SELECTED_ORDER_ID = null;
  document.querySelectorAll('.togo-filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === filterType);
  });
  // Reset detail panel
  const placeholder = document.getElementById('togo-detail-placeholder');
  const content = document.getElementById('togo-detail-content');
  if (placeholder) placeholder.style.display = '';
  if (content) content.style.display = 'none';
  loadToGoOrders();
}

function toggleToGoTimeRangeDropdown(e) {
  if (e) e.stopPropagation();
  // Switch to 'all' filter when opening dropdown
  if (TOGO_FILTER !== 'all') {
    TOGO_FILTER = 'all';
    document.querySelectorAll('.togo-filter-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.filter === 'all');
    });
  }
  const menu = document.getElementById('togo-timerange-menu');
  if (!menu) return;
  const isOpen = menu.style.display !== 'none';
  menu.style.display = isOpen ? 'none' : 'block';
  if (!isOpen) {
    // Close on outside click
    const closeMenu = () => { menu.style.display = 'none'; document.removeEventListener('click', closeMenu); };
    setTimeout(() => document.addEventListener('click', closeMenu), 0);
  }
}

function setToGoTimeRange(range) {
  TOGO_TIMERANGE = range;
  TOGO_FILTER = 'all';
  // Update label
  const labels = { today: 'All Today', yesterday: 'Since Yesterday', week: 'Since 1 Week', month: 'Since 1 Month', all: 'All Time' };
  const labelEl = document.getElementById('togo-timerange-label');
  if (labelEl) labelEl.textContent = labels[range] || 'All Today';
  // Highlight active in dropdown
  const menu = document.getElementById('togo-timerange-menu');
  if (menu) {
    menu.querySelectorAll('button').forEach((btn, i) => {
      const rangeMap = ['today', 'yesterday', 'week', 'month', 'all'];
      btn.classList.toggle('active', rangeMap[i] === range);
    });
    menu.style.display = 'none';
  }
  // Mark filter button active
  document.querySelectorAll('.togo-filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === 'all');
  });
  // Reset detail panel
  const placeholder = document.getElementById('togo-detail-placeholder');
  const content = document.getElementById('togo-detail-content');
  if (placeholder) placeholder.style.display = '';
  if (content) content.style.display = 'none';
  TOGO_SELECTED_ORDER_ID = null;
  loadToGoOrders();
}

// ──────────────────────────────────────────────────────────────
// QR Code modal (customer to-go order menu QR)
// ──────────────────────────────────────────────────────────────
function openToGoQRModal() {
  let modal = document.getElementById('togo-qr-modal');
  if (!modal) return;

  // Move modal to document.body to escape any stacking context / overflow constraints
  if (modal.parentNode !== document.body) {
    document.body.appendChild(modal);
  }
  modal.style.display = 'flex';

  // Build URL
  const baseUrl = `${window.location.protocol}//${window.location.host}`;
  const toGoUrl = `${baseUrl}/order-now/${restaurantId}`;

  const urlDisplay = document.getElementById('togo-qr-url-display');
  if (urlDisplay) urlDisplay.textContent = toGoUrl;

  // Render QR after browser paints the visible modal (avoids blank canvas bug)
  const qrEl = document.getElementById('togo-qrcode');
  if (qrEl) {
    qrEl.innerHTML = '';
    requestAnimationFrame(() => {
      try {
        new QRCode(qrEl, {
          text: toGoUrl,
          width: 220,
          height: 220,
          correctLevel: (typeof QRCode !== 'undefined' && QRCode.CorrectLevel && QRCode.CorrectLevel.H) || 3
        });
      } catch (e) {
        qrEl.innerHTML = `<p style="color:#ef4444;font-size:13px;">QR generation failed: ${e.message}</p>`;
      }
    });
  }
}

function closeToGoQRModal() {
  const modal = document.getElementById('togo-qr-modal');
  if (modal) modal.style.display = 'none';
}

function downloadToGoQR() {
  const qrEl = document.getElementById('togo-qrcode');
  if (!qrEl) return;
  const canvas = qrEl.querySelector('canvas');
  const img = qrEl.querySelector('img');
  let dataUrl;
  if (canvas) {
    dataUrl = canvas.toDataURL('image/png');
  } else if (img) {
    dataUrl = img.src;
  } else {
    alert('QR code not ready yet.');
    return;
  }
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `togo-qr-restaurant-${restaurantId}.png`;
  a.click();
}

// ──────────────────────────────────────────────────────────────
// Utility
// ──────────────────────────────────────────────────────────────
function escToGo(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ──────────────────────────────────────────────────────────────
// To-Go payment actions (void / refund / settle)
// These call the same backend endpoints as the orders history
// panel but refresh the To-Go detail panel afterwards instead.
// ──────────────────────────────────────────────────────────────
async function togoVoidOrder(orderId) {
  if (!confirm('Mark this order as Voided?\nThis is a manual record update only — no payment system will be called.')) return;
  try {
    const resp = await fetch(`${API}/restaurants/${restaurantId}/orders/${orderId}/void`, { method: 'POST' });
    const data = await resp.json();
    if (data.success) {
      await selectToGoOrder(orderId);
      await loadToGoOrders(true);
    } else {
      alert('Void failed: ' + data.error);
    }
  } catch (e) {
    alert(e.message);
  }
}

async function togoRefundOrder(orderId) {
  if (!confirm('Mark this order as Refunded?\nThis is a manual record update only — no payment system will be called.')) return;
  try {
    const resp = await fetch(`${API}/restaurants/${restaurantId}/orders/${orderId}/refund`, { method: 'POST' });
    const data = await resp.json();
    if (data.success) {
      await selectToGoOrder(orderId);
      await loadToGoOrders(true);
    } else {
      alert('Refund failed: ' + data.error);
    }
  } catch (e) {
    alert(e.message);
  }
}

async function togoOpenSettleBill(orderId, sessionId) {
  // Store the orderId so the settle-bill flow can refresh the To-Go panel after payment
  window._togoRefreshOrderId = orderId;
  if (typeof openSettleBillModal === 'function') {
    openSettleBillModal(orderId, sessionId);
  } else {
    alert('Payment module not loaded yet. Please wait and try again.');
  }
}
