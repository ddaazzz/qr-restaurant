// ============== STAFF PORTAL API CONFIGURATION ==============
const API_BASE = (() => {
  const hostname = window.location.hostname;
  const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
  
  if (isLocalhost) {
    return `http://${window.location.host}/api`;
  }
  // For local IPs and remote: use the same protocol as the page (avoids http→https mismatch)
  return `${window.location.protocol}//${window.location.host}/api`;
})();

// Reset menu background when on staff page
if (window.resetMenuBackground) {
  window.resetMenuBackground();
}

// Override global API variable from admin.js
var API = API_BASE;

let pin = "";
let staffAccessRights = null; // Store access rights after login

// ============== ACCESS RIGHTS MAPPING ==============
// Numeric access rights correspond to features
const ACCESS_RIGHTS_MAP = {
  1: { name: 'orders', label: 'Orders', navId: 'orders-nav-btn' },
  2: { name: 'tables', label: 'Tables', navId: 'tables-nav-btn' },
  3: { name: 'menu', label: 'Menu', navId: 'menu-nav-btn' },
  4: { name: 'staff', label: 'Staff', navId: 'staff-nav-btn' },
  5: { name: 'settings', label: 'Settings', navId: 'settings-nav-btn' },
  6: { name: 'bookings', label: 'Bookings', navId: 'bookings-nav-btn' },
  7: { name: 'reports', label: 'Reports', navId: 'reports-nav-btn' },
};

// Helper function to check if staff has access to a feature
function hasAccessRight(featureId) {
  if (!staffAccessRights) return false;
  
  // staffAccessRights is an array of numbers [1, 2, 3, etc]
  if (Array.isArray(staffAccessRights)) {
    return staffAccessRights.includes(featureId);
  }
  return false;
}

// Helper function to get list of accessible features
function getAccessibleFeatures() {
  const features = [];
  if (Array.isArray(staffAccessRights)) {
    staffAccessRights.forEach(id => {
      if (ACCESS_RIGHTS_MAP[id]) {
        features.push(ACCESS_RIGHTS_MAP[id].name);
      }
    });
  }
  return features;
}

// Note: token, restaurantId are declared globally in admin.js
// Get restaurantId from URL - MUST have rid parameter
(() => {
  const params = new URLSearchParams(window.location.search);
  window.restaurantId = params.get("rid");
  
  console.log("🧑‍💼 Staff portal - checking rid parameter:", window.restaurantId);
  
  // Staff portal REQUIRES rid parameter in URL
  if (!window.restaurantId) {
    console.warn("❌ No restaurantId (rid parameter) in URL - redirecting to login");
    window.location.href = "/login";
    return;
  }
  
  // Store in sessionStorage so it persists after login
  sessionStorage.setItem("restaurantId", window.restaurantId);
})();
 
function pressKey(num) {
  num = String(num); // Ensure num is a string
  if (pin.length < 6) {
    pin += num;
    console.log("📍 PIN updated:", pin.length, "digits");
    updatePinDisplay();
  }
}

function clearPin() {
  pin = "";
  console.log("🗑️ PIN cleared");
  updatePinDisplay();
}

function updatePinDisplay() {
  const dots = document.querySelectorAll("#pin-dots span");
  if (!dots || dots.length === 0) {
    console.warn("❌ PIN dots container not found!");
    return;
  }
  dots.forEach((dot, idx) => {
    dot.classList.toggle("filled", idx < pin.length);
  });
  console.log("📊 PIN display updated, filled:", pin.length, "/ 6");
}

async function submitPin() {
  if (pin.length !== 6) {
    console.warn("⚠️ PIN length is", pin.length, "- need exactly 6 digits");
    return;
  }

  console.log("🔐 Submitting PIN for restaurant:", window.restaurantId);
  const errorEl = document.getElementById("error-message");
  errorEl.style.display = "none";

  try {
    const res = await fetch(`${API_BASE}/auth/staff-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin, restaurantId: window.restaurantId, role: "staff" })
    });

    const data = await res.json();

    if (!res.ok || !data.token) {
      errorEl.textContent = data.error || "Invalid PIN";
      errorEl.style.display = "block";
      pin = "";
      updatePinDisplay();
      return;
    }

    // Check if user is staff
    if (data.role !== "staff") {
      errorEl.textContent = "Access denied. Staff only.";
      errorEl.style.display = "block";
      pin = "";
      updatePinDisplay();
      return;
    }

    // Set global variables (used by admin.js)
    window.token = data.token;
    
    // Convert string access rights to numeric IDs
    let rawAccessRights = data.access_rights || [];
    console.log("📋 Raw access rights from server:", rawAccessRights);
    console.log("📋 ACCESS_RIGHTS_MAP:", ACCESS_RIGHTS_MAP);
    
    if (Array.isArray(rawAccessRights)) {
      staffAccessRights = rawAccessRights.map(right => {
        console.log(`  Converting: "${right}" (type: ${typeof right})`);
        // If it's a string (e.g., 'orders'), convert to numeric ID
        if (typeof right === 'string') {
          for (const [id, config] of Object.entries(ACCESS_RIGHTS_MAP)) {
            if (config.name === right) {
              console.log(`    ✅ Found match: "${right}" -> ID ${id}`);
              return parseInt(id, 10);
            }
          }
          console.log(`    ❌ No match found for "${right}"`);
          return NaN;
        }
        // If it's already a number, keep it
        const numId = parseInt(right, 10);
        console.log(`    Already number: ${numId}`);
        return numId;
      }).filter(id => !isNaN(id)); // Remove any invalid IDs
      console.log("📋 Converted staffAccessRights:", staffAccessRights);
    } else {
      staffAccessRights = [];
    }
    
    console.log("✅ PIN login successful");
    console.log("🔑 Token:", window.token?.substring(0, 20) + "...");
    console.log("📋 Final staffAccessRights:", staffAccessRights);
    console.log("📋 Converted staffAccessRights variable:", staffAccessRights);
    console.log("📋 Is array?", Array.isArray(staffAccessRights));
    
    localStorage.setItem("token", data.token);
    localStorage.setItem("role", "staff");
    localStorage.setItem("restaurantId", window.restaurantId);
    sessionStorage.setItem("restaurantId", window.restaurantId);
    sessionStorage.setItem("staffStaffLogged", "true");

    // Store staff user ID for placed_by tracking and clock in/out
    window.staffUserId = data.user_id || null;
    window.staffCurrentlyClockedIn = data.currently_clocked_in || false;

    // Keep login screen visible until app is fully initialized
    // initializeStaffApp() will hide it when ready
    initializeStaffApp();
  } catch (err) {
    console.error(err);
    errorEl.textContent = "Connection error";
    errorEl.style.display = "block";
  }
}

// ============== STAFF APP INITIALIZATION ==============
async function initializeStaffApp() {
  console.log("Initializing staff app with access rights:", staffAccessRights);
  console.log("Accessible features:", getAccessibleFeatures());

  // Set global role for admin.js compatibility
  window.role = "staff";
  window.IS_STAFF = true;
  window.IS_ADMIN = false;
  window.IS_SUPERADMIN = false;
  window.IS_KITCHEN = false;

  // Set default timezone
  window.restaurantTimezone = localStorage.getItem("restaurantTimezone") || 'UTC';

  // Apply language preference before showing content
  const savedLang = localStorage.getItem('language') || 'zh';
  if (typeof setLanguage === 'function') {
    setLanguage(savedLang);
  }

  // ============== APPLY ACCESS CONTROL ==============
  const navButtonMap = [
    { id: 'orders-nav-btn', featureId: 1, name: 'Orders' },
    { id: 'tables-nav-btn', featureId: 2, name: 'Tables' },
    { id: 'menu-nav-btn', featureId: 3, name: 'Menu' },
    { id: 'staff-nav-btn', featureId: 4, name: 'Staff' },
    { id: 'settings-nav-btn', featureId: 5, name: 'Settings' },
    { id: 'bookings-nav-btn', featureId: 6, name: 'Bookings' },
    { id: 'reports-nav-btn', featureId: 7, name: 'Reports' },
  ];

  // Show only nav buttons the user has access to
  navButtonMap.forEach(({ id, featureId, name }) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    if (hasAccessRight(featureId)) {
      btn.classList.add('visible');
      console.log(`✅ ${name} tab shown (feature ${featureId})`);
    } else {
      btn.classList.remove('visible');
      console.log(`❌ No access to ${name} (feature ${featureId})`);
    }
  });

  // Load settings (theme colour, service charge etc.) before showing app
  if (typeof initializeSettingsOnPageLoad === 'function') {
    try {
      await initializeSettingsOnPageLoad();
    } catch (err) {
      console.warn('[Staff] initializeSettingsOnPageLoad failed:', err.message);
    }
  }

  // Initialize the admin interface (loads tables, switches to tables section)
  console.log("Calling initializeApp()...");
  await initializeApp();

  // Now show the app and hide login screen
  document.getElementById("login-screen").style.display = "none";
  document.getElementById("app-container").style.display = "";

  // Update clock button state
  updateClockBtn(window.staffCurrentlyClockedIn);

  // Show clock-in prompt if staff hasn't clocked in yet
  if (!window.staffCurrentlyClockedIn) {
    showClockInPrompt();
  }

  // Initialize WebSocket for auto-print / real-time session detection
  if (typeof autoPrintClient !== 'undefined' && window.restaurantId) {
    try {
      autoPrintClient.initialize(parseInt(window.restaurantId), (event) => {
        console.log('[Staff] Auto-print event received:', event);
      });
    } catch (err) {
      console.warn('[Staff] Failed to initialize auto-print client:', err);
    }
  }

  console.log("✅ Staff app fully initialized");
}

// ============== LOGOUT ==============
function staffLogout() {
  localStorage.removeItem("token");
  localStorage.removeItem("role");
  localStorage.removeItem("restaurantId");
  sessionStorage.removeItem("staffStaffLogged");
  // Preserve the rid parameter so staff can log back in
  const rid = window.restaurantId || new URLSearchParams(window.location.search).get("rid");
  window.location.href = rid ? `/staff.html?rid=${rid}` : "/login.html";
}

// Alias for backward compatibility
function logout() { staffLogout(); }

// Override admin.js functions to add staff access control filtering

console.log("✅ Staff portal ready");

// ============== STAFF ROLE VALIDATION ==============
// Check on page load that user has staff or superadmin role
// BUT: Skip validation if we're on the PIN login screen (login-screen is visible)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', validateStaffRole);
} else {
  // If DOMContentLoaded already fired, check immediately
  validateStaffRole();
}

function validateStaffRole() {
  // Check if login screen exists and is visible
  const loginScreen = document.getElementById("login-screen");
  if (loginScreen && loginScreen.style.display !== "none") {
    // User is on PIN login screen - don't redirect, let them log in
    console.log("📱 PIN login screen active - skipping role validation");
    return;
  }

  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");
  
  if (!token) {
    // No token - this is expected on first load with PIN login
    // Check if app container should be visible (means they already logged in)
    const appContainer = document.getElementById("app-container");
    if (!appContainer || appContainer.style.display === "none") {
      console.log("📱 No token found - showing PIN login screen (this is normal)");
      return; // Don't redirect - just let PIN login work
    }
  }
  
  // Staff portal requires 'staff' or 'superadmin' role
  if (role !== "staff" && role !== "superadmin") {
    console.warn("⚠️ User role is '" + role + "' but staff portal requires 'staff' or 'superadmin'");
    console.warn("🔄 Clearing localStorage and redirecting to login...");
    localStorage.clear();
    window.location.href = "/login.html?reason=InvalidRole";
    return;
  }
  
  console.log("✅ Staff role validated:", role);
}

// ============== LOAD RESTAURANT INFO WITH TIMEZONE ==============
async function loadRestaurantInfo() {
  try {
    if (!window.restaurantId) {
      console.warn("⚠️ No restaurantId available for loading restaurant info");
      window.restaurantTimezone = 'UTC';
      return;
    }

    if (!window.token) {
      console.warn("⚠️ No token available for loading restaurant info");
      window.restaurantTimezone = 'UTC';
      return;
    }

    const res = await fetch(`${API_BASE}/restaurants/${window.restaurantId}`, {
      headers: { "Authorization": `Bearer ${window.token}` }
    });
    
    if (!res.ok) {
      console.warn(`⚠️ Failed to load restaurant info: ${res.status} ${res.statusText}`);
      window.restaurantTimezone = 'UTC';
      return;
    }

    const restaurant = await res.json();
    const timezone = restaurant.timezone || 'UTC';
    
    // Store timezone globally
    window.restaurantTimezone = timezone;
    localStorage.setItem("restaurantTimezone", timezone);
    
    console.log("✅ Restaurant timezone loaded:", timezone);
  } catch (err) {
    console.warn("⚠️ Could not load restaurant timezone:", err.message);
    // Default to UTC if error
    window.restaurantTimezone = 'UTC';
    localStorage.setItem("restaurantTimezone", 'UTC');
  }
}

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

// Initialize language button states when page loads
document.addEventListener("DOMContentLoaded", async () => {
  // Fetch restaurant language preference and apply it to the PIN login page
  const rid = window.restaurantId;
  if (rid) {
    try {
      const res = await fetch(`${API_BASE}/restaurants/${rid}/settings`);
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
  updateLanguageButtonStates();
});

// ============== CLOCK IN / OUT ==============
function updateClockBtn(isClockedIn) {
  const btn = document.getElementById("clock-btn");
  if (!btn) return;
  btn.style.display = "inline-flex";
  btn.textContent = isClockedIn ? t('admin.clock-out') : t('admin.clock-in');
  btn.className = isClockedIn ? "btn-danger" : "btn-secondary";
  window.staffCurrentlyClockedIn = isClockedIn;
}

async function toggleClockInOut() {
  if (!window.staffUserId || !window.restaurantId) return;
  const action = window.staffCurrentlyClockedIn ? "clock-out" : "clock-in";
  try {
    const res = await fetch(`${API_BASE}/restaurants/${window.restaurantId}/staff/${window.staffUserId}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${window.token}` }
    });
    if (!res.ok) {
      const err = await res.json();
      alert(err.error || `Failed to ${action.replace("-", " ")}`);
      return;
    }
    const newState = !window.staffCurrentlyClockedIn;
    updateClockBtn(newState);
    alert(newState ? "Clocked in successfully." : "Clocked out successfully.");
  } catch (err) {
    console.error(err);
    alert("Connection error");
  }
}

function showClockInPrompt() {
  const overlay = document.createElement("div");
  overlay.id = "clock-in-prompt";
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center;";
  overlay.innerHTML = `
    <div style="background:#fff;border-radius:12px;padding:28px 32px;max-width:340px;width:90%;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,.25);">
      <p style="font-size:20px;margin:0 0 8px;">⏱</p>
      <h3 style="margin:0 0 10px;font-size:18px;">You haven't clocked in yet</h3>
      <p style="color:#666;font-size:14px;margin:0 0 20px;">Would you like to clock in now?</p>
      <div style="display:flex;gap:12px;justify-content:center;">
        <button onclick="clockInFromPrompt()" style="flex:1;padding:10px 16px;background:#2563eb;color:#fff;border:none;border-radius:8px;font-size:15px;cursor:pointer;">✅ Clock In</button>
        <button onclick="dismissClockInPrompt()" style="flex:1;padding:10px 16px;background:#f3f4f6;color:#333;border:none;border-radius:8px;font-size:15px;cursor:pointer;">Skip</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
}

async function clockInFromPrompt() {
  dismissClockInPrompt();
  await toggleClockInOut();
}

function dismissClockInPrompt() {
  const el = document.getElementById("clock-in-prompt");
  if (el) el.remove();
}
