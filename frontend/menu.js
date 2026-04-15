//Swipe
  let touchStartY = 0;
  let touchCurrentY = 0;
  let mouseStartY = 0;
  let mouseCurrentY = 0;
  let dragging = false;
  let activeDrawer = null;

  const API_BASE = (() => {
    const hostname = window.location.hostname;
    const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
    const protocol = window.location.protocol; // "https:" or "http:"
    
    if (isLocalhost) {
      return `http://${window.location.host}/api`;
    }
    // For all other cases (including private IPs), use the same protocol as the page
    return `${protocol}//${window.location.host}/api`;
  })();

const urlParams = new URLSearchParams(window.location.search);
const IS_STAFF = urlParams.get("staff") === "1";

const qrToken = window.location.pathname.split("/").filter(Boolean)[0];

let sessionId = null;
let tableName = null;
let restaurantId = null;
let restaurantName = null;
let pax = null;
let serviceChargePct = 0;
let orderPollerStarted = false;
let orderingInitialized = false;
let orderPayEnabled = false;
let showItemStatusToDiners = true;
let lastOrderId = null;
let paymentPageActive = false; // prevents polling from overwriting the inline payment page
let appliedCoupon = null; // { code, discount_cents, discount_type, discount_value }

async function fetchAndApplyPaymentSettings() {
  try {
    const res = await fetch(`${API_BASE}/restaurants/${restaurantId}/payment-settings`);
    const data = await res.json();
    orderPayEnabled = data.order_pay_enabled === true;
    showItemStatusToDiners = data.show_item_status_to_diners !== false; // default true
  } catch (e) {
    orderPayEnabled = false;
    showItemStatusToDiners = true;
  }
}

function applyThemeColor(hex) {
  if (!hex) return;
  document.documentElement.style.setProperty('--restaurant-color', hex);
  try {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const d = (v, f) => Math.max(0, Math.floor(v * f)).toString(16).padStart(2, '0');
    document.documentElement.style.setProperty('--secondary-color', `#${d(r,0.8)}${d(g,0.8)}${d(b,0.8)}`);
    document.documentElement.style.setProperty('--restaurant-color-10', `rgba(${r},${g},${b},0.10)`);
    document.documentElement.style.setProperty('--restaurant-color-20', `rgba(${r},${g},${b},0.20)`);
    document.documentElement.style.setProperty('--restaurant-color-30', `rgba(${r},${g},${b},0.30)`);
  } catch (e) {}
}

// cart, variants — unchanged
let cart = { items: [], total: 0 };
const variantSelections = {};

// Addon state for drawer
let drawerAddons = []; // addons loaded for current item
let selectedDrawerAddons = {}; // { addonId: true/false }
let addonVariantData = {}; // { addonItemId: [variants] } - cached
let addonVariantSelections = {}; // { addonId: { variantId: [optionIds] } }

// Search filter
function filterMenu(query) {
  const q = (query || '').trim().toLowerCase();
  document.querySelectorAll('.menu-item').forEach(el => {
    const name = el.querySelector('.menu-item-name')?.textContent?.toLowerCase() || '';
    el.style.display = (!q || name.includes(q)) ? '' : 'none';
  });
  document.querySelectorAll('.category').forEach(catTitle => {
    const grid = catTitle.nextElementSibling;
    if (!grid) return;
    const anyVisible = Array.from(grid.querySelectorAll('.menu-item')).some(i => i.style.display !== 'none');
    catTitle.style.display = anyVisible ? '' : 'none';
    grid.style.display = anyVisible ? '' : 'none';
  });
}

// Cart quantity badges — update all food card & category badges
function updateCartBadges() {
  if (!window.menu) return;
  // Per-item badges on food cards
  window.menu.items.forEach(item => {
    const qty = cart.items.filter(c => c.menuItemId === item.id).reduce((s, c) => s + c.quantity, 0);
    const badge = document.getElementById(`cart-badge-${item.id}`);
    if (badge) {
      badge.textContent = qty > 0 ? qty : '';
      badge.style.display = qty > 0 ? 'flex' : 'none';
    }
  });
  // Per-category badges in sidebar
  window.menu.categories.forEach(cat => {
    const catItemIds = window.menu.items.filter(i => i.category_id === cat.id).map(i => i.id);
    const catQty = cart.items.filter(c => catItemIds.includes(c.menuItemId)).reduce((s, c) => s + c.quantity, 0);
    const catBadge = document.getElementById(`cat-badge-${cat.id}`);
    if (catBadge) {
      catBadge.textContent = catQty > 0 ? catQty : '';
      catBadge.style.display = catQty > 0 ? 'flex' : 'none';
    }
  });
}

// Language switching for customer menu
function setLanguageFromMenu(lang) {
  localStorage.setItem('language', lang);
  
  // Use existing setLanguage function to update all data-i18n elements
  if (typeof setLanguage === 'function') {
    setLanguage(lang);
  }
  
  // Update table indicator
  if (document.getElementById('table-indicator')) {
    document.getElementById("table-indicator").textContent = `${t('menu.table-label')} ${tableName} • ${t('menu.pax-label')} ${pax || '-'}`;
  }
  
  // Re-render cart to update labels
  updateCartBar();
  
  // Update menu items if they're visible
  if (document.getElementById('menu') && document.getElementById('menu').innerHTML) {
    renderMenuItems(window.menu.items);
  }
}

async function initLanding() {
  if (!qrToken) {
    alert("Invalid QR code");
    return;
  }

  const res = await fetch(`${API_BASE}/scan/${qrToken}`, { method: "POST" });
  const session = await res.json();
  sessionId = session.session_id;
  restaurantId = session.restaurant_id;
  restaurantName = session.restaurant_name;
  tableName = session.table_name;
  pax = session.pax;
  serviceChargePct = session.service_charge_percent || 0;

  // Apply restaurant theme color
  if (session.theme_color) applyThemeColor(session.theme_color);
  
  // Apply restaurant language preference if available
  if (session.language_preference) {
    console.log('[Menu] Applying restaurant language preference:', session.language_preference);
    localStorage.setItem('restaurantLanguage', session.language_preference);
    if (typeof setLanguage === 'function') {
      setLanguage(session.language_preference);
    }
  } else {
    // Fallback to saved language preference
    const savedLanguage = localStorage.getItem('language') || 'zh';
    if (typeof setLanguage === 'function') {
      setLanguage(savedLanguage);
    }
  }
  
console.log("Session data:", session, "Pax value:", session.pax);
  // 🔥 Populate landing page
  const logoEl = document.getElementById("logo")
  if (logoEl){
    // Use session.logo_url if available, fallback to placeholder
    const logoUrl = session.logo_url;
    if (logoUrl) {
      logoEl.src = logoUrl;
      logoEl.onerror = () => { logoEl.style.display = 'none'; };
    } else {
      logoEl.style.display = 'none';
    }
    console.log("Logo URL set to:", logoUrl);
  }

  // 🔥 Apply background image with dark overlay (LANDING PAGE ONLY)
  const landingPage = document.getElementById("landing-page");
  if (session.background_url) {
    landingPage.style.backgroundImage = `linear-gradient(rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0.6)), url('${session.background_url}')`;
    landingPage.style.backgroundSize = "430px 100vh";
    landingPage.style.backgroundPosition = "center";
    landingPage.style.backgroundAttachment = "fixed";
    landingPage.style.backgroundRepeat = "no-repeat";
    landingPage.classList.remove("no-background");
    console.log("Background image set with 60% dark overlay and phone sizing:", session.background_url);
  } else {
    // No background: apply black text class for visibility
    landingPage.classList.add("no-background");
    console.log("No background image, applied black text styling");
  }

  // Store cleanup function to reset background when leaving menu
  window.resetMenuBackground = function() {
    if (landingPage) {
      landingPage.style.backgroundImage = "none";
      landingPage.style.backgroundColor = "#ffffff";
    }
    document.body.style.backgroundImage = "none";
    document.body.style.backgroundColor = "#ffffff";
  };

  const nameEl = document.getElementById("restaurantName")
  if (nameEl){
    nameEl.textContent = session.restaurant_name;
  }
  const tableNameEl = document.getElementById("tableInfo")
  if (tableNameEl){
    tableNameEl.textContent = `${session.table_name} • ${t('menu.pax-label')} ${session.pax != null ? session.pax : "-"}`;
    console.log("Table info set to:", tableNameEl.textContent, "with pax:", session.pax);
  }
  const addressEl = document.getElementById("address")
  if (addressEl){
    addressEl.textContent = session.address || "";
  }
  const phoneEl = document.getElementById("phone")
  if (phoneEl){
    phoneEl.textContent = session.phone || "";
  }

  // buttons
  document.getElementById("start-order-btn").onclick = startOrdering;
  document.getElementById("check-orders-btn").onclick = () => {
    startOrdering();
    openOrdersDrawer();
  };

  // Show payment result banner if returning from Payment Asia
  const paymentStatus = urlParams.get('payment_status');
  if (paymentStatus) {
    const ref = urlParams.get('ref') || '';
    const isSuccess = paymentStatus === 'success';
    const banner = document.createElement('div');
    banner.style.cssText = `position:fixed;top:0;left:0;right:0;z-index:9999;padding:16px 20px;text-align:center;font-size:15px;font-weight:bold;color:white;background:${isSuccess ? '#16a34a' : '#dc2626'};box-shadow:0 2px 8px rgba(0,0,0,0.3);`;
    banner.textContent = isSuccess ? '\u2705 Payment successful! Your order is confirmed.' : '\u274c Payment was not completed. Please try again or pay at the counter.';
    document.body.prepend(banner);
    // Clean payment params from URL without reloading
    history.replaceState({}, '', window.location.pathname);
    setTimeout(() => banner.remove(), 6000);
    // Auto-open orders drawer so the diner sees their paid order and can add more
    if (isSuccess) {
      startOrdering().then(() => {
        fetch(`${API_BASE}/restaurants/${restaurantId}/settings/payment`)
          .then(r => r.json()).then(s => { orderPayEnabled = s.order_pay_enabled === true; }).catch(() => {});
        openOrdersDrawer();
      });
    }
  }

  // Initialize active language button for landing page
  const currentLang = localStorage.getItem('language') || 'zh';
  setLanguage(currentLang);
}

async function startOrdering() {
  document.getElementById("landing-page").style.display = "none";
  document.getElementById("app").style.display = "flex";

  // Initialize language button for menu page
  const currentLang = localStorage.getItem('language') || 'zh';
  setLanguage(currentLang);

  document.getElementById("table-indicator").textContent = `${t('menu.table-label')} ${tableName} • ${t('menu.pax-label')} ${pax || '-'}`;

  // Cart bar click handlers — only attach once
  if (!orderingInitialized) {
    orderingInitialized = true;

    document
      .getElementById("confirm-order-btn")
      .addEventListener("click", openCartDrawer);

    document
      .getElementById("cart-count")
      .addEventListener("click", openCartDrawer);

    document
      .getElementById("cart-total")
      .addEventListener("click", openCartDrawer);

    document
      .getElementById("orders-btn")
      .addEventListener("click", openOrdersDrawer);

    // Overlay click to close drawer
    document
      .getElementById("drawer-overlay")
      .addEventListener("click", closeAllDrawers);
  }

  // 🔥 load menu
  const menuRes = await fetch(
    `${API_BASE}/restaurants/${restaurantId}/menu`
  );

  window.menu = await menuRes.json();

  renderMenu(window.menu);
  renderCategories(window.menu.categories);

  // Load cart from localStorage if exists
  loadCartFromStorage();
  updateCartBadges();

  initCategoryObserver(window.menu.categories);
  startOrderPolling();
  updateCartBar();
  await fetchAndApplyPaymentSettings();
}

function renderCategories(categories) {
  const catDiv = document.getElementById("categories");
  const menu = document.getElementById("menu");

  catDiv.innerHTML = "";

  categories.forEach(cat => {
    const el = document.createElement("div");
    el.className = "category-item";
    el.innerHTML = `${cat.name}<span class="cat-badge" id="cat-badge-${cat.id}"></span>`;
    el.dataset.categoryId = cat.id;

    el.onclick = () => {
      const target = document.getElementById(`category-${cat.id}`);
      if (!target) return;

      // Use scrollIntoView for reliable scrolling
      target.scrollIntoView({
        behavior: "instant",
        block: "start"
      });

      setActiveCategory(cat.id);
    };

    catDiv.appendChild(el);
  });
}

//RenderMenu to put food cards inside grid 
function renderMenu(menu) {
  const container = document.getElementById("menu");
  container.innerHTML = "";

  const { categories, items } = menu;

  categories.forEach(category => {
    // Category title
    const categoryTitle = document.createElement("div");
    categoryTitle.className = "category";
    categoryTitle.id = `category-${category.id}`;
    categoryTitle.textContent = category.name;
    
    container.appendChild(categoryTitle);

    // Grid for items
    const grid = document.createElement("div");
    grid.className = "menu-grid";

    const categoryItems = items.filter(
      item => item.category_id === category.id && (item.available !== false)
    );  
    console.log(menu);

    categoryItems.forEach(item => {
      const itemEl = renderMenuItem(item);
      grid.appendChild(itemEl);
    });

    container.appendChild(grid);
  });
}

//Clicking an item navigates to detail page
function renderMenuItem(item) {
  const card = document.createElement("div");
  card.className = "menu-item";

  // Log items without images for debugging
  if (!item.image_url) {
    console.warn(`[Menu] Item "${item.name}" (ID: ${item.id}) has no image_url`);
  }

 card.innerHTML = `
  <span class="cart-badge" id="cart-badge-${item.id}"></span>
  <img 
    src="${item.image_url || '/uploads/website/placeholder.png'}" 
    data-item-id="${item.id}"
    data-item-name="${item.name}"
    onerror="this.src='/uploads/website/placeholder.png';"
    alt="${item.name}"
  />

  <div class="menu-item-name">${item.name}</div>

  <div class="menu-item-footer">
    <span class="menu-item-price">
      $${(item.price_cents / 100).toFixed(2)}
    </span>
    <span class="menu-item-arrow">›</span>
  </div>
`;

  card.onclick = () => openDrawer(item.id);




  return card;



}//Render

function renderMenuItemWithVariants(item, addons){
    const card = document.createElement("div");
    card.className = "drawer-item";

    // Log items without images for debugging
    if (!item.image_url) {
      console.warn(`[Menu Drawer] Item "${item.name}" (ID: ${item.id}) has no image_url`);
    }

    card.innerHTML = `
    <img 
      src="${item.image_url || '/uploads/website/placeholder.png'}"
      data-item-id="${item.id}"
      data-item-name="${item.name}"
      onerror="this.src='/uploads/website/placeholder.png';"
      alt="${item.name}"
    />

    <div class="menu-item-content">
      <div class="menu-item-name">${item.name}</div>
      <div class="menu-item-price">
        $${(item.price_cents / 100).toFixed(2)}
      </div>
      ${item.description ? `<div class="menu-item-desc">${item.description}</div>` : ""}
    </div>
  `;

  const content = card.querySelector(".menu-item-content");

    // Add variants
    if (Array.isArray(item.variants)) {
  item.variants.forEach(v => {
        const vContainer = document.createElement("div");
        vContainer.className = "variant-group";

        vContainer.innerHTML = `
          <div class="variant-title">
            <strong>
              ${v.name}
              ${v.required ? `<span style="color:red;"> *</span>` : ""}
            </strong>
            <small id="variant-counter-${item.id}-${v.id}" style="margin-left:6px;color:#666;">
              ${
                v.min_select === v.max_select && v.min_select !== null
                  ? `(select ${v.min_select})`
                  : v.max_select
                  ? `(select ${v.min_select != null ? v.min_select : 0}–${v.max_select})`
                  : v.min_select
                  ? `(select at least ${v.min_select})`
                  : `(optional)`
              }
            </small>
          </div>
        `;



        (v.options || [])
        .forEach(o => {
        const opt = document.createElement("label");
        const isUnavail = o.is_available === false;

        if (isUnavail) {
          opt.style.cssText = 'opacity: 0.4; pointer-events: none;';
        }

        opt.innerHTML = `
          <input
            type="checkbox"
            value="${o.id}"
            data-item-id="${item.id}"
            data-variant-id="${v.id}"
            data-unavailable="${isUnavail}"
             ${
    (variantSelections[item.id] && variantSelections[item.id][v.id] && variantSelections[item.id][v.id].includes(o.id))
      ? "checked"
      : ""}
            ${isUnavail ? 'disabled' : ''}
            onchange="onVariantChange(${item.id}, ${v.id}, ${o.id}, this.checked)"
          />
          <span>
          ${o.name}${isUnavail ? ' (Sold Out)' : ''}
          ${o.price_cents > 0 ? `(+$${(o.price_cents / 100).toFixed(2)})` : ""}
          </span>
        `;
      

        vContainer.appendChild(opt);       

      });

content.appendChild(vContainer);
    });
  }

  // ---------- ADDON ITEMS SECTION ----------
  if (addons && addons.length > 0) {
    const addonSection = document.createElement("div");
    addonSection.className = "addon-section";
    addonSection.innerHTML = `
      <div style="border-top: 1px solid #e5e7eb; margin-top: 12px; padding-top: 12px;">
        <div style="font-weight: 700; font-size: 14px; color: #1f2937; margin-bottom: 8px; text-transform: uppercase;">${t('menu.addons') || 'Add-ons'}</div>
      </div>
    `;

    const addonGrid = document.createElement("div");
    addonGrid.style.cssText = "display: flex; flex-wrap: wrap; gap: 10px;";

    addons.forEach(addon => {
      const discountPct = addon.regular_price_cents > 0
        ? Math.round(((addon.regular_price_cents - addon.addon_discount_price_cents) / addon.regular_price_cents) * 100)
        : 0;
      const isSelected = !!selectedDrawerAddons[addon.id];

      const addonCard = document.createElement("div");
      addonCard.className = "addon-card";
      addonCard.dataset.addonId = addon.id;
      addonCard.style.cssText = `width: 100px; border-radius: 10px; border: 2px solid ${isSelected ? '#667eea' : '#e5e7eb'}; background: ${isSelected ? '#f0f0ff' : '#fff'}; overflow: hidden; cursor: pointer; position: relative;`;

      addonCard.innerHTML = `
        ${addon.addon_item_image
          ? `<img src="${addon.addon_item_image}" style="width: 100%; height: 65px; object-fit: cover; border-top-left-radius: 8px; border-top-right-radius: 8px;" onerror="this.style.display='none'" />`
          : `<div style="width: 100%; height: 65px; background: #f3f4f6; display: flex; align-items: center; justify-content: center; border-top-left-radius: 8px; border-top-right-radius: 8px; color: #d1d5db; font-size: 24px;">🍽</div>`
        }
        ${isSelected ? `<div style="position: absolute; top: 4px; right: 4px; width: 20px; height: 20px; border-radius: 10px; background: #ef4444; color: #fff; font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center;">1</div>` : ''}
        <div style="padding: 5px;">
          <div style="font-size: 11px; font-weight: 600; color: #1f2937; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">${addon.addon_item_name}</div>
          <div style="font-size: 11px; color: #667eea; font-weight: 600; margin-top: 2px;">$${(addon.addon_discount_price_cents / 100).toFixed(2)}</div>
          ${discountPct > 0 ? `<div style="font-size: 9px; color: #ef4444; margin-top: 1px;">-${discountPct}% off</div>` : ''}
        </div>
      `;

      addonCard.onclick = async () => {
        if (selectedDrawerAddons[addon.id]) {
          // Deselect
          selectedDrawerAddons[addon.id] = false;
          delete addonVariantSelections[addon.id];
          refreshAddonCards(item, addons, content);
        } else {
          // Select — fetch variants if needed
          selectedDrawerAddons[addon.id] = true;
          addonVariantSelections[addon.id] = {};
          if (!addonVariantData[addon.addon_item_id]) {
            try {
              const vRes = await fetch(`${API_BASE}/menu-items/${addon.addon_item_id}/variants`);
              if (vRes.ok) { addonVariantData[addon.addon_item_id] = await vRes.json(); }
              else { addonVariantData[addon.addon_item_id] = []; }
            } catch(e) { addonVariantData[addon.addon_item_id] = []; }
          }
          refreshAddonCards(item, addons, content);
        }
      };

      addonGrid.appendChild(addonCard);
    });

    addonSection.appendChild(addonGrid);

    // Render variant selections for selected addons
    renderAddonVariantSections(addons, addonSection);

    content.appendChild(addonSection);
  }

 // ---------- ADD TO CART BUTTON ----------
  const addBtn = document.createElement("button");
  addBtn.className = "add-btn";
  addBtn.textContent = t('menu.add-to-cart');
  addBtn.dataset.itemId = item.id;
  addBtn.disabled = !canAddToCart(item);
  addBtn.onclick = () => addToCart(item);

  content.appendChild(addBtn);

  return card;


}

function refreshAddonCards(item, addons, content) {
  // Remove old addon section and add button
  const oldSection = content.querySelector('.addon-section');
  const oldBtn = content.querySelector('.add-btn');
  if (oldSection) oldSection.remove();
  if (oldBtn) oldBtn.remove();

  // Re-render addon section
  if (addons && addons.length > 0) {
    const addonSection = document.createElement("div");
    addonSection.className = "addon-section";
    addonSection.innerHTML = `
      <div style="border-top: 1px solid #e5e7eb; margin-top: 12px; padding-top: 12px;">
        <div style="font-weight: 700; font-size: 14px; color: #1f2937; margin-bottom: 8px; text-transform: uppercase;">${t('menu.addons') || 'Add-ons'}</div>
      </div>
    `;

    const addonGrid = document.createElement("div");
    addonGrid.style.cssText = "display: flex; flex-wrap: wrap; gap: 10px;";

    addons.forEach(addon => {
      const discountPct = addon.regular_price_cents > 0
        ? Math.round(((addon.regular_price_cents - addon.addon_discount_price_cents) / addon.regular_price_cents) * 100)
        : 0;
      const isSelected = !!selectedDrawerAddons[addon.id];

      const addonCard = document.createElement("div");
      addonCard.className = "addon-card";
      addonCard.dataset.addonId = addon.id;
      addonCard.style.cssText = `width: 100px; border-radius: 10px; border: 2px solid ${isSelected ? '#667eea' : '#e5e7eb'}; background: ${isSelected ? '#f0f0ff' : '#fff'}; overflow: hidden; cursor: pointer; position: relative;`;

      addonCard.innerHTML = `
        ${addon.addon_item_image
          ? `<img src="${addon.addon_item_image}" style="width: 100%; height: 65px; object-fit: cover; border-top-left-radius: 8px; border-top-right-radius: 8px;" onerror="this.style.display='none'" />`
          : `<div style="width: 100%; height: 65px; background: #f3f4f6; display: flex; align-items: center; justify-content: center; border-top-left-radius: 8px; border-top-right-radius: 8px; color: #d1d5db; font-size: 24px;">🍽</div>`
        }
        ${isSelected ? `<div style="position: absolute; top: 4px; right: 4px; width: 20px; height: 20px; border-radius: 10px; background: #ef4444; color: #fff; font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center;">1</div>` : ''}
        <div style="padding: 5px;">
          <div style="font-size: 11px; font-weight: 600; color: #1f2937; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">${addon.addon_item_name}</div>
          <div style="font-size: 11px; color: #667eea; font-weight: 600; margin-top: 2px;">$${(addon.addon_discount_price_cents / 100).toFixed(2)}</div>
          ${discountPct > 0 ? `<div style="font-size: 9px; color: #ef4444; margin-top: 1px;">-${discountPct}% off</div>` : ''}
        </div>
      `;

      addonCard.onclick = async () => {
        if (selectedDrawerAddons[addon.id]) {
          selectedDrawerAddons[addon.id] = false;
          delete addonVariantSelections[addon.id];
          refreshAddonCards(item, addons, content);
        } else {
          selectedDrawerAddons[addon.id] = true;
          addonVariantSelections[addon.id] = {};
          if (!addonVariantData[addon.addon_item_id]) {
            try {
              const vRes = await fetch(`${API_BASE}/menu-items/${addon.addon_item_id}/variants`);
              if (vRes.ok) { addonVariantData[addon.addon_item_id] = await vRes.json(); }
              else { addonVariantData[addon.addon_item_id] = []; }
            } catch(e) { addonVariantData[addon.addon_item_id] = []; }
          }
          refreshAddonCards(item, addons, content);
        }
      };

      addonGrid.appendChild(addonCard);
    });

    addonSection.appendChild(addonGrid);

    // Render variant selections for selected addons
    renderAddonVariantSections(addons, addonSection);

    content.appendChild(addonSection);
  }

  // Re-add the button
  const addBtn = document.createElement("button");
  addBtn.className = "add-btn";
  addBtn.textContent = t('menu.add-to-cart');
  addBtn.dataset.itemId = item.id;
  addBtn.disabled = !canAddToCart(item);
  addBtn.onclick = () => addToCart(item);
  content.appendChild(addBtn);
}

// Render variant selection checkboxes for each selected addon
function renderAddonVariantSections(addons, container) {
  addons.forEach(addon => {
    if (!selectedDrawerAddons[addon.id]) return;
    const variants = addonVariantData[addon.addon_item_id] || [];
    if (variants.length === 0) return;

    const section = document.createElement("div");
    section.style.cssText = "margin-top: 10px; padding: 8px 10px; background: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;";
    section.innerHTML = `<div style="font-size: 12px; font-weight: 700; color: #667eea; margin-bottom: 6px;">${addon.addon_item_name}</div>`;

    variants.forEach(v => {
      const vDiv = document.createElement("div");
      vDiv.style.cssText = "margin-bottom: 6px;";
      vDiv.innerHTML = `<div style="font-size: 11px; font-weight: 600; color: #374151; margin-bottom: 3px;">${v.name}${v.required ? '<span style="color:red;"> *</span>' : ''}</div>`;

      (v.options || []).forEach(o => {
        const isUnavail = o.is_available === false;
        const selected = !isUnavail && (addonVariantSelections[addon.id]?.[v.id] || []).includes(o.id);
        const label = document.createElement("label");
        label.style.cssText = `display: flex; align-items: center; gap: 6px; font-size: 11px; color: #4b5563; margin-bottom: 2px; cursor: pointer;${isUnavail ? ' opacity: 0.4; pointer-events: none;' : ''}`;
        label.innerHTML = `
          <input type="checkbox" ${selected ? 'checked' : ''} ${isUnavail ? 'disabled' : ''} style="accent-color: #667eea;" />
          <span>${o.name}${isUnavail ? ' (Sold Out)' : ''}${o.price_cents > 0 ? ` (+$${(o.price_cents / 100).toFixed(2)})` : ''}</span>
        `;
        if (!isUnavail) {
          label.querySelector('input').onchange = function() {
            onAddonVariantChange(addon.id, v, o.id, this.checked);
          };
        }
        vDiv.appendChild(label);
      });

      section.appendChild(vDiv);
    });

    container.appendChild(section);
  });
}

// Handle addon variant checkbox change
function onAddonVariantChange(addonId, variant, optionId, checked) {
  if (!addonVariantSelections[addonId]) addonVariantSelections[addonId] = {};
  let selected = addonVariantSelections[addonId][variant.id] || [];

  if (checked) {
    if (variant.max_select && selected.length >= variant.max_select) {
      selected = selected.slice(1); // drop oldest
    }
    selected.push(optionId);
  } else {
    selected = selected.filter(id => id !== optionId);
  }
  addonVariantSelections[addonId][variant.id] = selected;

  // Update Add to Cart button state
  const btn = document.querySelector('.add-btn');
  if (btn) {
    const itemId = Number(btn.dataset.itemId);
    const item = window.menu && window.menu.items ? window.menu.items.find(i => i.id === itemId) : null;
    if (item) btn.disabled = !canAddToCart(item);
  }
}

function setActiveCategory(categoryId) {
  document.querySelectorAll(".category-item").forEach(el => {
    el.classList.remove("active");
  });

  const active = document.querySelector(
    `.category-item[data-category-id="${categoryId}"]`
  );

  if (active) {
    active.classList.add("active");
    active.scrollIntoView({ block: "nearest", behavior: "instant" });
  }
}

function initCategoryObserver(categories) {
  const menuEl = document.getElementById('menu');
  if (!menuEl) return;

  // Highlight the category whose header has most recently scrolled past
  // 25% from the top of the #menu element.
  const update = () => {
    const menuTop = menuEl.getBoundingClientRect().top;
    const triggerY = menuTop + menuEl.clientHeight * 0.25;
    let activeId = null;

    categories.forEach(cat => {
      const el = document.getElementById(`category-${cat.id}`);
      if (!el) return;
      if (el.getBoundingClientRect().top <= triggerY) {
        activeId = String(cat.id);
      }
    });

    if (activeId !== null) setActiveCategory(activeId);
  };

  menuEl.addEventListener('scroll', update, { passive: true });

  // Set initial highlight
  if (categories.length > 0) setActiveCategory(String(categories[0].id));
}

function addToCart(item) {
  const selectedOptions = [];
  const variantDetails = [];
  let extraPrice = 0;
  
  if (Array.isArray(item.variants)) {
    item.variants.forEach(v => {
      const selectedIds = variantSelections[item.id]?.[v.id] || [];

      if (v.required && selectedIds.length === 0) {
        alert(`Please select ${v.name}`);
        throw new Error("Missing required variant");
      }

      if (v.max_select && selectedIds.length > v.max_select) {
        alert(`You can only select ${v.max_select} for ${v.name}`);
        throw new Error("Too many selections");
      }

      selectedIds.forEach(optionId => {
        const option = v.options.find(o => o.id === optionId);
        if (option && option.is_available === false) {
          alert(`${option.name} is no longer available`);
          throw new Error("Unavailable option selected");
        }

        selectedOptions.push(optionId);
        variantDetails.push({
          variant: v.name,
          option: option.name
        });

        extraPrice += option.price_cents || 0;
      });
    });
  }

  // Validate addon variant requirements
  for (const addon of drawerAddons) {
    if (!selectedDrawerAddons[addon.id]) continue;
    const variants = addonVariantData[addon.addon_item_id] || [];
    for (const v of variants) {
      const selected = (addonVariantSelections[addon.id]?.[v.id] || []).length;
      const min = v.min_select != null ? v.min_select : (v.required ? 1 : 0);
      if (selected < min) {
        alert(`Please select ${v.name} for ${addon.addon_item_name}`);
        throw new Error("Missing required addon variant");
      }
    }
  }

  const existing = cart.items.find(
    c =>
      c.menuItemId === item.id &&
      JSON.stringify(c.variantOptionIds) === JSON.stringify(selectedOptions)
  );

  if (existing) {
    existing.quantity += 1;
    closeAllDrawers();
    saveCartToStorage();
    updateCartBar();
    updateCartBadges();
  } else {
    const cartItem = {
      menuItemId: item.id,
      name: item.name,
      image_url: item.image_url || null,
      quantity: 1,
      basePriceCents: item.price_cents,
      totalPriceCents: item.price_cents + extraPrice,
      variantOptionIds: selectedOptions,
      variantOptionDetails: variantDetails,
      addons: []
    };
    
    cart.items.push(cartItem);

    // Add selected addons from inline drawer selection
    if (drawerAddons.length > 0) {
      const selectedAddonItems = drawerAddons.filter(a => selectedDrawerAddons[a.id]);
      selectedAddonItems.forEach(addon => {
        const addonSelectedOpts = [];
        const addonVarDetails = [];
        const variants = addonVariantData[addon.addon_item_id] || [];
        const selections = addonVariantSelections[addon.id] || {};
        variants.forEach(v => {
          const optIds = selections[v.id] || [];
          optIds.forEach(optId => {
            const opt = (v.options || []).find(o => o.id === optId);
            if (opt) {
              addonSelectedOpts.push(optId);
              addonVarDetails.push({ variant: v.name, option: opt.name });
            }
          });
        });
        cartItem.addons.push({
          addonId: addon.id,
          addonItemId: addon.addon_item_id,
          name: addon.addon_item_name,
          priceCents: addon.addon_discount_price_cents,
          quantity: 1,
          selected_option_ids: addonSelectedOpts,
          variantDetails: addonVarDetails
        });
      });
    }

    closeAllDrawers();
    saveCartToStorage();
    updateCartBar();
    updateCartBadges();
  }
}

// ============ CART PERSISTENCE ============
function saveCartToStorage() {
  try {
    localStorage.setItem(`cart_${sessionId}`, JSON.stringify(cart));
  } catch (e) {
    console.error("Failed to save cart:", e);
  }
}

function loadCartFromStorage() {
  try {
    const stored = localStorage.getItem(`cart_${sessionId}`);
    if (stored) {
      cart = JSON.parse(stored);
      console.log("Loaded cart from storage:", cart);
    }
  } catch (e) {
    console.error("Failed to load cart:", e);
  }
}

function canAddToCart(item) {
  if (!item.variants || item.variants.length === 0) {
    // still check addon variants
  } else {
    for (const v of item.variants) {
      const selected =
        (variantSelections[item.id] && variantSelections[item.id][v.id]) ? variantSelections[item.id][v.id].length : 0;

      const min = v.min_select != null ? v.min_select : (v.required ? 1 : 0);

      if (selected < min) {
        return false;
      }
    }
  }

  // Check addon variant requirements
  for (const addon of drawerAddons) {
    if (!selectedDrawerAddons[addon.id]) continue;
    const variants = addonVariantData[addon.addon_item_id] || [];
    for (const v of variants) {
      const selected = (addonVariantSelections[addon.id]?.[v.id] || []).length;
      const min = v.min_select != null ? v.min_select : (v.required ? 1 : 0);
      if (selected < min) return false;
    }
  }

  return true;
}

function updateAddToCartButton(item) {
  const btn = document.querySelector(
    `button[data-item-id="${item.id}"]`
  );

  if (!btn) return;

  btn.disabled = !canAddToCart(item);
}

function updateVariantCounter(itemId, variant) {
  const selected =
    (variantSelections[itemId] && variantSelections[itemId][variant.id]) ? variantSelections[itemId][variant.id] : [];

  const count = selected.length;

  const counterEl = document.getElementById(
    `variant-counter-${itemId}-${variant.id}`
  );

  if (counterEl) {
    if (variant.max_select) {
      counterEl.textContent = `${count} / ${variant.max_select} selected`;
    } else {
      counterEl.textContent = `${count} selected`;
    }
  }

  // 🔥 THIS IS THE MISSING PART 🔥
  const inputs = document.querySelectorAll(
    `input[data-item-id="${itemId}"][data-variant-id="${variant.id}"]`
  );

  // 1️⃣ ALWAYS reset disabled state first (except unavailable options)
  inputs.forEach(input => {
    if (input.dataset.unavailable === 'true') return;
    input.removeAttribute("disabled");
    input.disabled = false;
  });

  // 2️⃣ Apply max_select rule ONLY if max reached
  if (variant.max_select && count >= variant.max_select) {
    inputs.forEach(input => {
      const optionId = Number(input.value);
      if (!selected.includes(optionId)) {
        input.disabled = true;
      }
    });
  }
}

async function submitOrder() {
  if (!cart.items.length) return;

  const payload = {
    items: cart.items.map(i => ({
      menu_item_id: i.menuItemId,
      quantity: i.quantity,
      selected_option_ids: i.variantOptionIds || [],
      addons: (i.addons || []).map(a => ({
        addon_id: a.addonId,
        quantity: a.quantity || 1,
        selected_option_ids: a.selected_option_ids || []
      }))
    }))
  };

  const res = await fetch(
    `${API_BASE}/sessions/${sessionId}/orders`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }
  );

  if (!res.ok) {
    const err = await res.json();
    alert(err.error || "Order failed");
    return;
  }

  const orderData = await res.json();
  const orderId = orderData.order_id;

  cart.items = [];
  saveCartToStorage();
  updateCartBar();
  closeAllDrawers();

  // Store the latest order ID for Pay Now
  lastOrderId = orderId;

  // Refresh payment settings then navigate to orders drawer
  await fetchAndApplyPaymentSettings();

  // Always navigate to orders drawer after placing order
  openOrdersDrawer();
}

function onVariantChange(itemId, variantId, optionId, checked) {
  if (!variantSelections[itemId]) {
    variantSelections[itemId] = {};
  }

  const item = window.menu.items.find(i => i.id === itemId);
  const variant = item.variants.find(v => v.id === variantId);

  let selected = variantSelections[itemId][variantId] || [];

  // ------------------------------
  // EXACT MODE (min === max)
  // ------------------------------
  if (
    variant.min_select !== null &&
    variant.max_select !== null &&
    variant.min_select === variant.max_select
  ) {
    if (checked) {
      selected = [optionId];

      // force UI sync
      document
        .querySelectorAll(
          `input[data-item-id="${itemId}"][data-variant-id="${variantId}"]`
        )
        .forEach(input => {
          input.checked = Number(input.value) === optionId;
        });
    } else {
      // prevent unchecking below min
      selected = [];
    }
  }

  // ------------------------------
  // NORMAL MULTI MODE
  // ------------------------------
  else {
    if (checked) {
      if (variant.max_select && selected.length >= variant.max_select) {
        // undo UI change
        const input = document.querySelector(
          `input[data-item-id="${itemId}"][data-variant-id="${variantId}"][value="${optionId}"]`
        );
        if (input) input.checked = false;
        return;
      }
      selected.push(optionId);
    } else {
      selected = selected.filter(id => id !== optionId);
    }
  }

  variantSelections[itemId][variantId] = selected;

  // ------------------------------
  // Disable unchecked when max reached
  // ------------------------------
if (variant.max_select) {
  document
    .querySelectorAll(
      `input[data-item-id="${itemId}"][data-variant-id="${variantId}"]`
    )
    .forEach(input => {
      const id = Number(input.value);

    });
}


  updateVariantCounter(itemId, variant);
  updateAddToCartButton(item);
}

async function loadOrderStatus() {
  if (!sessionId) {
    console.warn("❌ loadOrderStatus: No sessionId");
    return;
  }
  if (paymentPageActive) return; // don't overwrite the inline payment page

  try {
    const url = `${API_BASE}/sessions/${sessionId}/orders?restaurantId=${restaurantId}`;
    console.log("📡 Fetching orders from:", url);
    
    const res = await fetch(url);
    console.log("📥 Response status:", res.status);

    if (!res.ok) {
      console.warn("❌ API returned:", res.status, res.statusText);
      return;
    }

    const data = await res.json();
    console.log("✅ Orders loaded:", data);
    renderOrdersDrawer(data.items || [], tableName);
  } catch (error) {
    console.error("❌ Error loading orders:", error);
  }
}

function renderOrdersDrawer(orders, tableName) {
  const el = document.getElementById("orders-drawer-content");
  if (!el) {
    console.error("❌ orders-drawer-content element not found");
    return;
  }

  console.log("✅ renderOrdersDrawer called with", orders.length, "orders for table:", tableName);

  let subtotal = 0;

  let html = `
    <div class="orders-body">
    <div class="orders-items">
  `;

  if (!orders.length) {
    html += `<p class="no-orders">📋 No orders yet</p>`;
  } else {
    orders.forEach((order, oIdx) => {
      console.log(`📦 Order ${oIdx}:`, order);
      const isCompleted = order.order_status === 'completed';
      const isPAPayment = order.order_payment_method === 'payment-asia';
      const isPAInProgress = isPAPayment && !isCompleted; // PA initiated, webhook not yet confirmed
      const isPaid = isCompleted;                          // fully confirmed by DB
      const isHandledByPA = isPAPayment;                  // PA initiated (paid or processing)

      if (isHandledByPA) {
        const payLabel = isCompleted ? '💳 Paid via Payment Asia' : '⏳ Payment Processing via Payment Asia';
        const bg = isCompleted ? '#d1fae5' : '#fef3c7';
        const border = isCompleted ? '#10b981' : '#f59e0b';
        const color = isCompleted ? '#065f46' : '#92400e';
        html += `<div style="margin:12px 0 0;padding:6px 10px;background:${bg};border-left:3px solid ${border};border-radius:0 4px 4px 0;font-size:12px;color:${color};font-weight:600;">📦 Order #${order.order_id} — ${payLabel}</div>`;
        html += `<div style="opacity:0.65;">`;
      } else if (isPaid) {
        html += `<div style="margin:12px 0 0;padding:6px 10px;background:#d1fae5;border-left:3px solid #10b981;border-radius:0 4px 4px 0;font-size:12px;color:#065f46;font-weight:600;">📦 Order #${order.order_id} — ✅ Paid</div>`;
        html += `<div style="opacity:0.65;">`;
      } else if (oIdx > 0) {
        html += `<div style="font-size:12px;color:#666;margin:8px 0 4px;font-weight:600;">Order #${order.order_id} <span style="margin-left:8px;padding:2px 8px;background:#f3f4f6;color:#374151;border-radius:10px;font-size:11px;">Unpaid</span></div>`;
      }

      order.items.forEach(item => {
        const line = item.item_total_cents || (item.unit_price_cents * item.quantity) || 0;
        subtotal += line;

        const itemName = item.menu_item_name || item.name || 'Unknown';
        const menuItem = window.menu && window.menu.items
          ? window.menu.items.find(i => i.id === item.menu_item_id || i.name === itemName)
          : null;
        const thumbUrl = menuItem && menuItem.image_url ? menuItem.image_url : null;
        const thumbHtml = thumbUrl
          ? `<img class="order-item-thumb" src="${thumbUrl}" alt="${itemName}" loading="lazy">`
          : `<div class="order-item-thumb order-item-thumb-placeholder"></div>`;
        const addonTotal = (item.addons || []).reduce((sum, a) => sum + (Number(a.item_total_cents) || Number(a.unit_price_cents) * Number(a.quantity) || 0), 0);
        subtotal += addonTotal;
        const addonsHtml = item.addons && item.addons.length > 0 
          ? item.addons.map(addon => {
            const addonPrice = Number(addon.item_total_cents) || Number(addon.unit_price_cents) * Number(addon.quantity) || 0;
            const addonVarHtml = addon.variants ? `<div style="font-size: 10px; color: #9ca3af; margin-left: 20px;">${addon.variants}</div>` : '';
            return `<div style="font-size: 11px; color: #667eea; margin-left: 12px; margin-top: 2px;">+ ${(addon.menu_item_name || addon.name || 'Addon')} x${addon.quantity} <span style="color:#888;">$${(addonPrice / 100).toFixed(2)}</span></div>${addonVarHtml}`;
          }).join('')
          : '';

        html += `
          <div class="order-item">
            ${thumbHtml}
            <div class="order-item-body">
            <div class="order-line">
              <span class="item-name">${itemName}</span>
              <span class="item-quantity">×${item.quantity}</span>
              <span class="item-price">$${(line / 100).toFixed(2)}</span>
            </div>
            ${item.variants ? `<div class="item-variants">${item.variants}</div>` : ""}
            ${addonsHtml}
            <div class="item-status status-${item.status}">${showItemStatusToDiners ? `(${({'pending':'sending','preparing':'preparing','served':'delivered','completed':'delivered'})[item.status]||item.status})` : ''}</div>
            </div>
          </div>
        `;
      });

      if (isHandledByPA || isPaid) html += `</div>`; // end opacity wrapper
    });
  }
  serviceCharge = subtotal/100 * serviceChargePct;
  const discountCents = appliedCoupon ? appliedCoupon.discount_cents : 0;
  const total = subtotal + serviceCharge - discountCents;

  html += `
    </div>
    </div>
    <div class="orders-footer">
    <div class="orders-summary">
      <div class="summary-line">
        <span>${t('menu.subtotal-label')}</span>
        <span>$${(subtotal / 100).toFixed(2)}</span>
      </div>
      <div class="summary-line">
        <span>${t('menu.service-charge-label')} (${serviceChargePct}%)</span>
        <span>$${(serviceCharge / 100).toFixed(2)}</span>
      </div>
      ${discountCents > 0 ? `
      <div class="summary-line" style="color:#059669;">
        <span>Coupon (${appliedCoupon.code})</span>
        <span>-$${(discountCents / 100).toFixed(2)}</span>
      </div>` : ''}
      <div class="summary-line total">
        <strong>${t('menu.total-label')}</strong>
        <strong id="orders-total-display">$${(total / 100).toFixed(2)}</strong>
      </div>
    </div>
    <div class="coupon-section">
      <div class="coupon-row">
        <span class="coupon-label">${t('menu.coupon-code') || 'Coupon Code'}</span>
        <div class="coupon-input-group">
          <input type="text" id="orders-coupon-input" placeholder="CODE" value="${appliedCoupon ? appliedCoupon.code : ''}" />
          <button onclick="applyCouponToOrders()" class="coupon-apply-btn">${t('menu.apply-coupon') || 'Apply'}</button>
        </div>
      </div>
      <div id="orders-coupon-display">${appliedCoupon ? `<div class="coupon-applied">${t('menu.coupon-applied').replace('{0}', '-$' + (appliedCoupon.discount_cents/100).toFixed(2))}</div>` : ''}</div>
    </div>
    <div class="orders-actions">
      ${(() => {
        // Exclude orders where PA payment was already initiated (payment_method = 'payment-asia')
        const unpaidNonPAOrder = orders.filter(o =>
          o.order_status !== 'completed' && o.order_payment_method !== 'payment-asia'
        ).slice(-1)[0];
        const allPACompleted = orders.length > 0 && orders.every(o =>
          o.order_status === 'completed' && o.order_payment_method === 'payment-asia'
        );
        // PA orders that are genuinely in-flight (not failed — backend clears payment_method on failure)
        const hasPendingPAOrder = orders.some(o =>
          o.order_payment_method === 'payment-asia' && o.order_status !== 'completed'
        );
        if (orderPayEnabled && unpaidNonPAOrder) {
          return `<button class="btn-primary" onclick="showPaymentPage(${unpaidNonPAOrder.order_id})">Pay Now</button>`;
        }
        if (allPACompleted) {
          return `<button class="btn-primary" style="background:#059669;" onclick="endSessionFromMenu()">✅ End Session</button>`;
        }
        if (hasPendingPAOrder) {
          // PA initiated but webhook not yet confirmed — prevent double-pay
          return `<button class="btn-primary" style="background:#f59e0b;color:#000;" disabled>⏳ Payment Processing...</button>`;
        }
        if (orderPayEnabled) {
          // Order & Pay mode but no unpaid order yet — nothing to pay
          return `<button class="btn-primary" disabled style="opacity:0.5;">Pay Now</button>`;
        }
        return `<button class="btn-primary" id="close-bill-btn" onclick="closeBill()">${t('menu.close-bill')}</button>`;
      })()}
      <button class="btn-secondary" id="call-staff-btn" onclick="callStaff()">${t('menu.call-staff')}</button>
    </div>
    </div>
  `;

  el.innerHTML = html;
}

function renderCartDrawer() {
  const el = document.getElementById("cart-drawer-content");

  if (!cart.items.length) {
    el.innerHTML = '<div class="empty-cart"><p>' + t('menu.cart-empty') + '</p></div>';
    return;
  }

  let subtotal = 0;

  let html = '<div class="cart-items">';
  html += cart.items.map((item, idx) => {
    const addonTotal = (item.addons || []).reduce((s, a) => s + (a.priceCents || 0) * (a.quantity || 1), 0);
    const line = (item.totalPriceCents + addonTotal) * item.quantity;
    subtotal += line;

    const addonsHtml = (item.addons || []).map(a => {
      const varHtml = (a.variantDetails || []).map(v => 
        `<div style="font-size: 10px; color: #9ca3af; padding-left: 12px;">${v.variant}: ${v.option}</div>`
      ).join('');
      return `<div style="font-size: 11px; color: #667eea; margin-top: 2px; padding-left: 4px;">+ ${a.name} <span style="color:#888;">$${(a.priceCents / 100).toFixed(2)}</span></div>${varHtml}`;
    }).join('');

    return `
      <div class="cart-item">
        <div class="cart-item-body">
          ${item.image_url ? `<img class="order-item-thumb" src="${item.image_url}" alt="${item.name}" loading="lazy">` : ''}
          <div class="cart-item-details">
            <div class="cart-item-header">
              <strong>${item.name}</strong>
              <span class="cart-item-price">$${(line / 100).toFixed(2)}</span>
            </div>
            ${item.variantOptionDetails ? item.variantOptionDetails.map(function(v) { return `<div class="cart-item-variant">${v.variant}: ${v.option}</div>`; }).join("") : ""}
            ${addonsHtml}
            <div class="qty-controls">
              <button class="qty-btn" onclick="updateCartQty(${idx}, -1)">−</button>
              <span class="qty-display">${item.quantity}</span>
              <button class="qty-btn" onclick="updateCartQty(${idx}, 1)">+</button>
              <button class="qty-btn danger" onclick="removeCartItem(${idx})">🗑</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join("");
  html += '</div>';

  const serviceCharge = Math.round(subtotal * serviceChargePct / 100);
  const total = subtotal + serviceCharge;

  html += `
    <div class="cart-footer">
      <div class="cart-summary">
        <div class="summary-line">
          <span>${t('menu.subtotal-label')}:</span>
          <span>$${(subtotal / 100).toFixed(2)}</span>
        </div>
        ${serviceChargePct > 0 ? `
          <div class="summary-line">
            <span>${t('menu.service-charge-label')} (${serviceChargePct}%):</span>
            <span>$${(serviceCharge / 100).toFixed(2)}</span>
          </div>
        ` : ''}
        <div class="cart-total">
          <span>${t('menu.total-label')}:</span>
          <strong id="cart-total-display">$${(total / 100).toFixed(2)}</strong>
        </div>
      </div>
      <button class="btn-primary cart-submit" onclick="submitOrder()">${t('menu.confirm-order')}</button>
    </div>
  `;

  el.innerHTML = html;
}

function updateCartQty(index, delta) {
  const item = cart.items[index];
  if (!item) return;

  item.quantity += delta;

  if (item.quantity <= 0) {
    cart.items.splice(index, 1);
  }

  updateCartBar();
  saveCartToStorage();
  renderCartDrawer();
}

function removeCartItem(index) {
  cart.items.splice(index, 1);
  updateCartBar();
  saveCartToStorage();
  renderCartDrawer();
}

function openCartDrawer() {
    closeAllDrawers();

  activeDrawer = document.getElementById("cart-drawer");
  const overlay = document.getElementById("drawer-overlay");

  activeDrawer.classList.add("open");
  overlay.classList.add("open");
  setCartBarVisible(false);

  renderCartDrawer();
  initDrawerSwipe("cart-drawer");
}

function updateCartBar() {
  const btn = document.getElementById("confirm-order-btn");
  const countEl = document.getElementById("cart-count");
  const totalEl = document.getElementById("cart-total");

  const count = cart.items.reduce((s, i) => s + i.quantity, 0);
  const subtotalCents = cart.items.reduce(
    (sum, i) => {
      const addonTotal = (i.addons || []).reduce((s, a) => s + (a.priceCents || 0) * (a.quantity || 1), 0);
      return sum + (i.totalPriceCents + addonTotal) * i.quantity;
    },
    0
  );
  const serviceCharge = Math.round(subtotalCents * serviceChargePct / 100);
  const totalCents = subtotalCents + serviceCharge;

  countEl.textContent = `${count} item${count !== 1 ? "s" : ""}`;
  totalEl.textContent = `$${(totalCents / 100).toFixed(2)}`;

  btn.disabled = count === 0;
  updateCartBadges();
}

async function openDrawer(itemId) {
  closeAllDrawers();

  const item = window.menu.items.find(i => i.id === itemId);
  if (!item) return;

  // Reset addon state
  drawerAddons = [];
  selectedDrawerAddons = {};
  addonVariantData = {};
  addonVariantSelections = {};

  // Fetch addons for combo items
  if (item.is_meal_combo) {
    try {
      const res = await fetch(
        `${API_BASE}/restaurants/${restaurantId}/menu-items/${item.id}/addons`
      );
      if (res.ok) {
        drawerAddons = await res.json();
      }
    } catch (e) {
      console.error('Failed to load addons:', e);
    }
  }

  activeDrawer = document.getElementById("item-drawer");
  const content = activeDrawer.querySelector(".drawer-content");

  content.innerHTML = ""; // FULL RESET

  const itemUI = renderMenuItemWithVariants(item, drawerAddons);
  itemUI.classList.add("drawer-item"); // important
  content.appendChild(itemUI);

  activeDrawer.classList.add("open");
  setCartBarVisible(false);

  content.scrollTop = 0;
}

function initDrawerSwipe(drawerId = "item-drawer") {
  // Swipe disabled — drawers use instant display:none/flex
}

// ============ HEADER MODE (orders/payment vs normal menu) ============

function setCartBarVisible(visible) {
  const bar = document.getElementById('cart-bar');
  if (!bar) return;
  if (visible) bar.classList.remove('hidden');
  else bar.classList.add('hidden');
}
function setHeaderOrdersMode(active, isPayment = false) {
  const backBtn        = document.getElementById('header-back-btn');
  const pageTitle      = document.getElementById('header-page-title');
  const tableIndicator = document.getElementById('table-indicator');
  const searchContainer= document.getElementById('search-container');
  const headerRight    = document.querySelector('.header-right-menu');
  const headerTableName= document.getElementById('header-table-name');

  const show = el => el && (el.style.display = '');
  const hide = el => el && (el.style.display = 'none');

  if (active) {
    show(backBtn);
    show(pageTitle);
    show(headerTableName);
    hide(tableIndicator);
    hide(searchContainer);
    hide(headerRight);

    pageTitle.textContent = isPayment ? t('menu.payment') || 'Payment' : t('menu.check-orders') || 'Check Orders';
    headerTableName.textContent = `${t('menu.table-label') || 'Table'} ${tableName}`;
  } else {
    hide(backBtn);
    hide(pageTitle);
    hide(headerTableName);
    show(tableIndicator);
    show(searchContainer);
    show(headerRight);
  }
}

function headerBackAction() {
  if (paymentPageActive) {
    showPaymentPageBack();
  } else {
    closeAllDrawers();
  }
}

function openOrdersDrawer() {
  // Don't disrupt an active payment screen session
  if (paymentPageActive) return;

  closeAllDrawers();

  activeDrawer = document.getElementById("orders-drawer");

  activeDrawer.classList.add("open");

  setHeaderOrdersMode(true, false);
  setCartBarVisible(false);

  // 🔥 render immediately using latest polled data
  loadOrderStatus();
}


function initOrdersDrawerSwipe_disabled() {
  const drawer = document.getElementById("orders-drawer");
  if (!drawer || drawer.dataset.swipeInit) return;
  drawer.dataset.swipeInit = "true";

  // Orders drawer slides in from the RIGHT (translateX), not bottom.
  // Swipe right-to-close only — do NOT reuse initTouchSwipe (which applies
  // translateX(-50%) translateY(delta) and breaks the layout).
  let startX = 0;
  drawer.addEventListener("touchstart", e => {
    if (drawer !== activeDrawer) return;
    if (isInteractiveElement(e.target)) return;
    startX = e.touches[0].clientX;
    drawer.style.transition = "none";
  }, { passive: true });

  drawer.addEventListener("touchmove", e => {
    if (drawer !== activeDrawer) return;
    const delta = e.touches[0].clientX - startX;
    if (delta <= 0) return; // only allow rightward drag
    drawer.style.transform = `translateX(${delta}px)`;
  }, { passive: true });

  drawer.addEventListener("touchend", e => {
    if (drawer !== activeDrawer) return;
    const delta = e.changedTouches[0].clientX - startX;
    drawer.style.transition = "transform 0.3s ease";
    if (delta > 100) {
      closeActiveDrawer();
    } else {
      drawer.style.transform = "";
    }
  });
}

function isInteractiveElement(el) {
  return (
    el.tagName === "INPUT" ||
    el.tagName === "LABEL" ||
    el.tagName === "BUTTON" ||
    el.closest(".variant-group")
  );
}

function isTouchDevice() {
  return (
    "ontouchstart" in window ||
    navigator.maxTouchPoints > 0
  );
}

function initTouchSwipe_disabled(drawer) {
  drawer.addEventListener("touchstart", e => {
    if (drawer !== activeDrawer) return;
    if (isInteractiveElement(e.target)) return;

    touchStartY = e.touches[0].clientY;
    drawer.style.transition = "none";
  }, { passive: true });

  drawer.addEventListener("touchmove", e => {
    if (drawer !== activeDrawer) return;
    if (isInteractiveElement(e.target)) return;

    touchCurrentY = e.touches[0].clientY;
    const delta = touchCurrentY - touchStartY;
    if (delta < 0) return;

    drawer.style.transform = `translateX(-50%) translateY(${delta}px)`;
    e.preventDefault();
  }, { passive: false });

  drawer.addEventListener("touchend", () => {
    if (drawer !== activeDrawer) return;

    const delta = touchCurrentY - touchStartY;
    drawer.style.transition = "transform 0.25s ease";

    if (delta > 120) {
      closeActiveDrawer();
    } else {
      drawer.style.transform = "";
    }
  });
}

function initMouseSwipe_disabled(drawer) {
  drawer.addEventListener("mousedown", e => {
    if (drawer !== activeDrawer) return;

    dragging = true;
    mouseStartY = e.clientY;
    drawer.style.transition = "none";
  });

  window.addEventListener("mousemove", e => {
    if (!dragging || drawer !== activeDrawer) return;

    mouseCurrentY = e.clientY;
    const delta = mouseCurrentY - mouseStartY;
    if (delta < 0) return;

    drawer.style.transform = `translateX(-50%) translateY(${delta}px)`;
  });

  window.addEventListener("mouseup", () => {
    if (!dragging || drawer !== activeDrawer) return;

    dragging = false;
    const delta = mouseCurrentY - mouseStartY;

    drawer.style.transition = "transform 0.25s ease";

    if (delta > 120) {
      closeActiveDrawer();
    } else {
      drawer.style.transform = "";
    }
  });
}

function closeAllDrawers() {
  ["item-drawer", "orders-drawer", "cart-drawer"].forEach(id => {
    const d = document.getElementById(id);
    if (!d) return;
    d.classList.remove("open");
  });

  // Also close payment screen
  const paymentScreen = document.getElementById('payment-screen');
  if (paymentScreen) {
    paymentScreen.classList.remove('open');
    document.getElementById('payment-screen-content').innerHTML = '';
  }
  paymentPageActive = false;

  const drawerOverlay = document.getElementById("drawer-overlay");
  if (drawerOverlay) drawerOverlay.classList.remove("open");
  activeDrawer = null;

  setHeaderOrdersMode(false);
  setCartBarVisible(true);
}

function closeActiveDrawer() {
  if (!activeDrawer) return;

  activeDrawer.classList.remove("open");

  document.getElementById("drawer-overlay")?.classList.remove("open");

  // Clear payment page flag when orders drawer is closed
  if (activeDrawer.id === "orders-drawer") {
    paymentPageActive = false;
  }

  activeDrawer = null;
  setCartBarVisible(true);
}

function startOrderPolling() {
  if (orderPollerStarted) return;
  orderPollerStarted = true;

  loadOrderStatus(); // immediate
  setInterval(loadOrderStatus, 5000);
}

// ============= COUPON FUNCTIONS =============
function applyCouponToCart() {
  const couponCode = document.getElementById("cart-coupon-input").value.trim().toUpperCase();
  if (!couponCode) {
    alert(t('menu.enter-coupon'));
    return;
  }
  
  // Store coupon in session storage for use during order submission
  sessionStorage.setItem("pendingCouponCode", couponCode);
  
  // Display applied coupon
  const displayEl = document.getElementById("cart-coupon-display");
  displayEl.innerHTML = `<div class="coupon-applied">${t('menu.coupon-will-apply').replace('{0}', couponCode)}</div>`;
}

function applyCouponToOrders() {
  const couponCode = document.getElementById("orders-coupon-input").value.trim().toUpperCase();
  if (!couponCode) {
    alert(t('menu.enter-coupon'));
    return;
  }
  
  if (!sessionId) {
    alert(t('menu.session-not-found'));
    return;
  }
  
  applyCouponToSession(sessionId, couponCode);
}

async function applyCouponToSession(sessionId, couponCode) {
  try {
    const response = await fetch(`${API_BASE}/sessions/${sessionId}/apply-coupon`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ coupon_code: couponCode })
    });
    
    const data = await response.json();
    const displayEl = document.getElementById("orders-coupon-display");
    
    if (response.ok) {
      appliedCoupon = {
        code: data.coupon_code,
        discount_cents: data.discount_applied_cents,
        discount_type: data.discount_type,
        discount_value: data.discount_value
      };
      displayEl.innerHTML = `<div class="coupon-applied">${t('menu.coupon-applied').replace('{0}', '-$' + (data.discount_applied_cents/100).toFixed(2))}</div>`;
      // Refresh orders drawer to show updated total
      loadOrderStatus();
    } else {
      displayEl.innerHTML = `<div class="coupon-error">${t('menu.coupon-error').replace('{0}', data.error)}</div>`;
    }
  } catch (error) {
    console.error("Error applying coupon:", error);
    document.getElementById("orders-coupon-display").innerHTML = `<div class="coupon-error">${t('menu.coupon-failed')}</div>`;
  }
}

async function removeCouponFromSession(sid) {
  try {
    const response = await fetch(`${API_BASE}/sessions/${sid}/remove-coupon`, {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    });
    
    if (response.ok) {
      appliedCoupon = null;
      loadOrderStatus();
    }
  } catch (error) {
    console.error("Error removing coupon:", error);
  }
}

async function callStaff() {
  if (!sessionId || !restaurantId) return;
  try {
    const res = await fetch(`${API_BASE}/sessions/${sessionId}/call-staff`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restaurantId, call_staff_requested: true })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('Failed to call staff:', err);
      return;
    }
    const btn = document.getElementById('call-staff-btn');
    if (btn) {
      btn.textContent = t('menu.call-staff-sent');
      btn.disabled = true;
      btn.style.opacity = '0.7';
    }
  } catch (e) {
    console.error('Error calling staff:', e);
  }
}

async function closeBill() {
  if (!sessionId) {
    console.error("❌ No session ID for requesting bill closure");
    return;
  }

  if (!restaurantId) {
    console.error("❌ No restaurant ID for requesting bill closure");
    return;
  }

  try {
    console.log("📡 Requesting bill closure for session:", sessionId);
    
    // Update session to mark bill closure as requested (but don't close the session)
    const res = await fetch(`${API_BASE}/sessions/${sessionId}/request-bill-closure`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        restaurantId: restaurantId,
        bill_closure_requested: true
      })
    });

    if (!res.ok) {
      const error = await res.json();
      console.error("❌ Failed to request bill closure:", error);
      alert("Failed to request bill closure: " + (error.error || "Unknown error"));
      return;
    }

    console.log("✅ Bill closure requested - admin will see orange table card");
    
    // Change button to show request sent
    const btn = document.getElementById("close-bill-btn");
    if (btn) {
      btn.style.backgroundColor = "#fbbf24";
      btn.style.color = "#000";
      btn.textContent = t('menu.bill-request-sent');
      btn.disabled = true;
    }

    alert(t('menu.close-bill-requested'));
  } catch (error) {
    console.error("❌ Error closing bill:", error);
    alert("Error requesting bill closure");
  }
}

async function endSessionFromMenu() {
  if (!sessionId) return;
  const msg = t('menu.end-session-confirm') || 'Your payment is complete. End your dining session now?';
  if (!confirm(msg)) return;
  try {
    const res = await fetch(`${API_BASE}/table-sessions/${sessionId}/end`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert('Failed to end session: ' + (err.error || 'Unknown error'));
      return;
    }
    closeAllDrawers();
    // Return to landing page
    document.getElementById('app').style.display = 'none';
    document.getElementById('landing-page').style.display = 'flex';
  } catch (e) {
    console.error('❌ Error ending session:', e);
    alert('Error ending session');
  }
}

async function printMenuBill() {
  if (!sessionId) {
    alert("Session not found");
    return;
  }
  
  try {
    const res = await fetch(`/api/sessions/${sessionId}/bill`);
    if (!res.ok) return alert("Failed to load bill");

    const bill = await res.json();
    const win = window.open("", "_blank");
    
    let itemsHTML = '';
    bill.items.forEach(i => {
      const lineTotal = ((i.price_cents || i.unit_price_cents || 0) * i.quantity / 100).toFixed(2);
      itemsHTML += `<div class="item-row"><div class="item-name">${i.name || i.item_name}</div><div class="item-qty">x${i.quantity}</div><div class="item-price">$${lineTotal}</div></div>`;
      if (i.addons && i.addons.length > 0) {
        i.addons.forEach(a => {
          const addonTotal = (a.price_cents * a.quantity / 100).toFixed(2);
          itemsHTML += `<div class="item-row" style="padding-left:12px;font-size:11px;color:#667eea;"><div class="item-name">+ ${a.name}</div><div class="item-qty">x${a.quantity}</div><div class="item-price">$${addonTotal}</div></div>`;
        });
      }
    });
    
    const serviceChargeHTML = bill.service_charge_cents ? `<div class="summary-row"><span>Service Charge:</span><span>$${(bill.service_charge_cents / 100).toFixed(2)}</span></div>` : '';
    const discountHTML = bill.discount_applied_cents ? `<div class="summary-row discount"><span>Discount:</span><span>-$${(bill.discount_applied_cents / 100).toFixed(2)}</span></div>` : '';
    
    const billHTML = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <title>Receipt</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: 'Courier New', monospace; width: 300px; padding: 12px; background: #fff; }
      .receipt { width: 100%; text-align: center; font-size: 13px; line-height: 1.4; }
      .header { border-bottom: 2px dashed #000; padding-bottom: 8px; margin-bottom: 8px; }
      .logo { max-width: 60px; margin: 0 auto 6px; height: auto; }
      .restaurant-name { font-weight: bold; font-size: 16px; margin-bottom: 4px; }
      .restaurant-info { font-size: 11px; color: #333; margin-bottom: 2px; }
      .divider { border-bottom: 1px dashed #000; margin: 8px 0; }
      .items { text-align: left; margin: 8px 0; }
      .item-row { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px; }
      .item-name { flex: 1; }
      .item-qty { text-align: center; min-width: 30px; margin: 0 4px; }
      .item-price { text-align: right; min-width: 50px; font-weight: bold; }
      .summary { border-top: 2px dashed #000; padding-top: 6px; margin-top: 8px; }
      .summary-row { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 3px; }
      .summary-row.subtotal { border-bottom: 1px dashed #000; padding-bottom: 3px; }
      .summary-row.discount { color: #059669; font-weight: bold; }
      .summary-row.total { font-size: 16px; font-weight: bold; margin-top: 3px; }
      .footer { margin-top: 10px; font-size: 10px; color: #666; border-top: 1px dashed #000; padding-top: 6px; }
      .thank-you { font-weight: bold; margin-top: 4px; }
      @media print { body { margin: 0; padding: 0; } .receipt { width: 100%; } }
    </style>
  </head>
  <body>
    <div class="receipt">
      <div class="header">
        ${bill.restaurant.logo_url ? `<img src="${bill.restaurant.logo_url}" class="logo" alt="Logo"/>` : ''}
        <div class="restaurant-name">${bill.restaurant.name}</div>
        <div class="restaurant-info">${bill.restaurant.address}</div>
        <div class="restaurant-info">${bill.restaurant.phone}</div>
      </div>
      <div class="divider"></div>
      <div class="items">${itemsHTML}</div>
      <div class="summary">
        <div class="summary-row subtotal">
          <span>Subtotal:</span>
          <span>$${(bill.subtotal_cents / 100).toFixed(2)}</span>
        </div>
        ${serviceChargeHTML}
        ${discountHTML}
        <div class="summary-row total">
          <span>TOTAL:</span>
          <span>$${(bill.total_cents / 100).toFixed(2)}</span>
        </div>
      </div>
      <div class="footer">
        <div>Thank you for your visit!</div>
        <div class="thank-you">Come Again!</div>
      </div>
    </div>
    <script>
      window.print();
      window.onafterprint = () => window.close();
    </script>
  </body>
</html>`;
    
    win.document.write(billHTML);
  } catch (error) {
    console.error("Error printing bill:", error);
    alert("Failed to print bill");
  }
}

// ============= PAYMENT ASIA INTEGRATION =============

async function showPaymentPage(orderId) {
  const screen = document.getElementById('payment-screen');
  const el = document.getElementById('payment-screen-content');
  if (!screen || !el) return;

  paymentPageActive = true; // pause polling while payment page is shown

  // Show loading state
  el.innerHTML = '<div style="padding: 24px; text-align: center; color: #666;">⏳ Loading payment…</div>';
  screen.classList.add('open');
  setHeaderOrdersMode(true, true); // switch header to Payment mode
  setCartBarVisible(false);

  try {
    // Fetch order details for the payment summary
    const res = await fetch(`${API_BASE}/sessions/${sessionId}/orders?restaurantId=${restaurantId}`);
    const data = await res.json();
    const allOrders = data.items || [];
    const order = allOrders.find(o => o.order_id === orderId) || allOrders[allOrders.length - 1];

    if (!order) throw new Error('Order not found');

    const items = order.items || [];
    let subtotalCents = items.reduce((s, i) => s + (i.item_total_cents || (i.unit_price_cents * i.quantity) || 0), 0);
    const serviceChargeCents = Math.round(subtotalCents * serviceChargePct / 100);
    const totalCents = subtotalCents + serviceChargeCents;

    // Fetch restaurant info for name
    let restaurantName = tableName ? `Table ${tableName}` : 'Your Order';
    try {
      const rRes = await fetch(`${API_BASE}/restaurants/${restaurantId}`);
      const rData = await rRes.json();
      restaurantName = rData.name || restaurantName;
    } catch (e) {}

    const orderTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const networkOptions = [
      { value: 'CreditCard', icons: ['visa','mastercard'],  label: 'Credit / Debit Card' },
      { value: 'Fps',        icons: ['fps'],               label: 'FPS' },
      { value: 'Alipay',     icons: ['alipay'],            label: 'Alipay' },
      { value: 'Wechat',     icons: ['wechat-pay'],        label: 'WeChat Pay' },
      { value: 'CUP',        icons: ['unionpay'],          label: 'UnionPay' },
      { value: 'Octopus',    icons: ['octopus.png'],       label: 'Octopus' },
    ];

    el.innerHTML = `
      <div class="pay-screen-wrapper">
        <div class="pay-screen-restaurant">
          <div class="pay-screen-restaurant-name">${restaurantName}</div>
          <div class="pay-screen-meta">Order #${orderId} · ${orderTime} · Table ${tableName}</div>
        </div>

        <div class="pay-screen-items-card">
          ${items.map(item => {
            const name = item.menu_item_name || item.name || 'Item';
            const line = item.item_total_cents || (item.unit_price_cents * item.quantity) || 0;
            return `<div class="pay-screen-item-line">
              <span>${name} <span class="pay-screen-item-qty">×${item.quantity}</span></span>
              <span class="pay-screen-item-price">$${(line/100).toFixed(2)}</span>
            </div>`;
          }).join('')}
          ${serviceChargePct > 0 ? `
          <div class="pay-screen-charge-line">
            <span>Service Charge (${serviceChargePct}%)</span>
            <span>$${(serviceChargeCents/100).toFixed(2)}</span>
          </div>` : ''}
          <div class="pay-screen-total-line">
            <span>Total</span>
            <span>HKD $${(totalCents/100).toFixed(2)}</span>
          </div>
        </div>

        <div class="pay-screen-method-section">
          <div class="pay-screen-method-title">Payment Method</div>
          <div class="pay-screen-methods">
            ${networkOptions.map((opt, i) => `
            <label class="pay-method-option${i===0?' selected':''}" id="pay-method-label-${opt.value}">
              <input type="radio" name="pay-network" value="${opt.value}" ${i===0?'checked':''} onchange="highlightPayMethod()">
              <span class="pay-method-icon">${opt.icons.map(ic => { const src = ic.includes('.') ? `/uploads/website/payments/${ic}` : `/uploads/website/payments/${ic}.svg`; return `<img src="${src}" alt="${ic}" width="56" height="36">`; }).join('')}</span>
              <span>${opt.label}</span>
            </label>`).join('')}
          </div>
        </div>

        <div class="pay-screen-actions">
          <button id="pay-now-btn" class="btn-pay-now" onclick="submitPaymentInline(${orderId}, ${totalCents})">
            Pay HKD $${(totalCents/100).toFixed(2)}
          </button>
          <button class="btn-go-back" onclick="showPaymentPageBack()">Go Back</button>
        </div>
      </div>
    `;
  } catch (err) {
    el.innerHTML = `<div style="padding:24px; text-align:center; color:#dc2626;">❌ Failed to load order: ${err.message}</div>
      <div style="padding:16px;"><button class="btn-go-back" onclick="showPaymentPageBack()">Go Back</button></div>`;
  }
}

function highlightPayMethod() {
  document.querySelectorAll('[id^="pay-method-label-"]').forEach(label => {
    const radio = label.querySelector('input[type=radio]');
    label.classList.toggle('selected', !!(radio && radio.checked));
  });
}

function showPaymentPageBack() {
  const screen = document.getElementById('payment-screen');
  if (screen) {
    screen.classList.remove('open');
    document.getElementById('payment-screen-content').innerHTML = '';
  }
  paymentPageActive = false;
  setHeaderOrdersMode(true, false); // back to Check Orders header
  setCartBarVisible(false);         // still in orders view, not menu
  loadOrderStatus();
}

async function submitPaymentInline(orderId, totalCents) {
  const btn = document.getElementById('pay-now-btn');
  const selected = document.querySelector('input[name="pay-network"]:checked');
  if (!selected) { alert('Please select a payment method'); return; }

  if (btn) { btn.disabled = true; btn.textContent = '⏳ Processing…'; }

  const network = selected.value;

  try {
    const paymentRes = await fetch(
      `${API_BASE}/restaurants/${restaurantId}/sessions/${sessionId}/orders/${orderId}/initiate-payment`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: 'Guest',
          customer_email: `guest@table-${tableName || 'unknown'}.local`,
          customer_phone: '',
          customer_ip: window.location.hostname,
          customer_address: tableName || 'N/A',
          customer_state: 'HK',
          customer_country: 'HK',
          menu_return_url: window.location.origin + window.location.pathname + window.location.search,
          network,
        })
      }
    );

    if (!paymentRes.ok) {
      const err = await paymentRes.json();
      throw new Error(err.error || 'Failed to initiate payment');
    }

    const paymentData = await paymentRes.json();

    // Submit form to Payment Asia (same page navigation, not new tab)
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = paymentData.paymentUrl;
    form.style.display = 'none';
    Object.entries(paymentData.formData).forEach(([key, value]) => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = key;
      input.value = String(value);
      form.appendChild(input);
    });
    document.body.appendChild(form);
    form.submit();
  } catch (err) {
    if (btn) { btn.disabled = false; btn.textContent = `Pay HKD $${(totalCents/100).toFixed(2)}`; }
    alert('Payment failed: ' + err.message);
  }
}

  initLanding();
