import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  TouchableWithoutFeedback,
  Dimensions,
} from 'react-native';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = (SCREEN_WIDTH - 8 * 3) / 2; // 2 cols with 8px margins and gap
import Ionicons from '@react-native-vector-icons/ionicons';
import * as Print from 'expo-print';
import { Buffer } from 'buffer';
import { apiClient } from '../../services/apiClient';
import { useToast } from '../../components/ToastProvider';
import { useTranslation } from '../../contexts/TranslationContext';
import { thermalPrinterService } from '../../services/thermalPrinterService';

type FilterType = 'pending' | 'ready' | 'all';
type TimeRangeType = 'today' | 'yesterday' | 'week' | 'month' | 'all';

interface OrderItem {
  id: number;
  menu_item_name: string;
  quantity: number;
  item_total_cents: number;
  variants?: string;
  addons?: Array<{ menu_item_name: string; quantity: number }>;
}

interface ItemSummary {
  name: string;
  quantity: number;
  price_cents: number;
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
  items_summary?: ItemSummary[];
  items?: OrderItem[];
  payment_status?: string;
  payment_received?: boolean;
  cp_status?: string;
}

interface Props {
  restaurantId: string;
}

function sendEscPosToNetworkPrinter(host: string, port: number, data: Uint8Array, timeoutMs = 15000): Promise<void> {
  const url = 'http://localhost:8001/print';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ host, port, data: Array.from(data) }),
    signal: controller.signal,
  }).then(r => {
    clearTimeout(timer);
    if (!r.ok) throw new Error(`Print bridge error: ${r.status}`);
  }).catch(err => {
    clearTimeout(timer);
    throw err;
  });
}

export const ToGoTab: React.FC<Props> = ({ restaurantId }) => {
  const { showToast } = useToast();
  const { t } = useTranslation();
  const [filter, setFilter] = useState<FilterType>('pending');
  const [timeRange, setTimeRange] = useState<TimeRangeType>('today');
  const [showTimeRangeMenu, setShowTimeRangeMenu] = useState(false);
  const [orders, setOrders] = useState<ToGoOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);
  const [markingReadyId, setMarkingReadyId] = useState<number | null>(null);
  const [printingOrderId, setPrintingOrderId] = useState<number | null>(null);
  const lastTapRef = useRef<{ id: number; time: number } | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadOrders = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await apiClient.get(`/api/restaurants/${restaurantId}/orders?limit=200&order_type=to-go`);
      let data: ToGoOrder[] = Array.isArray(res.data) ? res.data : [];

      // Only to-go and counter types
      data = data.filter(o => o.order_type === 'to-go' || o.order_type === 'counter');

      // Only show PAID orders (bill settled = session ended)
      data = data.filter(o => !!o.session_ended_at);

      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

      if (filter === 'pending') {
        data = data.filter(o => !o.pickup_ready_at);
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
      }

      setOrders(data);
    } catch {
      if (!silent) showToast('Failed to load orders', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [restaurantId, filter, timeRange]);

  const loadOrderDetail = useCallback(async (orderId: number): Promise<ToGoOrder | null> => {
    try {
      const res = await apiClient.get(`/api/restaurants/${restaurantId}/orders/${orderId}`);
      return res.data as ToGoOrder;
    } catch {
      return null;
    }
  }, [restaurantId]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    intervalRef.current = setInterval(() => loadOrders(true), 15000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [loadOrders]);

  const handleMarkReady = async (orderId: number) => {
    setMarkingReadyId(orderId);
    try {
      await apiClient.post(`/api/restaurants/${restaurantId}/orders/${orderId}/ready`);
      showToast(t('togo.marked-ready'), 'success');
      setExpandedOrderId(null);
      await loadOrders(true);
    } catch {
      showToast('Failed to mark order ready', 'error');
    } finally {
      setMarkingReadyId(null);
    }
  };

  const handleCardPress = (item: ToGoOrder) => {
    const now = Date.now();
    const lastTap = lastTapRef.current;
    if (lastTap && lastTap.id === item.id && now - lastTap.time < 350) {
      lastTapRef.current = null;
      setExpandedOrderId(null);
      handleMarkReady(item.id);
    } else {
      lastTapRef.current = { id: item.id, time: now };
      setExpandedOrderId(prev => (prev === item.id ? null : item.id));
    }
  };

  const handlePrintReceipt = async (order: ToGoOrder) => {
    if (!order.session_id) {
      Alert.alert('Error', 'No session linked to this order.');
      return;
    }
    setPrintingOrderId(order.id);
    try {
      let detail = order;
      if (!order.items || order.items.length === 0) {
        const fetched = await loadOrderDetail(order.id);
        if (fetched) detail = fetched;
      }

      const printerRes = await apiClient.get(`/api/restaurants/${restaurantId}/printer-settings`);
      const printerRows = Array.isArray(printerRes.data) ? printerRes.data : [];
      const billPrinter = printerRows.find((p: any) => p.type === 'Bill');
      const billPrinterEntry = billPrinter?.settings?.printers?.[0];
      const billPrinterType: string | undefined = billPrinterEntry?.type;

      if (!billPrinterType || billPrinterType === 'none') {
        Alert.alert(
          t('togo.no-bill-printer'),
          'Please configure a bill printer in Settings.'
        );
        setPrintingOrderId(null);
        return;
      }

      const printItems = (detail.items || []).map((i: OrderItem) => ({
        name: i.menu_item_name,
        quantity: i.quantity,
        price_cents: i.quantity > 0 ? Math.round(i.item_total_cents / i.quantity) : i.item_total_cents,
      }));

      const billPayload = {
        sessionId: order.session_id,
        billData: {
          table: order.customer_name || 'Pick-up',
          items: printItems,
          subtotal: order.total_cents,
          serviceCharge: 0,
          total: order.total_cents,
        },
        priority: 5,
      };

      const printRes = await apiClient.post(`/api/restaurants/${restaurantId}/print-receipt`, billPayload);

      if (printRes.data?.networkPrint) {
        const { host, port, escposBase64 } = printRes.data.networkPrint;
        try {
          const escposBytes = new Uint8Array(Buffer.from(escposBase64, 'base64'));
          await sendEscPosToNetworkPrinter(host, port, escposBytes);
          showToast(t('togo.print-sent'), 'success');
        } catch (netErr: any) {
          Alert.alert('Printer Unreachable', `Could not reach printer at ${host}:${port}.\n\n${netErr.message}`);
        }
      } else if (printRes.data?.html) {
        await Print.printAsync({ html: printRes.data.html });
      } else if (printRes.data?.bluetoothPayload) {
        try {
          const { BleManager } = require('react-native-ble-plx');
          const manager = new BleManager();
          await thermalPrinterService.sendEscposBase64ToBluetooth(
            manager,
            printRes.data.bluetoothPayload.printerConfig.bluetoothDeviceId,
            printRes.data.bluetoothPayload.data.escposBase64,
            30000
          );
          showToast(t('togo.print-sent'), 'success');
        } catch (btErr: any) {
          Alert.alert('Bluetooth Error', btErr.message);
        }
      } else {
        showToast(t('togo.print-sent'), 'success');
      }
    } catch (err: any) {
      Alert.alert('Print Error', err?.response?.data?.error || err.message || 'Failed to print');
    } finally {
      setPrintingOrderId(null);
    }
  };

  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    const date = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `${date} ${time}`;
  };

  const renderCard = ({ item }: { item: ToGoOrder }) => {
    const isReady = !!item.pickup_ready_at;
    const isExpanded = item.id === expandedOrderId;
    const isEatHere = item.order_type === 'counter';
    const customer = item.customer_name || item.customer_phone || '';
    const total = item.total_cents != null ? `$${(item.total_cents / 100).toFixed(2)}` : '—';
    // Use items_summary from list response (contains name+qty), fall back to full items if available
    const displayItems: Array<{ name: string; quantity: number }> =
      (item.items_summary && item.items_summary.length > 0)
        ? item.items_summary
        : (item.items || []).map(i => ({ name: i.menu_item_name, quantity: i.quantity }));
    const isMarkingThisReady = markingReadyId === item.id;
    const isPrintingThis = printingOrderId === item.id;

    return (
      <TouchableOpacity
        style={[styles.card, isReady && styles.cardReady, isExpanded && styles.cardExpanded]}
        onPress={() => handleCardPress(item)}
        activeOpacity={0.85}
      >
        {/* Header: order# + time */}
        <View style={styles.cardHeader}>
          <Text style={styles.cardOrderNum}>#{item.restaurant_order_number ?? item.id}</Text>
          <Text style={styles.cardTime}>{formatDateTime(item.created_at)}</Text>
        </View>

        {/* Type badge + ready badge */}
        <View style={styles.badgeRow}>
          <View style={[styles.typeBadge, isEatHere ? styles.typeBadgeEatHere : styles.typeBadgeTakeaway]}>
            <Ionicons
              name={isEatHere ? 'restaurant-outline' : 'bag-outline'}
              size={9}
              color={isEatHere ? '#1d4ed8' : '#065f46'}
              style={{ marginRight: 3 }}
            />
            <Text style={[styles.typeBadgeText, isEatHere ? styles.typeBadgeTextEatHere : styles.typeBadgeTextTakeaway]}>
              {isEatHere ? t('togo.eat-here') : t('togo.takeaway')}
            </Text>
          </View>
          {isReady && (
            <View style={styles.readyBadge}>
              <Ionicons name="checkmark-circle" size={10} color="#065f46" style={{ marginRight: 2 }} />
              <Text style={styles.readyBadgeText}>{t('togo.status-ready')}</Text>
            </View>
          )}
        </View>

        {/* Customer name */}
        {!!customer && <Text style={styles.cardCustomer} numberOfLines={1}>{customer}</Text>}

        {/* Items list */}
        <View style={styles.itemsList}>
          {displayItems.length > 0 ? (
            displayItems.map((di, idx) => (
              <View key={idx} style={styles.itemRow}>
                <Text style={styles.itemQty}>×{di.quantity}</Text>
                <Text style={styles.itemName} numberOfLines={2}>{di.name}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.itemsCount}>{item.item_count ?? '?'} {t('togo.items')}</Text>
          )}
        </View>

        {/* Total */}
        <View style={styles.cardTotalRow}>
          <Text style={styles.cardTotalLabel}>{t('togo.total')}</Text>
          <Text style={styles.cardTotal}>{total}</Text>
        </View>

        {/* Expanded actions - stacked vertically to fit narrow card */}
        {isExpanded && (
          <View style={styles.expandedActions}>
            <TouchableOpacity
              style={[styles.printBtn, isPrintingThis && { opacity: 0.6 }]}
              onPress={() => handlePrintReceipt(item)}
              disabled={isPrintingThis}
            >
              {isPrintingThis ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="print-outline" size={14} color="#fff" style={{ marginRight: 4 }} />
                  <Text style={styles.printBtnText}>{t('togo.print-receipt')}</Text>
                </>
              )}
            </TouchableOpacity>
            {!isReady && (
              <TouchableOpacity
                style={[styles.markReadyBtn, isMarkingThisReady && { opacity: 0.6 }]}
                onPress={() => handleMarkReady(item.id)}
                disabled={isMarkingThisReady}
              >
                {isMarkingThisReady ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="cafe-outline" size={14} color="#fff" style={{ marginRight: 4 }} />
                    <Text style={styles.markReadyBtnText}>{t('togo.mark-ready')}</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}

        {isExpanded && !isReady && (
          <Text style={styles.doubleTapHint}>{t('togo.double-tap-ready')}</Text>
        )}
      </TouchableOpacity>
    );
  };

  const timeRangeLabels: Record<TimeRangeType, string> = {
    today: t('togo.time-today'),
    yesterday: t('togo.time-yesterday'),
    week: t('togo.time-week'),
    month: t('togo.time-month'),
    all: t('togo.time-all'),
  };

  const emptyLabels: Record<FilterType, string> = {
    pending: t('togo.empty-active'),
    ready: t('togo.empty-ready'),
    all: t('togo.empty-all'),
  };

  return (
    <View style={styles.container}>
      {/* Filter tabs */}
      <View style={styles.filterRow}>
        {(['pending', 'ready'] as FilterType[]).map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
            onPress={() => { setFilter(f); setExpandedOrderId(null); }}
          >
            {f === 'ready' && (
              <Ionicons name="checkmark" size={12} color={filter === f ? '#fff' : '#6b7280'} style={{ marginRight: 4 }} />
            )}
            <Text style={[styles.filterBtnText, filter === f && styles.filterBtnTextActive]}>
              {f === 'pending' ? t('togo.filter-active') : t('togo.filter-ready')}
            </Text>
          </TouchableOpacity>
        ))}
        {/* All / time-range */}
        <View style={{ flex: 1, position: 'relative', zIndex: 10 }}>
          <TouchableOpacity
            style={[styles.filterBtn, filter === 'all' && styles.filterBtnActive, { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }]}
            onPress={() => {
              setFilter('all');
              setExpandedOrderId(null);
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
                      setExpandedOrderId(null);
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

      {/* Interaction hint */}
      <View style={styles.hintBar}>
        <Text style={styles.hintText}>{t('togo.hint-tap')}</Text>
      </View>

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
          renderItem={renderCard}
          numColumns={2}
          key="grid-2"
          columnWrapperStyle={styles.columnWrapper}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); loadOrders(); }}
              tintColor="#667eea"
            />
          }
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },

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
    flexDirection: 'row',
    justifyContent: 'center',
  },
  filterBtnActive: { backgroundColor: '#667eea' },
  filterBtnText: { fontSize: 13, fontWeight: '600', color: '#6b7280' },
  filterBtnTextActive: { color: '#fff' },

  hintBar: {
    backgroundColor: '#eff6ff',
    borderBottomWidth: 1,
    borderBottomColor: '#bfdbfe',
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  hintText: { fontSize: 11, color: '#3b82f6', textAlign: 'center' },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyText: { marginTop: 12, fontSize: 14, color: '#9ca3af', textAlign: 'center' },

  listContent: { padding: 8, paddingBottom: 32 },
  columnWrapper: { gap: 8, marginBottom: 8 },

  card: {
    flex: 1,
    width: CARD_WIDTH,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  cardReady: { borderColor: '#6ee7b7', backgroundColor: '#f0fdf4' },
  cardExpanded: { borderColor: '#667eea', borderWidth: 2 },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  cardOrderNum: { fontSize: 16, fontWeight: '800', color: '#1f2937' },
  typeBadge: {
    paddingHorizontal: 5,
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
  readyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: '#d1fae5',
  },
  readyBadgeText: { fontSize: 10, fontWeight: '700', color: '#065f46' },
  cardTime: { fontSize: 11, color: '#9ca3af', fontWeight: '500' },

  cardCustomer: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 4 },

  itemsList: {
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingTop: 6,
    marginBottom: 6,
  },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 2 },
  itemQty: { fontSize: 12, fontWeight: '700', color: '#667eea', width: 26, flexShrink: 0 },
  itemName: { flex: 1, fontSize: 12, fontWeight: '500', color: '#374151' },
  itemPrice: { fontSize: 12, fontWeight: '600', color: '#6b7280', flexShrink: 0 },
  itemsCount: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 6,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },

  cardTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingTop: 6,
    marginTop: 2,
  },
  cardTotalLabel: { fontSize: 12, fontWeight: '600', color: '#6b7280' },
  cardTotal: { fontSize: 14, fontWeight: '800', color: '#1f2937' },

  expandedActions: { flexDirection: 'column', gap: 6, marginTop: 8 },
  printBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#667eea',
    borderRadius: 8,
    paddingVertical: 8,
  },
  printBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  markReadyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10b981',
    borderRadius: 8,
    paddingVertical: 8,
  },
  markReadyBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },

  doubleTapHint: { textAlign: 'center', fontSize: 10, color: '#9ca3af', marginTop: 4 },

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
  timeRangeItem: { paddingVertical: 10, paddingHorizontal: 14 },
  timeRangeItemActive: { backgroundColor: '#f0f0ff' },
  timeRangeItemText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  timeRangeItemTextActive: { color: '#667eea' },
});
