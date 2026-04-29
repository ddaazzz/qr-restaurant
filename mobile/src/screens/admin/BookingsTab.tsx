import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Modal,
  TextInput,
  Platform,
  Alert,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '../../services/apiClient';
import { useTranslation } from '../../contexts/TranslationContext';
import { useToast } from '../../components/ToastProvider';

interface Booking {
  id: number;
  guest_name: string;
  date?: string;
  booking_date?: string;
  time?: string;
  booking_time?: string;
  party_size?: number;
  pax?: number;
  phone?: string;
  email?: string;
  status: string;
  table_id?: number;
  session_id?: number;
  notes?: string;
  restaurant_booking_number?: number;
}

interface BookingSessionOrder {
  order_id: number;
  restaurant_order_number?: number;
  order_status: string;
  order_payment_method?: string;
  order_reference?: string;
  total_cents: number;
  items: Array<{
    menu_item_name: string;
    quantity: number;
    item_total_cents: number;
    variants?: string;
    is_addon?: boolean;
    addons?: Array<{
      menu_item_name: string;
      quantity: number;
      item_total_cents: number;
    }>;
  }>;
}

interface BookingSession {
  id: number;
  restaurant_session_number?: number;
  table_name?: string;
  pax: number;
  started_at: string;
  ended_at?: string;
}

interface Table {
  id: number;
  name: string;
  seat_count: number;
}

interface BookingsResponse {
  bookings: Booking[];
  total: number;
}

export interface BookingsTabRef {
  openNewBookingModal: () => void;
}

export const BookingsTab = forwardRef<BookingsTabRef, { restaurantId: string; searchQuery?: string }>((props, ref) => {
  const { restaurantId, searchQuery } = props;
  const { t } = useTranslation();
  const { showToast } = useToast();
  const isTabletDevice = (Platform as any).isPad;

  // Main state
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Calendar state
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Modal state
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [editingBookingId, setEditingBookingId] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [showTableDropdown, setShowTableDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);

  const [selectedBookingDetail, setSelectedBookingDetail] = useState<Booking | null>(null);
  const [sessionData, setSessionData] = useState<BookingSession | null>(null);
  const [sessionOrders, setSessionOrders] = useState<BookingSessionOrder[]>([]);
  const [loadingSession, setLoadingSession] = useState(false);

  // CRM customer search state
  const [crmSearchResults, setCrmSearchResults] = useState<Array<{ id: number; name: string; phone: string; email: string }>>([]);
  const [showCrmDropdown, setShowCrmDropdown] = useState(false);
  const crmSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    guest_name: '',
    phone: '',
    email: '',
    party_size: '1',
    table_id: '',
    date: '',
    time: '',
    status: 'confirmed',
    notes: '',
  });

  // Expose openNewBookingModal via ref
  useImperativeHandle(ref, () => ({
    openNewBookingModal() {
      openNewBookingModal();
    }
  }), []);

  const fetchBookings = async () => {
    try {
      setError(null);
      const response = await apiClient.get(`/api/restaurants/${restaurantId}/bookings`);
      // Backend returns array directly
      let bookingsData = Array.isArray(response.data) ? response.data : (response.data.bookings || []);
      
      // Normalize field names: booking_date -> date, booking_time -> time, pax -> party_size
      bookingsData = bookingsData.map((b: any) => ({
        ...b,
        date: b.date || b.booking_date || '',
        time: b.time || b.booking_time || '',
        party_size: b.party_size || b.pax || 1,
      }));
      
      setBookings(bookingsData);
    } catch (err: any) {
      console.error('Error fetching bookings:', err);
      if (err.response?.status === 404) {
        setError('Bookings endpoint not available');
      } else {
        setError(err.message || t('bookings.failed-load'));
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchTables = async () => {
    try {
      // Fetch from table-state endpoint (same as TablesTab)
      const response = await apiClient.get(`/api/restaurants/${restaurantId}/table-state`);
      
      // Transform table-state into table objects
      const tableMap: { [key: number]: Table } = {};
      
      response.data.forEach((row: any) => {
        if (!tableMap[row.table_id]) {
          tableMap[row.table_id] = {
            id: row.table_id,
            name: row.table_name,
            seat_count: row.seat_count,
          };
        }
      });
      
      const tablesData = Object.values(tableMap);
      setTables(tablesData);
    } catch (err: any) {
      console.error('Error fetching tables:', err);
    }
  };

  useEffect(() => {
    fetchBookings();
    fetchTables();
  }, [restaurantId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchBookings();
  };

  // Calendar functions
  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today);
  };

  const formatDateISO = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatDateDisplay = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getBookingsForDate = (date: Date) => {
    const dateStr = formatDateISO(date);
    return bookings.filter((b) => {
      // Handle both 'date' and 'booking_date' field names
      const bookingDateField = b.date || (b as any).booking_date;
      if (!bookingDateField || b.status === 'cancelled') return false;
      const bookingDate = bookingDateField.split('T')[0]; // Handle ISO timestamp
      if (bookingDate !== dateStr) return false;
      return true;
    });
  };

  // Search across all dates when query is present
  const getSearchResults = () => {
    if (!searchQuery || !searchQuery.trim()) return null;
    const q = searchQuery.trim().toLowerCase();
    return bookings.filter((b) => {
      const bookingDateField = b.date || (b as any).booking_date;
      if (!bookingDateField || b.status === 'cancelled') return false;
      return ((b as any).guest_name || (b as any).name || '').toLowerCase().includes(q)
          || (b.phone || '').toLowerCase().includes(q)
          || (b.email || '').toLowerCase().includes(q);
    });
  };

  const renderCalendarDays = () => {
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDay = getFirstDayOfMonth(currentDate);
    const days = [];

    // Empty cells for previous month
    for (let i = 0; i < firstDay; i++) {
      days.push(<View key={`empty-${i}`} style={[styles.calendarDay, !isTabletDevice && { height: 50 }]} />);
    }

    // Days of current month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
      const isSelected = formatDateISO(date) === formatDateISO(selectedDate);
      const isToday = formatDateISO(date) === formatDateISO(new Date());
      const bookingsForDay = getBookingsForDate(date);
      const hasBookings = bookingsForDay.length > 0;

      days.push(
        <TouchableOpacity
          key={`day-${day}`}
          style={[
            styles.calendarDay,
            !isTabletDevice && { height: 50 },
            isToday && styles.calendarDayToday,
            isSelected && styles.calendarDaySelected,
          ]}
          onPress={() => {
            setSelectedDate(date);
            setSelectedBookingDetail(null);
          }}
        >
          <Text style={[styles.calendarDayText, isSelected && styles.calendarDayTextSelected]}>
            {day}
          </Text>
          {hasBookings && (
            <>
              <View style={styles.calendarDotRow}>
                {bookingsForDay.slice(0, 4).map((b, idx) => (
                  <View
                    key={idx}
                    style={[styles.calendarStatusDot, { backgroundColor: getStatusColor(b.status) }]}
                  />
                ))}
                {bookingsForDay.length > 4 && (
                  <Text style={[styles.calendarMoreText, isSelected && { color: 'rgba(255,255,255,0.8)' }]}>
                    +{bookingsForDay.length - 4}
                  </Text>
                )}
              </View>
              {isTabletDevice && (
                <Text style={[styles.calendarDayBookingsText, isSelected && { color: 'rgba(255,255,255,0.8)' }]}>
                  {t('bookings.booking-count').replace('{0}', String(bookingsForDay.length))}
                </Text>
              )}
            </>
          )}
        </TouchableOpacity>
      );
    }

    return days;
  };

  const openNewBookingModal = () => {
    setEditingBookingId(null);
    const today = formatDateISO(new Date());
    setFormData({
      guest_name: '',
      phone: '',
      email: '',
      party_size: '1',
      table_id: '',
      date: today,
      time: '19:00',
      status: 'confirmed',
      notes: '',
    });
    setFormError(null);
    setShowBookingModal(true);
  };

  const openEditBookingModal = (booking: Booking) => {
    setEditingBookingId(booking.id);
    const bookingDate = (booking.date || booking.booking_date || '').split('T')[0];
    const bookingTime = booking.time || booking.booking_time || '';
    setFormData({
      guest_name: booking.guest_name,
      phone: booking.phone || '',
      email: booking.email || '',
      party_size: (booking.party_size || booking.pax || 1).toString(),
      table_id: booking.table_id?.toString() || '',
      date: bookingDate,
      time: bookingTime,
      status: booking.status,
      notes: (booking as any).notes || '',
    });
    setFormError(null);
    setShowBookingModal(true);
  };

  const closeModal = () => {
    setShowBookingModal(false);
    setEditingBookingId(null);
    setFormError(null);
    setShowCrmDropdown(false);
    setCrmSearchResults([]);
    if (crmSearchTimer.current) clearTimeout(crmSearchTimer.current);
  };

  const searchCrmCustomers = (text: string) => {
    if (crmSearchTimer.current) clearTimeout(crmSearchTimer.current);
    if (!text || text.trim().length < 2) {
      setCrmSearchResults([]);
      setShowCrmDropdown(false);
      return;
    }
    crmSearchTimer.current = setTimeout(async () => {
      try {
        const response = await apiClient.get(
          `/api/restaurants/${restaurantId}/crm/customers?search=${encodeURIComponent(text.trim())}&limit=8`
        );
        const results = Array.isArray(response.data) ? response.data : [];
        setCrmSearchResults(results);
        setShowCrmDropdown(true);
      } catch {
        setCrmSearchResults([]);
        setShowCrmDropdown(false);
      }
    }, 300);
  };

  const selectCrmCustomer = (customer: { id: number; name: string; phone: string; email: string }) => {
    setFormData((prev) => ({ ...prev, guest_name: customer.name, phone: customer.phone || '', email: customer.email || '' }));
    setShowCrmDropdown(false);
    setCrmSearchResults([]);
  };

  const saveBooking = async () => {
    if (!formData.guest_name.trim()) {
      setFormError(t('bookings.guest-name-required'));
      return;
    }
    if (!formData.party_size || parseInt(formData.party_size) < 1) {
      setFormError(t('bookings.party-size-min'));
      return;
    }
    if (!formData.date || !formData.time) {
      setFormError(t('bookings.date-time-required'));
      return;
    }
    if (!formData.table_id) {
      setFormError(t('bookings.table-required') || 'Please select a table');
      return;
    }

    try {
      const payload = {
        guest_name: formData.guest_name,
        phone: formData.phone,
        email: formData.email,
        pax: parseInt(formData.party_size),
        table_id: formData.table_id ? parseInt(formData.table_id) : null,
        booking_date: formData.date,
        booking_time: formData.time,
        status: formData.status,
        notes: formData.notes,
        restaurantId: parseInt(restaurantId),
      };

      if (editingBookingId) {
        // Update booking
        await apiClient.patch(`/api/bookings/${editingBookingId}`, payload);
        showToast(t('common.booking-updated'), 'success');
      } else {
        // Create booking - adjust field names for backend API
        const createPayload = {
          ...payload,
          pax: payload.pax,
          booking_date: payload.booking_date,
          booking_time: payload.booking_time,
        };
        await apiClient.post(`/api/restaurants/${restaurantId}/bookings`, createPayload);
        showToast(t('common.booking-created'), 'success');
      }

      closeModal();
      await fetchBookings();
    } catch (err: any) {
      console.error('Error saving booking:', err);
      let errorMsg = t('bookings.failed-save');
      if (err.response?.data?.message) {
        errorMsg = err.response.data.message;
      } else if (err.response?.data?.error) {
        errorMsg = err.response.data.error;
      } else if (err.response?.statusText) {
        errorMsg = `${err.response.status} ${err.response.statusText}`;
      } else if (err.message) {
        errorMsg = err.message;
      }
      console.log('[Save Booking Debug] Error details:', { errorMsg, status: err.response?.status, data: err.response?.data });
      setFormError(errorMsg);
    }
  };

  const deleteBooking = (bookingId: number) => {
    Alert.alert(t('admin.delete-booking-title'), t('admin.delete-booking-confirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        onPress: async () => {
          try {
            await apiClient.delete(`/api/bookings/${bookingId}`, {
              data: { restaurantId: parseInt(restaurantId) }
            });
            showToast(t('common.booking-deleted'), 'success');
            await fetchBookings();
          } catch (err: any) {
            showToast(err.message || t('common.failed'), 'error');
          }
        },
        style: 'destructive',
      },
    ]);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
      case 'reserved':
        return '#16a34a';
      case 'pending':
        return '#f97316';
      case 'in-session':
        return '#22c55e';
      case 'completed':
        return '#3b82f6';
      case 'cancelled':
        return '#f87171';
      case 'no-show':
        return '#9ca3af';
      default:
        return '#6b7280';
    }
  };

  const formatMoney = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  const getStatusLabel = (status: string) => {
    const map: Record<string, string> = {
      confirmed: t('bookings.confirmed'),
      pending: t('bookings.pending'),
      completed: t('bookings.completed'),
      cancelled: t('bookings.cancelled'),
      'no-show': t('bookings.no-show'),
    };
    return map[status] || status.charAt(0).toUpperCase() + status.slice(1);
  };

  const loadBookingSessionDetails = async (sessionId: number) => {
    setLoadingSession(true);
    try {
      const [sessionRes, ordersRes] = await Promise.all([
        apiClient.get(`/api/sessions/${sessionId}`),
        apiClient.get(`/api/sessions/${sessionId}/orders`),
      ]);
      setSessionData(sessionRes.data);
      const orders = ordersRes.data?.items || ordersRes.data || [];
      setSessionOrders(Array.isArray(orders) ? orders : []);
    } catch (err) {
      console.error('Error loading session details:', err);
      setSessionData(null);
      setSessionOrders([]);
    } finally {
      setLoadingSession(false);
    }
  };

  const getAvailableTablesForForm = () => {
    const dateStr = formData.date?.split('T')[0];
    if (!dateStr) return tables;
    // Find tables that are NOT booked by another booking on this date (excluding current booking being edited)
    const bookedTableIds = bookings
      .filter(b => {
        const bDate = (b.date || b.booking_date || '').split('T')[0];
        return bDate === dateStr && b.status !== 'cancelled' && b.id !== editingBookingId;
      })
      .map(b => b.table_id)
      .filter((id): id is number => id != null);
    return tables.filter(t => !bookedTableIds.includes(t.id));
  };

  const selectBookingDetail = (booking: Booking) => {
    setSelectedBookingDetail(booking);
    setSessionData(null);
    setSessionOrders([]);
    if (booking.session_id) {
      loadBookingSessionDetails(booking.session_id);
    }
  };

  const searchResults = getSearchResults();
  const selectedDateBookings = searchResults !== null ? searchResults : getBookingsForDate(selectedDate);
  const monthYear = currentDate.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Full-screen calendar */}
      <ScrollView style={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {/* Calendar Navigation */}
        <View style={styles.calendarNav}>
          <TouchableOpacity onPress={previousMonth} style={styles.navBtn}>
            <Text style={styles.navBtnText}>{t('bookings.prev')}</Text>
          </TouchableOpacity>
          <Text style={styles.calendarMonth}>{monthYear}</Text>
          <TouchableOpacity onPress={nextMonth} style={styles.navBtn}>
            <Text style={styles.navBtnText}>{t('bookings.next')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={goToToday} style={[styles.navBtn, styles.todayBtn]}>
            <Text style={styles.todayBtnText}>{t('bookings.today')}</Text>
          </TouchableOpacity>
        </View>

        {/* Calendar Grid */}
        <View style={styles.calendarGrid}>
          {t('bookings.weekdays').split(',').map((day: string) => (
            <View key={day} style={styles.weekdayHeader}>
              <Text style={styles.weekdayText}>{day}</Text>
            </View>
          ))}
          {renderCalendarDays()}
        </View>

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={fetchBookings} style={styles.retryBtn}>
              <Text style={styles.retryBtnText}>{t('bookings.retry')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Inline bookings list below calendar */}
        <View style={styles.inlineBookingsSection}>
            <View style={styles.inlineBookingsHeader}>
              <Text style={styles.inlineBookingsTitle}>
                {t('bookings.bookings-for')}{formatDateDisplay(selectedDate)}
              </Text>
            </View>

            {selectedBookingDetail ? (
              /* Inline detail view - matches webapp */
              <View style={styles.inlineDetailCard}>
                <TouchableOpacity onPress={() => setSelectedBookingDetail(null)} style={{ marginBottom: 8 }}>
                  <Text style={styles.panelBackBtnText}>{t('bookings.back-to-list')}</Text>
                </TouchableOpacity>

                {/* Header: Booking # + Status */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: '#1f2937' }}>
                    {t('bookings.booking-num').replace('{0}', String((selectedBookingDetail as any).restaurant_booking_number || selectedBookingDetail.id)).replace('{1}', selectedBookingDetail.guest_name)}
                  </Text>
                  <View style={[styles.detailStatusBadge, { backgroundColor: getStatusColor(selectedBookingDetail.status) }]}>
                    <Text style={styles.detailStatusText}>{getStatusLabel(selectedBookingDetail.status)}</Text>
                  </View>
                </View>

                {/* Customer & Booking Details section */}
                <View style={styles.detailSectionCard}>
                  <Text style={styles.detailSectionTitle}>{t('bookings.customer-details')}</Text>
                  <View style={styles.detailGrid}>
                    <View style={styles.detailGridItem}>
                      <Text style={styles.detailLabel}>{t('bookings.name')}</Text>
                      <Text style={styles.detailValue}>{selectedBookingDetail.guest_name}</Text>
                    </View>
                    <View style={styles.detailGridItem}>
                      <Text style={styles.detailLabel}>{t('bookings.phone')}</Text>
                      <Text style={styles.detailValue}>{selectedBookingDetail.phone || '—'}</Text>
                    </View>
                    <View style={styles.detailGridItem}>
                      <Text style={styles.detailLabel}>{t('bookings.email')}</Text>
                      <Text style={styles.detailValue}>{selectedBookingDetail.email || '—'}</Text>
                    </View>
                    <View style={styles.detailGridItem}>
                      <Text style={styles.detailLabel}>{t('bookings.pax')}</Text>
                      <Text style={styles.detailValue}>{selectedBookingDetail.party_size}</Text>
                    </View>
                    <View style={styles.detailGridItem}>
                      <Text style={styles.detailLabel}>{t('bookings.table')}</Text>
                      <Text style={styles.detailValue}>
                        {selectedBookingDetail.table_id
                          ? tables.find(t => t.id === selectedBookingDetail.table_id)?.name || `#${selectedBookingDetail.table_id}`
                          : '—'}
                      </Text>
                    </View>
                    <View style={styles.detailGridItem}>
                      <Text style={styles.detailLabel}>{t('bookings.date')}</Text>
                    </View>
                    <View style={styles.detailGridItem}>
                      <Text style={styles.detailLabel}>{t('bookings.time')}</Text>
                    </View>
                    {(selectedBookingDetail as any).notes ? (
                      <View style={[styles.detailGridItem, { width: '100%' }]}>
                        <Text style={styles.detailLabel}>{t('bookings.notes')}</Text>
                        <Text style={styles.detailValue}>{(selectedBookingDetail as any).notes}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>

                {/* Session & Orders section */}
                {selectedBookingDetail.session_id ? (
                  <View style={styles.detailSectionCard}>
                    <Text style={styles.detailSectionTitle}>{t('bookings.session-orders')}</Text>
                    {loadingSession ? (
                      <ActivityIndicator size="small" color="#3b82f6" style={{ paddingVertical: 12 }} />
                    ) : sessionData ? (
                      <>
                        {/* Session info grid */}
                        <View style={[styles.detailGrid, { marginBottom: 12 }]}>
                          <View style={styles.detailGridItem}>
                            <Text style={styles.detailLabel}>Session #</Text>
                            <Text style={styles.detailValue}>{(sessionData as any).restaurant_session_number || sessionData.id}</Text>
                          </View>
                          <View style={styles.detailGridItem}>
                            <Text style={styles.detailLabel}>Table</Text>
                            <Text style={styles.detailValue}>{sessionData.table_name || '—'}</Text>
                          </View>
                          <View style={styles.detailGridItem}>
                            <Text style={styles.detailLabel}>{t('bookings.guests')}</Text>
                            <Text style={styles.detailValue}>{sessionData.pax}</Text>
                          </View>
                          <View style={styles.detailGridItem}>
                            <Text style={styles.detailLabel}>{t('bookings.started')}</Text>
                            <Text style={styles.detailValue}>{new Date(sessionData.started_at).toLocaleString('en-HK', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</Text>
                          </View>
                          <View style={styles.detailGridItem}>
                            <Text style={styles.detailLabel}>{t('bookings.ended')}</Text>
                            <Text style={[styles.detailValue, !sessionData.ended_at && { color: '#22c55e' }]}>
                              {sessionData.ended_at
                                ? new Date(sessionData.ended_at).toLocaleString('en-HK', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                                : t('bookings.active')}
                            </Text>
                          </View>
                        </View>

                        {/* Orders */}
                        {sessionOrders.length === 0 ? (
                          <Text style={{ color: '#9ca3af', fontSize: 13, paddingVertical: 8 }}>{t('bookings.no-orders-session')}</Text>
                        ) : (
                          <>
                            {sessionOrders.map((order, oi) => {
                              const orderNum = order.restaurant_order_number || order.order_id;
                              const isPaid = order.order_status === 'completed';
                              const mainItems = (order.items || []).filter(i => !i.is_addon);
                              return (
                                <View key={oi} style={styles.orderBlock}>
                                  <View style={styles.orderBlockHeader}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                      <Text style={{ fontWeight: '700', color: '#1f2937', fontSize: 13 }}>{t('bookings.order-num').replace('{0}', String(orderNum))}</Text>
                                      <View style={[styles.detailStatusBadge, { backgroundColor: isPaid ? '#10b981' : '#d1d5db' }]}>
                                        <Text style={[styles.detailStatusText, { fontSize: 10 }]}>{isPaid ? t('bookings.paid') : order.order_status || t('bookings.pending')}</Text>
                                      </View>
                                    </View>
                                    {order.order_payment_method ? (
                                      <Text style={{ fontSize: 11, color: '#6b7280' }}>
                                        {order.order_payment_method.charAt(0).toUpperCase() + order.order_payment_method.slice(1)}
                                        {order.order_reference ? ` · ${t('bookings.ref').replace('{0}', order.order_reference)}` : ''}
                                      </Text>
                                    ) : null}
                                  </View>
                                  {mainItems.map((item, ii) => (
                                    <View key={ii} style={styles.orderItemRow}>
                                      <View style={{ flex: 1 }}>
                                        <Text style={{ fontWeight: '600', color: '#333', fontSize: 13 }}>
                                          {item.menu_item_name} ×{item.quantity}
                                        </Text>
                                        {item.variants ? (
                                          <Text style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>{item.variants}</Text>
                                        ) : null}
                                        {item.addons && item.addons.length > 0 && item.addons.map((addon, ai) => (
                                          <Text key={ai} style={{ fontSize: 11, color: '#6b7280', marginTop: 2, marginLeft: 8 }}>
                                            + {addon.menu_item_name} ×{addon.quantity} — {formatMoney(addon.item_total_cents)}
                                          </Text>
                                        ))}
                                      </View>
                                      <Text style={{ fontWeight: '600', color: '#667eea', fontSize: 13 }}>
                                        {formatMoney(item.item_total_cents)}
                                      </Text>
                                    </View>
                                  ))}
                                  <View style={styles.orderBlockTotal}>
                                    <Text style={{ fontWeight: '600', color: '#1f2937', fontSize: 13 }}>
                                      {t('bookings.order-total')}{formatMoney(order.total_cents || 0)}
                                    </Text>
                                  </View>
                                </View>
                              );
                            })}
                            <View style={styles.grandTotalRow}>
                              <Text style={{ fontSize: 15, fontWeight: '800', color: '#1f2937' }}>
                                {t('bookings.grand-total')}{formatMoney(sessionOrders.reduce((sum, o) => sum + (o.total_cents || 0), 0))}
                              </Text>
                            </View>
                          </>
                        )}
                      </>
                    ) : (
                      <Text style={{ color: '#ef4444', fontSize: 13 }}>{t('bookings.error-loading')}</Text>
                    )}
                  </View>
                ) : null}

                {/* Action buttons */}
                <View style={styles.detailActions}>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.editBtn, { flex: 1 }]}
                    onPress={() => { setSelectedBookingDetail(null); openEditBookingModal(selectedBookingDetail); }}
                  >
                    <Text style={styles.actionBtnText}>{t('bookings.edit-booking')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.deleteBtn, { flex: 1 }]}
                    onPress={() => { setSelectedBookingDetail(null); deleteBooking(selectedBookingDetail.id); }}
                  >
                    <Text style={styles.actionBtnText}>{t('bookings.delete')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              /* Table-style booking rows */
              <>
                {/* Table header row — iPad only */}
                {isTabletDevice && (
                  <View style={styles.bookingRowHeader}>
                    <Text style={[styles.bookingRowCell, { flex: 1 }]}>{t('bookings.date')}</Text>
                    <Text style={[styles.bookingRowCell, { flex: 2 }]}>{t('bookings.guest')}</Text>
                    <Text style={[styles.bookingRowCell, { flex: 1.5 }]}>{t('bookings.phone')}</Text>
                    <Text style={[styles.bookingRowCell, { flex: 0.7, textAlign: 'center' }]}>{t('bookings.pax')}</Text>
                    <Text style={[styles.bookingRowCell, { flex: 0.7, textAlign: 'center' }]}>{t('bookings.time')}</Text>
                    <Text style={[styles.bookingRowCell, { flex: 1, textAlign: 'center' }]}>{t('bookings.status')}</Text>
                    <Text style={[styles.bookingRowCell, { flex: 1, textAlign: 'center' }]}>{t('bookings.actions')}</Text>
                  </View>
                )}

                {selectedDateBookings.length === 0 ? (
                  <Text style={styles.noBookings}>{t('bookings.no-bookings')}</Text>
                ) : (
                  selectedDateBookings.map((item) => {
                    const statusColor = getStatusColor(item.status);
                    return isTabletDevice ? (
                      /* iPad: table row layout (unchanged) */
                      <TouchableOpacity
                        key={item.id}
                        style={[styles.bookingRow, { borderLeftColor: statusColor }]}
                        onPress={() => selectBookingDetail(item)}
                      >
                        <Text style={[styles.bookingRowCellText, { flex: 1, color: '#6b7280' }]} numberOfLines={1}>
                          {(() => {
                            const d = item.date || (item as any).booking_date || '';
                            if (!d) return '—';
                            const dt = new Date(d.includes('T') ? d : d + 'T00:00:00');
                            return `${dt.getMonth() + 1}/${dt.getDate()}`;
                          })()}
                        </Text>
                        <Text style={[styles.bookingRowCellText, { flex: 2, fontWeight: '600' }]} numberOfLines={1}>
                          {item.guest_name}
                        </Text>
                        <Text style={[styles.bookingRowCellText, { flex: 1.5, color: '#6b7280' }]} numberOfLines={1}>
                          {item.phone || '—'}
                        </Text>
                        <Text style={[styles.bookingRowCellText, { flex: 0.7, textAlign: 'center' }]}>
                          {item.party_size}
                        </Text>
                        <Text style={[styles.bookingRowCellText, { flex: 0.7, textAlign: 'center' }]}>
                          {item.time || (item as any).booking_time || '—'}
                        </Text>
                        <View style={{ flex: 1, alignItems: 'center' }}>
                          <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
                            <Text style={styles.statusText}>{getStatusLabel(item.status)}</Text>
                          </View>
                        </View>
                        <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
                          <TouchableOpacity
                            style={styles.inlineEditBtn}
                            onPress={() => openEditBookingModal(item)}
                          >
                            <Text style={{ color: '#3b82f6', fontSize: 12, fontWeight: '600' }}>{t('bookings.edit')}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.inlineDeleteBtn}
                            onPress={() => deleteBooking(item.id)}
                          >
                            <Text style={{ color: '#ef4444', fontSize: 14 }}>✕</Text>
                          </TouchableOpacity>
                        </View>
                      </TouchableOpacity>
                    ) : (
                      /* iPhone: card layout */
                      <TouchableOpacity
                        key={item.id}
                        style={styles.bookingCard}
                        onPress={() => selectBookingDetail(item)}
                      >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={{ fontWeight: '600', fontSize: 15, color: '#1f2937', flex: 1 }} numberOfLines={1}>
                            {item.guest_name}
                          </Text>
                          <View style={[styles.statusBadge, { backgroundColor: statusColor, marginLeft: 8 }]}>
                            <Text style={styles.statusText}>{getStatusLabel(item.status)}</Text>
                          </View>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 12, marginTop: 6, alignItems: 'center' }}>
                          <Text style={{ color: '#6b7280', fontSize: 13 }}>
                            <Ionicons name="time-outline" size={12} color="#9ca3af" /> {item.time || (item as any).booking_time || '—'}
                          </Text>
                          <Text style={{ color: '#6b7280', fontSize: 13 }}>
                            <Ionicons name="people-outline" size={12} color="#9ca3af" /> {item.party_size}
                          </Text>
                          {item.phone ? (
                            <Text style={{ color: '#6b7280', fontSize: 13 }} numberOfLines={1}>
                              <Ionicons name="call-outline" size={12} color="#9ca3af" /> {item.phone}
                            </Text>
                          ) : null}
                        </View>
                      </TouchableOpacity>
                    );
                  })
                )}
              </>
            )}
          </View>
      </ScrollView>


      {/* Booking Modal */}
      <Modal supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']} visible={showBookingModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingBookingId ? t('bookings.edit-booking') : t('bookings.new-booking')}
              </Text>
              <TouchableOpacity onPress={closeModal}>
                <Text style={styles.modalCloseBtn}>✕</Text>
              </TouchableOpacity>
            </View>

            {formError && <Text style={styles.formError}>{formError}</Text>}

            <ScrollView style={styles.formScroll}>
              {/* Row 1: Guest Name + Phone */}
              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.formLabel}>{t('bookings.guest-name-label')}</Text>
                  <View style={{ position: 'relative' }}>
                    <TextInput
                      style={styles.formInput}
                      placeholder={t('bookings.guest-name-placeholder')}
                      value={formData.guest_name}
                      onChangeText={(text) => {
                        setFormData({ ...formData, guest_name: text });
                        searchCrmCustomers(text);
                      }}
                    />
                    {showCrmDropdown && (
                      <View style={styles.crmDropdown}>
                        {crmSearchResults.map((customer) => (
                          <TouchableOpacity
                            key={customer.id}
                            style={styles.crmDropdownItem}
                            onPress={() => selectCrmCustomer(customer)}
                          >
                            <Text style={styles.crmDropdownName}>{customer.name}</Text>
                            {(customer.phone || customer.email) ? (
                              <Text style={styles.crmDropdownSub}>
                                {[customer.phone, customer.email].filter(Boolean).join(' · ')}
                              </Text>
                            ) : null}
                          </TouchableOpacity>
                        ))}
                        <TouchableOpacity
                          style={[styles.crmDropdownItem, styles.crmDropdownNewItem]}
                          onPress={() => {
                            setShowCrmDropdown(false);
                            setCrmSearchResults([]);
                          }}
                        >
                          <Text style={styles.crmDropdownNewText}>+ {t('bookings.create-new-customer') || 'Create new customer'}</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </View>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.formLabel}>{t('bookings.phone-label')}</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder={t('bookings.phone-placeholder')}
                    value={formData.phone}
                    onChangeText={(text) =>
                      setFormData({ ...formData, phone: text })
                    }
                  />
                </View>
              </View>

              {/* Row 2: Email + Party Size */}
              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.formLabel}>{t('bookings.email-label')}</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder={t('bookings.email-placeholder')}
                    value={formData.email}
                    onChangeText={(text) =>
                      setFormData({ ...formData, email: text })
                    }
                  />
                </View>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.formLabel}>{t('bookings.party-size-label')}</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder={t('bookings.party-size-placeholder')}
                    keyboardType="number-pad"
                    value={formData.party_size}
                    onChangeText={(text) =>
                      setFormData({
                        ...formData,
                        party_size: text || '1',
                      })
                    }
                  />
                </View>
              </View>

              {/* Row 3: Date + Time */}
              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.formLabel}>{t('bookings.date-label')}</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="YYYY-MM-DD"
                    value={formData.date}
                    onChangeText={(text) =>
                      setFormData({ ...formData, date: text })
                    }
                  />
                </View>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.formLabel}>{t('bookings.time-label')}</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="HH:MM"
                    value={formData.time}
                    onChangeText={(text) =>
                      setFormData({ ...formData, time: text })
                    }
                  />
                </View>
              </View>

              {/* Row 4: Table + Status */}
              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.formLabel}>{t('bookings.table-label')} *</Text>
                  <TouchableOpacity
                    style={styles.dropdownBtn}
                    onPress={() => {
                      setShowTableDropdown(true);
                    }}
                  >
                    <Text style={styles.dropdownBtnText}>
                      {formData.table_id
                        ? tables.find(t => t.id.toString() === formData.table_id)?.name || t('bookings.select-table')
                        : t('bookings.select-table')}
                    </Text>
                  </TouchableOpacity>
                </View>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.formLabel}>{t('bookings.status-label')}</Text>
                  <TouchableOpacity
                    style={styles.dropdownBtn}
                    onPress={() => setShowStatusDropdown(!showStatusDropdown)}
                  >
                    <Text style={styles.dropdownBtnText}>
                      {getStatusLabel(formData.status)}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Row 5: Remarks/Notes */}
              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.formLabel}>{t('bookings.notes-label')}</Text>
                  <TextInput
                    style={[styles.formInput, { minHeight: 60, textAlignVertical: 'top' }]}
                    placeholder={t('bookings.notes-placeholder')}
                    value={formData.notes}
                    onChangeText={(text) =>
                      setFormData({ ...formData, notes: text })
                    }
                    multiline
                    numberOfLines={3}
                  />
                </View>
              </View>
            </ScrollView>

            {/* Form Actions */}
            <View style={styles.formActions}>
              <TouchableOpacity
                style={[styles.formBtn, styles.formBtnCancel]}
                onPress={closeModal}
              >
                <Text style={styles.formBtnText}>{t('bookings.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.formBtn, styles.formBtnSave]}
                onPress={saveBooking}
              >
                <Text style={[styles.formBtnText, styles.formBtnSaveText]}>
                  {t('bookings.save')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

        {/* Table Dropdown Overlay - Inside Modal so it renders on top */}
        {showTableDropdown && (() => {
          const availableTables = getAvailableTablesForForm();
          return (
          <View style={styles.absoluteDropdownOverlay}>
            <TouchableOpacity 
              style={styles.backdropTouchable}
              activeOpacity={1}
              onPress={() => {
                setShowTableDropdown(false);
              }}
            />
            <View style={styles.absoluteDropdownMenuContainer}>
              {availableTables.length === 0 ? (
                <View style={styles.dropdownItem}>
                  <Text style={styles.dropdownItemText}>{t('bookings.no-tables-available') || 'No tables available for this date'}</Text>
                </View>
              ) : (
                <FlatList
                  data={[{ id: -1, name: t('bookings.select-table-option'), seat_count: 0 }, ...availableTables]}
                  keyExtractor={(item) => item.id.toString()}
                  scrollEnabled={tables.length > 10}
                  nestedScrollEnabled={true}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      onPress={() => {
                        if (item.id === -1) {
                          setFormData({ ...formData, table_id: '' });
                        } else {
                          setFormData({ ...formData, table_id: item.id.toString() });
                        }
                        setShowTableDropdown(false);
                      }}
                      style={styles.dropdownItem}
                    >
                      <Text style={styles.dropdownItemText}>
                        {item.id === -1 ? item.name : `${item.name} (${item.seat_count} ${t('bookings.seats')})`}
                      </Text>
                    </TouchableOpacity>
                  )}
                />
              )}
            </View>
          </View>
          );
        })()}

        {/* Status Dropdown Overlay - Inside Modal so it renders on top */}
        {showStatusDropdown && (
          <View style={styles.absoluteDropdownOverlay}>
            <TouchableOpacity 
              style={styles.backdropTouchable}
              activeOpacity={1}
              onPress={() => {
                setShowStatusDropdown(false);
              }}
            />
            <View style={styles.absoluteDropdownMenuContainer}>
              <FlatList
                data={['confirmed', 'pending', 'completed', 'cancelled', 'no-show']}
                keyExtractor={(item) => item}
                scrollEnabled={false}
                renderItem={({ item: status }) => (
                  <TouchableOpacity
                    onPress={() => {
                      setFormData({ ...formData, status });
                      setShowStatusDropdown(false);
                    }}
                    style={styles.dropdownItem}
                  >
                    <Text style={styles.dropdownItemText}>
                      {getStatusLabel(status)}
                    </Text>
                  </TouchableOpacity>
                )}
              />
            </View>
          </View>
        )}
        </View>
      </Modal>
    </View>
  );
});

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Inline bookings (iPad - webapp style)
  inlineBookingsSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 0,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
    minHeight: 400,
  },
  inlineBookingsHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  inlineBookingsTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1f2937',
  },
  bookingRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#f9fafb',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  bookingRowCell: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
  },
  bookingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    borderLeftWidth: 3,
  },
  bookingRowCellText: {
    fontSize: 13,
    color: '#1f2937',
  },
  inlineEditBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  inlineDeleteBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  inlineDetailCard: {
    padding: 16,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: '#f9fafb',
  },
  calendarNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
    backgroundColor: '#f9fafb',
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderRadius: 8,
    gap: 15,
  },
  navBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  navBtnText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#374151',
  },
  todayBtn: {
    backgroundColor: '#3b82f6',
  },
  todayBtnText: {
    color: '#fff',
  },
  calendarMonth: {
    fontSize: 22,
    fontWeight: '600',
    color: '#1f2937',
    flex: 1,
    textAlign: 'center',
  },
  calendarGrid: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 20,
    padding: 20,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  weekdayHeader: {
    width: '14.28%',
    paddingVertical: 10,
    alignItems: 'center',
  },
  weekdayText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase' as any,
  },
  calendarDay: {
    width: '14.28%',
    height: 100,
    justifyContent: 'flex-start',
    alignItems: 'center',
    borderRadius: 8,
    paddingTop: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    position: 'relative' as any,
  },
  calendarDayToday: {
    backgroundColor: '#dbeafe',
    borderColor: '#4a90e2',
  },
  calendarDaySelected: {
    backgroundColor: '#4a90e2',
    borderColor: '#3b82f6',
  },
  calendarDayText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  calendarDayTextSelected: {
    color: '#fff',
  },
  calendarDayDot: {
    position: 'absolute' as any,
    top: 5,
    right: 5,
    fontSize: 16,
    color: '#f59e0b',
  },
  calendarDotRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 2,
    marginTop: 4,
    paddingHorizontal: 4,
  },
  calendarStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  calendarMoreText: {
    fontSize: 9,
    color: '#6b7280',
    fontWeight: '600',
  },
  calendarDayBookingsText: {
    fontSize: 10,
    color: '#f59e0b',
    textAlign: 'center',
  },
  noBookings: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    paddingVertical: 20,
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  editBtn: {
    backgroundColor: '#3b82f6',
  },
  deleteBtn: {
    backgroundColor: '#ef4444',
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  errorContainer: {
    backgroundColor: '#fee',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    minHeight: (Platform as any).isPad ? '60%' : '80%',
    paddingTop: 0,
    flexDirection: 'column',
    paddingBottom: 20,
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
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  modalCloseBtn: {
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
  formScroll: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 10,
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
  },
  formGroup: {
    marginVertical: 6,
    minHeight: 50,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  formInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: '#1f2937',
    backgroundColor: '#f9fafb',
    minHeight: 44,
  },
  dropdownBtn: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 14,
    backgroundColor: '#f9fafb',
    justifyContent: 'center',
    minHeight: 44,
  },
  dropdownBtnText: {
    fontSize: 13,
    color: '#1f2937',
  },
  backdropTouchable: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  absoluteDropdownOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'flex-end',
    zIndex: 1000,
  },
  absoluteDropdownMenuContainer: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 20,
    paddingBottom: 0,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
    maxHeight: '60%',
    overflow: 'hidden',
  },
  dropdownItem: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    minHeight: 44,
  },
  dropdownItemText: {
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '500',
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
  formBtnSave: {
    backgroundColor: '#4a90e2',
  },
  formBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  formBtnSaveText: {
    color: '#fff',
  },
  panelBackBtnText: {
    fontSize: 14,
    color: '#3b82f6',
    fontWeight: '600',
  },
  detailStatusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  detailStatusText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 0,
  },
  detailGridItem: {
    width: '50%',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  detailLabel: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '600',
  },
  detailActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
    marginBottom: 10,
  },
  detailSectionCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  detailSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 10,
  },
  orderBlock: {
    backgroundColor: '#fff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 8,
    overflow: 'hidden',
  },
  orderBlockHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 8,
    backgroundColor: '#f3f4f6',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  orderItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f3f4f6',
  },
  orderBlockTotal: {
    padding: 8,
    alignItems: 'flex-end',
    backgroundColor: '#f9fafb',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  grandTotalRow: {
    alignItems: 'flex-end',
    paddingTop: 10,
    marginTop: 4,
    borderTopWidth: 2,
    borderTopColor: '#667eea',
  },
  bookingCard: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    borderLeftWidth: 3,
    borderLeftColor: '#d1d5db',
  },
  crmDropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    zIndex: 999,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 8,
    overflow: 'hidden',
  },
  crmDropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  crmDropdownName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  crmDropdownSub: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  crmDropdownNewItem: {
    backgroundColor: '#f0f9ff',
  },
  crmDropdownNewText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3b82f6',
  },
});