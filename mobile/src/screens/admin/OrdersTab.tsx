import React, { useState, useEffect, useRef, useImperativeHandle } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, FlatList, RefreshControl, Alert, Image, Modal, Platform, Dimensions, TextInput } from 'react-native';
import { apiClient, API_URL } from '../../services/apiClient';
import { useTranslation } from '../../contexts/TranslationContext';
import { useToast } from '../../components/ToastProvider';
import { Ionicons } from '@expo/vector-icons';

interface MenuItem {
  id: number;
  name: string;
  description?: string;
  price_cents: number;
  category_id: number;
  image_url?: string;
}

interface Variant {
  id: number;
  name: string;
  min_select: number;
  max_select: number;
  required: boolean;
  options: VariantOption[];
}

interface VariantOption {
  id: number;
  name: string;
  price_cents: number;
}

interface Category {
  id: number;
  name: string;
}

interface CartItem extends MenuItem {
  quantity: number;
  variants?: SelectedVariant[];
  notes?: string;
}

interface SelectedVariant {
  variantId: number;
  variantName: string;
  optionId: number;
  optionName: string;
}

interface Order {
  id: number;
  session_id?: number;
  order_type: string;
  status: string;
  total_cents: number;
  created_at: string;
  items?: any[];
  table_id?: number;
  table_name?: string;
  // Payment fields from backend
  payment_status?: string;
  payment_received?: boolean;
  payment_method_online?: string;
  payment_method_label?: string;
  kpay_reference_id?: string;
  kpay_status?: string;
  kpay_completed_at?: string;
  kpay_pay_method?: string;
  refund_amount_cents?: number;
  payment_network?: string;
  cp_vendor?: string;
  cp_method?: string;
  cp_status?: string;
  cp_vendor_ref?: string;
  cp_total_cents?: number;
  cp_env?: string;
  cp_completed_at?: string;
  cp_refunded_at?: string;
  cp_refund_amount_cents?: number;
  payment_records?: PaymentRecord[];
}

interface PaymentRecord {
  id: number;
  payment_vendor: string;
  payment_method: string;
  payment_gateway_env?: string;
  order_reference?: string;
  vendor_reference?: string;
  amount_cents: number;
  currency_code?: string;
  total_cents: number;
  status: string;
  refund_amount_cents?: number;
  refunded_at?: string;
  refund_reference?: string;
  created_at: string;
  completed_at?: string;
  failed_at?: string;
}

interface Session {
  session_id: number;
  table_id: number;
  table_name: string;
  pax: number;
  started_at: string;
  ended_at?: string;
}

// Shared helpers (used by main component + SessionDetails + OrderDetails)
const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const getOrderTypeLabel = (orderType?: string) => {
  if (!orderType) return 'Order';
  if (orderType === 'table') return 'Table';
  if (orderType === 'counter' || orderType === 'pay-now') return 'Order Now';
  if (orderType === 'to-go') return 'To-Go';
  return 'Order';
};

// KPay payMethod integer → label
const KPAY_METHOD_MAP: Record<number, string> = {
  1: 'Visa', 2: 'Mastercard', 3: 'Amex', 4: 'UnionPay',
  5: 'Alipay', 6: 'WeChat Pay', 7: 'FPS', 8: 'Octopus',
  10: 'JCB', 11: 'Octopus', 12: 'PayMe', 14: 'FPS',
};

// KPay payResult integer → label
const KPAY_RESULT_MAP: Record<number, string> = {
  '-1': 'Timeout', 1: 'Pending', 2: 'Success', 3: 'Failed',
  4: 'Refunded', 5: 'Cancelled', 6: 'Cancelled',
};

// Payment Asia status → label
const PA_STATUS_MAP: Record<string, string> = {
  '1': 'Completed', '2': 'Pending', '3': 'Failed',
  '4': 'Processing', '5': 'Refunded',
};

// Resolve the display payment method for an order
const getPaymentMethodLabel = (order: Order) => {
  if (order.cp_method) return order.cp_method;
  if (order.cp_vendor === 'kpay' && order.kpay_pay_method) {
    return KPAY_METHOD_MAP[Number(order.kpay_pay_method)] || 'Terminal';
  }
  if (order.cp_vendor === 'payment-asia' && order.payment_network) {
    return order.payment_network;
  }
  if (order.payment_method_online === 'kpay' && order.kpay_pay_method) {
    return KPAY_METHOD_MAP[Number(order.kpay_pay_method)] || 'Terminal';
  }
  if (order.payment_method_online === 'payment-asia' && order.payment_network) {
    return order.payment_network;
  }
  if (order.payment_method_online === 'card') return 'Credit Card';
  if (order.payment_method_online === 'cash' || !order.payment_method_online) return 'Cash';
  return order.payment_method_online;
};

// Resolve the vendor for display (from cp_vendor or payment_method_online)
const resolveVendor = (order: Order) => {
  return order.cp_vendor || order.payment_method_online || null;
};

export interface OrdersTabRef {
  toggleHistory: () => void;
}

interface OrdersTabProps {
  restaurantId: string;
  selectedTableOnInit?: any;
  searchQuery?: string;
  onNavigateToTables?: () => void;
}

const OrdersTabComponent = (props: OrdersTabProps, ref: React.ForwardedRef<OrdersTabRef>) => {
  const { restaurantId, selectedTableOnInit } = props;
    const { t } = useTranslation();
    // Menu state
    const [categories, setCategories] = useState<Category[]>([]);
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    
    // Variant modal state
    const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
    const [itemVariants, setItemVariants] = useState<Variant[]>([]);
    const [variantSelections, setVariantSelections] = useState<{
      [variantId: number]: number | number[];
    }>({});
    const [showVariantModal, setShowVariantModal] = useState(false);
    
    // Cart state
    const [cart, setCart] = useState<CartItem[]>([]);
    const [cartEditMode, setCartEditMode] = useState(false);
    const [orderType, setOrderType] = useState<'table' | 'pay-now' | 'to-go' | null>(null);
    const [selectedTable, setSelectedTable] = useState<string | null>(null);
    const [tables, setTables] = useState<any[]>([]);
    
    // Table picker state
    const [showTablePicker, setShowTablePicker] = useState(false);
    const [tablePickerData, setTablePickerData] = useState<any[]>([]);
    const [tablePickerLoading, setTablePickerLoading] = useState(false);
    const [selectedTableName, setSelectedTableName] = useState<string | null>(null);
    const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
    const [newOrderPax, setNewOrderPax] = useState('1');
    const [showNewOrderPaxModal, setShowNewOrderPaxModal] = useState(false);
    const [pendingTableForNewOrder, setPendingTableForNewOrder] = useState<any>(null);

    // History state
    const [showHistory, setShowHistory] = useState(false);
    const [orders, setOrders] = useState<Order[]>([]);
    const [selectedHistoryOrder, setSelectedHistoryOrder] = useState<Order | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Payment terminal state for refund/void
    const [kpayTerminal, setKpayTerminal] = useState<any>(null);
    const [showKpayRefundModal, setShowKpayRefundModal] = useState(false);
    const [kpayRefundAmount, setKpayRefundAmount] = useState('');
    const [kpayManagerPassword, setKpayManagerPassword] = useState('');
    const [showPaRefundModal, setShowPaRefundModal] = useState(false);
    const [paRefundAmount, setPaRefundAmount] = useState('');

    // Live transaction details
    const [kpayTxDetails, setKpayTxDetails] = useState<any>(null);
    const [paTxDetails, setPaTxDetails] = useState<any>(null);
    const [txLoading, setTxLoading] = useState(false);

    // Expose toggleHistory through ref
    useImperativeHandle(ref, () => ({
      toggleHistory() {
        setShowHistory(prev => !prev);
      }
    }), []);

    // Handle selectedTableOnInit from Tables tab
    useEffect(() => {
      if (selectedTableOnInit) {
        setOrderType('table');
        // selectedTableOnInit can be { sessionId, tableName } or { name }
        if (selectedTableOnInit.sessionId) {
          setSelectedTable(selectedTableOnInit.sessionId.toString());
        } else if (selectedTableOnInit.name) {
          setSelectedTable(selectedTableOnInit.name);
        }
      }
    }, [selectedTableOnInit]);

    const loadTablePickerData = async () => {
      try {
        setTablePickerLoading(true);
        const res = await apiClient.get(`/api/restaurants/${restaurantId}/table-state`);
        const rows = res.data || [];
        // Group by table
        const tableMap: Record<number, any> = {};
        rows.forEach((row: any) => {
          if (!tableMap[row.table_id]) {
            tableMap[row.table_id] = {
              id: row.table_id,
              name: row.table_name,
              sessions: [],
            };
          }
          if (row.session_id) {
            tableMap[row.table_id].sessions.push({
              id: row.session_id,
              pax: row.pax,
              started_at: row.started_at,
              order_id: row.order_id,
            });
          }
        });
        setTablePickerData(Object.values(tableMap));
      } catch (err) {
        console.error('Error loading table picker data:', err);
      } finally {
        setTablePickerLoading(false);
      }
    };

    const openTablePicker = async () => {
      setShowTablePicker(true);
      await loadTablePickerData();
    };

    const selectTableOrder = (table: any, session: any) => {
      setSelectedTable(session.id.toString());
      setSelectedTableName(table.name);
      setSelectedOrderId(session.order_id || null);
      setOrderType('table');
      setShowTablePicker(false);
    };

    const startNewOrderOnTable = (table: any) => {
      setPendingTableForNewOrder(table);
      setNewOrderPax('1');
      setShowNewOrderPaxModal(true);
    };

    const confirmNewOrderOnTable = async () => {
      if (!pendingTableForNewOrder || !newOrderPax || parseInt(newOrderPax) <= 0) return;
      try {
        const res = await apiClient.post(
          `/api/tables/${pendingTableForNewOrder.id}/sessions`,
          { pax: parseInt(newOrderPax) }
        );
        const newSession = res.data;
        setSelectedTable(newSession.id.toString());
        setSelectedTableName(pendingTableForNewOrder.name);
        setSelectedOrderId(newSession.order_id || null);
        setOrderType('table');
        setShowNewOrderPaxModal(false);
        setShowTablePicker(false);
        setPendingTableForNewOrder(null);
      } catch (err: any) {
        Alert.alert('Error', err.response?.data?.error || 'Failed to create order');
      }
    };

    // Load menu and tables on mount
    useEffect(() => {
      loadMenu();
      loadTables();
    }, [restaurantId]);

    // Load history when showing history view
    useEffect(() => {
      if (showHistory) {
        loadOrdersAndSessions();
        loadKpayTerminal();
      }
    }, [showHistory]);

    const loadKpayTerminal = async () => {
      try {
        const res = await apiClient.get(`/api/restaurants/${restaurantId}/kpay-terminal/active`);
        if (res.data?.configured) {
          setKpayTerminal(res.data.terminal);
        }
      } catch (err) {
        // No KPay terminal configured — that's fine
      }
    };

    // Load live transaction details for the selected order
    const loadTransactionDetails = async (order: Order) => {
      setKpayTxDetails(null);
      setPaTxDetails(null);
      const vendor = resolveVendor(order);
      const ref = order.kpay_reference_id || order.cp_vendor_ref;
      if (!ref) return;

      setTxLoading(true);
      try {
        if (vendor === 'kpay') {
          const res = await apiClient.get(`/api/restaurants/${restaurantId}/kpay-transactions/${ref}`);
          setKpayTxDetails(res.data);
        } else if (vendor === 'payment-asia') {
          const merchantRef = order.cp_vendor_ref || ref;
          const res = await apiClient.post(`/api/restaurants/${restaurantId}/payment-asia/query`, { merchant_reference: merchantRef });
          setPaTxDetails(res.data);
        }
      } catch (err) {
        // Query failed — we still show what we have from the order record
      } finally {
        setTxLoading(false);
      }
    };

    const selectHistoryOrder = async (order: Order) => {
      setSelectedHistoryOrder(order);
      // Also fetch full order detail (with items, payment_records, etc.)
      try {
        const res = await apiClient.get(`/api/restaurants/${restaurantId}/orders/${order.id}`);
        setSelectedHistoryOrder(res.data);
        loadTransactionDetails(res.data);
      } catch (err) {
        // Use the list data if detail fetch fails
        loadTransactionDetails(order);
      }
    };

    const loadMenu = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await apiClient.get(`/api/restaurants/${restaurantId}/menu`);
        setCategories(response.data.categories || []);
        setMenuItems(response.data.items || []);
        if (response.data.categories?.length > 0) {
          setSelectedCategory(response.data.categories[0].id);
        }
      } catch (err: any) {
        console.error('Error loading menu:', err);
        setError('Failed to load menu');
      } finally {
        setLoading(false);
      }
    };

    const loadTables = async () => {
      try {
        const response = await apiClient.get(`/api/restaurants/${restaurantId}/tables`);
        setTables(response.data || []);
      } catch (err) {
        console.error('Error loading tables:', err);
      }
    };

    const loadOrdersAndSessions = async () => {
      try {
        setRefreshing(true);
        setError(null);
        const response = await apiClient.get(`/api/restaurants/${restaurantId}/orders?limit=500`);
        const allOrders = Array.isArray(response.data) ? response.data : [];
        setOrders(allOrders);
      } catch (err: any) {
        console.error('Error loading orders:', err);
        setError(err.message || 'Failed to load data');
      } finally {
        setRefreshing(false);
      }
    }

    const handleItemPress = async (item: MenuItem) => {
      try {
        setSelectedItem(item);
        setVariantSelections({});
        
        // Fetch variants for this item
        const response = await apiClient.get(`/api/menu-items/${item.id}/variants`);
        setItemVariants(response.data || []);
        setShowVariantModal(true);
      } catch (err) {
        console.error('Error loading variants:', err);
        // If no variants, just add to cart
        handleAddToCart(item, []);
      }
    };

    const handleAddToCart = (item: MenuItem, selectedVariantsList: SelectedVariant[] = []) => {
      setCart(prevCart => [...prevCart, {
        ...item,
        quantity: 1,
        variants: selectedVariantsList,
      }]);
    };

    const handleVariantSubmit = () => {
      if (!selectedItem) return;

      // Validate required variants
      for (const variant of itemVariants) {
        if (variant.required && !variantSelections[variant.id]) {
          Alert.alert('Missing Selection', `Please select ${variant.name}`);
          return;
        }
      }

      // Build selected variants list
      const selectedVariantsList: SelectedVariant[] = [];
      Object.entries(variantSelections).forEach(([variantId, optionIds]) => {
        const variant = itemVariants.find(v => v.id === parseInt(variantId));
        if (variant) {
          const optionIdArray = Array.isArray(optionIds) ? optionIds : [optionIds];
          optionIdArray.forEach(optionId => {
            const option = variant.options.find(o => o.id === optionId);
            if (option) {
              selectedVariantsList.push({
                variantId: variant.id,
                variantName: variant.name,
                optionId: option.id,
                optionName: option.name,
              });
            }
          });
        }
      });

      handleAddToCart(selectedItem, selectedVariantsList);
      setShowVariantModal(false);
    };

    const handleRemoveFromCart = (index: number) => {
      setCart(prevCart => prevCart.filter((_, i) => i !== index));
    };

    const handleUpdateQuantity = (index: number, quantity: number) => {
      if (quantity <= 0) {
        handleRemoveFromCart(index);
      } else {
        setCart(prevCart =>
          prevCart.map((item, i) => i === index ? { ...item, quantity } : item)
        );
      }
    };

    const handleUpdateNotes = (index: number, notes: string) => {
      setCart(prevCart =>
        prevCart.map((item, i) => i === index ? { ...item, notes } : item)
      );
    };

    const handleSubmitOrder = async () => {
      if (cart.length === 0) {
        Alert.alert('Empty Cart', 'Please add items before submitting');
        return;
      }
      if (!orderType) {
        Alert.alert('Missing Info', 'Please select an order type');
        return;
      }
      if (orderType === 'table' && !selectedTable) {
        Alert.alert('Missing Table', 'Please select a table');
        return;
      }

      try {
        // Prepare items for API submission
        const items = cart.map(cartItem => ({
          menu_item_id: cartItem.id,
          quantity: cartItem.quantity,
          notes: cartItem.notes || null,
          selected_option_ids: (cartItem.variants || []).map(v => v.optionId),
        }));

        console.log('[OrderSubmit] Submitting order:', {
          orderType,
          selectedTable,
          items,
          restaurantId,
        });

        if (orderType === 'table') {
          // For table orders, we need a session ID
          // First, check if table has an active session
          if (!selectedTable) {
            throw new Error('Please select a table');
          }
          
          // The selectedTable is now a table ID (string)
          // We need to look up if this table has an active session
          // For now, treat selectedTable as a session ID (in case it's been pre-selected from active sessions)
          const sessionId = selectedTable;
          
          const res = await apiClient.post(
            `/api/sessions/${sessionId}/orders`,
            { items }
          );
          console.log('[OrderSubmit] Table order submitted:', res);
          Alert.alert('Success', `Order submitted with ${cart.length} items`);
        } else if (orderType === 'pay-now') {
          const res = await apiClient.post(
            `/api/restaurants/${restaurantId}/counter-order`,
            { pax: 1, items }
          );
          console.log('[OrderSubmit] Counter order submitted:', res);
          Alert.alert('Success', `Counter order submitted with ${cart.length} items`);
        } else if (orderType === 'to-go') {
          const res = await apiClient.post(
            `/api/restaurants/${restaurantId}/to-go-order`,
            { pax: 1, items }
          );
          console.log('[OrderSubmit] To-go order submitted:', res);
          Alert.alert('Success', `To-go order submitted with ${cart.length} items`);
        }

        // Clear cart and reset
        setCart([]);
        setOrderType(null);
        setSelectedTable(null);
      } catch (err: any) {
        console.error('[OrderSubmit] Error:', err);
        Alert.alert(
          'Error',
          err.response?.data?.error || err.message || 'Failed to submit order. Make sure table has an active session.'
        );
      }
    };

    // === Manual Void/Refund (non-vendor orders) ===
    const handleVoidOrder = (orderId: number) => {
      Alert.alert(
        'Void Order',
        'Mark this order as Voided?\nThis is a manual record update only — no payment system will be called.',
        [
          { text: 'Cancel' },
          {
            text: 'Void',
            style: 'destructive',
            onPress: async () => {
              try {
                await apiClient.post(`/api/restaurants/${restaurantId}/orders/${orderId}/void`);
                await reloadSelectedOrder(orderId);
              } catch (err: any) {
                Alert.alert('Error', err.response?.data?.error || 'Void failed');
              }
            },
          },
        ]
      );
    };

    const handleRefundOrder = (orderId: number) => {
      Alert.alert(
        'Refund Order',
        'Mark this order as Refunded?\nThis is a manual record update only — no payment system will be called.',
        [
          { text: 'Cancel' },
          {
            text: 'Refund',
            style: 'destructive',
            onPress: async () => {
              try {
                await apiClient.post(`/api/restaurants/${restaurantId}/orders/${orderId}/refund`);
                await reloadSelectedOrder(orderId);
              } catch (err: any) {
                Alert.alert('Error', err.response?.data?.error || 'Refund failed');
              }
            },
          },
        ]
      );
    };

    // === KPay Void ===
    const handleKpayVoid = (order: Order) => {
      if (!kpayTerminal) {
        Alert.alert('Error', 'No KPay terminal configured');
        return;
      }
      const outTradeNo = order.kpay_reference_id;
      if (!outTradeNo) {
        Alert.alert('Error', 'No KPay reference found for this order');
        return;
      }
      Alert.alert(
        'Void KPay Transaction',
        `Void transaction ${outTradeNo}?\nOnly works for same-day unsettled transactions.`,
        [
          { text: 'Cancel' },
          {
            text: 'Void',
            style: 'destructive',
            onPress: async () => {
              try {
                await apiClient.post(
                  `/api/restaurants/${restaurantId}/payment-terminals/${kpayTerminal.id}/cancel`,
                  { outTradeNo: `VOID-${Date.now()}`, originOutTradeNo: outTradeNo }
                );
                Alert.alert('Success', 'Void request sent to KPay terminal');
                await reloadSelectedOrder(order.id);
              } catch (err: any) {
                Alert.alert('Void Failed', err.response?.data?.error || err.message);
              }
            },
          },
        ]
      );
    };

    // === KPay Refund ===
    const openKpayRefund = () => {
      setKpayRefundAmount('');
      setKpayManagerPassword('');
      setShowKpayRefundModal(true);
    };

    const submitKpayRefund = async () => {
      if (!selectedHistoryOrder || !kpayTerminal) return;
      const outTradeNo = selectedHistoryOrder.kpay_reference_id;
      if (!outTradeNo || !kpayManagerPassword) {
        Alert.alert('Error', 'Manager password is required');
        return;
      }
      try {
        const body: any = {
          outTradeNo: `REF-${Date.now()}`,
          refundType: 2, // default QR
          managerPassword: kpayManagerPassword,
        };
        if (kpayRefundAmount) {
          body.refundAmount = kpayRefundAmount;
        }
        await apiClient.post(
          `/api/restaurants/${restaurantId}/payment-terminals/${kpayTerminal.id}/refund`,
          body
        );
        setShowKpayRefundModal(false);
        Alert.alert('Success', 'Refund request sent to KPay terminal');
        await reloadSelectedOrder(selectedHistoryOrder.id);
      } catch (err: any) {
        Alert.alert('Refund Failed', err.response?.data?.error || err.message);
      }
    };

    // === Payment Asia Refund ===
    const openPaRefund = () => {
      if (!selectedHistoryOrder) return;
      const totalDollars = ((selectedHistoryOrder.cp_total_cents || selectedHistoryOrder.total_cents || 0) / 100).toFixed(2);
      setPaRefundAmount(totalDollars);
      setShowPaRefundModal(true);
    };

    const submitPaRefund = async () => {
      if (!selectedHistoryOrder) return;
      const merchantRef = selectedHistoryOrder.cp_vendor_ref || selectedHistoryOrder.kpay_reference_id;
      if (!merchantRef) {
        Alert.alert('Error', 'No merchant reference found for this order');
        return;
      }
      if (!paRefundAmount || parseFloat(paRefundAmount) <= 0) {
        Alert.alert('Error', 'Please enter a valid refund amount');
        return;
      }
      try {
        await apiClient.post(
          `/api/restaurants/${restaurantId}/payment-asia/refund`,
          { merchant_reference: merchantRef, amount: parseFloat(paRefundAmount) }
        );
        setShowPaRefundModal(false);
        Alert.alert('Success', 'Refund request sent to Payment Asia');
        await reloadSelectedOrder(selectedHistoryOrder.id);
      } catch (err: any) {
        Alert.alert('Refund Failed', err.response?.data?.error || err.message);
      }
    };

    // Helper to reload selected order after void/refund
    const reloadSelectedOrder = async (orderId: number) => {
      await loadOrdersAndSessions();
      try {
        const res = await apiClient.get(`/api/restaurants/${restaurantId}/orders/${orderId}`);
        setSelectedHistoryOrder(res.data);
        loadTransactionDetails(res.data);
      } catch (err) {
        // fallback: find from reloaded list
      }
    };

    const cartTotal = cart.reduce((sum, item) => sum + (item.price_cents * item.quantity), 0);

    const filteredMenuItems = menuItems.filter(item => {
      if (selectedCategory && item.category_id !== selectedCategory) return false;
      if (props.searchQuery && props.searchQuery.trim()) {
        return item.name.toLowerCase().includes(props.searchQuery.trim().toLowerCase());
      }
      return true;
    });

    const getFullImageUrl = (imageUrl?: string) => {
      if (!imageUrl) return null;
      if (imageUrl.startsWith('http')) return imageUrl;
      return `${API_URL}${imageUrl}`;
    };
    
    const formatDate = (dateStr: string) => {
      const date = new Date(dateStr);
      return date.toLocaleString('en-US', { 
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    };

    if (loading && !showHistory) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      );
    }

    // ============= HISTORY VIEW =============
    if (showHistory) {
      const historyIsTablet = (Platform as any).isPad;
      return (
        <>
          <View style={[styles.container, historyIsTablet && { flexDirection: 'row' }]}>
          <View style={{ flex: 1 }}>
          {/* Header with back button */}
          <View style={styles.historyHeader}>
            <TouchableOpacity onPress={() => setShowHistory(false)}>
              <Text style={styles.backButton}>← {t('common.back')}</Text>
            </TouchableOpacity>
            <Text style={styles.historyTitle}>{t('admin.order-history')}</Text>
          </View>

          {/* Orders List — all orders descending */}
          <FlatList
            data={orders}
            keyExtractor={(item: any) => item.id.toString()}
            renderItem={({ item }) => {
              const order = item as Order;
              const paymentBadge = getPaymentBadge(order);
              const items = order.items || [];
              const isSelected = selectedHistoryOrder?.id === order.id;
              return (
                <TouchableOpacity onPress={() => selectHistoryOrder(order)}>
                <View style={[styles.orderCard, isSelected && { borderColor: '#3b82f6', borderWidth: 2 }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.orderId}>Order #{order.id}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
                        <Ionicons 
                          name={order.order_type === 'table' ? 'restaurant-outline' : order.order_type === 'to-go' ? 'bag-handle-outline' : 'cart-outline'} 
                          size={13} 
                          color="#6b7280" 
                        />
                        <Text style={styles.orderDetails}>
                          {getOrderTypeLabel(order.order_type)}
                          {order.order_type === 'table' && order.table_name ? ` ${order.table_name}` : ''}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>
                        {formatDate(order.created_at)}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4, marginLeft: 12 }}>
                      <Text style={styles.orderTotal}>{formatPrice(order.total_cents)}</Text>
                      {paymentBadge && (
                        <View style={[styles.statusBadge, { backgroundColor: paymentBadge.color }]}>
                          <Text style={styles.statusText}>{paymentBadge.label}</Text>
                        </View>
                      )}
                      <Text style={{ fontSize: 10, color: '#9ca3af' }}>
                        {getPaymentMethodLabel(order)}
                        {(() => {
                          const v = resolveVendor(order);
                          if (v && v !== 'cash' && v !== 'card') {
                            const vLabel = getVendorLabel(v);
                            const mLabel = getPaymentMethodLabel(order);
                            if (vLabel && mLabel !== vLabel) return ` · ${vLabel}`;
                          }
                          return '';
                        })()}
                      </Text>
                    </View>
                  </View>

                  {/* Items summary */}
                  {items.length > 0 && (
                    <Text style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }} numberOfLines={2}>
                      {items.map((i: any) => `${i.menu_item_name || i.name} ×${i.quantity}`).join(', ')}
                    </Text>
                  )}
                </View>
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>{t('admin.no-orders-found')}</Text>
              </View>
            }
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadOrdersAndSessions} />}
            contentContainerStyle={styles.listContent}
          />

          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
          </View>

          {/* Right panel: Order detail (iPad only) */}
          {historyIsTablet && (
            <View style={styles.historyDetailPanel}>
              {selectedHistoryOrder ? (
                <ScrollView>
                  {/* Header */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <Text style={{ fontSize: 18, fontWeight: '700', color: '#1f2937' }}>
                      Order #{selectedHistoryOrder.id}
                    </Text>
                    <View style={{ backgroundColor: selectedHistoryOrder.status === 'completed' ? '#d1fae5' : selectedHistoryOrder.status === 'cancelled' ? '#fee2e2' : '#dbeafe', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                      <Text style={{ fontSize: 11, fontWeight: '600', color: selectedHistoryOrder.status === 'completed' ? '#065f46' : selectedHistoryOrder.status === 'cancelled' ? '#991b1b' : '#1e40af' }}>
                        {selectedHistoryOrder.status?.toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  {/* Order Info */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text style={{ fontSize: 13, color: '#6b7280' }}>Type</Text>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#1f2937' }}>
                      {getOrderTypeLabel(selectedHistoryOrder.order_type)}
                      {selectedHistoryOrder.order_type === 'table' && selectedHistoryOrder.table_name ? ` — ${selectedHistoryOrder.table_name}` : ''}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text style={{ fontSize: 13, color: '#6b7280' }}>Date</Text>
                    <Text style={{ fontSize: 13, color: '#1f2937' }}>{formatDate(selectedHistoryOrder.created_at)}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text style={{ fontSize: 13, color: '#6b7280' }}>Items</Text>
                    <Text style={{ fontSize: 13, color: '#1f2937' }}>{(selectedHistoryOrder.items || []).reduce((sum: number, i: any) => sum + (i.quantity || 1), 0)} items</Text>
                  </View>

                  {/* Items Section */}
                  <View style={{ borderTopWidth: 1, borderTopColor: '#e5e7eb', marginVertical: 12, paddingTop: 12 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#1f2937', marginBottom: 8 }}>Order Items</Text>
                    {(selectedHistoryOrder.items || []).map((item: any, idx: number) => (
                      <View key={idx} style={{ paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 13, color: '#1f2937' }}>{item.menu_item_name || item.name}</Text>
                            <Text style={{ fontSize: 11, color: '#9ca3af' }}>×{item.quantity}</Text>
                            {item.variants ? (
                              <Text style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{item.variants}</Text>
                            ) : null}
                            {item.notes ? (
                              <Text style={{ fontSize: 11, color: '#f59e0b', marginTop: 2 }}>Note: {item.notes}</Text>
                            ) : null}
                          </View>
                          <Text style={{ fontSize: 13, fontWeight: '600', color: '#1f2937' }}>
                            {formatPrice(item.item_total_cents || (item.price_cents || 0) * (item.quantity || 1))}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>

                  {/* Order Summary */}
                  <View style={{ borderTopWidth: 1, borderTopColor: '#e5e7eb', marginTop: 4, paddingTop: 12 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#1f2937', marginBottom: 8 }}>Order Summary</Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={{ fontSize: 13, color: '#6b7280' }}>Subtotal</Text>
                      <Text style={{ fontSize: 13, color: '#1f2937' }}>
                        {formatPrice((selectedHistoryOrder.items || []).reduce((sum: number, i: any) => sum + (i.item_total_cents || (i.price_cents || 0) * (i.quantity || 1)), 0))}
                      </Text>
                    </View>
                    {(() => {
                      const subtotal = (selectedHistoryOrder.items || []).reduce((sum: number, i: any) => sum + (i.item_total_cents || (i.price_cents || 0) * (i.quantity || 1)), 0);
                      const serviceCharge = selectedHistoryOrder.total_cents - subtotal;
                      if (serviceCharge > 0) {
                        return (
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                            <Text style={{ fontSize: 13, color: '#6b7280' }}>Service Charge</Text>
                            <Text style={{ fontSize: 13, color: '#1f2937' }}>{formatPrice(serviceCharge)}</Text>
                          </View>
                        );
                      }
                      return null;
                    })()}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: 8, borderTopWidth: 1, borderTopColor: '#e5e7eb' }}>
                      <Text style={{ fontSize: 15, fontWeight: '700', color: '#1f2937' }}>Grand Total</Text>
                      <Text style={{ fontSize: 15, fontWeight: '700', color: '#1f2937' }}>{formatPrice(selectedHistoryOrder.total_cents)}</Text>
                    </View>
                  </View>

                  {/* Payment Information */}
                  {(() => {
                    const vendor = resolveVendor(selectedHistoryOrder);
                    const effectiveStatus = selectedHistoryOrder.cp_status || selectedHistoryOrder.payment_status || (selectedHistoryOrder.payment_received ? 'completed' : null);
                    const methodLabel = getPaymentMethodLabel(selectedHistoryOrder);
                    const vendorLabel = vendor ? getVendorLabel(vendor) : (selectedHistoryOrder.payment_received ? 'Cash' : null);

                    // Status badge helper
                    const statusBadge = (status: string | null) => {
                      if (!status) return null;
                      const map: Record<string, { label: string; bg: string; fg: string }> = {
                        completed: { label: '✓ Paid', bg: '#d1fae5', fg: '#065f46' },
                        paid: { label: '✓ Paid', bg: '#d1fae5', fg: '#065f46' },
                        voided: { label: '🚫 Voided', bg: '#fef3c7', fg: '#92400e' },
                        cancelled: { label: '🚫 Voided', bg: '#fef3c7', fg: '#92400e' },
                        refunded: { label: '↩ Refunded', bg: '#fee2e2', fg: '#991b1b' },
                        partial_refund: { label: '↩ Partial', bg: '#fef3c7', fg: '#92400e' },
                        pending: { label: 'Pending', bg: '#dbeafe', fg: '#1e40af' },
                        failed: { label: 'Failed', bg: '#fee2e2', fg: '#991b1b' },
                      };
                      return map[status] || { label: status, bg: '#f3f4f6', fg: '#374151' };
                    };
                    const badge = statusBadge(effectiveStatus);

                    return (
                      <View style={{ borderTopWidth: 1, borderTopColor: '#e5e7eb', marginTop: 12, paddingTop: 12 }}>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: '#1f2937', marginBottom: 8 }}>Payment Information</Text>

                        {/* Payment Status */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <Text style={{ fontSize: 13, color: '#6b7280' }}>Payment Status</Text>
                          {badge ? (
                            <View style={{ backgroundColor: badge.bg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }}>
                              <Text style={{ fontSize: 12, fontWeight: '600', color: badge.fg }}>{badge.label}</Text>
                            </View>
                          ) : (
                            <View style={{ backgroundColor: '#f3f4f6', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }}>
                              <Text style={{ fontSize: 12, fontWeight: '600', color: '#6b7280' }}>Unpaid</Text>
                            </View>
                          )}
                        </View>

                        {/* Payment Vendor */}
                        {vendorLabel && (
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                            <Text style={{ fontSize: 13, color: '#6b7280' }}>Payment Vendor</Text>
                            <Text style={{ fontSize: 13, fontWeight: '600', color: vendor ? getVendorColor(vendor) : '#374151' }}>
                              💳 {vendorLabel}
                            </Text>
                          </View>
                        )}

                        {/* Payment Method */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                          <Text style={{ fontSize: 13, color: '#6b7280' }}>Payment Method</Text>
                          <Text style={{ fontSize: 13, color: '#1f2937' }}>{methodLabel}</Text>
                        </View>

                        {/* Vendor Reference */}
                        {selectedHistoryOrder.cp_vendor_ref && (
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                            <Text style={{ fontSize: 13, color: '#6b7280' }}>Reference</Text>
                            <Text style={{ fontSize: 12, color: '#1f2937', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}>{selectedHistoryOrder.cp_vendor_ref}</Text>
                          </View>
                        )}

                        {/* Paid At */}
                        {selectedHistoryOrder.cp_completed_at && (
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                            <Text style={{ fontSize: 13, color: '#6b7280' }}>Paid At</Text>
                            <Text style={{ fontSize: 13, color: '#1f2937' }}>{formatDate(selectedHistoryOrder.cp_completed_at)}</Text>
                          </View>
                        )}

                        {/* Refund info */}
                        {selectedHistoryOrder.cp_refund_amount_cents && selectedHistoryOrder.cp_refund_amount_cents > 0 && (
                          <View style={{ backgroundColor: '#fef2f2', borderRadius: 8, padding: 8, marginTop: 4 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                              <Text style={{ fontSize: 13, color: '#ef4444' }}>Refunded</Text>
                              <Text style={{ fontSize: 13, fontWeight: '600', color: '#ef4444' }}>{formatPrice(selectedHistoryOrder.cp_refund_amount_cents)}</Text>
                            </View>
                            {selectedHistoryOrder.cp_refunded_at && (
                              <Text style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>at {formatDate(selectedHistoryOrder.cp_refunded_at)}</Text>
                            )}
                          </View>
                        )}

                        {/* Sandbox badge */}
                        {selectedHistoryOrder.cp_env === 'sandbox' && (
                          <View style={{ backgroundColor: '#fef3c7', borderRadius: 6, padding: 4, alignSelf: 'flex-start', marginTop: 6 }}>
                            <Text style={{ fontSize: 10, fontWeight: '600', color: '#92400e' }}>SANDBOX</Text>
                          </View>
                        )}
                      </View>
                    );
                  })()}

                  {/* KPay Transaction Details */}
                  {(() => {
                    const vendor = resolveVendor(selectedHistoryOrder);
                    if (vendor !== 'kpay' || !selectedHistoryOrder.kpay_reference_id) return null;

                    return (
                      <View style={{ backgroundColor: '#eff6ff', borderRadius: 10, padding: 12, marginTop: 12, borderWidth: 1, borderColor: '#bfdbfe' }}>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: '#1e40af', marginBottom: 8 }}>KPay Transaction Details</Text>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                          <Text style={{ fontSize: 12, color: '#6b7280' }}>Order Ref</Text>
                          <Text style={{ fontSize: 12, color: '#1f2937', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}>{selectedHistoryOrder.kpay_reference_id}</Text>
                        </View>
                        {txLoading && <ActivityIndicator size="small" color="#3b82f6" style={{ marginVertical: 8 }} />}
                        {kpayTxDetails && (
                          <>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                              <Text style={{ fontSize: 12, color: '#6b7280' }}>Amount</Text>
                              <Text style={{ fontSize: 12, color: '#1f2937' }}>
                                {kpayTxDetails.payCurrency || 'HKD'} {((Number(kpayTxDetails.payAmount) || kpayTxDetails.amount_cents || 0) / 100).toFixed(2)}
                                {kpayTxDetails.payAmount ? ` (${kpayTxDetails.payAmount})` : ''}
                              </Text>
                            </View>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                              <Text style={{ fontSize: 12, color: '#6b7280' }}>Status</Text>
                              <Text style={{ fontSize: 12, fontWeight: '600', color: '#1f2937' }}>{kpayTxDetails.status || '—'}</Text>
                            </View>
                            {kpayTxDetails.payResult !== undefined && (
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                                <Text style={{ fontSize: 12, color: '#6b7280' }}>payResult</Text>
                                <Text style={{ fontSize: 12, color: '#1f2937' }}>{(KPAY_RESULT_MAP as any)[kpayTxDetails.payResult] || kpayTxDetails.payResult}</Text>
                              </View>
                            )}
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                              <Text style={{ fontSize: 12, color: '#6b7280' }}>outTradeNo</Text>
                              <Text style={{ fontSize: 11, color: '#1f2937', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}>{kpayTxDetails.outTradeNo || '—'}</Text>
                            </View>
                            {kpayTxDetails.transactionNo && (
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                                <Text style={{ fontSize: 12, color: '#6b7280' }}>transactionNo</Text>
                                <Text style={{ fontSize: 11, color: '#1f2937', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}>{kpayTxDetails.transactionNo}</Text>
                              </View>
                            )}
                            {kpayTxDetails.refNo && (
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                                <Text style={{ fontSize: 12, color: '#6b7280' }}>refNo</Text>
                                <Text style={{ fontSize: 11, color: '#1f2937', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}>{kpayTxDetails.refNo}</Text>
                              </View>
                            )}
                            {kpayTxDetails.commitTime && (
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                                <Text style={{ fontSize: 12, color: '#6b7280' }}>commitTime</Text>
                                <Text style={{ fontSize: 12, color: '#1f2937' }}>{kpayTxDetails.commitTime}</Text>
                              </View>
                            )}
                            {kpayTxDetails.payMethod !== undefined && (
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                                <Text style={{ fontSize: 12, color: '#6b7280' }}>payMethod</Text>
                                <Text style={{ fontSize: 12, color: '#1f2937' }}>{KPAY_METHOD_MAP[kpayTxDetails.payMethod] || kpayTxDetails.payMethod}</Text>
                              </View>
                            )}
                            {kpayTxDetails.refund_amount_cents > 0 && (
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                                <Text style={{ fontSize: 12, color: '#ef4444' }}>Refunded</Text>
                                <Text style={{ fontSize: 12, fontWeight: '600', color: '#ef4444' }}>{formatPrice(kpayTxDetails.refund_amount_cents)}</Text>
                              </View>
                            )}
                          </>
                        )}
                      </View>
                    );
                  })()}

                  {/* Payment Asia Transaction Details */}
                  {(() => {
                    const vendor = resolveVendor(selectedHistoryOrder);
                    if (vendor !== 'payment-asia') return null;
                    const merchantRef = selectedHistoryOrder.cp_vendor_ref || selectedHistoryOrder.kpay_reference_id;
                    if (!merchantRef) return null;

                    return (
                      <View style={{ backgroundColor: '#fefce8', borderRadius: 10, padding: 12, marginTop: 12, borderWidth: 1, borderColor: '#fde68a' }}>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: '#92400e', marginBottom: 8 }}>Payment Asia Transaction Details</Text>
                        {txLoading && <ActivityIndicator size="small" color="#f59e0b" style={{ marginVertical: 8 }} />}
                        {paTxDetails?.records?.map((rec: any, idx: number) => {
                          const isSale = rec.type === '1' || rec.type === 'Sale';
                          return (
                            <View key={idx} style={{ marginBottom: idx < (paTxDetails.records.length - 1) ? 8 : 0 }}>
                              <Text style={{ fontSize: 11, fontWeight: '600', color: '#6b7280', marginBottom: 4 }}>
                                {isSale ? 'Sale' : `Record #${idx + 1}`}
                              </Text>
                              {selectedHistoryOrder.payment_network && (
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
                                  <Text style={{ fontSize: 12, color: '#6b7280' }}>Method</Text>
                                  <Text style={{ fontSize: 12, color: '#1f2937' }}>{selectedHistoryOrder.payment_network}</Text>
                                </View>
                              )}
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
                                <Text style={{ fontSize: 12, color: '#6b7280' }}>Amount</Text>
                                <Text style={{ fontSize: 12, color: '#1f2937' }}>{rec.currency || 'HKD'} {rec.amount}</Text>
                              </View>
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
                                <Text style={{ fontSize: 12, color: '#6b7280' }}>Status</Text>
                                <Text style={{ fontSize: 12, fontWeight: '600', color: '#1f2937' }}>{PA_STATUS_MAP[rec.status] || rec.status}</Text>
                              </View>
                              {rec.request_reference && (
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
                                  <Text style={{ fontSize: 12, color: '#6b7280' }}>Request Ref</Text>
                                  <Text style={{ fontSize: 11, color: '#1f2937', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}>{rec.request_reference}</Text>
                                </View>
                              )}
                              {rec.created_time && (
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
                                  <Text style={{ fontSize: 12, color: '#6b7280' }}>Created</Text>
                                  <Text style={{ fontSize: 12, color: '#1f2937' }}>{new Date(Number(rec.created_time) * 1000).toLocaleString()}</Text>
                                </View>
                              )}
                              {rec.completed_time && (
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
                                  <Text style={{ fontSize: 12, color: '#6b7280' }}>Completed</Text>
                                  <Text style={{ fontSize: 12, color: '#1f2937' }}>{new Date(Number(rec.completed_time) * 1000).toLocaleString()}</Text>
                                </View>
                              )}
                            </View>
                          );
                        })}
                        {paTxDetails && !paTxDetails.records?.length && (
                          <Text style={{ fontSize: 12, color: '#9ca3af' }}>No transaction records found</Text>
                        )}
                      </View>
                    );
                  })()}

                  {/* Payment Records Ledger */}
                  {selectedHistoryOrder.payment_records && selectedHistoryOrder.payment_records.length > 0 && (
                    <View style={{ borderTopWidth: 1, borderTopColor: '#e5e7eb', marginTop: 12, paddingTop: 12 }}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: '#1f2937', marginBottom: 8 }}>Payment Ledger</Text>
                      {selectedHistoryOrder.payment_records.map((record: PaymentRecord, idx: number) => (
                        <View key={record.id || idx} style={{ backgroundColor: '#f9fafb', borderRadius: 8, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: '#e5e7eb' }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                            <Text style={{ fontSize: 12, fontWeight: '600', color: getVendorColor(record.payment_vendor) }}>
                              {getVendorLabel(record.payment_vendor)}
                            </Text>
                            <View style={{ backgroundColor: record.status === 'completed' ? '#d1fae5' : record.status === 'failed' ? '#fee2e2' : '#fef3c7', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 }}>
                              <Text style={{ fontSize: 10, fontWeight: '600', color: record.status === 'completed' ? '#065f46' : record.status === 'failed' ? '#991b1b' : '#92400e' }}>
                                {record.status?.toUpperCase()}
                              </Text>
                            </View>
                          </View>
                          {record.payment_method && (
                            <Text style={{ fontSize: 11, color: '#6b7280', marginBottom: 2 }}>Method: {record.payment_method}</Text>
                          )}
                          <Text style={{ fontSize: 12, fontWeight: '600', color: '#1f2937' }}>{formatPrice(record.amount_cents)} {record.currency_code || ''}</Text>
                          {record.vendor_reference && (
                            <Text style={{ fontSize: 10, color: '#9ca3af', marginTop: 2, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}>Ref: {record.vendor_reference}</Text>
                          )}
                          {record.completed_at && (
                            <Text style={{ fontSize: 10, color: '#9ca3af', marginTop: 1 }}>Completed: {formatDate(record.completed_at)}</Text>
                          )}
                          {record.refund_amount_cents && record.refund_amount_cents > 0 && (
                            <Text style={{ fontSize: 11, color: '#ef4444', marginTop: 2 }}>Refunded: {formatPrice(record.refund_amount_cents)}</Text>
                          )}
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Void / Refund Actions */}
                  {(() => {
                    const vendor = resolveVendor(selectedHistoryOrder);
                    const pStatus = selectedHistoryOrder.cp_status || selectedHistoryOrder.payment_status;
                    const isVoided = pStatus === 'voided' || pStatus === 'cancelled';
                    const isRefunded = pStatus === 'refunded';
                    if (isVoided || isRefunded) return null;

                    if (vendor === 'kpay' && kpayTerminal) {
                      // KPay: Void + Refund (calls terminal)
                      return (
                        <View style={{ borderTopWidth: 1, borderTopColor: '#e5e7eb', marginTop: 12, paddingTop: 12 }}>
                          <View style={{ flexDirection: 'row', gap: 8 }}>
                            <TouchableOpacity
                              style={{ flex: 1, backgroundColor: '#fef3c7', borderRadius: 8, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: '#f59e0b' }}
                              onPress={() => handleKpayVoid(selectedHistoryOrder)}
                            >
                              <Text style={{ fontSize: 13, fontWeight: '600', color: '#92400e' }}>🚫 Void</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={{ flex: 1, backgroundColor: '#fee2e2', borderRadius: 8, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: '#ef4444' }}
                              onPress={openKpayRefund}
                            >
                              <Text style={{ fontSize: 13, fontWeight: '600', color: '#991b1b' }}>💸 Refund</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    }

                    if (vendor === 'payment-asia') {
                      // Payment Asia: Refund only (calls PA API)
                      return (
                        <View style={{ borderTopWidth: 1, borderTopColor: '#e5e7eb', marginTop: 12, paddingTop: 12 }}>
                          <TouchableOpacity
                            style={{ backgroundColor: '#fee2e2', borderRadius: 8, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: '#ef4444' }}
                            onPress={openPaRefund}
                          >
                            <Text style={{ fontSize: 13, fontWeight: '600', color: '#991b1b' }}>↩️ Refund via Payment Asia</Text>
                          </TouchableOpacity>
                        </View>
                      );
                    }

                    // Cash/Card (manual): Refund only
                    if (!vendor || vendor === 'cash' || vendor === 'card') {
                      const effStatus = pStatus || '';
                      if (effStatus === 'completed' || effStatus === 'paid' || !effStatus) {
                        return (
                          <View style={{ borderTopWidth: 1, borderTopColor: '#e5e7eb', marginTop: 12, paddingTop: 12 }}>
                            <TouchableOpacity
                              style={{ backgroundColor: '#fee2e2', borderRadius: 8, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: '#ef4444' }}
                              onPress={() => handleRefundOrder(selectedHistoryOrder.id)}
                            >
                              <Text style={{ fontSize: 13, fontWeight: '600', color: '#991b1b' }}>💸 Refund</Text>
                            </TouchableOpacity>
                          </View>
                        );
                      }
                    }
                    return null;
                  })()}
                        );
                      }
                    }
                    return null;
                  })()}
                </ScrollView>
              ) : (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                  <Ionicons name="receipt-outline" size={36} color="#d1d5db" />
                  <Text style={{ color: '#9ca3af', fontSize: 13, marginTop: 8 }}>Select an order to view details</Text>
                </View>
              )}
            </View>
          )}
        </View>
        </>
      );
    }

    // ============= MENU VIEW (DEFAULT) =============
    const menuScreenWidth = Dimensions.get('window').width;
    const menuIsTablet = (Platform as any).isPad;
    const menuNumColumns = menuIsTablet ? (menuScreenWidth > 1100 ? 4 : 3) : (menuScreenWidth > 500 ? 3 : 2);

    const cartPanel = (
      <View style={menuIsTablet ? styles.rightPanel : styles.bottomPanel}>
      <ScrollView style={{ flex: 1 }}>
        {/* Cart Header */}
        <View style={styles.cartHeader}>
          <Text style={styles.cartHeaderTitle}>Cart</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {cart.length > 0 && (
              <TouchableOpacity onPress={() => setCartEditMode(!cartEditMode)} style={[styles.cartEditToggle, cartEditMode && { backgroundColor: '#667eea' }]}>
                <Ionicons name="pencil" size={14} color={cartEditMode ? '#fff' : '#667eea'} />
                <Text style={[styles.cartEditToggleText, cartEditMode && styles.cartEditToggleTextActive]}>
                  {cartEditMode ? 'Done' : 'Edit'}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => { setCart([]); setCartEditMode(false); }}>
              <Text style={styles.cartClearBtn}>Clear</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Cart items */}
        {cart.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 32 }}>
            <Ionicons name="cart-outline" size={36} color="#d1d5db" />
            <Text style={{ color: '#9ca3af', fontSize: 13, marginTop: 8 }}>No items in cart</Text>
          </View>
        ) : (
        <View style={styles.cartItemsList}>
          {cart.map((item, idx) => (
            <View key={idx} style={styles.cartItemRow}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={styles.cartItemPreviewText} numberOfLines={1}>
                    {item.name} x{item.quantity}
                  </Text>
                  <Text style={styles.cartItemPriceText}>
                    {formatPrice(item.price_cents * item.quantity)}
                  </Text>
                </View>
                {item.variants && item.variants.length > 0 && (
                  <View style={{ marginTop: 2 }}>
                    {item.variants.map((v, vi) => (
                      <Text key={vi} style={styles.cartItemVariantText} numberOfLines={1}>
                        {v.variantName}: {v.optionName}
                      </Text>
                    ))}
                  </View>
                )}
                {/* Edit mode controls */}
                {cartEditMode && (
                  <View style={styles.cartEditControls}>
                    <View style={styles.cartQtyRow}>
                      <TouchableOpacity style={styles.cartQtyBtn} onPress={() => handleUpdateQuantity(idx, item.quantity - 1)}>
                        <Text style={styles.cartQtyBtnText}>−</Text>
                      </TouchableOpacity>
                      <Text style={styles.cartQtyValue}>{item.quantity}</Text>
                      <TouchableOpacity style={styles.cartQtyBtn} onPress={() => handleUpdateQuantity(idx, item.quantity + 1)}>
                        <Text style={styles.cartQtyBtnText}>+</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.cartRemoveBtn} onPress={() => handleRemoveFromCart(idx)}>
                        <Text style={{ fontSize: 16 }}>🗑</Text>
                      </TouchableOpacity>
                    </View>
                    <TextInput
                      style={styles.cartRemarksInput}
                      placeholder="Add remarks..."
                      placeholderTextColor="#9ca3af"
                      value={item.notes || ''}
                      onChangeText={(text) => handleUpdateNotes(idx, text)}
                      multiline
                    />
                  </View>
                )}
              </View>
              {!cartEditMode && (
                <TouchableOpacity onPress={() => handleRemoveFromCart(idx)} style={{ paddingLeft: 6 }}>
                  <Text style={styles.removeItemBtn}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>
        )}

        </ScrollView>
        {/* Order type selection + total - sticky at bottom */}
        <ScrollView style={{ flexShrink: 1, maxHeight: 200 }} bounces={false}>
        <View style={styles.orderTypeSection}>
          <Text style={styles.sectionLabel}>Order Type</Text>
          <View style={menuIsTablet ? styles.orderTypeButtonsVertical : styles.orderTypeButtons}>
            <TouchableOpacity
              style={[styles.orderTypeBtn, orderType === 'table' && styles.orderTypeBtnActive]}
              onPress={() => {
                openTablePicker();
              }}
            >
              <Text style={[styles.orderTypeBtnText, orderType === 'table' && styles.orderTypeBtnTextActive]}>
                {selectedTableName ? `Table — ${selectedTableName}${selectedOrderId ? `, #${selectedOrderId}` : ''}` : (selectedTableOnInit ? `Table — ${selectedTableOnInit.tableName || 'Selected'}` : 'Table')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.orderTypeBtn, orderType === 'pay-now' && styles.orderTypeBtnActive]}
              onPress={() => setOrderType('pay-now')}
            >
              <Text style={[styles.orderTypeBtnText, orderType === 'pay-now' && styles.orderTypeBtnTextActive]}>
                Order Now
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.orderTypeBtn, orderType === 'to-go' && styles.orderTypeBtnActive]}
              onPress={() => setOrderType('to-go')}
            >
              <Text style={[styles.orderTypeBtnText, orderType === 'to-go' && styles.orderTypeBtnTextActive]}>
                To-Go
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        </ScrollView>

        {/* Cart total and submit */}
        <View style={styles.cartFooterSection}>
          <View style={styles.cartTotalRow}>
            <Text style={styles.cartTotalLabel}>Total ({cart.length} items)</Text>
            <Text style={styles.cartTotalPrice}>{formatPrice(cartTotal)}</Text>
          </View>
          <TouchableOpacity 
            style={[
              styles.submitBtn,
              (!orderType || (orderType === 'table' && !selectedTable)) && styles.submitBtnDisabled
            ]}
            disabled={!orderType || (orderType === 'table' && !selectedTable)}
            onPress={handleSubmitOrder}
          >
            <Text style={styles.submitBtnText}>SUBMIT ORDER</Text>
          </TouchableOpacity>
        </View>
      </View>
    );

    return (
      <>
        <View style={[styles.container, menuIsTablet && styles.containerRow]}>
          {/* Left: Menu area */}
          <View style={menuIsTablet ? styles.menuAreaTablet : { flex: 1 }}>
            {/* Food Items Grid Wrapper */}
            <View style={styles.foodItemsGridWrapper}>
              <FlatList
                key={`menu-${selectedCategory}-${menuNumColumns}`}
                data={(() => {
                  const remainder = filteredMenuItems.length % menuNumColumns;
                  if (remainder === 0) return filteredMenuItems;
                  const spacers = Array.from({ length: menuNumColumns - remainder }, (_, i) => ({ id: `spacer-${i}`, isSpacer: true }));
                  return [...filteredMenuItems, ...spacers];
                })()}
                keyExtractor={(item: any) => item.id.toString()}
                numColumns={menuNumColumns}
                columnWrapperStyle={styles.gridRow}
                renderItem={({ item }: any) => {
                if (item.isSpacer) {
                  return <View style={styles.menuItemContainer} />;
                }
                return (
                <View style={styles.menuItemContainer}>
                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => handleItemPress(item)}
                  >
                    {item.image_url && item.image_url.trim() ? (
                      <Image
                        source={{ uri: getFullImageUrl(item.image_url)! }}
                        style={styles.menuItemImage}
                        onError={() => console.log('Image load error for:', item.name, 'URL:', getFullImageUrl(item.image_url))}
                      />
                    ) : (
                      <Image
                        source={{ uri: `${API_URL}/uploads/website/placeholder.png` }}
                        style={styles.menuItemImage}
                      />
                    )}
                    <View style={styles.menuItemInfo}>
                      <Text style={styles.menuItemName} numberOfLines={2}>{item.name}</Text>
                      <View style={styles.menuItemFooter}>
                        <Text style={styles.menuItemPrice}>{formatPrice(item.price_cents)}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                </View>
              );}}
              contentContainerStyle={styles.menuGrid}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadMenu} />}
            />
            </View>

            {/* Category Bar at bottom - matching webapp */}
            <View style={styles.categoryBarWrapper}>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoriesContent}
              >
                {categories.map(cat => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.categoryBtn,
                      selectedCategory === cat.id && styles.categoryBtnActive
                    ]}
                    onPress={() => setSelectedCategory(cat.id)}
                  >
                    <Text style={[
                      styles.categoryBtnText,
                      selectedCategory === cat.id && styles.categoryBtnTextActive
                    ]}>
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Bottom panel for phone only */}
            {!menuIsTablet && cart.length > 0 && cartPanel}
          </View>

          {/* Right panel: Cart (iPad only - always visible) */}
          {menuIsTablet && cartPanel}
        </View>

        {/* Variant Modal */}
        <Modal supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}
          visible={showVariantModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowVariantModal(false)}
        >
          <View style={[styles.modalOverlay, menuIsTablet && { flexDirection: 'row', justifyContent: 'flex-end' }]}>
            <View style={[styles.variantModalContent, menuIsTablet && { maxHeight: '100%', width: 380, borderTopLeftRadius: 0, borderTopRightRadius: 0, borderTopLeftRadius: 16, borderBottomLeftRadius: 16 }]}>
              {/* Header with image, name, price in one compact row */}
              <View style={styles.variantModalHeader}>
                <TouchableOpacity onPress={() => setShowVariantModal(false)}>
                  <Text style={styles.closeButton}>✕</Text>
                </TouchableOpacity>
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, marginLeft: 8 }}>
                  {selectedItem?.image_url && selectedItem.image_url.trim() ? (
                    <Image
                      source={{ uri: getFullImageUrl(selectedItem.image_url)! }}
                      style={{ width: 50, height: 50, borderRadius: 6, backgroundColor: '#f0f0f0' }}
                    />
                  ) : null}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.variantModalTitle} numberOfLines={1}>{selectedItem?.name}</Text>
                    {selectedItem?.description ? (
                      <Text style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }} numberOfLines={1}>{selectedItem.description}</Text>
                    ) : null}
                  </View>
                  <Text style={styles.itemPrice}>{formatPrice(selectedItem?.price_cents || 0)}</Text>
                </View>
              </View>

              <ScrollView style={styles.variantContent}>
                {itemVariants.length > 0 ? (
                  itemVariants.map((variant) => (
                    <View key={variant.id} style={styles.variantGroup}>
                      <View style={styles.variantGroupHeader}>
                        <Text style={styles.variantGroupName}>{variant.name}</Text>
                        {variant.required && <Text style={styles.requiredBadge}>Required</Text>}
                      </View>

                      <View style={styles.variantOptionsGrid}>
                      {variant.min_select === 1 && variant.max_select === 1 ? (
                        variant.options.map((option) => (
                          <TouchableOpacity
                            key={option.id}
                            style={styles.variantOption}
                            onPress={() => {
                              setVariantSelections(prev => ({
                                ...prev,
                                [variant.id]: option.id,
                              }));
                            }}
                          >
                            <View
                              style={[
                                styles.radioButton,
                                variantSelections[variant.id] === option.id && styles.radioButtonSelected,
                              ]}
                            />
                            <View style={styles.variantOptionContent}>
                              <Text style={styles.variantOptionName}>{option.name}</Text>
                              {option.price_cents > 0 && (
                                <Text style={styles.variantOptionPrice}>+{formatPrice(option.price_cents)}</Text>
                              )}
                            </View>
                          </TouchableOpacity>
                        ))
                      ) : (
                        variant.options.map((option) => {
                          const selected = Array.isArray(variantSelections[variant.id])
                            ? (variantSelections[variant.id] as number[]).includes(option.id)
                            : false;
                          return (
                            <TouchableOpacity
                              key={option.id}
                              style={styles.variantOption}
                              onPress={() => {
                                setVariantSelections(prev => {
                                  const current = Array.isArray(prev[variant.id]) ? [...(prev[variant.id] as number[])] : [];
                                  if (current.includes(option.id)) {
                                    current.splice(current.indexOf(option.id), 1);
                                  } else {
                                    current.push(option.id);
                                  }
                                  return {
                                    ...prev,
                                    [variant.id]: current,
                                  };
                                });
                              }}
                            >
                              <View
                                style={[
                                  styles.checkbox,
                                  selected && styles.checkboxSelected,
                                ]}
                              />
                              <View style={styles.variantOptionContent}>
                                <Text style={styles.variantOptionName}>{option.name}</Text>
                                {option.price_cents > 0 && (
                                  <Text style={styles.variantOptionPrice}>+{formatPrice(option.price_cents)}</Text>
                                )}
                              </View>
                            </TouchableOpacity>
                          );
                        })
                      )}
                      </View>
                    </View>
                  ))
                ) : null}
              </ScrollView>

              <View style={styles.variantModalFooter}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setShowVariantModal(false)}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.addBtn}
                  onPress={handleVariantSubmit}
                >
                  <Text style={styles.addBtnText}>Add to Cart</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Table Picker Modal */}
        <Modal
          supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}
          visible={showTablePicker}
          animationType="fade"
          transparent
          onRequestClose={() => setShowTablePicker(false)}
        >
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
            <View style={{ backgroundColor: '#fff', borderRadius: 12, width: '90%', maxWidth: 500, maxHeight: '80%', padding: 16 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text style={{ fontSize: 18, fontWeight: '700', color: '#1f2937' }}>Select Table</Text>
                <TouchableOpacity onPress={() => setShowTablePicker(false)}>
                  <Ionicons name="close" size={24} color="#374151" />
                </TouchableOpacity>
              </View>
              {tablePickerLoading ? (
                <ActivityIndicator size="large" color="#3b82f6" style={{ marginVertical: 40 }} />
              ) : (
                <ScrollView style={{ maxHeight: 500 }}>
                  {tablePickerData.map((table) => (
                    <View key={table.id} style={{ borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, marginBottom: 8, overflow: 'hidden' }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, backgroundColor: table.sessions.length > 0 ? '#f0fdf4' : '#f9fafb' }}>
                        <View>
                          <Text style={{ fontSize: 16, fontWeight: '600', color: '#1f2937' }}>{table.name}</Text>
                          <Text style={{ fontSize: 12, color: '#6b7280' }}>
                            {table.sessions.length > 0 ? `${table.sessions.length} active order${table.sessions.length > 1 ? 's' : ''}` : 'No active orders'}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={{ backgroundColor: '#3b82f6', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6 }}
                          onPress={() => startNewOrderOnTable(table)}
                        >
                          <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>New Order</Text>
                        </TouchableOpacity>
                      </View>
                      {table.sessions.map((session: any) => {
                        const elapsed = Math.floor((Date.now() - new Date(session.started_at).getTime()) / 60000);
                        return (
                          <TouchableOpacity
                            key={session.id}
                            style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderTopWidth: 1, borderTopColor: '#e5e7eb', backgroundColor: '#fff' }}
                            onPress={() => selectTableOrder(table, session)}
                          >
                            <View>
                              <Text style={{ fontSize: 14, fontWeight: '500', color: '#374151' }}>
                                {session.order_id ? `Order #${session.order_id}` : `Order`} • {session.pax} pax
                              </Text>
                              <Text style={{ fontSize: 12, color: '#9ca3af' }}>⏱ {elapsed}m</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ))}
                  {tablePickerData.length === 0 && (
                    <Text style={{ textAlign: 'center', color: '#9ca3af', paddingVertical: 20 }}>No tables found</Text>
                  )}
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>

        {/* New Order Pax Modal */}
        <Modal
          supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}
          visible={showNewOrderPaxModal}
          animationType="fade"
          transparent
          onRequestClose={() => setShowNewOrderPaxModal(false)}
        >
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
            <View style={{ backgroundColor: '#fff', borderRadius: 12, width: '80%', maxWidth: 360, padding: 20 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#1f2937', marginBottom: 16 }}>
                New Order — {pendingTableForNewOrder?.name}
              </Text>
              <Text style={{ fontSize: 14, color: '#6b7280', marginBottom: 6 }}>Number of guests</Text>
              <TextInput
                style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 10, fontSize: 16, marginBottom: 16 }}
                keyboardType="number-pad"
                value={newOrderPax}
                onChangeText={setNewOrderPax}
                placeholder="1"
              />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  style={{ flex: 1, backgroundColor: '#e5e7eb', borderRadius: 8, padding: 12, alignItems: 'center' }}
                  onPress={() => setShowNewOrderPaxModal(false)}
                >
                  <Text style={{ fontWeight: '600', color: '#374151' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flex: 1, backgroundColor: '#3b82f6', borderRadius: 8, padding: 12, alignItems: 'center' }}
                  onPress={confirmNewOrderOnTable}
                >
                  <Text style={{ fontWeight: '600', color: '#fff' }}>Start Order</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* KPay Refund Modal */}
        <Modal
          supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}
          visible={showKpayRefundModal}
          animationType="fade"
          transparent
          onRequestClose={() => setShowKpayRefundModal(false)}
        >
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
            <View style={{ backgroundColor: '#fff', borderRadius: 12, width: '80%', maxWidth: 400, padding: 20 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#1f2937', marginBottom: 4 }}>KPay Refund</Text>
              <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 16 }}>
                Ref: {selectedHistoryOrder?.kpay_reference_id || '—'}
              </Text>
              <Text style={{ fontSize: 14, color: '#374151', marginBottom: 4 }}>Refund Amount (leave blank for full)</Text>
              <TextInput
                style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 10, fontSize: 16, marginBottom: 12 }}
                keyboardType="numeric"
                value={kpayRefundAmount}
                onChangeText={setKpayRefundAmount}
                placeholder="Full refund"
              />
              <Text style={{ fontSize: 14, color: '#374151', marginBottom: 4 }}>Manager Password *</Text>
              <TextInput
                style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 10, fontSize: 16, marginBottom: 16 }}
                secureTextEntry
                value={kpayManagerPassword}
                onChangeText={setKpayManagerPassword}
                placeholder="Required"
              />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  style={{ flex: 1, backgroundColor: '#e5e7eb', borderRadius: 8, padding: 12, alignItems: 'center' }}
                  onPress={() => setShowKpayRefundModal(false)}
                >
                  <Text style={{ fontWeight: '600', color: '#374151' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flex: 1, backgroundColor: '#ef4444', borderRadius: 8, padding: 12, alignItems: 'center' }}
                  onPress={submitKpayRefund}
                >
                  <Text style={{ fontWeight: '600', color: '#fff' }}>Submit Refund</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Payment Asia Refund Modal */}
        <Modal
          supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}
          visible={showPaRefundModal}
          animationType="fade"
          transparent
          onRequestClose={() => setShowPaRefundModal(false)}
        >
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
            <View style={{ backgroundColor: '#fff', borderRadius: 12, width: '80%', maxWidth: 400, padding: 20 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#1f2937', marginBottom: 4 }}>Payment Asia Refund</Text>
              <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 16 }}>
                Ref: {selectedHistoryOrder?.cp_vendor_ref || selectedHistoryOrder?.kpay_reference_id || '—'}
              </Text>
              <Text style={{ fontSize: 14, color: '#374151', marginBottom: 4 }}>Refund Amount ($)</Text>
              <TextInput
                style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 10, fontSize: 16, marginBottom: 16 }}
                keyboardType="numeric"
                value={paRefundAmount}
                onChangeText={setPaRefundAmount}
                placeholder="0.00"
              />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  style={{ flex: 1, backgroundColor: '#e5e7eb', borderRadius: 8, padding: 12, alignItems: 'center' }}
                  onPress={() => setShowPaRefundModal(false)}
                >
                  <Text style={{ fontWeight: '600', color: '#374151' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flex: 1, backgroundColor: '#ef4444', borderRadius: 8, padding: 12, alignItems: 'center' }}
                  onPress={submitPaRefund}
                >
                  <Text style={{ fontWeight: '600', color: '#fff' }}>Submit Refund</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </>
    );
};

export const OrdersTab = React.forwardRef(OrdersTabComponent) as React.ForwardRefExoticComponent<
  OrdersTabProps & React.RefAttributes<OrdersTabRef>
>;

// Helper for order payment badge
const getPaymentBadge = (order: Order) => {
  const effStatus = order.cp_status || order.payment_status;
  if (effStatus === 'refunded' || order.cp_refunded_at) {
    return { label: '↩ Refunded', color: '#ef4444' };
  }
  if (effStatus === 'voided' || effStatus === 'cancelled') {
    return { label: '🚫 Voided', color: '#6b7280' };
  }
  if (order.cp_refund_amount_cents && order.cp_refund_amount_cents > 0) {
    return { label: '↩ Partial', color: '#f97316' };
  }
  if (order.payment_received || effStatus === 'completed' || effStatus === 'paid') {
    return { label: '✓ Paid', color: '#10b981' };
  }
  return { label: 'Unpaid', color: '#9ca3af' };
};

const getVendorLabel = (vendor?: string) => {
  if (!vendor) return '';
  const map: Record<string, string> = {
    kpay: 'KPay Terminal',
    'payment-asia': 'Payment Asia',
    cash: 'Cash',
    card: 'Card',
  };
  return map[vendor] || vendor;
};

const getVendorColor = (vendor?: string) => {
  if (!vendor) return '#6b7280';
  const map: Record<string, string> = {
    kpay: '#1a73e8',
    'payment-asia': '#7c3aed',
    cash: '#059669',
    card: '#2563eb',
  };
  return map[vendor] || '#6b7280';
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
  
  // History view
  historyDetailPanel: {
    width: 320,
    backgroundColor: '#fff',
    borderLeftWidth: 1,
    borderLeftColor: '#e5e7eb',
    padding: 16,
  },
  historyHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C3E50',
  },
  historyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    flex: 1,
  },
  listContent: {
    padding: 12,
  },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  orderCardSelected: {
    borderColor: '#667eea',
    backgroundColor: '#eef2ff',
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderId: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  orderDetails: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 4,
  },
  orderTotal: {
    fontSize: 14,
    fontWeight: '700',
    color: '#667eea',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
  errorContainer: {
    backgroundColor: '#fee',
    padding: 12,
    borderRadius: 8,
    margin: 12,
  },
  errorText: {
    color: '#c33',
    fontSize: 13,
  },

  // Menu view
  categoryBarWrapper: {
    flex: 0,
    backgroundColor: '#f5f5f5',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  foodItemsGridWrapper: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  categoriesContent: {
    flexDirection: 'row',
    flexGrow: 1,
  },
  categoryBtn: {
    flex: 1,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#f5f5f5',
    borderRightWidth: 1,
    borderRightColor: '#e0e0e0',
  },
  categoryBtnActive: {
    backgroundColor: '#5a5a5a',
  },
  categoryBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  categoryBtnTextActive: {
    color: '#ffffff',
  },

  // Menu grid
  menuGrid: {
    padding: 12,
  },
  gridRow: {
    justifyContent: 'flex-start',
    marginBottom: 12,
    gap: 12,
  },
  menuItemContainer: {
    width: '23%',
    maxWidth: '23%',
  },
  menuItem: {
    backgroundColor: '#fff',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    height: 200,
  },
  menuItemImage: {
    width: '100%',
    height: 120,
    backgroundColor: '#f0f0f0',
  },
  noImage: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuItemInfo: {
    padding: 10,
    flex: 1,
  },
  menuItemName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  menuItemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 'auto' as any,
  },
  menuItemPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2C3E50',
  },

  // Bottom panel
  bottomPanel: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    padding: 12,
    paddingBottom: 20,
  },
  // Right panel (iPad cart)
  rightPanel: {
    width: 280,
    backgroundColor: '#fff',
    borderLeftWidth: 1,
    borderLeftColor: '#e0e0e0',
    padding: 12,
    flexShrink: 0,
    flexDirection: 'column',
  },
  containerRow: {
    flexDirection: 'row',
  },
  menuAreaTablet: {
    flex: 1,
  },
  cartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    marginBottom: 12,
  },
  cartHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  cartClearBtn: {
    fontSize: 13,
    color: '#666',
    fontWeight: '600',
  },
  cartItemsList: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  cartItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: '#fafafa',
    borderWidth: 1,
    borderColor: '#f0f0f0',
    borderRadius: 4,
    marginBottom: 4,
  },
  orderTypeButtonsVertical: {
    flexDirection: 'column',
    gap: 6,
  },
  tableListWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  cartFooterSection: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 12,
    marginTop: 8,
  },
  cartTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cartItemPreviewText: {
    fontSize: 12,
    color: '#374151',
    flex: 1,
  },
  removeItemBtn: {
    fontSize: 14,
    color: '#ef4444',
    fontWeight: 'bold',
  },
  cartItemVariantText: {
    fontSize: 10,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 1,
  },
  cartItemPriceText: {
    fontSize: 12,
    color: '#2C3E50',
    fontWeight: '600',
    marginLeft: 8,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },

  // Order type
  orderTypeSection: {
    marginBottom: 12,
  },
  orderTypeButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  orderTypeBtn: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 6,
    backgroundColor: '#f9f9f9',
    borderWidth: 1,
    borderColor: '#ddd',
    justifyContent: 'center',
    minHeight: 40,
  },
  orderTypeBtnActive: {
    backgroundColor: '#2C3E50',
    borderColor: '#2C3E50',
  },
  orderTypeBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  orderTypeBtnTextActive: {
    color: '#fff',
  },

  // Table selection
  tableSelectionSection: {
    marginBottom: 12,
  },
  tableList: {
    marginBottom: 8,
  },
  tableBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#f0f0f0',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  tableBtnActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  tableBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  tableBtnTextActive: {
    color: '#fff',
  },

  // Cart footer
  cartTotalLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
  },
  cartTotalPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2C3E50',
    minWidth: 60,
    textAlign: 'right',
  },
  submitBtn: {
    backgroundColor: '#2c3e50',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%' as any,
  },
  submitBtnDisabled: {
    backgroundColor: '#ccc',
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase' as any,
  },

  // Modal styling
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  closeButton: {
    fontSize: 24,
    color: '#666',
    fontWeight: '600',
  },

  // Variant modal styling
  variantModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '95%',
    paddingTop: 0,
  },
  variantModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  variantModalTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  itemPrice: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  variantContent: {
    padding: 12,
    flex: 1,
  },
  variantGroup: {
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  variantGroupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  variantOptionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  variantGroupName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  requiredBadge: {
    backgroundColor: '#ef4444',
    color: '#fff',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 4,
    fontSize: 11,
    fontWeight: '600',
  },
  variantOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
    width: '50%',
  },
  radioButton: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#5a5a5a',
    marginRight: 8,
  },
  radioButtonSelected: {
    backgroundColor: '#5a5a5a',
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#5a5a5a',
    marginRight: 8,
  },
  checkboxSelected: {
    backgroundColor: '#5a5a5a',
  },
  variantOptionContent: {
    flex: 1,
  },
  variantOptionName: {
    fontSize: 13,
    color: '#1f2937',
  },
  variantOptionPrice: {
    fontSize: 11,
    color: '#2C3E50',
    fontWeight: '600',
  },
  variantModalFooter: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  addBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#10b981',
    alignItems: 'center',
  },
  addBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  cartEditToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#667eea',
  },
  cartEditToggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#667eea',
  },
  cartEditToggleTextActive: {
    color: '#fff',
  },
  cartEditControls: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e7eb',
  },
  cartQtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cartQtyBtn: {
    width: 28,
    height: 28,
    borderRadius: 4,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartQtyBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#374151',
  },
  cartQtyValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1f2937',
    minWidth: 20,
    textAlign: 'center',
  },
  cartRemoveBtn: {
    marginLeft: 8,
    padding: 4,
  },
  cartRemarksInput: {
    marginTop: 6,
    fontSize: 12,
    color: '#374151',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minHeight: 32,
  },
});
