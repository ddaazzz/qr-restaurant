import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Dimensions,
  useWindowDimensions,
} from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { apiClient } from '../services/apiClient';
import { useTranslation } from '../contexts/TranslationContext';
import { useToast } from '../components/ToastProvider';
import { io, Socket } from 'socket.io-client';
import { API_URL } from '../services/apiClient';
import { printerSettingsService, KitchenPrinter } from '../services/printerSettingsService';
import { printerSessionService } from '../services/printerSessionService';
import { printerAutoPrintService } from '../services/printerAutoPrintService';
import { printQueueService } from '../services/printQueueService';
import { bluetoothService } from '../services/bluetoothService';
import { printerDeviceStorageService } from '../services/printerDeviceStorageService';

/** Raw item from the API (one row per order_item) */
interface RawKitchenItem {
  order_item_id: number;
  order_id: number;
  restaurant_order_number?: number;
  session_id: number;
  table_name: string;
  order_type: string;
  menu_item_name: string;
  category_id?: number;
  quantity: number;
  status: string;
  variants: string;
  notes: string;
  created_at: string;
  restaurant_id: number;
  is_addon?: boolean;
  parent_order_item_id?: number | null;
}

/** Grouped order card (matches web app structure) */
interface KitchenOrder {
  orderId: number;
  restaurantOrderNumber?: number;
  tableName: string;
  orderType: string;
  createdAt: string;
  status: string; // worst status among items
  items: Array<{
    id: number;
    name: string;
    quantity: number;
    status: string;
    variants?: string;
    notes?: string;
    categoryId?: number;
    isAddon?: boolean;
    parentOrderItemId?: number | null;
    addons?: Array<{
      id: number;
      name: string;
      quantity: number;
      status: string;
      variants?: string;
      notes?: string;
    }>;
  }>;
}

/**
 * KITCHEN AUTO-PRINT ARCHITECTURE (Matches Web App)
 * 
 * PRIMARY (Always Works - Server-Side):
 *   1. Order created in database
 *   2. PostgreSQL trigger fires → PostgreSQL NOTIFY
 *   3. Backend OrderNotifier receives event
 *   4. Backend KitchenAutoPrintService auto-prints to configured printer
 *   → WORKS EVEN IF KITCHEN STAFF ISN'T LOGGED IN ✅
 * 
 * FALLBACK (Optional - Kitchen Staff Can Also Print):
 *   1. Kitchen staff logs in → printer session initialized
 *   2. Staff taps "Print" on order → calls backend print endpoint
 *   3. Backend sends ESC/POS to configured printer
 *   → Backup print if server didn't auto-print ✅
 */
/**
 * Get relative time-ago string from a date
 */
const getTimeAgo = (dateStr: string): string => {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  if (diffMs < 0) return 'just now';
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

export const KitchenDashboardScreen = ({ navigation }: any) => {
  const { user, logout, updateUser } = useAuth();
  const { t, lang, setLanguage } = useTranslation();
  const { showToast } = useToast();
  const { width: screenWidth } = useWindowDimensions();
  const [rawItems, setRawItems] = useState<RawKitchenItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [kitchenPrinters, setKitchenPrinters] = useState<KitchenPrinter[]>([]);
  const [showPrinterModal, setShowPrinterModal] = useState(false);
  const [selectedOrderForPrint, setSelectedOrderForPrint] = useState<KitchenOrder | null>(null);
  const [matchingPrinters, setMatchingPrinters] = useState<KitchenPrinter[]>([]);
  const [printing, setPrinting] = useState(false);
  const [printerConnected, setPrinterConnected] = useState(false);
  const [printerStatus, setPrinterStatus] = useState('Initializing...');
  const [wsConnected, setWsConnected] = useState(false);
  const [clockLoading, setClockLoading] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const [, setTimeRefresh] = useState(0); // Force re-render for time-ago updates

  // Group raw items into order cards (like web app does)
  const kitchenOrders = useMemo((): KitchenOrder[] => {
    const orderMap: Record<number, KitchenOrder> = {};
    const statusPriority: Record<string, number> = { pending: 0, confirmed: 1, preparing: 2, ready: 3 };

    // First pass: collect all items per order
    const allItemsByOrder: Record<number, RawKitchenItem[]> = {};
    for (const item of rawItems) {
      const oid = item.order_id;
      if (!allItemsByOrder[oid]) allItemsByOrder[oid] = [];
      allItemsByOrder[oid].push(item);
    }

    // Second pass: group addons under parent items
    for (const [oidStr, items] of Object.entries(allItemsByOrder)) {
      const oid = Number(oidStr);
      const mainItems: RawKitchenItem[] = [];
      const addonsByParent: Record<number, RawKitchenItem[]> = {};

      for (const item of items) {
        if (item.is_addon && item.parent_order_item_id) {
          if (!addonsByParent[item.parent_order_item_id]) addonsByParent[item.parent_order_item_id] = [];
          addonsByParent[item.parent_order_item_id].push(item);
        } else {
          mainItems.push(item);
        }
      }

      const firstItem = items[0];
      orderMap[oid] = {
        orderId: oid,
        restaurantOrderNumber: firstItem.restaurant_order_number,
        tableName: firstItem.table_name,
        orderType: firstItem.order_type,
        createdAt: firstItem.created_at,
        status: firstItem.status,
        items: mainItems.map(item => ({
          id: item.order_item_id,
          name: item.menu_item_name,
          quantity: item.quantity,
          status: item.status,
          variants: item.variants,
          notes: item.notes,
          categoryId: item.category_id,
          isAddon: false,
          parentOrderItemId: null,
          addons: (addonsByParent[item.order_item_id] || []).map(addon => ({
            id: addon.order_item_id,
            name: addon.menu_item_name,
            quantity: addon.quantity,
            status: addon.status,
            variants: addon.variants,
            notes: addon.notes,
          })),
        })),
      };

      // Use worst (earliest) status for the card
      for (const item of items) {
        if ((statusPriority[item.status] ?? 99) < (statusPriority[orderMap[oid].status] ?? 99)) {
          orderMap[oid].status = item.status;
        }
      }
    }

    return Object.values(orderMap).sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }, [rawItems]);

  // Calculate grid columns based on screen width
  const numColumns = useMemo(() => {
    if (screenWidth >= 1200) return 4;
    if (screenWidth >= 900) return 3;
    if (screenWidth >= 600) return 2;
    return 1;
  }, [screenWidth]);

  useEffect(() => {
    initializePrinters();
    subscribeToAutoPrint();
    connectWebSocket();
    
    // Polling as fallback (WebSocket is primary)
    const interval = setInterval(() => {
      loadKitchenItems();
      loadKitchenPrinters();
    }, 5000);

    // Time-ago refresh every 30s
    const timeInterval = setInterval(() => {
      setTimeRefresh(prev => prev + 1);
    }, 30000);

    return () => {
      clearInterval(interval);
      clearInterval(timeInterval);
      printerAutoPrintService.unsubscribeFromOrders();
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [user?.restaurantId]);

  /**
   * Connect to WebSocket for real-time kitchen order updates
   */
  const connectWebSocket = () => {
    const restaurantId = user?.restaurantId;
    if (!restaurantId) return;

    try {
      const wsUrl = API_URL.replace('/api', '');
      const socket = io(wsUrl, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 2000,
      });

      socket.on('connect', () => {
        console.log('[Kitchen WS] Connected');
        setWsConnected(true);
        socket.emit('subscribe-kitchen-orders', { restaurantId });
      });

      socket.on('disconnect', () => {
        console.log('[Kitchen WS] Disconnected');
        setWsConnected(false);
      });

      socket.on('new-order', (_data: any) => {
        console.log('[Kitchen WS] New order received');
        loadKitchenItems();
      });

      socket.on('order-status-changed', (_data: any) => {
        console.log('[Kitchen WS] Order status changed');
        loadKitchenItems();
      });

      socketRef.current = socket;
    } catch (err) {
      console.error('[Kitchen WS] Connection error:', err);
    }
  };

  /**
   * Clock In/Out handler
   */
  const handleClockToggle = async () => {
    if (!user?.userId || !user?.restaurantId) return;
    setClockLoading(true);
    try {
      const isClockedIn = user.currently_clocked_in;
      const endpoint = isClockedIn
        ? `/api/restaurants/${user.restaurantId}/staff/${user.userId}/clock-out`
        : `/api/restaurants/${user.restaurantId}/staff/${user.userId}/clock-in`;
      await apiClient.post(endpoint, { restaurantId: user.restaurantId });
      updateUser({ currently_clocked_in: !isClockedIn });
      showToast(t(isClockedIn ? 'common.clocked-out' : 'common.clocked-in'), 'success');
    } catch (err: any) {
      showToast(err.message || t('common.failed'), 'error');
    } finally {
      setClockLoading(false);
    }
  };

  /**
   * Initialize printer services on mount
   */
  const initializePrinters = async () => {
    try {
      // Load saved printer devices from storage
      await printerSessionService.loadSavedDevices();
      console.log('[KitchenDashboard] Printer sessions initialized');

      // Load kitchen printers config
      await loadKitchenPrinters();
      updatePrinterConnectionStatus();
    } catch (err) {
      console.error('[KitchenDashboard] Printer initialization error:', err);
      setPrinterStatus('Printer init failed');
    }
  };

  /**
   * Subscribe to auto-print order events
   */
  const subscribeToAutoPrint = async () => {
    const restaurantId = user?.restaurantId;
    if (!restaurantId) return;

    try {
      // Register callback for new orders
      printerAutoPrintService.onOrder(async (order) => {
        console.log('[KitchenDashboard] Auto-print triggered for order:', order.orderId);
        await handleAutoPrintOrder(order);
      });

      // Start polling for new orders
      await printerAutoPrintService.subscribeToOrders(restaurantId, 3000);
      console.log('[KitchenDashboard] Auto-print subscription started');
    } catch (err) {
      console.error('[KitchenDashboard] Auto-print setup error:', err);
    }
  };

  /**
   * Update printer connection status display
   */
  const updatePrinterConnectionStatus = () => {
    const session = printerSessionService.getSession('kitchen');
    if (session && session.connected) {
      setPrinterConnected(true);
      setPrinterStatus(`Connected: ${session.deviceName}`);
    } else {
      setPrinterConnected(false);
      const pending = printerSessionService.getSessionAny('kitchen');
      if (pending) {
        setPrinterStatus(`Reconnecting: ${pending.deviceName}...`);
      } else {
        setPrinterStatus('Not connected');
      }
    }
  };

  /**
   * Load kitchen printers from unified printer settings
   * NEW: Supports multi-printer configuration with category routing
   */
  const loadKitchenPrinters = async () => {
    try {
      const restaurantId = user?.restaurantId;
      if (!restaurantId) return;

      const printers = await printerSettingsService.getKitchenPrinters(restaurantId);
      console.log('[KitchenDashboard] Loaded kitchen printers:', {
        count: printers.length,
        printers: printers.map(p => ({ name: p.name, categories: p.categories }))
      });
      setKitchenPrinters(printers);
    } catch (err) {
      console.error('[KitchenDashboard] Error loading kitchen printers:', err);
      // Don't show alert if printers fail to load - use auto-print fallback
    }
  };

  const loadKitchenItems = async () => {
    try {
      const data = await apiClient.getKitchenItems();
      setRawItems(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load items');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        onPress: async () => {
          await logout();
        },
      },
    ]);
  };

  const handleUpdateStatus = async (itemId: number, newStatus: string) => {
    try {
      await apiClient.updateOrderStatus(String(itemId), newStatus);
      loadKitchenItems();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to update status');
    }
  };

  /** Update all items in an order to the same status */
  const handleUpdateAllItemsStatus = async (order: KitchenOrder, newStatus: string) => {
    try {
      const allIds = order.items.flatMap(item => [
        item.id,
        ...(item.addons || []).map(a => a.id),
      ]);
      await Promise.all(
        allIds.map(id => apiClient.updateOrderStatus(String(id), newStatus))
      );
      loadKitchenItems();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to update status');
    }
  };

  /**
   * Handle print order button - routes to appropriate printer based on category
   * NEW: Supports multi-printer with category-based routing
   */
  const handlePrintOrder = async (order: KitchenOrder) => {
    try {
      setSelectedOrderForPrint(order);

      // Find printers that can handle this order's categories
      let printers: KitchenPrinter[] = [];
      const orderCategoryIds = order.items.map(i => i.categoryId).filter(Boolean) as number[];
      
      if (orderCategoryIds.length > 0 && kitchenPrinters.length > 0) {
        printers = kitchenPrinters.filter(p => 
          p.categories && orderCategoryIds.some(cid => p.categories!.includes(cid))
        );
        console.log(`[KitchenDashboard] Found ${printers.length} printers for categories ${orderCategoryIds}`);
      } else if (kitchenPrinters.length > 0) {
        // Fallback: if no category or no match, show all printers
        printers = kitchenPrinters;
        console.log(`[KitchenDashboard] No category match, showing all ${printers.length} printers`);
      }

      if (printers.length === 0) {
        Alert.alert(
          'No Printer Configured',
          'No kitchen printer is configured for this order category.\n\nPlease configure printers in web admin.'
        );
        return;
      }

      if (printers.length === 1) {
        // Only one option - print directly
        await executePrint(order, printers[0]);
      } else {
        // Multiple options - show selection modal
        setMatchingPrinters(printers);
        setShowPrinterModal(true);
      }
    } catch (err) {
      console.error('[KitchenDashboard] Error in handlePrintOrder:', err);
      Alert.alert('Error', 'Failed to prepare order for printing');
    }
  };

  /**
   * Handle auto-print orders from real-time subscription
   */
  const handleAutoPrintOrder = async (order: any) => {
    try {
      // Find appropriate printers for this order's category
      let printers: KitchenPrinter[] = kitchenPrinters;
      
      if (order.categoryId && kitchenPrinters.length > 0) {
        printers = kitchenPrinters.filter(p => 
          p.categories && p.categories.includes(order.categoryId)
        );
      }

      // If no category match, use all available printers
      if (printers.length === 0) {
        printers = kitchenPrinters;
      }

      // Auto-print to all matching printers
      for (const printer of printers) {
        try {
          console.log(`[KitchenDashboard] Auto-printing order ${order.orderId} to ${printer.name}`);
          
          // Try to print, queue if fails
          const success = await attemptPrint(order, printer);
          if (!success && printer.bluetoothDevice) {
            // Queue for retry if Bluetooth printer failed
            const jobId = printQueueService.addJob(
              order.orderId,
              'kitchen',
              printer.bluetoothDevice,
              `Auto-print job for ${printer.name}`,
              3
            );
            console.log(`[KitchenDashboard] Queued print job: ${jobId}`);
          }
        } catch (printerErr) {
          console.error(`[KitchenDashboard] Auto-print error for printer ${printer.name}:`, printerErr);
        }
      }
    } catch (err) {
      console.error('[KitchenDashboard] Auto-print order error:', err);
    }
  };

  /**
   * Attempt to print an order (with retry queue fallback)
   */
  const attemptPrint = async (order: any, printer: KitchenPrinter): Promise<boolean> => {
    try {
      if (printer.type === 'network' && printer.host) {
        await sendToNetworkPrinter(order, printer);
        return true;
      }

      if (printer.type === 'bluetooth' && printer.bluetoothDevice) {
        return await sendToBluetoothPrinterWithQueue(order, printer);
      }

      return false;
    } catch (err) {
      console.error('[KitchenDashboard] Print attempt error:', err);
      return false;
    }
  };

  /**
   * Execute print to selected printer with queue & auto-reconnect support
   */
  const executePrint = async (order: KitchenOrder, printer: KitchenPrinter) => {
    try {
      setPrinting(true);
      setShowPrinterModal(false);
      
      console.log(`[KitchenDashboard] 🖇️ Printing order ${order.orderId} to: ${printer.name} (${printer.type})`);

      if (!user?.restaurantId) {
        throw new Error('Restaurant ID not found');
      }

      // Try to print
      const success = await attemptPrint(order, printer);
      
      if (success) {
        // Save device selection
        if (printer.bluetoothDevice) {
          await printerDeviceStorageService.savePrinterDevice(
            'kitchen',
            printer.bluetoothDevice,
            printer.name
          );
        }
        Alert.alert('Print Sent', `Order sent to: ${printer.name}`);
      } else {
        throw new Error(`Failed to print to ${printer.name}`);
      }
    } catch (err) {
      console.error('[KitchenDashboard] ❌ Print error:', err);
      const message = err instanceof Error ? err.message : 'Failed to print order';
      Alert.alert('Print Failed', message);
    } finally {
      setPrinting(false);
    }
  };

  /**
   * Send print data to network printer via TCP/IP
   * Matches webapp's network printer approach
   */
  const sendToNetworkPrinter = async (order: KitchenOrder, printer: KitchenPrinter) => {
    try {
      if (!printer.host) {
        throw new Error('Printer host not configured');
      }

      console.log(`[KitchenDashboard] Connecting to network printer: ${printer.host}:9100`);

      const response = await apiClient.post(
        `/restaurants/${user?.restaurantId}/print-order`,
        {
          orderId: order.orderId,
          orderType: 'kitchen',
          priority: 10
        }
      );

      console.log('[KitchenDashboard] ✅ Print request sent to backend');
      return response;
    } catch (err) {
      console.error('[KitchenDashboard] Network print error:', err);
      throw new Error(`Failed to print to ${printer.name}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  /**
   * Send print data to Bluetooth printer with queue & retry support
   */
  const sendToBluetoothPrinterWithQueue = async (
    order: KitchenOrder | any,
    printer: KitchenPrinter
  ): Promise<boolean> => {
    try {
      if (!printer.bluetoothDevice) {
        throw new Error('Bluetooth device not configured');
      }

      console.log(`[KitchenDashboard] Connecting to Bluetooth: ${printer.bluetoothDevice}`);

      // Check if we have an active session for this device
      let session = printerSessionService.getSessionAny('kitchen');
      const deviceNeedsConnection = !session || !session.connected || session.deviceId !== printer.bluetoothDevice;

      if (deviceNeedsConnection) {
        // Try to connect to device
        try {
          const connected = await bluetoothService.connectToPrinter(printer.bluetoothDevice);
          
          if (connected) {
            // Update session
            const newSession = {
              deviceId: printer.bluetoothDevice,
              deviceName: printer.name,
              connected: true,
              lastUsed: Date.now(),
            };
            await printerSessionService.setSession('kitchen', newSession);
            printerSessionService.markConnected('kitchen');
          } else {
            // Queue the print job for retry
            const jobId = printQueueService.addJob(
              order.orderId,
              'kitchen',
              printer.bluetoothDevice,
              'Kitchen print job',
              3
            );
            console.log(`[KitchenDashboard] Device not available, job queued: ${jobId}`);
            return false;
          }
        } catch (err) {
          console.error('[KitchenDashboard] Connection failed:', err);
          const jobId = printQueueService.addJob(
            order.orderId,
            'kitchen',
            printer.bluetoothDevice,
            'Kitchen print job',
            3
          );
          console.log(`[KitchenDashboard] Connection error, job queued: ${jobId}`);
          return false;
        }
      }

      // Send print request to backend to get TM-U220 compatible ESC/POS data
      const response = await apiClient.post(
        `/restaurants/${user?.restaurantId}/print-order`,
        {
          orderId: order.orderId,
          orderType: 'kitchen',
          printerName: printer.bluetoothDevice,
          priority: 10
        }
      );

      // Send ESC/POS data to Bluetooth printer (TM-U220 Impact Printer compatible)
      if (response.data?.bluetoothPayload?.escposBase64) {
        await bluetoothService.sendRawData(
          printer.bluetoothDevice,
          response.data.bluetoothPayload.escposBase64
        );
      }

      console.log('[KitchenDashboard] ✅ Print sent successfully');
      updatePrinterConnectionStatus();
      return true;
    } catch (err) {
      console.error('[KitchenDashboard] Bluetooth print error:', err);
      printerSessionService.markDisconnected('kitchen', 
        err instanceof Error ? err.message : 'Print failed'
      );
      return false;
    }
  };

  /**
   * Send print data to Bluetooth printer
   * Matches webapp's Bluetooth approach - uses persistent session if available
   */
  const sendToBluetoothPrinter = async (order: KitchenOrder, printer: KitchenPrinter) => {
    return await sendToBluetoothPrinterWithQueue(order, printer);
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#FF9800" />
      </View>
    );
  }

  const statusColors: any = {
    pending: '#FFC107',
    confirmed: '#3b82f6',
    preparing: '#FF9800',
    ready: '#4CAF50',
    served: '#9E9E9E',
  };

  const cardBorderColors: any = {
    pending: '#FFC107',
    confirmed: '#3b82f6',
    preparing: '#FF9800',
    ready: '#4CAF50',
    served: '#9E9E9E',
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{t('kitchen.kitchen-queue') || 'Kitchen Queue'}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <Text style={[styles.printerStatus, { color: printerConnected ? '#4CAF50' : '#FF9800' }]}>
              {printerStatus}
            </Text>
            <Text style={{ fontSize: 12, color: wsConnected ? '#4CAF50' : '#FF9800' }}>
              {wsConnected ? '● Live' : '○ Polling'}
            </Text>
          </View>
        </View>
        {/* Clock In/Out button */}
        <TouchableOpacity
          onPress={handleClockToggle}
          disabled={clockLoading}
          style={[
            styles.menuButton,
            { backgroundColor: user?.currently_clocked_in ? 'rgba(231,76,60,0.3)' : 'rgba(39,174,96,0.3)', marginRight: 8 },
          ]}
        >
          {clockLoading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.menuButtonText}>
              {user?.currently_clocked_in ? t('admin.clock-out') : t('admin.clock-in')}
            </Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowMenu(!showMenu)} style={styles.menuButton}>
          <Text style={styles.menuButtonText}>{t('common.menu') || 'Menu'}</Text>
        </TouchableOpacity>
      </View>

      {/* Menu Dropdown */}
      <Modal supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']} visible={showMenu} transparent animationType="fade" onRequestClose={() => setShowMenu(false)}>
        <TouchableOpacity
          style={styles.menuBackdrop}
          activeOpacity={1}
          onPress={() => setShowMenu(false)}
        >
          <View style={styles.menuDropdown}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setLanguage(lang === 'en' ? 'zh' : 'en');
                showToast(lang === 'en' ? '已切換至中文' : 'Switched to English', 'info');
                setShowMenu(false);
              }}
            >
              <Text style={styles.menuItemText}>{lang === 'en' ? '中文' : 'English'}</Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setShowMenu(false);
                handleLogout();
              }}
            >
              <Text style={styles.menuItemText}>{t('common.logout') || 'Logout'}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* NEW: Printer Selection Modal */}
      <Modal supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']} visible={showPrinterModal} transparent animationType="fade" onRequestClose={() => setShowPrinterModal(false)}>
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowPrinterModal(false)}
        >
          <View style={styles.printerModalContent}>
            <Text style={styles.printerModalTitle}>Select Printer</Text>
            <Text style={styles.printerModalSubtitle}>
              {selectedOrderForPrint ? `Order #${selectedOrderForPrint.orderId}` : ''}
            </Text>

            <View style={styles.printerList}>
              {matchingPrinters.map((printer) => (
                <TouchableOpacity
                  key={printer.id}
                  style={styles.printerOption}
                  onPress={() => executePrint(selectedOrderForPrint!, printer)}
                  disabled={printing}
                >
                  <View style={styles.printerOptionContent}>
                    <Text style={styles.printerName}>{printer.name}</Text>
                    <Text style={styles.printerType}>
                      {printer.type === 'network' 
                        ? `${printer.host || 'Network Printer'}` 
                        : `${printer.bluetoothDevice || 'Bluetooth'}`}
                    </Text>
                    <Text style={styles.printerCategories}>
                      Categories: {printer.categories?.join(', ') || 'All'}
                    </Text>
                  </View>
                  <Text style={styles.printerArrow}>→</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={styles.printerModalCancel}
              onPress={() => setShowPrinterModal(false)}
            >
              <Text style={styles.printerModalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Content */}
      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadKitchenItems}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : kitchenOrders.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>{t('kitchen.no-orders') || 'No active orders'}</Text>
        </View>
      ) : (
        <FlatList<KitchenOrder>
          // @ts-ignore - key needed to force remount when numColumns changes
          key={`grid-${numColumns}`}
          data={kitchenOrders}
          numColumns={numColumns}
          keyExtractor={(item) => String(item.orderId)}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={numColumns > 1 ? styles.gridRow : undefined}
          refreshing={loading}
          onRefresh={loadKitchenItems}
          renderItem={({ item: order }) => {
            const displayName = order.orderType === 'table'
              ? order.tableName
              : order.orderType === 'takeaway' ? (t('kitchen.takeaway') || 'Takeaway')
              : order.orderType === 'counter' ? (t('kitchen.counter') || 'Counter')
              : order.tableName || (t('kitchen.order') || 'Order');

            return (
              <View style={[
                styles.orderCard,
                { borderLeftColor: cardBorderColors[order.status] || '#FF9800' },
                numColumns > 1 && { flex: 1, maxWidth: `${100 / numColumns}%` as any },
              ]}>
                {/* Header */}
                <View style={styles.orderHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.orderNumber}>
                      {displayName} {order.restaurantOrderNumber ? `#${order.restaurantOrderNumber}` : `#${order.orderId}`}
                    </Text>
                    <Text style={styles.timestamp}>{getTimeAgo(order.createdAt)}</Text>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: statusColors[order.status] || '#999' },
                    ]}
                  >
                    <Text style={styles.statusText}>{order.status?.toUpperCase()}</Text>
                  </View>
                </View>

                {/* Items */}
                <View style={styles.itemsList}>
                  {order.items.map((menuItem) => (
                    <View key={menuItem.id} style={styles.itemRow}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={styles.itemName}>
                          {menuItem.quantity}x {menuItem.name}
                        </Text>
                        <View style={[styles.itemStatusDot, { backgroundColor: statusColors[menuItem.status] || '#999' }]} />
                      </View>
                      {menuItem.variants ? (
                        <Text style={styles.optionText}>{menuItem.variants}</Text>
                      ) : null}
                      {menuItem.notes ? (
                        <Text style={styles.notes}>{menuItem.notes}</Text>
                      ) : null}
                      {/* Addon items nested under parent */}
                      {(menuItem.addons || []).map((addon) => (
                        <View key={addon.id} style={styles.addonRow}>
                          <Text style={styles.addonName}>+ {addon.name}</Text>
                          {addon.variants ? (
                            <Text style={styles.addonVariants}>{addon.variants}</Text>
                          ) : null}
                          {addon.notes ? (
                            <Text style={styles.addonNotes}>{addon.notes}</Text>
                          ) : null}
                        </View>
                      ))}
                    </View>
                  ))}
                </View>

                {/* Action Buttons: Print + one state-change button */}
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.printButton]}
                    onPress={() => handlePrintOrder(order)}
                    disabled={printing}
                  >
                    <Text style={styles.actionButtonText}>
                      {printing ? (t('kitchen.printing') || 'Printing...') : (t('kitchen.print') || 'Print')}
                    </Text>
                  </TouchableOpacity>

                  {order.status === 'pending' && (
                    <TouchableOpacity
                      style={[styles.actionButton, styles.preparingButton]}
                      onPress={() => handleUpdateAllItemsStatus(order, 'preparing')}
                    >
                      <Text style={styles.actionButtonText}>{t('kitchen.start-preparing') || 'Start Preparing'}</Text>
                    </TouchableOpacity>
                  )}

                  {order.status === 'preparing' && (
                    <TouchableOpacity
                      style={[styles.actionButton, styles.readyButton]}
                      onPress={() => handleUpdateAllItemsStatus(order, 'ready')}
                    >
                      <Text style={styles.actionButtonText}>{t('kitchen.ready') || 'Ready'}</Text>
                    </TouchableOpacity>
                  )}

                  {order.status === 'ready' && (
                    <TouchableOpacity
                      style={[styles.actionButton, styles.servedButton]}
                      onPress={() => handleUpdateAllItemsStatus(order, 'served')}
                    >
                      <Text style={styles.actionButtonText}>{t('kitchen.served') || 'Served'}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
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
  header: {
    backgroundColor: '#FF9800',
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingTop: 50,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  printerStatus: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: '500',
  },
  menuButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    flexShrink: 0,
  },
  menuButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  menuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
    paddingTop: 80,
  },
  menuDropdown: {
    backgroundColor: '#fff',
    marginHorizontal: 10,
    marginRight: 20,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    alignSelf: 'flex-end',
    minWidth: 180,
  },
  menuItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  menuItemText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#eee',
  },
  logoutBtn: {
    color: '#fff',
    fontSize: 14,
    padding: 8,
  },
  listContent: {
    padding: 10,
  },
  gridRow: {
    gap: 10,
  },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderLeftWidth: 5,
    borderLeftColor: '#FF9800',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
    marginTop: 3,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
    textTransform: 'uppercase',
  },
  itemsList: {
    marginBottom: 15,
  },
  itemRow: {
    marginBottom: 12,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  itemStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 6,
  },
  optionText: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
    marginLeft: 4,
  },
  notes: {
    fontSize: 12,
    color: '#FF9800',
    fontStyle: 'italic',
    marginTop: 2,
  },
  addonRow: {
    marginLeft: 16,
    marginTop: 4,
    paddingLeft: 8,
    borderLeftWidth: 2,
    borderLeftColor: '#667eea',
  },
  addonName: {
    fontSize: 13,
    fontWeight: '500',
    color: '#667eea',
  },
  addonVariants: {
    fontSize: 11,
    color: '#888',
    marginTop: 1,
    marginLeft: 4,
  },
  addonNotes: {
    fontSize: 11,
    color: '#FF9800',
    fontStyle: 'italic',
    marginTop: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  readyButton: {
    backgroundColor: '#4CAF50',
  },
  preparingButton: {
    backgroundColor: '#FF9800',
  },
  servedButton: {
    backgroundColor: '#9E9E9E',
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#f44336',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#FF9800',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    color: '#999',
  },
  // NEW: Print button and modal styles
  printButton: {
    backgroundColor: '#3b82f6',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  printerModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  printerModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  printerModalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  printerList: {
    marginBottom: 16,
  },
  printerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
  },
  printerOptionContent: {
    flex: 1,
  },
  printerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  printerType: {
    fontSize: 13,
    color: '#666',
    marginBottom: 2,
  },
  printerCategories: {
    fontSize: 12,
    color: '#999',
  },
  printerArrow: {
    fontSize: 16,
    color: '#3b82f6',
    marginLeft: 8,
  },
  printerModalCancel: {
    paddingVertical: 12,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  printerModalCancelText: {
    fontSize: 16,
    color: '#999',
    fontWeight: '500',
  },
});
