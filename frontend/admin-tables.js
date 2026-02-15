// ============= TABLES MODULE =============
// All table management functionality extracted from admin.js

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

  for (var ci = 0; ci < TABLE_CATEGORIES.length; ci++) {
    var cat = TABLE_CATEGORIES[ci];
    var btn = document.createElement("button");
    var isActive = SELECTED_TABLE_CATEGORY && SELECTED_TABLE_CATEGORY.key === cat.key;
    btn.className = isActive ? "tab active" : "tab";
    btn.textContent = cat.key;
    btn.categoryKey = cat.key;
    btn.onclick = function(e) {
      for (var i = 0; i < TABLE_CATEGORIES.length; i++) {
        if (TABLE_CATEGORIES[i].key === e.target.categoryKey) {
          SELECTED_TABLE_CATEGORY = TABLE_CATEGORIES[i];
          break;
        }
      }
      renderTableCategoryTabs();
      renderCategoryTablesGrid();
    };
    tabs.appendChild(btn);
  }

  // Add category button (only in edit mode)
  if (document.body.classList.contains("edit-mode")) {
    var addBtn = document.createElement("button");
    addBtn.className = "add-category-btn";
    addBtn.textContent = "+ Add";
    addBtn.onclick = function() { addTableCategoryPrompt(); };
    tabs.appendChild(addBtn);
  }
}

async function addTableCategoryPrompt() {
  var categoryName = prompt("Enter new table category name (e.g., Main Floor, Patio):", "");
  if (!categoryName || !categoryName.trim()) return;

  try {
    var url = API + "/restaurants/" + restaurantId + "/table-categories";
    var res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: categoryName.trim() })
    });

    if (!res.ok) {
      var err = await res.json();
      return alert(err.error || "Failed to create category");
    }

    await loadTablesCategories();
  } catch (err) {
    alert("Error creating category: " + err.message);
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

// Helper function to determine table card color based on session duration
function getTableCardColor(table) {
  if (table.sessions.length === 0 && !table.reserved) {
    return "white"; // Empty table
  }

  if (table.reserved && table.sessions.length === 0) {
    return "reserved"; // Reserved (yellow)
  }

  if (table.sessions.length > 0) {
    // Table is dining - check duration
    var session = table.sessions[0];
    var startedAt;
    if (session.started_at.indexOf('T') !== -1) {
      startedAt = new Date(session.started_at);
    } else {
      startedAt = new Date(session.started_at + 'Z');
    }
    var now = new Date();
    var durationMinutes = (now - startedAt) / (1000 * 60);

    if (durationMinutes < 30) {
      return "light-blue"; // Just started dining
    } else if (durationMinutes > 120) {
      return "red"; // Dining for over 2 hours
    } else {
      return "light-blue"; // Default to light blue for dining < 2 hrs
    }
  }

  return "white";
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
    grid.innerHTML = `<div class="empty-state"><p>No categories available</p></div>`;
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
    addCard.onclick = function() { addTablePrompt(SELECTED_TABLE_CATEGORY.id); };
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
      // Check if fully seated - hide status text
      if (usedSeats >= table.seat_count) {
        statusText = "";
      }
      // Build time display for each session
      for (var sj = 0; sj < table.sessions.length; sj++) {
        var session = table.sessions[sj];
        var startedAt;
        if (session.started_at.indexOf('T') !== -1) {
          startedAt = new Date(session.started_at);
        } else {
          startedAt = new Date(session.started_at + 'Z');
        }
        var elapsed = Math.floor((Date.now() - startedAt.getTime()) / 60000);
        sessionTimesHTML = sessionTimesHTML + "<div style=\"margin: 2px 0;\"><img src=\"/uploads/website/timer.png\" alt=\"timer\" style=\"width: 14px; height: 14px; vertical-align: middle; margin-right: 4px;\"> " + elapsed + "m</div>";
      }
    } else if (table.reserved) {
      status = "reserved";
      statusText = "Reserved";
    }

    // Determine card color
    var cardColor = getTableCardColor(table);

    var card = document.createElement("div");
    card.className = "table-card table-card-" + cardColor;

    var sessionsCountHTML = table.sessions.length > 0 ? "○ " + table.sessions.length : "";
    var sessionsListHTML = sessionTimesHTML ? "<div class=\"table-card-sessions-list\">" + sessionTimesHTML + "</div>" : "";
    var sessionsSpan = table.sessions.length > 0 ? "<span>" + table.sessions.length + " session(s)</span>" : "";
    
    card.innerHTML = "<div class=\"table-card-sessions\">" + sessionsCountHTML + "</div>" +
      "<div class=\"table-card-name\">" + table.name + "</div>" +
      sessionsListHTML +
      "<div class=\"table-card-status " + status + "\">" + statusText + "</div>" +
      "<div class=\"table-card-info\">" +
      "<span>" + usedSeats + "/" + table.seat_count + " seats</span>" +
      sessionsSpan +
      "</div>" +
      "<div class=\"table-edit-controls\">" +
      "<button onclick=\"event.stopPropagation(); renameTablePrompt(" + table.id + ", '" + table.name + "')\"><img src=\"/uploads/website/pencil.png\" alt=\"edit\" style=\"width: 14px; height: 14px; vertical-align: middle; margin-right: 4px;\"/>Rename</button>" +
      "<button onclick=\"event.stopPropagation(); changeTableSeatsPrompt(" + table.id + ", " + table.seat_count + ")\"><img src=\"/uploads/website/pencil.png\" alt=\"edit\" style=\"width: 14px; height: 14px; vertical-align: middle; margin-right: 4px;\"/>Seats</button>" +
      "<button onclick=\"event.stopPropagation(); deleteTable(" + table.id + ")\" style=\"background-color: #fee; color: #c33;\"><img src=\"/uploads/website/bin.png\" alt=\"delete\" style=\"width: 14px; height: 14px; vertical-align: middle; margin-right: 4px;\"/>Delete</button>" +
      "</div>" +
      "<div class=\"table-card-seats\" style=\"position: absolute; top: 8px; right: 8px; display: flex; align-items: center; gap: 4px;\">" +
      "<img src=\"/uploads/website/chair.png\" alt=\"seats\" style=\"width: 20px; height: 20px;\"/>" +
      "<span style=\"font-size: 14px;\">" + usedSeats + "/" + table.seat_count + "</span>" +
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

async function addTablePrompt(categoryId) {
  const name = prompt("Enter table name (e.g., T01, Table 1):", "");
  if (!name || !name.trim()) return;

  const seats = Number(prompt("Enter number of seats:", "4"));
  if (!seats || seats <= 0) return alert("Invalid seat count");

  try {
    const res = await fetch(`${API}/restaurants/${restaurantId}/tables`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category_id: categoryId,
        name: name.trim(),
        seat_count: seats
      })
    });

    if (!res.ok) {
      const err = await res.json();
      return alert(err.error || "Failed to create table");
    }

    await loadTablesCategoryTable();
  } catch (err) {
    alert("Error creating table: " + err.message);
  }
}



function renameTablePrompt(tableId, currentName) {
  const newName = prompt("Enter new table name:", currentName);
  if (!newName || !newName.trim()) return;

  renameTable(tableId, newName);
}

function changeTableSeatsPrompt(tableId, currentSeats) {
  const newSeats = Number(prompt("Enter new seat count:", currentSeats));
  if (!newSeats || newSeats <= 0) return alert("Invalid seat count");

  fetch(`${API}/tables/${tableId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ seat_count: newSeats })
  }).then(loadTablesCategoryTable);
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
        reserved: false
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
        started_at: r.started_at
      });
    }
  }

  TABLES = [];
  for (var key in tableMap) {
    if (tableMap.hasOwnProperty(key)) {
      TABLES.push(tableMap[key]);
    }
  }

  // Load bookings for today to set reserved flag
  try {
    var today = new Date().toISOString().split('T')[0];
    var bookingsUrl = API + "/restaurants/" + restaurantId + "/bookings?date=" + today;
    var bookingsRes = await fetch(bookingsUrl);
    if (bookingsRes.ok) {
      var bookings = await bookingsRes.json();
      var timeAllowance = 15;
      if (ADMIN_SETTINGS_CACHE && ADMIN_SETTINGS_CACHE.booking_time_allowance_mins) {
        timeAllowance = ADMIN_SETTINGS_CACHE.booking_time_allowance_mins;
      }
      var now = new Date();
      
      // Mark tables that have active bookings (not expired)
      for (var bi = 0; bi < bookings.length; bi++) {
        var booking = bookings[bi];
        var table = null;
        for (var ti = 0; ti < TABLES.length; ti++) {
          if (TABLES[ti].id === booking.table_id) {
            table = TABLES[ti];
            break;
          }
        }
        if (table && booking.status !== 'cancelled' && booking.status !== 'no-show') {
          // Check if booking has expired (past booking time + allowance)
          var bookingTime = new Date(today + "T" + booking.booking_time);
          var expirationTime = new Date(bookingTime.getTime() + timeAllowance * 60000);
          
          if (now < expirationTime) {
            table.reserved = true;
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
  if (startedAt.includes('T')) {
    // Already in ISO format or contains T
    start = new Date(startedAt);
  } else {
    // Plain datetime string, assume UTC
    start = new Date(startedAt + 'Z');
  }
  
  // Check if date is valid
  if (isNaN(start.getTime())) {
    return "—";
  }
  
  const now = new Date();
  const diffMs = now - start;
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
    const today = new Date().toISOString().split('T')[0];
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
    if (session.started_at.includes('T')) {
      startedAt = new Date(session.started_at);
    } else {
      startedAt = new Date(session.started_at + 'Z');
    }
    const durationMinutes = Math.floor((Date.now() - startedAt.getTime()) / 60000);
    
    // Determine color based on dining duration
    let sessionColor = "#0099ff"; // light blue < 30 mins
    if (durationMinutes >= 30 && durationMinutes < 120) {
      sessionColor = "#4a90e2"; // blue 30-120 mins
    } else if (durationMinutes >= 120) {
      sessionColor = "#e74c3c"; // red > 120 mins
    }
    
    const billTotal = sessionBills[session.id] ? `$${(sessionBills[session.id] / 100).toFixed(2)}` : "—";

    return `
      <div class="session-list-item" style="padding: 12px; background: ${sessionColor}15; border: 2px solid ${sessionColor}; border-radius: 6px; margin-bottom: 8px; cursor: pointer;" onclick="selectSessionToView(${session.id})">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <strong>Session #${session.id}</strong>
            <div style="font-size: 13px; color: var(--text-light); margin-top: 2px;">👥 ${session.pax} • Dining ${duration}</div>
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
      <strong style="display: block; margin-bottom: 8px;">Active Sessions:</strong>
      ${sessionsHTML}
    </div>

    ${remaining > 0 ? `
      <button class="btn-primary" style="width: 100%; margin-bottom: 8px;" onclick="startNewSessionModal(${table.id})">
        ＋ Start New Session (${remaining} seats)
      </button>
    ` : ''}

    <button class="btn-secondary" style="width: 100%; margin-bottom: 16px;" onclick="bookTableModal(${table.id})">
      ⊞ Book Table
    </button>

    <div id="table-reservations-list">
      <p style="font-size: 12px; color: var(--text-light);">Loading reservations...</p>
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
      ○ All ${table.seat_count} seats available
    </p>

    <button class="btn-primary" style="width: 100%; margin-bottom: 8px;" onclick="startNewSessionModal(${table.id})">
      ＋ Start Session
    </button>

    <button class="btn-secondary" style="width: 100%; margin-bottom: 16px;" onclick="bookTableModal(${table.id})">
      ⊞ Book Table
    </button>

    <div id="table-reservations-list">
      <p style="font-size: 12px; color: var(--text-light);">Loading reservations...</p>
    </div>
  `;

  // Load and display reservations
  loadTableReservations(table.id);
}

async function loadTableReservations(tableId) {
  try {
    const bookingsRes = await fetch(`${API}/restaurants/${restaurantId}/bookings`);
    if (!bookingsRes.ok) return;

    const bookings = await bookingsRes.json();
    const tableBookings = bookings.filter(b => b.table_id === tableId && b.status === 'confirmed');

    const reservationsEl = document.getElementById("table-reservations-list");
    if (!tableBookings.length) {
      reservationsEl.innerHTML = '<p style="font-size: 12px; color: var(--text-light);">No upcoming reservations</p>';
      return;
    }

    const reservationsHTML = tableBookings.map(booking => {
      const bookingDate = new Date(booking.booking_date);
      const dayStr = bookingDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return `
        <div style="padding: 10px; background: #f5f5f5; border-left: 3px solid #4a90e2; border-radius: 4px; margin-bottom: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <strong style="display: block; margin-bottom: 2px;">${booking.guest_name}</strong>
              <div style="font-size: 12px; color: var(--text-light);">
                📅 ${dayStr} at ${booking.booking_time}
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
      <strong style="display: block; margin-bottom: 8px; font-size: 12px;">Upcoming Reservations:</strong>
      ${reservationsHTML}
    `;
  } catch (err) {
    console.error("Error loading reservations:", err);
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
      <h3>Start New Session - ${table.name}</h3>
      <p style="color: var(--text-light); margin: 0 0 16px 0;">${remaining} seats available</p>
      
      <label style="display: block; margin-bottom: 16px;">
        <span style="font-weight: 600; display: block; margin-bottom: 8px;">Number of Guests (Pax)</span>
        <input type="number" id="session-pax-input" min="1" max="${remaining}" value="1" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 16px;">
      </label>

      <div style="display: flex; gap: 10px; justify-content: flex-end;">
        <button onclick="this.closest('.modal-overlay').remove()" style="padding: 10px 20px; background: #f0f0f0; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;">Cancel</button>
        <button onclick="submitStartSession(${tableId})" style="padding: 10px 20px; background: var(--primary-color); color: white; border: none; border-radius: 4px; cursor: pointer;">Start Session</button>
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
    alert("Session started successfully!");
    await loadTablesCategoryTable();
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
      <h3>Book Table - ${table.name}</h3>
      
      <label style="display: block; margin-bottom: 16px;">
        <span style="font-weight: 600; display: block; margin-bottom: 8px;">Guest Name</span>
        <input type="text" id="booking-name-input" placeholder="e.g., John Smith" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 16px;">
      </label>

      <label style="display: block; margin-bottom: 16px;">
        <span style="font-weight: 600; display: block; margin-bottom: 8px;">Number of Guests (Pax)</span>
        <input type="number" id="booking-pax-input" min="1" max="${table.seat_count}" value="2" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 16px;">
      </label>

      <label style="display: block; margin-bottom: 16px;">
        <span style="font-weight: 600; display: block; margin-bottom: 8px;">Booking Date</span>
        <input type="date" id="booking-date-input" value="${today}" min="${minDate}" max="${maxDate}" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 16px;">
      </label>

      <label style="display: block; margin-bottom: 16px;">
        <span style="font-weight: 600; display: block; margin-bottom: 8px;">Reservation Time</span>
        <input type="time" id="booking-time-input" value="18:00" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 16px;">
      </label>

      <div style="display: flex; gap: 10px; justify-content: flex-end;">
        <button onclick="this.closest('.modal-overlay').remove()" style="padding: 10px 20px; background: #f0f0f0; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;">Cancel</button>
        <button onclick="submitBookTable(${tableId})" style="padding: 10px 20px; background: var(--primary-color); color: white; border: none; border-radius: 4px; cursor: pointer;">Book Table</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  document.getElementById("booking-name-input").focus();
}

async function submitBookTable(tableId) {
  const nameInput = document.getElementById("booking-name-input");
  const name = nameInput ? nameInput.value.trim() : "";
  const paxInput = document.getElementById("booking-pax-input");
  const pax = Number(paxInput ? paxInput.value : 0);
  const dateInput = document.getElementById("booking-date-input");
  const date = dateInput ? dateInput.value : "";
  const timeInput = document.getElementById("booking-time-input");
  const time = timeInput ? timeInput.value : "";

  if (!name) return alert("Guest name required");
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

  // Header with session info and gear dropdown
  panel.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
      <button class="panel-close-btn" onclick="closeSessionPanel()">✕</button>
      <div style="flex: 1; text-align: center;">
        <h3 style="margin: 0; font-size: 18px;">${sessionLabel}</h3>
        <p style="margin: 4px 0 0 0; font-size: 12px; color: var(--text-light);">${pax} pax • Dining ${diningDuration}</p>
      </div>
      <div style="position: relative;">
        <button class="gear-icon-btn" onclick="toggleSessionGearMenu(event)">⚙️</button>
        <div id="session-gear-menu" class="session-gear-menu hidden">
          <button onclick="changeSessionPaxModal(${session.id}, ${pax})">Change Pax</button>
          <button onclick="moveTableModal(${table.id})">Move Table</button>
          <button onclick="orderForTable('${table.units[0] ? table.units[0].qr_token : ''}')">Order for Table</button>
          <button onclick="printQR(${session.id})">📱 Print QR</button>
          <button onclick="printBill(${session.id})">🖨 Print Bill</button>
          <button onclick="splitBill(${session.id})">Split Bill</button>
          <button onclick="endTableSession(${session.id})" style="color: #c33;">Delete Session</button>
        </div>
      </div>
    </div>

    <!-- Orders Section -->
    <div id="session-orders" style="flex: 1; overflow-y: auto; border-top: 1px solid var(--border-color); padding-top: 12px; margin-bottom: 12px;">
      <p>Loading orders…</p>
    </div>

    <!-- Total and Actions -->
    <div style="border-top: 2px solid var(--border-color); padding-top: 12px;">
      <div id="session-total" style="font-weight: bold; margin-bottom: 12px; font-size: 16px;">
        Total: —
      </div>
      <button class="btn-primary" style="width: 100%;" onclick="closeBillModal(${session.id})">
        💳 Close Bill
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

    const res = await fetch(`${API}/sessions/${sessionId}/orders`);
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
      container.innerHTML = "<p style='color: var(--text-light);'>No orders yet</p>";
      totalEl.textContent = "Total: $0.00";
      return;
    }

    let totalCents = 0;

    // Build order HTML + compute subtotal
    container.innerHTML = orders.map(order => `
      <div class="order-card">
        <strong>Order #${order.order_id}</strong>

        ${order.items.map(i => {
          const itemTotal = i.quantity * i.unit_price_cents;
          totalCents += itemTotal;

          return `
            <div class="order-item" style="display:flex;gap:6px;align-items:center;justify-content:space-between;margin:8px 0;">
              <div style="flex:1;">
                <div><strong>${i.name}</strong></div>
                ${i.variants && i.variants.trim() ? `<div style="font-size:0.85em;color:#666;margin-top:2px;font-style:italic;">${i.variants}</div>` : ''}
                <div style="color:#999;font-size:0.9em;">Status: ${i.status}</div>
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
        <span>Subtotal:</span>
        <span>$${(totalCents / 100).toFixed(2)}</span>
      </div>
      ${serviceChargePercent > 0 ? `
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 14px;">
          <span>Service (${serviceChargePercent}%):</span>
          <span>$${(serviceCharge / 100).toFixed(2)}</span>
        </div>
      ` : ''}
      <div style="display: flex; justify-content: space-between; font-size: 18px; color: white; background: rgba(0,0,0,0.3); padding: 8px; border-radius: 4px; margin-top: 8px;">
        <span>Total:</span>
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
  const win = window.open("", "_blank");
  
  let itemsHTML = '';
  bill.items.forEach(i => {
    const lineTotal = (i.price_cents * i.quantity / 100).toFixed(2);
    itemsHTML += `<div class="item-row"><div class="item-name">${i.name}</div><div class="item-qty">x${i.quantity}</div><div class="item-price">$${lineTotal}</div></div>`;
  });
  
  const serviceChargeHTML = bill.service_charge_cents ? `<div class="summary-row"><span>Service Charge:</span><span>$${(bill.service_charge_cents / 100).toFixed(2)}</span></div>` : '';
  
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
      <div class="items">${itemsHTML}</div>
      <div class="summary">
        <div class="summary-row subtotal">
          <span>Subtotal:</span>
          <span>$${(bill.subtotal_cents / 100).toFixed(2)}</span>
        </div>
        ${serviceChargeHTML}
        <div class="summary-row total">
          <span>TOTAL:</span>
          <span>$${(bill.total_cents / 100).toFixed(2)}</span>
        </div>
      </div>
      <div class="footer">
        <div>Thank you for your visit!</div>
        <div class="thank-you">Come Again!</div>
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

  const sessionLabel = getSessionLabel(table, sessionId);
  const tableUnit = table.units[0];
  const qrToken = tableUnit ? tableUnit.qr_token : null;

  if (!qrToken) return alert("QR code not available");

  const qrURL = (window.location.hostname === "localhost" ? "http://localhost:10000/" : "https://chuio.io/") + qrToken;

  const win = window.open("", "_blank");
  
  const qrHTML = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <title>QR Code - ${sessionLabel}</title>
    <script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"><\/script>
    <style>
      body { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; }
      .container { background: white; padding: 30px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); text-align: center; }
      .title { font-size: 24px; font-weight: bold; margin-bottom: 8px; color: #333; }
      .subtitle { font-size: 16px; color: #666; margin-bottom: 24px; }
      #qrcode { display: inline-block; padding: 12px; background: white; border: 2px solid var(--primary-color); border-radius: 8px; margin-bottom: 20px; }
      .instruction { font-size: 14px; color: #666; margin-top: 16px; padding-top: 16px; border-top: 1px solid #eee; }
      .url { font-size: 12px; color: #999; margin-top: 12px; word-break: break-all; font-family: monospace; }
      @media print { body { background: white; } .container { box-shadow: none; } .instruction { display: none; } }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="title">Order QR Code</div>
      <div class="subtitle">Table ${sessionLabel}</div>
      <div id="qrcode"><\/div>
      <div class="url">${qrURL}<\/div>
      <div class="instruction">Scan this QR code to view and order from the menu<\/div>
    </div>
    <script>
      new QRCode(document.getElementById("qrcode"), { text: "${qrURL}", width: 280, height: 280, correctLevel: QRCode.CorrectLevel.H });
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
  const res = await fetch(`${API}/sessions/${sessionId}/orders`);
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
  closeBillWindow.innerHTML = `
    <div class="modal-content" style="width: 400px;">
      <h3>Close Bill - ${table.name}</h3>
      
      <div style="margin-bottom: 20px; padding: 15px; background: #f5f5f5; border-radius: 8px;">
        <p style="margin: 0 0 8px 0; color: #666;">Bill Summary</p>
        <p style="margin: 0 0 5px 0; font-size: 14px;">Subtotal: $${(totalCents / 100).toFixed(2)}</p>
        <p style="margin: 0; font-size: 14px;">Service Charge (${serviceChargePercent}%): $${(serviceCharge / 100).toFixed(2)}</p>
        <p style="margin: 8px 0 0 0; font-size: 16px; font-weight: bold; border-top: 1px solid #ddd; padding-top: 8px;">Total: $${(grandTotal / 100).toFixed(2)}</p>
      </div>

      <label style="display: block; margin-bottom: 15px;">
        <span style="font-weight: 600; display: block; margin-bottom: 5px;">Payment Method</span>
        <select id="payment-method" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
          <option value="cash">Cash</option>
          <option value="card">Card</option>
          <option value="online">Online Payment</option>
          <option value="check">Check</option>
          <option value="other">Other</option>
        </select>
      </label>

      <label style="display: block; margin-bottom: 15px;">
        <span style="font-weight: 600; display: block; margin-bottom: 5px;">Discount / Coupon</span>
        <select id="discount-coupon" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
          <option value="">No Discount</option>
          ${coupons.map(c => `<option value="${c.id}" data-type="${c.discount_type}" data-value="${c.discount_value}">${c.code} - ${c.discount_type === 'percentage' ? c.discount_value + '%' : '$' + (c.discount_value / 100).toFixed(2)}</option>`).join('')}
        </select>
      </label>

      <label style="display: block; margin-bottom: 15px;">
        <span style="font-weight: 600; display: block; margin-bottom: 5px;">Reason (optional)</span>
        <textarea id="close-reason" placeholder="e.g., Customer satisfied, Complaint, etc." style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-family: inherit; resize: vertical; height: 60px;"></textarea>
      </label>

      <div style="display: flex; gap: 10px; justify-content: flex-end;">
        <button onclick="this.closest('.modal-overlay').remove()" style="padding: 10px 20px; background: #f0f0f0; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;">Cancel</button>
        <button onclick="submitCloseBill(${sessionId}, ${grandTotal})" style="padding: 10px 20px; background: var(--primary-color); color: white; border: none; border-radius: 4px; cursor: pointer;">Close Bill</button>
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

  // Close the bill
  const closeBillRes = await fetch(`${API}/sessions/${sessionId}/close-bill`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ 
      payment_method: paymentMethod,
      amount_paid: finalAmount,
      discount_applied: discountApplied,
      notes: reason
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

async function renameTable(tableId, name) {
  if (!name.trim()) return;

  await fetch(`${API}/tables/${tableId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name })
  });

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

  await fetch(`${API}/tables/${tableId}`, {
    method: "DELETE"
  });

  loadTablesCategoryTable();
}



function editTableCategory(catId, currentName) {
  const newName = prompt("Enter new category name:", currentName);
  if (!newName || !newName.trim()) return;

  fetch(`${API}/restaurants/${restaurantId}/table-categories/${catId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: newName })
  }).then(() => loadTablesCategoryTable());
}

async function deleteTableCategory(catId) {
  if (!confirm("Delete this category? All tables in it will be affected.")) return;

  await fetch(`${API}/restaurants/${restaurantId}/table-categories/${catId}`, {
    method: "DELETE"
  });

  loadTablesCategoryTable();
}

