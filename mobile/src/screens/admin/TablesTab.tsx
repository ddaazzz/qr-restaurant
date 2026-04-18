import React, { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ScrollView,
  Modal,
  TextInput,
  Alert,
  Dimensions,
  Image,
  Pressable,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  InputAccessoryView,
} from 'react-native';
import * as Print from 'expo-print';
import RNModal from 'react-native-modal';
import { apiClient, API_URL } from '../../services/apiClient';
import { useTranslation } from '../../contexts/TranslationContext';
import { thermalPrinterService } from '../../services/thermalPrinterService';
import { printerSettingsService } from '../../services/printerSettingsService';
import { PrinterSelectionModal, SelectedPrinter } from '../../components/PrinterSelectionModal';
import { Ionicons } from '@expo/vector-icons';

interface TableCategory {
  id: number;
  key: string;
  name?: string;
}

interface Session {
  id: number;
  pax: number;
  started_at: string;
  bill_closure_requested?: boolean;
  order_id?: number;
  restaurant_order_number?: number;
}

interface Booking {
  id: number;
  restaurant_booking_number?: number;
  table_id: number;
  guest_name: string;
  phone?: string;
  pax: number;
  booking_time: string;
  booking_date: string;
  status: string;
  session_id?: number;
  notes?: string;
}

interface Table {
  id: number;
  name: string;
  seat_count: number;
  category_id: number;
  sessions: Session[];
  reserved?: boolean;
  booking_time?: string;
  bookings?: Booking[];
  units: Array<{ id: number; qr_token: string; display_name?: string }>;
}

interface TableState {
  id: number;
  table_id: number;
  table_name: string;
  seat_count: number;
  category_id: number;
  table_unit_id?: number;
  unit_code?: string;
  unit_name?: string;
  qr_token?: string;
  session_id?: number;
  pax?: number;
  started_at?: string;
  bill_closure_requested?: boolean;
  order_id?: number;
  restaurant_order_number?: number;
  booking_time?: string;
}

interface Bill {
  total_cents: number;
  subtotal_cents: number;
  service_charge_cents?: number;
  grand_total_cents?: number;
  items: Array<{ name: string; price_cents: number; quantity: number; status: string }>;
}

interface Coupon {
  id: number;
  code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  description?: string;
  is_active: boolean;
}

interface Order {
  order_id?: number;
  id?: number;
  restaurant_order_number?: number;
  items: Array<{
    name?: string;
    item_name?: string;
    menu_item_name?: string;
    quantity: number;
    unit_price_cents?: number;
    price_cents?: number;
    item_total_cents?: number;
    status: string;
    variants?: string;
    addons?: Array<{
      menu_item_name?: string;
      name?: string;
      quantity: number;
      unit_price_cents?: number;
      item_total_cents?: number;
    }>;
  }>;
}

type ViewType = 'grid' | 'sessionDetail' | 'sessionList';

export interface TablesTabRef {
  toggleEditMode: () => void;
  navigateToScannedQR: (sessionId: number) => void;
}

const getTableTextColor = (bgColor: string) => {
  if (bgColor === '#f3f4f6' || bgColor === '#ffeb3b' || bgColor === '#dddddd') {
    return { color: '#000' };
  }
  return { color: '#fff' };
};

export const TablesTab = forwardRef<TablesTabRef, { restaurantId: string; onOrderForTable?: (sessionId: number, tableName: string) => void; searchQuery?: string; selectedRoomId?: number | null; onCategoriesLoaded?: (cats: TableCategory[]) => void }>(({ restaurantId, onOrderForTable, searchQuery, selectedRoomId, onCategoriesLoaded }, ref) => {
  const { t } = useTranslation();
  const [categories, setCategories] = useState<TableCategory[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [restaurantName, setRestaurantName] = useState<string>('');
  const [qrMode, setQrMode] = useState<string>('regenerate');

  // View state
  const [currentView, setCurrentView] = useState<ViewType>('grid');
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [sessionOrders, setSessionOrders] = useState<Order[]>([]);
  const [sessionBill, setSessionBill] = useState<Bill | null>(null);

  // Modal states
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showTableModal, setShowTableModal] = useState(false);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showCloseBillModal, setShowCloseBillModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrTextAbove, setQrTextAbove] = useState('Scan to Order');
  const [qrTextBelow, setQrTextBelow] = useState('Let us know how we did!');
  const [showSessionGearMenu, setShowSessionGearMenu] = useState(false);
  const [showChangePaxModal, setShowChangePaxModal] = useState(false);
  const [showMoveTableModal, setShowMoveTableModal] = useState(false);
  const [showBookingStartModal, setShowBookingStartModal] = useState(false);
  const [bookingToStart, setBookingToStart] = useState<{ tableId: number; booking: Booking } | null>(null);
  const [newPaxValue, setNewPaxValue] = useState('');
  const [selectedMoveTable, setSelectedMoveTable] = useState<number | null>(null);

  // Printer selection modal states
  const [showPrinterModal, setShowPrinterModal] = useState(false);
  const [currentPrintJob, setCurrentPrintJob] = useState<'qr' | 'bill' | 'kitchen' | null>(null);
  const [selectedPrinterForJob, setSelectedPrinterForJob] = useState<SelectedPrinter | null>(null);

  // Edit mode state
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedTableForEditControls, setSelectedTableForEditControls] = useState<number | null>(null);
  const [selectedCategoryForEditControls, setSelectedCategoryForEditControls] = useState<number | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [editingTableId, setEditingTableId] = useState<number | null>(null);
  const [editingTableName, setEditingTableName] = useState('');
  const [editingTableSeats, setEditingTableSeats] = useState('');
  const [editingTablePaxId, setEditingTablePaxId] = useState<number | null>(null);
  const [editingPaxValue, setEditingPaxValue] = useState('');
  const [deletingCategoryId, setDeletingCategoryId] = useState<number | null>(null);
  const [deletingTableId, setDeletingTableId] = useState<number | null>(null);

  // Modal states for edit operations
  const [showEditCategoryModal, setShowEditCategoryModal] = useState(false);
  const [showEditTableModal, setShowEditTableModal] = useState(false);
  const [showEditPaxModal, setShowEditPaxModal] = useState(false);
  const [showDeleteCategoryModal, setShowDeleteCategoryModal] = useState(false);
  const [showDeleteTableModal, setShowDeleteTableModal] = useState(false);

  // Form inputs
  const [categoryName, setCategoryName] = useState('');
  const [tableName, setTableName] = useState('');
  const [tableSeats, setTableSeats] = useState('4');
  const [sessionPax, setSessionPax] = useState('1');
  const [seatUnits, setSeatUnits] = useState<Array<{ id: number; unit_code: string; display_name: string; occupied: boolean }>>([]);
  const [selectedSeatIds, setSelectedSeatIds] = useState<number[]>([]);
  const [loadingSeats, setLoadingSeats] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [bookingPax, setBookingPax] = useState('2');
  const [bookingTime, setBookingTime] = useState('18:00');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [discountAmount, setDiscountAmount] = useState('0');
  const [closeReason, setCloseReason] = useState('');
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [selectedCouponId, setSelectedCouponId] = useState<number | null>(null);
  const [showCouponPicker, setShowCouponPicker] = useState(false);
  // Service charge
  const [serviceCharge, setServiceCharge] = useState(0);

  // Expose toggleEditMode and navigateToScannedQR through ref
  useImperativeHandle(ref, () => ({
    toggleEditMode() {
      setIsEditMode(prev => {
        const newIsEditMode = !prev;
        // Clear selected controls when exiting edit mode
        if (!newIsEditMode) {
          setSelectedTableForEditControls(null);
          setSelectedCategoryForEditControls(null);
        }
        return newIsEditMode;
      });
    },
    navigateToScannedQR(sessionId: number) {
      // Find the session by ID in all tables
      console.log('[TablesTab] Looking for session ID:', sessionId);
      
      for (const table of tables) {
        const matchingSession = table.sessions?.find(session => session.id === sessionId);
        if (matchingSession) {
          console.log('[TablesTab] Found session:', matchingSession);
          setSelectedTable(table);
          setSelectedSession(matchingSession);
          setCurrentView('sessionDetail');
          return;
        }
      }
      
      console.error('[TablesTab] Session not found with ID:', sessionId);
      Alert.alert('Order Not Found', 'Could not find this order. Please try again.');
    }
  }), [tables]);

  const getTodayDateString = useCallback(() => {
    const now = new Date();
    return now.toISOString().split('T')[0];
  }, []);

  const loadTableData = useCallback(async () => {
    try {
      setError(null);
      // Load categories
      const categoriesRes = await apiClient.get(
        `/api/restaurants/${restaurantId}/table-categories`
      );
      setCategories(categoriesRes.data);
      onCategoriesLoaded?.(categoriesRes.data);

      // Load table state
      const tableStateRes = await apiClient.get(
        `/api/restaurants/${restaurantId}/table-state`
      );

      // Transform into table objects
      const tableMap: { [key: number]: Table } = {};
      const unitsMap: { [key: number]: Set<number> } = {}; // Track which units we've seen for each table
      
      tableStateRes.data.forEach((row: TableState) => {
        if (!tableMap[row.table_id]) {
          tableMap[row.table_id] = {
            id: row.table_id,
            name: row.table_name,
            seat_count: row.seat_count,
            category_id: row.category_id,
            sessions: [],
            units: [],
            reserved: false,
          };
          unitsMap[row.table_id] = new Set();
        }

        // Add unit to table if not already added (each row represents one unit)
        if (row.table_unit_id && !unitsMap[row.table_id].has(row.table_unit_id)) {
          unitsMap[row.table_id].add(row.table_unit_id);
          tableMap[row.table_id].units.push({
            id: row.table_unit_id,
            qr_token: row.qr_token,
          } as any);
        }

        if (row.session_id) {
          tableMap[row.table_id].sessions.push({
            id: row.session_id,
            pax: row.pax || 0,
            started_at: row.started_at || '',
            bill_closure_requested: row.bill_closure_requested,
            order_id: row.order_id,
            restaurant_order_number: row.restaurant_order_number,
          });
        }
      });

      const tableArray = Object.values(tableMap);

      // Load today's bookings to mark reserved tables
      try {
        const todayStr = new Date().toISOString().split('T')[0];
        const bookingsRes = await apiClient.get(
          `/api/restaurants/${restaurantId}/bookings?date=${todayStr}`
        );
        if (bookingsRes.data && Array.isArray(bookingsRes.data)) {
          bookingsRes.data.forEach((b: any) => {
            if (b.table_id && b.status !== 'cancelled' && b.status !== 'completed') {
              const table = tableArray.find(t => t.id === b.table_id);
              if (table) {
                if (!b.session_id) {
                  table.reserved = true;
                  if (!table.booking_time || b.booking_time < table.booking_time) {
                    table.booking_time = b.booking_time;
                  }
                }
                if (!table.bookings) table.bookings = [];
                table.bookings.push({
                  id: b.id,
                  restaurant_booking_number: b.restaurant_booking_number,
                  table_id: b.table_id,
                  guest_name: b.guest_name,
                  phone: b.phone,
                  pax: b.pax,
                  booking_time: b.booking_time,
                  booking_date: b.booking_date,
                  status: b.status,
                  session_id: b.session_id,
                  notes: b.notes,
                });
              }
            }
          });
        }
      } catch (e) {
        console.warn('Could not load bookings for reservation status');
      }

      setTables(tableArray);

      if (!selectedCategory && categoriesRes.data.length > 0) {
        setSelectedCategory(categoriesRes.data[0].id);
      }

      // Load service charge settings
      try {
        const settingsRes = await apiClient.get(`/api/restaurants/${restaurantId}/settings`);
        if (settingsRes.data && settingsRes.data.service_charge_percent) {
          setServiceCharge(settingsRes.data.service_charge_percent);
        }
        if (settingsRes.data?.qr_mode) {
          setQrMode(settingsRes.data.qr_mode);
        }
      } catch (e) {
        console.warn('Could not load service charge settings');
      }
    } catch (err: any) {
      console.error('Error fetching table data:', err);
      setError(err.message || 'Failed to load tables');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [restaurantId, selectedCategory]);

  useEffect(() => {
    loadTableData();
    const interval = setInterval(loadTableData, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, [restaurantId, loadTableData]);

  // Load QR image when modal opens
  useEffect(() => {
    if (showQRModal && selectedSession) {
      // QR Modal opened, session selected
      
      // Get QR token from selectedTable.units
      const qrToken = selectedTable?.units?.[0]?.qr_token;
      // Build QR data from table units
      
      if (!qrToken) {
        setQrLoading(false);
        return;
      }

      setQrLoading(true);
      // Generate QR code using QR server API - Large 800x800 to fill the receipt paper
      const qrDataUrl = `https://chuio.io/${qrToken}`;
      
      // Use qr-server.com API to generate QR code (800x800 to fill receipt)
      const qrServerUrl = `https://api.qrserver.com/v1/create-qr-code/?size=800x800&data=${encodeURIComponent(qrDataUrl)}`;
      
      setQrImageUrl(qrServerUrl);
      setQrLoading(false);
    } else if (!showQRModal) {
      setQrImageUrl(null);
    }
  }, [showQRModal, selectedSession, selectedTable]);

  // Preload printer settings on component mount
  // This ensures settings are cached and available immediately when printing
  useEffect(() => {
    const preloadPrinterSettings = async () => {
      try {
        console.log('[TablesTab] Preloading printer settings on mount');
        await printerSettingsService.getPrinterSettings(restaurantId, false);
        console.log('[TablesTab] Printer settings preloaded successfully');
      } catch (err: any) {
        console.error('[TablesTab] Failed to preload printer settings:', err.message);
        // Don't show error alert - printer settings not being available is not a critical issue at startup
      }
    };

    preloadPrinterSettings();
  }, [restaurantId]);

  // Load restaurant name for autoprint formatting
  useEffect(() => {
    const loadRestaurantName = async () => {
      try {
        const res = await apiClient.get(`/api/restaurants/${restaurantId}`);
        if (res.data?.name) {
          setRestaurantName(res.data.name);
        }
      } catch (err: any) {
        console.warn('[TablesTab] Could not load restaurant name:', err.message);
      }
    };

    loadRestaurantName();
  }, [restaurantId]);

  // Load QR text settings when QR modal opens
  useEffect(() => {
    if (!showQRModal) return;

    const loadQRTextSettings = async () => {
      try {
        const printerSettings = await printerSettingsService.getPrinterSettings(restaurantId, false);
        setQrTextAbove(printerSettings?.qr_text_above || 'Scan to Order');
        setQrTextBelow(printerSettings?.qr_text_below || 'Let us know how we did!');
      } catch (err: any) {
        console.warn('[TablesTab] Failed to load QR text settings:', err.message);
        // Use defaults if fetch fails
        setQrTextAbove('Scan to Order');
        setQrTextBelow('Let us know how we did!');
      }
    };

    loadQRTextSettings();
  }, [showQRModal, restaurantId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTableData();
  };

  const filteredTables = selectedCategory
    ? tables.filter((t) => t.category_id === selectedCategory)
    : [];

  // Build sections: all categories with their tables, filtered by room and search
  const tableSections = categories
    .filter(cat => !selectedRoomId || cat.id === selectedRoomId)
    .map(cat => ({
      category: cat,
      tables: tables.filter(t => {
        if (t.category_id !== cat.id) return false;
        if (searchQuery && searchQuery.trim()) {
          return t.name.toLowerCase().includes(searchQuery.trim().toLowerCase());
        }
        return true;
      }),
    }));

  // Chunk an array into rows of N
  const chunkArray = <T,>(arr: T[], size: number): T[][] => {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  };

  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  const formatDuration = (startedAt: string) => {
    try {
      const start = new Date(startedAt);
      const now = new Date();
      const diffMinutes = Math.floor((now.getTime() - start.getTime()) / 60000);

      if (diffMinutes < 1) return 'just now';
      if (diffMinutes < 60) return `${diffMinutes}m`;

      const hours = Math.floor(diffMinutes / 60);
      const mins = diffMinutes % 60;
      return `${hours}h ${mins}m`;
    } catch {
      return '--';
    }
  };

  const getReservationTimeInfo = (table: Table) => {
    if (!table.reserved || !table.booking_time) return null;
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const bookingTime = new Date(`${todayStr}T${table.booking_time}`);
    const timeRemaining = bookingTime.getTime() - now.getTime();
    if (timeRemaining <= 0) return { text: 'Now', isNow: true };
    const minutesRemaining = Math.floor(timeRemaining / 60000);
    if (minutesRemaining < 60) {
      return { text: `In ${minutesRemaining}m`, isNow: false };
    }
    const hours = Math.floor(minutesRemaining / 60);
    const mins = minutesRemaining % 60;
    return { text: mins > 0 ? `In ${hours}h ${mins}m` : `In ${hours}h`, isNow: false };
  };

  const getTableCardColor = (table: Table) => {
    if (table.sessions.length === 0 && !table.reserved) return '#dddddd';
    if (table.sessions.length > 1) return '#2C3E50';
    if (table.sessions.length === 1) {
      const session = table.sessions[0];
      if ((session as any).payment_received === true) return '#4caf50';
      if (session.bill_closure_requested) return '#ffeb3b';

      try {
        const start = new Date(session.started_at);
        const now = new Date();
        const diffMinutes = Math.floor((now.getTime() - start.getTime()) / 60000);

        if (diffMinutes < 30) return '#2C3E50';
        if (diffMinutes < 60) return '#9c27b0';
        if (diffMinutes < 120) return '#ff9800';
        return '#f44336';
      } catch {
        return '#2C3E50';
      }
    }
    if (table.reserved) return '#dddddd';
    return '#dddddd';
  };

  const handleTableClick = (table: Table) => {
    setSelectedTable(table);
    setCurrentView('sessionList');
  };

  const loadSessionOrders = async (sessionId: number) => {
    try {
      const res = await apiClient.get(
        `/api/sessions/${sessionId}/orders`
      );
      console.log('[LoadOrders] API Response:', res.data);
      const orders = res.data.items || res.data || [];
      console.log('[LoadOrders] Parsed orders:', orders);
      setSessionOrders(Array.isArray(orders) ? orders : []);

      const billRes = await apiClient.get(
        `/api/sessions/${sessionId}/bill`
      );
      console.log('[LoadBill] Bill data:', billRes.data);
      setSessionBill(billRes.data);
    } catch (err) {
      console.error('Error loading session orders:', err);
      Alert.alert('Error Loading Orders', 'Failed to load order details');
    }
  };

  const handleSessionClick = async (session: Session) => {
    setSelectedSession(session);
    setCurrentView('sessionDetail');
    await loadSessionOrders(session.id);
  };

  const createCategory = async () => {
    if (!categoryName.trim()) {
      Alert.alert('Error', 'Category name required');
      return;
    }

    try {
      await apiClient.post(
        `/api/restaurants/${restaurantId}/table-categories`,
        { name: categoryName }
      );
      setCategoryName('');
      setShowCategoryModal(false);
      await loadTableData();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to create category');
    }
  };

  const createTable = async () => {
    if (!tableName.trim()) {
      Alert.alert('Error', 'Table name required');
      return;
    }
    if (!tableSeats || parseInt(tableSeats) <= 0) {
      Alert.alert('Error', 'Valid seat count required');
      return;
    }

    try {
      await apiClient.post(
        `/api/restaurants/${restaurantId}/tables`,
        {
          category_id: selectedCategory,
          name: tableName,
          seat_count: parseInt(tableSeats),
        }
      );
      setTableName('');
      setTableSeats('4');
      setShowTableModal(false);
      await loadTableData();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to create table');
    }
  };

  const editCategory = async (categoryId: number) => {
    if (!editingCategoryName.trim()) {
      Alert.alert('Error', 'Category name required');
      return;
    }

    try {
      await apiClient.patch(
        `/api/restaurants/${restaurantId}/table-categories/${categoryId}`,
        { name: editingCategoryName }
      );
      setEditingCategoryId(null);
      setEditingCategoryName('');
      await loadTableData();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to edit category');
    }
  };

  const deleteCategory = async (categoryId: number, categoryName: string) => {
    Alert.alert(
      'Delete Category',
      `Are you sure you want to delete "${categoryName}"?`,
      [
        { text: 'Cancel', onPress: () => {}, style: 'cancel' },
        {
          text: 'Delete',
          onPress: async () => {
            try {
              await apiClient.delete(
                `/api/restaurants/${restaurantId}/table-categories/${categoryId}`
              );
              await loadTableData();
            } catch (err: any) {
              Alert.alert('Error', err.response?.data?.error || 'Failed to delete category');
            }
          },
          style: 'destructive',
        },
      ]
    );
  };

  const updateTable = async () => {
    if (!editingTableName.trim()) {
      Alert.alert('Error', 'Table name required');
      return;
    }
    if (!editingTableSeats || parseInt(editingTableSeats) <= 0) {
      Alert.alert('Error', 'Valid seat count required');
      return;
    }

    try {
      await apiClient.patch(`/tables/${editingTableId}`, {
        name: editingTableName,
        seat_count: parseInt(editingTableSeats),
        restaurantId: parseInt(restaurantId),
      });
      setEditingTableId(null);
      setEditingTableName('');
      setEditingTableSeats('');
      setShowEditTableModal(false);
      await loadTableData();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to update table');
    }
  };

  const deleteTable = async (tableId: number, tableName: string) => {
    Alert.alert(
      'Delete Table',
      `Are you sure you want to delete table "${tableName}"?`,
      [
        { text: 'Cancel', onPress: () => {}, style: 'cancel' },
        {
          text: 'Delete',
          onPress: async () => {
            try {
              await apiClient.delete(`/api/restaurants/${restaurantId}/tables/${tableId}`);
              await loadTableData();
            } catch (err: any) {
              Alert.alert('Error', err.response?.data?.error || 'Failed to delete table');
            }
          },
          style: 'destructive',
        },
      ]
    );
  };

  const updateTablePax = async (tableId: number) => {
    if (!editingPaxValue || parseInt(editingPaxValue) <= 0) {
      Alert.alert('Error', 'Valid seat count required');
      return;
    }

    try {
      await apiClient.patch(`/tables/${tableId}`, {
        seat_count: parseInt(editingPaxValue),
        restaurantId: parseInt(restaurantId),
      });
      setEditingTablePaxId(null);
      setEditingPaxValue('');
      setShowEditPaxModal(false);
      await loadTableData();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to update seat count');
    }
  };

  const autoPrintQR = async (newSession: any, table: Table) => {
    try {
      // Get printer settings
      const printerSettings = await printerSettingsService.getPrinterSettings(restaurantId, true);

      // Use per-printer-type config if available
      const qrPrinterType = printerSettings?.qr_printer_type || printerSettings?.printer_type;
      const qrBluetoothDeviceId = printerSettings?.qr_bluetooth_device_id || printerSettings?.bluetooth_device_id;
      const qrBluetoothDeviceName = printerSettings?.qr_bluetooth_device_name || printerSettings?.bluetooth_device_name;

      // Check if QR printer is configured
      if (!qrPrinterType || qrPrinterType === 'none') {
        console.log('[AutoPrintQR] No QR printer configured');
        return;
      }

      // Get QR token
      const qrToken = table?.units?.[0]?.qr_token;
      if (!qrToken) {
        console.log('[AutoPrintQR] No QR token available');
        return;
      }

      console.log('[AutoPrintQR] Auto-printing QR for session:', newSession.id, 'printer type:', qrPrinterType);

      // Generate QR HTML with customizable text from printer settings
      const qrHtml = await generateQRHTML(
        table.name, 
        qrToken,
        printerSettings?.qr_text_above,
        printerSettings?.qr_text_below
      );

      if (qrPrinterType === 'browser') {
        await Print.printAsync({ html: qrHtml });
      } else {
        // Thermal/Network/Bluetooth printer - send to backend
        const qrPayload = {
          sessionId: newSession.id,
          tableId: table.id,
          tableName: table.name,
          qrToken: qrToken,
          priority: 10,
        };

        const printRes = await apiClient.post(`/api/restaurants/${restaurantId}/print-qr`, qrPayload);

        if (printRes.data?.bluetoothPayload) {
          try {
            const { BleManager } = require('react-native-ble-plx');
            const manager = new BleManager();

            const sessionDate = new Date(newSession.started_at);
            const startTimeStr = sessionDate.toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: true,
            });

            const receiptData = {
              restaurantName: restaurantName || 'Restaurant',
              tableNumber: table.name,
              pax: newSession.pax,
              startTime: startTimeStr,
              qrCode: `https://chuio.io/${qrToken}`,
              printerPaperWidth: printerSettings?.printer_paper_width || 80,
            };

            await thermalPrinterService.sendToBluetooth(
              manager,
              printRes.data.bluetoothPayload.printerConfig.bluetoothDeviceId,
              receiptData,
              30000
            );

            console.log('[AutoPrintQR] ✓ QR successfully sent to Bluetooth printer');
          } catch (err: any) {
            console.error('[AutoPrintQR] Bluetooth send error:', err);
          }
        } else if (printRes.data?.success) {
          console.log('[AutoPrintQR] ✓ QR queued for network printer');
        } else if (printRes.data?.html) {
          await Print.printAsync({ html: printRes.data.html });
          console.log('[AutoPrintQR] ✓ QR sent to browser print');
        }
      }
    } catch (err: any) {
      console.error('[AutoPrintQR] Error:', err);
    }
  };

  const startSessionFromBooking = async (tableId: number, booking: Booking) => {
    setBookingToStart({ tableId, booking });
    setShowBookingStartModal(true);
  };

  const confirmStartSessionFromBooking = async () => {
    if (!bookingToStart) return;
    const { tableId, booking } = bookingToStart;
    try {
      await apiClient.post(`/api/tables/${tableId}/sessions`, {
        pax: booking.pax,
        booking_id: booking.id,
        customer_name: booking.guest_name,
        customer_phone: booking.phone || '',
      });
      setShowBookingStartModal(false);
      setBookingToStart(null);
      await loadTableData();
      setSelectedTable(null);
      setCurrentView('grid');
    } catch (err: any) {
      Alert.alert(t('common.error') || 'Error', err.response?.data?.error || 'Failed to start session');
    }
  };

  const loadSeatsForTable = async (tableId: number) => {
    setLoadingSeats(true);
    try {
      const res = await apiClient.get(`/api/tables/${tableId}/units`);
      setSeatUnits(res.data || []);
      setSelectedSeatIds([]);
    } catch (err: any) {
      console.warn('[TablesTab] Failed to load seats:', err.message);
      setSeatUnits([]);
    } finally {
      setLoadingSeats(false);
    }
  };

  const openNewOrderModal = async () => {
    if (qrMode === 'static_seat' && selectedTable) {
      await loadSeatsForTable(selectedTable.id);
    }
    setShowSessionModal(true);
  };

  const toggleSeat = (unitId: number) => {
    setSelectedSeatIds(prev =>
      prev.includes(unitId) ? prev.filter(id => id !== unitId) : [...prev, unitId]
    );
  };

  const startSession = async () => {
    if (!selectedTable || !sessionPax || parseInt(sessionPax) <= 0) {
      Alert.alert('Error', 'Valid pax count required');
      return;
    }

    if (qrMode === 'static_seat' && selectedSeatIds.length === 0) {
      Alert.alert('Error', 'Please select at least one seat');
      return;
    }

    try {
      Keyboard.dismiss();
      
      const body: any = { pax: parseInt(sessionPax) };
      if (qrMode === 'static_seat' && selectedSeatIds.length > 0) {
        body.unit_ids = selectedSeatIds;
      }

      const createRes = await apiClient.post(
        `/api/tables/${selectedTable.id}/sessions`,
        body
      );

      // Check if QR auto-print is enabled
      if (createRes.data?.id) {
        try {
          const printerRes = await apiClient.get(
            `/api/restaurants/${restaurantId}/printer-settings`
          );

          if (printerRes.data?.qr_auto_print === true) {
            console.log('[StartSession] QR auto-print enabled, auto-printing QR...');
            // Wait for Bluetooth to initialize before autoprinting
            await new Promise(resolve => setTimeout(resolve, 2500));
            // Auto-print the QR code for this new session
            await autoPrintQR(createRes.data, selectedTable);
          }
        } catch (autoError) {
          console.log('[StartSession] QR auto-print check failed (non-critical):', autoError);
        }
      }

      setSessionPax('1');
      setSelectedSeatIds([]);
      setSeatUnits([]);
      setShowSessionModal(false);
      await loadTableData();
      setSelectedTable(null);
      setCurrentView('grid');
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to start order');
    }
  };

  const bookTable = async () => {
    if (!guestName.trim() || !guestPhone.trim() || !guestEmail.trim()) {
      Alert.alert('Error', 'All guest details required');
      return;
    }

    try {
      await apiClient.post(
        `/api/restaurants/${restaurantId}/bookings`,
        {
          table_id: selectedTable?.id,
          guest_name: guestName,
          phone_number: guestPhone,
          email: guestEmail,
          pax: parseInt(bookingPax),
          booking_date: getTodayDateString(),
          booking_time: bookingTime,
          status: 'confirmed',
        }
      );
      setGuestName('');
      setGuestPhone('');
      setGuestEmail('');
      setShowBookingModal(false);
      await loadTableData();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to book table');
    }
  };

  const getDiscountCents = () => {
    const coupon = coupons.find(c => c.id === selectedCouponId);
    if (!coupon) return 0;
    const grandTotal = sessionBill?.grand_total_cents || sessionBill?.total_cents || 0;
    if (coupon.discount_type === 'percentage') {
      return Math.round(grandTotal * coupon.discount_value / 100);
    }
    return coupon.discount_value;
  };

  const closeBill = async () => {
    if (!selectedSession) return;

    const discountCents = getDiscountCents();
    const grandTotal = sessionBill?.grand_total_cents || sessionBill?.total_cents || 0;
    const finalAmount = grandTotal - discountCents;

    try {
      await apiClient.post(
        `/api/sessions/${selectedSession.id}/close-bill`,
        {
          restaurantId: parseInt(restaurantId),
          payment_method: paymentMethod,
          amount_paid: finalAmount,
          discount_applied: discountCents,
          service_charge: sessionBill?.service_charge_cents || 0,
          notes: closeReason,
        }
      );

      // Check if bill auto-print is enabled
      try {
        const printerRes = await apiClient.get(
          `/api/restaurants/${restaurantId}/printer-settings`
        );

        if (printerRes.data?.bill_auto_print === true) {
          console.log('[CloseBill] Bill auto-print enabled, printing bill...');
          // Auto-print the bill with the handleBillPrint logic
          await printBill(true);
        }
      } catch (autoError) {
        console.log('[CloseBill] Bill auto-print check failed (non-critical):', autoError);
      }

      setShowCloseBillModal(false);
      setPaymentMethod('cash');
      setDiscountAmount('0');
      setCloseReason('');
      setSelectedCouponId(null);
      setCoupons([]);      await loadTableData();
      setCurrentView('grid');
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to close bill');
    }
  };

  const endSession = async (sessionId: number) => {
    Alert.alert('End Order', 'Are you sure you want to end this order?', [
      { text: 'Cancel' },
      {
        text: 'End',
        onPress: async () => {
          try {
            await apiClient.post(
              `/api/table-sessions/${sessionId}/end`,
              {}
            );
            await loadTableData();
            setCurrentView('grid');
          } catch (err: any) {
            Alert.alert('Error', err.response?.data?.error || 'Failed to end order');
          }
        },
      },
    ]);
  };

  const changePax = async (sessionId: number, currentPax: number) => {
    setNewPaxValue(currentPax.toString());
    setShowChangePaxModal(true);
    setShowSessionGearMenu(false);
  };

  const submitChangePax = async () => {
    if (!selectedSession || !newPaxValue || parseInt(newPaxValue) <= 0) {
      Alert.alert('Error', 'Valid pax count required');
      return;
    }

    try {
      await apiClient.patch(
        `/api/table-sessions/${selectedSession.id}`,
        { pax: parseInt(newPaxValue) }
      );
      setShowChangePaxModal(false);
      setNewPaxValue('');
      await loadTableData();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to update pax');
    }
  };

  const moveTable = () => {
    if (!selectedTable) return;
    const availableTables = tables.filter((t) => t.sessions.length === 0 && t.id !== selectedTable.id);
    if (availableTables.length === 0) {
      Alert.alert('Error', 'No empty tables available');
      return;
    }
    setShowMoveTableModal(true);
    setShowSessionGearMenu(false);
  };

  const submitMoveTable = async () => {
    if (!selectedTable || !selectedSession || !selectedMoveTable) {
      Alert.alert('Error', 'No table selected');
      return;
    }

    try {
      await apiClient.patch(
        `/api/table-sessions/${selectedSession.id}/move-table`,
        { new_table_id: selectedMoveTable }
      );
      setShowMoveTableModal(false);
      setSelectedMoveTable(null);
      await loadTableData();
      setCurrentView('grid');
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to move table');
    }
  };

  const orderForTable = () => {
    if (!selectedTable || !selectedSession) return;
    setShowSessionGearMenu(false);
    if (onOrderForTable) {
      onOrderForTable(selectedSession.id, selectedTable.name);
    } else {
      Alert.alert('Order for Table', `Open order screen for ${selectedTable.name}`);
    }
  };

  const generateQRHTML = async (tableName: string, qrToken: string, qrTextAbove?: string, qrTextBelow?: string) => {
    try {
      // Build the URL that will be encoded in the QR code
      const qrDataUrl = `https://chuio.io/${qrToken}`;
      
      // Use QR server API to generate QR code image (1200x1200 for high quality)
      const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=1200x1200&data=${encodeURIComponent(qrDataUrl)}`;

      // Get session info
      const sessionStartTime = selectedSession 
        ? new Date(selectedSession.started_at).toLocaleString()
        : new Date().toLocaleString();
      
      // Use printer settings text or defaults
      const textAbove = qrTextAbove || 'Scan to Order';
      const textBelow = qrTextBelow || 'Let us know how we did!';
      
      const pax = selectedSession?.pax || 0;

      return `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <title>QR Code - ${tableName}</title>
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { 
                font-family: 'Courier New', monospace; 
                padding: 12px; 
                background: #fff; 
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
              }
              .receipt { 
                width: 100%; 
                text-align: center; 
                font-size: 12px; 
                line-height: 1.5; 
                max-width: 80mm; 
                margin: 0 auto; 
              }
              .header { 
                border-bottom: 2px dashed #000; 
                padding-bottom: 8px; 
                margin-bottom: 8px; 
              }
              .restaurant-name { 
                font-weight: bold; 
                font-size: 18px; 
                margin-bottom: 4px; 
              }
              .divider { 
                border-bottom: 1px dashed #000; 
                margin: 8px 0; 
              }
              .info-section { 
                text-align: left; 
                margin: 8px 0; 
                font-size: 11px; 
                line-height: 1.8;
              }
              .info-row { 
                display: flex; 
                justify-content: space-between; 
                margin-bottom: 2px; 
              }
              .info-label { 
                font-weight: bold; 
              }
              #qrcode { 
                display: flex; 
                justify-content: center; 
                margin: 12px 0; 
              }
              #qrcode img { 
                max-width: 100%;
                height: auto;
                width: 200px;
                height: 200px;
              }
              .scan-instruction { 
                font-weight: bold; 
                font-size: 12px; 
                margin: 8px 0; 
              }
              .footer { 
                font-size: 10px; 
                color: #666; 
                margin-top: 8px; 
              }
              @media print { 
                body { margin: 0; padding: 8px; } 
                .receipt { width: 80mm; } 
                #qrcode img { width: 70mm; height: 70mm; }
              }
            </style>
          </head>
          <body>
            <div class="receipt">
              <div class="header">
                <div class="restaurant-name">${restaurantName}</div>
              </div>
              
              <div class="info-section">
                <div class="info-row">
                  <span class="info-label">Table:</span>
                  <span>${tableName}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Pax:</span>
                  <span>${pax}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Started:</span>
                  <span>${sessionStartTime}</span>
                </div>
              </div>
              
              <div class="divider"></div>
              
              <div id="qrcode">
                <img src="${qrImageUrl}" alt="QR Code" />
              </div>
              
              <div class="scan-instruction">${textAbove}</div>
              
              <div class="footer">
                <p style="margin-top: 8px;">${textBelow}</p>
              </div>
            </div>
            <script>
              window.onload = () => { setTimeout(() => window.print(), 500); };
              window.onafterprint = () => window.close();
            </script>
          </body>
        </html>
      `;
    } catch (qrErr) {
      console.warn('[PrintQR] QR generation failed:', qrErr);
      throw new Error('Failed to generate QR code');
    }
  };

  const printQR = async () => {
    console.log('[PrintQR] Button clicked');
    if (!selectedSession || !selectedTable) {
      console.log('[PrintQR] No session or table selected, returning');
      return;
    }

    try {
      setShowSessionGearMenu(false);

      // Get printer settings using the centralized service - force refresh to get latest
      console.log('[PrintQR] Fetching printer settings for QR printer');
      const printerSettings = await printerSettingsService.getPrinterSettings(restaurantId, true);
      
      // Use per-printer-type config if available, otherwise fall back to generic printer_type
      const qrPrinterType = printerSettings?.qr_printer_type || printerSettings?.printer_type;
      const qrPrinterHost = printerSettings?.qr_printer_host || printerSettings?.printer_host;
      const qrPrinterPort = printerSettings?.qr_printer_port || printerSettings?.printer_port || 9100;
      const qrBluetoothDeviceId = printerSettings?.qr_bluetooth_device_id || printerSettings?.bluetooth_device_id;
      const qrBluetoothDeviceName = printerSettings?.qr_bluetooth_device_name || printerSettings?.bluetooth_device_name;
      
      console.log('[PrintQR] QR printer config from backend:', {
        qr_printer_type: qrPrinterType,
        qr_printer_host: qrPrinterHost,
        qr_printer_port: qrPrinterPort,
        qr_bluetooth_device_id: qrBluetoothDeviceId,
        qr_bluetooth_device_name: qrBluetoothDeviceName,
      });

      // Check if QR printer is configured
      if (!qrPrinterType || qrPrinterType === 'none') {
        console.log('[PrintQR] No QR printer configured:', printerSettings);
        Alert.alert(
          'No QR Printer Configured',
          'Please configure a QR printer in Settings before printing. For now, showing QR code on screen.',
          [
            {
              text: 'OK',
              onPress: () => {
                // Fall back to showing the modal
                setShowQRModal(true);
              },
            },
          ]
        );
        return;
      }

      // Get QR token
      const qrToken = selectedTable?.units?.[0]?.qr_token;
      if (!qrToken) {
        console.log('[PrintQR] No QR token available for table:', selectedTable?.name);
        Alert.alert('Error', 'No QR token available for this table');
        return;
      }

      console.log('[PrintQR] Using QR printer type:', qrPrinterType, 'for QR token:', qrToken);

      // Generate QR HTML with customizable text from printer settings
      const qrHtml = await generateQRHTML(
        selectedTable.name, 
        qrToken,
        printerSettings?.qr_text_above,
        printerSettings?.qr_text_below
      );

      if (qrPrinterType === 'browser') {
        // Use expo print for browser
        console.log('[PrintQR] Printing to browser');
        await Print.printAsync({ html: qrHtml });
      } else {
        // Thermal/Network/USB/Bluetooth printer - send to backend
        console.log('[PrintQR] Sending QR to printer via backend');
        const qrPayload = {
          sessionId: selectedSession.id,
          tableId: selectedTable.id,
          tableName: selectedTable.name,
          qrToken: qrToken,
          priority: 10, // Higher priority for QR
        };

        const printRes = await apiClient.post(`/api/restaurants/${restaurantId}/print-qr`, qrPayload);

        if (printRes.data?.bluetoothPayload) {
          // Backend returned Bluetooth payload - send to local printer using BLE
          console.log('[PrintQR] Sending Bluetooth payload to device:', printRes.data.bluetoothPayload.printerConfig.bluetoothDeviceName);
          Alert.alert('Printing', 'Sending QR code to Bluetooth printer...');
          
          try {
            // Import BLE manager needed for Bluetooth
            const { BleManager } = require('react-native-ble-plx');
            const manager = new BleManager();
            
            // Format start time
            const sessionDate = new Date(selectedSession.started_at);
            const startTimeStr = sessionDate.toLocaleTimeString('en-US', { 
              hour: '2-digit', 
              minute: '2-digit',
              hour12: true 
            });
            
            // Send to printer using thermalPrinterService
            const receiptData = {
              restaurantName: restaurantName || 'Restaurant',
              tableNumber: selectedTable.name,
              pax: selectedSession.pax,
              startTime: startTimeStr,
              qrCode: `https://chuio.io/${qrToken}`,
              printerPaperWidth: printerSettings?.printer_paper_width || 80,
            };
            
            await thermalPrinterService.sendToBluetooth(
              manager,
              printRes.data.bluetoothPayload.printerConfig.bluetoothDeviceId,
              receiptData,
              30000
            );
            
            Alert.alert('Sent', 'QR code sent to Bluetooth printer');
          } catch (err: any) {
            console.error('[PrintQR] Bluetooth send error:', err);
            Alert.alert('Error', err.message || 'Failed to send to Bluetooth printer');
            setShowQRModal(true);
          }
        } else if (printRes.data?.success) {
          Alert.alert('Queued', 'QR code queued for network printer');
        } else if (printRes.data?.html) {
          // Backend returned HTML for browser printing
          await Print.printAsync({ html: printRes.data.html });
          Alert.alert('Printing', 'QR code sent to print');
        } else {
          Alert.alert('Error', 'Unexpected response from backend');
          setShowQRModal(true);
        }
      }
    } catch (err: any) {
      console.error('[PrintQR] Error:', err);
      console.error('[PrintQR] Full error:', err.response || err.message);
      Alert.alert(
        'Print Error',
        `${err.response?.data?.error || err.message || 'Failed to print QR code'}`
      );
      // Fall back to showing the modal
      setShowQRModal(true);
    }
  };

  const printBillWithPrinterSelection = () => {
    if (!selectedSession || !sessionBill) {
      Alert.alert('Error', 'No bill data available');
      return;
    }
    console.log('[PrintBill] Opening printer selection for bill');
    setCurrentPrintJob('bill');
    setShowPrinterModal(true);
    setShowSessionGearMenu(false);
  };



  const handleBillPrint = async (printer: SelectedPrinter) => {
    try {
      if (!selectedSession || !sessionBill || !selectedTable) {
        throw new Error('Missing session or bill data');
      }

      console.log('[PrintBill] Printing to', printer.type, 'printer:', printer.name);
      console.log('[PrintBill] Bill data:', sessionBill);

      if (printer.type === 'browser') {
        // Use expo print
        const billHtml = generateBillHTML(selectedTable.name, sessionBill);
        await Print.printAsync({ html: billHtml });
        console.log('[PrintBill] Browser print sent successfully');
      } else if (printer.type === 'bluetooth') {
        // Print via Bluetooth
        if (!printer.id) throw new Error('No Bluetooth device selected');
        
        const manager = new (require('react-native-ble-plx')).BleManager();
        await thermalPrinterService.sendToBluetooth(
          manager,
          printer.id,
          {
            tableNumber: selectedTable.name,
            items: sessionBill.items,
            subtotal: sessionBill.subtotal_cents,
            serviceCharge: sessionBill.service_charge_cents || 0,
            total: sessionBill.total_cents,
          },
          30000
        );
        console.log('[PrintBill] Bluetooth print sent successfully');
      } else {
        // Thermal/Network printer - send to backend
        console.log('[PrintBill] Sending to network/thermal printer via backend');
        const billPayload = {
          sessionId: selectedSession.id,
          billData: {
            table: selectedTable.name,
            items: (sessionBill.items || []).map((item: any) => ({
              name: item.name || item.item_name || 'Unknown',
              quantity: item.quantity,
              price_cents: item.price_cents || item.unit_price_cents || 0,
            })),
            subtotal: sessionBill.subtotal_cents,
            serviceCharge: sessionBill.service_charge_cents || 0,
            total: sessionBill.total_cents,
          },
          priority: 5,
        };
        
        console.log('[PrintBill] Sending payload:', billPayload);
        const response = await apiClient.post(`/api/restaurants/${restaurantId}/print-bill`, billPayload);
        const responseData = response.data || response;
        
        console.log('[PrintBill] Backend response:', responseData);
        
        if (responseData?.success) {
          Alert.alert('Print Queued', 'Bill queued successfully for printing');
        } else if (responseData?.html) {
          // Backend returned HTML for browser printing
          await Print.printAsync({ html: responseData.html });
        }
      }
    } catch (err: any) {
      console.error('[PrintBill] Error:', err.message || err);
      console.error('[PrintBill] Full error:', err);
      Alert.alert(
        'Print Error',
        err.response?.data?.error || err.message || 'Failed to print bill'
      );
      throw err;
    }
  };

  // Helper function to generate bill HTML
  const generateBillHTML = (tableName: string, bill: any) => {
    const itemsHTML = bill.items
      .map((item: any) => {
        let html = `<tr><td>${item.name}</td><td>${item.quantity}</td><td>${(item.price_cents / 100).toFixed(2)}</td></tr>`;
        if (item.addons && item.addons.length > 0) {
          for (const addon of item.addons) {
            html += `<tr style="color:#667eea;font-size:0.9em;"><td style="padding-left:16px;">+ ${addon.name}</td><td>${addon.quantity}</td><td>${(addon.price_cents / 100).toFixed(2)}</td></tr>`;
          }
        }
        return html;
      })
      .join('');
    
    return `
      <html>
        <body style="font-family: Arial; padding: 20px;">
          <h2>${tableName} - Bill</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><th>Item</th><th>Qty</th><th>Price</th></tr>
            ${itemsHTML}
          </table>
          <hr/>
          <h3>Total: ${(bill.total_cents / 100).toFixed(2)}</h3>
        </body>
      </html>
    `;
  };

  const printBill = async (autoPrint: boolean = false) => {
    console.log('[PrintBill] Starting printBill, autoPrint=', autoPrint);
    console.log('[PrintBill] selectedSession:', selectedSession);
    console.log('[PrintBill] sessionBill:', sessionBill);
    
    if (!selectedSession || !sessionBill) {
      console.log('[PrintBill] Missing session or bill data, returning');
      if (!autoPrint) {
        Alert.alert('Error', 'No bill data available. Please open a table order first.');
      }
      return;
    }

    try {
      console.log('[PrintBill] Fetching printer settings...');
      // Check if printer is configured
      const printerRes = await apiClient.get(
        `/api/restaurants/${restaurantId}/printer-settings`
      );
      console.log('[PrintBill] Printer settings response:', printerRes.data);

      if (!printerRes.data || !printerRes.data.printer_type) {
        if (!autoPrint) {
          Alert.alert(
            'No Printer Configured',
            'Please configure a printer in Settings to enable printing. Would you like to set up a printer now?',
            [
              {
                text: 'Cancel',
                style: 'cancel',
              },
              {
                text: 'Configure Printer',
                onPress: () => {
                  console.log('[PrintBill] User wants to configure printer');
                },
                style: 'default',
              },
            ]
          );
        }
        return;
      }

      // Prepare bill data in format expected by backend
      const printItems: any[] = [];
      sessionBill.items.forEach((item: any) => {
        printItems.push({
          name: item.name,
          quantity: item.quantity,
          price_cents: item.price_cents,
          status: item.status,
        });
        if (item.addons && item.addons.length > 0) {
          item.addons.forEach((addon: any) => {
            printItems.push({
              name: addon.name,
              quantity: addon.quantity,
              price_cents: addon.price_cents,
              isAddon: true,
            });
          });
        }
      });
      const billPayload = {
        sessionId: selectedSession.id,
        billData: {
          table: selectedTable?.name || 'Receipt',
          items: printItems,
          subtotal: sessionBill.subtotal_cents,
          serviceCharge: sessionBill.service_charge_cents || 0,
          total: sessionBill.total_cents,
        },
        priority: 5,
      };

      console.log('[PrintBill] Sending print request with payload:', billPayload);

      // Send to backend for printing
      const printRes = await apiClient.post(
        `/api/restaurants/${restaurantId}/print-bill`,
        billPayload
      );

      console.log('[PrintBill] Print response:', printRes.data);

      if (printRes.data && printRes.data.success) {
        // Handle browser printing - open native print dialog
        if (printRes.data.html && !printRes.data.bluetoothDevice) {
          console.log('[PrintBill] Opening native print dialog for browser printing');
          try {
            await Print.printAsync({
              html: printRes.data.html,
            });
            if (!autoPrint) {
              Alert.alert('Print Dialog Opened', `Bill for ${selectedTable?.name} ready to print`);
            }
          } catch (printErr: any) {
            console.error('[PrintBill] Print dialog error:', printErr);
            if (!autoPrint) {
              Alert.alert('Print Error', 'Failed to open print dialog: ' + printErr.message);
            }
          }
        } 
        // Handle Bluetooth printing
        else if (printRes.data.bluetoothDevice) {
          console.log('[PrintBill] Initiating Bluetooth printing to:', printRes.data.bluetoothDevice);
          console.log('[PrintBill] Receipt HTML length:', printRes.data.html?.length || 0);
          
          if (!autoPrint) {
            Alert.alert('Printing...', 'Sending receipt to Bluetooth printer...');
          }
          
          try {
            const device = printRes.data.bluetoothDevice;
            
            // Import BleManager for Bluetooth printing
            let BleManager: any = null;
            try {
              const ble = require('react-native-ble-plx');
              BleManager = ble.BleManager;
            } catch (e) {
              throw new Error('Bluetooth not available on this device');
            }

            if (!BleManager) {
              throw new Error('BleManager not available');
            }

            const manager = new BleManager();
            
            // Wait for BLE to be ready
            await new Promise<void>((resolve) => {
              let attempts = 0;
              const checkState = async () => {
                try {
                  const state = await manager.state();
                  if (state === 'PoweredOn') {
                    resolve();
                  } else if (++attempts < 10) {
                    setTimeout(checkState, 200);
                  } else {
                    resolve();
                  }
                } catch (e) {
                  if (++attempts < 10) setTimeout(checkState, 200);
                  else resolve();
                }
              };
              checkState();
            });

            console.log('[PrintBill] BLE ready, preparing thermal print data');
            
            // Prepare receipt data for thermal printer
            const receiptData = {
              orderNumber: String(selectedSession?.restaurant_order_number || selectedSession?.id),
              tableNumber: selectedTable?.name || 'Receipt',
              items: sessionBill.items.map(item => ({
                name: item.name,
                quantity: item.quantity,
                price: item.price_cents,
              })),
              subtotal: sessionBill.subtotal_cents,
              serviceCharge: sessionBill.service_charge_cents || 0,
              total: sessionBill.total_cents,
              timestamp: new Date().toLocaleTimeString(),
              restaurantName: 'Restaurant',
            };

            console.log('[PrintBill] Sending thermal print data to:', device.id);
            
            // Send to thermal printer using ESC/POS commands
            // Use 30 second timeout for authentication and printing
            await thermalPrinterService.sendToBluetooth(manager, device.id, receiptData, 30000);
            
            console.log('[PrintBill] Bluetooth printing completed successfully');
            if (!autoPrint) {
              Alert.alert('Printed', `Bill sent to printer "${device.name}"`);
            }
          } catch (bluetoothErr: any) {
            console.error('[PrintBill] Bluetooth printing error:', bluetoothErr);
            if (!autoPrint) {
              Alert.alert(
                'Print Issue',
                `Could not connect to printer. Make sure it's powered on and nearby.\n\nError: ${bluetoothErr.message}`
              );
            }
          }
        } 
        else {
          // Printer type is thermal/network - sent to printer queue
          if (!autoPrint) {
            Alert.alert(
              'Print Sent',
              `Bill for ${selectedTable?.name} sent to printer successfully`
            );
          }
        }
        setShowSessionGearMenu(false);
      } else {
        Alert.alert(
          'Printer Error',
          printRes.data?.error || 'Failed to send to printer'
        );
      }
    } catch (err: any) {
      console.log('[PrintBill] Error caught:', err);
      console.log('[PrintBill] Error message:', err.message);
      console.log('[PrintBill] Error response:', err.response?.data);
      
      if (!autoPrint) {
        Alert.alert(
          'Error',
          err.response?.data?.error || err.message || 'Failed to print bill'
        );
      }
    }
  };

  const testPrintBill = async () => {
    console.log('[TestPrint] Starting diagnostic test print');
    
    try {
      // Check if printer is configured
      const printerRes = await apiClient.get(
        `/api/restaurants/${restaurantId}/printer-settings`
      );
      
      if (!printerRes.data || !printerRes.data.printer_type) {
        Alert.alert('No Printer', 'Please configure a Bluetooth printer first');
        return;
      }

      if (printerRes.data.printer_type !== 'bluetooth') {
        Alert.alert('Not Bluetooth', 'Test print only works with Bluetooth printers');
        return;
      }

      const device = { 
        id: printerRes.data.bluetooth_device_id, 
        name: printerRes.data.bluetooth_device_name 
      };

      if (!device.id) {
        Alert.alert('No Device', 'Bluetooth device not configured');
        return;
      }

      Alert.alert('Test Print', 'Sending minimal test sequence to printer...');

      // Import BleManager
      let BleManager: any = null;
      try {
        const ble = require('react-native-ble-plx');
        BleManager = ble.BleManager;
      } catch (e) {
        throw new Error('Bluetooth not available');
      }

      const manager = new BleManager();
      
      // Wait for BLE to be ready
      await new Promise<void>((resolve) => {
        let attempts = 0;
        const checkState = async () => {
          try {
            const state = await manager.state();
            if (state === 'PoweredOn') {
              resolve();
            } else if (++attempts < 10) {
              setTimeout(checkState, 200);
            } else {
              resolve();
            }
          } catch (e) {
            if (++attempts < 10) setTimeout(checkState, 200);
            else resolve();
          }
        };
        checkState();
      });

      console.log('[TestPrint] Sending test sequence to:', device.id);
      // Use 30 second timeout for authentication and test print
      await thermalPrinterService.sendTestPrint(manager, device.id, 30000);
      
      Alert.alert('Test Sent', 'Check printer - it should print "TEST" if working');
      setShowSessionGearMenu(false);
    } catch (err: any) {
      console.error('[TestPrint] Error:', err);
      Alert.alert('Test Failed', err.message || 'Could not send test print');
    }
  };

  // Split bill state
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [splitCount, setSplitCount] = useState(2);
  const [splitBillData, setSplitBillData] = useState<any>(null);

  const splitBill = async () => {
    if (!selectedSession) return;
    setShowSessionGearMenu(false);
    try {
      const response = await apiClient.get(`/api/sessions/${selectedSession.id}/bill`);
      setSplitBillData(response.data);
      setSplitCount(2);
      setShowSplitModal(true);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to load bill for splitting');
    }
  };

  const calculateTotal = () => {
    let total = 0;
    sessionOrders.forEach((order) => {
      order.items.forEach((item) => {
        total += item.quantity * (item.unit_price_cents || item.price_cents || 0);
      });
    });

    const chargeAmount = Math.round(total * serviceCharge / 100);
    return { subtotal: total, serviceChargeAmount: chargeAmount, total: total + chargeAmount };
  };

  const isTablet = (Platform as any).isPad;
  const totals = calculateTotal();
  const screenWidth = Dimensions.get('window').width;
  const sidebarWidth = 130;
  const contentWidth = isTablet ? screenWidth - sidebarWidth - 24 : screenWidth - 24; // iPhone sidebar is overlay
  const tableNumColumns = isTablet ? (screenWidth > 1100 ? 5 : 4) : (screenWidth > 500 ? 3 : 2);
  const tableCardMaxWidth = Math.floor(contentWidth / tableNumColumns) - 12; // 12 for gap

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  if (currentView === 'sessionDetail' && selectedSession && selectedTable && !isTablet) {

    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setCurrentView('grid')}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>
            {selectedTable.name} • {selectedSession.pax} pax{selectedSession.order_id ? ` • Order #${selectedSession.restaurant_order_number || selectedSession.order_id}` : ''}
          </Text>
          <View style={{ position: 'relative' }}>
            <TouchableOpacity onPress={() => setShowSessionGearMenu(!showSessionGearMenu)}>
              <Text style={styles.gearIcon}><Ionicons name="settings-outline" size={20} color="#374151" /></Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Session Gear Menu - Outside header to avoid clipping */}
        {showSessionGearMenu && (
          <>
            {/* Overlay to close menu when tapped elsewhere */}
            <Pressable
              style={styles.menuOverlay}
              onPress={() => setShowSessionGearMenu(false)}
            />
            <View style={styles.gearMenuContainer}>
              <TouchableOpacity
                style={styles.gearMenuItem}
                onPress={() => changePax(selectedSession.id, selectedSession.pax)}
              >
                <Text style={styles.gearMenuItemText}>{t('admin.change-pax')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.gearMenuItem}
                onPress={moveTable}
              >
                <Text style={styles.gearMenuItemText}>{t('admin.move-table')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.gearMenuItem}
                onPress={orderForTable}
              >
                <Text style={styles.gearMenuItemText}>{t('admin.order-for-table')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.gearMenuItem}
                onPress={printQR}
              >
                <Text style={styles.gearMenuItemText}>{t('admin.print-qr')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.gearMenuItem}
                onPress={printBillWithPrinterSelection}
              >
                <Text style={styles.gearMenuItemText}>{t('admin.print-bill')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.gearMenuItem, { backgroundColor: '#f97316' }]}
                onPress={testPrintBill}
              >
                <Text style={styles.gearMenuItemText}>{t('admin.test-print')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.gearMenuItem}
                onPress={splitBill}
              >
                <Text style={styles.gearMenuItemText}>{t('admin.split-bill')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.gearMenuItem, styles.gearMenuItemDelete]}
                onPress={() => {
                  endSession(selectedSession.id);
                  setShowSessionGearMenu(false);
                }}
              >
                <Text style={[styles.gearMenuItemText, styles.gearMenuItemTextDelete]}>End Order</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        <ScrollView style={styles.content}>
          <Text style={styles.sectionTitle}>{t('admin.orders')}</Text>
          {sessionOrders.length === 0 ? (
            <Text style={styles.emptyText}>{t('admin.no-orders')}</Text>
          ) : (
            sessionOrders.map((order, idx) => {
              console.log(`[OrderRender] Order ${idx}:`, order);
              return (
                <View key={idx} style={styles.orderCard}>
                  <Text style={styles.orderTitle}>Order #{order.restaurant_order_number || order.order_id || order.id}</Text>
                  {order.items && order.items.length > 0 ? (
                    order.items.map((item, itemIdx) => (
                      <View key={itemIdx}>
                        <View style={styles.orderItem}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.itemName}>
                              {item.name || item.item_name || item.menu_item_name || 'Unknown Item'} x{item.quantity}
                            </Text>
                            <Text style={styles.itemStatus}>{item.status || 'pending'}</Text>
                            {item.variants && item.variants !== '' && <Text style={styles.itemStatus}>{item.variants}</Text>}
                          </View>
                          <Text style={styles.itemPrice}>
                            {formatPrice((item.item_total_cents || item.unit_price_cents || item.price_cents || 0))}
                          </Text>
                        </View>
                        {item.addons && item.addons.length > 0 && (
                          <View style={{ paddingLeft: 12, paddingTop: 4, paddingBottom: 4 }}>
                            {item.addons.map((addon, addonIdx) => (
                              <View key={addonIdx} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 }}>
                                <Text style={[styles.itemStatus, { color: '#999', fontStyle: 'italic', flex: 1 }]}>
                                  + {addon.menu_item_name || addon.name || 'Addon'} x{addon.quantity}
                                </Text>
                                <Text style={[styles.itemStatus, { color: '#666', marginLeft: 8 }]}>
                                  {formatPrice((addon.item_total_cents || 0))}
                                </Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    ))
                  ) : (
                    <Text style={styles.itemStatus}>No items in order</Text>
                  )}
                </View>
              );
            })
          )}

          <View style={styles.totalsSection}>
            <View style={styles.totalRow}>
              <Text>{t('admin.subtotal')}</Text>
              <Text>{formatPrice(totals.subtotal)}</Text>
            </View>
            {serviceCharge > 0 && (
              <View style={styles.totalRow}>
                <Text>{t('admin.service-charge')} ({serviceCharge}%)</Text>
                <Text>{formatPrice(totals.serviceChargeAmount)}</Text>
              </View>
            )}
            <View style={[styles.totalRow, styles.grandTotal]}>
              <Text style={styles.totalLabel}>{t('admin.total')}</Text>
              <Text style={styles.totalLabel}>{formatPrice(totals.total)}</Text>
            </View>
          </View>
        </ScrollView>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.btn, styles.btnPrimary]}
            onPress={async () => {
              setShowCloseBillModal(true);
              try {
                const res = await apiClient.get(`/api/restaurants/${restaurantId}/coupons`);
                setCoupons((res.data || []).filter((c: Coupon) => c.is_active));
              } catch (e) {
                setCoupons([]);
              }
            }}
          >
            <Text style={styles.btnText}>{t('admin.close-bill')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, styles.btnSecondary]}
            onPress={() => endSession(selectedSession.id)}
          >
            <Text style={styles.btnText}>End Order</Text>
          </TouchableOpacity>
        </View>

        {/* Close Bill Modal */}
        <Modal supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']} visible={showCloseBillModal} animationType="fade" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{t('admin.close-bill')}</Text>

              {/* Bill Summary */}
              {sessionBill && (
                <View style={{ backgroundColor: '#f8f9fa', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ color: '#666' }}>Subtotal</Text>
                    <Text>${((sessionBill.subtotal_cents || 0) / 100).toFixed(2)}</Text>
                  </View>
                  {(sessionBill.service_charge_cents || 0) > 0 && (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={{ color: '#666' }}>Service Charge</Text>
                      <Text>${(sessionBill.service_charge_cents! / 100).toFixed(2)}</Text>
                    </View>
                  )}
                  {getDiscountCents() > 0 && (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={{ color: '#e74c3c' }}>Discount</Text>
                      <Text style={{ color: '#e74c3c' }}>-${(getDiscountCents() / 100).toFixed(2)}</Text>
                    </View>
                  )}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#ddd', paddingTop: 6, marginTop: 4 }}>
                    <Text style={{ fontWeight: '700', fontSize: 16 }}>Total</Text>
                    <Text style={{ fontWeight: '700', fontSize: 16, color: '#27ae60' }}>
                      ${(((sessionBill.grand_total_cents || sessionBill.total_cents || 0) - getDiscountCents()) / 100).toFixed(2)}
                    </Text>
                  </View>
                </View>
              )}

              <Text style={styles.label}>{t('admin.payment-method')}</Text>
              <View style={styles.selectGroup}>
                {['cash', 'card', 'online'].map((method) => (
                  <TouchableOpacity
                    key={method}
                    style={[
                      styles.selectOption,
                      paymentMethod === method && styles.selectOptionActive,
                    ]}
                    onPress={() => setPaymentMethod(method)}
                  >
                    <Text
                      style={[
                        styles.selectOptionText,
                        paymentMethod === method && styles.selectOptionTextActive,
                      ]}
                    >
                      {method.charAt(0).toUpperCase() + method.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Coupon Picker */}
              <Text style={styles.label}>{t('admin.discount-coupon')}</Text>
              <TouchableOpacity
                style={[styles.input, { justifyContent: 'center' }]}
                onPress={() => setShowCouponPicker(!showCouponPicker)}
              >
                <Text style={{ color: selectedCouponId ? '#333' : '#999' }}>
                  {selectedCouponId
                    ? (() => {
                        const c = coupons.find(cp => cp.id === selectedCouponId);
                        return c ? `${c.code} - ${c.discount_type === 'percentage' ? c.discount_value + '%' : '$' + (c.discount_value / 100).toFixed(2)}` : 'No discount';
                      })()
                    : 'No discount'}
                </Text>
              </TouchableOpacity>
              {showCouponPicker && (
                <View style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, marginTop: -8, marginBottom: 8, maxHeight: 160 }}>
                  <ScrollView nestedScrollEnabled>
                    <TouchableOpacity
                      style={{ padding: 10, borderBottomWidth: 1, borderBottomColor: '#eee' }}
                      onPress={() => { setSelectedCouponId(null); setShowCouponPicker(false); }}
                    >
                      <Text style={{ color: '#666' }}>No discount</Text>
                    </TouchableOpacity>
                    {coupons.map(c => (
                      <TouchableOpacity
                        key={c.id}
                        style={{ padding: 10, borderBottomWidth: 1, borderBottomColor: '#eee', backgroundColor: selectedCouponId === c.id ? '#e8f4fd' : '#fff' }}
                        onPress={() => { setSelectedCouponId(c.id); setShowCouponPicker(false); }}
                      >
                        <Text style={{ fontWeight: '600' }}>{c.code}</Text>
                        <Text style={{ color: '#666', fontSize: 12 }}>
                          {c.discount_type === 'percentage' ? `${c.discount_value}% off` : `$${(c.discount_value / 100).toFixed(2)} off`}
                          {c.description ? ` — ${c.description}` : ''}
                        </Text>
                      </TouchableOpacity>
                    ))}
                    {coupons.length === 0 && (
                      <Text style={{ padding: 10, color: '#999', fontStyle: 'italic' }}>No coupons available</Text>
                    )}
                  </ScrollView>
                </View>
              )}

              <Text style={styles.label}>{t('admin.notes')}</Text>
              <TextInput
                style={[styles.input, styles.multilineInput]}
                multiline
                value={closeReason}
                onChangeText={setCloseReason}
                placeholder="Optional notes"
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.btn, styles.btnSecondary]}
                  onPress={() => setShowCloseBillModal(false)}
                >
                  <Text style={styles.btnText}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, styles.btnPrimary]}
                  onPress={closeBill}
                >
                  <Text style={styles.btnText}>{t('admin.close-bill')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Booking Start Modal */}
        <Modal supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']} visible={showBookingStartModal} animationType="fade" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{t('admin.start-session') || 'Start Session'}</Text>
              {bookingToStart && (
                <>
                  <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 4 }}>{bookingToStart.booking.guest_name}</Text>
                  <Text style={{ fontSize: 14, color: '#666', marginBottom: 4 }}>{bookingToStart.booking.pax} {t('admin.guests') || 'guests'}</Text>
                  {bookingToStart.booking.phone ? <Text style={{ fontSize: 14, color: '#666' }}>{bookingToStart.booking.phone}</Text> : null}
                </>
              )}
              <View style={styles.modalActions}>
                <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={() => { setShowBookingStartModal(false); setBookingToStart(null); }}>
                  <Text style={styles.btnText}>{t('common.cancel') || 'Cancel'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={confirmStartSessionFromBooking}>
                  <Text style={styles.btnText}>{t('admin.start-session') || 'Start'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Change Pax Modal */}
        <Modal supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']} visible={showChangePaxModal} animationType="fade" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{t('admin.change-pax')}</Text>

              <Text style={styles.label}>New Pax Count</Text>
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                inputAccessoryViewID="numpadDone"
                value={newPaxValue}
                onChangeText={setNewPaxValue}
                placeholder="1"
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.btn, styles.btnSecondary]}
                  onPress={() => setShowChangePaxModal(false)}
                >
                  <Text style={styles.btnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, styles.btnPrimary]}
                  onPress={submitChangePax}
                >
                  <Text style={styles.btnText}>Update</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Move Table Modal */}
        <Modal supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']} visible={showMoveTableModal} animationType="fade" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Move to Table</Text>

              <Text style={styles.label}>Select Available Table</Text>
              <ScrollView style={{ maxHeight: 200, marginBottom: 16 }}>
                {tables
                  .filter((t) => t.sessions.length === 0 && t.id !== selectedTable?.id)
                  .map((table) => (
                    <TouchableOpacity
                      key={table.id}
                      style={[
                        styles.tableOption,
                        selectedMoveTable === table.id && styles.tableOptionSelected,
                      ]}
                      onPress={() => setSelectedMoveTable(table.id)}
                    >
                      <Text style={styles.tableOptionText}>{table.name}</Text>
                    </TouchableOpacity>
                  ))}
              </ScrollView>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.btn, styles.btnSecondary]}
                  onPress={() => setShowMoveTableModal(false)}
                >
                  <Text style={styles.btnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, styles.btnPrimary]}
                  onPress={submitMoveTable}
                >
                  <Text style={styles.btnText}>Move</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Print QR Code Modal */}
        <Modal supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']} visible={showQRModal} animationType="fade" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Print QR Code</Text>
              
              {selectedTable && selectedSession && qrImageUrl ? (
                <>
                  <ScrollView style={{ marginBottom: 16 }}>
                    <View style={styles.qrHeader}>
                      <Text style={styles.qrHeaderTable}>{selectedTable.name}</Text>
                      <Text style={styles.qrHeaderPax}>Party of {selectedSession.pax}</Text>
                    </View>
                    
                    <View style={styles.qrImageContainer}>
                      {qrLoading ? (
                        <ActivityIndicator size="large" color="#3b82f6" />
                      ) : (
                        <Image
                          source={{ uri: qrImageUrl }}
                          style={styles.qrImage}
                          resizeMode="contain"
                          onError={() => {
                            Alert.alert('Error', 'Failed to load QR code image');
                            setShowQRModal(false);
                          }}
                        />
                      )}
                    </View>

                    <View style={styles.qrFooter}>
                      <Text style={styles.qrFooterText}>{qrTextAbove}</Text>
                    </View>
                  </ScrollView>

                  <View style={styles.modalActions}>
                    <TouchableOpacity
                      style={[styles.btn, styles.btnSecondary]}
                      onPress={() => setShowQRModal(false)}
                    >
                      <Text style={styles.btnText}>Close</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.btn, styles.btnPrimary]}
                      onPress={() => {
                        Alert.alert(
                          'QR Code Ready',
                          'The QR code is displayed above. Users can scan it to place orders.',
                          [{ text: 'OK', onPress: () => setShowQRModal(false) }]
                        );
                      }}
                    >
                      <Text style={styles.btnText}>Done</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 40 }}>
                  <Text style={{ marginBottom: 20, color: '#666' }}>
                    Loading QR Code...
                  </Text>
                  <Text style={{ marginBottom: 10, fontSize: 12, color: '#999' }}>
                    Table: {selectedTable?.name || 'NONE'}
                  </Text>
                  <Text style={{ marginBottom: 10, fontSize: 12, color: '#999' }}>
                    Session: {selectedSession?.id || 'NONE'}
                  </Text>
                  <Text style={{ marginBottom: 10, fontSize: 12, color: '#999' }}>
                    QR URL: {qrImageUrl ? 'PRESENT' : 'NOT YET'}
                  </Text>
                  <Text style={{ marginBottom: 10, fontSize: 12, color: '#999' }}>
                    QR Loading: {qrLoading ? 'YES' : 'NO'}
                  </Text>
                  <ActivityIndicator size="large" color="#3b82f6" />
                </View>
              )}
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  if (currentView === 'sessionList' && selectedTable && !isTablet) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setCurrentView('grid')}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{selectedTable.name}</Text>
        </View>

        <ScrollView style={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
          <Text style={styles.sectionTitle}>Active Orders</Text>
          {selectedTable.sessions.length === 0 ? (
            <Text style={styles.emptyText}>No active orders</Text>
          ) : (
            selectedTable.sessions.map((session, idx) => (
              <TouchableOpacity
                key={session.id}
                style={styles.sessionCard}
                onPress={() => handleSessionClick(session)}
              >
                <View>
                  <Text style={styles.sessionTitle}>
                    {selectedTable.name}{selectedTable.sessions.length > 1 ? String.fromCharCode(65 + idx) : ''}{session.order_id ? `, Order #${session.restaurant_order_number || session.order_id}` : ''}
                  </Text>
                  <Text style={styles.sessionInfo}>
                    {session.pax} pax • Dining {formatDuration(session.started_at)}
                  </Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
            ))
          )}

          {selectedTable.sessions.length < selectedTable.seat_count && (
            <>
              <Text style={styles.sectionTitle}>{t('admin.options')}</Text>
              <TouchableOpacity
                style={[styles.btn, styles.btnPrimary]}
                onPress={openNewOrderModal}
              >
                <Text style={styles.btnText}>New Order</Text>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity
            style={[styles.btn, styles.btnSecondary]}
            onPress={() => {
              setShowBookingModal(true);
            }}
          >
            <Text style={styles.btnText}>{t('admin.book-table')}</Text>
          </TouchableOpacity>
          {/* Upcoming Reservations */}
          {selectedTable.bookings && selectedTable.bookings.filter(b => !b.session_id).length > 0 && (
            <>
              <Text style={[styles.sectionTitle, { marginTop: 16 }]}>{t('admin.upcoming-reservations') || 'Upcoming Reservations'}</Text>
              {selectedTable.bookings.filter(b => !b.session_id).map((booking) => (
                <TouchableOpacity
                  key={booking.id}
                  style={{ padding: 10, backgroundColor: '#f5f5f5', borderLeftWidth: 3, borderLeftColor: '#4a90e2', borderRadius: 4, marginBottom: 8 }}
                  onPress={() => startSessionFromBooking(selectedTable.id, booking)}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '700', fontSize: 14 }}>#{booking.restaurant_booking_number || booking.id} - {booking.guest_name}</Text>
                      <Text style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
                        {booking.booking_time} · {booking.phone || 'N/A'} · {booking.pax} {t('admin.guests') || 'guests'}
                      </Text>
                    </View>
                    <View style={{ backgroundColor: '#dbeafe', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 }}>
                      <Text style={{ fontSize: 11, color: '#1d4ed8', fontWeight: '600' }}>{t('admin.tap-to-start') || 'Tap to start'}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </>
          )}
        </ScrollView>

        {/* Session Modal */}
        <Modal supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']} visible={showSessionModal} animationType="fade" transparent onDismiss={() => Keyboard.dismiss()}>
          <Pressable style={styles.modalOverlay} onPress={() => {
            Keyboard.dismiss();
            setShowSessionModal(false);
          }}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ justifyContent: 'center', flex: 1 }}>
            <Pressable style={styles.modalContent} onPress={() => {}}>
              <Text style={styles.modalTitle}>New Order</Text>

              <Text style={styles.label}>{t('admin.number-of-guests')}</Text>
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                inputAccessoryViewID="numpadDone"
                value={sessionPax}
                onChangeText={setSessionPax}
                placeholder="1"
              />

              {qrMode === 'static_seat' && (
                <>
                  <Text style={[styles.label, { marginTop: 12 }]}>Select Seats</Text>
                  {loadingSeats ? (
                    <Text style={{ color: '#888', marginBottom: 8 }}>Loading seats...</Text>
                  ) : (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                      {seatUnits.map(unit => {
                        const isSelected = selectedSeatIds.includes(unit.id);
                        return (
                          <TouchableOpacity
                            key={unit.id}
                            onPress={() => !unit.occupied && toggleSeat(unit.id)}
                            style={{
                              paddingVertical: 8, paddingHorizontal: 14,
                              borderRadius: 8, borderWidth: 2,
                              borderColor: unit.occupied ? '#ccc' : isSelected ? '#007AFF' : '#ddd',
                              backgroundColor: unit.occupied ? '#f0f0f0' : isSelected ? '#007AFF' : '#fff',
                              opacity: unit.occupied ? 0.5 : 1,
                            }}
                          >
                            <Text style={{ fontWeight: '600', color: unit.occupied ? '#999' : isSelected ? '#fff' : '#333' }}>
                              {unit.display_name || unit.unit_code}
                            </Text>
                            {unit.occupied && <Text style={{ fontSize: 10, color: '#999' }}>Occupied</Text>}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </>
              )}

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.btn, styles.btnSecondary]}
                  onPress={() => {
                    Keyboard.dismiss();
                    setShowSessionModal(false);
                  }}
                >
                  <Text style={styles.btnText}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, styles.btnPrimary]}
                  onPress={startSession}
                >
                  <Text style={styles.btnText}>Start Order</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
            </KeyboardAvoidingView>
          </Pressable>
        </Modal>

        {/* Booking Modal */}
        <Modal supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']} visible={showBookingModal} animationType="fade" transparent>
          <View style={styles.modalOverlay}>
            <ScrollView contentContainerStyle={styles.modalContent}>
              <Text style={styles.modalTitle}>{t('admin.book-table')}</Text>

              <Text style={styles.label}>{t('admin.guest-name')}</Text>
              <TextInput
                style={styles.input}
                value={guestName}
                onChangeText={setGuestName}
                placeholder="John Smith"
              />

              <Text style={styles.label}>{t('admin.phone')}</Text>
              <TextInput
                style={styles.input}
                value={guestPhone}
                onChangeText={setGuestPhone}
                placeholder="+1 (555) 123-4567"
                keyboardType="phone-pad"
              />

              <Text style={styles.label}>{t('admin.email')}</Text>
              <TextInput
                style={styles.input}
                value={guestEmail}
                onChangeText={setGuestEmail}
                placeholder="john@example.com"
                keyboardType="email-address"
              />

              <Text style={styles.label}>{t('admin.guests')}</Text>
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                inputAccessoryViewID="numpadDone"
                value={bookingPax}
                onChangeText={setBookingPax}
                placeholder="2"
              />

              <Text style={styles.label}>{t('admin.reservation-time')}</Text>
              <TextInput
                style={styles.input}
                value={bookingTime}
                onChangeText={setBookingTime}
                placeholder="18:00"
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.btn, styles.btnSecondary]}
                  onPress={() => setShowBookingModal(false)}
                >
                  <Text style={styles.btnText}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, styles.btnPrimary]}
                  onPress={bookTable}
                >
                  <Text style={styles.btnText}>{t('admin.book-table')}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </Modal>
      </View>
    );
  }

  return (
    <View style={[styles.container, isTablet && currentView !== 'grid' ? { flexDirection: 'row' } : {}]}>
      {/* Grid: Category Bar + Tables (wrapped for iPad split layout) */}
      <View style={{ flex: 1 }}>
      {/* Tables grouped by category */}
      <ScrollView
        style={styles.tablesGridWrapper}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Edit mode: Add Category button */}
        {isEditMode && (
          <TouchableOpacity
            style={[styles.categoryBtn, styles.categoryBtnAdd, { alignSelf: 'flex-start', marginHorizontal: 12, marginTop: 8 }]}
            onPress={() => setShowCategoryModal(true)}
          >
            <Text style={[styles.categoryBtnText, styles.categoryBtnAddText]}>+ Add Category</Text>
          </TouchableOpacity>
        )}

        {tableSections.map((section) => {
          const sectionTables = section.tables;
          if (sectionTables.length === 0 && !isEditMode) return null;
          const dataForGrid = isEditMode
            ? [...sectionTables, { id: 'add-table', name: '+ Add Table', isAddButton: true, category_id: section.category.id }]
            : sectionTables;
          const rows = chunkArray(dataForGrid, tableNumColumns);

          return (
            <View key={section.category.id} style={styles.tableSectionContainer}>
              {/* Section Header */}
              <View style={styles.tableSectionHeader}>
                <Text style={styles.tableSectionTitle}>{section.category.key || section.category.name || `Category ${section.category.id}`}</Text>
                {isEditMode && (
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity
                      style={styles.categoryActionBtn}
                      onPress={() => {
                        setEditingCategoryId(section.category.id);
                        setEditingCategoryName(section.category.name || section.category.key || '');
                        setShowEditCategoryModal(true);
                      }}
                    >
                      <Text style={styles.categoryActionBtnText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.categoryActionBtn, styles.categoryActionBtnDelete]}
                      onPress={() => deleteCategory(section.category.id, section.category.name || section.category.key || `Category ${section.category.id}`)}
                    >
                      <Text style={styles.categoryActionBtnText}>Del</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Table cards grid */}
              {rows.map((row, rowIdx) => (
                <View key={rowIdx} style={styles.gridRow}>
                  {row.map((tableOrAdd: any) => {
                    if (tableOrAdd.isAddButton) {
                      return (
                        <View key="add-table" style={[styles.tableCardWrapper, { maxWidth: tableCardMaxWidth }]}>
                          <TouchableOpacity
                            style={[styles.tableCard, styles.tableAddCard]}
                            onPress={() => {
                              setSelectedCategory(section.category.id);
                              setShowTableModal(true);
                            }}
                          >
                            <Text style={styles.tableAddIcon}>+</Text>
                            <Text style={styles.tableAddLabel}>Add Table</Text>
                          </TouchableOpacity>
                        </View>
                      );
                    }
                    const table = tableOrAdd as Table;
                    const cardColor = getTableCardColor(table);
                    const textColor = getTableTextColor(cardColor);
                    const isEmpty = table.sessions.length === 0 && !table.reserved;
                    return (
                  <View key={table.id} style={[styles.tableCardWrapper, { maxWidth: tableCardMaxWidth }]}>
                    <TouchableOpacity
                      style={[
                        styles.tableCard,
                        { backgroundColor: cardColor, borderColor: isEmpty ? '#ddd' : cardColor },
                        isEditMode && selectedTableForEditControls === table.id && styles.tableCardSelected,
                      ]}
                      onPress={() => {
                        if (isEditMode) {
                          setSelectedTableForEditControls(selectedTableForEditControls === table.id ? null : table.id);
                        } else {
                          handleTableClick(table);
                        }
                      }}
                    >
                      {table.sessions.length > 0 && (
                        <Text style={[styles.tableCardSessionsBadge, textColor]}>
                          ● {table.sessions.length}
                        </Text>
                      )}
                      <View style={[styles.tableCardSeats]}>
                        <Ionicons name="person" size={12} color={isEmpty ? '#666' : (textColor as any)?.color || '#fff'} />
                        <Text style={[styles.tableCardSeatsText, textColor]}>
                          {table.sessions.reduce((sum: number, s: any) => sum + (s.pax || 0), 0)}/{table.seat_count}
                        </Text>
                      </View>
                      <Text style={[styles.tableCardName, textColor]} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.6}>
                        {table.name}
                      </Text>
                      <View style={styles.tableCardBottomInfo}>
                        {table.sessions.length > 0 ? (
                          <View style={styles.tableCardSessionsList}>
                            {table.sessions.map((session: any, sIdx: number) => (
                              <View key={session.id} style={styles.sessionTimeItem}>
                                <Ionicons name="timer-outline" size={13} color={(textColor as any)?.color || '#fff'} />
                                <Text style={[styles.sessionTimeText, textColor]}>
                                  {session.order_id ? `#${session.restaurant_order_number || session.order_id}` : ''} {formatDuration(session.started_at)}
                                </Text>
                                {session.staff_called && (
                                  <View style={styles.sessionBadgeStaff}>
                                    <Text style={styles.sessionBadgeStaffText}>STAFF</Text>
                                  </View>
                                )}
                                {session.bill_closure_requested && (
                                  <View style={styles.sessionBadgeBill}>
                                    <Text style={styles.sessionBadgeBillText}>BILL</Text>
                                  </View>
                                )}
                              </View>
                            ))}
                          </View>
                        ) : table.reserved ? (
                          <View style={{ backgroundColor: '#ffc107', borderRadius: 6, paddingVertical: 3, paddingHorizontal: 10, alignSelf: 'center' }}>
                            <Text style={{ color: '#000', fontWeight: '700', fontSize: 11 }}>
                              {getReservationTimeInfo(table)?.text || 'Reserved'}
                            </Text>
                          </View>
                        ) : (
                          <Text style={[styles.tableCardAvailableText, textColor]}>Available</Text>
                        )}
                      </View>
                    </TouchableOpacity>
                    {isEditMode && selectedTableForEditControls === table.id && (
                      <View style={styles.tableActionButtonsContainer}>
                        <TouchableOpacity
                          style={styles.tableActionBtn}
                          onPress={() => {
                            setEditingTableId(table.id);
                            setEditingTableName(table.name);
                            setEditingTableSeats(table.seat_count.toString());
                            setShowEditTableModal(true);
                          }}
                        >
                          <Text style={styles.tableActionBtnText}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.tableActionBtn}
                          onPress={() => {
                            setEditingTablePaxId(table.id);
                            setEditingPaxValue(table.seat_count.toString());
                            setShowEditPaxModal(true);
                          }}
                        >
                          <Text style={styles.tableActionBtnText}>Pax</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.tableActionBtn, styles.tableActionBtnDelete]}
                          onPress={() => deleteTable(table.id, table.name)}
                        >
                          <Text style={styles.tableActionBtnText}>Del</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                    );
                  })}
                  {/* Fill remaining columns with empty spacers */}
                  {row.length < tableNumColumns && Array.from({ length: tableNumColumns - row.length }).map((_, i) => (
                    <View key={`spacer-${i}`} style={[styles.tableCardWrapper, { maxWidth: tableCardMaxWidth }]} />
                  ))}
                </View>
              ))}
            </View>
          );
        })}

        {tableSections.length === 0 && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>{t('admin.no-tables')}</Text>
          </View>
        )}
      </ScrollView>
      </View>{/* end flex:1 grid wrapper */}

      {/* iPad: Session List Side Panel */}
      {isTablet && currentView === 'sessionList' && selectedTable && (
        <View style={styles.sessionSidePanel}>
          <View style={styles.sessionSidePanelHeader}>
            <Text style={styles.sessionSidePanelTitle}>{selectedTable.name}</Text>
            <TouchableOpacity onPress={() => setCurrentView('grid')}>
              <Ionicons name="close" size={22} color="#374151" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
            <Text style={styles.sectionTitle}>Active Orders</Text>
            {selectedTable.sessions.length === 0 ? (
              <Text style={styles.emptyText}>No active orders</Text>
            ) : (
              selectedTable.sessions.map((session, idx) => (
                <TouchableOpacity key={session.id} style={styles.sessionCard} onPress={() => handleSessionClick(session)}>
                  <View>
                    <Text style={styles.sessionTitle}>{selectedTable.name}{selectedTable.sessions.length > 1 ? String.fromCharCode(65 + idx) : ''}{session.order_id ? `, Order #${session.restaurant_order_number || session.order_id}` : ''}</Text>
                    <Text style={styles.sessionInfo}>{session.pax} pax • Dining {formatDuration(session.started_at)}</Text>
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </TouchableOpacity>
              ))
            )}
            {selectedTable.sessions.length < selectedTable.seat_count && (
              <>
                <Text style={styles.sectionTitle}>{t('admin.options')}</Text>
                <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={openNewOrderModal}>
                  <Text style={styles.btnText}>New Order</Text>
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={() => setShowBookingModal(true)}>
              <Text style={styles.btnText}>{t('admin.book-table')}</Text>
            </TouchableOpacity>
            {/* Upcoming Reservations */}
            {selectedTable.bookings && selectedTable.bookings.filter(b => !b.session_id).length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { marginTop: 16 }]}>{t('admin.upcoming-reservations') || 'Upcoming Reservations'}</Text>
                {selectedTable.bookings.filter(b => !b.session_id).map((booking) => (
                  <TouchableOpacity
                    key={booking.id}
                    style={{ padding: 10, backgroundColor: '#f5f5f5', borderLeftWidth: 3, borderLeftColor: '#4a90e2', borderRadius: 4, marginBottom: 8 }}
                    onPress={() => startSessionFromBooking(selectedTable.id, booking)}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: '700', fontSize: 14 }}>#{booking.restaurant_booking_number || booking.id} - {booking.guest_name}</Text>
                        <Text style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
                          {booking.booking_time} · {booking.phone || 'N/A'} · {booking.pax} {t('admin.guests') || 'guests'}
                        </Text>
                      </View>
                      <View style={{ backgroundColor: '#dbeafe', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 }}>
                        <Text style={{ fontSize: 11, color: '#1d4ed8', fontWeight: '600' }}>{t('admin.tap-to-start') || 'Tap to start'}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </>
            )}
          </ScrollView>
          <Modal supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']} visible={showSessionModal} animationType="fade" transparent onDismiss={() => Keyboard.dismiss()}>
            <Pressable style={styles.modalOverlay} onPress={() => { Keyboard.dismiss(); setShowSessionModal(false); }}>
              <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ justifyContent: 'center', flex: 1 }}>
                <Pressable style={styles.modalContent} onPress={() => {}}>
                  <Text style={styles.modalTitle}>New Order</Text>
                  <Text style={styles.label}>{t('admin.number-of-guests')}</Text>
                  <TextInput style={styles.input} keyboardType="number-pad" inputAccessoryViewID="numpadDone" value={sessionPax} onChangeText={setSessionPax} placeholder="1" />
                  {qrMode === 'static_seat' && (
                    <>
                      <Text style={[styles.label, { marginTop: 12 }]}>Select Seats</Text>
                      {loadingSeats ? (
                        <Text style={{ color: '#888', marginBottom: 8 }}>Loading seats...</Text>
                      ) : (
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                          {seatUnits.map(unit => {
                            const isSelected = selectedSeatIds.includes(unit.id);
                            return (
                              <TouchableOpacity
                                key={unit.id}
                                onPress={() => !unit.occupied && toggleSeat(unit.id)}
                                style={{
                                  paddingVertical: 8, paddingHorizontal: 14,
                                  borderRadius: 8, borderWidth: 2,
                                  borderColor: unit.occupied ? '#ccc' : isSelected ? '#007AFF' : '#ddd',
                                  backgroundColor: unit.occupied ? '#f0f0f0' : isSelected ? '#007AFF' : '#fff',
                                  opacity: unit.occupied ? 0.5 : 1,
                                }}
                              >
                                <Text style={{ fontWeight: '600', color: unit.occupied ? '#999' : isSelected ? '#fff' : '#333' }}>
                                  {unit.display_name || unit.unit_code}
                                </Text>
                                {unit.occupied && <Text style={{ fontSize: 10, color: '#999' }}>Occupied</Text>}
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      )}
                    </>
                  )}
                  <View style={styles.modalActions}>
                    <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={() => { Keyboard.dismiss(); setShowSessionModal(false); }}>
                      <Text style={styles.btnText}>{t('common.cancel')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={startSession}>
                      <Text style={styles.btnText}>Start Order</Text>
                    </TouchableOpacity>
                  </View>
                </Pressable>
              </KeyboardAvoidingView>
            </Pressable>
          </Modal>
          <Modal supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']} visible={showBookingModal} animationType="fade" transparent>
            <View style={styles.modalOverlay}>
              <ScrollView contentContainerStyle={styles.modalContent}>
                <Text style={styles.modalTitle}>{t('admin.book-table')}</Text>
                <Text style={styles.label}>{t('admin.guest-name')}</Text>
                <TextInput style={styles.input} value={guestName} onChangeText={setGuestName} placeholder="John Smith" />
                <Text style={styles.label}>{t('admin.phone')}</Text>
                <TextInput style={styles.input} value={guestPhone} onChangeText={setGuestPhone} placeholder="+1 (555) 123-4567" keyboardType="phone-pad" />
                <Text style={styles.label}>{t('admin.email')}</Text>
                <TextInput style={styles.input} value={guestEmail} onChangeText={setGuestEmail} placeholder="john@example.com" keyboardType="email-address" />
                <Text style={styles.label}>{t('admin.guests')}</Text>
                <TextInput style={styles.input} keyboardType="number-pad" inputAccessoryViewID="numpadDone" value={bookingPax} onChangeText={setBookingPax} placeholder="2" />
                <Text style={styles.label}>{t('admin.reservation-time')}</Text>
                <TextInput style={styles.input} value={bookingTime} onChangeText={setBookingTime} placeholder="18:00" />
                <View style={styles.modalActions}>
                  <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={() => setShowBookingModal(false)}>
                    <Text style={styles.btnText}>{t('common.cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={bookTable}>
                    <Text style={styles.btnText}>{t('admin.book-table')}</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </Modal>
        </View>
      )}

      {/* iPad: Session Detail Side Panel */}
      {isTablet && currentView === 'sessionDetail' && selectedSession && selectedTable && (
        <View style={styles.sessionSidePanel}>
          <View style={styles.sessionSidePanelHeader}>
            <Text style={styles.sessionSidePanelTitle} numberOfLines={1}>{selectedTable.name} • {selectedSession.pax} pax{selectedSession.order_id ? ` • Order #${selectedSession.restaurant_order_number || selectedSession.order_id}` : ''}</Text>
            <TouchableOpacity onPress={() => { setCurrentView('grid'); setSelectedSession(null); }}>
              <Ionicons name="close" size={22} color="#374151" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowSessionGearMenu(!showSessionGearMenu)}>
              <Ionicons name="settings-outline" size={20} color="#374151" />
            </TouchableOpacity>
          </View>
          {showSessionGearMenu && (
            <>
              <Pressable style={styles.menuOverlay} onPress={() => setShowSessionGearMenu(false)} />
              <View style={styles.gearMenuContainer}>
                <TouchableOpacity style={styles.gearMenuItem} onPress={() => changePax(selectedSession.id, selectedSession.pax)}>
                  <Text style={styles.gearMenuItemText}>{t('admin.change-pax')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.gearMenuItem} onPress={moveTable}>
                  <Text style={styles.gearMenuItemText}>{t('admin.move-table')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.gearMenuItem} onPress={orderForTable}>
                  <Text style={styles.gearMenuItemText}>{t('admin.order-for-table')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.gearMenuItem} onPress={printQR}>
                  <Text style={styles.gearMenuItemText}>{t('admin.print-qr')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.gearMenuItem} onPress={printBillWithPrinterSelection}>
                  <Text style={styles.gearMenuItemText}>{t('admin.print-bill')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.gearMenuItem, { backgroundColor: '#f97316' }]} onPress={testPrintBill}>
                  <Text style={styles.gearMenuItemText}>{t('admin.test-print')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.gearMenuItem} onPress={splitBill}>
                  <Text style={styles.gearMenuItemText}>{t('admin.split-bill')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.gearMenuItem, styles.gearMenuItemDelete]} onPress={() => { endSession(selectedSession.id); setShowSessionGearMenu(false); }}>
                  <Text style={[styles.gearMenuItemText, styles.gearMenuItemTextDelete]}>End Order</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
          <ScrollView style={styles.content}>
            <Text style={styles.sectionTitle}>{t('admin.orders')}</Text>
            {sessionOrders.length === 0 ? (
              <Text style={styles.emptyText}>{t('admin.no-orders')}</Text>
            ) : (
              sessionOrders.map((order, idx) => (
                <View key={idx} style={styles.orderCard}>
                  <Text style={styles.orderTitle}>Order #{order.restaurant_order_number || order.order_id || order.id}</Text>
                  {order.items && order.items.length > 0 ? (
                    order.items.map((item, itemIdx) => (
                      <View key={itemIdx}>
                        <View style={styles.orderItem}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.itemName}>{item.name || item.item_name || item.menu_item_name || 'Unknown Item'} x{item.quantity}</Text>
                            <Text style={styles.itemStatus}>{item.status || 'pending'}</Text>
                            {item.variants && item.variants !== '' && <Text style={styles.itemStatus}>{item.variants}</Text>}
                          </View>
                          <Text style={styles.itemPrice}>{formatPrice((item.item_total_cents || item.unit_price_cents || item.price_cents || 0))}</Text>
                        </View>
                        {item.addons && item.addons.length > 0 && (
                          <View style={{ paddingLeft: 12, paddingTop: 4, paddingBottom: 4 }}>
                            {item.addons.map((addon, addonIdx) => (
                              <View key={addonIdx} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 }}>
                                <Text style={[styles.itemStatus, { color: '#999', fontStyle: 'italic', flex: 1 }]}>+ {addon.menu_item_name || addon.name || 'Addon'} x{addon.quantity}</Text>
                                <Text style={[styles.itemStatus, { color: '#666', marginLeft: 8 }]}>{formatPrice((addon.item_total_cents || 0))}</Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    ))
                  ) : (
                    <Text style={styles.itemStatus}>No items in order</Text>
                  )}
                </View>
              ))
            )}
            <View style={styles.totalsSection}>
              <View style={styles.totalRow}>
                <Text>{t('admin.subtotal')}</Text>
                <Text>{formatPrice(totals.subtotal)}</Text>
              </View>
              {serviceCharge > 0 && (
                <View style={styles.totalRow}>
                  <Text>{t('admin.service-charge')} ({serviceCharge}%)</Text>
                  <Text>{formatPrice(totals.serviceChargeAmount)}</Text>
                </View>
              )}
              <View style={[styles.totalRow, styles.grandTotal]}>
                <Text style={styles.totalLabel}>{t('admin.total')}</Text>
                <Text style={styles.totalLabel}>{formatPrice(totals.total)}</Text>
              </View>
            </View>
          </ScrollView>
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.btn, styles.btnPrimary]}
              onPress={async () => {
                setShowCloseBillModal(true);
                try {
                  const res = await apiClient.get(`/api/restaurants/${restaurantId}/coupons`);
                  setCoupons((res.data || []).filter((c: Coupon) => c.is_active));
                } catch (e) { setCoupons([]); }
              }}
            >
              <Text style={styles.btnText}>{t('admin.close-bill')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={() => endSession(selectedSession.id)}>
              <Text style={styles.btnText}>End Order</Text>
            </TouchableOpacity>
          </View>
          <Modal supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']} visible={showCloseBillModal} animationType="fade" transparent>
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>{t('admin.close-bill')}</Text>
                {sessionBill && (
                  <View style={{ backgroundColor: '#f8f9fa', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={{ color: '#666' }}>Subtotal</Text>
                      <Text>${((sessionBill.subtotal_cents || 0) / 100).toFixed(2)}</Text>
                    </View>
                    {(sessionBill.service_charge_cents || 0) > 0 && (
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text style={{ color: '#666' }}>Service Charge</Text>
                        <Text>${(sessionBill.service_charge_cents! / 100).toFixed(2)}</Text>
                      </View>
                    )}
                    {getDiscountCents() > 0 && (
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text style={{ color: '#e74c3c' }}>Discount</Text>
                        <Text style={{ color: '#e74c3c' }}>-${(getDiscountCents() / 100).toFixed(2)}</Text>
                      </View>
                    )}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#ddd', paddingTop: 6, marginTop: 4 }}>
                      <Text style={{ fontWeight: '700', fontSize: 16 }}>Total</Text>
                      <Text style={{ fontWeight: '700', fontSize: 16, color: '#27ae60' }}>
                        ${(((sessionBill.grand_total_cents || sessionBill.total_cents || 0) - getDiscountCents()) / 100).toFixed(2)}
                      </Text>
                    </View>
                  </View>
                )}
                <Text style={styles.label}>{t('admin.payment-method')}</Text>
                <View style={styles.selectGroup}>
                  {['cash', 'card', 'online'].map((method) => (
                    <TouchableOpacity key={method} style={[styles.selectOption, paymentMethod === method && styles.selectOptionActive]} onPress={() => setPaymentMethod(method)}>
                      <Text style={[styles.selectOptionText, paymentMethod === method && styles.selectOptionTextActive]}>{method.charAt(0).toUpperCase() + method.slice(1)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.label}>{t('admin.discount-coupon')}</Text>
                <TouchableOpacity style={[styles.input, { justifyContent: 'center' }]} onPress={() => setShowCouponPicker(!showCouponPicker)}>
                  <Text style={{ color: selectedCouponId ? '#333' : '#999' }}>
                    {selectedCouponId ? (() => { const c = coupons.find(cp => cp.id === selectedCouponId); return c ? `${c.code} - ${c.discount_type === 'percentage' ? c.discount_value + '%' : '$' + (c.discount_value / 100).toFixed(2)}` : 'No discount'; })() : 'No discount'}
                  </Text>
                </TouchableOpacity>
                {showCouponPicker && (
                  <View style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, marginTop: -8, marginBottom: 8, maxHeight: 160 }}>
                    <ScrollView nestedScrollEnabled>
                      <TouchableOpacity style={{ padding: 10, borderBottomWidth: 1, borderBottomColor: '#eee' }} onPress={() => { setSelectedCouponId(null); setShowCouponPicker(false); }}>
                        <Text style={{ color: '#666' }}>No discount</Text>
                      </TouchableOpacity>
                      {coupons.map(c => (
                        <TouchableOpacity key={c.id} style={{ padding: 10, borderBottomWidth: 1, borderBottomColor: '#eee', backgroundColor: selectedCouponId === c.id ? '#e8f4fd' : '#fff' }} onPress={() => { setSelectedCouponId(c.id); setShowCouponPicker(false); }}>
                          <Text style={{ fontWeight: '600' }}>{c.code}</Text>
                          <Text style={{ color: '#666', fontSize: 12 }}>{c.discount_type === 'percentage' ? `${c.discount_value}% off` : `$${(c.discount_value / 100).toFixed(2)} off`}{c.description ? ` — ${c.description}` : ''}</Text>
                        </TouchableOpacity>
                      ))}
                      {coupons.length === 0 && <Text style={{ padding: 10, color: '#999', fontStyle: 'italic' }}>No coupons available</Text>}
                    </ScrollView>
                  </View>
                )}
                <Text style={styles.label}>{t('admin.notes')}</Text>
                <TextInput style={[styles.input, styles.multilineInput]} multiline value={closeReason} onChangeText={setCloseReason} placeholder="Optional notes" />
                <View style={styles.modalActions}>
                  <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={() => setShowCloseBillModal(false)}>
                    <Text style={styles.btnText}>{t('common.cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={closeBill}>
                    <Text style={styles.btnText}>{t('admin.close-bill')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
          <Modal supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']} visible={showBookingStartModal} animationType="fade" transparent>
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>{t('admin.start-session') || 'Start Session'}</Text>
                {bookingToStart && (
                  <>
                    <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 4 }}>{bookingToStart.booking.guest_name}</Text>
                    <Text style={{ fontSize: 14, color: '#666', marginBottom: 4 }}>{bookingToStart.booking.pax} {t('admin.guests') || 'guests'}</Text>
                    {bookingToStart.booking.phone ? <Text style={{ fontSize: 14, color: '#666' }}>{bookingToStart.booking.phone}</Text> : null}
                  </>
                )}
                <View style={styles.modalActions}>
                  <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={() => { setShowBookingStartModal(false); setBookingToStart(null); }}>
                    <Text style={styles.btnText}>{t('common.cancel') || 'Cancel'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={confirmStartSessionFromBooking}>
                    <Text style={styles.btnText}>{t('admin.start-session') || 'Start'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
          <Modal supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']} visible={showChangePaxModal} animationType="fade" transparent>
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>{t('admin.change-pax')}</Text>
                <Text style={styles.label}>New Pax Count</Text>
                <TextInput style={styles.input} keyboardType="number-pad" inputAccessoryViewID="numpadDone" value={newPaxValue} onChangeText={setNewPaxValue} placeholder="1" />
                <View style={styles.modalActions}>
                  <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={() => setShowChangePaxModal(false)}>
                    <Text style={styles.btnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={submitChangePax}>
                    <Text style={styles.btnText}>Update</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
          <Modal supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']} visible={showMoveTableModal} animationType="fade" transparent>
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Move to Table</Text>
                <Text style={styles.label}>Select Available Table</Text>
                <ScrollView style={{ maxHeight: 200, marginBottom: 16 }}>
                  {tables.filter((t) => t.sessions.length === 0 && t.id !== selectedTable?.id).map((table) => (
                    <TouchableOpacity key={table.id} style={[styles.tableOption, selectedMoveTable === table.id && styles.tableOptionSelected]} onPress={() => setSelectedMoveTable(table.id)}>
                      <Text style={styles.tableOptionText}>{table.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <View style={styles.modalActions}>
                  <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={() => setShowMoveTableModal(false)}>
                    <Text style={styles.btnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={submitMoveTable}>
                    <Text style={styles.btnText}>Move</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
          <Modal supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']} visible={showQRModal} animationType="fade" transparent>
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Print QR Code</Text>
                {selectedTable && selectedSession && qrImageUrl ? (
                  <>
                    <ScrollView style={{ marginBottom: 16 }}>
                      <View style={styles.qrHeader}>
                        <Text style={styles.qrHeaderTable}>{selectedTable.name}</Text>
                        <Text style={styles.qrHeaderPax}>Party of {selectedSession.pax}</Text>
                      </View>
                      <View style={styles.qrImageContainer}>
                        {qrLoading ? <ActivityIndicator size="large" color="#3b82f6" /> : (
                          <Image source={{ uri: qrImageUrl }} style={styles.qrImage} resizeMode="contain" onError={() => { Alert.alert('Error', 'Failed to load QR code image'); setShowQRModal(false); }} />
                        )}
                      </View>
                      <View style={styles.qrFooter}><Text style={styles.qrFooterText}>{qrTextAbove}</Text></View>
                    </ScrollView>
                    <View style={styles.modalActions}>
                      <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={() => setShowQRModal(false)}>
                        <Text style={styles.btnText}>Close</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={() => Alert.alert('QR Code Ready', 'The QR code is displayed above. Users can scan it to place orders.', [{ text: 'OK', onPress: () => setShowQRModal(false) }])}>
                        <Text style={styles.btnText}>Done</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 40 }}>
                    <ActivityIndicator size="large" color="#3b82f6" />
                  </View>
                )}
              </View>
            </View>
          </Modal>
        </View>
      )}

      {/* Category Modal */}
      <Modal supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']} visible={showCategoryModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>New Category</Text>

            <Text style={styles.label}>Category Name</Text>
            <TextInput
              style={styles.input}
              value={categoryName}
              onChangeText={setCategoryName}
              placeholder="e.g., Main Floor"
              autoFocus
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.btn, styles.btnSecondary]}
                onPress={() => setShowCategoryModal(false)}
              >
                <Text style={styles.btnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.btnPrimary]}
                onPress={createCategory}
              >
                <Text style={styles.btnText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Category Modal */}
      <Modal supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']} visible={editingCategoryId !== null} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('admin.edit-category')}</Text>

            <Text style={styles.label}>Category Name</Text>
            <TextInput
              style={styles.input}
              value={editingCategoryName}
              onChangeText={setEditingCategoryName}
              placeholder="e.g., Main Floor"
              autoFocus
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.btn, styles.btnSecondary]}
                onPress={() => {
                  setEditingCategoryId(null);
                  setEditingCategoryName('');
                }}
              >
                <Text style={styles.btnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.btnPrimary]}
                onPress={() => editingCategoryId && editCategory(editingCategoryId)}
              >
                <Text style={styles.btnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Table Modal */}
      <Modal supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']} visible={showTableModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>New Table</Text>

            <Text style={styles.label}>Table Name</Text>
            <TextInput
              style={styles.input}
              value={tableName}
              onChangeText={setTableName}
              placeholder="e.g., T01"
            />

            <Text style={styles.label}>Seat Count</Text>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              inputAccessoryViewID="numpadDone"
              value={tableSeats}
              onChangeText={setTableSeats}
              placeholder="4"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.btn, styles.btnSecondary]}
                onPress={() => setShowTableModal(false)}
              >
                <Text style={styles.btnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.btnPrimary]}
                onPress={createTable}
              >
                <Text style={styles.btnText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Table Modal */}
      <Modal supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']} visible={editingTableId !== null} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('admin.edit-table')}</Text>

            <Text style={styles.label}>Table Name</Text>
            <TextInput
              style={styles.input}
              value={editingTableName}
              onChangeText={setEditingTableName}
              placeholder="e.g., T01"
              autoFocus
            />

            <Text style={styles.label}>Seat Count</Text>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              inputAccessoryViewID="numpadDone"
              value={editingTableSeats}
              onChangeText={setEditingTableSeats}
              placeholder="4"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.btn, styles.btnSecondary]}
                onPress={() => {
                  setEditingTableId(null);
                  setEditingTableName('');
                  setEditingTableSeats('');
                }}
              >
                <Text style={styles.btnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.btnPrimary]}
                onPress={updateTable}
              >
                <Text style={styles.btnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Table Pax Modal */}
      <Modal supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']} visible={editingTablePaxId !== null} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Table Capacity</Text>

            <Text style={styles.label}>Seat Count</Text>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              inputAccessoryViewID="numpadDone"
              value={editingPaxValue}
              onChangeText={setEditingPaxValue}
              placeholder="1"
              autoFocus
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.btn, styles.btnSecondary]}
                onPress={() => {
                  setEditingTablePaxId(null);
                  setEditingPaxValue('');
                }}
              >
                <Text style={styles.btnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.btnPrimary]}
                onPress={() => {
                  if (editingTablePaxId) {
                    updateTablePax(editingTablePaxId);
                  }
                }}
              >
                <Text style={styles.btnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Printer Selection Modal */}
      <PrinterSelectionModal
        visible={showPrinterModal}
        onClose={() => {
          setShowPrinterModal(false);
          setCurrentPrintJob(null);
        }}
        onSelectPrinter={setSelectedPrinterForJob}
        onPrint={async (printer: SelectedPrinter) => {
          try {
            // Only bill printing uses the printer modal
            // QR code printing uses the simple QR display modal
            if (currentPrintJob === 'bill') {
              await handleBillPrint(printer);
            }
          } catch (err: any) {
            console.error('[PrinterSelection] Error:', err);
            throw err;
          }
        }}
        jobName={
          currentPrintJob === 'qr'
            ? 'Session QR Code'
            : currentPrintJob === 'bill'
            ? 'Bill'
            : currentPrintJob === 'kitchen'
            ? 'Kitchen Order'
            : 'Document'
        }
      />

      {/* Split Bill Modal */}
      <Modal supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']} visible={showSplitModal} transparent animationType="fade" onRequestClose={() => setShowSplitModal(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#1f2937', marginBottom: 16 }}>
              Split Bill
            </Text>

            {splitBillData && (
              <>
                <Text style={{ fontSize: 14, color: '#6b7280', marginBottom: 4 }}>
                  Total: ${((splitBillData.total_cents || splitBillData.grand_total_cents || 0) / 100).toFixed(2)}
                </Text>
                <Text style={{ fontSize: 14, color: '#6b7280', marginBottom: 16 }}>
                  Service Charge: ${((splitBillData.service_charge_cents || 0) / 100).toFixed(2)}
                </Text>

                <Text style={{ fontSize: 13, color: '#374151', fontWeight: '600', marginBottom: 8 }}>
                  Split between:
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <TouchableOpacity
                    style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#e5e7eb', justifyContent: 'center', alignItems: 'center' }}
                    onPress={() => setSplitCount(Math.max(2, splitCount - 1))}
                  >
                    <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#374151' }}>−</Text>
                  </TouchableOpacity>
                  <Text style={{ fontSize: 28, fontWeight: 'bold', color: '#1f2937', width: 50, textAlign: 'center' }}>
                    {splitCount}
                  </Text>
                  <TouchableOpacity
                    style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#e5e7eb', justifyContent: 'center', alignItems: 'center' }}
                    onPress={() => setSplitCount(Math.min(20, splitCount + 1))}
                  >
                    <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#374151' }}>+</Text>
                  </TouchableOpacity>
                  <Text style={{ fontSize: 14, color: '#6b7280' }}>people</Text>
                </View>

                <View style={{
                  backgroundColor: '#f0fdf4',
                  borderRadius: 8,
                  padding: 16,
                  alignItems: 'center',
                  marginBottom: 16,
                  borderWidth: 1,
                  borderColor: '#bbf7d0',
                }}>
                  <Text style={{ fontSize: 14, color: '#6b7280' }}>Each person pays</Text>
                  <Text style={{ fontSize: 28, fontWeight: 'bold', color: '#059669' }}>
                    ${(((splitBillData.total_cents || splitBillData.grand_total_cents || 0) / splitCount) / 100).toFixed(2)}
                  </Text>
                </View>
              </>
            )}

            <TouchableOpacity
              style={{ paddingVertical: 12, alignItems: 'center', backgroundColor: '#e5e7eb', borderRadius: 8 }}
              onPress={() => setShowSplitModal(false)}
            >
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151' }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Done button for iOS number-pad */}
      {Platform.OS === 'ios' && (
        <InputAccessoryView nativeID="numpadDone">
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', backgroundColor: '#f1f1f1', borderTopWidth: 1, borderTopColor: '#ccc', paddingHorizontal: 12, paddingVertical: 6 }}>
            <TouchableOpacity onPress={() => Keyboard.dismiss()} style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#007AFF' }}>Done</Text>
            </TouchableOpacity>
          </View>
        </InputAccessoryView>
      )}

    </View>
  );
});

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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    fontSize: 16,
    color: '#3b82f6',
    fontWeight: '600',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    flex: 1,
    textAlign: 'center',
  },
  editBtnText: {
    color: '#3b82f6',
    fontWeight: '600',
    fontSize: 14,
  },
  editBtnDone: {
    color: '#10b981',
    fontWeight: '600',
    fontSize: 14,
  },
  gearIcon: {
    fontSize: 20,
    color: '#3b82f6',
  },
  gearMenuContainer: {
    position: 'absolute',
    top: 55,
    right: 16,
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 8,
    zIndex: 1000,
    minWidth: 180,
  },
  menuOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
  },
  gearMenuItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  gearMenuItemDelete: {
    borderBottomWidth: 0,
  },
  gearMenuItemText: {
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '500',
  },
  gearMenuItemTextDelete: {
    color: '#dc2626',
  },
  tableOption: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  tableOptionSelected: {
    backgroundColor: '#3b82f6',
  },
  tableOptionText: {
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '500',
  },
  categoryBarWrapper: {
    flex: 0,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tableSectionContainer: {
    marginBottom: 8,
  },
  tableSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  tableSectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
  },
  sessionSidePanel: {
    width: 380,
    backgroundColor: '#fff',
    borderLeftWidth: 1,
    borderLeftColor: '#e5e7eb',
    flexDirection: 'column',
  },
  sessionSidePanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f9fafb',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    gap: 10,
  },
  sessionSidePanelTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    flex: 1,
  },
  tablesGridWrapper: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  categoryScroll: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    height: 48,
    flexShrink: 0,
  },
  categoryContent: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  categoryBtn: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    marginHorizontal: 4,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  categoryBtnActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  categoryBtnSelected: {
    borderWidth: 2,
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff',
  },
  categoryBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  categoryBtnTextActive: {
    color: '#ffffff',
  },
  categoryBtnAdd: {
    backgroundColor: '#dbeafe',
    borderColor: '#93c5fd',
    borderStyle: 'dashed',
  },
  categoryBtnAddText: {
    color: '#3b82f6',
  },
  categoryActionButtons: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingRight: 4,
  },
  categoryActionBtn: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryActionBtnDelete: {
    backgroundColor: '#ef4444',
  },
  listContent: {
    padding: 12,
  },
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  tableCardWrapper: {
    flex: 1,
    marginRight: 8,
    position: 'relative',
  },
  tableCard: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 12,
    borderWidth: 2,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  tableAddCard: {
    backgroundColor: 'rgba(74, 144, 226, 0.08)',
    borderStyle: 'dashed',
    borderColor: '#4a90e2',
  },
  tableAddIcon: {
    fontSize: 28,
    fontWeight: '900',
    color: '#4a90e2',
  },
  tableAddLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4a90e2',
    marginTop: 4,
    textAlign: 'center',
  },
  tableCardSelected: {
    borderWidth: 3,
    borderColor: '#3b82f6',
    shadowColor: '#3b82f6',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  tableCardSessionsBadge: {
    position: 'absolute',
    top: 7,
    left: 8,
    fontSize: 18,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  tableCardSeats: {
    position: 'absolute',
    top: 7,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  tableCardSeatsText: {
    fontSize: 13,
    fontWeight: '600',
  },
  tableCardBottomInfo: {
    position: 'absolute',
    bottom: 6,
    left: 0,
    right: 0,
    alignItems: 'center',
    maxHeight: 60,
    overflow: 'hidden',
  },
  tableCardSessionsList: {
    alignItems: 'center',
    width: '100%',
  },
  sessionTimeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginVertical: 1,
  },
  sessionTimeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  sessionBadgeStaff: {
    backgroundColor: '#fbbf24',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
  sessionBadgeStaffText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#000',
  },
  sessionBadgeBill: {
    backgroundColor: '#f97316',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
  sessionBadgeBillText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#fff',
  },
  tableCardStatusBadge: {
    backgroundColor: '#fbbf24',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tableCardStatusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#333',
  },
  tableCardAvailableText: {
    fontSize: 11,
    fontWeight: '600',
    opacity: 0.85,
  },
  tableEditIconsContainer: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    gap: 4,
  },
  tableActionButtonsContainer: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    right: 6,
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'center',
  },
  tableEditIcon: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 16,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  tableActionBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: 'center',
    backgroundColor: '#3b82f6',
  },
  tableActionBtnDelete: {
    backgroundColor: '#ef4444',
  },
  tableDeleteIcon: {
    backgroundColor: 'rgba(255, 100, 100, 0.9)',
  },
  tableEditIconText: {
    fontSize: 16,
  },
  tableActionBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  categoryActionBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  tableCardContent: {
    alignItems: 'center',
  },
  tableCardName: {
    fontSize: 32,
    fontWeight: '900',
    textAlign: 'center',
    paddingHorizontal: 6,
    lineHeight: 36,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
    color: '#1f2937',
  },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 6,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
  },
  orderTitle: {
    fontWeight: '600',
    marginBottom: 8,
    color: '#1f2937',
  },
  orderItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  itemName: {
    fontWeight: '500',
    color: '#1f2937',
    fontSize: 13,
  },
  itemStatus: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
  },
  itemPrice: {
    fontWeight: '600',
    color: '#1f2937',
    fontSize: 13,
  },
  totalsSection: {
    backgroundColor: '#f9fafb',
    borderRadius: 6,
    padding: 12,
    marginTop: 16,
    marginBottom: 16,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  grandTotal: {
    borderBottomWidth: 0,
    marginTop: 8,
    paddingTop: 12,
    backgroundColor: '#374151',
    borderRadius: 4,
    paddingHorizontal: 8,
  },
  totalLabel: {
    fontWeight: '700',
    color: '#fff',
    fontSize: 14,
  },
  sessionCard: {
    backgroundColor: '#fff',
    borderRadius: 6,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
  },
  sessionTitle: {
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  sessionInfo: {
    fontSize: 12,
    color: '#6b7280',
  },
  chevron: {
    fontSize: 20,
    color: '#d1d5db',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  btn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  btnPrimary: {
    backgroundColor: '#3b82f6',
  },
  btnSecondary: {
    backgroundColor: '#e5e7eb',
  },
  btnText: {
    fontWeight: '600',
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    maxHeight: Dimensions.get('window').height * 0.8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#1f2937',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    color: '#374151',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
    fontSize: 14,
  },
  multilineInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  selectGroup: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  selectOption: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#d1d5db',
    alignItems: 'center',
  },
  selectOptionActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  selectOptionText: {
    fontWeight: '600',
    color: '#6b7280',
    fontSize: 12,
  },
  selectOptionTextActive: {
    color: '#fff',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
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

  // QR Modal styling
  bottomSheetModal: {
    justifyContent: 'flex-end',
    margin: 0,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  qrModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '90%',
    paddingTop: 0,
  },
  qrModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  qrModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  qrModalCloseButton: {
    fontSize: 24,
    color: '#666',
    fontWeight: '600',
  },
  qrModalBody: {
    padding: 16,
  },
  qrModalBodyContent: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  qrHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  qrHeaderTable: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  qrHeaderPax: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  qrImageContainer: {
    width: 250,
    height: 250,
    alignSelf: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 12,
  },
  qrImage: {
    width: '90%',
    height: '90%',
  },
  qrFooter: {
    marginTop: 12,
    alignItems: 'center',
  },
  qrFooterText: {
    fontSize: 14,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  qrErrorText: {
    fontSize: 14,
    color: '#dc2626',
    textAlign: 'center',
  },
  qrModalActions: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  editModeControls: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
});
