import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  FlatList,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '../../services/apiClient';
import { useAuth } from '../../hooks/useAuth';

interface User {
  id: number;
  name: string;
  email: string | null;
  role: string;
  pin: string | null;
  restaurant_id: number | null;
  restaurant_name: string | null;
  access_rights: string[];
  hourly_rate_cents: number | null;
  google_id: string | null;
}

interface Restaurant {
  id: number;
  name: string;
  address: string | null;
  phone: string | null;
  timezone: string | null;
  service_charge_percent: number | null;
  language_preference: string | null;
  user_count: number;
}

type Tab = 'users' | 'restaurants';

const ROLE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  superadmin: { bg: '#fef3c7', text: '#92400e', border: '#f59e0b' },
  admin: { bg: '#dbeafe', text: '#1e40af', border: '#3b82f6' },
  staff: { bg: '#dcfce7', text: '#166534', border: '#22c55e' },
  kitchen: { bg: '#ffedd5', text: '#9a3412', border: '#f97316' },
};

export const UsersTab = ({ onBack }: { onBack: () => void }) => {
  const { user: currentUser } = useAuth();
  const isSuperadmin = currentUser?.role === 'superadmin';

  const [tab, setTab] = useState<Tab>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // User modal
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userForm, setUserForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'staff' as string,
    pin: '',
    restaurant_id: '' as string,
    hourly_rate_cents: '',
  });
  const [saving, setSaving] = useState(false);

  // Restaurant modal
  const [showRestaurantModal, setShowRestaurantModal] = useState(false);
  const [editingRestaurant, setEditingRestaurant] = useState<Restaurant | null>(null);
  const [restaurantForm, setRestaurantForm] = useState({
    name: '',
    address: '',
    phone: '',
    timezone: 'Asia/Hong_Kong',
    service_charge_percent: '10',
    language_preference: 'en',
  });

  const fetchData = useCallback(async () => {
    setFetchError(null);
    try {
      const usersData = await apiClient.getUsers();
      setUsers(usersData);
    } catch (err: any) {
      console.error('[UsersTab] Failed to load users:', err);
      setFetchError(err?.message || 'Failed to load users');
    }
    try {
      const restaurantsData = await apiClient.getRestaurants();
      setRestaurants(restaurantsData);
    } catch (err: any) {
      console.error('[UsersTab] Failed to load restaurants:', err);
      // Only show error if user is superadmin (admins aren't expected to access this)
      if (isSuperadmin && !fetchError) {
        setFetchError(err?.message || 'Failed to load restaurants');
      }
    }
    setLoading(false);
    setRefreshing(false);
  }, [isSuperadmin]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  // ---- User CRUD ----
  const openCreateUser = () => {
    setEditingUser(null);
    setUserForm({
      name: '',
      email: '',
      password: '',
      role: 'staff',
      pin: '',
      restaurant_id: currentUser?.restaurantId || '',
      hourly_rate_cents: '',
    });
    setShowUserModal(true);
  };

  const openEditUser = (u: User) => {
    setEditingUser(u);
    setUserForm({
      name: u.name || '',
      email: u.email || '',
      password: '',
      role: u.role,
      pin: u.pin || '',
      restaurant_id: u.restaurant_id ? String(u.restaurant_id) : '',
      hourly_rate_cents: u.hourly_rate_cents ? String(u.hourly_rate_cents) : '',
    });
    setShowUserModal(true);
  };

  const handleSaveUser = async () => {
    if (!userForm.name.trim()) {
      Alert.alert('Error', 'Name is required');
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, any> = {
        name: userForm.name.trim(),
        role: userForm.role,
      };

      if (userForm.email) payload.email = userForm.email.trim();
      if (userForm.password) payload.password = userForm.password;
      if (userForm.pin) payload.pin = userForm.pin;
      if (userForm.restaurant_id) payload.restaurant_id = parseInt(userForm.restaurant_id);
      if (userForm.hourly_rate_cents) payload.hourly_rate_cents = parseInt(userForm.hourly_rate_cents);

      if (editingUser) {
        await apiClient.updateUser(editingUser.id, payload);
      } else {
        await apiClient.createUser(payload as any);
      }

      setShowUserModal(false);
      await fetchData();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save user');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = (u: User) => {
    Alert.alert(
      'Delete User',
      `Are you sure you want to delete "${u.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.deleteUser(u.id);
              await fetchData();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to delete user');
            }
          },
        },
      ]
    );
  };

  // ---- Restaurant CRUD ----
  const openCreateRestaurant = () => {
    setEditingRestaurant(null);
    setRestaurantForm({
      name: '',
      address: '',
      phone: '',
      timezone: 'Asia/Hong_Kong',
      service_charge_percent: '10',
      language_preference: 'en',
    });
    setShowRestaurantModal(true);
  };

  const openEditRestaurant = (r: Restaurant) => {
    setEditingRestaurant(r);
    setRestaurantForm({
      name: r.name || '',
      address: r.address || '',
      phone: r.phone || '',
      timezone: r.timezone || 'Asia/Hong_Kong',
      service_charge_percent: r.service_charge_percent != null ? String(r.service_charge_percent) : '10',
      language_preference: r.language_preference || 'en',
    });
    setShowRestaurantModal(true);
  };

  const handleSaveRestaurant = async () => {
    if (!restaurantForm.name.trim()) {
      Alert.alert('Error', 'Restaurant name is required');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: restaurantForm.name.trim(),
        address: restaurantForm.address.trim() || undefined,
        phone: restaurantForm.phone.trim() || undefined,
        timezone: restaurantForm.timezone,
        service_charge_percent: parseFloat(restaurantForm.service_charge_percent) || 0,
        language_preference: restaurantForm.language_preference,
      };

      if (editingRestaurant) {
        await apiClient.updateRestaurant(editingRestaurant.id, payload);
      } else {
        await apiClient.createRestaurant(payload);
      }

      setShowRestaurantModal(false);
      await fetchData();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save restaurant');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRestaurant = (r: Restaurant) => {
    Alert.alert(
      'Delete Restaurant',
      `Are you sure you want to delete "${r.name}"? All users must be removed first.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.deleteRestaurant(r.id);
              await fetchData();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to delete restaurant');
            }
          },
        },
      ]
    );
  };

  // ---- Role badge ----
  const RoleBadge = ({ role }: { role: string }) => {
    const colors = ROLE_COLORS[role] || ROLE_COLORS.staff;
    return (
      <View style={[s.roleBadge, { backgroundColor: colors.bg, borderColor: colors.border }]}>
        <Text style={[s.roleBadgeText, { color: colors.text }]}>{role}</Text>
      </View>
    );
  };

  // ---- Render user card ----
  const renderUserCard = ({ item: u }: { item: User }) => {
    const isCurrentUser = u.id === parseInt(currentUser?.userId || '0');
    return (
      <View style={s.card}>
        <View style={s.cardHeader}>
          <View style={{ flex: 1 }}>
            <View style={s.nameRow}>
              <Text style={s.cardName}>{u.name}</Text>
              <RoleBadge role={u.role} />
            </View>
            {u.email && <Text style={s.cardSub}>{u.email}</Text>}
            {u.pin && <Text style={s.cardSub}>PIN: {u.pin}</Text>}
            {(u.role === 'staff' || u.role === 'kitchen') && u.hourly_rate_cents != null && (
              <Text style={s.cardSub}>Rate: ${(u.hourly_rate_cents / 100).toFixed(2)}/hr</Text>
            )}
            <Text style={s.cardRestaurant}>
              {u.restaurant_name || (u.restaurant_id ? `Restaurant #${u.restaurant_id}` : 'No restaurant')}
            </Text>
          </View>
          <View style={s.cardActions}>
            <TouchableOpacity style={s.iconBtn} onPress={() => openEditUser(u)}>
              <Ionicons name="pencil" size={18} color="#3b82f6" />
            </TouchableOpacity>
            {!isCurrentUser && (
              <TouchableOpacity style={s.iconBtn} onPress={() => handleDeleteUser(u)}>
                <Ionicons name="trash" size={18} color="#ef4444" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  // ---- Render restaurant card ----
  const renderRestaurantCard = ({ item: r }: { item: Restaurant }) => (
    <View style={s.card}>
      <View style={s.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={s.cardName}>{r.name}</Text>
          {r.address && <Text style={s.cardSub}>{r.address}</Text>}
          {r.phone && <Text style={s.cardSub}>{r.phone}</Text>}
          <View style={s.restaurantMeta}>
            <Text style={s.metaChip}>{r.user_count} users</Text>
            {r.timezone && <Text style={s.metaChip}>{r.timezone}</Text>}
            {r.service_charge_percent != null && (
              <Text style={s.metaChip}>{r.service_charge_percent}% SC</Text>
            )}
          </View>
        </View>
        <View style={s.cardActions}>
          <TouchableOpacity style={s.iconBtn} onPress={() => openEditRestaurant(r)}>
            <Ionicons name="pencil" size={18} color="#3b82f6" />
          </TouchableOpacity>
          {isSuperadmin && (
            <TouchableOpacity style={s.iconBtn} onPress={() => handleDeleteRestaurant(r)}>
              <Ionicons name="trash" size={18} color="#ef4444" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );

  // ---- Role needs PIN or email/password ----
  const needsPin = userForm.role === 'staff' || userForm.role === 'kitchen';
  const needsEmail = userForm.role === 'admin' || userForm.role === 'superadmin';
  const availableRoles = isSuperadmin
    ? ['superadmin', 'admin', 'staff', 'kitchen']
    : ['staff', 'kitchen'];

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  return (
    <View style={s.wrapper}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} style={s.backBtn}>
          <Ionicons name="arrow-back" size={20} color="#4f46e5" />
          <Text style={s.backBtnText}> Back</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Users & Restaurants</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Tab bar */}
      <View style={s.tabBar}>
        <TouchableOpacity
          style={[s.tabBtn, tab === 'users' && s.tabBtnActive]}
          onPress={() => setTab('users')}
        >
          <Ionicons name="people-outline" size={16} color={tab === 'users' ? '#4f46e5' : '#6b7280'} />
          <Text style={[s.tabBtnText, tab === 'users' && s.tabBtnTextActive]}>
            Users ({users.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.tabBtn, tab === 'restaurants' && s.tabBtnActive]}
          onPress={() => setTab('restaurants')}
        >
          <Ionicons name="storefront-outline" size={16} color={tab === 'restaurants' ? '#4f46e5' : '#6b7280'} />
          <Text style={[s.tabBtnText, tab === 'restaurants' && s.tabBtnTextActive]}>
            Restaurants ({restaurants.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Users list */}
      {tab === 'users' && (
        <FlatList
          data={users}
          renderItem={renderUserCard}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={s.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListHeaderComponent={
            <>
              {fetchError && (
                <View style={s.errorBanner}>
                  <Text style={s.errorBannerText}>⚠ {fetchError}</Text>
                  <TouchableOpacity onPress={onRefresh}>
                    <Text style={s.errorBannerRetry}>Retry</Text>
                  </TouchableOpacity>
                </View>
              )}
              <TouchableOpacity style={s.addBtn} onPress={openCreateUser}>
                <Ionicons name="add-circle-outline" size={20} color="#fff" />
                <Text style={s.addBtnText}>Create User</Text>
              </TouchableOpacity>
            </>
          }
          ListEmptyComponent={<Text style={s.emptyText}>{fetchError ? 'Could not load users' : 'No users found'}</Text>}
        />
      )}

      {/* Restaurants list */}
      {tab === 'restaurants' && (
        <FlatList
          data={restaurants}
          renderItem={renderRestaurantCard}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={s.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListHeaderComponent={
            isSuperadmin ? (
              <TouchableOpacity style={s.addBtn} onPress={openCreateRestaurant}>
                <Ionicons name="add-circle-outline" size={20} color="#fff" />
                <Text style={s.addBtnText}>Create Restaurant</Text>
              </TouchableOpacity>
            ) : null
          }
          ListEmptyComponent={<Text style={s.emptyText}>No restaurants found</Text>}
        />
      )}

      {/* ========== User Modal ========== */}
      <Modal supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']} visible={showUserModal} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>{editingUser ? 'Edit User' : 'Create User'}</Text>
              <TouchableOpacity onPress={() => setShowUserModal(false)}>
                <Text style={s.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={s.modalBody} keyboardShouldPersistTaps="handled">
              <Text style={s.label}>Name *</Text>
              <TextInput
                style={s.input}
                value={userForm.name}
                onChangeText={(t) => setUserForm({ ...userForm, name: t })}
                placeholder="Full name"
                placeholderTextColor="#9ca3af"
              />

              <Text style={s.label}>Role *</Text>
              <View style={s.roleRow}>
                {availableRoles.map((r) => {
                  const colors = ROLE_COLORS[r];
                  const active = userForm.role === r;
                  return (
                    <TouchableOpacity
                      key={r}
                      style={[s.roleChip, active && { backgroundColor: colors.bg, borderColor: colors.border }]}
                      onPress={() => setUserForm({ ...userForm, role: r })}
                    >
                      <Text style={[s.roleChipText, active && { color: colors.text }]}>{r}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {needsEmail && (
                <>
                  <Text style={s.label}>Email {!editingUser ? '*' : ''}</Text>
                  <TextInput
                    style={s.input}
                    value={userForm.email}
                    onChangeText={(t) => setUserForm({ ...userForm, email: t })}
                    placeholder="user@example.com"
                    placeholderTextColor="#9ca3af"
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />

                  <Text style={s.label}>Password {!editingUser ? '*' : '(leave blank to keep)'}</Text>
                  <TextInput
                    style={s.input}
                    value={userForm.password}
                    onChangeText={(t) => setUserForm({ ...userForm, password: t })}
                    placeholder={editingUser ? 'Leave blank to keep' : 'Min 8 characters'}
                    placeholderTextColor="#9ca3af"
                    secureTextEntry
                  />
                </>
              )}

              {needsPin && (
                <>
                  <Text style={s.label}>PIN (6 digits) *</Text>
                  <TextInput
                    style={s.input}
                    value={userForm.pin}
                    onChangeText={(t) => setUserForm({ ...userForm, pin: t.replace(/[^0-9]/g, '').slice(0, 6) })}
                    placeholder="000000"
                    placeholderTextColor="#9ca3af"
                    keyboardType="number-pad"
                    maxLength={6}
                  />
                </>
              )}

              {isSuperadmin && (
                <>
                  <Text style={s.label}>Restaurant</Text>
                  <View style={s.restaurantPicker}>
                    {restaurants.map((r) => (
                      <TouchableOpacity
                        key={r.id}
                        style={[
                          s.restaurantOption,
                          userForm.restaurant_id === String(r.id) && s.restaurantOptionActive,
                        ]}
                        onPress={() => setUserForm({ ...userForm, restaurant_id: String(r.id) })}
                      >
                        <Text
                          style={[
                            s.restaurantOptionText,
                            userForm.restaurant_id === String(r.id) && s.restaurantOptionTextActive,
                          ]}
                        >
                          {r.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              {(userForm.role === 'staff' || userForm.role === 'kitchen') && (
                <>
                  <Text style={s.label}>Hourly Rate (cents)</Text>
                  <TextInput
                    style={s.input}
                    value={userForm.hourly_rate_cents}
                    onChangeText={(t) => setUserForm({ ...userForm, hourly_rate_cents: t.replace(/[^0-9]/g, '') })}
                    placeholder="e.g. 1500 = $15/hr"
                    placeholderTextColor="#9ca3af"
                    keyboardType="number-pad"
                  />
                </>
              )}
            </ScrollView>

            <View style={s.modalFooter}>
              <TouchableOpacity
                style={s.cancelBtn}
                onPress={() => setShowUserModal(false)}
                disabled={saving}
              >
                <Text style={s.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.saveBtn, saving && { opacity: 0.5 }]}
                onPress={handleSaveUser}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={s.saveBtnText}>{editingUser ? 'Save' : 'Create'}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========== Restaurant Modal ========== */}
      <Modal supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']} visible={showRestaurantModal} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>
                {editingRestaurant ? 'Edit Restaurant' : 'Create Restaurant'}
              </Text>
              <TouchableOpacity onPress={() => setShowRestaurantModal(false)}>
                <Text style={s.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={s.modalBody} keyboardShouldPersistTaps="handled">
              <Text style={s.label}>Restaurant Name *</Text>
              <TextInput
                style={s.input}
                value={restaurantForm.name}
                onChangeText={(t) => setRestaurantForm({ ...restaurantForm, name: t })}
                placeholder="Restaurant name"
                placeholderTextColor="#9ca3af"
              />

              <Text style={s.label}>Address</Text>
              <TextInput
                style={s.input}
                value={restaurantForm.address}
                onChangeText={(t) => setRestaurantForm({ ...restaurantForm, address: t })}
                placeholder="123 Main St, City"
                placeholderTextColor="#9ca3af"
              />

              <Text style={s.label}>Phone</Text>
              <TextInput
                style={s.input}
                value={restaurantForm.phone}
                onChangeText={(t) => setRestaurantForm({ ...restaurantForm, phone: t })}
                placeholder="+852 1234 5678"
                placeholderTextColor="#9ca3af"
                keyboardType="phone-pad"
              />

              <Text style={s.label}>Service Charge (%)</Text>
              <TextInput
                style={s.input}
                value={restaurantForm.service_charge_percent}
                onChangeText={(t) => setRestaurantForm({ ...restaurantForm, service_charge_percent: t })}
                placeholder="10"
                placeholderTextColor="#9ca3af"
                keyboardType="decimal-pad"
              />

              <Text style={s.label}>Language</Text>
              <View style={s.roleRow}>
                {[
                  { value: 'en', label: 'English' },
                  { value: 'zh', label: '中文' },
                ].map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[s.roleChip, restaurantForm.language_preference === opt.value && s.roleChipActive]}
                    onPress={() => setRestaurantForm({ ...restaurantForm, language_preference: opt.value })}
                  >
                    <Text
                      style={[
                        s.roleChipText,
                        restaurantForm.language_preference === opt.value && s.roleChipTextActive,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.label}>Timezone</Text>
              <View style={s.roleRow}>
                {[
                  { value: 'Asia/Hong_Kong', label: 'HKT' },
                  { value: 'America/New_York', label: 'EST' },
                  { value: 'Europe/London', label: 'GMT' },
                  { value: 'UTC', label: 'UTC' },
                ].map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[s.roleChip, restaurantForm.timezone === opt.value && s.roleChipActive]}
                    onPress={() => setRestaurantForm({ ...restaurantForm, timezone: opt.value })}
                  >
                    <Text
                      style={[
                        s.roleChipText,
                        restaurantForm.timezone === opt.value && s.roleChipTextActive,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <View style={s.modalFooter}>
              <TouchableOpacity
                style={s.cancelBtn}
                onPress={() => setShowRestaurantModal(false)}
                disabled={saving}
              >
                <Text style={s.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.saveBtn, saving && { opacity: 0.5 }]}
                onPress={handleSaveRestaurant}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={s.saveBtnText}>{editingRestaurant ? 'Save' : 'Create'}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const s = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  backBtnText: {
    color: '#4f46e5',
    fontWeight: '600',
    fontSize: 14,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1f2937',
  },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
  },
  tabBtnActive: {
    backgroundColor: '#eef2ff',
    borderWidth: 1,
    borderColor: '#c7d2fe',
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
  tabBtnTextActive: {
    color: '#4f46e5',
  },

  // List
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },

  // Add button
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#4f46e5',
    paddingVertical: 12,
    borderRadius: 10,
    marginBottom: 14,
  },
  addBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },

  // Cards
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  cardName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1f2937',
  },
  cardSub: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  cardRestaurant: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 4,
    fontStyle: 'italic',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
    marginLeft: 8,
  },
  iconBtn: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#f3f4f6',
  },

  // Role badge
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },

  // Restaurant meta
  restaurantMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  metaChip: {
    fontSize: 11,
    color: '#4b5563',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: 'hidden',
  },

  emptyText: {
    fontSize: 13,
    color: '#9ca3af',
    textAlign: 'center',
    paddingVertical: 32,
  },
  errorBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderColor: '#fca5a5',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  errorBannerText: {
    fontSize: 13,
    color: '#dc2626',
    flex: 1,
  },
  errorBannerRetry: {
    fontSize: 13,
    color: '#dc2626',
    fontWeight: '700',
    marginLeft: 8,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
  },
  closeBtn: {
    fontSize: 22,
    color: '#6b7280',
  },
  modalBody: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },

  // Form elements
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    fontSize: 14,
    color: '#1f2937',
  },
  roleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  roleChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#f9fafb',
  },
  roleChipActive: {
    backgroundColor: '#eef2ff',
    borderColor: '#4f46e5',
  },
  roleChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
  roleChipTextActive: {
    color: '#4f46e5',
  },

  // Restaurant picker
  restaurantPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  restaurantOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#f9fafb',
  },
  restaurantOptionActive: {
    backgroundColor: '#eef2ff',
    borderColor: '#4f46e5',
  },
  restaurantOptionText: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
  restaurantOptionTextActive: {
    color: '#4f46e5',
    fontWeight: '600',
  },

  // Buttons
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  saveBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#4f46e5',
    alignItems: 'center',
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
});
