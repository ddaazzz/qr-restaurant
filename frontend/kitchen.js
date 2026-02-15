const API_BASE = (() => {
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
let allowedCategoryIds = []; // Categories this kitchen staff can view

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
    const res = await fetch(`${API_BASE}/auth/staff-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin, restaurantId, role: "kitchen" })
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
    localStorage.setItem("token", token);
    localStorage.setItem("role", "kitchen");
    localStorage.setItem("restaurantId", restaurantId);

    // Extract allowed categories from access_rights if they exist
    if (data.access_rights && data.access_rights.allowed_categories) {
      allowedCategoryIds = data.access_rights.allowed_categories.map(id => parseInt(id, 10));
    }

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
  if (!restaurantId) {
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/kitchen/items`);
    if (!res.ok) {
      return;
    }

    const items = await res.json();


    items.forEach(item => {
      if (item.restaurant_id != restaurantId) return;

      // Filter by allowed categories if restrictions exist
      if (allowedCategoryIds.length > 0 && item.category_id) {
        if (!allowedCategoryIds.includes(parseInt(item.category_id, 10))) {
          return;
        }
      }

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
  const sessionId = localStorage.getItem("sessionId");
  
  // Log the logout if we have a sessionId
  if (sessionId) {
    fetch(`${window.location.origin}/api/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId })
    }).catch(err => console.error("Error logging logout:", err));
  }
  
  sessionStorage.removeItem("kitchenToken");
  sessionStorage.removeItem("kitchenStaffLogged");
  sessionStorage.removeItem("restaurantId");
  localStorage.removeItem("sessionId");
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
  
  if (savedToken && restaurantId) {
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
