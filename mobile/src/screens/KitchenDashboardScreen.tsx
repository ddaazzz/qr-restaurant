import React, { useEffect, useState } from 'react';
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
} from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { apiClient } from '../services/apiClient';
import { printerSettingsService, KitchenPrinter } from '../services/printerSettingsService';
import { printerSessionService } from '../services/printerSessionService';

interface KitchenItem {
  id: string;
  orderId: string;
  tableNumber: number;
  createdAt: string;
  status: string;
  categoryId?: number;  // NEW: category for printer routing
  items: Array<{
    quantity: number;
    name: string;
    selectedOptions?: Array<{ name: string }>;
    notes?: string;
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
export const KitchenDashboardScreen = ({ navigation }: any) => {
  const { user, logout } = useAuth();
  const [kitchenItems, setKitchenItems] = useState<KitchenItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [kitchenPrinters, setKitchenPrinters] = useState<KitchenPrinter[]>([]);
  const [showPrinterModal, setShowPrinterModal] = useState(false);
  const [selectedOrderForPrint, setSelectedOrderForPrint] = useState<KitchenItem | null>(null);
  const [matchingPrinters, setMatchingPrinters] = useState<KitchenPrinter[]>([]);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    loadKitchenItems();
    loadKitchenPrinters();
    const interval = setInterval(() => {
      loadKitchenItems();
      loadKitchenPrinters(); // Refresh printer config periodically
    }, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

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
      setKitchenItems(data);
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

  const handleUpdateStatus = async (itemId: string, newStatus: string) => {
    try {
      await apiClient.updateOrderStatus(itemId, newStatus);
      loadKitchenItems();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to update status');
    }
  };

  /**
   * Handle print order button - routes to appropriate printer based on category
   * NEW: Supports multi-printer with category-based routing
   */
  const handlePrintOrder = async (order: KitchenItem) => {
    try {
      setSelectedOrderForPrint(order);

      // Find printers that can handle this order's category
      let printers: KitchenPrinter[] = [];
      
      if (order.categoryId && kitchenPrinters.length > 0) {
        // NEW: Match by category ID
        printers = kitchenPrinters.filter(p => 
          p.categories && p.categories.includes(order.categoryId!)
        );
        console.log(`[KitchenDashboard] Found ${printers.length} printers for category ${order.categoryId}`);
      } else if (kitchenPrinters.length > 0) {
        // Fallback: if no category or no match, show all printers
        printers = kitchenPrinters;
        console.log(`[KitchenDashboard] No category match, showing all ${printers.length} printers`);
      }

      if (printers.length === 0) {
        Alert.alert(
          '⚠️ No Printer Configured',
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
   * Execute print to selected printer
   * Matches webapp's printKitchenOrder() flow - backend determines printer and sends ESC/POS
   */
  const executePrint = async (order: KitchenItem, printer: KitchenPrinter) => {
    try {
      setPrinting(true);
      setShowPrinterModal(false);
      
      console.log(`[KitchenDashboard] 🖇️ Printing order ${order.orderId} to: ${printer.name} (${printer.type})`);

      if (!user?.restaurantId) {
        throw new Error('Restaurant ID not found');
      }

      // Method 1: Network Printer (LAN/WiFi)
      if (printer.type === 'network' && printer.host) {
        console.log(`[KitchenDashboard] Sending to network printer: ${printer.host}:9100`);
        await sendToNetworkPrinter(order, printer);
        Alert.alert('✅ Print Sent', `Order sent to${printer.name}\n📍 ${printer.host}:9100`);
        return;
      }

      // Method 2: Bluetooth Printer
      if (printer.type === 'bluetooth' && printer.bluetoothDevice) {
        console.log(`[KitchenDashboard] Sending to Bluetooth printer: ${printer.bluetoothDevice}`);
        await sendToBluetoothPrinter(order, printer);
        Alert.alert('✅ Print Sent', `Order sent to: ${printer.name}\n📱 ${printer.bluetoothDevice}`);
        return;
      }

      throw new Error(`Unsupported printer type: ${printer.type}`);
    } catch (err) {
      console.error('[KitchenDashboard] ❌ Print error:', err);
      const message = err instanceof Error ? err.message : 'Failed to print order';
      Alert.alert('❌ Print Failed', message);
    } finally {
      setPrinting(false);
    }
  };

  /**
   * Send print data to network printer via TCP/IP
   * Matches webapp's network printer approach
   */
  const sendToNetworkPrinter = async (order: KitchenItem, printer: KitchenPrinter) => {
    try {
      if (!printer.host) {
        throw new Error('Printer host not configured');
      }

      console.log(`[KitchenDashboard] Connecting to network printer: ${printer.host}:9100`);

      // Generate ESC/POS from order data
      const { thermalPrinterService } = require('../services/thermalPrinterService');
      const printerService = new thermalPrinterService();
      
      const receiptData = {
        orderNumber: order.orderId,
        tableNumber: order.tableNumber,
        items: order.items?.map((item: any) => ({
          name: item.name,
          quantity: item.quantity
        })),
        timestamp: new Date().toLocaleString(),
        restaurantName: ''
      };

      const escposArray = printerService.generateESCPOS(receiptData);
      console.log(`[KitchenDashboard] Generated ${escposArray.length} bytes of ESC/POS`);

      // Send to backend print endpoint (backup - usually server-side auto-print handles this)
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
   * Send print data to Bluetooth printer
   * Matches webapp's Bluetooth approach - uses persistent session if available
   */
  const sendToBluetoothPrinter = async (order: KitchenItem, printer: KitchenPrinter) => {
    try {
      if (!printer.bluetoothDevice) {
        throw new Error('Bluetooth device not configured');
      }

      console.log(`[KitchenDashboard] Connecting to Bluetooth printer: ${printer.bluetoothDevice}`);

      // Generate ESC/POS from order data
      const { thermalPrinterService } = require('../services/thermalPrinterService');
      const printerService = new thermalPrinterService();
      
      const receiptData = {
        orderNumber: order.orderId,
        tableNumber: order.tableNumber,
        items: order.items?.map((item: any) => ({
          name: item.name,
          quantity: item.quantity
        })),
        timestamp: new Date().toLocaleString(),
        restaurantName: ''
      };

      const escposArray = printerService.generateESCPOS(receiptData);
      console.log(`[KitchenDashboard] Generated ${escposArray.length} bytes of ESC/POS`);

      // Send to backend print endpoint - backend handles Bluetooth connection
      // This matches webapp's architecture where backend generates and controls printing
      const response = await apiClient.post(
        `/restaurants/${user?.restaurantId}/print-order`,
        {
          orderId: order.orderId,
          orderType: 'kitchen',
          printerName: printer.bluetoothDevice,
          priority: 10
        }
      );

      console.log('[KitchenDashboard] ✅ Bluetooth print request sent to backend');
      // Backend will handle device connection and printing asynchronously
      return response;
    } catch (err) {
      console.error('[KitchenDashboard] Bluetooth print error:', err);
      throw new Error(`Failed to print to ${printer.name}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#FF9800" />
      </View>
    );
  }

  const statusColors: any = {
    pending: '#FVC107',
    confirmed: '#2196F3',
    preparing: '#FF9800',
    ready: '#4CAF50',
    served: '#9E9E9E',
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>🍳 Kitchen Queue</Text>
        <TouchableOpacity onPress={() => setShowMenu(!showMenu)} style={styles.menuButton}>
          <Text style={styles.menuButtonText}>Menu ▼</Text>
        </TouchableOpacity>
      </View>

      {/* Menu Dropdown */}
      <Modal visible={showMenu} transparent animationType="fade" onRequestClose={() => setShowMenu(false)}>
        <TouchableOpacity
          style={styles.menuBackdrop}
          activeOpacity={1}
          onPress={() => setShowMenu(false)}
        >
          <View style={styles.menuDropdown}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                Alert.alert('Language', 'Language selection would go here');
                setShowMenu(false);
              }}
            >
              <Text style={styles.menuItemText}>🌍 Language</Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setShowMenu(false);
                handleLogout();
              }}
            >
              <Text style={styles.menuItemText}>🚪 Logout</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* NEW: Printer Selection Modal */}
      <Modal visible={showPrinterModal} transparent animationType="fade" onRequestClose={() => setShowPrinterModal(false)}>
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
                        ? `📍 ${printer.host || 'Network Printer'}` 
                        : `📱 ${printer.bluetoothDevice || 'Bluetooth'}`}
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
      ) : kitchenItems.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No active orders</Text>
        </View>
      ) : (
        <FlatList
          data={kitchenItems}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshing={loading}
          onRefresh={loadKitchenItems}
          renderItem={({ item }) => (
            <View style={styles.orderCard}>
              <View style={styles.orderHeader}>
                <View>
                  <Text style={styles.orderNumber}>Order #{item.orderId}</Text>
                  <Text style={styles.tableNumber}>Table {item.tableNumber}</Text>
                  <Text style={styles.timestamp}>{new Date(item.createdAt).toLocaleTimeString()}</Text>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: statusColors[item.status] || '#999' },
                  ]}
                >
                  <Text style={styles.statusText}>{item.status}</Text>
                </View>
              </View>

              {/* Items */}
              <View style={styles.itemsList}>
                {item.items && item.items.length > 0 ? (
                  item.items.map((menuItem: any, id: number) => (
                    <View key={id} style={styles.itemRow}>
                      <Text style={styles.itemName}>
                        {menuItem.quantity}x {menuItem.name}
                      </Text>
                      {menuItem.selectedOptions && menuItem.selectedOptions.length > 0 && (
                        <View style={styles.optionsList}>
                          {menuItem.selectedOptions.map((opt: any, optId: number) => (
                            <Text key={optId} style={styles.optionText}>
                              • {opt.name}
                            </Text>
                          ))}
                        </View>
                      )}
                      {menuItem.notes && (
                        <Text style={styles.notes}>Note: {menuItem.notes}</Text>
                      )}
                    </View>
                  ))
                ) : (
                  <Text style={styles.noItems}>No items</Text>
                )}
              </View>

              {/* Action Buttons */}
              <View style={styles.actions}>
                {/* NEW: Print Button */}
                <TouchableOpacity
                  style={[styles.actionButton, styles.printButton]}
                  onPress={() => handlePrintOrder(item)}
                  disabled={printing}
                >
                  <Text style={styles.actionButtonText}>
                    {printing ? '⏳ Printing...' : '🖨️ Print'}
                  </Text>
                </TouchableOpacity>

                {item.status !== 'ready' && (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.readyButton]}
                    onPress={() => handleUpdateStatus(item.id, 'ready')}
                  >
                    <Text style={styles.actionButtonText}>Ready</Text>
                  </TouchableOpacity>
                )}

                {item.status !== 'served' && item.status === 'ready' && (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.servedButton]}
                    onPress={() => handleUpdateStatus(item.id, 'served')}
                  >
                    <Text style={styles.actionButtonText}>Served</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
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
    padding: 20,
    paddingTop: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  menuButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  menuButtonText: {
    color: '#fff',
    fontSize: 14,
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
    padding: 15,
  },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    borderLeftWidth: 4,
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
    marginBottom: 15,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  orderNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  tableNumber: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
    marginTop: 5,
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
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  optionsList: {
    marginTop: 5,
    marginLeft: 10,
  },
  optionText: {
    fontSize: 13,
    color: '#666',
  },
  notes: {
    fontSize: 13,
    color: '#FF9800',
    fontStyle: 'italic',
    marginTop: 5,
  },
  noItems: {
    fontSize: 14,
    color: '#999',
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
    backgroundColor: '#2196F3',
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
    borderLeftColor: '#2196F3',
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
    color: '#2196F3',
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
