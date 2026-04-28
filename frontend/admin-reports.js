// ============= ANALYTICS DASHBOARD MODULE =============
// New analytics dashboard - automatic on page load

// Initialization gate
let reportsInitialized = false;
let globalDateRange = 'month'; // today, week, month, all

function getGlobalDays() {
  if (globalDateRange === 'today') return 1;
  if (globalDateRange === 'week') return 7;
  if (globalDateRange === 'month') return 30;
  return 9999;
}

function setGlobalDateRange(range) {
  globalDateRange = range;
  // Update button styles
  var buttons = document.querySelectorAll('.global-date-btn');
  for (var i = 0; i < buttons.length; i++) {
    var btn = buttons[i];
    if (btn.dataset.range === range) {
      btn.style.background = '#4a90e2';
      btn.style.color = 'white';
      btn.style.border = 'none';
    } else {
      btn.style.background = 'transparent';
      btn.style.color = '#4a90e2';
      btn.style.border = '2px solid #4a90e2';
    }
  }
  // Re-render everything with new date range
  initializeAnalyticsDashboard();
}

// ========== INITIALIZE REPORTS ==========
async function initializeReports() {
  // Always load and render analytics dashboard when section is switched to
  await initializeAnalyticsDashboard();
  
  // Attach event listeners only once
  if (!reportsInitialized) {
    reportsInitialized = true;
    attachEventListeners();
  }
}

// ========== ATTACH EVENT LISTENERS ==========
function attachEventListeners() {
  // Language change listener
  window.addEventListener('languageChanged', () => {
    initializeAnalyticsDashboard();
  });
}

// ========== ANALYTICS DASHBOARD ==========
async function initializeAnalyticsDashboard() {
  try {
    // Get element references
    var dashboardEl = document.getElementById("reports-dashboard");
    var loadingEl = document.getElementById("reports-loading");
    
    // Show loading state
    if (dashboardEl) dashboardEl.style.display = "none";
    if (loadingEl) loadingEl.style.display = "block";

    // Fetch orders, top-items, top-tables, all tables, menu, and staff in parallel
    var ordersUrl = API + "/restaurants/" + restaurantId + "/orders?limit=1000";
    var topItemsUrl = API + "/restaurants/" + restaurantId + "/reports/top-items?days=" + getGlobalDays();
    var topTablesUrl = API + "/restaurants/" + restaurantId + "/reports/top-tables?days=" + getGlobalDays();
    var tablesUrl = API + "/restaurants/" + restaurantId + "/tables";
    var menuUrl = API + "/restaurants/" + restaurantId + "/menu";
    var staffUrl = API + "/restaurants/" + restaurantId + "/staff";
    var bookingsUrl = API + "/restaurants/" + restaurantId + "/bookings";

    var [ordersRes, topItemsRes, topTablesRes, tablesRes, menuRes, staffRes, bookingsRes] = await Promise.all([
      fetch(ordersUrl),
      fetch(topItemsUrl),
      fetch(topTablesUrl),
      fetch(tablesUrl),
      fetch(menuUrl),
      fetch(staffUrl),
      fetch(bookingsUrl)
    ]);

    if (!ordersRes.ok) {
      throw new Error("Failed to load orders: " + ordersRes.status);
    }

    var allOrders = await ordersRes.json();
    var topItems = topItemsRes.ok ? await topItemsRes.json() : [];
    var topTables = topTablesRes.ok ? await topTablesRes.json() : [];
    var allTables = tablesRes.ok ? await tablesRes.json() : [];
    var menuData = menuRes.ok ? await menuRes.json() : {};
    var menuItems = (menuData && menuData.items) ? menuData.items : [];
    var allStaff = staffRes.ok ? await staffRes.json() : [];
    var allBookings = bookingsRes.ok ? await bookingsRes.json() : [];

    if (!allOrders || !allOrders.length) {
      // No orders yet - show empty state with 0 values
      var stats = {
        total_orders: 0,
        total_revenue: 0,
        average_bill: 0,
        active_sessions: 0,
        total_discount: 0,
        order_count_by_status: {},
        revenue_by_day: {},
        revenue_by_hour: {},
        daily_order_counts: {},
        daily_customers: {},
        daily_discount: {},
        table_orders: {},
        item_sales: {},
        topItems: [],
        topTables: [],
        allTables: allTables,
        menuItems: menuItems,
        allStaff: allStaff,
        allBookings: allBookings
      };
      renderAnalyticsDashboard(stats);
      if (loadingEl) loadingEl.style.display = "none";
      if (dashboardEl) dashboardEl.style.display = "block";
      return;
    }

    // Filter orders by global date range
    var days = getGlobalDays();
    var now = Date.now();
    var filteredOrders = allOrders;
    if (days < 9999) {
      filteredOrders = allOrders.filter(function(order) {
        return (now - new Date(order.created_at).getTime()) / (1000 * 60 * 60 * 24) <= days;
      });
    }

    // Calculate stats from orders
    var stats = calculateAnalyticsStats(filteredOrders);
    stats.topItems = topItems || [];
    stats.topTables = topTables || [];
    stats.allTables = allTables || [];
    stats.menuItems = menuItems || [];
    stats.allStaff = allStaff || [];
    stats.allBookings = allBookings || [];

    // Render dashboard
    renderAnalyticsDashboard(stats);

    // Hide loading and show dashboard
    if (loadingEl) loadingEl.style.display = "none";
    if (dashboardEl) dashboardEl.style.display = "block";

  } catch (error) {
    console.error("Error initializing analytics dashboard:", error);
    console.error("Error stack:", error.stack);
    var loadingEl = document.getElementById("reports-loading");
    if (loadingEl) {
      loadingEl.innerHTML = '<p style="font-size: 16px; color: #e74c3c;">Error loading dashboard: ' + error.message + '</p>';
    }
  }
}

function calculateAnalyticsStats(orders) {
  var stats = {
    total_orders: orders.length,
    total_revenue: 0,
    average_bill: 0,
    active_sessions: orders.length,
    total_discount: 0,
    order_count_by_status: {},
    revenue_by_day: {},
    revenue_by_hour: {},
    daily_order_counts: {},
    daily_customers: {},
    daily_discount: {},
    table_orders: {},
    item_sales: {},
    orders_by_hour: {},
    allOrders: orders
  };

  if (orders.length === 0) {
    return stats;
  }

  // Calculate revenue and status breakdown
  for (var oi = 0; oi < orders.length; oi++) {
    var order = orders[oi];
    var orderAmount = parseInt(order.total_cents, 10) || 0;
    var discountAmount = parseInt(order.discount_cents, 10) || 0;
    stats.total_revenue += orderAmount;
    stats.total_discount += discountAmount;

    // Count by status
    var orderStatus = order.status || "unknown";
    if (!stats.order_count_by_status[orderStatus]) {
      stats.order_count_by_status[orderStatus] = 0;
    }
    stats.order_count_by_status[orderStatus]++;

    // Revenue by day (in restaurant timezone)
    var createdDate = new Date(order.created_at);
    // Format date in restaurant's timezone
    var dateFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: restaurantTimezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    var dateStr = dateFormatter.format(createdDate);
    // Convert MM/DD/YYYY to YYYY-MM-DD
    var [month, day, year] = dateStr.split('/');
    var date = year + '-' + month + '-' + day;
    if (!stats.revenue_by_day[date]) {
      stats.revenue_by_day[date] = 0;
      stats.daily_order_counts[date] = 0;
      stats.daily_customers[date] = 0;
      stats.daily_discount[date] = 0;
    }
    stats.revenue_by_day[date] += orderAmount;
    stats.daily_order_counts[date]++;
    stats.daily_customers[date]++;
    stats.daily_discount[date] += discountAmount;

    // Revenue by hour (in restaurant timezone)
    var hourFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: restaurantTimezone,
      hour: '2-digit',
      hour12: false
    });
    var hourStr = hourFormatter.format(createdDate);
    var hourKey = hourStr + ':00';
    if (!stats.revenue_by_hour[hourKey]) {
      stats.revenue_by_hour[hourKey] = 0;
      stats.orders_by_hour[hourKey] = 0;
    }
    stats.revenue_by_hour[hourKey] += orderAmount;
    stats.orders_by_hour[hourKey]++;
  }

  stats.average_bill = stats.total_orders > 0 ? Math.round(stats.total_revenue / stats.total_orders) : 0;

  return stats;
}

function renderAnalyticsDashboard(stats) {
  // Store stats globally for trend button access
  window.lastStats = stats;
  
  // Update metric cards
  var metricTotalOrders = document.getElementById("metric-total-orders");
  var metricTotalRevenue = document.getElementById("metric-total-revenue");
  var metricAvgBill = document.getElementById("metric-avg-bill");
  var metricActiveSessions = document.getElementById("metric-active-sessions");
  var metricCustomersPerDay = document.getElementById("metric-customers-per-day");
  var metricAvgSpendCustomer = document.getElementById("metric-avg-spend-customer");
  var metricTotalDiscounts = document.getElementById("metric-total-discounts");
  var metricAvgDailyNet = document.getElementById("metric-avg-daily-net");
  var metricAvgDailyCustomers = document.getElementById("metric-avg-daily-customers");
  
  if (metricTotalOrders) {
    metricTotalOrders.textContent = stats.total_orders;
  }
  if (metricTotalRevenue) {
    metricTotalRevenue.textContent = "$" + (stats.total_revenue / 100).toFixed(2);
  }
  if (metricAvgBill) {
    metricAvgBill.textContent = "$" + (stats.average_bill / 100).toFixed(2);
  }

  // Calculate new metrics
  var dayKeys = Object.keys(stats.revenue_by_day || {});
  var numDays = dayKeys.length || 1;
  var totalCustomers = stats.total_orders; // 1 order = 1 customer session
  var totalDiscount = stats.total_discount || 0;
  var netSales = stats.total_revenue - totalDiscount;

  if (metricCustomersPerDay) {
    metricCustomersPerDay.textContent = (totalCustomers / numDays).toFixed(1);
  }
  if (metricAvgSpendCustomer) {
    var avgSpend = totalCustomers > 0 ? stats.total_revenue / totalCustomers : 0;
    metricAvgSpendCustomer.textContent = "$" + (avgSpend / 100).toFixed(2);
  }
  if (metricTotalDiscounts) {
    metricTotalDiscounts.textContent = "$" + (totalDiscount / 100).toFixed(2);
  }
  if (metricAvgDailyNet) {
    metricAvgDailyNet.textContent = "$" + (netSales / numDays / 100).toFixed(2);
  }
  if (metricAvgDailyCustomers) {
    metricAvgDailyCustomers.textContent = (totalCustomers / numDays).toFixed(1);
  }

  renderRevenueReport(stats);

  renderBusiestTables(stats);

  renderHourlyRevenue(stats);

  renderTopItems(stats);

  renderTopRevenueDays(stats);

  renderOrderStatusBreakdown(stats);

  renderDailyTrends(stats, 'daily');

  loadSalesByCategory();
  loadSalesByItem();
  loadPaymentByType();
  loadStaffHours();
  loadOrderStatusTiming();

  renderBookingsAnalytics(stats);
}

function renderRevenueReport(stats) {
  var container = document.getElementById("revenue-report-content");
  if (!container) {
    return;
  }

  // Store stats for filtering
  window.reportStats = stats;
  window.allOrders = stats.allOrders || [];
  window.allTables = stats.allTables || [];
  window.menuItems = stats.menuItems || [];
  window.allStaff = stats.allStaff || [];

  // Populate filter dropdowns
  var categorySelect = document.getElementById("revenue-filter-category");
  var staffSelect = document.getElementById("revenue-filter-staff");
  var tableSelect = document.getElementById("revenue-filter-table");
  var productSelect = document.getElementById("revenue-filter-product");

  // Clear all dropdowns before repopulating (prevents duplicates on re-render)
  if (categorySelect) { while (categorySelect.options.length > 1) categorySelect.remove(1); }
  if (staffSelect) { while (staffSelect.options.length > 1) staffSelect.remove(1); }
  if (tableSelect) { while (tableSelect.options.length > 1) tableSelect.remove(1); }
  if (productSelect) { while (productSelect.options.length > 1) productSelect.remove(1); }

  // Populate category dropdown from menu categories (via menuItems which carry category_name)
  var categorySet = {};
  for (var mi2 = 0; mi2 < window.menuItems.length; mi2++) {
    var catN = window.menuItems[mi2].category_name;
    if (catN) categorySet[catN] = true;
  }
  if (categorySelect) {
    for (var cat in categorySet) {
      var option = document.createElement("option");
      option.value = cat;
      option.textContent = cat;
      categorySelect.appendChild(option);
    }
  }

  // Populate staff dropdown from restaurant staff list
  if (staffSelect) {
    for (var si = 0; si < window.allStaff.length; si++) {
      var staffMember = window.allStaff[si];
      var option = document.createElement("option");
      option.value = staffMember.name;
      option.textContent = staffMember.name;
      staffSelect.appendChild(option);
    }
  }

  // Populate table dropdown from all restaurant tables (not just tables with orders)
  if (tableSelect) {
    for (var ti = 0; ti < window.allTables.length; ti++) {
      var tblRow = window.allTables[ti];
      var option = document.createElement("option");
      option.value = tblRow.name;
      option.textContent = tblRow.name;
      tableSelect.appendChild(option);
    }
  }

  // Populate product dropdown from menu items, grouped by food category
  if (productSelect) {
    var menuByCategory = {};
    for (var mi = 0; mi < window.menuItems.length; mi++) {
      var menuItem = window.menuItems[mi];
      var catName = menuItem.category_name || 'Other';
      if (!menuByCategory[catName]) {
        menuByCategory[catName] = [];
      }
      menuByCategory[catName].push(menuItem);
    }
    for (var catKey in menuByCategory) {
      var group = document.createElement("optgroup");
      group.label = catKey;
      var catItems = menuByCategory[catKey];
      for (var itemIdx = 0; itemIdx < catItems.length; itemIdx++) {
        var opt = document.createElement("option");
        opt.value = catItems[itemIdx].name;
        opt.textContent = catItems[itemIdx].name;
        group.appendChild(opt);
      }
      productSelect.appendChild(group);
    }
  }

  // Initial render
  filterRevenueReport();
}

function sortRevenueTable(col) {
  var container = document.getElementById("revenue-report-content");
  if (!container || !window._revenueByDate) return;
  
  var sortState = window._revenueCurrentSort || { col: 'date', asc: false };
  if (sortState.col === col) {
    sortState.asc = !sortState.asc;
  } else {
    sortState.col = col;
    sortState.asc = col !== 'revenue'; // revenue defaults descending
  }
  window._revenueCurrentSort = sortState;

  // Update sort indicators
  ['date', 'orders', 'discount', 'revenue'].forEach(function(c) {
    var el = document.getElementById('sort-indicator-' + c);
    if (el) el.innerHTML = c === col ? (sortState.asc ? '&#9650;' : '&#9660;') : '';
  });

  var revenueByDate = window._revenueByDate;
  var rowTemplate = document.getElementById("revenue-report-row-template");
  var tbody = container.querySelector('[data-rows-container]');
  if (!tbody || !rowTemplate) return;

  var dates = Object.keys(revenueByDate);
  dates.sort(function(a, b) {
    var da = revenueByDate[a], db = revenueByDate[b];
    var va, vb;
    if (col === 'date') { va = new Date(a).getTime(); vb = new Date(b).getTime(); }
    else if (col === 'orders') { va = da.count; vb = db.count; }
    else if (col === 'discount') { va = da.discount; vb = db.discount; }
    else { va = da.revenue; vb = db.revenue; }
    return sortState.asc ? (va - vb) : (vb - va);
  });

  tbody.innerHTML = '';
  for (var di = 0; di < dates.length; di++) {
    var date = dates[di];
    var data = revenueByDate[date];
    var row = rowTemplate.content.cloneNode(true);
    row.querySelector('[data-field="date"]').textContent = date;
    row.querySelector('[data-field="orders"]').textContent = data.count;
    row.querySelector('[data-field="discount"]').textContent = data.discount > 0 ? '-$' + (data.discount / 100).toFixed(2) : '\u2014';
    row.querySelector('[data-field="revenue"]').textContent = '$' + (data.revenue / 100).toFixed(2);
    tbody.appendChild(row);
  }
}

function filterRevenueReport() {
  var container = document.getElementById("revenue-report-content");
  if (!container || !window.allOrders) {
    return;
  }

  var dateRangeEl = document.getElementById("revenue-filter-daterange");
  var categoryFilterEl = document.getElementById("revenue-filter-category");
  var staffFilterEl = document.getElementById("revenue-filter-staff");
  var tableFilterEl = document.getElementById("revenue-filter-table");
  var productFilterEl = document.getElementById("revenue-filter-product");

  var dateRange = globalDateRange;
  var categoryFilter = (categoryFilterEl && categoryFilterEl.value) ? categoryFilterEl.value : "";
  var staffFilter = (staffFilterEl && staffFilterEl.value) ? staffFilterEl.value : "";
  var tableFilter = (tableFilterEl && tableFilterEl.value) ? tableFilterEl.value : "";
  var productFilter = (productFilterEl && productFilterEl.value) ? productFilterEl.value : "";

  // Filter orders based on criteria
  var filteredOrders = window.allOrders.filter(function(order) {
    // Date filter
    var orderDate = new Date(order.created_at);
    var now = new Date();
    var daysDiff = (now - orderDate) / (1000 * 60 * 60 * 24);
    
    var passedDateFilter = false;
    if (dateRange === "today") {
      passedDateFilter = daysDiff <= 1;
    } else if (dateRange === "week") {
      passedDateFilter = daysDiff <= 7;
    } else if (dateRange === "month") {
      passedDateFilter = daysDiff <= 30;
    } else if (dateRange === "all") {
      passedDateFilter = true;
    }

    if (!passedDateFilter) return false;

    // Category filter — check if any of the order's item categories match
    if (categoryFilter) {
      var catNames = order.category_names || [];
      if (!catNames.includes(categoryFilter)) return false;
    }

    // Staff filter
    if (staffFilter && order.closed_by_staff_name !== staffFilter) return false;

    // Table filter
    if (tableFilter && order.table_name !== tableFilter) return false;

    // Product filter
    if (productFilter) {
      var itemNames = order.item_names || [];
      if (!itemNames.includes(productFilter)) return false;
    }

    return true;
  });

  // Calculate totals
  var totalRevenue = 0;
  var totalDiscount = 0;
  var totalOrders = filteredOrders.length;
  
  for (var oi = 0; oi < filteredOrders.length; oi++) {
    totalRevenue += parseInt(filteredOrders[oi].total_cents, 10) || 0;
    totalDiscount += parseInt(filteredOrders[oi].discount_cents, 10) || 0;
  }

  var avgBill = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  var netSales = totalRevenue - totalDiscount;

  // Group by date for template
  var revenueByDate = {};
  for (var oi = 0; oi < filteredOrders.length; oi++) {
    var order = filteredOrders[oi];
    var dateStr = new Date(order.created_at).toLocaleDateString();
    if (!revenueByDate[dateStr]) {
      revenueByDate[dateStr] = { revenue: 0, count: 0, discount: 0 };
    }
    revenueByDate[dateStr].revenue += parseInt(order.total_cents, 10) || 0;
    revenueByDate[dateStr].discount += parseInt(order.discount_cents, 10) || 0;
    revenueByDate[dateStr].count++;
  }

  // Clone template and populate with data
  var template = document.getElementById("revenue-report-template");
  var rowTemplate = document.getElementById("revenue-report-row-template");
  if (!template || !rowTemplate) return;

  var fragment = template.content.cloneNode(true);
  
  // Update header metrics
  fragment.querySelector('[data-field="total-revenue"]').textContent = '$' + (totalRevenue / 100).toFixed(2);
  fragment.querySelector('[data-field="total-orders"]').textContent = totalOrders;
  fragment.querySelector('[data-field="avg-bill"]').textContent = '$' + (avgBill / 100).toFixed(2);
  fragment.querySelector('[data-field="total-discounts"]').textContent = '-$' + (totalDiscount / 100).toFixed(2);
  fragment.querySelector('[data-field="net-sales"]').textContent = '$' + (netSales / 100).toFixed(2);
  
  // Populate table rows — default sort: date descending
  window._revenueByDate = revenueByDate;
  var tbody = fragment.querySelector('[data-rows-container]');
  var dates = Object.keys(revenueByDate).sort().reverse();
  for (var di = 0; di < dates.length; di++) {
    var date = dates[di];
    var data = revenueByDate[date];
    var row = rowTemplate.content.cloneNode(true);
    row.querySelector('[data-field="date"]').textContent = date;
    row.querySelector('[data-field="orders"]').textContent = data.count;
    row.querySelector('[data-field="discount"]').textContent = data.discount > 0 ? '-$' + (data.discount / 100).toFixed(2) : '—';
    row.querySelector('[data-field="revenue"]').textContent = '$' + (data.revenue / 100).toFixed(2);
    row.setAttribute && row.setAttribute('data-date', date);
    tbody.appendChild(row);
  }
  
  container.innerHTML = '';
  container.appendChild(fragment);
  window._revenueCurrentSort = { col: 'date', asc: false };
  reTranslateContent();
}

function renderBusiestTables(stats) {
  var container = document.getElementById("chart-busiest-tables");
  if (!container) return;

  var topTables = stats.topTables || [];

  if (topTables.length === 0) {
    container.innerHTML = '<p style="color: #999; text-align: center; padding: 20px;" data-i18n="admin.no-data">No data available.</p>';
    return;
  }

  var maxOrders = parseInt(topTables[0].order_count, 10) || 1;
  var html = '<table style="width:100%;font-size:13px;border-collapse:collapse;">' +
    '<thead><tr style="border-bottom:2px solid #e5e7eb;background:#f9fafb;">' +
    '<th style="padding:10px 12px;text-align:left;font-weight:600;color:#6b7280;" data-i18n="admin.col-table">Table</th>' +
    '<th style="padding:10px 12px;text-align:right;font-weight:600;color:#6b7280;" data-i18n="admin.col-orders">Orders</th>' +
    '<th style="padding:10px 12px;text-align:right;font-weight:600;color:#6b7280;" data-i18n="admin.col-revenue">Revenue</th>' +
    '<th style="padding:10px 12px;" ></th>' +
    '</tr></thead><tbody>';

  for (var ti = 0; ti < topTables.length; ti++) {
    var tbl = topTables[ti];
    var orderCount = parseInt(tbl.order_count, 10) || 0;
    var revenue = parseInt(tbl.total_revenue_cents, 10) || 0;
    var barPct = Math.round((orderCount / maxOrders) * 100);
    html += '<tr style="border-bottom:1px solid #f0f0f0;">' +
      '<td style="padding:10px 12px;font-weight:500;color:#1f2937;">' + tbl.table_name + '</td>' +
      '<td style="padding:10px 12px;text-align:right;color:#667eea;font-weight:600;">' + orderCount + '</td>' +
      '<td style="padding:10px 12px;text-align:right;color:#059669;font-weight:600;">$' + (revenue / 100).toFixed(2) + '</td>' +
      '<td style="padding:10px 12px;min-width:120px;">' +
        '<div style="background:#f3f4f6;border-radius:4px;height:8px;overflow:hidden;">' +
          '<div style="background:#667eea;height:100%;width:' + barPct + '%;border-radius:4px;"></div>' +
        '</div>' +
      '</td>' +
      '</tr>';
  }

  html += '</tbody></table>';
  container.innerHTML = html;
  reTranslateContent();
}

function renderHourlyRevenue(stats) {
  var container = document.getElementById("chart-hourly-revenue");
  if (!container) return;

  if (!stats.revenue_by_hour) stats.revenue_by_hour = {};
  if (!stats.orders_by_hour) stats.orders_by_hour = {};

  var revenueValues = Object.values(stats.revenue_by_hour);
  var maxRevenue = Math.max.apply(null, revenueValues.length > 0 ? revenueValues : [1]);
  if (maxRevenue <= 0) maxRevenue = 1;

  var html = '<table style="width:100%;font-size:13px;border-collapse:collapse;">' +
    '<thead><tr style="border-bottom:2px solid #e5e7eb;background:#f9fafb;">' +
    '<th style="padding:10px 12px;text-align:left;font-weight:600;color:#6b7280;" data-i18n="admin.col-hour">Hour</th>' +
    '<th style="padding:10px 12px;text-align:right;font-weight:600;color:#6b7280;" data-i18n="admin.col-orders">Orders</th>' +
    '<th style="padding:10px 12px;text-align:right;font-weight:600;color:#6b7280;" data-i18n="admin.col-revenue">Revenue</th>' +
    '<th style="padding:10px 12px;"></th>' +
    '</tr></thead><tbody>';

  for (var i = 0; i < 24; i++) {
    var hourKey = i + ':00';
    var revenue = stats.revenue_by_hour[hourKey] || 0;
    var orderCount = stats.orders_by_hour[hourKey] || 0;
    if (orderCount === 0 && revenue === 0) continue;
    var barPct = Math.round((revenue / maxRevenue) * 100);
    html += '<tr style="border-bottom:1px solid #f0f0f0;">' +
      '<td style="padding:10px 12px;font-weight:500;color:#1f2937;">' + String(i).padStart(2, '0') + ':00</td>' +
      '<td style="padding:10px 12px;text-align:right;color:#667eea;font-weight:600;">' + orderCount + '</td>' +
      '<td style="padding:10px 12px;text-align:right;color:#059669;font-weight:600;">$' + (revenue / 100).toFixed(2) + '</td>' +
      '<td style="padding:10px 12px;min-width:120px;">' +
        '<div style="background:#f3f4f6;border-radius:4px;height:8px;overflow:hidden;">' +
          '<div style="background:linear-gradient(to right,#667eea,#764ba2);height:100%;width:' + barPct + '%;border-radius:4px;"></div>' +
        '</div>' +
      '</td>' +
      '</tr>';
  }

  if (html.indexOf('<tr') === -1) {
    html += '<tr><td colspan="4" style="padding:20px;text-align:center;color:#999;" data-i18n="admin.no-data">No data available.</td></tr>';
  }

  html += '</tbody></table>';
  container.innerHTML = html;
  reTranslateContent();
}

function renderTopItems(stats) {
  // Deprecated: the Sales by Item section (below) renders a better version.
  // We no longer render a separate Top Selling Items section.
  // The old #chart-top-items container is removed from the HTML.
}

function renderTopRevenueDays(stats) {
  var container = document.getElementById('top-revenue-days');
  if (!container) return;

  var revenueByDay = stats.revenue_by_day || {};
  var entries = [];
  for (var date in revenueByDay) {
    if (revenueByDay.hasOwnProperty(date)) {
      entries.push({ date: date, revenue: revenueByDay[date], orders: stats.daily_order_counts[date] || 0 });
    }
  }
  entries.sort(function(a, b) { return b.revenue - a.revenue; });
  entries = entries.slice(0, 5);

  if (entries.length === 0) {
    container.innerHTML = '<p style="color: #999; text-align: center; padding: 16px;">No data available.</p>';
    return;
  }

  var html = '<div style="display: flex; flex-wrap: wrap; gap: 12px;">';
  for (var i = 0; i < entries.length; i++) {
    var e = entries[i];
    var colors = ['#667eea', '#e67e22', '#059669', '#8b5cf6', '#06b6d4'];
    html += '<div style="flex: 1; min-width: 150px; background: linear-gradient(135deg, ' + colors[i % colors.length] + '22, ' + colors[i % colors.length] + '11); border: 1px solid ' + colors[i % colors.length] + '33; border-radius: 10px; padding: 14px; text-align: center;">' +
      '<div style="font-size: 20px; font-weight: 700; color: ' + colors[i % colors.length] + ';">#' + (i + 1) + '</div>' +
      '<div style="font-size: 13px; font-weight: 600; color: #374151; margin: 4px 0;">' + formatTimeWithTimezone(e.date, restaurantTimezone, 'date') + '</div>' +
      '<div style="font-size: 18px; font-weight: 700; color: #059669;">$' + (e.revenue / 100).toFixed(2) + '</div>' +
      '<div style="font-size: 11px; color: #6b7280;">' + e.orders + ' orders</div>' +
      '</div>';
  }
  html += '</div>';
  container.innerHTML = html;
}

function renderOrderStatusBreakdown(stats) {
  var container = document.getElementById('order-status-breakdown');
  if (!container) return;

  var statusCounts = stats.order_count_by_status || {};
  var entries = [];
  for (var status in statusCounts) {
    if (statusCounts.hasOwnProperty(status)) {
      entries.push({ status: status, count: statusCounts[status] });
    }
  }
  entries.sort(function(a, b) { return b.count - a.count; });

  if (entries.length === 0) {
    container.innerHTML = '<p style="color: #999; text-align: center; padding: 16px;">No data available.</p>';
    return;
  }

  var statusColors = { paid: '#059669', completed: '#059669', pending: '#f59e0b', preparing: '#4a90e2', ready: '#8b5cf6', cancelled: '#dc2626', refunded: '#dc2626' };
  var html = '<div style="display: flex; flex-wrap: wrap; gap: 10px;">';
  for (var i = 0; i < entries.length; i++) {
    var e = entries[i];
    var color = statusColors[e.status] || '#6b7280';
    html += '<div style="display: flex; align-items: center; gap: 8px; padding: 8px 14px; background: ' + color + '11; border: 1px solid ' + color + '33; border-radius: 8px;">' +
      '<span style="display: inline-block; width: 10px; height: 10px; background: ' + color + '; border-radius: 50%;"></span>' +
      '<span style="font-size: 13px; font-weight: 500; color: #374151; text-transform: capitalize;">' + e.status + '</span>' +
      '<span style="font-size: 14px; font-weight: 700; color: ' + color + ';">' + e.count + '</span>' +
      '</div>';
  }
  html += '</div>';
  container.innerHTML = html;
}

function renderDailyTrends(stats, mode) {
  var container = document.getElementById("table-daily-trends");
  if (!container) return;

  // Update button styles
  var dailyBtn = document.getElementById("trends-daily-btn");
  var weeklyBtn = document.getElementById("trends-weekly-btn");
  var monthlyBtn = document.getElementById("trends-monthly-btn");

  if (dailyBtn) dailyBtn.style.background = mode === 'daily' ? '#4a90e2' : 'transparent';
  if (dailyBtn) dailyBtn.style.color = mode === 'daily' ? 'white' : '#4a90e2';
  if (dailyBtn) dailyBtn.style.border = mode === 'daily' ? 'none' : '2px solid #4a90e2';
  
  if (weeklyBtn) weeklyBtn.style.background = mode === 'weekly' ? '#4a90e2' : 'transparent';
  if (weeklyBtn) weeklyBtn.style.color = mode === 'weekly' ? 'white' : '#4a90e2';
  if (weeklyBtn) weeklyBtn.style.border = mode === 'weekly' ? 'none' : '2px solid #4a90e2';
  
  if (monthlyBtn) monthlyBtn.style.background = mode === 'monthly' ? '#4a90e2' : 'transparent';
  if (monthlyBtn) monthlyBtn.style.color = mode === 'monthly' ? 'white' : '#4a90e2';
  if (monthlyBtn) monthlyBtn.style.border = mode === 'monthly' ? 'none' : '2px solid #4a90e2';

  var entries = [];
  if (mode === 'daily') {
    // Daily - one entry per day
    for (var date in stats.revenue_by_day) {
      if (stats.revenue_by_day.hasOwnProperty(date)) {
        entries.push({
          period: date,
          label: formatTimeWithTimezone(date, restaurantTimezone, 'date'),
          revenue: stats.revenue_by_day[date],
          count: stats.daily_order_counts[date] || 0,
          customers: stats.daily_customers[date] || 0,
          discount: stats.daily_discount[date] || 0
        });
      }
    }
    entries.sort(function(a, b) {
      return new Date(b.period) - new Date(a.period);
    });
  } else if (mode === 'weekly') {
    // Weekly - group by week
    var weekMap = {};
    for (var date2 in stats.revenue_by_day) {
      if (stats.revenue_by_day.hasOwnProperty(date2)) {
        var dateObj = new Date(date2);
        var weekStart = new Date(dateObj);
        var day = weekStart.getDay();
        var diff = weekStart.getDate() - day;
        weekStart.setDate(diff);
        var weekKey = weekStart.toISOString().split('T')[0];
        
        if (!weekMap[weekKey]) {
          weekMap[weekKey] = {
            period: weekKey,
            revenue: 0,
            count: 0,
            customers: 0,
            discount: 0
          };
        }
        weekMap[weekKey].revenue += stats.revenue_by_day[date2];
        weekMap[weekKey].count += stats.daily_order_counts[date2] || 0;
        weekMap[weekKey].customers += stats.daily_customers[date2] || 0;
        weekMap[weekKey].discount += stats.daily_discount[date2] || 0;
      }
    }
    for (var week in weekMap) {
      if (weekMap.hasOwnProperty(week)) {
        var weekStart2 = new Date(week);
        var weekEnd = new Date(weekStart2);
        weekEnd.setDate(weekEnd.getDate() + 6);
        var weekStart2Str = formatTimeWithTimezone(week, restaurantTimezone, 'date');
        var weekEndStr = formatTimeWithTimezone(weekEnd.toISOString().split('T')[0], restaurantTimezone, 'date');
        entries.push({
          period: week,
          label: weekStart2Str + ' - ' + weekEndStr,
          revenue: weekMap[week].revenue,
          count: weekMap[week].count,
          customers: weekMap[week].customers,
          discount: weekMap[week].discount
        });
      }
    }
    entries.sort(function(a, b) {
      return new Date(b.period) - new Date(a.period);
    });
  } else if (mode === 'monthly') {
    // Monthly - group by month
    var monthMap = {};
    for (var date3 in stats.revenue_by_day) {
      if (stats.revenue_by_day.hasOwnProperty(date3)) {
        var monthKey = date3.substring(0, 7);
        if (!monthMap[monthKey]) {
          monthMap[monthKey] = {
            period: monthKey,
            revenue: 0,
            count: 0,
            customers: 0,
            discount: 0
          };
        }
        monthMap[monthKey].revenue += stats.revenue_by_day[date3];
        monthMap[monthKey].count += stats.daily_order_counts[date3] || 0;
        monthMap[monthKey].customers += stats.daily_customers[date3] || 0;
        monthMap[monthKey].discount += stats.daily_discount[date3] || 0;
      }
    }
    for (var month in monthMap) {
      if (monthMap.hasOwnProperty(month)) {
        entries.push({
          period: month,
          label: formatTimeWithTimezone(month + '-01', restaurantTimezone, 'month'),
          revenue: monthMap[month].revenue,
          count: monthMap[month].count,
          customers: monthMap[month].customers,
          discount: monthMap[month].discount
        });
      }
    }
    entries.sort(function(a, b) {
      return new Date(b.period) - new Date(a.period);
    });
  }

  // Clone template and populate with data
  var template = document.getElementById("daily-trends-table-template");
  var rowTemplate = document.getElementById("daily-trends-row-template");
  if (!template || !rowTemplate) {
    container.innerHTML = '<p style="color: #999; text-align: center;">No data</p>';
    return;
  }

  var fragment = template.content.cloneNode(true);
  var tbody = fragment.querySelector('[data-rows-container]');

  for (var ei = 0; ei < entries.length; ei++) {
    var item = entries[ei];
    var avg = item.customers > 0 ? item.revenue / item.customers : 0;
    var netSales = item.revenue - item.discount;
    
    var row = rowTemplate.content.cloneNode(true);
    row.querySelector('[data-field="label"]').textContent = item.label;
    row.querySelector('[data-field="orders"]').textContent = item.count;
    row.querySelector('[data-field="customers"]').textContent = item.customers;
    row.querySelector('[data-field="revenue"]').textContent = '$' + (item.revenue / 100).toFixed(2);
    row.querySelector('[data-field="discount"]').textContent = item.discount > 0 ? '-$' + (item.discount / 100).toFixed(2) : '$0.00';
    row.querySelector('[data-field="net-sales"]').textContent = '$' + (netSales / 100).toFixed(2);
    row.querySelector('[data-field="avg-spend"]').textContent = '$' + (avg / 100).toFixed(2);
    
    tbody.appendChild(row);
  }

  container.innerHTML = '';
  container.appendChild(fragment);
  reTranslateContent();
}

// ========== SALES BY CATEGORY ==========

async function loadSalesByCategory() {
  var container = document.getElementById('sales-by-category-content');
  if (!container) return;

  var days = getGlobalDays();

  container.innerHTML = '<p style="color: #999; text-align: center; padding: 16px;">Loading...</p>';

  try {
    var url = API + '/restaurants/' + restaurantId + '/reports/sales-by-category?days=' + days;
    var res = await fetch(url);
    if (!res.ok) throw new Error('Failed');
    var data = await res.json();

    if (!data || data.length === 0) {
      container.innerHTML = '<p style="color: #999; text-align: center; padding: 16px;">No data available.</p>';
      return;
    }

    var totalRev = 0;
    for (var i = 0; i < data.length; i++) {
      totalRev += parseInt(data[i].total_revenue_cents, 10) || 0;
    }

    var html = '<table style="width: 100%; font-size: 13px; border-collapse: collapse;">' +
      '<thead><tr style="border-bottom: 2px solid #e5e7eb; background: #f9fafb;">' +
      '<th style="padding: 10px 12px; text-align: left; font-weight: 600; color: #6b7280;" data-i18n="admin.col-category">Category</th>' +
      '<th style="padding: 10px 12px; text-align: right; font-weight: 600; color: #6b7280;" data-i18n="admin.col-items-sold">Items Sold</th>' +
      '<th style="padding: 10px 12px; text-align: right; font-weight: 600; color: #6b7280;" data-i18n="admin.col-orders">Orders</th>' +
      '<th style="padding: 10px 12px; text-align: right; font-weight: 600; color: #6b7280;" data-i18n="admin.col-revenue">Revenue</th>' +
      '<th style="padding: 10px 12px; text-align: right; font-weight: 600; color: #6b7280;">%</th>' +
      '</tr></thead><tbody>';

    for (var i = 0; i < data.length; i++) {
      var row = data[i];
      var rev = parseInt(row.total_revenue_cents, 10) || 0;
      var pct = totalRev > 0 ? ((rev / totalRev) * 100).toFixed(1) : '0.0';
      html += '<tr style="border-bottom: 1px solid #f0f0f0;">' +
        '<td style="padding: 10px 12px; font-weight: 500; color: #1f2937;">' + (row.category_name || 'Uncategorized') + '</td>' +
        '<td style="padding: 10px 12px; text-align: right; color: #667eea; font-weight: 600;">' + (parseInt(row.total_qty, 10) || 0) + '</td>' +
        '<td style="padding: 10px 12px; text-align: right; color: #6b7280;">' + (parseInt(row.order_count, 10) || 0) + '</td>' +
        '<td style="padding: 10px 12px; text-align: right; color: #059669; font-weight: 600;">$' + (rev / 100).toFixed(2) + '</td>' +
        '<td style="padding: 10px 12px; text-align: right; color: #6b7280;">' + pct + '%</td>' +
        '</tr>';
    }

    html += '</tbody></table>';

    // Add visual bar breakdown
    if (data.length > 0) {
      var colors = ['#667eea', '#e67e22', '#059669', '#dc2626', '#8b5cf6', '#06b6d4', '#f59e0b', '#ec4899'];
      html += '<div style="display: flex; height: 24px; border-radius: 6px; overflow: hidden; margin-top: 16px;">';
      for (var i = 0; i < data.length; i++) {
        var rev = parseInt(data[i].total_revenue_cents, 10) || 0;
        var pct = totalRev > 0 ? (rev / totalRev) * 100 : 0;
        if (pct < 0.5) continue;
        var color = colors[i % colors.length];
        html += '<div title="' + data[i].category_name + ': $' + (rev / 100).toFixed(2) + ' (' + pct.toFixed(1) + '%)" style="width: ' + pct + '%; background: ' + color + '; cursor: pointer;" onmouseover="this.style.opacity=\'0.8\'" onmouseout="this.style.opacity=\'1\'"></div>';
      }
      html += '</div>';
      html += '<div style="display: flex; flex-wrap: wrap; gap: 12px; margin-top: 8px; font-size: 11px;">';
      for (var i = 0; i < data.length; i++) {
        var rev = parseInt(data[i].total_revenue_cents, 10) || 0;
        var pct = totalRev > 0 ? (rev / totalRev) * 100 : 0;
        if (pct < 0.5) continue;
        var color = colors[i % colors.length];
        html += '<span><span style="display: inline-block; width: 10px; height: 10px; background: ' + color + '; border-radius: 2px; margin-right: 4px;"></span>' + data[i].category_name + '</span>';
      }
      html += '</div>';
    }

    container.innerHTML = html;
    reTranslateContent();
  } catch (err) {
    console.error('[sales-by-category]', err);
    container.innerHTML = '<p style="color: #e74c3c; text-align: center; padding: 16px;">Failed to load data.</p>';
  }
}

// ========== SALES BY ITEM ==========

async function loadSalesByItem() {
  var container = document.getElementById('sales-by-item-content');
  if (!container) return;

  var days = getGlobalDays();

  container.innerHTML = '<p style="color: #999; text-align: center; padding: 16px;">Loading...</p>';

  try {
    var url = API + '/restaurants/' + restaurantId + '/reports/sales-by-item?days=' + days;
    var res = await fetch(url);
    if (!res.ok) throw new Error('Failed');
    var data = await res.json();

    if (!data || data.length === 0) {
      container.innerHTML = '<p style="color: #999; text-align: center; padding: 16px;">No data available.</p>';
      return;
    }

    var html = '<table style="width: 100%; font-size: 13px; border-collapse: collapse;">' +
      '<thead><tr style="border-bottom: 2px solid #e5e7eb; background: #f9fafb;">' +
      '<th style="padding: 10px 12px; text-align: left; font-weight: 600; color: #6b7280;" data-i18n="admin.col-item">Item</th>' +
      '<th style="padding: 10px 12px; text-align: left; font-weight: 600; color: #6b7280;" data-i18n="admin.col-category">Category</th>' +
      '<th style="padding: 10px 12px; text-align: right; font-weight: 600; color: #6b7280;" data-i18n="admin.col-qty-sold">Qty Sold</th>' +
      '<th style="padding: 10px 12px; text-align: right; font-weight: 600; color: #6b7280;" data-i18n="admin.col-orders">Orders</th>' +
      '<th style="padding: 10px 12px; text-align: right; font-weight: 600; color: #6b7280;" data-i18n="admin.col-revenue">Revenue</th>' +
      '</tr></thead><tbody>';

    for (var i = 0; i < data.length; i++) {
      var row = data[i];
      var rev = parseInt(row.total_revenue_cents, 10) || 0;
      html += '<tr style="border-bottom: 1px solid #f0f0f0;">' +
        '<td style="padding: 10px 12px; font-weight: 500; color: #1f2937;">' + (row.item_name || 'Unknown') + '</td>' +
        '<td style="padding: 10px 12px; color: #6b7280; font-size: 12px;">' + (row.category_name || '-') + '</td>' +
        '<td style="padding: 10px 12px; text-align: right; color: #667eea; font-weight: 600;">' + (parseInt(row.total_qty, 10) || 0) + '</td>' +
        '<td style="padding: 10px 12px; text-align: right; color: #6b7280;">' + (parseInt(row.order_count, 10) || 0) + '</td>' +
        '<td style="padding: 10px 12px; text-align: right; color: #059669; font-weight: 600;">$' + (rev / 100).toFixed(2) + '</td>' +
        '</tr>';
    }

    html += '</tbody></table>';
    container.innerHTML = html;
    reTranslateContent();
  } catch (err) {
    console.error('[sales-by-item]', err);
    container.innerHTML = '<p style="color: #e74c3c; text-align: center; padding: 16px;">Failed to load data.</p>';
  }
}

// ========== ORDER STATUS TIMING ==========

async function loadOrderStatusTiming() {
  var container = document.getElementById('order-status-timing');
  if (!container) return;

  var days = getGlobalDays();
  container.innerHTML = '<p style="color:#999;text-align:center;padding:16px;" data-i18n="admin.loading">Loading...</p>';

  try {
    var res = await fetch(API + '/restaurants/' + restaurantId + '/reports/order-status-timing?days=' + days);
    if (!res.ok) throw new Error('Failed');
    var data = await res.json();

    var transitions = data.transitions || [];
    var fastest = data.fastest_items || [];
    var prepByItem = data.prep_time_by_item || [];

    if (transitions.length === 0 && fastest.length === 0 && prepByItem.length === 0) {
      container.innerHTML = '<p style="color:#999;text-align:center;padding:16px;" data-i18n="admin.no-timing-data">No timing data yet — data appears once staff change item status (preparing → served).</p>';
      return;
    }

    var html = '';

    if (transitions.length > 0) {
      html += '<table style="width:100%;font-size:13px;border-collapse:collapse;margin-bottom:16px;">' +
        '<thead><tr style="border-bottom:2px solid #e5e7eb;background:#f9fafb;">' +
        '<th style="padding:10px 12px;text-align:left;font-weight:600;color:#6b7280;" data-i18n="admin.col-transition">Transition</th>' +
        '<th style="padding:10px 12px;text-align:right;font-weight:600;color:#6b7280;" data-i18n="admin.col-count">Count</th>' +
        '<th style="padding:10px 12px;text-align:right;font-weight:600;color:#6b7280;" data-i18n="admin.col-avg-time">Avg (min)</th>' +
        '<th style="padding:10px 12px;text-align:right;font-weight:600;color:#6b7280;" data-i18n="admin.col-min-time">Min</th>' +
        '<th style="padding:10px 12px;text-align:right;font-weight:600;color:#6b7280;" data-i18n="admin.col-max-time">Max</th>' +
        '</tr></thead><tbody>';

      for (var i = 0; i < transitions.length; i++) {
        var t = transitions[i];
        html += '<tr style="border-bottom:1px solid #f0f0f0;">' +
          '<td style="padding:10px 12px;color:#1f2937;font-weight:500;">' +
            '<span style="text-transform:capitalize;">' + (t.from_status || '—') + '</span>' +
            ' → <span style="text-transform:capitalize;">' + t.to_status + '</span>' +
          '</td>' +
          '<td style="padding:10px 12px;text-align:right;color:#6b7280;">' + t.transition_count + '</td>' +
          '<td style="padding:10px 12px;text-align:right;color:#059669;font-weight:600;">' + t.avg_minutes + '</td>' +
          '<td style="padding:10px 12px;text-align:right;color:#6b7280;">' + t.min_minutes + '</td>' +
          '<td style="padding:10px 12px;text-align:right;color:#6b7280;">' + t.max_minutes + '</td>' +
          '</tr>';
      }
      html += '</tbody></table>';
    }

    if (fastest.length > 0) {
      html += '<h4 style="font-size:13px;font-weight:600;color:#374151;margin:8px 0;" data-i18n="admin.fastest-dishes">Fastest Dishes (preparing → ready)</h4>' +
        '<table style="width:100%;font-size:13px;border-collapse:collapse;margin-bottom:16px;">' +
        '<thead><tr style="border-bottom:2px solid #e5e7eb;background:#f9fafb;">' +
        '<th style="padding:10px 12px;text-align:left;font-weight:600;color:#6b7280;" data-i18n="admin.col-item">Item</th>' +
        '<th style="padding:10px 12px;text-align:right;font-weight:600;color:#6b7280;" data-i18n="admin.col-avg-time">Avg (min)</th>' +
        '<th style="padding:10px 12px;text-align:right;font-weight:600;color:#6b7280;" data-i18n="admin.col-samples">Samples</th>' +
        '</tr></thead><tbody>';

      for (var j = 0; j < fastest.length; j++) {
        var f = fastest[j];
        html += '<tr style="border-bottom:1px solid #f0f0f0;">' +
          '<td style="padding:10px 12px;font-weight:500;color:#1f2937;">' + f.item_name + '</td>' +
          '<td style="padding:10px 12px;text-align:right;color:#059669;font-weight:600;">' + f.avg_minutes + '</td>' +
          '<td style="padding:10px 12px;text-align:right;color:#6b7280;">' + f.sample_count + '</td>' +
          '</tr>';
      }
      html += '</tbody></table>';
    }

    if (prepByItem.length > 0) {
      html += '<h4 style="font-size:13px;font-weight:600;color:#374151;margin:8px 0;" data-i18n="admin.prep-time-by-item">Prep Time by Item (preparing → served)</h4>' +
        '<p style="font-size:11px;color:#9ca3af;margin:0 0 8px;" data-i18n="admin.prep-time-by-item-desc">Time from kitchen start (preparing) to delivery (served) per dish</p>' +
        '<table style="width:100%;font-size:13px;border-collapse:collapse;">' +
        '<thead><tr style="border-bottom:2px solid #e5e7eb;background:#f9fafb;">' +
        '<th style="padding:10px 12px;text-align:left;font-weight:600;color:#6b7280;" data-i18n="admin.col-item">Item</th>' +
        '<th style="padding:10px 12px;text-align:right;font-weight:600;color:#6b7280;" data-i18n="admin.col-avg-time">Avg (min)</th>' +
        '<th style="padding:10px 12px;text-align:right;font-weight:600;color:#6b7280;" data-i18n="admin.col-min-time">Min</th>' +
        '<th style="padding:10px 12px;text-align:right;font-weight:600;color:#6b7280;" data-i18n="admin.col-max-time">Max</th>' +
        '<th style="padding:10px 12px;text-align:right;font-weight:600;color:#6b7280;" data-i18n="admin.col-samples">Samples</th>' +
        '</tr></thead><tbody>';

      for (var k = 0; k < prepByItem.length; k++) {
        var p = prepByItem[k];
        // Colour the avg: green ≤5 min, amber ≤15, red >15
        var avgColor = p.avg_minutes <= 5 ? '#059669' : p.avg_minutes <= 15 ? '#d97706' : '#dc2626';
        html += '<tr style="border-bottom:1px solid #f0f0f0;">' +
          '<td style="padding:10px 12px;font-weight:500;color:#1f2937;">' + p.item_name + '</td>' +
          '<td style="padding:10px 12px;text-align:right;font-weight:700;color:' + avgColor + ';">' + p.avg_minutes + '</td>' +
          '<td style="padding:10px 12px;text-align:right;color:#6b7280;">' + p.min_minutes + '</td>' +
          '<td style="padding:10px 12px;text-align:right;color:#6b7280;">' + p.max_minutes + '</td>' +
          '<td style="padding:10px 12px;text-align:right;color:#6b7280;">' + p.sample_count + '</td>' +
          '</tr>';
      }
      html += '</tbody></table>';
    }

    container.innerHTML = html;
    reTranslateContent();
  } catch (err) {
    console.error('[order-status-timing]', err);
    container.innerHTML = '<p style="color:#999;text-align:center;padding:16px;" data-i18n="admin.no-timing-data">No timing data yet.</p>';
  }
}

// ========== PAYMENT BY TYPE ==========

async function loadPaymentByType() {
  var container = document.getElementById('payment-by-type-content');
  if (!container) return;

  var days = getGlobalDays();
  container.innerHTML = '<p style="color:#999;text-align:center;padding:16px;" data-i18n="admin.loading">Loading...</p>';

  try {
    var res = await fetch(API + '/restaurants/' + restaurantId + '/reports/payment-by-type?days=' + days);
    if (!res.ok) throw new Error('Failed');
    var data = await res.json();

    if (!data || data.length === 0) {
      container.innerHTML = '<p style="color:#999;text-align:center;padding:16px;" data-i18n="admin.no-data">No data available.</p>';
      return;
    }

    var totalRev = 0;
    for (var i = 0; i < data.length; i++) {
      totalRev += parseInt(data[i].total_revenue_cents, 10) || 0;
    }

    var paymentColors = { cash: '#059669', kpay: '#667eea', 'payment-asia': '#e67e22', card: '#8b5cf6', alipay: '#dc2626', wechat: '#06b6d4' };
    var html = '<table style="width:100%;font-size:13px;border-collapse:collapse;">' +
      '<thead><tr style="border-bottom:2px solid #e5e7eb;background:#f9fafb;">' +
      '<th style="padding:10px 12px;text-align:left;font-weight:600;color:#6b7280;" data-i18n="admin.col-payment-method">Payment Method</th>' +
      '<th style="padding:10px 12px;text-align:right;font-weight:600;color:#6b7280;" data-i18n="admin.col-orders">Orders</th>' +
      '<th style="padding:10px 12px;text-align:right;font-weight:600;color:#6b7280;" data-i18n="admin.col-revenue">Revenue</th>' +
      '<th style="padding:10px 12px;text-align:right;font-weight:600;color:#6b7280;">%</th>' +
      '<th style="padding:10px 12px;"></th>' +
      '</tr></thead><tbody>';

    for (var i = 0; i < data.length; i++) {
      var row = data[i];
      var rev = parseInt(row.total_revenue_cents, 10) || 0;
      var pct = totalRev > 0 ? ((rev / totalRev) * 100) : 0;
      var color = paymentColors[row.payment_method] || '#6b7280';
      html += '<tr style="border-bottom:1px solid #f0f0f0;">' +
        '<td style="padding:10px 12px;font-weight:500;color:#1f2937;">' +
          '<span style="display:inline-block;width:10px;height:10px;background:' + color + ';border-radius:2px;margin-right:6px;"></span>' +
          row.payment_method +
        '</td>' +
        '<td style="padding:10px 12px;text-align:right;color:#667eea;font-weight:600;">' + row.order_count + '</td>' +
        '<td style="padding:10px 12px;text-align:right;color:#059669;font-weight:600;">$' + (rev / 100).toFixed(2) + '</td>' +
        '<td style="padding:10px 12px;text-align:right;color:#6b7280;">' + pct.toFixed(1) + '%</td>' +
        '<td style="padding:10px 12px;min-width:100px;">' +
          '<div style="background:#f3f4f6;border-radius:4px;height:8px;overflow:hidden;">' +
            '<div style="background:' + color + ';height:100%;width:' + pct.toFixed(0) + '%;border-radius:4px;"></div>' +
          '</div>' +
        '</td>' +
        '</tr>';
    }
    html += '</tbody></table>';
    container.innerHTML = html;
    reTranslateContent();
  } catch (err) {
    console.error('[payment-by-type]', err);
    container.innerHTML = '<p style="color:#e74c3c;text-align:center;padding:16px;">Failed to load data.</p>';
  }
}

// ========== STAFF HOURS ==========

async function loadStaffHours() {
  var container = document.getElementById('staff-hours-content');
  if (!container) return;

  var days = getGlobalDays();
  container.innerHTML = '<p style="color:#999;text-align:center;padding:16px;" data-i18n="admin.loading">Loading...</p>';

  try {
    var res = await fetch(API + '/restaurants/' + restaurantId + '/reports/staff-hours?days=' + days);
    if (!res.ok) throw new Error('Failed');
    var data = await res.json();

    if (!data || data.length === 0) {
      container.innerHTML = '<p style="color:#999;text-align:center;padding:16px;" data-i18n="admin.no-staff-hours">No timekeeping records found. Staff need to clock in/out.</p>';
      return;
    }

    var html = '<table style="width:100%;font-size:13px;border-collapse:collapse;">' +
      '<thead><tr style="border-bottom:2px solid #e5e7eb;background:#f9fafb;">' +
      '<th style="padding:10px 12px;text-align:left;font-weight:600;color:#6b7280;" data-i18n="admin.col-staff">Staff</th>' +
      '<th style="padding:10px 12px;text-align:left;font-weight:600;color:#6b7280;" data-i18n="admin.col-role">Role</th>' +
      '<th style="padding:10px 12px;text-align:right;font-weight:600;color:#6b7280;" data-i18n="admin.col-shifts">Shifts</th>' +
      '<th style="padding:10px 12px;text-align:right;font-weight:600;color:#6b7280;" data-i18n="admin.col-total-hours">Total Hours</th>' +
      '<th style="padding:10px 12px;text-align:right;font-weight:600;color:#6b7280;" data-i18n="admin.col-avg-shift">Avg Shift</th>' +
      '</tr></thead><tbody>';

    for (var i = 0; i < data.length; i++) {
      var row = data[i];
      var totalMin = parseFloat(row.total_minutes) || 0;
      var shiftCount = parseInt(row.shift_count, 10) || 0;
      var totalHours = (totalMin / 60).toFixed(1);
      var avgShift = shiftCount > 0 ? (totalMin / shiftCount / 60).toFixed(1) : '—';
      html += '<tr style="border-bottom:1px solid #f0f0f0;">' +
        '<td style="padding:10px 12px;font-weight:500;color:#1f2937;">' + row.staff_name + '</td>' +
        '<td style="padding:10px 12px;color:#6b7280;font-size:12px;text-transform:capitalize;">' + (row.role || '—') + '</td>' +
        '<td style="padding:10px 12px;text-align:right;color:#667eea;font-weight:600;">' + shiftCount + '</td>' +
        '<td style="padding:10px 12px;text-align:right;color:#059669;font-weight:600;">' + totalHours + ' hrs</td>' +
        '<td style="padding:10px 12px;text-align:right;color:#6b7280;">' + avgShift + ' hrs</td>' +
        '</tr>';
    }
    html += '</tbody></table>';
    container.innerHTML = html;
    reTranslateContent();
  } catch (err) {
    console.error('[staff-hours]', err);
    container.innerHTML = '<p style="color:#e74c3c;text-align:center;padding:16px;">Failed to load data.</p>';
  }
}

// ========== BOOKINGS ANALYTICS ==========

function renderBookingsAnalytics(stats) {
  var allBookings = stats.allBookings || [];
  // Filter bookings by global date range
  var days = getGlobalDays();
  var now = Date.now();
  var bookings = allBookings;
  if (days < 9999) {
    bookings = allBookings.filter(function(b) {
      var dateStr = b.booking_date_str || b.booking_date;
      if (!dateStr) return false;
      return (now - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24) <= days;
    });
  }
  window.allBookings = bookings;

  // Update top-level metric cards
  var total = bookings.length;
  var confirmed = bookings.filter(function(b) { return b.status === 'confirmed'; }).length;
  var completed = bookings.filter(function(b) { return b.status === 'completed'; }).length;
  var cancelled = bookings.filter(function(b) { return b.status === 'cancelled'; }).length;

  var elTotal = document.getElementById('metric-total-bookings');
  var elConfirmed = document.getElementById('metric-bookings-confirmed');
  var elCancelled = document.getElementById('metric-bookings-cancelled');
  if (elTotal) elTotal.textContent = total;
  if (elConfirmed) elConfirmed.textContent = confirmed + completed;
  if (elCancelled) elCancelled.textContent = cancelled;

  // Summary stat tiles inside the section
  var summaryEl = document.getElementById('bookings-summary-stats');
  if (summaryEl) {
    var paxTotal = bookings.reduce(function(s, b) { return s + (parseInt(b.pax, 10) || 0); }, 0);
    var avgPax = total > 0 ? (paxTotal / total).toFixed(1) : '0';
    var completionRate = total > 0 ? Math.round(((confirmed + completed) / total) * 100) : 0;
    summaryEl.innerHTML =
      '<div class="metric-card"><div class="metric-label" data-i18n="admin.bookings-total-pax">Total Guests</div><div class="metric-value" style="font-size:22px;">' + paxTotal + '</div></div>' +
      '<div class="metric-card"><div class="metric-label" data-i18n="admin.bookings-avg-pax">Avg Party Size</div><div class="metric-value" style="font-size:22px;">' + avgPax + '</div></div>' +
      '<div class="metric-card"><div class="metric-label" data-i18n="admin.bookings-completion">Completion Rate</div><div class="metric-value" style="font-size:22px; color:#059669;">' + completionRate + '%</div></div>' +
      '<div class="metric-card"><div class="metric-label" data-i18n="admin.bookings-cancelled">Cancelled</div><div class="metric-value" style="font-size:22px; color:#dc2626;">' + cancelled + '</div></div>';
    reTranslateContent();
  }

  renderBookingsTrends('daily');
  renderBookingsPeakHours(bookings);
  renderBookingsTopTables(bookings);
  renderBookingsStatusBar(bookings);
}

function renderBookingsTrends(mode) {
  var bookings = window.allBookings || [];
  var container = document.getElementById('bookings-trend-table');
  if (!container) return;

  // Update toggle button styles
  var dailyBtn = document.getElementById('bookings-daily-btn');
  var weeklyBtn = document.getElementById('bookings-weekly-btn');
  var monthlyBtn = document.getElementById('bookings-monthly-btn');
  var activeStyle = 'padding: 8px 12px; background: #e67e22; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 600;';
  var inactiveStyle = 'padding: 8px 12px; background: transparent; color: #e67e22; border: 2px solid #e67e22; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 600;';
  if (dailyBtn) dailyBtn.style.cssText = mode === 'daily' ? activeStyle : inactiveStyle;
  if (weeklyBtn) weeklyBtn.style.cssText = mode === 'weekly' ? activeStyle : inactiveStyle;
  if (monthlyBtn) monthlyBtn.style.cssText = mode === 'monthly' ? activeStyle : inactiveStyle;

  // Group bookings by period
  var periodMap = {};
  for (var i = 0; i < bookings.length; i++) {
    var b = bookings[i];
    var dateStr = b.booking_date_str || b.booking_date;
    if (!dateStr) continue;
    // Normalise to YYYY-MM-DD
    if (dateStr.length > 10) dateStr = dateStr.substring(0, 10);

    var periodKey;
    var label;
    if (mode === 'daily') {
      periodKey = dateStr;
      label = dateStr;
    } else if (mode === 'weekly') {
      var d = new Date(dateStr + 'T00:00:00');
      var day = d.getDay();
      var weekStart = new Date(d);
      weekStart.setDate(d.getDate() - day);
      periodKey = weekStart.toISOString().split('T')[0];
      var weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      label = periodKey + ' \u2013 ' + weekEnd.toISOString().split('T')[0];
    } else {
      periodKey = dateStr.substring(0, 7);
      label = periodKey;
    }

    if (!periodMap[periodKey]) {
      periodMap[periodKey] = { label: label, total: 0, confirmed: 0, completed: 0, cancelled: 0, pax: 0 };
    }
    periodMap[periodKey].total++;
    periodMap[periodKey].pax += parseInt(b.pax, 10) || 0;
    if (b.status === 'confirmed') periodMap[periodKey].confirmed++;
    else if (b.status === 'completed') periodMap[periodKey].completed++;
    else if (b.status === 'cancelled') periodMap[periodKey].cancelled++;
  }

  var entries = Object.keys(periodMap).sort().reverse().map(function(k) { return periodMap[k]; });

  if (entries.length === 0) {
    container.innerHTML = '<p style="color:#999;text-align:center;padding:16px;" data-i18n="admin.no-bookings-data">No booking data available.</p>';
    reTranslateContent();
    return;
  }

  var html = '<table style="width:100%;font-size:13px;border-collapse:collapse;">' +
    '<thead><tr style="border-bottom:2px solid #e5e7eb;background:#fffbf5;">' +
    '<th style="padding:10px 12px;text-align:left;font-weight:600;color:#6b7280;" data-i18n="admin.col-period">Period</th>' +
    '<th style="padding:10px 12px;text-align:right;font-weight:600;color:#6b7280;" data-i18n="admin.col-bookings">Bookings</th>' +
    '<th style="padding:10px 12px;text-align:right;font-weight:600;color:#059669;" data-i18n="admin.bookings-confirmed">Confirmed</th>' +
    '<th style="padding:10px 12px;text-align:right;font-weight:600;color:#dc2626;" data-i18n="admin.bookings-cancelled">Cancelled</th>' +
    '<th style="padding:10px 12px;text-align:right;font-weight:600;color:#6b7280;" data-i18n="admin.bookings-total-pax">Guests</th>' +
    '</tr></thead><tbody>';

  for (var ei = 0; ei < entries.length; ei++) {
    var e = entries[ei];
    html += '<tr style="border-bottom:1px solid #f0f0f0;">' +
      '<td style="padding:10px 12px;font-weight:500;color:#1f2937;">' + e.label + '</td>' +
      '<td style="padding:10px 12px;text-align:right;font-weight:600;color:#e67e22;">' + e.total + '</td>' +
      '<td style="padding:10px 12px;text-align:right;font-weight:600;color:#059669;">' + (e.confirmed + e.completed) + '</td>' +
      '<td style="padding:10px 12px;text-align:right;font-weight:600;color:#dc2626;">' + e.cancelled + '</td>' +
      '<td style="padding:10px 12px;text-align:right;color:#6b7280;">' + e.pax + '</td>' +
      '</tr>';
  }
  html += '</tbody></table>';
  container.innerHTML = html;
  reTranslateContent();
}

function renderBookingsPeakHours(bookings) {
  var container = document.getElementById('bookings-peak-hours');
  if (!container) return;

  var hourCounts = {};
  for (var i = 0; i < 24; i++) hourCounts[i] = 0;

  for (var bi = 0; bi < bookings.length; bi++) {
    var timeStr = bookings[bi].booking_time; // "HH:MM:SS"
    if (!timeStr) continue;
    var hour = parseInt(timeStr.split(':')[0], 10);
    if (!isNaN(hour)) hourCounts[hour]++;
  }

  var maxCount = Math.max.apply(null, Object.values(hourCounts).concat([1]));

  var html = '<div style="display:flex;align-items:flex-end;gap:3px;height:150px;width:100%;">';
  for (var h = 0; h < 24; h++) {
    var cnt = hourCounts[h];
    var barHeight = maxCount > 0 ? Math.max(Math.round((cnt / maxCount) * 130), cnt > 0 ? 4 : 0) : 0;
    var lbl = h < 10 ? '0' + h : '' + h;
    html += '<div style="flex:1;display:flex;flex-direction:column;align-items:center;min-width:14px;">' +
      '<div title="' + lbl + ':00 \u2014 ' + cnt + ' bookings" style="background:linear-gradient(to top,#e67e22,#f39c12);width:100%;height:' + barHeight + 'px;border-radius:3px 3px 0 0;' + (cnt > 0 ? 'min-height:4px;' : '') + 'cursor:pointer;" onmouseover="this.style.opacity=\'0.8\'" onmouseout="this.style.opacity=\'1\'"></div>' +
      '<div style="font-size:9px;color:#999;margin-top:3px;">' + lbl + '</div>' +
      '</div>';
  }
  html += '</div>';
  container.innerHTML = html;
}

function renderBookingsTopTables(bookings) {
  var container = document.getElementById('bookings-top-tables');
  if (!container) return;

  var tableCounts = {};
  for (var bi = 0; bi < bookings.length; bi++) {
    var name = bookings[bi].table_name || ('Table ' + bookings[bi].table_id);
    if (!tableCounts[name]) tableCounts[name] = { count: 0, pax: 0 };
    tableCounts[name].count++;
    tableCounts[name].pax += parseInt(bookings[bi].pax, 10) || 0;
  }

  var sorted = Object.keys(tableCounts).map(function(k) {
    return { name: k, count: tableCounts[k].count, pax: tableCounts[k].pax };
  }).sort(function(a, b) { return b.count - a.count; }).slice(0, 8);

  if (sorted.length === 0) {
    container.innerHTML = '<p style="color:#999;font-size:13px;" data-i18n="admin.no-bookings-data">No booking data available.</p>';
    reTranslateContent();
    return;
  }

  var maxCount = sorted[0].count || 1;
  var html = '';
  for (var ti = 0; ti < sorted.length; ti++) {
    var t = sorted[ti];
    var pct = Math.round((t.count / maxCount) * 100);
    html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">' +
      '<div style="width:52px;font-size:12px;font-weight:600;color:#374151;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="' + t.name + '">' + t.name + '</div>' +
      '<div style="flex:1;background:#f3f4f6;height:18px;border-radius:4px;overflow:hidden;">' +
        '<div style="background:linear-gradient(to right,#e67e22,#f39c12);height:100%;width:' + pct + '%;border-radius:4px;"></div>' +
      '</div>' +
      '<div style="width:28px;font-size:12px;font-weight:700;color:#e67e22;text-align:right;">' + t.count + '</div>' +
      '</div>';
  }
  container.innerHTML = html;
}

function renderBookingsStatusBar(bookings) {
  var container = document.getElementById('bookings-status-bar');
  if (!container) return;

  var total = bookings.length;
  if (total === 0) {
    container.innerHTML = '<p style="color:#999;font-size:13px;" data-i18n="admin.no-bookings-data">No booking data available.</p>';
    reTranslateContent();
    return;
  }

  var counts = { confirmed: 0, completed: 0, cancelled: 0 };
  for (var bi = 0; bi < bookings.length; bi++) {
    var s = bookings[bi].status;
    if (counts[s] !== undefined) counts[s]++;
  }

  var confirmedPct = Math.round(((counts.confirmed + counts.completed) / total) * 100);
  var cancelledPct = Math.round((counts.cancelled / total) * 100);

  container.innerHTML =
    '<div style="display:flex;height:28px;border-radius:6px;overflow:hidden;margin-bottom:10px;">' +
      '<div title="Confirmed/Completed: ' + (counts.confirmed + counts.completed) + '" style="width:' + confirmedPct + '%;background:#059669;transition:width 0.4s;"></div>' +
      '<div title="Cancelled: ' + counts.cancelled + '" style="width:' + cancelledPct + '%;background:#dc2626;transition:width 0.4s;"></div>' +
      '<div style="flex:1;background:#e5e7eb;"></div>' +
    '</div>' +
    '<div style="display:flex;gap:16px;flex-wrap:wrap;font-size:12px;">' +
      '<span><span style="display:inline-block;width:10px;height:10px;background:#059669;border-radius:2px;margin-right:4px;"></span>' +
      '<span data-i18n="admin.bookings-confirmed">Confirmed</span>: ' + (counts.confirmed + counts.completed) + ' (' + confirmedPct + '%)</span>' +
      '<span><span style="display:inline-block;width:10px;height:10px;background:#dc2626;border-radius:2px;margin-right:4px;"></span>' +
      '<span data-i18n="admin.bookings-cancelled">Cancelled</span>: ' + counts.cancelled + ' (' + cancelledPct + '%)</span>' +
    '</div>';
  reTranslateContent();
}

// ============= EXPORT PAGE =============

var currentExportPeriod = 'all';

function showExportPage() {
  var dashboard = document.getElementById('reports-dashboard');
  var loading = document.getElementById('reports-loading');
  var exportPage = document.getElementById('reports-export-page');
  if (dashboard) dashboard.style.display = 'none';
  if (loading) loading.style.display = 'none';
  if (exportPage) exportPage.style.display = '';
  // Set default dates: last 30 days
  var today = new Date();
  var from = new Date(today);
  from.setDate(from.getDate() - 30);
  var toInput = document.getElementById('export-date-to');
  var fromInput = document.getElementById('export-date-from');
  if (toInput && !toInput.value) toInput.value = today.toISOString().split('T')[0];
  if (fromInput && !fromInput.value) fromInput.value = from.toISOString().split('T')[0];
}

function hideExportPage() {
  var exportPage = document.getElementById('reports-export-page');
  if (exportPage) exportPage.style.display = 'none';
  var dashboard = document.getElementById('reports-dashboard');
  if (dashboard) dashboard.style.display = '';
}

function selectExportPeriod(period) {
  currentExportPeriod = period;
  document.querySelectorAll('.export-period-btn').forEach(function(btn) {
    if (btn.dataset.period === period) {
      btn.style.background = '#4a90e2';
      btn.style.color = 'white';
      btn.style.border = '2px solid #4a90e2';
    } else {
      btn.style.background = 'transparent';
      btn.style.color = '#4a90e2';
      btn.style.border = '2px solid #4a90e2';
    }
  });
  var customTime = document.getElementById('export-custom-time');
  if (customTime) {
    customTime.style.display = period === 'custom' ? 'grid' : 'none';
  }
}

function updateExportTypeChip(checkbox) {
  var label = checkbox.closest('label') || checkbox.parentElement;
  if (checkbox.checked) {
    label.style.background = '#4a90e2';
    label.style.color = 'white';
  } else {
    label.style.background = 'transparent';
    label.style.color = '#4a90e2';
  }
}

async function downloadExportCSV() {
  var errEl = document.getElementById('export-error');
  if (errEl) errEl.style.display = 'none';

  var params = new URLSearchParams();

  var dateFrom = document.getElementById('export-date-from') ? document.getElementById('export-date-from').value : '';
  var dateTo = document.getElementById('export-date-to') ? document.getElementById('export-date-to').value : '';
  if (dateFrom) params.set('date_from', dateFrom);
  if (dateTo) params.set('date_to', dateTo);

  if (currentExportPeriod && currentExportPeriod !== 'all') {
    params.set('period', currentExportPeriod);
    if (currentExportPeriod === 'custom') {
      var pFrom = document.getElementById('export-period-from') ? document.getElementById('export-period-from').value : '';
      var pTo = document.getElementById('export-period-to') ? document.getElementById('export-period-to').value : '';
      if (pFrom) params.set('period_from', pFrom);
      if (pTo) params.set('period_to', pTo);
    }
  }

  var types = [];
  if (document.getElementById('export-type-table') && document.getElementById('export-type-table').checked) types.push('table');
  if (document.getElementById('export-type-now') && document.getElementById('export-type-now').checked) types.push('now');
  if (document.getElementById('export-type-to-go') && document.getElementById('export-type-to-go').checked) types.push('to_go');
  if (types.length > 0 && types.length < 3) params.set('order_type', types.join(','));

  var paxMin = document.getElementById('export-pax-min') ? document.getElementById('export-pax-min').value : '';
  var paxMax = document.getElementById('export-pax-max') ? document.getElementById('export-pax-max').value : '';
  if (paxMin) params.set('pax_min', paxMin);
  if (paxMax) params.set('pax_max', paxMax);

  var url = API + '/restaurants/' + restaurantId + '/reports/export?' + params.toString();

  try {
    var resp = await fetch(url, { headers: { 'Authorization': 'Bearer ' + token } });
    if (!resp.ok) {
      var err = {};
      try { err = await resp.json(); } catch (e2) {}
      throw new Error(err.error || 'Export failed (' + resp.status + ')');
    }
    var blob = await resp.blob();
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'orders_export_' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  } catch (e) {
    if (errEl) { errEl.textContent = e.message; errEl.style.display = 'block'; }
  }
}

