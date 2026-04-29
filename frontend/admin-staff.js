// ============= STAFF MODULE =============

let STAFF_EDIT_MODE = false;
let STAFF_EDIT_ID = null; // Track which staff is being edited
let STAFF_OLD_HOURLY_RATE = null; // Store old hourly rate to detect changes
let CURRENT_WORK_DAYS = 30; // Default timeframe for work log (days)
let staffInitialized = false;

// Initialize staff section
function initializeStaff() {
  // Always load staff data when section is switched to
  loadStaff();
  
  // Attach event listeners only once
  if (!staffInitialized) {
    staffInitialized = true;
    attachEventListeners();
  }
}

function attachEventListeners() {
  // Close modal when clicking outside (on backdrop)
  document.addEventListener("click", function(event) {
    const modal = document.getElementById("staff-detail-modal");
    if (!modal) return;
    if (event.target === modal) {
      closeStaffDetailModal();
    }
  });
  
  // Language change listener
  window.addEventListener('languageChanged', () => {
    loadStaff();
  });
}

async function loadStaff() {
  // Allow admin/superadmin, or staff with feature 4 access
  const hasAccess = IS_ADMIN || IS_SUPERADMIN || (IS_STAFF && typeof staffAccessRights !== 'undefined' && Array.isArray(staffAccessRights) && staffAccessRights.includes(4));
  if (!hasAccess) {
    console.log("User does not have access to staff management");
    return;
  }

  // Load menu categories for kitchen role
  await loadMenuCategories();

  try {
    const res = await fetch(`${API}/restaurants/${restaurantId}/staff`);
    if (!res.ok) throw new Error('Failed to load staff');
    
    const staff = await res.json();

    const container = document.getElementById("staff-grid");
    if (!container) {
      console.error("staff-grid container not found");
      return;
    }
    
    // Render staff list using templates
    renderStaffList(staff, STAFF_EDIT_MODE);
    reTranslateContent();
    
  } catch (err) {
    console.error("Error loading staff:", err);
    const container = document.getElementById("staff-grid");
    if (container) {
      container.innerHTML = '<p style="color: #ef4444; grid-column: 1/-1;">Error loading staff</p>';
    }
  }
}

function toggleStaffEditMode(section) {
  // Only allow edit mode when staff section is active
  if (section !== 'staff') {
    return;
  }
  
  STAFF_EDIT_MODE = !STAFF_EDIT_MODE;
  document.body.classList.toggle("edit-mode");
  
  const editBtn = document.getElementById("staff-edit-btn");
  const staffCards = document.querySelectorAll('.staff-card:not(#add-staff-card)');
  const addStaffCard = document.getElementById('add-staff-card');
  
  // Update button text
  if (editBtn) {
    editBtn.innerHTML = STAFF_EDIT_MODE 
      ? `<img src="/uploads/website/pencil.png" alt="edit" class="btn-icon"> ${t('admin.done')}`
      : `<img src="/uploads/website/pencil.png" alt="edit" class="btn-icon"> ${t('admin.edit')}`;
    if (STAFF_EDIT_MODE) {
      editBtn.classList.add("active");
    } else {
      editBtn.classList.remove("active");
    }
  }
  
  // Show/hide Add Staff card based on edit mode
  if (addStaffCard) {
    if (STAFF_EDIT_MODE) {
      addStaffCard.classList.remove('hidden');
    } else {
      addStaffCard.classList.add('hidden');
    }
  }
  
  // Show/hide edit/delete buttons on all cards
  staffCards.forEach(card => {
    const actions = card.querySelector('.staff-card-actions');
    if (actions) {
      actions.style.display = STAFF_EDIT_MODE ? 'flex' : 'none';
    }
  });
}

async function loadMenuCategories() {
  try {
    const res = await fetch(`${API}/restaurants/${restaurantId}/menu_categories`);
    if (res.ok) {
      MENU_CATEGORIES = await res.json();
      populateKitchenCategories();
    }
  } catch (err) {
    console.error("Error loading categories:", err);
  }
}

function populateKitchenCategories() {
  // Render kitchen categories using template
  renderKitchenCategories(MENU_CATEGORIES);
}

function handleStaffRoleChange() {
  const role = document.getElementById("staff-role").value;
  const tabAccessDiv = document.getElementById("staff-tab-access");
  const categoryAccessDiv = document.getElementById("kitchen-category-access");
  
  if (role === "staff") {
    tabAccessDiv.style.display = "block";
    categoryAccessDiv.style.display = "none";
  } else if (role === "kitchen") {
    tabAccessDiv.style.display = "none";
    categoryAccessDiv.style.display = "block";
  }
}

function resetStaffForm() {
  document.getElementById("staff-name").value = "";
  document.getElementById("staff-pin").value = "";
  document.getElementById("staff-role").value = "";
  document.getElementById("staff-hourly-rate").value = "";
  const emailInput = document.getElementById("staff-email");
  if (emailInput) emailInput.value = "";
  const passwordInput = document.getElementById("staff-password");
  if (passwordInput) passwordInput.value = "";
  document.getElementById("staff-error").style.display = "none";
  document.getElementById("staff-success").style.display = "none";
  document.getElementById("staff-submit-btn").textContent = "➕ Add Staff";
  
  // Clear checkboxes
  document.querySelectorAll(".staff-access-checkbox, .kitchen-category-checkbox").forEach(cb => {
    cb.checked = false;
  });
  
  // Hide both access sections
  document.getElementById("staff-tab-access").style.display = "none";
  document.getElementById("kitchen-category-access").style.display = "none";
  
  STAFF_EDIT_ID = null;
}

async function editStaff(staffId, event) {
  if (event) event.stopPropagation();
  
  // Parse staffId in case it's passed as string
  const parsedId = parseInt(staffId, 10);
  
  if (!parsedId || isNaN(parsedId)) {
    console.error("❌ Invalid staff ID:", staffId);
    alert('Error: Invalid staff ID');
    return;
  }
  
  // Allow edit from modal even if not in STAFF_EDIT_MODE
  
  try {
    console.log(`📝 Editing staff ${parsedId} for restaurant ${restaurantId}`);
    const res = await fetch(`${API}/restaurants/${restaurantId}/staff/${parsedId}`);
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(`Failed to load staff: ${res.status} ${errData.error || res.statusText}`);
    }
    
    const staff = await res.json();
    console.log("✅ Staff data loaded:", staff);
    
    // Set the edit ID
    STAFF_EDIT_ID = parsedId;
    
    // Populate form
    document.getElementById("staff-name").value = staff.name;
    document.getElementById("staff-pin").value = staff.pin || "";
    document.getElementById("staff-role").value = staff.role || "staff";
    
    // Populate hourly rate (convert from cents to dollars)
    if (staff.hourly_rate_cents) {
      document.getElementById("staff-hourly-rate").value = (staff.hourly_rate_cents / 100).toFixed(2);
    } else {
      document.getElementById("staff-hourly-rate").value = "";
    }
    STAFF_OLD_HOURLY_RATE = staff.hourly_rate_cents || null;

    // Populate employment start date
    const empStartInput = document.getElementById("staff-employment-start");
    if (empStartInput) empStartInput.value = staff.employment_start_date ? staff.employment_start_date.split('T')[0] : '';

    // Populate email field
    const emailInput = document.getElementById("staff-email");
    if (emailInput) emailInput.value = staff.email || "";
    const passwordInput = document.getElementById("staff-password");
    if (passwordInput) passwordInput.value = "";
    
    document.getElementById("staff-submit-btn").textContent = "Update";
    
    // Clear all checkboxes first
    document.querySelectorAll(".staff-access-checkbox, .kitchen-category-checkbox").forEach(cb => {
      cb.checked = false;
    });
    
    // Populate access rights based on role
    if (staff.role === "staff" && staff.access_rights) {
      const tabs = typeof staff.access_rights === 'string' ? JSON.parse(staff.access_rights) : staff.access_rights;
      if (Array.isArray(tabs)) {
        tabs.forEach(tab => {
          const checkbox = document.getElementById(`access-${tab}`);
          if (checkbox) checkbox.checked = true;
        });
      }
    } else if (staff.role === "kitchen" && staff.access_rights) {
      const categories = typeof staff.access_rights === 'string' ? JSON.parse(staff.access_rights) : staff.access_rights;
      if (Array.isArray(categories)) {
        categories.forEach(catId => {
          const checkbox = document.querySelector(`.kitchen-category-checkbox[value="${catId}"]`);
          if (checkbox) checkbox.checked = true;
        });
      }
    }
    
    // Update display
    handleStaffRoleChange();
    
    // Set title and open panel
    const title = document.getElementById("staff-form-title");
    if (title) title.textContent = "Edit Staff";
    openStaffForm();
    
  } catch (err) {
    console.error("❌ Error loading staff:", err);
    alert("Error loading staff: " + err.message);
  }
}

async function createOrUpdateStaff() {
  const errorEl = document.getElementById("staff-error");
  const successEl = document.getElementById("staff-success");
  errorEl.style.display = "none";
  successEl.style.display = "none";

  const name = document.getElementById("staff-name").value.trim();
  const pin = document.getElementById("staff-pin").value.trim();
  const role = document.getElementById("staff-role").value;
  const hourlyRateInput = document.getElementById("staff-hourly-rate").value.trim();

  if (!name || !pin) {
    errorEl.textContent = "Name and PIN are required";
    errorEl.style.display = "flex";
    return;
  }

  if (pin.length !== 6 || isNaN(pin)) {
    errorEl.textContent = "PIN must be exactly 6 digits";
    errorEl.style.display = "flex";
    return;
  }

  // Convert hourly rate to cents (handle decimal format)
  let hourly_rate_cents = null;
  if (hourlyRateInput) {
    const rate = parseFloat(hourlyRateInput);
    if (isNaN(rate) || rate < 0) {
      errorEl.textContent = "Hourly rate must be a positive number";
      errorEl.style.display = "flex";
      return;
    }
    hourly_rate_cents = Math.round(rate * 100); // Convert dollars to cents
  }

  // Collect access rights based on role
  let access_rights = [];
  if (role === "staff") {
    document.querySelectorAll(".staff-access-checkbox:checked").forEach(cb => {
      access_rights.push(cb.value);
    });
  } else if (role === "kitchen") {
    document.querySelectorAll(".kitchen-category-checkbox:checked").forEach(cb => {
      access_rights.push(parseInt(cb.value));
    });
  }

  try {
    const payload = { name, pin, role, access_rights, hourly_rate_cents };

    // Add employment start date if provided
    const empStartInput = document.getElementById("staff-employment-start");
    if (empStartInput) {
      const empVal = empStartInput.value.trim();
      if (empVal) payload.employment_start_date = empVal;
      else if (STAFF_EDIT_ID) payload.employment_start_date = null;
    }

    // Add email and password if provided
    const emailInput = document.getElementById("staff-email");
    const passwordInput = document.getElementById("staff-password");
    if (emailInput) {
      const email = emailInput.value.trim();
      if (email) payload.email = email;
      else if (STAFF_EDIT_ID) payload.email = null; // Allow clearing email on edit
    }
    if (passwordInput) {
      const password = passwordInput.value;
      if (password) payload.password = password;
    }

    // Detect hourly rate change and prompt for backfill
    if (STAFF_EDIT_ID && hourly_rate_cents !== null && STAFF_OLD_HOURLY_RATE !== null && hourly_rate_cents !== STAFF_OLD_HOURLY_RATE) {
      const backfill = confirm(t('admin.rate-changed-backfill-prompt') || 'Hourly rate changed. Apply new rate to all previous work log records too?\n\nOK = yes, backfill all history\nCancel = only apply to new shifts');
      payload.backfill_hourly_rate = backfill;
    }
    
    const url = STAFF_EDIT_ID 
      ? `${API}/restaurants/${restaurantId}/staff/${STAFF_EDIT_ID}`
      : `${API}/restaurants/${restaurantId}/staff`;
    
    const method = STAFF_EDIT_ID ? "PATCH" : "POST";
    
    const res = await fetch(url, {
      method: method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!res.ok) {
      errorEl.textContent = data.error || `Failed to ${STAFF_EDIT_ID ? 'update' : 'create'} staff`;
      errorEl.style.display = "flex";
      return;
    }

    // Success
    const actionText = STAFF_EDIT_ID ? 'updated' : 'created';
    successEl.textContent = `Staff member ${actionText} successfully`;
    successEl.style.display = "flex";
    showToast(`Staff member ${actionText}`);
    
    setTimeout(() => {
      successEl.style.display = "none";
      closeStaffForm();
    }, 1500);

    resetStaffForm();
    loadStaff();
    
  } catch (err) {
    console.error("Error:", err);
    errorEl.textContent = "Network error: " + (err.message || "Operation failed");
    errorEl.style.display = "flex";
  }
}

async function deleteStaff(staffId, event) {
  if (event) event.stopPropagation();
  if (!STAFF_EDIT_MODE) return;

  if (!confirm("Delete this staff member?")) return;

  try {
    const res = await fetch(`${API}/restaurants/${restaurantId}/staff/${staffId}`, { 
      method: "DELETE" 
    });
    
    if (!res.ok) {
      const error = await res.json();
      alert(error.error || "Failed to delete staff");
      return;
    }

    const successEl = document.getElementById("staff-success");
    if (successEl) {
      successEl.textContent = "Staff member deleted";
      successEl.style.display = "flex";
      setTimeout(() => {
        successEl.style.display = "none";
      }, 3000);
    }

    loadStaff();
  } catch (err) {
    console.error(err);
    alert("Error: " + (err.message || "Failed to delete staff"));
  }
}
function openStaffForm() {
  const panel = document.getElementById("staff-create-section");
  if (!panel) {
    console.error("Staff form panel not found");
    return;
  }
  
  // Only reset if not editing
  if (!STAFF_EDIT_ID) {
    const title = panel.querySelector('h3');
    if (title) {
      title.textContent = "Create New Staff";
    }
    resetStaffForm();
  } else {
    const title = panel.querySelector('h3');
    if (title) {
      title.textContent = "Edit Staff";
    }
  }
  
  panel.classList.remove("hidden");
  
  // Focus on first input
  setTimeout(() => {
    const nameInput = document.getElementById("staff-name");
    if (nameInput) nameInput.focus();
  }, 100);
}

function closeStaffForm() {
  const panel = document.getElementById("staff-create-section");
  if (!panel) return;
  
  panel.classList.add("hidden");
  STAFF_EDIT_ID = null;
  resetStaffForm();
}

// ============= STAFF DETAIL MODAL FUNCTIONS =============

let CURRENT_STAFF_ID = null; // Track which staff is shown in modal

function openStaffDetailModal(staffId) {
  CURRENT_STAFF_ID = staffId;
  CURRENT_WORK_DAYS = 30; // Reset to default on open
  const modal = document.getElementById("staff-detail-modal");
  if (!modal) return;
  modal.style.display = "flex";
  loadStaffDetailData();
}

function closeStaffDetailModal() {
  const modal = document.getElementById("staff-detail-modal");
  if (!modal) return;
  modal.style.display = "none";
  CURRENT_STAFF_ID = null;
}

function setWorkLogDays(days) {
  CURRENT_WORK_DAYS = days;
  // Update filter button active states
  [1, 7, 30, 3650].forEach(function(d) {
    var btn = document.getElementById('work-days-btn-' + d);
    if (btn) {
      btn.style.background = d === days ? '#3b82f6' : '#e5e7eb';
      btn.style.color = d === days ? 'white' : '#374151';
    }
  });
  loadStaffDetailData();
}

async function loadStaffDetailData() {
  if (!CURRENT_STAFF_ID) return;
  
  try {
    const res = await fetch(`${API}/restaurants/${restaurantId}/staff/${CURRENT_STAFF_ID}?days=${CURRENT_WORK_DAYS}`);
    if (!res.ok) throw new Error('Failed to load staff details');
    
    const staff = await res.json();
    
    // Update staff info
    document.getElementById("staff-detail-name").textContent = staff.name;
    document.getElementById("staff-detail-role").textContent = staff.role === 'kitchen' ? t('admin.kitchen-role') : t('admin.staff-role');
    document.getElementById("staff-detail-pin").textContent = staff.pin || '-';
    
    // Format hourly rate
    if (staff.hourly_rate_cents) {
      const rate = (staff.hourly_rate_cents / 100).toFixed(2);
      document.getElementById("staff-detail-wage").textContent = `$${rate}/hr`;
    } else {
      document.getElementById("staff-detail-wage").textContent = 'Not set';
    }

    // Show start date
    const startDateEl = document.getElementById("staff-detail-start-date");
    if (startDateEl) {
      startDateEl.textContent = staff.employment_start_date ? staff.employment_start_date.split('T')[0] : '—';
    }
    
    // Update clock status
    const statusEl = document.getElementById("staff-detail-status");
    const clockInBtn = document.getElementById("staff-clock-in-btn");
    const clockOutBtn = document.getElementById("staff-clock-out-btn");
    
    if (staff.currently_clocked_in) {
      statusEl.textContent = 'Clocked In';
      statusEl.style.color = '#10b981';
      clockInBtn.style.display = "none";
      clockOutBtn.style.display = "block";
    } else {
      statusEl.textContent = '⚪ Clocked Out';
      statusEl.style.color = '#999';
      clockInBtn.style.display = "block";
      clockOutBtn.style.display = "none";
    }
    
    // Update work hours summary
    if (staff.stats) {
      document.getElementById("staff-total-shifts").textContent = staff.stats.total_shifts;
      document.getElementById("staff-total-hours").textContent = staff.stats.total_hours.toFixed(1);
      const salaryEl = document.getElementById("staff-estimated-salary");
      if (salaryEl) {
        if (staff.stats.estimated_salary_cents !== null && staff.stats.estimated_salary_cents !== undefined) {
          salaryEl.textContent = '$' + (staff.stats.estimated_salary_cents / 100).toFixed(2);
        } else {
          salaryEl.textContent = '—';
        }
      }
    }

    // Sync filter button active states
    [1, 7, 30, 3650].forEach(function(d) {
      var btn = document.getElementById('work-days-btn-' + d);
      if (btn) {
        btn.style.background = d === CURRENT_WORK_DAYS ? '#3b82f6' : '#e5e7eb';
        btn.style.color = d === CURRENT_WORK_DAYS ? 'white' : '#374151';
      }
    });
    
    // Display timekeeping list
    displayTimekeepingList(staff.timekeeping || [], staff.hourly_rate_cents);
  } catch (err) {
    console.error("Error loading staff details:", err);
  }
}

function displayTimekeepingList(records, staffHourlyRate) {
  const container = document.getElementById("staff-timekeeping-list");
  if (!container) return;
  
  // Render timekeeping list using template
  renderTimekeepingList(records, staffHourlyRate);
}

async function clockInStaff() {
  if (!CURRENT_STAFF_ID) return;
  
  try {
    const res = await fetch(`${API}/restaurants/${restaurantId}/staff/${CURRENT_STAFF_ID}/clock-in`, {
      method: 'POST'
    });
    
    if (!res.ok) throw new Error('Failed to clock in');
    
    const messageEl = document.getElementById("staff-clock-message");
    messageEl.textContent = '✓ Clocked in successfully';
    messageEl.style.color = '#10b981';
    
    setTimeout(() => {
      loadStaffDetailData();
      messageEl.textContent = '';
    }, 1500);
  } catch (err) {
    console.error("Error clocking in:", err);
    const messageEl = document.getElementById("staff-clock-message");
    messageEl.textContent = '✗ Error: ' + (err.message || 'Failed to clock in');
    messageEl.style.color = '#ef4444';
  }
}

async function clockOutStaff() {
  if (!CURRENT_STAFF_ID) return;
  
  try {
    const res = await fetch(`${API}/restaurants/${restaurantId}/staff/${CURRENT_STAFF_ID}/clock-out`, {
      method: 'POST'
    });
    
    if (!res.ok) throw new Error('Failed to clock out');
    
    const messageEl = document.getElementById("staff-clock-message");
    messageEl.textContent = '✓ Clocked out successfully';
    messageEl.style.color = '#10b981';
    
    setTimeout(() => {
      loadStaffDetailData();
      messageEl.textContent = '';
    }, 1500);
  } catch (err) {
    console.error("Error clocking out:", err);
    const messageEl = document.getElementById("staff-clock-message");
    messageEl.textContent = '✗ Error: ' + (err.message || 'Failed to clock out');
    messageEl.style.color = '#ef4444';
  }
}

function editStaffFromModal() {
  if (!CURRENT_STAFF_ID) {
    console.error("❌ No staff ID available for editing");
    alert("Error: No staff member selected. Please close and reopen the details.");
    return;
  }
  console.log("📝 Editing staff ID:", CURRENT_STAFF_ID);
  closeStaffDetailModal();
  editStaff(CURRENT_STAFF_ID);
}

function deleteStaffFromModal() {
  if (!CURRENT_STAFF_ID) return;
  if (confirm('Are you sure you want to delete this staff member?')) {
    deleteStaff(CURRENT_STAFF_ID);
    closeStaffDetailModal();
  }
}

// ============= HTML TEMPLATE BUILDERS (consolidate all HTML generation) =============
// These functions encapsulate HTML generation for display views
// They handle all data transformation and return HTML strings
// Display functions only: fetch data, validate, call template builder, assign to innerHTML

// ============= TEMPLATE RENDERING FUNCTIONS =============

/**
 * Render staff list using templates
 * @param {Array} staff - Array of staff objects
 * @param {boolean} isEditMode - Whether edit mode is enabled
 */
function renderStaffList(staff, isEditMode) {
  const container = document.getElementById("staff-grid");
  if (!container) {
    console.error("staff-grid container not found");
    return;
  }
  
  container.innerHTML = "";

  // Show message if no staff
  if (!staff || staff.length === 0) {
    const noStaffMsg = document.createElement('p');
    noStaffMsg.style.color = 'var(--text-light)';
    noStaffMsg.style.fontSize = '14px';
    noStaffMsg.style.textAlign = 'center';
    noStaffMsg.style.padding = '20px';
    noStaffMsg.style.gridColumn = '1/-1';
    noStaffMsg.textContent = t('admin.no-staff') || 'No staff members yet - Use the Edit button to add one';
    container.appendChild(noStaffMsg);
  } else {
    // Render staff cards only if there is staff
    const cardTemplate = document.getElementById("staff-card-template");
    const ACCESS_MAP = {
      1: t('admin.access-orders'),
      2: t('admin.access-tables'),
      3: t('admin.access-menu'),
      4: t('admin.access-staff'),
      5: t('admin.access-settings'),
      6: t('admin.access-bookings')
    };

    staff.forEach(s => {
      const card = document.createElement('div');
      card.className = 'staff-card';
      card.style.cursor = isEditMode ? 'default' : 'pointer';
      if (!isEditMode) {
        card.onclick = () => openStaffDetailModal(s.id);
      }
      
      // Clone template
      const clone = cardTemplate.content.cloneNode(true);
      
      // Populate staff data
      clone.querySelector('.staff-card-name').textContent = s.name;
      const roleLabel = s.role === 'kitchen' ? t('admin.kitchen-role') : t('admin.staff-role');
      const roleColor = s.role === 'kitchen' ? '#ff6b6b' : '#3b82f6';
      const roleEl = clone.querySelector('.staff-card-role');
      roleEl.textContent = roleLabel;
      roleEl.style.background = `${roleColor}20`;
      roleEl.style.color = roleColor;
      
      // Format access rights display
      let accessDisplay = t('admin.no-access');
      if (s.access_rights) {
        try {
          const rights = typeof s.access_rights === 'string' ? JSON.parse(s.access_rights) : s.access_rights;
          if (Array.isArray(rights) && rights.length > 0) {
            const featureNames = rights.map(id => ACCESS_MAP[id] || `Feature ${id}`);
            accessDisplay = featureNames.join(', ');
          } else if (typeof rights === 'object' && Object.keys(rights).length > 0) {
            accessDisplay = Object.keys(rights).join(', ');
          }
        } catch (e) {
          accessDisplay = t('admin.no-access');
        }
      }
      clone.querySelector('.access-text').textContent = accessDisplay;
      
      // Setup delete button
      const deleteBtn = clone.querySelector('.btn-delete');
      deleteBtn.style.display = isEditMode ? 'block' : 'none';
      deleteBtn.onclick = (e) => {
        e.preventDefault();
        deleteStaff(s.id, e);
      };
      
      const actions = clone.querySelector('.staff-card-actions');
      actions.style.display = isEditMode ? 'flex' : 'none';
      
      card.appendChild(clone);
      container.appendChild(card);
    });
  }

  // Always add the "Add Staff" card at the end (will be hidden unless in edit mode)
  const addStaffCardTemplate = document.getElementById("add-staff-card-template");
  const addStaffCard = document.createElement('div');
  addStaffCard.id = 'add-staff-card';
  addStaffCard.className = 'staff-card add-staff-card-style';
  if (!isEditMode) {
    addStaffCard.classList.add('hidden');
  }
  addStaffCard.onclick = () => openStaffForm();
  
  const addClone = addStaffCardTemplate.content.cloneNode(true);
  addStaffCard.appendChild(addClone);
  container.appendChild(addStaffCard);
}

/**
 * Render kitchen categories using templates
 * @param {Array} categories - Array of category objects with id and name
 */
function renderKitchenCategories(categories) {
  const container = document.getElementById("kitchen-categories-list");
  if (!container || !categories) return;
  
  container.innerHTML = "";
  const template = document.getElementById("kitchen-category-template");
  
  categories.forEach(cat => {
    const clone = template.content.cloneNode(true);
    clone.querySelector('.kitchen-category-checkbox').value = cat.id;
    clone.querySelector('.category-name').textContent = cat.name;
    container.appendChild(clone);
  });
}

/**
 * Render timekeeping list using templates
 * @param {Array} records - Array of timekeeping records with clock_in_at, clock_out_at, duration_minutes, hourly_rate_cents
 * @param {number|null} staffHourlyRate - Staff's current hourly rate in cents (fallback for records without snapshot)
 */
function renderTimekeepingList(records, staffHourlyRate) {
  const container = document.getElementById("staff-timekeeping-list");
  if (!container) return;
  
  if (!records || records.length === 0) {
    container.innerHTML = '<p style="color: #999; font-size: 14px;">No work history in the selected period</p>';
    return;
  }
  
  container.innerHTML = "";
  const template = document.getElementById("timekeeping-item-template");
  
  records.forEach(record => {
    const clockIn = new Date(record.clock_in_at);
    const clockOut = record.clock_out_at ? new Date(record.clock_out_at) : null;
    const hours = record.duration_minutes ? (record.duration_minutes / 60).toFixed(1) : '—';
    
    const dateStr = clockIn.toLocaleDateString();
    const timeInStr = clockIn.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const timeOutStr = clockOut ? clockOut.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Still working';
    
    // Calculate salary: use per-record snapshot rate if available, else fall back to current staff rate
    const rateForRecord = record.hourly_rate_cents || staffHourlyRate || 0;
    const salaryStr = rateForRecord > 0 && record.duration_minutes
      ? '$' + (record.duration_minutes / 60 * rateForRecord / 100).toFixed(2)
      : '';
    
    const clone = template.content.cloneNode(true);
    clone.querySelector('.timekeeping-date').textContent = dateStr;
    clone.querySelector('.timekeeping-time-in').textContent = timeInStr;
    clone.querySelector('.timekeeping-time-out').textContent = timeOutStr;
    clone.querySelector('.timekeeping-hours').textContent = hours + 'h';
    const salaryEl = clone.querySelector('.timekeeping-salary');
    if (salaryEl) salaryEl.textContent = salaryStr;
    
    container.appendChild(clone);
  });
}