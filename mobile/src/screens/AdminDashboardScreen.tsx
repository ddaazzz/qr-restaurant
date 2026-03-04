import React, { useState } from 'react';
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
import { TablesTab } from './admin/TablesTab';
import { MenuTab } from './admin/MenuTab';
import { OrdersTab } from './admin/OrdersTab';
import { StaffTab } from './admin/StaffTab';
import { SettingsTab } from './admin/SettingsTab';
import { BookingsTab } from './admin/BookingsTab';
import { ReportsTab } from './admin/ReportsTab';

type TabType = 'tables' | 'orders' | 'menu' | 'staff' | 'bookings' | 'reports' | 'settings';

export const AdminDashboardScreen = ({ navigation }: any) => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('tables');

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

  const renderTabContent = () => {
    switch (activeTab) {
      case 'tables':
        return <TablesTab restaurantId={user.restaurantId} />;
      case 'orders':
        return <OrdersTab restaurantId={user.restaurantId} />;
      case 'menu':
        return <MenuTab restaurantId={user.restaurantId} />;
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

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Admin Dashboard</Text>
        <TouchableOpacity onPress={handleLogout}>
          <Text style={styles.logoutBtn}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabBar}>
        {(['tables', 'orders', 'menu', 'staff', 'bookings', 'reports', 'settings'] as const).map(
          (tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.activeTab]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          )
        )}
      </View>

      {/* Content */}
      <View style={styles.content}>{renderTabContent()}</View>
    </SafeAreaView>
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
    backgroundColor: '#fff',
  },
  header: {
    backgroundColor: '#2196F3',
    padding: 20,
    paddingTop: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  logoutBtn: {
    color: '#fff',
    fontSize: 14,
    padding: 8,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    paddingHorizontal: 5,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTab: {
    borderBottomWidth: 3,
    borderBottomColor: '#2196F3',
  },
  tabText: {
    fontSize: 12,
    color: '#666',
  },
  activeTabText: {
    color: '#2196F3',
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
});
