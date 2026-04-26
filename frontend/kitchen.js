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

  // Check if already authenticated via email login
  const existingToken = localStorage.getItem("token");
  const existingRole = localStorage.getItem("role");
  if (existingToken && existingRole === "kitchen" && restaurantId) {
    console.log("🔑 Kitchen already authenticated via email login, skipping PIN");
    token = existingToken;
    
    // Restore allowed categories from localStorage
    const storedRights = localStorage.getItem("accessRights");
    if (storedRights) {
      try {
        const rawRights = JSON.parse(storedRights);
        if (rawRights && rawRights.allowed_categories) {
          allowedCategoryIds = rawRights.allowed_categories.map(id => parseInt(id, 10));
        }
      } catch {}
    }

    // Auto-initialize kitchen app after DOM ready
    document.addEventListener("DOMContentLoaded", () => {
      document.getElementById("login-screen").style.display = "none";
      document.getElementById("kitchen-app").classList.add("active");
      loadKitchenOrders();
      setInterval(loadKitchenOrders, 5000);
    });
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
    errorEl.textContent = t('admin.connection-error');
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
          restaurantOrderNumber: item.restaurant_order_number,
          table: item.table_name,
          orderType: item.order_type,
          items: [],
          createdAt: item.created_at
        };
      }
      orderMap[orderId].items.push(item);
    });

    // Group addon items under their parent items for display
    for (const orderId in orderMap) {
      const order = orderMap[orderId];
      const mainItems = [];
      const addonsByParent = {};
      for (const item of order.items) {
        if (item.is_addon && item.parent_order_item_id) {
          if (!addonsByParent[item.parent_order_item_id]) addonsByParent[item.parent_order_item_id] = [];
          addonsByParent[item.parent_order_item_id].push(item);
        } else {
          mainItems.push(item);
        }
      }
      // Attach addons to main items
      for (const item of mainItems) {
        item._addons = addonsByParent[item.order_item_id] || [];
      }
      order.items = mainItems;
    }

    renderKitchenOrders(Object.values(orderMap).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)));
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
    const hasReady = order.items.some(item => item.status === "ready");
    const hasPreparing = order.items.some(item => item.status === "preparing");
    const statusClass = hasAllServed ? "served" : hasReady ? "ready" : hasPreparing ? "preparing" : "pending";
    
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

    const orderNumber = order.restaurantOrderNumber || order.orderId;

    return `
      <div class="order-card ${statusClass}">
        <div class="card-header">
          <div>
            <div class="card-title">${displayLabel} #${orderNumber}</div>
          </div>
          <div>
            <span class="card-status-badge ${statusClass}">${
              statusClass === 'pending' ? (typeof t === 'function' ? t('kitchen.pending') : 'PENDING') :
              statusClass === 'preparing' ? (typeof t === 'function' ? t('kitchen.preparing') : 'PREPARING') :
              statusClass === 'ready' ? (typeof t === 'function' ? t('kitchen.ready') : 'READY') :
              (typeof t === 'function' ? t('kitchen.served') : 'SERVED')
            }</span>
          </div>
        </div>
        <div class="card-time-row">${getTimeAgo(order.createdAt)}</div>
        <div class="card-body">
          ${order.items.map(item => `
            <div class="order-item">
              <div class="item-header">
                <span class="item-name">${item.menu_item_name}</span>
                <span class="item-qty">×${item.quantity}</span>
              </div>
              ${item.variants ? `<div class="item-variants">${item.variants}</div>` : ""}
              ${item.notes ? `<div class="item-notes" style="color:#e65100;font-style:italic;font-size:12px;margin-top:2px;">📝 ${item.notes}</div>` : ""}
              ${(item._addons || []).map(addon => `
                <div class="addon-item">
                  <div class="item-header">
                    <span class="item-name">+ ${addon.menu_item_name}</span>
                    <span class="item-qty">×${addon.quantity}</span>
                  </div>
                  ${addon.variants ? `<div class="item-variants">${addon.variants}</div>` : ""}
                  ${addon.notes ? `<div class="item-notes" style="color:#e65100;font-style:italic;font-size:12px;margin-top:2px;">📝 ${addon.notes}</div>` : ""}
                </div>
              `).join("")}
            </div>
          `).join("")}
          
          <div class="card-actions">
            ${(() => {
              const allItemIds = order.items.flatMap(i => [i.order_item_id, ...(i._addons || []).map(a => a.order_item_id)]);
              const printBtn = `<button class="btn-action btn-print" onclick="handlePrintOrder('${order.orderId}')">${typeof t === 'function' ? t('kitchen.print-order') : '🖨️ Print'}</button>`;
              if (statusClass === 'pending') {
                return `${printBtn}
                <button class="btn-action btn-start" onclick="updateAllItemStatus(${JSON.stringify(allItemIds)}, 'preparing')">${typeof t === 'function' ? t('kitchen.start-preparing') : 'Start Preparing'}</button>`;
              } else if (statusClass === 'preparing') {
                return `${printBtn}
                <button class="btn-action btn-serve" onclick="updateAllItemStatus(${JSON.stringify(allItemIds)}, 'ready')">${typeof t === 'function' ? t('kitchen.ready') : 'Ready'}</button>`;
              } else if (statusClass === 'ready') {
                return `${printBtn}
                <button class="btn-action btn-served" onclick="updateAllItemStatus(${JSON.stringify(allItemIds)}, 'served')">${typeof t === 'function' ? t('kitchen.served') : 'Served'}</button>`;
              } else {
                return `${printBtn}
                <button class="btn-action btn-ready" disabled>${typeof t === 'function' ? t('kitchen.all-served') : 'All Served'}</button>`;
              }
            })()}
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
window.addEventListener("DOMContentLoaded", async () => {
  // Check if user came from login.html with email/password
  const emailLoginFlag = sessionStorage.getItem("kitchenStaffLogged");
  
  // Use stored restaurantId from sessionStorage if available, otherwise use URL param
  if (!restaurantId && sessionStorage.getItem("restaurantId")) {
    restaurantId = sessionStorage.getItem("restaurantId");
  }

  // Fetch restaurant language preference and apply it to the PIN login page
  if (restaurantId) {
    try {
      const res = await fetch(`${API_BASE}/restaurants/${restaurantId}/settings`);
      if (res.ok) {
        const settings = await res.json();
        if (settings.language_preference && typeof setLanguage === 'function') {
          setLanguage(settings.language_preference);
        }
      }
    } catch (err) {
      // Network error - fall back to cached language preference
      const cached = localStorage.getItem('language') || 'zh';
      if (typeof setLanguage === 'function') setLanguage(cached);
    }
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

// ============== ADMIN MENU DROPDOWN ============== 
function toggleAdminDropdown() {
  const dropdown = document.getElementById("admin-dropdown");
  if (dropdown) {
    dropdown.classList.toggle("hidden");
  }
}

// Close dropdown when clicking outside
document.addEventListener("click", (e) => {
  const btn = document.getElementById("admin-menu-btn");
  const dropdown = document.getElementById("admin-dropdown");
  if (btn && dropdown && !btn.contains(e.target) && !dropdown.contains(e.target)) {
    dropdown.classList.add("hidden");
  }
});

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
    alert(newState ? t('admin.clock-in-success') : t('admin.clock-out-success'));
  } catch (err) {
    console.error(err);
    alert(t('admin.connection-error'));
  }
}

function showKitchenClockInPrompt() {
  const overlay = document.createElement("div");
  overlay.id = "clock-in-prompt";
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center;";
  overlay.innerHTML = `
    <div style="background:#fff;border-radius:12px;padding:28px 32px;max-width:340px;width:90%;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,.25);">
      <p style="font-size:20px;margin:0 0 8px;">⏱</p>
      <h3 style="margin:0 0 10px;font-size:18px;">${t('admin.clock-in-prompt-title')}</h3>
      <p style="color:#666;font-size:14px;margin:0 0 20px;">${t('admin.clock-in-prompt-body')}</p>
      <div style="display:flex;gap:12px;justify-content:center;">
        <button onclick="kitchenClockInFromPrompt()" style="flex:1;padding:10px 16px;background:#2563eb;color:#fff;border:none;border-radius:8px;font-size:15px;cursor:pointer;">${t('admin.clock-in')}</button>
        <button onclick="dismissKitchenClockInPrompt()" style="flex:1;padding:10px 16px;background:#f3f4f6;color:#333;border:none;border-radius:8px;font-size:15px;cursor:pointer;">${t('admin.skip')}</button>
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
