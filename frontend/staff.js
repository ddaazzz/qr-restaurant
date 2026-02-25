// ============== STAFF PORTAL API CONFIGURATION ==============
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

    // Hide login screen and show app
    document.getElementById("login-screen").style.display = "none";
    document.getElementById("app-container").style.display = "grid";

    // Initialize the admin app interface
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

  // Set default timezone (can be overridden by admin.js if needed)
  window.restaurantTimezone = localStorage.getItem("restaurantTimezone") || 'UTC';

  // Load modular HTML content FIRST
  console.log("Loading modular content...");
  await loadModularContent();
  console.log("Modular content loaded, waiting for DOM to settle...");
  
  // Give DOM a moment to settle
  await new Promise(resolve => setTimeout(resolve, 100));

  // ============== APPLY ACCESS CONTROL ==============
  // Define all nav buttons with their feature IDs
  const navButtonMap = [
    { id: 'orders-nav-btn', featureId: 1, name: 'Orders' },
    { id: 'tables-nav-btn', featureId: 2, name: 'Tables' },
    { id: 'menu-nav-btn', featureId: 3, name: 'Menu' },
    { id: 'staff-nav-btn', featureId: 4, name: 'Staff' },
    { id: 'settings-nav-btn', featureId: 5, name: 'Settings' },
    { id: 'bookings-nav-btn', featureId: 6, name: 'Bookings' },
  ];

  console.log("🔐 Checking access rights for:", staffAccessRights);
  console.log("🔐 hasAccessRight function test:");
  for (let i = 1; i <= 6; i++) {
    console.log(`   hasAccessRight(${i}): ${hasAccessRight(i)}`);
  }
  
  // Show only nav buttons that user has access to
  navButtonMap.forEach(({ id, featureId, name }) => {
    const btn = document.getElementById(id);
    if (!btn) {
      console.log(`❌ ${name} button (${id}) not found in DOM`);
      return;
    }
    
    if (hasAccessRight(featureId)) {
      btn.classList.add('visible');
      console.log(`✅ ${name} tab shown (feature ${featureId})`);
    } else {
      btn.classList.remove('visible');
      console.log(`❌ No access to ${name} (feature ${featureId})`);
    }
  });
  
  // Hide menu edit button (staff can only view)
  const menuEditBtn = document.getElementById("menu-edit-btn");
  if (menuEditBtn) menuEditBtn.style.display = "none";

  // Hide table edit button (staff can only view)
  const tableEditBtn = document.getElementById("table-edit-btn");
  if (tableEditBtn) tableEditBtn.style.display = "none";

  // Now initialize the admin interface
  console.log("Calling initializeApp()...");
  await initializeApp();
  console.log("Staff app initialized with feature-based access control");
}

// Load modular HTML content into sections
async function loadModularContent() {
  try {
    console.log("Fetching admin-tables.html...");
    const tablesRes = await fetch("/admin-tables.html");
    if (tablesRes.ok) {
      const tablesHtml = await tablesRes.text();
      const tablesSection = document.getElementById("section-tables");
      if (tablesSection) {
        tablesSection.innerHTML = tablesHtml;
        console.log("✅ Admin tables HTML loaded");
      } else {
        console.error("section-tables not found!");
      }
    } else {
      console.error("Failed to fetch admin-tables.html:", tablesRes.status);
    }

    console.log("Fetching admin-orders.html...");
    const ordersRes = await fetch("/admin-orders.html");
    if (ordersRes.ok) {
      const ordersHtml = await ordersRes.text();
      const ordersSection = document.getElementById("section-orders");
      if (ordersSection) {
        ordersSection.innerHTML = ordersHtml;
        console.log("✅ Admin orders HTML loaded");
      } else {
        console.error("section-orders not found!");
      }
    } else {
      console.error("Failed to fetch admin-orders.html:", ordersRes.status);
    }

    console.log("Fetching admin-menu.html...");
    const menuRes = await fetch("/admin-menu.html");
    if (menuRes.ok) {
      const menuHtml = await menuRes.text();
      const menuSection = document.getElementById("section-menu");
      if (menuSection) {
        menuSection.innerHTML = menuHtml;
        console.log("✅ Admin menu HTML loaded");
      } else {
        console.error("section-menu not found!");
      }
    } else {
      console.error("Failed to fetch admin-menu.html:", menuRes.status);
    }

    console.log("Fetching admin-staff.html...");
    const staffRes = await fetch("/admin-staff.html");
    if (staffRes.ok) {
      const staffHtml = await staffRes.text();
      const staffSection = document.getElementById("section-staff");
      if (staffSection) {
        staffSection.innerHTML = staffHtml;
        console.log("✅ Admin staff HTML loaded");
      } else {
        console.error("section-staff not found!");
      }
    } else {
      console.error("Failed to fetch admin-staff.html:", staffRes.status);
    }

    console.log("Fetching admin-settings.html...");
    const settingsRes = await fetch("/admin-settings.html");
    if (settingsRes.ok) {
      const settingsHtml = await settingsRes.text();
      const settingsSection = document.getElementById("section-settings");
      if (settingsSection) {
        settingsSection.innerHTML = settingsHtml;
        console.log("✅ Admin settings HTML loaded");
      } else {
        console.error("section-settings not found!");
      }
    } else {
      console.error("Failed to fetch admin-settings.html:", settingsRes.status);
    }

    console.log("✅ All modular content loaded");
  } catch (err) {
    console.error("Error loading modular content:", err);
  }
}

// ============== LOGOUT ==============
function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("role");
  localStorage.removeItem("restaurantId");
  sessionStorage.removeItem("staffStaffLogged");
  window.location.href = "/staff.html";
}

// Override admin.js functions to add staff access control filtering

// Hook into loadTablesCategoryTable to filter by staff access rights if needed
const originalLoadTablesCategoryTable = window.loadTablesCategoryTable;
if (originalLoadTablesCategoryTable) {
  window.loadTablesCategoryTable = async function() {
    await originalLoadTablesCategoryTable.call(this);
    // Staff can see all tables in their assigned categories
    console.log("✅ Tables loaded for staff view");
  };
}

// Hook into loadMenuItems to filter by staff allowed categories
const originalLoadMenuItems = window.loadMenuItems;
if (originalLoadMenuItems) {
  window.loadMenuItems = async function(categoryId) {
    // Check if staff has access to this category
    if (staffAccessRights && staffAccessRights.allowed_categories) {
      if (!staffAccessRights.allowed_categories.includes(parseInt(categoryId, 10))) {
        console.warn("Staff does not have access to this menu category");
        document.getElementById("menu-items").innerHTML = '<p style="color: #999; text-align: center; padding: 20px;">You do not have access to this menu category</p>';
        return;
      }
    }
    
    await originalLoadMenuItems.call(this, categoryId);
  };
}

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
document.addEventListener("DOMContentLoaded", () => {
  updateLanguageButtonStates();
});
