import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, FlatList, RefreshControl, Modal, ScrollView, TextInput, Alert } from 'react-native';
import { apiClient } from '../../services/apiClient';
import { useLanguage } from '../../contexts/LanguageContext';

interface StaffMember {
  id: number;
  name: string;
  role: string;
  pin?: string;
  access_rights?: string[] | number[];
  hourly_rate_cents?: number;
  currently_clocked_in?: boolean;
  stats?: {
    total_shifts: number;
    total_hours: number;
  };
  timekeeping?: TimekeepingRecord[];
}

interface TimekeepingRecord {
  clock_in_at: string;
  clock_out_at?: string;
  duration_minutes?: number;
}

interface MenuCategory {
  id: number;
  name: string;
}

export interface StaffTabRef {
  toggleEditMode: () => void;
}

export const StaffTab = forwardRef<StaffTabRef, { restaurantId: string }>(({ restaurantId }, ref) => {
  const { t } = useLanguage();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [menuCategories, setMenuCategories] = useState<MenuCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [editMode, setEditMode] = useState(false);
  
  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingStaffId, setEditingStaffId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    pin: '',
    role: 'staff' as 'staff' | 'kitchen',
    hourlyRate: '',
    accessRights: [] as (string | number)[],
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Detail modal state
  const [selectedStaff, setSelectedStaff] = useState<(StaffMember & { timekeeping?: TimekeepingRecord[] }) | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const fetchStaff = async () => {
    try {
      setError(null);
      const response = await apiClient.get(`/api/restaurants/${restaurantId}/staff`);
      setStaff(response.data as StaffMember[]);
    } catch (err: any) {
      console.error('Error fetching staff:', err);
      setError(err.message || 'Failed to load staff');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchMenuCategories = async () => {
    try {
      const response = await apiClient.get(`/api/restaurants/${restaurantId}/menu_categories`);
      setMenuCategories(response.data as MenuCategory[]);
    } catch (err: any) {
      console.error('Error fetching categories:', err);
    }
  };

  useEffect(() => {
    fetchStaff();
    fetchMenuCategories();
  }, [restaurantId]);

  useImperativeHandle(ref, () => ({
    toggleEditMode() {
      setEditMode(prev => !prev);
    }
  }), []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchStaff();
  };

  const resetForm = () => {
    setFormData({
      name: '',
      pin: '',
      role: 'staff',
      hourlyRate: '',
      accessRights: [],
    });
    setFormError(null);
    setFormSuccess(null);
    setEditingStaffId(null);
  };

  const openForm = (staffMember?: StaffMember) => {
    if (staffMember) {
      setEditingStaffId(staffMember.id);
      setFormData({
        name: staffMember.name,
        pin: staffMember.pin || '',
        role: (staffMember.role as 'staff' | 'kitchen') || 'staff',
        hourlyRate: staffMember.hourly_rate_cents ? (staffMember.hourly_rate_cents / 100).toFixed(2) : '',
        accessRights: staffMember.access_rights || [],
      });
    } else {
      resetForm();
    }
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    resetForm();
  };

  const toggleAccessRight = (right: string | number) => {
    setFormData(prev => {
      const rights = prev.accessRights;
      const index = rights.indexOf(right);
      if (index > -1) {
        rights.splice(index, 1);
      } else {
        rights.push(right);
      }
      return { ...prev, accessRights: [...rights] };
    });
  };

  const handleSubmitStaff = async () => {
    setFormError(null);
    const name = formData.name.trim();
    const pin = formData.pin.trim();
    const { role, hourlyRate, accessRights } = formData;

    if (!name) {
      setFormError('Name is required');
      return;
    }
    if (!pin) {
      setFormError('PIN is required');
      return;
    }
    if (pin.length !== 6 || isNaN(Number(pin))) {
      setFormError('PIN must be exactly 6 digits');
      return;
    }
    if (hourlyRate && isNaN(Number(hourlyRate))) {
      setFormError('Hourly rate must be a valid number');
      return;
    }

    try {
      const hourly_rate_cents = hourlyRate ? Math.round(Number(hourlyRate) * 100) : null;
      const payload = {
        name,
        pin,
        role,
        access_rights: accessRights,
        hourly_rate_cents,
      };

      if (editingStaffId) {
        await apiClient.patch(`/api/restaurants/${restaurantId}/staff/${editingStaffId}`, payload);
        setFormSuccess('Staff member updated successfully');
      } else {
        await apiClient.post(`/api/restaurants/${restaurantId}/staff`, payload);
        setFormSuccess('Staff member created successfully');
      }

      setTimeout(() => {
        closeForm();
        fetchStaff();
      }, 1000);
    } catch (err: any) {
      setFormError(err.message || 'Failed to save staff');
    }
  };

  const handleDeleteStaff = async (staffId: number) => {
    Alert.alert('Delete Staff', 'Are you sure you want to delete this staff member?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        onPress: async () => {
          try {
            await apiClient.delete(`/api/restaurants/${restaurantId}/staff/${staffId}`);
            setStaff(staff.filter(s => s.id !== staffId));
            setShowDetailModal(false);
            setSelectedStaff(null);
          } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to delete staff');
          }
        },
        style: 'destructive',
      },
    ]);
  };

  const openDetailModal = async (staffMember: StaffMember) => {
    try {
      const response = await apiClient.get(`/api/restaurants/${restaurantId}/staff/${staffMember.id}`);
      setSelectedStaff(response.data as StaffMember);
      setShowDetailModal(true);
    } catch (err: any) {
      Alert.alert('Error', 'Failed to load staff details');
    }
  };

  const handleClockInOut = async (staffId: number, action: 'in' | 'out') => {
    try {
      const endpoint = action === 'in' ? 'clock-in' : 'clock-out';
      await apiClient.post(`/api/restaurants/${restaurantId}/staff/${staffId}/${endpoint}`, {});
      if (selectedStaff) {
        const updated = await apiClient.get(`/api/restaurants/${restaurantId}/staff/${staffId}`);
        setSelectedStaff(updated.data as StaffMember);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || `Failed to clock ${action}`);
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return '#3b82f6';
      case 'staff': return '#10b981';
      case 'kitchen': return '#ff6b6b';
      default: return '#6b7280';
    }
  };

  const getAccessLabel = (right: string | number) => {
    if (typeof right === 'string') return right.charAt(0).toUpperCase() + right.slice(1);
    const accessMap: { [key: number]: string } = {
      1: 'Orders',
      2: 'Tables',
      3: 'Menu',
      4: 'Staff',
      5: 'Settings',
      6: 'Bookings',
    };
    return accessMap[right] || `Feature ${right}`;
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#5a5a5a" />
      </View>
    );
  }

  // Tab access options for staff role
  const tabAccessOptions = [
    { id: 'orders', label: 'Orders' },
    { id: 'tables', label: 'Tables' },
    { id: 'menu', label: 'Menu' },
    { id: 'staff', label: 'Staff' },
    { id: 'settings', label: 'Settings' },
    { id: 'bookings', label: 'Bookings' },
  ];

  return (
    <View style={styles.container}>
      {/* Staff Grid */}
      <FlatList
        data={editMode ? [{ id: 'add' }, ...staff] : staff}
        keyExtractor={(item, idx) => (item.id ? item.id.toString() : `add-${idx}`)}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        renderItem={({ item }) => {
          if (item.id === 'add') {
            return (
              <View style={styles.staffCardContainer}>
                <TouchableOpacity
                  style={[styles.staffCard, styles.addStaffCard]}
                  onPress={() => openForm()}
                >
                  <Text style={styles.addStaffIcon}>➕</Text>
                  <Text style={styles.addStaffText}>Add Staff</Text>
                </TouchableOpacity>
              </View>
            );
          }

          const s = item as StaffMember;
          const accessDisplay =
            s.access_rights && s.access_rights.length > 0
              ? s.access_rights.map(r => getAccessLabel(r)).join(', ')
              : 'No access';

          return (
            <View style={styles.staffCardContainer}>
              <TouchableOpacity
                style={styles.staffCard}
                onPress={() => !editMode && openDetailModal(s)}
              >
                <Text style={styles.staffCardName}>{s.name}</Text>
                <View style={[styles.staffCardRole, { backgroundColor: getRoleColor(s.role) + '30' }]}>
                  <Text style={[styles.staffCardRoleText, { color: getRoleColor(s.role) }]}>
                    {s.role === 'kitchen' ? '🍳 Kitchen' : '👤 Staff'}
                  </Text>
                </View>
                {s.pin && (
                  <Text style={styles.staffCardPin}>PIN: {s.pin}</Text>
                )}
                <Text style={styles.staffCardAccess}>{accessDisplay}</Text>
                {editMode && (
                  <View style={styles.staffCardActions}>
                    <TouchableOpacity
                      style={[styles.cardActionBtn, styles.editCardBtn]}
                      onPress={() => openForm(s)}
                    >
                      <Text style={styles.cardActionBtnText}>✏️</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.cardActionBtn, styles.deleteCardBtn]}
                      onPress={() => handleDeleteStaff(s.id)}
                    >
                      <Text style={styles.cardActionBtnText}>🗑️</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          );
        }}
        contentContainerStyle={styles.gridContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No staff members</Text>
          </View>
        }
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      />

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Create/Edit Form Modal */}
      <Modal visible={showForm} transparent animationType="fade" onRequestClose={closeForm}>
        <View style={styles.formOverlay}>
          <View style={styles.formContent}>
            <View style={styles.formHeader}>
              <Text style={styles.formTitle}>{editingStaffId ? 'Edit Staff' : 'Create New Staff'}</Text>
              <TouchableOpacity onPress={closeForm}>
                <Text style={styles.formCloseBtn}>✕</Text>
              </TouchableOpacity>
            </View>

            {formError && <Text style={styles.formError}>{formError}</Text>}
            {formSuccess && <Text style={styles.formSuccess}>{formSuccess}</Text>}

            <ScrollView style={styles.formBody}>
              {/* Name */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Staff Name</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g., John Smith"
                  value={formData.name}
                  onChangeText={(text) => setFormData({ ...formData, name: text })}
                />
              </View>

              {/* PIN */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>PIN (6 digits)</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g., 123456"
                  value={formData.pin}
                  onChangeText={(text) => setFormData({ ...formData, pin: text.slice(0, 6) })}
                  maxLength={6}
                  keyboardType="numeric"
                />
              </View>

              {/* Role */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Role</Text>
                <View style={styles.roleButtons}>
                  {['staff', 'kitchen'].map((roleOption) => (
                    <TouchableOpacity
                      key={roleOption}
                      style={[
                        styles.roleBtn,
                        formData.role === roleOption && styles.roleBtnActive,
                      ]}
                      onPress={() => setFormData({ ...formData, role: roleOption as 'staff' | 'kitchen', accessRights: [] })}
                    >
                      <Text
                        style={[
                          styles.roleBtnText,
                          formData.role === roleOption && styles.roleBtnTextActive,
                        ]}
                      >
                        {roleOption === 'kitchen' ? '🍳 Kitchen' : '👤 Staff'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Hourly Rate */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Hourly Rate ($/hr)</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g., 15.50"
                  value={formData.hourlyRate}
                  onChangeText={(text) => setFormData({ ...formData, hourlyRate: text })}
                  keyboardType="decimal-pad"
                />
              </View>

              {/* Access Rights */}
              {formData.role === 'staff' ? (
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Tab Access Permissions</Text>
                  <View style={styles.accessGrid}>
                    {tabAccessOptions.map((option) => (
                      <TouchableOpacity
                        key={option.id}
                        style={[
                          styles.accessCheckbox,
                          formData.accessRights.includes(option.id) && styles.accessCheckboxActive,
                        ]}
                        onPress={() => toggleAccessRight(option.id)}
                      >
                        <Text
                          style={[
                            styles.accessCheckboxText,
                            formData.accessRights.includes(option.id) && styles.accessCheckboxTextActive,
                          ]}
                        >
                          {formData.accessRights.includes(option.id) ? '✓' : '○'} {option.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ) : (
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Food Categories Access</Text>
                  <View style={styles.accessGrid}>
                    {menuCategories.map((cat) => (
                      <TouchableOpacity
                        key={cat.id}
                        style={[
                          styles.accessCheckbox,
                          formData.accessRights.includes(cat.id) && styles.accessCheckboxActive,
                        ]}
                        onPress={() => toggleAccessRight(cat.id)}
                      >
                        <Text
                          style={[
                            styles.accessCheckboxText,
                            formData.accessRights.includes(cat.id) && styles.accessCheckboxTextActive,
                          ]}
                        >
                          {formData.accessRights.includes(cat.id) ? '✓' : '○'} {cat.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Form Actions */}
            <View style={styles.formActions}>
              <TouchableOpacity style={[styles.formBtn, styles.formBtnCancel]} onPress={closeForm}>
                <Text style={styles.formBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.formBtn, styles.formBtnSubmit]} onPress={handleSubmitStaff}>
                <Text style={[styles.formBtnText, styles.formBtnSubmitText]}>
                  {editingStaffId ? '💾 Update' : '➕ Add'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Detail Modal */}
      <Modal visible={showDetailModal} transparent animationType="fade" onRequestClose={() => setShowDetailModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.detailModalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowDetailModal(false)}>
                <Text style={styles.modalCloseBtn}>✕</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{selectedStaff?.name}</Text>
              <View style={{ width: 24 }} />
            </View>

            <ScrollView style={styles.modalBody}>
              {selectedStaff && (
                <>
                  {/* Staff Info */}
                  <View style={styles.infoSection}>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Role</Text>
                      <Text style={styles.infoValue}>
                        {selectedStaff.role === 'kitchen' ? '🍳 Kitchen' : '👤 Staff'}
                      </Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>PIN</Text>
                      <Text style={[styles.infoValue, { fontFamily: 'monospace' }]}>{selectedStaff.pin || '-'}</Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Hourly Rate</Text>
                      <Text style={styles.infoValue}>
                        {selectedStaff.hourly_rate_cents
                          ? `$${(selectedStaff.hourly_rate_cents / 100).toFixed(2)}/hr`
                          : 'Not set'}
                      </Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Status</Text>
                      <Text style={[styles.infoValue, { color: selectedStaff.currently_clocked_in ? '#10b981' : '#999' }]}>
                        {selectedStaff.currently_clocked_in ? '🟢 Clocked In' : '⚪ Clocked Out'}
                      </Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Access</Text>
                      <Text style={styles.infoValue}>
                        {selectedStaff.access_rights && selectedStaff.access_rights.length > 0
                          ? selectedStaff.access_rights.map(r => getAccessLabel(r)).join(', ')
                          : 'No access'}
                      </Text>
                    </View>
                  </View>

                  {/* Clock In/Out */}
                  <View style={styles.clockSection}>
                    <Text style={styles.sectionTitle}>Clock In/Out</Text>
                    <View style={styles.clockButtons}>
                      {!selectedStaff.currently_clocked_in ? (
                        <TouchableOpacity
                          style={[styles.clockBtn, styles.clockInBtn]}
                          onPress={() => handleClockInOut(selectedStaff.id, 'in')}
                        >
                          <Text style={styles.clockBtnText}>▶ Clock In</Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          style={[styles.clockBtn, styles.clockOutBtn]}
                          onPress={() => handleClockInOut(selectedStaff.id, 'out')}
                        >
                          <Text style={styles.clockBtnText}>⏹ Clock Out</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>

                  {/* Work Hours Summary */}
                  {selectedStaff.stats && (
                    <View style={styles.statsSection}>
                      <Text style={styles.sectionTitle}>Work Hours (Last 30 Days)</Text>
                      <View style={styles.statsRow}>
                        <View style={styles.statBox}>
                          <Text style={styles.statLabel}>Days Worked</Text>
                          <Text style={styles.statValue}>{selectedStaff.stats.total_shifts}</Text>
                        </View>
                        <View style={styles.statBox}>
                          <Text style={styles.statLabel}>Total Hours</Text>
                          <Text style={styles.statValue}>{selectedStaff.stats.total_hours.toFixed(1)}h</Text>
                        </View>
                      </View>
                    </View>
                  )}

                  {/* Timekeeping List */}
                  {selectedStaff.timekeeping && selectedStaff.timekeeping.length > 0 && (
                    <View style={styles.timekeepingSection}>
                      <Text style={styles.sectionTitle}>Work Log (Last 30 Days)</Text>
                      {selectedStaff.timekeeping.map((record, idx) => {
                        const clockIn = new Date(record.clock_in_at);
                        const clockOut = record.clock_out_at ? new Date(record.clock_out_at) : null;
                        const hours = record.duration_minutes ? (record.duration_minutes / 60).toFixed(1) : '—';
                        const dateStr = clockIn.toLocaleDateString();
                        const timeInStr = clockIn.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        const timeOutStr = clockOut
                          ? clockOut.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : 'Still working';

                        return (
                          <View key={idx} style={styles.timekeepingRow}>
                            <View style={styles.timekeepingLeft}>
                              <Text style={styles.timekeepingDate}>{dateStr}</Text>
                              <Text style={styles.timekeepingTime}>{timeInStr} → {timeOutStr}</Text>
                            </View>
                            <Text style={styles.timekeepingHours}>{hours}h</Text>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </>
              )}
            </ScrollView>

            {/* Modal Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalActionBtn, styles.modalEditBtn]}
                onPress={() => {
                  setShowDetailModal(false);
                  if (selectedStaff) openForm(selectedStaff);
                }}
              >
                <Text style={styles.modalActionBtnText}>✏️ Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalActionBtn, styles.deleteBtn]}
                onPress={() => {
                  if (selectedStaff) handleDeleteStaff(selectedStaff.id);
                }}
              >
                <Text style={styles.modalActionBtnText}>🗑️ Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridContent: {
    padding: 12,
  },
  gridRow: {
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 12,
  },
  staffCardContainer: {
    flex: 1,
  },
  staffCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    minHeight: 160,
    flex: 1,
  },
  addStaffCard: {
    borderStyle: 'dashed',
    backgroundColor: '#f9f9f9',
    borderColor: '#d0d0d0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addStaffIcon: {
    fontSize: 32,
    marginBottom: 6,
  },
  addStaffText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    textAlign: 'center',
  },
  staffCardName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 10,
    textAlign: 'center',
  },
  staffCardRole: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginBottom: 8,
    alignSelf: 'center',
  },
  staffCardRoleText: {
    fontSize: 13,
    fontWeight: '600',
  },
  staffCardPin: {
    fontSize: 11,
    color: '#999',
    marginBottom: 8,
    backgroundColor: '#f5f5f5',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    fontFamily: 'monospace',
  },
  staffCardAccess: {
    fontSize: 10,
    color: '#999',
    marginBottom: 8,
    maxHeight: 50,
    lineHeight: 14,
  },
  staffCardActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    width: '100%',
    justifyContent: 'center',
  },
  cardActionBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    flex: 1,
    alignItems: 'center',
  },
  editCardBtn: {
    backgroundColor: '#3b82f6',
  },
  deleteCardBtn: {
    backgroundColor: '#ef4444',
  },
  cardActionBtnText: {
    color: '#fff',
    fontSize: 16,
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
  },

  // Form styles
  formOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  formContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '95%',
    paddingTop: 0,
    flexDirection: 'column',
    height: '100%',
  },
  formHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  formTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  formCloseBtn: {
    fontSize: 24,
    color: '#999',
  },
  formError: {
    backgroundColor: '#fee',
    color: '#c33',
    padding: 10,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 6,
    fontSize: 13,
    fontWeight: '500',
  },
  formSuccess: {
    backgroundColor: '#efe',
    color: '#3c3',
    padding: 10,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 6,
    fontSize: 13,
    fontWeight: '500',
  },
  formBody: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 16,
  },
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  formInput: {
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 14,
    color: '#1f2937',
    backgroundColor: '#f9f9f9',
  },
  roleButtons: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  roleBtn: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f9f9f9',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleBtnActive: {
    backgroundColor: '#2C3E50',
    borderColor: '#2C3E50',
  },
  roleBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
  },
  roleBtnTextActive: {
    color: '#fff',
  },
  accessGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
  },
  accessCheckbox: {
    width: '48%',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#f9f9f9',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  accessCheckboxActive: {
    backgroundColor: '#2C3E50',
    borderColor: '#2C3E50',
  },
  accessCheckboxText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#1f2937',
    textAlign: 'center',
  },
  accessCheckboxTextActive: {
    color: '#fff',
  },
  formActions: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  formBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  formBtnCancel: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  formBtnSubmit: {
    backgroundColor: '#10b981',
  },
  formBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  formBtnSubmitText: {
    color: '#fff',
  },

  // Detail modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  detailModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '90%',
    paddingTop: 0,
    flexDirection: 'column',
    height: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalCloseBtn: {
    fontSize: 24,
    color: '#666',
    fontWeight: '600',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  modalBody: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 16,
  },
  infoSection: {
    backgroundColor: '#f9f9f9',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 2,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  infoLabel: {
    fontSize: 13,
    color: '#666',
    fontWeight: '600',
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  clockSection: {
    backgroundColor: '#f0f7ff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  clockButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  clockBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  clockInBtn: {
    backgroundColor: '#10b981',
  },
  clockOutBtn: {
    backgroundColor: '#ef4444',
  },
  clockBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  statsSection: {
    backgroundColor: '#f9f9f9',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 15,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#999',
    fontWeight: '500',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  timekeepingSection: {
    backgroundColor: '#f9f9f9',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
  },
  timekeepingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  timekeepingLeft: {
    flex: 1,
  },
  timekeepingDate: {
    fontSize: 12,
    color: '#999',
    fontWeight: '500',
  },
  timekeepingTime: {
    fontSize: 13,
    color: '#1f2937',
    marginTop: 2,
  },
  timekeepingHours: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10b981',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  modalActionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalEditBtn: {
    backgroundColor: '#5a5a5a',
  },
  deleteBtn: {
    backgroundColor: '#ef4444',
  },
  modalActionBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
