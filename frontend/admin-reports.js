// ============= ANALYTICS DASHBOARD MODULE =============
// New analytics dashboard - automatic on page load

// Initialization gate
let reportsInitialized = false;

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
    var topItemsUrl = API + "/restaurants/" + restaurantId + "/reports/top-items?days=30";
    var topTablesUrl = API + "/restaurants/" + restaurantId + "/reports/top-tables?days=30";
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
        order_count_by_status: {},
        revenue_by_day: {},
        revenue_by_hour: {},
        daily_order_counts: {},
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

    // Calculate stats from orders
    var stats = calculateAnalyticsStats(allOrders);
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
    order_count_by_status: {},
    revenue_by_day: {},
    revenue_by_hour: {},
    daily_order_counts: {},
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
    stats.total_revenue += orderAmount;

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
    }
    stats.revenue_by_day[date] += orderAmount;
    stats.daily_order_counts[date]++;

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
  
  if (metricTotalOrders) {
    metricTotalOrders.textContent = stats.total_orders;
  }
  if (metricTotalRevenue) {
    metricTotalRevenue.textContent = "$" + (stats.total_revenue / 100).toFixed(2);
  }
  if (metricAvgBill) {
    metricAvgBill.textContent = "$" + (stats.average_bill / 100).toFixed(2);
  }
  if (metricActiveSessions) {
    metricActiveSessions.textContent = stats.active_sessions;
  }

  renderRevenueReport(stats);

  renderBusiestTables(stats);

  renderHourlyRevenue(stats);

  renderTopItems(stats);

  renderDailyTrends(stats, 'daily');

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

  var dateRange = (dateRangeEl && dateRangeEl.value) ? dateRangeEl.value : "month";
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
  var totalOrders = filteredOrders.length;
  
  for (var oi = 0; oi < filteredOrders.length; oi++) {
    totalRevenue += parseInt(filteredOrders[oi].total_cents, 10) || 0;
  }

  var avgBill = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  // Group by date for template
  var revenueByDate = {};
  for (var oi = 0; oi < filteredOrders.length; oi++) {
    var order = filteredOrders[oi];
    var dateStr = new Date(order.created_at).toLocaleDateString();
    if (!revenueByDate[dateStr]) {
      revenueByDate[dateStr] = { revenue: 0, count: 0 };
    }
    revenueByDate[dateStr].revenue += parseInt(order.total_cents, 10) || 0;
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
  
  // Populate table rows
  var tbody = fragment.querySelector('[data-rows-container]');
  var dates = Object.keys(revenueByDate).sort().reverse();
  for (var di = 0; di < dates.length; di++) {
    var date = dates[di];
    var data = revenueByDate[date];
    var row = rowTemplate.content.cloneNode(true);
    row.querySelector('[data-field="date"]').textContent = date;
    row.querySelector('[data-field="orders"]').textContent = data.count;
    row.querySelector('[data-field="revenue"]').textContent = '$' + (data.revenue / 100).toFixed(2);
    tbody.appendChild(row);
  }
  
  container.innerHTML = '';
  container.appendChild(fragment);
  reTranslateContent();
}

function renderBusiestTables(stats) {
  var container = document.getElementById("chart-busiest-tables");
  if (!container) {
    return;
  }

  var topTables = stats.topTables || [];

  if (topTables.length === 0) {
    container.innerHTML = '<p style="color: #999; text-align: center; padding: 20px;">No table data available.</p>';
    return;
  }

  var maxOrders = parseInt(topTables[0].order_count, 10) || 1;

  // Clone template and populate with data
  var template = document.getElementById("busiest-tables-chart-template");
  var columnTemplate = document.getElementById("busiest-tables-column-template");
  if (!template || !columnTemplate) return;

  var fragment = template.content.cloneNode(true);
  var columnsContainer = fragment.querySelector('[data-columns-container]');

  for (var ti = 0; ti < topTables.length; ti++) {
    var tbl = topTables[ti];
    var orderCount = parseInt(tbl.order_count, 10) || 0;
    var revenue = parseInt(tbl.total_revenue_cents, 10) || 0;
    var height = (orderCount / maxOrders) * 180;

    var column = columnTemplate.content.cloneNode(true);
    var bar = column.querySelector('[data-field="bar"]');
    bar.style.height = height + 'px';
    bar.title = tbl.table_name + ': ' + orderCount + ' orders ($' + (revenue / 100).toFixed(2) + ')';

    column.querySelector('[data-field="date"]').textContent = tbl.table_name;
    column.querySelector('[data-field="orders"]').textContent = orderCount;

    columnsContainer.appendChild(column);
  }

  container.innerHTML = '';
  container.appendChild(fragment);
  reTranslateContent();
}

function renderHourlyRevenue(stats) {
  var container = document.getElementById("chart-hourly-revenue");
  if (!container) return;

  // Ensure revenue_by_hour and orders_by_hour exist
  if (!stats.revenue_by_hour) stats.revenue_by_hour = {};
  if (!stats.orders_by_hour) stats.orders_by_hour = {};
  
  var revenueValues = [];
  for (var hour in stats.revenue_by_hour) {
    if (stats.revenue_by_hour.hasOwnProperty(hour)) {
      revenueValues.push(stats.revenue_by_hour[hour]);
    }
  }
  var maxRevenue = Math.max.apply(null, revenueValues.length > 0 ? revenueValues : [1]);
  if (maxRevenue <= 0) maxRevenue = 1;
  
  // Clone template and populate with data
  var template = document.getElementById("hourly-revenue-chart-template");
  var columnTemplate = document.getElementById("hourly-revenue-column-template");
  if (!template || !columnTemplate) return;

  var fragment = template.content.cloneNode(true);
  var columnsContainer = fragment.querySelector('[data-columns-container]');

  for (var i = 0; i < 24; i++) {
    var hourKey = i + ':00';
    var revenue = stats.revenue_by_hour[hourKey] || 0;
    var orderCount = stats.orders_by_hour[hourKey] || 0;
    var height = Math.round((revenue / maxRevenue) * 220);
    var tooltipText = 'Hour: ' + hourKey + ' | Revenue: $' + (revenue / 100).toFixed(2) + ' | Orders: ' + orderCount;
    
    var column = columnTemplate.content.cloneNode(true);
    var bar = column.querySelector('[data-field="bar"]');
    bar.style.height = height + 'px';
    bar.title = tooltipText;
    
    column.querySelector('[data-field="hour"]').textContent = i;
    
    columnsContainer.appendChild(column);
  }

  container.innerHTML = '';
  container.appendChild(fragment);
  reTranslateContent();
}

function renderTopItems(stats) {
  var container = document.getElementById("chart-top-items");
  if (!container) return;

  var topItems = stats.topItems || [];

  if (topItems.length === 0) {
    container.innerHTML = '<p style="color: #999; text-align: center; padding: 20px;">No item sales data available.</p>';
    return;
  }

  // Clone template and populate with data
  var template = document.getElementById("top-items-cards-template");
  var cardTemplate = document.getElementById("top-items-card-template");
  if (!template || !cardTemplate) {
    container.innerHTML = '<p style="color: #ccc; text-align: center;">No item data</p>';
    return;
  }

  var fragment = template.content.cloneNode(true);
  var cardsContainer = fragment.querySelector('[data-cards-container]');

  for (var ti = 0; ti < topItems.length; ti++) {
    var item = topItems[ti];
    var card = cardTemplate.content.cloneNode(true);
    card.querySelector('[data-field="item-name"]').textContent = item.item_name || 'Unknown';
    card.querySelector('[data-field="item-qty"]').textContent = item.total_qty + ' ' + (typeof t === 'function' ? t('admin.sold') : 'sold');
    card.querySelector('[data-field="item-revenue"]').textContent = '$' + (parseInt(item.total_revenue_cents, 10) / 100).toFixed(2);
    cardsContainer.appendChild(card);
  }

  container.innerHTML = '';
  container.appendChild(fragment);
  reTranslateContent();
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
          count: stats.daily_order_counts[date] || 0
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
            count: 0
          };
        }
        weekMap[weekKey].revenue += stats.revenue_by_day[date2];
        weekMap[weekKey].count += stats.daily_order_counts[date2] || 0;
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
          count: weekMap[week].count
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
            count: 0
          };
        }
        monthMap[monthKey].revenue += stats.revenue_by_day[date3];
        monthMap[monthKey].count += stats.daily_order_counts[date3] || 0;
      }
    }
    for (var month in monthMap) {
      if (monthMap.hasOwnProperty(month)) {
        entries.push({
          period: month,
          label: formatTimeWithTimezone(month + '-01', restaurantTimezone, 'month'),
          revenue: monthMap[month].revenue,
          count: monthMap[month].count
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
    var avg = item.count > 0 ? item.revenue / item.count : 0;
    
    var row = rowTemplate.content.cloneNode(true);
    row.querySelector('[data-field="label"]').textContent = item.label;
    row.querySelector('[data-field="orders"]').textContent = item.count;
    row.querySelector('[data-field="revenue"]').textContent = '$' + (item.revenue / 100).toFixed(2);
    row.querySelector('[data-field="avg-bill"]').textContent = '$' + (avg / 100).toFixed(2);
    
    tbody.appendChild(row);
  }

  container.innerHTML = '';
  container.appendChild(fragment);
  reTranslateContent();
}

// ========== BOOKINGS ANALYTICS ==========

function renderBookingsAnalytics(stats) {
  var bookings = stats.allBookings || [];
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

