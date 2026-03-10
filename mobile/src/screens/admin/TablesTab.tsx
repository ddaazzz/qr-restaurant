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
} from 'react-native';
import * as Print from 'expo-print';
import RNModal from 'react-native-modal';
import { apiClient } from '../../services/apiClient';
import { thermalPrinterService } from '../../services/thermalPrinterService';
import { useLanguage } from '../../contexts/LanguageContext';

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
}

interface Table {
  id: number;
  name: string;
  seat_count: number;
  category_id: number;
  sessions: Session[];
  reserved?: boolean;
  booking_time?: string;
  units: Array<{ id: number; qr_token: string }>;
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
  booking_time?: string;
}

interface Bill {
  total_cents: number;
  subtotal_cents: number;
  service_charge_cents?: number;
  items: Array<{ name: string; price_cents: number; quantity: number; status: string }>;
}

interface Order {
  order_id?: number;
  id?: number;
  items: Array<{
    name?: string;
    item_name?: string;
    menu_item_name?: string;
    quantity: number;
    unit_price_cents?: number;
    price_cents?: number;
    status: string;
    variants?: string;
  }>;
}

type ViewType = 'grid' | 'sessionDetail' | 'sessionList';

export interface TablesTabRef {
  toggleEditMode: () => void;
  navigateToScannedQR: (token: string) => void;
}

const getTableTextColor = (bgColor: string) => {
  if (bgColor === '#f3f4f6' || bgColor === '#ffeb3b') {
    return { color: '#000' };
  }
  return { color: '#fff' };
};

export const TablesTab = forwardRef<TablesTabRef, { restaurantId: string }>(({ restaurantId }, ref) => {
  const { t } = useLanguage();
  const [categories, setCategories] = useState<TableCategory[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

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
  const [showSessionGearMenu, setShowSessionGearMenu] = useState(false);
  const [showChangePaxModal, setShowChangePaxModal] = useState(false);
  const [showMoveTableModal, setShowMoveTableModal] = useState(false);
  const [newPaxValue, setNewPaxValue] = useState('');
  const [selectedMoveTable, setSelectedMoveTable] = useState<number | null>(null);

  // Edit mode state
  const [isEditMode, setIsEditMode] = useState(false);
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
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [bookingPax, setBookingPax] = useState('2');
  const [bookingTime, setBookingTime] = useState('18:00');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [discountAmount, setDiscountAmount] = useState('0');
  const [closeReason, setCloseReason] = useState('');

  // Service charge
  const [serviceCharge, setServiceCharge] = useState(0);

  // Expose toggleEditMode and navigateToScannedQR through ref
  useImperativeHandle(ref, () => ({
    toggleEditMode() {
      setIsEditMode(prev => !prev);
    },
    navigateToScannedQR(token: string) {
      console.log('[TablesTab] Navigating to scanned QR token:', token);
      
      // Find the table and session with this QR token
      for (const table of tables) {
        const matchingUnit = table.units?.find(unit => unit.qr_token === token);
        if (matchingUnit && table.sessions && table.sessions.length > 0) {
          // Found the table with this token
          setSelectedTable(table);
          setSelectedSession(table.sessions[0]); // Select the first/active session
          setCurrentView('sessionDetail');
          console.log('[TablesTab] Navigated to session:', table.sessions[0]);
          return;
        }
      }
      
      console.warn('[TablesTab] No table found for QR token:', token);
      Alert.alert('Table Not Found', 'Could not find this table. Please try again.');
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
          });
        }
      });

      const tableArray = Object.values(tableMap);
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
      } catch (e) {
        console.log('Could not load service charge settings');
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
      console.log('[QR Debug] QR Modal opened, session:', selectedSession);
      console.log('[QR Debug] selectedTable:', selectedTable);
      console.log('[QR Debug] selectedTable.units:', selectedTable?.units);
      
      // Get QR token from selectedTable.units
      const qrToken = selectedTable?.units?.[0]?.qr_token;
      console.log('[QR Debug] QR Token from table units:', qrToken);
      
      if (!qrToken) {
        console.log('[QR Debug] No QR token found in table units, units:', selectedTable?.units);
        setQrLoading(false);
        return;
      }

      setQrLoading(true);
      // Generate QR code using QR server API
      const qrDataUrl = `https://chuio.io/${qrToken}`;
      console.log('[QR Debug] QR Data URL to encode:', qrDataUrl);
      
      // Use qr-server.com API to generate QR code
      const qrServerUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrDataUrl)}`;
      console.log('[QR Debug] QR Server URL:', qrServerUrl);
      
      setQrImageUrl(qrServerUrl);
      setQrLoading(false);
    } else if (!showQRModal) {
      console.log('[QR Debug] QR Modal closed, clearing QR');
      setQrImageUrl(null);
    }
  }, [showQRModal, selectedSession, selectedTable]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTableData();
  };

  const filteredTables = selectedCategory
    ? tables.filter((t) => t.category_id === selectedCategory)
    : [];

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

  const getTableCardColor = (table: Table) => {
    if (table.sessions.length === 0 && !table.reserved) return '#f3f4f6';
    if (table.sessions.length > 1) return '#2C3E50';
    if (table.sessions.length === 1) {
      const session = table.sessions[0];
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
    if (table.reserved) return '#f3f4f6';
    return '#f3f4f6';
  };

  const handleTableClick = (table: Table) => {
    setSelectedTable(table);
    if (table.sessions.length > 0) {
      setCurrentView('sessionList');
    } else {
      setCurrentView('sessionDetail');
    }
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
      Alert.alert('Error Loading Orders', 'Failed to load orders for this session');
    }
  };

  const handleSessionClick = async (session: Session) => {
    setSelectedSession(session);
    setCurrentView('sessionDetail');
    await loadSessionOrders(session.id);
  };

  const createCategory = async () => {
    if (!categoryName.trim()) {
        Alert.alert(t('error.error'), t('tables.add-table'));
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
        Alert.alert(t('error.error'), t('tables.add-table'));
        return;
      }
      if (!tableSeats || parseInt(tableSeats) <= 0) {
        Alert.alert(t('error.error'), 'Valid seat count required');
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
        Alert.alert(t('error.error'), t('tables.edit-table'));
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
      t('tables.delete-table'),
      `Are you sure you want to delete "${categoryName}"?`,
      [
        { text: t('button.cancel'), onPress: () => {}, style: 'cancel' },
        {
          text: t('button.delete') () => {
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
        Alert.alert(t('error.error'), t('tables.edit-table'));
        return;
      }
      if (!editingTableSeats || parseInt(editingTableSeats) <= 0) {
        Alert.alert(t('error.error'), 'Valid seat count required');

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
      t('tables.delete-table'),
      `Are you sure you want to delete table "${tableName}"?`,
      [
        { text: t('button.cancel'), onPress: () => {}, style: 'cancel' },
        {
          text: t('button.delete') () => {
            try {
              await apiClient.delete(`/tables/${tableId}`, {
                data: { restaurantId: parseInt(restaurantId) },
              });
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
        Alert.alert(t('error.error'), 'Valid seat count required');

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

  const startSession = async () => {
    if (!selectedTable || !sessionPax || parseInt(sessionPax) <= 0) {
      Alert.alert('Error', 'Valid pax count required');
        Alert.alert(t('error.error'), 'Valid pax count required');

    try {
      await apiClient.post(
        `/api/tables/${selectedTable.id}/sessions`,
        { pax: parseInt(sessionPax) }
      );
      setSessionPax('1');
      setShowSessionModal(false);
      await loadTableData();
      setSelectedTable(null);
      setCurrentView('grid');
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to start session');
    }
  };

  const bookTable = async () => {
    if (!guestName.trim() || !guestPhone.trim() || !guestEmail.trim()) {
      Alert.alert('Error', 'All guest details required');
      return;
        Alert.alert(t('error.error'), 'All guest details required');
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
t('error.error')
  const closeBill = async () => {
    if (!selectedSession) return;

    try {
      await apiClient.post(
        `/api/sessions/${selectedSession.id}/close-bill`,
        {
          payment_method: paymentMethod,
          amount_paid: (sessionBill?.total_cents || 0) - parseInt(discountAmount || '0'),
          discount_applied: parseInt(discountAmount || '0'),
          notes: closeReason,
        }
      );

      // Check if auto-print is enabled and if so, print the bill
      try {
        const printerRes = await apiClient.get(
          `/api/restaurants/${restaurantId}/printer-settings`
        );

        if (printerRes.data && printerRes.data.bill_auto_print === true) {
          console.log('[CloseBill] Auto-print enabled, printing bill...');
          // Call printBill with autoPrint flag to avoid showing success alert
          await printBill(true);
        }
      } catch (autoError) {
        console.log('[CloseBill] Auto-print check failed (non-critical):', autoError);
        // Don't fail the close operation if auto-print fails
      }

      setShowCloseBillModal(false);
      setPaymentMethod('cash');
      setDiscountAmount('0');
      setCloseReason('');
      await loadTableData();
      setCurrentView('grid');
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to close bill');
    }
  };

  const endSession = async (sessionId: number) => {
    Alert.alert('End Session', 'Are you sure you want to end this session?', [
      { text: 'Cancel' },
      {t('tables.end-session'), 'Are you sure you want to end this session?', [
      { text: t('button.cancel') },
      {
        text: t('button.submit')
            await apiClient.post(
              `/api/table-sessions/${sessionId}/end`,
              {}
            );
            await loadTableData();
            setCurrentView('grid');
          } catch (err: any) {
            Alert.alert('Error', err.response?.data?.error || 'Failed to end session');
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
    }t('error.error')
    setShowMoveTableModal(true);
    setShowSessionGearMenu(false);
  };

  const submitMoveTable = async () => {
    if (!selectedTable || !selectedSession || !selectedMoveTable) {
      Alert.alert('Error', 'No table selected');
      return;t('error.error')
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
    // This would open the order screen for the table
    // For now, just show an alert
    Alert.alert('Order for Table', `Open order screen for ${selectedTable.name}`);
    setShowSessionGearMenu(false);
  };

  const printQR = () => {
    console.log('[PrintQR] Button clicked');
    console.log('[PrintQR] selectedSession:', selectedSession);
    console.log('[PrintQR] selectedTable:', selectedTable);
    if (!selectedSession) {
      console.log('[PrintQR] No session selected, returning');
      return;
    }
    console.log('[PrintQR] Opening QR modal');
    setShowQRModal(true);
    setShowSessionGearMenu(false);
  };

  const printBill = async (autoPrint: boolean = false) => {
    console.log('[PrintBill] Starting printBill, autoPrint=', autoPrint);
    console.log('[PrintBill] selectedSession:', selectedSession);
    console.log('[PrintBill] sessionBill:', sessionBill);
    
    if (!selectedSession || !sessionBill) {
      console.log('[PrintBill] Missing session or bill data, returning');
      if (!autoPrint) {
        Alert.alert('❌ Error', 'No bill data available. Please open a table session first.');
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
            '🖨️ No Printer Configured',
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
      const billPayload = {
        sessionId: selectedSession.id,
        billData: {
          table: selectedTable?.name || 'Receipt',
          items: sessionBill.items.map(item => ({
            name: item.name,
            quantity: item.quantity,
            price_cents: item.price_cents,
            status: item.status,
          })),
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
              Alert.alert('✓ Print Dialog Opened', `Bill for ${selectedTable?.name} ready to print`);
            }
          } catch (printErr: any) {
            console.error('[PrintBill] Print dialog error:', printErr);
            if (!autoPrint) {
              Alert.alert('❌ Print Error', 'Failed to open print dialog: ' + printErr.message);
            }
          }
        } 
        // Handle Bluetooth printing
        else if (printRes.data.bluetoothDevice) {
          console.log('[PrintBill] Initiating Bluetooth printing to:', printRes.data.bluetoothDevice);
          console.log('[PrintBill] Receipt HTML length:', printRes.data.html?.length || 0);
          
          if (!autoPrint) {
            Alert.alert('⏳ Printing...', 'Sending receipt to Bluetooth printer...');
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
              orderNumber: String(selectedSession?.id),
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
              Alert.alert('✓ Printed', `Bill sent to printer "${device.name}"`);
            }
          } catch (bluetoothErr: any) {
            console.error('[PrintBill] Bluetooth printing error:', bluetoothErr);
            if (!autoPrint) {
              Alert.alert(
                '⚠️ Print Issue',
                `Could not connect to printer. Make sure it's powered on and nearby.\n\nError: ${bluetoothErr.message}`
              );
            }
          }
        } 
        else {
          // Printer type is thermal/network - sent to printer queue
          if (!autoPrint) {
            Alert.alert(
              '✓ Print Sent',
              `Bill for ${selectedTable?.name} sent to printer successfully`
            );
          }
        }
        setShowSessionGearMenu(false);
      } else {
        Alert.alert(
          '❌ Printer Error',
          printRes.data?.error || 'Failed to send to printer'
        );
      }
    } catch (err: any) {
      console.log('[PrintBill] Error caught:', err);
      console.log('[PrintBill] Error message:', err.message);
      console.log('[PrintBill] Error response:', err.response?.data);
      
      if (!autoPrint) {
        Alert.alert(
          '❌ Error',
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
        Alert.alert('🖨️ No Printer', 'Please configure a Bluetooth printer first');
        return;
      }

      if (printerRes.data.printer_type !== 'bluetooth') {
        Alert.alert('ℹ️ Not Bluetooth', 'Test print only works with Bluetooth printers');
        return;
      }

      const device = { 
        id: printerRes.data.bluetooth_device_id, 
        name: printerRes.data.bluetooth_device_name 
      };

      if (!device.id) {
        Alert.alert('❌ No Device', 'Bluetooth device not configured');
        return;
      }

      Alert.alert('⏳ Test Print', 'Sending minimal test sequence to printer...');

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
      
      Alert.alert('✓ Test Sent', 'Check printer - it should print "TEST" if working');
      setShowSessionGearMenu(false);
    } catch (err: any) {
      console.error('[TestPrint] Error:', err);
      Alert.alert('❌ Test Failed', err.message || 'Could not send test print');
    }
  };

  const splitBill = () => {
    if (!selectedSession) return;
    Alert.alert('Split Bill', 'Split bill functionality - Coming soon');
    setShowSessionGearMenu(false);
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

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  if (currentView === 'sessionDetail' && selectedSession && selectedTable) {
    const totals = calculateTotal();

    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setCurrentView('grid')}>
            <Text style={styles.backButton}>← {t('modal.back')}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>
            {selectedTable.name} • {selectedSession.pax} {t('tables.pax')}
          </Text>
          <View style={{ position: 'relative' }}>
            <TouchableOpacity onPress={() => setShowSessionGearMenu(!showSessionGearMenu)}>
              <Text style={styles.gearIcon}>⚙️</Text>
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
                <Text style={styles.gearMenuItemText}>👥 {t('tables.change-pax')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.gearMenuItem}
                onPress={moveTable}
              >
                <Text style={styles.gearMenuItemText}>↔️ {t('tables.move-table')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.gearMenuItem}
                onPress={orderForTable}
              >
                <Text style={styles.gearMenuItemText}>📱 Order for Table</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.gearMenuItem}
                onPress={printQR}
              >
                <Text style={styles.gearMenuItemText}>📋 {t('tables.print-qr')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.gearMenuItem}
                onPress={() => printBill(false)}
              >
                <Text style={styles.gearMenuItemText}>🖨️ {t('tables.print-bill')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.gearMenuItem, { backgroundColor: '#f97316' }]}
                onPress={testPrintBill}
              >
                <Text style={styles.gearMenuItemText}>🧪 Test Print</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.gearMenuItem}
                onPress={splitBill}
              >
                <Text style={styles.gearMenuItemText}>💵 Split Bill</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.gearMenuItem, styles.gearMenuItemDelete]}
                onPress={() => {
                  endSession(selectedSession.id);
                  setShowSessionGearMenu(false);
                }}
              >
                <Text style={[styles.gearMenuItemText, styles.gearMenuItemTextDelete]}>🗑️ {t('tables.end-session')}</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        <ScrollView style={styles.content}>
          <Text style={styles.sectionTitle}>{t('orders.order-details')}</Text>
          {sessionOrders.length === 0 ? (
            <Text style={styles.emptyText}>{t('orders.empty-cart')}</Text>
          ) : (
            sessionOrders.map((order, idx) => {
              console.log(`[OrderRender] Order ${idx}:`, order);
              return (
                <View key={idx} style={styles.orderCard}>
                  <Text style={styles.orderTitle}>Order #{order.order_id || order.id}</Text>
                  {order.items && order.items.length > 0 ? (
                    order.items.map((item, itemIdx) => (
                      <View key={itemIdx} style={styles.orderItem}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.itemName}>
                            {item.name || item.item_name || item.menu_item_name || 'Unknown Item'} x{item.quantity}
                          </Text>
                          <Text style={styles.itemStatus}>{item.status || 'pending'}</Text>
                          {item.variants && item.variants !== '' && <Text style={styles.itemStatus}>{item.variants}</Text>}
                        </View>
                        <Text style={styles.itemPrice}>
                          {formatPrice((item.unit_price_cents || item.price_cents || 0) * item.quantity)}
                        </Text>
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
              <Text>Subtotal</Text>
              <Text>{formatPrice(totals.subtotal)}</Text>
            </View>
            {serviceCharge > 0 && (
              <View style={styles.totalRow}>
                <Text>Service Charge ({serviceCharge}%)</Text>
                <Text>{formatPrice(totals.serviceChargeAmount)}</Text>
              </View>
            )}
            <View style={[styles.totalRow, styles.grandTotal]}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalLabel}>{formatPrice(totals.total)}</Text>
            </View>
          </View>
        </ScrollView>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.btn, styles.btnPrimary]}
            onPress={() => setShowCloseBillModal(true)}
          >
            <Text style={styles.btnText}>{t('tables.close-bill')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, styles.btnSecondary]}
            onPress={() => endSession(selectedSession.id)}
          >
            <Text style={styles.btnText}>{t('tables.end-session')}</Text>
          </TouchableOpacity>
        </View>

        {/* Close Bill Modal */}
        <Modal visible={showCloseBillModal} animationType="fade" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{t('tables.close-bill')}</Text>

              <Text style={styles.label}>Payment Method</Text>
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

              <Text style={styles.label}>Discount (cents)</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={discountAmount}
                onChangeText={setDiscountAmount}
                placeholder="0"
              />

              <Text style={styles.label}>Reason</Text>
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
                  <Text style={styles.btnText}>{t('button.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, styles.btnPrimary]}
                  onPress={closeBill}
                >
                  <Text style={styles.btnText}>{t('tables.close-bill')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Change Pax Modal */}
        <Modal visible={showChangePaxModal} animationType="fade" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{t('tables.change-pax')}</Text>

              <Text style={styles.label}>{t('tables.change-pax')}</Text>
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                value={newPaxValue}
                onChangeText={setNewPaxValue}
                placeholder="1"
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.btn, styles.btnSecondary]}
                  onPress={() => setShowChangePaxModal(false)}
                >
                  <Text style={styles.btnText}>{t('button.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, styles.btnPrimary]}
                  onPress={submitChangePax}
                >
                  <Text style={styles.btnText}>{t('button.submit')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Move Table Modal */}
        <Modal visible={showMoveTableModal} animationType="fade" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{t('tables.move-table')}</Text>

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
                  <Text style={styles.btnText}>{t('button.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, styles.btnPrimary]}
                  onPress={submitMoveTable}
                >
                  <Text style={styles.btnText}>{t('tables.move-table')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Print QR Code Modal */}
        <Modal visible={showQRModal} animationType="fade" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{t('tables.print-qr')}</Text>
              
              {selectedTable && selectedSession && qrImageUrl ? (
                <>
                  <ScrollView style={{ marginBottom: 16 }}>
                    <View style={styles.qrHeader}>
                      <Text style={styles.qrHeaderTable}>{selectedTable.name}</Text>
                      <Text style={styles.qrHeaderPax}>{t('tables.pax')} of {selectedSession.pax}</Text>
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
                      <Text style={styles.qrFooterText}>Scan to order</Text>
                    </View>
                  </ScrollView>

                  <View style={styles.modalActions}>
                    <TouchableOpacity
                      style={[styles.btn, styles.btnSecondary]}
                      onPress={() => setShowQRModal(false)}
                    >
                      <Text style={styles.btnText}>{t('button.close')}</Text>
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
                      <Text style={styles.btnText}>✓ Done</Text>
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

  if (currentView === 'sessionList' && selectedTable) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setCurrentView('grid')}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{selectedTable.name}</Text>
        </View>

        <ScrollView style={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
          <Text style={styles.sectionTitle}>Active Sessions</Text>
          {selectedTable.sessions.length === 0 ? (
            <Text style={styles.emptyText}>No active sessions</Text>
          ) : (
            selectedTable.sessions.map((session, idx) => (
              <TouchableOpacity
                key={session.id}
                style={styles.sessionCard}
                onPress={() => handleSessionClick(session)}
              >
                <View>
                  <Text style={styles.sessionTitle}>
                    {selectedTable.name}
                    {String.fromCharCode(65 + idx)}
                  </Text>
                  <Text style={styles.sessionInfo}>
                    {session.pax} {t('tables.pax')} • Dining {formatDuration(session.started_at)}
                  </Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
            ))
          )}

          {selectedTable.sessions.length < selectedTable.seat_count && (
            <>
              <Text style={styles.sectionTitle}>{t('tables.start-session')}</Text>
              <TouchableOpacity
                style={[styles.btn, styles.btnPrimary]}
                onPress={() => setShowSessionModal(true)}
              >
                <Text style={styles.btnText}>{t('tables.start-session')}</Text>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity
            style={[styles.btn, styles.btnSecondary]}
            onPress={() => {
              setShowBookingModal(true);
            }}
          >
            <Text style={styles.btnText}>{t('tables.book-table')}</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Session Modal */}
        <Modal visible={showSessionModal} animationType="fade" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{t('tables.start-session')}</Text>

              <Text style={styles.label}>Number of Guests</Text>
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                value={sessionPax}
                onChangeText={setSessionPax}
                placeholder="1"
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.btn, styles.btnSecondary]}
                  onPress={() => setShowSessionModal(false)}
                >
                  <Text style={styles.btnText}>{t('button.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, styles.btnPrimary]}
                  onPress={startSession}
                >
                  <Text style={styles.btnText}>{t('tables.start-session')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Booking Modal */}
        <Modal visible={showBookingModal} animationType="fade" transparent>
          <View style={styles.modalOverlay}>
            <ScrollView contentContainerStyle={styles.modalContent}>
              <Text style={styles.modalTitle}>{t('tables.book-table')}</Text>

              <Text style={styles.label}>Guest Name</Text>
              <TextInput
                style={styles.input}
                value={guestName}
                onChangeText={setGuestName}
                placeholder="John Smith"
              />

              <Text style={styles.label}>Phone</Text>
              <TextInput
                style={styles.input}
                value={guestPhone}
                onChangeText={setGuestPhone}
                placeholder="+1 (555) 123-4567"
                keyboardType="phone-pad"
              />

              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={guestEmail}
                onChangeText={setGuestEmail}
                placeholder="john@example.com"
                keyboardType="email-address"
              />

              <Text style={styles.label}>Guests</Text>
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                value={bookingPax}
                onChangeText={setBookingPax}
                placeholder="2"
              />

              <Text style={styles.label}>Reservation Time</Text>
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
                  <Text style={styles.btnText}>{t('button.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, styles.btnPrimary]}
                  onPress={bookTable}
                >
                  <Text style={styles.btnText}>{t('tables.book-table')}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </Modal>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Category Bar Wrapper - Separate Context */}
      <View style={styles.categoryBarWrapper}>
        <ScrollView
          horizontal
          scrollEnabled={true}
          showsHorizontalScrollIndicator={false}
          style={styles.categoryScroll}
          contentContainerStyle={styles.categoryContent}
        >
          {/* Add Category Button - Visible in Edit Mode */}
          {isEditMode && (
            <TouchableOpacity
              style={[styles.categoryBtn, styles.categoryBtnAdd]}
              onPress={() => setShowCategoryModal(true)}
            >
              <Text style={[styles.categoryBtnText, styles.categoryBtnAddText]}>
                + {t('tables.add-table')}
              </Text>
            </TouchableOpacity>
          )}

          {categories.map((cat) => (
            <View key={cat.id} style={{ position: 'relative' }}>
              <TouchableOpacity
                style={[
                  styles.categoryBtn,
                  selectedCategory === cat.id && styles.categoryBtnActive,
                ]}
                onPress={() => setSelectedCategory(cat.id)}
              >
                <Text
                  style={[
                    styles.categoryBtnText,
                    selectedCategory === cat.id && styles.categoryBtnTextActive,
                  ]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {cat.key || cat.name || `Cat ${cat.id}`}
                </Text>
              </TouchableOpacity>
              {isEditMode && (
                <View style={styles.categoryActionButtons}>
                  <TouchableOpacity
                    style={styles.categoryActionBtn}
                    onPress={() => {
                      setEditingCategoryId(cat.id);
                      setEditingCategoryName(cat.name || cat.key || '');
                      setShowEditCategoryModal(true);
                    }}
                  >
                    <Text style={styles.categoryActionBtnText}>✏️</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.categoryActionBtn, styles.categoryActionBtnDelete]}
                    onPress={() => deleteCategory(cat.id, cat.name || cat.key || `Category ${cat.id}`)}
                  >
                    <Text style={styles.categoryActionBtnText}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      </View>

      {/* Tables Grid Wrapper - Separate Context */}
      <View style={styles.tablesGridWrapper}>
        <FlatList
          data={isEditMode && selectedCategory 
            ? [...filteredTables, { id: 'add-table', name: '+ Add Table', isAddButton: true }]
            : filteredTables
          }
          keyExtractor={(item: any) => (item.id === 'add-table' ? 'add-table' : item.id.toString())}
          renderItem={({ item: tableOrAdd }: any) => {
            if (tableOrAdd.isAddButton) {
              return (
                <View style={styles.tableCardWrapper}>
                  <TouchableOpacity
                    style={[styles.tableCard, { backgroundColor: '#e8e8e8' }]}
                    onPress={() => setShowTableModal(true)}
                  >
                    <View style={styles.tableCardContent}>
                      <Text style={[styles.tableCardName, { color: '#666' }]}>
                        + Add Table
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>
              );
            }
            const table = tableOrAdd as Table;
            return (
          <View style={styles.tableCardWrapper}>
            <TouchableOpacity
              style={[styles.tableCard, { backgroundColor: getTableCardColor(table) }]}
              onPress={() => handleTableClick(table)}
            >
              <View style={styles.tableCardContent}>
                <Text style={[styles.tableCardName, getTableTextColor(getTableCardColor(table))]}>
                  {table.name}
                </Text>
                {table.sessions.length > 0 && (
                  <Text style={[{ fontSize: 12, marginTop: 6 }, getTableTextColor(getTableCardColor(table))]}>
                    {table.sessions.length} active • {table.sessions[0].pax} pax
                  </Text>
                )}
                {table.sessions.length === 0 && !table.reserved && (
                  <Text style={[{ fontSize: 12, marginTop: 6 }, getTableTextColor(getTableCardColor(table))]}>
                    ○ {t('tables.empty-table')}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
            {isEditMode && (
              <View style={styles.tableActionButtonsContainer}>
                {/* Edit Table Button */}
                <TouchableOpacity
                  style={styles.tableActionBtn}
                  onPress={() => {
                    setEditingTableId(table.id);
                    setEditingTableName(table.name);
                    setEditingTableSeats(table.seat_count.toString());
                    setShowEditTableModal(true);
                  }}
                >
                  <Text style={styles.tableActionBtnText}>✏️</Text>
                </TouchableOpacity>
                {/* Change Pax/Seat Count Button - Always visible */}
                <TouchableOpacity
                  style={styles.tableActionBtn}
                  onPress={() => {
                    setEditingTablePaxId(table.id);
                    setEditingPaxValue(table.seat_count.toString());
                    setShowEditPaxModal(true);
                  }}
                >
                  <Text style={styles.tableActionBtnText}>👥</Text>
                </TouchableOpacity>
                {/* Delete Table Button */}
                <TouchableOpacity
                  style={[styles.tableActionBtn, styles.tableActionBtnDelete]}
                  onPress={() => deleteTable(table.id, table.name)}
                >
                  <Text style={styles.tableActionBtnText}>🗑️</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
            );
          }}
        numColumns={3}
        columnWrapperStyle={styles.gridRow}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No tables in this category</Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      />
      </View>

      {/* Category Modal */}
      <Modal visible={showCategoryModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('tables.add-table')}</Text>

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
                <Text style={styles.btnText}>{t('button.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.btnPrimary]}
                onPress={createCategory}
              >
                <Text style={styles.btnText}>{t('button.submit')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Category Modal */}
      <Modal visible={editingCategoryId !== null} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('tables.edit-table')}</Text>

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
                <Text style={styles.btnText}>{t('button.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.btnPrimary]}
                onPress={() => editingCategoryId && editCategory(editingCategoryId)}
              >
                <Text style={styles.btnText}>{t('button.save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Table Modal */}
      <Modal visible={showTableModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('tables.add-table')}</Text>

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
              value={tableSeats}
              onChangeText={setTableSeats}
              placeholder="4"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.btn, styles.btnSecondary]}
                onPress={() => setShowTableModal(false)}
              >
                <Text style={styles.btnText}>{t('button.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.btnPrimary]}
                onPress={createTable}
              >
                <Text style={styles.btnText}>{t('button.submit')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Table Modal */}
      <Modal visible={editingTableId !== null} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('tables.edit-table')}</Text>

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
                <Text style={styles.btnText}>{t('button.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.btnPrimary]}
                onPress={updateTable}
              >
                <Text style={styles.btnText}>{t('button.save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Table Pax Modal */}
      <Modal visible={editingTablePaxId !== null} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Table Capacity</Text>

            <Text style={styles.label}>Seat Count</Text>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
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
                <Text style={styles.btnText}>{t('button.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.btnPrimary]}
                onPress={() => {
                  if (editingTablePaxId) {
                    updateTablePax(editingTablePaxId);
                  }
                }}
              >
                <Text style={styles.btnText}>{t('button.save')}</Text>
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
    paddingHorizontal: 16,
    borderRadius: 6,
    backgroundColor: '#f9fafb',
    marginHorizontal: 4,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryBtnActive: {
    backgroundColor: '#3b82f6',
  },
  categoryBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
  },
  categoryBtnTextActive: {
    color: '#ffffff',
  },
  categoryBtnAdd: {
    backgroundColor: '#e5e7eb',
  },
  categoryBtnAddText: {
    color: '#4b5563',
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
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.8,
  },
  categoryActionBtnDelete: {
    backgroundColor: '#ef4444',
  },
  listContent: {
    padding: 12,
  },
  gridRow: {
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
    borderRadius: 8,
    padding: 16,
    paddingTop: 40,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    minHeight: 120,
    justifyContent: 'center',
    alignItems: 'center',
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
    top: 8,
    right: 8,
    flexDirection: 'row',
    gap: 4,
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
  tableActionBtnDelete: {
    backgroundColor: 'rgba(255, 100, 100, 0.9)',
  },
  tableDeleteIcon: {
    backgroundColor: 'rgba(255, 100, 100, 0.9)',
  },
  tableEditIconText: {
    fontSize: 16,
  },
  tableActionBtnText: {
    fontSize: 16,
  },
  categoryActionBtnText: {
    fontSize: 14,
  },
  tableCardContent: {
    alignItems: 'center',
  },
  tableCardName: {
    fontSize: 18,
    fontWeight: 'bold',
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
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 16,
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
