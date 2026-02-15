
// ============= CORE ADMIN.JS - Global State & Utilities =============
// This file contains ONLY code that is NOT in the modular files:
// - admin-tables.js (table, session, order management)
// - admin-menu.js (menu items, categories, variants)
// - admin-staff.js (staff management)
// - admin-reports.js (reports)
// - admin-settings.js (settings, POS, QR preferences)

var API = window.location.hostname === "localhost" ? "http://localhost:10000/api" : "https://chuio.io/api";

var restaurantId = localStorage.getItem("restaurantId");
var token = localStorage.getItem("token");
var role = localStorage.getItem("role");
var superadminRestaurants = [];

var IS_ADMIN = role === "admin";
var IS_STAFF = role === "staff";
var IS_KITCHEN = role === "kitchen";
var IS_SUPERADMIN = role === "superadmin";

// Global state
var CREATING_ITEM = false;
var EDITING_ITEM_ID = null;
var OPEN_VARIANTS_ITEM_ID = null;
var EDITING_VARIANT_ID = null;
var CURRENT_VARIANTS = [];

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
      var ordersContent = document.getElementById("orders-section-content");
      if (!document.getElementById('orders-menu-items')) {
        var response = await fetch('/admin-orders.html');
        ordersContent.innerHTML = await response.text();
      }
      await initializeOrders();
      updateSectionHeader("Orders Management", "orders-history-header-btn");
    } else if (sectionId === "tables") {
      var tablesSection = document.getElementById("section-tables");
      if (tablesSection && !tablesSection.innerHTML.includes("tables-container")) {
        try {
          var tablesResponse = await fetch('/admin-tables.html');
          tablesSection.innerHTML = await tablesResponse.text();
        } catch (err) {
          console.error("Error loading tables HTML:", err);
        }
      }
      if (!TABLE_CATEGORIES.length) {
        await loadTablesCategories();
      }
      await loadTablesCategoryTable();
      var grid = document.getElementById("tables-grid");
      if (grid && !grid.innerHTML) {
        renderCategoryTablesGrid();
      }
      updateSectionHeader("Tables", "table-edit-btn");
    } else if (sectionId === "menu") {
      var menuSection = document.getElementById("section-menu");
      if (menuSection && !menuSection.innerHTML.includes("menu-container")) {
        try {
          var menuResponse = await fetch('/admin-menu.html');
          menuSection.innerHTML = await menuResponse.text();
        } catch (err) {
          console.error("Error loading menu HTML:", err);
        }
      }
      await loadMenuItems();
      updateSectionHeader("Menu Management", "menu-edit-btn");
    } else if (sectionId === "staff") {
      var staffSection = document.getElementById("section-staff");
      if (staffSection && !staffSection.innerHTML.includes("staff-grid")) {
        try {
          var staffResponse = await fetch('/admin-staff.html');
          staffSection.innerHTML = await staffResponse.text();
        } catch (err) {
          console.error("Error loading staff HTML:", err);
        }
      }
      await loadStaff();
      updateSectionHeader("Staff Management", "staff-edit-btn");
    } else if (sectionId === "coupons") {
      var couponsSection = document.getElementById("section-coupons");
      if (couponsSection && !couponsSection.innerHTML.includes("coupon-code")) {
        try {
          var couponsResponse = await fetch('/admin-coupons.html');
          couponsSection.innerHTML = await couponsResponse.text();
        } catch (err) {
          console.error("Error loading coupons HTML:", err);
        }
      }
      await loadCoupons();
      updateSectionHeader("Coupons", "");
    } else if (sectionId === "reports") {
      if (IS_ADMIN || IS_SUPERADMIN) {
        var reportsSection = document.getElementById("section-reports");
        if (reportsSection && !reportsSection.innerHTML.includes("reports-dashboard")) {
          try {
            var reportsResponse = await fetch('/admin-reports.html');
            var reportsHTML = await reportsResponse.text();
            reportsSection.innerHTML = reportsHTML;
          } catch (err) {
            console.error("Error loading reports HTML:", err);
          }
        }
        await initializeAnalyticsDashboard();
      }
      updateSectionHeader("Reports & Analytics", "reports-btn");
    } else if (sectionId === "settings") {
      var settingsSection = document.getElementById("section-settings");
      if (settingsSection && !settingsSection.innerHTML.includes("settings-cards-grid")) {
        try {
          var settingsResponse = await fetch('/admin-settings.html');
          settingsSection.innerHTML = await settingsResponse.text();
        } catch (err) {
          console.error("Error loading settings HTML:", err);
        }
      }
      // Initialize settings cache
      try {
        const res = await fetch(`${API}/${restaurantId}/settings`);
        if (res.ok) {
          ADMIN_SETTINGS_CACHE = await res.json();
          applyThemeColor(ADMIN_SETTINGS_CACHE.theme_color);
        }
      } catch (err) {
        console.error("Failed to initialize settings:", err);
      }
      updateSectionHeader("Settings", "edit-settings-header");
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
  var sidebar = document.getElementById("sidebar");
  var container = document.getElementById("app-container");
  if (sidebar) {
    sidebar.classList.toggle("collapsed");
    if (container) {
      container.classList.toggle("sidebar-collapsed");
    }
  }
}

// Close sidebar when clicking outside of it
document.addEventListener("click", function(event) {
  var sidebar = document.getElementById("sidebar");
  var toggleBtn = document.getElementById("sidebar-toggle");
  var container = document.getElementById("app-container");
  
  // If sidebar exists and is not collapsed
  if (sidebar && !sidebar.classList.contains("collapsed")) {
    // Check if click is outside sidebar and not on toggle button
    if (!sidebar.contains(event.target) && !toggleBtn.contains(event.target)) {
      sidebar.classList.add("collapsed");
      if (container) {
        container.classList.add("sidebar-collapsed");
      }
    }
  }
});

// Update app header with section-specific content
function updateSectionHeader(title, actionButtonId) {
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
    if (btn.id !== "admin-menu-btn" && btn.id !== "admin-dropdown") {
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
    // Load only tables on page load
    await loadTablesCategories();
    await loadTablesCategoryTable();
  } catch (err) {
    console.error("Error loading app:", err);
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
    body: JSON.stringify({ quantity })
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
    method: "DELETE"
  });

  if (!res.ok) {
    const err = await res.json();
    return alert(err.error || "Failed to delete item");
  }
  if (ACTIVE_SESSION_ID) {
    loadAndRenderOrders(ACTIVE_SESSION_ID);
  }
}

// ============= MENU VARIANTS (NOT in modular files) =============
async function manageVariants(itemId) {
  OPEN_VARIANTS_ITEM_ID = OPEN_VARIANTS_ITEM_ID === itemId ? null : itemId;
  await loadMenuItems();
}

async function fetchVariants(itemId) {
  const res = await fetch(`${API}/menu-items/${itemId}/variants`);
  return await res.json();
}

function renderVariants(itemId, variants) {
  if (!variants || variants.length === 0) {
    return `<div style="padding: 10px; color: #999;">No variants yet</div>`;
  }

  return `
    <div class="variants-container">
      <h4>Variant Groups</h4>
      ${variants.map(group => `
        <div class="variant-group" style="margin-bottom: 12px; padding: 10px; background: #f5f5f5; border-radius: 6px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <strong>${group.name}</strong>
            <div>
              <button class="btn-icon" onclick="addVariantOption(${itemId}, ${group.id})">➕ Add Option</button>
              <button class="btn-icon danger" onclick="deleteVariant(${itemId}, ${group.id})">🗑</button>
            </div>
          </div>
          <div style="margin-left: 10px; border-left: 2px solid #ddd; padding-left: 10px;">
            ${group.options.map(opt => `
              <div style="display: flex; justify-content: space-between; margin-bottom: 6px; padding: 6px; background: white; border-radius: 4px;">
                <div>
                  <input value="${opt.name}" placeholder="Option name" style="width: 150px;" onchange="updateVariantOption(${itemId}, ${group.id}, ${opt.id}, this.value, ${opt.price_cents})"/>
                  <span style="margin-left: 10px; color: #666;">+$${(opt.price_cents / 100).toFixed(2)}</span>
                </div>
                <button class="btn-icon danger" onclick="deleteVariantOption(${itemId}, ${group.id}, ${opt.id})">🗑</button>
              </div>
            `).join("")}
          </div>
        </div>
      `).join("")}
      <button class="btn-secondary" onclick="addVariantGroup(${itemId})">➕ Add Variant Group</button>
    </div>
  `;
}

async function addVariantGroup(itemId) {
  const name = prompt("Variant group name (e.g., 'Size', 'Temperature'):");
  if (!name) return;

  const res = await fetch(`${API}/menu-items/${itemId}/variants`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, required: true })
  });

  if (!res.ok) {
    alert("Failed to add variant group");
    return;
  }

  await loadMenuItems();
}

async function addVariantOption(itemId, groupId) {
  const name = prompt("Option name:");
  if (!name) return;

  const res = await fetch(
    `${API}/menu-items/${itemId}/variants/${groupId}/options`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, price_cents: 0 })
    }
  );

  if (!res.ok) {
    alert("Failed to add option");
    return;
  }

  await loadMenuItems();
}

function sanitizeVariantChanges(changes) {
  // Prevent injection
  return {
    ...changes,
    name: changes.name ? changes.name.substring(0, 100) : ""
  };
}

async function updateVariant(itemId, groupId, changes) {
  const sanitized = sanitizeVariantChanges(changes);

  await fetch(`${API}/menu-items/${itemId}/variants/${groupId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sanitized)
  });

  await loadMenuItems();
}

async function deleteVariant(itemId, groupId) {
  if (!confirm("Delete this variant group?")) return;

  const res = await fetch(`${API}/menu-items/${itemId}/variants/${groupId}`, {
    method: "DELETE"
  });

  if (!res.ok) {
    alert("Failed to delete variant");
    return;
  }

  await loadMenuItems();
}

async function updateVariantOption(itemId, groupId, optionId, name, price) {
  await fetch(
    `${API}/menu-items/${itemId}/variants/${groupId}/options/${optionId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, price_cents: price })
    }
  );

  await loadMenuItems();
}

async function deleteVariantOption(itemId, groupId, optionId) {
  if (!confirm("Delete this option?")) return;

  const res = await fetch(
    `${API}/menu-items/${itemId}/variants/${groupId}/options/${optionId}`,
    { method: "DELETE" }
  );

  if (!res.ok) {
    alert("Failed to delete option");
    return;
  }

  await loadMenuItems();
}

// ============= COUPONS & DISCOUNTS (NOT in modular files) =============
async function loadCoupons() {
  const res = await fetch(`${API}/restaurants/${restaurantId}/coupons`);
  const coupons = await res.json();

  const container = document.getElementById("coupons-list");
  if (!container) return;

  container.innerHTML = "";

  if (!coupons || coupons.length === 0) {
    container.innerHTML = "<p>No coupons yet</p>";
    return;
  }

  coupons.forEach(coupon => {
    container.innerHTML += `
      <div class="coupon-card">
        <div>
          <strong>${coupon.code}</strong> - ${coupon.discount_type === "percentage" ? coupon.discount_value + "%" : "$" + (coupon.discount_value / 100).toFixed(2)}
        </div>
        <button onclick="deleteCoupon(${coupon.id})">🗑</button>
      </div>
    `;
  });
}

function renderCouponsList() {
  loadCoupons();
}

async function createCoupon() {
  const codeEl = document.getElementById("coupon-code");
  const code = codeEl ? codeEl.value.trim() : "";
  const typeEl = document.getElementById("coupon-type");
  const type = typeEl ? typeEl.value : "";
  const valueEl = document.getElementById("coupon-value");
  const value = valueEl ? valueEl.value : "";

  if (!code || !type || !value) {
    return alert("All fields required");
  }

  const res = await fetch(`${API}/restaurants/${restaurantId}/coupons`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code,
      discount_type: type,
      discount_value: type === "percentage" ? Number(value) : Number(value) * 100
    })
  });

  if (!res.ok) {
    alert("Failed to create coupon");
    return;
  }

  document.getElementById("coupon-code").value = "";
  document.getElementById("coupon-value").value = "";
  loadCoupons();
}

async function deleteCoupon(couponId) {
  if (!confirm("Delete this coupon?")) return;

  const res = await fetch(
    `${API}/restaurants/${restaurantId}/coupons/${couponId}`,
    { method: "DELETE" }
  );

  if (!res.ok) {
    alert("Failed to delete coupon");
    return;
  }

  loadCoupons();
}

async function editCoupon(couponId) {
  // TODO: Implement coupon editing
  alert("Coupon editing not implemented yet");
}

async function applyManualDiscount() {
  if (!ACTIVE_SESSION_ID) {
    alert("Select a session first");
    return;
  }

  const discount = prompt("Enter discount amount ($):");
  if (!discount) return;

  // TODO: Apply discount to session
  alert("Manual discounts not yet implemented");
}

function clearManualDiscount() {
  // TODO: Clear discount
  alert("Discount clearing not implemented yet");
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
  if (!token) {
    window.location.href = "/login.html";
    return;
  }

  // Show app container
  document.getElementById("app-container").style.display = "";

  // Set up language system
  if (typeof initializeLanguageSystem === "function") {
    initializeLanguageSystem();
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
