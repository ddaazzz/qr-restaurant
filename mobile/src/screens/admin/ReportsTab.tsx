import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { apiClient } from '../../services/apiClient';

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

export const ReportsTab = ({ restaurantId }: { restaurantId: string }) => {
  const [stats, setStats] = useState<AnalyticsStats | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [trendMode, setTrendMode] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [showTrendModal, setShowTrendModal] = useState(false);

  const fetchReports = async () => {
    try {
      setError(null);
      const response = await apiClient.get(`/api/restaurants/${restaurantId}/orders?limit=1000`);

      const allOrders = response.data || [];
      setOrders(allOrders);

      if (allOrders.length > 0) {
        const calculatedStats = calculateAnalyticsStats(allOrders);
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
  }, [restaurantId]);

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

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {stats && (
        <View style={styles.content}>
          {/* Key Metrics */}
          <View style={styles.metricsGrid}>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Total Orders</Text>
              <Text style={styles.metricValue}>{stats.total_orders}</Text>
            </View>

            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Total Revenue</Text>
              <Text style={styles.metricValue}>{formatPrice(stats.total_revenue)}</Text>
            </View>

            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Avg Bill</Text>
              <Text style={styles.metricValue}>{formatPrice(stats.average_bill)}</Text>
            </View>

            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Active Sessions</Text>
              <Text style={styles.metricValue}>{stats.active_sessions}</Text>
            </View>
          </View>

          {/* Revenue Report */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📊 Revenue Report</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableCell, { flex: 1 }]}>Date</Text>
                <Text style={[styles.tableCell, { flex: 0.8 }]}>Orders</Text>
                <Text style={[styles.tableCell, { flex: 1 }]}>Revenue</Text>
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

          {/* Busiest Tables (Daily Activity) */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📈 Daily Activity</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableCell, { flex: 1 }]}>Date</Text>
                <Text style={[styles.tableCell, { flex: 0.8 }]}>Orders</Text>
                <Text style={[styles.tableCell, { flex: 1 }]}>Revenue</Text>
              </View>
              <FlatList
                data={Object.entries(stats.revenue_by_day)
                  .sort(([a], [b]) => b.localeCompare(a))
                  .slice(0, 7)}
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

          {/* Hourly Revenue */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🕐 Hourly Revenue</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableCell, { flex: 1 }]}>Hour</Text>
                <Text style={[styles.tableCell, { flex: 0.8 }]}>Orders</Text>
                <Text style={[styles.tableCell, { flex: 1 }]}>Revenue</Text>
              </View>
              <FlatList
                data={Array.from({ length: 24 }, (_, i) => {
                  const hour = String(i).padStart(2, '0');
                  const hourKey = `${hour}:00`;
                  return {
                    hour: hourKey,
                    orders: stats.orders_by_hour[hourKey] || 0,
                    revenue: stats.revenue_by_hour[hourKey] || 0,
                  };
                }).filter((h) => h.orders > 0)}
                renderItem={({ item }) => (
                  <View style={styles.tableRow}>
                    <Text style={[styles.tableCell, { flex: 1 }]}>{item.hour}</Text>
                    <Text style={[styles.tableCell, { flex: 0.8 }]}>{item.orders}</Text>
                    <Text style={[styles.tableCell, { flex: 1 }]}>{formatPrice(item.revenue)}</Text>
                  </View>
                )}
                keyExtractor={(item) => item.hour}
                scrollEnabled={false}
              />
            </View>
          </View>

          {/* Top Revenue Days */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🏆 Top Revenue Days</Text>
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
                      {stats.daily_order_counts[date] || 0} orders
                    </Text>
                  </View>
                ))}
            </View>
          </View>

          {/* Daily Trends */}
          <View style={styles.section}>
            <View style={styles.trendHeader}>
              <Text style={styles.sectionTitle}>📅 Daily Trends</Text>
              <TouchableOpacity onPress={() => setShowTrendModal(true)} style={styles.trendBtn}>
                <Text style={styles.trendBtnText}>{trendMode.toUpperCase()}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableCell, { flex: 1.2 }]}>Period</Text>
                <Text style={[styles.tableCell, { flex: 0.7 }]}>Orders</Text>
                <Text style={[styles.tableCell, { flex: 1 }]}>Revenue</Text>
                <Text style={[styles.tableCell, { flex: 0.8 }]}>Avg Bill</Text>
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
            <Text style={styles.sectionTitle}>💭 Order Status</Text>
            {Object.entries(stats.order_count_by_status).map(([status, count]) => (
              <View key={status} style={styles.statusItem}>
                <Text style={styles.statusLabel}>
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </Text>
                <Text style={styles.statusValue}>{count}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={fetchReports} style={styles.retryBtn}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Trend Mode Modal */}
      <Modal visible={showTrendModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Trend View</Text>

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
              <Text style={styles.trendOptionText}>Close</Text>
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
});
