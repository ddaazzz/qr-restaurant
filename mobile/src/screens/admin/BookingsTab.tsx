import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
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
  Alert,
} from 'react-native';
import { apiClient } from '../../services/apiClient';
import { useLanguage } from '../../contexts/LanguageContext';

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

export const BookingsTab = forwardRef<BookingsTabRef, { restaurantId: string }>((props, ref) => {
  const { restaurantId } = props;
  const { t } = useLanguage();
  
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
      console.log('[Bookings Debug] Response:', { rawData: response.data, parsedCount: bookingsData.length });
      
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
        setError(err.message || 'Failed to load bookings');
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
      console.log('[Tables Debug] Response:', { 
        rawDataLength: response.data?.length || 0, 
        tablesCount: tablesData.length, 
        tables: tablesData 
      });
      setTables(tablesData);
    } catch (err: any) {
      console.error('Error fetching tables:', err);
      console.log('[Tables Error Debug]', { 
        status: err.response?.status, 
        data: err.response?.data, 
        message: err.message,
        url: `/api/restaurants/${restaurantId}/table-state`
      });
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
      return bookingDate === dateStr;
    });
  };

  const renderCalendarDays = () => {
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDay = getFirstDayOfMonth(currentDate);
    const days = [];

    // Empty cells for previous month
    for (let i = 0; i < firstDay; i++) {
      days.push(<View key={`empty-${i}`} style={styles.calendarDay} />);
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
            isToday && styles.calendarDayToday,
            isSelected && styles.calendarDaySelected,
          ]}
          onPress={() => setSelectedDate(date)}
        >
          <Text style={[styles.calendarDayText, isSelected && styles.calendarDayTextSelected]}>
            {day}
          </Text>
          {hasBookings && (
            <Text style={styles.calendarDayBadge}>{bookingsForDay.length}</Text>
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
    });
    setFormError(null);
    setShowBookingModal(true);
  };

  const closeModal = () => {
    setShowBookingModal(false);
    setEditingBookingId(null);
    setFormError(null);
  };

  const saveBooking = async () => {
    if (!formData.guest_name.trim()) {
      setFormError('Guest name is required');
      return;
    }
    if (!formData.party_size || parseInt(formData.party_size) < 1) {
      setFormError('Party size must be at least 1');
      return;
    }
    if (!formData.date || !formData.time) {
      setFormError('Date and time are required');
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
        restaurantId: parseInt(restaurantId),
      };

      if (editingBookingId) {
        // Update booking
        await apiClient.patch(`/api/bookings/${editingBookingId}`, payload);
        Alert.alert(t('success.success'), t('success.booking-updated'));
      } else {
        // Create booking - adjust field names for backend API
        const createPayload = {
          ...payload,
          pax: payload.pax,
          booking_date: payload.booking_date,
          booking_time: payload.booking_time,
        };
        await apiClient.post(`/api/restaurants/${restaurantId}/bookings`, createPayload);
        Alert.alert(t('success.success'), t('success.booking-created'));
      }

      closeModal();
      await fetchBookings();
    } catch (err: any) {
      console.error('Error saving booking:', err);
      let errorMsg = 'Failed to save booking';
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
    Alert.alert(t('bookings.delete-title'), t('bookings.delete-confirm'), [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        onPress: async () => {
          try {
            await apiClient.delete(`/api/bookings/${bookingId}`, {
              data: { restaurantId: parseInt(restaurantId) }
            });
            Alert.alert(t('success.success'), t('success.booking-deleted'));
            await fetchBookings();
          } catch (err: any) {
            Alert.alert(t('error.error'), err.message || t('error.failed'));
          }
        },
        style: 'destructive',
      },
    ]);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return '#10b981';
      case 'pending':
        return '#f59e0b';
      case 'cancelled':
        return '#ef4444';
      case 'completed':
        return '#6366f1';
      case 'no-show':
        return '#8b5cf6';
      default:
        return '#6b7280';
    }
  };

  const selectedDateBookings = getBookingsForDate(selectedDate);
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
      <View style={styles.container}>
        <ScrollView style={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {/* Calendar Navigation */}
        <View style={styles.calendarNav}>
          <TouchableOpacity onPress={previousMonth} style={styles.navBtn}>
            <Text style={styles.navBtnText}>← Prev</Text>
          </TouchableOpacity>
          <Text style={styles.calendarMonth}>{monthYear}</Text>
          <TouchableOpacity onPress={nextMonth} style={styles.navBtn}>
            <Text style={styles.navBtnText}>Next →</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={goToToday} style={[styles.navBtn, styles.todayBtn]}>
            <Text style={styles.todayBtnText}>Today</Text>
          </TouchableOpacity>
        </View>

        {/* Calendar Grid */}
        <View style={styles.calendarGrid}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <View key={day} style={styles.weekdayHeader}>
              <Text style={styles.weekdayText}>{day}</Text>
            </View>
          ))}
          {renderCalendarDays()}
        </View>

        {/* Bookings for Selected Date */}
        <View style={styles.bookingsSection}>
          <Text style={styles.selectedDateTitle}>Bookings for {formatDateDisplay(selectedDate)}</Text>

          {selectedDateBookings.length === 0 ? (
            <Text style={styles.noBookings}>No bookings for this date</Text>
          ) : (
            <FlatList
              scrollEnabled={false}
              data={selectedDateBookings}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <View style={styles.bookingCard}>
                  <View style={styles.bookingTop}>
                    <View>
                      <Text style={styles.bookingName}>{item.guest_name}</Text>
                      <Text style={styles.bookingTime}>
                        🕐 {item.time || (item as any).booking_time || 'N/A'} • 👥 {item.party_size} guests
                      </Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
                      <Text style={styles.statusText}>{item.status}</Text>
                    </View>
                  </View>
                  {item.phone && <Text style={styles.bookingMeta}>📱 {item.phone}</Text>}
                  {item.email && <Text style={styles.bookingMeta}>📧 {item.email}</Text>}
                  <View style={styles.bookingActions}>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.editBtn]}
                      onPress={() => openEditBookingModal(item)}
                    >
                      <Text style={styles.actionBtnText}>✏️ Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.deleteBtn]}
                      onPress={() => deleteBooking(item.id)}
                    >
                      <Text style={styles.actionBtnText}>🗑️ Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            />
          )}
        </View>

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={fetchBookings} style={styles.retryBtn}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Booking Modal */}
      <Modal visible={showBookingModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingBookingId ? 'Edit Booking' : 'New Booking'}
              </Text>
              <TouchableOpacity onPress={closeModal}>
                <Text style={styles.modalCloseBtn}>✕</Text>
              </TouchableOpacity>
            </View>

            {formError && <Text style={styles.formError}>{formError}</Text>}

            <ScrollView style={styles.formScroll}>
              {/* Guest Name */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Guest Name *</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="Enter guest name"
                  value={formData.guest_name}
                  onChangeText={(text) =>
                    setFormData({ ...formData, guest_name: text })
                  }
                />
              </View>

              {/* Phone */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Phone</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="Enter phone number"
                  value={formData.phone}
                  onChangeText={(text) =>
                    setFormData({ ...formData, phone: text })
                  }
                />
              </View>

              {/* Email */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Email</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="Enter email"
                  value={formData.email}
                  onChangeText={(text) =>
                    setFormData({ ...formData, email: text })
                  }
                />
              </View>

              {/* Party Size */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Party Size *</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="Number of guests"
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

              {/* Table */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Table</Text>
                <TouchableOpacity
                  style={styles.dropdownBtn}
                  onPress={() => {
                    console.log('[Debug] Table button pressed, current state:', showTableDropdown);
                    setShowTableDropdown(true);
                  }}
                >
                  <Text style={styles.dropdownBtnText}>
                    {formData.table_id
                      ? tables.find(t => t.id.toString() === formData.table_id)?.name || 'Select table'
                      : 'Select table'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Date */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Date *</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="YYYY-MM-DD"
                  value={formData.date}
                  onChangeText={(text) =>
                    setFormData({ ...formData, date: text })
                  }
                />
              </View>

              {/* Time */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Time *</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="HH:MM"
                  value={formData.time}
                  onChangeText={(text) =>
                    setFormData({ ...formData, time: text })
                  }
                />
              </View>

              {/* Status */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Status *</Text>
                <TouchableOpacity
                  style={styles.dropdownBtn}
                  onPress={() => setShowStatusDropdown(!showStatusDropdown)}
                >
                  <Text style={styles.dropdownBtnText}>
                    {formData.status.charAt(0).toUpperCase() + formData.status.slice(1)}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>

            {/* Form Actions */}
            <View style={styles.formActions}>
              <TouchableOpacity
                style={[styles.formBtn, styles.formBtnCancel]}
                onPress={closeModal}
              >
                <Text style={styles.formBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.formBtn, styles.formBtnSave]}
                onPress={saveBooking}
              >
                <Text style={[styles.formBtnText, styles.formBtnSaveText]}>
                  💾 Save
                </Text>
              </TouchableOpacity>
            </View>
          </View>

        {/* Table Dropdown Overlay - Inside Modal so it renders on top */}
        {showTableDropdown && (
          <View style={styles.absoluteDropdownOverlay}>
            <TouchableOpacity 
              style={styles.backdropTouchable}
              activeOpacity={1}
              onPress={() => {
                console.log('[Debug] Backdrop pressed, closing dropdown');
                setShowTableDropdown(false);
              }}
            />
            <View style={styles.absoluteDropdownMenuContainer}>
              {tables.length === 0 ? (
                <View style={styles.dropdownItem}>
                  <Text style={styles.dropdownItemText}>No tables available</Text>
                </View>
              ) : (
                <FlatList
                  data={[{ id: -1, name: '— Select table —', seat_count: 0 }, ...tables]}
                  keyExtractor={(item) => item.id.toString()}
                  scrollEnabled={tables.length > 10}
                  nestedScrollEnabled={true}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      onPress={() => {
                        console.log('[Debug] Table selected:', item.id);
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
                        {item.id === -1 ? item.name : `📍 ${item.name} (${item.seat_count} seats)`}
                      </Text>
                    </TouchableOpacity>
                  )}
                />
              )}
            </View>
          </View>
        )}

        {/* Status Dropdown Overlay - Inside Modal so it renders on top */}
        {showStatusDropdown && (
          <View style={styles.absoluteDropdownOverlay}>
            <TouchableOpacity 
              style={styles.backdropTouchable}
              activeOpacity={1}
              onPress={() => {
                console.log('[Debug] Status backdrop pressed, closing dropdown');
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
                      console.log('[Debug] Status selected:', status);
                      setFormData({ ...formData, status });
                      setShowStatusDropdown(false);
                    }}
                    style={styles.dropdownItem}
                  >
                    <Text style={styles.dropdownItemText}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  newBookingBtn: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  newBookingBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  content: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  calendarNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
  },
  navBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
  },
  navBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  todayBtn: {
    backgroundColor: '#3b82f6',
  },
  todayBtnText: {
    color: '#fff',
  },
  calendarMonth: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  calendarGrid: {
    backgroundColor: '#fff',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 16,
    paddingHorizontal: 8,
    paddingVertical: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
  },
  weekdayHeader: {
    width: '14.28%',
    paddingVertical: 8,
    alignItems: 'center',
  },
  weekdayText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  calendarDay: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 6,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  calendarDayToday: {
    backgroundColor: '#fef3c7',
    borderColor: '#fbbf24',
  },
  calendarDaySelected: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  calendarDayText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
  },
  calendarDayTextSelected: {
    color: '#fff',
  },
  calendarDayBadge: {
    position: 'absolute',
    bottom: 2,
    fontSize: 10,
    fontWeight: 'bold',
    color: '#ef4444',
  },
  bookingsSection: {
    marginBottom: 20,
  },
  selectedDateTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 12,
  },
  noBookings: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    paddingVertical: 20,
  },
  bookingCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  bookingTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  bookingName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  bookingTime: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
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
  bookingMeta: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  bookingActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
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
    minHeight: '80%',
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
  formGroup: {
    marginVertical: 10,
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
  dropdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'flex-end',
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
  dropdownMenuContainer: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
    maxHeight: '60%',
    overflow: 'hidden',
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
  dropdownMenu: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
    maxHeight: 300,
    overflow: 'hidden',
    width: 'auto',
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
    backgroundColor: '#10b981',
  },
  formBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  formBtnSaveText: {
    color: '#fff',
  },
});