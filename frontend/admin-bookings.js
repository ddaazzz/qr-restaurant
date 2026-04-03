// Admin Bookings Management

let currentDate = new Date();
let selectedDate = new Date();
let allBookings = [];
let allTables = [];
let editingBookingId = null;
let bookingSearchQuery = '';

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
      const booking = allBookings.find(b => b.id === editingBookingId);
      const bookingNum = booking ? (booking.restaurant_booking_number || booking.id) : editingBookingId;
      closeBookingModal();
      confirmAndDeleteBooking(editingBookingId, bookingNum);
    }
  });

  const searchInput = document.getElementById('booking-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      bookingSearchQuery = e.target.value.trim().toLowerCase();
      renderBookingsForDate(selectedDate);
    });
  }
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
    if (!b.booking_date) return false;
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
  // Use UTC-noon trick so timezone conversion never rolls to the previous/next day
  const utcNoon = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0));
  const formatter = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC'
  });
  return formatter.format(utcNoon);
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
  let bookings = getBookingsForDate(date);
  const dateDisplay = formatDateDisplay(date);
  document.getElementById('selected-date-display').textContent = dateDisplay;

  // Filter by search query
  if (bookingSearchQuery) {
    const q = bookingSearchQuery;
    bookings = bookings.filter(b =>
      (b.guest_name && b.guest_name.toLowerCase().includes(q)) ||
      (b.phone && b.phone.toLowerCase().includes(q))
    );
  }

  const list = document.getElementById('bookings-list');

  if (bookings.length === 0) {
    const emptyTemplate = document.getElementById('empty-bookings-template');
    list.innerHTML = '';
    list.appendChild(emptyTemplate.content.cloneNode(true));
    return;
  }

  // Sort by time
  bookings.sort((a, b) => a.booking_time.localeCompare(b.booking_time));

  // Render all booking rows from template
  list.innerHTML = '';
  bookings.forEach(booking => {
    const card = renderBookingCardFromTemplate(booking);
    list.appendChild(card);
  });
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
  document.getElementById('booking-email').value = booking.email || '';
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
    email: document.getElementById('booking-email').value || null,
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
        const guestName = document.getElementById('booking-guest-name').value;
        const isNew = !editingBookingId;
        closeBookingModal();
        loadBookings();
        showToast(isNew ? `Booking created for ${guestName}` : `Booking updated for ${guestName}`);
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

function formatBookingMoney(cents) {
  if (!cents && cents !== 0) return '$0.00';
  return '$' + (cents / 100).toFixed(2);
}

// Auto-refresh bookings every 5 seconds to sync with tables tab
setInterval(function() {
  if (bookingsInitialized && allBookings && allBookings.length > 0) {
    loadBookings();
  }
}, 5000);

// ============= HTML TEMPLATE RENDERING (consolidate all HTML generation) =============
// These functions render templates for display views
// They separate concerns: display functions handle data/logic, renderers populate templates

/**
 * Render booking card from template
 * @param {Object} booking - Booking object with id, guest_name, status, pax, table_id, booking_time, booking_date, phone, notes, restaurant_booking_number
 * @returns {Element} DOM element for one booking card
 */
function renderBookingCardFromTemplate(booking) {
  const template = document.getElementById('booking-card-template');
  const card = template.content.cloneNode(true);

  const bookingNum = booking.restaurant_booking_number || booking.id;
  const sessionActive = !!booking.session_id && booking.status === 'confirmed';

  // Populate row fields
  card.querySelector('.booking-guest').textContent = booking.guest_name;
  card.querySelector('.booking-number').textContent = `#${bookingNum}`;
  card.querySelector('.booking-row-phone').textContent = booking.phone || '—';
  card.querySelector('.booking-row-pax').textContent = `👥 ${booking.pax}`;
  card.querySelector('.booking-time').textContent = booking.booking_time;

  const rowEl = card.querySelector('.booking-row');
  const badge = card.querySelector('.booking-status-badge');

  // Status badge + row colour class
  rowEl.className = 'booking-row';
  if (sessionActive) {
    rowEl.classList.add('row-in-session');
    badge.textContent = 'In Session';
    badge.className = 'booking-status-badge status-in-session';
  } else {
    const statusMap = {
      confirmed: { label: 'Confirmed', css: 'status-confirmed', row: 'row-reserved'  },
      completed: { label: 'Completed', css: 'status-completed', row: 'row-completed' },
      cancelled: { label: 'Cancelled', css: 'status-cancelled', row: 'row-cancelled' },
      'no-show': { label: 'No Show',   css: 'status-no-show',   row: 'row-no-show'   },
    };
    const s = statusMap[booking.status] || { label: booking.status, css: 'status-confirmed', row: 'row-reserved' };
    rowEl.classList.add(s.row);
    badge.textContent = s.label;
    badge.className = `booking-status-badge ${s.css}`;
  }

  // Clicking anywhere on the row opens the detail modal
  rowEl.addEventListener('click', () => openBookingDetailsModal(booking.id));

  // Edit/View button
  const editBtn = card.querySelector('.btn-edit-booking');
  if (!sessionActive && booking.status === 'confirmed') {
    editBtn.textContent = 'Edit';
    editBtn.onclick = (e) => { e.stopPropagation(); editBooking(booking.id); };
  } else {
    editBtn.textContent = 'View';
    editBtn.onclick = (e) => { e.stopPropagation(); openBookingDetailsModal(booking.id); };
  }

  // Delete button
  const deleteBtn = card.querySelector('.btn-delete-booking-inline');
  deleteBtn.onclick = (e) => { e.stopPropagation(); confirmAndDeleteBooking(booking.id, bookingNum); };

  return card;
}

function confirmAndDeleteBooking(bookingId, bookingNum) {
  if (!confirm(`Delete booking #${bookingNum}? This cannot be undone.`)) return;
  showLoading(true);
  fetch(`${API}/bookings/${bookingId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ restaurantId })
  })
    .then(r => r.json())
    .then(result => {
      if (result.error) alert('Error: ' + result.error);
      else {
        loadBookings();
        if (typeof loadTablesCategoryTable === 'function') loadTablesCategoryTable();
      }
      showLoading(false);
    })
    .catch(err => {
      console.error('Error deleting booking:', err);
      alert('Error deleting booking');
      showLoading(false);
    });
}

async function openBookingDetailsModal(bookingId) {
  const booking = allBookings.find(b => b.id === bookingId);
  if (!booking) return;

  const table = allTables.find(t => t.id === booking.table_id);
  const tableName = table ? table.name : 'Unknown Table';
  const bookingNum = booking.restaurant_booking_number || booking.id;
  const sessionActive = !!booking.session_id && booking.status === 'confirmed';
  const hasSession = !!booking.session_id;

  const statusLabels = {
    confirmed: t('admin.booking-confirmed'), completed: t('admin.booking-completed'),
    cancelled: t('admin.booking-cancelled'), 'no-show': t('admin.booking-no-show')
  };
  const statusLabel = sessionActive ? t('admin.booking-in-session') : (statusLabels[booking.status] || booking.status);
  const statusCls = sessionActive ? 'status-in-session' : `status-${booking.status}`;

  const canEdit = !sessionActive && booking.status === 'confirmed';

  const modal = document.createElement('div');
  modal.className = 'modal-overlay booking-detail-overlay';
  modal.innerHTML = `
    <div class="modal-content booking-detail-modal">
      <div class="booking-detail-header">
        <div>
          <h3 class="booking-detail-title">Booking #${bookingNum} — ${escapeHtml(booking.guest_name)}</h3>
          <span class="booking-status-badge ${statusCls}">${statusLabel}</span>
        </div>
        <button class="booking-detail-close" onclick="this.closest('.modal-overlay').remove()">×</button>
      </div>

      <div class="booking-detail-body">
        <div class="detail-section">
          <h4 class="detail-section-title">${t('admin.customer-booking-details')}</h4>
          <div class="detail-grid">
            <div class="detail-row"><span>${t('admin.booking-name-label')}</span><strong>${escapeHtml(booking.guest_name)}</strong></div>
            <div class="detail-row"><span>${t('admin.booking-phone-label')}</span><strong>${booking.phone ? escapeHtml(booking.phone) : '—'}</strong></div>
            <div class="detail-row"><span>${t('admin.booking-email-label')}</span><strong>${booking.email ? escapeHtml(booking.email) : '—'}</strong></div>
            <div class="detail-row"><span>${t('admin.booking-pax-label')}</span><strong>${booking.pax}</strong></div>
            <div class="detail-row"><span>${t('admin.booking-table-label')}</span><strong>${escapeHtml(tableName)}</strong></div>
            <div class="detail-row"><span>${t('admin.booking-date-label')}</span><strong>${booking.booking_date}</strong></div>
            <div class="detail-row"><span>${t('admin.booking-time-label')}</span><strong>${booking.booking_time}</strong></div>
            ${booking.notes ? `<div class="detail-row detail-row-full"><span>${t('admin.booking-notes-label')}</span><strong>${escapeHtml(booking.notes)}</strong></div>` : ''}
          </div>
        </div>

        ${hasSession ? `
        <div id="booking-session-section" class="detail-section">
          <h4 class="detail-section-title">${t('admin.session-orders-title')}</h4>
          <div id="session-load-state" style="color:#9ca3af;font-size:13px;padding:8px 0;">${t('admin.loading-session')}</div>
        </div>` : ''}
      </div>

      <div class="modal-button-group">
        ${canEdit ? `<button class="modal-btn-primary" onclick="this.closest('.modal-overlay').remove(); editBooking(${booking.id})">${t('admin.edit-booking')}</button>` : ''}
        <button class="modal-cancel-btn" onclick="this.closest('.modal-overlay').remove()">${t('admin.close')}</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  if (hasSession) {
    loadBookingSessionDetails(booking.session_id);
  }
}

async function loadBookingSessionDetails(sessionId) {
  const stateEl = document.getElementById('session-load-state');
  const sectionEl = document.getElementById('booking-session-section');
  if (!stateEl || !sectionEl) return;

  try {
    const [sessionRes, ordersRes] = await Promise.all([
      fetch(`${API}/sessions/${sessionId}`),
      fetch(`${API}/sessions/${sessionId}/orders`)
    ]);
    if (!sessionRes.ok || !ordersRes.ok) throw new Error('API error');

    const session = await sessionRes.json();
    const ordersData = await ordersRes.json();
    const orders = ordersData.items || [];

    const fmt = (iso) => {
      if (!iso) return '—';
      return new Date(iso).toLocaleString('en-HK', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    };

    let ordersHtml = '';
    let grandTotal = 0;

    if (orders.length === 0) {
      ordersHtml = `<p style="color:#9ca3af;font-size:13px;margin:8px 0;">${t('admin.no-orders-session')}</p>`;
    } else {
      orders.forEach(order => {
        grandTotal += order.total_cents || 0;
        const orderNum = order.restaurant_order_number || order.order_id;
        const payMethod = order.order_payment_method
          ? order.order_payment_method.charAt(0).toUpperCase() + order.order_payment_method.slice(1)
          : 'Unpaid';
        const refText = order.order_reference ? `<span style="font-size:11px;color:#9ca3af;"> · Ref: ${escapeHtml(order.order_reference)}</span>` : '';
        const paidBadge = order.order_status === 'completed'
          ? `<span class="order-badge order-badge-paid">${t('admin.paid')}</span>`
          : `<span class="order-badge order-badge-pending">${order.order_status || t('admin.pending')}</span>`;

        const itemsHtml = (order.items || []).filter(i => !i.is_addon).map(item => {
          const varText = item.variants ? `<em style="color:#9ca3af;font-size:11px;"> (${escapeHtml(item.variants)})</em>` : '';
          const addonsHtml = (item.addons || []).map(a =>
            `<div class="order-item-addon">+ ${escapeHtml(a.menu_item_name)} ×${a.quantity} — ${formatBookingMoney(a.item_total_cents)}</div>`
          ).join('');
          return `
            <div class="order-item-row">
              <div class="order-item-name">${escapeHtml(item.menu_item_name)} ×${item.quantity}${varText}${addonsHtml}</div>
              <strong class="order-item-price">${formatBookingMoney(item.item_total_cents)}</strong>
            </div>`;
        }).join('');

        ordersHtml += `
          <div class="order-block">
            <div class="order-block-header">
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                <strong>${t('admin.order-num-prefix')}${orderNum}</strong>${paidBadge}
              </div>
              <span style="font-size:12px;color:#6b7280;">${payMethod}${refText}</span>
            </div>
            ${itemsHtml}
            <div class="order-block-total">${t('admin.order-total-prefix')} ${formatBookingMoney(order.total_cents || 0)}</div>
          </div>`;
      });
    }

    const sessionNum = session.restaurant_session_number || session.id;
    sectionEl.innerHTML = `
      <h4 class="detail-section-title">${t('admin.session-orders-title')}</h4>
      <div class="detail-grid" style="margin-bottom:12px;">
        <div class="detail-row"><span>${t('admin.session-num-label')}</span><strong>${sessionNum}</strong></div>
        <div class="detail-row"><span>${t('admin.booking-table-label')}</span><strong>${session.table_name || '—'}</strong></div>
        <div class="detail-row"><span>${t('admin.session-guests-label')}</span><strong>${session.pax}</strong></div>
        <div class="detail-row"><span>${t('admin.session-started')}</span><strong>${fmt(session.started_at)}</strong></div>
        <div class="detail-row"><span>${t('admin.session-ended-label')}</span><strong>${session.ended_at ? fmt(session.ended_at) : `<span style="color:#22c55e;font-weight:600;">${t('admin.session-active-label')}</span>`}</strong></div>
      </div>
      <div class="orders-list-wrapper">
        ${ordersHtml}
        ${orders.length > 0 ? `<div class="grand-total-row">${t('admin.grand-total-label')} ${formatBookingMoney(grandTotal)}</div>` : ''}
      </div>`;
  } catch (err) {
    console.error('Error loading session details:', err);
    if (stateEl) stateEl.textContent = t('admin.error-loading-session');
  }
}

// ============= OLD HTML TEMPLATE BUILDERS (DEPRECATED - use renderBookingCardFromTemplate instead) =============
// These functions encapsulate HTML generation for display views
// They separate concerns: display functions handle data/logic, builders handle HTML

/**
 * Build individual booking card HTML
 * @deprecated Use renderBookingCardFromTemplate() instead
 * @param {Object} booking - Booking object with id, guest_name, status, pax, table_id, booking_time, booking_date, phone, notes, restaurant_booking_number
 * @param {Array} allTables - Array of table objects to look up table name
 * @returns {string} HTML string for one booking card
 */
function buildBookingCardHTML_DEPRECATED(booking, allTables) {
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
}
