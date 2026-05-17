// ============= ADMIN DASHBOARD MODULE =============

let dashboardInitialized = false;
let dashRange = 'today'; // today | week | month

function getDashDays() {
  if (dashRange === 'today') return 1;
  if (dashRange === 'week') return 7;
  return 30;
}

function setDashRange(range) {
  dashRange = range;
  var btns = document.querySelectorAll('.dash-range-btn');
  for (var i = 0; i < btns.length; i++) {
    var btn = btns[i];
    if (btn.dataset.range === range) {
      btn.style.background = 'var(--primary-color)';
      btn.style.color = '#fff';
      btn.style.border = 'none';
    } else {
      btn.style.background = 'transparent';
      btn.style.color = 'var(--primary-color)';
      btn.style.border = '2px solid var(--primary-color)';
    }
  }
  initializeDashboard();
}

// ========== INITIALIZE DASHBOARD ==========
async function initializeDashboard() {
  var loading = document.getElementById('dashboard-loading');
  var content = document.getElementById('dashboard-content');
  if (loading) loading.style.display = 'block';
  if (content) content.style.opacity = '0.4';

  try {
    var days = getDashDays();
    var base = API + '/restaurants/' + restaurantId;

    var [ordersRes, topItemsRes, topTablesRes, bookingsRes] = await Promise.all([
      fetch(base + '/orders?limit=2000'),
      fetch(base + '/reports/top-items?days=' + days),
      fetch(base + '/reports/top-tables?days=' + days),
      fetch(base + '/bookings')
    ]);

    var allOrders = ordersRes.ok ? await ordersRes.json() : [];
    var topItems  = topItemsRes.ok  ? await topItemsRes.json()  : [];
    var topTables = topTablesRes.ok ? await topTablesRes.json() : [];
    var allBookings = bookingsRes.ok ? await bookingsRes.json() : [];

    // Filter orders by date range
    var now = Date.now();
    var cutoff = now - days * 24 * 60 * 60 * 1000;
    var orders = (allOrders || []).filter(function(o) {
      return new Date(o.created_at).getTime() >= cutoff;
    });

    // Filter bookings by date range
    var todayStr = new Date().toISOString().slice(0, 10);
    var cutoffDate = new Date(cutoff).toISOString().slice(0, 10);
    var periodBookings = (allBookings || []).filter(function(b) {
      return b.booking_date >= cutoffDate && b.booking_date <= todayStr;
    });

    renderDashboard(orders, topItems, topTables, periodBookings, allBookings);

  } catch (err) {
    console.error('[Dashboard] Failed to load:', err);
  } finally {
    if (loading) loading.style.display = 'none';
    if (content) content.style.opacity = '1';
  }
}

function dashFmt(cents) {
  return '$' + (cents / 100).toFixed(2);
}

function renderDashboard(orders, topItems, topTables, periodBookings, allBookings) {
  // ---- Metrics ----
  var totalRevenue = 0, totalDiscount = 0;
  var revenueByHour = {};

  for (var i = 0; i < orders.length; i++) {
    var o = orders[i];
    totalRevenue  += parseInt(o.total_cents,    10) || 0;
    totalDiscount += parseInt(o.discount_cents, 10) || 0;

    // Hourly
    var hr = new Intl.DateTimeFormat('en-US', { timeZone: restaurantTimezone, hour: '2-digit', hour12: false }).format(new Date(o.created_at));
    var key = hr + ':00';
    revenueByHour[key] = (revenueByHour[key] || 0) + (parseInt(o.total_cents, 10) || 0);
  }

  var totalOrders = orders.length;
  var avgBill = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;
  var netRevenue = totalRevenue - totalDiscount;

  setText('dash-revenue-val',  dashFmt(totalRevenue));
  setText('dash-orders-val',   totalOrders);
  setText('dash-avgbill-val',  dashFmt(avgBill));
  setText('dash-netrev-val',   dashFmt(netRevenue));
  setText('dash-discount-val', '-' + dashFmt(totalDiscount));
  setText('dash-bookings-val', periodBookings.length);

  // ---- Hourly Revenue Chart ----
  renderDashHourlyChart(revenueByHour);

  // ---- Bookings ----
  renderDashBookings(periodBookings, allBookings);

  // ---- Table Performance ----
  renderDashTablePerf(topTables);

  // ---- Top Items ----
  renderDashTopItems(topItems);

  // ---- Order Status ----
  renderDashOrderStatus(orders);

  // ---- Top Revenue Days ----
  renderDashTopDays(orders);
}

function setText(id, val) {
  var el = document.getElementById(id);
  if (el) el.textContent = val;
}

function showEmpty(contentId, emptyId, isEmpty) {
  var c = document.getElementById(contentId);
  var e = document.getElementById(emptyId);
  if (c) c.style.display = isEmpty ? 'none' : '';
  if (e) e.style.display = isEmpty ? 'block' : 'none';
}

// ---- Hourly Revenue Chart ----
function renderDashHourlyChart(revenueByHour) {
  var el = document.getElementById('dash-hourly-chart');
  var emptyEl = document.getElementById('dash-hourly-empty');
  if (!el) return;

  var hours = Object.keys(revenueByHour);
  if (hours.length === 0) {
    el.style.display = 'none';
    if (emptyEl) emptyEl.style.display = 'block';
    return;
  }
  el.style.display = 'flex';
  if (emptyEl) emptyEl.style.display = 'none';

  var maxRev = Math.max.apply(null, Object.values(revenueByHour));
  // Build all 24 hours
  var html = '';
  for (var h = 0; h < 24; h++) {
    var key = (h < 10 ? '0' + h : '' + h) + ':00';
    var rev = revenueByHour[key] || 0;
    var pct = maxRev > 0 ? Math.max(2, Math.round((rev / maxRev) * 100)) : 2;
    var label = h % 3 === 0 ? (h < 10 ? '0' + h : '' + h) : '';
    var tip = key + ' ' + dashFmt(rev);
    html += '<div style="flex:1;display:flex;flex-direction:column;align-items:center;min-width:0;" title="' + tip + '">' +
      '<div style="width:100%;background:' + (rev > 0 ? 'linear-gradient(to top,#6366f1,#818cf8)' : '#f3f4f6') + ';border-radius:2px 2px 0 0;height:' + pct + '%;min-height:2px;transition:height 0.3s;"></div>' +
      '<div style="font-size:8px;color:#9ca3af;margin-top:2px;white-space:nowrap;">' + label + '</div>' +
      '</div>';
  }
  el.innerHTML = html;
}

// ---- Bookings Overview ----
function renderDashBookings(periodBookings, allBookings) {
  var statsEl = document.getElementById('dash-bookings-stats');
  var todayEl  = document.getElementById('dash-bookings-today');
  var emptyEl  = document.getElementById('dash-bookings-empty');
  if (!statsEl) return;

  if (periodBookings.length === 0) {
    statsEl.innerHTML = '';
    if (todayEl) todayEl.innerHTML = '';
    if (emptyEl) emptyEl.style.display = 'block';
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';

  var confirmed = 0, pending = 0, cancelled = 0, noshow = 0, completed = 0;
  for (var i = 0; i < periodBookings.length; i++) {
    var s = (periodBookings[i].status || '').toLowerCase();
    if (s === 'confirmed' || s === 'seated') confirmed++;
    else if (s === 'pending') pending++;
    else if (s === 'cancelled' || s === 'canceled') cancelled++;
    else if (s === 'no_show' || s === 'no-show' || s === 'noshow') noshow++;
    else if (s === 'completed') completed++;
  }

  statsEl.innerHTML =
    dashStatBadge(confirmed, 'Confirmed', '#059669', '#d1fae5') +
    dashStatBadge(pending, 'Pending', '#d97706', '#fef3c7') +
    dashStatBadge(cancelled + noshow, 'Cancelled', '#dc2626', '#fee2e2') +
    dashStatBadge(completed, 'Completed', '#6366f1', '#ede9fe');

  // Upcoming bookings today
  var todayStr = new Date().toISOString().slice(0, 10);
  var upcoming = (allBookings || []).filter(function(b) {
    return b.booking_date >= todayStr && (b.status || '').toLowerCase() !== 'cancelled' && (b.status || '').toLowerCase() !== 'canceled' && (b.status || '').toLowerCase() !== 'no_show';
  }).sort(function(a, b) {
    return (a.booking_date + (a.booking_time || '')).localeCompare(b.booking_date + (b.booking_time || ''));
  }).slice(0, 5);

  if (upcoming.length > 0 && todayEl) {
    var rows = '<div style="font-size:11px;font-weight:600;color:#9ca3af;margin-bottom:6px;text-transform:uppercase;letter-spacing:.05em;">Upcoming</div>';
    for (var j = 0; j < upcoming.length; j++) {
      var bk = upcoming[j];
      var statusColor = bk.status === 'confirmed' ? '#059669' : '#d97706';
      rows += '<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid #f3f4f6;">' +
        '<div style="flex:1;min-width:0;">' +
          '<div style="font-size:12px;font-weight:600;color:#1f2937;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + (bk.guest_name || bk.name || '—') + '</div>' +
          '<div style="font-size:11px;color:#6b7280;">' + bk.booking_date + (bk.booking_time ? ' ' + bk.booking_time : '') + (bk.pax ? ' · ' + bk.pax + ' pax' : '') + '</div>' +
        '</div>' +
        '<div style="font-size:10px;font-weight:600;color:' + statusColor + ';background:' + (statusColor === '#059669' ? '#d1fae5' : '#fef3c7') + ';padding:2px 6px;border-radius:4px;flex-shrink:0;">' + (bk.status || '') + '</div>' +
        '</div>';
    }
    todayEl.innerHTML = rows;
  } else if (todayEl) {
    todayEl.innerHTML = '<div style="font-size:12px;color:#9ca3af;text-align:center;padding:8px 0;">No upcoming bookings</div>';
  }
}

function dashStatBadge(val, label, textColor, bgColor) {
  return '<div style="background:' + bgColor + ';border-radius:8px;padding:10px;text-align:center;">' +
    '<div style="font-size:22px;font-weight:700;color:' + textColor + ';">' + val + '</div>' +
    '<div style="font-size:11px;color:' + textColor + ';opacity:.8;font-weight:600;">' + label + '</div>' +
    '</div>';
}

// ---- Table Performance ----
function renderDashTablePerf(topTables) {
  var el = document.getElementById('dash-table-perf');
  var emptyEl = document.getElementById('dash-table-empty');
  if (!el) return;

  var tables = Array.isArray(topTables) ? topTables : [];
  if (tables.length === 0) {
    el.innerHTML = '';
    if (emptyEl) emptyEl.style.display = 'block';
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';

  var maxOrders = Math.max.apply(null, tables.map(function(t) { return parseInt(t.order_count, 10) || 0; }));
  var html = '';
  var shown = tables.slice(0, 10);
  for (var i = 0; i < shown.length; i++) {
    var t = shown[i];
    var cnt = parseInt(t.order_count, 10) || 0;
    var rev = parseInt(t.total_revenue_cents, 10) || 0;
    var pct = maxOrders > 0 ? Math.max(4, Math.round((cnt / maxOrders) * 100)) : 4;
    html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">' +
      '<div style="font-size:12px;font-weight:600;color:#374151;width:64px;flex-shrink:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + (t.table_name || '?') + '</div>' +
      '<div style="flex:1;background:#f3f4f6;border-radius:4px;height:14px;overflow:hidden;">' +
        '<div style="width:' + pct + '%;height:100%;background:linear-gradient(to right,#6366f1,#8b5cf6);border-radius:4px;"></div>' +
      '</div>' +
      '<div style="font-size:11px;color:#6b7280;width:28px;text-align:right;flex-shrink:0;">' + cnt + '</div>' +
      '<div style="font-size:11px;color:#059669;font-weight:600;width:52px;text-align:right;flex-shrink:0;">' + dashFmt(rev) + '</div>' +
    '</div>';
  }
  el.innerHTML = html;
}

// ---- Top Items ----
function renderDashTopItems(topItems) {
  var el = document.getElementById('dash-top-items');
  var emptyEl = document.getElementById('dash-top-items-empty');
  if (!el) return;

  var items = Array.isArray(topItems) ? topItems : [];
  if (items.length === 0) {
    el.innerHTML = '';
    if (emptyEl) emptyEl.style.display = 'block';
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';

  var maxQty = Math.max.apply(null, items.map(function(it) { return parseInt(it.total_qty, 10) || 0; }));
  var html = '';
  var shown = items.slice(0, 10);
  for (var i = 0; i < shown.length; i++) {
    var it = shown[i];
    var qty = parseInt(it.total_qty, 10) || 0;
    var rev = parseInt(it.total_revenue_cents, 10) || 0;
    var pct = maxQty > 0 ? Math.max(4, Math.round((qty / maxQty) * 100)) : 4;
    html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">' +
      '<div style="font-size:12px;font-weight:600;color:#374151;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + (it.item_name || '?') + '</div>' +
      '<div style="width:70px;background:#f3f4f6;border-radius:4px;height:14px;overflow:hidden;flex-shrink:0;">' +
        '<div style="width:' + pct + '%;height:100%;background:linear-gradient(to right,#f59e0b,#f97316);border-radius:4px;"></div>' +
      '</div>' +
      '<div style="font-size:11px;color:#6b7280;width:24px;text-align:right;flex-shrink:0;">×' + qty + '</div>' +
      '<div style="font-size:11px;color:#059669;font-weight:600;width:52px;text-align:right;flex-shrink:0;">' + dashFmt(rev) + '</div>' +
    '</div>';
  }
  el.innerHTML = html;
}

// ---- Order Status ----
function renderDashOrderStatus(orders) {
  var el = document.getElementById('dash-order-status');
  var emptyEl = document.getElementById('dash-order-status-empty');
  if (!el) return;

  if (orders.length === 0) {
    el.innerHTML = '';
    if (emptyEl) emptyEl.style.display = 'block';
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';

  var counts = {};
  for (var i = 0; i < orders.length; i++) {
    var s = orders[i].status || 'unknown';
    counts[s] = (counts[s] || 0) + 1;
  }

  var statusColors = {
    paid: '#059669', completed: '#059669',
    pending: '#d97706', confirmed: '#3b82f6',
    preparing: '#8b5cf6', ready: '#06b6d4',
    cancelled: '#dc2626', canceled: '#dc2626'
  };

  var html = '<div style="display:flex;flex-wrap:wrap;gap:8px;">';
  for (var st in counts) {
    var color = statusColors[st.toLowerCase()] || '#6b7280';
    html += '<div style="display:flex;align-items:center;gap:5px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:5px 10px;">' +
      '<span style="width:8px;height:8px;background:' + color + ';border-radius:50%;display:inline-block;"></span>' +
      '<span style="font-size:12px;color:#374151;font-weight:600;">' + st + '</span>' +
      '<span style="font-size:13px;font-weight:700;color:' + color + ';margin-left:2px;">' + counts[st] + '</span>' +
    '</div>';
  }
  html += '</div>';
  el.innerHTML = html;
}

// ---- Top Revenue Days ----
function renderDashTopDays(orders) {
  var el = document.getElementById('dash-top-days');
  var emptyEl = document.getElementById('dash-top-days-empty');
  if (!el) return;

  if (orders.length === 0) {
    el.innerHTML = '';
    if (emptyEl) emptyEl.style.display = 'block';
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';

  var byDay = {};
  for (var i = 0; i < orders.length; i++) {
    var o = orders[i];
    var df = new Intl.DateTimeFormat('en-CA', { timeZone: restaurantTimezone, year: 'numeric', month: '2-digit', day: '2-digit' });
    var d = df.format(new Date(o.created_at));
    if (!byDay[d]) byDay[d] = { orders: 0, revenue: 0 };
    byDay[d].orders++;
    byDay[d].revenue += parseInt(o.total_cents, 10) || 0;
  }

  var days = Object.keys(byDay).map(function(d) { return { date: d, orders: byDay[d].orders, revenue: byDay[d].revenue }; });
  days.sort(function(a, b) { return b.revenue - a.revenue; });
  var top = days.slice(0, 7);

  var maxRev = top.length > 0 ? top[0].revenue : 1;
  var html = '<div style="display:flex;flex-direction:column;gap:6px;">';
  for (var j = 0; j < top.length; j++) {
    var row = top[j];
    var pct = maxRev > 0 ? Math.max(4, Math.round((row.revenue / maxRev) * 100)) : 4;
    html += '<div style="display:flex;align-items:center;gap:10px;">' +
      '<div style="font-size:12px;color:#374151;font-weight:500;width:88px;flex-shrink:0;">' + row.date + '</div>' +
      '<div style="flex:1;background:#f3f4f6;border-radius:4px;height:14px;overflow:hidden;">' +
        '<div style="width:' + pct + '%;height:100%;background:linear-gradient(to right,#059669,#10b981);border-radius:4px;"></div>' +
      '</div>' +
      '<div style="font-size:11px;color:#6b7280;width:28px;text-align:right;flex-shrink:0;">' + row.orders + ' ord</div>' +
      '<div style="font-size:12px;color:#059669;font-weight:700;width:64px;text-align:right;flex-shrink:0;">' + dashFmt(row.revenue) + '</div>' +
    '</div>';
  }
  html += '</div>';
  el.innerHTML = html;
}
