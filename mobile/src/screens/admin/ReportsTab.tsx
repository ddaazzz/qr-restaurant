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
} from 'react-native';
import { apiClient } from '../../services/apiClient';
import { useTranslation } from '../../contexts/TranslationContext';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface Order {
  id: number;
  total_cents: number;
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
  revenue_by_day: Record<string, number>;
  daily_order_counts: Record<string, number>;
  revenue_by_hour: Record<string, number>;
  orders_by_hour: Record<string, number>;
  order_count_by_status: Record<string, number>;
}

interface DailyTrend {
  period: string;
  orders: number;
  revenue: number;
  average_bill: number;
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [trendMode, setTrendMode] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [showTrendModal, setShowTrendModal] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>('30days');
  const [showDateRangeModal, setShowDateRangeModal] = useState(false);

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
      
      // Fetch orders + top items + top tables + sales breakdowns in parallel
      const [ordersRes, topItemsRes, topTablesRes, salesByCategoryRes, salesByItemRes] = await Promise.all([
        apiClient.get(`/api/restaurants/${restaurantId}/orders?limit=1000`),
        apiClient.get(`/api/restaurants/${restaurantId}/reports/top-items?days=${days}`).catch(() => ({ data: [] })),
        apiClient.get(`/api/restaurants/${restaurantId}/reports/top-tables?days=${days}`).catch(() => ({ data: [] })),
        apiClient.get(`/api/restaurants/${restaurantId}/reports/sales-by-category?days=${days}`).catch(() => ({ data: [] })),
        apiClient.get(`/api/restaurants/${restaurantId}/reports/sales-by-item?days=${days}`).catch(() => ({ data: [] })),
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

      setOrders(filteredOrders);
      setTopItems(topItemsRes.data || []);
      setTopTables(topTablesRes.data || []);
      setSalesByCategory(salesByCategoryRes.data || []);
      setSalesByItem(salesByItemRes.data || []);

      if (filteredOrders.length > 0) {
        const calculatedStats = calculateAnalyticsStats(filteredOrders);
        setStats(calculatedStats);
      } else {
        setStats({
          total_orders: 0,
          total_revenue: 0,
          average_bill: 0,
          active_sessions: 0,
          revenue_by_day: {},
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
      revenue_by_day: {},
      daily_order_counts: {},
      revenue_by_hour: {},
      orders_by_hour: {},
      order_count_by_status: {},
    };

    for (const order of allOrders) {
      const orderAmount = parseInt(order.total_cents?.toString() || '0', 10) || 0;
      stats.total_revenue += orderAmount;

      // Status breakdown
      const status = order.status || 'unknown';
      stats.order_count_by_status[status] = (stats.order_count_by_status[status] || 0) + 1;

      // Revenue by date
      const createdDate = new Date(order.created_at);
      const dateStr = createdDate.toISOString().split('T')[0];
      stats.revenue_by_day[dateStr] = (stats.revenue_by_day[dateStr] || 0) + orderAmount;
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

    const trends: Record<string, { orders: number; revenue: number }> = {};

    Object.entries(stats.revenue_by_day).forEach(([date, revenue]) => {
      let key = date;

      if (mode === 'weekly') {
        const d = new Date(date);
        const weekStart = new Date(d);
        weekStart.setDate(d.getDate() - d.getDay());
        key = `Week of ${weekStart.toISOString().split('T')[0]}`;
      } else if (mode === 'monthly') {
        key = date.substring(0, 7);
      }

      if (!trends[key]) {
        trends[key] = { orders: 0, revenue: 0 };
      }
      trends[key].revenue += revenue;
      trends[key].orders += stats.daily_order_counts[date] || 0;
    });

    return Object.entries(trends)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([period, { orders, revenue }]) => ({
        period,
        orders,
        revenue,
        average_bill: orders > 0 ? Math.round(revenue / orders) : 0,
      }));
  };

  useEffect(() => {
    fetchReports();
  }, [restaurantId, dateRange]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchReports();
  };

  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  const dailyTrends = getDailyTrends(trendMode);

  // Compute max hourly revenue for bar chart
  const maxHourlyRevenue = stats
    ? Math.max(...Object.values(stats.revenue_by_hour), 1)
    : 1;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {stats && (
        <View style={styles.content}>
          {/* Date Range Filter */}
          <TouchableOpacity
            style={styles.dateRangeBtn}
            onPress={() => setShowDateRangeModal(true)}
          >
            <Text style={styles.dateRangeBtnText}>
              {dateRangeLabels[dateRange]}
            </Text>
          </TouchableOpacity>

          {/* Key Metrics */}
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
              <Text style={styles.metricLabel}>{t('admin.average-bill') || 'Avg Bill'}</Text>
              <Text style={styles.metricValue}>{formatPrice(stats.average_bill)}</Text>
            </View>

            <View style={[styles.metricCard, { borderLeftColor: '#8b5cf6' }]}>
              <Text style={styles.metricLabel}>{t('admin.active-sessions') || 'Active Sessions'}</Text>
              <Text style={styles.metricValue}>{stats.active_sessions}</Text>
            </View>
          </View>

          {/* Revenue Report */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('admin.revenue-report') || 'Revenue'}</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableCell, { flex: 1 }]}>{t('admin.date') || 'Date'}</Text>
                <Text style={[styles.tableCell, { flex: 0.8 }]}>{t('admin.orders') || 'Orders'}</Text>
                <Text style={[styles.tableCell, { flex: 1 }]}>{t('admin.revenue') || 'Revenue'}</Text>
              </View>
              <FlatList
                data={Object.entries(stats.revenue_by_day)
                  .sort(([a], [b]) => b.localeCompare(a))
                  .slice(0, 10)}
                renderItem={({ item: [date, revenue] }) => (
                  <View style={styles.tableRow}>
                    <Text style={[styles.tableCell, { flex: 1 }]}>{date}</Text>
                    <Text style={[styles.tableCell, { flex: 0.8 }]}>
                      {stats.daily_order_counts[date] || 0}
                    </Text>
                    <Text style={[styles.tableCell, { flex: 1 }]}>{formatPrice(revenue)}</Text>
                  </View>
                )}
                keyExtractor={(item) => item[0]}
                scrollEnabled={false}
              />
            </View>
          </View>

          {/* Top Selling Items */}
          {topItems.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('admin.top-selling-items') || 'Top Selling Items'}</Text>
              {topItems.map((item, idx) => (
                <View key={idx} style={styles.topItemRow}>
                  <View style={styles.topItemRank}>
                    <Text style={styles.topItemRankText}>#{idx + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.topItemName}>{item.item_name}</Text>
                    <Text style={styles.topItemSub}>
                      {item.total_qty} {t('admin.sold') || 'sold'} · {formatPrice(item.total_revenue_cents)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Busiest Tables */}
          {topTables.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('admin.busiest-tables') || 'Busiest Tables'}</Text>
              {topTables.map((table, idx) => {
                const maxOrders = topTables[0]?.order_count || 1;
                const barWidth = (table.order_count / maxOrders) * 100;
                return (
                  <View key={idx} style={styles.tableBarRow}>
                    <Text style={styles.tableBarLabel}>{table.table_name}</Text>
                    <View style={styles.tableBarContainer}>
                      <View style={[styles.tableBar, { width: `${barWidth}%` }]} />
                    </View>
                    <Text style={styles.tableBarValue}>
                      {table.order_count} · {formatPrice(table.total_revenue_cents)}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}

          {/* Hourly Revenue (Bar Chart) */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('admin.hourly-revenue') || 'Hourly Revenue'}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.hourlyChart}>
                {Array.from({ length: 24 }, (_, i) => {
                  const hour = String(i).padStart(2, '0');
                  const hourKey = `${hour}:00`;
                  const revenue = stats.revenue_by_hour[hourKey] || 0;
                  const orders = stats.orders_by_hour[hourKey] || 0;
                  const barHeight = revenue > 0 ? Math.max((revenue / maxHourlyRevenue) * 120, 4) : 0;
                  return (
                    <View key={hourKey} style={styles.hourlyBarCol}>
                      <Text style={styles.hourlyBarValue}>
                        {orders > 0 ? orders : ''}
                      </Text>
                      <View style={[styles.hourlyBar, { height: barHeight }]} />
                      <Text style={styles.hourlyBarLabel}>{hour}</Text>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          </View>

          {/* Top Revenue Days */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('admin.top-revenue-days') || 'Top Revenue Days'}</Text>
            <View style={styles.cardsContainer}>
              {Object.entries(stats.revenue_by_day)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 5)
                .map(([date, revenue], idx) => (
                  <View key={date} style={styles.card}>
                    <Text style={styles.cardRank}>#{idx + 1}</Text>
                    <Text style={styles.cardDate}>{date}</Text>
                    <Text style={styles.cardRevenue}>{formatPrice(revenue)}</Text>
                    <Text style={styles.cardOrders}>
                      {stats.daily_order_counts[date] || 0} {t('admin.orders') || 'orders'}
                    </Text>
                  </View>
                ))}
            </View>
          </View>

          {/* Daily Trends */}
          <View style={styles.section}>
            <View style={styles.trendHeader}>
              <Text style={styles.sectionTitle}>{t('admin.daily-trends') || 'Trends'}</Text>
              <TouchableOpacity onPress={() => setShowTrendModal(true)} style={styles.trendBtn}>
                <Text style={styles.trendBtnText}>{trendMode.toUpperCase()}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableCell, { flex: 1.2 }]}>{t('admin.period') || 'Period'}</Text>
                <Text style={[styles.tableCell, { flex: 0.7 }]}>{t('admin.orders') || 'Orders'}</Text>
                <Text style={[styles.tableCell, { flex: 1 }]}>{t('admin.revenue') || 'Revenue'}</Text>
                <Text style={[styles.tableCell, { flex: 0.8 }]}>{t('admin.avg-bill') || 'Avg Bill'}</Text>
              </View>
              <FlatList
                data={dailyTrends}
                renderItem={({ item }) => (
                  <View style={styles.tableRow}>
                    <Text style={[styles.tableCell, { flex: 1.2 }]} numberOfLines={1}>
                      {item.period}
                    </Text>
                    <Text style={[styles.tableCell, { flex: 0.7 }]}>{item.orders}</Text>
                    <Text style={[styles.tableCell, { flex: 1 }]}>{formatPrice(item.revenue)}</Text>
                    <Text style={[styles.tableCell, { flex: 0.8 }]}>
                      {formatPrice(item.average_bill)}
                    </Text>
                  </View>
                )}
                keyExtractor={(item) => item.period}
                scrollEnabled={false}
              />
            </View>
          </View>

          {/* Order Status Breakdown */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('admin.order-status') || 'Order Status'}</Text>
            {Object.entries(stats.order_count_by_status).map(([status, count]) => (
              <View key={status} style={styles.statusItem}>
                <Text style={styles.statusLabel}>
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </Text>
                <Text style={styles.statusValue}>{count}</Text>
              </View>
            ))}
          </View>

          {/* Sales by Category */}
          {salesByCategory.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('admin.report-sales-by-category') || 'Sales by Category'}</Text>
              {(() => {
                const totalRev = salesByCategory.reduce((sum, c) => sum + (parseInt(c.total_revenue_cents?.toString() || '0', 10) || 0), 0);
                return salesByCategory.map((cat, idx) => {
                  const rev = parseInt(cat.total_revenue_cents?.toString() || '0', 10) || 0;
                  const pct = totalRev > 0 ? ((rev / totalRev) * 100).toFixed(1) : '0.0';
                  const colors = ['#667eea', '#e67e22', '#059669', '#dc2626', '#8b5cf6', '#06b6d4', '#f59e0b', '#ec4899'];
                  const color = colors[idx % colors.length];
                  return (
                    <View key={cat.category_name || idx} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' }}>
                      <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: color, marginRight: 8 }} />
                      <Text style={{ flex: 1, fontSize: 13, fontWeight: '500', color: '#1f2937' }}>{cat.category_name || 'Uncategorized'}</Text>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: '#059669', marginRight: 8 }}>${(rev / 100).toFixed(2)}</Text>
                      <Text style={{ fontSize: 12, color: '#6b7280', width: 45, textAlign: 'right' }}>{pct}%</Text>
                    </View>
                  );
                });
              })()}
            </View>
          )}

          {/* Sales by Item */}
          {salesByItem.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('admin.report-sales-by-item') || 'Sales by Item'}</Text>
              {salesByItem.slice(0, 20).map((item, idx) => {
                const rev = parseInt(item.total_revenue_cents?.toString() || '0', 10) || 0;
                return (
                  <View key={item.item_name || idx} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: '500', color: '#1f2937' }}>{item.item_name || 'Unknown'}</Text>
                      <Text style={{ fontSize: 11, color: '#6b7280' }}>{item.category_name || ''}</Text>
                    </View>
                    <Text style={{ fontSize: 12, color: '#667eea', fontWeight: '600', marginRight: 12 }}>{item.total_qty} sold</Text>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#059669' }}>${(rev / 100).toFixed(2)}</Text>
                  </View>
                );
              })}
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
                onPress={() => {
                  setTrendMode(mode);
                  setShowTrendModal(false);
                }}
              >
                <Text
                  style={[
                    styles.trendOptionText,
                    trendMode === mode && styles.trendOptionTextActive,
                  ]}
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={[styles.trendOption, { backgroundColor: '#e5e7eb', marginTop: 12 }]}
              onPress={() => setShowTrendModal(false)}
            >
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
                onPress={() => {
                  setDateRange(range);
                  setShowDateRangeModal(false);
                }}
              >
                <Text
                  style={[
                    styles.trendOptionText,
                    dateRange === range && styles.trendOptionTextActive,
                  ]}
                >
                  {dateRangeLabels[range]}
                </Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={[styles.trendOption, { backgroundColor: '#e5e7eb', marginTop: 12 }]}
              onPress={() => setShowDateRangeModal(false)}
            >
              <Text style={styles.trendOptionText}>{t('common.close') || 'Close'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    flex: 1,
    minWidth: '48%',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
  },
  metricLabel: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '500',
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 20,
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
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
  },
  cardRank: {
    fontSize: 10,
    color: '#9ca3af',
    fontWeight: '600',
  },
  cardDate: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
    marginTop: 4,
  },
  cardRevenue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#059669',
    marginTop: 4,
  },
  cardOrders: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 4,
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
  dateRangeBtn: {
    backgroundColor: '#3b82f6',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  dateRangeBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
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
