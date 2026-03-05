
// ============= CORE ADMIN.JS - Global State & Utilities =============
// This file contains ONLY code that is NOT in the modular files:
// - admin-tables.js (table, session, order management)
// - admin-menu.js (menu items, categories, variants)
// - admin-staff.js (staff management)
// - admin-reports.js (reports)
// - admin-settings.js (settings, POS, QR preferences)

// Determine API base URL - use same domain for remote access, local backend for development
var API = (() => {
  const hostname = window.location.hostname;
  const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
  
  if (isLocalhost) {
    return `http://${window.location.host}/api`;
  }
  // Remote access - use same domain
  return `https://${window.location.hostname}/api`;
})();

var restaurantId = localStorage.getItem("restaurantId");
var token = localStorage.getItem("token");
var role = localStorage.getItem("role");
var superadminRestaurants = [];

// ✅ Timezone support
var restaurantTimezone = localStorage.getItem("restaurantTimezone") || "UTC";

var IS_ADMIN = role === "admin";
var IS_STAFF = role === "staff";
var IS_KITCHEN = role === "kitchen";
var IS_SUPERADMIN = role === "superadmin";

// ============= IMMEDIATE ROLE VALIDATION (admin.html only) ==============
if (window.location.pathname.includes("admin.html")) {
  if (!token) {
    console.log("❌ No token found, redirecting to login");
    window.location.href = "/login.html";
  } else if (!IS_ADMIN && !IS_SUPERADMIN) {
    console.warn("⚠️ User role is '" + role + "' but admin panel requires 'admin' or 'superadmin'");
    console.warn("🔄 Clearing localStorage and redirecting to login...");
    localStorage.clear();
    window.location.href = "/login.html?reason=InvalidRole";
  }
}

// Global state
var CREATING_ITEM = false;
var EDITING_ITEM_ID = null;

var MENU_CATEGORIES = [];
var MENU_ITEMS = [];
var SELECTED_MENU_CATEGORY = null;

var TABLE_CATEGORIES = [];
var TABLES = [];
var SELECTED_TABLE_CATEGORY = null;
var SELECTED_CATEGORY = null;

var IS_EDIT_MODE = false;
var ACTIVE_SESSION_ID = null;

var CURRENT_SECTION = "tables";

// Settings / Restaurant config
var serviceChargeFee = 0;

// ============= LANGUAGE & TRANSLATION UTILITIES =============
// Re-apply translations to newly added DOM content (for modular HTML files)
function reTranslateContent() {
  const currentLang = localStorage.getItem('language') || 'zh';
  const elements = document.querySelectorAll('[data-i18n]');
  
  elements.forEach(el => {
    const key = el.getAttribute('data-i18n');
    const translation = t(key, currentLang);
    
    // Only update if translation exists and is different
    if (translation && translation !== key) {
      el.textContent = translation;
    }
  });
  
  console.log('[admin.js] Re-translated', elements.length, 'elements in', currentLang);
}

// Ensure modular files apply language when they load
function ensureLanguageOnModuleLoad() {
  const currentLang = localStorage.getItem('language') || 'zh';
  console.log('[admin.js] Module loaded - ensuring language is', currentLang);
  
  if (typeof setLanguage === 'function') {
    setLanguage(currentLang);
  } else {
    console.warn('[admin.js] setLanguage function not available yet');
  }
}

// ============= APP INITIALIZATION =============
async function initializeApp() {
  
  // Hide admin-only elements (but NOT sections) for staff
  var adminOnlyEls = document.querySelectorAll(".admin-only:not(section)");
  for (var i = 0; i < adminOnlyEls.length; i++) {
    var el = adminOnlyEls[i];
    if (IS_ADMIN || IS_SUPERADMIN) {
      el.classList.add("admin-visible");
    }
  }

  // Hide non-admin menu buttons for staff
  if (IS_STAFF) {
    var menuNavBtn = document.getElementById("menu-nav-btn");
    var staffNavBtn = document.getElementById("staff-nav-btn");
    var settingsNavBtn = document.getElementById("settings-nav-btn");
    if (menuNavBtn) menuNavBtn.style.display = "none";
    if (staffNavBtn) staffNavBtn.style.display = "none";
    if (settingsNavBtn) settingsNavBtn.style.display = "none";
  }

  await loadApp();
  
  // Initialize to Tables section
  await switchSection("tables");
}

// ============= NAVIGATION =============
async function switchSection(sectionId) {
  CURRENT_SECTION = sectionId;
  
  // Update active nav button FIRST (before anything else)
  var menuBtns = document.querySelectorAll(".menu-btn");
  for (var mb = 0; mb < menuBtns.length; mb++) {
    menuBtns[mb].classList.remove("active");
  }
  var activeBtn = document.querySelector("[data-section='" + sectionId + "']");
  if (activeBtn) {
    activeBtn.classList.add("active");
  }
  
  // Hide all sections
  var sections = document.querySelectorAll(".content-section");
  for (var s = 0; s < sections.length; s++) {
    sections[s].classList.remove("active");
  }

  // Show selected section
  var section = document.getElementById("section-" + sectionId);
  if (section) {
    section.classList.add("active");

    // Load data for the section
    if (sectionId === "orders") {
      var ordersSection = document.getElementById("section-orders");
      if (!document.getElementById('orders-menu-items')) {
        var response = await fetch('/admin-orders.html');
        ordersSection.innerHTML = await response.text();
        reTranslateContent();
      }
      await initializeOrders();
      reTranslateContent();
      updateSectionHeader('admin.section-orders', 'orders-history-header-btn');
    } else if (sectionId === "tables") {
      var tablesSection = document.getElementById("section-tables");
      if (tablesSection && !tablesSection.innerHTML.includes("tables-container")) {
        try {
          var tablesResponse = await fetch('/admin-tables.html');
          tablesSection.innerHTML = await tablesResponse.text();
          reTranslateContent();
        } catch (err) {
          console.error("Error loading tables HTML:", err);
        }
      }
      await initializeTables();
      reTranslateContent();
      updateSectionHeader('admin.section-tables', 'table-edit-btn');
    } else if (sectionId === "menu") {
      var menuSection = document.getElementById("section-menu");
      if (menuSection && !menuSection.innerHTML.includes("menu-container")) {
        try {
          var menuResponse = await fetch('/admin-menu.html');
          menuSection.innerHTML = await menuResponse.text();
          reTranslateContent();
        } catch (err) {
          console.error("Error loading menu HTML:", err);
        }
      }
      await initializeMenu();
      reTranslateContent();
      updateSectionHeader('admin.section-menu', 'menu-edit-btn');
    } else if (sectionId === "staff") {
      console.log("🔵 Loading STAFF section");
      
      // Check if user has access to staff management (admin/superadmin, or staff with feature 4)
      var hasStaffAccess = IS_ADMIN || IS_SUPERADMIN || (IS_STAFF && typeof staffAccessRights !== 'undefined' && Array.isArray(staffAccessRights) && staffAccessRights.includes(4));
      
      if (hasStaffAccess) {
        var staffSection = document.getElementById("section-staff");
        console.log("📌 staffSection found:", !!staffSection);
        console.log("📌 staffSection.innerHTML includes staff-grid:", staffSection ? staffSection.innerHTML.includes("staff-grid") : "N/A");
        
        if (staffSection && !staffSection.innerHTML.includes("staff-grid")) {
          try {
            console.log("📥 Fetching admin-staff.html...");
            var staffResponse = await fetch('/admin-staff.html');
            console.log("📦 Response status:", staffResponse.status);
            var html = await staffResponse.text();
            console.log("📝 HTML length:", html.length);
            staffSection.innerHTML = html;
            console.log("✅ HTML injected into staffSection");
            reTranslateContent();
          } catch (err) {
            console.error("❌ Error loading staff HTML:", err);
          }
        } else {
          console.log("⏭️ Staff HTML already loaded, skipping fetch");
        }
        console.log("🔵 Calling initializeStaff()...");
        await initializeStaff();
        console.log("✅ initializeStaff() completed");
        reTranslateContent();
      } else {
        console.log("❌ User does not have access to staff management (need admin/superadmin or staff feature 4)");
      }
      updateSectionHeader('admin.section-staff', 'staff-edit-btn');
    } else if (sectionId === "bookings") {
      var bookingsSection = document.getElementById("section-bookings");
      if (bookingsSection && !bookingsSection.innerHTML.includes("bookings-container")) {
        try {
          var bookingsResponse = await fetch('/admin-bookings.html');
          bookingsSection.innerHTML = await bookingsResponse.text();
          reTranslateContent();
        } catch (err) {
          console.error("Error loading bookings HTML:", err);
        }
      }
      initializeBookings();
      reTranslateContent();
      updateSectionHeader('admin.section-reservations', '');
    } else if (sectionId === "reports") {
      console.log("🔵 Loading REPORTS section");
      console.log("📌 IS_ADMIN:", IS_ADMIN, "IS_SUPERADMIN:", IS_SUPERADMIN, "IS_STAFF:", IS_STAFF);
      
      // Check if user has access to reports (admin/superadmin, or staff with feature 3)
      var hasReportsAccess = IS_ADMIN || IS_SUPERADMIN || (IS_STAFF && typeof staffAccessRights !== 'undefined' && Array.isArray(staffAccessRights) && staffAccessRights.includes(3));
      
      if (hasReportsAccess) {
        var reportsSection = document.getElementById("section-reports");
        console.log("📌 reportsSection found:", !!reportsSection);
        console.log("📌 reportsSection.innerHTML includes reports-dashboard:", reportsSection ? reportsSection.innerHTML.includes("reports-dashboard") : "N/A");
        
        if (reportsSection && !reportsSection.innerHTML.includes("reports-dashboard")) {
          try {
            console.log("📥 Fetching admin-reports.html...");
            var reportsResponse = await fetch('/admin-reports.html');
            console.log("📦 Response status:", reportsResponse.status);
            var reportsHTML = await reportsResponse.text();
            console.log("📝 HTML length:", reportsHTML.length);
            reportsSection.innerHTML = reportsHTML;
            console.log("✅ HTML injected into reportsSection");
            reTranslateContent();
          } catch (err) {
            console.error("❌ Error loading reports HTML:", err);
          }
        } else {
          console.log("⏭️ Reports HTML already loaded, skipping fetch");
        }
        console.log("🔵 Calling initializeReports()...");
        await initializeReports();
        console.log("✅ initializeReports() completed");
        reTranslateContent();
      } else {
        console.log("❌ User does not have access to reports (need admin/superadmin or staff feature 3)");
      }
      updateSectionHeader('admin.section-analytics', 'reports-btn');
    } else if (sectionId === "settings") {
      console.log("🔵 Loading SETTINGS section");
      
      // Check if user has access to settings (admin/superadmin, or staff with feature 5)
      var hasSettingsAccess = IS_ADMIN || IS_SUPERADMIN || (IS_STAFF && typeof staffAccessRights !== 'undefined' && Array.isArray(staffAccessRights) && staffAccessRights.includes(5));
      
      if (hasSettingsAccess) {
        var settingsSection = document.getElementById("section-settings");
        if (settingsSection && !settingsSection.innerHTML.includes("settings-cards-grid")) {
          try {
            var settingsResponse = await fetch('/admin-settings.html');
            settingsSection.innerHTML = await settingsResponse.text();
            reTranslateContent();
          } catch (err) {
            console.error("Error loading settings HTML:", err);
          }
        }
        await initializeSettings();
        reTranslateContent();
      } else {
        console.log("❌ User does not have access to settings (need admin/superadmin or staff feature 5)");
      }
      updateSectionHeader('admin.section-settings', 'edit-settings-header');
    }

    IS_EDIT_MODE = false;
    
    if (CURRENT_SECTION !== "staff" && typeof STAFF_EDIT_MODE !== 'undefined') {
      STAFF_EDIT_MODE = false;
      document.body.classList.remove("edit-mode");
    }
  }

  var sidebar = document.getElementById("sidebar");
  if (sidebar && window.innerWidth < 768) {
    sidebar.classList.add("collapsed");
  }
}

function handleLogout() {
  localStorage.removeItem("token");
  localStorage.removeItem("role");
  localStorage.removeItem("restaurantId");
  window.location.href = "/login.html";
}

function toggleSidebar() {
  var sidebar = document.querySelector(".sidebar");
  if (sidebar) {
    sidebar.classList.toggle("collapsed");
  }
}

// Update app header with section-specific content
function updateSectionHeader(titleKey, actionButtonId) {
  // Translate the title using the translation key
  const title = typeof titleKey === 'string' && titleKey.includes('admin.') ? t(titleKey) : titleKey;
  
  // Update header-left with section title (replace the static div)
  var headerLeft = document.querySelector(".header-left");
  if (headerLeft) {
    // Remove old title if it exists
    var oldTitle = headerLeft.querySelector(".section-title");
    if (oldTitle) {
      oldTitle.remove();
    }
    // Add new title
    var titleEl = document.createElement("div");
    titleEl.className = "section-title";
    titleEl.textContent = title;
    headerLeft.appendChild(titleEl);
  }

  // Hide all action buttons in header-right
  var headerRightBtns = document.querySelectorAll(".header-right [id$='-btn'], .header-right [id$='-header']");
  for (var i = 0; i < headerRightBtns.length; i++) {
    var btn = headerRightBtns[i];
    if (btn.id !== "admin-menu-btn" && btn.id !== "admin-dropdown" && btn.id !== "scan-qr-btn") {
      btn.style.display = "none";
    }
  }

  // Show the relevant action button
  if (actionButtonId) {
    var btn = document.getElementById(actionButtonId);
    if (btn) {
      btn.style.display = "inline-block";
    }
  }

  // Show scan QR button only for tables section
  var scanBtn = document.getElementById("scan-qr-btn");
  if (scanBtn) {
    if (CURRENT_SECTION === "tables") {
      scanBtn.style.display = "inline-block";
    } else {
      scanBtn.style.display = "none";
    }
  }
}

function toggleAdminDropdown() {
  var dropdown = document.getElementById("admin-dropdown");
  if (dropdown) {
    dropdown.classList.toggle("hidden");
  }
}

function toggleTableEditMode() {
  document.body.classList.toggle("edit-mode");
  const btn = document.getElementById("table-edit-btn");
  if (document.body.classList.contains("edit-mode")) {
    btn.innerHTML = '<img src="/uploads/website/pencil.png" alt="edit" class="btn-icon"> Done';
    btn.classList.add("active");
  } else {
    btn.innerHTML = '<img src="/uploads/website/pencil.png" alt="edit" class="btn-icon"> Edit';
    btn.classList.remove("active");
  }
  
  // Re-render to show/hide add buttons
  renderTableCategoryTabs();
  renderCategoryTablesGrid();
}

function closeSessionPanel() {
  const panel = document.getElementById("session-order-panel");
  if (panel) {
    panel.classList.remove("active");
  }
}
// ============= APP LOADING =============
async function loadApp() {
  try {
    // Load restaurant timezone from API
    const settingsRes = await fetch(`${API}/restaurants/${restaurantId}/settings`);
    if (settingsRes.ok) {
      const settings = await settingsRes.json();
      restaurantTimezone = settings.timezone || 'UTC';
      localStorage.setItem('restaurantTimezone', restaurantTimezone);
      console.log('✅ Restaurant timezone loaded:', restaurantTimezone);
    }
    
    // Load only tables on page load
    await loadTablesCategories();
    await loadTablesCategoryTable();
  } catch (err) {
    console.error("Error loading app:", err);
    // Continue with UTC as fallback
    restaurantTimezone = 'UTC';
  }
}

function adminOnly(action) {
  return IS_ADMIN || IS_SUPERADMIN;
}

// ============= ORDER MANAGEMENT (NOT in modular files) =============
async function updateOrderItem(orderItemId, quantity) {
  const res = await fetch(`${API}/order-items/${orderItemId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ quantity, restaurantId })
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
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ restaurantId })
  });

  if (!res.ok) {
    const err = await res.json();
    return alert(err.error || "Failed to delete item");
  }
  if (ACTIVE_SESSION_ID) {
    loadAndRenderOrders(ACTIVE_SESSION_ID);
  }
}

// ============= SUPERADMIN RESTAURANT MANAGEMENT =============
function openCreateRestaurantModal() {
  const modal = document.getElementById("create-restaurant-modal");
  if (modal) modal.classList.add("show");
}

async function createRestaurant() {
  const nameEl = document.getElementById("new-restaurant-name");
  const name = nameEl ? nameEl.value.trim() : "";
  const emailEl = document.getElementById("new-restaurant-email");
  const email = emailEl ? emailEl.value.trim() : "";

  if (!name || !email) {
    return alert("Name and email required");
  }

  const res = await fetch(`${API}/restaurants`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ name, email })
  });

  if (!res.ok) {
    alert("Failed to create restaurant");
    return;
  }

  alert("Restaurant created");
  document.getElementById("new-restaurant-name").value = "";
  document.getElementById("new-restaurant-email").value = "";
  const modal = document.getElementById("create-restaurant-modal");
  if (modal) modal.classList.remove("show");

  if (IS_SUPERADMIN) {
    initializeSuperadmin();
  }
}

function init() {
  // Initialize app
  if (!token) {
    window.location.href = "/login.html";
    return;
  }

  if (IS_SUPERADMIN) {
    initializeSuperadmin();
  } else {
    initializeApp();
  }
}

async function initializeSuperadmin() {
  // Show the restaurant list in the admin dropdown for superadmin
  const restaurantList = document.getElementById("superadmin-restaurant-list");
  
  // Load all restaurants for superadmin
  const res = await fetch(`${API}/restaurants`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  superadminRestaurants = await res.json();

  if (restaurantList) {
    restaurantList.style.display = "block";
    restaurantList.innerHTML = "";
    superadminRestaurants.forEach(r => {
      const btn = document.createElement("button");
      btn.className = "dropdown-item";
      btn.onclick = () => switchRestaurant(r.id);
      btn.textContent = r.name;
      restaurantList.appendChild(btn);
    });
  }
}

function toggleRestaurantList() {
  const list = document.getElementById("superadmin-restaurant-list");
  if (list) {
    list.style.display = list.style.display === "none" ? "block" : "none";
  }
}

async function switchRestaurant(newRestaurantId) {
  restaurantId = newRestaurantId;
  localStorage.setItem("restaurantId", restaurantId);
  window.location.reload();
}



// ============= PAGE INITIALIZATION =============
document.addEventListener("DOMContentLoaded", async () => {
  // Reset menu background when entering admin panel
  if (window.resetMenuBackground) {
    window.resetMenuBackground();
  }

  // SKIP: Staff portal uses PIN-based login (handled in staff.js), not token-based
  if (window.location.pathname.includes("staff.html")) {
    console.log("📋 Staff portal detected - skipping admin.js initialization");
    return;
  }

  if (!token) {
    window.location.href = "/login.html";
    return;
  }

  // Verify user has admin or superadmin role (for admin.html)
  if (window.location.pathname.includes("admin.html")) {
    if (!IS_ADMIN && !IS_SUPERADMIN) {
      console.warn("⚠️ User role is '" + role + "' but admin panel requires 'admin' or 'superadmin'");
      console.warn("🔄 Clearing localStorage and redirecting to login...");
      localStorage.clear();
      window.location.href = "/login.html?reason=InvalidRole";
      return;
    }
  }

  // ========== STEP 1: LOAD LANGUAGE PREFERENCE FIRST (before showing content) ==========
  const restaurantId = localStorage.getItem('restaurantId');
  let languageToUse = localStorage.getItem('language') || 'zh';
  
  // Try to fetch language preference from database
  if (restaurantId) {
    try {
      const settingsRes = await fetch(`${API}/restaurants/${restaurantId}/settings`);
      if (settingsRes.ok) {
        const settings = await settingsRes.json();
        if (settings.language_preference) {
          languageToUse = settings.language_preference;
          console.log('[Admin Init] Loaded language from database:', languageToUse);
        }
      }
    } catch (err) {
      console.warn('[Admin Init] Failed to load language from database:', err);
    }
  }
  
  if (typeof setLanguage === 'function') {
    console.log('[Admin Init] Applying language:', languageToUse);
    setLanguage(languageToUse);
  }

  // ========== STEP 2: NOW show app container after language is set ==========
  document.getElementById("app-container").style.display = "";
  
  // Hide loading splash screen
  const loadingSplash = document.getElementById("loading-splash");
  if (loadingSplash) {
    loadingSplash.style.display = "none";
  }

  // Load settings on page load (theme color, service charge)
  if (typeof initializeSettingsOnPageLoad === "function") {
    await initializeSettingsOnPageLoad();
  }

  // Initialize app
  if (IS_SUPERADMIN) {
    initializeSuperadmin();
  }
  await initializeApp();
});
