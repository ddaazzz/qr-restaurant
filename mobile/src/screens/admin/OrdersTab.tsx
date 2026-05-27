import React, { useState, useEffect, useRef, useImperativeHandle } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, FlatList, RefreshControl, Alert, Image, Modal, Platform, Dimensions, TextInput, SafeAreaView, KeyboardAvoidingView } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import * as Print from 'expo-print';
import { Buffer } from 'buffer';
import { apiClient, API_URL } from '../../services/apiClient';
import { printerSettingsService } from '../../services/printerSettingsService';
import { thermalPrinterService } from '../../services/thermalPrinterService';
import { useTranslation } from '../../contexts/TranslationContext';
import { useToast } from '../../components/ToastProvider';
import Ionicons from '@react-native-vector-icons/ionicons';
import { kpaySign, kpayQuery, kpaySale, kpayVoid, kpayRefund, kpayClose, kpayQueryDirect, encryptManagerPassword, KPayTerminalConfig } from '../../services/kpayDirectService';
import { paOfflineCreateOrder, paOfflineQueryOrder, paOfflineVoidOrder, paOfflineRefundOrder, PATerminalConfig } from '../../services/paTerminalDirectService';

interface MenuItem {
  id: number;
  name: string;
  name_zh?: string;
  description?: string;
  price_cents: number;
  category_id: number;
  image_url?: string;
  is_meal_combo?: boolean;
}

interface Addon {
  id: number;
  addon_item_id: number;
  addon_name: string;
  addon_description?: string;
  regular_price_cents: number;
  addon_discount_price_cents: number;
  is_available: boolean;
  addon_item_name: string;
  addon_item_image?: string;
}

interface SelectedAddon {
  addon_id: number;
  addon_item_id: number;
  addon_item_name: string;
  addon_discount_price_cents: number;
  quantity: number;
  variants?: SelectedVariant[];
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
  name_zh?: string;
}

interface CartItem extends MenuItem {
  quantity: number;
  variants?: SelectedVariant[];
  notes?: string;
  addons?: SelectedAddon[];
}

interface SelectedVariant {
  variantId: number;
  variantName: string;
  optionId: number;
  optionName: string;
}

interface Order {
  id: number;
  restaurant_order_number?: number;
  session_id?: number;
  order_type: string;
  status: string;
  total_cents: number;
  created_at: string;
  items?: any[];
  table_id?: number;
  table_name?: string;
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
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
  void_vendor_ref?: string;
  refund_vendor_ref?: string;
  chuio_order_reference?: string;
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
  staffId?: string;
}

const OrdersTabComponent = (props: OrdersTabProps, ref: React.ForwardedRef<OrdersTabRef>) => {
  const { restaurantId, selectedTableOnInit, staffId } = props;
    const { t, lang } = useTranslation();
    const { showToast } = useToast();
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
    
    // Addon state
    const [itemAddons, setItemAddons] = useState<Addon[]>([]);
    const [selectedAddons, setSelectedAddons] = useState<SelectedAddon[]>([]);
    const [addonVariantModal, setAddonVariantModal] = useState<{ addon: Addon; variants: Variant[] } | null>(null);
    const [addonVariantSelections, setAddonVariantSelections] = useState<{ [variantId: number]: number | number[] }>({});
    
    // Cart state
    const [cart, setCart] = useState<CartItem[]>([]);
    const [cartEditMode, setCartEditMode] = useState(false);
    // Cart item edit modal
    const [cartEditModal, setCartEditModal] = useState<{ item: CartItem; idx: number } | null>(null);
    const [cartEditVariantSelections, setCartEditVariantSelections] = useState<{ [variantId: number]: number | number[] }>({});
    const [cartEditAddons, setCartEditAddons] = useState<SelectedAddon[]>([]);
    const [cartEditVariants, setCartEditVariants] = useState<Variant[]>([]);
    const [cartEditItemAddons, setCartEditItemAddons] = useState<Addon[]>([]);
    const [cartEditAddonVariantModal, setCartEditAddonVariantModal] = useState<{ addon: Addon; variants: Variant[] } | null>(null);
    const [cartEditAddonVariantSelections, setCartEditAddonVariantSelections] = useState<{ [variantId: number]: number | number[] }>({});
    const [showCartQtyNumpad, setShowCartQtyNumpad] = useState(false);
    const [cartQtyNumpadInput, setCartQtyNumpadInput] = useState('1');
    const [phoneView, setPhoneView] = useState<'menu' | 'variant' | 'cart'>('menu');
    const [orderType, setOrderType] = useState<'table' | 'pay-now' | 'to-go' | null>(null);
    const [selectedTable, setSelectedTable] = useState<string | null>(null);
    const [tables, setTables] = useState<any[]>([]);
    
    // Table picker state
    const [showTablePicker, setShowTablePicker] = useState(false);
    const [tablePickerData, setTablePickerData] = useState<any[]>([]);
    const [tablePickerLoading, setTablePickerLoading] = useState(false);
    const [selectedTableName, setSelectedTableName] = useState<string | null>(null);
    const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
    const [selectedOrderNumber, setSelectedOrderNumber] = useState<number | null>(null);
    const [newOrderPax, setNewOrderPax] = useState('1');
    const [showNewOrderPaxModal, setShowNewOrderPaxModal] = useState(false);
    const [pendingTableForNewOrder, setPendingTableForNewOrder] = useState<any>(null);

    // History state
    const [showHistory, setShowHistory] = useState(false);
    const [orders, setOrders] = useState<Order[]>([]);
    const [selectedHistoryOrder, setSelectedHistoryOrder] = useState<Order | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Payment modal state (for Order Now settle-on-submit)
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentModalSessionId, setPaymentModalSessionId] = useState<number | null>(null);
    const [paymentModalOrderId, setPaymentModalOrderId] = useState<number | null>(null);
    const [paymentModalOrderNumber, setPaymentModalOrderNumber] = useState<number | null>(null);
    const [paymentModalTotal, setPaymentModalTotal] = useState(0);
    const [paymentModalMethod, setPaymentModalMethod] = useState<string>('cash');
    const [paymentModalCashReceived, setPaymentModalCashReceived] = useState('');
    const [showOrderPaymentSuccess, setShowOrderPaymentSuccess] = useState(false);
    const [orderPaymentSuccessAmount, setOrderPaymentSuccessAmount] = useState(0);
    const [printingBill, setPrintingBill] = useState(false);
    const [printingKitchen, setPrintingKitchen] = useState(false);

    // KPay terminal payment processing state
    const [kpayProcessing, setKpayProcessing] = useState(false);
    const [kpayStatusMsg, setKpayStatusMsg] = useState('');
    const [kpayLogs, setKpayLogs] = useState<Array<{ msg: string; color: string }>>([]);
    const kpayPollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [kpayModalTitle, setKpayModalTitle] = useState<string | null>(null);
    // PA Offline: current order ID and config, kept in refs so abort can access them
    const paOfflineOrderIdRef = useRef<string | null>(null);
    const paOfflineConfigRef = useRef<PATerminalConfig | null>(null);
    // KPay: current trade number, config and private key for abort/close
    const kpayCurrentTradeNoRef = useRef<string | null>(null);
    const kpayConfigRef = useRef<KPayTerminalConfig | null>(null);
    const kpayPrivateKeyRef = useRef<string | null>(null);

    // Customer name prompt for To-Go orders
    const [showCustomerNameModal, setShowCustomerNameModal] = useState(false);
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');

    // Editable customer in order detail
    const [editingCustomer, setEditingCustomer] = useState(false);
    const [editCustomerName, setEditCustomerName] = useState('');
    const [editCustomerPhone, setEditCustomerPhone] = useState('');
    const [editCustomerEmail, setEditCustomerEmail] = useState('');
    const [customerSearchResults, setCustomerSearchResults] = useState<any[]>([]);
    const [customerSearchQuery, setCustomerSearchQuery] = useState('');
    const customerSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Email receipt state
    const [emailReceiptEnabled, setEmailReceiptEnabled] = useState(false);
    const [showEmailReceiptModal, setShowEmailReceiptModal] = useState(false);
    const [emailReceiptAddress, setEmailReceiptAddress] = useState('');
    const [emailReceiptSending, setEmailReceiptSending] = useState(false);
    const [emailReceiptSessionId, setEmailReceiptSessionId] = useState<number | null>(null);

    // History filter tab state
    const [historyFilter, setHistoryFilter] = useState<'all' | 'table' | 'pay-now' | 'to-go'>('all');
    const [historyTableFilter, setHistoryTableFilter] = useState<string>('');
    const [showHistoryFilterModal, setShowHistoryFilterModal] = useState(false);
    const [historyDateFilter, setHistoryDateFilter] = useState<'all' | 'today' | 'yesterday' | 'week' | 'custom'>('all');
    const [historyDateFrom, setHistoryDateFrom] = useState('');
    const [historyDateTo, setHistoryDateTo] = useState('');
    const [historyPaymentStatusFilter, setHistoryPaymentStatusFilter] = useState<'all' | 'paid' | 'unpaid' | 'pending' | 'refunded' | 'voided'>('all');
    const [historyPaymentMethodFilter, setHistoryPaymentMethodFilter] = useState<'all' | 'kpay' | 'payment-asia' | 'payment-asia-offline' | 'cash' | 'card'>('all');

    // Payment terminal state for refund/void
    const [kpayTerminal, setKpayTerminal] = useState<any>(null);
    const [paOfflineTerminal, setPaOfflineTerminal] = useState<any>(null);
    const [paOnlineEnabled, setPaOnlineEnabled] = useState(false);
    // Custom payment methods configured by admin
    const DEFAULT_PAYMENT_METHODS = [{ id: 'cash', label: 'Cash' }, { id: 'credit-card', label: 'Credit Card' }];
    const [customPaymentMethods, setCustomPaymentMethods] = useState<Array<{id: string, label: string}>>(DEFAULT_PAYMENT_METHODS);
    const [showKpayRefundModal, setShowKpayRefundModal] = useState(false);
    const [kpayRefundPassword, setKpayRefundPassword] = useState('');
    const [kpayOperationType, setKpayOperationType] = useState<'sale' | 'void' | 'refund'>('sale');
    const [showPaRefundModal, setShowPaRefundModal] = useState(false);
    const [paRefundAmount, setPaRefundAmount] = useState('');
    const [showPaOfflineRefundModal, setShowPaOfflineRefundModal] = useState(false);
    const [paOfflineRefundAmount, setPaOfflineRefundAmount] = useState('');
    const [paOfflineRefundTarget, setPaOfflineRefundTarget] = useState<Order | null>(null);

    // Live transaction details
    const [kpayTxDetails, setKpayTxDetails] = useState<any>(null);
    const [paTxDetails, setPaTxDetails] = useState<any>(null);
    const [paOfflineTxDetails, setPaOfflineTxDetails] = useState<any>(null);
    const [txLoading, setTxLoading] = useState(false);

    // Expose toggleHistory through ref
    useImperativeHandle(ref, () => ({
      toggleHistory() {
        setShowHistory(prev => !prev);
      }
    }), []);

    // Reset all history filters whenever the Order History view is opened
    useEffect(() => {
      if (showHistory) {
        setHistoryFilter('all');
        setHistoryTableFilter('');
        setHistoryDateFilter('all');
        setHistoryDateFrom('');
        setHistoryDateTo('');
        setHistoryPaymentStatusFilter('all');
        setHistoryPaymentMethodFilter('all');
        setSelectedHistoryOrder(null);
      }
    }, [showHistory]);

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
              restaurant_order_number: row.restaurant_order_number,
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
      setSelectedOrderNumber(session.restaurant_order_number || session.order_id || null);
      setOrderType('table');
      setShowTablePicker(false);
    };

    const startNewOrderOnTable = (table: any) => {
      setPendingTableForNewOrder(table);
      setNewOrderPax('1');
      // Close table picker first — iOS cannot present a modal on top of another modal
      // (Attempt to present RCTFabricModalHostViewController on UIViewController which
      //  is already presenting RCTFabricModalHostViewController)
      setShowTablePicker(false);
      setTimeout(() => setShowNewOrderPaxModal(true), 350);
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
        setSelectedOrderNumber(newSession.restaurant_order_number || newSession.order_id || null);
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
      loadKpayTerminal();
      // Load email receipt setting
      apiClient.get(`/api/restaurants/${restaurantId}/settings`)
        .then(res => {
          setEmailReceiptEnabled(!!res.data?.feature_flags?.email_receipt_enabled);
          const savedMethods = res.data?.feature_flags?.custom_payment_methods;
          if (Array.isArray(savedMethods) && savedMethods.length > 0) {
            setCustomPaymentMethods(savedMethods);
          }
          setPaOnlineEnabled(res.data?.active_payment_vendor === 'payment-asia');
        })
        .catch(() => {});
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
        if (res.data?.configured && res.data.terminal?.vendor_name === 'kpay') {
          setKpayTerminal(res.data.terminal);
        }
      } catch (err) {
        // No KPay terminal configured — that's fine
      }
      try {
        const termRes = await apiClient.get(`/api/restaurants/${restaurantId}/payment-terminals`);
        const paOff = (termRes.data || []).find((t: any) => t.vendor_name === 'payment-asia-offline' && t.is_active);
        setPaOfflineTerminal(paOff || null);
      } catch (err) {
        // No PA Offline terminal — that's fine
      }
    };

    // Search CRM customers by name or phone
    const searchCustomers = async (query: string) => {
      if (!query || query.length < 1) {
        setCustomerSearchResults([]);
        return;
      }
      try {
        const res = await apiClient.get(`/api/restaurants/${restaurantId}/crm/customers?search=${encodeURIComponent(query)}`);
        setCustomerSearchResults(res.data || []);
      } catch (err) {
        setCustomerSearchResults([]);
      }
    };

    const handleCustomerSearchInput = (text: string) => {
      setCustomerSearchQuery(text);
      setEditCustomerName(text);
      if (customerSearchTimer.current) clearTimeout(customerSearchTimer.current);
      customerSearchTimer.current = setTimeout(() => searchCustomers(text), 300);
    };

    const selectCrmCustomer = (customer: any) => {
      setEditCustomerName(customer.name || '');
      setEditCustomerPhone(customer.phone || '');
      setEditCustomerEmail(customer.email || '');
      setCustomerSearchResults([]);
      setCustomerSearchQuery('');
    };

    const saveCustomerEdit = async () => {
      if (!selectedHistoryOrder?.session_id) return;
      try {
        await apiClient.patch(`/api/sessions/${selectedHistoryOrder.session_id}/customer`, {
          customer_name: editCustomerName,
          customer_phone: editCustomerPhone,
          customer_email: editCustomerEmail,
        });
        // Update local state
        if (selectedHistoryOrder) {
          const updated = { ...selectedHistoryOrder, customer_name: editCustomerName, customer_phone: editCustomerPhone, customer_email: editCustomerEmail };
          setSelectedHistoryOrder(updated);
          setOrders((prev: Order[]) => prev.map((o: Order) => o.id === updated.id ? { ...o, customer_name: editCustomerName, customer_phone: editCustomerPhone, customer_email: editCustomerEmail } : o));
        }
        setEditingCustomer(false);
        showToast(t('orders.customer-saved'), 'success');
      } catch (err) {
        showToast(t('orders.customer-save-failed'), 'error');
      }
    };

    const sendEmailReceipt = async (email: string, sessionId?: number) => {
      const sid = sessionId || selectedHistoryOrder?.session_id;
      if (!sid || !email) return;
      setEmailReceiptSending(true);
      try {
        await apiClient.post(`/api/sessions/${sid}/receipts/send-email`, {
          restaurantId: parseInt(restaurantId),
          customerEmail: email,
        });
        showToast(t('orders.receipt-sent'), 'success');
        setShowEmailReceiptModal(false);
        setEmailReceiptAddress('');
      } catch (err: any) {
        showToast(t('orders.receipt-send-failed'), 'error');
      } finally {
        setEmailReceiptSending(false);
      }
    };

    const openEmailReceiptModal = (sessionId: number, prefilledEmail?: string) => {
      setEmailReceiptSessionId(sessionId);
      setEmailReceiptAddress(prefilledEmail || '');
      setShowEmailReceiptModal(true);
    };

    // Load live transaction details for the selected order
    const loadTransactionDetails = async (order: Order) => {
      setKpayTxDetails(null);
      setPaTxDetails(null);
      setPaOfflineTxDetails(null);
      const vendor = resolveVendor(order);
      const ref = order.kpay_reference_id || order.cp_vendor_ref;
      if (!ref) return;

      setTxLoading(true);
      try {
        if (vendor === 'kpay') {
          // Try backend first — has DB status for voided/refunded orders
          let details: any = null;
          try {
            const res = await apiClient.get(`/api/restaurants/${restaurantId}/kpay-transactions/${ref}`);
            details = res.data;
          } catch (_) {
            // 404 = mobile-initiated order (no kpay_transactions row) — fall through to direct query
          }

          // If backend has no live data (Render can't reach LAN terminal), query directly from device
          if (kpayTerminal && (!details || !details.transactionNo)) {
            try {
              const terminalRes = await apiClient.get(`/api/restaurants/${restaurantId}/payment-terminals/${kpayTerminal.id}`);
              const tc = terminalRes.data;
              const config: KPayTerminalConfig = {
                terminalIp: tc.terminal_ip,
                terminalPort: tc.terminal_port,
                appId: tc.app_id,
                appSecret: tc.app_secret,
                endpointPath: tc.endpoint_path || '/v2/pos/sign',
              };
              const live = await kpayQueryDirect(config, ref);
              if (live.success) {
                details = {
                  ...(details || {}),
                  outTradeNo: live.outTradeNo || ref,
                  payAmount: live.payAmount,
                  payCurrency: live.payCurrency,
                  transactionNo: live.transactionNo,
                  refNo: live.refNo,
                  commitTime: live.commitTime,
                  payMethod: live.payMethod,
                  payResult: live.payResult,
                  // Keep DB voided/refunded status; otherwise use live result
                  status: (details?.status === 'voided' || details?.status === 'refunded')
                    ? details.status
                    : (live.payResult === 2 ? 'completed' : details?.status || live.status.toLowerCase()),
                };
              }
            } catch (_) {
              // Direct query failed (terminal off/unreachable) — show DB data if available
            }
          }

          if (details) setKpayTxDetails(details);
        } else if (vendor === 'payment-asia') {
          // kpay_reference_id holds chuio_order_reference for PA Online orders
          // (backend aliases COALESCE(o.chuio_order_reference,...) AS kpay_reference_id)
          const merchantRef = order.kpay_reference_id || order.chuio_order_reference || order.cp_vendor_ref || ref;
          const res = await apiClient.get(`/api/restaurants/${restaurantId}/pa-online-details?merchant_reference=${encodeURIComponent(merchantRef)}`);
          setPaTxDetails(res.data);
        } else if (vendor === 'payment-asia-offline') {
          const res = await apiClient.get(`/api/restaurants/${restaurantId}/pa-offline-transactions/${ref}?skip_live=1`);
          setPaOfflineTxDetails(res.data);
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
        // Load variants and addons in parallel
        const [variantRes, addonRes] = await Promise.all([
          apiClient.get(`/api/menu-items/${item.id}/variants`),
          item.is_meal_combo
            ? apiClient.get(`/api/restaurants/${restaurantId}/menu-items/${item.id}/addons`)
            : Promise.resolve({ data: [] }),
        ]);
        const variants = variantRes.data || [];
        const addons = addonRes.data || [];
        
        if (variants.length > 0 || addons.length > 0) {
          setSelectedItem(item);
          setVariantSelections({});
          setItemVariants(variants);
          setItemAddons(addons);
          setSelectedAddons([]);
          setAddonVariantModal(null);
          const isPhone = !(Platform as any).isPad;
          if (isPhone) {
            setPhoneView('variant');
          } else {
            setShowVariantModal(true);
          }
        } else {
          handleAddToCart(item, []);
        }
      } catch (err) {
        console.error('Error loading variants:', err);
        handleAddToCart(item, []);
      }
    };

    const handleAddToCart = (item: MenuItem, selectedVariantsList: SelectedVariant[] = [], addonsList: SelectedAddon[] = []) => {
      setCart(prevCart => [...prevCart, {
        ...item,
        quantity: 1,
        variants: selectedVariantsList,
        addons: addonsList,
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

      handleAddToCart(selectedItem, selectedVariantsList, selectedAddons);
      const isPhone = !(Platform as any).isPad;
      if (isPhone) {
        setPhoneView('menu');
      } else {
        setShowVariantModal(false);
      }
    };

    // Toggle addon selection (simple on/off)
    const toggleAddon = async (addon: Addon) => {
      const existing = selectedAddons.find(a => a.addon_id === addon.id);
      if (existing) {
        // Deselect
        setSelectedAddons(prev => prev.filter(a => a.addon_id !== addon.id));
        return;
      }
      // Check if addon item has variants
      try {
        const res = await apiClient.get(`/api/menu-items/${addon.addon_item_id}/variants`);
        const variants = res.data || [];
        if (variants.length > 0) {
          // Show addon variant sub-modal
          setAddonVariantModal({ addon, variants });
          setAddonVariantSelections({});
        } else {
          // No variants — add directly
          setSelectedAddons(prev => [...prev, {
            addon_id: addon.id,
            addon_item_id: addon.addon_item_id,
            addon_item_name: addon.addon_item_name,
            addon_discount_price_cents: addon.addon_discount_price_cents,
            quantity: 1,
          }]);
        }
      } catch {
        // Fallback: add without variants
        setSelectedAddons(prev => [...prev, {
          addon_id: addon.id,
          addon_item_id: addon.addon_item_id,
          addon_item_name: addon.addon_item_name,
          addon_discount_price_cents: addon.addon_discount_price_cents,
          quantity: 1,
        }]);
      }
    };

    // Confirm addon variant selection
    const confirmAddonVariant = () => {
      if (!addonVariantModal) return;
      const { addon, variants } = addonVariantModal;
      // Validate required
      for (const v of variants) {
        if (v.required && !addonVariantSelections[v.id]) {
          Alert.alert('Missing Selection', `Please select ${v.name}`);
          return;
        }
      }
      const variantsList: SelectedVariant[] = [];
      Object.entries(addonVariantSelections).forEach(([variantId, optionIds]) => {
        const variant = variants.find(v => v.id === parseInt(variantId));
        if (variant) {
          const arr = Array.isArray(optionIds) ? optionIds : [optionIds];
          arr.forEach(optionId => {
            const option = variant.options.find(o => o.id === optionId);
            if (option) {
              variantsList.push({ variantId: variant.id, variantName: variant.name, optionId: option.id, optionName: option.name });
            }
          });
        }
      });
      setSelectedAddons(prev => [...prev, {
        addon_id: addon.id,
        addon_item_id: addon.addon_item_id,
        addon_item_name: addon.addon_item_name,
        addon_discount_price_cents: addon.addon_discount_price_cents,
        quantity: 1,
        variants: variantsList,
      }]);
      setAddonVariantModal(null);
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

    // Open the cart item edit modal — loads variants & addons then pre-fills selections
    const openCartEditModal = async (item: CartItem, idx: number) => {
      try {
        const [variantRes, addonRes] = await Promise.all([
          apiClient.get(`/api/menu-items/${item.id}/variants`),
          item.is_meal_combo
            ? apiClient.get(`/api/restaurants/${restaurantId}/menu-items/${item.id}/addons`)
            : Promise.resolve({ data: [] }),
        ]);
        const variants: Variant[] = variantRes.data || [];
        const addons: Addon[] = addonRes.data || [];

        // Pre-fill variant selections from current cart item
        const prefillVariants: { [variantId: number]: number | number[] } = {};
        if (item.variants) {
          item.variants.forEach(sv => {
            const variant = variants.find(v => v.id === sv.variantId);
            if (!variant) return;
            const isSingle = variant.min_select === 1 && variant.max_select === 1;
            if (isSingle) {
              prefillVariants[sv.variantId] = sv.optionId;
            } else {
              const cur = Array.isArray(prefillVariants[sv.variantId]) ? [...(prefillVariants[sv.variantId] as number[])] : [];
              cur.push(sv.optionId);
              prefillVariants[sv.variantId] = cur;
            }
          });
        }

        setCartEditVariants(variants);
        setCartEditItemAddons(addons);
        setCartEditVariantSelections(prefillVariants);
        setCartEditAddons(item.addons ? [...item.addons] : []);
        setCartEditAddonVariantModal(null);
        setCartEditAddonVariantSelections({});
        setCartQtyNumpadInput(String(item.quantity));
        setShowCartQtyNumpad(false);
        setCartEditModal({ item, idx });
      } catch (err) {
        // If we can't load variants (network error), still open with just qty/notes
        setCartEditVariants([]);
        setCartEditItemAddons([]);
        setCartEditVariantSelections({});
        setCartEditAddons(item.addons ? [...item.addons] : []);
        setCartEditAddonVariantModal(null);
        setCartQtyNumpadInput(String(item.quantity));
        setShowCartQtyNumpad(false);
        setCartEditModal({ item, idx });
      }
    };

    // Save edits back to cart
    const saveCartEdit = () => {
      if (!cartEditModal) return;
      const { idx } = cartEditModal;
      const newQty = Math.max(1, parseInt(cartQtyNumpadInput) || 1);

      // Build updated variant list
      const updatedVariants: SelectedVariant[] = [];
      Object.entries(cartEditVariantSelections).forEach(([variantId, optionIds]) => {
        const variant = cartEditVariants.find(v => v.id === parseInt(variantId));
        if (variant) {
          const optionIdArray = Array.isArray(optionIds) ? optionIds : [optionIds];
          optionIdArray.forEach(optionId => {
            const option = variant.options.find(o => o.id === optionId);
            if (option) {
              updatedVariants.push({ variantId: variant.id, variantName: variant.name, optionId: option.id, optionName: option.name });
            }
          });
        }
      });

      setCart(prevCart =>
        prevCart.map((item, i) =>
          i === idx
            ? { ...item, quantity: newQty, variants: updatedVariants, addons: cartEditAddons, notes: cartEditModal.item.notes }
            : item
        )
      );
      setCartEditModal(null);
    };

    // Toggle addon inside cart edit modal
    const toggleCartEditAddon = async (addon: Addon) => {
      const existing = cartEditAddons.find(a => a.addon_id === addon.id);
      if (existing) {
        setCartEditAddons(prev => prev.filter(a => a.addon_id !== addon.id));
        return;
      }
      try {
        const res = await apiClient.get(`/api/menu-items/${addon.addon_item_id}/variants`);
        const variants = res.data || [];
        if (variants.length > 0) {
          setCartEditAddonVariantModal({ addon, variants });
          setCartEditAddonVariantSelections({});
        } else {
          setCartEditAddons(prev => [...prev, { addon_id: addon.id, addon_item_id: addon.addon_item_id, addon_item_name: addon.addon_item_name, addon_discount_price_cents: addon.addon_discount_price_cents, quantity: 1 }]);
        }
      } catch {
        setCartEditAddons(prev => [...prev, { addon_id: addon.id, addon_item_id: addon.addon_item_id, addon_item_name: addon.addon_item_name, addon_discount_price_cents: addon.addon_discount_price_cents, quantity: 1 }]);
      }
    };

    const handleSubmitOrder = async () => {
      if (cart.length === 0) {
        Alert.alert(t('orders.empty-cart'), t('orders.empty-cart-msg'));
        return;
      }
      if (!orderType) {
        Alert.alert(t('orders.missing-info'), t('orders.select-order-type'));
        return;
      }
      if (orderType === 'table' && !selectedTable) {
        Alert.alert(t('orders.missing-table'), t('orders.select-table-msg'));
        return;
      }

      // To-Go orders: prompt for customer name first
      if (orderType === 'to-go') {
        setCustomerName('');
        setCustomerPhone('');
        setShowCustomerNameModal(true);
        return;
      }

      await doSubmitOrder();
    };

    const doSubmitOrder = async (toGoCustomerName?: string) => {
      try {
        // Prepare items for API submission
        const items = cart.map(cartItem => ({
          menu_item_id: cartItem.id,
          quantity: cartItem.quantity,
          notes: cartItem.notes || null,
          selected_option_ids: (cartItem.variants || []).map(v => v.optionId),
          addons: (cartItem.addons || []).map(a => ({ addon_id: a.addon_id, quantity: a.quantity })),
        }));

        console.log('[OrderSubmit] Submitting order:', {
          orderType,
          selectedTable,
          items,
          restaurantId,
        });

        let newOrderId: number | null = null;

        if (orderType === 'table') {
          if (!selectedTable) {
            throw new Error('Please select a table');
          }
          const sessionId = selectedTable;
          
          const res = await apiClient.post(
            `/api/sessions/${sessionId}/orders`,
            { items }
          );
          console.log('[OrderSubmit] Table order submitted:', res);
          newOrderId = res.data?.id || res.data?.order_id || null;
          Alert.alert(t('orders.success'), t('orders.table-order-success').replace('{0}', String(cart.length)));
        } else if (orderType === 'pay-now') {
          const res = await apiClient.post(
            `/api/restaurants/${restaurantId}/counter-order`,
            { pax: 1, items }
          );
          console.log('[OrderSubmit] Counter order submitted:', res);
          newOrderId = res.data?.orders?.[0]?.id || null;
          
          // Show payment modal right away for Order Now
          const session = res.data?.session;
          if (session) {
            const sessionOrders = res.data?.orders || [];
            let totalCents = 0;
            sessionOrders.forEach((o: any) => (o.items || []).forEach((i: any) => { totalCents += (i.item_total_cents || i.unit_price_cents * i.quantity || 0); }));
            if (totalCents === 0) totalCents = cartTotal;
            setPaymentModalSessionId(session.id || session.session_id);
            setPaymentModalOrderId(sessionOrders[0]?.id || null);
            setPaymentModalOrderNumber(sessionOrders[0]?.restaurant_order_number || sessionOrders[0]?.id || null);
            setPaymentModalTotal(totalCents);
            setPaymentModalMethod(customPaymentMethods[0]?.id || 'cash');
            setShowPaymentModal(true);
          }
        } else if (orderType === 'to-go') {
          const res = await apiClient.post(
            `/api/restaurants/${restaurantId}/to-go-order`,
            { pax: 1, items, customer_name: toGoCustomerName || '', customer_phone: customerPhone || '' }
          );
          console.log('[OrderSubmit] To-go order submitted:', res);
          newOrderId = res.data?.id || res.data?.order_id || null;
          showToast(t('orders.togo-order-success').replace('{0}', String(cart.length)), 'success');
        }

        // Auto-print to kitchen if kitchen_auto_print is enabled (non-blocking)
        if (newOrderId) {
          try {
            const printerConfig = await printerSettingsService.getPrinterSettings(restaurantId, false);
            if (printerConfig.kitchen_auto_print) {
              apiClient.post(`/api/restaurants/${restaurantId}/print-order`, { orderId: newOrderId, orderType: 'kitchen' }).catch(err => {
                console.warn('[OrderSubmit] Auto-print kitchen failed (non-blocking):', err?.message);
              });
            }
          } catch (_printErr) {
            // non-blocking — ignore print setting fetch errors
          }
        }

        // Clear cart and reset
        setCart([]);
        setOrderType(null);
        setSelectedTable(null);
        
        // Refresh order list so new order appears
        await loadOrdersAndSessions();
      } catch (err: any) {
        console.error('[OrderSubmit] Error:', err);
        Alert.alert(
          t('orders.error'),
          err.response?.data?.error || err.message || t('orders.submit-failed')
        );
      }
    };

    // Submit payment for Order Now (counter order)
    const submitPaymentModal = async () => {
      if (!paymentModalSessionId) return;

      if (paymentModalMethod === 'kpay') {
        // KPay terminal payment flow
        if (!kpayTerminal) {
          Alert.alert(t('orders.error'), t('orders.no-kpay-terminal'));
          return;
        }
        await startKpayTerminalPayment();
        return;
      }

      if (paymentModalMethod === 'payment-asia-offline') {
        if (!paOfflineTerminal) {
          Alert.alert(t('orders.error'), 'No active PA Offline terminal found');
          return;
        }
        await startPaOfflinePayment();
        return;
      }

      // Cash or Card (manual) — close bill immediately
      try {
        await apiClient.post(
          `/api/sessions/${paymentModalSessionId}/close-bill`,
          {
            restaurantId: parseInt(restaurantId),
            payment_method: paymentModalMethod,
            amount_paid: paymentModalTotal,
            discount_applied: 0,
            service_charge: 0,
            notes: '',
          }
        );
        setShowPaymentModal(false);
        setPaymentModalCashReceived('');
        setOrderPaymentSuccessAmount(paymentModalTotal);
        setShowOrderPaymentSuccess(true);
        if (emailReceiptEnabled && paymentModalSessionId) {
          openEmailReceiptModal(paymentModalSessionId, selectedHistoryOrder?.customer_email || '');
        }
        await loadOrdersAndSessions();
      } catch (err: any) {
        Alert.alert(t('orders.error'), err.response?.data?.error || t('orders.payment-failed'));
      }
    };

    // KPay terminal payment: initiate sale + poll for result
    const startKpayTerminalPayment = async () => {
      if (!kpayTerminal || !paymentModalSessionId) return;

      setKpayProcessing(true);
      setKpayStatusMsg(t('orders.kpay-initiating'));
      setKpayLogs([{ msg: `> ${t('orders.kpay-connecting')}`, color: '#ffd43b' }]);
      setKpayOperationType('sale');

      const addLog = (msg: string, color: string = '#00ff00') =>
        setKpayLogs(prev => [...prev, { msg, color }]);

      const outTradeNo = `ORD-${restaurantId}-${paymentModalOrderId || 0}-${Date.now()}`;
      const amountStr = String(paymentModalTotal).padStart(12, '0');

      try {
        // Fetch terminal config (with unmasked keys)
        const terminalRes = await apiClient.get(`/api/restaurants/${restaurantId}/payment-terminals/${kpayTerminal.id}`);
        const tc = terminalRes.data;
        const config: KPayTerminalConfig = {
          terminalIp: tc.terminal_ip,
          terminalPort: tc.terminal_port,
          appId: tc.app_id,
          appSecret: tc.app_secret,
          endpointPath: tc.endpoint_path || '/v2/pos/sign',
        };

        // Sign in directly from device
        addLog('> Signing in to KPay terminal...', '#ffd43b');
        const signResult = await kpaySign(config);
        if (!signResult.success || !signResult.appPrivateKey) {
          setKpayStatusMsg(t('orders.kpay-failed'));
          addLog(`> ❌ ${signResult.error || signResult.message}`, '#ff6b6b');
          setKpayProcessing(false);
          return;
        }
        addLog('> ✅ Signed in', '#51cf66');
        // Save for abort handler
        kpayConfigRef.current = config;
        kpayPrivateKeyRef.current = signResult.appPrivateKey;
        kpayCurrentTradeNoRef.current = outTradeNo;

        // Initiate sale directly from device
        setKpayStatusMsg(t('orders.kpay-waiting'));
        addLog(`> outTradeNo: ${outTradeNo}`, '#ffd43b');
        addLog(`> Amount: ${formatPrice(paymentModalTotal)}`, '#ffd43b');
        const saleResult = await kpaySale(config, signResult.appPrivateKey, outTradeNo, amountStr);
        if (!saleResult.success) {
          setKpayStatusMsg(t('orders.kpay-failed'));
          addLog(`> ❌ ${saleResult.error || saleResult.message}`, '#ff6b6b');
          setKpayProcessing(false);
          return;
        }
        addLog(`> ✅ Sale initiated — present terminal to customer`, '#51cf66');
        addLog(`> ${t('orders.kpay-tap-scan')}`, '#ffd43b');

        // Poll for result directly from device
        let attempts = 0;
        const maxAttempts = 22;

        const poll = async () => {
          if (attempts >= maxAttempts) {
            setKpayStatusMsg(t('orders.kpay-timeout'));
            addLog('> TIMEOUT', '#ffd43b');
            // Try to close the transaction on the terminal to return it to idle
            addLog('> Sending close transaction to terminal...', '#ffd43b');
            try {
              const closeRes = await kpayClose(config, signResult.appPrivateKey!, outTradeNo);
              addLog(closeRes.success ? '> ✅ Terminal freed' : `> ⚠️ Close: ${closeRes.error || closeRes.message}`, closeRes.success ? '#51cf66' : '#ffd43b');
            } catch (_) {}
            setKpayProcessing(false);
            return;
          }
          attempts++;
          addLog(`> Polling… (${attempts}/${maxAttempts})`);

          try {
            const qData = await kpayQuery(config, signResult.appPrivateKey!, outTradeNo);
            if (qData.status === 'success') {
              setKpayStatusMsg(t('orders.kpay-paid'));
              addLog(`> ✅ ${t('orders.kpay-confirmed')}`, '#51cf66');

              try {
                await apiClient.post(
                  `/api/sessions/${paymentModalSessionId}/close-bill`,
                  {
                    restaurantId: parseInt(restaurantId),
                    payment_method: 'kpay',
                    amount_paid: paymentModalTotal,
                    discount_applied: 0,
                    service_charge: 0,
                    notes: '',
                    kpay_reference_id: outTradeNo,
                  }
                );
                addLog(`> ✅ ${t('orders.bill-closed')}`, '#51cf66');
              } catch (closeBillErr: any) {
                addLog(`> ⚠️ Payment confirmed but failed to record: ${closeBillErr.message}`, '#ffd43b');
              }
              setKpayProcessing(false);

              const orderIdToReload = paymentModalOrderId;
              setTimeout(() => {
                setShowPaymentModal(false);
                setKpayLogs([]);
                showToast(t('orders.payment-confirmed'), 'success');
                if (emailReceiptEnabled && paymentModalSessionId) {
                  openEmailReceiptModal(paymentModalSessionId, selectedHistoryOrder?.customer_email || '');
                }
                if (orderIdToReload) reloadSelectedOrder(orderIdToReload);
                else loadOrdersAndSessions();
              }, 2000);
              return;
            }

            if (qData.status === 'cancelled' || qData.status === 'failed') {
              setKpayStatusMsg(qData.status === 'cancelled' ? t('orders.kpay-cancelled') : t('orders.kpay-failed'));
              addLog(`> ${qData.status}`, '#ff6b6b');
              setKpayProcessing(false);
              return;
            }

            kpayPollRef.current = setTimeout(poll, 3000);
          } catch (e: any) {
            addLog(`> Poll error: ${e.message}`, '#ffd43b');
            kpayPollRef.current = setTimeout(poll, 3000);
          }
        };

        kpayPollRef.current = setTimeout(poll, 2000);
      } catch (err: any) {
        addLog(`> ❌ Error: ${err.message}`, '#ff6b6b');
        setKpayStatusMsg(t('orders.kpay-failed'));
        setKpayProcessing(false);
      }
    };


    const abortKpayPayment = async () => {
      if (kpayPollRef.current) {
        clearTimeout(kpayPollRef.current);
        kpayPollRef.current = null;
      }

      // If KPay sale/void/refund is in progress, send close transaction to return terminal to idle
      const kpayTradeNo = kpayCurrentTradeNoRef.current;
      const kpayCfg = kpayConfigRef.current;
      const kpayKey = kpayPrivateKeyRef.current;
      if (kpayTradeNo && kpayCfg && kpayKey) {
        setKpayStatusMsg('Closing transaction on terminal…');
        setKpayLogs(prev => [...prev, { msg: `> Sending close to terminal (${kpayTradeNo})…`, color: '#ffd43b' }]);
        try {
          const cr = await kpayClose(kpayCfg, kpayKey, kpayTradeNo);
          setKpayLogs(prev => [...prev, {
            msg: cr.success ? '> ✅ Terminal freed.' : `> ⚠️ Close: ${cr.error || cr.message}`,
            color: cr.success ? '#51cf66' : '#ffd43b',
          }]);
          if (!cr.success && (kpayTradeNo.startsWith('VOID-') || kpayTradeNo.startsWith('REF-'))) {
            setKpayLogs(prev => [...prev, {
              msg: '> ℹ️ KPay limitation: close does not abort in-progress void/refund — cancel manually on the terminal screen if needed.',
              color: '#94a3b8',
            }]);
          }
        } catch (e: any) {
          setKpayLogs(prev => [...prev, { msg: `> Close error: ${e.message}`, color: '#ffd43b' }]);
        }
        kpayCurrentTradeNoRef.current = null;
        kpayConfigRef.current = null;
        kpayPrivateKeyRef.current = null;
      }

      // If a PA Offline order is in progress, void it on the terminal so it's freed
      const paOrderId = paOfflineOrderIdRef.current;
      const paConfig = paOfflineConfigRef.current;
      if (paOrderId && paConfig) {
        setKpayStatusMsg('Cancelling on terminal…');
        setKpayLogs(prev => [...prev, { msg: `> Voiding PA order ${paOrderId} on terminal…`, color: '#ffd43b' }]);
        try {
          const vr = await paOfflineVoidOrder(paConfig, paOrderId);
          setKpayLogs(prev => [...prev, {
            msg: vr.success ? '> ✅ Terminal order voided — terminal freed.' : `> ⚠️ Void failed: ${vr.message}`,
            color: vr.success ? '#51cf66' : '#ffd43b',
          }]);
        } catch (e: any) {
          setKpayLogs(prev => [...prev, { msg: `> Void error: ${e.message}`, color: '#ffd43b' }]);
        }
        paOfflineOrderIdRef.current = null;
      }

      setKpayProcessing(false);
      // Close the modal entirely instead of showing payment method selection
      setShowPaymentModal(false);
      setKpayLogs([]);
      setKpayStatusMsg('');
      setKpayModalTitle(null);
    };

    // === PA Offline Terminal Payment (direct from device) ===
    const startPaOfflinePayment = async () => {
      if (!paOfflineTerminal || !paymentModalSessionId) return;

      setKpayProcessing(true);
      setKpayStatusMsg('Initiating PA terminal…');
      setKpayLogs([{ msg: '> Connecting to PA terminal…', color: '#ffd43b' }]);
      setKpayOperationType('sale');

      const addLog = (msg: string, color: string = '#00ff00') => {
        setKpayLogs(prev => [...prev, { msg, color }]);
      };

      try {
        // Fetch real terminal config with unmasked app_secret
        const termRes = await apiClient.get(`/api/restaurants/${restaurantId}/payment-terminals/${paOfflineTerminal.id}`);
        const term = termRes.data;
        const paConfig: PATerminalConfig = {
          terminalIp: term.terminal_ip,
          terminalPort: term.terminal_port,
          apiKey: term.app_secret,
        };

        // Save config for abort handler
        paOfflineConfigRef.current = paConfig;

        // Void any lingering PA order before creating a new one.
        // This covers: (1) previous abort that didn't clear the terminal,
        // (2) "settle from history" re-attempt where an old order is still open.
        const candidatesToVoid: string[] = [];
        if (paOfflineOrderIdRef.current) candidatesToVoid.push(paOfflineOrderIdRef.current);
        const dbRef = selectedHistoryOrder?.cp_vendor_ref;
        if (dbRef && dbRef.startsWith('PA-') && dbRef !== paOfflineOrderIdRef.current) {
          candidatesToVoid.push(dbRef);
        }
        for (const oldId of candidatesToVoid) {
          addLog(`> Voiding previous PA order: ${oldId}…`, '#ffd43b');
          try {
            const vr = await paOfflineVoidOrder(paConfig, oldId);
            addLog(vr.success ? `> Previous order voided ✅` : `> Void skipped: ${vr.message}`, vr.success ? '#51cf66' : '#ffd43b');
          } catch { addLog(`> Could not void previous order (may have expired)`, '#ffd43b'); }
        }
        paOfflineOrderIdRef.current = null;

        const amountDollars = (paymentModalTotal / 100).toFixed(2);
        const orderId = `PA-${restaurantId}-${paOfflineTerminal.id}-${Date.now()}`;
        paOfflineOrderIdRef.current = orderId;

        addLog(`> Connecting to PA terminal at ${paConfig.terminalIp}:${paConfig.terminalPort}…`);
        addLog(`> Amount: HKD ${amountDollars}`);

        let createResult = await paOfflineCreateOrder(paConfig, orderId, amountDollars);

        // If busy, try voiding one more time (e.g. terminal auto-closed but API still open)
        if (!createResult.success) {
          const busyMsg = (createResult.message || '').toLowerCase();
          if (busyMsg.includes('busy') || busyMsg.includes('exist') || busyMsg.includes('pending')) {
            addLog(`> Terminal busy — attempting auto-clear…`, '#ffd43b');
            try { await paOfflineVoidOrder(paConfig, orderId); } catch {}
            // Small delay, then retry
            await new Promise(r => setTimeout(r, 1500));
            createResult = await paOfflineCreateOrder(paConfig, orderId, amountDollars);
          }
        }

        addLog(
          createResult.success
            ? `[PAOffline] ✅ Order created — id: ${orderId}`
            : `[PAOffline] ❌ Failed: ${createResult.error || createResult.message}`,
          createResult.success ? '#51cf66' : '#ff6b6b',
        );

        if (!createResult.success) {
          setKpayStatusMsg('PA Terminal: Failed');
          setKpayProcessing(false);
          paOfflineOrderIdRef.current = null;
          return;
        }

        setKpayStatusMsg('Waiting for payment…');
        addLog('> Present terminal to customer for QR scan…', '#ffd43b');

        let attempts = 0;
        const maxAttempts = 22;

        const poll = async () => {
          if (attempts >= maxAttempts) {
            setKpayStatusMsg('Timeout');
            addLog('> TIMEOUT — no payment received. Use Cancel to free the terminal.', '#ffd43b');
            setKpayProcessing(false);
            return;
          }
          attempts++;

          try {
            const qData = await paOfflineQueryOrder(paConfig, orderId);
            addLog(`> Poll ${attempts}/${maxAttempts} — status: ${qData.status}${qData.raw?._paStatus !== undefined ? ` (raw=${qData.raw._paStatus})` : ''}`);

            if (qData.status === 'success') {
              setKpayStatusMsg('Payment Confirmed ✅');
              addLog('> ✅ Payment confirmed', '#51cf66');
              paOfflineOrderIdRef.current = null;

              // Wrap close-bill in its own try-catch so a billing error does NOT
              // get caught by the outer poll catch (which would retry the poll loop).
              try {
                await apiClient.post(
                  `/api/sessions/${paymentModalSessionId}/close-bill`,
                  {
                    restaurantId: parseInt(restaurantId),
                    payment_method: 'payment-asia-offline',
                    amount_paid: paymentModalTotal,
                    discount_applied: 0,
                    service_charge: 0,
                    notes: '',
                    cp_vendor_ref: orderId,
                    pa_terminal_details: {
                      payment_method: qData.raw?.payment_method || null,
                      provider: qData.raw?.provider || null,
                      provider_reference: qData.raw?.provider_reference || null,
                      request_reference: qData.raw?.request_reference || null,
                      pa_created_time: qData.raw?.created_time ? Number(qData.raw.created_time) : null,
                      pa_completed_time: qData.raw?.completed_time ? Number(qData.raw.completed_time) : null,
                    },
                  },
                );
                addLog('> ✅ Bill closed', '#51cf66');
              } catch (closeBillErr: any) {
                addLog(`> ⚠️ Payment confirmed on terminal but failed to record: ${closeBillErr.message}`, '#ffd43b');
              }
              setKpayProcessing(false);

              const orderIdToReload = paymentModalOrderId;
              setTimeout(() => {
                setShowPaymentModal(false);
                setKpayLogs([]);
                showToast(t('orders.payment-confirmed'), 'success');
                if (emailReceiptEnabled && paymentModalSessionId) {
                  openEmailReceiptModal(paymentModalSessionId, selectedHistoryOrder?.customer_email || '');
                }
                if (orderIdToReload) reloadSelectedOrder(orderIdToReload);
                else loadOrdersAndSessions();
              }, 2000);
              return;
            }

            if (qData.status === 'cancelled' || qData.status === 'failed') {
              setKpayStatusMsg(qData.status === 'cancelled' ? 'Cancelled' : 'Failed');
              addLog(`> ${qData.status} — terminal ended the transaction.`, '#ff6b6b');
              paOfflineOrderIdRef.current = null;
              setKpayProcessing(false);
              return;
            }

            // Still pending — poll again
            kpayPollRef.current = setTimeout(poll, 3000);
          } catch (e: any) {
            addLog(`> Poll error: ${e.message}`, '#ffd43b');
            kpayPollRef.current = setTimeout(poll, 3000);
          }
        };

        kpayPollRef.current = setTimeout(poll, 2000);
      } catch (err: any) {
        addLog(`> ❌ Error: ${err.message}`, '#ff6b6b');
        setKpayStatusMsg('PA Terminal: Failed');
        setKpayProcessing(false);
        paOfflineOrderIdRef.current = null;
      }
    };

    // === Manual Void/Refund (non-vendor orders) ===
    const handleVoidOrder = (orderId: number) => {
      Alert.alert(
        t('orders.void-order'),
        t('orders.void-manual-msg'),
        [
          { text: t('orders.cancel') },
          {
            text: t('orders.void'),
            style: 'destructive',
            onPress: async () => {
              try {
                await apiClient.post(`/api/restaurants/${restaurantId}/orders/${orderId}/void`);
                await reloadSelectedOrder(orderId);
              } catch (err: any) {
                Alert.alert(t('orders.error'), err.response?.data?.error || t('orders.void-failed'));
              }
            },
          },
        ]
      );
    };

    const handleRefundOrder = (orderId: number) => {
      Alert.alert(
        t('orders.refund-order'),
        t('orders.refund-manual-msg'),
        [
          { text: t('orders.cancel') },
          {
            text: t('orders.refund'),
            style: 'destructive',
            onPress: async () => {
              try {
                await apiClient.post(`/api/restaurants/${restaurantId}/orders/${orderId}/refund`);
                await reloadSelectedOrder(orderId);
              } catch (err: any) {
                Alert.alert(t('orders.error'), err.response?.data?.error || t('orders.refund-failed'));
              }
            },
          },
        ]
      );
    };

    // === KPay Void ===
    const handleKpayVoid = (order: Order) => {
      if (!kpayTerminal) {
        Alert.alert(t('orders.error'), t('orders.no-kpay-terminal'));
        return;
      }
      const originOutTradeNo = order.kpay_reference_id || order.cp_vendor_ref;
      if (!originOutTradeNo) {
        Alert.alert(t('orders.error'), t('orders.no-kpay-ref'));
        return;
      }
      Alert.alert(
        t('orders.void-kpay'),
        t('orders.void-kpay-msg').replace('{0}', originOutTradeNo),
        [
          { text: t('orders.cancel') },
          {
            text: t('orders.void'),
            style: 'destructive',
            onPress: () => startKpayVoidFlow(order, originOutTradeNo),
          },
        ]
      );
    };

    const startKpayVoidFlow = async (order: Order, originOutTradeNo: string) => {
      const voidOutTradeNo = `VOID-${Date.now()}`;
      setKpayModalTitle('⊘ Void Transaction');
      setPaymentModalTotal(order.total_cents);
      setPaymentModalOrderNumber(order.restaurant_order_number || order.id);
      setPaymentModalOrderId(order.id);
      setPaymentModalSessionId(order.session_id || null);
      setKpayProcessing(true);
      setKpayLogs([]);
      setKpayStatusMsg('');
      setKpayOperationType('void');
      setShowPaymentModal(true);

      const addLog = (msg: string, color: string = '#00ff00') =>
        setKpayLogs(prev => [...prev, { msg, color }]);

      try {
        setKpayStatusMsg('Signing in...');
        addLog('> Signing in to KPay terminal...', '#ffd43b');
        const terminalRes = await apiClient.get(`/api/restaurants/${restaurantId}/payment-terminals/${kpayTerminal.id}`);
        const tc = terminalRes.data;
        const config: KPayTerminalConfig = {
          terminalIp: tc.terminal_ip,
          terminalPort: tc.terminal_port,
          appId: tc.app_id,
          appSecret: tc.app_secret,
          endpointPath: tc.endpoint_path || '/v2/pos/sign',
        };
        const signResult = await kpaySign(config);
        if (!signResult.success || !signResult.appPrivateKey) {
          setKpayStatusMsg('Sign-in failed');
          addLog(`> ❌ ${signResult.error || signResult.message}`, '#ff6b6b');
          setKpayProcessing(false);
          return;
        }
        addLog('> ✅ Signed in', '#51cf66');
        kpayConfigRef.current = config;
        kpayPrivateKeyRef.current = signResult.appPrivateKey;
        kpayCurrentTradeNoRef.current = voidOutTradeNo;

        setKpayStatusMsg('Sending void to terminal...');
        addLog(`> Void ref: ${voidOutTradeNo}`, '#ffd43b');
        addLog(`> Original: ${originOutTradeNo}`, '#ffd43b');
        const voidResult = await kpayVoid(config, signResult.appPrivateKey, voidOutTradeNo, originOutTradeNo);
        if (!voidResult.success) {
          setKpayStatusMsg('Void failed');
          addLog(`> ❌ ${voidResult.error || voidResult.message}`, '#ff6b6b');
          setKpayProcessing(false);
          return;
        }
        addLog('> ✅ Void initiated — confirm on terminal screen', '#51cf66');
        setKpayStatusMsg('Waiting for confirmation...');
        addLog('> Polling terminal for confirmation...', '#ffd43b');

        let attempts = 0;
        const maxAttempts = 40; // ~2 min
        const poll = async () => {
          if (attempts >= maxAttempts) {
            setKpayStatusMsg('Timeout — no confirmation');
            addLog('> TIMEOUT — void may not have been confirmed', '#ffd43b');
            setKpayProcessing(false);
            return;
          }
          attempts++;
          addLog(`> Poll ${attempts}/${maxAttempts}...`);
          try {
            const qData = await kpayQuery(config, signResult.appPrivateKey!, voidOutTradeNo);
            if (qData.status === 'success') {
              setKpayStatusMsg('Void confirmed ✅');
              addLog('> ✅ Void confirmed by terminal!', '#51cf66');
              setKpayProcessing(false);
              try {
                await apiClient.patch(
                  `/api/restaurants/${restaurantId}/orders/${order.id}/payment-outcome`,
                  { status: 'voided', void_vendor_ref: voidOutTradeNo, refunded_by_staff_id: staffId || undefined }
                );
              } catch (_) {}
              setTimeout(async () => {
                setShowPaymentModal(false);
                setKpayLogs([]);
                setKpayModalTitle(null);
                await reloadSelectedOrder(order.id);
              }, 1500);
              return;
            }
            if (qData.status === 'cancelled' || qData.status === 'failed') {
              setKpayStatusMsg(qData.status === 'cancelled' ? 'Void cancelled' : 'Void failed');
              addLog(`> ${qData.status === 'cancelled' ? '⚠️ Void cancelled' : '❌ Void failed'}`, '#ff6b6b');
              setKpayProcessing(false);
              return;
            }
            kpayPollRef.current = setTimeout(poll, 3000);
          } catch (e: any) {
            addLog(`> Poll error: ${e.message}`, '#ffd43b');
            kpayPollRef.current = setTimeout(poll, 3000);
          }
        };
        kpayPollRef.current = setTimeout(poll, 2000);
      } catch (err: any) {
        addLog(`> ❌ ${err.message}`, '#ff6b6b');
        setKpayStatusMsg('Error');
        setKpayProcessing(false);
      }
    };

    // === KPay Refund ===
    const openKpayRefund = () => {
      setKpayRefundPassword('');
      setShowKpayRefundModal(true);
    };

    const submitKpayRefund = async () => {
      if (!selectedHistoryOrder || !kpayTerminal) return;
      const originOutTradeNo = selectedHistoryOrder.kpay_reference_id || selectedHistoryOrder.cp_vendor_ref;
      if (!originOutTradeNo) {
        Alert.alert(t('orders.error'), t('orders.no-kpay-ref'));
        return;
      }
      if (!kpayRefundPassword.trim()) {
        Alert.alert(t('orders.error'), 'Manager password is required for refund.');
        return;
      }
      // Close amount modal and open the terminal window
      setShowKpayRefundModal(false);
      const refOutTradeNo = `REF-${Date.now()}`;
      setKpayModalTitle('↩ Refund Transaction');
      setPaymentModalTotal(selectedHistoryOrder.total_cents);
      setPaymentModalOrderNumber(selectedHistoryOrder.restaurant_order_number || selectedHistoryOrder.id);
      setPaymentModalOrderId(selectedHistoryOrder.id);
      setPaymentModalSessionId(selectedHistoryOrder.session_id || null);
      setKpayProcessing(true);
      setKpayLogs([]);
      setKpayStatusMsg('');
      setKpayOperationType('refund');
      setShowPaymentModal(true);

      const addLog = (msg: string, color: string = '#00ff00') =>
        setKpayLogs(prev => [...prev, { msg, color }]);

      const orderId = selectedHistoryOrder.id;

      try {
        setKpayStatusMsg('Signing in...');
        addLog('> Signing in to KPay terminal...', '#ffd43b');
        const terminalRes = await apiClient.get(`/api/restaurants/${restaurantId}/payment-terminals/${kpayTerminal.id}`);
        const tc = terminalRes.data;
        const config: KPayTerminalConfig = {
          terminalIp: tc.terminal_ip,
          terminalPort: tc.terminal_port,
          appId: tc.app_id,
          appSecret: tc.app_secret,
          endpointPath: tc.endpoint_path || '/v2/pos/sign',
        };
        const signResult = await kpaySign(config);
        if (!signResult.success || !signResult.appPrivateKey) {
          setKpayStatusMsg('Sign-in failed');
          addLog(`> ❌ ${signResult.error || signResult.message}`, '#ff6b6b');
          setKpayProcessing(false);
          return;
        }
        addLog('> ✅ Signed in', '#51cf66');
        kpayConfigRef.current = config;
        kpayPrivateKeyRef.current = signResult.appPrivateKey;
        kpayCurrentTradeNoRef.current = refOutTradeNo;

        // Query original transaction to get live payMethod / transactionNo / refNo
        setKpayStatusMsg('Querying original transaction...');
        addLog(`> Querying: ${originOutTradeNo}`, '#ffd43b');
        const qOriginal = await kpayQuery(config, signResult.appPrivateKey, originOutTradeNo);
        const livePayMethod = qOriginal.raw?.payMethod ?? kpayTxDetails?.payMethod;
        addLog(`> payMethod: ${livePayMethod === 1 ? 'Card (1)' : livePayMethod != null ? `QR/Mobile (${livePayMethod})` : 'unknown — defaulting to QR'}`, '#ffd43b');

        const refundParams: any = {
          outTradeNo: refOutTradeNo,
          refundType: livePayMethod === 1 ? 1 : 2, // 1=Card, 2=QR/mobile
        };
        // managerPassword is required (✅) for KPay refund — entered at refund time, encrypted with platformPublicKey
        if (signResult.platformPublicKey) {
          try {
            refundParams.encryptedManagerPassword = encryptManagerPassword(signResult.platformPublicKey, kpayRefundPassword);
            addLog('> Manager password encrypted ✅', '#ffd43b');
          } catch (encErr: any) {
            addLog(`> ⚠️ Password encrypt error: ${encErr.message}`, '#ffd43b');
          }
        }
        if (qOriginal.transactionNo) { refundParams.transactionNo = qOriginal.transactionNo; addLog(`> transactionNo: ${qOriginal.transactionNo}`, '#ffd43b'); }
        if (qOriginal.refNo)         { refundParams.refNo = qOriginal.refNo;                 addLog(`> refNo: ${qOriginal.refNo}`, '#ffd43b'); }
        if (qOriginal.commitTime)    { refundParams.commitTime = qOriginal.commitTime; }

        setKpayStatusMsg('Sending refund to terminal...');
        addLog(`> Refund ref: ${refOutTradeNo}`, '#ffd43b');
        const result = await kpayRefund(config, signResult.appPrivateKey, refundParams);
        if (!result.success) {
          setKpayStatusMsg('Refund failed');
          addLog(`> ❌ ${result.error || result.message}`, '#ff6b6b');
          setKpayProcessing(false);
          return;
        }
        addLog('> ✅ Refund initiated — enter password on terminal screen if prompted', '#51cf66');
        setKpayStatusMsg('Waiting for confirmation...');
        addLog('> Polling terminal for confirmation...', '#ffd43b');

        let attempts = 0;
        const maxAttempts = 40;
        const poll = async () => {
          if (attempts >= maxAttempts) {
            setKpayStatusMsg('Timeout — no confirmation');
            addLog('> TIMEOUT', '#ffd43b');
            setKpayProcessing(false);
            return;
          }
          attempts++;
          addLog(`> Poll ${attempts}/${maxAttempts}...`);
          try {
            const qData = await kpayQuery(config, signResult.appPrivateKey!, refOutTradeNo);
            if (qData.status === 'success') {
              setKpayStatusMsg('Refund confirmed ✅');
              addLog('> ✅ Refund confirmed by terminal!', '#51cf66');
              setKpayProcessing(false);
              try {
                await apiClient.patch(
                  `/api/restaurants/${restaurantId}/orders/${orderId}/payment-outcome`,
                  { status: 'refunded', refund_vendor_ref: refOutTradeNo, refunded_by_staff_id: staffId || undefined }
                );
              } catch (_) {}
              setTimeout(async () => {
                setShowPaymentModal(false);
                setKpayLogs([]);
                setKpayModalTitle(null);
                await reloadSelectedOrder(orderId);
              }, 1500);
              return;
            }
            if (qData.status === 'cancelled' || qData.status === 'failed') {
              setKpayStatusMsg(qData.status === 'cancelled' ? 'Refund cancelled' : 'Refund failed');
              addLog(`> ${qData.status === 'cancelled' ? '⚠️ Refund cancelled' : '❌ Refund failed'}`, '#ff6b6b');
              setKpayProcessing(false);
              return;
            }
            kpayPollRef.current = setTimeout(poll, 3000);
          } catch (e: any) {
            addLog(`> Poll error: ${e.message}`, '#ffd43b');
            kpayPollRef.current = setTimeout(poll, 3000);
          }
        };
        kpayPollRef.current = setTimeout(poll, 2000);
      } catch (err: any) {
        addLog(`> ❌ ${err.message}`, '#ff6b6b');
        setKpayStatusMsg('Error');
        setKpayProcessing(false);
      }
    };

    // === Payment Asia Online Refund ===
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
        Alert.alert(t('orders.error'), t('orders.no-pa-ref'));
        return;
      }
      if (!paRefundAmount || parseFloat(paRefundAmount) <= 0) {
        Alert.alert(t('orders.error'), t('orders.invalid-amount'));
        return;
      }
      try {
        await apiClient.post(
          `/api/restaurants/${restaurantId}/payment-asia/refund`,
          { merchant_reference: merchantRef, amount: parseFloat(paRefundAmount) }
        );
        setShowPaRefundModal(false);
        Alert.alert(t('orders.success'), t('orders.refund-pa-success'));
        await reloadSelectedOrder(selectedHistoryOrder.id);
      } catch (err: any) {
        Alert.alert(t('orders.refund-failed'), err.response?.data?.error || err.message);
      }
    };

    // === PA Offline Refund (direct from device — POST /order/refund, then poll) ===
    // NOTE: PA Offline has no void endpoint; only refund is supported.
    const openPaOfflineRefundModal = (order: Order) => {
      const totalDollars = ((order.total_cents || 0) / 100).toFixed(2);
      setPaOfflineRefundAmount(totalDollars);
      setPaOfflineRefundTarget(order);
      setShowPaOfflineRefundModal(true);
    };

    const submitPaOfflineRefund = () => {
      if (!paOfflineRefundTarget) return;
      setShowPaOfflineRefundModal(false);
      const amount = paOfflineRefundAmount ? parseFloat(paOfflineRefundAmount).toFixed(2) : undefined;
      startPaOfflineRefundFlow(paOfflineRefundTarget, amount);
    };

    const startPaOfflineRefundFlow = async (order: Order, refundAmountDollars?: string) => {
      const paOrderId = order.cp_vendor_ref || order.kpay_reference_id;
      if (!paOrderId) {
        Alert.alert(t('orders.error'), t('orders.no-pa-ref'));
        return;
      }
      setKpayModalTitle('↩ PA Terminal Refund');
      setPaymentModalTotal(order.total_cents);
      setPaymentModalOrderNumber(order.restaurant_order_number || order.id);
      setPaymentModalOrderId(order.id);
      setPaymentModalSessionId(order.session_id || null);
      setKpayProcessing(true);
      setKpayLogs([]);
      setKpayStatusMsg('');
      setKpayOperationType('sale');
      setShowPaymentModal(true);

      const addLog = (msg: string, color: string = '#00ff00') =>
        setKpayLogs(prev => [...prev, { msg, color }]);

      const orderId = order.id;

      try {
        addLog('> Fetching PA Offline terminal config...', '#ffd43b');
        const termRes = await apiClient.get(`/api/restaurants/${restaurantId}/payment-terminals`);
        const paTerminal = (termRes.data || []).find((t: any) => t.vendor_name === 'payment-asia-offline' && t.is_active);
        if (!paTerminal) {
          setKpayStatusMsg('No PA terminal');
          addLog('> ❌ No active PA Offline terminal found', '#ff6b6b');
          setKpayProcessing(false);
          return;
        }
        const termDetail = await apiClient.get(`/api/restaurants/${restaurantId}/payment-terminals/${paTerminal.id}`);
        const tc = termDetail.data;
        const paConfig: PATerminalConfig = {
          terminalIp: tc.terminal_ip,
          terminalPort: tc.terminal_port,
          apiKey: tc.app_secret,
        };

        setKpayStatusMsg('Sending refund to terminal...');
        addLog(`> POST /order/refund  order_id=${paOrderId}${refundAmountDollars ? `  amount=${refundAmountDollars}` : ''}`, '#ffd43b');
        const result = await paOfflineRefundOrder(paConfig, paOrderId, refundAmountDollars);
        if (result.success) {
          setKpayStatusMsg('Refund confirmed ✅');
          addLog('> ✅ Refund successful on terminal!', '#51cf66');
          setKpayProcessing(false);
          try {
            await apiClient.patch(
              `/api/restaurants/${restaurantId}/orders/${orderId}/payment-outcome`,
              { status: 'refunded', refund_vendor_ref: paOrderId, refunded_by_staff_id: staffId || undefined }
            );
          } catch (_) {}
          setTimeout(async () => {
            setShowPaymentModal(false);
            setKpayLogs([]);
            setKpayModalTitle(null);
            await reloadSelectedOrder(orderId);
          }, 1500);
        } else {
          setKpayStatusMsg('Refund failed');
          addLog(`> ❌ ${result.error || result.message}`, '#ff6b6b');
          setKpayProcessing(false);
        }
      } catch (err: any) {
        addLog(`> ❌ ${err.message}`, '#ff6b6b');
        setKpayStatusMsg('Error');
        setKpayProcessing(false);
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

    const cartTotal = cart.reduce((sum, item) => {
      const addonTotal = (item.addons || []).reduce((s, a) => s + a.addon_discount_price_cents * a.quantity, 0);
      return sum + (item.price_cents * item.quantity) + (addonTotal * item.quantity);
    }, 0);

    // Helper to determine if an order is unpaid
    const isOrderUnpaid = (order: Order) => {
      const effStatus = order.cp_status || order.payment_status;
      const isPaid = order.payment_received || effStatus === 'completed' || effStatus === 'paid';
      const isVoided = effStatus === 'voided' || effStatus === 'cancelled';
      const isRefunded = effStatus === 'refunded';
      return !isPaid && !isVoided && !isRefunded && order.total_cents > 0;
    };

    const printBillForSession = async (order: Order) => {
      if (!order.session_id) {
        Alert.alert('Error', 'No session linked to this order.');
        return;
      }
      setPrintingBill(true);
      try {
        const printerRes = await apiClient.get(`/api/restaurants/${restaurantId}/printer-settings`);
        const printerRows = Array.isArray(printerRes.data) ? printerRes.data : [];
        const billPrinter = printerRows.find((p: any) => p.type === 'Bill');
        const billPrinterType = billPrinter?.printer_type;
        if (!billPrinterType || billPrinterType === 'none') {
          Alert.alert('No Bill Printer', 'Please configure a bill printer in Settings → Printer Settings.');
          return;
        }
        const printItems = (order.items || []).map((i: any) => ({
          name: i.menu_item_name || i.name,
          quantity: i.quantity,
          price_cents: i.quantity > 0 ? Math.round((i.item_total_cents ?? i.price_cents ?? 0) / i.quantity) : (i.price_cents ?? 0),
        }));
        const billPayload = {
          sessionId: order.session_id,
          billData: {
            table: order.customer_name || (order.table_name ? `Table ${order.table_name}` : 'Receipt'),
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
            const url = 'http://localhost:8001/print';
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 15000);
            await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ host, port, data: Array.from(escposBytes) }),
              signal: controller.signal,
            }).finally(() => clearTimeout(timer));
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
        setPrintingBill(false);
      }
    };

    // Print kitchen order for any order (re-trigger kitchen print)
    const handlePrintKitchenOrder = async (order: Order) => {
      if (!order.id) return;
      setPrintingKitchen(true);
      try {
        await apiClient.post(`/api/restaurants/${restaurantId}/print-order`, { orderId: order.id, orderType: 'kitchen' });
        showToast('Kitchen order sent to printer', 'success');
      } catch (err: any) {
        Alert.alert('Print Error', err?.response?.data?.error || err.message || 'Failed to print kitchen order');
      } finally {
        setPrintingKitchen(false);
      }
    };

    // Cancel a single order item; if it's the last item, cancel the whole order
    const handleCancelOrderItem = (order: Order) => {
      const items = (order.items || []).filter((i: any) => !i.removed);
      if (items.length === 0) {
        Alert.alert('No Items', 'This order has no items to cancel.');
        return;
      }
      if (items.length === 1) {
        // Last item — cancel the whole order
        Alert.alert(
          t('orders.void-order'),
          t('orders.void-manual-msg'),
          [
            { text: t('common.cancel'), style: 'cancel' },
            {
              text: t('orders.void'),
              style: 'destructive',
              onPress: () => handleVoidOrder(order.id),
            },
          ]
        );
        return;
      }
      // Multiple items — show picker
      Alert.alert(
        'Cancel Item',
        'Select an item to cancel:',
        [
          ...items.map((item: any) => ({
            text: `${item.menu_item_name || item.name} ×${item.quantity}`,
            onPress: async () => {
              try {
                await apiClient.delete(`/api/restaurants/${restaurantId}/order-items/${item.id}`, {
                  data: { restaurantId },
                });
                showToast('Item cancelled', 'success');
                await reloadSelectedOrder(order.id);
              } catch (err: any) {
                Alert.alert('Error', err?.response?.data?.error || 'Failed to cancel item');
              }
            },
          })),
          { text: t('common.cancel'), style: 'cancel' },
        ]
      );
    };

    // Compute filtered orders for history and unpaid counts
    const filteredHistoryOrders = orders.filter(order => {
      // Order type filter
      if (historyFilter === 'table') {
        if (order.order_type !== 'table') return false;
        if (historyTableFilter && order.table_name && !order.table_name.toLowerCase().includes(historyTableFilter.toLowerCase())) return false;
      } else if (historyFilter === 'pay-now') {
        if (order.order_type !== 'counter' && order.order_type !== 'pay-now') return false;
      } else if (historyFilter === 'to-go') {
        if (order.order_type !== 'to-go') return false;
      }
      // Date filter
      if (historyDateFilter !== 'all') {
        const orderDate = order.created_at ? new Date(order.created_at) : null;
        if (!orderDate) return false;
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterdayStart = new Date(todayStart.getTime() - 86400000);
        const weekStart = new Date(todayStart.getTime() - 6 * 86400000);
        if (historyDateFilter === 'today' && orderDate < todayStart) return false;
        if (historyDateFilter === 'yesterday' && (orderDate < yesterdayStart || orderDate >= todayStart)) return false;
        if (historyDateFilter === 'week' && orderDate < weekStart) return false;
        if (historyDateFilter === 'custom') {
          if (historyDateFrom) {
            const from = new Date(historyDateFrom + 'T00:00:00');
            if (!isNaN(from.getTime()) && orderDate < from) return false;
          }
          if (historyDateTo) {
            const to = new Date(historyDateTo + 'T23:59:59');
            if (!isNaN(to.getTime()) && orderDate > to) return false;
          }
        }
      }
      // Payment status filter
      if (historyPaymentStatusFilter !== 'all') {
        const badge = getPaymentBadge(order);
        if (historyPaymentStatusFilter === 'pending') {
          if (badge.label.toLowerCase() !== 'pending') return false;
        } else {
          if (badge.label.toLowerCase() !== historyPaymentStatusFilter) return false;
        }
      }
      // Payment method filter
      if (historyPaymentMethodFilter !== 'all') {
        const vendor = resolveVendor(order) || '';
        if (historyPaymentMethodFilter === 'card') {
          if (vendor !== 'card' && vendor !== 'credit-card') return false;
        } else {
          if (vendor !== historyPaymentMethodFilter) return false;
        }
      }
      return true;
    });

    const unpaidCounts = {
      all: filteredHistoryOrders.filter(isOrderUnpaid).length,
      table: filteredHistoryOrders.filter(o => o.order_type === 'table' && isOrderUnpaid(o)).length,
      'pay-now': filteredHistoryOrders.filter(o => (o.order_type === 'counter' || o.order_type === 'pay-now') && isOrderUnpaid(o)).length,
      'to-go': filteredHistoryOrders.filter(o => o.order_type === 'to-go' && isOrderUnpaid(o)).length,
    };

    const filteredMenuItems = menuItems.filter(item => {
      if (selectedCategory && item.category_id !== selectedCategory) return false;
      if (props.searchQuery && props.searchQuery.trim()) {
        const q = props.searchQuery.trim().toLowerCase();
        return item.name.toLowerCase().includes(q) || (item.name_zh ? item.name_zh.toLowerCase().includes(q) : false);
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

    // ============= EMAIL RECEIPT MODAL =============
    const emailReceiptModal = (
      <Modal
        supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}
        visible={showEmailReceiptModal}
        animationType="fade"
        transparent
        onRequestClose={() => { if (!emailReceiptSending) { setShowEmailReceiptModal(false); } }}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 12, width: '85%', maxWidth: 400, padding: 20 }}>
            <Text style={{ fontSize: 17, fontWeight: '700', color: '#1f2937', marginBottom: 6 }}>📧 {t('orders.email-receipt-title')}</Text>
            <Text style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>{t('orders.email-receipt-prompt')}</Text>
            <TextInput
              style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 10, fontSize: 14, marginBottom: 16, backgroundColor: '#f9fafb' }}
              value={emailReceiptAddress}
              onChangeText={setEmailReceiptAddress}
              placeholder="customer@email.com"
              placeholderTextColor="#9ca3af"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!emailReceiptSending}
            />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: '#f3f4f6', borderRadius: 8, padding: 12, alignItems: 'center' }}
                onPress={() => { setShowEmailReceiptModal(false); setEmailReceiptAddress(''); }}
                disabled={emailReceiptSending}
              >
                <Text style={{ fontWeight: '600', color: '#374151' }}>{t('orders.no-thanks')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: emailReceiptSending ? '#93c5fd' : '#3b82f6', borderRadius: 8, padding: 12, alignItems: 'center' }}
                onPress={() => sendEmailReceipt(emailReceiptAddress, emailReceiptSessionId || undefined)}
                disabled={emailReceiptSending || !emailReceiptAddress.trim()}
              >
                {emailReceiptSending
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={{ fontWeight: '600', color: '#fff' }}>{t('orders.send-receipt-btn')}</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
        </KeyboardAvoidingView>
      </Modal>
    );

    // ============= PAYMENT MODAL (shared between history and menu views) =============
    const paymentModal = (
        <Modal
          supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}
          visible={showPaymentModal}
          animationType="fade"
          transparent
          onRequestClose={() => {
            if (!kpayProcessing) {
              setShowPaymentModal(false);
              setKpayLogs([]);
              setKpayModalTitle(null);
            }
          }}
        >
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
            <View style={{ backgroundColor: '#fff', borderRadius: 12, width: '85%', maxWidth: 440, padding: 20 }}>
              {/* Header row: title + X button */}
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 }}>
                <Text style={{ flex: 1, fontSize: 18, fontWeight: '700', color: '#1f2937' }}>{kpayModalTitle || t('orders.collect-payment')}</Text>
                <TouchableOpacity
                  style={{ padding: 4, marginLeft: 8 }}
                  onPress={() => {
                    if (kpayPollRef.current) { clearTimeout(kpayPollRef.current); kpayPollRef.current = null; }
                    setShowPaymentModal(false);
                    setKpayLogs([]);
                    setKpayStatusMsg('');
                    setKpayModalTitle(null);
                  }}
                >
                  <Ionicons name="close" size={22} color="#6b7280" />
                </TouchableOpacity>
              </View>
              <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 16 }}>
                {t('orders.order-now')} {paymentModalOrderNumber ? `#${paymentModalOrderNumber}` : ''}
              </Text>

              {/* Total */}
              <View style={{ backgroundColor: '#f8f9fa', borderRadius: 8, padding: 12, marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: '#1f2937' }}>{t('orders.grand-total')}</Text>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: '#1f2937' }}>{formatPrice(paymentModalTotal)}</Text>
                </View>
              </View>

              {/* KPay Terminal Processing View */}
              {kpayProcessing || kpayLogs.length > 0 ? (
                <View style={{ marginBottom: 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#1e40af' }}>{t('orders.kpay-terminal')}</Text>
                    {kpayStatusMsg ? (
                      <View style={{ backgroundColor: kpayStatusMsg.includes('✅') || kpayStatusMsg === t('orders.kpay-paid') ? '#d1fae5' : '#fef3c7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}>
                        <Text style={{ fontSize: 11, fontWeight: '600', color: kpayStatusMsg.includes('✅') || kpayStatusMsg === t('orders.kpay-paid') ? '#065f46' : '#b45309' }}>{kpayStatusMsg}</Text>
                      </View>
                    ) : null}
                  </View>
                  <ScrollView style={{ backgroundColor: '#1a1a1a', borderRadius: 8, padding: 10, maxHeight: 160 }}>
                    {kpayLogs.map((log, idx) => (
                      <Text key={idx} style={{ color: log.color, fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', marginBottom: 2 }}>{log.msg}</Text>
                    ))}
                    {kpayProcessing && <ActivityIndicator size="small" color="#00ff00" style={{ marginTop: 6, alignSelf: 'flex-start' }} />}
                  </ScrollView>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                    {kpayProcessing ? (
                      kpayOperationType !== 'sale' ? (
                        // Void/Refund in progress — just show status, no action button
                        <View style={{ flex: 1, backgroundColor: '#fef3c7', borderRadius: 8, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#fde68a' }}>
                          <ActivityIndicator size="small" color="#b45309" style={{ marginBottom: 4 }} />
                          <Text style={{ fontSize: 12, color: '#92400e', fontWeight: '600' }}>Processing on terminal…</Text>
                          <Text style={{ fontSize: 11, color: '#b45309', marginTop: 2 }}>Please wait or check the terminal screen</Text>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={{ flex: 1, backgroundColor: '#fee2e2', borderRadius: 8, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#fca5a5' }}
                          onPress={abortKpayPayment}
                        >
                          <Text style={{ fontWeight: '600', color: '#dc2626' }}>{t('orders.abort')}</Text>
                        </TouchableOpacity>
                      )
                    ) : (
                      <TouchableOpacity
                        style={{ flex: 1, backgroundColor: '#d1fae5', borderRadius: 8, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#6ee7b7' }}
                        onPress={() => {
                          setShowPaymentModal(false);
                          setKpayLogs([]);
                          setKpayStatusMsg('');
                          setKpayModalTitle(null);
                          loadOrdersAndSessions();
                        }}
                      >
                        <Text style={{ fontWeight: '600', color: '#065f46' }}>{t('orders.done')}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ) : (
                <>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 }}>{t('orders.payment-method')}</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: (kpayTerminal && paymentModalMethod === 'kpay') || (paOfflineTerminal && paymentModalMethod === 'payment-asia-offline') ? 8 : 20 }}>
                    {customPaymentMethods.map((method) => (
                      <TouchableOpacity
                        key={method.id}
                        style={{ flex: 1, minWidth: 80, backgroundColor: paymentModalMethod === method.id ? '#3b82f6' : '#f3f4f6', borderRadius: 8, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: paymentModalMethod === method.id ? '#3b82f6' : '#d1d5db' }}
                        onPress={() => setPaymentModalMethod(method.id)}
                      >
                        <Text style={{ fontWeight: '600', color: paymentModalMethod === method.id ? '#fff' : '#374151', fontSize: 12 }}>{method.label}</Text>
                      </TouchableOpacity>
                    ))}
                    {kpayTerminal && (
                      <TouchableOpacity
                        style={{ flex: 1, minWidth: 80, backgroundColor: paymentModalMethod === 'kpay' ? '#3b82f6' : '#f3f4f6', borderRadius: 8, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: paymentModalMethod === 'kpay' ? '#3b82f6' : '#d1d5db' }}
                        onPress={() => setPaymentModalMethod('kpay')}
                      >
                        <Text style={{ fontWeight: '600', color: paymentModalMethod === 'kpay' ? '#fff' : '#374151', fontSize: 12 }}>KPay Terminal</Text>
                      </TouchableOpacity>
                    )}
                    {paOfflineTerminal && (
                      <TouchableOpacity
                        style={{ flex: 1, minWidth: 80, backgroundColor: paymentModalMethod === 'payment-asia-offline' ? '#3b82f6' : '#f3f4f6', borderRadius: 8, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: paymentModalMethod === 'payment-asia-offline' ? '#3b82f6' : '#d1d5db' }}
                        onPress={() => setPaymentModalMethod('payment-asia-offline')}
                      >
                        <Text style={{ fontWeight: '600', color: paymentModalMethod === 'payment-asia-offline' ? '#fff' : '#374151', fontSize: 12 }}>PA Terminal</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  {paymentModalMethod === 'kpay' && kpayTerminal && (
                    <View style={{ backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe', borderRadius: 8, padding: 10, marginBottom: 16 }}>
                      <Text style={{ fontSize: 12, color: '#1d4ed8' }}>
                        {t('orders.kpay-terminal-msg').replace('{0}', kpayTerminal.terminal_ip || '')}
                      </Text>
                    </View>
                  )}
                  {paymentModalMethod === 'payment-asia-offline' && paOfflineTerminal && (
                    <View style={{ backgroundColor: '#fefce8', borderWidth: 1, borderColor: '#fde68a', borderRadius: 8, padding: 10, marginBottom: 16 }}>
                      <Text style={{ fontSize: 12, color: '#92400e' }}>
                        Payment will be sent to PA terminal ({paOfflineTerminal.terminal_ip}:{paOfflineTerminal.terminal_port}). Tap Confirm to initiate.
                      </Text>
                    </View>
                  )}
                  {/* Cash received */}
                  {paymentModalMethod === 'cash' && (
                    <View style={{ backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0', borderRadius: 8, padding: 12, marginBottom: 16 }}>
                      <Text style={{ fontWeight: '600', fontSize: 13, color: '#166534', marginBottom: 6 }}>{t('admin.cash-received')}</Text>
                      <TextInput
                        style={{ borderWidth: 1, borderColor: '#86efac', borderRadius: 6, padding: 8, fontSize: 15, fontWeight: '600', backgroundColor: '#fff' }}
                        keyboardType="decimal-pad"
                        value={paymentModalCashReceived}
                        onChangeText={setPaymentModalCashReceived}
                        placeholder="0.00"
                      />
                      {paymentModalCashReceived !== '' && parseFloat(paymentModalCashReceived) > 0 && (() => {
                        const change = parseFloat(paymentModalCashReceived) - paymentModalTotal / 100;
                        return (
                          <Text style={{ fontSize: 13, color: change >= 0 ? '#166534' : '#dc2626', marginTop: 6, fontWeight: '600' }}>
                            {t('admin.cash-change')}: ${change.toFixed(2)}
                          </Text>
                        );
                      })()}
                    </View>
                  )}
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity
                      style={{ flex: 1, backgroundColor: '#e5e7eb', borderRadius: 8, padding: 12, alignItems: 'center' }}
                      onPress={() => {
                        setShowPaymentModal(false);
                        showToast(t('orders.pay-later-msg'), 'info');
                      }}
                    >
                      <Text style={{ fontWeight: '600', color: '#374151' }}>{t('orders.pay-later')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{ flex: 1, backgroundColor: '#10b981', borderRadius: 8, padding: 12, alignItems: 'center' }}
                      onPress={submitPaymentModal}
                    >
                      <Text style={{ fontWeight: '600', color: '#fff' }}>{t('orders.confirm-payment')}</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </View>
        </Modal>
    );

    // ============= KPAY REFUND MODAL (shown before terminal window — collect amount + password) =============
    const kpayRefundModal = (
      <Modal
        supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}
        visible={showKpayRefundModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowKpayRefundModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ width: '80%', maxWidth: 400 }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 20 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#1f2937', marginBottom: 4 }}>{t('orders.kpay-refund')}</Text>
            <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 16 }}>
              Ref: {selectedHistoryOrder?.kpay_reference_id || selectedHistoryOrder?.cp_vendor_ref || '—'}
            </Text>
            <Text style={{ fontSize: 14, color: '#374151', marginBottom: 4 }}>Manager Password</Text>
            <TextInput
              style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 10, fontSize: 16, marginBottom: 4 }}
              keyboardType="number-pad"
              secureTextEntry
              value={kpayRefundPassword}
              onChangeText={setKpayRefundPassword}
              placeholder="Enter manager password"
            />
            <Text style={{ fontSize: 11, color: '#6b7280', marginBottom: 16 }}>
              Encrypted before sending to terminal.
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: '#e5e7eb', borderRadius: 8, padding: 12, alignItems: 'center' }}
                onPress={() => setShowKpayRefundModal(false)}
              >
                <Text style={{ fontWeight: '600', color: '#374151' }}>{t('orders.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: '#ef4444', borderRadius: 8, padding: 12, alignItems: 'center' }}
                onPress={submitKpayRefund}
              >
                <Text style={{ fontWeight: '600', color: '#fff' }}>{t('orders.submit-refund')}</Text>
              </TouchableOpacity>
            </View>
          </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    );

    // ============= HISTORY FILTER MODAL =============
    const historyFilterModal = (
      <Modal
        supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}
        visible={showHistoryFilterModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowHistoryFilterModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, paddingBottom: 36 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 17, fontWeight: '700', color: '#1f2937' }}>Filter Orders</Text>
              <TouchableOpacity onPress={() => setShowHistoryFilterModal(false)}>
                <Ionicons name="close" size={22} color="#6b7280" />
              </TouchableOpacity>
            </View>
            {/* Date */}
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 }}>Date</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
              {([{ key: 'all', label: 'All Time' }, { key: 'today', label: 'Today' }, { key: 'yesterday', label: 'Yesterday' }, { key: 'week', label: 'Last 7 Days' }, { key: 'custom', label: 'Custom Date Range' }] as const).map(opt => (
                <TouchableOpacity
                  key={opt.key}
                  style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: historyDateFilter === opt.key ? '#3b82f6' : '#f3f4f6', borderWidth: 1, borderColor: historyDateFilter === opt.key ? '#3b82f6' : '#e5e7eb' }}
                  onPress={() => setHistoryDateFilter(opt.key)}
                >
                  <Text style={{ fontSize: 13, fontWeight: '600', color: historyDateFilter === opt.key ? '#fff' : '#374151' }}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {historyDateFilter === 'custom' && (
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 11, color: '#6b7280', marginBottom: 3 }}>From (YYYY-MM-DD)</Text>
                  <TextInput
                    style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 8, fontSize: 14 }}
                    placeholder="2025-01-01"
                    value={historyDateFrom}
                    onChangeText={setHistoryDateFrom}
                    keyboardType="numbers-and-punctuation"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 11, color: '#6b7280', marginBottom: 3 }}>To (YYYY-MM-DD)</Text>
                  <TextInput
                    style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 8, fontSize: 14 }}
                    placeholder="2025-12-31"
                    value={historyDateTo}
                    onChangeText={setHistoryDateTo}
                    keyboardType="numbers-and-punctuation"
                  />
                </View>
              </View>
            )}
            <View style={{ marginBottom: 16 }} />
            {/* Payment Status */}
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 }}>Payment Status</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {([{ key: 'all', label: 'All' }, { key: 'paid', label: 'Paid' }, { key: 'unpaid', label: 'Unpaid' }, { key: 'pending', label: 'Pending' }, { key: 'refunded', label: 'Refunded' }, { key: 'voided', label: 'Voided' }] as const).map(opt => (
                <TouchableOpacity
                  key={opt.key}
                  style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: historyPaymentStatusFilter === opt.key ? '#3b82f6' : '#f3f4f6', borderWidth: 1, borderColor: historyPaymentStatusFilter === opt.key ? '#3b82f6' : '#e5e7eb' }}
                  onPress={() => setHistoryPaymentStatusFilter(opt.key)}
                >
                  <Text style={{ fontSize: 13, fontWeight: '600', color: historyPaymentStatusFilter === opt.key ? '#fff' : '#374151' }}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {/* Payment Method — only show chips for methods activated for this restaurant */}
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 }}>Payment Method</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
              {([
                { key: 'all', label: 'All', visible: true },
                { key: 'cash', label: 'Cash', visible: customPaymentMethods.some(m => m.id === 'cash') },
                { key: 'card', label: 'Card', visible: customPaymentMethods.some(m => m.id === 'credit-card' || m.id === 'card') },
                { key: 'kpay', label: 'KPay', visible: !!kpayTerminal },
                { key: 'payment-asia', label: 'PA Online', visible: paOnlineEnabled },
                { key: 'payment-asia-offline', label: 'PA Terminal', visible: !!paOfflineTerminal },
              ] as Array<{ key: typeof historyPaymentMethodFilter; label: string; visible: boolean }>)
                .filter(opt => opt.visible)
                .map(opt => (
                  <TouchableOpacity
                    key={opt.key}
                    style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: historyPaymentMethodFilter === opt.key ? '#3b82f6' : '#f3f4f6', borderWidth: 1, borderColor: historyPaymentMethodFilter === opt.key ? '#3b82f6' : '#e5e7eb' }}
                    onPress={() => setHistoryPaymentMethodFilter(opt.key)}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '600', color: historyPaymentMethodFilter === opt.key ? '#fff' : '#374151' }}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: '#f3f4f6', borderRadius: 8, padding: 12, alignItems: 'center' }}
                onPress={() => { setHistoryDateFilter('all'); setHistoryDateFrom(''); setHistoryDateTo(''); setHistoryPaymentStatusFilter('all'); setHistoryPaymentMethodFilter('all'); }}
              >
                <Text style={{ fontWeight: '600', color: '#374151' }}>Clear All</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: '#3b82f6', borderRadius: 8, padding: 12, alignItems: 'center' }}
                onPress={() => setShowHistoryFilterModal(false)}
              >
                <Text style={{ fontWeight: '600', color: '#fff' }}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );

    // ============= PA ONLINE REFUND MODAL =============
    const paOnlineRefundModal = (
      <Modal
        supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}
        visible={showPaRefundModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowPaRefundModal(false)}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 12, width: '80%', maxWidth: 400, padding: 20 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#1f2937', marginBottom: 4 }}>
              {t('orders.pa-refund')}
            </Text>
            <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 16 }}>
              Ref: {selectedHistoryOrder?.cp_vendor_ref || selectedHistoryOrder?.kpay_reference_id || '—'}
            </Text>
            <Text style={{ fontSize: 14, color: '#374151', marginBottom: 4 }}>{t('orders.refund-amount-dollar')}</Text>
            <TextInput
              style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 10, fontSize: 16, marginBottom: 16 }}
              keyboardType="decimal-pad"
              value={paRefundAmount}
              onChangeText={setPaRefundAmount}
              placeholder="0.00"
            />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: '#e5e7eb', borderRadius: 8, padding: 12, alignItems: 'center' }}
                onPress={() => setShowPaRefundModal(false)}
              >
                <Text style={{ fontWeight: '600', color: '#374151' }}>{t('orders.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: '#ef4444', borderRadius: 8, padding: 12, alignItems: 'center' }}
                onPress={submitPaRefund}
              >
                <Text style={{ fontWeight: '600', color: '#fff' }}>{t('orders.submit-refund')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        </KeyboardAvoidingView>
      </Modal>
    );

    if (loading && !showHistory) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      );
    }

    // ============= CART ITEM EDIT MODAL =============
    const cartItemEditModal = cartEditModal ? (() => {
      const { item, idx } = cartEditModal;
      const itemName = lang === 'zh' && item.name_zh ? item.name_zh : item.name;
      const numpadKeys = ['1','2','3','4','5','6','7','8','9','','0','⌫'];
      return (
        <Modal
          supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}
          visible={true}
          animationType="slide"
          transparent
          onRequestClose={() => setCartEditModal(null)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1, justifyContent: 'flex-end' }}
          >
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
            <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '92%', flex: 1 }}>
              {/* Close handle */}
              <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 4 }}>
                <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: '#d1d5db' }} />
              </View>
              <TouchableOpacity style={{ position: 'absolute', top: 14, right: 16, zIndex: 10, padding: 4 }} onPress={() => setCartEditModal(null)}>
                <Text style={{ fontSize: 22, color: '#6b7280', fontWeight: '600' }}>✕</Text>
              </TouchableOpacity>

              <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
                {/* Image */}
                {item.image_url && item.image_url.trim() ? (
                  <Image source={{ uri: getFullImageUrl(item.image_url)! }} style={{ width: '100%', height: 180, borderTopLeftRadius: 20, borderTopRightRadius: 20 }} resizeMode="cover" />
                ) : null}

                {/* Item name + description */}
                <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 }}>
                  <Text style={{ fontSize: 22, fontWeight: '800', color: '#1f2937', marginBottom: 4 }}>{itemName}</Text>
                  {item.description ? (
                    <Text style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>{item.description}</Text>
                  ) : null}
                  <Text style={{ fontSize: 16, fontWeight: '700', color: '#10b981' }}>{formatPrice(item.price_cents || 0)}</Text>
                </View>

                <View style={{ height: 1, backgroundColor: '#e5e7eb', marginHorizontal: 20, marginVertical: 12 }} />

                {/* QUANTITY SECTION */}
                <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Quantity</Text>
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 14 }}
                    onPress={() => setShowCartQtyNumpad(v => !v)}
                  >
                    <Text style={{ fontSize: 28, fontWeight: '800', color: '#1f2937' }}>×{cartQtyNumpadInput || '1'}</Text>
                    <Ionicons name={showCartQtyNumpad ? 'chevron-up' : 'chevron-down'} size={18} color="#6b7280" />
                  </TouchableOpacity>
                  {showCartQtyNumpad && (
                    <View style={{ marginTop: 10, backgroundColor: '#f9fafb', borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb', padding: 8 }}>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                        {numpadKeys.map((key, ki) => (
                          <TouchableOpacity
                            key={ki}
                            style={{ width: '33.33%', paddingVertical: 14, alignItems: 'center' }}
                            onPress={() => {
                              if (key === '⌫') {
                                setCartQtyNumpadInput(v => v.length > 1 ? v.slice(0, -1) : '');
                              } else if (key === '') {
                                // blank key — do nothing
                              } else {
                                setCartQtyNumpadInput(v => {
                                  const next = (v === '0' || v === '') ? key : v + key;
                                  return next.length > 3 ? v : next;
                                });
                              }
                            }}
                          >
                            <Text style={{ fontSize: 22, fontWeight: key === '⌫' ? '400' : '700', color: key === '' ? 'transparent' : '#1f2937' }}>{key}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  )}
                </View>

                {/* VARIANT SECTION */}
                {cartEditVariants.length > 0 && (
                  <>
                    <View style={{ height: 1, backgroundColor: '#e5e7eb', marginHorizontal: 20, marginBottom: 12 }} />
                    <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
                      <Text style={styles.variantSectionTitle}>{t('orders.select-options') || 'SELECT OPTIONS'}</Text>
                      {cartEditVariants.map((variant) => (
                        <View key={variant.id} style={styles.variantGroup}>
                          <View style={styles.variantGroupHeader}>
                            <Text style={styles.variantGroupName}>
                              {variant.name}
                              {variant.required && <Text style={{ color: '#ef4444' }}> *</Text>}
                            </Text>
                          </View>
                          <View style={styles.variantOptionsGrid}>
                            {variant.min_select === 1 && variant.max_select === 1 ? (
                              variant.options.map((option) => (
                                <TouchableOpacity
                                  key={option.id}
                                  style={styles.variantOption}
                                  onPress={() => setCartEditVariantSelections(prev => ({ ...prev, [variant.id]: option.id }))}
                                >
                                  <View style={[styles.radioButton, cartEditVariantSelections[variant.id] === option.id && styles.radioButtonSelected]} />
                                  <View style={styles.variantOptionContent}>
                                    <Text style={styles.variantOptionName}>{option.name}</Text>
                                    {option.price_cents !== 0 && <Text style={styles.variantOptionPrice}>{option.price_cents > 0 ? '+' : ''}{formatPrice(option.price_cents)}</Text>}
                                  </View>
                                </TouchableOpacity>
                              ))
                            ) : (
                              variant.options.map((option) => {
                                const sel = Array.isArray(cartEditVariantSelections[variant.id])
                                  ? (cartEditVariantSelections[variant.id] as number[]).includes(option.id) : false;
                                return (
                                  <TouchableOpacity
                                    key={option.id}
                                    style={styles.variantOption}
                                    onPress={() => {
                                      setCartEditVariantSelections(prev => {
                                        const cur = Array.isArray(prev[variant.id]) ? [...(prev[variant.id] as number[])] : [];
                                        if (cur.includes(option.id)) cur.splice(cur.indexOf(option.id), 1);
                                        else cur.push(option.id);
                                        return { ...prev, [variant.id]: cur };
                                      });
                                    }}
                                  >
                                    <View style={[styles.checkbox, sel && styles.checkboxSelected]} />
                                    <View style={styles.variantOptionContent}>
                                      <Text style={styles.variantOptionName}>{option.name}</Text>
                                      {option.price_cents !== 0 && <Text style={styles.variantOptionPrice}>{option.price_cents > 0 ? '+' : ''}{formatPrice(option.price_cents)}</Text>}
                                    </View>
                                  </TouchableOpacity>
                                );
                              })
                            )}
                          </View>
                        </View>
                      ))}
                    </View>
                  </>
                )}

                {/* COMBO / ADDON SECTION */}
                {cartEditItemAddons.length > 0 && (
                  <>
                    <View style={{ height: 1, backgroundColor: '#e5e7eb', marginHorizontal: 20, marginBottom: 12 }} />
                    <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
                      <Text style={styles.variantSectionTitle}>{t('orders.add-ons') || 'ADD-ONS'}</Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 }}>
                        {cartEditItemAddons.map((addon) => {
                          const isSelected = cartEditAddons.some(a => a.addon_id === addon.id);
                          const discountPct = addon.regular_price_cents > 0
                            ? Math.round(((addon.regular_price_cents - addon.addon_discount_price_cents) / addon.regular_price_cents) * 100)
                            : 0;
                          return (
                            <TouchableOpacity
                              key={addon.id}
                              onPress={() => toggleCartEditAddon(addon)}
                              style={{ width: 110, borderRadius: 10, borderWidth: 2, borderColor: isSelected ? '#667eea' : '#e5e7eb', backgroundColor: isSelected ? '#f0f0ff' : '#fff', overflow: 'hidden' }}
                            >
                              {addon.addon_item_image ? (
                                <Image source={{ uri: getFullImageUrl(addon.addon_item_image)! }} style={{ width: '100%', height: 70, borderTopLeftRadius: 8, borderTopRightRadius: 8 }} />
                              ) : (
                                <View style={{ width: '100%', height: 70, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' }}>
                                  <Ionicons name="fast-food-outline" size={28} color="#d1d5db" />
                                </View>
                              )}
                              {isSelected && (
                                <View style={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center' }}>
                                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>✓</Text>
                                </View>
                              )}
                              <View style={{ padding: 6 }}>
                                <Text style={{ fontSize: 11, fontWeight: '600', color: '#1f2937' }} numberOfLines={2}>{addon.addon_item_name}</Text>
                                <Text style={{ fontSize: 11, color: '#667eea', fontWeight: '600', marginTop: 2 }}>{formatPrice(addon.addon_discount_price_cents)}</Text>
                                {discountPct > 0 && <Text style={{ fontSize: 9, color: '#ef4444', marginTop: 1 }}>-{discountPct}% off</Text>}
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                      {/* Addon variant sub-modal inside cart edit */}
                      {cartEditAddonVariantModal && (
                        <View style={{ marginTop: 12, padding: 12, backgroundColor: '#f9fafb', borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb' }}>
                          <Text style={{ fontSize: 14, fontWeight: '700', color: '#1f2937', marginBottom: 8 }}>
                            {cartEditAddonVariantModal.addon.addon_item_name} — {t('orders.select-options') || 'Select Options'}
                          </Text>
                          {cartEditAddonVariantModal.variants.map((variant) => (
                            <View key={variant.id} style={{ marginBottom: 8 }}>
                              <Text style={{ fontSize: 12, fontWeight: '600', color: '#374151', marginBottom: 4 }}>{variant.name}{variant.required && <Text style={{ color: '#ef4444' }}> *</Text>}</Text>
                              {variant.min_select === 1 && variant.max_select === 1 ? (
                                variant.options.map((option) => (
                                  <TouchableOpacity key={option.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4 }}
                                    onPress={() => setCartEditAddonVariantSelections(prev => ({ ...prev, [variant.id]: option.id }))}>
                                    <View style={[styles.radioButton, cartEditAddonVariantSelections[variant.id] === option.id && styles.radioButtonSelected]} />
                                    <Text style={{ fontSize: 12, marginLeft: 8 }}>{option.name}</Text>
                                    {option.price_cents !== 0 && <Text style={{ fontSize: 11, color: '#6b7280', marginLeft: 4 }}>{option.price_cents > 0 ? '+' : ''}{formatPrice(option.price_cents)}</Text>}
                                  </TouchableOpacity>
                                ))
                              ) : (
                                variant.options.map((option) => {
                                  const sel = Array.isArray(cartEditAddonVariantSelections[variant.id])
                                    ? (cartEditAddonVariantSelections[variant.id] as number[]).includes(option.id) : false;
                                  return (
                                    <TouchableOpacity key={option.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4 }}
                                      onPress={() => {
                                        setCartEditAddonVariantSelections(prev => {
                                          const cur = Array.isArray(prev[variant.id]) ? [...(prev[variant.id] as number[])] : [];
                                          if (cur.includes(option.id)) cur.splice(cur.indexOf(option.id), 1); else cur.push(option.id);
                                          return { ...prev, [variant.id]: cur };
                                        });
                                      }}>
                                      <View style={[styles.checkbox, sel && styles.checkboxSelected]} />
                                      <Text style={{ fontSize: 12, marginLeft: 8 }}>{option.name}</Text>
                                    </TouchableOpacity>
                                  );
                                })
                              )}
                            </View>
                          ))}
                          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                            <TouchableOpacity style={{ flex: 1, backgroundColor: '#e5e7eb', borderRadius: 8, padding: 10, alignItems: 'center' }} onPress={() => setCartEditAddonVariantModal(null)}>
                              <Text style={{ fontWeight: '600', color: '#374151' }}>{t('orders.cancel')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={{ flex: 1, backgroundColor: '#667eea', borderRadius: 8, padding: 10, alignItems: 'center' }}
                              onPress={() => {
                                const addon = cartEditAddonVariantModal.addon;
                                setCartEditAddons(prev => [...prev, {
                                  addon_id: addon.id, addon_item_id: addon.addon_item_id,
                                  addon_item_name: addon.addon_item_name,
                                  addon_discount_price_cents: addon.addon_discount_price_cents, quantity: 1,
                                }]);
                                setCartEditAddonVariantModal(null);
                              }}
                            >
                              <Text style={{ fontWeight: '600', color: '#fff' }}>Add</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}
                    </View>
                  </>
                )}

                {/* COMMENTS SECTION */}
                <View style={{ height: 1, backgroundColor: '#e5e7eb', marginHorizontal: 20, marginBottom: 12 }} />
                <View style={{ paddingHorizontal: 20, marginBottom: 24 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Comments</Text>
                  <TextInput
                    style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, padding: 12, fontSize: 14, color: '#374151', backgroundColor: '#fafafa', minHeight: 72, textAlignVertical: 'top' }}
                    placeholder={t('orders.add-remarks')}
                    placeholderTextColor="#9ca3af"
                    value={cartEditModal.item.notes || ''}
                    onChangeText={(text) => setCartEditModal(prev => prev ? { ...prev, item: { ...prev.item, notes: text } } : null)}
                    multiline
                  />
                </View>
              </ScrollView>

              {/* Footer buttons */}
              <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#e5e7eb' }}>
                <TouchableOpacity
                  style={{ flex: 1, backgroundColor: '#fee2e2', borderRadius: 10, padding: 14, alignItems: 'center' }}
                  onPress={() => { handleRemoveFromCart(idx); setCartEditModal(null); }}
                >
                  <Text style={{ fontWeight: '700', color: '#dc2626', fontSize: 14 }}>Remove Item</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flex: 2, backgroundColor: '#2c3e50', borderRadius: 10, padding: 14, alignItems: 'center' }}
                  onPress={saveCartEdit}
                >
                  <Text style={{ fontWeight: '700', color: '#fff', fontSize: 14 }}>Update Cart</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
          </KeyboardAvoidingView>
        </Modal>
      );
    })() : null;

    // ============= PA OFFLINE REFUND MODAL =============
    const paOfflineRefundModal = (
      <Modal
        supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}
        visible={showPaOfflineRefundModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowPaOfflineRefundModal(false)}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 12, width: '80%', maxWidth: 400, padding: 20 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#1f2937', marginBottom: 4 }}>PA Terminal Refund</Text>
            <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 16 }}>
              Ref: {paOfflineRefundTarget?.cp_vendor_ref || paOfflineRefundTarget?.kpay_reference_id || '—'}
            </Text>
            <Text style={{ fontSize: 14, color: '#374151', marginBottom: 4 }}>Refund Amount (HKD)</Text>
            <TextInput
              style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 10, fontSize: 16, marginBottom: 12 }}
              keyboardType="decimal-pad"
              value={paOfflineRefundAmount}
              onChangeText={setPaOfflineRefundAmount}
              placeholder="Full refund"
            />
            <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 16 }}>
              The refund will be processed on the PA payment terminal.
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: '#e5e7eb', borderRadius: 8, padding: 12, alignItems: 'center' }}
                onPress={() => setShowPaOfflineRefundModal(false)}
              >
                <Text style={{ fontWeight: '600', color: '#374151' }}>{t('orders.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: '#ef4444', borderRadius: 8, padding: 12, alignItems: 'center' }}
                onPress={submitPaOfflineRefund}
              >
                <Text style={{ fontWeight: '600', color: '#fff' }}>{t('orders.submit-refund')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        </KeyboardAvoidingView>
      </Modal>
    );

    // ============= RENDER HISTORY ORDER DETAIL (shared by iPad panel + iPhone full-page) =============
    const renderHistoryOrderDetail = () => {
      if (!selectedHistoryOrder) return null;
      return (
        <>
          {/* Header */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#1f2937' }}>
              {t('orders.order-num').replace('{0}', String(selectedHistoryOrder.restaurant_order_number || selectedHistoryOrder.id))}
            </Text>
            <View style={{ backgroundColor: selectedHistoryOrder.status === 'completed' ? '#d1fae5' : selectedHistoryOrder.status === 'cancelled' ? '#fee2e2' : '#dbeafe', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
              <Text style={{ fontSize: 11, fontWeight: '600', color: selectedHistoryOrder.status === 'completed' ? '#065f46' : selectedHistoryOrder.status === 'cancelled' ? '#991b1b' : '#1e40af' }}>
                {selectedHistoryOrder.status?.toUpperCase()}
              </Text>
            </View>
          </View>

          {/* Order Info */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={{ fontSize: 13, color: '#6b7280' }}>{t('orders.type')}</Text>
            <Text style={{ fontSize: 13, color: '#1f2937' }}>
              {t(`orders.${selectedHistoryOrder.order_type || 'dine-in'}`)}
              {selectedHistoryOrder.order_type === 'table' && selectedHistoryOrder.table_name ? ` — ${selectedHistoryOrder.table_name}` : ''}
            </Text>
          </View>

          {/* Editable Customer Info */}
          {editingCustomer ? (
            <View style={{ backgroundColor: '#f0f9ff', borderRadius: 8, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: '#bfdbfe' }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#1e40af', marginBottom: 6 }}>{t('orders.customer')}</Text>
              <TextInput
                style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 6, padding: 8, fontSize: 13, marginBottom: 4, backgroundColor: '#fff' }}
                value={editCustomerName}
                onChangeText={handleCustomerSearchInput}
                placeholder={t('orders.customer-name-placeholder')}
                placeholderTextColor="#9ca3af"
              />
              {(customerSearchResults.length > 0 || (customerSearchQuery.trim().length >= 1)) && (
                <View style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 6, maxHeight: 150, marginBottom: 4 }}>
                  <ScrollView nestedScrollEnabled>
                    {customerSearchResults.map((c: any) => (
                      <TouchableOpacity
                        key={c.id}
                        style={{ padding: 8, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}
                        onPress={() => selectCrmCustomer(c)}
                      >
                        <Text style={{ fontSize: 13, color: '#1f2937', fontWeight: '500' }}>{c.name}</Text>
                        {!!c.email && <Text style={{ fontSize: 11, color: '#6b7280' }}>{c.email}</Text>}
                        {!!c.phone && <Text style={{ fontSize: 11, color: '#6b7280' }}>{c.phone}</Text>}
                      </TouchableOpacity>
                    ))}
                    {customerSearchQuery.trim().length >= 1 && (
                      <TouchableOpacity
                        style={{ padding: 8, borderTopWidth: customerSearchResults.length > 0 ? 1 : 0, borderTopColor: '#e5e7eb', backgroundColor: '#f0fdf4' }}
                        onPress={() => {
                          // "Create new" just keeps the typed name, clears search results
                          setCustomerSearchResults([]);
                          setCustomerSearchQuery('');
                        }}
                      >
                        <Text style={{ fontSize: 13, color: '#166534', fontWeight: '600' }}>{t('orders.create-new-customer')}</Text>
                      </TouchableOpacity>
                    )}
                  </ScrollView>
                </View>
              )}
              <TextInput
                style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 6, padding: 8, fontSize: 13, marginBottom: 4, backgroundColor: '#fff' }}
                value={editCustomerPhone}
                onChangeText={setEditCustomerPhone}
                placeholder={t('orders.customer-phone-placeholder')}
                placeholderTextColor="#9ca3af"
                keyboardType="phone-pad"
              />
              <TextInput
                style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 6, padding: 8, fontSize: 13, marginBottom: 8, backgroundColor: '#fff' }}
                value={editCustomerEmail}
                onChangeText={setEditCustomerEmail}
                placeholder={t('orders.customer-email-placeholder')}
                placeholderTextColor="#9ca3af"
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <TouchableOpacity
                  style={{ flex: 1, backgroundColor: '#e5e7eb', borderRadius: 6, padding: 8, alignItems: 'center' }}
                  onPress={() => { setEditingCustomer(false); setCustomerSearchResults([]); }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#374151' }}>{t('orders.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flex: 1, backgroundColor: '#3b82f6', borderRadius: 6, padding: 8, alignItems: 'center' }}
                  onPress={saveCustomerEdit}
                >
                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#fff' }}>{t('orders.save')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => {
                setEditCustomerName(selectedHistoryOrder.customer_name || '');
                setEditCustomerPhone(selectedHistoryOrder.customer_phone || '');
                setEditCustomerEmail(selectedHistoryOrder.customer_email || '');
                setEditingCustomer(true);
                setCustomerSearchResults([]);
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center' }}>
                <Text style={{ fontSize: 13, color: '#6b7280' }}>{t('orders.customer')}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={{ fontSize: 13, color: '#1f2937' }}>
                    {selectedHistoryOrder.customer_name || selectedHistoryOrder.customer_phone
                      ? `${selectedHistoryOrder.customer_name || ''}${selectedHistoryOrder.customer_phone ? ` (${selectedHistoryOrder.customer_phone})` : ''}`
                      : t('orders.add-customer')}
                  </Text>
                  <Ionicons name="pencil-outline" size={12} color="#9ca3af" />
                </View>
              </View>
            </TouchableOpacity>
          )}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={{ fontSize: 13, color: '#6b7280' }}>{t('orders.date')}</Text>
            <Text style={{ fontSize: 13, color: '#1f2937' }}>{formatDate(selectedHistoryOrder.created_at)}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={{ fontSize: 13, color: '#6b7280' }}>{t('orders.items')}</Text>
            <Text style={{ fontSize: 13, color: '#1f2937' }}>{t('orders.items-count').replace('{0}', String((selectedHistoryOrder.items || []).reduce((sum: number, i: any) => sum + (i.quantity || 1), 0)))}</Text>
          </View>

          {/* Items Section */}
          <View style={{ borderTopWidth: 1, borderTopColor: '#e5e7eb', marginVertical: 12, paddingTop: 12 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#1f2937', marginBottom: 8 }}>{t('orders.order-items')}</Text>
            {(selectedHistoryOrder.items || []).map((item: any, idx: number) => (
              <View key={idx} style={{ paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ fontSize: 13, color: '#1f2937' }}>{lang === 'zh' && (item.menu_item_name_zh || item.name_zh) ? (item.menu_item_name_zh || item.name_zh) : (item.menu_item_name || item.name)}</Text>
                      {item.status && (() => {
                        const statusMap: Record<string, { label: string; bg: string; fg: string }> = {
                          pending: { label: t('orders.pending'), bg: '#fef3c7', fg: '#92400e' },
                          preparing: { label: t('orders.preparing') || 'Preparing', bg: '#dbeafe', fg: '#1e40af' },
                          ready: { label: t('orders.ready') || 'Ready', bg: '#d1fae5', fg: '#065f46' },
                          served: { label: t('orders.served') || 'Served', bg: '#e5e7eb', fg: '#374151' },
                          cancelled: { label: t('orders.cancelled') || 'Cancelled', bg: '#fee2e2', fg: '#991b1b' },
                        };
                        const s = statusMap[item.status];
                        return s ? (
                          <View style={{ backgroundColor: s.bg, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 }}>
                            <Text style={{ fontSize: 9, fontWeight: '600', color: s.fg }}>{s.label}</Text>
                          </View>
                        ) : null;
                      })()}
                    </View>
                    <Text style={{ fontSize: 11, color: '#9ca3af' }}>×{item.quantity}</Text>
                    {item.variants ? (
                      <Text style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{item.variants}</Text>
                    ) : null}
                    {item.notes ? (
                      <Text style={{ fontSize: 11, color: '#f59e0b', marginTop: 2 }}>{t('orders.note-prefix')}{item.notes}</Text>
                    ) : null}
                    {item.addons && item.addons.length > 0 ? (
                      <View style={{ marginTop: 3 }}>
                        {item.addons.map((addon: any, ai: number) => (
                          <Text key={ai} style={{ fontSize: 11, color: '#667eea', marginTop: 1 }}>
                            + {addon.menu_item_name} ×{addon.quantity} ({formatPrice(addon.item_total_cents || addon.unit_price_cents * addon.quantity)})
                          </Text>
                        ))}
                      </View>
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
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#1f2937', marginBottom: 8 }}>{t('orders.order-summary')}</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text style={{ fontSize: 13, color: '#6b7280' }}>{t('orders.subtotal')}</Text>
              <Text style={{ fontSize: 13, color: '#1f2937' }}>
                {formatPrice((selectedHistoryOrder.items || []).reduce((sum: number, i: any) => {
                  const itemTotal = i.item_total_cents || (i.price_cents || 0) * (i.quantity || 1);
                  const addonsTotal = (i.addons || []).reduce((s: number, a: any) => s + (a.item_total_cents || a.unit_price_cents * a.quantity), 0);
                  return sum + itemTotal + addonsTotal;
                }, 0))}
              </Text>
            </View>
            {(() => {
              const subtotal = (selectedHistoryOrder.items || []).reduce((sum: number, i: any) => {
                const itemTotal = i.item_total_cents || (i.price_cents || 0) * (i.quantity || 1);
                const addonsTotal = (i.addons || []).reduce((s: number, a: any) => s + (a.item_total_cents || a.unit_price_cents * a.quantity), 0);
                return sum + itemTotal + addonsTotal;
              }, 0);
              const serviceCharge = selectedHistoryOrder.total_cents - subtotal;
              if (serviceCharge > 0) {
                return (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ fontSize: 13, color: '#6b7280' }}>{t('orders.service-charge')}</Text>
                    <Text style={{ fontSize: 13, color: '#1f2937' }}>{formatPrice(serviceCharge)}</Text>
                  </View>
                );
              }
              return null;
            })()}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: 8, borderTopWidth: 1, borderTopColor: '#e5e7eb' }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#1f2937' }}>{t('orders.grand-total')}</Text>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#1f2937' }}>{formatPrice(selectedHistoryOrder.total_cents)}</Text>
            </View>
          </View>

          {/* Payment Information */}
          {(() => {
            const vendor = resolveVendor(selectedHistoryOrder);
            const _ps = selectedHistoryOrder.payment_status;
            const effectiveStatus = (_ps === 'voided' || _ps === 'cancelled' || _ps === 'refunded') ? _ps : (selectedHistoryOrder.cp_status || _ps || (selectedHistoryOrder.payment_received ? 'completed' : selectedHistoryOrder.status || null));
            const methodLabel = (() => { const raw = getPaymentMethodLabel(selectedHistoryOrder); const map: Record<string, string> = { 'Credit Card': t('orders.credit-card'), 'Cash': t('orders.cash'), 'Terminal': t('orders.terminal') }; return map[raw] || raw; })();
            const vendorLabel = (() => { if (vendor) { const raw = getVendorLabel(vendor); const map: Record<string, string> = { 'KPay Terminal': t('orders.kpay-terminal'), 'Payment Asia': t('orders.payment-asia'), 'PA Terminal': t('admin.pa-terminal'), 'Cash': t('orders.cash'), 'Card': t('orders.card') }; return map[raw] || raw; } return selectedHistoryOrder.payment_received ? t('orders.cash') : null; })();

            const statusBadge = (status: string | null) => {
              if (!status) return null;
              const map: Record<string, { label: string; bg: string; fg: string }> = {
                completed: { label: t('orders.paid'), bg: '#d1fae5', fg: '#065f46' },
                paid: { label: t('orders.paid'), bg: '#d1fae5', fg: '#065f46' },
                voided: { label: t('orders.voided'), bg: '#fef3c7', fg: '#92400e' },
                cancelled: { label: t('orders.voided'), bg: '#fef3c7', fg: '#92400e' },
                refunded: { label: t('orders.refunded'), bg: '#fee2e2', fg: '#991b1b' },
                partial_refund: { label: t('orders.partial-refund'), bg: '#fef3c7', fg: '#92400e' },
                pending: { label: t('orders.pending'), bg: '#dbeafe', fg: '#1e40af' },
                failed: { label: t('orders.failed'), bg: '#fee2e2', fg: '#991b1b' },
              };
              return map[status] || { label: status, bg: '#f3f4f6', fg: '#374151' };
            };
            const badge = statusBadge(effectiveStatus);

            return (
              <View style={{ borderTopWidth: 1, borderTopColor: '#e5e7eb', marginTop: 12, paddingTop: 12 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#1f2937', marginBottom: 8 }}>{t('orders.payment-info')}</Text>

                {/* Payment Status */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <Text style={{ fontSize: 13, color: '#6b7280' }}>{t('orders.payment-status')}</Text>
                  {badge ? (
                    <View style={{ backgroundColor: badge.bg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }}>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: badge.fg }}>{badge.label}</Text>
                    </View>
                  ) : (
                    <View style={{ backgroundColor: '#f3f4f6', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }}>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: '#6b7280' }}>{t('orders.unpaid')}</Text>
                    </View>
                  )}
                </View>

                {/* Payment Vendor */}
                {vendorLabel && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text style={{ fontSize: 13, color: '#6b7280' }}>{t('orders.payment-vendor')}</Text>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: vendor ? getVendorColor(vendor) : '#374151' }}>
                      {vendorLabel}
                    </Text>
                  </View>
                )}

                {/* Payment Method */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={{ fontSize: 13, color: '#6b7280' }}>{t('orders.payment-method')}</Text>
                  <Text style={{ fontSize: 13, color: '#1f2937' }}>{methodLabel}</Text>
                </View>

                {/* Order Number */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={{ fontSize: 13, color: '#6b7280' }}>{t('admin.order-num-prefix')}</Text>
                  <Text style={{ fontSize: 13, color: '#1f2937', fontWeight: '600' }}>{selectedHistoryOrder.restaurant_order_number || selectedHistoryOrder.id}</Text>
                </View>

                {/* Vendor Reference */}
                {(selectedHistoryOrder.cp_vendor_ref || selectedHistoryOrder.kpay_reference_id) && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text style={{ fontSize: 13, color: '#6b7280' }}>{t('orders.reference')}</Text>
                    <Text style={{ fontSize: 12, color: '#1f2937', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }} numberOfLines={1} ellipsizeMode="middle">{selectedHistoryOrder.cp_vendor_ref || selectedHistoryOrder.kpay_reference_id}</Text>
                  </View>
                )}

                {/* Paid At */}
                {selectedHistoryOrder.cp_completed_at && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text style={{ fontSize: 13, color: '#6b7280' }}>{t('orders.paid-at')}</Text>
                    <Text style={{ fontSize: 13, color: '#1f2937' }}>{formatDate(selectedHistoryOrder.cp_completed_at)}</Text>
                  </View>
                )}

                {/* Refund info */}
                {selectedHistoryOrder.cp_refund_amount_cents && selectedHistoryOrder.cp_refund_amount_cents > 0 && (
                  <View style={{ backgroundColor: '#fef2f2', borderRadius: 8, padding: 8, marginTop: 4 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: 13, color: '#ef4444' }}>{t('orders.refunded-label')}</Text>
                    </View>
                    {selectedHistoryOrder.cp_refunded_at && (
                      <Text style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>at {formatDate(selectedHistoryOrder.cp_refunded_at)}</Text>
                    )}
                  </View>
                )}

                {/* Void transaction link */}
                {selectedHistoryOrder.void_vendor_ref && (
                  <View style={{ backgroundColor: '#fff7ed', borderRadius: 8, padding: 10, marginTop: 8, borderLeftWidth: 3, borderLeftColor: '#f97316' }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#c2410c', marginBottom: 4 }}>⊘ Void Transaction</Text>
                    <Text style={{ fontSize: 11, color: '#7c3aed', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}>{selectedHistoryOrder.void_vendor_ref}</Text>
                  </View>
                )}

                {/* Refund transaction link */}
                {selectedHistoryOrder.refund_vendor_ref && (
                  <View style={{ backgroundColor: '#fef2f2', borderRadius: 8, padding: 10, marginTop: 8, borderLeftWidth: 3, borderLeftColor: '#ef4444' }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#dc2626', marginBottom: 4 }}>↩ Refund Transaction</Text>
                    <Text style={{ fontSize: 11, color: '#7c3aed', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}>{selectedHistoryOrder.refund_vendor_ref}</Text>
                  </View>
                )}

                {/* Sandbox badge */}
                {selectedHistoryOrder.cp_env === 'sandbox' && (
                  <View style={{ backgroundColor: '#fef3c7', borderRadius: 6, padding: 4, alignSelf: 'flex-start', marginTop: 6 }}>
                    <Text style={{ fontSize: 10, fontWeight: '600', color: '#92400e' }}>{t('orders.sandbox')}</Text>
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
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#1e40af', marginBottom: 8 }}>{t('orders.kpay-details')}</Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={{ fontSize: 12, color: '#6b7280' }}>{t('orders.order-ref')}</Text>
                  <Text style={{ fontSize: 12, color: '#1f2937', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}>{selectedHistoryOrder.kpay_reference_id}</Text>
                </View>
                {txLoading && <ActivityIndicator size="small" color="#3b82f6" style={{ marginVertical: 8 }} />}
                {kpayTxDetails && (
                  <>
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
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={{ fontSize: 12, color: '#6b7280' }}>{t('orders.amount')}</Text>
                      <Text style={{ fontSize: 12, color: '#1f2937' }}>
                        {kpayTxDetails.payCurrency || 'HKD'} {((Number(kpayTxDetails.payAmount) || kpayTxDetails.amount_cents || 0) / 100).toFixed(2)}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={{ fontSize: 12, color: '#6b7280' }}>{t('orders.status')}</Text>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: '#1f2937' }}>{kpayTxDetails.status || '—'}</Text>
                    </View>
                    {kpayTxDetails.payResult !== undefined && (
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text style={{ fontSize: 12, color: '#6b7280' }}>payResult</Text>
                        <Text style={{ fontSize: 12, color: '#1f2937' }}>{(KPAY_RESULT_MAP as any)[kpayTxDetails.payResult] || kpayTxDetails.payResult}</Text>
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
                        <Text style={{ fontSize: 12, color: '#ef4444' }}>{t('orders.refunded-label')}</Text>
                        <Text style={{ fontSize: 12, color: '#ef4444' }}>
                          {((kpayTxDetails.refund_amount_cents || 0) / 100).toFixed(2)}
                        </Text>
                      </View>
                    )}
                    {selectedHistoryOrder.void_vendor_ref && (
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text style={{ fontSize: 12, color: '#6b7280' }}>Void Ref</Text>
                        <Text style={{ fontSize: 11, color: '#ef4444', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}>{selectedHistoryOrder.void_vendor_ref}</Text>
                      </View>
                    )}
                    {selectedHistoryOrder.refund_vendor_ref && (
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text style={{ fontSize: 12, color: '#6b7280' }}>Refund Ref</Text>
                        <Text style={{ fontSize: 11, color: '#ef4444', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}>{selectedHistoryOrder.refund_vendor_ref}</Text>
                      </View>
                    )}
                  </>
                )}
              </View>
            );
          })()}

          {/* Payment Asia Online Transaction Details */}
          {(() => {
            const vendor = resolveVendor(selectedHistoryOrder);
            if (vendor !== 'payment-asia') return null;
            const merchantRef = selectedHistoryOrder.cp_vendor_ref || selectedHistoryOrder.chuio_order_reference || selectedHistoryOrder.kpay_reference_id;
            if (!merchantRef) return null;

            // Merge DB + live data into a single display object
            const dbTx: any[] = paTxDetails?.db?.transactions || [];
            const dbPayment: any = paTxDetails?.db?.payment || null;
            const liveRecords: any[] = paTxDetails?.live || [];
            const liveError: string | null = paTxDetails?.liveError || null;

            // Best-effort: use live if available, fall back to DB
            const primaryTx = dbTx[0] || null;
            const PA_STATUS_DISPLAY: Record<string, string> = {
              pending: 'Pending', approved: 'Completed', completed: 'Completed',
              failed: 'Failed', cancelled: 'Cancelled', refunded: 'Refunded',
              '1': 'Completed', '2': 'Pending', '3': 'Failed', '4': 'Processing',
            };

            // Prefer live record for amount/status; fall back to DB tx, then DB payment
            const liveSale = liveRecords.find((r: any) => String(r.type) === '1' || String(r.type).toLowerCase() === 'sale') || liveRecords[0];
            const displayStatus = (() => {
              if (liveSale?.status) return PA_STATUS_DISPLAY[String(liveSale.status)] || String(liveSale.status);
              if (primaryTx?.status) return PA_STATUS_DISPLAY[primaryTx.status] || primaryTx.status;
              if (dbPayment?.payment_status) return PA_STATUS_DISPLAY[dbPayment.payment_status] || dbPayment.payment_status;
              return '—';
            })();
            const displayAmount = (() => {
              if (liveSale?.amount) return `${liveSale.currency || 'HKD'} ${liveSale.amount}`;
              if (primaryTx?.amount_cents) return `${primaryTx.currency_code || 'HKD'} ${(primaryTx.amount_cents / 100).toFixed(2)}`;
              if (dbPayment?.total_cents) return `${dbPayment.currency_code || 'HKD'} ${(dbPayment.total_cents / 100).toFixed(2)}`;
              return '—';
            })();
            const displayMethod = (() => {
              const net = selectedHistoryOrder.payment_network || primaryTx?.network || primaryTx?.payment_method || dbPayment?.payment_method;
              const MAP: Record<string, string> = { Alipay: 'Alipay', WeChat: 'WeChat Pay', Wechat: 'WeChat Pay', CreditCard: 'Credit Card', FPS: 'FPS', Fps: 'FPS', Octopus: 'Octopus', CUP: 'UnionPay', visa: 'Visa', mastercard: 'Mastercard' };
              return net ? (MAP[net] || net) : null;
            })();
            const displayRef = liveSale?.request_reference || primaryTx?.transaction_id || dbPayment?.vendor_reference || null;
            const displayMerchantRef = merchantRef;
            const displayCreated = primaryTx?.created_at || dbPayment?.created_at || selectedHistoryOrder.created_at;
            const displayCompleted = primaryTx?.approved_at || dbPayment?.completed_at || (liveSale?.completed_time ? new Date(Number(liveSale.completed_time) * 1000).toISOString() : null);
            const displayRefunded = primaryTx?.refunded_at || dbPayment?.refunded_at;
            const displayRefundAmt = primaryTx?.refund_amount_cents || dbPayment?.refund_amount_cents;
            const displayEnv = primaryTx?.payment_gateway_env || dbPayment?.payment_gateway_env;

            const hasAnyData = primaryTx || dbPayment || liveSale;

            const Row = ({ label, value, mono }: { label: string; value: string; mono?: boolean }) => (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={{ fontSize: 12, color: '#6b7280' }}>{label}</Text>
                <Text style={{ fontSize: 12, color: '#1f2937', fontFamily: mono ? (Platform.OS === 'ios' ? 'Menlo' : 'monospace') : undefined, maxWidth: '60%', textAlign: 'right' }}>{value}</Text>
              </View>
            );

            return (
              <View style={{ backgroundColor: '#fefce8', borderRadius: 10, padding: 12, marginTop: 12, borderWidth: 1, borderColor: '#fde68a' }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#92400e' }}>{t('orders.pa-details')}</Text>
                  {displayEnv === 'sandbox' && (
                    <View style={{ backgroundColor: '#fef3c7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: '#92400e' }}>SANDBOX</Text>
                    </View>
                  )}
                </View>
                {txLoading && <ActivityIndicator size="small" color="#f59e0b" style={{ marginVertical: 8 }} />}
                {!txLoading && !hasAnyData && (
                  <Text style={{ fontSize: 12, color: '#9ca3af' }}>No transaction records found.</Text>
                )}
                {hasAnyData && (
                  <>
                    <Row label="Amount" value={displayAmount} />
                    <Row label="Status" value={displayStatus} />
                    {displayMethod && <Row label="Method" value={displayMethod} />}
                    <Row label="Merchant Ref" value={displayMerchantRef} mono />
                    {displayRef && <Row label="Transaction Ref" value={displayRef} mono />}
                    {displayCreated && <Row label="Created" value={new Date(displayCreated).toLocaleString()} />}
                    {displayCompleted && <Row label="Completed" value={new Date(displayCompleted).toLocaleString()} />}
                    {displayRefunded && <Row label="Refunded At" value={new Date(displayRefunded).toLocaleString()} />}
                    {displayRefundAmt && displayRefundAmt > 0 && (
                      <Row label="Refund Amount" value={`HKD ${(displayRefundAmt / 100).toFixed(2)}`} />
                    )}
                  </>
                )}
                {liveError && (
                  <Text style={{ fontSize: 10, color: '#d97706', marginTop: 6 }}>
                    Live query unavailable — showing recorded data. ({liveError})
                  </Text>
                )}
              </View>
            );
          })()}

          {/* PA-Offline Transaction Details */}
          {(() => {
            const vendor = resolveVendor(selectedHistoryOrder);
            if (vendor !== 'payment-asia-offline') return null;
            const paOrderId = selectedHistoryOrder.cp_vendor_ref || selectedHistoryOrder.kpay_reference_id;
            if (!paOrderId) return null;

            const fmtTime = (ts: any) => {
              if (!ts) return null;
              const n = Number(ts);
              return isNaN(n) ? String(ts) : new Date(n * 1000).toLocaleString();
            };
            const tx = paOfflineTxDetails;
            const paStatusLabels: Record<string, string> = {
              completed: 'Completed ✓', voided: 'Voided', refunded: 'Refunded',
              partial_refund: 'Partial Refund', failed: 'Failed', cancelled: 'Cancelled', pending: 'Pending',
            };
            const txStatus = tx?.status || '';

            return (
              <View style={{ backgroundColor: '#f0fdf4', borderRadius: 10, padding: 12, marginTop: 12, borderWidth: 1, borderColor: '#86efac' }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#166534', marginBottom: 8 }}>PA Terminal Transaction</Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={{ fontSize: 12, color: '#6b7280' }}>Order Ref</Text>
                  <Text style={{ fontSize: 11, color: '#1f2937', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}>{paOrderId}</Text>
                </View>
                {txLoading && <ActivityIndicator size="small" color="#16a34a" style={{ marginVertical: 8 }} />}
                {tx && (
                  <>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={{ fontSize: 12, color: '#6b7280' }}>Amount</Text>
                      <Text style={{ fontSize: 12, color: '#1f2937' }}>{tx.currency || 'HKD'} {((tx.amount_cents || 0) / 100).toFixed(2)}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={{ fontSize: 12, color: '#6b7280' }}>Status</Text>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: txStatus === 'completed' ? '#16a34a' : txStatus === 'voided' || txStatus === 'refunded' ? '#ef4444' : '#374151' }}>
                        {paStatusLabels[txStatus] || txStatus || '—'}
                      </Text>
                    </View>
                    {tx.payment_method && (
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text style={{ fontSize: 12, color: '#6b7280' }}>Method</Text>
                        <Text style={{ fontSize: 12, color: '#1f2937' }}>{tx.payment_method}</Text>
                      </View>
                    )}
                    {tx.provider && (
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text style={{ fontSize: 12, color: '#6b7280' }}>Provider</Text>
                        <Text style={{ fontSize: 12, color: '#1f2937' }}>{tx.provider}</Text>
                      </View>
                    )}
                    {tx.provider_reference && (
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text style={{ fontSize: 12, color: '#6b7280' }}>Provider Ref</Text>
                        <Text style={{ fontSize: 11, color: '#1f2937', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}>{tx.provider_reference}</Text>
                      </View>
                    )}
                    {tx.request_reference && (
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text style={{ fontSize: 12, color: '#6b7280' }}>Request Ref</Text>
                        <Text style={{ fontSize: 11, color: '#1f2937', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}>{tx.request_reference}</Text>
                      </View>
                    )}
                    {fmtTime(tx.pa_created_time) && (
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text style={{ fontSize: 12, color: '#6b7280' }}>Created</Text>
                        <Text style={{ fontSize: 12, color: '#1f2937' }}>{fmtTime(tx.pa_created_time)}</Text>
                      </View>
                    )}
                    {fmtTime(tx.pa_completed_time) && (
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text style={{ fontSize: 12, color: '#6b7280' }}>Completed</Text>
                        <Text style={{ fontSize: 12, color: '#1f2937' }}>{fmtTime(tx.pa_completed_time)}</Text>
                      </View>
                    )}
                  </>
                )}
              </View>
            );
          })()}

          {/* Payment Records Ledger — hidden for PA Online (covered by Transaction Details above) */}
          {selectedHistoryOrder.payment_records && selectedHistoryOrder.payment_records.length > 0 && resolveVendor(selectedHistoryOrder) !== 'payment-asia' && (
            <View style={{ borderTopWidth: 1, borderTopColor: '#e5e7eb', marginTop: 12, paddingTop: 12 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#1f2937', marginBottom: 8 }}>{t('orders.payment-ledger')}</Text>
              {selectedHistoryOrder.payment_records.map((record: PaymentRecord, idx: number) => (
                <View key={record.id || idx} style={{ backgroundColor: '#f9fafb', borderRadius: 8, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: '#e5e7eb' }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: getVendorColor(record.payment_vendor) }}>
                      {(() => { const raw = getVendorLabel(record.payment_vendor); const map: Record<string, string> = { 'KPay Terminal': t('orders.kpay-terminal'), 'Payment Asia': t('orders.payment-asia'), 'PA Terminal': t('admin.pa-terminal'), 'Cash': t('orders.cash'), 'Card': t('orders.card') }; return map[raw] || raw; })()}
                    </Text>
                    <View style={{ backgroundColor: record.status === 'completed' ? '#d1fae5' : record.status === 'failed' ? '#fee2e2' : '#fef3c7', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 }}>
                      <Text style={{ fontSize: 10, fontWeight: '600', color: record.status === 'completed' ? '#065f46' : record.status === 'failed' ? '#991b1b' : '#92400e' }}>
                        {(() => { const map: Record<string, string> = { completed: t('orders.paid'), paid: t('orders.paid'), failed: t('orders.failed'), pending: t('orders.pending'), refunded: t('orders.refunded'), voided: t('orders.voided'), cancelled: t('orders.voided') }; return map[record.status || ''] || record.status?.toUpperCase(); })()}
                      </Text>
                    </View>
                  </View>
                  {record.payment_method && (
                    <Text style={{ fontSize: 11, color: '#6b7280', marginBottom: 2 }}>{t('orders.method-prefix')}{record.payment_method}</Text>
                  )}
                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#1f2937' }}>{formatPrice(record.amount_cents)} {record.currency_code || ''}</Text>
                  {record.vendor_reference && (
                    <Text style={{ fontSize: 10, color: '#9ca3af', marginTop: 2, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}>{t('orders.ref-prefix')}{record.vendor_reference}</Text>
                  )}
                  {record.completed_at && (
                    <Text style={{ fontSize: 10, color: '#9ca3af', marginTop: 1 }}>{t('orders.completed-prefix')}{formatDate(record.completed_at)}</Text>
                  )}
                  {record.refund_amount_cents && record.refund_amount_cents > 0 && (
                    <Text style={{ fontSize: 11, color: '#ef4444', marginTop: 2 }}>{t('orders.refunded-prefix')}{formatPrice(record.refund_amount_cents)}</Text>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* Settle Bill for Unpaid Orders */}
          {(() => {
            if (!isOrderUnpaid(selectedHistoryOrder)) return null;
            return (
              <View style={{ backgroundColor: '#fff7ed', borderWidth: 1, borderColor: '#fed7aa', borderRadius: 8, padding: 16, marginTop: 12 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#92400e', marginBottom: 4 }}>{t('orders.payment-pending-title')}</Text>
                <Text style={{ fontSize: 12, color: '#78350f', marginBottom: 12 }}>{t('orders.payment-pending-msg')}</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    style={{ flex: 1, backgroundColor: '#667eea', borderRadius: 8, padding: 10, alignItems: 'center' }}
                    onPress={() => {
                      if (selectedHistoryOrder.session_id) {
                        setPaymentModalSessionId(selectedHistoryOrder.session_id);
                        setPaymentModalOrderId(selectedHistoryOrder.id);
                        setPaymentModalOrderNumber(selectedHistoryOrder.restaurant_order_number || selectedHistoryOrder.id);
                        setPaymentModalTotal(selectedHistoryOrder.total_cents);
                        setPaymentModalMethod(customPaymentMethods[0]?.id || 'cash');
                        setShowPaymentModal(true);
                      }
                    }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#fff' }}>{t('admin.settle-bill')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })()}

          {/* Void / Refund Actions */}
          {(() => {
            const vendor = resolveVendor(selectedHistoryOrder);
            const pStatus = selectedHistoryOrder.cp_status || selectedHistoryOrder.payment_status;
            const isVoided = pStatus === 'voided' || pStatus === 'cancelled';
            const isRefunded = pStatus === 'refunded';
            if (isVoided || isRefunded) return null;

            if (vendor === 'kpay' && kpayTerminal) {
              return (
                <View style={{ borderTopWidth: 1, borderTopColor: '#e5e7eb', marginTop: 12, paddingTop: 12 }}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity
                      style={{ flex: 1, backgroundColor: '#fef3c7', borderRadius: 8, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: '#f59e0b' }}
                      onPress={() => handleKpayVoid(selectedHistoryOrder)}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '600', color: '#92400e' }}>{t('orders.void-btn')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{ flex: 1, backgroundColor: '#fee2e2', borderRadius: 8, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: '#ef4444' }}
                      onPress={openKpayRefund}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '600', color: '#991b1b' }}>{t('orders.refund-btn')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }

            if (vendor === 'payment-asia') {
              return (
                <View style={{ borderTopWidth: 1, borderTopColor: '#e5e7eb', marginTop: 12, paddingTop: 12 }}>
                  <TouchableOpacity
                    style={{ backgroundColor: '#fee2e2', borderRadius: 8, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: '#ef4444' }}
                    onPress={openPaRefund}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#991b1b' }}>{t('orders.refund-pa-btn')}</Text>
                  </TouchableOpacity>
                </View>
              );
            }

            if (vendor === 'payment-asia-offline') {
              return (
                <View style={{ borderTopWidth: 1, borderTopColor: '#e5e7eb', marginTop: 12, paddingTop: 12 }}>
                  <TouchableOpacity
                    style={{ backgroundColor: '#fee2e2', borderRadius: 8, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: '#ef4444' }}
                    onPress={() => openPaOfflineRefundModal(selectedHistoryOrder)}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#991b1b' }}>Refund</Text>
                    <Text style={{ fontSize: 10, color: '#b91c1c', marginTop: 2 }}>PA Terminal</Text>
                  </TouchableOpacity>
                </View>
              );
            }

            if (!vendor || vendor === 'cash' || vendor === 'card') {
              const effStatus = pStatus || '';
              if (effStatus === 'completed' || effStatus === 'paid') {
                return (
                  <View style={{ borderTopWidth: 1, borderTopColor: '#e5e7eb', marginTop: 12, paddingTop: 12 }}>
                    <TouchableOpacity
                      style={{ backgroundColor: '#fee2e2', borderRadius: 8, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: '#ef4444' }}
                      onPress={() => handleRefundOrder(selectedHistoryOrder.id)}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '600', color: '#991b1b' }}>{t('orders.refund-btn')}</Text>
                    </TouchableOpacity>
                  </View>
                );
              }
            }
            return null;
          })()}

          {/* Print Receipt Button — for paid orders with a session */}
          {!isOrderUnpaid(selectedHistoryOrder) && selectedHistoryOrder.session_id && (
            <TouchableOpacity
              style={[{ backgroundColor: '#f0f0ff', borderRadius: 8, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: '#c7d2fe', marginTop: 12, flexDirection: 'row', justifyContent: 'center' }, printingBill && { opacity: 0.6 }]}
              onPress={() => printBillForSession(selectedHistoryOrder)}
              disabled={printingBill}
            >
              {printingBill ? <ActivityIndicator size="small" color="#667eea" /> : <Text style={{ fontSize: 13, fontWeight: '600', color: '#4f46e5' }}>🖨 {t('togo.print-receipt')}</Text>}
            </TouchableOpacity>
          )}

          {/* Print Kitchen Order Button */}
          <TouchableOpacity
            style={[{ backgroundColor: '#f0fdf4', borderRadius: 8, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: '#86efac', marginTop: 8, flexDirection: 'row', justifyContent: 'center' }, printingKitchen && { opacity: 0.6 }]}
            onPress={() => handlePrintKitchenOrder(selectedHistoryOrder)}
            disabled={printingKitchen}
          >
            {printingKitchen ? <ActivityIndicator size="small" color="#16a34a" /> : <Text style={{ fontSize: 13, fontWeight: '600', color: '#15803d' }}>🍳 Print Kitchen Order</Text>}
          </TouchableOpacity>

          {/* Cancel Item Button */}
          {(selectedHistoryOrder.items || []).filter((i: any) => !i.removed).length > 0 && (
            <TouchableOpacity
              style={{ backgroundColor: '#fff7ed', borderRadius: 8, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: '#fed7aa', marginTop: 8, flexDirection: 'row', justifyContent: 'center' }}
              onPress={() => handleCancelOrderItem(selectedHistoryOrder)}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#c2410c' }}>
                {(selectedHistoryOrder.items || []).filter((i: any) => !i.removed).length === 1 ? '✕ Cancel Order' : '✕ Cancel Item'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Email Receipt Button — for paid orders when feature is enabled */}
          {emailReceiptEnabled && !isOrderUnpaid(selectedHistoryOrder) && selectedHistoryOrder.session_id && (
            <TouchableOpacity
              style={{ backgroundColor: '#eff6ff', borderRadius: 8, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: '#bfdbfe', marginTop: 12 }}
              onPress={() => openEmailReceiptModal(
                selectedHistoryOrder.session_id!,
                selectedHistoryOrder.customer_email || ''
              )}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#1d4ed8' }}>📧 {t('orders.email-receipt-btn')}</Text>
            </TouchableOpacity>
          )}
        </>
      );
    };

    // ============= HISTORY VIEW =============
    if (showHistory) {
      const historyIsTablet = (Platform as any).isPad;

      // iPhone: full-page order detail when an order is selected
      if (!historyIsTablet && selectedHistoryOrder) {
        return (
          <>
            <View style={styles.container}>
              <View style={styles.historyHeader}>
                <TouchableOpacity onPress={() => setSelectedHistoryOrder(null)}>
                  <Ionicons name="arrow-back" size={22} color="#2C3E50" />
                </TouchableOpacity>
                <Text style={styles.historyTitle}>{t('orders.order-num').replace('{0}', String(selectedHistoryOrder.restaurant_order_number || selectedHistoryOrder.id))}</Text>
              </View>
              <ScrollView style={{ flex: 1, padding: 16 }}>
                {renderHistoryOrderDetail()}
              </ScrollView>
            </View>
            {paymentModal}
            {kpayRefundModal}
            {historyFilterModal}
            {paOnlineRefundModal}
            {paOfflineRefundModal}
            {cartItemEditModal}
            {emailReceiptModal}
          </>
        );
      }

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

          {/* Filter Tabs */}
          <View style={{ flexDirection: 'row', paddingHorizontal: 12, paddingTop: 8, paddingBottom: 8, gap: 8, alignItems: 'center' }}>
            {([
              { key: 'all' as const, label: t('orders.all-orders') },
              { key: 'table' as const, label: t('orders.table') },
              { key: 'pay-now' as const, label: t('orders.order-now') },
              { key: 'to-go' as const, label: t('orders.to-go') },
            ]).map(tab => (
              <TouchableOpacity
                key={tab.key}
                style={{
                  paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20,
                  backgroundColor: historyFilter === tab.key ? '#3b82f6' : '#f3f4f6',
                  flexDirection: 'row', alignItems: 'center', gap: 4,
                  borderWidth: 1, borderColor: historyFilter === tab.key ? '#3b82f6' : '#e5e7eb',
                }}
                onPress={() => {
                  setHistoryFilter(tab.key);
                  setHistoryTableFilter('');
                  // Reset all filters when switching tabs
                  setHistoryDateFilter('all');
                  setHistoryDateFrom('');
                  setHistoryDateTo('');
                  setHistoryPaymentStatusFilter('all');
                  setHistoryPaymentMethodFilter('all');
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: '600', color: historyFilter === tab.key ? '#fff' : '#374151' }}>
                  {tab.label}
                </Text>
                {unpaidCounts[tab.key] > 0 && (
                  <View style={{ backgroundColor: '#ef4444', borderRadius: 8, minWidth: 17, height: 17, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 }}>
                    <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>{unpaidCounts[tab.key]}</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
            {/* Advanced filter button */}
            <View style={{ flex: 1 }} />
            {(() => {
              const activeFilterCount = [historyDateFilter, historyPaymentStatusFilter, historyPaymentMethodFilter].filter(f => f !== 'all').length;
              return (
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 20, backgroundColor: activeFilterCount > 0 ? '#3b82f6' : '#f3f4f6', borderWidth: 1, borderColor: activeFilterCount > 0 ? '#3b82f6' : '#e5e7eb' }}
                  onPress={() => setShowHistoryFilterModal(true)}
                >
                  <Ionicons name="filter" size={14} color={activeFilterCount > 0 ? '#fff' : '#374151'} />
                  {activeFilterCount > 0 && (
                    <View style={{ backgroundColor: '#fff', borderRadius: 8, minWidth: 17, height: 17, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3 }}>
                      <Text style={{ color: '#3b82f6', fontSize: 10, fontWeight: '700' }}>{activeFilterCount}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })()}
          </View>

          {/* Table number filter (when Table tab is active) */}
          {historyFilter === 'table' && (
            <View style={{ paddingHorizontal: 12, paddingBottom: 8 }}>
              <TextInput
                style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 8, fontSize: 13, backgroundColor: '#fff' }}
                placeholder={t('orders.filter-table-placeholder')}
                placeholderTextColor="#9ca3af"
                value={historyTableFilter}
                onChangeText={setHistoryTableFilter}
              />
            </View>
          )}

          {/* Orders List — filtered orders descending */}
          <FlatList
            data={filteredHistoryOrders}
            keyExtractor={(item: any) => item.id.toString()}
            renderItem={({ item }) => {
              const order = item as Order;
              const paymentBadge = getPaymentBadge(order);
              const badgeLabelMap: Record<string, string> = {
                'Refunded': t('orders.refunded'),
                'Voided': t('orders.voided'),
                'Partial': t('orders.partial-refund'),
                'Paid': t('orders.paid'),
                'Unpaid': t('orders.unpaid'),
                'Pending': t('orders.pending'),
              };
              const translatedBadgeLabel = badgeLabelMap[paymentBadge.label] || paymentBadge.label;
              const orderTypeLabelMap: Record<string, string> = {
                'Order': t('orders.order'), 'Table': t('orders.table'),
                'Order Now': t('orders.order-now'), 'To-Go': t('orders.to-go'),
              };
              const vendorLabelMap: Record<string, string> = {
                'KPay Terminal': t('orders.kpay-terminal'), 'Payment Asia': t('orders.payment-asia'),
                'PA Terminal': t('admin.pa-terminal'),
                'Cash': t('orders.cash'), 'Card': t('orders.card'),
              };
              const methodLabelMap: Record<string, string> = {
                'Credit Card': t('orders.credit-card'), 'Cash': t('orders.cash'), 'Terminal': t('orders.terminal'),
              };
              const items = order.items || [];
              const isSelected = selectedHistoryOrder?.id === order.id;
              const orderUnpaid = isOrderUnpaid(order);
              return (
                <TouchableOpacity onPress={() => selectHistoryOrder(order)}>
                <View style={[styles.orderCard, isSelected && { borderColor: '#3b82f6', borderWidth: 2 }, orderUnpaid && { borderLeftWidth: 3, borderLeftColor: '#ef4444' }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        {orderUnpaid && (
                          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444' }} />
                        )}
                        <Text style={styles.orderId}>{t('orders.order-num').replace('{0}', String(order.restaurant_order_number || order.id))}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
                        <Ionicons 
                          name={order.order_type === 'table' ? 'restaurant-outline' : order.order_type === 'to-go' ? 'bag-handle-outline' : 'cart-outline'} 
                          size={13} 
                          color="#6b7280" 
                        />
                        <Text style={styles.orderDetails}>
                          {orderTypeLabelMap[getOrderTypeLabel(order.order_type)] || getOrderTypeLabel(order.order_type)}
                          {order.order_type === 'table' && order.table_name ? ` ${order.table_name}` : ''}
                          {order.order_type === 'to-go' && order.customer_name ? ` — ${order.customer_name}` : ''}
                          {order.order_type === 'to-go' && order.customer_phone ? ` (${order.customer_phone})` : ''}
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
                          <Text style={styles.statusText}>{translatedBadgeLabel}</Text>
                        </View>
                      )}
                      <Text style={{ fontSize: 10, color: '#9ca3af' }}>
                        {methodLabelMap[getPaymentMethodLabel(order)] || getPaymentMethodLabel(order)}
                        {(() => {
                          const v = resolveVendor(order);
                          if (v && v !== 'cash' && v !== 'card') {
                            const vLabel = vendorLabelMap[getVendorLabel(v)] || getVendorLabel(v);
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
                      {items.map((i: any) => `${lang === 'zh' && (i.menu_item_name_zh || i.name_zh) ? (i.menu_item_name_zh || i.name_zh) : (i.menu_item_name || i.name)} ×${i.quantity}`).join(', ')}
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
                  {renderHistoryOrderDetail()}
                </ScrollView>
              ) : (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                  <Ionicons name="receipt-outline" size={36} color="#d1d5db" />
                  <Text style={{ color: '#9ca3af', fontSize: 13, marginTop: 8 }}>{t('orders.select-order')}</Text>
                </View>
              )}
            </View>
          )}
        </View>
        {paymentModal}
        {kpayRefundModal}
        {historyFilterModal}
        {paOnlineRefundModal}
        {paOfflineRefundModal}
        {cartItemEditModal}
        {emailReceiptModal}
        </>
      );
    }

    // ============= MENU VIEW (DEFAULT) =============
    const menuScreenWidth = Dimensions.get('window').width;
    const menuIsTablet = (Platform as any).isPad;
    const menuNumColumns = menuIsTablet ? (menuScreenWidth > 1100 ? 4 : 3) : (menuScreenWidth > 500 ? 3 : 2);
    const menuItemWidthPct = `${Math.floor(100 / menuNumColumns) - 2}%` as const;

    // Shared variant selection content (used by both phone full-page and iPad modal)
    const variantContent = selectedItem ? (
      <>
        <ScrollView style={{ flex: 1 }}>
          {selectedItem.image_url && selectedItem.image_url.trim() ? (
            <Image source={{ uri: getFullImageUrl(selectedItem.image_url)! }} style={styles.variantSlideImage} />
          ) : null}
          <View style={styles.variantSlideHeader}>
            <Text style={styles.variantSlideTitle}>{lang === 'zh' && selectedItem.name_zh ? selectedItem.name_zh : selectedItem.name}</Text>
            <View style={styles.variantSlidePrice}>
              <Text style={styles.variantSlidePriceLabel}>{t('orders.price-label') || 'Price:'}</Text>
              <Text style={styles.variantSlidePriceValue}>{formatPrice(selectedItem.price_cents || 0)}</Text>
            </View>
            {selectedItem.description ? (
              <Text style={styles.variantSlideDescription}>{selectedItem.description}</Text>
            ) : null}
          </View>
          <View style={{ height: 1, backgroundColor: '#e5e7eb', marginHorizontal: 16 }} />
          {itemVariants.length > 0 ? (
            <View style={styles.variantContent}>
              <Text style={styles.variantSectionTitle}>{t('orders.select-options') || 'SELECT OPTIONS'}</Text>
              {itemVariants.map((variant) => (
                <View key={variant.id} style={styles.variantGroup}>
                  <View style={styles.variantGroupHeader}>
                    <Text style={styles.variantGroupName}>
                      {variant.name}
                      {variant.required && <Text style={{ color: '#ef4444' }}> *</Text>}
                    </Text>
                  </View>
                  <View style={styles.variantOptionsGrid}>
                    {variant.min_select === 1 && variant.max_select === 1 ? (
                      variant.options.map((option) => (
                        <TouchableOpacity
                          key={option.id}
                          style={styles.variantOption}
                          onPress={() => setVariantSelections(prev => ({ ...prev, [variant.id]: option.id }))}
                        >
                          <View style={[styles.radioButton, variantSelections[variant.id] === option.id && styles.radioButtonSelected]} />
                          <View style={styles.variantOptionContent}>
                            <Text style={styles.variantOptionName}>{option.name}</Text>
                            {option.price_cents !== 0 && <Text style={styles.variantOptionPrice}>{option.price_cents > 0 ? '+' : ''}{formatPrice(option.price_cents)}</Text>}
                          </View>
                        </TouchableOpacity>
                      ))
                    ) : (
                      variant.options.map((option) => {
                        const selected = Array.isArray(variantSelections[variant.id])
                          ? (variantSelections[variant.id] as number[]).includes(option.id) : false;
                        return (
                          <TouchableOpacity
                            key={option.id}
                            style={styles.variantOption}
                            onPress={() => {
                              setVariantSelections(prev => {
                                const current = Array.isArray(prev[variant.id]) ? [...(prev[variant.id] as number[])] : [];
                                if (current.includes(option.id)) current.splice(current.indexOf(option.id), 1);
                                else current.push(option.id);
                                return { ...prev, [variant.id]: current };
                              });
                            }}
                          >
                            <View style={[styles.checkbox, selected && styles.checkboxSelected]} />
                            <View style={styles.variantOptionContent}>
                              <Text style={styles.variantOptionName}>{option.name}</Text>
                              {option.price_cents !== 0 && <Text style={styles.variantOptionPrice}>{option.price_cents > 0 ? '+' : ''}{formatPrice(option.price_cents)}</Text>}
                            </View>
                          </TouchableOpacity>
                        );
                      })
                    )}
                  </View>
                </View>
              ))}
            </View>
          ) : null}
          {/* Addon items section */}
          {itemAddons.length > 0 ? (
            <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
              <View style={{ height: 1, backgroundColor: '#e5e7eb', marginBottom: 12 }} />
              <Text style={styles.variantSectionTitle}>{t('orders.add-ons') || 'ADD-ONS'}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 }}>
                {itemAddons.map((addon) => {
                  const isSelected = selectedAddons.some(a => a.addon_id === addon.id);
                  const discountPct = addon.regular_price_cents > 0
                    ? Math.round(((addon.regular_price_cents - addon.addon_discount_price_cents) / addon.regular_price_cents) * 100)
                    : 0;
                  return (
                    <TouchableOpacity
                      key={addon.id}
                      onPress={() => toggleAddon(addon)}
                      style={{
                        width: 110,
                        borderRadius: 10,
                        borderWidth: 2,
                        borderColor: isSelected ? '#667eea' : '#e5e7eb',
                        backgroundColor: isSelected ? '#f0f0ff' : '#fff',
                        overflow: 'hidden',
                      }}
                    >
                      {addon.addon_item_image ? (
                        <Image
                          source={{ uri: getFullImageUrl(addon.addon_item_image)! }}
                          style={{ width: '100%', height: 70, borderTopLeftRadius: 8, borderTopRightRadius: 8 }}
                        />
                      ) : (
                        <View style={{ width: '100%', height: 70, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center', borderTopLeftRadius: 8, borderTopRightRadius: 8 }}>
                          <Ionicons name="fast-food-outline" size={28} color="#d1d5db" />
                        </View>
                      )}
                      {isSelected && (
                        <View style={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>1</Text>
                        </View>
                      )}
                      <View style={{ padding: 6 }}>
                        <Text style={{ fontSize: 11, fontWeight: '600', color: '#1f2937' }} numberOfLines={2}>{addon.addon_item_name}</Text>
                        <Text style={{ fontSize: 11, color: '#667eea', fontWeight: '600', marginTop: 2 }}>
                          {formatPrice(addon.addon_discount_price_cents)}
                        </Text>
                        {discountPct > 0 && (
                          <Text style={{ fontSize: 9, color: '#ef4444', marginTop: 1 }}>-{discountPct}% off</Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ) : null}
          {/* Addon variant sub-modal */}
          {addonVariantModal && (
            <View style={{ paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#f9fafb', borderTopWidth: 1, borderTopColor: '#e5e7eb' }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#1f2937', marginBottom: 8 }}>
                {addonVariantModal.addon.addon_item_name} — {t('orders.select-options') || 'Select Options'}
              </Text>
              {addonVariantModal.variants.map((variant) => (
                <View key={variant.id} style={{ marginBottom: 8 }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#374151', marginBottom: 4 }}>
                    {variant.name}{variant.required && <Text style={{ color: '#ef4444' }}> *</Text>}
                  </Text>
                  {variant.min_select === 1 && variant.max_select === 1 ? (
                    variant.options.map((option) => (
                      <TouchableOpacity key={option.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4 }}
                        onPress={() => setAddonVariantSelections(prev => ({ ...prev, [variant.id]: option.id }))}>
                        <View style={[styles.radioButton, addonVariantSelections[variant.id] === option.id && styles.radioButtonSelected]} />
                        <Text style={{ fontSize: 12, marginLeft: 8 }}>{option.name}</Text>
                        {option.price_cents !== 0 && <Text style={{ fontSize: 11, color: '#6b7280', marginLeft: 4 }}>{option.price_cents > 0 ? '+' : ''}{formatPrice(option.price_cents)}</Text>}
                      </TouchableOpacity>
                    ))
                  ) : (
                    variant.options.map((option) => {
                      const sel = Array.isArray(addonVariantSelections[variant.id])
                        ? (addonVariantSelections[variant.id] as number[]).includes(option.id) : false;
                      return (
                        <TouchableOpacity key={option.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4 }}
                          onPress={() => {
                            setAddonVariantSelections(prev => {
                              const cur = Array.isArray(prev[variant.id]) ? [...(prev[variant.id] as number[])] : [];
                              if (cur.includes(option.id)) cur.splice(cur.indexOf(option.id), 1);
                              else cur.push(option.id);
                              return { ...prev, [variant.id]: cur };
                            });
                          }}>
                          <View style={[styles.checkbox, sel && styles.checkboxSelected]} />
                          <Text style={{ fontSize: 12, marginLeft: 8 }}>{option.name}</Text>
                          {option.price_cents !== 0 && <Text style={{ fontSize: 11, color: '#6b7280', marginLeft: 4 }}>{option.price_cents > 0 ? '+' : ''}{formatPrice(option.price_cents)}</Text>}
                        </TouchableOpacity>
                      );
                    })
                  )}
                </View>
              ))}
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                <TouchableOpacity style={{ flex: 1, backgroundColor: '#667eea', paddingVertical: 8, borderRadius: 6, alignItems: 'center' }}
                  onPress={confirmAddonVariant}>
                  <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>{t('orders.confirm') || 'Confirm'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={{ flex: 1, borderWidth: 1, borderColor: '#d1d5db', paddingVertical: 8, borderRadius: 6, alignItems: 'center' }}
                  onPress={() => setAddonVariantModal(null)}>
                  <Text style={{ fontSize: 13, color: '#6b7280' }}>{t('orders.cancel')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>
        <View style={styles.variantModalFooter}>
          <TouchableOpacity style={styles.addBtn} onPress={handleVariantSubmit}>
            <Text style={styles.addBtnText}>{t('orders.add-to-cart')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => {
            if (!menuIsTablet) { setPhoneView('menu'); } else { setShowVariantModal(false); }
          }}>
            <Text style={styles.cancelBtnText}>{t('orders.cancel')}</Text>
          </TouchableOpacity>
        </View>
      </>
    ) : null;

    // Shared cart content (used by both phone full-page and iPad side panel)
    const cartContent = (
      <>
        <ScrollView style={{ flex: 1 }}>
          <View style={styles.cartHeader}>
            <Text style={styles.cartHeaderTitle}>{t('orders.cart')}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TouchableOpacity onPress={() => { setCart([]); setCartEditMode(false); }}>
                <Text style={styles.cartClearBtn}>{t('orders.clear')}</Text>
              </TouchableOpacity>
            </View>
          </View>
          {cart.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 32 }}>
              <Ionicons name="cart-outline" size={36} color="#d1d5db" />
              <Text style={{ color: '#9ca3af', fontSize: 13, marginTop: 8 }}>{t('orders.no-items')}</Text>
            </View>
          ) : (
            <View style={styles.cartItemsList}>
              {cart.map((item, idx) => (
                <Swipeable
                  key={idx}
                  renderRightActions={() => (
                    <TouchableOpacity
                      style={styles.cartSwipeDelete}
                      onPress={() => handleRemoveFromCart(idx)}
                    >
                      <Ionicons name="trash-outline" size={22} color="#fff" />
                      <Text style={styles.cartSwipeDeleteText}>Remove</Text>
                    </TouchableOpacity>
                  )}
                  rightThreshold={40}
                  overshootRight={false}
                >
                  <TouchableOpacity
                    style={styles.cartItemRow}
                    onPress={() => openCartEditModal(item, idx)}
                    activeOpacity={0.75}
                  >
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={styles.cartItemPreviewText} numberOfLines={1}>
                          {(lang === 'zh' && item.name_zh ? item.name_zh : item.name)}
                          <Text style={styles.cartItemQtyBadge}>  ×{item.quantity}</Text>
                        </Text>
                        <Text style={styles.cartItemPriceText}>{formatPrice(item.price_cents * item.quantity)}</Text>
                      </View>
                      {item.variants && item.variants.length > 0 && (
                        <View style={{ marginTop: 3 }}>
                          {item.variants.map((v, vi) => (
                            <Text key={vi} style={styles.cartItemVariantText} numberOfLines={1}>{v.variantName}: {v.optionName}</Text>
                          ))}
                        </View>
                      )}
                      {item.addons && item.addons.length > 0 && (
                        <View style={{ marginTop: 3 }}>
                          {item.addons.map((a, ai) => (
                            <Text key={ai} style={{ fontSize: 12, color: '#667eea' }} numberOfLines={1}>+ {a.addon_item_name} ({formatPrice(a.addon_discount_price_cents)})</Text>
                          ))}
                        </View>
                      )}
                      {item.notes ? (
                        <Text style={{ fontSize: 11, color: '#9ca3af', fontStyle: 'italic', marginTop: 2 }} numberOfLines={1}>"{item.notes}"</Text>
                      ) : null}
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#d1d5db" style={{ marginLeft: 6 }} />
                  </TouchableOpacity>
                </Swipeable>
              ))}
            </View>
          )}
        </ScrollView>
        <ScrollView style={{ flexShrink: 1, maxHeight: 200 }} bounces={false}>
          <View style={styles.orderTypeSection}>
            <Text style={styles.sectionLabel}>{t('orders.order-type')}</Text>
            <View style={menuIsTablet ? styles.orderTypeButtonsVertical : styles.orderTypeButtons}>
              <TouchableOpacity style={[styles.orderTypeBtn, orderType === 'table' && styles.orderTypeBtnActive]} onPress={() => openTablePicker()}>
                <Text style={[styles.orderTypeBtnText, orderType === 'table' && styles.orderTypeBtnTextActive]}>
                  {selectedTableName ? `${t('orders.table')} — ${selectedTableName}${selectedOrderNumber ? `, #${selectedOrderNumber}` : ''}` : (selectedTableOnInit ? `${t('orders.table')} — ${selectedTableOnInit.tableName || 'Selected'}` : t('orders.table'))}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.orderTypeBtn, orderType === 'pay-now' && styles.orderTypeBtnActive]} onPress={() => setOrderType('pay-now')}>
                <Text style={[styles.orderTypeBtnText, orderType === 'pay-now' && styles.orderTypeBtnTextActive]}>{t('orders.order-now')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.orderTypeBtn, orderType === 'to-go' && styles.orderTypeBtnActive]} onPress={() => setOrderType('to-go')}>
                <Text style={[styles.orderTypeBtnText, orderType === 'to-go' && styles.orderTypeBtnTextActive]}>{t('orders.to-go')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
        <View style={styles.cartFooterSection}>
          <View style={styles.cartTotalRow}>
            <Text style={styles.cartTotalLabel}>{t('orders.total-items').replace('{0}', String(cart.length))}</Text>
            <Text style={styles.cartTotalPrice}>{formatPrice(cartTotal)}</Text>
          </View>
          <TouchableOpacity
            style={[styles.submitBtn, (!orderType || (orderType === 'table' && !selectedTable)) && styles.submitBtnDisabled]}
            disabled={!orderType || (orderType === 'table' && !selectedTable)}
            onPress={handleSubmitOrder}
          >
            <Text style={styles.submitBtnText}>{t('orders.submit-order')}</Text>
          </TouchableOpacity>
        </View>
      </>
    );

    // Table Picker Modal (extracted so it's available in all return paths)
    const tablePickerModal = (
      <>
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
                <Text style={{ fontSize: 18, fontWeight: '700', color: '#1f2937' }}>{t('orders.select-table-title')}</Text>
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
                            {table.sessions.length > 0 ? t('orders.active-orders').replace('{0}', String(table.sessions.length)) : t('orders.no-active-orders')}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={{ backgroundColor: '#3b82f6', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6 }}
                          onPress={() => startNewOrderOnTable(table)}
                        >
                          <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>{t('orders.new-order')}</Text>
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
                                {session.order_id ? t('orders.order-num').replace('{0}', String(session.restaurant_order_number || session.order_id)) : t('orders.order')} • {session.pax} pax
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
                    <Text style={{ textAlign: 'center', color: '#9ca3af', paddingVertical: 20 }}>{t('orders.no-tables-found')}</Text>
                  )}
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>

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
                {t('orders.new-order-for').replace('{0}', pendingTableForNewOrder?.name)}
              </Text>
              <Text style={{ fontSize: 14, color: '#6b7280', marginBottom: 6 }}>{t('orders.number-guests')}</Text>
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
                  <Text style={{ fontWeight: '600', color: '#374151' }}>{t('orders.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flex: 1, backgroundColor: '#3b82f6', borderRadius: 8, padding: 12, alignItems: 'center' }}
                  onPress={confirmNewOrderOnTable}
                >
                  <Text style={{ fontWeight: '600', color: '#fff' }}>{t('orders.start-order')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </>
    );

    // ===== PHONE: Full-page variant selection =====
    if (!menuIsTablet && phoneView === 'variant' && selectedItem) {
      return (
        <>
          <View style={styles.container}>
            <View style={styles.phoneSubpageHeader}>
              <TouchableOpacity onPress={() => setPhoneView('menu')}>
                <Ionicons name="arrow-back" size={22} color="#2C3E50" />
              </TouchableOpacity>
              <Text style={styles.phoneSubpageTitle}>{lang === 'zh' && selectedItem.name_zh ? selectedItem.name_zh : selectedItem.name}</Text>
            </View>
            <View style={{ flex: 1 }}>
              {variantContent}
            </View>
          </View>
          {paymentModal}
          {emailReceiptModal}
          {tablePickerModal}
          {cartItemEditModal}
        </>
      );
    }

    // ===== PHONE: Full-page cart view =====
    if (!menuIsTablet && phoneView === 'cart') {
      return (
        <>
          <View style={styles.container}>
            <View style={styles.phoneSubpageHeader}>
              <TouchableOpacity onPress={() => setPhoneView('menu')}>
                <Ionicons name="arrow-back" size={22} color="#2C3E50" />
              </TouchableOpacity>
              <Text style={styles.phoneSubpageTitle}>{t('orders.cart')} ({cart.reduce((sum, i) => sum + i.quantity, 0)})</Text>
            </View>
            <View style={{ flex: 1, padding: 12 }}>
              {cartContent}
            </View>
          </View>
          {paymentModal}
          {emailReceiptModal}
          {tablePickerModal}
          {cartItemEditModal}
        </>
      );
    }

    // ===== MENU GRID VIEW (default for both phone and iPad) =====
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
                  return <View style={[styles.menuItemContainer, { width: menuItemWidthPct, maxWidth: menuItemWidthPct }]} />;
                }
                return (
                <View style={[styles.menuItemContainer, { width: menuItemWidthPct, maxWidth: menuItemWidthPct }]}>
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
                      <Text style={styles.menuItemName} numberOfLines={2}>{lang === 'zh' && item.name_zh ? item.name_zh : item.name}</Text>
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
                      {lang === 'zh' && cat.name_zh ? cat.name_zh : cat.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Phone: floating cart button that navigates to full cart page */}
            {!menuIsTablet && cart.length > 0 && (
              <TouchableOpacity
                style={styles.cartFloatingBtn}
                onPress={() => setPhoneView('cart')}
                activeOpacity={0.85}
              >
                <View style={styles.cartFloatingBtnInner}>
                  <View style={styles.cartFloatingBadge}>
                    <Text style={styles.cartFloatingBadgeText}>{cart.reduce((sum, i) => sum + i.quantity, 0)}</Text>
                  </View>
                  <Text style={styles.cartFloatingBtnText}>{t('orders.cart')}</Text>
                  <Text style={styles.cartFloatingBtnPrice}>{formatPrice(cartTotal)}</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>

          {/* iPad: Cart side panel (always visible) */}
          {menuIsTablet && (
            <View style={styles.rightPanel}>
              {cartContent}
            </View>
          )}
        </View>

        {/* Variant Modal (iPad only — phone uses full-page view) */}
        {menuIsTablet && (
        <Modal supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}
          visible={showVariantModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowVariantModal(false)}
        >
          <View style={[styles.modalOverlay, { flexDirection: 'row', justifyContent: 'flex-end' }]}>
            <SafeAreaView style={[styles.variantModalContent, { maxHeight: '100%', width: 380, borderTopRightRadius: 0, borderTopLeftRadius: 16, borderBottomLeftRadius: 16 }]}>
              <TouchableOpacity style={styles.variantCloseBtn} onPress={() => setShowVariantModal(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
              {variantContent}
            </SafeAreaView>
          </View>
        </Modal>
        )}

        {tablePickerModal}

        {kpayRefundModal}

        {historyFilterModal}

        {paOnlineRefundModal}

        {paOfflineRefundModal}

        {cartItemEditModal}

        {/* Order Now Payment Modal */}
        {paymentModal}
        {emailReceiptModal}

        {/* Customer Name Modal for To-Go orders */}
        <Modal
          supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}
          visible={showCustomerNameModal}
          animationType="fade"
          transparent
          onRequestClose={() => setShowCustomerNameModal(false)}
        >
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
            <View style={{ backgroundColor: '#fff', borderRadius: 12, width: '80%', maxWidth: 400, padding: 20 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#1f2937', marginBottom: 4 }}>{t('orders.to-go')}</Text>
              <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 16 }}>{t('orders.enter-customer-name')}</Text>

              <TextInput
                style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 12 }}
                value={customerName}
                onChangeText={setCustomerName}
                placeholder={t('orders.customer-name-placeholder')}
                placeholderTextColor="#9ca3af"
                autoFocus
              />

              <TextInput
                style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 16 }}
                value={customerPhone}
                onChangeText={setCustomerPhone}
                placeholder={t('orders.customer-phone-placeholder')}
                placeholderTextColor="#9ca3af"
                keyboardType="phone-pad"
              />

              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  style={{ flex: 1, backgroundColor: '#e5e7eb', borderRadius: 8, padding: 12, alignItems: 'center' }}
                  onPress={() => setShowCustomerNameModal(false)}
                >
                  <Text style={{ fontWeight: '600', color: '#374151' }}>{t('orders.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flex: 1, backgroundColor: '#3b82f6', borderRadius: 8, padding: 12, alignItems: 'center' }}
                  onPress={() => {
                    setShowCustomerNameModal(false);
                    doSubmitOrder(customerName);
                  }}
                >
                  <Text style={{ fontWeight: '600', color: '#fff' }}>{t('orders.submit-order')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Order Payment Success Popup */}
        <Modal supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']} visible={showOrderPaymentSuccess} animationType="fade" transparent>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center' }}>
            <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 32, alignItems: 'center', width: 260, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 12, elevation: 10 }}>
              <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#d1fae5', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
                <Ionicons name="checkmark-circle" size={36} color="#10b981" />
              </View>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#1f2937', marginBottom: 6 }}>{t('admin.payment-success')}</Text>
              <Text style={{ fontSize: 22, fontWeight: '800', color: '#10b981', marginBottom: 4 }}>${(orderPaymentSuccessAmount / 100).toFixed(2)}</Text>
              <TouchableOpacity
                style={{ marginTop: 20, paddingHorizontal: 32, paddingVertical: 10, backgroundColor: '#10b981', borderRadius: 8 }}
                onPress={() => setShowOrderPaymentSuccess(false)}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>OK</Text>
              </TouchableOpacity>
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
  // payment_status takes priority for terminal outcomes (voided/refunded) — cp_status may be stale
  const ps = order.payment_status;
  if (ps === 'voided' || ps === 'cancelled') return { label: 'Voided', color: '#6b7280' };
  if (ps === 'refunded') return { label: 'Refunded', color: '#ef4444' };
  const effStatus = order.cp_status || ps;
  if (effStatus === 'refunded' || order.cp_refunded_at) {
    return { label: 'Refunded', color: '#ef4444' };
  }
  if (effStatus === 'voided' || effStatus === 'cancelled') {
    return { label: 'Voided', color: '#6b7280' };
  }
  if (order.cp_refund_amount_cents && order.cp_refund_amount_cents > 0) {
    return { label: 'Partial', color: '#f97316' };
  }
  if (order.payment_received || effStatus === 'completed' || effStatus === 'paid') {
    return { label: 'Paid', color: '#10b981' };
  }
  if (order.status === 'pending') {
    return { label: 'Pending', color: '#f59e0b' };
  }
  return { label: 'Unpaid', color: '#9ca3af' };
};

const getVendorLabel = (vendor?: string) => {
  if (!vendor) return '';
  const map: Record<string, string> = {
    kpay: 'KPay Terminal',
    'payment-asia': 'Payment Asia',
    'payment-asia-offline': 'PA Terminal',
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
    'payment-asia-offline': '#16a34a',
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

  // Floating cart button (phone)
  cartFloatingBtn: {
    backgroundColor: '#3b82f6',
    marginHorizontal: 12,
    marginBottom: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  cartFloatingBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  cartFloatingBadge: {
    backgroundColor: '#fff',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    marginRight: 10,
  },
  cartFloatingBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#3b82f6',
  },
  cartFloatingBtnText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  cartFloatingBtnPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  // Phone subpage header (for variant/cart full-page views)
  phoneSubpageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  phoneSubpageTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1f2937',
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
    marginBottom: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e7eb',
  },
  cartItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  cartSwipeDelete: {
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    flexDirection: 'column',
    gap: 4,
  },
  cartSwipeDeleteText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
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
    fontSize: 15,
    color: '#1f2937',
    fontWeight: '600',
    flex: 1,
  },
  cartItemQtyBadge: {
    fontSize: 15,
    color: '#667eea',
    fontWeight: '700',
  },
  removeItemBtn: {
    fontSize: 14,
    color: '#ef4444',
    fontWeight: 'bold',
  },
  cartItemVariantText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  cartItemPriceText: {
    fontSize: 15,
    color: '#2C3E50',
    fontWeight: '700',
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
  variantCloseBtn: {
    position: 'absolute',
    top: 10,
    right: 12,
    zIndex: 10,
    padding: 4,
  },
  variantSlideImage: {
    width: '100%',
    height: 200,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  variantSlideHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  variantSlideTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  variantSlidePrice: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  variantSlidePriceLabel: {
    fontSize: 15,
    color: '#374151',
  },
  variantSlidePriceValue: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#10b981',
  },
  variantSlideDescription: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 4,
  },
  variantSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
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
