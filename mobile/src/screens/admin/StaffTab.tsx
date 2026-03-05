import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, FlatList, RefreshControl, Modal, ScrollView, TextInput } from 'react-native';
import { apiClient } from '../../services/apiClient';

interface StaffMember {
  id: number;
  name: string;
  role: string;
  pin?: string;
  access_rights?: number[];
  hourly_rate_cents?: number;
}

export const StaffTab = ({ restaurantId }: { restaurantId: string }) => {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [showModal, setShowModal] = useState(false);

  const fetchStaff = async () => {
    try {
      setError(null);
      const response = await apiClient.get<StaffMember[]>(`/api/restaurants/${restaurantId}/staff`);
      setStaff(response.data);
    } catch (err: any) {
      console.error('Error fetching staff:', err);
      setError(err.message || 'Failed to load staff');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [restaurantId]);

  const fetchData = async () => {
    setLoading(true);
    await fetchStaff();
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchStaff();
  };

  const deleteStaff = async (staffId: number) => {
    try {
      await apiClient.delete(`/api/restaurants/${restaurantId}/staff/${staffId}`);
      setStaff(staff.filter(s => s.id !== staffId));
    } catch (err: any) {
      console.error('Error deleting staff:', err);
      alert('Failed to delete staff');
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return '#3b82f6';
      case 'staff': return '#10b981';
      case 'kitchen': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={staff}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <View style={styles.staffCard}>
            <View style={styles.staffHeader}>
              <View style={styles.staffInfo}>
                <Text style={styles.staffName}>{item.name}</Text>
                <View style={[styles.roleBadge, { backgroundColor: getRoleColor(item.role) }]}>
                  <Text style={styles.roleBadgeText}>{item.role}</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => deleteStaff(item.id)}
                style={styles.deleteBtn}
              >
                <Text style={styles.deleteBtnText}>🗑️</Text>
              </TouchableOpacity>
            </View>
            {item.hourly_rate_cents !== undefined && item.hourly_rate_cents !== null && (
              <Text style={styles.staffDetail}>Rate: ${(item.hourly_rate_cents / 100).toFixed(2)}/hr</Text>
            )}
            {item.access_rights && item.access_rights.length > 0 && (
              <Text style={styles.staffDetail}>Features: {item.access_rights.join(', ')}</Text>
            )}
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No staff members</Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      />

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={fetchData} style={styles.retryBtn}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
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
  listContent: {
    padding: 12,
  },
  staffCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  staffHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  staffInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  staffName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  roleBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  roleBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  deleteBtn: {
    padding: 8,
  },
  deleteBtnText: {
    fontSize: 18,
  },
  staffDetail: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
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
});
