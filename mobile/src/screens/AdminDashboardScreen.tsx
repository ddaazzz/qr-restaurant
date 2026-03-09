import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  Modal,
  Dimensions,
  FlatList,
} from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { QRScannerModal } from '../components/QRScannerModal';
import { TablesTab, TablesTabRef } from './admin/TablesTab';
import { MenuTab, MenuTabRef } from './admin/MenuTab';
import { StaffTab, StaffTabRef } from './admin/StaffTab';
import { OrdersTab } from './admin/OrdersTab';
import { SettingsTab } from './admin/SettingsTab';
import { BookingsTab, BookingsTabRef } from './admin/BookingsTab';
import { ReportsTab } from './admin/ReportsTab';

type TabType = 'tables' | 'orders' | 'menu' | 'staff' | 'bookings' | 'reports' | 'settings';

export const AdminDashboardScreen = ({ navigation }: any) => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('tables');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showAdminDropdown, setShowAdminDropdown] = useState(false);
  const [restaurants, setRestaurants] = useState<Array<{ id: number; name: string }>>([]);
  const tablesTabRef = useRef<TablesTabRef>(null);
  const menuTabRef = useRef<MenuTabRef>(null);
  const staffTabRef = useRef<StaffTabRef>(null);
  const ordersTabRef = useRef<any>(null);
  const bookingsTabRef = useRef<BookingsTabRef>(null);

  if (!user?.restaurantId) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2C3E50" />
      </SafeAreaView>
    );
  }

  // Fetch restaurants when dropdown is opened
  const openAdminDropdown = async () => {
    if (showAdminDropdown) {
      setShowAdminDropdown(false);
      return;
    }

    // If restaurants already loaded, just open
    if (restaurants.length > 0) {
      setShowAdminDropdown(true);
      return;
    }

    // Fetch restaurants for superadmin
    if (user.role === 'superadmin') {
      try {
        const response = await fetch('https://chuio.io/api/auth/restaurants', {
          headers: {
            'Authorization': `Bearer ${user.token}`,
          }
        });
        if (response.ok) {
          const data = await response.json();
          setRestaurants(data);
        }
      } catch (error) {
        console.error('Failed to fetch restaurants:', error);
      }
    }

    setShowAdminDropdown(true);
  };

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        onPress: async () => {
          setShowAdminDropdown(false);
          await logout();
        },
      },
    ]);
  };

  const handleEditToggle = () => {
    if (tablesTabRef.current?.toggleEditMode) {
      tablesTabRef.current.toggleEditMode();
    }
  };

  const handleMenuEditToggle = () => {
    if (menuTabRef.current?.toggleEditMode) {
      menuTabRef.current.toggleEditMode();
    }
  };

  const handleStaffEditToggle = () => {
    if (staffTabRef.current?.toggleEditMode) {
      staffTabRef.current.toggleEditMode();
    }
  };

  const handleHistoryToggle = () => {
    if (ordersTabRef.current?.toggleHistory) {
      ordersTabRef.current.toggleHistory();
    }
  };

  const handleScanQR = () => {
    setShowQRScanner(true);
  };

  const handleQRScanned = (token: string) => {
    console.log('[AdminDashboard] QR scanned with token:', token);
    
    // Switch to Tables tab
    setActiveTab('tables');
    setShowQRScanner(false);

    // Navigate to the session after a short delay to ensure Tables tab is loaded
    setTimeout(() => {
      if (tablesTabRef.current?.navigateToScannedQR) {
        tablesTabRef.current.navigateToScannedQR(token);
      }
    }, 300);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'tables':
        return <TablesTab ref={tablesTabRef} restaurantId={user.restaurantId} />;
      case 'orders':
        return <OrdersTab ref={ordersTabRef} restaurantId={user.restaurantId} />;
      case 'menu':
        return <MenuTab ref={menuTabRef} restaurantId={user.restaurantId} />;
      case 'staff':
        return <StaffTab ref={staffTabRef} restaurantId={user.restaurantId} />;
      case 'bookings':
        return <BookingsTab ref={bookingsTabRef} restaurantId={user.restaurantId} />;
      case 'reports':
        return <ReportsTab restaurantId={user.restaurantId} />;
      case 'settings':
        return <SettingsTab restaurantId={user.restaurantId} navigation={navigation} />;
      default:
        return null;
    }
  };

  const getTabDisplayName = () => {
    const names: Record<TabType, string> = {
      'tables': 'Tables',
      'orders': 'Orders',
      'menu': 'Menu',
      'staff': 'Staff',
      'bookings': 'Bookings',
      'reports': 'Reports',
      'settings': 'Settings',
    };
    return names[activeTab];
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => setSidebarOpen(!sidebarOpen)}
          style={styles.menuToggleBtn}
        >
          <Text style={styles.menuToggleIcon}>{sidebarOpen ? '◀' : '▶'}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{getTabDisplayName()}</Text>
        <View style={styles.headerCenterActions}>
          {activeTab === 'tables' && (
            <TouchableOpacity 
              style={styles.headerActionBtn}
              onPress={handleEditToggle}
            >
              <Text style={styles.headerActionBtnText}>Edit</Text>
            </TouchableOpacity>
          )}
          {activeTab === 'menu' && (
            <TouchableOpacity 
              style={styles.headerActionBtn}
              onPress={handleMenuEditToggle}
            >
              <Text style={styles.headerActionBtnText}>Edit</Text>
            </TouchableOpacity>
          )}
          {activeTab === 'staff' && (
            <TouchableOpacity 
              style={styles.headerActionBtn}
              onPress={handleStaffEditToggle}
            >
              <Text style={styles.headerActionBtnText}>Edit</Text>
            </TouchableOpacity>
          )}
          {activeTab === 'orders' && (
            <TouchableOpacity 
              style={styles.headerActionBtn}
              onPress={handleHistoryToggle}
            >
              <Text style={styles.headerActionBtnText}>History</Text>
            </TouchableOpacity>
          )}
          {activeTab === 'bookings' && (
            <TouchableOpacity 
              style={styles.headerActionBtn}
              onPress={() => bookingsTabRef.current?.openNewBookingModal()}
            >
              <Text style={styles.headerActionBtnText}>+ New</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity 
            style={styles.headerActionBtn}
            onPress={handleScanQR}
          >
            <Text style={styles.headerActionBtnText}>Scan QR</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity 
          style={styles.adminBtn}
          onPress={openAdminDropdown}
        >
          <Text style={styles.adminBtnText}>Admin ▼</Text>
        </TouchableOpacity>
      </View>

      {/* Main Layout: Sidebar + Content */}
      <View style={styles.mainLayout}>
        {/* Sidebar Navigation */}
        {sidebarOpen && (
          <View style={styles.sidebar}>
            {(['tables', 'orders', 'menu', 'staff', 'bookings', 'reports', 'settings'] as const).map(
              (tab) => {
                const tabLabels: Record<TabType, string> = {
                  'tables': 'Tables',
                  'orders': 'Orders',
                  'menu': 'Menu',
                  'staff': 'Staff',
                  'bookings': 'Bookings',
                  'reports': 'Reports',
                  'settings': 'More',
                };
                return (
                  <TouchableOpacity
                    key={tab}
                    style={[styles.sidebarTab, activeTab === tab && styles.sidebarTabActive]}
                    onPress={() => setActiveTab(tab)}
                  >
                    <Text style={[styles.sidebarTabText, activeTab === tab && styles.sidebarTabTextActive]}>
                      {tabLabels[tab]}
                    </Text>
                  </TouchableOpacity>
                );
              }
            )}
          </View>
        )}

        {/* Content */}
        <View style={styles.content} key={`tab-${activeTab}`}>{renderTabContent()}</View>
      </View>

      {/* QR Scanner Modal */}
      <QRScannerModal
        visible={showQRScanner}
        onClose={() => setShowQRScanner(false)}
        onQRScanned={handleQRScanned}
        restaurantId={user.restaurantId}
      />

      {/* Admin Dropdown Modal */}
      <Modal
        visible={showAdminDropdown}
        animationType="fade"
        transparent
        onRequestClose={() => setShowAdminDropdown(false)}
      >
        <TouchableOpacity
          style={styles.dropdownOverlay}
          onPress={() => setShowAdminDropdown(false)}
          activeOpacity={1}
        >
          <View style={styles.dropdownContent}>
            {/* Restaurants List for Superadmin */}
            {user?.role === 'superadmin' && restaurants.length > 0 && (
              <>
                <Text style={styles.dropdownSectionTitle}>Select Restaurant</Text>
                <View style={styles.restaurantsList}>
                  {restaurants.map((restaurant) => (
                    <TouchableOpacity
                      key={restaurant.id}
                      style={[
                        styles.dropdownItem,
                        parseInt(user.restaurantId) === restaurant.id && styles.dropdownItemActive,
                      ]}
                      onPress={() => {
                        if (parseInt(user.restaurantId) !== restaurant.id) {
                          // TODO: Implement restaurant switching
                          Alert.alert('Restaurant Switch', `Switching to ${restaurant.name}`);
                        }
                        setShowAdminDropdown(false);
                      }}
                    >
                      <Text style={[
                        styles.dropdownItemText,
                        parseInt(user.restaurantId) === restaurant.id && styles.dropdownItemTextActive,
                      ]}>
                        {restaurant.name}
                        {parseInt(user.restaurantId) === restaurant.id && ' ✓'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={styles.dropdownDivider} />
              </>
            )}
            
            {/* Logout */}
            <TouchableOpacity
              style={styles.dropdownItem}
              onPress={handleLogout}
            >
              <Text style={styles.dropdownItemText}>Logout</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
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
    backgroundColor: '#fff',
  },
  header: {
    backgroundColor: '#f9fafb',
    padding: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  menuToggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginLeft: -8,
    backgroundColor: '#2c3e50',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  menuToggleIcon: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    flex: 0,
    minWidth: 80,
  },
  headerCenterActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  headerActionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#2C3E50',
    borderRadius: 6,
  },
  headerActionBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  adminBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#2C3E50',
    borderRadius: 6,
    flexShrink: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  adminBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  dropdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-start',
    paddingTop: 60,
  },
  dropdownContent: {
    backgroundColor: '#fff',
    borderRadius: 8,
    marginHorizontal: 12,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  dropdownItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: 'center',
  },
  dropdownItemText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
  },
  dropdownDivider: {
    height: 1,
    backgroundColor: '#e5e7eb',
  },
  dropdownSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    paddingHorizontal: 16,
    paddingVertical: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  restaurantsList: {
    maxHeight: 250,
  },
  dropdownItemActive: {
    backgroundColor: '#f0f0f0',
  },
  dropdownItemTextActive: {
    color: '#2C3E50',
    fontWeight: '600',
  },
  mainLayout: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebar: {
    width: 100,
    backgroundColor: '#f9fafb',
    borderRightWidth: 2,
    borderRightColor: '#e5e7eb',
    paddingVertical: 0,
  },
  sidebarTab: {
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  sidebarTabActive: {
    borderLeftColor: '#2C3E50',
    backgroundColor: '#ecf0f1',
  },
  sidebarTabText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#1f2937',
    textAlign: 'center',
  },
  sidebarTabTextActive: {
    color: '#2C3E50',
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
});
