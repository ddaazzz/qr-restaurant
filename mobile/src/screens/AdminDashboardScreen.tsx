import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView,
} from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { TablesTab, TablesTabRef } from './admin/TablesTab';
import { MenuTab, MenuTabRef } from './admin/MenuTab';
import { OrdersTab } from './admin/OrdersTab';
import { StaffTab } from './admin/StaffTab';
import { SettingsTab } from './admin/SettingsTab';
import { BookingsTab } from './admin/BookingsTab';
import { ReportsTab } from './admin/ReportsTab';

type TabType = 'tables' | 'orders' | 'menu' | 'staff' | 'bookings' | 'reports' | 'settings';

export const AdminDashboardScreen = ({ navigation }: any) => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('tables');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const tablesTabRef = useRef<TablesTabRef>(null);
  const menuTabRef = useRef<MenuTabRef>(null);
  const ordersTabRef = useRef<any>(null);

  if (!user?.restaurantId) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
      </SafeAreaView>
    );
  }

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

  const handleHistoryToggle = () => {
    if (ordersTabRef.current?.toggleHistory) {
      ordersTabRef.current.toggleHistory();
    }
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
        return <StaffTab restaurantId={user.restaurantId} />;
      case 'bookings':
        return <BookingsTab restaurantId={user.restaurantId} />;
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
        <View style={styles.headerActions}>
          {activeTab === 'tables' && (
            <TouchableOpacity 
              style={styles.headerActionBtn}
              onPress={handleEditToggle}
            >
              <Text style={styles.headerActionBtnText}>✎ Edit</Text>
            </TouchableOpacity>
          )}
          {activeTab === 'menu' && (
            <TouchableOpacity 
              style={styles.headerActionBtn}
              onPress={handleMenuEditToggle}
            >
              <Text style={styles.headerActionBtnText}>✎ Edit</Text>
            </TouchableOpacity>
          )}
          {activeTab === 'orders' && (
            <TouchableOpacity 
              style={styles.headerActionBtn}
              onPress={handleHistoryToggle}
            >
              <Text style={styles.headerActionBtnText}>📜 History</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtnContainer}>
            <Text style={styles.logoutBtn}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Layout: Sidebar + Content */}
      <View style={styles.mainLayout}>
        {/* Sidebar Navigation */}
        {sidebarOpen && (
          <View style={styles.sidebar}>
            {(['tables', 'orders', 'menu', 'staff', 'bookings', 'reports', 'settings'] as const).map(
              (tab) => (
                <TouchableOpacity
                  key={tab}
                  style={[styles.sidebarTab, activeTab === tab && styles.sidebarTabActive]}
                  onPress={() => setActiveTab(tab)}
                >
                  <Text style={[styles.sidebarTabText, activeTab === tab && styles.sidebarTabTextActive]}>
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </Text>
                </TouchableOpacity>
              )
            )}
          </View>
        )}

        {/* Content */}
        <View style={styles.content} key={`tab-${activeTab}`}>{renderTabContent()}</View>
      </View>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
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
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerActionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#5a5a5a',
    borderRadius: 6,
  },
  headerActionBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  logoutBtnContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  logoutBtn: {
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#5a5a5a',
    color: '#ffffff',
    borderRadius: 6,
    overflow: 'hidden',
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
    borderLeftColor: '#5a5a5a',
    backgroundColor: '#e0e0e0',
  },
  sidebarTabText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#1f2937',
    textAlign: 'center',
  },
  sidebarTabTextActive: {
    color: '#5a5a5a',
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
});
