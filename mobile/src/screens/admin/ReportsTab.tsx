import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, RefreshControl } from 'react-native';
import { apiClient } from '../../services/apiClient';

interface ReportData {
  total_orders: number;
  total_revenue_cents: number;
  completed_orders: number;
  pending_orders: number;
  today_revenue_cents?: number;
  week_revenue_cents?: number;
  most_ordered_item?: string;
  average_order_value_cents?: number;
}

export const ReportsTab = ({ restaurantId }: { restaurantId: string }) => {
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchReports = async () => {
    try {
      setError(null);
      // For now, we'll use the orders endpoint to calculate statistics
      // In the future, a dedicated reports endpoint would be ideal
      const response = await apiClient.get<any>(`/api/restaurants/${restaurantId}/orders`);
      
      const orders = response.data.orders || [];
      const completed = orders.filter((o: any) => o.status === 'completed');
      const pending = orders.filter((o: any) => o.status !== 'completed');
      
      const totalRevenue = orders.reduce((sum: number, o: any) => sum + (o.total_cents || 0), 0);
      const avgOrder = orders.length > 0 ? totalRevenue / orders.length : 0;
      
      setReportData({
        total_orders: orders.length,
        total_revenue_cents: totalRevenue,
        completed_orders: completed.length,
        pending_orders: pending.length,
        average_order_value_cents: avgOrder,
      });
    } catch (err: any) {
      console.error('Error fetching reports:', err);
      setError(err.message || 'Failed to load reports');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [restaurantId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchReports();
  };

  const formatCurrency = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {reportData && (
        <View style={styles.content}>
          <View style={styles.metricsGrid}>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Total Orders</Text>
              <Text style={styles.metricValue}>{reportData.total_orders}</Text>
            </View>
            
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Completed</Text>
              <Text style={[styles.metricValue, { color: '#10b981' }]}>{reportData.completed_orders}</Text>
            </View>
            
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Pending</Text>
              <Text style={[styles.metricValue, { color: '#f59e0b' }]}>{reportData.pending_orders}</Text>
            </View>
            
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Total Revenue</Text>
              <Text style={[styles.metricValue, { color: '#059669' }]}>
                {formatCurrency(reportData.total_revenue_cents)}
              </Text>
            </View>
            
            {reportData.average_order_value_cents !== undefined && (
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Avg Order Value</Text>
                <Text style={styles.metricValue}>
                  {formatCurrency(reportData.average_order_value_cents)}
                </Text>
              </View>
            )}
            
            {reportData.today_revenue_cents !== undefined && (
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Today's Revenue</Text>
                <Text style={[styles.metricValue, { color: '#059669' }]}>
                  {formatCurrency(reportData.today_revenue_cents)}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Performance Summary</Text>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Completion Rate</Text>
              <Text style={styles.summaryValue}>
                {reportData.total_orders > 0 
                  ? `${((reportData.completed_orders / reportData.total_orders) * 100).toFixed(1)}%`
                  : 'N/A'
                }
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Total Transactions</Text>
              <Text style={styles.summaryValue}>{reportData.total_orders}</Text>
            </View>
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
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
    marginBottom: 20,
    gap: 10,
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
  },
  metricLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
    marginBottom: 8,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 12,
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 16,
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
});
