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

    // Fetch all orders for the restaurant (with unlimited results for analytics)
    var ordersUrl = API + "/restaurants/" + restaurantId + "/orders?limit=1000";
    
    var ordersRes = await fetch(ordersUrl);
    
    if (!ordersRes.ok) {
      throw new Error("Failed to load orders: " + ordersRes.status);
    }
    
    var allOrders = await ordersRes.json();
    
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
        item_sales: {}
      };
      renderAnalyticsDashboard(stats);
      if (loadingEl) loadingEl.style.display = "none";
      if (dashboardEl) dashboardEl.style.display = "block";
      return;
    }

    // Calculate stats from orders
    var stats = calculateAnalyticsStats(allOrders);

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
}

function renderRevenueReport(stats) {
  var container = document.getElementById("revenue-report-content");
  if (!container) {
    return;
  }

  // Store stats for filtering
  window.reportStats = stats;
  window.allOrders = stats.allOrders || [];

  // Populate filter dropdowns
  var categorySelect = document.getElementById("revenue-filter-category");
  var waiterSelect = document.getElementById("revenue-filter-waiter");
  var tableSelect = document.getElementById("revenue-filter-table");
  var productSelect = document.getElementById("revenue-filter-product");

  // Collect unique values from orders
  var categories = {};
  var waiters = {};
  var tables = {};
  var products = {};

  for (var oi = 0; oi < window.allOrders.length; oi++) {
    var order = window.allOrders[oi];
    if (order.category_name) categories[order.category_name] = true;
    if (order.waiter_name) waiters[order.waiter_name] = true;
    if (order.table_name) tables[order.table_name] = true;
    if (order.items && order.items.length > 0) {
      for (var it = 0; it < order.items.length; it++) {
        if (order.items[it].name) products[order.items[it].name] = true;
      }
    }
  }

  // Populate dropdowns
  if (categorySelect) {
    for (var cat in categories) {
      var option = document.createElement("option");
      option.value = cat;
      option.textContent = cat;
      categorySelect.appendChild(option);
    }
  }
  if (waiterSelect) {
    for (var waiter in waiters) {
      var option = document.createElement("option");
      option.value = waiter;
      option.textContent = waiter;
      waiterSelect.appendChild(option);
    }
  }
  if (tableSelect) {
    for (var tbl in tables) {
      var option = document.createElement("option");
      option.value = tbl;
      option.textContent = tbl;
      tableSelect.appendChild(option);
    }
  }
  if (productSelect) {
    for (var prod in products) {
      var option = document.createElement("option");
      option.value = prod;
      option.textContent = prod;
      productSelect.appendChild(option);
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
  var waiterFilterEl = document.getElementById("revenue-filter-waiter");
  var tableFilterEl = document.getElementById("revenue-filter-table");
  var productFilterEl = document.getElementById("revenue-filter-product");

  var dateRange = (dateRangeEl && dateRangeEl.value) ? dateRangeEl.value : "month";
  var categoryFilter = (categoryFilterEl && categoryFilterEl.value) ? categoryFilterEl.value : "";
  var waiterFilter = (waiterFilterEl && waiterFilterEl.value) ? waiterFilterEl.value : "";
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

    // Category filter
    if (categoryFilter && order.category_name !== categoryFilter) return false;

    // Waiter filter
    if (waiterFilter && order.waiter_name !== waiterFilter) return false;

    // Table filter
    if (tableFilter && order.table_name !== tableFilter) return false;

    // Product filter
    if (productFilter && order.items) {
      var hasProduct = order.items.some(function(item) {
        return item.name === productFilter;
      });
      if (!hasProduct) return false;
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

  // Build table activity list from orders - count orders per day
  var dayStats = {};
  for (var date in stats.revenue_by_day) {
    if (stats.revenue_by_day.hasOwnProperty(date)) {
      var orderCount = stats.daily_order_counts[date] || 0;
      dayStats[date] = {
        orders: orderCount,
        revenue: stats.revenue_by_day[date]
      };
    }
  }

  // Sort by order count (busiest first)
  var sortedDays = [];
  for (var d in dayStats) {
    if (dayStats.hasOwnProperty(d)) {
      sortedDays.push({
        date: d,
        orders: dayStats[d].orders,
        revenue: dayStats[d].revenue
      });
    }
  }
  sortedDays.sort(function(a, b) {
    return b.orders - a.orders;
  });

  var topDays = sortedDays.slice(0, 6);
  var maxOrders = topDays.length > 0 ? topDays[0].orders : 1;

  // Clone template and populate with data
  var template = document.getElementById("busiest-tables-chart-template");
  var columnTemplate = document.getElementById("busiest-tables-column-template");
  if (!template || !columnTemplate) return;

  var fragment = template.content.cloneNode(true);
  var columnsContainer = fragment.querySelector('[data-columns-container]');

  for (var ti = 0; ti < topDays.length; ti++) {
    var day = topDays[ti];
    var height = (day.orders / maxOrders) * 150;
    
    // Format date in restaurant timezone
    var dateFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: restaurantTimezone,
      month: '2-digit',
      day: '2-digit'
    });
    var dateLabel = dateFormatter.format(new Date(day.date));

    var column = columnTemplate.content.cloneNode(true);
    var bar = column.querySelector('[data-field="bar"]');
    bar.style.height = height + 'px';
    bar.title = day.orders + ' orders ($' + (day.revenue / 100).toFixed(2) + ')';
    
    column.querySelector('[data-field="date"]').textContent = dateLabel;
    column.querySelector('[data-field="orders"]').textContent = day.orders;
    
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
  var maxRevenue = Math.max.apply(null, revenueValues.length > 0 ? revenueValues : [1000]);
  
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
    var height = (revenue / maxRevenue) * 200;
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

  // Show revenue by day sorted by revenue (highest first)
  var dayEntries = [];
  for (var date in stats.revenue_by_day) {
    if (stats.revenue_by_day.hasOwnProperty(date)) {
      dayEntries.push({
        date: date,
        revenue: stats.revenue_by_day[date],
        orders: stats.daily_order_counts[date] || 0
      });
    }
  }
  dayEntries.sort(function(a, b) { 
    return b.revenue - a.revenue;
  });
  
  var topDays = dayEntries.slice(0, 6);

  // Clone template and populate with data
  var template = document.getElementById("top-items-cards-template");
  var cardTemplate = document.getElementById("top-items-card-template");
  if (!template || !cardTemplate) {
    container.innerHTML = '<p style="color: #ccc; text-align: center;">No revenue data</p>';
    return;
  }

  var fragment = template.content.cloneNode(true);
  var cardsContainer = fragment.querySelector('[data-cards-container]');

  for (var ti = 0; ti < topDays.length; ti++) {
    var entry = topDays[ti];
    
    // Format date in restaurant timezone
    var dateFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: restaurantTimezone,
      month: '2-digit',
      day: '2-digit',
      year: 'numeric'
    });
    var dateStr = dateFormatter.format(new Date(entry.date));

    var card = cardTemplate.content.cloneNode(true);
    card.querySelector('[data-field="date"]').textContent = dateStr;
    card.querySelector('[data-field="revenue"]').textContent = '$' + (entry.revenue / 100).toFixed(2);
    card.querySelector('[data-field="orders"]').textContent = entry.orders + ' orders';
    
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

