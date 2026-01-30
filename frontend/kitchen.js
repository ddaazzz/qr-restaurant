const API_BASE = 
  window.location.hostname === "localhost"
    ? "http://localhost:10000/api"
    : "https://chuio.io/api";

let pin = "";
let token = null;
let restaurantId = null;

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
    // restaurantId should already be in sessionStorage from login.js
    restaurantId = sessionStorage.getItem("restaurantId");

    if (!restaurantId) {
      errorEl.textContent = "Restaurant ID not found. Please login again.";
      errorEl.style.display = "block";
      return;
    }

    const res = await fetch(`${API_BASE}/auth/staff-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin, restaurantId })
    });

    const data = await res.json();

    if (!res.ok || !data.token) {
      errorEl.textContent = data.error || "Invalid PIN";
      errorEl.style.display = "block";
      pin = "";
      updatePinDisplay();
      return;
    }

    // Check if user is kitchen staff
    if (data.role !== "kitchen") {
      errorEl.textContent = "Access denied. Kitchen staff only.";
      errorEl.style.display = "block";
      pin = "";
      updatePinDisplay();
      return;
    }

    token = data.token;
    sessionStorage.setItem("kitchenToken", token);
    sessionStorage.setItem("kitchenStaffLogged", "true");

    // Show kitchen dashboard
    document.getElementById("login-screen").style.display = "none";
    document.getElementById("kitchen-app").classList.add("active");

    // Start loading orders
    loadKitchenOrders();
    setInterval(loadKitchenOrders, 5000);
  } catch (err) {
    console.error(err);
    errorEl.textContent = "Connection error";
    errorEl.style.display = "block";
  }
}

// ============== KITCHEN DASHBOARD ============== 
async function loadKitchenOrders() {
  console.log("🔄 loadKitchenOrders() called - restaurantId:", restaurantId);
  if (!restaurantId) {
    console.log("❌ restaurantId not set, returning early");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/kitchen/items`);
    console.log("📡 API Response status:", res.status);
    if (!res.ok) {
      console.log("❌ API returned error:", res.status);
      return;
    }

    const items = await res.json();
    console.log("📦 Raw items from API:", items);

    // Filter items for this restaurant and group by order
    const orderMap = {};

    items.forEach(item => {
      console.log("📌 Processing item - restaurant_id:", item.restaurant_id, "restaurantId filter:", restaurantId, "match:", item.restaurant_id == restaurantId);
      if (item.restaurant_id != restaurantId) return;

      const orderId = item.order_id;
      if (!orderMap[orderId]) {
        orderMap[orderId] = {
          orderId,
          table: item.table_name,
          items: [],
          createdAt: item.created_at
        };
      }
      orderMap[orderId].items.push(item);
    });

    console.log("✅ Grouped orders:", Object.values(orderMap));
    renderKitchenOrders(Object.values(orderMap));
  } catch (err) {
    console.error("❌ Failed to load kitchen items:", err);
  }
}

function renderKitchenOrders(orders) {
  const container = document.getElementById("orders-container");

  if (!orders.length) {
    container.innerHTML = '<p class="no-orders">✓ All orders completed!</p>';
    return;
  }

  container.innerHTML = orders.map(order => {
    const hasAllServed = order.items.every(item => item.status === "served");
    const statusClass = hasAllServed ? "ready" : (order.items.some(item => item.status === "preparing") ? "preparing" : "pending");

    return `
      <div class="order-card ${statusClass}">
        <div class="card-header">
          <div>
            <div class="card-title">Table ${order.table}</div>
            <div class="card-time">#${order.orderId}</div>
          </div>
          <div class="card-time">${getTimeAgo(order.createdAt)}</div>
        </div>
        <div class="card-body">
          ${order.items.map(item => `
            <div class="order-item">
              <div class="item-header">
                <span class="item-name">${item.item_name}</span>
                <span class="item-qty">×${item.quantity}</span>
              </div>
              ${item.variants ? `<div class="item-variants">${item.variants}</div>` : ""}
              <span class="item-status ${item.status}">${item.status.charAt(0).toUpperCase() + item.status.slice(1)}</span>
            </div>
          `).join("")}
          
          <div class="card-actions">
            ${order.items.map(item => {
              if (item.status === "pending") {
                return `<button class="btn-action btn-start" onclick="updateItemStatus(${item.order_item_id}, 'preparing')">Start Preparing</button>`;
              } else if (item.status === "preparing") {
                return `<button class="btn-action btn-serve" onclick="updateItemStatus(${item.order_item_id}, 'served')">Serve</button>`;
              } else {
                return `<button class="btn-action btn-ready" disabled>Served</button>`;
              }
            }).join("")}
          </div>
        </div>
      </div>
    `;
  }).join("");
}

async function updateItemStatus(orderItemId, status) {
  try {
    const res = await fetch(`${API_BASE}/order-items/${orderItemId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    });

    if (res.ok) {
      loadKitchenOrders();
    }
  } catch (err) {
    console.error("Failed to update item status:", err);
  }
}

function getTimeAgo(timestamp) {
  const now = new Date();
  const then = new Date(timestamp);
  const diff = Math.floor((now - then) / 1000);

  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function handleLogout() {
  sessionStorage.removeItem("kitchenToken");
  sessionStorage.removeItem("kitchenStaffLogged");
  sessionStorage.removeItem("restaurantId");
  pin = "";
  token = null;
  restaurantId = null;
  updatePinDisplay();
  document.getElementById("login-screen").style.display = "flex";
  document.getElementById("kitchen-app").classList.remove("active");
}

// ============== INIT ============== 
window.addEventListener("DOMContentLoaded", () => {
  // Check if user came from login.html with email/password
  const emailLoginFlag = sessionStorage.getItem("kitchenStaffLogged");
  restaurantId = sessionStorage.getItem("restaurantId");

  console.log("Kitchen.html DOMContentLoaded - emailLoginFlag:", emailLoginFlag, "restaurantId:", restaurantId);

  if (emailLoginFlag && restaurantId) {
    // User logged in via email/password, bypass PIN and go directly to dashboard
    console.log("User authenticated via email/password, showing dashboard");
    token = "email-auth"; // Mark as authenticated via email
    document.getElementById("login-screen").style.display = "none";
    document.getElementById("kitchen-app").classList.add("active");
    loadKitchenOrders();
    setInterval(loadKitchenOrders, 5000);
    return;
  }

  // Check if already logged in via PIN
  const savedToken = sessionStorage.getItem("kitchenToken");
  console.log("Checking PIN login - savedToken:", savedToken);
  
  if (savedToken && restaurantId) {
    console.log("User authenticated via PIN, showing dashboard");
    token = savedToken;
    document.getElementById("login-screen").style.display = "none";
    document.getElementById("kitchen-app").classList.add("active");
    loadKitchenOrders();
    setInterval(loadKitchenOrders, 5000);
  } else {
    // Not logged in, show login screen
    document.getElementById("login-screen").style.display = "flex";
  }
});
