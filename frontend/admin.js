
// ============= CORE ADMIN.JS - Global State & Utilities =============
// This file contains ONLY code that is NOT in the modular files:
// - admin-tables.js (table, session, order management)
// - admin-menu.js (menu items, categories, variants)
// - admin-staff.js (staff management)
// - admin-reports.js (reports)
// - admin-settings.js (settings, POS, QR preferences)

// ============= UI UTILITIES =============

/**
 * Show a toast notification. Disappears on click or after 4 seconds.
 * @param {string} message
 * @param {'success'|'error'|'info'} type
 */
function showToast(message, type = 'success') {
  const existing = document.getElementById('app-toast');
  if (existing) existing.remove();

  const colors = {
    success: { bg: '#1a1a2e', accent: '#22c55e', icon: '✅' },
    error:   { bg: '#1a1a2e', accent: '#ef4444', icon: '❌' },
    info:    { bg: '#1a1a2e', accent: '#3b82f6', icon: 'ℹ️' },
  };
  const c = colors[type] || colors.success;

  const toast = document.createElement('div');
  toast.id = 'app-toast';
  toast.style.cssText = `
    position: fixed; bottom: 32px; left: 50%; transform: translateX(-50%) translateY(16px);
    background: ${c.bg}; color: #fff; padding: 14px 24px;
    border-left: 4px solid ${c.accent}; border-radius: 10px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.35); font-size: 15px; font-weight: 500;
    z-index: 9999; cursor: pointer; white-space: pre-line; max-width: 90vw; text-align: center;
    opacity: 0; transition: opacity 0.2s ease, transform 0.2s ease;
  `;
  toast.innerHTML = `${c.icon} ${message}`;

  const dismiss = () => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(16px)';
    setTimeout(() => toast.remove(), 220);
  };
  toast.addEventListener('click', dismiss);

  document.body.appendChild(toast);
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';
  });
  setTimeout(dismiss, 4000);
}

/**
 * Styled modal to ask for pax count (replaces browser prompt).
 * Returns a Promise that resolves to the pax number, or null if cancelled.
 */
function showPaxPrompt() {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-content" style="width: 340px; padding: 28px;">
        <h3 style="margin: 0 0 8px 0; font-size: 18px;">No Active Session</h3>
        <p style="margin: 0 0 20px 0; color: var(--text-light); font-size: 14px;">How many people (pax) for this table?</p>
        <label style="display: block; margin-bottom: 20px;">
          <span class="modal-content-label">Number of Guests</span>
          <input type="number" id="pax-prompt-input" min="1" value="2" class="modal-input" style="font-size: 18px; text-align: center;">
        </label>
        <div class="modal-button-group">
          <button id="pax-prompt-cancel" class="modal-cancel-btn">Cancel</button>
          <button id="pax-prompt-confirm" class="modal-btn-primary">Start Session</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    const input = overlay.querySelector('#pax-prompt-input');
    input.focus();
    input.select();
    overlay.querySelector('#pax-prompt-confirm').addEventListener('click', () => {
      const val = parseInt(input.value);
      if (!val || val <= 0) { input.focus(); return; }
      overlay.remove();
      resolve(val);
    });
    overlay.querySelector('#pax-prompt-cancel').addEventListener('click', () => {
      overlay.remove();
      resolve(null);
    });
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') overlay.querySelector('#pax-prompt-confirm').click();
      if (e.key === 'Escape') overlay.querySelector('#pax-prompt-cancel').click();
    });
  });
}

// Determine API base URL - use same domain for remote access, local backend for development
var API = (() => {
  const hostname = window.location.hostname;
  const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
  
  if (isLocalhost) {
    return `http://${window.location.host}/api`;
  }
  // Remote/local network access - use HTTPS with same host:port
  return `https://${window.location.host}/api`;
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
  
  // Decode JWT token to get current user ID for placed_by tracking
  try {
    if (token) {
      const payload = JSON.parse(atob(token.split('.')[1]));
      window.staffUserId = payload.id || null;
    }
  } catch (e) { /* ignore decode errors */ }

  // Hide admin-only elements (but NOT sections) for staff
  var adminOnlyEls = document.querySelectorAll(".admin-only:not(section)");
  for (var i = 0; i < adminOnlyEls.length; i++) {
    var el = adminOnlyEls[i];
    if (IS_ADMIN || IS_SUPERADMIN) {
      el.classList.add("admin-visible");
    }
  }

  // Note: staff.html uses feature-based access control via staff.css (.menu-btn / .menu-btn.visible)
  // Do NOT hide nav buttons here for IS_STAFF — that is handled by staff.js initializeStaffApp().

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

  // Close any open session panel (fixed on mobile, could persist across section changes)
  if (sectionId !== "tables" && typeof closeSessionPanel === 'function') {
    closeSessionPanel();
  }

  // Close orders cart panel if open (position:fixed on mobile, persists across sections)
  if (sectionId !== "orders") {
    var cartPanel = document.getElementById('orders-cart-view-container');
    if (cartPanel && cartPanel.classList.contains('show-cart')) {
      cartPanel.classList.remove('show-cart');
      var cartBar = document.querySelector('.orders-cart-bar');
      if (cartBar) cartBar.classList.remove('active');
    }
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
      if (typeof initializeOrders === 'function') {
        await initializeOrders();
      } else {
        console.warn('[admin.js] initializeOrders not yet loaded');
      }
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
      if (typeof initializeTables === 'function') {
        await initializeTables();
      } else {
        console.warn('[admin.js] initializeTables not yet loaded');
      }
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
      if (typeof initializeMenu === 'function') {
        await initializeMenu();
      } else {
        console.warn('[admin.js] initializeMenu not yet loaded');
      }
      reTranslateContent();
      updateSectionHeader('admin.section-menu', 'menu-edit-btn');
      // Show the import button only if the feature is enabled or user is superadmin
      var importBtn = document.getElementById('menu-import-btn');
      if (importBtn) {
        var importFlags = (typeof ADMIN_SETTINGS_CACHE !== 'undefined' && ADMIN_SETTINGS_CACHE && ADMIN_SETTINGS_CACHE.feature_flags) || {};
        if (IS_SUPERADMIN || importFlags.menu_import_enabled === true) {
          importBtn.style.display = 'inline-block';
        } else {
          importBtn.style.display = 'none';
        }
      }
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
        if (typeof initializeStaff === 'function') {
          await initializeStaff();
          console.log("✅ initializeStaff() completed");
        } else {
          console.warn('[admin.js] initializeStaff not yet loaded');
        }
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
      if (typeof initializeBookings === 'function') {
        initializeBookings();
      } else {
        console.warn('[admin.js] initializeBookings not yet loaded');
      }
      reTranslateContent();
      updateSectionHeader('admin.section-reservations', 'header-new-booking-btn');
    } else if (sectionId === "reports") {
      console.log("🔵 Loading REPORTS section");
      console.log("📌 IS_ADMIN:", IS_ADMIN, "IS_SUPERADMIN:", IS_SUPERADMIN, "IS_STAFF:", IS_STAFF);
      
      // Check if user has access to reports (admin/superadmin, or staff with feature 3)
      var hasReportsAccess = IS_ADMIN || IS_SUPERADMIN || (IS_STAFF && typeof staffAccessRights !== 'undefined' && Array.isArray(staffAccessRights) && staffAccessRights.includes(7));
      
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
        if (typeof initializeReports === 'function') {
          await initializeReports();
          console.log("✅ initializeReports() completed");
        } else {
          console.warn('[admin.js] initializeReports not yet loaded');
        }
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
            // Re-apply admin-visible class to newly loaded admin-only elements
            var settingsAdminEls = settingsSection.querySelectorAll(".admin-only");
            for (var i = 0; i < settingsAdminEls.length; i++) {
              if (IS_ADMIN || IS_SUPERADMIN) {
                settingsAdminEls[i].classList.add("admin-visible");
              }
            }
            reTranslateContent();
          } catch (err) {
            console.error("Error loading settings HTML:", err);
          }
        }
        if (typeof initializeSettings === 'function') {
          await initializeSettings();
        } else {
          console.warn('[admin.js] initializeSettings not yet loaded');
        }
        reTranslateContent();
      } else {
        console.log("❌ User does not have access to settings (need admin/superadmin or staff feature 5)");
      }
      updateSectionHeader('admin.section-settings', 'edit-settings-header');
    } else if (sectionId === "users") {
      // Superadmin only - Users & Restaurants management
      if (!IS_SUPERADMIN) {
        console.warn("❌ User does not have access to users management (superadmin only)");
        return;
      }
      
      if (typeof loadUsersManagement === 'function') {
        await loadUsersManagement();
      } else {
        console.warn('[admin.js] loadUsersManagement not yet loaded');
      }
      reTranslateContent();
      updateSectionHeader('admin.users-restaurants', null);
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
    var overlay = document.getElementById("sidebar-overlay");
    if (overlay) overlay.classList.remove("active");
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
    // Toggle overlay backdrop on mobile
    var overlay = document.getElementById("sidebar-overlay");
    if (overlay) {
      overlay.classList.toggle("active", !sidebar.classList.contains("collapsed"));
    }
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
    if (btn.id !== "admin-menu-btn" && btn.id !== "admin-dropdown" && btn.id !== "scan-qr-btn" && btn.id !== "clock-btn") {
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

  // Show scan QR button on all sections for easy access
  var scanBtn = document.getElementById("scan-qr-btn");
  if (scanBtn) {
    scanBtn.style.display = "inline-block";
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

      // Hide sidebar tabs based on feature flags
      var ff = settings.feature_flags || {};
      var tabFlagMap = {
        bookings: 'bookings-nav-btn',
        staff_timekeeping: 'staff-nav-btn',
      };
      Object.keys(tabFlagMap).forEach(function(flag) {
        if (ff[flag] === false) {
          var btn = document.getElementById(tabFlagMap[flag]);
          if (btn) btn.style.display = 'none';
        }
      });
    }
    
    // Load only tables on page load
    if (typeof loadTablesCategories === 'function') {
      await loadTablesCategories();
    } else {
      console.warn('[admin.js] loadTablesCategories not yet loaded');
    }
    
    if (typeof loadTablesCategoryTable === 'function') {
      await loadTablesCategoryTable();
    } else {
      console.warn('[admin.js] loadTablesCategoryTable not yet loaded');
    }
  } catch (err) {
    console.error("Error loading app:", err);
    // Continue with UTC as fallback
    restaurantTimezone = 'UTC';
  }
}

function adminOnly(action) {
  return IS_ADMIN || IS_SUPERADMIN;
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
  
  // On desktop, expand sidebar by default; on mobile, keep collapsed
  var sidebar = document.getElementById("sidebar");
  if (sidebar && window.innerWidth >= 768) {
    sidebar.classList.remove("collapsed");
  }

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

  // ========== STEP 3: Initialize WebSocket for real-time auto-print ==========
  if (typeof autoPrintClient !== 'undefined' && restaurantId) {
    try {
      console.log('[Admin Init] Initializing auto-print WebSocket client');
      autoPrintClient.initialize(parseInt(restaurantId), (event) => {
        console.log('[Admin Init] Auto-print event received:', event);
        // The autoPrintClient will handle triggering the print automatically
      });
    } catch (err) {
      console.warn('[Admin Init] Failed to initialize auto-print client:', err);
    }
  }
});
