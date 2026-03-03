import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useTables } from '../hooks/useAPI';
import { useAuth } from '../hooks/useAuth';

export const AdminDashboardScreen = ({ navigation }: any) => {
  const { user, logout } = useAuth();
  const { tables, loading, error, refetch } = useTables(user?.restaurantId || '');
  const [activeTab, setActiveTab] = useState<'tables' | 'menu' | 'staff' | 'settings'>(
    'tables'
  );

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

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.button} onPress={refetch}>
          <Text style={styles.buttonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Admin Dashboard</Text>
        <TouchableOpacity onPress={handleLogout}>
          <Text style={styles.logoutBtn}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabBar}>
        {(['tables', 'menu', 'staff', 'settings'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.activeTab]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <ScrollView style={styles.content}>
        {activeTab === 'tables' && (
          <View>
            <TouchableOpacity style={styles.addButton}>
              <Text style={styles.addButtonText}>+ Add Table</Text>
            </TouchableOpacity>

            <View style={styles.tablesList}>
              {tables.length > 0 ? (
                tables.map((table: any) => (
                  <View key={table.id} style={styles.tableCard}>
                    <View style={styles.tableInfo}>
                      <Text style={styles.tableNumber}>Table {table.number}</Text>
                      <Text style={styles.tableCapacity}>Capacity: {table.capacity}</Text>
                    </View>
                    <TouchableOpacity style={styles.tableAction}>
                      <Text style={styles.tableActionText}>Manage</Text>
                    </TouchableOpacity>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>No tables configured</Text>
              )}
            </View>
          </View>
        )}

        {activeTab === 'menu' && (
          <View>
            <TouchableOpacity style={styles.addButton}>
              <Text style={styles.addButtonText}>+ Add Item</Text>
            </TouchableOpacity>
            <Text style={styles.sectionText}>Menu items management</Text>
          </View>
        )}

        {activeTab === 'staff' && (
          <View>
            <TouchableOpacity style={styles.addButton}>
              <Text style={styles.addButtonText}>+ Add Staff</Text>
            </TouchableOpacity>
            <Text style={styles.sectionText}>Staff members management</Text>
          </View>
        )}

        {activeTab === 'settings' && (
          <View>
            <View style={styles.settingsSection}>
              <TouchableOpacity
                style={styles.settingsItem}
                onPress={() => navigation.navigate('PrinterSettings')}
              >
                <Text style={styles.settingsItemText}>Printer Configuration</Text>
                <Text style={styles.settingsItemArrow}>›</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.settingsItem}>
                <Text style={styles.settingsItemText}>Restaurant Settings</Text>
                <Text style={styles.settingsItemArrow}>›</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.settingsItem}>
                <Text style={styles.settingsItemText}>POS Integration</Text>
                <Text style={styles.settingsItemArrow}>›</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
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
    backgroundColor: '#2196F3',
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
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 3,
    borderBottomColor: '#2196F3',
  },
  tabText: {
    fontSize: 14,
    color: '#666',
  },
  activeTabText: {
    color: '#2196F3',
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 15,
  },
  addButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 15,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  tablesList: {
    gap: 10,
  },
  tableCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  tableInfo: {
    flex: 1,
  },
  tableNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  tableCapacity: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  tableAction: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 6,
  },
  tableActionText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    marginTop: 40,
    fontSize: 16,
  },
  sectionText: {
    fontSize: 16,
    color: '#666',
    marginTop: 20,
    textAlign: 'center',
  },
  settingsSection: {
    gap: 10,
  },
  settingsItem: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  settingsItemText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  settingsItemArrow: {
    fontSize: 20,
    color: '#999',
  },
  button: {
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  errorText: {
    color: '#f44336',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
});
