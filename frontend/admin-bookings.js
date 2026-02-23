// Admin Bookings Management

let currentDate = new Date();
let selectedDate = new Date();
let allBookings = [];
let allTables = [];
let editingBookingId = null;

// Initialize only when bookings section is loaded
let bookingsInitialized = false;

function initializeBookings() {
  if (bookingsInitialized) return;
  bookingsInitialized = true;
  
  loadTables();
  renderCalendar();
  loadBookings();
  attachEventListeners();
}

function attachEventListeners() {
  const btnNewBooking = document.getElementById('btn-new-booking');
  const btnPrevMonth = document.getElementById('btn-prev-month');
  const btnNextMonth = document.getElementById('btn-next-month');
  const btnToday = document.getElementById('btn-today');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const btnCancelForm = document.getElementById('btn-cancel-form');
  const bookingForm = document.getElementById('booking-form');
  const btnDeleteBooking = document.getElementById('btn-delete-booking');
  const btnConfirmNo = document.getElementById('btn-confirm-no');

  if (btnNewBooking) btnNewBooking.addEventListener('click', openNewBookingModal);
  if (btnPrevMonth) btnPrevMonth.addEventListener('click', previousMonth);
  if (btnNextMonth) btnNextMonth.addEventListener('click', nextMonth);
  if (btnToday) btnToday.addEventListener('click', goToToday);
  if (btnCloseModal) btnCloseModal.addEventListener('click', closeBookingModal);
  if (btnCancelForm) btnCancelForm.addEventListener('click', closeBookingModal);
  if (bookingForm) bookingForm.addEventListener('submit', saveBooking);
  if (btnDeleteBooking) btnDeleteBooking.addEventListener('click', () => {
    if (editingBookingId) {
      document.getElementById('confirm-message').textContent = 'Are you sure you want to delete this booking?';
      document.getElementById('confirm-modal').classList.remove('hidden');
    }
  });
  const btnConfirmYes = document.getElementById('btn-confirm-yes');
  if (btnConfirmYes) btnConfirmYes.addEventListener('click', confirmDeleteBooking);
  if (btnConfirmNo) btnConfirmNo.addEventListener('click', () => {
    document.getElementById('confirm-modal').classList.add('hidden');
    editingBookingId = null;
  });
}

function showLoading(show = true) {
  const loading = document.getElementById('loading');
  if (show) {
    loading.classList.remove('hidden');
  } else {
    loading.classList.add('hidden');
  }
}

function loadTables() {
  if (!API || !restaurantId) {
    console.error('Missing API or restaurantId for tables');
    return;
  }
  
  fetch(`${API}/restaurants/${restaurantId}/tables`)
    .then(r => r.json())
    .then(tables => {
      allTables = tables || [];
      updateTableDropdown();
    })
    .catch(err => console.error('Error loading tables:', err));
}

function updateTableDropdown() {
  const select = document.getElementById('booking-table');
  const currentValue = select.value;
  select.innerHTML = '<option value="">Select a table</option>';
  allTables.forEach(table => {
    const option = document.createElement('option');
    option.value = table.id;
    option.textContent = `${table.name} (${table.seat_count} seats)`;
    select.appendChild(option);
  });
  if (currentValue) select.value = currentValue;
}

function loadBookings() {
  if (!API || !restaurantId) {
    console.error('Missing API or restaurantId for bookings');
    showLoading(false);
    return;
  }
  
  showLoading(true);
  fetch(`${API}/restaurants/${restaurantId}/bookings`)
    .then(r => r.json())
    .then(bookings => {
      allBookings = bookings || [];
      renderCalendar();
      renderBookingsForDate(selectedDate);
      showLoading(false);
    })
    .catch(err => {
      console.error('Error loading bookings:', err);
      showLoading(false);
    });
}

function getBookingsForDate(date) {
  const dateStr = formatDateISO(date);
  return allBookings.filter(b => {
    if (!b.booking_date || b.status === 'cancelled') return false;
    // booking_date is now in YYYY-MM-DD format from backend
    return b.booking_date === dateStr;
  });
}

function formatDateISO(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateDisplay(date) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: restaurantTimezone
  });
  return formatter.format(date);
}

function renderCalendar() {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  
  // Update header
  const monthYear = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: restaurantTimezone }).format(currentDate);
  document.getElementById('calendar-month-year').textContent = monthYear;

  // Get first day and number of days in month
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const daysContainer = document.getElementById('calendar-days');
  daysContainer.innerHTML = '';

  // Previous month days
  for (let i = firstDay - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i;
    const prevDate = new Date(year, month - 1, day);
    addDayElement(daysContainer, day, 'other-month', prevDate);
  }

  // Current month days
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const isToday = isDateToday(date);
    const isSelected = isDateSelected(date);
    const classes = [];
    if (isToday) classes.push('today');
    if (isSelected) classes.push('selected');
    
    const bookingsCount = getBookingsForDate(date).length;
    if (bookingsCount > 0) classes.push('has-bookings');
    
    addDayElement(daysContainer, day, classes.join(' '), date);
  }

  // Next month days
  const totalCells = daysContainer.children.length + firstDay;
  const remainingCells = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  for (let day = 1; day <= remainingCells; day++) {
    const nextDate = new Date(year, month + 1, day);
    addDayElement(daysContainer, day, 'other-month', nextDate);
  }
}

function addDayElement(container, day, className, date) {
  const dayEl = document.createElement('div');
  dayEl.className = `calendar-day ${className}`;
  
  const dayNum = document.createElement('div');
  dayNum.className = 'calendar-day-number';
  dayNum.textContent = day;
  dayEl.appendChild(dayNum);

  if (!className.includes('other-month')) {
    const bookingsCount = getBookingsForDate(date).length;
    if (bookingsCount > 0) {
      const bookingsInfo = document.createElement('div');
      bookingsInfo.className = 'calendar-day-bookings';
      bookingsInfo.textContent = `${bookingsCount} booking${bookingsCount > 1 ? 's' : ''}`;
      dayEl.appendChild(bookingsInfo);
    }
    
    dayEl.addEventListener('click', () => selectDate(date));
  }

  container.appendChild(dayEl);
}

function isDateToday(date) {
  const today = new Date();
  return date.getFullYear() === today.getFullYear() &&
         date.getMonth() === today.getMonth() &&
         date.getDate() === today.getDate();
}

function isDateSelected(date) {
  return date.getFullYear() === selectedDate.getFullYear() &&
         date.getMonth() === selectedDate.getMonth() &&
         date.getDate() === selectedDate.getDate();
}

function selectDate(date) {
  selectedDate = new Date(date);
  renderCalendar();
  renderBookingsForDate(date);
}

function previousMonth() {
  currentDate.setMonth(currentDate.getMonth() - 1);
  renderCalendar();
}

function nextMonth() {
  currentDate.setMonth(currentDate.getMonth() + 1);
  renderCalendar();
}

function goToToday() {
  currentDate = new Date();
  selectedDate = new Date();
  renderCalendar();
  renderBookingsForDate(selectedDate);
}

function getTimeUntilBooking(bookingDate, bookingTime) {
  const [hours, minutes] = bookingTime.split(':').map(Number);
  const bookingDateTime = new Date(bookingDate);
  bookingDateTime.setHours(hours, minutes, 0, 0);
  
  const now = new Date();
  const diff = bookingDateTime - now;
  
  if (diff < 0) {
    return 'Past';
  }
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours_left = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const mins_left = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (days > 0) {
    return `${days}d ${hours_left}h`;
  } else if (hours_left > 0) {
    return `${hours_left}h ${mins_left}m`;
  } else {
    return `${mins_left}m`;
  }
}

function renderBookingsForDate(date) {
  const bookings = getBookingsForDate(date);
  const dateDisplay = formatDateDisplay(date);
  document.getElementById('selected-date-display').textContent = dateDisplay;

  const list = document.getElementById('bookings-list');
  
  if (bookings.length === 0) {
    list.innerHTML = '<p class="empty-state">No bookings for this date</p>';
    return;
  }

  // Sort by time
  bookings.sort((a, b) => a.booking_time.localeCompare(b.booking_time));

  list.innerHTML = bookings.map(booking => {
    const table = allTables.find(t => t.id === booking.table_id);
    const tableName = table ? table.name : 'Unknown Table';
    const bookingNum = booking.restaurant_booking_number || booking.id;
    const timeUntil = getTimeUntilBooking(booking.booking_date, booking.booking_time);
    
    return `
      <div class="booking-card ${booking.status === 'cancelled' ? 'cancelled' : 'reserved'}">
        <div class="booking-header">
          <div>
            <div class="booking-guest">${escapeHtml(booking.guest_name)}</div>
            <div class="booking-number">#${bookingNum}</div>
          </div>
          <div class="booking-status-badge">Reserved</div>
        </div>
        <div class="booking-time-until">in ${timeUntil}</div>
        <div class="booking-details">
          <div class="booking-details-item">
            <span>Guests:</span>
            <strong>${booking.pax}</strong>
          </div>
          <div class="booking-details-item">
            <span>Table:</span>
            <strong>${escapeHtml(tableName)}</strong>
          </div>
          <div class="booking-details-item">
            <span>Time:</span>
            <strong>${booking.booking_time}</strong>
          </div>
          ${booking.phone ? `<div class="booking-details-item"><span>Phone:</span><strong>${escapeHtml(booking.phone)}</strong></div>` : ''}
          ${booking.notes ? `<div class="booking-details-item"><span>Notes:</span><strong>${escapeHtml(booking.notes)}</strong></div>` : ''}
        </div>
        <div class="booking-actions">
          <button class="btn-edit-booking" onclick="editBooking(${booking.id})">Edit</button>
          <button class="btn-delete-booking-inline" onclick="startDeleteBooking(${booking.id})">Delete</button>
        </div>
      </div>
    `;
  }).join('');
}

function openNewBookingModal() {
  editingBookingId = null;
  document.getElementById('modal-title').textContent = 'New Booking';
  document.getElementById('btn-delete-booking').classList.add('hidden');
  
  const form = document.getElementById('booking-form');
  form.reset();
  
  document.getElementById('booking-date').value = formatDateISO(selectedDate);
  document.getElementById('booking-time').value = '19:00';
  document.getElementById('booking-status').value = 'confirmed';
  
  document.getElementById('booking-modal').classList.remove('hidden');
}

function editBooking(bookingId) {
  const booking = allBookings.find(b => b.id === bookingId);
  if (!booking) return;

  editingBookingId = bookingId;
  document.getElementById('modal-title').textContent = 'Edit Booking';
  document.getElementById('btn-delete-booking').classList.remove('hidden');

  document.getElementById('booking-guest-name').value = booking.guest_name;
  document.getElementById('booking-phone').value = booking.phone || '';
  document.getElementById('booking-pax').value = booking.pax;
  document.getElementById('booking-table').value = booking.table_id;
  document.getElementById('booking-date').value = booking.booking_date;
  document.getElementById('booking-time').value = booking.booking_time;
  document.getElementById('booking-status').value = booking.status;
  document.getElementById('booking-notes').value = booking.notes || '';

  document.getElementById('booking-modal').classList.remove('hidden');
}

function closeBookingModal() {
  document.getElementById('booking-modal').classList.add('hidden');
  editingBookingId = null;
}

function saveBooking(e) {
  e.preventDefault();

  const status = document.getElementById('booking-status').value;
  
  // Validate status is one of the allowed values
  const validStatuses = ['confirmed', 'completed', 'cancelled', 'no-show'];
  if (!validStatuses.includes(status)) {
    alert('Invalid booking status');
    return;
  }

  const data = {
    guest_name: document.getElementById('booking-guest-name').value,
    phone: document.getElementById('booking-phone').value || null,
    pax: parseInt(document.getElementById('booking-pax').value),
    table_id: parseInt(document.getElementById('booking-table').value),
    booking_date: document.getElementById('booking-date').value,
    booking_time: document.getElementById('booking-time').value,
    status: status,
    notes: document.getElementById('booking-notes').value || ''
  };

  if (!data.guest_name || !data.table_id || !data.booking_date || !data.booking_time) {
    alert('Please fill in all required fields');
    return;
  }

  showLoading(true);

  const method = editingBookingId ? 'PATCH' : 'POST';
  const url = editingBookingId
    ? `${API}/bookings/${editingBookingId}`
    : `${API}/restaurants/${restaurantId}/bookings`;

  // For PATCH, add restaurantId to body
  if (method === 'PATCH') {
    data.restaurantId = restaurantId;
  }
  
  fetch(url, {
    method: method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
    .then(r => r.json())
    .then(result => {
      if (result.error) {
        alert('Error: ' + result.error);
      } else {
        closeBookingModal();
        loadBookings();
        // Sync table reserved status
        if (typeof loadTablesCategoryTable === 'function') {
          loadTablesCategoryTable();
        }
      }
      showLoading(false);
    })
    .catch(err => {
      console.error('Error saving booking:', err);
      alert('Error saving booking: ' + err.message);
      showLoading(false);
    });
}

function startDeleteBooking(bookingId) {
  editingBookingId = bookingId;
  document.getElementById('confirm-message').textContent = 'Are you sure you want to delete this booking?';
  document.getElementById('confirm-modal').classList.remove('hidden');
}

function confirmDeleteBooking() {
  if (!editingBookingId) return;

  showLoading(true);
  fetch(`${API}/bookings/${editingBookingId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ restaurantId: restaurantId })
  })
    .then(r => r.json())
    .then(result => {
      if (result.error) {
        alert('Error: ' + result.error);
      } else {
        loadBookings();
      }
      document.getElementById('confirm-modal').classList.add('hidden');
      showLoading(false);
    })
    .catch(err => {
      console.error('Error deleting booking:', err);
      alert('Error deleting booking');
      showLoading(false);
    });
}

// Close modals when clicking backdrop
document.addEventListener('click', (e) => {
  const bookingModal = document.getElementById('booking-modal');
  const confirmModal = document.getElementById('confirm-modal');

  if (e.target === bookingModal) {
    closeBookingModal();
  }
  if (e.target === confirmModal) {
    confirmModal.classList.add('hidden');
  }
});

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Auto-refresh bookings every 5 seconds to sync with tables tab
setInterval(function() {
  if (bookingsInitialized && allBookings && allBookings.length > 0) {
    loadBookings();
  }
}, 5000);
