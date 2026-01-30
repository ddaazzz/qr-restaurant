
  const API =
  window.location.hostname === "localhost"
    ? "http://localhost:10000/api"
    : "https://chuio.io/api";

let restaurantId = localStorage.getItem("restaurantId");
const token = localStorage.getItem("token");
const role = localStorage.getItem("role"); // "admin" | "staff" | "superadmin"
let superadminRestaurants = [];

if (!token || !["admin", "staff", "superadmin"].includes(role)) {
  alert("Access denied");
  window.location.href = "/login";
}

const IS_ADMIN = role === "admin";
const IS_STAFF = role === "staff";
const IS_SUPERADMIN = role === "superadmin";

let CREATING_ITEM = false;
let EDITING_ITEM_ID = null;
let OPEN_VARIANTS_ITEM_ID = null;
let EDITING_VARIANT_ID = null;
let CURRENT_VARIANTS = [];
let MENU_CATEGORIES = [];
let MENU_ITEMS = [];
let TABLE_CATEGORIES = [];
let TABLES = [];
let SELECTED_TABLE_CATEGORY = null;
let SELECTED_CATEGORY = null; // currently selected category for display
let IS_EDIT_MODE = false;
let ACTIVE_SESSION_ID = null;
let ADMIN_SETTINGS_CACHE = {};
// Store the staged logo URL or file locally
let STAGED_LOGO = null;
let serviceChargeFee = null;
let CURRENT_SECTION = "tables";

// ============= UI INITIALIZATION =============
document.addEventListener("DOMContentLoaded", () => {
  // Handle login screen visibility
  const loginScreen = document.getElementById("login-screen");
  const appContainer = document.getElementById("app-container");
  
  if (IS_STAFF) {
    // Staff shows PIN login first
    loginScreen.style.display = "flex";
    appContainer.style.display = "none";
  } else {
    // Admin goes straight to app
    loginScreen.style.display = "none";
    appContainer.style.display = "flex";
    initializeApp();
  }

  const colorInput = document.getElementById("colorInput");
  if (colorInput) {
    colorInput.addEventListener("input", e => {
      const newColor = e.target.value;
      applyThemeColor(newColor);
    });
  }
});

// ============= APP INITIALIZATION =============
function initializeApp() {
  // Hide admin-only elements (but NOT sections) for staff
  document.querySelectorAll(".admin-only:not(section)").forEach(el => {
    if (IS_ADMIN || IS_SUPERADMIN) {
      el.classList.add("admin-visible");
    }
  });

  // Hide non-admin menu buttons for staff
  if (IS_STAFF) {
    document.getElementById("menu-nav-btn").style.display = "none";
    document.getElementById("staff-nav-btn").style.display = "none";
    document.getElementById("tables-mgmt-nav-btn").style.display = "none";
    document.getElementById("settings-nav-btn").style.display = "none";
  }

  loadApp();
  
  // Initialize to Tables section
  switchSection("tables");
}

// ============= SECTION SWITCHING =============
function switchSection(sectionName) {
  CURRENT_SECTION = sectionName;
  
  // Hide all sections
  document.querySelectorAll(".content-section").forEach(el => {
    el.classList.remove("active");
  });

  // Show selected section
  const sectionEl = document.getElementById(`section-${sectionName}`);
  if (sectionEl) {
    sectionEl.classList.add("active");
  }

  // Update active menu button
  document.querySelectorAll(".menu-btn").forEach(btn => {
    btn.classList.remove("active");
  });
  document.querySelector(`[data-section="${sectionName}"]`).classList.add("active");
}

// ============= LOGOUT =============
function handleLogout() {
  if (confirm("Are you sure you want to logout?")) {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("restaurantId");
    window.location.href = "/login.html";
  }
}

// ============= PIN LOGIN MODAL =============
let modalEnteredPin = "";
const MODAL_PIN_LENGTH = 6;

function openPinLoginModal() {
  document.getElementById("pin-modal-overlay").style.display = "block";
  document.getElementById("pin-modal").style.display = "block";
  modalEnteredPin = "";
  updateModalDots();
}

function closePinLoginModal() {
  document.getElementById("pin-modal-overlay").style.display = "none";
  document.getElementById("pin-modal").style.display = "none";
  modalEnteredPin = "";
  updateModalDots();
}

function pressKeyModal(num) {
  if (modalEnteredPin.length >= MODAL_PIN_LENGTH) return;
  modalEnteredPin += num;
  updateModalDots();
}

function clearPinModal() {
  modalEnteredPin = modalEnteredPin.slice(0, -1);
  updateModalDots();
}

function updateModalDots() {
  document.querySelectorAll("#modal-pin-dots span").forEach((dot, i) => {
    dot.classList.toggle("filled", i < modalEnteredPin.length);
  });
}

async function submitPinModal() {
  if (modalEnteredPin.length !== MODAL_PIN_LENGTH) {
    alert("Enter 6-digit PIN");
    return;
  }

  // Try to login with PIN
  const res = await fetch(`${API}/auth/staff-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pin: modalEnteredPin, restaurantId })
  });

  const data = await res.json();
  
  if (res.ok) {
    localStorage.setItem("token", data.token);
    closePinLoginModal();
    // Reload the app with the new user
    location.reload();
  } else {
    alert(data.error || "Invalid PIN");
    modalEnteredPin = "";
    updateModalDots();
  }
}

// ============= MAIN APP LOAD =============
async function loadApp() {
  if (IS_ADMIN || IS_SUPERADMIN) {
    await loadAdminSettings();
    await loadStaff();
    await loadMenuItems();
  }

  await loadTablesCategories();
  await loadTablesCategoryTable();
}

function adminOnly(actionName = "This action") {
  if (!IS_ADMIN && !IS_SUPERADMIN) {
    alert(`${actionName} is admin only`);
    return false;
  }
  return true;
}

async function loadAdminSettings() {
  const res = await fetch(`${API}/${restaurantId}/settings`);
  const s = await res.json();

  ADMIN_SETTINGS_CACHE = { ...s }; // 🔥 cache everything

  // View mode text
  document.getElementById("view-name").textContent = s.name || "";
  document.getElementById("view-address").textContent = s.address || "";
  document.getElementById("view-phone").textContent = s.phone || "";
  document.getElementById("view-color").textContent = s.theme_color || "";
  document.getElementById("view-service-charge").textContent =
    s.service_charge_percent ?? "";

  // Inputs (pre-filled for edit later)
  document.getElementById("restaurant-name").value = s.name || "";
  document.getElementById("restaurant-address").value = s.address || "";
  document.getElementById("restaurant-phone").value = s.phone || "";
  document.getElementById("colorInput").value = s.theme_color || "#000000";
  document.getElementById("serviceChargeInput").value =
    s.service_charge_percent ?? 0;
    
    serviceChargeFee = s.service_charge_percent;

  // Logo
  const logoEl = document.getElementById("restaurant-logo");
  if (s.logo_url) {
    logoEl.src = s.logo_url;
    logoEl.style.display = "block";
  }
}
function enterEditMode() {
  toggleEdit(true);
}

function cancelEditMode() {
  toggleEdit(false);
}

function toggleEdit(isEdit) {
  const inputs = document.querySelectorAll(
    "#restaurant-header input"
  );
  const views = document.querySelectorAll(
    "#restaurant-header .view-mode"
  );

  inputs.forEach(el => el.style.display = isEdit ? "block" : "none");
  views.forEach(el => el.style.display = isEdit ? "none" : "block");

  document.getElementById("logoInput").style.display = isEdit ? "block" : "none";
  document.getElementById("edit-settings-btn").style.display = isEdit ? "none" : "inline-block";
  document.getElementById("save-settings-btn").style.display = isEdit ? "inline-block" : "none";
  document.getElementById("cancel-settings-btn").style.display = isEdit ? "inline-block" : "none";
}

// Apply the theme color to the CSS
function applyThemeColor(color) {
  if (!color) return;

  document.documentElement.style
    .setProperty("--primary-color", color);
}


function uploadRestaurantLogo(file) {
  if (!file) return;

  // Store the file locally, only upload on Save
  STAGED_LOGO = file;

  // Preview immediately
  const reader = new FileReader();
  reader.onload = e => {
    const logoEl = document.getElementById("restaurant-logo");
    logoEl.src = e.target.result; // local preview
    logoEl.style.display = "block";
  };
  reader.readAsDataURL(file);
}


async function saveAdminSettings() {
  const payload = {
    name: document.getElementById("restaurant-name").value,
    address: document.getElementById("restaurant-address").value,
    phone: document.getElementById("restaurant-phone").value,
    theme_color: document.getElementById("colorInput").value,
    service_charge_percent:
      Number(document.getElementById("serviceChargeInput").value) || 0,
  };

  // If a new logo was staged, upload it first
  if (STAGED_LOGO) {
    const form = new FormData();
    form.append("image", STAGED_LOGO);

    const res = await fetch(`${API}/${restaurantId}/logo`, {
      method: "POST",
      body: form
    });

    if (!res.ok) {
      alert("Logo upload failed");
      return;
    }

    const data = await res.json();
    payload.logo_url = data.logo_url;

    // Clear staged logo after successful upload
    STAGED_LOGO = null;
  } else {
    // Preserve existing logo if no new one
    payload.logo_url = ADMIN_SETTINGS_CACHE.logo_url;
  }

  // Save all settings
  const saveRes = await fetch(`${API}/${restaurantId}/settings`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!saveRes.ok) {
    alert("Failed to save settings");
    return;
  }

  alert("Restaurant settings saved");
  toggleEdit(false);
  loadAdminSettings(); // refresh view
}


async function loadStaff() {
  if (!adminOnly("MANAGE_STAFF")) return;

  console.log("Loading staff for restaurantId:", restaurantId);

  const res = await fetch(`${API}/restaurants/${restaurantId}/staff`);
  const staff = await res.json();

  console.log("Staff loaded:", staff);

  const container = document.getElementById("staff-list");
  container.innerHTML = "";

  if (!staff || staff.length === 0) {
    container.innerHTML = "<p style='color: var(--text-light);'>No staff members yet</p>";
    return;
  }

  staff.forEach(s => {
    container.innerHTML += `
      <div class="card">
        <div>
          <strong>${s.name}</strong><br>
          <span style="font-size: 12px; color: var(--text-light);">${s.email}</span>
          <br>
          <span style="font-size: 11px; color: var(--text-light); background: var(--bg-light); padding: 2px 6px; border-radius: 3px; display: inline-block; margin-top: 4px;">${s.role || 'staff'}</span>
        </div>
        <button onclick="deleteStaff(${s.id})">🗑</button>
      </div>
    `;
  });
}

async function createStaff() {
  if (!adminOnly("MANAGE_STAFF")) return;

  // Clear previous messages
  const errorEl = document.getElementById("staff-error");
  const successEl = document.getElementById("staff-success");
  errorEl.style.display = "none";
  successEl.style.display = "none";

  const name = document.getElementById("staff-name").value;
  const email = document.getElementById("staff-email").value;
  const password = document.getElementById("staff-password").value;
  const pin = document.getElementById("staff-pin").value;
  const role = document.getElementById("staff-role")?.value || "staff";

  console.log("Creating staff:", { name, email, pin, role });

  if (!name || !email || !password || !pin) {
    errorEl.textContent = "All fields are required";
    errorEl.style.display = "flex";
    return;
  }

  try {
    const payload = { name, email, password, pin, role };
    console.log("Sending payload:", payload);

    const res = await fetch(`${API}/restaurants/${restaurantId}/staff`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    console.log("Response status:", res.status, "Data:", data);

    if (!res.ok) {
      errorEl.textContent = data.error || "Failed to create staff";
      errorEl.style.display = "flex";
      return;
    }

    // Clear inputs
    document.getElementById("staff-name").value = "";
    document.getElementById("staff-email").value = "";
    document.getElementById("staff-password").value = "";
    document.getElementById("staff-pin").value = "";
    if (document.getElementById("staff-role")) {
      document.getElementById("staff-role").value = "staff";
    }

    // Show success message
    successEl.textContent = `${role === 'kitchen' ? 'Kitchen staff' : 'Staff'} member created successfully`;
    successEl.style.display = "flex";
    
    console.log("Staff created successfully, reloading staff list");

    // Auto-hide success message after 4 seconds
    setTimeout(() => {
      successEl.style.display = "none";
    }, 4000);

    loadStaff(); // refresh staff list
  } catch (err) {
    console.error("Error creating staff:", err);
    errorEl.textContent = "Network error: " + (err.message || "Failed to create staff");
    errorEl.style.display = "flex";
  }
}

async function deleteStaff(staffId) {
  if (!adminOnly("MANAGE_STAFF")) return;

  if (!confirm("Are you sure you want to delete this staff?")) return;

  try {
    const res = await fetch(`${API}/restaurants/${restaurantId}/staff/${staffId}`, { method: "DELETE" });
    
    if (!res.ok) {
      const error = await res.json();
      alert(error.error || "Failed to delete staff");
      return;
    }

    // Show success notification
    const successEl = document.getElementById("staff-success");
    if (successEl) {
      successEl.textContent = "Staff member deleted successfully";
      successEl.style.display = "flex";
      setTimeout(() => {
        successEl.style.display = "none";
      }, 3000);
    }

    loadStaff(); // refresh staff list
  } catch (err) {
    console.error(err);
    alert("Error: " + (err.message || "Failed to delete staff"));
  }
}

async function loginStaff() {
  const pin = document.getElementById("staff-login-pin").value;
  if (!pin) return alert("Enter PIN");

  const res = await fetch(`${API}/auth/staff-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pin, restaurantId })
  });

  const data = await res.json();
  if (res.ok) {
    localStorage.setItem("token", data.token);
    // Show app, hide login
    document.getElementById("login-screen").style.display = "none";
    document.getElementById("app-container").style.display = "flex";
    initializeApp();
  } else {
    alert(data.error);
  }
}


async function loadTablesCategories() {
  const res = await fetch(
    `${API}/restaurants/${restaurantId}/table-categories`
  );
  TABLE_CATEGORIES = await res.json();

  // auto-select first category
  if (!SELECTED_TABLE_CATEGORY && TABLE_CATEGORIES.length) {
    SELECTED_TABLE_CATEGORY = TABLE_CATEGORIES[0];
  }

  renderTableCategoryTabs();
}

function renderTableCategoryTabs() {
  const tabs = document.getElementById("tables-category-tabs");
  tabs.innerHTML = "";

  TABLE_CATEGORIES.forEach(cat => {
    const btn = document.createElement("button");
    btn.className =
      SELECTED_TABLE_CATEGORY?.key === cat.key
        ? "tab active"
        : "tab";

    btn.textContent = cat.key;

    btn.onclick = () => {
      SELECTED_TABLE_CATEGORY = cat;
      renderTableCategoryTabs();
      renderCategoryTablesGrid();
    };

    tabs.appendChild(btn);
  });
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
  const name = document
    .getElementById("new-tables-category-name")
    .value
    .trim();

  if (!name) return alert("Category name required");

  await fetch(
    `${API}/restaurants/${restaurantId}/table-categories`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name })
    }
  );

  document.getElementById("new-tables-category-name").value = "";
  closeCreateTablesCategory();
  loadTablesCategoryTable();
}

function renderCategoryTablesGrid() {
  const grid = document.getElementById("tables-grid");
  grid.innerHTML = "";

  if (!SELECTED_TABLE_CATEGORY) return;

  const tables = TABLES.filter(t => t.category_id === SELECTED_TABLE_CATEGORY.id);

  if (!tables.length) {
    grid.innerHTML = `<div class="empty-state"><p>No tables in this category</p></div>`;
    return;
  }

  tables.forEach(table => {
    const usedSeats = table.sessions.reduce((s, x) => s + x.pax, 0);

    const card = document.createElement("div");
    card.className = "table-card";

    card.innerHTML = `
      <strong>${table.name}</strong><br>
      Seats: ${usedSeats}/${table.seat_count}<br>

      ${IS_ADMIN || IS_SUPERADMIN ? `
  <div class="table-actions">
    <button onclick="renameTablePrompt(${table.id}, '${table.name}')">✏️ Rename</button>
    <button onclick="changeTableSeatsPrompt(${table.id}, ${table.seat_count})">🪑 Change Seats</button>
    <button onclick="deleteTable(${table.id})">🗑 Delete</button>
  </div>
` : ""}


      <div class="sessions">
        ${renderTableSessions(table)}
      </div>
    `;

    // Clicking card = start new session
    card.onclick = e => {
      if (e.target.tagName !== "BUTTON") handleTableClick(table);
    };

    grid.appendChild(card);
  });
}

function renameTablePrompt(tableId, currentName) {
  const newName = prompt("Enter new table name:", currentName);
  if (!newName?.trim()) return;

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
  const res = await fetch(
    `${API}/restaurants/${restaurantId}/table-state`
  );

  const rows = await res.json();

  const tableMap = {};

  rows.forEach(r => {
    if (!tableMap[r.table_id]) {
  tableMap[r.table_id] = {
    id: r.table_id,
    name: r.table_name,
    seat_count: r.seat_count,
    category_id: r.category_id,   // ✅ ADD THIS
    units: [],
    sessions: []
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
        pax: Number(r.pax), // ✅ ALWAYS valid now
        started_at: r.started_at
      });
    }
  });

  TABLES = Object.values(tableMap);

  renderCategoryTablesGrid();
  renderTableCategoriesList();
  renderTablesList();
  updateTableCategorySelect();
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

async function handleTableClick(table) {
  const usedSeats = table.sessions.reduce((s, x) => s + x.pax, 0);
  const remaining = table.seat_count - usedSeats;

  if (remaining <= 0) {
    alert("Table is full. End a session to free seats.");
    return;
  }

  const pax = Number(
    prompt(`Table ${table.name} has ${remaining} seats left.\nEnter pax:`)
  );

  if (!pax || pax <= 0 || pax > remaining) {
    alert("Invalid pax count");
    return;
  }

  // 1️⃣ Start a new session
  const res = await fetch(`${API}/tables/${table.id}/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pax })
  });

  if (!res.ok) {
    const err = await res.json();
    alert(err.error || "Failed to start session");
    return;
  }

  /* 2️⃣ Regenerate QR for all table units
  for (const unit of table.units) {
    await fetch(`${API}/tables/${unit.id}/regenerate-qr`, { method: "POST" });
  }*/

  // 3️⃣ Refresh table list
  await loadTablesCategoryTable();
}

async function renderSessionOrder(session) {
  const panel = document.getElementById("session-order-panel");

  const table = TABLES.find(t =>
    t.sessions.some(s => s.id === session.id)
  );
  if (!table) return;

  const sessionLabel = getSessionLabel(table, session.id);
  const pax = session.pax;

  const tableUnit = table.units[0];
  const qrToken = tableUnit?.qr_token;

  const qrURL = `${
    window.location.hostname === "localhost"
      ? "http://localhost:10000/"
      : "https://chuio.io/"
  }${qrToken}`;

  const canvasId = `qr-${table.id}`;


  panel.innerHTML = `
    <h3>🧾 Session</h3>
    <div style="margin-bottom:8px;">
      <strong>${sessionLabel}</strong> · ${pax} pax
    </div>
    <div class="session-actions">
      <button onclick="changeSessionPax(${session.id})">Change Pax</button>
      <button onclick="printQR(${session.id})">📱 Print QR</button>
      <button onclick="printBill(${session.id})">Print Bill</button>
      <button onclick="splitBill(${session.id})">Split Bill</button>
      <button class="danger" onclick="endTableSession(${session.id})">End Session</button>
      ${IS_ADMIN ? `
        <button onclick="IS_EDIT_MODE = !IS_EDIT_MODE; loadAndRenderOrders(${session.id})">
          ${IS_EDIT_MODE ? "Confirm Edit" : "Edit Order"}
        </button>
      ` : ""}
    </div>
    <div class="session-extra">
      <a href="${qrURL}" target="_blank" class="btn-secondary" style="margin-bottom:8px;display:inline-block;width:100%;text-align:center;">Order for Table</a>
    </div>
    <div id="session-orders">
      <p>Loading orders…</p>
    </div>
    ${IS_ADMIN ? `
      <div class="session-discount-section">
        <strong>💰 Apply Discount (Admin Only)</strong><br>
        <div style="margin-top: 8px; display: flex; gap: 8px; flex-wrap: wrap;">
          <input type="number" id="discount-amount-${session.id}" placeholder="$0.00" step="0.01" style="flex:1 1 80px; min-width:0; max-width:120px; padding: 6px; border: 1px solid #ddd; border-radius: 6px;" />
          <button onclick="applyManualDiscount(${session.id})" class="btn-secondary" style="flex:0 0 auto;max-width:70px;">Apply</button>
          <button onclick="clearManualDiscount(${session.id})" class="btn-secondary" style="flex:0 0 auto;max-width:70px;">Clear</button>
        </div>
        <div id="discount-display-${session.id}" style="margin-top: 6px; color: #059669; font-weight: 600; font-size: 13px;"></div>
      </div>
    ` : ""}
    <div id="session-total" style="margin-top:10px;font-weight:bold;">
      Total: —
    </div>
  `;

  // QR code is hidden from the session panel (per requirements)

  await loadAndRenderOrders(session.id);
}

async function loadAndRenderOrders(sessionId) {
  try {
    const res = await fetch(`${API}/sessions/${sessionId}/orders`);
    if (!res.ok) {
      const err = await res.json();
      console.error("Error loading orders:", err);
      return;
    }
    
    const data = await res.json();
    const orders = data.items || [];

    console.log("📦 Loaded orders for session:", sessionId, "Orders:", orders);

    const container = document.getElementById("session-orders");
    const totalEl = document.getElementById("session-total");

    if (!orders.length) {
      container.innerHTML = "<p>No orders yet</p>";
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

          console.log("Item:", i.name, "Variants:", i.variants, "Status:", i.status);

          return `
            <div class="order-item" style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
              <span style="flex:1;min-width:200px;">
                <div><strong>${i.name}</strong></div>
                ${i.variants && i.variants.trim() ? `<div style="font-size:0.85em;color:#666;margin-top:2px;font-style:italic;">${i.variants}</div>` : ''}
                <div style="color:#999;font-size:0.9em;">Status: ${i.status}</div>
                <div style="font-weight:bold;margin-top:4px;">$${(itemTotal / 100).toFixed(2)}</div>
              </span>
              ${
                IS_EDIT_MODE
                  ? `
                    <button onclick="updateOrderItem(${i.order_item_id}, ${i.quantity - 1})">−</button>
                    <span>${i.quantity}</span>
                    <button onclick="updateOrderItem(${i.order_item_id}, ${i.quantity + 1})">+</button>
                    <button onclick="removeOrderItem(${i.order_item_id})">🗑</button>
                  `
                  : `<span>x${i.quantity}</span>`
              }
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
      Subtotal: $${(totalCents / 100).toFixed(2)}<br>
      Service Charge (${serviceChargePercent}%): $${(serviceCharge / 100).toFixed(2)}<br>
      <strong>Total: $${(grandTotal / 100).toFixed(2)}</strong>
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
async function changeSessionPax(sessionId) {
  if (!adminOnly("Change pax")) return;
  const session = findSessionById(sessionId);
  if (!session) return alert("Session not found");

  const table = TABLES.find(t =>
    t.sessions.some(s => s.id === sessionId)
  );

  const usedSeatsExcludingThis =
    table.sessions
      .filter(s => s.id !== sessionId)
      .reduce((sum, s) => sum + s.pax, 0);

  const maxAllowed = table.seat_count - usedSeatsExcludingThis;

  const newPax = Number(
    prompt(
      `Table ${table.name}\nMax allowed: ${maxAllowed}\nEnter new pax:`,
      session.pax
    )
  );

  if (!newPax || newPax <= 0 || newPax > maxAllowed) {
    return alert("Invalid pax number");
  }

  const res = await fetch(`${API}/sessions/${sessionId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pax: newPax })
  });

  if (!res.ok) {
    const err = await res.json();
    return alert(err.error || "Failed to update pax");
  }

  await loadTablesCategoryTable();
  renderSessionOrder(session);
}

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
        <div class="restaurant-name">${bill.restaurant?.name || 'Receipt'}</div>
        <div class="restaurant-info">${bill.restaurant?.address || ''}</div>
        <div class="restaurant-info">${bill.restaurant?.phone || ''}</div>
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
  const qrToken = tableUnit?.qr_token;

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
      #qrcode { display: inline-block; padding: 12px; background: white; border: 2px solid #f97316; border-radius: 8px; margin-bottom: 20px; }
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
  if (!confirm("End this session? This will close the table.")) return;

  const res = await fetch(`${API}/table-sessions/${sessionId}/end`, {
    method: "POST"
  });

  if (!res.ok) {
    const err = await res.json();
    return alert(err.error || "Failed to end session");
  }

  await loadTablesCategoryTable();

  document.getElementById("session-order-panel").innerHTML =
    "<p>Select a session</p>";
}

function renderOrdersHTML(orders) {
  if (!orders.length) return `<p style="color:#666;">No active orders</p>`;

  return orders.map(order => `
    <div class="order-card">
      <strong>Order #${order.order_id}</strong> - Status: ${order.status || 'pending'}
      ${order.items.map(i => `
        <div>${i.quantity}× ${i.name}</div>
      `).join("")}
      <div>Total: $${(order.total_cents / 100).toFixed(2)}</div>
    </div>
  `).join("");
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
  for (const table of TABLES) {
    const s = table.sessions.find(x => x.id === sessionId);
    if (s) return s;
  }
  return null;
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

// ============= TABLE MANAGEMENT RENDERING =============
function renderTableCategoriesList() {
  const listDiv = document.getElementById("table-categories-list");
  if (!listDiv) return;

  listDiv.innerHTML = "";

  if (!TABLE_CATEGORIES.length) {
    listDiv.innerHTML = "<p>No table categories yet</p>";
    return;
  }

  TABLE_CATEGORIES.forEach(cat => {
    const item = document.createElement("div");
    item.className = "list-item";
    item.innerHTML = `
      <div>
        <strong>${cat.key}</strong>
      </div>
      <div class="item-actions">
        <button onclick="editTableCategory(${cat.id}, '${cat.key}')" class="btn-secondary">✏️ Edit</button>
        <button onclick="deleteTableCategory(${cat.id})" class="btn-danger">🗑 Delete</button>
      </div>
    `;
    listDiv.appendChild(item);
  });
}

function renderTablesList() {
  const listDiv = document.getElementById("tables-list");
  if (!listDiv) return;

  listDiv.innerHTML = "";

  if (!TABLES.length) {
    listDiv.innerHTML = "<p>No tables yet</p>";
    return;
  }

  TABLES.forEach(table => {
    const category = TABLE_CATEGORIES.find(c => c.id === table.category_id);
    const item = document.createElement("div");
    item.className = "list-item";
    item.innerHTML = `
      <div>
        <strong>${table.name}</strong> - ${category?.key || "N/A"} (${table.seat_count} seats)
      </div>
      <div class="item-actions">
        <button onclick="renameTablePrompt(${table.id}, '${table.name}')" class="btn-secondary">✏️ Rename</button>
        <button onclick="changeTableSeatsPrompt(${table.id}, ${table.seat_count})" class="btn-secondary">🪑 Seats</button>
        <button onclick="deleteTable(${table.id})" class="btn-danger">🗑 Delete</button>
      </div>
    `;
    listDiv.appendChild(item);
  });
}

function editTableCategory(catId, currentName) {
  const newName = prompt("Enter new category name:", currentName);
  if (!newName?.trim()) return;

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

function updateTableCategorySelect() {
  const select = document.getElementById("new-table-category");
  if (!select) return;

  const currentValue = select.value;
  select.innerHTML = '<option value="">-- Select Category --</option>';

  TABLE_CATEGORIES.forEach(cat => {
    const option = document.createElement("option");
    option.value = cat.id;
    option.textContent = cat.key;
    select.appendChild(option);
  });

  if (currentValue) select.value = currentValue;
}



async function updateOrderItem(orderItemId, quantity) {
  const res = await fetch(`${API}/order-items/${orderItemId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ quantity })
  });

  if (!res.ok) {
    const err = await res.json();
    return alert(err.error || "Failed to update item");
  }

if (ACTIVE_SESSION_ID) {
  loadAndRenderOrders(ACTIVE_SESSION_ID);
}

}

async function removeOrderItem(orderItemId) {
  if (!confirm("Remove this item?")) return;

  const res = await fetch(`${API}/order-items/${orderItemId}`, {
    method: "DELETE"
  });

  if (!res.ok) {
    const err = await res.json();
    return alert(err.error || "Failed to delete item");
  }
if (ACTIVE_SESSION_ID) {
  loadAndRenderOrders(ACTIVE_SESSION_ID);
}

}


//FOOD MENU FUNCTIONS
async function loadMenuItems() {
  console.log("🔄 loadMenuItems() called");

  // Load categories
  const catRes = await fetch(`${API}/restaurants/${restaurantId}/menu_categories`);
  MENU_CATEGORIES = await catRes.json();
  console.log("📂 CATEGORIES:", MENU_CATEGORIES);

  // Load items
  const res = await fetch(`${API}/restaurants/${restaurantId}/menu/staff`);
  MENU_ITEMS = await res.json();
  console.log("🍽 MENU ITEMS:", MENU_ITEMS);

  const container = document.getElementById("menu-items");
  container.innerHTML = "";

  /* ================= LAYOUT CONTAINER ================= */
  const layoutContainer = document.createElement("div");
  layoutContainer.className = "menu-layout";

  /* ================= LEFT: CATEGORIES ================= */
  const categoriesDiv = document.createElement("div");
  categoriesDiv.className = "menu-categories";

  MENU_CATEGORIES.forEach(cat => {
    const catDiv = document.createElement("div");
    catDiv.className = `menu-category-item ${SELECTED_CATEGORY && SELECTED_CATEGORY.id === cat.id ? "active" : ""}`;
    catDiv.style.cursor = "pointer";

    catDiv.innerHTML = `
      <span class="category-name" onclick="selectMenuCategoryById(${cat.id})">${cat.name}</span>
      <div class="category-actions">
        <button class="btn-icon" onclick="event.stopPropagation(); editMenuCategoryName(${cat.id}, '${cat.name}')">✏️</button>
        <button class="btn-icon danger" onclick="deleteMenuCategories(${cat.id})">🗑</button>
      </div>
    `;

    categoriesDiv.appendChild(catDiv);
  });

  const addCatBtn = document.createElement("button");
  addCatBtn.className = "btn-primary menu-add-category";
  addCatBtn.textContent = "➕ Add Category";
  addCatBtn.onclick = addMenuCategory;
  categoriesDiv.appendChild(addCatBtn);

  layoutContainer.appendChild(categoriesDiv);

  /* ================= RIGHT: ITEMS ================= */
  const itemsDiv = document.createElement("div");
  itemsDiv.className = "menu-items-list";

  if (!SELECTED_CATEGORY) {
    itemsDiv.innerHTML = '<div class="empty-state">Select a category to view items</div>';
    layoutContainer.appendChild(itemsDiv);
    container.appendChild(layoutContainer);
    return;
  }

  const visibleItems = MENU_ITEMS.filter(
    i => Number(i.category_id) === Number(SELECTED_CATEGORY.id)
  );

MENU_ITEMS.forEach(i => {
  console.log(
    "🍽 Item:",
    i.name,
    "| category_id:",
    i.category_id,
    "| type:",
    typeof i.category_id
  );
});  
console.log("🧪 Visible items:", visibleItems);

  if (!visibleItems.length) {
    itemsDiv.innerHTML = '<div class="empty-state">No items in this category yet</div>';
  } else {
    visibleItems.forEach(item => {
      const div = document.createElement("div");
      const isAvailable = item.available !== false;
      
      div.className = `menu-item ${!isAvailable ? "unavailable" : ""} ${EDITING_ITEM_ID === item.id ? "editing" : ""}`;

      if (EDITING_ITEM_ID === item.id) {
        // EDITING MODE
        div.innerHTML = `
          <div class="menu-item-header">
            <input class="menu-item-title" value="${item.name}" onchange="updateMenuItem(${item.id}, { name: this.value })"/>
          </div>
          
          <div class="menu-item-body">
            <div class="edit-form">
              <div class="form-row">
                <div class="form-group">
                  <label>Category</label>
                  <select onchange="updateMenuItem(${item.id}, { category_id: Number(this.value) })">
                    ${MENU_CATEGORIES.map(c =>
                      `<option value="${c.id}" ${c.id === item.category_id ? "selected" : ""}>${c.name}</option>`
                    ).join("")}
                  </select>
                </div>
                <div class="form-group">
                  <label>Price</label>
                  <div class="input-with-suffix">
                    <input type="number" value="${item.price_cents}" onchange="updateMenuItem(${item.id}, { price_cents: Number(this.value) })"/>
                    <span>¢</span>
                  </div>
                </div>
              </div>

              <div class="form-group">
                <label>Description</label>
                <textarea onchange="updateMenuItem(${item.id}, { description: this.value })">${item.description || ""}</textarea>
              </div>

              <div class="form-group">
                <label>Image</label>
                <div class="image-upload" onclick="this.querySelector('input[type=file]').click()" style="cursor: pointer;">
                  ${item.image_url ? `<img src="${item.image_url}" class="preview-image"/>` : '<div class="no-image">📸 Click to upload</div>'}
                  <input type="file" accept="image/*" onchange="uploadItemImage(${item.id}, this.files[0])" class="hidden-file-input"/>
                </div>
              </div>
            </div>

            <div class="item-actions">
              <button onclick="endEditItem()" class="btn-primary">✓ Done</button>
              <button onclick="manageVariants(${item.id})" class="btn-secondary">🧩 Variants</button>
              <button onclick="deleteMenuItem(${item.id})" class="btn-secondary danger">🗑 Delete</button>
              ${adminOnly("Change item availability") ? `
                <button onclick="toggleMenuAvailability(${item.id}, ${!isAvailable})" class="btn-secondary">
                  ${isAvailable ? "🚫 Sold Out" : "✅ Available"}
                </button>
              ` : ""}
            </div>

            <div id="variants-${item.id}" class="variants-panel"></div>
          </div>
        `;
      } else {
        // VIEW MODE
        div.innerHTML = `
          <div class="menu-item-header">
            <div class="menu-item-title-view">
              <h4>${item.name}</h4>
              ${!isAvailable ? '<span class="badge-sold-out">Sold Out</span>' : ''}
            </div>
            <div class="menu-item-price">$${(item.price_cents / 100).toFixed(2)}</div>
          </div>
          
          <div class="menu-item-body">
            ${item.image_url ? `<img src="${item.image_url}" class="menu-item-image"/>` : ''}
            ${item.description ? `<p class="menu-item-desc">${item.description}</p>` : ''}

            <div class="item-actions">
              <button onclick="startEditItem(${item.id})" class="btn-primary">✏️ Edit</button>
              <button onclick="manageVariants(${item.id})" class="btn-secondary">🧩 Variants</button>
              ${adminOnly("Change item availability") ? `
                <button onclick="toggleMenuAvailability(${item.id}, ${!isAvailable})" class="btn-secondary ${isAvailable ? 'danger' : ''}">
                  ${isAvailable ? "🚫 Sold Out" : "✅ Available"}
                </button>
              ` : ""}
            </div>

            <div id="variants-${item.id}" class="variants-panel"></div>
          </div>
        `;
      }

      itemsDiv.appendChild(div);

      if (OPEN_VARIANTS_ITEM_ID === item.id) {
        fetchVariants(item.id).then(variants => {
          document.getElementById(`variants-${item.id}`).innerHTML =
            renderVariants(item.id, variants);
        });
      }
    });
  }

  layoutContainer.appendChild(itemsDiv);
  container.appendChild(layoutContainer);
}

function selectMenuCategoryById(categoryId) {
  SELECTED_CATEGORY = MENU_CATEGORIES.find(c => c.id === categoryId);
  loadMenuItems();
}

// CATEGORY FUNCTIONS
async function addMenuCategory() {
  const name = prompt("New category name:");
  if (!name) return;

  await fetch(`${API}/restaurants/${restaurantId}/menu_categories`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name })
  });
  loadMenuItems();
}

async function editMenuCategoryName(categoryId, oldName) {
  const name = prompt("Edit category name:", oldName);
  if (!name) return;

  await fetch(`${API}/menu-categories/${categoryId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name })
  });
  loadMenuItems();
}

async function deleteMenuCategories(categoryId) {
  if (!confirm("Delete this category? All items inside will also be deleted.")) return;

  await fetch(`${API}/menu-categories/${categoryId}`, { method: "DELETE" });
  loadMenuItems();
}

async function createMenuItem() {
  const name = document.getElementById("new-item-name").value.trim();
  const price = Number(document.getElementById("new-item-price").value);
  const categoryId = Number(document.getElementById("new-item-category").value);
  const description = document.getElementById("new-item-desc").value.trim();
  const imageFile = document.getElementById("new-item-image").files[0];

  if (!name || !price || !categoryId) {
    return alert("Name, price, and category are required");
  }

  const res = await fetch(
    `${API}/restaurants/${restaurantId}/menu-items`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        price_cents: price,
        category_id: categoryId,
        description
      })
    }
  );

  const newItem = await res.json();
  const newItemId = newItem.id;

  // Upload image if provided
  if (imageFile && newItemId) {
    await uploadItemImage(newItemId, imageFile);
  }

  // reset form
  document.getElementById("new-item-name").value = "";
  document.getElementById("new-item-price").value = "";
  document.getElementById("new-item-category").value = "";
  document.getElementById("new-item-desc").value = "";
  document.getElementById("new-item-image").value = "";
  document.getElementById("new-item-image-preview").innerHTML = '<div class="upload-placeholder">📸 Click to upload image</div>';

  loadMenuItems();
  endCreateItem();

}

function previewItemImage(input) {
  const file = input.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const previewBox = document.getElementById("new-item-image-preview");
    previewBox.innerHTML = `<img src="${e.target.result}" class="preview-image" style="max-width: 100%; border-radius: 8px;"/>`;
  };
  reader.readAsDataURL(file);
}

function cancelCreateItem() {
  endCreateItem();
  document.getElementById("new-item-name").value = "";
  document.getElementById("new-item-price").value = "";
  document.getElementById("new-item-category").value = "";
  document.getElementById("new-item-desc").value = "";
  document.getElementById("new-item-image").value = "";
  document.getElementById("new-item-image-preview").innerHTML = '<div class="upload-placeholder">📸 Click to upload image</div>';
}

//TO DO: availability toggle (future)
/*async function toggleItem(itemId, available) {
  await fetch(
    `${API}/menu-items/${itemId}/availability`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ available })
    }
  );
}
*/

async function getMenuCategories(){
  const res = await fetch(`${API}/restaurants/${restaurantId}/menu_categories`);
  const data = await res.json();

}

function startCreateItem() {
  CREATING_ITEM = true;
  document.getElementById("create-item-form").style.display = "block";
  
  // Populate category dropdown
  const categorySelect = document.getElementById("new-item-category");
  if (categorySelect) {
    categorySelect.innerHTML = '<option value="">-- Select a category --</option>';
    MENU_CATEGORIES.forEach(cat => {
      const option = document.createElement("option");
      option.value = cat.id;
      option.textContent = cat.name;
      categorySelect.appendChild(option);
    });
  }
  
  // Make preview box clickable
  const previewBox = document.getElementById("new-item-image-preview");
  if (previewBox) {
    previewBox.style.cursor = "pointer";
    previewBox.onclick = () => document.getElementById("new-item-image").click();
  }
}

function endCreateItem() {
  CREATING_ITEM = false;
  document.getElementById("create-item-form").style.display = "none";
}

async function updateMenuItem(itemId, changes) {
  await fetch(
    `${API}/menu-items/${itemId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(changes)
    }
  );
}

async function deleteMenuItem(itemId) {
  if (!confirm("Delete this menu item permanently?")) return;

  const res = await fetch(
    `${API}/menu-items/${itemId}`,
    { method: "DELETE" }
  );

  if (!res.ok) {
    const err = await res.json();
    return alert(err.error || "Cannot delete item");
  }

  loadMenuItems();
}

async function toggleMenuAvailability(itemId, available) {
  if (!adminOnly("Change item availability")) return;

  await fetch(`${API}/menu-items/${itemId}/availability`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ available })
  });

  loadMenuItems();
}


function manageVariants(itemId) {
  if (!itemId) return; // SAFETY GUARD

  OPEN_VARIANTS_ITEM_ID =
    OPEN_VARIANTS_ITEM_ID === itemId ? null : itemId;

  EDITING_VARIANT_ID = null;
  loadMenuItems();
}

async function fetchVariants(itemId) {
  const res = await fetch(`${API}/menu-items/${itemId}/variants`);
  const data = await res.json();
  CURRENT_VARIANTS = data;
  return data;
}

function renderVariants(itemId, variants) {
  if (OPEN_VARIANTS_ITEM_ID !== itemId) return "";

  return `
    <div class="variant-form">
      ${variants.map(v => `
        <div class="variant-group">
          <div class="variant-header">
            <div>
              <div class="variant-name">${v.name}</div>
              <div class="variant-meta">${v.required ? "Required" : "Optional"} ${(v.min_select || v.max_select) ? `• min ${v.min_select ?? 0}, max ${v.max_select ?? "∞"}` : ""}</div>
            </div>
            <div style="display: flex; gap: 6px;">
              ${EDITING_VARIANT_ID === v.id ? `
                <button onclick="EDITING_VARIANT_ID=null; loadMenuItems()" class="btn-primary" style="padding: 6px 10px; font-size: 12px;">✓ Done</button>
              ` : `
                <button onclick="EDITING_VARIANT_ID=${v.id}; loadMenuItems()" class="btn-secondary" style="padding: 6px 10px; font-size: 12px;">✏️</button>
              `}
              <button onclick="deleteVariant(${v.id}, ${itemId})" class="btn-secondary danger" style="padding: 6px 10px; font-size: 12px;">🗑</button>
            </div>
          </div>

          ${EDITING_VARIANT_ID === v.id ? `
            <div style="display: flex; gap: 8px; margin-bottom: 10px; flex-wrap: wrap;">
              <input value="${v.name}" onchange="updateVariant(${v.id}, { name: this.value })" placeholder="Variant name" style="flex: 1; min-width: 150px; padding: 8px 10px !important;"/>
              <label style="display: flex; align-items: center; gap: 6px; font-size: 13px;">
                <input type="checkbox" ${v.required ? "checked" : ""} onchange="updateVariant(${v.id}, { required: this.checked, min_select: this.checked ? (${v.min_select ?? 1}) : 0 })"/>
                Required
              </label>
              <input type="number" value="${v.min_select ?? ""}" placeholder="Min" onchange="updateVariant(${v.id}, { min_select: this.value === '' ? null : Number(this.value) })" style="width: 70px; padding: 8px 10px !important;"/>
              <input type="number" value="${v.max_select ?? ""}" placeholder="Max" onchange="updateVariant(${v.id}, { max_select: this.value === '' ? null : Number(this.value) })" style="width: 70px; padding: 8px 10px !important;"/>
            </div>
          ` : ""}

          <div class="variant-options">
            ${v.options.map(o => `
              <div class="variant-option${EDITING_VARIANT_ID === v.id ? " variant-option-edit" : ""}">
                ${EDITING_VARIANT_ID === v.id ? `
                  <input value="${o.name}" onchange="updateVariantOption(${o.id}, { name: this.value })" placeholder="Option name" style="flex: 1;"/>
                  <input type="number" value="${o.price_cents ?? 0}" onchange="updateVariantOption(${o.id}, { price_cents: Number(this.value) })" placeholder="¢" style="width: 70px;"/>
                  <button onclick="deleteVariantOption(${o.id})" class="btn-secondary danger" style="padding: 6px 8px; font-size: 12px;">🗑</button>
                ` : `
                  <span>• ${o.name}${o.price_cents ? ` (+${o.price_cents}¢)` : ""}</span>
                `}
              </div>
            `).join("")}
          </div>

          ${EDITING_VARIANT_ID === v.id ? `
            <div style="display: flex; gap: 6px; margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border-color);">
              <input id="new-option-name-${v.id}" placeholder="Add option" style="flex: 1; min-width: 150px; padding: 8px 10px !important;"/>
              <input id="new-option-price-${v.id}" type="number" placeholder="¢" style="width: 70px; padding: 8px 10px !important;"/>
              <button onclick="addVariantOption(${v.id})" class="btn-primary" style="padding: 8px 12px; font-size: 13px;">➕ Add</button>
            </div>
          ` : ""}
        </div>
      `).join("")}

      <div style="padding: 12px 0; border-top: 1px solid var(--border-color); margin-top: 10px;">
        <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: flex-start;">
          <input id="new-variant-name-${itemId}" placeholder="Variant name (e.g., Toppings, Size)" style="flex: 1; min-width: 150px; padding: 8px 10px !important;"/>
          <label style="display: flex; align-items: center; gap: 6px; font-size: 13px; white-space: nowrap;">
            <input type="checkbox" id="new-variant-required-${itemId}"/>
            Required
          </label>
          <input id="new-variant-min-${itemId}" type="number" min="0" placeholder="Min" style="width: 70px; padding: 8px 10px !important;"/>
          <input id="new-variant-max-${itemId}" type="number" min="0" placeholder="Max" style="width: 70px; padding: 8px 10px !important;"/>
          <button onclick="addVariantGroup(${itemId})" class="btn-primary" style="padding: 8px 12px; font-size: 13px;">➕ Add Variant</button>
        </div>
      </div>
    </div>
  `;
}

async function addVariantGroup(itemId) {
  const name = document
    .getElementById(`new-variant-name-${itemId}`)
    .value.trim();

  const required = document
    .getElementById(`new-variant-required-${itemId}`)
    .checked;

  const minSelectRaw =
    document.getElementById(`new-variant-min-${itemId}`).value;
  const maxSelectRaw =
    document.getElementById(`new-variant-max-${itemId}`).value;

  const min_select =
    minSelectRaw === "" ? null : Number(minSelectRaw);
  const max_select =
    maxSelectRaw === "" ? null : Number(maxSelectRaw);

  if (!required && min_select > 0) {
    return alert("Min must be 0 if variant is not required");
  }

  if (min_select !== null && max_select !== null && min_select > max_select) {
    return alert("Min cannot be greater than Max");
  }

  if (!name) return alert("Variant name required");

  await fetch(`${API}/menu-items/${itemId}/variants`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      required,
      min_select,
      max_select
    })
  });

  loadMenuItems();
}

async function addVariantOption(variantId) {
  const nameInput =
    document.getElementById(`new-option-name-${variantId}`);
  const priceInput =
    document.getElementById(`new-option-price-${variantId}`);

  const name = nameInput.value.trim();
  const price = Number(priceInput.value) || 0;

  if (!name) return alert("Option name required");

  const res = await fetch(`${API}/variants/${variantId}/options`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      price_cents: price
    })
  });

  if (!res.ok) {
    const err = await res.json();
    alert(err.error || "Failed to add option");
    return;
  }

  nameInput.value = "";
  priceInput.value = "";

  manageVariants(OPEN_VARIANTS_ITEM_ID);

}

function sanitizeVariantChanges(existing, changes) {
  const merged = { ...existing, ...changes };

  // Rule 1: not required → min = 0
  if (!merged.required) {
    merged.min_select = 0;
  }

  // Rule 2: min <= max
  if (
    merged.min_select !== null &&
    merged.max_select !== null &&
    merged.min_select > merged.max_select
  ) {
    merged.max_select = merged.min_select;
  }

  return merged;
}

async function updateVariant(variantId, changes) {
  const variant = CURRENT_VARIANTS.find(v => v.id === variantId);
  if (!variant) return;

  const clean = sanitizeVariantChanges(variant, changes);

  const res = await fetch(`${API}/variants/${variantId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(clean)
  });

  if (!res.ok) {
    const err = await res.json();
    alert(err.error || "Variant update failed");
  }

  loadMenuItems();
}

async function deleteVariant(variantId, itemId) {
  if (!confirm("Delete this variant?")) return;

  await fetch(
    `${API}/variants/${variantId}`,
    { method: "DELETE" }
  );

  manageVariants(itemId);
}

function startEditItem(itemId) {
  EDITING_ITEM_ID = itemId;
  loadMenuItems();
}

function endEditItem() {
  EDITING_ITEM_ID = null;
  loadMenuItems();
}

async function uploadItemImage(itemId, file) {
  if (!file) return;

  const form = new FormData();
  form.append("image", file);

  await fetch(
    `${API}/menu-items/${itemId}/image`,
    {
      method: "POST",
      body: form
    }
  );

  loadMenuItems();
}

async function updateVariantOption(optionId, changes) {
  await fetch(`${API}/variant-options/${optionId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(changes)
  });
}

async function deleteVariantOption(optionId) {
  if (!confirm("Delete this option?")) return;

  await fetch(`${API}/variant-options/${optionId}`, {
    method: "DELETE"
  });

  loadMenuItems();
}


// ============= PIN LOGIN ============= //

let enteredPin = "";
const PIN_LENGTH = 6;

function pressKey(num) {
  if (enteredPin.length >= PIN_LENGTH) return;
  enteredPin += num;
  updateDots();
}

function clearPin() {
  enteredPin = enteredPin.slice(0, -1);
  updateDots();
}

function updateDots() {
  document.querySelectorAll("#pin-dots span").forEach((dot, i) => {
    dot.classList.toggle("filled", i < enteredPin.length);
  });
}

async function submitPin() {
  if (enteredPin.length !== PIN_LENGTH) {
    alert("Enter 6-digit PIN");
    return;
  }

  // Try to login with PIN
  const res = await fetch(`${API}/auth/staff-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pin: enteredPin, restaurantId })
  });

  const data = await res.json();
  
  if (res.ok) {
    localStorage.setItem("token", data.token);
    // Show app, hide login
    document.getElementById("login-screen").style.display = "none";
    document.getElementById("app-container").style.display = "flex";
    initializeApp();
  } else {
    alert(data.error || "Invalid PIN");
    enteredPin = "";
    updateDots();
  }
}

// ============= COUPONS MANAGEMENT =============
async function loadCoupons() {
  try {
    const res = await fetch(`${API}/restaurants/${restaurantId}/coupons`);
    if (!res.ok) throw new Error("Failed to load coupons");
    const coupons = await res.json();
    renderCouponsList(coupons);
  } catch (error) {
    console.error("Error loading coupons:", error);
  }
}

function renderCouponsList(coupons) {
  const container = document.getElementById("coupons-list");
  if (!coupons.length) {
    container.innerHTML = "<p>No coupons yet</p>";
    return;
  }

  let html = "<h3>Active Coupons</h3>";
  html += '<div class="coupons-grid">';

  coupons.forEach(coupon => {
    const isExpired = coupon.valid_until && new Date(coupon.valid_until) < new Date();
    const isFull = coupon.max_uses && coupon.current_uses >= coupon.max_uses;
    const status = !coupon.is_active ? "Inactive" : isExpired ? "Expired" : isFull ? "Full" : "Active";
    const statusClass = status.toLowerCase();

    html += `
      <div class="coupon-card">
        <div class="coupon-header">
          <div>
            <h4>${coupon.code}</h4>
            <p class="coupon-status ${statusClass}">${status}</p>
          </div>
          <div class="coupon-discount">
            ${coupon.discount_type === "percentage" ? `${coupon.discount_value}%` : `$${parseFloat(coupon.discount_value).toFixed(2)}`}
          </div>
        </div>
        <div class="coupon-details">
          <p>${coupon.description || "No description"}</p>
          <p class="coupon-usage">Uses: ${coupon.current_uses}${coupon.max_uses ? ` / ${coupon.max_uses}` : " (unlimited)"}</p>
          ${coupon.valid_until ? `<p class="coupon-date">Expires: ${new Date(coupon.valid_until).toLocaleDateString()}</p>` : ""}
        </div>
        <div class="coupon-actions">
          <button onclick="editCoupon(${coupon.id})" class="btn-secondary">✏️ Edit</button>
          <button onclick="deleteCoupon(${coupon.id})" class="btn-secondary danger">🗑 Delete</button>
        </div>
      </div>
    `;
  });

  html += "</div>";
  container.innerHTML = html;
}

async function createCoupon() {
  const code = document.getElementById("new-coupon-code").value.trim().toUpperCase();
  const type = document.getElementById("new-coupon-type").value;
  const value = parseFloat(document.getElementById("new-coupon-value").value);
  const minOrder = parseFloat(document.getElementById("new-coupon-min-order").value) || 0;
  const maxUses = document.getElementById("new-coupon-max-uses").value ? parseInt(document.getElementById("new-coupon-max-uses").value) : null;
  const validUntil = document.getElementById("new-coupon-valid-until").value;
  const description = document.getElementById("new-coupon-description").value.trim();

  const errorEl = document.getElementById("coupon-error");
  const successEl = document.getElementById("coupon-success");
  errorEl.style.display = "none";
  successEl.style.display = "none";

  if (!code || !type || !value) {
    errorEl.textContent = "Please fill in all required fields";
    errorEl.style.display = "block";
    return;
  }

  if (value <= 0) {
    errorEl.textContent = "Discount value must be greater than 0";
    errorEl.style.display = "block";
    return;
  }

  try {
    const res = await fetch(`${API}/restaurants/${restaurantId}/coupons`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        discount_type: type,
        discount_value: value,
        description: description || null,
        max_uses: maxUses,
        valid_until: validUntil || null,
        minimum_order_value: minOrder
      })
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error);
    }

    successEl.textContent = `Coupon "${code}" created successfully!`;
    successEl.style.display = "block";

    // Clear form
    document.getElementById("new-coupon-code").value = "";
    document.getElementById("new-coupon-type").value = "percentage";
    document.getElementById("new-coupon-value").value = "";
    document.getElementById("new-coupon-min-order").value = "0";
    document.getElementById("new-coupon-max-uses").value = "";
    document.getElementById("new-coupon-valid-until").value = "";
    document.getElementById("new-coupon-description").value = "";

    loadCoupons();
  } catch (error) {
    errorEl.textContent = error.message || "Failed to create coupon";
    errorEl.style.display = "block";
  }
}

async function deleteCoupon(couponId) {
  if (!confirm("Are you sure you want to delete this coupon?")) return;

  try {
    const res = await fetch(`${API}/coupons/${couponId}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to delete coupon");
    loadCoupons();
  } catch (error) {
    alert("Error: " + error.message);
  }
}

function editCoupon(couponId) {
  alert("Edit functionality coming soon");
}

// ============= MANUAL DISCOUNT (ADMIN ONLY) =============
async function applyManualDiscount(sessionId) {
  const discountInput = document.getElementById(`discount-amount-${sessionId}`);
  if (!discountInput) return;
  
  const discountAmount = parseFloat(discountInput.value) || 0;
  if (discountAmount < 0) {
    alert("Discount must be 0 or greater");
    return;
  }

  // Store discount in session display
  const displayEl = document.getElementById(`discount-display-${sessionId}`);
  if (displayEl) {
    if (discountAmount > 0) {
      displayEl.textContent = `✓ Discount of $${discountAmount.toFixed(2)} applied`;
    } else {
      displayEl.textContent = "";
    }
  }

  // Update session total display (fetch updated bill)
  await loadAndRenderOrders(sessionId);
}

async function clearManualDiscount(sessionId) {
  const discountInput = document.getElementById(`discount-amount-${sessionId}`);
  if (discountInput) {
    discountInput.value = "";
  }
  
  const displayEl = document.getElementById(`discount-display-${sessionId}`);
  if (displayEl) {
    displayEl.textContent = "";
  }

  await loadAndRenderOrders(sessionId);
}

(async function init() {
  // Handle superadmin restaurant selector
  if (IS_SUPERADMIN) {
    await initializeSuperadmin();
    document.getElementById("restaurant-selector").style.display = "flex";
  }

  // Only load if admin (staff waits for PIN login)
  if (IS_ADMIN || IS_SUPERADMIN) {
    document.getElementById("login-screen").style.display = "none";
    document.getElementById("app-container").style.display = "flex";
    initializeApp();
    loadCoupons(); // Load coupons on init
  }
})();

// ============= SUPERADMIN RESTAURANT SWITCHING =============
async function initializeSuperadmin() {
  try {
    const response = await fetch(`${API}/auth/restaurants`);
    const restaurants = await response.json();
    superadminRestaurants = restaurants;

    // Display restaurant name in button
    const currentRestaurant = restaurants.find(r => r.id === parseInt(restaurantId));
    const restaurantNameBtn = document.getElementById("restaurant-name-btn");
    if (currentRestaurant) {
      restaurantNameBtn.textContent = `🏢 ${currentRestaurant.name}`;
    }

    // Populate restaurant list dropdown
    const restaurantListDiv = document.getElementById("restaurant-list");
    restaurantListDiv.innerHTML = restaurants.map(r => 
      `<button class="restaurant-item ${r.id === parseInt(restaurantId) ? 'active' : ''}" 
               onclick="switchRestaurant(${r.id}, '${r.name}')">${r.name} (ID: ${r.id})</button>`
    ).join("");
  } catch (err) {
    console.error("Error loading restaurants:", err);
  }
}

function toggleRestaurantList() {
  const restaurantList = document.getElementById("restaurant-list");
  const isVisible = restaurantList.style.display !== "none";
  restaurantList.style.display = isVisible ? "none" : "block";
}

async function switchRestaurant(newRestaurantId, restaurantName) {
  restaurantId = newRestaurantId;
  localStorage.setItem("restaurantId", restaurantId);

  // Update button text
  const restaurantNameBtn = document.getElementById("restaurant-name-btn");
  restaurantNameBtn.textContent = `🏢 ${restaurantName}`;

  // Close dropdown
  document.getElementById("restaurant-list").style.display = "none";

  // Update active state in dropdown
  document.querySelectorAll(".restaurant-item").forEach(item => {
    item.classList.remove("active");
  });
  event.target.classList.add("active");

  // Reload app data for new restaurant
  MENU_CATEGORIES = [];
  MENU_ITEMS = [];
  TABLE_CATEGORIES = [];
  TABLES = [];
  MENU_ITEM_VARIANTS = [];
  CURRENT_VARIANTS = [];

  // Reload the app
  loadApp();
  switchSection("tables");
}

