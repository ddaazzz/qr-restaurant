// ============= ANALYTICS DASHBOARD MODULE =============
// New analytics dashboard - automatic on page load

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
    orders_by_hour: {}
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

    // Revenue by day
    var createdDate = new Date(order.created_at);
    var date = createdDate.toISOString().split('T')[0];
    if (!stats.revenue_by_day[date]) {
      stats.revenue_by_day[date] = 0;
      stats.daily_order_counts[date] = 0;
    }
    stats.revenue_by_day[date] += orderAmount;
    stats.daily_order_counts[date]++;

    // Revenue by hour
    var hour = createdDate.getHours();
    var hourKey = (hour < 10 ? '0' : '') + hour + ':00';
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

  renderStatusDistribution(stats);

  renderBusiestTables(stats);

  renderHourlyRevenue(stats);

  renderTopItems(stats);

  renderDailyTrends(stats, 'daily');
}

function renderStatusDistribution(stats) {
  var container = document.getElementById("chart-status-distribution");
  if (!container) {
    return;
  }

  var html = '';
  for (var status in stats.order_count_by_status) {
    if (stats.order_count_by_status.hasOwnProperty(status)) {
      var count = stats.order_count_by_status[status];
      var colors = {
        pending: '#f59e0b',
        confirmed: '#3b82f6',
        ready: '#8b5cf6',
        served: '#10b981',
        paid: '#059669',
        cancelled: '#ef4444'
      };
      var color = colors[status] || '#6b7280';
      var percentage = ((count / stats.total_orders) * 100).toFixed(1);
      html += '<div style="margin-bottom: 16px;">' +
        '<div style="display: flex; justify-content: space-between; margin-bottom: 6px;">' +
        '<span style="font-size: 13px; color: #666; text-transform: capitalize; font-weight: 500;">' + status + '</span>' +
        '<span style="font-size: 13px; font-weight: 600; color: ' + color + ';">' + count + ' (' + percentage + '%)</span>' +
        '</div>' +
        '<div style="height: 8px; background: #f0f0f0; border-radius: 4px; overflow: hidden;">' +
        '<div style="height: 100%; background: ' + color + '; width: ' + percentage + '%;"></div>' +
        '</div>' +
        '</div>';
    }
  }

  container.innerHTML = html;
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

  var html = '<div style="display: flex; align-items: flex-end; gap: 12px; height: 200px;">';

  for (var ti = 0; ti < topDays.length; ti++) {
    var day = topDays[ti];
    var height = (day.orders / maxOrders) * 150;
    var dateObj = new Date(day.date);
    var dateLabel = (dateObj.getMonth() + 1) + '/' + dateObj.getDate();

    html += '<div style="flex: 1; display: flex; flex-direction: column; align-items: center;">' +
      '<div style="background: linear-gradient(to top, #667eea, #764ba2); width: 100%; height: ' + height + 'px; border-radius: 4px 4px 0 0; cursor: pointer; transition: opacity 0.3s;" title="' + day.orders + ' orders ($' + (day.revenue / 100).toFixed(2) + ')" onmouseover="this.style.opacity=\'0.8\'" onmouseout="this.style.opacity=\'1\'"></div>' +
      '<div style="font-size: 11px; color: #666; margin-top: 8px; font-weight: 600; text-align: center;">' + dateLabel + '</div>' +
      '<div style="font-size: 12px; color: #333; margin-top: 2px; font-weight: bold;">' + day.orders + '</div>' +
      '</div>';
  }

  html += '</div>';
  container.innerHTML = html;
}

function renderHourlyRevenue(stats) {
  var container = document.getElementById("chart-hourly-revenue");
  if (!container) return;

  var revenueValues = [];
  for (var hour in stats.revenue_by_hour) {
    if (stats.revenue_by_hour.hasOwnProperty(hour)) {
      revenueValues.push(stats.revenue_by_hour[hour]);
    }
  }
  var maxRevenue = Math.max.apply(null, revenueValues.length > 0 ? revenueValues : [1000]);
  
  var html = '<div style="display: flex; align-items: flex-end; gap: 6px; height: 250px;">';
  
  for (var i = 0; i < 24; i++) {
    var hourKey = i + ':00';
    var revenue = stats.revenue_by_hour[hourKey] || 0;
    var orderCount = stats.orders_by_hour[hourKey] || 0;
    var height = (revenue / maxRevenue) * 200;
    var tooltipText = 'Hour: ' + hourKey + ' | Revenue: $' + (revenue / 100).toFixed(2) + ' | Orders: ' + orderCount;
    
    html += '<div style="flex: 1; display: flex; flex-direction: column; align-items: center; position: relative;">' +
      '<div style="background: linear-gradient(to top, #667eea, #764ba2); width: 100%; height: ' + height + 'px; border-radius: 4px 4px 0 0; cursor: pointer; transition: all 0.3s; position: relative; group: hover;" title="' + tooltipText + '" onmouseover="this.style.opacity=\'0.8\'; this.style.boxShadow=\'0 4px 12px rgba(0,0,0,0.2)\';" onmouseout="this.style.opacity=\'1\'; this.style.boxShadow=\'none\';"></div>' +
      '<div style="font-size: 10px; color: #999; margin-top: 4px;">' + i + '</div>' +
      '</div>';
  }
  
  html += '</div>';
  container.innerHTML = html;
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
  var html = '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px;">';
  
  for (var ti = 0; ti < topDays.length; ti++) {
    var entry = topDays[ti];
    var dateObj = new Date(entry.date);
    var dateStr = (dateObj.getMonth() + 1) + '/' + dateObj.getDate() + '/' + dateObj.getFullYear();
    
    html += '<div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 16px; border-radius: 12px; color: white;">' +
      '<div style="font-size: 12px; opacity: 0.9; margin-bottom: 4px;">💰 ' + dateStr + '</div>' +
      '<div style="font-size: 18px; font-weight: 700; margin-bottom: 8px;">$' + (entry.revenue / 100).toFixed(2) + '</div>' +
      '<div style="font-size: 12px; opacity: 0.8;">' + entry.orders + ' orders</div>' +
      '</div>';
  }
  
  html += '</div>';
  container.innerHTML = html || '<p style="color: #ccc; text-align: center;">No revenue data</p>';
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
          label: new Date(date).toLocaleDateString(),
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
        entries.push({
          period: week,
          label: weekStart2.toLocaleDateString() + ' - ' + weekEnd.toLocaleDateString(),
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
        var monthDate = new Date(month + '-01');
        entries.push({
          period: month,
          label: monthDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long' }),
          revenue: monthMap[month].revenue,
          count: monthMap[month].count
        });
      }
    }
    entries.sort(function(a, b) {
      return new Date(b.period) - new Date(a.period);
    });
  }

  var html = '<table style="width: 100%; font-size: 13px; border-collapse: collapse;">' +
    '<thead>' +
    '<tr style="border-bottom: 2px solid #e5e7eb; background: #f9fafb;">' +
    '<th style="padding: 12px; text-align: left; font-weight: 600; color: #6b7280;">Period</th>' +
    '<th style="padding: 12px; text-align: right; font-weight: 600; color: #6b7280;">Orders</th>' +
    '<th style="padding: 12px; text-align: right; font-weight: 600; color: #6b7280;">Revenue</th>' +
    '<th style="padding: 12px; text-align: right; font-weight: 600; color: #6b7280;">Avg Bill</th>' +
    '</tr>' +
    '</thead>' +
    '<tbody>';

  for (var ei = 0; ei < entries.length; ei++) {
    var item = entries[ei];
    var avg = item.count > 0 ? item.revenue / item.count : 0;
    html += '<tr style="border-bottom: 1px solid #f0f0f0;">' +
      '<td style="padding: 12px; color: #1f2937; font-weight: 500;">' + item.label + '</td>' +
      '<td style="padding: 12px; text-align: right; color: #667eea; font-weight: 600;">' + item.count + '</td>' +
      '<td style="padding: 12px; text-align: right; color: #059669; font-weight: 600;">$' + (item.revenue / 100).toFixed(2) + '</td>' +
      '<td style="padding: 12px; text-align: right; color: #6b7280;">$' + (avg / 100).toFixed(2) + '</td>' +
      '</tr>';
  }

  html += '</tbody></table>';
  container.innerHTML = html || '<p style="color: #999; text-align: center;">No data</p>';
}

