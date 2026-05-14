import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Modal,
  TouchableWithoutFeedback,
} from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';
import { apiClient } from '../../services/apiClient';
import { useToast } from '../../components/ToastProvider';

type FilterType = 'active' | 'ready' | 'all';
type TimeRangeType = 'today' | 'yesterday' | 'week' | 'month' | 'all';

interface OrderItem {
  id: number;
  menu_item_name: string;
  quantity: number;
  item_total_cents: number;
  variants?: string;
  addons?: Array<{ menu_item_name: string; quantity: number }>;
}

interface ToGoOrder {
  id: number;
  restaurant_order_number?: number;
  session_id?: number;
  order_type: string;
  total_cents: number;
  created_at: string;
  pickup_ready_at?: string | null;
  session_ended_at?: string | null;
  customer_name?: string;
  customer_phone?: string;
  item_count?: number;
  items?: OrderItem[];
  payment_status?: string;
  payment_received?: boolean;
  cp_status?: string;
}

interface Props {
  restaurantId: string;
}

export const ToGoTab: React.FC<Props> = ({ restaurantId }) => {
  const { showToast } = useToast();
  const [filter, setFilter] = useState<FilterType>('active');
  const [timeRange, setTimeRange] = useState<TimeRangeType>('today');
  const [showTimeRangeMenu, setShowTimeRangeMenu] = useState(false);
  const [orders, setOrders] = useState<ToGoOrder[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<ToGoOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [markingReady, setMarkingReady] = useState(false);
  const [settlingBill, setSettlingBill] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadOrders = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await apiClient.get(`/api/restaurants/${restaurantId}/orders?limit=100&order_type=to-go`);
      let data: ToGoOrder[] = Array.isArray(res.data) ? res.data : [];

      // Include both 'to-go' and 'counter' order types
      data = data.filter(o => o.order_type === 'to-go' || o.order_type === 'counter');

      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

      if (filter === 'active') {
        data = data.filter(o => !o.pickup_ready_at && !o.session_ended_at);
      } else if (filter === 'ready') {
        data = data.filter(o => !!o.pickup_ready_at);
      } else {
        if (timeRange === 'today') {
          data = data.filter(o => new Date(o.created_at).getTime() >= todayStart);
        } else if (timeRange === 'yesterday') {
          data = data.filter(o => new Date(o.created_at).getTime() >= todayStart - 86400000);
        } else if (timeRange === 'week') {
          data = data.filter(o => new Date(o.created_at).getTime() >= todayStart - 7 * 86400000);
        } else if (timeRange === 'month') {
          data = data.filter(o => new Date(o.created_at).getTime() >= todayStart - 30 * 86400000);
        }
        // 'all' = no date filter
      }

      setOrders(data);
    } catch {
      if (!silent) showToast('Failed to load orders', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [restaurantId, filter, timeRange]);

  const loadOrderDetail = useCallback(async (orderId: number) => {
    setDetailLoading(true);
    try {
      const res = await apiClient.get(`/api/restaurants/${restaurantId}/orders/${orderId}`);
      setSelectedOrder(res.data);
    } catch {
      showToast('Failed to load order details', 'error');
    } finally {
      setDetailLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // Auto-refresh every 15 seconds
  useEffect(() => {
    intervalRef.current = setInterval(() => loadOrders(true), 15000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [loadOrders]);

  const handleSelectOrder = (orderId: number) => {
    setSelectedOrderId(orderId);
    loadOrderDetail(orderId);
  };

  const handleMarkReady = async () => {
    if (!selectedOrderId) return;
    setMarkingReady(true);
    try {
      await apiClient.post(`/api/restaurants/${restaurantId}/orders/${selectedOrderId}/ready`);
      showToast('Order marked as ready!', 'success');
      await loadOrders(true);
      // Reload the detail
      loadOrderDetail(selectedOrderId);
    } catch {
      showToast('Failed to mark order ready', 'error');
    } finally {
      setMarkingReady(false);
    }
  };

  const handleSettleBill = async () => {
    if (!selectedOrder || !selectedOrder.session_id) return;
    setSettlingBill(true);
    try {
      const sessionId = selectedOrder.session_id;
      const items = selectedOrder.items ?? [];
      let subtotal = 0;
      items.forEach(i => { subtotal += i.item_total_cents ?? 0; });
      const total = selectedOrder.total_cents ?? subtotal;
      await apiClient.post(`/api/sessions/${sessionId}/close-bill`, {
        payment_method: 'cash',
        amount_paid: total,
        discount_applied: 0,
        service_charge: 0,
        notes: '',
        restaurantId,
      });
      showToast('Bill settled!', 'success');
      await loadOrders(true);
      loadOrderDetail(selectedOrder.id);
    } catch (err: any) {
      showToast(err?.response?.data?.error || 'Failed to settle bill', 'error');
    } finally {
      setSettlingBill(false);
    }
  };

  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderOrderRow = ({ item }: { item: ToGoOrder }) => {
    const isReady = !!item.pickup_ready_at;
    const isSelected = item.id === selectedOrderId;
    const isEatHere = item.order_type === 'counter';
    const customer = item.customer_name || item.customer_phone || '—';
    const itemCount = item.item_count ?? (item.items?.length ?? '?');
    const total = item.total_cents != null ? `$${(item.total_cents / 100).toFixed(2)}` : '—';

    return (
      <TouchableOpacity
        style={[styles.orderRow, isSelected && styles.orderRowSelected, isReady && styles.orderRowReady]}
        onPress={() => handleSelectOrder(item.id)}
        activeOpacity={0.7}
      >
        <View style={styles.orderRowTop}>
          <Text style={styles.orderNum}>
            #{item.restaurant_order_number ?? item.id}
          </Text>
        <View style={[styles.typeBadge, isEatHere ? styles.typeBadgeEatHere : styles.typeBadgeTakeaway]}>
            <Ionicons
              name={isEatHere ? 'restaurant-outline' : 'bag-outline'}
              size={9}
              color={isEatHere ? '#1d4ed8' : '#065f46'}
              style={{ marginRight: 3 }}
            />
            <Text style={[styles.typeBadgeText, isEatHere ? styles.typeBadgeTextEatHere : styles.typeBadgeTextTakeaway]}>
              {isEatHere ? 'Eat Here' : 'Takeaway'}
            </Text>
          </View>
          <View style={[styles.statusPill, isReady ? styles.statusPillReady : styles.statusPillPending]}>
            <Text style={[styles.statusPillText, isReady ? styles.statusPillTextReady : styles.statusPillTextPending]}>
              {isReady ? '✓ Ready' : 'Pending'}
            </Text>
          </View>
        </View>
        <Text style={styles.orderCustomer}>{customer}</Text>
        <Text style={styles.orderMeta}>
          {formatTime(item.created_at)} · {itemCount} item{itemCount !== 1 ? 's' : ''} · {total}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderDetail = () => {
    if (!selectedOrder) {
      return (
        <View style={styles.detailPlaceholder}>
          <Ionicons name="bag-handle-outline" size={48} color="#d1d5db" />
          <Text style={styles.detailPlaceholderText}>Select an order to view details</Text>
        </View>
      );
    }

    if (detailLoading) {
      return (
        <View style={styles.detailPlaceholder}>
          <ActivityIndicator size="large" color="#667eea" />
        </View>
      );
    }

    const order = selectedOrder;
    const isReady = !!order.pickup_ready_at;
    const isEatHere = order.order_type === 'counter';
    const isPaid = order.payment_received || order.cp_status === 'completed';
    const isVoided = order.cp_status === 'voided';
    const isRefunded = order.cp_status === 'refunded' || order.cp_status === 'partial_refund';

    let subtotal = 0;
    const items = order.items ?? [];
    items.forEach(i => { subtotal += i.item_total_cents ?? 0; });
    const total = order.total_cents ?? subtotal;

    const paymentStatus = isRefunded ? 'Refunded'
      : isVoided ? 'Voided'
      : isPaid ? 'Paid'
      : 'Unpaid';

    const paymentColor = isRefunded ? '#dc2626'
      : isVoided ? '#b45309'
      : isPaid ? '#065f46'
      : '#854d0e';

    const paymentBg = isRefunded ? '#fee2e2'
      : isVoided ? '#fef3c7'
      : isPaid ? '#d1fae5'
      : '#fef9c3';

    return (
      <ScrollView style={styles.detailScroll} contentContainerStyle={{ padding: 12 }}>
        {/* Header card */}
        <View style={styles.detailCard}>
          <View style={styles.detailHeaderRow}>
            <View>
              <Text style={styles.detailOrderNum}>#{order.restaurant_order_number ?? order.id}</Text>
              <View style={[styles.typeBadge, isEatHere ? styles.typeBadgeEatHere : styles.typeBadgeTakeaway, { marginTop: 4 }]}>
                <Ionicons
                  name={isEatHere ? 'restaurant-outline' : 'bag-outline'}
                  size={9}
                  color={isEatHere ? '#1d4ed8' : '#065f46'}
                  style={{ marginRight: 3 }}
                />
                <Text style={[styles.typeBadgeText, isEatHere ? styles.typeBadgeTextEatHere : styles.typeBadgeTextTakeaway]}>
                  {isEatHere ? 'Eat Here' : 'Takeaway'}
                </Text>
              </View>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.detailTotalLabel}>Total</Text>
              <Text style={styles.detailTotal}>${(total / 100).toFixed(2)}</Text>
            </View>
          </View>
          <View style={styles.detailGrid}>
            <View style={styles.detailGridItem}>
              <Text style={styles.detailGridLabel}>CUSTOMER</Text>
              <Text style={styles.detailGridValue}>{order.customer_name || '—'}</Text>
            </View>
            <View style={styles.detailGridItem}>
              <Text style={styles.detailGridLabel}>PHONE</Text>
              <Text style={styles.detailGridValue}>{order.customer_phone || '—'}</Text>
            </View>
            <View style={styles.detailGridItem}>
              <Text style={styles.detailGridLabel}>ORDERED</Text>
              <Text style={styles.detailGridValue}>{new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
            </View>
            <View style={styles.detailGridItem}>
              <Text style={styles.detailGridLabel}>PAYMENT</Text>
              <View style={[styles.payBadge, { backgroundColor: paymentBg }]}>
                <Text style={[styles.payBadgeText, { color: paymentColor }]}>{paymentStatus}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Items */}
        <View style={styles.detailCard}>
          <Text style={styles.detailSectionTitle}>Order Items</Text>
          {items.length === 0 ? (
            <Text style={styles.noItemsText}>No items</Text>
          ) : (
            items.map((item, idx) => (
              <View key={idx} style={styles.orderItem}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.orderItemName}>
                    {item.menu_item_name} <Text style={styles.orderItemQty}>×{item.quantity}</Text>
                  </Text>
                  {!!item.variants && (
                    <Text style={styles.orderItemVariant}>{item.variants}</Text>
                  )}
                  {item.addons?.map((a, ai) => (
                    <Text key={ai} style={styles.orderItemAddon}>+ {a.menu_item_name} ×{a.quantity}</Text>
                  ))}
                </View>
                <Text style={styles.orderItemPrice}>${((item.item_total_cents ?? 0) / 100).toFixed(2)}</Text>
              </View>
            ))
          )}
          <View style={styles.totalRow}>
            <Text style={styles.totalRowLabel}>Total</Text>
            <Text style={styles.totalRowValue}>${(total / 100).toFixed(2)}</Text>
          </View>
        </View>

        {/* Ready / action */}
        {isReady ? (
          <View style={styles.readyBanner}>
            <Ionicons name="checkmark-circle" size={22} color="#065f46" style={{ marginRight: 8 }} />
            <Text style={styles.readyBannerText}>Ready for Pickup</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.markReadyBtn, markingReady && { opacity: 0.6 }]}
            onPress={handleMarkReady}
            disabled={markingReady}
          >
            {markingReady ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="cafe-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.markReadyBtnText}>Mark as Ready for Pickup</Text>
              </>
            )}
          </TouchableOpacity>
        )}
        {/* Settle Bill */}
        {!isPaid && !isVoided && !isRefunded && (
          <TouchableOpacity
            style={[styles.settleBillBtn, settlingBill && { opacity: 0.6 }]}
            onPress={handleSettleBill}
            disabled={settlingBill}
          >
            {settlingBill ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="card-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.settleBillBtnText}>Settle Bill</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>
    );
  };

  const timeRangeLabels: Record<TimeRangeType, string> = {
    today: 'All Today',
    yesterday: 'Since Yesterday',
    week: 'Since 1 Week',
    month: 'Since 1 Month',
    all: 'All Time',
  };

  const emptyLabels: Record<FilterType, string> = {
    active: 'No active to-go orders',
    ready: 'No orders marked ready',
    all: 'No to-go orders today',
  };

  return (
    <View style={styles.container}>
      {/* Filter tabs */}
      <View style={styles.filterRow}>
        {(['active', 'ready'] as FilterType[]).map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
            onPress={() => { setFilter(f); setSelectedOrderId(null); setSelectedOrder(null); }}
          >
            {f === 'ready' && (
              <Ionicons name="checkmark" size={12} color={filter === f ? '#fff' : '#6b7280'} style={{ marginRight: 4 }} />
            )}
            <Text style={[styles.filterBtnText, filter === f && styles.filterBtnTextActive]}>
              {f === 'active' ? 'Active' : 'Ready'}
            </Text>
          </TouchableOpacity>
        ))}
        {/* All Today with time range dropdown */}
        <View style={{ flex: 1, position: 'relative' }}>
          <TouchableOpacity
            style={[styles.filterBtn, filter === 'all' && styles.filterBtnActive, { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }]}
            onPress={() => {
              setFilter('all');
              setSelectedOrderId(null);
              setSelectedOrder(null);
              setShowTimeRangeMenu(v => !v);
            }}
          >
            <Text style={[styles.filterBtnText, filter === 'all' && styles.filterBtnTextActive]} numberOfLines={1}>
              {timeRangeLabels[timeRange]}
            </Text>
            <Ionicons name="chevron-down" size={11} color={filter === 'all' ? '#fff' : '#6b7280'} />
          </TouchableOpacity>
          {showTimeRangeMenu && (
            <>
              <TouchableWithoutFeedback onPress={() => setShowTimeRangeMenu(false)}>
                <View style={StyleSheet.absoluteFillObject} />
              </TouchableWithoutFeedback>
              <View style={styles.timeRangeMenu}>
                {(Object.keys(timeRangeLabels) as TimeRangeType[]).map(r => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.timeRangeItem, timeRange === r && styles.timeRangeItemActive]}
                    onPress={() => {
                      setTimeRange(r);
                      setFilter('all');
                      setShowTimeRangeMenu(false);
                      setSelectedOrderId(null);
                      setSelectedOrder(null);
                    }}
                  >
                    <Text style={[styles.timeRangeItemText, timeRange === r && styles.timeRangeItemTextActive]}>
                      {timeRangeLabels[r]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
        </View>
      </View>

      <View style={styles.body}>
        {/* Order list */}
        <View style={styles.listPane}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#667eea" />
            </View>
          ) : orders.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="bag-outline" size={40} color="#d1d5db" />
              <Text style={styles.emptyText}>{emptyLabels[filter]}</Text>
            </View>
          ) : (
            <FlatList
              data={orders}
              keyExtractor={item => String(item.id)}
              renderItem={renderOrderRow}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => { setRefreshing(true); loadOrders(); }}
                  tintColor="#667eea"
                />
              }
              contentContainerStyle={{ padding: 8 }}
            />
          )}
        </View>

        {/* Detail pane */}
        <View style={styles.detailPane}>
          {renderDetail()}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  filterRow: {
    flexDirection: 'row',
    padding: 10,
    gap: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  filterBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  filterBtnActive: { backgroundColor: '#667eea' },
  filterBtnText: { fontSize: 13, fontWeight: '600', color: '#6b7280' },
  filterBtnTextActive: { color: '#fff' },

  body: { flex: 1, flexDirection: 'row' },
  listPane: { flex: 1, borderRightWidth: 1, borderRightColor: '#e5e7eb' },
  detailPane: { flex: 1 },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyText: { marginTop: 12, fontSize: 14, color: '#9ca3af', textAlign: 'center' },

  orderRow: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  orderRowSelected: { borderColor: '#667eea', backgroundColor: '#f0f0ff' },
  orderRowReady: { borderColor: '#6ee7b7', backgroundColor: '#f0fdf4' },
  orderRowTop: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' },
  orderNum: { fontSize: 16, fontWeight: '800', color: '#1f2937', marginRight: 4 },
  typeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  typeBadgeEatHere: { backgroundColor: '#dbeafe' },
  typeBadgeTakeaway: { backgroundColor: '#d1fae5' },
  typeBadgeText: { fontSize: 10, fontWeight: '700' },
  typeBadgeTextEatHere: { color: '#1d4ed8' },
  typeBadgeTextTakeaway: { color: '#065f46' },
  statusPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 'auto',
  },
  statusPillReady: { backgroundColor: '#d1fae5' },
  statusPillPending: { backgroundColor: '#fef9c3' },
  statusPillText: { fontSize: 10, fontWeight: '700' },
  statusPillTextReady: { color: '#065f46' },
  statusPillTextPending: { color: '#854d0e' },
  orderCustomer: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 2 },
  orderMeta: { fontSize: 12, color: '#9ca3af' },

  detailPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  detailPlaceholderText: { marginTop: 12, fontSize: 14, color: '#9ca3af', textAlign: 'center' },
  detailScroll: { flex: 1 },

  detailCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  detailHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  detailOrderNum: { fontSize: 26, fontWeight: '800', color: '#1f2937' },
  detailTotalLabel: { fontSize: 11, color: '#9ca3af', fontWeight: '600', textTransform: 'uppercase', marginBottom: 2 },
  detailTotal: { fontSize: 22, fontWeight: '800', color: '#667eea' },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 4 },
  detailGridItem: { width: '45%' },
  detailGridLabel: { fontSize: 11, color: '#9ca3af', fontWeight: '600', textTransform: 'uppercase', marginBottom: 2 },
  detailGridValue: { fontSize: 14, fontWeight: '600', color: '#1f2937' },
  payBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, alignSelf: 'flex-start' },
  payBadgeText: { fontSize: 12, fontWeight: '700' },

  detailSectionTitle: { fontSize: 14, fontWeight: '700', color: '#1f2937', marginBottom: 10 },
  noItemsText: { fontSize: 13, color: '#9ca3af' },
  orderItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 10,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#667eea',
  },
  orderItemName: { fontSize: 15, fontWeight: '700', color: '#1f2937' },
  orderItemQty: { color: '#6b7280', fontWeight: '400' },
  orderItemVariant: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  orderItemAddon: { fontSize: 12, color: '#667eea' },
  orderItemPrice: { fontSize: 15, fontWeight: '700', color: '#667eea', marginLeft: 12 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, paddingTop: 10, borderTopWidth: 2, borderTopColor: '#f3f4f6' },
  totalRowLabel: { fontSize: 16, fontWeight: '800', color: '#1f2937' },
  totalRowValue: { fontSize: 16, fontWeight: '800', color: '#1f2937' },

  readyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#d1fae5',
    borderWidth: 1,
    borderColor: '#6ee7b7',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
  },
  readyBannerText: { fontSize: 17, fontWeight: '800', color: '#065f46' },
  markReadyBtn: {
    backgroundColor: '#667eea',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  markReadyBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  settleBillBtn: {
    backgroundColor: '#10b981',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  settleBillBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  timeRangeMenu: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 100,
    minWidth: 140,
  },
  timeRangeItem: {
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  timeRangeItemActive: { backgroundColor: '#f0f0ff' },
  timeRangeItemText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  timeRangeItemTextActive: { color: '#667eea' },
});
