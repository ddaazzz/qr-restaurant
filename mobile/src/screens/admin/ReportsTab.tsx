import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  FlatList,
  Modal,
  Dimensions,
  Share,
  Alert,
} from 'react-native';
import { apiClient } from '../../services/apiClient';
import { useTranslation } from '../../contexts/TranslationContext';

const SCREEN_WIDTH = Dimensions.get('window').width;
const NUM_METRIC_COLS = SCREEN_WIDTH > 600 ? 4 : 2;
const METRIC_CARD_WIDTH = Math.floor((SCREEN_WIDTH - 32 - (NUM_METRIC_COLS - 1) * 8) / NUM_METRIC_COLS);

interface Order {
  id: number;
  total_cents: number;
  discount_cents?: number;
  status: string;
  created_at: string;
  items: Array<{
    item_name?: string;
    menu_item_name?: string;
    quantity: number;
    price_cents?: number;
    unit_price_cents?: number;
  }>;
  table_name?: string;
  waiter_name?: string;
  closed_by_staff_name?: string;
  category_names?: string[];
  item_names?: string[];
}

interface PaymentByType {
  payment_method: string;
  order_count: number;
  total_revenue_cents: number;
}

interface StaffHour {
  staff_name: string;
  role: string;
  shift_count: number;
  total_minutes: number;
}

interface StatusTransition {
  from_status: string;
  to_status: string;
  transition_count: number;
  avg_minutes: number;
  min_minutes: number;
  max_minutes: number;
}

interface FastestItem {
  item_name: string;
  avg_minutes: number;
  sample_count: number;
}

interface BookingEntry {
  id?: number;
  status: string;
  booking_date_str?: string;
  booking_date?: string;
  booking_time?: string;
  pax?: number | string;
  table_name?: string;
  table_id?: number;
  guest_name?: string;
}

interface TopItem {
  item_name: string;
  total_qty: number;
  total_revenue_cents: number;
}

interface TopTable {
  table_name: string;
  order_count: number;
  total_revenue_cents: number;
}

interface SalesByCategory {
  category_name: string;
  total_qty: number;
  order_count: number;
  total_revenue_cents: number;
}

interface SalesByItem {
  item_name: string;
  category_name: string;
  total_qty: number;
  order_count: number;
  total_revenue_cents: number;
}

interface AnalyticsStats {
  total_orders: number;
  total_revenue: number;
  average_bill: number;
  active_sessions: number;
  total_discount: number;
  revenue_by_day: Record<string, number>;
  daily_discount: Record<string, number>;
  daily_order_counts: Record<string, number>;
  revenue_by_hour: Record<string, number>;
  orders_by_hour: Record<string, number>;
  order_count_by_status: Record<string, number>;
}

interface DailyTrend {
  period: string;
  orders: number;
  customers: number;
  revenue: number;
  discount: number;
  netSales: number;
  avgSpend: number;
}

type DateRange = 'today' | '7days' | '30days' | 'all';

export const ReportsTab = ({ restaurantId }: { restaurantId: string }) => {
  const { t } = useTranslation();
  const [stats, setStats] = useState<AnalyticsStats | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [topItems, setTopItems] = useState<TopItem[]>([]);
  const [topTables, setTopTables] = useState<TopTable[]>([]);
  const [salesByCategory, setSalesByCategory] = useState<SalesByCategory[]>([]);
  const [salesByItem, setSalesByItem] = useState<SalesByItem[]>([]);
  const [paymentByType, setPaymentByType] = useState<PaymentByType[]>([]);
  const [staffHours, setStaffHours] = useState<StaffHour[]>([]);
  const [statusTransitions, setStatusTransitions] = useState<StatusTransition[]>([]);
  const [fastestItems, setFastestItems] = useState<FastestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [trendMode, setTrendMode] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [showTrendModal, setShowTrendModal] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>('30days');
  const [showDateRangeModal, setShowDateRangeModal] = useState(false);
  const [revenueSort, setRevenueSort] = useState<{ col: 'date' | 'orders' | 'discount' | 'revenue'; asc: boolean }>({ col: 'date', asc: false });
  const [bookings, setBookings] = useState<BookingEntry[]>([]);
  const [bookingsTrendMode, setBookingsTrendMode] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [showBookingsTrendModal, setShowBookingsTrendModal] = useState(false);
  const [revenueFilterCategory, setRevenueFilterCategory] = useState('');
  const [revenueFilterStaff, setRevenueFilterStaff] = useState('');
  const [revenueFilterTable, setRevenueFilterTable] = useState('');
  const [revenueFilterProduct, setRevenueFilterProduct] = useState('');
  const [showCategoryFilter, setShowCategoryFilter] = useState(false);
  const [showStaffFilter, setShowStaffFilter] = useState(false);
  const [showTableFilter, setShowTableFilter] = useState(false);
  const [showProductFilter, setShowProductFilter] = useState(false);

  // Date range days mapping
  const dateRangeDays: Record<DateRange, number> = {
    today: 1,
    '7days': 7,
    '30days': 30,
    all: 9999,
  };

  const dateRangeLabels: Record<DateRange, string> = {
    today: t('admin.report-today') || 'Today',
    '7days': t('admin.report-last-7') || 'Last 7 Days',
    '30days': t('admin.report-last-30') || 'Last 30 Days',
    all: t('admin.report-all-time') || 'All Time',
  };

  const fetchReports = async () => {
    try {
      setError(null);
      const days = dateRangeDays[dateRange];
      
      // Fetch orders + top items + top tables + sales breakdowns + bookings in parallel
      const [ordersRes, topItemsRes, topTablesRes, salesByCategoryRes, salesByItemRes, paymentByTypeRes, staffHoursRes, statusTimingRes, bookingsRes] = await Promise.all([
        apiClient.get(`/api/restaurants/${restaurantId}/orders?limit=1000`),
        apiClient.get(`/api/restaurants/${restaurantId}/reports/top-items?days=${days}`).catch(() => ({ data: [] })),
        apiClient.get(`/api/restaurants/${restaurantId}/reports/top-tables?days=${days}`).catch(() => ({ data: [] })),
        apiClient.get(`/api/restaurants/${restaurantId}/reports/sales-by-category?days=${days}`).catch(() => ({ data: [] })),
        apiClient.get(`/api/restaurants/${restaurantId}/reports/sales-by-item?days=${days}`).catch(() => ({ data: [] })),
        apiClient.get(`/api/restaurants/${restaurantId}/reports/payment-by-type?days=${days}`).catch(() => ({ data: [] })),
        apiClient.get(`/api/restaurants/${restaurantId}/reports/staff-hours?days=${days}`).catch(() => ({ data: [] })),
        apiClient.get(`/api/restaurants/${restaurantId}/reports/order-status-timing?days=${days}`).catch(() => ({ data: { transitions: [], fastest_items: [] } })),
        apiClient.get(`/api/restaurants/${restaurantId}/bookings`).catch(() => ({ data: [] })),
      ]);

      const allOrders: Order[] = ordersRes.data || [];
      
      // Filter orders by date range client-side
      const now = Date.now();
      const filteredOrders = dateRange === 'all'
        ? allOrders
        : allOrders.filter(order => {
            const orderDate = new Date(order.created_at).getTime();
            return (now - orderDate) / (1000 * 60 * 60 * 24) <= days;
          });

      // Filter bookings by date range
      const allBookings: BookingEntry[] = (bookingsRes as any).data || [];
      const filteredBookings = dateRange === 'all'
        ? allBookings
        : allBookings.filter(b => {
            const dateStr = b.booking_date_str || b.booking_date;
            if (!dateStr) return false;
            return (now - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24) <= days;
          });
      setBookings(filteredBookings);

      setOrders(filteredOrders);
      setTopItems(topItemsRes.data || []);
      setTopTables(topTablesRes.data || []);
      setSalesByCategory(salesByCategoryRes.data || []);
      setSalesByItem(salesByItemRes.data || []);
      setPaymentByType((paymentByTypeRes as any).data || []);
      setStaffHours((staffHoursRes as any).data || []);
      const timingData = (statusTimingRes as any).data || {};
      setStatusTransitions(timingData.transitions || []);
      setFastestItems(timingData.fastest_items || []);

      if (filteredOrders.length > 0) {
        const calculatedStats = calculateAnalyticsStats(filteredOrders);
        setStats(calculatedStats);
      } else {
        setStats({
          total_orders: 0,
          total_revenue: 0,
          average_bill: 0,
          active_sessions: 0,
          total_discount: 0,
          revenue_by_day: {},
          daily_discount: {},
          daily_order_counts: {},
          revenue_by_hour: {},
          orders_by_hour: {},
          order_count_by_status: {},
        });
      }
    } catch (err: any) {
      console.error('[Reports] Error fetching reports:', err);
      setError(err.message || 'Failed to load reports');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const calculateAnalyticsStats = (allOrders: Order[]): AnalyticsStats => {
    const stats: AnalyticsStats = {
      total_orders: allOrders.length,
      total_revenue: 0,
      average_bill: 0,
      active_sessions: allOrders.length,
      total_discount: 0,
      revenue_by_day: {},
      daily_discount: {},
      daily_order_counts: {},
      revenue_by_hour: {},
      orders_by_hour: {},
      order_count_by_status: {},
    };

    for (const order of allOrders) {
      const orderAmount = parseInt(order.total_cents?.toString() || '0', 10) || 0;
      const discountAmount = parseInt(order.discount_cents?.toString() || '0', 10) || 0;
      stats.total_revenue += orderAmount;
      stats.total_discount += discountAmount;

      // Status breakdown
      const status = order.status || 'unknown';
      stats.order_count_by_status[status] = (stats.order_count_by_status[status] || 0) + 1;

      // Revenue by date
      const createdDate = new Date(order.created_at);
      const dateStr = createdDate.toISOString().split('T')[0];
      stats.revenue_by_day[dateStr] = (stats.revenue_by_day[dateStr] || 0) + orderAmount;
      stats.daily_discount[dateStr] = (stats.daily_discount[dateStr] || 0) + discountAmount;
      stats.daily_order_counts[dateStr] = (stats.daily_order_counts[dateStr] || 0) + 1;

      // Revenue by hour
      const hour = String(createdDate.getHours()).padStart(2, '0');
      const hourKey = `${hour}:00`;
      stats.revenue_by_hour[hourKey] = (stats.revenue_by_hour[hourKey] || 0) + orderAmount;
      stats.orders_by_hour[hourKey] = (stats.orders_by_hour[hourKey] || 0) + 1;
    }

    stats.average_bill = stats.total_orders > 0 ? Math.round(stats.total_revenue / stats.total_orders) : 0;

    return stats;
  };

  const getDailyTrends = (mode: 'daily' | 'weekly' | 'monthly'): DailyTrend[] => {
    if (!stats) return [];

    const trends: Record<string, { orders: number; revenue: number; discount: number }> = {};

    Object.entries(stats.revenue_by_day).forEach(([date, revenue]) => {
      let key = date;

      if (mode === 'weekly') {
        const d = new Date(date);
        const weekStart = new Date(d);
        weekStart.setDate(d.getDate() - d.getDay());
        key = weekStart.toISOString().split('T')[0];
      } else if (mode === 'monthly') {
        key = date.substring(0, 7);
      }

      if (!trends[key]) {
        trends[key] = { orders: 0, revenue: 0, discount: 0 };
      }
      trends[key].revenue += revenue;
      trends[key].orders += stats.daily_order_counts[date] || 0;
      trends[key].discount += stats.daily_discount[date] || 0;
    });

    return Object.entries(trends)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([period, { orders, revenue, discount }]) => ({
        period,
        orders,
        customers: orders,
        revenue,
        discount,
        netSales: revenue - discount,
        avgSpend: orders > 0 ? Math.round(revenue / orders) : 0,
      }));
  };

  const getBookingsTrends = (mode: 'daily' | 'weekly' | 'monthly') => {
    const periodMap: Record<string, { label: string; total: number; confirmed: number; cancelled: number; pax: number }> = {};
    bookings.forEach(b => {
      const raw = (b.booking_date_str || b.booking_date || '').substring(0, 10);
      if (!raw) return;
      let key: string;
      let label: string;
      if (mode === 'daily') {
        key = label = raw;
      } else if (mode === 'weekly') {
        const d = new Date(raw + 'T00:00:00');
        const ws = new Date(d);
        ws.setDate(d.getDate() - d.getDay());
        const we = new Date(ws);
        we.setDate(we.getDate() + 6);
        key = ws.toISOString().split('T')[0];
        label = `${key} – ${we.toISOString().split('T')[0]}`;
      } else {
        key = label = raw.substring(0, 7);
      }
      if (!periodMap[key]) periodMap[key] = { label, total: 0, confirmed: 0, cancelled: 0, pax: 0 };
      periodMap[key].total++;
      periodMap[key].pax += parseInt(String(b.pax || 0), 10) || 0;
      if (b.status === 'confirmed' || b.status === 'completed') periodMap[key].confirmed++;
      if (b.status === 'cancelled') periodMap[key].cancelled++;
    });
    return Object.keys(periodMap).sort().reverse().map(k => periodMap[k]);
  };

  useEffect(() => {
    fetchReports();
  }, [restaurantId, dateRange]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchReports();
  };

  const exportToCSV = async () => {
    try {
      const lines: string[] = [];
      const esc = (v: any) => {
        const s = String(v ?? '');
        return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const row = (...cells: any[]) => lines.push(cells.map(esc).join(','));

      // --- Summary Metrics ---
      row('Report', `${dateRangeLabels[dateRange]}`);
      row();
      row('SUMMARY METRICS');
      row('Metric', 'Value');
      row('Total Orders', stats?.total_orders ?? 0);
      row('Total Revenue', formatPrice(stats?.total_revenue ?? 0));
      row('Average Bill', formatPrice(stats?.average_bill ?? 0));
      row('Total Discounts', formatPrice(stats?.total_discount ?? 0));
      row('Customers / Day', customersPerDay);
      row('Avg Spend / Customer', formatPrice(avgSpendPerCustomer));
      row('Avg Daily Net Sales', formatPrice(avgDailyNetSales));
      row('Avg Daily Customers', avgDailyCustomers);
      row('Total Bookings', bookingsTotal);
      row('Confirmed Bookings', bookingsConfirmed);
      row('Cancelled Bookings', bookingsCancelled);
      row();

      // --- Revenue by Day ---
      row('REVENUE BY DAY');
      row('Date', 'Orders', 'Discount', 'Revenue', 'Net Sales');
      Object.entries(filteredRevenueByDay)
        .sort(([a], [b]) => b.localeCompare(a))
        .forEach(([date, data]) => {
          row(date, data.orders, formatPrice(data.discount), formatPrice(data.revenue), formatPrice(data.revenue - data.discount));
        });
      row();

      // --- Payment by Type ---
      if (paymentByType.length > 0) {
        row('PAYMENT BY TYPE');
        row('Method', 'Orders', 'Revenue');
        paymentByType.forEach(p => {
          row(p.payment_method, p.order_count, formatPrice(parseInt(String(p.total_revenue_cents || 0), 10)));
        });
        row();
      }

      // --- Top Items ---
      if (topItems.length > 0) {
        row('TOP ITEMS');
        row('Item', 'Qty Sold', 'Revenue');
        topItems.forEach(item => {
          row(item.item_name, item.total_qty, formatPrice(item.total_revenue_cents));
        });
        row();
      }

      // --- Sales by Category ---
      if (salesByCategory.length > 0) {
        row('SALES BY CATEGORY');
        row('Category', 'Items Sold', 'Orders', 'Revenue');
        salesByCategory.forEach(cat => {
          row(cat.category_name, cat.total_qty, cat.order_count, formatPrice(parseInt(String(cat.total_revenue_cents || 0), 10)));
        });
        row();
      }

      // --- Busiest Tables ---
      if (topTables.length > 0) {
        row('BUSIEST TABLES');
        row('Table', 'Orders', 'Revenue');
        topTables.forEach(tbl => {
          row(tbl.table_name, tbl.order_count, formatPrice(tbl.total_revenue_cents));
        });
        row();
      }

      // --- Staff Hours ---
      if (staffHours.length > 0) {
        row('STAFF HOURS');
        row('Staff', 'Role', 'Shifts', 'Total Hours', 'Avg Shift (hrs)');
        staffHours.forEach(s => {
          const totalMin = parseFloat(String(s.total_minutes || 0)) || 0;
          row(s.staff_name, s.role, s.shift_count, (totalMin / 60).toFixed(1), s.shift_count > 0 ? (totalMin / s.shift_count / 60).toFixed(1) : '—');
        });
        row();
      }

      // --- Bookings Trend ---
      if (bookingTrends.length > 0) {
        row('BOOKINGS TREND');
        row('Period', 'Total', 'Confirmed', 'Cancelled', 'Guests');
        bookingTrends.forEach(e => {
          row(e.label, e.total, e.confirmed, e.cancelled, e.pax);
        });
        row();
      }

      const csv = lines.join('\n');
      const filename = `reports-${dateRange}-${new Date().toISOString().slice(0, 10)}.csv`;

      await Share.share({
        message: csv,
        title: filename,
      });
    } catch (err: any) {
      if (err.message !== 'User did not share') {
        Alert.alert('Export Failed', err.message || 'Could not export report');
      }
    }
  };

  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  // All computed values and useMemo hooks MUST be before any early return (Rules of Hooks)
  const dailyTrends = getDailyTrends(trendMode);
  const bookingTrends = getBookingsTrends(bookingsTrendMode);

  // Computed metrics
  const numDays = Math.max(Object.keys(stats?.revenue_by_day || {}).length, 1);
  const totalCustomers = stats?.total_orders || 0;
  const customersPerDay = (totalCustomers / numDays).toFixed(1);
  const avgSpendPerCustomer = totalCustomers > 0 ? Math.round((stats?.total_revenue || 0) / totalCustomers) : 0;
  const netSalesTotal = (stats?.total_revenue || 0) - (stats?.total_discount || 0);
  const avgDailyNetSales = Math.round(netSalesTotal / numDays);
  const avgDailyCustomers = (totalCustomers / numDays).toFixed(1);

  // Filter options derived from data
  const revenueCategoryOptions = useMemo(() => [...new Set(salesByCategory.map(c => c.category_name).filter(Boolean))], [salesByCategory]);
  const revenueStaffOptions = useMemo(() => [...new Set(orders.map(o => o.closed_by_staff_name).filter((v): v is string => !!v))], [orders]);
  const revenueTableOptions = useMemo(() => [...new Set(orders.map(o => o.table_name).filter((v): v is string => !!v))], [orders]);
  const revenueProductOptions = useMemo(() => [...new Set(salesByItem.map(i => i.item_name).filter(Boolean))], [salesByItem]);

  // Filtered revenue by day
  const filteredRevenueByDay = useMemo(() => {
    const filtered = orders.filter(o => {
      if (revenueFilterCategory && !(o.category_names || []).includes(revenueFilterCategory)) return false;
      if (revenueFilterStaff && o.closed_by_staff_name !== revenueFilterStaff) return false;
      if (revenueFilterTable && o.table_name !== revenueFilterTable) return false;
      if (revenueFilterProduct && !(o.item_names || []).includes(revenueFilterProduct)) return false;
      return true;
    });
    const byDay: Record<string, { revenue: number; orders: number; discount: number }> = {};
    filtered.forEach(o => {
      const date = new Date(o.created_at).toISOString().split('T')[0];
      if (!byDay[date]) byDay[date] = { revenue: 0, orders: 0, discount: 0 };
      byDay[date].revenue += parseInt(String(o.total_cents || 0), 10) || 0;
      byDay[date].discount += parseInt(String(o.discount_cents || 0), 10) || 0;
      byDay[date].orders++;
    });
    return byDay;
  }, [orders, revenueFilterCategory, revenueFilterStaff, revenueFilterTable, revenueFilterProduct]);

  // Bookings computed values
  const bookingsTotal = bookings.length;
  const bookingsConfirmed = bookings.filter(b => b.status === 'confirmed' || b.status === 'completed').length;
  const bookingsCancelled = bookings.filter(b => b.status === 'cancelled').length;
  const bookingsTotalPax = bookings.reduce((s, b) => s + (parseInt(String(b.pax || 0), 10) || 0), 0);
  const bookingsAvgPax = bookingsTotal > 0 ? (bookingsTotalPax / bookingsTotal).toFixed(1) : '0';
  const bookingsCompletionRate = bookingsTotal > 0 ? Math.round((bookingsConfirmed / bookingsTotal) * 100) : 0;

  const bookingsPeakHours = useMemo(() => {
    const h = new Array(24).fill(0);
    bookings.forEach(b => {
      if (!b.booking_time) return;
      const hr = parseInt(b.booking_time.split(':')[0], 10);
      if (!isNaN(hr)) h[hr]++;
    });
    return h;
  }, [bookings]);
  const bookingsPeakMax = Math.max(...bookingsPeakHours, 1);

  const bookingsTopTables = useMemo(() => {
    const tc: Record<string, { count: number; pax: number }> = {};
    bookings.forEach(b => {
      const name = b.table_name || `Table ${b.table_id}`;
      if (!tc[name]) tc[name] = { count: 0, pax: 0 };
      tc[name].count++;
      tc[name].pax += parseInt(String(b.pax || 0), 10) || 0;
    });
    return Object.entries(tc).sort(([, a], [, b]) => b.count - a.count).slice(0, 8).map(([name, v]) => ({ name, ...v }));
  }, [bookings]);

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  const renderFilterChip = (label: string, value: string, onPress: () => void) => (
    <TouchableOpacity
      key={label}
      onPress={onPress}
      style={[styles.filterChip, value ? styles.filterChipActive : null]}
    >
      <Text style={[styles.filterChipText, value ? styles.filterChipTextActive : null]}>
        {value ? `${label}: ${value}` : label}
      </Text>
    </TouchableOpacity>
  );

  const renderFilterModal = (
    visible: boolean,
    title: string,
    options: string[],
    current: string,
    onSelect: (v: string) => void,
    onClose: () => void,
  ) => (
    <Modal supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']} visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>{title}</Text>
          <TouchableOpacity
            style={[styles.trendOption, current === '' && styles.trendOptionActive]}
            onPress={() => { onSelect(''); onClose(); }}
          >
            <Text style={[styles.trendOptionText, current === '' && styles.trendOptionTextActive]}>All</Text>
          </TouchableOpacity>
          {options.map(opt => (
            <TouchableOpacity
              key={opt}
              style={[styles.trendOption, current === opt && styles.trendOptionActive]}
              onPress={() => { onSelect(opt); onClose(); }}
            >
              <Text style={[styles.trendOptionText, current === opt && styles.trendOptionTextActive]}>{opt}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={[styles.trendOption, { backgroundColor: '#e5e7eb', marginTop: 12 }]} onPress={onClose}>
            <Text style={styles.trendOptionText}>{t('common.close') || 'Close'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {stats && (
        <View style={styles.content}>
          {/* Header row: date range filter + export */}
          <View style={styles.reportHeaderRow}>
            <TouchableOpacity
              style={styles.dateRangeBtn}
              onPress={() => setShowDateRangeModal(true)}
            >
              <Text style={styles.dateRangeBtnText}>
                {dateRangeLabels[dateRange]}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.exportBtn} onPress={exportToCSV}>
              <Text style={styles.exportBtnText}>⬇ Export CSV</Text>
            </TouchableOpacity>
          </View>

          {/* Key Metrics — 11 cards matching webapp */}
          <View style={styles.metricsGrid}>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>{t('admin.total-orders') || 'Total Orders'}</Text>
              <Text style={styles.metricValue}>{stats.total_orders}</Text>
            </View>
            <View style={[styles.metricCard, { borderLeftColor: '#059669' }]}>
              <Text style={styles.metricLabel}>{t('admin.total-revenue') || 'Total Revenue'}</Text>
              <Text style={styles.metricValue}>{formatPrice(stats.total_revenue)}</Text>
            </View>
            <View style={[styles.metricCard, { borderLeftColor: '#f59e0b' }]}>
              <Text style={styles.metricLabel}>{t('admin.avg-bill') || 'Avg Bill'}</Text>
              <Text style={styles.metricValue}>{formatPrice(stats.average_bill)}</Text>
            </View>
            <View style={[styles.metricCard, { borderLeftColor: '#dc2626' }]}>
              <Text style={styles.metricLabel}>{t('admin.total-discounts') || 'Total Discounts'}</Text>
              <Text style={[styles.metricValue, { color: '#dc2626' }]}>{formatPrice(stats.total_discount)}</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>{t('admin.customers-per-day') || 'Customers / Day'}</Text>
              <Text style={styles.metricValue}>{customersPerDay}</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>{t('admin.avg-spend-per-customer') || 'Avg Spend / Customer'}</Text>
              <Text style={styles.metricValue}>{formatPrice(avgSpendPerCustomer)}</Text>
            </View>
            <View style={[styles.metricCard, { borderLeftColor: '#059669' }]}>
              <Text style={styles.metricLabel}>{t('admin.avg-daily-net-sales') || 'Avg Daily Net Sales'}</Text>
              <Text style={[styles.metricValue, { color: '#059669' }]}>{formatPrice(avgDailyNetSales)}</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>{t('admin.avg-daily-customers') || 'Avg Daily Customers'}</Text>
              <Text style={styles.metricValue}>{avgDailyCustomers}</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>{t('admin.total-bookings') || 'Total Bookings'}</Text>
              <Text style={styles.metricValue}>{bookingsTotal}</Text>
            </View>
            <View style={[styles.metricCard, { borderLeftColor: '#059669' }]}>
              <Text style={styles.metricLabel}>{t('admin.bookings-confirmed') || 'Confirmed'}</Text>
              <Text style={[styles.metricValue, { color: '#059669' }]}>{bookingsConfirmed}</Text>
            </View>
            <View style={[styles.metricCard, { borderLeftColor: '#dc2626' }]}>
              <Text style={styles.metricLabel}>{t('admin.bookings-cancelled') || 'Cancelled'}</Text>
              <Text style={[styles.metricValue, { color: '#dc2626' }]}>{bookingsCancelled}</Text>
            </View>
          </View>

          {/* Top Revenue Days */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('admin.report-top-revenue-days') || 'Top Revenue Days'}</Text>
            <View style={styles.cardsContainer}>
              {Object.entries(stats.revenue_by_day)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 5)
                .map(([date, revenue], idx) => {
                  const colors = ['#667eea', '#e67e22', '#059669', '#8b5cf6', '#06b6d4'];
                  return (
                    <View key={date} style={[styles.card, { borderLeftColor: colors[idx % colors.length] }]}>
                      <Text style={[styles.cardRank, { color: colors[idx % colors.length] }]}>#{idx + 1}</Text>
                      <Text style={styles.cardDate}>{date}</Text>
                      <Text style={styles.cardRevenue}>{formatPrice(revenue)}</Text>
                      <Text style={styles.cardOrders}>
                        {stats.daily_order_counts[date] || 0} {t('admin.orders') || 'orders'}
                      </Text>
                    </View>
                  );
                })}
            </View>
          </View>

          {/* Revenue Report with filters */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('admin.orders-bills') || 'Revenue Report'}</Text>
            {/* Filter chips */}
            <View style={styles.filterRow}>
              {renderFilterChip(t('admin.filter-by-category') || 'Category', revenueFilterCategory, () => setShowCategoryFilter(true))}
              {renderFilterChip(t('admin.filter-by-staff') || 'Staff', revenueFilterStaff, () => setShowStaffFilter(true))}
              {renderFilterChip(t('admin.filter-by-table') || 'Table', revenueFilterTable, () => setShowTableFilter(true))}
              {renderFilterChip(t('admin.filter-by-product') || 'Product', revenueFilterProduct, () => setShowProductFilter(true))}
            </View>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <TouchableOpacity style={{ flex: 1.2 }} onPress={() => setRevenueSort(s => ({ col: 'date', asc: s.col === 'date' ? !s.asc : false }))}>
                  <Text style={styles.tableHeaderCell}>{t('admin.date') || 'Date'}{revenueSort.col === 'date' ? (revenueSort.asc ? ' ▲' : ' ▼') : ''}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={{ flex: 0.6 }} onPress={() => setRevenueSort(s => ({ col: 'orders', asc: s.col === 'orders' ? !s.asc : false }))}>
                  <Text style={[styles.tableHeaderCell, { textAlign: 'right' }]}>{t('admin.col-orders') || 'Orders'}{revenueSort.col === 'orders' ? (revenueSort.asc ? ' ▲' : ' ▼') : ''}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={{ flex: 0.9 }} onPress={() => setRevenueSort(s => ({ col: 'discount', asc: s.col === 'discount' ? !s.asc : false }))}>
                  <Text style={[styles.tableHeaderCell, { textAlign: 'right' }]}>{t('admin.col-discount') || 'Discount'}{revenueSort.col === 'discount' ? (revenueSort.asc ? ' ▲' : ' ▼') : ''}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={{ flex: 1 }} onPress={() => setRevenueSort(s => ({ col: 'revenue', asc: s.col === 'revenue' ? !s.asc : false }))}>
                  <Text style={[styles.tableHeaderCell, { textAlign: 'right' }]}>{t('admin.col-revenue') || 'Revenue'}{revenueSort.col === 'revenue' ? (revenueSort.asc ? ' ▲' : ' ▼') : ''}</Text>
                </TouchableOpacity>
              </View>
              <FlatList
                data={Object.entries(filteredRevenueByDay)
                  .sort(([a, aData], [b, bData]) => {
                    let cmp = 0;
                    if (revenueSort.col === 'date') cmp = a.localeCompare(b);
                    else if (revenueSort.col === 'orders') cmp = aData.orders - bData.orders;
                    else if (revenueSort.col === 'discount') cmp = aData.discount - bData.discount;
                    else cmp = aData.revenue - bData.revenue;
                    return revenueSort.asc ? cmp : -cmp;
                  })}
                renderItem={({ item: [date, data] }) => (
                  <View style={styles.tableRow}>
                    <Text style={[styles.tableCell, { flex: 1.2, fontWeight: '500', color: '#1f2937' }]}>{date}</Text>
                    <Text style={[styles.tableCell, { flex: 0.6, textAlign: 'right', color: '#667eea', fontWeight: '600' }]}>{data.orders}</Text>
                    <Text style={[styles.tableCell, { flex: 0.9, textAlign: 'right', color: '#dc2626' }]}>
                      {data.discount > 0 ? `-${formatPrice(data.discount)}` : '—'}
                    </Text>
                    <Text style={[styles.tableCell, { flex: 1, textAlign: 'right', color: '#059669', fontWeight: '600' }]}>{formatPrice(data.revenue)}</Text>
                  </View>
                )}
                keyExtractor={(item) => item[0]}
                scrollEnabled={false}
              />
            </View>
          </View>

          {/* Busiest Tables */}
          {topTables.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('admin.report-tables') || 'Busiest Tables'}</Text>
              <View style={styles.table}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderCell, { flex: 1.2 }]}>{t('admin.col-table') || 'Table'}</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 0.6, textAlign: 'right' }]}>{t('admin.col-orders') || 'Orders'}</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 0.9, textAlign: 'right' }]}>{t('admin.col-revenue') || 'Revenue'}</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 0.8 }]}>{' '}</Text>
                </View>
                {topTables.map((table, idx) => {
                  const maxOrders = topTables[0]?.order_count || 1;
                  const barPct = (table.order_count / maxOrders) * 100;
                  return (
                    <View key={idx} style={styles.tableRow}>
                      <Text style={[styles.tableCell, { flex: 1.2, fontWeight: '500', color: '#1f2937' }]}>{table.table_name}</Text>
                      <Text style={[styles.tableCell, { flex: 0.6, textAlign: 'right', color: '#667eea', fontWeight: '600' }]}>{table.order_count}</Text>
                      <Text style={[styles.tableCell, { flex: 0.9, textAlign: 'right', color: '#059669', fontWeight: '600' }]}>{formatPrice(table.total_revenue_cents)}</Text>
                      <View style={{ flex: 0.8, justifyContent: 'center' }}>
                        <View style={{ backgroundColor: '#f3f4f6', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                          <View style={{ backgroundColor: '#667eea', height: '100%', width: `${barPct}%`, borderRadius: 4 }} />
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Hourly Revenue */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('admin.report-hourly') || 'Hourly Revenue'}</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, { flex: 0.6 }]}>{t('admin.col-hour') || 'Hour'}</Text>
                <Text style={[styles.tableHeaderCell, { flex: 0.6, textAlign: 'right' }]}>{t('admin.col-orders') || 'Orders'}</Text>
                <Text style={[styles.tableHeaderCell, { flex: 0.9, textAlign: 'right' }]}>{t('admin.col-revenue') || 'Revenue'}</Text>
                <Text style={[styles.tableHeaderCell, { flex: 0.8 }]}>{' '}</Text>
              </View>
              {(() => {
                const maxRev = Math.max(...Array.from({ length: 24 }, (_, i) => stats.revenue_by_hour[`${String(i).padStart(2, '0')}:00`] || 0), 1);
                return Array.from({ length: 24 }, (_, i) => {
                  const hourKey = `${String(i).padStart(2, '0')}:00`;
                  const revenue = stats.revenue_by_hour[hourKey] || 0;
                  const orderCount = stats.orders_by_hour[hourKey] || 0;
                  if (orderCount === 0 && revenue === 0) return null;
                  const barPct = (revenue / maxRev) * 100;
                  return (
                    <View key={hourKey} style={styles.tableRow}>
                      <Text style={[styles.tableCell, { flex: 0.6, fontWeight: '500', color: '#1f2937' }]}>{hourKey}</Text>
                      <Text style={[styles.tableCell, { flex: 0.6, textAlign: 'right', color: '#667eea', fontWeight: '600' }]}>{orderCount}</Text>
                      <Text style={[styles.tableCell, { flex: 0.9, textAlign: 'right', color: '#059669', fontWeight: '600' }]}>{formatPrice(revenue)}</Text>
                      <View style={{ flex: 0.8, justifyContent: 'center' }}>
                        <View style={{ backgroundColor: '#f3f4f6', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                          <View style={{ backgroundColor: '#667eea', height: '100%', width: `${barPct}%`, borderRadius: 4 }} />
                        </View>
                      </View>
                    </View>
                  );
                }).filter(Boolean);
              })()}
            </View>
          </View>

          {/* Order Status Breakdown */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('admin.report-order-status') || 'Order Status Breakdown'}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {Object.entries(stats.order_count_by_status)
                .sort(([, a], [, b]) => b - a)
                .map(([status, count]) => {
                  const statusColors: Record<string, string> = { paid: '#059669', completed: '#059669', pending: '#f59e0b', preparing: '#4a90e2', ready: '#8b5cf6', cancelled: '#dc2626', refunded: '#dc2626' };
                  const color = statusColors[status] || '#6b7280';
                  return (
                    <View key={status} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: `${color}11`, borderWidth: 1, borderColor: `${color}44`, borderRadius: 8 }}>
                      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
                      <Text style={{ fontSize: 12, color: '#374151', fontWeight: '500', textTransform: 'capitalize' }}>{status}</Text>
                      <Text style={{ fontSize: 13, fontWeight: '700', color }}>{count}</Text>
                    </View>
                  );
                })}
            </View>
          </View>

          {/* Order Status Timing (Dish Prep Speed) */}
          {(statusTransitions.length > 0 || fastestItems.length > 0) && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('admin.report-status-timing') || 'Dish Preparation Speed'}</Text>
              {statusTransitions.length > 0 && (
                <View style={styles.table}>
                  <View style={styles.tableHeader}>
                    <Text style={[styles.tableHeaderCell, { flex: 1.4 }]}>{t('admin.col-transition') || 'Transition'}</Text>
                    <Text style={[styles.tableHeaderCell, { flex: 0.6, textAlign: 'right' }]}>{t('admin.col-count') || 'Count'}</Text>
                    <Text style={[styles.tableHeaderCell, { flex: 0.7, textAlign: 'right' }]}>{t('admin.col-avg-time') || 'Avg'}</Text>
                    <Text style={[styles.tableHeaderCell, { flex: 0.6, textAlign: 'right' }]}>{t('admin.col-min-time') || 'Min'}</Text>
                    <Text style={[styles.tableHeaderCell, { flex: 0.6, textAlign: 'right' }]}>{t('admin.col-max-time') || 'Max'}</Text>
                  </View>
                  {statusTransitions.map((tr, idx) => (
                    <View key={idx} style={styles.tableRow}>
                      <Text style={[styles.tableCell, { flex: 1.4, color: '#1f2937', fontWeight: '500' }]} numberOfLines={1}>
                        {`${tr.from_status || '—'} → ${tr.to_status}`}
                      </Text>
                      <Text style={[styles.tableCell, { flex: 0.6, textAlign: 'right', color: '#6b7280' }]}>{tr.transition_count}</Text>
                      <Text style={[styles.tableCell, { flex: 0.7, textAlign: 'right', color: '#059669', fontWeight: '600' }]}>{tr.avg_minutes}</Text>
                      <Text style={[styles.tableCell, { flex: 0.6, textAlign: 'right', color: '#6b7280' }]}>{tr.min_minutes}</Text>
                      <Text style={[styles.tableCell, { flex: 0.6, textAlign: 'right', color: '#6b7280' }]}>{tr.max_minutes}</Text>
                    </View>
                  ))}
                </View>
              )}
              {fastestItems.length > 0 && (
                <View style={{ marginTop: 12 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 }}>
                    {t('admin.fastest-dishes') || 'Fastest Dishes (preparing → ready)'}
                  </Text>
                  <View style={styles.table}>
                    <View style={styles.tableHeader}>
                      <Text style={[styles.tableHeaderCell, { flex: 1.4 }]}>{t('admin.col-item') || 'Item'}</Text>
                      <Text style={[styles.tableHeaderCell, { flex: 0.9, textAlign: 'right' }]}>{t('admin.col-avg-time') || 'Avg (min)'}</Text>
                      <Text style={[styles.tableHeaderCell, { flex: 0.7, textAlign: 'right' }]}>{t('admin.col-samples') || 'Samples'}</Text>
                    </View>
                    {fastestItems.map((f, idx) => (
                      <View key={idx} style={styles.tableRow}>
                        <Text style={[styles.tableCell, { flex: 1.4, fontWeight: '500', color: '#1f2937' }]}>{f.item_name}</Text>
                        <Text style={[styles.tableCell, { flex: 0.9, textAlign: 'right', color: '#059669', fontWeight: '600' }]}>{f.avg_minutes}</Text>
                        <Text style={[styles.tableCell, { flex: 0.7, textAlign: 'right', color: '#6b7280' }]}>{f.sample_count}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Payment by Type */}
          {paymentByType.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('admin.report-payment-by-type') || 'Payment by Type'}</Text>
              <View style={styles.table}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderCell, { flex: 1.2 }]}>{t('admin.col-payment-method') || 'Method'}</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 0.6, textAlign: 'right' }]}>{t('admin.col-orders') || 'Orders'}</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 0.9, textAlign: 'right' }]}>{t('admin.col-revenue') || 'Revenue'}</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 0.5, textAlign: 'right' }]}>%</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 0.7 }]}>{' '}</Text>
                </View>
                {(() => {
                  const totalRev = paymentByType.reduce((s, p) => s + (parseInt(String(p.total_revenue_cents || 0), 10) || 0), 0);
                  const payColors: Record<string, string> = { cash: '#059669', kpay: '#667eea', 'payment-asia': '#e67e22', card: '#8b5cf6', alipay: '#dc2626', wechat: '#06b6d4' };
                  return paymentByType.map((p, idx) => {
                    const rev = parseInt(String(p.total_revenue_cents || 0), 10) || 0;
                    const pct = totalRev > 0 ? (rev / totalRev) * 100 : 0;
                    const color = payColors[p.payment_method] || '#6b7280';
                    return (
                      <View key={p.payment_method || idx} style={styles.tableRow}>
                        <View style={{ flex: 1.2, flexDirection: 'row', alignItems: 'center' }}>
                          <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: color, marginRight: 6 }} />
                          <Text style={{ fontSize: 13, fontWeight: '500', color: '#1f2937', textTransform: 'capitalize' }}>{p.payment_method}</Text>
                        </View>
                        <Text style={[styles.tableCell, { flex: 0.6, textAlign: 'right', color: '#667eea', fontWeight: '600' }]}>{p.order_count}</Text>
                        <Text style={[styles.tableCell, { flex: 0.9, textAlign: 'right', color: '#059669', fontWeight: '600' }]}>{formatPrice(rev)}</Text>
                        <Text style={[styles.tableCell, { flex: 0.5, textAlign: 'right', color: '#6b7280' }]}>{pct.toFixed(1)}%</Text>
                        <View style={{ flex: 0.7, justifyContent: 'center' }}>
                          <View style={{ backgroundColor: '#f3f4f6', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                            <View style={{ backgroundColor: color, height: '100%', width: `${pct}%`, borderRadius: 4 }} />
                          </View>
                        </View>
                      </View>
                    );
                  });
                })()}
              </View>
            </View>
          )}

          {/* Staff Hours */}
          {staffHours.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('admin.report-staff-hours') || 'Staff Hours'}</Text>
              <View style={styles.table}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderCell, { flex: 1.2 }]}>{t('admin.col-staff') || 'Staff'}</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 0.5, textAlign: 'right' }]}>{t('admin.col-shifts') || 'Shifts'}</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 0.8, textAlign: 'right' }]}>{t('admin.col-total-hours') || 'Hours'}</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 0.8, textAlign: 'right' }]}>{t('admin.col-avg-shift') || 'Avg Shift'}</Text>
                </View>
                {staffHours.map((s, idx) => {
                  const totalMin = parseFloat(String(s.total_minutes || 0)) || 0;
                  const totalHours = (totalMin / 60).toFixed(1);
                  const avgShift = s.shift_count > 0 ? (totalMin / s.shift_count / 60).toFixed(1) : '—';
                  return (
                    <View key={s.staff_name || idx} style={styles.tableRow}>
                      <View style={{ flex: 1.2 }}>
                        <Text style={{ fontSize: 13, fontWeight: '500', color: '#1f2937' }}>{s.staff_name}</Text>
                        {s.role ? <Text style={{ fontSize: 11, color: '#6b7280', textTransform: 'capitalize' }}>{s.role}</Text> : null}
                      </View>
                      <Text style={[styles.tableCell, { flex: 0.5, textAlign: 'right', color: '#667eea', fontWeight: '600' }]}>{s.shift_count}</Text>
                      <Text style={[styles.tableCell, { flex: 0.8, textAlign: 'right', color: '#059669', fontWeight: '600' }]}>{totalHours} hrs</Text>
                      <Text style={[styles.tableCell, { flex: 0.8, textAlign: 'right', color: '#6b7280' }]}>{avgShift} hrs</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Sales by Category */}
          {salesByCategory.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('admin.report-sales-by-category') || 'Sales by Category'}</Text>
              {(() => {
                const totalRev = salesByCategory.reduce((sum, c) => sum + (parseInt(String(c.total_revenue_cents || 0), 10) || 0), 0);
                const colors = ['#667eea', '#e67e22', '#059669', '#dc2626', '#8b5cf6', '#06b6d4', '#f59e0b', '#ec4899'];
                return (
                  <>
                    <View style={styles.table}>
                      <View style={styles.tableHeader}>
                        <Text style={[styles.tableHeaderCell, { flex: 1.2 }]}>{t('admin.col-category') || 'Category'}</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 0.6, textAlign: 'right' }]}>{t('admin.col-items-sold') || 'Items'}</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 0.6, textAlign: 'right' }]}>{t('admin.col-orders') || 'Orders'}</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 0.9, textAlign: 'right' }]}>{t('admin.col-revenue') || 'Revenue'}</Text>
                        <Text style={[styles.tableHeaderCell, { flex: 0.5, textAlign: 'right' }]}>%</Text>
                      </View>
                      {salesByCategory.map((cat, idx) => {
                        const rev = parseInt(String(cat.total_revenue_cents || 0), 10) || 0;
                        const pct = totalRev > 0 ? ((rev / totalRev) * 100).toFixed(1) : '0.0';
                        return (
                          <View key={cat.category_name || idx} style={styles.tableRow}>
                            <Text style={[styles.tableCell, { flex: 1.2, fontWeight: '500', color: '#1f2937' }]}>{cat.category_name || 'Uncategorized'}</Text>
                            <Text style={[styles.tableCell, { flex: 0.6, textAlign: 'right', color: '#667eea', fontWeight: '600' }]}>{parseInt(String(cat.total_qty || 0), 10) || 0}</Text>
                            <Text style={[styles.tableCell, { flex: 0.6, textAlign: 'right', color: '#6b7280' }]}>{parseInt(String(cat.order_count || 0), 10) || 0}</Text>
                            <Text style={[styles.tableCell, { flex: 0.9, textAlign: 'right', color: '#059669', fontWeight: '600' }]}>{formatPrice(rev)}</Text>
                            <Text style={[styles.tableCell, { flex: 0.5, textAlign: 'right', color: '#6b7280' }]}>{pct}%</Text>
                          </View>
                        );
                      })}
                    </View>
                    {/* Proportion bar */}
                    <View style={{ flexDirection: 'row', height: 20, borderRadius: 6, overflow: 'hidden', marginTop: 14 }}>
                      {salesByCategory.map((cat, idx) => {
                        const rev = parseInt(String(cat.total_revenue_cents || 0), 10) || 0;
                        const pct = totalRev > 0 ? (rev / totalRev) * 100 : 0;
                        if (pct < 0.5) return null;
                        return <View key={idx} style={{ flex: pct, backgroundColor: colors[idx % colors.length] }} />;
                      })}
                    </View>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 }}>
                      {salesByCategory.map((cat, idx) => {
                        const rev = parseInt(String(cat.total_revenue_cents || 0), 10) || 0;
                        const pct = totalRev > 0 ? (rev / totalRev) * 100 : 0;
                        if (pct < 0.5) return null;
                        return (
                          <View key={idx} style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: colors[idx % colors.length], marginRight: 4 }} />
                            <Text style={{ fontSize: 11, color: '#374151' }}>{cat.category_name}</Text>
                          </View>
                        );
                      })}
                    </View>
                  </>
                );
              })()}
            </View>
          )}

          {/* Sales by Item */}
          {salesByItem.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('admin.report-sales-by-item') || 'Sales by Item'}</Text>
              <View style={styles.table}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderCell, { flex: 1.4 }]}>{t('admin.col-item') || 'Item'}</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 0.7, textAlign: 'right' }]}>{t('admin.col-qty-sold') || 'Qty'}</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 0.6, textAlign: 'right' }]}>{t('admin.col-orders') || 'Orders'}</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'right' }]}>{t('admin.col-revenue') || 'Revenue'}</Text>
                </View>
                {salesByItem.slice(0, 20).map((item, idx) => {
                  const rev = parseInt(String(item.total_revenue_cents || 0), 10) || 0;
                  return (
                    <View key={item.item_name || idx} style={styles.tableRow}>
                      <View style={{ flex: 1.4 }}>
                        <Text style={{ fontSize: 13, fontWeight: '500', color: '#1f2937' }}>{item.item_name || 'Unknown'}</Text>
                        {item.category_name ? <Text style={{ fontSize: 11, color: '#6b7280' }}>{item.category_name}</Text> : null}
                      </View>
                      <Text style={[styles.tableCell, { flex: 0.7, textAlign: 'right', color: '#667eea', fontWeight: '600' }]}>{item.total_qty}</Text>
                      <Text style={[styles.tableCell, { flex: 0.6, textAlign: 'right', color: '#6b7280' }]}>{parseInt(String(item.order_count || 0), 10) || 0}</Text>
                      <Text style={[styles.tableCell, { flex: 1, textAlign: 'right', color: '#059669', fontWeight: '600' }]}>{formatPrice(rev)}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Revenue Trends */}
          <View style={styles.section}>
            <View style={styles.trendHeader}>
              <Text style={styles.sectionTitle}>{t('admin.report-revenue-trends') || 'Revenue Trends'}</Text>
              <TouchableOpacity onPress={() => setShowTrendModal(true)} style={styles.trendBtn}>
                <Text style={styles.trendBtnText}>{trendMode.toUpperCase()}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, { flex: 1.0 }]}>{t('admin.period') || 'Period'}</Text>
                <Text style={[styles.tableHeaderCell, { flex: 0.5, textAlign: 'right' }]}>{t('admin.col-orders') || 'Orders'}</Text>
                <Text style={[styles.tableHeaderCell, { flex: 0.5, textAlign: 'right' }]}>{t('admin.col-customers') || 'Cust.'}</Text>
                <Text style={[styles.tableHeaderCell, { flex: 0.8, textAlign: 'right' }]}>{t('admin.col-revenue') || 'Revenue'}</Text>
                <Text style={[styles.tableHeaderCell, { flex: 0.7, textAlign: 'right' }]}>{t('admin.col-discount') || 'Disc.'}</Text>
                <Text style={[styles.tableHeaderCell, { flex: 0.8, textAlign: 'right' }]}>{t('admin.col-net-sales') || 'Net'}</Text>
              </View>
              <FlatList
                data={dailyTrends}
                renderItem={({ item }) => (
                  <View style={styles.tableRow}>
                    <Text style={[styles.tableCell, { flex: 1.0 }]} numberOfLines={1}>{item.period}</Text>
                    <Text style={[styles.tableCell, { flex: 0.5, textAlign: 'right' }]}>{item.orders}</Text>
                    <Text style={[styles.tableCell, { flex: 0.5, textAlign: 'right' }]}>{item.customers}</Text>
                    <Text style={[styles.tableCell, { flex: 0.8, textAlign: 'right', color: '#059669' }]}>{formatPrice(item.revenue)}</Text>
                    <Text style={[styles.tableCell, { flex: 0.7, textAlign: 'right', color: '#dc2626' }]}>
                      {item.discount > 0 ? `-${formatPrice(item.discount)}` : '$0.00'}
                    </Text>
                    <Text style={[styles.tableCell, { flex: 0.8, textAlign: 'right', fontWeight: '600' }]}>{formatPrice(item.netSales)}</Text>
                  </View>
                )}
                keyExtractor={(item) => item.period}
                scrollEnabled={false}
              />
            </View>
          </View>

          {/* Bookings Analytics */}
          {bookingsTotal > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('admin.report-bookings') || 'Bookings Analytics'}</Text>

              {/* Summary stats */}
              <View style={styles.metricsGrid}>
                <View style={[styles.metricCard, { borderLeftColor: '#e67e22' }]}>
                  <Text style={styles.metricLabel}>{t('admin.bookings-total-pax') || 'Total Guests'}</Text>
                  <Text style={styles.metricValue}>{bookingsTotalPax}</Text>
                </View>
                <View style={[styles.metricCard, { borderLeftColor: '#e67e22' }]}>
                  <Text style={styles.metricLabel}>{t('admin.bookings-avg-pax') || 'Avg Party Size'}</Text>
                  <Text style={styles.metricValue}>{bookingsAvgPax}</Text>
                </View>
                <View style={[styles.metricCard, { borderLeftColor: '#059669' }]}>
                  <Text style={styles.metricLabel}>{t('admin.bookings-completion') || 'Completion Rate'}</Text>
                  <Text style={[styles.metricValue, { color: '#059669' }]}>{bookingsCompletionRate}%</Text>
                </View>
                <View style={[styles.metricCard, { borderLeftColor: '#dc2626' }]}>
                  <Text style={styles.metricLabel}>{t('admin.bookings-cancelled') || 'Cancelled'}</Text>
                  <Text style={[styles.metricValue, { color: '#dc2626' }]}>{bookingsCancelled}</Text>
                </View>
              </View>

              {/* Trend table with toggle */}
              <View style={styles.trendHeader}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151' }}>{t('admin.booking-trend') || 'Booking Trend'}</Text>
                <TouchableOpacity onPress={() => setShowBookingsTrendModal(true)} style={[styles.trendBtn, { backgroundColor: '#e67e22' }]}>
                  <Text style={styles.trendBtnText}>{bookingsTrendMode.toUpperCase()}</Text>
                </TouchableOpacity>
              </View>
              {bookingTrends.length > 0 ? (
                <View style={[styles.table, { marginBottom: 16 }]}>
                  <View style={[styles.tableHeader, { backgroundColor: '#fffbf5' }]}>
                    <Text style={[styles.tableHeaderCell, { flex: 1.1 }]}>{t('admin.col-period') || 'Period'}</Text>
                    <Text style={[styles.tableHeaderCell, { flex: 0.7, textAlign: 'right', color: '#e67e22' }]}>{t('admin.col-bookings') || 'Bookings'}</Text>
                    <Text style={[styles.tableHeaderCell, { flex: 0.8, textAlign: 'right', color: '#059669' }]}>{t('admin.bookings-confirmed') || 'Confirmed'}</Text>
                    <Text style={[styles.tableHeaderCell, { flex: 0.8, textAlign: 'right', color: '#dc2626' }]}>{t('admin.bookings-cancelled') || 'Cancelled'}</Text>
                    <Text style={[styles.tableHeaderCell, { flex: 0.6, textAlign: 'right' }]}>{t('admin.bookings-total-pax') || 'Guests'}</Text>
                  </View>
                  {bookingTrends.map((e, idx) => (
                    <View key={idx} style={styles.tableRow}>
                      <Text style={[styles.tableCell, { flex: 1.1, fontWeight: '500', color: '#1f2937' }]} numberOfLines={1}>{e.label}</Text>
                      <Text style={[styles.tableCell, { flex: 0.7, textAlign: 'right', color: '#e67e22', fontWeight: '600' }]}>{e.total}</Text>
                      <Text style={[styles.tableCell, { flex: 0.8, textAlign: 'right', color: '#059669', fontWeight: '600' }]}>{e.confirmed}</Text>
                      <Text style={[styles.tableCell, { flex: 0.8, textAlign: 'right', color: '#dc2626', fontWeight: '600' }]}>{e.cancelled}</Text>
                      <Text style={[styles.tableCell, { flex: 0.6, textAlign: 'right', color: '#6b7280' }]}>{e.pax}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {/* Peak Booking Hours bar chart + Most Booked Tables side by side */}
              <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 }}>{t('admin.bookings-peak-hours') || 'Peak Booking Hours'}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 100, gap: 2 }}>
                    {bookingsPeakHours.map((cnt, h) => {
                      const barH = bookingsPeakMax > 0 ? Math.max(Math.round((cnt / bookingsPeakMax) * 88), cnt > 0 ? 4 : 0) : 0;
                      return (
                        <View key={h} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end' }}>
                          <View style={{ width: '100%', height: barH, backgroundColor: '#e67e22', borderRadius: 2, opacity: cnt > 0 ? 1 : 0.15 }} />
                          {h % 6 === 0 ? <Text style={{ fontSize: 8, color: '#999', marginTop: 2 }}>{String(h).padStart(2, '0')}</Text> : null}
                        </View>
                      );
                    })}
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 }}>{t('admin.bookings-top-tables') || 'Most Booked Tables'}</Text>
                  {bookingsTopTables.map((t2, idx) => {
                    const maxC = bookingsTopTables[0]?.count || 1;
                    const pct = (t2.count / maxC) * 100;
                    return (
                      <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        <Text style={{ width: 48, fontSize: 11, fontWeight: '600', color: '#374151' }} numberOfLines={1}>{t2.name}</Text>
                        <View style={{ flex: 1, backgroundColor: '#f3f4f6', height: 16, borderRadius: 4, overflow: 'hidden' }}>
                          <View style={{ backgroundColor: '#e67e22', height: '100%', width: `${pct}%`, borderRadius: 4 }} />
                        </View>
                        <Text style={{ width: 22, fontSize: 11, fontWeight: '700', color: '#e67e22', textAlign: 'right' }}>{t2.count}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>

              {/* Booking Status Bar */}
              {(() => {
                const confirmedPct = bookingsTotal > 0 ? Math.round((bookingsConfirmed / bookingsTotal) * 100) : 0;
                const cancelledPct = bookingsTotal > 0 ? Math.round((bookingsCancelled / bookingsTotal) * 100) : 0;
                return (
                  <View>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 }}>{t('admin.bookings-status') || 'Booking Status Breakdown'}</Text>
                    <View style={{ flexDirection: 'row', height: 24, borderRadius: 6, overflow: 'hidden', marginBottom: 8 }}>
                      <View style={{ flex: confirmedPct, backgroundColor: '#059669' }} />
                      <View style={{ flex: cancelledPct, backgroundColor: '#dc2626' }} />
                      <View style={{ flex: Math.max(100 - confirmedPct - cancelledPct, 0), backgroundColor: '#e5e7eb' }} />
                    </View>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: '#059669', marginRight: 4 }} />
                        <Text style={{ fontSize: 12, color: '#374151' }}>{t('admin.bookings-confirmed') || 'Confirmed'}: {bookingsConfirmed} ({confirmedPct}%)</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: '#dc2626', marginRight: 4 }} />
                        <Text style={{ fontSize: 12, color: '#374151' }}>{t('admin.bookings-cancelled') || 'Cancelled'}: {bookingsCancelled} ({cancelledPct}%)</Text>
                      </View>
                    </View>
                  </View>
                );
              })()}
            </View>
          )}
        </View>
      )}

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={fetchReports} style={styles.retryBtn}>
            <Text style={styles.retryBtnText}>{t('common.retry') || 'Retry'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Trend Mode Modal */}
      <Modal supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']} visible={showTrendModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('admin.select-trend-view') || 'Select Trend View'}</Text>
            {(['daily', 'weekly', 'monthly'] as const).map((mode) => (
              <TouchableOpacity
                key={mode}
                style={[styles.trendOption, trendMode === mode && styles.trendOptionActive]}
                onPress={() => { setTrendMode(mode); setShowTrendModal(false); }}
              >
                <Text style={[styles.trendOptionText, trendMode === mode && styles.trendOptionTextActive]}>
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={[styles.trendOption, { backgroundColor: '#e5e7eb', marginTop: 12 }]} onPress={() => setShowTrendModal(false)}>
              <Text style={styles.trendOptionText}>{t('common.close') || 'Close'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Bookings Trend Mode Modal */}
      <Modal supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']} visible={showBookingsTrendModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('admin.select-trend-view') || 'Select Trend View'}</Text>
            {(['daily', 'weekly', 'monthly'] as const).map((mode) => (
              <TouchableOpacity
                key={mode}
                style={[styles.trendOption, bookingsTrendMode === mode && styles.trendOptionActive]}
                onPress={() => { setBookingsTrendMode(mode); setShowBookingsTrendModal(false); }}
              >
                <Text style={[styles.trendOptionText, bookingsTrendMode === mode && styles.trendOptionTextActive]}>
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={[styles.trendOption, { backgroundColor: '#e5e7eb', marginTop: 12 }]} onPress={() => setShowBookingsTrendModal(false)}>
              <Text style={styles.trendOptionText}>{t('common.close') || 'Close'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Date Range Modal */}
      <Modal supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']} visible={showDateRangeModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('admin.select-date-range-modal') || 'Select Date Range'}</Text>
            {(['today', '7days', '30days', 'all'] as DateRange[]).map((range) => (
              <TouchableOpacity
                key={range}
                style={[styles.trendOption, dateRange === range && styles.trendOptionActive]}
                onPress={() => { setDateRange(range); setShowDateRangeModal(false); }}
              >
                <Text style={[styles.trendOptionText, dateRange === range && styles.trendOptionTextActive]}>
                  {dateRangeLabels[range]}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={[styles.trendOption, { backgroundColor: '#e5e7eb', marginTop: 12 }]} onPress={() => setShowDateRangeModal(false)}>
              <Text style={styles.trendOptionText}>{t('common.close') || 'Close'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Revenue Filter Modals */}
      {renderFilterModal(showCategoryFilter, t('admin.filter-by-category') || 'Filter by Category', revenueCategoryOptions, revenueFilterCategory, setRevenueFilterCategory, () => setShowCategoryFilter(false))}
      {renderFilterModal(showStaffFilter, t('admin.filter-by-staff') || 'Filter by Staff', revenueStaffOptions, revenueFilterStaff, setRevenueFilterStaff, () => setShowStaffFilter(false))}
      {renderFilterModal(showTableFilter, t('admin.filter-by-table') || 'Filter by Table', revenueTableOptions, revenueFilterTable, setRevenueFilterTable, () => setShowTableFilter(false))}
      {renderFilterModal(showProductFilter, t('admin.filter-by-product') || 'Filter by Product', revenueProductOptions, revenueFilterProduct, setRevenueFilterProduct, () => setShowProductFilter(false))}
    </ScrollView>
  );
};
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 16,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
    gap: 8,
  },
  metricCard: {
    width: METRIC_CARD_WIDTH,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 8,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
  },
  metricLabel: {
    fontSize: 9,
    color: '#6b7280',
    fontWeight: '500',
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 12,
  },
  table: {
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  tableHeaderCell: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600',
    flex: 1,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  tableCell: {
    fontSize: 12,
    color: '#374151',
  },
  cardsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  card: {
    width: '47%',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
  },
  cardRank: {
    fontSize: 9,
    color: '#9ca3af',
    fontWeight: '600',
  },
  cardDate: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1f2937',
    marginTop: 2,
  },
  cardRevenue: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#059669',
    marginTop: 2,
  },
  cardOrders: {
    fontSize: 10,
    color: '#6b7280',
    marginTop: 2,
  },
  trendHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  trendBtn: {
    backgroundColor: '#3b82f6',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
  },
  trendBtnText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  statusItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  statusLabel: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '500',
  },
  statusValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#3b82f6',
  },
  errorContainer: {
    backgroundColor: '#fee',
    margin: 12,
    padding: 12,
    borderRadius: 8,
  },
  errorText: {
    color: '#c33',
    fontSize: 13,
    marginBottom: 8,
  },
  retryBtn: {
    backgroundColor: '#c33',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 4,
    alignItems: 'center',
  },
  retryBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: 24,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#1f2937',
  },
  trendOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    backgroundColor: '#f3f4f6',
    marginBottom: 8,
  },
  trendOptionActive: {
    backgroundColor: '#3b82f6',
  },
  trendOptionText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
    textAlign: 'center',
  },
  trendOptionTextActive: {
    color: '#fff',
  },
  // Date range button
  reportHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  dateRangeBtn: {
    backgroundColor: '#3b82f6',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  dateRangeBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  exportBtn: {
    backgroundColor: '#059669',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  exportBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  filterChipActive: {
    backgroundColor: '#4a90e2',
    borderColor: '#4a90e2',
  },
  filterChipText: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#fff',
  },
  // Top items
  topItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  topItemRank: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  topItemRankText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  topItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  topItemSub: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  // Busiest tables bar chart
  tableBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 8,
  },
  tableBarLabel: {
    width: 70,
    fontSize: 12,
    color: '#374151',
    fontWeight: '500',
  },
  tableBarContainer: {
    flex: 1,
    height: 20,
    backgroundColor: '#f3f4f6',
    borderRadius: 4,
    overflow: 'hidden',
  },
  tableBar: {
    height: '100%',
    backgroundColor: '#3b82f6',
    borderRadius: 4,
    minWidth: 4,
  },
  tableBarValue: {
    width: 100,
    fontSize: 11,
    color: '#6b7280',
    textAlign: 'right',
  },
  // Hourly bar chart
  hourlyChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 160,
    paddingTop: 20,
  },
  hourlyBarCol: {
    alignItems: 'center',
    width: 28,
    marginHorizontal: 2,
  },
  hourlyBar: {
    width: 20,
    backgroundColor: '#3b82f6',
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    minHeight: 0,
  },
  hourlyBarLabel: {
    fontSize: 9,
    color: '#9ca3af',
    marginTop: 4,
  },
  hourlyBarValue: {
    fontSize: 9,
    color: '#6b7280',
    marginBottom: 2,
  },
});
