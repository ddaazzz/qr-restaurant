// ============= TABLES MODULE =============
// All table management functionality extracted from admin.js

// ============= PRINTER ROUTING HELPERS =============
// Printer routing functions are defined in printer-routing.js
// Backend endpoints handle HTML generation and printer routing:
// - POST /api/restaurants/:id/print-qr - QR code printing
// - POST /api/restaurants/:id/print-order - Order/kitchen receipt printing  
// - POST /api/restaurants/:id/print-bill - Bill/session receipt printing
// ============= END PRINTER ROUTING HELPERS =============

// Initialization state
let tablesInitialized = false;

function initializeTables() {
  // Always load table categories and table data when section is switched to
  loadTablesCategoryTable();
  loadActiveKPayTerminal();

  // Attach event listeners only once
  if (!tablesInitialized) {
    tablesInitialized = true;
    attachEventListeners();
  }
}

/** Fetch the active KPay terminal and store in window._kpayTerminal.
 *  Used to conditionally show the KPay payment option in close-bill. */
async function loadActiveKPayTerminal() {
  try {
    const rid = restaurantId || localStorage.getItem('restaurantId');
    if (!rid) return;
    const resp = await fetch(`${API}/restaurants/${rid}/kpay-terminal/active`);
    if (!resp.ok) return;
    const data = await resp.json();
    window._kpayTerminal = data.configured ? data.terminal : null;
  } catch {
    window._kpayTerminal = null;
  }
}

function attachEventListeners() {
  const closeOrdersModal = document.getElementById('close-orders-modal');
  const modalCloseBtn = document.getElementById('modal-close-btn');
  const viewOrdersBtn = document.getElementById('view-orders-btn');
  const closeBillBtn = document.getElementById('close-bill-btn');
  
  if (closeOrdersModal) {
    closeOrdersModal.addEventListener('click', () => {
      const modal = document.getElementById('orders-modal');
      if (modal) modal.classList.add('hidden');
    });
  }
  
  if (modalCloseBtn) {
    modalCloseBtn.addEventListener('click', () => {
      const modal = document.getElementById('orders-modal');
      if (modal) modal.classList.add('hidden');
    });
  }
  
  if (viewOrdersBtn) {
    viewOrdersBtn.addEventListener('click', () => {
      const modal = document.getElementById('orders-modal');
      if (modal) modal.classList.remove('hidden');
    });
  }
  
  if (closeBillBtn) {
    closeBillBtn.addEventListener('click', () => closeBillModal(sessionId));
  }
  
  // Language change listener
  window.addEventListener('languageChanged', () => {
    reTranslateContent();
  });
}

// Helper to get today's date in restaurant timezone (YYYY-MM-DD format)
function getTodayDateString() {
  const tz = typeof restaurantTimezone !== 'undefined' ? restaurantTimezone : 'UTC';
  const formatter = new Intl.DateTimeFormat('en-CA', { 
    year: 'numeric', 
    month: '2-digit', 
    day: '2-digit',
    timeZone: tz 
  });
  return formatter.format(new Date());
}

async function loadTablesCategories() {
  var url = API + "/restaurants/" + restaurantId + "/table-categories";
  var res = await fetch(url);
  TABLE_CATEGORIES = await res.json();

  // auto-select first category
  if (!SELECTED_TABLE_CATEGORY && TABLE_CATEGORIES.length) {
    SELECTED_TABLE_CATEGORY = TABLE_CATEGORIES[0];
  }

  renderTableCategoryTabs();
}

function renderTableCategoryTabs() {
  var tabs = document.getElementById("tables-category-tabs");
  if (!tabs) {
    console.warn("tables-category-tabs element not found");
    return;
  }
  tabs.innerHTML = "";

  // If no categories exist and in edit mode, show "Create Category" button
  if (TABLE_CATEGORIES.length === 0 && document.body.classList.contains("edit-mode")) {
    var createBtn = document.createElement("button");
    createBtn.className = "tab active";
    createBtn.textContent = "+ Create First Category";
    createBtn.style.flex = "1";
    createBtn.onclick = function() { addTableCategoryModal(); };
    tabs.appendChild(createBtn);
    return;
  }

  var isEditMode = document.body.classList.contains("edit-mode");

  for (var ci = 0; ci < TABLE_CATEGORIES.length; ci++) {
    var cat = TABLE_CATEGORIES[ci];
    
    // Create wrapper container for category button with controls
    var wrapper = document.createElement("div");
    wrapper.style.display = "flex";
    wrapper.style.flexDirection = "column";
    wrapper.style.alignItems = "center";
    wrapper.style.position = "relative";
    wrapper.className = "category-button-wrapper";
    
    var btn = document.createElement("button");
    var isActive = SELECTED_TABLE_CATEGORY && SELECTED_TABLE_CATEGORY.key === cat.key;
    btn.className = isActive ? "tab active" : "tab";
    btn.textContent = cat.key;
    btn.categoryKey = cat.key;
    btn.categoryId = cat.id;
    btn.style.flex = isEditMode ? "1" : "auto";
    btn.onclick = function(e) {
      if (e.target.classList.contains('category-btn-delete') || e.target.classList.contains('category-btn-edit')) {
        return; // Don't switch category if clicking edit/delete
      }
      for (var i = 0; i < TABLE_CATEGORIES.length; i++) {
        if (TABLE_CATEGORIES[i].key === this.categoryKey) {
          SELECTED_TABLE_CATEGORY = TABLE_CATEGORIES[i];
          break;
        }
      }
      renderTableCategoryTabs();
      renderCategoryTablesGrid();
    };
    wrapper.appendChild(btn);
    
    // Add edit/delete buttons in edit mode
    if (isEditMode) {
      var editBtn = document.createElement("button");
      editBtn.className = "category-btn-edit";
      editBtn.textContent = "✏️";
      editBtn.style.marginTop = "4px";
      editBtn.style.padding = "4px 8px";
      editBtn.style.backgroundColor = "#3b82f6";
      editBtn.style.color = "white";
      editBtn.style.border = "none";
      editBtn.style.borderRadius = "4px";
      editBtn.style.cursor = "pointer";
      editBtn.title = "Edit category name";
      editBtn.onclick = function(e) {
        e.stopPropagation();
        editTableCategoryModal(cat.id, cat.key);
      };
      wrapper.appendChild(editBtn);
      
      var deleteBtn = document.createElement("button");
      deleteBtn.className = "category-btn-delete";
      deleteBtn.textContent = "✕";
      deleteBtn.style.marginTop = "4px";
      deleteBtn.style.padding = "4px 8px";
      deleteBtn.style.backgroundColor = "#ef4444";
      deleteBtn.style.color = "white";
      deleteBtn.style.border = "none";
      deleteBtn.style.borderRadius = "4px";
      deleteBtn.style.cursor = "pointer";
      deleteBtn.title = "Delete category";
      deleteBtn.onclick = function(e) {
        e.stopPropagation();
        deleteTableCategory(cat.id, cat.key);
      };
      wrapper.appendChild(deleteBtn);
    }
    
    tabs.appendChild(wrapper);
  }

  // Add category button (only in edit mode)
  if (document.body.classList.contains("edit-mode")) {
    var addBtn = document.createElement("button");
    addBtn.className = "add-category-btn";
    addBtn.textContent = "+ Add";
    addBtn.onclick = function() { addTableCategoryModal(); };
    tabs.appendChild(addBtn);
  }
}

function addTableCategoryModal() {
  const modal = document.createElement("div");
  modal.className = "modal-overlay";
  modal.innerHTML = `
    <div class="modal-content" style="width: 400px;">
      <h3>${t('admin.add-category')}</h3>
      <p style="color: var(--text-light); margin: 0 0 16px 0;">${t('admin.enter-category-name')}</p>
      
      <label style="display: block; margin-bottom: 16px;">
        <span class="modal-content-label">${t('admin.category-name')}</span>
        <input type="text" id="category-name-input" placeholder="Main Floor" class="modal-input">
      </label>

      <div class="modal-button-group">
        <button onclick="this.closest('.modal-overlay').remove()" class="modal-cancel-btn">${t('admin.cancel-button')}</button>
        <button onclick="submitAddTableCategory()" class="modal-btn-primary">${t('admin.create')}</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  document.getElementById("category-name-input").focus();
}

async function submitAddTableCategory() {
  const nameInput = document.getElementById("category-name-input");
  const categoryName = nameInput ? nameInput.value.trim() : "";
  if (!categoryName) return alert("Please enter a category name");

  try {
    const url = API + "/restaurants/" + restaurantId + "/table-categories";
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: categoryName })
    });

    if (!res.ok) {
      const err = await res.json();
      return alert(err.error || "Failed to create category");
    }

    const overlay = document.querySelector(".modal-overlay");
    if (overlay) overlay.remove();
    await loadTablesCategories();
  } catch (err) {
    alert("Error creating category: " + err.message);
  }
}

function editTableCategoryModal(categoryId, currentName) {
  const modal = document.createElement("div");
  modal.className = "modal-overlay";
  modal.innerHTML = `
    <div class="modal-content" style="width: 400px;">
      <h3>${t('admin.edit-category')}</h3>
      <p style="color: var(--text-light); margin: 0 0 16px 0;">${t('admin.enter-category-name')}</p>
      
      <label style="display: block; margin-bottom: 16px;">
        <span class="modal-content-label">${t('admin.category-name')}</span>
        <input type="text" id="edit-category-name-input" value="${currentName}" class="modal-input">
      </label>

      <div class="modal-button-group">
        <button onclick="this.closest('.modal-overlay').remove()" class="modal-cancel-btn">${t('admin.cancel-button')}</button>
        <button onclick="submitEditTableCategory(${categoryId})" class="modal-btn-primary">${t('admin.save')}</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  document.getElementById("edit-category-name-input").focus();
}

async function submitEditTableCategory(categoryId) {
  const nameInput = document.getElementById("edit-category-name-input");
  const newName = nameInput ? nameInput.value.trim() : "";
  if (!newName) return alert("Please enter a category name");

  try {
    const url = API + "/restaurants/" + restaurantId + "/table-categories/" + categoryId;
    const res = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName })
    });

    if (!res.ok) {
      const err = await res.json();
      return alert(err.error || "Failed to update category");
    }

    const overlay = document.querySelector(".modal-overlay");
    if (overlay) overlay.remove();
    await loadTablesCategories();
  } catch (err) {
    alert("Error updating category: " + err.message);
  }
}

async function deleteTableCategory(categoryId, categoryName) {
  if (!confirm("Delete category \"" + categoryName + "\"? Any tables in this category will be orphaned.")) return;

  try {
    var url = API + "/restaurants/" + restaurantId + "/table-categories/" + categoryId;
    var res = await fetch(url, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" }
    });

    if (!res.ok) {
      var err = await res.json();
      return alert(err.error || "Failed to delete category");
    }

    await loadTablesCategories();
  } catch (err) {
    alert("Error deleting category: " + err.message);
  }
}

function openCreateTablesCategory() {
  const modal = document.getElementById("create-tables-category-modal");
  if (modal) modal.classList.add("show");
}

function closeCreateTablesCategory() {
  const modal = document.getElementById("create-tables-category-modal");
  if (modal) modal.classList.remove("show");
}

async function createTablesCategory() {
  var nameEl = document.getElementById("new-tables-category-name");
  var name = nameEl.value.trim();

  if (!name) return alert("Category name required");

  var url = API + "/restaurants/" + restaurantId + "/table-categories";
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: name })
  });

  nameEl.value = "";
  closeCreateTablesCategory();
  loadTablesCategoryTable();
}

// Helper function to determine table card color based on session status and payment
function getTableCardColor(table) {
  if (table.sessions.length === 0 && !table.reserved) {
    return "white"; // Empty table
  }

  if (table.reserved && table.sessions.length === 0) {
    return "white"; // Reserved table - show as white card with yellow "Reserved" text
  }

  if (table.sessions.length > 0) {
    // If multiple sessions, always show light-blue
    if (table.sessions.length > 1) {
      return "light-blue"; // Multiple sessions = light-blue
    }
    
    // Single session - check payment and bill closure status
    var session = table.sessions[0];
    
    // If payment has been received online, show green (paid)
    if (session.payment_received === true) {
      return "green"; // Payment received - session is paid
    }
    
    // Check if bill closure has been requested by customer (defaults to false if column doesn't exist yet)
    if (session.bill_closure_requested === true) {
      return "yellow"; // Customer requested bill closure
    }
    
    // Check duration using the same logic as session colors
    var startedAt;
    var dateStr = session.started_at.trim();
    
    if (dateStr.includes('T') && dateStr.includes('Z')) {
      startedAt = new Date(dateStr);
    } else if (dateStr.includes('T')) {
      startedAt = new Date(dateStr + 'Z');
    } else {
      startedAt = new Date(dateStr);
    }
    
    var durationMinutes = Math.floor((Date.now() - startedAt.getTime()) / 60000);
    
    // Return color based on duration (matching session color logic)
    if (durationMinutes < 30) {
      return "light-blue"; // < 30 mins
    } else if (durationMinutes >= 30 && durationMinutes < 60) {
      return "purple"; // 30-60 mins
    } else if (durationMinutes >= 60 && durationMinutes < 120) {
      return "orange"; // 60-120 mins
    } else if (durationMinutes >= 120) {
      return "red"; // > 120 mins
    }
  }

  return "white";
}

// Helper function to get reservation time info
function getReservationTimeInfo(table) {
  if (!table.reserved || !table.booking_time) {
    return null;
  }
  
  var now = new Date();
  var today = getTodayDateString();
  var bookingTime = new Date(today + "T" + table.booking_time);
  var timeRemaining = bookingTime.getTime() - now.getTime();
  
  if (timeRemaining <= 0) {
    return { text: "Now", isNow: true };
  }
  
  var minutesRemaining = Math.floor(timeRemaining / 60000);
  
  if (minutesRemaining < 1) {
    return { text: "Now", isNow: true };
  } else if (minutesRemaining < 60) {
    return { text: "In " + minutesRemaining + " min" + (minutesRemaining !== 1 ? "s" : ""), isNow: false };
  } else {
    var hours = Math.floor(minutesRemaining / 60);
    var mins = minutesRemaining % 60;
    if (mins > 0) {
      return { text: "In " + hours + "h " + mins + "m", isNow: false };
    } else {
      return { text: "In " + hours + "h", isNow: false };
    }
  }
}

function renderCategoryTablesGrid() {
  const grid = document.getElementById("tables-grid");
  if (!grid) {
    console.warn("tables-grid element not found");
    return;
  }
  
  grid.innerHTML = "";

  // If no category selected, select the first one
  if (!SELECTED_TABLE_CATEGORY && TABLE_CATEGORIES.length) {
    SELECTED_TABLE_CATEGORY = TABLE_CATEGORIES[0];
  }

  if (!SELECTED_TABLE_CATEGORY) {
    if (document.body.classList.contains("edit-mode")) {
      grid.innerHTML = `<div class="empty-state"><p>Click "+ Create First Category" above to create a table category</p></div>`;
    } else {
      grid.innerHTML = `<div class="empty-state"><p>No categories available</p></div>`;
    }
    return;
  }

  var tables = [];
  for (var ti = 0; ti < TABLES.length; ti++) {
    if (TABLES[ti].category_id === SELECTED_TABLE_CATEGORY.id) {
      tables.push(TABLES[ti]);
    }
  }

  // Add "Add Table" card in edit mode
  if (document.body.classList.contains("edit-mode")) {
    var addCard = document.createElement("div");
    addCard.className = "add-table-card";
    addCard.onclick = function() { addTableModal(SELECTED_TABLE_CATEGORY.id); };
    grid.appendChild(addCard);
  }

  if (!tables.length) {
    if (!document.body.classList.contains("edit-mode")) {
      grid.innerHTML = "<div class=\"empty-state\"><p>No tables in this category</p></div>";
    }
    return;
  }

  for (var ti = 0; ti < tables.length; ti++) {
    var table = tables[ti];
    var usedSeats = 0;
    for (var si = 0; si < table.sessions.length; si++) {
      usedSeats = usedSeats + table.sessions[si].pax;
    }
    var remaining = table.seat_count - usedSeats;

    // Determine status
    var status = "available";
    var statusText = "Available";
    var sessionTimesHTML = "";
    
    if (table.sessions.length > 0) {
      status = "dining";
      statusText = "Dining"; // Always show dining status when there are sessions
      // Build time display for each session
      for (var sj = 0; sj < table.sessions.length; sj++) {
        var session = table.sessions[sj];
        var startedAt;
        // Handle ISO 8601 dates properly - parse as UTC
        var dateStr = session.started_at.trim();
        
        // ISO 8601 with Z means UTC - parse it explicitly
        if (dateStr.includes('T') && dateStr.includes('Z')) {
          // Parse as UTC by using getTime() which is always in UTC milliseconds
          startedAt = new Date(dateStr);
        } else if (dateStr.includes('T')) {
          // ISO format without Z - treat as UTC by adding Z
          startedAt = new Date(dateStr + 'Z');
        } else {
          // Not in ISO format, try parsing as-is
          startedAt = new Date(dateStr);
        }
        
        // Validate date parsing
        if (isNaN(startedAt.getTime())) {
          console.warn('Invalid date:', session.started_at);
          sessionTimesHTML = sessionTimesHTML + "<div class=\"session-time-item\"><img src=\"/uploads/website/timer.png\" alt=\"timer\"> --m</div>";
        } else {
          // Both Date.now() and startedAt.getTime() are in UTC milliseconds
          var elapsedMs = Date.now() - startedAt.getTime();
          var elapsed = Math.floor(elapsedMs / 60000);
          
          // Format elapsed time: show hours if >= 60 minutes, else minutes
          if (elapsed >= 60) {
            var hours = Math.floor(elapsed / 60);
            var mins = elapsed % 60;
            if (mins > 0) {
              elapsed = hours + "h " + mins + "m";
            } else {
              elapsed = hours + "h";
            }
          } else {
            elapsed = elapsed + "m";
          }
          var statusBadge = '';
          if (session.call_staff_requested) {
            statusBadge = ' <span style="background:#fbbf24;color:#000;font-size:9px;padding:1px 5px;border-radius:4px;font-weight:700;vertical-align:middle;">STAFF</span>';
          } else if (session.bill_closure_requested) {
            statusBadge = ' <span style="background:#f97316;color:#fff;font-size:9px;padding:1px 5px;border-radius:4px;font-weight:700;vertical-align:middle;">BILL</span>';
          }
          sessionTimesHTML = sessionTimesHTML + "<div class=\"session-time-item\"><img src=\"/uploads/website/timer.png\" alt=\"timer\"> " + elapsed + statusBadge + "</div>";
        }
      }
    } else if (table.reserved) {
      status = "reserved";
      statusText = "Reserved";
    }

    // Determine card color
    var cardColor = getTableCardColor(table);

    var card = document.createElement("div");
    card.className = "table-card table-card-" + cardColor;
    card.setAttribute("data-table-id", table.id);

    // Get reservation time info if reserved
    var reservationTimeHTML = "";
    var reservationStatusClass = "";
    if (table.reserved && table.sessions.length === 0) {
      var reservationInfo = getReservationTimeInfo(table);
      if (reservationInfo) {
        reservationStatusClass = reservationInfo.isNow ? "reservation-now" : "reservation-upcoming";
        reservationTimeHTML = "<div class=\"table-card-reservation-time " + reservationStatusClass + "\">" + reservationInfo.text + "</div>";
      }
    }

    var sessionsCountHTML = table.sessions.length > 0 ? "○ " + table.sessions.length : "";
    var sessionsListHTML = sessionTimesHTML ? "<div class=\"table-card-sessions-list\">" + sessionTimesHTML + "</div>" : "";
    
    // Build status and reservation info for bottom of card
    var bottomInfoHTML = "";
    var bottomItems = [];
    
    // Add Reserved status if reserved and no active sessions
    if (table.reserved && table.sessions.length === 0) {
      var reservationInfo = getReservationTimeInfo(table);
      if (reservationInfo) {
        reservationStatusClass = reservationInfo.isNow ? "reservation-now" : "reservation-upcoming";
        bottomItems.push("<div class=\"table-card-status-badge " + reservationStatusClass + "\">" + reservationInfo.text + "</div>");
      } else {
        bottomItems.push("<div class=\"table-card-status-badge\">Reserved</div>");
      }
    }
    
    // Add active sessions/dining time at bottom
    if (sessionTimesHTML) {
      bottomItems.push("<div class=\"table-card-sessions-list\">" + sessionTimesHTML + "</div>");
    }
    
    // Add Available status if available
    if (status === "available") {
      bottomItems.push("<div class=\"table-card-status " + status + "\">" + t('admin.table-status-available') + "</div>");
    }
    
    // Create bottom info section if we have items
    if (bottomItems.length > 0) {
      bottomInfoHTML = "<div class=\"table-card-bottom-info\">" + bottomItems.join("") + "</div>";
    }
    
    // Clear sessionsListHTML since we moved it to bottom
    sessionsListHTML = "";
    
    card.innerHTML = "<div class=\"table-card-sessions\">" + sessionsCountHTML + "</div>" +
      "<div class=\"table-card-name\">" + table.name + "</div>" +
      sessionsListHTML +
      bottomInfoHTML +
      "<div class=\"table-edit-controls\">" +
      "<button onclick=\"event.stopPropagation(); renameTableModal(" + table.id + ", '" + table.name + "')\"><img src=\"/uploads/website/pencil.png\" alt=\"edit\"/>Rename</button>" +
      "<button onclick=\"event.stopPropagation(); changeTableSeatsModal(" + table.id + ", " + table.seat_count + ")\"><img src=\"/uploads/website/pencil.png\" alt=\"edit\"/>" + t('admin.seats') + "</button>" +
      "<button onclick=\"event.stopPropagation(); deleteTable(" + table.id + ")\" class=\"table-card-delete-btn\"><img src=\"/uploads/website/bin.png\" alt=\"delete\"/>Delete</button>" +
      "</div>" +
      "<div class=\"table-card-seats\">" +
      "<img src=\"/uploads/website/chair.png\" alt=\"seats\"/>" +
      "<span>" + usedSeats + "/" + table.seat_count + "</span>" +
      "</div>";

    // Clicking card = show session panel (unless in edit mode and clicking edit buttons)
    // Create proper closure for each table to avoid capturing the loop variable
    (function(currentTable) {
      card.onclick = function(e) {
        if (e.target.tagName !== "BUTTON") {
          handleTableClick(currentTable);
        }
      };
    })(table);

    var wrapper = document.createElement("div");
    wrapper.className = "table-card-wrapper";
    wrapper.appendChild(card);
    grid.appendChild(wrapper);
  }
}

function addTableModal(categoryId) {
  // Ensure categoryId is valid
  if (!categoryId || categoryId <= 0) {
    console.error("❌ Invalid categoryId:", categoryId);
    alert("Error: No category selected. Please select a category tab first.");
    return;
  }

  const modal = document.createElement("div");
  modal.className = "modal-overlay";
  modal.innerHTML = `
    <div class="modal-content" style="width: 450px;">
      <h3>${t('admin.add-table')}</h3>
      <p style="color: var(--text-light); margin: 0 0 16px 0;">${t('admin.enter-table-details')}</p>
      
      <label style="display: block; margin-bottom: 16px;">
        <span class="modal-content-label">${t('admin.table-name')}</span>
        <input type="text" id="add-table-name-input" placeholder="T01, Table 1" class="modal-input">
      </label>

      <label style="display: block; margin-bottom: 16px;">
        <span class="modal-content-label">${t('admin.number-of-seats')}</span>
        <input type="number" id="add-table-seats-input" min="1" value="4" class="modal-input">
      </label>

      <div class="modal-button-group">
        <button onclick="this.closest('.modal-overlay').remove()" class="modal-cancel-btn">${t('admin.cancel-button')}</button>
        <button onclick="submitAddTable(${categoryId})" class="modal-btn-primary">${t('admin.create-table')}</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  document.getElementById("add-table-name-input").focus();
}

async function submitAddTable(categoryId) {
  const nameInput = document.getElementById("add-table-name-input");
  const seatsInput = document.getElementById("add-table-seats-input");
  
  const name = nameInput ? nameInput.value.trim() : "";
  const seats = seatsInput ? Number(seatsInput.value) : 0;

  if (!name) return alert("Please enter a table name");
  if (!seats || seats <= 0) return alert("Invalid seat count");

  try {
    console.log(`📝 Creating table - categoryId: ${categoryId}, name: ${name}, seats: ${seats}`);
    
    const res = await fetch(`${API}/restaurants/${restaurantId}/tables`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category_id: categoryId,
        name: name,
        seat_count: seats
      })
    });

    if (!res.ok) {
      const err = await res.json();
      console.error("❌ Server error:", err);
      return alert(err.error || err.details || "Failed to create table");
    }

    const result = await res.json();
    console.log("✅ Table created:", result);
    const overlay = document.querySelector(".modal-overlay");
    if (overlay) overlay.remove();
    await loadTablesCategoryTable();
    showToast(`Table "${name}" created`);
  } catch (err) {
    console.error("❌ Error creating table:", err);
    alert("Error creating table: " + err.message);
  }
}



function renameTableModal(tableId, currentName) {
  const modal = document.createElement("div");
  modal.className = "modal-overlay";
  modal.innerHTML = `
    <div class="modal-content" style="width: 400px;">
      <h3>${t('admin.rename-table')}</h3>
      <p style="color: var(--text-light); margin: 0 0 16px 0;">${t('admin.enter-new-table-name')}</p>
      
      <label style="display: block; margin-bottom: 16px;">
        <span class="modal-content-label">${t('admin.table-name')}</span>
        <input type="text" id="rename-table-input" value="${currentName}" class="modal-input">
      </label>

      <div class="modal-button-group">
        <button onclick="this.closest('.modal-overlay').remove()" class="modal-cancel-btn">${t('admin.cancel-button')}</button>
        <button onclick="submitRenameTable(${tableId})" class="modal-btn-primary">${t('admin.save')}</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  document.getElementById("rename-table-input").focus();
}

async function submitRenameTable(tableId) {
  const nameInput = document.getElementById("rename-table-input");
  const newName = nameInput ? nameInput.value.trim() : "";
  if (!newName) return alert("Please enter a table name");

  try {
    const res = await fetch(`${API}/tables/${tableId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName })
    });

    if (!res.ok) {
      const err = await res.json();
      return alert(err.error || "Failed to rename table");
    }

    const overlay = document.querySelector(".modal-overlay");
    if (overlay) overlay.remove();
    await loadTablesCategoryTable();
  } catch (err) {
    alert("Error renaming table: " + err.message);
  }
}

function changeTableSeatsModal(tableId, currentSeats) {
  const modal = document.createElement("div");
  modal.className = "modal-overlay";
  modal.innerHTML = `
    <div class="modal-content" style="width: 400px;">
      <h3>${t('admin.change-seats')}</h3>
      <p style="color: var(--text-light); margin: 0 0 16px 0;">${t('admin.enter-new-seat-count')}</p>
      
      <label style="display: block; margin-bottom: 16px;">
        <span class="modal-content-label">${t('admin.number-of-seats')}</span>
        <input type="number" id="change-seats-input" min="1" value="${currentSeats}" class="modal-input">
      </label>

      <div class="modal-button-group">
        <button onclick="this.closest('.modal-overlay').remove()" class="modal-cancel-btn">${t('admin.cancel-button')}</button>
        <button onclick="submitChangeTableSeats(${tableId})" class="modal-btn-primary">${t('admin.save')}</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  document.getElementById("change-seats-input").focus();
}

async function submitChangeTableSeats(tableId) {
  const seatsInput = document.getElementById("change-seats-input");
  const newSeats = seatsInput ? Number(seatsInput.value) : 0;
  if (!newSeats || newSeats <= 0) return alert("Invalid seat count");

  try {
    const res = await fetch(`${API}/tables/${tableId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seat_count: newSeats })
    });

    if (!res.ok) {
      const err = await res.json();
      return alert("Error updating seats: " + (err.error || err.message || "Unknown error"));
    }

    const overlay = document.querySelector(".modal-overlay");
    if (overlay) overlay.remove();
    await loadTablesCategoryTable();
  } catch (err) {
    alert("Error updating seats: " + err.message);
  }
}

async function loadTablesCategoryTable() {
  // Load categories first
  await loadTablesCategories();
  
  var url = API + "/restaurants/" + restaurantId + "/table-state";
  var res = await fetch(url);

  var rows = await res.json();

  var tableMap = {};

  for (var ri = 0; ri < rows.length; ri++) {
    var r = rows[ri];
    if (!tableMap[r.table_id]) {
      tableMap[r.table_id] = {
        id: r.table_id,
        name: r.table_name,
        seat_count: r.seat_count,
        category_id: r.category_id,
        units: [],
        sessions: [],
        reserved: false,
        booking_time: r.booking_time || null
      };
    }

    if (r.table_unit_id) {
      tableMap[r.table_id].units.push({
        id: r.table_unit_id,
        unit_code: r.unit_code,
        display_name: r.display_name,
        qr_token: r.qr_token
      });
    }

    if (r.session_id) {
      tableMap[r.table_id].sessions.push({
        id: r.session_id,
        table_unit_id: r.table_unit_id,
        pax: Number(r.pax),
        started_at: r.started_at,
        bill_closure_requested: r.bill_closure_requested,
        call_staff_requested: r.call_staff_requested,
        booking_guest_name: r.booking_guest_name || null
      });
    }
  }

  TABLES = [];
  for (var key in tableMap) {
    if (tableMap.hasOwnProperty(key)) {
      var table = tableMap[key];
      // booking_time will be set from bookings API
      TABLES.push(table);
    }
  }

  // Load bookings for today to set reserved flag and booking_time
  try {
    var today = getTodayDateString();
    var bookingsUrl = API + "/restaurants/" + restaurantId + "/bookings?date=" + today;
    var bookingsRes = await fetch(bookingsUrl);
    if (bookingsRes.ok) {
      var bookings = await bookingsRes.json();
      var timeAllowance = 15;
      if (ADMIN_SETTINGS_CACHE && ADMIN_SETTINGS_CACHE.booking_time_allowance_mins) {
        timeAllowance = ADMIN_SETTINGS_CACHE.booking_time_allowance_mins;
      }
      var now = new Date();
      
      // Mark tables that have active bookings (not expired) and set booking_time
      for (var bi = 0; bi < bookings.length; bi++) {
        var booking = bookings[bi];
        var table = null;
        for (var ti = 0; ti < TABLES.length; ti++) {
          if (TABLES[ti].id === booking.table_id) {
            table = TABLES[ti];
            break;
          }
        }
        if (table && booking.status === 'confirmed' && !booking.session_id) {
          // Show reserved indicator for any confirmed booking today regardless of time
          table.reserved = true;
          // Prefer the earliest upcoming booking time for display
          if (!table.booking_time || booking.booking_time < table.booking_time) {
            table.booking_time = booking.booking_time;
          }
        }
      }
    }
  } catch (err) {
    console.error("Error loading bookings:", err);
  }

  // Ensure both tabs and grid are rendered
  renderTableCategoryTabs();
  renderCategoryTablesGrid();
}

function renderTableSessions(table) {
  if (!table.sessions || table.sessions.length === 0) {
    return `<span class="muted">Empty</span>`;
  }

  return table.sessions.map((s, i) => {
    const letter = String.fromCharCode(65 + i); // T01A, T01B
    const label = `${table.name}${letter} · ${s.pax} pax`;

    return `
            <button
        class="session-pill"
        onclick="event.stopPropagation(); handleSessionClick(${s.id})"
        >

        ${label}
      </button>
    `;
  }).join("");
}

// Helper to format dining duration
function formatDiningDuration(startedAt) {
  // Parse timestamp - handle both ISO format and plain datetime strings
  let start;
  var dateStr = startedAt.trim();
  
  if (dateStr.includes('T') && dateStr.includes('Z')) {
    // ISO 8601 with Z - parse as UTC
    start = new Date(dateStr);
  } else if (dateStr.includes('T')) {
    // ISO format without Z - treat as UTC by adding Z
    start = new Date(dateStr + 'Z');
  } else {
    // Plain datetime string, assume UTC
    start = new Date(dateStr + 'Z');
  }
  
  // Check if date is valid
  if (isNaN(start.getTime())) {
    return "—";
  }
  
  // Use Date.now() - start.getTime() for timezone-agnostic calculation (both in UTC milliseconds)
  const diffMs = Date.now() - start.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return "just started";
  if (diffMins < 60) return `${diffMins}m`;
  
  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  return `${hours}h ${mins}m`;
}

// Helper to check if table is reserved today
async function isTableReservedToday(tableId) {
  try {
    const today = getTodayDateString();
    const res = await fetch(`${API}/restaurants/${restaurantId}/bookings?table_id=${tableId}&date=${today}`);
    if (!res.ok) return false;
    
    const bookings = await res.json();
    return bookings.some(b => b.status !== 'cancelled');
  } catch (err) {
    console.error("Error checking bookings:", err);
    return false;
  }
}

async function handleTableClick(table) {
  // Show the session panel with active class to slide it in
  const panel = document.getElementById("session-order-panel");
  panel.classList.add("active");

  // Render the session panel content
  if (table.sessions.length > 0) {
    // If table has active sessions, show list of all sessions first
    renderSessionsList(table);
  } else {
    // If no sessions, show the start session/booking options
    renderTableOptionsPanel(table);
  }
}

// Global to store current session for viewing
let CURRENT_SESSION_VIEWING = null;

async function renderSessionsList(table) {
  const panel = document.getElementById("session-order-panel");
  const usedSeats = table.sessions.reduce((s, x) => s + x.pax, 0);
  const remaining = table.seat_count - usedSeats;

  // Get bill totals for each session
  var sessionBills = {};
  for (var s = 0; s < table.sessions.length; s++) {
    var session = table.sessions[s];
    try {
      var res = await fetch(API + "/sessions/" + session.id + "/bill");
      if (res.ok) {
        var bill = await res.json();
        sessionBills[session.id] = bill.total_cents;
      }
    } catch (err) {
      console.error("Error loading bill:", err);
    }
  }

  let sessionsHTML = table.sessions.map(session => {
    const duration = formatDiningDuration(session.started_at);
    let startedAt;
    var dateStr = session.started_at.trim();
    
    if (dateStr.includes('T') && dateStr.includes('Z')) {
      // ISO 8601 with Z - parse as UTC
      startedAt = new Date(dateStr);
    } else if (dateStr.includes('T')) {
      // ISO format without Z - treat as UTC by adding Z
      startedAt = new Date(dateStr + 'Z');
    } else {
      // Not ISO format
      startedAt = new Date(dateStr);
    }
    
    const durationMinutes = Math.floor((Date.now() - startedAt.getTime()) / 60000);
    
    // Determine color based on dining duration with better consistency
    let sessionColor = "#0099ff"; // light blue < 30 mins
    let sessionLabel = "< 30m";
    if (durationMinutes >= 30 && durationMinutes < 60) {
      sessionColor = "#2735b0"; // purple 30-60 mins
      sessionLabel = "30-60m";
    } else if (durationMinutes >= 60 && durationMinutes < 120) {
      sessionColor = "#8d0303"; // orange 60-120 mins
      sessionLabel = "60-120m";
    } else if (durationMinutes >= 120) {
      sessionColor = "#e74c3c"; // red > 120 mins
      sessionLabel = "> 120m";
    }
    
    const billTotal = sessionBills[session.id] ? `$${(sessionBills[session.id] / 100).toFixed(2)}` : "—";

    return `
      <div class="session-list-item" style="padding: 12px; background: ${sessionColor}15; border: 2px solid ${sessionColor}; border-radius: 6px; margin-bottom: 8px; cursor: pointer;" onclick="selectSessionToView(${session.id})">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <strong>${t('admin.session-label').replace('{0}', session.id)}${session.booking_guest_name ? ` – ${session.booking_guest_name}` : ''}</strong>
            <div style="font-size: 13px; color: var(--text-light); margin-top: 2px;">${session.pax} pax • ${t('admin.dining')} ${duration}</div>
          </div>
          <div style="text-align: right; font-size: 14px; font-weight: 600; color: ${sessionColor};">
            ${billTotal}
            ${session.call_staff_requested ? `<div style="font-size:11px;background:#fef9c3;border:1px solid #fbbf24;border-radius:4px;padding:2px 6px;color:#92400e;font-weight:600;margin-top:4px;">Call Staff</div>` : ''}
            ${session.bill_closure_requested && !session.call_staff_requested ? `<div style="font-size:11px;background:#fff7ed;border:1px solid #f97316;border-radius:4px;padding:2px 6px;color:#c2410c;font-weight:600;margin-top:4px;">Close Bill</div>` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');

  panel.innerHTML = `
    <button class="panel-close-btn" onclick="closeSessionPanel()">✕</button>
    <h2 style="margin: 0 0 12px 0; font-size: 24px; font-weight: 900; color: var(--text-dark);">${table.name}</h2>
    <p style="margin: 0 0 16px 0; font-size: 13px; color: var(--text-light);">
      ○ ${usedSeats}/${table.seat_count} seats occupied
    </p>

    <div style="margin-bottom: 16px;">
      <strong style="display: block; margin-bottom: 8px;">${t('admin.active-sessions')}</strong>
      ${sessionsHTML}
    </div>

    ${remaining > 0 ? `
      <button class="btn-primary" style="width: 100%; margin-bottom: 8px;" onclick="startNewSessionModal(${table.id})">
        ${t('admin.start-new-session')} (${remaining} seats)
      </button>
    ` : ''}

    <button class="btn-secondary" style="width: 100%; margin-bottom: 16px;" onclick="bookTableModal(${table.id})">
      ${t('admin.book-table')}
    </button>

    <div id="table-reservations-list">
      <p style="font-size: 12px; color: var(--text-light);">${t('admin.loading-reservations')}</p>
    </div>
  `;

  // Load and display reservations for this table
  loadTableReservations(table.id);
}

function selectSessionToView(sessionId) {
  let session = null;
  for (let i = 0; i < TABLES.length; i++) {
    const found = TABLES[i].sessions.find(s => s.id === sessionId);
    if (found) {
      session = found;
      break;
    }
  }
  if (session) {
    CURRENT_SESSION_VIEWING = session;
    renderSessionOrder(session);
  }
}

function renderTableOptionsPanel(table) {
  const panel = document.getElementById("session-order-panel");
  const usedSeats = 0;
  const remaining = table.seat_count;

  panel.innerHTML = `
    <button class="panel-close-btn" onclick="closeSessionPanel()">✕</button>
    <h2 style="margin: 0 0 12px 0; font-size: 24px; font-weight: 900; color: var(--text-dark);">${table.name}</h2>
    <p style="margin: 0 0 16px 0; font-size: 13px; color: var(--text-light);">
      ${t('admin.all-seats-available').replace('{0}', table.seat_count)}
    </p>

    <button class="btn-primary" style="width: 100%; margin-bottom: 8px;" onclick="startNewSessionModal(${table.id})">
      ${t('admin.start-session')}
    </button>

    <button class="btn-secondary" style="width: 100%; margin-bottom: 16px;" onclick="bookTableModal(${table.id})">
      ${t('admin.book-table')}
    </button>

    <div id="table-reservations-list">
      <p style="font-size: 12px; color: var(--text-light);">${t('admin.loading-reservations')}</p>
    </div>
  `;

  // Load and display reservations
  loadTableReservations(table.id);
}

async function loadTableReservations(tableId) {
  try {
    const reservationsEl = document.getElementById("table-reservations-list");
    if (!reservationsEl) {
      // Element doesn't exist yet - will be called again when panel is rendered
      return;
    }

    const today = getTodayDateString();
    const bookingsRes = await fetch(`${API}/restaurants/${restaurantId}/bookings?date=${today}`);
    if (!bookingsRes.ok) {
      reservationsEl.innerHTML = '<p style="font-size: 12px; color: var(--text-light);">Could not load reservations</p>';
      return;
    }

    const bookings = await bookingsRes.json();
    const tableBookings = bookings.filter(b => b.table_id === tableId && b.status === 'confirmed' && !b.session_id);

    if (!tableBookings.length) {
      reservationsEl.innerHTML = `<p style="font-size: 12px; color: var(--text-light);">${t('admin.no-upcoming-reservations')}</p>`;
      return;
    }

    const reservationsHTML = tableBookings.map(booking => {
      const isActive = !!booking.session_id;
      const clickAttr = isActive ? '' : `onclick="showStartSessionFromBookingPrompt(${tableId}, ${booking.id}, ${booking.pax}, '${booking.guest_name.replace(/'/g, "\\'")}')"`;
      const badge = isActive
        ? `<span style="font-size: 11px; padding: 3px 8px; background: #22c55e; color: white; border-radius: 4px; white-space: nowrap;">Active</span>`
        : `<span style="font-size: 11px; padding: 3px 8px; background: #dbeafe; color: #1d4ed8; border-radius: 4px; white-space: nowrap;">▶ Tap to start</span>`;
      return `
        <div ${clickAttr} style="padding: 10px; background: #f5f5f5; border-left: 3px solid #4a90e2; border-radius: 4px; margin-bottom: 8px;${isActive ? '' : ' cursor: pointer;'}">
          <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
            <div style="min-width: 0; flex: 1;">
              <strong style="display: block; margin-bottom: 2px;">#${booking.id} - ${booking.guest_name}</strong>
              <div style="font-size: 12px; color: var(--text-light);">
                ${booking.booking_time} · ${booking.phone || 'N/A'} · ${booking.pax} pax
              </div>
            </div>
            <div style="flex-shrink: 0;">${badge}</div>
          </div>
        </div>
      `;
    }).join('');

    reservationsEl.innerHTML = `
      <strong style="display: block; margin-bottom: 8px; font-size: 12px;">Upcoming Reservations (Today):</strong>
      ${reservationsHTML}
    `;
  } catch (err) {
    console.error("Error loading reservations:", err);
    const reservationsEl = document.getElementById("table-reservations-list");
    if (reservationsEl) {
      reservationsEl.innerHTML = '<p style="font-size: 12px; color: var(--text-light);">Error loading reservations</p>';
    }
  }
}

function startNewSessionModal(tableId) {
  const table = TABLES.find(t => t.id === tableId);
  if (!table) return;

  const usedSeats = table.sessions.reduce((s, x) => s + x.pax, 0);
  const remaining = table.seat_count - usedSeats;

  if (remaining <= 0) {
    alert("Table is full. End a session to free seats.");
    return;
  }

  const qrMode = ADMIN_SETTINGS_CACHE?.qr_mode || 'regenerate';

  // Create modal for entering pax
  const modal = document.createElement("div");
  modal.className = "modal-overlay";
  modal.innerHTML = `
    <div class="modal-content" style="width: 400px;">
      <h3>${t('admin.start-session-modal-title').replace('{0}', table.name)}</h3>
      <p style="color: var(--text-light); margin: 0 0 16px 0;">${t('admin.seats-available').replace('{0}', remaining)}</p>
      
      <label style="display: block; margin-bottom: 16px;">
        <span class="modal-content-label">${t('admin.number-of-guests')}</span>
        <input type="number" id="session-pax-input" min="1" max="${remaining}" value="1" class="modal-input">
      </label>

      <div id="seat-picker-container" style="display: none; margin-bottom: 16px;">
        <span class="modal-content-label">Select Seats</span>
        <div id="seat-picker-grid" style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px;"></div>
      </div>

      <div class="modal-button-group">
        <button onclick="this.closest('.modal-overlay').remove()" class="modal-cancel-btn">${t('admin.cancel-button')}</button>
        <button onclick="submitStartSession(${tableId})" class="modal-btn-primary">${t('admin.start-session')}</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  document.getElementById("session-pax-input").focus();

  // Load seat picker for static_seat mode
  if (qrMode === 'static_seat') {
    loadSeatPicker(tableId);
  }
}

let _selectedSeatIds = [];

async function loadSeatPicker(tableId) {
  const container = document.getElementById("seat-picker-container");
  const grid = document.getElementById("seat-picker-grid");
  if (!container || !grid) return;

  container.style.display = "block";
  grid.innerHTML = '<span style="color: #888; font-size: 13px;">Loading seats...</span>';
  _selectedSeatIds = [];

  try {
    const res = await fetch(`${API}/tables/${tableId}/units`);
    if (!res.ok) throw new Error("Failed to load seats");
    const units = await res.json();

    grid.innerHTML = "";
    units.forEach(unit => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.dataset.unitId = unit.id;
      btn.textContent = unit.display_name || unit.unit_code;
      btn.style.cssText = `
        padding: 8px 14px; border-radius: 8px; border: 2px solid ${unit.occupied ? '#ccc' : '#ddd'};
        background: ${unit.occupied ? '#f0f0f0' : '#fff'}; cursor: ${unit.occupied ? 'not-allowed' : 'pointer'};
        font-weight: 600; color: ${unit.occupied ? '#999' : '#333'}; opacity: ${unit.occupied ? '0.5' : '1'};
        font-size: 14px; transition: all 0.15s;
      `;
      if (unit.occupied) {
        const occLabel = document.createElement("div");
        occLabel.textContent = "Occupied";
        occLabel.style.cssText = "font-size: 10px; color: #999; font-weight: normal;";
        btn.appendChild(occLabel);
      } else {
        btn.addEventListener("click", () => {
          const idx = _selectedSeatIds.indexOf(unit.id);
          if (idx >= 0) {
            _selectedSeatIds.splice(idx, 1);
            btn.style.borderColor = "#ddd";
            btn.style.background = "#fff";
            btn.style.color = "#333";
          } else {
            _selectedSeatIds.push(unit.id);
            btn.style.borderColor = "#007AFF";
            btn.style.background = "#007AFF";
            btn.style.color = "#fff";
          }
        });
      }
      grid.appendChild(btn);
    });
  } catch (err) {
    grid.innerHTML = '<span style="color: #e74c3c; font-size: 13px;">Failed to load seats</span>';
  }
}

async function submitStartSession(tableId) {
  const paxInput = document.getElementById("session-pax-input");
  const pax = Number(paxInput ? paxInput.value : 0);
  if (!pax || pax <= 0) return alert("Invalid number of guests");

  const qrMode = ADMIN_SETTINGS_CACHE?.qr_mode || 'regenerate';
  if (qrMode === 'static_seat' && _selectedSeatIds.length === 0) {
    return alert("Please select at least one seat");
  }

  const body = { pax };
  if (qrMode === 'static_seat' && _selectedSeatIds.length > 0) {
    body.unit_ids = [..._selectedSeatIds];
  }

  try {
    const res = await fetch(`${API}/tables/${tableId}/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const err = await res.json();
      return alert(err.error || "Failed to start session");
    }

    const sessionResponse = await res.json();
    const newSessionId = sessionResponse.id;

    const overlay = document.querySelector(".modal-overlay");
    if (overlay) overlay.remove();

    // Reload table data and automatically display the session
    await loadTablesCategoryTable();
    
    // Find the table and display its session
    const table = TABLES.find(t => t.id === tableId);
    if (table) {
      handleTableClick(table);
    }

    // Note: Auto-print is now handled by WebSocket (session-notifier)
    // This allows printing from any tab/page, not just when user is on tables tab
    // So we don't need to call printQR here
  } catch (err) {
    alert("Error starting session: " + err.message);
  }
}

async function startSessionFromBooking(tableId, bookingId, pax) {
  try {
    const res = await fetch(`${API}/tables/${tableId}/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pax, booking_id: bookingId })
    });

    if (!res.ok) {
      const err = await res.json();
      return alert(err.error || "Failed to start session");
    }

    // Reload table data and display the updated table
    await loadTablesCategoryTable();
    const table = TABLES.find(t => t.id === tableId);
    if (table) handleTableClick(table);
  } catch (err) {
    alert("Error starting session: " + err.message);
  }
}

function showStartSessionFromBookingPrompt(tableId, bookingId, pax, guestName) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-content" style="width: 340px; padding: 28px; text-align: center;">
      <h3 style="margin: 0 0 8px 0; font-size: 18px;">Start Session Now?</h3>
      <p style="margin: 0 0 6px 0; color: var(--text-dark); font-size: 15px; font-weight: 600;">${guestName}</p>
      <p style="margin: 0 0 24px 0; color: var(--text-light); font-size: 14px;">${pax} guests</p>
      <div class="modal-button-group">
        <button onclick="this.closest('.modal-overlay').remove()" class="modal-cancel-btn">No</button>
        <button onclick="confirmStartSessionFromBooking(${tableId}, ${bookingId}, ${pax})" class="modal-btn-primary">Yes, Start</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}

async function confirmStartSessionFromBooking(tableId, bookingId, pax) {
  document.querySelector('.modal-overlay')?.remove();
  await startSessionFromBooking(tableId, bookingId, pax);
}

function bookTableModal(tableId) {
  const table = TABLES.find(t => t.id === tableId);
  if (!table) return;

  // Get today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split('T')[0];
  const minDate = today;
  const maxDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // 30 days from now

  const modal = document.createElement("div");
  modal.className = "modal-overlay";
  modal.innerHTML = `
    <div class="modal-content" style="width: 450px;">
      <h3>${t('admin.book-table-title').replace('{0}', table.name)}</h3>
      
      <label style="display: block; margin-bottom: 16px;">
        <span style="font-weight: 600; display: block; margin-bottom: 8px;">${t('admin.guest-name')}</span>
        <input type="text" id="booking-name-input" placeholder="e.g., John Smith" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 16px;">
      </label>

      <label style="display: block; margin-bottom: 16px;">
        <span style="font-weight: 600; display: block; margin-bottom: 8px;">${t('admin.guest-phone')}</span>
        <input type="tel" id="booking-phone-input" placeholder="e.g., +1 (555) 123-4567" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 16px;">
      </label>

      <label style="display: block; margin-bottom: 16px;">
        <span style="font-weight: 600; display: block; margin-bottom: 8px;">${t('admin.guest-email')}</span>
        <input type="email" id="booking-email-input" placeholder="e.g., john@example.com" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 16px;">
      </label>

      <label style="display: block; margin-bottom: 16px;">
        <span style="font-weight: 600; display: block; margin-bottom: 8px;">${t('admin.number-of-guests')}</span>
        <input type="number" id="booking-pax-input" min="1" max="${table.seat_count}" value="2" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 16px;">
      </label>

      <label style="display: block; margin-bottom: 16px;">
        <span style="font-weight: 600; display: block; margin-bottom: 8px;">${t('admin.booking-date')}</span>
        <input type="date" id="booking-date-input" value="${today}" min="${minDate}" max="${maxDate}" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 16px;">
      </label>

      <label style="display: block; margin-bottom: 16px;">
        <span style="font-weight: 600; display: block; margin-bottom: 8px;">${t('admin.reservation-time')}</span>
        <input type="time" id="booking-time-input" value="18:00" class="modal-input">
      </label>

      <div class="modal-button-group">
        <button onclick="this.closest('.modal-overlay').remove()" class="modal-cancel-btn">${t('admin.cancel-button')}</button>
        <button onclick="submitBookTable(${tableId})" class="modal-btn-primary">${t('admin.book-table')}</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  document.getElementById("booking-name-input").focus();
}

async function submitBookTable(tableId) {
  const nameInput = document.getElementById("booking-name-input");
  const name = nameInput ? nameInput.value.trim() : "";
  const phoneInput = document.getElementById("booking-phone-input");
  const phone = phoneInput ? phoneInput.value.trim() : "";
  const emailInput = document.getElementById("booking-email-input");
  const email = emailInput ? emailInput.value.trim() : "";
  const paxInput = document.getElementById("booking-pax-input");
  const pax = Number(paxInput ? paxInput.value : 0);
  const dateInput = document.getElementById("booking-date-input");
  const date = dateInput ? dateInput.value : "";
  const timeInput = document.getElementById("booking-time-input");
  const time = timeInput ? timeInput.value : "";

  if (!name) return alert("Guest name required");
  if (!phone) return alert("Phone number required");
  if (!email) return alert("Email required");
  if (!pax || pax <= 0) return alert("Invalid number of guests");
  if (!date) return alert("Booking date required");
  if (!time) return alert("Reservation time required");

  try {
    const res = await fetch(`${API}/restaurants/${restaurantId}/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        table_id: tableId,
        guest_name: name,
        phone_number: phone,
        email: email,
        pax,
        booking_date: date,
        booking_time: time,
        status: "confirmed"
      })
    });

    if (!res.ok) {
      const err = await res.json();
      return alert(err.error || "Failed to create booking");
    }

    const overlay = document.querySelector(".modal-overlay");
    if (overlay) overlay.remove();
    showToast(`Booking created for ${name}`);
    // Sync bookings tab
    if (typeof loadBookings === 'function') {
      loadBookings();
    }
    await loadTablesCategoryTable();
  } catch (err) {
    alert("Error booking table: " + err.message);
  }
}

function renderStartSessionPrompt(table) {
  const panel = document.getElementById("session-order-panel");
  const usedSeats = table.sessions.reduce((s, x) => s + x.pax, 0);
  const remaining = table.seat_count - usedSeats;

  panel.innerHTML = `
    <button class="panel-close-btn" onclick="closeSessionPanel()">✕</button>
    <h3>${table.name}</h3>
    <div class="table-card-info">
      <p><strong>${usedSeats}/${table.seat_count} seats occupied</strong></p>
      <p>${remaining} seats available</p>
    </div>
    <div class="session-actions" style="margin-top: 16px;">
      <button class="btn-primary" onclick="startNewSessionModal(${table.id})">
        ➕ Start New Session
      </button>
    </div>
  `;
}

async function renderSessionOrder(session) {
  const panel = document.getElementById("session-order-panel");

  const table = TABLES.find(t =>
    t.sessions.some(s => s.id === session.id)
  );
  if (!table) return;

  const sessionLabel = getSessionLabel(table, session.id);
  const pax = session.pax;
  const diningDuration = formatDiningDuration(session.started_at);

  // Build payment status indicator
  let paymentStatusHtml = '';
  if (session.payment_received) {
    const paymentTime = new Date(session.payment_received_at).toLocaleTimeString();
    const merchant = session.merchant_reference || '—';
    paymentStatusHtml = `
      <div style="background: #e8f5e9; border: 1px solid #4caf50; border-radius: 6px; padding: 8px 12px; margin: 8px 0; font-size: 12px;">
        <div style="color: #2e7d32; font-weight: 600;">Payment Received</div>
        <div style="color: #555; margin-top: 2px; font-size: 11px;">Via: ${session.payment_method_online ? session.payment_method_online.toUpperCase() : 'N/A'}</div>
        <div style="color: #555; font-size: 11px;">Ref: ${merchant}</div>
      </div>
    `;
  } else if (session.bill_closure_requested) {
    paymentStatusHtml = `
      <div style="background: #fff3e0; border: 1px solid #ff9800; border-radius: 6px; padding: 8px 12px; margin: 8px 0; font-size: 12px;">
        <div style="color: #e65100; font-weight: 600;">Bill Closure Requested</div>
        <div style="color: #555; margin-top: 2px; font-size: 11px;">Customer has requested payment</div>
      </div>
    `;
  }

  if (session.call_staff_requested) {
    paymentStatusHtml += `
      <div style="background: #fef9c3; border: 1px solid #fbbf24; border-radius: 6px; padding: 8px 12px; margin: 8px 0; font-size: 12px;">
        <div style="color: #92400e; font-weight: 600;">Staff Called</div>
        <div style="color: #555; margin-top: 2px; font-size: 11px;">Customer is requesting assistance
          <button onclick="clearCallStaff(${session.id})" style="margin-left: 8px; padding: 2px 8px; font-size: 11px; border: none; border-radius: 4px; background: #d97706; color: #fff; cursor: pointer; font-weight: 600;">Acknowledge</button>
        </div>
      </div>
    `;
  }

  // ADD THE ACTIVE CLASS TO SHOW THE PANEL
  panel.classList.add("active");

  // Header with session info and gear dropdown
  panel.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
      <button class="panel-close-btn" onclick="closeSessionPanel()">✕</button>
      <div style="flex: 1;">
        <h3 style="margin: 0; font-size: 18px; text-align: center;">${sessionLabel}</h3>
        ${session.booking_guest_name ? `<p style="margin: 2px 0 0 0; font-size: 14px; font-weight: 600; color: var(--text-dark); text-align: center;">${session.booking_guest_name}</p>` : ''}
        <p style="margin: 4px 0 0 0; font-size: 12px; color: var(--text-light); text-align: center;">Table ${table.name} • ${t('admin.started')} ${new Date(session.started_at).toLocaleTimeString()}</p>
        <p style="margin: 4px 0 0 0; font-size: 12px; color: var(--text-light); text-align: center;">${pax} ${t('admin.pax-label')} • ${t('admin.dining')} ${diningDuration}</p>
        ${paymentStatusHtml}
      </div>
      <div style="position: relative;">
        <button class="gear-icon-btn" onclick="toggleSessionGearMenu(event)">⚙</button>
        <div id="session-gear-menu" class="session-gear-menu hidden">
          <button onclick="changeSessionPaxModal(${session.id}, ${pax})">${t('admin.change-pax')}</button>
          <button onclick="moveTableModal(${table.id})">${t('admin.move-table')}</button>
          <button onclick="orderForTable(${table.id})">${t('admin.order-for-table')}</button>
          <button onclick="showTableQR(${session.id})">Show QR Code</button>
          <button onclick="printQR(${session.id})">${t('admin.print-qr')}</button>
          <button onclick="splitBill(${session.id})">${t('admin.split-bill')}</button>
          <button onclick="endTableSession(${session.id})" style="color: #c33;">${t('admin.delete-session')}</button>
        </div>
      </div>
    </div>

    <!-- Orders Section -->
    <div id="session-orders" style="flex: 1; overflow-y: auto; border-top: 1px solid var(--border-color); padding-top: 12px; margin-bottom: 12px;">
      <p>${t('admin.loading-orders')}</p>
    </div>

    <!-- Total and Actions -->
    <div style="border-top: 2px solid var(--border-color); padding-top: 12px;">
      <div id="session-total" style="font-weight: bold; margin-bottom: 12px; font-size: 16px;">
        ${t('admin.total-label')} —
      </div>
      <div style="display: flex; gap: 8px;">
        <button style="flex: 1; padding: 10px; border: none; border-radius: 6px; background: white; color: #333; font-weight: 600; cursor: pointer;" onclick="printBill(${session.id})">
          ${t('admin.print-bill')}
        </button>
        <button id="session-close-bill-btn" data-session-id="${session.id}" style="flex: 1; padding: 10px; border: none; border-radius: 6px; background: #1f2937; color: white; font-weight: 600; cursor: pointer;" onclick="closeBillModal(${session.id})">
          ${ADMIN_SETTINGS_CACHE?.order_pay_enabled ? 'Close Bill (Manual)' : 'Close Bill'}
        </button>
      </div>
    </div>
  `;

  await loadAndRenderOrders(session.id);
}

async function loadAndRenderOrders(sessionId) {
  try {
    // Ensure settings are loaded for service charge fee
    if (!serviceChargeFee || serviceChargeFee === 0) {
      await loadAdminSettings();
    }

    const res = await fetch(`${API}/sessions/${sessionId}/orders?restaurantId=${restaurantId}`);
    if (!res.ok) {
      const err = await res.json();
      console.error("Error loading orders:", err);
      return;
    }
    
    const data = await res.json();
    const orders = data.items || [];

    const container = document.getElementById("session-orders");
    const totalEl = document.getElementById("session-total");

    if (!orders.length) {
      container.innerHTML = `<p style='color: var(--text-light);'>${t('admin.no-orders')}</p>`;
      totalEl.textContent = "Total: $0.00";
      return;
    }

    let totalCents = 0;

    // Build order HTML + compute subtotal
    container.innerHTML = orders.map(order => {
      const isCompleted = order.order_status === 'completed';
      const isPAPayment = order.order_payment_method === 'payment-asia';
      const payBadge = isCompleted
        ? (isPAPayment
          ? ` <span style="margin-left:6px;padding:2px 7px;background:#f59e0b;color:white;border-radius:10px;font-size:10px;font-weight:700;">PA Paid</span>`
          : ` <span style="margin-left:6px;padding:2px 7px;background:#10b981;color:white;border-radius:10px;font-size:10px;font-weight:700;">Paid</span>`)
        : ` <span style="margin-left:6px;padding:2px 7px;background:#6b7280;color:white;border-radius:10px;font-size:10px;font-weight:700;">Not Paid</span>`;

      let itemsHtml = '';
      order.items.forEach(i => {
        const itemTotal = i.quantity * i.unit_price_cents;
        totalCents += itemTotal;
        itemsHtml += `
            <div class="order-item" style="display:flex;gap:8px;align-items:flex-start;justify-content:space-between;margin:8px 0;padding:8px 0;border-bottom:1px solid #f0f0f0;">
              <div style="flex:1;min-width:0;">
                <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;">
                  <strong style="flex:1;">${i.name || i.item_name || i.menu_item_name || 'Item'}</strong>
                  <span style="color:#999;font-size:0.85em;white-space:nowrap;">x${i.quantity}</span>
                </div>
                ${i.variants && i.variants.trim() ? `<div style="font-size:0.8em;color:#777;font-style:italic;margin-bottom:2px;">${i.variants}</div>` : ''}
                <div style="font-size:0.8em;color:#aaa;">${({'pending':'Sending','preparing':'Preparing','served':'Delivered','completed':'Delivered'})[i.status] || i.status}</div>
              </div>
              <div style="text-align: right; white-space: nowrap; font-weight: 600;">$${(itemTotal / 100).toFixed(2)}</div>
            </div>
          `;
      });

      return `
      <div class="order-card" style="${isCompleted ? 'opacity:0.7;' : ''}">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
          <div><strong>${t('admin.order-label')} #${order.restaurant_order_number || order.order_id}</strong>${payBadge}</div>
          <button onclick="viewOrderInOrders(${order.order_id})" style="font-size:11px;padding:3px 8px;border:1px solid #d1d5db;border-radius:4px;background:white;color:#374151;cursor:pointer;white-space:nowrap;">View</button>
        </div>
        ${itemsHtml}
      </div>`;
    }).join("");

    // If any order was paid via Payment Asia (completed), swap Close Bill → Paid Online
    const paidViaPA = orders.some(o => o.order_payment_method === 'payment-asia' && o.order_status === 'completed');
    const closeBillBtn = document.getElementById('session-close-bill-btn');
    if (paidViaPA && closeBillBtn) {
      closeBillBtn.textContent = '✅ Paid Online';
      closeBillBtn.disabled = true;
      closeBillBtn.style.background = '#9ca3af';
      closeBillBtn.style.cursor = 'default';
      closeBillBtn.onclick = null;
    }

    // Service charge
    const serviceChargePercent = serviceChargeFee || Number(window.RESTAURANT_SERVICE_CHARGE || 0);
    const serviceCharge = Math.round(totalCents * serviceChargePercent / 100);
    const grandTotal = totalCents + serviceCharge;

    // Render totals
    totalEl.innerHTML = `
      <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
        <span>${t('admin.subtotal-label')}</span>
        <span>$${(totalCents / 100).toFixed(2)}</span>
      </div>
      ${serviceChargePercent > 0 ? `
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 14px;">
          <span>${t('admin.service-charge-label').replace('{0}', serviceChargePercent)} (${serviceChargePercent}%):</span>
          <span>$${(serviceCharge / 100).toFixed(2)}</span>
        </div>
      ` : ''}
      <div style="display: flex; justify-content: space-between; font-size: 18px; color: white; background: rgba(0,0,0,0.3); padding: 8px; border-radius: 4px; margin-top: 8px;">
        <span>${t('admin.total-label')}</span>
        <span>$${(grandTotal / 100).toFixed(2)}</span>
      </div>
    `;

  } catch (error) {
    console.error("Error in loadAndRenderOrders:", error);
    document.getElementById("session-orders").innerHTML = `<p style="color:red;">Error loading orders: ${error.message}</p>`;
  }
}

function getSessionLabel(table, sessionId) {
  const index = table.sessions.findIndex(s => s.id === sessionId);
  const letter = String.fromCharCode(65 + index);
  return `${table.name}${letter}`;
}

// STUB FUNCTIONS to avoid undefined errors

async function viewOrderInOrders(orderId) {
  // Switch to orders section first (loads HTML + initializes if needed)
  if (typeof switchSection === 'function') {
    await switchSection('orders');
  }
  // Wait for selectOrderFromHistory to be available (orders HTML may have just been injected)
  let attempts = 0;
  while (typeof selectOrderFromHistory !== 'function' && attempts++ < 20) {
    await new Promise(r => setTimeout(r, 100));
  }
  if (typeof selectOrderFromHistory === 'function') {
    // Ensure we are in history mode
    if (typeof ORDERS_HISTORY_MODE !== 'undefined' && !ORDERS_HISTORY_MODE && typeof toggleOrdersHistoryMode === 'function') {
      await toggleOrdersHistoryMode();
    }
    await selectOrderFromHistory(orderId);
  }
}

async function printBill(sessionId, autoPrint = false) {
  console.log('[PrintBill] Starting bill print for session:', sessionId, 'autoPrint:', autoPrint);
  
  try {
    const restaurantId = localStorage.getItem('restaurantId');
    
    // Fetch bill data from backend
    const billResponse = await fetch(`${API}/sessions/${sessionId}/bill`);
    if (!billResponse.ok) {
      throw new Error('Failed to load bill data');
    }
    
    const billData = await billResponse.json();
    console.log('[PrintBill] Bill data loaded:', billData);
    
    // Format bill data for printing
    const billPayload = {
      table: billData.session.table_name,
      pax: billData.session.pax,
      items: billData.items.map(item => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price_cents
      })),
      subtotal: billData.subtotal_cents,
      serviceCharge: billData.service_charge_cents,
      total: billData.total_cents
    };
    
    // Call backend endpoint - it handles HTML generation and printer routing
    await printBillViaAPI(restaurantId, sessionId, billPayload);
    console.log('[PrintBill] Bill print completed');
  } catch (err) {
    console.error('[PrintBill] Error:', err);
    if (!autoPrint) {
      alert('Print error: ' + err.message);
    }
  }
}

async function splitBill(sessionId) {
  const res = await fetch(`${API}/sessions/${sessionId}/bill`);
  if (!res.ok) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content" style="width: 380px;">
        <h3>${t('admin.split-bill')}</h3>
        <p style="color: #e74c3c; margin: 12px 0;">Failed to load bill details.</p>
        <div class="modal-button-group">
          <button onclick="this.closest('.modal-overlay').remove()" class="modal-btn-primary">OK</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    return;
  }

  const bill = await res.json();
  const total = bill.total_cents;
  const initialSplits = 2;
  const initialPerPerson = Math.ceil(total / initialSplits);

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.setAttribute('data-split-total', total);
  modal.innerHTML = `
    <div class="modal-content" style="width: 420px;">
      <h3>${t('admin.split-bill')}</h3>
      <div style="background: #f3f4f6; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; border-left: 4px solid var(--primary-color);">
        <p style="margin: 0; font-size: 15px; color: var(--text-dark);">Total: <strong>$${(total / 100).toFixed(2)}</strong></p>
      </div>
      <label style="display: block; margin-bottom: 16px;">
        <span class="modal-content-label">Split among how many guests?</span>
        <input type="number" id="split-count-input" min="2" max="20" value="${initialSplits}" class="modal-input" oninput="updateSplitPreview()">
      </label>
      <div id="split-preview" style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 14px; text-align: center; margin-bottom: 16px;">
        <p style="margin: 0; font-size: 13px; color: #065f46;">Each guest pays:</p>
        <p style="margin: 6px 0 0 0; font-size: 26px; font-weight: 700; color: #059669;">$${(initialPerPerson / 100).toFixed(2)}</p>
      </div>
      <div class="modal-button-group">
        <button onclick="this.closest('.modal-overlay').remove()" class="modal-cancel-btn">${t('admin.cancel-button')}</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  setTimeout(() => {
    const input = document.getElementById('split-count-input');
    if (input) { input.focus(); input.select(); }
  }, 50);
}

function updateSplitPreview() {
  const modal = document.querySelector('.modal-overlay[data-split-total]');
  if (!modal) return;
  const total = parseInt(modal.getAttribute('data-split-total'), 10);
  const input = document.getElementById('split-count-input');
  const splits = Math.max(2, parseInt(input ? input.value : '2', 10) || 2);
  const perPerson = Math.ceil(total / splits);
  const preview = document.getElementById('split-preview');
  if (preview) {
    preview.innerHTML = `
      <p style="margin: 0; font-size: 13px; color: #065f46;">Each guest pays:</p>
      <p style="margin: 6px 0 0 0; font-size: 26px; font-weight: 700; color: #059669;">$${(perPerson / 100).toFixed(2)}</p>
    `;
  }
}

async function printQR(sessionId, autoPrint = false, sessionEventData = null) {
  console.log('[PrintQR] Starting QR print for session:', sessionId, 'autoPrint:', autoPrint, 'eventData:', sessionEventData);
  
  try {
    let session = findSessionById(sessionId);
    let table = null;
    let qrToken = null;
    let tableId = null;
    let tableName = null;
    
    // If we have session event data from WebSocket, use it
    if (sessionEventData && sessionEventData.tableId) {
      console.log('[PrintQR] Using WebSocket session event data');
      tableId = sessionEventData.tableId;
      
      // Try to get table from local cache first
      table = TABLES.find(t => t.id === tableId);
      
      if (table) {
        tableName = table.name;
        const tableUnit = table.units && table.units[0];
        qrToken = tableUnit ? tableUnit.qr_token : null;
      }
      
      // If not in cache or missing QR token, fetch from API
      if (!qrToken) {
        console.log('[PrintQR] Fetching table data from API for ID:', tableId);
        const res = await fetch(`${API}/tables/${tableId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          table = await res.json();
          tableName = table.name;
          if (table.units && table.units[0]) {
            qrToken = table.units[0].qr_token;
          }
        }
      }
    } 
    // If session found locally, use local data
    else if (session) {
      table = TABLES.find(t => t.sessions.some(s => s.id === sessionId));
      if (!table) throw new Error("Table not found");
      
      const tableUnit = table.units[0];
      qrToken = tableUnit ? tableUnit.qr_token : null;
      tableId = table.id;
      tableName = table.name;
    }
    // Last resort: fetch from API
    else {
      console.log('[PrintQR] Session not in local cache, fetching from API...');
      const restaurantId = localStorage.getItem('restaurantId');
      const res = await fetch(`${API}/sessions/${sessionId}/bill`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!res.ok) {
        throw new Error(`Failed to fetch session ${sessionId}: ${res.status}`);
      }
      
      const billData = await res.json();
      session = billData.session;
      tableId = session.table_id;
      tableName = session.table_name;
      
      // Get QR token from table if needed
      if (tableId) {
        const tableRes = await fetch(`${API}/tables/${tableId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (tableRes.ok) {
          table = await tableRes.json();
          if (table.units && table.units[0]) {
            qrToken = table.units[0].qr_token;
          }
        }
      }
    }

    if (!qrToken) throw new Error("QR code not available");

    const restaurantId = localStorage.getItem('restaurantId');
    
    // Call backend endpoint - it handles HTML generation and printer routing
    await printQRViaAPI(
      restaurantId,
      sessionId,
      tableId,
      tableName,
      qrToken
    );
    
    console.log('[PrintQR] QR print completed');
  } catch (err) {
    console.error('[PrintQR] Error:', err);
    if (!autoPrint) {
      alert('Print error: ' + err.message);
    }
  }
}

async function endTableSession(sessionId) {
  if (!confirm("Delete this session? Orders will be saved.")) return;

  const res = await fetch(`${API}/table-sessions/${sessionId}/end`, {
    method: "POST"
  });

  if (!res.ok) {
    const err = await res.json();
    return alert(err.error || "Failed to end session");
  }

  await loadTablesCategoryTable();
  closeSessionPanel();
}

function showSessionQR(sessionId) {
  const modal = document.createElement("div");
  modal.className = "modal";
  modal.style.display = "flex";
  modal.style.alignItems = "center";
  modal.style.justifyContent = "center";
  modal.innerHTML = `
    <div class="modal-content">
      <h4>Session QR</h4>
      <img src="${API}/table-sessions/${sessionId}/qr" width="200" />
      <br><br>
      <button id="close-qr-modal">Close</button>
    </div>
  `;

  document.body.appendChild(modal);
  modal.querySelector("#close-qr-modal").onclick = () => modal.remove();
}

function orderForTable(tableId) {
  if (typeof switchSection === 'function') {
    window._pendingOrderForTable = { tableId: tableId.toString() };
    switchSection('orders');
  }
}

function handleSessionClick(sessionId) {
  ACTIVE_SESSION_ID = sessionId;
  const session = findSessionById(sessionId);
  if (!session) return;
  renderSessionOrder(session);
}

function findSessionById(sessionId) {
  for (var t = 0; t < TABLES.length; t++) {
    var table = TABLES[t];
    for (var s = 0; s < table.sessions.length; s++) {
      if (table.sessions[s].id === sessionId) {
        return table.sessions[s];
      }
    }
  }
  return null;
}

function toggleSessionGearMenu(event) {
  event.stopPropagation();
  const menu = document.getElementById("session-gear-menu");
  if (menu) {
    menu.classList.toggle("hidden");
  }
  // Close menu when clicking elsewhere
  document.addEventListener("click", () => {
    if (menu) menu.classList.add("hidden");
  }, { once: true });
}

async function showTableQR(sessionId) {
  // Close gear menu
  const gearMenu = document.getElementById('session-gear-menu');
  if (gearMenu) gearMenu.classList.add('hidden');

  // Find qr_token for this session's table
  let qrToken = null;
  let tableName = null;
  const table = TABLES.find(t => t.sessions.some(s => s.id === sessionId));
  if (table) {
    tableName = table.name;
    qrToken = table.units && table.units[0] && table.units[0].qr_token;
  }

  if (!qrToken) {
    alert('QR code not available for this table');
    return;
  }

  const menuUrl = `${window.location.origin}/${qrToken}`;
  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(menuUrl)}`;

  // Remove any existing QR modal
  const existing = document.getElementById('table-qr-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'table-qr-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:9999;';
  modal.innerHTML = `
    <div style="background:#fff;border-radius:12px;padding:28px 24px;text-align:center;max-width:340px;width:90%;box-shadow:0 8px 32px rgba(0,0,0,0.3);">
      <h3 style="margin:0 0 4px 0;font-size:18px;">Table ${tableName}</h3>
      <p style="margin:0 0 16px 0;font-size:12px;color:#666;">Scan to open the customer menu</p>
      <img src="${qrApiUrl}" width="240" height="240" style="border:1px solid #e5e7eb;border-radius:8px;" alt="QR Code" />
      <p style="margin:16px 0 0 0;font-size:11px;color:#999;word-break:break-all;">${menuUrl}</p>
      <button onclick="document.getElementById('table-qr-modal').remove()" style="margin-top:16px;padding:8px 24px;border:none;border-radius:6px;background:#1f2937;color:#fff;font-size:14px;font-weight:600;cursor:pointer;">Close</button>
    </div>
  `;
  // Close on backdrop click
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}

async function moveTableModal(tableId) {
  const table = TABLES.find(t => t.id === tableId);
  if (!table) return;

  const otherTables = TABLES.filter(t => t.id !== tableId && t.sessions.length === 0);
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';

  if (otherTables.length === 0) {
    modal.innerHTML = `
      <div class="modal-content" style="width: 380px;">
        <h3>↔️ Move Table</h3>
        <p style="color: var(--text-light); margin: 12px 0;">No empty tables available to move to.</p>
        <div class="modal-button-group">
          <button onclick="this.closest('.modal-overlay').remove()" class="modal-btn-primary">OK</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    return;
  }

  const options = otherTables.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
  modal.innerHTML = `
    <div class="modal-content" style="width: 400px;">
      <h3>↔️ Move Table</h3>
      <p style="color: var(--text-light); margin: 0 0 16px 0;">Move session from <strong>${table.name}</strong> to:</p>
      <label style="display: block; margin-bottom: 16px;">
        <span class="modal-content-label">Select Target Table</span>
        <select id="move-table-select" class="modal-input">
          ${options}
        </select>
      </label>
      <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 10px 12px; margin-bottom: 16px; font-size: 13px; color: #92400e;">
        Table transfer feature coming soon.
      </div>
      <div class="modal-button-group">
        <button onclick="this.closest('.modal-overlay').remove()" class="modal-cancel-btn">${t('admin.cancel-button')}</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

async function changeSessionPaxModal(sessionId, currentPax) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content" style="width: 380px;">
      <h3>${t('admin.change-pax')}</h3>
      <p style="color: var(--text-light); margin: 0 0 16px 0;">Current: <strong>${currentPax}</strong> guest(s)</p>
      <label style="display: block; margin-bottom: 16px;">
        <span class="modal-content-label">${t('admin.number-of-guests')}</span>
        <input type="number" id="new-pax-input" min="1" value="${currentPax}" class="modal-input">
      </label>
      <div class="modal-button-group">
        <button onclick="this.closest('.modal-overlay').remove()" class="modal-cancel-btn">${t('admin.cancel-button')}</button>
        <button onclick="submitChangePax(${sessionId})" class="modal-btn-primary">${t('admin.confirm') || 'Confirm'}</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  setTimeout(() => {
    const input = document.getElementById('new-pax-input');
    if (input) { input.focus(); input.select(); }
  }, 50);
}

async function submitChangePax(sessionId) {
  const input = document.getElementById('new-pax-input');
  const newPax = Number(input ? input.value : 0);
  if (!newPax || newPax <= 0) return;

  const res = await fetch(`${API}/table-sessions/${sessionId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pax: newPax, restaurantId })
  });

  if (!res.ok) {
    const err = await res.json();
    return alert(err.error || 'Failed to update pax');
  }

  const overlay = document.querySelector('.modal-overlay');
  if (overlay) overlay.remove();
  await loadTablesCategoryTable();
}

function updateBillTotal(grandTotal) {
  const couponSelect = document.getElementById('discount-coupon');
  const selectedOption = couponSelect && couponSelect.options ? couponSelect.options[couponSelect.selectedIndex] : null;
  
  let discountAmount = 0;
  if (selectedOption && selectedOption.value) {
    const couponType = selectedOption.getAttribute('data-type');
    const couponValue = Number(selectedOption.getAttribute('data-value'));
    
    if (couponType === 'percentage') {
      discountAmount = Math.round(grandTotal * couponValue / 100);
    } else {
      discountAmount = couponValue;
    }
  }
  
  const finalTotal = grandTotal - discountAmount;
  
  // Update the total display in the modal
  const billSummary = document.querySelector('[style*="Bill Summary"]');
  if (billSummary) {
    const totalLine = billSummary.querySelector('[style*="font-weight: bold"]');
    if (totalLine) {
      totalLine.innerHTML = `<p style="margin: 8px 0 0 0; font-size: 16px; font-weight: bold; border-top: 1px solid #ddd; padding-top: 8px;">Total: <span style="color: ${discountAmount > 0 ? '#10b981' : '#000'};">$${(finalTotal / 100).toFixed(2)}</span>${discountAmount > 0 ? ` <span style="font-size: 12px; color: #666;">(-$${(discountAmount / 100).toFixed(2)})</span>` : ''}</p>`;
    }
  }
}

async function clearCallStaff(sessionId) {
  try {
    const res = await fetch(`${API}/sessions/${sessionId}/call-staff`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restaurantId, call_staff_requested: false })
    });
    if (!res.ok) throw new Error('Failed');
    await fetchTableStates();
  } catch (e) {
    console.error('Error clearing call staff:', e);
  }
}

async function closeBillModal(sessionId) {
  const session = findSessionById(sessionId);
  if (!session) return alert("Session not found");

  const table = TABLES.find(t =>
    t.sessions.some(s => s.id === sessionId)
  );
  if (!table) return;

  // Ensure settings are loaded to get service charge fee
  if (!serviceChargeFee || serviceChargeFee === 0) {
    await loadAdminSettings();
  }

  // Get orders to calculate total
  const res = await fetch(`${API}/sessions/${sessionId}/orders?restaurantId=${restaurantId}`);
  if (!res.ok) return alert("Failed to load orders");

  const data = await res.json();
  const orders = data.items || [];

  let totalCents = 0;
  orders.forEach(order => {
    order.items.forEach(i => {
      totalCents += i.quantity * i.unit_price_cents;
    });
  });

  const serviceChargePercent = serviceChargeFee || Number(window.RESTAURANT_SERVICE_CHARGE || 0);
  const serviceCharge = Math.round(totalCents * serviceChargePercent / 100);
  const grandTotal = totalCents + serviceCharge;

  // Load coupons for discount selection
  const couponsRes = await fetch(`${API}/restaurants/${restaurantId}/coupons`);
  const coupons = couponsRes.ok ? await couponsRes.json() : [];

  // Ensure KPay terminal state is current before rendering the payment options
  await loadActiveKPayTerminal();

  // Create close bill modal with payment method, discount, and reason
  const closeBillWindow = document.createElement("div");
  closeBillWindow.className = "modal-overlay";
  const billTitle = t('admin.close-bill-title').replace('{0}', table.name);
  closeBillWindow.innerHTML = `
    <div class="modal-content" style="width: 400px;">
      <h3>${billTitle}</h3>
      
      <div style="margin-bottom: 20px; padding: 15px; background: #f5f5f5; border-radius: 8px;">
        <p style="margin: 0 0 8px 0; color: #666;">${t('admin.bill-summary')}</p>
        <p style="margin: 0 0 5px 0; font-size: 14px;">
          ${t('admin.subtotal-amount')} $${(totalCents / 100).toFixed(2)}
        </p>
        <p style="margin: 0; font-size: 14px;">
          ${t('admin.service-charge-label')} (${serviceChargePercent}%): $${(serviceCharge / 100).toFixed(2)}
        </p>
        <p style="margin: 8px 0 0 0; font-size: 16px; font-weight: bold; border-top: 1px solid #ddd; padding-top: 8px;">
          ${t('admin.total-amount')} $${(grandTotal / 100).toFixed(2)}
        </p>
      </div>

      <label style="display: block; margin-bottom: 15px;">
        <span style="font-weight: 600; display: block; margin-bottom: 5px;">${t('admin.payment-method')}</span>
        <select id="payment-method" onchange="onPaymentMethodChange()" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
          <option value="cash">${t('admin.payment-cash')}</option>
          <option value="card">${t('admin.payment-card')}</option>
          ${window._kpayTerminal ? `<option value="kpay">KPay Terminal</option>` : ''}
        </select>
      </label>

      <!-- KPay notice (shown when kpay selected) -->
      <div id="kpay-notice" style="display:none; background:#eff6ff; border:1px solid #bfdbfe; border-radius:6px; padding:10px; margin-bottom:15px; font-size:13px; color:#1d4ed8;">
        Payment will be sent to KPay terminal <strong>${window._kpayTerminal ? window._kpayTerminal.terminal_ip : ''}</strong>.<br>
        Confirm to initiate — the terminal will prompt the customer.
      </div>

      <label style="display: block; margin-bottom: 15px;">
        <span style="font-weight: 600; display: block; margin-bottom: 5px;">${t('admin.discount-section')}</span>
        <select id="discount-coupon" onchange="updateBillTotal(${grandTotal})" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
          <option value="">${t('admin.discount-none')}</option>
          ${coupons.map(c => `<option value="${c.id}" data-type="${c.discount_type}" data-value="${c.discount_value}">${c.code} - ${c.discount_type === 'percentage' ? c.discount_value + '%' : '$' + (c.discount_value / 100).toFixed(2)}</option>`).join('')}
        </select>
      </label>

      <label style="display: block; margin-bottom: 15px;">
        <span style="font-weight: 600; display: block; margin-bottom: 5px;">${t('admin.bill-close-reason')}</span>
        <textarea id="close-reason" placeholder="${t('admin.bill-close-reason-placeholder')}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-family: inherit; resize: vertical; height: 60px;"></textarea>
      </label>

      <div class="modal-button-group">
        <button onclick="this.closest('.modal-overlay').remove()" class="modal-cancel-btn">${t('admin.cancel-button')}</button>
        <button onclick="submitCloseBill(${sessionId}, ${grandTotal}, ${serviceCharge})" class="modal-btn-primary">${t('admin.close-bill-confirm')}</button>
      </div>
    </div>
  `;

  document.body.appendChild(closeBillWindow);
}

function onPaymentMethodChange() {
  const method = document.getElementById('payment-method')?.value;
  const notice = document.getElementById('kpay-notice');
  if (notice) notice.style.display = method === 'kpay' ? 'block' : 'none';
}

async function submitCloseBill(sessionId, grandTotal, serviceChargeAmount = 0) {
  const paymentEl = document.getElementById("payment-method");
  const paymentMethod = paymentEl ? paymentEl.value : "cash";
  const couponSelect = document.getElementById("discount-coupon");
  const selectedCouponOption = couponSelect && couponSelect.options ? couponSelect.options[couponSelect.selectedIndex] : null;
  const reasonEl = document.getElementById("close-reason");
  const reason = reasonEl ? reasonEl.value : "";

  let discountApplied = 0;
  if (selectedCouponOption && selectedCouponOption.value) {
    const couponType = selectedCouponOption.getAttribute("data-type");
    const couponValue = Number(selectedCouponOption.getAttribute("data-value"));
    if (couponType === "percentage") {
      discountApplied = Math.round(grandTotal * couponValue / 100);
    } else {
      discountApplied = couponValue;
    }
  }

  const finalAmount = grandTotal - discountApplied;

  // ── KPay path: initiate terminal payment first ──────────────────────────
  if (paymentMethod === 'kpay') {
    if (!window._kpayTerminal) {
      return alert('❌ No active KPay terminal configured. Please set one up in Settings.');
    }
    // Remove the close-bill modal before showing KPay overlay
    const overlay = document.querySelector(".modal-overlay");
    if (overlay) overlay.remove();

    await startKPayPayment({
      sessionId,
      finalAmount,
      discountApplied,
      serviceChargeAmount,
      reason,
      terminalId: window._kpayTerminal.id,
    });
    return;
  }

  // ── Cash / Card path (original flow) ──────────────────────────────────
  await _doCloseBill({ sessionId, paymentMethod, finalAmount, discountApplied, serviceChargeAmount, reason });
}

/**
 * Shows the KPay payment-waiting overlay, initiates the sale, polls for result.
 * On success calls _doCloseBill with payment_method='kpay' and kpay_reference_id.
 */
async function startKPayPayment({ sessionId, finalAmount, discountApplied, serviceChargeAmount, reason, terminalId }) {
  const restaurantId = localStorage.getItem('restaurantId');
  const amountInCents = String(finalAmount).padStart(12, '0');

  // Build overlay
  const overlay = document.createElement('div');
  overlay.id = 'kpay-payment-overlay';
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-content" style="width:420px; max-width:95vw;">
      <h3 style="margin:0 0 12px 0; display:flex; align-items:center; gap:8px;">
        KPay Terminal Payment
        <span id="kpay-status-badge" style="font-size:12px; padding:3px 10px; background:#fef3c7; color:#b45309; border-radius:12px; font-weight:600;">Initiating…</span>
      </h3>

      <div style="background:#f9fafb; border-radius:8px; padding:12px; margin-bottom:12px; font-size:13px;">
        <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
          <span style="color:#666;">Amount</span>
          <strong>HKD ${(finalAmount / 100).toFixed(2)}</strong>
        </div>
        <div style="display:flex; justify-content:space-between;">
          <span style="color:#666;">Terminal</span>
          <span>${window._kpayTerminal ? window._kpayTerminal.terminal_ip : ''}</span>
        </div>
      </div>

      <!-- Terminal log window -->
      <div id="kpay-terminal-log" style="
        background:#1a1a1a; color:#00ff00; font-family:'Courier New',monospace;
        font-size:11px; padding:12px; border-radius:6px; max-height:180px;
        overflow-y:auto; margin-bottom:12px;">
        <div style="color:#ffd43b;">> Connecting to KPay terminal…</div>
      </div>

      <div id="kpay-result-msg" style="display:none; padding:10px; border-radius:6px; font-size:13px; margin-bottom:12px;"></div>

      <div style="display:flex; gap:8px;">
        <button id="kpay-abort-btn" onclick="abortKPayPayment()" style="
          flex:1; padding:10px; background:#fee2e2; color:#dc2626;
          border:1px solid #fca5a5; border-radius:6px; cursor:pointer; font-size:13px; font-weight:600;">
          ⏹ Abort / Close Transaction
        </button>
        <button id="kpay-done-btn" onclick="document.getElementById('kpay-payment-overlay').remove()" style="
          display:none; flex:1; padding:10px; background:#d1fae5; color:#065f46;
          border:1px solid #6ee7b7; border-radius:6px; cursor:pointer; font-size:13px; font-weight:600;">
          ✓ Done
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  // Store context for abort / poll callbacks
  overlay._ctx = { sessionId, finalAmount, discountApplied, serviceChargeAmount, reason, terminalId, restaurantId };
  overlay._pollTimer = null;
  overlay._outTradeNo = null;

  function kpayLog(msg, color) {
    const log = document.getElementById('kpay-terminal-log');
    if (!log) return;
    const line = document.createElement('div');
    line.style.color = color || '#00ff00';
    line.textContent = msg;
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
  }

  function setBadge(text, bg, fg) {
    const b = document.getElementById('kpay-status-badge');
    if (b) { b.textContent = text; b.style.background = bg; b.style.color = fg; }
  }

  // ── Step 1: Initiate sale ────────────────────────────────────────────
  try {
    const apiUrl = `${API}/restaurants/${restaurantId}/payment-terminals/${terminalId}/test`;
    kpayLog(`> POST ${apiUrl}`);
    kpayLog(`> Amount: ${amountInCents} cents`);

    const resp = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payAmount: amountInCents, tipsAmount: '000000000000', payCurrency: '344' }),
    });
    const result = await resp.json();

    if (result.logs) result.logs.forEach(l => kpayLog(l, l.includes('✅') ? '#51cf66' : l.includes('❌') ? '#ff6b6b' : l.includes('⚠️') ? '#ffd43b' : '#00ff00'));

    if (!result.initiated) {
      setBadge('Failed', '#fee2e2', '#dc2626');
      const msg = document.getElementById('kpay-result-msg');
      if (msg) { msg.style.display='block'; msg.style.background='#fee2e2'; msg.style.color='#dc2626'; msg.textContent = (result.message || 'Failed to initiate payment'); }
      return;
    }

    overlay._outTradeNo = result.outTradeNo;
    setBadge('Waiting…', '#fef3c7', '#b45309');
    kpayLog(`> Payment initiated — outTradeNo: ${result.outTradeNo}`, '#ffd43b');
    kpayLog('> Waiting for customer to tap / scan on terminal…', '#ffd43b');

    // ── Step 2: Poll ──────────────────────────────────────────────────
    let attempts = 0;
    const maxAttempts = 22;

    async function poll() {
      if (attempts >= maxAttempts) {
        setBadge('Timeout', '#fee2e2', '#dc2626');
        kpayLog('> TIMEOUT — no response after 65s. Use Abort to free the terminal.', '#ffd43b');
        return;
      }
      if (!document.getElementById('kpay-payment-overlay')) return; // overlay removed

      kpayLog(`> Polling… (${attempts + 1}/${maxAttempts})`);
      attempts++;

      try {
        const qResp = await fetch(`${API}/restaurants/${restaurantId}/payment-terminals/${terminalId}/test-status?outTradeNo=${encodeURIComponent(overlay._outTradeNo)}`);
        const qData = await qResp.json();
        if (qData.logs) qData.logs.forEach(l => kpayLog(l, l.includes('✅') ? '#51cf66' : l.includes('❌') ? '#ff6b6b' : '#00ff00'));
        kpayLog(`  Status: ${qData.status}  code: ${qData.code ?? '?'}`);

        if (qData.status === 'success') {
          setBadge('Paid ✓', '#d1fae5', '#065f46');
          kpayLog('> ✅ PAYMENT CONFIRMED — closing bill…', '#51cf66');
          document.getElementById('kpay-abort-btn').style.display = 'none';
          const ctx = overlay._ctx;
          await _doCloseBill({
            sessionId: ctx.sessionId,
            paymentMethod: 'kpay',
            finalAmount: ctx.finalAmount,
            discountApplied: ctx.discountApplied,
            serviceChargeAmount: ctx.serviceChargeAmount,
            reason: ctx.reason,
            kpay_reference_id: overlay._outTradeNo,
          });
          kpayLog('> ✅ Bill closed.', '#51cf66');

          // Auto-print KPay receipt if enabled
          if (window.currentPrinterSettings?.kpay_auto_print) {
            kpayLog('> 🖨️ Printing KPay receipt…', '#51cf66');
            try {
              await printKPayReceipt({
                sessionId: ctx.sessionId,
                outTradeNo: overlay._outTradeNo,
                amountCents: ctx.finalAmount,
                transactionNo: qData.transactionNo,
              });
              kpayLog('> ✅ Receipt printed.', '#51cf66');
            } catch (printErr) {
              kpayLog('> ⚠️ Receipt print failed: ' + printErr.message, '#ffd43b');
            }
          }

          document.getElementById('kpay-done-btn').style.display = 'block';
          return;
        }

        if (qData.status === 'cancelled' || qData.status === 'failed') {
          setBadge(qData.status === 'cancelled' ? 'Cancelled' : 'Failed', '#fee2e2', '#dc2626');
          kpayLog(`> Payment ${qData.status}.`, '#ff6b6b');
          return;
        }

        // Still pending
        overlay._pollTimer = setTimeout(poll, 3000);
      } catch (e) {
        kpayLog(`  Poll error: ${e.message} — retrying…`, '#ffd43b');
        overlay._pollTimer = setTimeout(poll, 3000);
      }
    }

    overlay._pollTimer = setTimeout(poll, 2000);

  } catch (e) {
    kpayLog(`> ❌ Error: ${e.message}`, '#ff6b6b');
    setBadge('Error', '#fee2e2', '#dc2626');
  }
}

async function abortKPayPayment() {
  const overlay = document.getElementById('kpay-payment-overlay');
  if (!overlay) return;
  if (overlay._pollTimer) { clearTimeout(overlay._pollTimer); overlay._pollTimer = null; }
  const { terminalId, restaurantId } = overlay._ctx;
  const outTradeNo = overlay._outTradeNo;

  const log = document.getElementById('kpay-terminal-log');
  function klog(msg, color) {
    if (!log) return;
    const d = document.createElement('div'); d.style.color = color || '#ffd43b'; d.textContent = msg;
    log.appendChild(d); log.scrollTop = log.scrollHeight;
  }

  if (!outTradeNo) { overlay.remove(); return; }
  if (!confirm('Abort KPay transaction? This will close the pending payment on the terminal.')) return;

  document.getElementById('kpay-abort-btn').disabled = true;
  klog('> Aborting — sending close-transaction to terminal…');

  try {
    const r = await fetch(`${API}/restaurants/${restaurantId}/payment-terminals/${terminalId}/close-transaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outTradeNo }),
    });
    const d = await r.json();
    if (d.logs) d.logs.forEach(l => klog(l, l.includes('✅') ? '#51cf66' : l.includes('❌') ? '#ff6b6b' : '#ffd43b'));
    klog(d.success ? '> ✅ Transaction closed — terminal freed.' : `> ❌ Close failed: ${d.message || d.error}`, d.success ? '#51cf66' : '#ff6b6b');
  } catch (e) {
    klog(`> Error: ${e.message}`, '#ff6b6b');
  }

  document.getElementById('kpay-abort-btn').style.display = 'none';
  document.getElementById('kpay-done-btn').style.display = 'block';
  document.getElementById('kpay-done-btn').textContent = 'Close';
}

/**
 * Print KPay receipt after a successful payment.
 * Calls the backend print-kpay-receipt endpoint and handles Bluetooth printing client-side.
 */
async function printKPayReceipt({ sessionId, outTradeNo, amountCents, transactionNo }) {
  const rId = restaurantId || localStorage.getItem('restaurantId');
  if (!rId) return;

  // Get table name for receipt
  let tableName;
  try {
    const table = TABLES.find(t => t.sessions.some(s => s.id === sessionId));
    if (table) tableName = table.name;
  } catch (_) {}

  const response = await fetch(`${API}/restaurants/${rId}/print-kpay-receipt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId,
      outTradeNo,
      amountCents,
      currency: 'HKD',
      transactionNo: transactionNo || undefined,
      tableName: tableName || undefined,
      timestamp: new Date().toLocaleString(),
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Print failed');
  }

  const data = await response.json();

  // Handle Bluetooth print client-side
  if (data.bluetoothPayload && window.handleBluetoothPrint) {
    await window.handleBluetoothPrint({
      type: 'kpay',
      data: {
        escposBase64: data.bluetoothPayload.escposBase64,
        escposArray: data.bluetoothPayload.escposArray,
      },
      printerConfig: data.bluetoothPayload.printerConfig,
    });
  }
}

/**
 * Core close-bill API call, shared by both cash/card and KPay paths.
 */
async function _doCloseBill({ sessionId, paymentMethod, finalAmount, discountApplied, serviceChargeAmount, reason, kpay_reference_id = null }) {
  const restaurantId = localStorage.getItem('restaurantId');

  await fetch(`${API}/sessions/${sessionId}/request-bill-closure`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bill_closure_requested: true, restaurantId })
  }).catch(() => {});

  await loadTablesCategoryTable();

  const body = {
    payment_method: paymentMethod,
    amount_paid: finalAmount,
    discount_applied: discountApplied,
    service_charge: serviceChargeAmount,
    notes: reason,
    restaurantId,
    ...(kpay_reference_id ? { kpay_reference_id } : {}),
  };

  const closeBillRes = await fetch(`${API}/sessions/${sessionId}/close-bill`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!closeBillRes.ok) {
    const err = await closeBillRes.json();
    // Remove any remaining modal
    document.querySelectorAll('.modal-overlay').forEach(el => el.remove());
    alert(`❌ Error closing bill: ${err.error || err.message || "Failed to close bill"}`);
    return;
  }

  // Remove any remaining modals (cash/card path)
  document.querySelectorAll('.modal-overlay').forEach(el => el.remove());

  if (paymentMethod !== 'kpay') {
    showToast(`Bill closed\n${paymentMethod.toUpperCase()} · HKD ${(finalAmount / 100).toFixed(2)}`, 'success');
  }

  await loadTablesCategoryTable();
  if (typeof loadOrdersHistoryLeftPanel === 'function') await loadOrdersHistoryLeftPanel();

  // Auto-print bill if enabled
  if (window.currentPrinterSettings?.bill_auto_print) {
    await printBill(sessionId, true);
  }

  closeSessionPanel();
}

async function createTable() {
  const categoryId = Number(document.getElementById("new-table-category").value);
  if (!categoryId) return alert("Select a table category first");

  const name = document.getElementById("new-table-name").value.trim();
  const seats = Number(document.getElementById("new-table-seats").value) || 1;
  if (!name) return alert("Table name required");

  await fetch(`${API}/restaurants/${restaurantId}/tables`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      category_id: categoryId,
      name,
      seat_count: seats
    })
  });

  document.getElementById("new-table-name").value = "";
  document.getElementById("new-table-seats").value = "";
  document.getElementById("new-table-category").value = "";

  await loadTablesCategoryTable();
}

async function regenQR(tableId) {
  await fetch(
    `${API}/tables/${tableId}/regenerate-qr`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurantId })
    }
  );
  loadTablesCategoryTable();
}

async function deleteTable(tableId) {
  if (!confirm("Delete this table permanently?")) return;

  try {
    const res = await fetch(`${API}/restaurants/${restaurantId}/tables/${tableId}`, {
      method: "DELETE"
    });

    if (!res.ok) {
      const err = await res.json();
      return alert("Error deleting table: " + (err.error || err.message || "Unknown error"));
    }

    await loadTablesCategoryTable();
  } catch (err) {
    alert("Error deleting table: " + err.message);
  }
}

// Periodically reload table state to update card colors based on session elapsed time
setInterval(function() {
  if (TABLES && TABLES.length > 0) {
    loadTablesCategoryTable();
  }
}, 5000); // Reload tables every 5 seconds to sync bookings and status changes

// Listen for language changes to re-render category tabs
window.addEventListener('languageChanged', () => {
  console.log('[Tables] Language changed - re-rendering tabs');
  renderTableCategoryTabs();
});

