
const API =
  window.location.hostname === "localhost"
    ? "http://localhost:10000/api"
    : "https://chuio.io/api";
const restaurantId = 1;

let MENU_CACHE = [];
let EDITING_ORDER_ID = null;
let EDIT_BUFFER = {};
const ORDER_ITEM_CACHE = {};
const qrURL = window.location.hostname === "localhost"
    ? "http://localhost:10000/"
    : "https://chuio.io/"`${table.qr_token}`;
const canvasId = `qr-${table.id}`

// 🔐 Auth guard
(() => {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");

  if (!token || role !== "staff") {
    alert("Access denied");
    window.location.href = "/login";
  }
})();

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
