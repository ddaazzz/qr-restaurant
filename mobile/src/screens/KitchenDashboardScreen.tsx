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
import { useLanguage } from '../contexts/LanguageContext';
import { apiClient } from '../services/apiClient';

interface KitchenItem {
  id: string;
  orderId: string;
  tableNumber: number;
  createdAt: string;
  status: string;
  items: Array<{
    quantity: number;
    name: string;
    selectedOptions?: Array<{ name: string }>;
    notes?: string;
  }>;
}

export const KitchenDashboardScreen = ({ navigation }: any) => {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const [kitchenItems, setKitchenItems] = useState<KitchenItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    loadKitchenItems();
    const interval = setInterval(loadKitchenItems, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

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
    Alert.alert(t('button.logout'), t('modal.confirm'), [
      { text: t('button.cancel'), style: 'cancel' },
      {
        text: t('button.logout'),
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
      Alert.alert(t('error.error'), err instanceof Error ? err.message : t('error.failed'));
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2C3E50" />
      </View>
    );
  }

  const statusColors: any = {
    pending: '#FVC107',
    confirmed: '#2C3E50',
    preparing: '#2C3E50',
    ready: '#2C3E50',
    served: '#9E9E9E',
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>🍳 {t('kitchen.kitchen-queue')}</Text>
        <TouchableOpacity onPress={() => setShowMenu(!showMenu)} style={styles.menuButton}>
          <Text style={styles.menuButtonText}>{t('menu.menu')} ▼</Text>
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
                Alert.alert(t('language.language'), t('language.select'));
                setShowMenu(false);
              }}
            >
              <Text style={styles.menuItemText}>🌍 {t('language.language')}</Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setShowMenu(false);
                handleLogout();
              }}
            >
              <Text style={styles.menuItemText}>🚪 {t('button.logout')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Content */}
      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadKitchenItems}>
            <Text style={styles.retryButtonText}>{t('button.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : kitchenItems.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>{t('kitchen.no-active-orders')}</Text>
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
    backgroundColor: '#2C3E50',
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
    borderLeftColor: '#2C3E50',
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
    color: '#2C3E50',
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
    backgroundColor: '#2C3E50',
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
    backgroundColor: '#2C3E50',
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
});
