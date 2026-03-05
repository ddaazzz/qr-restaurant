// ============= TABLES MODULE =============
// All table management functionality extracted from admin.js

// Initialization state
let tablesInitialized = false;

function initializeTables() {
  // Always load table categories and table data when section is switched to
  loadTablesCategoryTable();
  
  // Attach event listeners only once
  if (!tablesInitialized) {
    tablesInitialized = true;
    attachEventListeners();
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
    closeBillBtn.addEventListener('click', openCloseBillModal);
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
      deleteBtn.textContent = "🗑️";
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

// Helper function to determine table card color based on session duration and status
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
    
    // Single session - check if bill closure is requested
    var session = table.sessions[0];
    
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
    addCard.textContent = "+";
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
          sessionTimesHTML = sessionTimesHTML + "<div class=\"session-time-item\"><img src=\"/uploads/website/timer.png\" alt=\"timer\"> " + elapsed + "</div>";
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

    grid.appendChild(card);
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
        bill_closure_requested: r.bill_closure_requested
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
        if (table && booking.status === 'confirmed') {
          // Check if booking has expired (past booking time + allowance)
          var bookingTime = new Date(today + "T" + booking.booking_time);
          var expirationTime = new Date(bookingTime.getTime() + timeAllowance * 60000);
          
          if (now < expirationTime) {
            table.reserved = true;
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
    const res = await fetch(`${API}/restaurants/${restaurantId}/bookings?table_id=${tableId}&date=${new Date().toISOString().split('T')[0]}`);
    if (!res.ok) return false;
    
    const bookings = await res.json();
    const today = new Date().toISOString().split('T')[0];
    return bookings.some(b => b.date === today && b.status !== 'cancelled');
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

  // Get next reservation for this table
  let nextReservation = null;
  try {
    const today = getTodayDateString();
    const bookingsRes = await fetch(`${API}/restaurants/${restaurantId}/bookings?date=${today}`);
    if (bookingsRes.ok) {
      const bookings = await bookingsRes.json();
      const upcomingBooking = bookings.find(b => b.table_id === table.id && b.status === 'confirmed');
      if (upcomingBooking) {
        nextReservation = upcomingBooking;
      }
    }
  } catch (err) {
    console.error("Error loading bookings:", err);
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
            <strong>${t('admin.session-label').replace('{0}', session.id)}</strong>
            <div style="font-size: 13px; color: var(--text-light); margin-top: 2px;">👥 ${session.pax} • ${t('admin.dining')} ${duration}</div>
          </div>
          <div style="text-align: right; font-size: 14px; font-weight: 600; color: ${sessionColor};">
            ${billTotal}
          </div>
        </div>
      </div>
    `;
  }).join('');

  const nextReservationHTML = nextReservation ? `
    <div style="padding: 12px; background: #f39c1215; border: 1px solid #f39c12; border-radius: 6px; margin-bottom: 16px;">
      <strong style="display: block; margin-bottom: 4px;">📅 Next Reservation</strong>
      <div style="font-size: 13px; color: var(--text-light);">
        ${nextReservation.guest_name} • ${nextReservation.pax} pax at ${nextReservation.booking_time}
      </div>
    </div>
  ` : '';

  panel.innerHTML = `
    <button class="panel-close-btn" onclick="closeSessionPanel()">✕</button>
    <h2 style="margin: 0 0 12px 0; font-size: 24px; font-weight: 900; color: var(--text-dark);">${table.name}</h2>
    <p style="margin: 0 0 16px 0; font-size: 13px; color: var(--text-light);">
      ○ ${usedSeats}/${table.seat_count} seats occupied
    </p>

    ${nextReservationHTML}

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
    const tableBookings = bookings.filter(b => b.table_id === tableId && b.status === 'confirmed');

    if (!tableBookings.length) {
      reservationsEl.innerHTML = `<p style="font-size: 12px; color: var(--text-light);">${t('admin.no-upcoming-reservations')}</p>`;
      return;
    }

    const reservationsHTML = tableBookings.map(booking => {
      return `
        <div style="padding: 10px; background: #f5f5f5; border-left: 3px solid #4a90e2; border-radius: 4px; margin-bottom: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <strong style="display: block; margin-bottom: 2px;">#${booking.id} - ${booking.guest_name}</strong>
              <div style="font-size: 12px; color: var(--text-light);">
                🕒 ${booking.booking_time} • 📞 ${booking.phone || 'N/A'}
              </div>
            </div>
            <div style="text-align: right; font-weight: 600; color: #4a90e2;">
              👥 ${booking.pax}
            </div>
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

      <div class="modal-button-group">
        <button onclick="this.closest('.modal-overlay').remove()" class="modal-cancel-btn">${t('admin.cancel-button')}</button>
        <button onclick="submitStartSession(${tableId})" class="modal-btn-primary">${t('admin.start-session')}</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  document.getElementById("session-pax-input").focus();
}

async function submitStartSession(tableId) {
  const paxInput = document.getElementById("session-pax-input");
  const pax = Number(paxInput ? paxInput.value : 0);
  if (!pax || pax <= 0) return alert("Invalid number of guests");

  try {
    const res = await fetch(`${API}/tables/${tableId}/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pax })
    });

    if (!res.ok) {
      const err = await res.json();
      return alert(err.error || "Failed to start session");
    }

    const overlay = document.querySelector(".modal-overlay");
    if (overlay) overlay.remove();
    
    // Reload table data and automatically display the session
    await loadTablesCategoryTable();
    
    // Find the table and display its session
    const table = TABLES.find(t => t.id === tableId);
    if (table) {
      handleTableClick(table);
    }
  } catch (err) {
    alert("Error starting session: " + err.message);
  }
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
    alert("Table booked successfully!");
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

  // ADD THE ACTIVE CLASS TO SHOW THE PANEL
  panel.classList.add("active");

  // Header with session info and gear dropdown
  panel.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
      <button class="panel-close-btn" onclick="closeSessionPanel()">✕</button>
      <div style="flex: 1; text-align: center;">
        <h3 style="margin: 0; font-size: 18px;">${sessionLabel}</h3>
        <p style="margin: 4px 0 0 0; font-size: 12px; color: var(--text-light);">Table ${table.name} • ${t('admin.started')} ${new Date(session.started_at).toLocaleTimeString()}</p>
        <p style="margin: 4px 0 0 0; font-size: 12px; color: var(--text-light);">${pax} ${t('admin.pax-label')} • ${t('admin.dining')} ${diningDuration}</p>
      </div>
      <div style="position: relative;">
        <button class="gear-icon-btn" onclick="toggleSessionGearMenu(event)">⚙️</button>
        <div id="session-gear-menu" class="session-gear-menu hidden">
          <button onclick="changeSessionPaxModal(${session.id}, ${pax})">${t('admin.change-pax')}</button>
          <button onclick="moveTableModal(${table.id})">${t('admin.move-table')}</button>
          <button onclick="orderForTable('${table.units[0] ? table.units[0].qr_token : ''}')">📱 ${t('admin.order-for-table')}</button>
          <button onclick="printQR(${session.id})">${t('admin.print-qr')}</button>
          <button onclick="printBill(${session.id})">${t('admin.print-bill')}</button>
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
      <button class="btn-primary" style="width: 100%;" onclick="closeBillModal(${session.id})">
        💳 ${t('admin.close-bill')}
      </button>
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
    container.innerHTML = orders.map(order => `
      <div class="order-card">
        <strong>${t('admin.order-label')} #${order.order_id}</strong>

        ${order.items.map(i => {
          const itemTotal = i.quantity * i.unit_price_cents;
          totalCents += itemTotal;

          return `
            <div class="order-item" style="display:flex;gap:6px;align-items:center;justify-content:space-between;margin:8px 0;">
              <div style="flex:1;">
                <div><strong>${i.name || 'Item'}</strong></div>
                ${i.variants && i.variants.trim() ? `<div style="font-size:0.85em;color:#666;margin-top:2px;font-style:italic;">${i.variants}</div>` : ''}
                <div style="color:#999;font-size:0.9em;">${t('admin.status-label')} ${i.status}</div>
              </div>
              <div style="text-align: right;">
                <div style="font-weight: bold;">$${(itemTotal / 100).toFixed(2)}</div>
                <div style="font-size: 0.9em; color: var(--text-light);">x${i.quantity}</div>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `).join("");

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
          <span>${t('admin.service-charge-label').replace('{0}', serviceChargePercent)}:</span>
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
async function printBill(sessionId) {
  const res = await fetch(`${API}/sessions/${sessionId}/bill`);
  if (!res.ok) return alert("Failed to load bill");

  const bill = await res.json();
  const lang = localStorage.getItem('language') || 'en';
  
  // Translation labels
  const labels = {
    'subtotal': lang === 'zh' ? '小計：' : 'Subtotal:',
    'service': lang === 'zh' ? '服務費' : 'Service Charge',
    'total': lang === 'zh' ? '總計：' : 'TOTAL:',
    'order-type': lang === 'zh' ? '訂單類型' : 'Order Type',
    'table': lang === 'zh' ? '座位' : 'Table',
    'time': lang === 'zh' ? '時間' : 'Time',
    'thank-you': lang === 'zh' ? '感謝蒞臨！' : 'Thank you for your visit!',
    'come-again': lang === 'zh' ? '歡迎再來！' : 'Come Again!'
  };
  
  const win = window.open("", "_blank");
  
  let itemsHTML = '';
  bill.items.forEach(i => {
    const lineTotal = (i.price_cents * i.quantity / 100).toFixed(2);
    itemsHTML += `<div class="item-row"><div class="item-name">${i.name}</div><div class="item-qty">x${i.quantity}</div><div class="item-price">$${lineTotal}</div></div>`;
  });
  
  const serviceChargeHTML = bill.service_charge_cents ? `<div class="summary-row"><span>${labels.service} (%):</span><span>$${(bill.service_charge_cents / 100).toFixed(2)}</span></div>` : '';
  
  // Format session start time and order type from bill response
  let sessionInfoHTML = '';
  if (bill.session) {
    const startTime = bill.session.started_at ? new Date(bill.session.started_at).toLocaleString() : 'N/A';
    let orderType = lang === 'zh' ? '座位' : 'Table';
    let tableInfo = '';
    
    if (bill.session.order_type === 'to-go') orderType = lang === 'zh' ? '外帶' : 'To Go';
    else if (bill.session.order_type === 'pay-now') orderType = lang === 'zh' ? '現場結帳' : 'Counter/Pay Now';
    else if (bill.session.table_id) tableInfo = ` - ${labels.table} ${bill.session.table_name || '#' + bill.session.table_id}`;
    
    sessionInfoHTML = `
      <div style="font-size: 11px; color: #666; margin-bottom: 2px;">${labels['order-type']}: ${orderType}${tableInfo}</div>
      <div style="font-size: 11px; color: #666; margin-bottom: 6px;">${labels.time}: ${startTime}</div>
    `;
  }
  
  const billHTML = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <title>Receipt</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: 'Courier New', monospace; width: 300px; padding: 12px; background: #fff; }
      .receipt { width: 100%; text-align: center; font-size: 13px; line-height: 1.4; }
      .header { border-bottom: 2px dashed #000; padding-bottom: 8px; margin-bottom: 8px; }
      .logo { max-width: 60px; margin: 0 auto 6px; height: auto; }
      .restaurant-name { font-weight: bold; font-size: 16px; margin-bottom: 4px; }
      .restaurant-info { font-size: 11px; color: #333; margin-bottom: 2px; }
      .divider { border-bottom: 1px dashed #000; margin: 8px 0; }
      .items { text-align: left; margin: 8px 0; }
      .item-row { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px; }
      .item-name { flex: 1; }
      .item-qty { text-align: center; min-width: 30px; margin: 0 4px; }
      .item-price { text-align: right; min-width: 50px; font-weight: bold; }
      .summary { border-top: 2px dashed #000; padding-top: 6px; margin-top: 8px; }
      .summary-row { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 3px; }
      .summary-row.subtotal { border-bottom: 1px dashed #000; padding-bottom: 3px; }
      .summary-row.total { font-size: 16px; font-weight: bold; margin-top: 3px; }
      .footer { margin-top: 10px; font-size: 10px; color: #666; border-top: 1px dashed #000; padding-top: 6px; }
      .thank-you { font-weight: bold; margin-top: 4px; }
      @media print { body { margin: 0; padding: 0; } .receipt { width: 100%; } }
    </style>
  </head>
  <body>
    <div class="receipt">
      <div class="header">
        ${bill.restaurant && bill.restaurant.logo_url ? `<img src="${bill.restaurant.logo_url}" class="logo" alt="Logo"/>` : ''}
        <div class="restaurant-name">${bill.restaurant ? bill.restaurant.name : 'Receipt'}</div>
        <div class="restaurant-info">${bill.restaurant ? bill.restaurant.address || '' : ''}</div>
        <div class="restaurant-info">${bill.restaurant ? bill.restaurant.phone || '' : ''}</div>
      </div>
      <div class="divider"></div>
      ${sessionInfoHTML}
      <div class="items">${itemsHTML}</div>
      <div class="summary">
        <div class="summary-row subtotal">
          <span>${labels.subtotal}</span>
          <span>$${(bill.subtotal_cents / 100).toFixed(2)}</span>
        </div>
        ${serviceChargeHTML}
        <div class="summary-row total">
          <span>${labels.total}</span>
          <span>$${(bill.total_cents / 100).toFixed(2)}</span>
        </div>
      </div>
      <div class="footer">
        <div>${labels['thank-you']}</div>
        <div class="thank-you">${labels['come-again']}</div>
      </div>
    </div>
    <script>
      window.print();
      window.onafterprint = () => window.close();
    </script>
  </body>
</html>`;
  
  win.document.write(billHTML);
}

async function splitBill(sessionId) {
  const res = await fetch(`${API}/sessions/${sessionId}/bill`);
  if (!res.ok) return alert("Failed to load bill");

  const bill = await res.json();

  const splits = Number(
    prompt("Split bill into how many people?")
  );

  if (!splits || splits <= 1) {
    return alert("Invalid split count");
  }

  const perPerson = Math.ceil(bill.total_cents / splits);

  alert(
    'Total: $' + (bill.total_cents / 100).toFixed(2) + '\n' +
    'Each pays: $' + (perPerson / 100).toFixed(2)
  );
}

async function printQR(sessionId) {
  const session = findSessionById(sessionId);
  if (!session) return alert("Session not found");
  
  const table = TABLES.find(t => t.sessions.some(s => s.id === sessionId));
  if (!table) return alert("Table not found");

  const lang = localStorage.getItem('language') || 'en';
  const labels = {
    'table': lang === 'zh' ? '座位' : 'Table',
    'pax': lang === 'zh' ? '人數' : 'Pax',
    'started': lang === 'zh' ? '開始時間' : 'Started',
    'scan-to-order': lang === 'zh' ? '掃描 QR Code 開始點餐' : 'Scan this QR code to order'
  };

  const sessionLabel = getSessionLabel(table, sessionId);
  const tableUnit = table.units[0];
  const qrToken = tableUnit ? tableUnit.qr_token : null;

  if (!qrToken) return alert("QR code not available");

  const qrURL = (window.location.hostname === "localhost" ? "http://localhost:10000/" : "https://chuio.io/") + qrToken;
  const startTime = new Date(session.started_at).toLocaleString();
  const pax = session.pax || 0;
  const restaurantName = document.querySelector('[data-i18n="app.restaurant-name"]')?.textContent || 'Restaurant';

  const win = window.open("", "_blank");
  
  const qrHTML = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <title>QR Code - ${sessionLabel}</title>
    <script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"><\/script>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: 'Courier New', monospace; padding: 12px; background: #fff; }
      .receipt { width: 100%; text-align: center; font-size: 12px; line-height: 1.5; max-width: 80mm; margin: 0 auto; }
      .header { border-bottom: 2px dashed #000; padding-bottom: 8px; margin-bottom: 8px; }
      .restaurant-name { font-weight: bold; font-size: 18px; margin-bottom: 4px; }
      .divider { border-bottom: 1px dashed #000; margin: 8px 0; }
      .info-section { text-align: left; margin: 8px 0; font-size: 11px; }
      .info-row { display: flex; justify-content: space-between; margin-bottom: 4px; }
      .info-label { font-weight: bold; min-width: 60px; }
      #qrcode { display: flex; justify-content: center; margin: 12px 0; }
      #qrcode img { max-width: 200px; height: auto; }
      .scan-instruction { font-weight: bold; font-size: 13px; margin: 8px 0; }
      .footer { font-size: 10px; color: #666; margin-top: 8px; }
      @media print { 
        body { margin: 0; padding: 8px; } 
        .receipt { width: 80mm; } 
        .instruction { display: none; }
      }
    </style>
  </head>
  <body>
    <div class="receipt">
      <div class="header">
        <div class="restaurant-name">${restaurantName}</div>
      </div>
      
      <div class="info-section">
        <div class="info-row">
          <span class="info-label">${labels.table}:</span>
          <span>${table.name}</span>
        </div>
        <div class="info-row">
          <span class="info-label">${labels.pax}:</span>
          <span>${pax} ${lang === 'zh' ? '人' : 'pax'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">${labels.started}:</span>
          <span>${startTime}</span>
        </div>
      </div>
      
      <div class="divider"></div>
      
      <div id="qrcode"><\/div>
      
      <div class="scan-instruction">${labels['scan-to-order']}</div>
      
      <div class="footer">
        <p style="margin-top: 8px;">---</p>
      </div>
    </div>
    
    <script>
      new QRCode(document.getElementById("qrcode"), { 
        text: "${qrURL}", 
        width: 200, 
        height: 200, 
        correctLevel: QRCode.CorrectLevel.H,
        colorDark: "#000000",
        colorLight: "#ffffff"
      });
      window.onload = () => { setTimeout(() => window.print(), 500); };
      window.onafterprint = () => window.close();
    <\/script>
  </body>
</html>`;
  
  win.document.write(qrHTML);
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

function orderForTable(qrToken) {
  window.open(`${location.origin}/${qrToken}?staff=1`, "_blank");
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

async function moveTableModal(tableId) {
  const table = TABLES.find(t => t.id === tableId);
  if (!table) return alert("Table not found");

  const otherTables = TABLES.filter(t => t.id !== tableId && t.sessions.length === 0);
  
  if (otherTables.length === 0) {
    return alert("No empty tables available to move to");
  }

  const tableNames = otherTables.map(t => t.name).join(", ");
  const newTableName = prompt(`Move ${table.name} to one of these tables:\n${tableNames}\n\nEnter table name:`, "");
  
  if (!newTableName) return;

  const newTable = otherTables.find(t => t.name.toLowerCase() === newTableName.toLowerCase());
  if (!newTable) {
    return alert("Invalid table name");
  }

  // TODO: Implement move table API call
  alert(`Moving ${table.name} to ${newTable.name} (feature coming soon)`);
}

async function changeSessionPaxModal(sessionId, currentPax) {
  const newPax = Number(prompt(`Change pax from ${currentPax} to:`, currentPax));
  if (!newPax || newPax <= 0) {
    return alert("Invalid pax count");
  }

  const res = await fetch(`${API}/table-sessions/${sessionId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pax: newPax })
  });

  if (!res.ok) {
    const err = await res.json();
    return alert(err.error || "Failed to update pax");
  }

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
        <select id="payment-method" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
          <option value="cash">${t('admin.payment-cash')}</option>
          <option value="card">${t('admin.payment-card')}</option>
          <option value="online">${t('admin.payment-online')}</option>
        </select>
      </label>

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
        <button onclick="submitCloseBill(${sessionId}, ${grandTotal})" class="modal-btn-primary">${t('admin.close-bill-confirm')}</button>
      </div>
    </div>
  `;

  document.body.appendChild(closeBillWindow);
}

async function submitCloseBill(sessionId, grandTotal) {
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

  // First update session to mark bill closure requested (shows yellow on table card)
  await fetch(`${API}/sessions/${sessionId}/request-bill-closure`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ 
      bill_closure_requested: true,
      restaurantId: restaurantId
    })
  }).catch(err => console.log("Note: Could not pre-mark bill closure", err));

  // Immediately reload to show yellow card
  await loadTablesCategoryTable();

  // Close the bill
  const closeBillRes = await fetch(`${API}/sessions/${sessionId}/close-bill`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ 
      payment_method: paymentMethod,
      amount_paid: finalAmount,
      discount_applied: discountApplied,
      notes: reason,
      restaurantId: restaurantId
    })
  });

  if (!closeBillRes.ok) {
    const err = await closeBillRes.json();
    return alert(err.error || "Failed to close bill");
  }

  // Remove modal
  const overlay = document.querySelector(".modal-overlay");
  if (overlay) overlay.remove();

  alert("Bill closed successfully!");
  await loadTablesCategoryTable();
  
  // If called from orders panel, refresh orders history
  if (typeof loadOrdersHistoryLeftPanel === 'function') {
    await loadOrdersHistoryLeftPanel();
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
    { method: "POST" }
  );
  loadTablesCategoryTable();
}

async function deleteTable(tableId) {
  if (!confirm("Delete this table permanently?")) return;

  try {
    const res = await fetch(`${API}/tables/${tableId}`, {
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

