const API_BASE = (() => {
  const hostname = window.location.hostname;
  const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
  
  if (isLocalhost) {
    return `http://${window.location.host}/api`;
  }
  // For local IPs and remote: use the same protocol as the page (avoids http→https mismatch)
  return `${window.location.protocol}//${window.location.host}/api`;
})();

let pin = "";
let token = null;
let restaurantId = null;
let allowedCategoryIds = []; // Categories this kitchen staff can view
let orderMap = {}; // Maps orderId to order details

// Get restaurantId from URL on page load, fallback to sessionStorage/localStorage
(() => {
  const params = new URLSearchParams(window.location.search);
  // Check both 'rid' (from admin-settings.js) and 'restaurantId' for compatibility
  restaurantId = params.get("rid") || params.get("restaurantId") || sessionStorage.getItem("restaurantId") || localStorage.getItem("restaurantId");
  
  console.log("🍳 Kitchen initialized with restaurantId:", restaurantId, "type:", typeof restaurantId);
  
  if (!restaurantId) {
    console.warn("⚠️ No restaurantId found in URL params or storage");
    // Don't redirect yet - they might be coming from login.html
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
    const res = await fetch(`${API_BASE}/auth/kitchen-login`, {
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
    localStorage.setItem("token", token);
    localStorage.setItem("role", "kitchen");
    localStorage.setItem("restaurantId", restaurantId);

    // Store kitchen user ID for clock in/out
    window.kitchenUserId = data.user_id || null;
    window.kitchenCurrentlyClockedIn = data.currently_clocked_in || false;

    // Extract allowed categories from access_rights if they exist
    if (data.access_rights && data.access_rights.allowed_categories) {
      allowedCategoryIds = data.access_rights.allowed_categories.map(id => parseInt(id, 10));
    }

    // Show kitchen dashboard
    document.getElementById("login-screen").style.display = "none";
    document.getElementById("kitchen-app").classList.add("active");

    // Update clock button state and show prompt if needed
    updateKitchenClockBtn(window.kitchenCurrentlyClockedIn);
    if (!window.kitchenCurrentlyClockedIn) {
      showKitchenClockInPrompt();
    }

    // Start loading orders (polling)
    loadKitchenOrders();
    setInterval(loadKitchenOrders, 5000);

    // Initialize kitchen printer Bluetooth session (same structure as QR/Bill)
    try {
      console.log('[Kitchen] Initializing kitchen printer Bluetooth session...');
      const kitchenPrinterData = await fetch(`${API_BASE}/restaurants/${restaurantId}/printer-settings`);
      if (kitchenPrinterData.ok) {
        const printers = await kitchenPrinterData.json();
        const kitchenPrinter = printers.find(p => p.type === 'Kitchen');
        
        if (kitchenPrinter && kitchenPrinter.bluetooth_device_name) {
          console.log('[Kitchen] Kitchen printer found, initializing Bluetooth session...');
          // Store kitchen printer info for later use
          window.kitchenPrinterConfig = {
            bluetoothDeviceName: kitchenPrinter.bluetooth_device_name,
            bluetoothDeviceId: kitchenPrinter.bluetooth_device_id
          };
          
          // Request Bluetooth device and establish session
          try {
            const device = await navigator.bluetooth.requestDevice({
              filters: [{ name: kitchenPrinter.bluetooth_device_name }],
              optionalServices: ['49535343-fe7d-4ae5-8fa9-9fafd205e455', '0000ffe0-0000-1000-8000-00805f9b34fb']
            });

            // Initialize printer session same as admin does
            if (!window.bluetoothSessions) window.bluetoothSessions = {};
            window.bluetoothSessions.KITCHEN = {
              device: device,
              server: null,
              service: null,
              characteristic: null,
              connected: false,
              lastUsed: Date.now()
            };

            const server = await device.gatt.connect();
            window.bluetoothSessions.KITCHEN.server = server;
            window.bluetoothSessions.KITCHEN.connected = true;

            // Get service
            const knownUUIDs = [
              '49535343-fe7d-4ae5-8fa9-9fafd205e455',  // MPT-2/3 series
              '0000ffe0-0000-1000-8000-00805f9b34fb',  // Common BLE UART
              '0000fff0-0000-1000-8000-00805f9b34fb'   // Alternative BLE UART
            ];

            let service;
            for (const uuid of knownUUIDs) {
              try {
                service = await server.getPrimaryService(uuid);
                break;
              } catch (e) {
                // Try next UUID
              }
            }

            if (!service) {
              const services = await server.getPrimaryServices();
              for (const svc of services) {
                try {
                  const characteristics = await svc.getCharacteristics();
                  const writable = characteristics.find(c => c.properties.writeWithoutResponse || c.properties.write);
                  if (writable) {
                    service = svc;
                    break;
                  }
                } catch (e) {}
              }
            }

            if (service) {
              window.bluetoothSessions.KITCHEN.service = service;
              const characteristics = await service.getCharacteristics();
              const writableChar = characteristics.find(c => 
                c.properties.writeWithoutResponse || c.properties.write
              );
              if (writableChar) {
                window.bluetoothSessions.KITCHEN.characteristic = writableChar;
                console.log('✅ Kitchen printer session established:', device.name);
              }
            }
          } catch (bluetoothError) {
            console.warn('[Kitchen] Bluetooth session setup skipped (user cancelled or not supported)');
          }
        }
      }
    } catch (error) {
      console.warn('[Kitchen] Could not initialize printer session (non-blocking):', error);
    }

    // Initialize WebSocket for REAL-TIME DISPLAY UPDATES
    // ⚠️  NOTE: Kitchen printer AUTO-PRINTS orders on the BACKEND (session not required)
    // This WebSocket is OPTIONAL - just for refreshing the kitchen display UI in real-time
    if (typeof kitchenOrderWebSocketClient !== 'undefined') {
      try {
        kitchenOrderWebSocketClient.connect(restaurantId);
        console.log('✅ Kitchen display connected for real-time updates');
      } catch (error) {
        console.warn('⚠️  WebSocket display not available:', error);
      }
    }
  } catch (err) {
    console.error(err);
    errorEl.textContent = "Connection error";
    errorEl.style.display = "block";
  }
}

// ============== KITCHEN DASHBOARD ============== 
async function loadKitchenOrders() {
  if (!restaurantId) {
    console.warn("⚠️ restaurantId is not set, skipping order load");
    return;
  }

  try {
    const url = `${API_BASE}/kitchen/items?restaurantId=${encodeURIComponent(restaurantId)}`;
    console.log("📡 Fetching kitchen orders from:", url);
    
    const res = await fetch(url);
    console.log("📊 Response status:", res.status, res.statusText);
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error("❌ Failed to load kitchen orders:", res.status, errorText);
      return;
    }

    const items = await res.json();
    console.log("✅ Loaded", items.length, "kitchen items");

    // Reset orderMap for fresh load
    orderMap = {};
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
          orderType: item.order_type,
          items: [],
          createdAt: item.created_at
        };
      }
      orderMap[orderId].items.push(item);
    });

    renderKitchenOrders(Object.values(orderMap).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
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
    
    // Determine display label: use table name if available and order type is 'table', otherwise use order type
    let displayLabel = order.table;
    if (order.table === 'Unknown Table' || order.orderType !== 'table') {
      // Format order type nicely: 'to-go' -> 'To Go', 'counter' -> 'Counter', 'order-now' -> 'Order Now'
      if (order.orderType) {
        displayLabel = order.orderType
          .split('-')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
      } else {
        displayLabel = 'Order';
      }
    }

    return `
      <div class="order-card ${statusClass}">
        <div class="card-header">
          <div>
            <div class="card-title">${displayLabel}</div>
            <div class="card-time">#${order.orderId}</div>
          </div>
          <div class="card-time">${getTimeAgo(order.createdAt)}</div>
        </div>
        <div class="card-body">
          ${order.items.map(item => `
            <div class="order-item">
              <div class="item-header">
                <span class="item-name">${item.menu_item_name}</span>
                <span class="item-qty">×${item.quantity}</span>
              </div>
              ${item.variants ? `<div class="item-variants">${item.variants}</div>` : ""}
              ${item.notes ? `<div class="item-notes" style="color:#e65100;font-style:italic;font-size:12px;margin-top:2px;">📝 ${item.notes}</div>` : ""}
              <span class="item-status ${item.status}">${({'pending':'Sending','preparing':'Preparing','served':'Delivered','completed':'Delivered'})[item.status] || item.status.charAt(0).toUpperCase() + item.status.slice(1)}</span>
            </div>
          `).join("")}
          
          <div class="card-actions">
            ${order.items.some(item => item.status === "pending") ? 
              `<button class="btn-action btn-start" onclick="updateAllItemStatus(${JSON.stringify(order.items.filter(i => i.status === 'pending').map(i => i.order_item_id))}, 'preparing')">Start Preparing</button>
              <button class="btn-action btn-print" onclick="handlePrintOrder('${order.orderId}')" data-i18n="kitchen.print-order">🖨️ Print</button>` 
              : (order.items.some(item => item.status === "preparing") ? 
              `<button class="btn-action btn-serve" onclick="updateAllItemStatus(${JSON.stringify(order.items.filter(i => i.status === 'preparing').map(i => i.order_item_id))}, 'served')">Serve</button>` 
              : `<button class="btn-action btn-ready" disabled>All Served</button>`)}
          </div>
        </div>
      </div>
    `;
  }).join("");
}

async function updateAllItemStatus(itemIds, status) {
  try {
    // Ensure itemIds is an array
    let ids = Array.isArray(itemIds) ? itemIds : [];
    
    if (ids.length === 0) {
      return alert("No items to update");
    }
    
    // Update all items in parallel
    const restaurantId = localStorage.getItem("restaurantId");
    const promises = ids.map(id => 
      fetch(`${API_BASE}/order-items/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, restaurantId })
      })
    );
    
    const results = await Promise.all(promises);
    
    if (results.every(res => res.ok)) {
      loadKitchenOrders();
    } else {
      alert("Some items failed to update");
    }
  } catch (err) {
    console.error("Failed to update item status:", err);
    alert("Error updating items: " + err.message);
  }
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
  
  // Use stored restaurantId from sessionStorage if available, otherwise use URL param
  if (!restaurantId && sessionStorage.getItem("restaurantId")) {
    restaurantId = sessionStorage.getItem("restaurantId");
  }

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

  // Initialize language buttons
  updateLanguageButtonStates();
});

// ============== ADMIN MENU DROPDOWN (kept for backward compat; Exit button calls openKitchenSwitcher) ============== 
function toggleAdminDropdown() {
  openKitchenSwitcher();
}

// ============== PRINTING ============== 
function handlePrintOrder(orderId) {
  const order = orderMap[orderId];
  if (!order) {
    console.error("Order not found:", orderId);
    return;
  }
  const restaurantName = localStorage.getItem("restaurantName") || "Restaurant";
  kitchenPrinting.print(order, restaurantName);
}

// ============== LANGUAGE SWITCHING ============== 
function updateLanguageButtonStates() {
  const currentLang = getCurrentLanguage();
  const enBtn = document.getElementById("lang-en");
  const zhBtn = document.getElementById("lang-zh");
  
  if (enBtn) {
    enBtn.classList.toggle("active", currentLang === "en");
  }
  if (zhBtn) {
    zhBtn.classList.toggle("active", currentLang === "zh");
  }
}

// Listen for language changes
window.addEventListener("languageChanged", (e) => {
  updateLanguageButtonStates();
});

// ============== CLOCK IN / OUT (KITCHEN) ==============
function updateKitchenClockBtn(isClockedIn) {
  const btn = document.getElementById("clock-btn");
  if (!btn) return;
  btn.style.display = "inline-flex";
  btn.textContent = isClockedIn ? t('admin.clock-out') : t('admin.clock-in');
  btn.className = isClockedIn ? "btn-danger" : "btn-secondary";
  window.kitchenCurrentlyClockedIn = isClockedIn;
}

async function toggleKitchenClockInOut() {
  if (!window.kitchenUserId || !restaurantId) return;
  const action = window.kitchenCurrentlyClockedIn ? "clock-out" : "clock-in";
  try {
    const res = await fetch(`${API_BASE}/restaurants/${restaurantId}/staff/${window.kitchenUserId}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
    });
    if (!res.ok) {
      const err = await res.json();
      alert(err.error || `Failed to ${action.replace("-", " ")}`);
      return;
    }
    const newState = !window.kitchenCurrentlyClockedIn;
    updateKitchenClockBtn(newState);
    alert(newState ? "Clocked in successfully." : "Clocked out successfully.");
  } catch (err) {
    console.error(err);
    alert("Connection error");
  }
}

function showKitchenClockInPrompt() {
  const overlay = document.createElement("div");
  overlay.id = "clock-in-prompt";
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center;";
  overlay.innerHTML = `
    <div style="background:#fff;border-radius:12px;padding:28px 32px;max-width:340px;width:90%;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,.25);">
      <p style="font-size:20px;margin:0 0 8px;">⏱</p>
      <h3 style="margin:0 0 10px;font-size:18px;">You haven't clocked in yet</h3>
      <p style="color:#666;font-size:14px;margin:0 0 20px;">Would you like to clock in now?</p>
      <div style="display:flex;gap:12px;justify-content:center;">
        <button onclick="kitchenClockInFromPrompt()" style="flex:1;padding:10px 16px;background:#2563eb;color:#fff;border:none;border-radius:8px;font-size:15px;cursor:pointer;">✅ Clock In</button>
        <button onclick="dismissKitchenClockInPrompt()" style="flex:1;padding:10px 16px;background:#f3f4f6;color:#333;border:none;border-radius:8px;font-size:15px;cursor:pointer;">Skip</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
}

async function kitchenClockInFromPrompt() {
  dismissKitchenClockInPrompt();
  await toggleKitchenClockInOut();
}

function dismissKitchenClockInPrompt() {
  const el = document.getElementById("clock-in-prompt");
  if (el) el.remove();
}

// ============== KITCHEN SWITCHER ==============
const KITCHEN_AVATAR_COLORS = ['#2c3e50','#e74c3c','#3498db','#2ecc71','#9b59b6','#f39c12','#1abc9c','#e67e22'];
let kitchenSwitcherPin = "";
let kitchenSwitcherSelectedId = null;
let kitchenSwitcherStaffList = [];

function getKitchenAvatarColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return KITCHEN_AVATAR_COLORS[Math.abs(hash) % KITCHEN_AVATAR_COLORS.length];
}

function getKitchenInitials(name) {
  return name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

async function openKitchenSwitcher() {
  const overlay = document.getElementById("kitchen-switcher");
  if (!overlay) return;
  showKitchenSwitcherGridView();
  overlay.style.display = "flex";
  try {
    const res = await fetch(`${API_BASE}/restaurants/${restaurantId}/staff`);
    if (!res.ok) throw new Error("Failed to load staff");
    const allStaff = await res.json();
    // Only kitchen role, max 8
    kitchenSwitcherStaffList = allStaff.filter(s => s.role === 'kitchen').slice(0, 8);
    renderKitchenSwitcherGrid();
  } catch (err) {
    console.error("Kitchen switcher load error:", err);
  }
}

function closeKitchenSwitcher() {
  const overlay = document.getElementById("kitchen-switcher");
  if (overlay) overlay.style.display = "none";
}

function renderKitchenSwitcherGrid() {
  const grid = document.getElementById("kitchen-switcher-staff-grid");
  if (!grid) return;
  grid.innerHTML = "";

  const activeEl = document.getElementById("kitchen-switcher-logged-in-name");
  if (activeEl) {
    const me = kitchenSwitcherStaffList.find(s => String(s.id) === String(window.kitchenUserId));
    activeEl.textContent = me ? me.name : "";
  }

  kitchenSwitcherStaffList.forEach(staff => {
    const isCurrent = String(staff.id) === String(window.kitchenUserId);
    const card = document.createElement("div");
    card.className = "switcher-staff-card" + (isCurrent ? " current-user" : "");

    const color = getKitchenAvatarColor(staff.name);
    const initials = getKitchenInitials(staff.name);
    const clockedIn = staff.currently_clocked_in;

    card.innerHTML =
      `<div class="switcher-avatar" style="background:${color}">${initials}</div>` +
      `<div class="switcher-card-name">${staff.name}</div>` +
      (clockedIn
        ? `<div class="switcher-card-status clocked-in" data-i18n="admin.switcher-clocked-in">${t('admin.switcher-clocked-in')}</div>`
        : `<div class="switcher-card-status" data-i18n="admin.switcher-off">${t('admin.switcher-off')}</div>`) +
      (isCurrent ? `<div class="switcher-active-badge" data-i18n="admin.switcher-active">${t('admin.switcher-active')}</div>` : "");

    if (!isCurrent) {
      card.onclick = () => selectKitchenSwitcherStaff(staff.id, staff.name);
    }
    grid.appendChild(card);
  });
}

function showKitchenSwitcherGridView() {
  const gridView = document.getElementById("kitchen-switcher-grid-view");
  const pinView = document.getElementById("kitchen-switcher-pin-view");
  if (gridView) gridView.style.display = "";
  if (pinView) pinView.style.display = "none";
  kitchenSwitcherPin = "";
  kitchenSwitcherSelectedId = null;
  updateKitchenSwitcherPinDots();
}

function selectKitchenSwitcherStaff(staffId, staffName) {
  kitchenSwitcherSelectedId = staffId;
  kitchenSwitcherPin = "";

  const nameEl = document.getElementById("kitchen-switcher-pin-name");
  if (nameEl) nameEl.textContent = staffName;

  const avatarEl = document.getElementById("kitchen-switcher-pin-avatar");
  if (avatarEl) {
    avatarEl.textContent = getKitchenInitials(staffName);
    avatarEl.style.background = getKitchenAvatarColor(staffName);
  }

  updateKitchenSwitcherPinDots();

  document.getElementById("kitchen-switcher-grid-view").style.display = "none";
  document.getElementById("kitchen-switcher-pin-view").style.display = "";

  const errorEl = document.getElementById("kitchen-switcher-error");
  if (errorEl) { errorEl.textContent = ""; errorEl.style.display = "none"; }
}

function backToKitchenSwitcherGrid() { showKitchenSwitcherGridView(); }

function kitchenSwitcherPressKey(num) {
  if (kitchenSwitcherPin.length < 6) {
    kitchenSwitcherPin += String(num);
    updateKitchenSwitcherPinDots();
  }
}

function kitchenSwitcherClearPin() {
  kitchenSwitcherPin = "";
  updateKitchenSwitcherPinDots();
}

function updateKitchenSwitcherPinDots() {
  document.querySelectorAll("#kitchen-switcher-pin-dots span")
    .forEach((dot, idx) => dot.classList.toggle("filled", idx < kitchenSwitcherPin.length));
}

async function kitchenSwitcherSubmitPin() {
  if (kitchenSwitcherPin.length !== 6 || !kitchenSwitcherSelectedId) return;
  const errorEl = document.getElementById("kitchen-switcher-error");
  if (errorEl) errorEl.style.display = "none";

  try {
    const res = await fetch(`${API_BASE}/auth/kitchen-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: kitchenSwitcherPin, restaurantId })
    });
    const data = await res.json();

    if (!res.ok || !data.token) {
      if (errorEl) { errorEl.textContent = data.error || "Invalid PIN"; errorEl.style.display = "block"; }
      kitchenSwitcherPin = ""; updateKitchenSwitcherPinDots();
      return;
    }

    // Verify PIN belongs to the kitchen staff member that was selected
    if (String(data.user_id) !== String(kitchenSwitcherSelectedId)) {
      if (errorEl) { errorEl.textContent = t('admin.switcher-wrong-pin'); errorEl.style.display = "block"; }
      kitchenSwitcherPin = ""; updateKitchenSwitcherPinDots();
      return;
    }

    // Switch to new kitchen user
    token = data.token;
    localStorage.setItem("token", token);
    localStorage.setItem("role", "kitchen");
    localStorage.setItem("restaurantId", restaurantId);

    window.kitchenUserId = data.user_id || null;
    window.kitchenCurrentlyClockedIn = data.currently_clocked_in || false;

    if (data.access_rights && data.access_rights.allowed_categories) {
      allowedCategoryIds = data.access_rights.allowed_categories.map(id => parseInt(id, 10));
    }

    closeKitchenSwitcher();

    // Refresh clock button and prompt
    updateKitchenClockBtn(window.kitchenCurrentlyClockedIn);
    if (!window.kitchenCurrentlyClockedIn) showKitchenClockInPrompt();

    // Reload orders with new token (interval already running)
    loadKitchenOrders();

  } catch (err) {
    if (errorEl) { errorEl.textContent = "Connection error"; errorEl.style.display = "block"; }
  }
}
