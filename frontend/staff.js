
const API = (() => {
  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    return "http://localhost:10000/api";
  } else if (window.location.hostname.startsWith("192.") || window.location.hostname.startsWith("10.") || window.location.hostname.startsWith("172.")) {
    // Local network IP (iPad, phone, etc.)
    return `http://${window.location.hostname}:10000/api`;
  } else {
    return "https://chuio.io/api";
  }
})();

let pin = "";
let token = null;
let restaurantId = null;

// Get restaurantId from URL on page load
(() => {
  const params = new URLSearchParams(window.location.search);
  restaurantId = params.get("restaurantId");
  
  if (!restaurantId) {
    alert("No restaurant selected. Please login from admin panel.");
    window.location.href = "/login";
    return;
  }
})();

// ============== PIN LOGIN ============== 
function pressKey(num) {
  if (pin.length < 6) {
    pin += num;
    updatePinDisplay();
  }
}

function clearPin() {
  pin = "";
  updatePinDisplay();
}

function updatePinDisplay() {
  const dots = document.querySelectorAll("#pin-dots span");
  dots.forEach((dot, idx) => {
    dot.classList.toggle("filled", idx < pin.length);
  });
}

async function submitPin() {
  if (pin.length !== 6) return;

  const errorEl = document.getElementById("error-message");
  errorEl.style.display = "none";

  try {
    const res = await fetch(`${API}/auth/staff-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin, restaurantId, role: "staff" })
    });

    const data = await res.json();

    if (!res.ok || !data.token) {
      errorEl.textContent = data.error || "Invalid PIN";
      errorEl.style.display = "block";
      pin = "";
      updatePinDisplay();
      return;
    }

    // Check if user is table staff
    if (data.role !== "staff") {
      errorEl.textContent = "Access denied. Table staff only.";
      errorEl.style.display = "block";
      pin = "";
      updatePinDisplay();
      return;
    }

    token = data.token;
    localStorage.setItem("token", token);
    localStorage.setItem("role", "staff");
    localStorage.setItem("restaurantId", restaurantId);

    // Show staff dashboard
    document.getElementById("login-screen").style.display = "none";
    document.getElementById("staff-app").style.display = "block";

    // Start loading tables
    loadTables();
  } catch (err) {
    console.error(err);
    errorEl.textContent = "Connection error";
    errorEl.style.display = "block";
  }
}

/* ------------------------
   Utilities
------------------------ */
function deriveOrderStatus(items) {
  if (items.some(i => i.status === "preparing")) return "preparing";
  if (items.some(i => i.status === "pending")) return "pending";
  return "served";
}

function isEditing(orderId) {
  return EDITING_ORDER_ID === Number(orderId);
}

/* ------------------------
   Load Tables + Sessions
------------------------ */
async function loadTables() {
  const [tablesRes, sessionsRes] = await Promise.all([
    fetch(`${API}/restaurants/${restaurantId}/table-units`),
    fetch(`${API}/restaurants/${restaurantId}/active-sessions-with-orders`)
  ]);

  const tables = await tablesRes.json();
  const rows = await sessionsRes.json();

  const sessionsByUnit = {};
  rows.forEach(r => {
    if (!sessionsByUnit[r.table_unit_id]) {
      sessionsByUnit[r.table_unit_id] = {
        session_id: r.session_id,
        orders: {}
      };
    }

    if (r.order_id) {
      const orders = sessionsByUnit[r.table_unit_id].orders;
      if (!orders[r.order_id]) {
        orders[r.order_id] = { items: [], total: 0 };
      }

      orders[r.order_id].items.push(r);
      orders[r.order_id].total += r.price_cents * r.quantity;
    }
  });

  const container = document.getElementById("tables-list");
  container.innerHTML = "";

  tables.forEach(table => {
    const session = sessionsByUnit[table.id];
    const qrUrl = `${API}/${table.qr_token}`;
    const div = document.createElement("div");
    div.className = "table-card";

    const statusClass = session ? "open" : "closed";
    const statusText = session ? "ACTIVE" : "INACTIVE";

    div.innerHTML = `
      <div class="table-title">${table.unit_name}</div>
      <div class="table-sub">${table.name}</div>

      <div class="status ${statusClass}">
        Status: ${statusText}
      </div>

      ${
        session
          ? `<button class="danger" onclick="endSession(${session.session_id})">
              End Session
            </button>`
          : `<button onclick="startSession(${table.id})">
              Start Session
            </button>`
      }

      <button class="secondary"
        onclick="orderForTable('${table.qr_token}')">
        ➕ Order for Table
      </button>
    `;

    container.appendChild(div);
  });
}

/* ------------------------
   Menu
------------------------ */
async function loadMenu() {
  const res = await fetch(`${API}/restaurants/${restaurantId}/menu/staff`);
  MENU_CACHE = await res.json();

  const container = document.getElementById("menu-list");
  container.innerHTML = "";

  MENU_CACHE.forEach(item => {
    container.innerHTML += `
      <div>
        <strong>${item.name}</strong>
        $${(item.price_cents / 100).toFixed(2)}
        <button onclick="toggleAvailability(${item.id}, ${!item.available})">
          ${item.available ? "Sold Out" : "Available"}
        </button>
      </div>
    `;
  });
}

/* ------------------------
   Actions
------------------------ */
async function startSession(tableUnitId) {
  await fetch(`${API}/table-units/${tableUnitId}/sessions`, { method: "POST" });
  loadTables();
}

async function endSession(sessionId) {
  await fetch(`${API}/sessions/${sessionId}/end`, { method: "POST" });
  loadTables();
}

function orderForTable(qrToken) {
  window.open(`${location.origin}/${qrToken}?staff=1`, "_blank");
}

async function toggleAvailability(itemId, available) {
  await fetch(`${API}/menu-items/${itemId}/availability`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ available })
  });
  loadMenu();
}

/* ------------------------
   Init
------------------------ */
loadMenu();
loadTables();

setInterval(() => {
  if (EDITING_ORDER_ID === null) loadTables();
}, 5000);
