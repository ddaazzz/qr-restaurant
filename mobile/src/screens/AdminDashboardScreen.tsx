import React, { useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { TablesTab } from './admin/TablesTab';
import { MenuTab } from './admin/MenuTab';
import { OrdersTab } from './admin/OrdersTab';
import { StaffTab } from './admin/StaffTab';
import { SettingsTab } from './admin/SettingsTab';
import { BookingsTab } from './admin/BookingsTab';
import { ReportsTab } from './admin/ReportsTab';

type ActiveTab = 'tables' | 'orders' | 'menu' | 'staff' | 'bookings' | 'reports' | 'settings';

export const AdminDashboardScreen = ({ navigation }: any) => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>('tables');
  const ordersTabRef = useRef(null);

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
        return <OrdersTab ref={ordersTabRef} restaurantId={user.restaurantId} />;
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
        <Text style={styles.title}>Admin Panel</Text>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* Tab Navigation */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.tabBarContainer}
        contentContainerStyle={styles.tabBar}
      >
        {(['tables', 'orders', 'menu', 'staff', 'bookings', 'reports', 'settings'] as const).map(
          (tab) => (
            <TouchableOpacity
              key={tab}
              style={[
                styles.tabButton,
                activeTab === tab && styles.tabButtonActive,
              ]}
              onPress={() => setActiveTab(tab)}
            >
              <Text
                style={[
                  styles.tabButtonText,
                  activeTab === tab && styles.tabButtonTextActive,
                ]}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          )
        )}
      </ScrollView>

      {/* Tab Content */}
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
    paddingHorizontal: 20,
    paddingVertical: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#1976D2',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  logoutButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 4,
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  tabBarContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    gap: 4,
  },
  tabButton: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginVertical: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 6,
    marginHorizontal: 2,
  },
  tabButtonActive: {
    backgroundColor: '#2196F3',
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  tabButtonTextActive: {
    color: '#fff',
  },
  content: {
    flex: 1,
    backgroundColor: '#fff',
  },
});
