import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
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
  TextInput,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from '../contexts/TranslationContext';
import { useToast } from '../components/ToastProvider';
import { QRScannerModal } from '../components/QRScannerModal';
import { TablesTab, TablesTabRef } from './admin/TablesTab';
import { MenuTab, MenuTabRef } from './admin/MenuTab';
import { StaffTab, StaffTabRef } from './admin/StaffTab';
import { OrdersTab } from './admin/OrdersTab';
import { SettingsTab } from './admin/SettingsTab';
import { BookingsTab, BookingsTabRef } from './admin/BookingsTab';
import { ReportsTab } from './admin/ReportsTab';
import { API_URL, apiClient } from '../services/apiClient';

type TabType = 'tables' | 'orders' | 'menu' | 'staff' | 'bookings' | 'reports' | 'settings';

// Map access_rights IDs to tab names
const ACCESS_RIGHTS_TAB_MAP: Record<number, TabType> = {
  1: 'orders',
  2: 'tables',
  3: 'menu',
  4: 'staff',
  5: 'settings',
  6: 'bookings',
  7: 'reports',
};

// Also handle string-based access_rights
const ACCESS_RIGHTS_STRING_MAP: Record<string, TabType> = {
  orders: 'orders',
  tables: 'tables',
  menu: 'menu',
  staff: 'staff',
  settings: 'settings',
  bookings: 'bookings',
  reports: 'reports',
};

export const AdminDashboardScreen = ({ navigation }: any) => {
  const { user, logout, updateUser, switchRestaurant } = useAuth();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<TabType>('tables');
  const isTabletDevice = (Platform as any).isPad;
  const [sidebarOpen, setSidebarOpen] = useState(isTabletDevice);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showAdminDropdown, setShowAdminDropdown] = useState(false);
  const [restaurants, setRestaurants] = useState<Array<{ id: number; name: string }>>([]);
  const [orderForTableData, setOrderForTableData] = useState<{ sessionId: number; tableName: string } | null>(null);
  const [clockLoading, setClockLoading] = useState(false);
  const [showClockInPrompt, setShowClockInPrompt] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [tableCategories, setTableCategories] = useState<Array<{ id: number; name?: string; key?: string }>>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const [showRoomDropdown, setShowRoomDropdown] = useState(false);
  const [unpaidOrderCount, setUnpaidOrderCount] = useState(0);
  const [featureFlags, setFeatureFlags] = useState<Record<string, boolean>>({});
  const tablesTabRef = useRef<TablesTabRef>(null);
  const menuTabRef = useRef<MenuTabRef>(null);
  const staffTabRef = useRef<StaffTabRef>(null);
  const ordersTabRef = useRef<any>(null);
  const bookingsTabRef = useRef<BookingsTabRef>(null);

  // Load unpaid order count for sidebar badge
  const loadUnpaidCount = useCallback(async () => {
    try {
      const response = await apiClient.get(`/api/restaurants/${user.restaurantId}/orders?limit=500`);
      const allOrders = Array.isArray(response.data) ? response.data : [];
      const count = allOrders.filter((o: any) => {
        const effStatus = o.cp_status || o.payment_status;
        const isPaid = o.payment_received || effStatus === 'completed' || effStatus === 'paid';
        const isVoided = effStatus === 'voided' || effStatus === 'cancelled';
        const isRefunded = effStatus === 'refunded';
        return !isPaid && !isVoided && !isRefunded && o.total_cents > 0;
      }).length;
      setUnpaidOrderCount(count);
    } catch (err) {
      // Ignore errors
    }
  }, [user?.restaurantId]);

  useEffect(() => {
    loadUnpaidCount();
    const interval = setInterval(loadUnpaidCount, 30000);
    return () => clearInterval(interval);
  }, [loadUnpaidCount]);

  // Fetch restaurant feature flags
  useEffect(() => {
    if (!user?.restaurantId) return;
    apiClient.get(`/api/restaurants/${user.restaurantId}/config`)
      .then((res: any) => {
        if (res.data?.feature_flags) setFeatureFlags(res.data.feature_flags);
      })
      .catch(() => {});
  }, [user?.restaurantId]);

  // Show clock-in prompt for staff who haven't clocked in
  useEffect(() => {
    if (user?.role === 'staff' && !user?.currently_clocked_in) {
      setShowClockInPrompt(true);
    }
  }, []);

  // Compute visible tabs based on role and access_rights
  const visibleTabs = useMemo((): TabType[] => {
    const allTabs: TabType[] = ['tables', 'orders', 'menu', 'staff', 'bookings', 'reports', 'settings'];
    
    // Admin and superadmin always see all tabs
    if (!user || user.role === 'admin' || user.role === 'superadmin') {
      return allTabs;
    }

    // Staff role: filter based on access_rights
    if (user.role === 'staff' && user.access_rights) {
      const rights = user.access_rights;
      const allowedTabs = new Set<TabType>(['tables']); // tables always visible

      if (Array.isArray(rights)) {
        rights.forEach((right: string | number) => {
          if (typeof right === 'number' && ACCESS_RIGHTS_TAB_MAP[right]) {
            allowedTabs.add(ACCESS_RIGHTS_TAB_MAP[right]);
          } else if (typeof right === 'string' && ACCESS_RIGHTS_STRING_MAP[right]) {
            allowedTabs.add(ACCESS_RIGHTS_STRING_MAP[right]);
          }
        });
      }

      return allTabs.filter(tab => allowedTabs.has(tab));
    }

    return allTabs;
  }, [user]);

  // Filter tabs by feature flags (opt-out: hidden only if explicitly false)
  const TAB_FLAG_MAP: Record<string, string> = { bookings: 'bookings', staff: 'staff_timekeeping' };
  const filteredTabs = useMemo(() => {
    return visibleTabs.filter(tab => {
      const flag = TAB_FLAG_MAP[tab];
      return !flag || featureFlags[flag] !== false;
    });
  }, [visibleTabs, featureFlags]);

  // Clock In/Out handler
  const handleClockToggle = async () => {
    if (!user?.userId || !user?.restaurantId) return;
    setClockLoading(true);
    try {
      const isClockedIn = user.currently_clocked_in;
      const endpoint = isClockedIn
        ? `/api/restaurants/${user.restaurantId}/staff/${user.userId}/clock-out`
        : `/api/restaurants/${user.restaurantId}/staff/${user.userId}/clock-in`;
      await apiClient.post(endpoint, { restaurantId: user.restaurantId });
      updateUser({ currently_clocked_in: !isClockedIn });
      showToast(t(isClockedIn ? 'common.clocked-out' : 'common.clocked-in'), 'success');
    } catch (err: any) {
      showToast(err.message || t('common.failed'), 'error');
    } finally {
      setClockLoading(false);
    }
  };

  if (!user?.restaurantId) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
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
        const response = await fetch(`${API_URL}/api/auth/restaurants`, {
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
    Alert.alert(t('common.logout'), t('common.are-you-sure'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.logout'),
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

  const handleQRScanned = (data: { sessionId: number; tableName: string; token: string }) => {
    // Switch to Tables tab
    setActiveTab('tables');
    setShowQRScanner(false);

    // Navigate to the session after a short delay to ensure Tables tab is loaded
    setTimeout(() => {
      if (tablesTabRef.current?.navigateToScannedQR) {
        tablesTabRef.current.navigateToScannedQR(data.sessionId);
      }
    }, 300);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'tables':
        return <TablesTab ref={tablesTabRef} restaurantId={user.restaurantId} searchQuery={searchQuery} selectedRoomId={selectedRoomId} onCategoriesLoaded={setTableCategories} onOrderForTable={(sessionId: number, tableName: string) => {
          setOrderForTableData({ sessionId, tableName });
          setActiveTab('orders');
        }} />;
      case 'orders':
        return <OrdersTab ref={ordersTabRef} restaurantId={user.restaurantId} selectedTableOnInit={orderForTableData} searchQuery={searchQuery} onNavigateToTables={() => setActiveTab('tables')} />;
      case 'menu':
        return <MenuTab ref={menuTabRef} restaurantId={user.restaurantId} searchQuery={searchQuery} />;
      case 'staff':
        return <StaffTab ref={staffTabRef} restaurantId={user.restaurantId} searchQuery={searchQuery} />;
      case 'bookings':
        return <BookingsTab ref={bookingsTabRef} restaurantId={user.restaurantId} searchQuery={searchQuery} />;
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
      'tables': t('admin.tables'),
      'orders': t('admin.orders'),
      'menu': t('admin.menu'),
      'staff': t('admin.staff'),
      'bookings': t('admin.bookings'),
      'reports': t('admin.reports'),
      'settings': t('admin.settings'),
    };
    return names[activeTab];
  };

  const getSearchPlaceholder = () => {
    const placeholders: Record<TabType, string> = {
      'tables': 'Search table number...',
      'orders': 'Search food item...',
      'menu': 'Search food item...',
      'staff': 'Search staff name...',
      'bookings': 'Search name, phone, email...',
      'reports': '',
      'settings': '',
    };
    return placeholders[activeTab];
  };

  const showSearchBar = activeTab !== 'reports' && activeTab !== 'settings';

  return (
    <View style={styles.rootContainer}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={[styles.header, isTabletDevice && { marginLeft: 138 }]}>
        {!isTabletDevice && (
        <TouchableOpacity 
          onPress={() => setSidebarOpen(!sidebarOpen)}
          style={styles.menuToggleBtn}
        >
          <Ionicons name={sidebarOpen ? 'chevron-back' : 'menu'} size={20} color="#374151" />
        </TouchableOpacity>
        )}
        <Text style={[styles.title, !isTabletDevice && { fontSize: 16 }]}>{getTabDisplayName()}</Text>
        <View style={styles.headerRightSection}>
          {showSearchBar && (
            <View style={[styles.searchBarContainer, !isTabletDevice && { maxWidth: 140 }]}>
              <Ionicons name="search" size={16} color="#9ca3af" style={{ marginLeft: 8 }} />
              <TextInput
                style={styles.searchInput}
                placeholder={getSearchPlaceholder()}
                placeholderTextColor="#9ca3af"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
          )}
          {activeTab === 'tables' && (
            <View style={{ position: 'relative' }}>
              <TouchableOpacity
                style={styles.roomFilterBtn}
                onPress={() => setShowRoomDropdown(!showRoomDropdown)}
              >
                <Ionicons name="filter" size={14} color="#374151" />
                <Text style={styles.roomFilterBtnText} numberOfLines={1}>
                  {selectedRoomId
                    ? (tableCategories.find(c => c.id === selectedRoomId)?.key || tableCategories.find(c => c.id === selectedRoomId)?.name || 'Room')
                    : 'All Rooms'}
                </Text>
                <Ionicons name="chevron-down" size={12} color="#374151" />
              </TouchableOpacity>
              {showRoomDropdown && (
                <View style={styles.roomDropdown}>
                  <TouchableOpacity
                    style={[styles.roomDropdownItem, !selectedRoomId && styles.roomDropdownItemActive]}
                    onPress={() => { setSelectedRoomId(null); setShowRoomDropdown(false); }}
                  >
                    <Text style={[styles.roomDropdownItemText, !selectedRoomId && styles.roomDropdownItemTextActive]}>All Rooms</Text>
                  </TouchableOpacity>
                  {tableCategories.map(cat => (
                    <TouchableOpacity
                      key={cat.id}
                      style={[styles.roomDropdownItem, selectedRoomId === cat.id && styles.roomDropdownItemActive]}
                      onPress={() => { setSelectedRoomId(cat.id); setShowRoomDropdown(false); }}
                    >
                      <Text style={[styles.roomDropdownItemText, selectedRoomId === cat.id && styles.roomDropdownItemTextActive]}>
                        {cat.key || cat.name || `Category ${cat.id}`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}
        <View style={styles.headerCenterActions}>
          {activeTab === 'tables' && (
            <TouchableOpacity 
              style={[styles.headerActionBtn, !isTabletDevice && styles.headerActionBtnPhone]}
              onPress={handleEditToggle}
            >
              {isTabletDevice ? (
                <Text style={styles.headerActionBtnText}>{t('common.edit')}</Text>
              ) : (
                <Ionicons name="pencil" size={16} color="#fff" />
              )}
            </TouchableOpacity>
          )}
          {activeTab === 'staff' && (
            <TouchableOpacity 
              style={[styles.headerActionBtn, !isTabletDevice && styles.headerActionBtnPhone]}
              onPress={handleStaffEditToggle}
            >
              {isTabletDevice ? (
                <Text style={styles.headerActionBtnText}>{t('common.edit')}</Text>
              ) : (
                <Ionicons name="pencil" size={16} color="#fff" />
              )}
            </TouchableOpacity>
          )}
          {activeTab === 'menu' && (
            <TouchableOpacity 
              style={[styles.headerActionBtn, !isTabletDevice && styles.headerActionBtnPhone]}
              onPress={handleMenuEditToggle}
            >
              {isTabletDevice ? (
                <Text style={styles.headerActionBtnText}>{t('common.edit')}</Text>
              ) : (
                <Ionicons name="pencil" size={16} color="#fff" />
              )}
            </TouchableOpacity>
          )}
          {activeTab === 'orders' && (
            <TouchableOpacity 
              style={[styles.headerActionBtn, !isTabletDevice && styles.headerActionBtnPhone]}
              onPress={handleHistoryToggle}
            >
              {isTabletDevice ? (
                <Text style={styles.headerActionBtnText}>{t('admin.order-history')}</Text>
              ) : (
                <Ionicons name="time" size={16} color="#fff" />
              )}
            </TouchableOpacity>
          )}
          {activeTab === 'bookings' && (
            <TouchableOpacity 
              style={[styles.headerActionBtn, !isTabletDevice && styles.headerActionBtnPhone]}
              onPress={() => bookingsTabRef.current?.openNewBookingModal()}
            >
              {isTabletDevice ? (
                <Text style={styles.headerActionBtnText}>+ {t('common.new')}</Text>
              ) : (
                <Ionicons name="add" size={18} color="#fff" />
              )}
            </TouchableOpacity>
          )}
          <TouchableOpacity 
            style={[styles.headerActionBtn, !isTabletDevice && styles.headerActionBtnPhone]}
            onPress={handleScanQR}
          >
            {isTabletDevice ? (
              <Text style={styles.headerActionBtnText}>{t('admin.scan-qr')}</Text>
            ) : (
              <Ionicons name="qr-code" size={16} color="#fff" />
            )}
          </TouchableOpacity>
          {user?.role === 'staff' && (
            <TouchableOpacity 
              style={[
                styles.headerActionBtn,
                !isTabletDevice && styles.headerActionBtnPhone,
                { backgroundColor: user?.currently_clocked_in ? '#e74c3c' : '#27ae60' },
              ]}
              onPress={handleClockToggle}
              disabled={clockLoading}
            >
              {clockLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : isTabletDevice ? (
                <Text style={styles.headerActionBtnText}>
                  {user?.currently_clocked_in ? t('admin.clock-out') : t('admin.clock-in')}
                </Text>
              ) : (
                <Ionicons name={user?.currently_clocked_in ? 'log-out' : 'log-in'} size={16} color="#fff" />
              )}
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity 
          style={[styles.adminBtn, !isTabletDevice && styles.headerActionBtnPhone]}
          onPress={openAdminDropdown}
        >
          {isTabletDevice ? (
            <Text style={styles.adminBtnText}>Admin <Ionicons name="chevron-down" size={12} color="#374151" /></Text>
          ) : (
            <Ionicons name="person-circle" size={18} color="#fff" />
          )}
        </TouchableOpacity>
        </View>{/* end headerRightSection */}
      </View>

      {/* Main Layout — content area with left margin for sidebar */}
      <View style={[styles.mainLayout, isTabletDevice && { marginLeft: 138 }]}>
        <View style={styles.content} key={`tab-${activeTab}`}>{renderTabContent()}</View>
      </View>
      </SafeAreaView>

      {/* Sidebar backdrop for iPhone overlay */}
      {!isTabletDevice && sidebarOpen && (
        <TouchableOpacity
          style={styles.sidebarBackdrop}
          activeOpacity={1}
          onPress={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — rendered OUTSIDE SafeAreaView, positioned absolutely to fill full screen height */}
      {(isTabletDevice || sidebarOpen) && (
        <View style={[styles.sidebarAbsolute, !isTabletDevice && styles.sidebarAbsolutePhone, !isTabletDevice && { zIndex: 11 }]}>
          <SafeAreaView style={[styles.sidebarSafeArea, !isTabletDevice && styles.sidebarSafeAreaPhone]}>
            {/* Brand at top */}
            <View style={styles.sidebarBrandContainer}>
              <Text style={styles.sidebarBrand}>chuio.io</Text>
            </View>

            {/* Tab buttons — fill remaining space */}
            <ScrollView style={styles.sidebarTabsContainer} contentContainerStyle={{ flex: 1, justifyContent: 'space-evenly' }} showsVerticalScrollIndicator={false}>
              {filteredTabs.map(
                (tab) => {
                  const tabConfig: Record<TabType, { label: string; icon: string }> = {
                    'tables': { label: t('admin.tables'), icon: 'grid' },
                    'orders': { label: t('admin.orders'), icon: 'receipt' },
                    'menu': { label: t('admin.menu'), icon: 'restaurant' },
                    'staff': { label: t('admin.staff'), icon: 'people' },
                    'bookings': { label: t('admin.bookings'), icon: 'calendar' },
                    'reports': { label: t('admin.reports'), icon: 'stats-chart' },
                    'settings': { label: t('admin.more'), icon: 'cog' },
                  };
                  const config = tabConfig[tab];
                  const iconSize = isTabletDevice ? 36 : 26;
                  return (
                    <TouchableOpacity
                      key={tab}
                      style={[styles.sidebarTab, !isTabletDevice && styles.sidebarTabPhone, activeTab === tab && styles.sidebarTabActive]}
                      onPress={() => { setActiveTab(tab); setSearchQuery(''); if (!isTabletDevice) setSidebarOpen(false); }}
                    >
                      <View style={{ position: 'relative' }}>
                        <Ionicons 
                          name={config.icon as any} 
                          size={iconSize} 
                          color={activeTab === tab ? '#fff' : 'rgba(255,255,255,0.55)'} 
                          style={isTabletDevice ? styles.sidebarIcon : styles.sidebarIconPhone}
                        />
                        {tab === 'orders' && unpaidOrderCount > 0 && (
                          <View style={{ position: 'absolute', top: -4, right: -8, backgroundColor: '#ef4444', borderRadius: 9, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 }}>
                            <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>{unpaidOrderCount > 99 ? '99+' : unpaidOrderCount}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.sidebarTabText, !isTabletDevice && styles.sidebarTabTextPhone, activeTab === tab && styles.sidebarTabTextActive]}>
                        {config.label}
                      </Text>
                    </TouchableOpacity>
                  );
                }
              )}
            </ScrollView>
          </SafeAreaView>
        </View>
      )}
      <Modal supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}
        visible={showClockInPrompt}
        animationType="fade"
        transparent
        onRequestClose={() => setShowClockInPrompt(false)}
      >
        <View style={styles.clockPromptOverlay}>
          <View style={styles.clockPromptCard}>
            <Ionicons name="time-outline" size={40} color="#4f46e5" style={{ marginBottom: 12 }} />
            <Text style={styles.clockPromptTitle}>You haven't clocked in yet</Text>
            <Text style={styles.clockPromptSubtitle}>Would you like to clock in now?</Text>
            <View style={styles.clockPromptButtons}>
              <TouchableOpacity
                style={styles.clockPromptBtnPrimary}
                onPress={async () => {
                  setShowClockInPrompt(false);
                  await handleClockToggle();
                }}
              >
                <Text style={styles.clockPromptBtnPrimaryText}>Clock In</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.clockPromptBtnSecondary}
                onPress={() => setShowClockInPrompt(false)}
              >
                <Text style={styles.clockPromptBtnSecondaryText}>Skip</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* QR Scanner Modal */}
      <QRScannerModal
        visible={showQRScanner}
        onClose={() => setShowQRScanner(false)}
        onQRScanned={handleQRScanned}
        restaurantId={user.restaurantId}
      />

      {/* Admin Dropdown Modal */}
      <Modal supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}
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
                <Text style={styles.dropdownSectionTitle}>{t('admin.select-restaurant')}</Text>
                <View style={styles.restaurantsList}>
                  {restaurants.map((restaurant) => (
                    <TouchableOpacity
                      key={restaurant.id}
                      style={[
                        styles.dropdownItem,
                        parseInt(user.restaurantId) === restaurant.id && styles.dropdownItemActive,
                      ]}
                      onPress={async () => {
                        if (parseInt(user.restaurantId) !== restaurant.id) {
                          await switchRestaurant(String(restaurant.id));
                          showToast(`${t('admin.switched-to') || 'Switched to'} ${restaurant.name}`, 'success');
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
              <Text style={styles.dropdownItemText}>{t('common.logout')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  safeArea: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  header: {
    backgroundColor: '#f9fafb',
    paddingVertical: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    height: 70,
  },
  menuToggleBtn: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: 'transparent',
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
    fontSize: 22,
    fontWeight: '700',
    color: '#1f2937',
    flexShrink: 0,
  },
  headerRightSection: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
  searchBarContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    height: 36,
    maxWidth: 280,
  },
  searchInput: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 0,
    fontSize: 14,
    color: '#1f2937',
    height: '100%',
  },
  roomFilterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    height: 36,
  },
  roomFilterBtnText: {
    fontSize: 13,
    color: '#374151',
    maxWidth: 100,
  },
  roomDropdown: {
    position: 'absolute',
    top: 40,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    minWidth: 150,
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 5,
  },
  roomDropdownItem: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  roomDropdownItemActive: {
    backgroundColor: '#eff6ff',
  },
  roomDropdownItemText: {
    fontSize: 14,
    color: '#374151',
  },
  roomDropdownItemTextActive: {
    color: '#2563eb',
    fontWeight: '600',
  },
  headerCenterActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
    flexWrap: 'nowrap',
    overflow: 'hidden',
  },
  headerActionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#2C3E50',
    borderRadius: 6,
    flexShrink: 0,
  },
  headerActionBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  adminBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#2C3E50',
    borderRadius: 6,
    flexShrink: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  adminBtnText: {
    fontSize: 13,
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
  },
  sidebarAbsolute: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: 130,
    paddingTop: Platform.OS === 'ios' ? 38 : 0,
    paddingLeft: 6,
    paddingBottom: 0,
    zIndex: 10,
  },
  sidebarSafeArea: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 16,
    paddingHorizontal: 6,
    paddingVertical: 12,
    overflow: 'hidden',
  },
  sidebarBrandContainer: {
    alignItems: 'center',
    paddingBottom: 6,
    marginTop: 8,
    marginBottom: 0,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  sidebarBrand: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
  sidebarTabsContainer: {
    flex: 1,
  },
  sidebarTab: {
    paddingVertical: 14,
    paddingHorizontal: 6,
    marginHorizontal: 4,
    marginVertical: 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderRadius: 8,
  },
  sidebarTabPhone: {
    paddingVertical: 8,
    marginVertical: 1,
    gap: 2,
  },
  sidebarIcon: {
    width: 36,
    height: 36,
  },
  sidebarIconPhone: {
    width: 26,
    height: 26,
  },
  sidebarTabActive: {
    backgroundColor: '#3b82f6',
  },
  sidebarTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    lineHeight: 14,
  },
  sidebarTabTextPhone: {
    fontSize: 10,
    lineHeight: 12,
  },
  sidebarTabTextActive: {
    color: '#fff',
  },
  content: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  clockPromptOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  clockPromptCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  clockPromptTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  clockPromptSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 24,
    textAlign: 'center',
  },
  clockPromptButtons: {
    width: '100%',
    gap: 10,
  },
  clockPromptBtnPrimary: {
    backgroundColor: '#4f46e5',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  clockPromptBtnPrimaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  clockPromptBtnSecondary: {
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  clockPromptBtnSecondaryText: {
    color: '#6b7280',
    fontSize: 16,
    fontWeight: '500',
  },
  sidebarBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    zIndex: 9,
  },
  headerActionBtnPhone: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    minWidth: 36,
    alignItems: 'center' as any,
    justifyContent: 'center' as any,
  },
  sidebarAbsolutePhone: {
    paddingTop: 0,
    paddingLeft: 0,
    paddingBottom: 0,
    width: 80,
    backgroundColor: '#1e293b',
  },
  sidebarSafeAreaPhone: {
    borderRadius: 0,
    paddingHorizontal: 4,
    paddingVertical: 0,
  },
});
