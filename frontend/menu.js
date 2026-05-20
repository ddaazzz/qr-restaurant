  let activeDrawer = null;

  const API_BASE = window.location.origin + '/api';

const urlParams = new URLSearchParams(window.location.search);
const IS_STAFF = urlParams.get("staff") === "1";

// Detect order-now (to-go) mode: path is /order-now/{restaurantId}
const _pathParts = window.location.pathname.split('/').filter(Boolean);
const IS_ORDER_NOW = _pathParts[0] === 'order-now';
const ORDER_NOW_RESTAURANT_ID = IS_ORDER_NOW ? (_pathParts[1] || null) : null;
const qrToken = IS_ORDER_NOW ? null : (_pathParts[0] || null);

let sessionId = null;
let tableName = null;
let restaurantId = null;
let restaurantName = null;
let restaurantAddress = null;
let hasTableService = true;
let tableUnitId = null;
let pax = null;
let serviceChargePct = 0;
let orderPollerStarted = false;
let orderingInitialized = false;
let orderPayEnabled = false;
let paOrderLocked = false;
let showItemStatusToDiners = true;
let lastOrderId = null;
let paymentPageActive = false; // prevents polling from overwriting the inline payment page
let lastOrdersHash = null;         // diff-based rendering — only re-render when data changes
let confirmationPollingActive = false; // true while awaiting PA payment confirmation after redirect
let confirmationPollTimer = null;      // setInterval handle for fast confirmation polling
let confirmationPollDeadline = 0;      // epoch ms after which we stop fast polling
let idlePollTimer = null;              // setInterval handle for slow background polling
let appliedCoupon = null; // { code, discount_cents, discount_type, discount_value }
let pendingOrderItems = []; // items moved from cart to "pending" before Place Order
let pendingSrCart = {};     // service-request items moved to pending

/* ─── XISH State (Phase 5+6) ─────────────────────────────── */
let xishEnabled  = false;
let xishMember   = null;  // { member_id, name, tier, points_balance, xish_id, discount_percent }
let xishToken    = null;  // Current XISH session JWT

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
let menuColumns = 1; // 1 or 2, read from ui_config.menu_columns on scan
let menuLayout = localStorage.getItem('menu-layout') || 'normal'; // 'normal' | 'compact'

// Service request items & cart
let serviceRequestItems = [];
let srCart = {}; // { [itemId]: quantity }
const variantSelections = {};

// Addon state for drawer
let drawerAddons = []; // addons loaded for current item
let selectedDrawerAddons = {}; // { addonId: true/false }
let addonVariantData = {}; // { addonItemId: [variants] } - cached
let addonVariantSelections = {}; // { addonId: { variantId: [optionIds] } }

// Chinese name helpers
function getItemDisplayName(item) {
  const lang = localStorage.getItem('language') || 'en';
  return (lang === 'zh' && item.name_zh) ? item.name_zh : item.name;
}
function getCategoryDisplayName(cat) {
  const lang = localStorage.getItem('language') || 'en';
  return (lang === 'zh' && cat.name_zh) ? cat.name_zh : cat.name;
}

// Search filter — works for both standard (.menu-item) and compact (.menu-compact-item) layouts
function filterMenu(query) {
  const q = (query || '').trim().toLowerCase();
  const itemSel = '.menu-item, .menu-compact-item';
  document.querySelectorAll(itemSel).forEach(el => {
    const name = (el.querySelector('.menu-item-name, .mc-name')?.textContent?.toLowerCase()) || '';
    el.style.display = (!q || name.includes(q)) ? '' : 'none';
  });
  document.querySelectorAll('.category').forEach(catTitle => {
    const grid = catTitle.nextElementSibling;
    if (!grid) return;
    const anyVisible = Array.from(grid.querySelectorAll(itemSel)).some(i => i.style.display !== 'none');
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

// ============= SERVICE REQUEST CART =============
function hasSrCartItems() {
  return Object.values(srCart).some(q => q > 0);
}

function updateSrBadges() {
  serviceRequestItems.forEach(item => {
    const qty = srCart[item.id] || 0;
    const badge = document.getElementById(`sr-badge-${item.id}`);
    if (badge) {
      badge.textContent = qty > 0 ? qty : '';
      badge.style.display = qty > 0 ? 'flex' : 'none';
    }
  });
  // Category badge — total SR qty
  const totalSr = Object.values(srCart).reduce((s, q) => s + q, 0);
  const catBadge = document.getElementById('cat-badge-service');
  if (catBadge) {
    catBadge.textContent = totalSr > 0 ? totalSr : '';
    catBadge.style.display = totalSr > 0 ? 'flex' : 'none';
  }
}

function addToSrCart(item) {
  srCart[item.id] = (srCart[item.id] || 0) + 1;
  updateSrBadges();
  updateCartBar();
}

function removeFromSrCart(item) {
  if (!srCart[item.id]) return;
  srCart[item.id]--;
  if (srCart[item.id] <= 0) delete srCart[item.id];
  updateSrBadges();
  updateCartBar();
}

async function loadAndRenderServiceRequests() {
  // Check feature flag from session data before making any request
  const flags = (window.sessionData && window.sessionData.feature_flags) || {};
  if (flags.service_requests === false) return;
  try {
    const res = await fetch(`${API_BASE}/restaurants/${restaurantId}/service-request-items`);
    if (!res.ok) return;
    serviceRequestItems = await res.json();
    if (!serviceRequestItems.length) return;
    renderServiceRequestCategory();
  } catch (e) {
    // feature not enabled or network error — silently skip
  }
}

function renderServiceRequestCategory() {
  const currentLang = localStorage.getItem('language') || 'en';
  const catLabel = currentLang === 'zh' ? '服務' : 'Service';

  // Add to sidebar
  const catDiv = document.getElementById('categories');
  const catEl = document.createElement('div');
  catEl.className = 'category-item';
  catEl.id = 'cat-item-service';
  catEl.dataset.categoryId = 'service';
  catEl.innerHTML = `${catLabel}<span class="cat-badge" id="cat-badge-service" style="background-color:#8b5cf6;"></span>`;
  catEl.onclick = () => {
    const target = document.getElementById('category-service');
    if (!target) return;
    target.scrollIntoView({ behavior: 'instant', block: 'start' });
    setActiveCategory('service');
  };
  catDiv.appendChild(catEl);

  // Add to menu grid
  const menuContainer = document.getElementById('menu');
  const catTitle = document.createElement('div');
  catTitle.className = 'category';
  catTitle.id = 'category-service';
  catTitle.textContent = catLabel;
  menuContainer.appendChild(catTitle);

  const grid = document.createElement('div');
  grid.className = menuColumns === 2 ? 'menu-grid two-columns' : 'menu-grid single-column';
  grid.id = 'sr-grid';

  serviceRequestItems.forEach(item => {
    grid.appendChild(renderSrItemCard(item));
  });

  menuContainer.appendChild(grid);
}

function renderSrItemCard(item) {
  const color = item.color || '#8b5cf6';
  const currentLang = localStorage.getItem('language') || 'en';
  const label = (currentLang === 'zh' && item.label_zh) ? item.label_zh : item.label_en;

  const card = document.createElement('div');
  card.className = 'menu-item';

  card.innerHTML = `
    <span class="cart-badge" id="sr-badge-${item.id}" style="background-color:${color};"></span>
    <img
      src="${item.image_url || '/uploads/website/placeholder.png'}"
      onerror="this.src='/uploads/website/placeholder.png';"
      alt="${label}"
    />
    <div class="menu-item-name">${label}</div>
    <div class="menu-item-footer">
      <span style="font-size:11px;font-weight:700;color:${color};padding:2px 8px;background:${color}22;border-radius:20px;">Request</span>
    </div>
  `;

  // Tap card → add 1 to SR cart
  card.onclick = () => addToSrCart(item);

  // Tap badge circle → remove 1
  const badge = card.querySelector(`#sr-badge-${item.id}`);
  if (badge) {
    badge.onclick = (e) => {
      e.stopPropagation();
      removeFromSrCart(item);
    };
  }

  return card;
}

async function submitSrItems() {
  for (const item of serviceRequestItems) {
    const qty = srCart[item.id] || 0;
    if (!qty) continue;
    const currentLang = localStorage.getItem('language') || 'en';
    const label = (currentLang === 'zh' && item.label_zh) ? item.label_zh : item.label_en;
    for (let i = 0; i < qty; i++) {
      try {
        await fetch(`${API_BASE}/restaurants/${restaurantId}/service-requests`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            table_session_id: sessionId,
            table_unit_id: tableUnitId,
            request_type: item.request_type,
            label
          })
        });
      } catch (e) { /* best-effort */ }
    }
  }
  srCart = {};
  updateSrBadges();
}

// Language switching for customer menu
function setLanguageFromMenu(lang) {
  localStorage.setItem('language', lang);
  
  // Use existing setLanguage function to update all data-i18n elements
  if (typeof setLanguage === 'function') {
    setLanguage(lang);
  }
  
  // Update new header center text
  _refreshHeaderText();
  const langLabel = document.getElementById('header-lang-label');
  if (langLabel) langLabel.textContent = lang === 'zh' ? '中' : 'EN';
  
  // Re-render cart to update labels
  updateCartBar();
  
  // Re-render menu and categories with updated language
  if (window.menu && document.getElementById('menu') && document.getElementById('menu').innerHTML) {
    renderMenu(window.menu);
    renderCategories(window.menu.categories);
  }
}

// ── New header helper functions ──────────────────────────────────────────────

function _refreshHeaderText() {
  const orderTypeEl = document.getElementById('header-order-type');
  const orderSubEl  = document.getElementById('header-order-sub');
  if (!orderTypeEl) return;
  const lang = localStorage.getItem('language') || 'zh';
  if (!IS_ORDER_NOW || hasScannedTable) {
    orderTypeEl.textContent = lang === 'zh' ? '堂食點餐' : 'Dine In';
    if (orderSubEl) orderSubEl.textContent = `${pax || '-'} ${t('menu.pax-label')} · ${t('menu.table-label')} ${tableName}`;
  } else if (orderType === 'takeaway' && tableName) {
    // Table-session takeaway: ordered takeaway but seated at a table
    orderTypeEl.textContent = lang === 'zh' ? '外帶' : 'Takeaway';
    if (orderSubEl) orderSubEl.textContent = `${t('menu.table-label')} ${tableName}`;
  } else if (orderType === 'counter') {
    orderTypeEl.textContent = lang === 'zh' ? '取餐' : 'Pick Up';
    if (orderSubEl) orderSubEl.textContent = lang === 'zh' ? '即時取餐' : 'Order for Now';
  } else if (orderType === 'takeaway') {
    orderTypeEl.textContent = lang === 'zh' ? '外帶' : 'Takeaway';
    if (orderSubEl) orderSubEl.textContent = lang === 'zh' ? '即時外帶' : 'Order for Now';
  } else {
    orderTypeEl.textContent = lang === 'zh' ? '堂食' : 'Dine In';
    if (orderSubEl) orderSubEl.textContent = '';
  }
}

/* ─── Main tab navigation ───────────────────────────────────────────────── */
let _activeMainTab = 'home';

function switchMainTab(tab) {
  if (tab === 'menu' && !orderingInitialized) {
    // Show order-type picker overlay before entering menu (unless counter_only)
    if (!window._isCounterOnly) {
      _showOrderTypePickerOverlay();
      return;
    }
    // counter_only (Takeaway Only): single order flow — start ordering with takeaway type
    orderType = 'takeaway';
    startOrdering().then(() => _activateMainTab('menu'));
    return;
  }
  _activateMainTab(tab);
}

/* Show a full-screen order-type picker overlay when user taps "Order" nav button */
function _showOrderTypePickerOverlay() {
  const overlay = document.getElementById('order-type-overlay');
  if (!overlay) return;
  // Populate labels based on restaurant type and scan mode
  const btn1 = document.getElementById('otp-btn-1');
  const btn2 = document.getElementById('otp-btn-2');
  const lbl1Main = document.getElementById('otp-lbl1-main');
  const lbl1Sub  = document.getElementById('otp-lbl1-sub');
  const lbl2Main = document.getElementById('otp-lbl2-main');
  const lbl2Sub  = document.getElementById('otp-lbl2-sub');
  if (IS_ORDER_NOW && hasTableService) {
    // Order-now + table service: Dine-In (scan table) vs Takeaway
    if (lbl1Main) lbl1Main.textContent = '堂食';
    if (lbl1Sub)  lbl1Sub.textContent  = 'DINE IN';
    if (lbl2Main) lbl2Main.textContent = '外帶';
    if (lbl2Sub)  lbl2Sub.textContent  = 'TAKEAWAY';
    if (btn1) btn1.onclick = () => { _closeOrderTypeOverlay(); openTableScanPanel(); };
    if (btn2) btn2.onclick = () => { _closeOrderTypeOverlay(); orderType = 'takeaway'; startOrdering().then(() => _activateMainTab('menu')); };
  } else if (hasTableService) {
    // Table-scan + table service: Dine-In vs Takeaway
    if (lbl1Main) lbl1Main.textContent = '點餐';
    if (lbl1Sub)  lbl1Sub.textContent  = 'ORDER';
    if (lbl2Main) lbl2Main.textContent = '外帶';
    if (lbl2Sub)  lbl2Sub.textContent  = 'TAKEAWAY';
    if (btn1) btn1.onclick = () => { _closeOrderTypeOverlay(); orderType = 'dine-in'; startOrdering().then(() => _activateMainTab('menu')); };
    if (btn2) btn2.onclick = () => { _closeOrderTypeOverlay(); orderType = 'takeaway'; startOrdering().then(() => _activateMainTab('menu')); };
  } else {
    // Counter (no table service): Pick Up vs Takeaway
    if (lbl1Main) lbl1Main.textContent = '取餐';
    if (lbl1Sub)  lbl1Sub.textContent  = 'ORDER HERE';
    if (lbl2Main) lbl2Main.textContent = '外帶';
    if (lbl2Sub)  lbl2Sub.textContent  = 'TAKEAWAY';
    if (btn1) btn1.onclick = () => { _closeOrderTypeOverlay(); orderType = 'counter'; startOrdering().then(() => _activateMainTab('menu')); };
    if (btn2) btn2.onclick = () => { _closeOrderTypeOverlay(); orderType = 'takeaway'; startOrdering().then(() => _activateMainTab('menu')); };
  }
  overlay.style.display = 'flex';
}

function _closeOrderTypeOverlay() {
  const overlay = document.getElementById('order-type-overlay');
  if (overlay) overlay.style.display = 'none';
}

function _activateMainTab(tab) {
  _activeMainTab = tab;
  document.querySelectorAll('.main-tab').forEach(el => el.classList.remove('active-tab'));
  const tabEl = document.getElementById(tab + '-tab');
  if (tabEl) tabEl.classList.add('active-tab');
  document.querySelectorAll('.bn-item').forEach(el => el.classList.remove('active'));
  const bnEl = document.getElementById('bn-' + tab);
  if (bnEl) bnEl.classList.add('active');
  if (tab === 'orders') _renderOrdersTabContent();
  if (tab === 'profile') _renderProfileTabContent();
}

function _renderOrdersTabContent() {
  const content = document.getElementById('orders-tab-content');
  const empty = document.getElementById('orders-empty-state');
  if (!content) return;
  // Restore header to normal Orders state whenever re-rendering
  _setOrdersTabHeader('orders');
  // If cart items exist, show inline order review.
  // Exception: IS_ORDER_NOW with a locked completed session — show receipt + New Order button instead.
  const hasPending = cart.items.length > 0 || Object.values(srCart).some(q => q > 0);
  if (hasPending && !(IS_ORDER_NOW && paOrderLocked)) {
    if (empty) empty.style.display = 'none';
    content.style.padding = '0';
    _renderOrderReviewInTab(content);
    return;
  }
  // If no active session, show empty state
  if (!sessionId) {
    if (IS_ORDER_NOW) {
      // IS_ORDER_NOW with no session: prompt to browse the menu
      if (empty) empty.style.display = 'none';
      const lang = localStorage.getItem('language') || 'zh';
      const isZh = lang === 'zh';
      content.style.padding = '32px 16px';
      content.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;text-align:center;gap:16px;">
          <div style="font-size:48px;">🍽️</div>
          <p style="font-size:16px;font-weight:700;color:#1f2937;margin:0;">${isZh ? '準備好落單了嗎？' : 'Ready to order?'}</p>
          <p style="font-size:13px;color:#6b7280;margin:0;">${isZh ? '瀏覽菜單，選擇你喜歡的菜式！' : 'Browse the menu and add items to your cart.'}</p>
          <button class="btn-primary" style="width:180px;" onclick="switchMainTab('menu')">${isZh ? '瀏覽菜單' : 'Browse Menu'}</button>
        </div>`;
      _updateOrdersTabItemsChip(0);
      return;
    }
    if (empty) empty.style.display = 'flex';
    content.style.padding = '12px';
    content.innerHTML = '';
    _updateOrdersTabItemsChip(0);
    return;
  }
  // Fetch and render placed orders into the tab
  if (empty) empty.style.display = 'none';
  content.style.padding = '0';
  loadOrderStatus({ forceRender: true });
}

function _renderProfileTabContent() {
  const content = document.getElementById('profile-tab-content');
  if (!content) return;
  const lang = localStorage.getItem('language') || 'zh';
  const isZh = lang === 'zh';
  const flags = (window.sessionData && window.sessionData.feature_flags) || {};
  const membersAreaEnabled = flags.members_area !== false;
  const couponsEnabled = flags.coupons !== false;
  const hasPoints = typeof xishMember !== 'undefined' && xishMember;
  const points = hasPoints ? (xishMember.points_balance || 0).toLocaleString() : '—';
  const coupons = hasPoints ? (xishMember.active_coupons || xishMember.coupon_count || 0) : '—';
  const memberName = hasPoints ? (xishMember.name || '') : '';
  const cardsHtml = [
    membersAreaEnabled ? `
      <div class="ptb-card" onclick="openMyPointsPanel()">
        <div class="ptb-card-icon">★</div>
        <div class="ptb-card-value">${points}</div>
        <div class="ptb-card-label">我的積分<span style="display:block;font-size:10px;font-weight:400;color:#9ca3af;">My Points</span></div>
      </div>` : '',
    couponsEnabled ? `
      <div class="ptb-card" onclick="openMyCouponsPanel()">
        <div class="ptb-card-icon">🎟</div>
        <div class="ptb-card-value">${coupons}</div>
        <div class="ptb-card-label">我的優惠券<span style="display:block;font-size:10px;font-weight:400;color:#9ca3af;">My Coupons</span></div>
      </div>` : '',
  ].join('');
  content.innerHTML = `
    <div class="profile-tab-inner">
      ${memberName ? `<div class="ptb-name">${memberName}</div>` : ''}
      ${cardsHtml ? `<div class="ptb-cards">${cardsHtml}</div>` : ''}
    </div>
  `;
}

function backToLanding() {
  closeAllDrawers();
  if (idlePollTimer)         { clearInterval(idlePollTimer);         idlePollTimer = null; }
  if (confirmationPollTimer) { clearInterval(confirmationPollTimer); confirmationPollTimer = null; }
  _activateMainTab('home');
}

function toggleMenuLayout() {
  menuLayout = menuLayout === 'normal' ? 'compact' : 'normal';
  localStorage.setItem('menu-layout', menuLayout);
  updateLayoutBtn();
  if (window._currentMenuData) renderMenu(window._currentMenuData);
  // re-apply badge counts after re-render
  updateCartBadges();
}

function updateLayoutBtn() {
  const btn = document.getElementById('layout-btn-icon');
  if (!btn) return;
  if (menuLayout === 'compact') {
    // Show list/rows icon (indicating compact is active; click to go back to grid)
    btn.innerHTML = '<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>';
  } else {
    // Show grid icon (indicating grid is active; click to go compact)
    btn.innerHTML = '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>';
  }
}

function cycleHeaderLang() {
  const current = localStorage.getItem('language') || 'zh';
  setLanguageFromMenu(current === 'zh' ? 'en' : 'zh');
}

function openXishOrJoin() {
  if (typeof xishEnabled !== 'undefined' && xishEnabled) {
    openXishTab('points');
  }
}

/* ── Info expand toggles ─────────────────────────── */
window.toggleHomeInfoExpand = function() {
  const el = document.getElementById('home-info-expand');
  const ch = document.getElementById('home-info-chevron');
  if (!el) return;
  const open = el.style.display === 'none' || !el.style.display;
  el.style.display = open ? 'flex' : 'none';
  if (ch) ch.style.transform = open ? 'rotate(180deg)' : '';
};

window.toggleMenuInfoExpand = function() {
  const el = document.getElementById('mth-expand');
  const ch = document.getElementById('mth-chevron');
  if (!el) return;
  const open = el.style.display === 'none' || !el.style.display;
  el.style.display = open ? 'flex' : 'none';
  if (ch) ch.style.transform = open ? 'rotate(180deg)' : '';
};

/* ── Featured items ─────────────────────────────── */
function renderFeaturedItems(menuData) {
  // Check if featured strip is enabled in ui_config
  const uiCfg = (window.sessionData && window.sessionData.ui_config) || {};
  if (uiCfg.featured_strip_enabled === false) return;

  // Only show featured strip when banners are explicitly configured — no food fallback
  let banners = (window.sessionData && window.sessionData.featured_banners) || [];
  // Guard: some DB drivers return JSONB as a string — parse if needed
  if (typeof banners === 'string') {
    try { banners = JSON.parse(banners); } catch(e) { banners = []; }
  }
  if (!Array.isArray(banners) || !banners.length) return;
  const featured = banners.filter(b => b.image_url);
  if (!featured.length) return;

  const allItems = (menuData && menuData.items) || [];

  function makeFeaturedCard(entry) {
    const wrap = document.createElement('div');
    const imageUrl = entry.image_url;
    const linkedItem = entry.item_id ? allItems.find(i => i.id === entry.item_id) : null;
    const displayName = linkedItem ? getItemDisplayName(linkedItem) : '';
    const itemId = entry.item_id;
    wrap.className = 'mf-item';
    wrap.innerHTML = '<img src="' + imageUrl + '" alt="' + displayName + '" onerror="this.parentElement.style.display=\'none\'">' +
      '<div class="mf-item-label">' + displayName + '</div>';
    wrap.onclick = () => {
      if (!orderingInitialized) { switchMainTab('home'); return; }
      if (itemId) openDrawer(itemId);
    };
    return wrap;
  }

  // Only populate menu tab — featured items never shown on home tab
  const menuScroll = document.getElementById('menu-featured-scroll');
  if (menuScroll) {
    menuScroll.innerHTML = '';
    featured.forEach(entry => menuScroll.appendChild(makeFeaturedCard(entry)));
  }
  const menuStrip = document.getElementById('menu-featured-strip');
  if (menuStrip) menuStrip.style.display = '';
}

/* ── Home landing banners (below loyalty section) ───────── */
function _renderHomeLandingBanners() {
  const wrap = document.getElementById('home-landing-banners');
  const track = document.getElementById('hlb-track');
  if (!wrap || !track) return;

  let banners = (window.sessionData && window.sessionData.featured_banners) || [];
  if (typeof banners === 'string') { try { banners = JSON.parse(banners); } catch(e) { banners = []; } }
  if (!Array.isArray(banners)) banners = [];
  const visible = banners.filter(b => b.image_url);
  if (!visible.length) { wrap.style.display = 'none'; return; }

  const allItems = (window._currentMenuData && window._currentMenuData.items) || [];
  track.innerHTML = '';
  visible.forEach(b => {
    const div = document.createElement('div');
    div.className = 'hlb-banner';
    div.style.width = visible.length > 1 ? '90%' : '100%';
    const img = document.createElement('img');
    img.src = b.image_url;
    img.alt = '';
    img.onerror = () => { div.style.display = 'none'; };
    div.appendChild(img);
    if (b.item_id) {
      div.onclick = () => {
        if (!orderingInitialized) { switchMainTab('home'); return; }
        openDrawer(b.item_id);
      };
    }
    track.appendChild(div);
  });
  wrap.style.display = '';
}

/* ── Member QR modal ────────────────────────────── */
window.showMemberQR = function() {
  if (typeof xishMember === 'undefined' || !xishMember) return;
  const tierEl = document.getElementById('mqr-tier');
  const nameEl = document.getElementById('mqr-name');
  const idEl   = document.getElementById('mqr-xish-id');
  if (tierEl) tierEl.textContent = (xishMember.tier || 'member').toUpperCase();
  if (nameEl) nameEl.textContent = xishMember.name || '';
  if (idEl)   idEl.textContent   = xishMember.xish_id || '';
  const container = document.getElementById('mqr-qr-container');
  if (container) {
    container.innerHTML = '';
    if (typeof QRCode !== 'undefined') {
      new QRCode(container, {
        text: xishMember.xish_id || String(xishMember.member_id || ''),
        width: 160,
        height: 160,
        colorDark: '#1f2937',
        colorLight: '#ffffff',
      });
    }
  }
  const modal = document.getElementById('member-qr-modal');
  if (modal) modal.style.display = 'flex';
};

window.closeMemberQR = function() {
  const modal = document.getElementById('member-qr-modal');
  if (modal) modal.style.display = 'none';
};

function renderMembershipCard(member) {
  if (!member) return;
  const card = document.getElementById('home-membership-card');
  if (!card) return;
  const tierEl = document.getElementById('hmc-tier');
  const nameEl = document.getElementById('hmc-name');
  const couponEl = document.getElementById('hmc-coupon-count');
  const stampEl  = document.getElementById('hmc-stamp-count');
  if (tierEl) tierEl.textContent = (member.tier || 'member').toUpperCase();
  if (nameEl) nameEl.textContent = member.name || '';
  if (couponEl) couponEl.textContent = member.active_coupons || member.coupon_count || 0;
  if (stampEl)  stampEl.textContent  = member.points_balance || 0;
  card.style.display = '';
}

/* ── Update menu-tab order-type badge ─────────────── */
function updateMthOrderTypeBadge(type) {
  const el = document.getElementById('mth-order-type-badge');
  if (!el) return;
  const labels = { 'dine-in': '堂食', 'takeaway': '外帶', 'counter': '取餐' };
  el.textContent = labels[type] || type || '';
}

function toggleMenuSearch() {
  const row = document.getElementById('menu-search-row');
  if (!row) return;
  const visible = row.style.display !== 'none';
  row.style.display = visible ? 'none' : 'block';
  if (!visible) {
    const inp = document.getElementById('search-input');
    if (inp) { inp.value = ''; filterMenu(''); setTimeout(() => inp.focus(), 50); }
  } else {
    const inp = document.getElementById('search-input');
    if (inp) { inp.value = ''; filterMenu(''); }
  }
}

// Apply saved layout preference on page load
updateLayoutBtn();

async function initLanding() {
  if (IS_ORDER_NOW) {
    if (!ORDER_NOW_RESTAURANT_ID) {
      alert("Invalid to-go QR code");
      return;
    }
    const res = await fetch(`${API_BASE}/scan/order-now/${ORDER_NOW_RESTAURANT_ID}`, { method: "POST" });
    if (!res.ok) {
      alert("Restaurant not found");
      return;
    }
    const session = await res.json();
    await _applySessionToLanding(session, true);
    return;
  }

  if (!qrToken) {
    alert("Invalid QR code");
    return;
  }

  const res = await fetch(`${API_BASE}/scan/${qrToken}`, { method: "POST" });
  const session = await res.json();
  await _applySessionToLanding(session, false);
}

async function _applySessionToLanding(session, isOrderNow) {
  sessionId = session.session_id;
  restaurantId = session.restaurant_id;
  restaurantName = session.restaurant_name;
  restaurantAddress = session.address || null;
  hasTableService = session.has_table_service !== false;
  window._isCounterOnly = !!(session.feature_flags && session.feature_flags.counter_only);
  tableName = session.table_name;
  tableUnitId = session.table_unit_id || null;
  window.sessionData = session; // store for featured items etc.
  pax = session.pax;
  serviceChargePct = session.service_charge_percent || 0;

  // Apply restaurant theme color
  if (session.theme_color) applyThemeColor(session.theme_color);
  
  // Apply menu column/layout from ui_config (admin setting overrides localStorage)
  if (session.ui_config?.menu_layout === 'compact') {
    menuLayout = 'compact';
    menuColumns = 1;
    localStorage.setItem('menu-layout', 'compact');
  } else {
    menuLayout = localStorage.getItem('menu-layout') || 'normal';
    menuColumns = (session.ui_config?.menu_columns === 2) ? 2 : 1;
    if (session.ui_config?.menu_layout === 'normal') {
      menuLayout = 'normal';
      localStorage.setItem('menu-layout', 'normal');
    }
  }

  // Apply portal styling from ui_config
  if (session.ui_config?.portal_bg) {
    document.documentElement.style.setProperty('--landing-bg', session.ui_config.portal_bg);
  }
  if (session.ui_config?.portal_card_bg) {
    document.documentElement.style.setProperty('--bg-light', session.ui_config.portal_card_bg);
  }

  // Apply restaurant language preference if available
  if (session.language_preference) {
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
  
  // 🔥 Populate landing page
  const logoEl = document.getElementById("logo");
  if (logoEl) {
    const logoUrl = session.logo_url;
    if (logoUrl) {
      logoEl.src = logoUrl;
      logoEl.onerror = () => { logoEl.style.display = 'none'; };
    } else {
      logoEl.style.display = 'none';
    }
  }

  // Apply background image to home cover
  const homeCover = document.getElementById('home-cover');
  if (session.background_url && homeCover) {
    homeCover.style.backgroundImage = `url('${session.background_url}')`;
    homeCover.style.backgroundSize = 'cover';
    homeCover.style.backgroundPosition = 'center';
  }

  // Populate new home elements
  const homeCoverName = document.getElementById('home-cover-name');
  if (homeCoverName) homeCoverName.textContent = session.restaurant_name || '';
  const homeInfoName = document.getElementById('home-info-name');
  if (homeInfoName) homeInfoName.textContent = session.restaurant_name || '';
  const homeInfoHours = document.getElementById('home-info-hours');
  if (homeInfoHours) homeInfoHours.textContent = session.operating_hours || '';
  if (!session.operating_hours) {
    const sep = document.getElementById('home-info-sep'); if (sep) sep.style.display = 'none';
  }
  const homeInfoAddr = document.getElementById('home-info-address');
  if (homeInfoAddr) homeInfoAddr.textContent = session.address || '';
  if (!session.address) {
    const moreBtn = document.getElementById('home-info-more-btn'); if (moreBtn) moreBtn.style.display = 'none';
  }
  const mthName = document.getElementById('mth-restaurant-name');
  if (mthName) mthName.textContent = session.restaurant_name || '';
  const mthHours = document.getElementById('mth-hours');
  if (mthHours) mthHours.textContent = session.operating_hours || '';
  const mthAddr = document.getElementById('mth-address');
  if (mthAddr) mthAddr.textContent = session.address || '';

  // Store cleanup function
  window.resetMenuBackground = function() {
    if (homeCover) homeCover.style.backgroundImage = '';
    document.body.style.backgroundImage = 'none';
    document.body.style.backgroundColor = '#ffffff';
  };

  const nameEl = document.getElementById("restaurantName");
  if (nameEl) nameEl.textContent = session.restaurant_name;

  const addressEl = document.getElementById("address");
  if (addressEl) addressEl.textContent = session.address || "";

  // Wire action buttons based on restaurant type (has_table_service)
  const dineInBtn      = document.getElementById('home-dine-btn');
  const togoBtn        = document.getElementById('home-pickup-btn');
  const checkBtn       = document.getElementById('check-orders-btn');

  // Helper to relabel a landing action button
  function _relabelBtn(btn, svgOrIcon, main, sub) {
    if (!btn) return;
    const em = btn.querySelector('.hoc-icon');
    const ml = btn.querySelector('.hoc-label-zh');
    const sl = btn.querySelector('.hoc-label-en');
    if (em) em.innerHTML = svgOrIcon;
    if (ml) ml.textContent = main;
    if (sl) sl.textContent = sub;
  }

  // SVG icon strings for landing action buttons
  const _SVG_DINEIN   = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h2v11h2V2H3z"/><path d="M18 2v20h-2v-8h-3V6c0-2.2 1.8-4 4-4z"/></svg>';
  const _SVG_TAKEAWAY = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>';
  const _SVG_COUNTER  = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>';

  if (window._isCounterOnly) {
    // Counter-only: single "Order Here" button, no dine-in/takeaway choice
    if (togoBtn) togoBtn.style.display = 'none';
    const orderCards = document.getElementById('home-order-cards');
    if (orderCards) orderCards.style.justifyContent = 'center';
    const zhLabel = dineInBtn && dineInBtn.querySelector('.hoc-label-zh');
    const enLabel = dineInBtn && dineInBtn.querySelector('.hoc-label-en');
    if (zhLabel) zhLabel.textContent = '立即點餐';
    if (enLabel) enLabel.textContent = 'ORDER NOW';
    if (dineInBtn) dineInBtn.style.width = '140px';
    if (dineInBtn) dineInBtn.onclick = () => { orderType = 'counter'; startOrdering(); };
    if (checkBtn) {
      checkBtn.style.display = '';
      checkBtn.onclick = () => switchMainTab('orders');
    }
  } else if (isOrderNow) {
    // Order-now QR — no pre-existing table session
    // Show transaction record button so returning customers can check orders
    if (checkBtn) {
      checkBtn.style.display = '';
      checkBtn.onclick = () => switchMainTab('orders');
    }

    if (hasTableService) {
      // Table-service restaurant: let customer scan a table QR or order takeaway
      _relabelBtn(dineInBtn, _SVG_DINEIN,   '堂食', 'ORDER FOR TABLE');
      _relabelBtn(togoBtn,   _SVG_TAKEAWAY, '外帶', 'TAKEAWAY');
      if (dineInBtn) dineInBtn.onclick = () => openTableScanPanel();
      if (togoBtn)   togoBtn.onclick   = () => { orderType = 'takeaway'; startOrdering(); };
    } else {
      // Counter / no-table restaurant: walk-in pickup or takeaway
      _relabelBtn(dineInBtn, _SVG_COUNTER,  '取餐', 'PICK UP');
      _relabelBtn(togoBtn,   _SVG_TAKEAWAY, '外帶', 'TAKEAWAY');
      if (dineInBtn) dineInBtn.onclick = () => { orderType = 'counter'; startOrdering(); };
      if (togoBtn)   togoBtn.onclick   = () => { orderType = 'takeaway'; startOrdering(); };
    }
  } else {
    // Table QR scan mode — customer already at a specific table
    if (hasTableService) {
      _relabelBtn(dineInBtn, _SVG_DINEIN, '點餐', 'ORDER');
      if (dineInBtn) dineInBtn.onclick = () => { orderType = 'dine-in'; startOrdering(); };
    } else {
      // Counter restaurant with a QR code (edge case)
      _relabelBtn(dineInBtn, _SVG_COUNTER, '取餐', 'PICK UP');
      if (dineInBtn) dineInBtn.onclick = () => { orderType = 'counter'; startOrdering(); };
    }
    _relabelBtn(togoBtn, _SVG_TAKEAWAY, '外帶', 'TAKEAWAY');
    if (togoBtn)  togoBtn.onclick  = () => { orderType = 'takeaway'; startOrdering(); };
    if (checkBtn) {
      checkBtn.style.display = '';
      checkBtn.onclick = () => switchMainTab('orders');
    }
  }

  // Show payment result banner if returning from Payment Asia
  const paymentStatus = urlParams.get('payment_status');
  if (paymentStatus) {
    const isSuccess = paymentStatus === 'success';
    history.replaceState({}, '', window.location.pathname + window.location.search.replace(/[?&]payment_status=[^&]*/g, '').replace(/^&/, '?'));
    startOrdering().then(async () => {
      await fetchAndApplyPaymentSettings();
      openOrdersDrawer();
      if (isSuccess) {
        startConfirmationPolling();
      } else {
        showPaymentReturnBanner(false);
      }
    });
  }

  // Initialize active language button for landing page
  const currentLang = localStorage.getItem('language') || 'zh';
  setLanguage(currentLang);

  // Phase 5+6: Members Area (loyalty) mode detection
  // Supports: session.xish_enabled, feature_flags.xish (legacy), feature_flags.members_area (new)
  const membersAreaEnabled = session.xish_enabled
    || (session.feature_flags && (session.feature_flags.xish || session.feature_flags.members_area !== false));
  if (membersAreaEnabled) {
    await initXishMode(session);
  }
}

/* ─── Customer Table Scan (order-now → link to table QR) ─────────────────── */

function openTableScanPanel() {
  const overlay = document.getElementById('table-scan-overlay');
  if (!overlay) return;
  overlay.classList.add('open');
  setTimeout(() => _startCustomerTableScan(), 50);
}

function closeTableScanPanel() {
  const overlay = document.getElementById('table-scan-overlay');
  if (overlay) overlay.classList.remove('open');
  _stopCustomerTableScan();
}

function _stopCustomerTableScan() {
  if (_customerTableScanner) {
    try { _customerTableScanner.stop().catch(() => {}); } catch (e) {}
    _customerTableScanner = null;
  }
}

async function _startCustomerTableScan() {
  const statusEl = document.getElementById('table-scan-status');
  const errorEl  = document.getElementById('table-scan-error');
  if (statusEl) { statusEl.textContent = 'Initializing camera…'; statusEl.style.display = 'block'; }
  if (errorEl)  errorEl.style.display = 'none';

  let retries = 0;
  while (typeof Html5Qrcode === 'undefined' && retries < 20) {
    await new Promise(r => setTimeout(r, 100));
    retries++;
  }
  if (typeof Html5Qrcode === 'undefined') {
    if (errorEl) { errorEl.textContent = 'QR scanner library not loaded. Please refresh.'; errorEl.style.display = 'block'; }
    if (statusEl) statusEl.style.display = 'none';
    return;
  }

  try {
    const readerEl = document.getElementById('table-scan-reader');
    if (readerEl) readerEl.innerHTML = '';
    _customerTableScanner = new Html5Qrcode('table-scan-reader', {
      formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE]
    });
    await _customerTableScanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 220, height: 220 }, aspectRatio: 1.0 },
      async (text) => {
        _stopCustomerTableScan();
        if (statusEl) { statusEl.textContent = 'QR detected — looking up table…'; statusEl.style.display = 'block'; }
        await _processCustomerTableScan(text);
      },
      () => {}
    );
    if (statusEl) { statusEl.textContent = ''; statusEl.style.display = 'none'; }
  } catch (err) {
    _customerTableScanner = null;
    let msg = 'Could not start camera.';
    const m = err?.message || String(err);
    if (m.includes('NotAllowedError') || m.includes('Permission denied'))
      msg = '📵 Camera permission denied. Please allow camera access in your browser settings.';
    else if (m.includes('NotFoundError'))
      msg = '📷 No camera found on this device.';
    if (errorEl) { errorEl.textContent = msg; errorEl.style.display = 'block'; }
    if (statusEl) statusEl.style.display = 'none';
  }
}

async function _processCustomerTableScan(qrText) {
  const errorEl  = document.getElementById('table-scan-error');
  const statusEl = document.getElementById('table-scan-status');
  if (errorEl)  errorEl.style.display = 'none';
  if (statusEl) { statusEl.textContent = 'Looking up table…'; statusEl.style.display = 'block'; }

  let token = qrText.trim();
  if (token.includes('/')) {
    const parts = token.split('/').filter(Boolean);
    token = parts[parts.length - 1];
  }

  try {
    const res = await fetch(`${API_BASE}/scan/${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      if (errorEl) { errorEl.textContent = err.error || 'Invalid QR code'; errorEl.style.display = 'block'; }
      if (statusEl) statusEl.style.display = 'none';
      setTimeout(() => { if (errorEl) errorEl.style.display = 'none'; _startCustomerTableScan(); }, 2500);
      return;
    }
    const data = await res.json();

    if (!data.session_id) {
      if (errorEl) {
        errorEl.textContent = '⚠️ No active session at this table. Please ask a staff member to open it.';
        errorEl.style.display = 'block';
      }
      if (statusEl) statusEl.style.display = 'none';
      setTimeout(() => { if (errorEl) errorEl.style.display = 'none'; _startCustomerTableScan(); }, 3500);
      return;
    }

    // Success — link order to the scanned table session
    sessionId       = data.session_id;
    tableName       = data.table_name;
    tableUnitId     = data.table_unit_id || null;
    pax             = data.pax || null;
    hasScannedTable = true;
    orderType       = 'dine-in';
    closeTableScanPanel();
    startOrdering();
  } catch (e) {
    if (errorEl) { errorEl.textContent = 'Network error. Please try again.'; errorEl.style.display = 'block'; }
    if (statusEl) statusEl.style.display = 'none';
    setTimeout(() => { if (errorEl) errorEl.style.display = 'none'; _startCustomerTableScan(); }, 2000);
  }
}

/* ─────────────────────────────────────────────────────────────────────────── */

async function startOrdering() {
  _activateMainTab('menu');

  // Initialize language button for menu page
  const currentLang = localStorage.getItem('language') || 'zh';
  setLanguage(currentLang);

  _refreshHeaderText();
  {
    const langLabel = document.getElementById('header-lang-label');
    if (langLabel) langLabel.textContent = currentLang === 'zh' ? '中' : 'EN';
  }

  // Cart bar click handlers — only attach once
  if (!orderingInitialized) {
    orderingInitialized = true;

    document
      .getElementById("confirm-order-btn")
      .addEventListener("click", addCartToPending);

    document
      .getElementById("cart-count")
      .addEventListener("click", openCartDrawer);

    document
      .getElementById("cart-total")
      .addEventListener("click", openCartDrawer);

    const _ordersBtn = document.getElementById('orders-btn');
    if (_ordersBtn) _ordersBtn.addEventListener('click', openOrdersDrawer);

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
  renderFeaturedItems(window.menu);

  // Update order-type badge in menu tab header
  updateMthOrderTypeBadge(orderType);
  loadCartFromStorage();
  loadPendingFromStorage();
  updateCartBadges();

  initCategoryObserver(window.menu.categories);
  // Restore any in-progress to-go order for this restaurant (persists across refreshes)
  if (IS_ORDER_NOW) restoreSavedToGoOrder();
  startOrderPolling();
  updateCartBar();

  await fetchAndApplyPaymentSettings();
  await loadAndRenderServiceRequests();
}

function renderCategories(categories) {
  const catDiv = document.getElementById("categories");
  const menu = document.getElementById("menu");

  catDiv.innerHTML = "";

  categories.forEach(cat => {
    const el = document.createElement("div");
    el.className = "category-item";
    el.innerHTML = `${getCategoryDisplayName(cat)}<span class="cat-badge" id="cat-badge-${cat.id}"></span>`;
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
  window._currentMenuData = menu; // store for re-render on layout toggle
  const container = document.getElementById("menu");
  container.innerHTML = "";

  const { categories, items } = menu;

  categories.forEach(category => {
    // Category title
    const categoryTitle = document.createElement("div");
    categoryTitle.className = "category";
    categoryTitle.id = `category-${category.id}`;
    categoryTitle.textContent = getCategoryDisplayName(category);
    
    container.appendChild(categoryTitle);

    // Grid for items
    const grid = document.createElement("div");
    if (menuLayout === 'compact') {
      grid.className = "menu-grid compact-mode";
    } else {
      grid.className = menuColumns === 2 ? "menu-grid two-columns" : "menu-grid single-column";
    }

    const categoryItems = items.filter(
      item => item.category_id === category.id && (item.available !== false)
    );  

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
  const isUnavail = item.available === false;
  const currentLang = localStorage.getItem('language') || 'zh';
  const isZhLocal = currentLang === 'zh';

  if (menuLayout === 'compact') {
    card.className = "menu-compact-item";
    if (isUnavail) card.style.cssText = 'opacity:0.45;pointer-events:none;';
    card.innerHTML = `
      <span class="cart-badge" id="cart-badge-${item.id}"></span>
      <img
        src="${item.image_url || '/uploads/website/placeholder.png'}"
        onerror="this.src='/uploads/website/placeholder.png';"
        alt="${getItemDisplayName(item)}"
      />
      <div class="mc-info">
        <div class="mc-name">${getItemDisplayName(item)}</div>
        ${item.description ? `<div class="mc-desc">${item.description}</div>` : ''}
        <div class="mc-price">$${(item.price_cents / 100).toFixed(2)}</div>
      </div>
      <button class="mc-btn" onclick="event.stopPropagation(); openDrawer(${item.id})">
        ${isZhLocal ? '點選' : 'Select'}
      </button>
    `;
    card.onclick = () => openDrawer(item.id);
  } else {
    card.className = "menu-item";
    if (isUnavail) card.style.cssText = 'opacity:0.45;pointer-events:none;';
    card.innerHTML = `
      <span class="cart-badge" id="cart-badge-${item.id}"></span>
      <img 
        src="${item.image_url || '/uploads/website/placeholder.png'}" 
        data-item-id="${item.id}"
        data-item-name="${item.name}"
        onerror="this.src='/uploads/website/placeholder.png';"
        alt="${item.name}"
      />
      <div class="menu-item-name">${getItemDisplayName(item)}</div>
      <div class="menu-item-footer">
        <span class="menu-item-price">
          $${(item.price_cents / 100).toFixed(2)}
        </span>
        <span class="menu-item-arrow">›</span>
      </div>
    `;
    card.onclick = () => openDrawer(item.id);
  }

  return card;
}

function renderMenuItemWithVariants(item, addons){
    const card = document.createElement("div");
    card.className = "drawer-item";

    card.innerHTML = `
    ${item.image_url ? `<img src="${item.image_url}" class="drawer-item-rounded-img" onerror="this.style.display='none'" alt="">` : ''}
    <div class="menu-item-content">
      <div class="drawer-item-header-row">
        <div class="menu-item-name">${getItemDisplayName(item)}</div>
        <div class="menu-item-price">$${(item.price_cents / 100).toFixed(2)}</div>
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



        const optGrid = document.createElement("div");
        optGrid.className = "variant-options";

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
          ${o.price_cents > 0 ? `(+$${(o.price_cents / 100).toFixed(2)})` : o.price_cents < 0 ? `(-$${(Math.abs(o.price_cents) / 100).toFixed(2)})` : ""}
          </span>
        `;
      

        optGrid.appendChild(opt);       

      });

        vContainer.appendChild(optGrid);
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
          <span>${o.name}${isUnavail ? ' (Sold Out)' : ''}${o.price_cents > 0 ? ` (+$${(o.price_cents / 100).toFixed(2)})` : o.price_cents < 0 ? ` (-$${(Math.abs(o.price_cents) / 100).toFixed(2)})` : ''}</span>
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

    // Also check service category
    const srEl = document.getElementById('category-service');
    if (srEl && srEl.getBoundingClientRect().top <= triggerY) {
      activeId = 'service';
    }

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
      name_zh: item.name_zh || null,
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
// Return the localStorage key for cart data.
// In order-now mode sessionId is null until the first order is placed,
// so we scope by restaurantId to keep carts isolated between restaurants.
function cartStorageKey() {
  if (sessionId) return `cart_${sessionId}`;
  if (restaurantId) return `cart_r${restaurantId}`;
  return 'cart_null';
}

function saveCartToStorage() {
  try {
    localStorage.setItem(cartStorageKey(), JSON.stringify(cart));
  } catch (e) {
    console.error("Failed to save cart:", e);
  }
}

function pendingStorageKey() {
  return 'pending_' + (sessionId || restaurantId || 'default');
}

function savePendingToStorage() {
  try {
    localStorage.setItem(pendingStorageKey(), JSON.stringify({ items: pendingOrderItems, srCart: pendingSrCart }));
  } catch (e) {}
}

function loadPendingFromStorage() {
  try {
    const raw = localStorage.getItem(pendingStorageKey());
    if (raw) {
      const d = JSON.parse(raw);
      pendingOrderItems = d.items || [];
      pendingSrCart = d.srCart || {};
    }
  } catch (e) {}
}

function clearPendingStorage() {
  try { localStorage.removeItem(pendingStorageKey()); } catch (e) {}
  pendingOrderItems = [];
  pendingSrCart = {};
}


function loadCartFromStorage() {
  try {
    const key = cartStorageKey();
    let stored = localStorage.getItem(key);
    // Migrate from legacy unscoped key if present
    if (!stored && !sessionId && restaurantId) {
      const legacy = localStorage.getItem('cart_null');
      if (legacy) {
        stored = legacy;
        localStorage.removeItem('cart_null');
      }
    }
    if (stored) {
      cart = JSON.parse(stored);
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

/* ─── ORDER REVIEW OVERLAY ──────────────────────────────────── */

// Restore pending items back to cart (when user presses back on order review)
function restorePendingToCart() {
  if (!pendingOrderItems.length && !Object.keys(pendingSrCart).length) return;
  pendingOrderItems.forEach(item => {
    const existingIdx = cart.items.findIndex(p =>
      p.menuItemId === item.menuItemId &&
      JSON.stringify(p.variantOptionIds || []) === JSON.stringify(item.variantOptionIds || [])
    );
    if (existingIdx >= 0) {
      cart.items[existingIdx].quantity += item.quantity;
    } else {
      cart.items.push({ ...item });
    }
  });
  Object.entries(pendingSrCart).forEach(([id, qty]) => {
    srCart[id] = (srCart[id] || 0) + qty;
  });
  clearPendingStorage();
  saveCartToStorage();
  updateCartBar();
}

function addCartToPending() {
  if (paOrderLocked && !IS_ORDER_NOW) {
    alert('Payment is complete — no new orders can be placed.');
    return;
  }
  // IS_ORDER_NOW: auto-clear any completed session so this becomes a fresh order
  if (IS_ORDER_NOW && paOrderLocked) {
    _clearCompletedSession();
  }
  const hasFood = cart.items.length > 0;
  const hasSr = hasSrCartItems();
  if (!hasFood && !hasSr) return;
  // Navigate to orders tab — cart items are shown directly as the review
  closeAllDrawers();
  _activateMainTab('orders');
}

function openOrderReview() {
  if (paOrderLocked && !IS_ORDER_NOW) {
    alert('Payment is complete — no new orders can be placed.');
    return;
  }
  const hasItems = cart.items.length > 0 || Object.values(srCart).some(q => q > 0);
  if (!hasItems) return;
  closeAllDrawers();
  _activateMainTab('orders');
}

function _setOrdersTabHeader(mode) {
  const lang = localStorage.getItem('language') || 'zh';
  const isZh = lang === 'zh';
  const back = document.getElementById('orders-tab-back');
  const title = document.querySelector('#orders-tab .sth-title');
  const historyBtn = document.getElementById('header-history-btn');
  if (mode === 'review') {
    if (back) {
      back.style.display = '';
      back.onclick = () => { closeAllDrawers(); _activateMainTab('menu'); };
    }
    if (title) title.textContent = isZh ? '訂單確認' : 'Order Confirmation';
    if (historyBtn) historyBtn.style.display = 'none';
  } else {
    if (back) back.style.display = 'none';
    if (title) title.textContent = isZh ? '訂單 · Orders' : 'Orders';
    if (historyBtn) historyBtn.style.display = '';
  }
}

function _renderOrderReviewInTab(container) {
  if (paOrderLocked && !IS_ORDER_NOW) {
    container.innerHTML = '<div style="text-align:center;padding:40px 16px;color:#6b7280;">Payment is complete.</div>';
    return;
  }
  const reviewItems = cart.items;
  const reviewSrCart = srCart;
  const hasFood = reviewItems.length > 0;
  const hasSr = Object.values(reviewSrCart).some(q => q > 0);
  if (!hasFood && !hasSr) {
    // Nothing to review — show empty state
    _updateOrdersTabItemsChip(0);
    const empty = document.getElementById('orders-empty-state');
    if (empty) empty.style.display = 'flex';
    container.innerHTML = '';
    return;
  }

  const lang = localStorage.getItem('language') || 'zh';
  const isZh = lang === 'zh';

  let subtotal = 0;
  let itemsHtml = '';
  reviewItems.forEach((item, idx) => {
    const addonTotal = (item.addons || []).reduce((s, a) => s + (a.priceCents || 0) * (a.quantity || 1), 0);
    const line = (item.totalPriceCents + addonTotal) * item.quantity;
    subtotal += line;
    const displayName = getItemDisplayName(item);
    const addonsHtml = (item.addons || []).map(a =>
      `<div style="font-size:11px;color:#667eea;padding-left:8px;">+ ${a.name} $${(a.priceCents/100).toFixed(2)}</div>`
    ).join('');
    const imageHtml = item.image_url
      ? `<img src="${item.image_url}" style="width:56px;height:56px;border-radius:8px;object-fit:cover;flex-shrink:0;margin-right:12px;" onerror="this.style.display='none'">`
      : '';
    itemsHtml += `
      <div style="display:flex;align-items:flex-start;padding:12px 16px;border-bottom:1px solid #f3f4f6;">
        ${imageHtml}
        <div style="flex:1;min-width:0;cursor:pointer;" onclick="(function(){ restorePendingToCart(); openCartDrawer(); openDrawer(${item.menuItemId || item.id}); })()">
          <div style="font-weight:600;font-size:14px;color:#1f2937;">${displayName}</div>
          ${addonsHtml}
          ${item.variantOptionDetails ? item.variantOptionDetails.map(v => `<div style="font-size:11px;color:#9ca3af;padding-left:8px;margin-top:1px;">– ${v.variant}: ${v.option}</div>`).join('') : ''}
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;margin-left:12px;flex-shrink:0;">
          <div style="font-weight:700;font-size:14px;white-space:nowrap;color:#1f2937;">$${(line/100).toFixed(2)}</div>
          <div style="display:flex;align-items:center;gap:6px;">
            <button onclick="(function(){ if(cart.items[${idx}].quantity>1){cart.items[${idx}].quantity--;}else{cart.items.splice(${idx},1);} saveCartToStorage(); _renderOrdersTabContent(); updateCartBar(); })()" style="width:26px;height:26px;border-radius:50%;border:1.5px solid #d1d5db;background:#fff;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#374151;line-height:1;">−</button>
            <span style="font-size:14px;font-weight:600;color:#1f2937;min-width:16px;text-align:center;">${item.quantity}</span>
            <button onclick="(function(){ cart.items[${idx}].quantity++; saveCartToStorage(); _renderOrdersTabContent(); updateCartBar(); })()" style="width:26px;height:26px;border-radius:50%;border:1.5px solid #d1d5db;background:#fff;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#374151;line-height:1;">+</button>
          </div>
        </div>
      </div>`;
  });

  const serviceCharge = Math.round(subtotal * serviceChargePct / 100);
  const xishDiscountCents = (xishMember && xishMember.discount_percent > 0)
    ? Math.round(subtotal * xishMember.discount_percent / 100) : 0;
  const couponDiscountCents = appliedCoupon ? (appliedCoupon.discount_cents || 0) : 0;
  const total = subtotal + serviceCharge - xishDiscountCents - couponDiscountCents;

  // Name/phone fields only for order-now mode (counter/pickup QR)
  const showNamePhone = IS_ORDER_NOW && !hasScannedTable;
  const namePhoneHtml = showNamePhone ? `
    <div style="display:flex;flex-direction:column;gap:10px;">
      <div>
        <label style="font-size:12px;color:#6b7280;font-weight:600;">${isZh ? '姓名（取餐通知用）' : 'Your Name (for pickup notification)'}</label>
        <input id="review-customer-name" type="text" placeholder="${isZh ? '例：陳大明' : 'e.g. John'}"
          style="width:100%;margin-top:4px;padding:10px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;box-sizing:border-box;outline:none;">
      </div>
      <div>
        <label style="font-size:12px;color:#6b7280;font-weight:600;">${isZh ? '電話（可選）' : 'Phone Number (optional)'}</label>
        <input id="review-customer-phone" type="tel" placeholder="${isZh ? '例：9123 4567' : 'e.g. 9123 4567'}"
          style="width:100%;margin-top:4px;padding:10px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;box-sizing:border-box;outline:none;">
      </div>
    </div>` : '';

  // Order type label
  const orderTypeLabel = orderType === 'dine-in'
    ? (isZh ? '堂食' : 'Dine In')
    : orderType === 'counter'
      ? (isZh ? '堂食' : 'Dine In')
      : (isZh ? '外帶' : 'Takeaway');

  // Update items chip with pending count
  const _pendingQty = reviewItems.reduce((s, i) => s + i.quantity, 0);
  _updateOrdersTabItemsChip(_pendingQty);

  // Switch header to "Order Confirmation" mode
  _setOrdersTabHeader('review');

  container.innerHTML = `
    <div style="background:#f5f5f5;min-height:100%;">
      <!-- Restaurant info + order type row -->
      <div style="background:#fff;padding:12px 16px;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;justify-content:space-between;">
        <div style="display:flex;align-items:center;gap:8px;min-width:0;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          <span style="font-size:13px;font-weight:600;color:#374151;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escXish(restaurantName || '')}</span>
        </div>
        <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h2v11h2V2H3z"/><path d="M18 2v20h-2v-8h-3V6c0-2.2 1.8-4 4-4z"/></svg>
          <span style="font-size:13px;font-weight:600;color:var(--restaurant-color,#667eea);">${orderTypeLabel}</span>
        </div>
      </div>

      <!-- Order Details section -->
      <div style="background:#fff;margin-top:8px;">
        <div style="padding:14px 16px 10px;display:flex;align-items:center;gap:8px;">
          <span style="width:3px;height:16px;background:var(--restaurant-color,#667eea);border-radius:2px;display:inline-block;"></span>
          <span style="font-size:15px;font-weight:700;color:#1f2937;">${isZh ? '訂單詳情' : 'Order Details'}</span>
        </div>
        <div style="height:1px;background:#f3f4f6;margin:0 16px;"></div>
        ${itemsHtml || '<p style="color:#9ca3af;text-align:center;padding:20px 0;">No items</p>'}
      </div>

      <!-- Summary -->
      <div style="background:#fff;margin-top:8px;padding:14px 16px;">
        <div style="display:flex;justify-content:space-between;font-size:14px;color:#6b7280;padding:6px 0;">
          <span>${t('menu.subtotal-label') || 'Subtotal'}</span>
          <span>$${(subtotal/100).toFixed(2)}</span>
        </div>
        ${serviceChargePct > 0 ? `<div style="display:flex;justify-content:space-between;font-size:14px;color:#6b7280;padding:6px 0;">
          <span>${t('menu.service-charge-label')||'Service Charge'} (${serviceChargePct}%)</span>
          <span>$${(serviceCharge/100).toFixed(2)}</span>
        </div>` : ''}
        ${xishDiscountCents > 0 ? `<div style="display:flex;justify-content:space-between;font-size:14px;color:#A10035;font-weight:600;padding:6px 0;">
          <span>✦ XISH (${xishMember.discount_percent}% off)</span>
          <span>-$${(xishDiscountCents/100).toFixed(2)}</span>
        </div>` : ''}
        <div style="display:flex;justify-content:space-between;font-size:17px;font-weight:800;color:#1f2937;padding:10px 0 4px;">
          <span>${t('menu.total-label') || 'Total'}</span>
          <span>$${(total/100).toFixed(2)}</span>
        </div>
      </div>

      <!-- Coupon row -->
      ${(window.sessionData && window.sessionData.feature_flags && window.sessionData.feature_flags.coupons === false) ? '' : `
      <div style="background:#fff;margin-top:8px;">
        <button id="review-coupon-row" onclick="openCouponSheet()" style="width:100%;display:flex;align-items:center;justify-content:space-between;padding:14px 16px;background:none;border:none;border-top:1px solid #f3f4f6;border-bottom:1px solid #f3f4f6;cursor:pointer;text-align:left;">
          <div style="display:flex;align-items:center;gap:10px;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2"><path d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 0 0-2 2v3a2 2 0 0 1 0 4v3a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3a2 2 0 0 1 0-4V7a2 2 0 0 0-2-2H5z"/></svg>
            <span style="font-size:14px;color:#374151;font-weight:500;">${isZh ? '優惠券' : 'Coupons'}</span>
          </div>
          <div style="display:flex;align-items:center;gap:6px;">
            <span style="font-size:13px;color:${appliedCoupon ? '#059669' : '#9ca3af'};">
              ${appliedCoupon ? `-$${(couponDiscountCents/100).toFixed(2)} (${escXish(appliedCoupon.code)})` : (isZh ? '暫無' : 'None')}
            </span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
          </div>
        </button>
      </div>
      `}

      ${showNamePhone ? `<div style="background:#fff;margin-top:8px;padding:14px 16px;">${namePhoneHtml}</div>` : ''}

      <!-- Bottom action buttons (same row) -->
      <div style="padding:16px;background:#fff;margin-top:8px;padding-bottom:24px;">
        <div style="display:flex;gap:10px;align-items:stretch;">
          <button onclick="closeAllDrawers(); _activateMainTab('menu');" style="flex:1;padding:13px 10px;background:#fff;color:var(--restaurant-color,#667eea);border:1.5px solid var(--restaurant-color,#667eea);border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;-webkit-tap-highlight-color:transparent;">
            ${isZh ? '繼續點餐' : 'Add Items'}
          </button>
          <button id="review-place-order-btn" onclick="(function(){
            var nameEl = document.getElementById('review-customer-name');
            var phoneEl = document.getElementById('review-customer-phone');
            var n = nameEl ? nameEl.value.trim() || null : null;
            var p = phoneEl ? phoneEl.value.trim() || null : null;
            submitOrder({ customerName: n, customerPhone: p });
          })()" style="flex:2;padding:13px 10px;background:var(--restaurant-color,#667eea);color:#fff;border:none;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;-webkit-tap-highlight-color:transparent;">
            ${isZh ? '下單並支付' : 'Confirm & Pay'}
          </button>
        </div>
      </div>
    </div>
  `;
}

function _updateOrdersTabItemsChip(count) {
  const chip = document.getElementById('orders-items-chip');
  const countEl = document.getElementById('orders-items-chip-count');
  if (!chip || !countEl) return;
  if (!count || count <= 0) { chip.style.display = 'none'; return; }
  countEl.textContent = count;
  chip.style.display = '';
}

function _showOrderItemsSheet() {
  const lang = localStorage.getItem('language') || 'zh';
  const isZh = lang === 'zh';
  let items = [];
  if (pendingOrderItems.length > 0) {
    items = pendingOrderItems.map(i => ({ name: getItemDisplayName(i), qty: i.quantity }));
  }
  const sheet = document.createElement('div');
  sheet.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:2000;display:flex;align-items:flex-end;justify-content:center;';
  const itemsHtml = items.length
    ? items.map(i => `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:14px;"><span style="color:#1f2937;">${i.name}</span><span style="font-weight:700;color:#1f2937;">×${i.qty}</span></div>`).join('')
    : `<div style="text-align:center;color:#9ca3af;padding:16px 0;font-size:13px;">${isZh ? '請往下滾動查看訂單' : 'Scroll down to see your order.'}</div>`;
  sheet.innerHTML = `
    <div style="background:#fff;border-radius:20px 20px 0 0;width:100%;max-width:430px;padding:20px 16px 36px;max-height:60vh;overflow-y:auto;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <span style="font-size:16px;font-weight:700;color:#1f2937;">${isZh ? '訂單項目' : 'Order Items'}</span>
        <button onclick="this.closest('div[style*=position]').remove()" style="background:none;border:none;font-size:20px;cursor:pointer;color:#374151;">✕</button>
      </div>
      ${itemsHtml}
    </div>
  `;
  sheet.onclick = e => { if (e.target === sheet) sheet.remove(); };
  document.body.appendChild(sheet);
}

async function submitOrder({ customerName = null, customerPhone = null } = {}) {
  if (paOrderLocked && !IS_ORDER_NOW) {
    alert('Payment is complete — no new orders can be placed.');
    return;
  }
  // Use cart.items directly (single source of truth)
  const submitItems = cart.items;
  const submitSrCart = srCart;
  const hasFood = submitItems.length > 0;
  const hasSr = Object.values(submitSrCart).some(q => q > 0);
  if (!hasFood && !hasSr) return;

  // ─── Order-now / To-Go mode: create a fresh session + order ─────────────
  // After scanning a table QR from order-now mode, route through the table session path
  if (IS_ORDER_NOW && !hasScannedTable && hasFood) {
    // customerName/customerPhone passed in from the order review page

    const payload = {
      pax: 1,
      order_type: orderType,   // 'takeaway', 'counter', etc.
      customer_name: customerName,
      customer_phone: customerPhone,
      items: submitItems.map(i => ({
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

    try {
      const res = await fetch(`${API_BASE}/restaurants/${restaurantId}/to-go-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || 'Order failed');
        return;
      }
      const data = await res.json();
      sessionId = data.session.id;
      lastOrderId = data.order ? data.order.id : null;
      // Persist order info so it survives a page refresh
      if (restaurantId && data.order) {
        try {
          localStorage.setItem('togo_r' + restaurantId, JSON.stringify({
            sessionId: data.session.id,
            orderId: data.order.id,
            orderNumber: data.order.restaurant_order_number,
            customerName: customerName || null,
            placedAt: Date.now()
          }));
          // Also append to history list (cap at 20 entries)
          const histKey = 'togo_history_r' + restaurantId;
          let hist = [];
          try { hist = JSON.parse(localStorage.getItem(histKey) || '[]'); } catch (_) {}
          hist = hist.filter(e => e.sessionId !== data.session.id);
          hist.unshift({ sessionId: data.session.id, orderNumber: data.order.restaurant_order_number, placedAt: Date.now() });
          if (hist.length > 20) hist = hist.slice(0, 20);
          localStorage.setItem(histKey, JSON.stringify(hist));
        } catch (_) {}
      }
      cart.items = [];
      saveCartToStorage();
      updateCartBar();
      closeAllDrawers();
      await fetchAndApplyPaymentSettings();
      if (orderPayEnabled && lastOrderId) {
        _activateMainTab('orders');
        showPaymentPage(lastOrderId);
      } else {
        showToGoConfirmation(customerName, data.order);
      }
    } catch (err) {
      alert('Order failed: ' + err.message);
    }
    return;
  }
  // ─────────────────────────────────────────────────────────────────────────

  if (hasFood) {
    // Table-session takeaway: customer at a scanned table chose to take food away
    const isTableTakeaway = !IS_ORDER_NOW && orderType === 'takeaway' && !!tableName;
    const payload = {
      is_takeaway: isTableTakeaway,
      items: submitItems.map(i => ({
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
    lastOrderId = orderData.order_id;

    cart.items = [];
    saveCartToStorage();
  }

  if (hasSr) {
    await submitSrItems();
  }

  updateCartBar();
  closeAllDrawers();

  // Refresh payment settings then navigate to orders tab
  await fetchAndApplyPaymentSettings();
  if (orderPayEnabled && lastOrderId) {
    // Online payment configured — show Payment Asia gateway from orders tab
    _activateMainTab('orders');
    showPaymentPage(lastOrderId);
  } else {
    // No online payment — show placed orders with Close bill / Contact staff
    _activateMainTab('orders');
  }
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
  updateVariantCounter(itemId, variant);
  updateAddToCartButton(item);
  _updateDrawerFooter();
}

async function loadOrderStatus({ forceRender = false } = {}) {
  if (!sessionId) {
    // In order-now mode with no session yet, show empty tracking state if drawer is open
    if (IS_ORDER_NOW) {
      const el = document.getElementById('orders-drawer-content');
      if (el && document.getElementById('orders-drawer')?.classList.contains('open')) {
        el.innerHTML = '<div style="text-align:center;padding:40px 16px;color:#9ca3af;">📋 No active order yet.<br>Browse the menu and place your first order!</div>';
      }
    }
    return;
  }
  if (paymentPageActive) return; // don't overwrite the inline payment page

  try {
    const url = `${API_BASE}/sessions/${sessionId}/orders?restaurantId=${restaurantId}`;
    const res = await fetch(url);

    if (!res.ok) {
      console.warn("❌ API returned:", res.status, res.statusText);
      return;
    }

    const data = await res.json();
    const orders = data.items || [];

    // In order-now mode, also fetch queue position for tracking UI
    let queueInfo = null;
    if (IS_ORDER_NOW && sessionId) {
      try {
        const qRes = await fetch(`${API_BASE}/sessions/${sessionId}/queue-position`);
        if (qRes.ok) queueInfo = await qRes.json();
      } catch (_) {}
    }

    // Only re-render the drawer when data has actually changed (avoids flicker)
    const newHash = JSON.stringify(orders) + JSON.stringify(queueInfo);
    if (forceRender || newHash !== lastOrdersHash) {
      lastOrdersHash = newHash;
      renderOrdersDrawer(orders, tableName, queueInfo);
    }

    // Clear localStorage if order is ready
    if (IS_ORDER_NOW && queueInfo && queueInfo.status === 'ready') {
      const key = 'togo_r' + restaurantId;
      // Keep for 30 more minutes after ready so customer can still see their number
      const raw = localStorage.getItem(key);
      if (raw) {
        try {
          const saved = JSON.parse(raw);
          if (!saved.readyAt) {
            saved.readyAt = Date.now();
            localStorage.setItem(key, JSON.stringify(saved));
          } else if (Date.now() - saved.readyAt > 30 * 60 * 1000) {
            localStorage.removeItem(key);
          }
        } catch (_) {}
      }
    }

    // If awaiting confirmation, check if any order is now completed
    if (confirmationPollingActive) {
      const anyPACompleted = orders.some(
        o => o.order_payment_method === 'payment-asia' && o.order_status === 'completed'
      );
      if (anyPACompleted) {
        stopConfirmationPolling();
        showPaymentReturnBanner(true);
        return;
      }
      if (Date.now() > confirmationPollDeadline) {
        stopConfirmationPolling();
        return;
      }
    }

    const pendingPA = orders.find(o => o.order_payment_method === 'payment-asia' && o.order_status !== 'completed');
    if (pendingPA) {
      fetch(`${API_BASE}/restaurants/${restaurantId}/orders/${pendingPA.order_id}/payment-status`)
        .catch(() => {}); // fire-and-forget
    }
  } catch (error) {
    console.error("❌ Error loading orders:", error);
  }
}

/** Start fast 2-second polling for up to 5 minutes to confirm PA payment. */
function startConfirmationPolling() {
  if (confirmationPollingActive) return;
  confirmationPollingActive = true;
  confirmationPollDeadline = Date.now() + 5 * 60 * 1000; // 5 minutes
  // Show a subtle "Confirming payment…" indicator inside the drawer
  const el = document.getElementById('orders-drawer-content');
  if (el) {
    const bar = document.createElement('div');
    bar.id = 'payment-confirming-bar';
    bar.style.cssText = 'background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:10px 14px;margin:8px 0;font-size:13px;color:#92400e;text-align:center;';
    bar.textContent = '⏳ Confirming your payment…';
    el.prepend(bar);
  }
  loadOrderStatus({ forceRender: false }); // immediate check
  confirmationPollTimer = setInterval(() => loadOrderStatus({ forceRender: false }), 2000);
}

/** Stop fast confirmation polling and remove the confirming bar. */
function stopConfirmationPolling() {
  confirmationPollingActive = false;
  if (confirmationPollTimer) { clearInterval(confirmationPollTimer); confirmationPollTimer = null; }
  const bar = document.getElementById('payment-confirming-bar');
  if (bar) bar.remove();
}

/** Show a sticky banner after returning from the PA gateway. */
function showPaymentReturnBanner(isSuccess) {
  const existing = document.getElementById('payment-return-banner');
  if (existing) existing.remove();
  const banner = document.createElement('div');
  banner.id = 'payment-return-banner';
  banner.style.cssText = `position:fixed;top:0;left:0;right:0;z-index:9999;padding:14px 20px;text-align:center;font-size:15px;font-weight:bold;color:white;background:${isSuccess ? '#16a34a' : '#dc2626'};box-shadow:0 2px 8px rgba(0,0,0,0.3);cursor:pointer;`;
  banner.textContent = isSuccess ? '✅ Payment confirmed! Your order is all set.' : '❌ Payment was not completed. Please try again or pay at the counter.';
  banner.onclick = () => banner.remove();
  document.body.prepend(banner);
  // Success banner stays until dismissed (tap to close); failure banner also stays
}

async function cancelPAPayment(orderId) {
  if (!orderId) return;
  try {
    const res = await fetch(
      `${API_BASE}/restaurants/${restaurantId}/orders/${orderId}/cancel-payment`,
      { method: 'POST' }
    );
    if (res.ok) {
      lastOrdersHash = null; // invalidate cache so cancel re-renders
      loadOrderStatus({ forceRender: true });
    } else {
      alert('Could not cancel payment. Please ask staff for assistance.');
    }
  } catch (e) {
    alert('Network error — please try again.');
  }
}

function renderOrdersDrawer(orders, tableName, queueInfo = null) {
  const el = document.getElementById("orders-drawer-content");
  if (!el) {
    console.error("❌ orders-drawer-content element not found");
    return;
  }

  const lang = localStorage.getItem('language') || 'zh';
  const isZh = lang === 'zh';

  let subtotal = 0;

  // Compute payment state up-front so IS_ORDER_NOW block can use it
  const allPACompleted = orders.length > 0 && orders.every(o =>
    o.order_status === 'completed' && o.order_payment_method === 'payment-asia'
  );
  paOrderLocked = allPACompleted;

  let html = `
    <div class="orders-body">
    <div class="orders-items">
  `;

  // ── Pickup tracking header for order-now (QR pickup) mode ──────────────
  if (IS_ORDER_NOW && orders.length > 0) {
    const firstOrder = orders[0];
    const orderNum = firstOrder.restaurant_order_number || firstOrder.order_id;
    const isReady = queueInfo && queueInfo.status === 'ready';
    const aheadCount = queueInfo ? queueInfo.orders_ahead : null;
    const hasPendingPAPayment = orders.some(o => o.order_payment_method === 'payment-asia' && o.order_status !== 'completed');

    if (allPACompleted) {
      // Order is paid + complete — show plain order number heading (no coloured card)
      html += `<div style="padding:12px 0 6px;font-size:24px;font-weight:900;color:#1f2937;">\u0023${orderNum}</div>`;
    } else if (hasPendingPAPayment) {
      html += `
        <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:12px;padding:16px;text-align:center;margin-bottom:16px;">
          <div style="font-size:22px;margin-bottom:4px;">💳</div>
          <div style="font-size:13px;color:#78350f;font-weight:600;">${isZh ? '等待付款確認…' : 'Awaiting payment…'}</div>
          <div style="font-size:32px;font-weight:900;color:#92400e;margin:8px 0;">#${orderNum}</div>
          <div style="font-size:12px;color:#92400e;">${isZh ? '付款確認後，廚房將開始準備' : 'Kitchen will start once payment is confirmed'}</div>
        </div>`;
    } else if (isReady) {
      html += `
        <div style="background:#d1fae5;border:1px solid #6ee7b7;border-radius:12px;padding:16px;text-align:center;margin-bottom:16px;">
          <div style="font-size:26px;margin-bottom:6px;">✅</div>
          <div style="font-size:15px;font-weight:700;color:#065f46;">${t('menu.ready-for-pickup') || (isZh ? '✓ 可以取餐了！' : '✓ Ready for pickup!')}</div>
          <div style="font-size:28px;font-weight:900;color:#065f46;margin:8px 0;">#${orderNum}</div>
          <div style="font-size:12px;color:#047857;">${isZh ? '請持此號碼到櫃台取餐' : 'Please collect your order at the counter'}</div>
        </div>`;
    } else {
      html += `
        <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:12px;padding:16px;text-align:center;margin-bottom:16px;">
          <div style="font-size:22px;margin-bottom:4px;">⏳</div>
          <div style="font-size:13px;color:#78350f;font-weight:600;">${t('menu.being-prepared') || (isZh ? '正在準備中…' : 'Being prepared…')}</div>
          <div style="font-size:32px;font-weight:900;color:#92400e;margin:8px 0;">#${orderNum}</div>
          ${aheadCount !== null ? `<div style="font-size:12px;color:#92400e;">
            ${aheadCount > 0
              ? `${aheadCount} ${t('menu.orders-ahead') || (isZh ? '個訂單在你前面' : 'order(s) ahead of you')}`
              : (isZh ? '你是下一位！' : "You're next!")}
          </div>` : ''}
        </div>`;
    }
    // Try browser notification when ready
    if (isReady && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(isZh ? '你的訂單已準備好！🥡' : 'Your order is ready! 🥡', {
        body: isZh ? `訂單 #${orderNum} 請到櫃台取餐` : `Order #${orderNum} – please collect at the counter.`
      });
    }
  }

  // Show takeaway banner if this is a table-takeaway order
  if (orders.length && orders[0].is_takeaway && tableName) {
    html += `<div style="display:flex;align-items:center;gap:8px;padding:10px 14px;background:rgba(249,115,22,0.06);border:1px solid rgba(249,115,22,0.2);border-radius:10px;margin-bottom:12px;">
      <span style="font-size:18px;">🥡</span>
      <div>
        <div style="font-size:13px;font-weight:700;color:#ea580c;">${isZh ? '外帶訂單' : 'Takeaway Order'}</div>
        <div style="font-size:11px;color:#9ca3af;">${isZh ? '送往' : 'Deliver to'} ${t('menu.table-label')} ${tableName}</div>
      </div>
    </div>`;
  }

  if (!orders.length) {
    html += `<p class="no-orders">📋 ${isZh ? '暫無訂單' : 'No orders yet'}</p>`;
  } else {
    orders.forEach((order, oIdx) => {
      const isCompleted = order.order_status === 'completed';
      const isPAPayment = order.order_payment_method === 'payment-asia';
      const isPaid = isCompleted;
      const isHandledByPA = isPAPayment;

      // When ALL orders are complete, show items clearly (no fading) with paid badge
      if (allPACompleted) {
        if (oIdx > 0) {
          html += `<div style="font-size:12px;color:#666;margin:8px 0 4px;font-weight:600;">${isZh ? '訂單' : 'Order'} #${order.restaurant_order_number || order.order_id} <span style="margin-left:8px;padding:2px 8px;background:#d1fae5;color:#065f46;border-radius:10px;font-size:11px;">✓ ${isZh ? '已付款' : 'Paid'}</span></div>`;
        }
      } else if (isHandledByPA || isPaid) {
        html += `<div style="opacity:0.65;">`;
      } else if (oIdx > 0) {
        const isTakeawayBadge = order.is_takeaway
          ? `<span class="order-type-badge takeaway">🥡 ${isZh ? '外帶' : 'Takeaway'}</span>`
          : '';
        html += `<div style="font-size:12px;color:#666;margin:8px 0 4px;font-weight:600;">${isZh ? '訂單' : 'Order'} #${order.restaurant_order_number || order.order_id}${isTakeawayBadge} <span style="margin-left:8px;padding:2px 8px;background:#f3f4f6;color:#374151;border-radius:10px;font-size:11px;">${isZh ? '未付款' : 'Unpaid'}</span></div>`;
      }

      order.items.forEach(item => {
        const line = item.item_total_cents || (item.unit_price_cents * item.quantity) || 0;
        subtotal += line;

        const itemName = (lang === 'zh' && (item.menu_item_name_zh || item.name_zh)) ? (item.menu_item_name_zh || item.name_zh) : (item.menu_item_name || item.name || 'Unknown');
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
            return `<div style="font-size: 11px; color: #667eea; margin-left: 12px; margin-top: 2px;">+ ${lang === 'zh' && addon.menu_item_name_zh ? addon.menu_item_name_zh : (addon.menu_item_name || addon.name || 'Addon')} x${addon.quantity} <span style="color:#888;">$${(addonPrice / 100).toFixed(2)}</span></div>${addonVarHtml}`;
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

      if (!allPACompleted && (isHandledByPA || isPaid)) html += `</div>`; // end opacity wrapper
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
    ${allPACompleted ? '' : ''}
    <div class="orders-actions">
      ${(() => {
        if (allPACompleted) {
          const newOrderBtn = IS_ORDER_NOW
            ? `<button class="btn-primary" style="margin-top:16px;" onclick="startNewOrder()">${isZh ? '再次落單' : 'New Order'}</button>`
            : '';
          return `<div style="display:flex;flex-direction:column;align-items:center;padding:12px 0;text-align:center;width:100%;">
            <p style="font-size:13px;color:#6b7280;margin:0;">${isZh ? '已付款' : 'Paid'}</p>
            ${newOrderBtn}
          </div>`;
        }
        // Exclude orders where PA payment was already initiated (payment_method = 'payment-asia')
        const unpaidNonPAOrder = orders.filter(o =>
          o.order_status !== 'completed' && o.order_payment_method !== 'payment-asia'
        ).slice(-1)[0];
        // PA orders that are genuinely in-flight (not failed — backend clears payment_method on failure)
        const hasPendingPAOrder = orders.some(o =>
          o.order_payment_method === 'payment-asia' && o.order_status !== 'completed'
        );
        if (orderPayEnabled && unpaidNonPAOrder) {
          return `<button class="btn-primary" onclick="showPaymentPage(${unpaidNonPAOrder.order_id})">${isZh ? '立即付款' : 'Pay Now'}</button>`;
        }
        if (hasPendingPAOrder) {
          // PA initiated but webhook not yet confirmed — prevent double-pay; show persistent status
          const pendingPAOrder = orders.find(o => o.order_payment_method === 'payment-asia' && o.order_status !== 'completed');
          return `<div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:10px 14px;margin-bottom:8px;text-align:center;">
              <div style="font-size:13px;font-weight:600;color:#92400e;">${isZh ? '⏳ 等待付款確認…' : '⏳ Awaiting payment confirmation…'}</div>
            </div>
            <button class="btn-secondary" style="font-size:12px;" onclick="cancelPAPayment(${pendingPAOrder?.order_id})">${isZh ? '✕ 取消並重試' : '✕ Cancel and try again'}</button>`;
        }
        if (orderPayEnabled) {
          // Order & Pay mode but no unpaid order yet — nothing to pay
          return `<button class="btn-primary" disabled style="opacity:0.5;">${isZh ? '立即付款' : 'Pay Now'}</button>`;
        }
        return `<button class="btn-primary" id="close-bill-btn" onclick="closeBill()">${t('menu.close-bill')}</button>`;
      })()}
      ${allPACompleted ? '' : `<button class="btn-secondary" id="call-staff-btn" onclick="callStaff()">${t('menu.call-staff')}</button>`}
    </div>
    </div>
  `;

  el.innerHTML = html;

  // Sync to orders tab when it's active and:
  // - cart is empty (normal placed-orders view), OR
  // - IS_ORDER_NOW with a completed locked session (receipt must show even with cart items)
  const _ordersTabContent = document.getElementById('orders-tab-content');
  const _shouldSyncReceipt = !cart.items.length || (IS_ORDER_NOW && paOrderLocked);
  if (_ordersTabContent && typeof _activeMainTab !== 'undefined' && _activeMainTab === 'orders' && _shouldSyncReceipt) {
    _ordersTabContent.style.padding = '0';
    _ordersTabContent.innerHTML = html;
  }
  // Update items count chip
  let _chipCount = 0;
  orders.forEach(o => (o.items || []).forEach(i => { _chipCount += (i.quantity || 1); }));
  _updateOrdersTabItemsChip(_chipCount);
}

function renderCartDrawer() {
  const el = document.getElementById("cart-drawer-content");

  if (!cart.items.length && !hasSrCartItems()) {
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
          ${item.image_url ? `<img class="order-item-thumb" src="${item.image_url}" alt="${getItemDisplayName(item)}" loading="lazy">` : ''}
          <div class="cart-item-details">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
              <div style="flex:1;min-width:0;">
                <strong style="font-size:14px;color:#1f2937;">${getItemDisplayName(item)}</strong>
                ${item.variantOptionDetails ? item.variantOptionDetails.map(function(v) { return `<div style="font-size:11px;color:#6b7280;margin-top:2px;">${v.variant}: ${v.option}</div>`; }).join("") : ""}
                ${addonsHtml}
              </div>
              <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0;">
                <span style="font-size:13px;font-weight:700;color:#1f2937;">$${(line / 100).toFixed(2)}</span>
                <div style="display:flex;align-items:center;gap:4px;">
                  <button style="width:22px;height:22px;border-radius:50%;border:1.5px solid #d1d5db;background:#fff;font-size:14px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;" onclick="updateCartQty(${idx}, -1)">−</button>
                  <span style="font-size:13px;font-weight:600;min-width:16px;text-align:center;">${item.quantity}</span>
                  <button style="width:22px;height:22px;border-radius:50%;border:1.5px solid #d1d5db;background:#fff;font-size:14px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;" onclick="updateCartQty(${idx}, 1)">+</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join("");

  // Service request items in cart
  const currentLang = localStorage.getItem('language') || 'en';
  serviceRequestItems.forEach(item => {
    const qty = srCart[item.id] || 0;
    if (!qty) return;
    const color = item.color || '#8b5cf6';
    const label = (currentLang === 'zh' && item.label_zh) ? item.label_zh : item.label_en;
    html += `
      <div class="cart-item">
        <div class="cart-item-body">
          ${item.image_url ? `<img class="order-item-thumb" src="${item.image_url}" alt="${label}" loading="lazy">` : `<div class="order-item-thumb order-item-thumb-placeholder"></div>`}
          <div class="cart-item-details">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
              <div style="flex:1;min-width:0;">
                <strong style="font-size:14px;color:#1f2937;">${label}</strong>
                <div style="font-size:11px;font-weight:700;color:${color};margin-top:2px;">Request</div>
              </div>
              <div style="display:flex;align-items:center;gap:4px;flex-shrink:0;">
                <button style="width:22px;height:22px;border-radius:50%;border:1.5px solid #d1d5db;background:#fff;font-size:14px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;" onclick="adjustSrCart(${item.id}, -1)">−</button>
                <span style="font-size:13px;font-weight:600;min-width:16px;text-align:center;">${qty}</span>
                <button style="width:22px;height:22px;border-radius:50%;border:1.5px solid #d1d5db;background:#fff;font-size:14px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;" onclick="adjustSrCart(${item.id}, 1)">+</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  });

  html += '</div>';

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

function adjustSrCart(itemId, delta) {
  const item = serviceRequestItems.find(i => i.id === itemId);
  if (!item) return;
  srCart[itemId] = (srCart[itemId] || 0) + delta;
  if (srCart[itemId] <= 0) delete srCart[itemId];
  updateSrBadges();
  updateCartBar();
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
  const srCount = Object.values(srCart).reduce((s, q) => s + q, 0);
  const totalCount = count + srCount;

  const subtotalCents = cart.items.reduce(
    (sum, i) => {
      const addonTotal = (i.addons || []).reduce((s, a) => s + (a.priceCents || 0) * (a.quantity || 1), 0);
      return sum + (i.totalPriceCents + addonTotal) * i.quantity;
    },
    0
  );
  const serviceCharge = Math.round(subtotalCents * serviceChargePct / 100);
  const xishDiscountCents = (xishMember && xishMember.discount_percent > 0)
    ? Math.round(subtotalCents * xishMember.discount_percent / 100)
    : 0;
  const totalCents = subtotalCents + serviceCharge - xishDiscountCents;

  countEl.textContent = `${totalCount} item${totalCount !== 1 ? "s" : ""}`;
  totalEl.textContent = `$${(totalCents / 100).toFixed(2)}${xishDiscountCents > 0 ? ' ✦' : ''}`;

  btn.disabled = totalCount === 0;
  updateCartBadges();
  updateSrBadges();
  // Red badge on menu nav tab showing cart item count
  const _mnuBadge = document.getElementById('bn-menu-badge');
  if (_mnuBadge) {
    if (count > 0) { _mnuBadge.textContent = count; _mnuBadge.style.display = 'flex'; }
    else { _mnuBadge.style.display = 'none'; }
  }
}

// Qty state for the sticky footer
let _drawerQty = 1;
let _drawerActiveItem = null;

window.changeDrawerQty = function(delta) {
  _drawerQty = Math.max(1, _drawerQty + delta);
  const el = document.getElementById('idf-qty');
  if (el) el.textContent = _drawerQty;
  _updateDrawerFooter();
};

window.addFromDrawer = function() {
  if (_drawerActiveItem) {
    for (let i = 0; i < _drawerQty; i++) addToCart(_drawerActiveItem);
    closeAllDrawers();
  }
};

function _updateDrawerFooter() {
  if (!_drawerActiveItem) return;
  const item = _drawerActiveItem;
  let price = item.price_cents;
  const sels = variantSelections[item.id] || {};
  if (item.variants) {
    item.variants.forEach(v => {
      (sels[v.id] || []).forEach(optId => {
        const opt = v.options.find(o => o.id === optId);
        if (opt) price += (opt.price_cents || 0);
      });
    });
  }
  price *= _drawerQty;
  const priceEl = document.getElementById('idf-price');
  if (priceEl) priceEl.textContent = `$${(price / 100).toFixed(2)}`;
  // Options summary
  const summaryEl = document.getElementById('idf-options-summary');
  if (summaryEl) {
    const parts = [];
    if (item.variants) {
      item.variants.forEach(v => {
        const ids = sels[v.id] || [];
        if (ids.length) {
          const names = ids.map(id => { const o = v.options.find(o => o.id === id); return o ? o.name : ''; }).filter(Boolean);
          if (names.length) parts.push(names.join(', '));
        }
      });
    }
    summaryEl.textContent = parts.join(' · ');
  }
  // Enable/disable add btn
  const addBtn = document.getElementById('idf-add-btn');
  if (addBtn) addBtn.disabled = !canAddToCart(item);
}

async function openDrawer(itemId) {
  closeAllDrawers();

  const item = window.menu.items.find(i => i.id === itemId);
  if (!item) return;

  _drawerActiveItem = item;
  _drawerQty = 1;

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
  // Hide the inner add-btn (replaced by sticky footer)
  const innerAddBtn = itemUI.querySelector('.add-btn');
  if (innerAddBtn) innerAddBtn.style.display = 'none';
  content.appendChild(itemUI);

  activeDrawer.classList.add("open");
  setCartBarVisible(false);

  // Show + populate footer
  const footer = document.getElementById('item-drawer-footer');
  if (footer) {
    footer.style.display = '';
    document.getElementById('idf-qty').textContent = '1';
    _updateDrawerFooter();
  }

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
  const backBtn      = document.getElementById('header-back-btn');
  const pageTitle    = document.getElementById('header-page-title');
  const headerTableName = document.getElementById('header-table-name');
  const menuBtn      = document.getElementById('header-menu-btn');
  const orderInfo    = document.getElementById('header-order-info');
  const headerIcons  = document.getElementById('header-icons');
  const searchRow    = document.getElementById('menu-search-row');
  const historyBtn   = document.getElementById('header-history-btn');

  const show = el => el && (el.style.display = '');
  const hide = el => el && (el.style.display = 'none');

  if (active) {
    show(backBtn);
    show(pageTitle);
    show(headerTableName);
    hide(menuBtn);
    hide(orderInfo);
    hide(headerIcons);
    if (searchRow) hide(searchRow);
    // Show history button only in Check Orders mode (not payment), and only in order-now mode
    if (historyBtn) historyBtn.style.display = (!isPayment && IS_ORDER_NOW) ? '' : 'none';

    if (pageTitle) pageTitle.textContent = isPayment ? t('menu.payment') || 'Payment' : t('menu.check-orders') || 'Check Orders';
    if (headerTableName) headerTableName.textContent = tableName ? `${t('menu.table-label') || 'Table'} ${tableName}` : '';
  } else {
    hide(backBtn);
    hide(pageTitle);
    hide(headerTableName);
    show(menuBtn);
    show(orderInfo);
    show(headerIcons);
    // Keep history button visible in IS_ORDER_NOW — it lives in the orders-tab header, not the drawer header
    if (historyBtn) historyBtn.style.display = IS_ORDER_NOW ? '' : 'none';
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

  // Force a fresh render when the drawer opens
  loadOrderStatus({ forceRender: true });
}


function closeAllDrawers() {
  ["item-drawer", "orders-drawer", "cart-drawer"].forEach(id => {
    const d = document.getElementById(id);
    if (!d) return;
    d.classList.remove("open");
  });
  // Hide item drawer footer
  const footer = document.getElementById('item-drawer-footer');
  if (footer) footer.style.display = 'none';
  _drawerActiveItem = null;

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

  // In order-now mode, sessionId is null until the first order is placed.
  // Skip the immediate load to avoid the "No sessionId" warning; the poll
  // interval will naturally pick it up once an order exists.
  if (sessionId) loadOrderStatus({ forceRender: true });
  // Slow idle poll every 30s — just keeps orders in sync without constant flicker.
  // Fast confirmation polling (2s) is started separately after PA redirect.
  idlePollTimer = setInterval(() => loadOrderStatus(), 30_000);
}

// ============= COUPON FUNCTIONS =============
function applyCouponToOrders() {
  const couponCode = document.getElementById("orders-coupon-input")
    ? document.getElementById("orders-coupon-input").value.trim().toUpperCase()
    : (appliedCoupon ? appliedCoupon.code : '');
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

async function openCouponSheet() {
  const lang = localStorage.getItem('language') || 'zh';
  const isZh = lang === 'zh';

  // Remove any existing sheet
  const existing = document.getElementById('coupon-sheet');
  if (existing) existing.remove();

  const sheet = document.createElement('div');
  sheet.id = 'coupon-sheet';
  sheet.style.cssText = 'position:absolute;inset:0;z-index:1100;display:flex;flex-direction:column;justify-content:flex-end;';
  sheet.innerHTML = `
    <div onclick="document.getElementById('coupon-sheet').remove()" style="flex:1;background:rgba(0,0,0,0.4);"></div>
    <div style="background:#fff;border-radius:20px 20px 0 0;padding:0 0 env(safe-area-inset-bottom,16px);max-height:80vh;display:flex;flex-direction:column;">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px 12px;border-bottom:1px solid #f3f4f6;flex-shrink:0;">
        <h3 style="margin:0;font-size:16px;font-weight:700;color:#1f2937;">${isZh ? '選擇優惠券' : 'Select Coupon'}</h3>
        <button onclick="document.getElementById('coupon-sheet').remove()" style="background:none;border:none;font-size:20px;cursor:pointer;color:#6b7280;width:32px;height:32px;display:flex;align-items:center;justify-content:center;border-radius:50%;">×</button>
      </div>
      <div style="flex:1;overflow-y:auto;padding:0 0 8px;">
        <div id="coupon-sheet-list" style="padding:8px 0;">
          <div style="text-align:center;padding:24px;color:#9ca3af;font-size:13px;">${isZh ? '載入中…' : 'Loading…'}</div>
        </div>
        <!-- Manual code entry -->
        <div style="padding:12px 20px;border-top:1px solid #f3f4f6;">
          <div style="font-size:12px;font-weight:600;color:#6b7280;margin-bottom:8px;">${isZh ? '或手動輸入優惠碼' : 'Or enter code manually'}</div>
          <div style="display:flex;gap:8px;">
            <input id="coupon-sheet-input" type="text" placeholder="${isZh ? '優惠碼' : 'Coupon code'}"
              style="flex:1;padding:10px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;box-sizing:border-box;text-transform:uppercase;outline:none;"
              value="${appliedCoupon ? appliedCoupon.code : ''}" />
            <button onclick="applyCouponFromSheet()" style="padding:10px 16px;background:var(--restaurant-color,#667eea);color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap;">
              ${isZh ? '套用' : 'Apply'}
            </button>
          </div>
          <div id="coupon-sheet-error" style="min-height:18px;margin-top:6px;font-size:12px;"></div>
        </div>
      </div>
    </div>
  `;
  (document.getElementById('phone-frame') || document.body).appendChild(sheet);

  // Fetch XISH coupons if logged in
  const listEl = document.getElementById('coupon-sheet-list');
  let myCoupons = [];
  if (xishMember && xishMember.member_id && xishToken) {
    try {
      const r = await fetch(`${API_BASE}/xish/members/${xishMember.member_id}`, {
        headers: { 'Authorization': `Bearer ${xishToken}` }
      });
      if (r.ok) {
        const d = await r.json();
        const all = (d.member && d.member.gift_coupons) || d.gift_coupons || [];
        myCoupons = all.filter(c =>
          (c.item_type || c.setting_type || '').toLowerCase() === 'coupon' &&
          c.qty_remaining > 0 && c.coupon_code
        );
      }
    } catch (_) {}
  }

  if (!listEl) return;

  if (!myCoupons.length) {
    listEl.innerHTML = `<div style="text-align:center;padding:20px 16px;color:#9ca3af;font-size:13px;">${isZh ? '暫無可用優惠券' : 'No coupons available'}</div>`;
  } else {
    listEl.innerHTML = '';
    myCoupons.forEach(c => {
      const label = c.name || c.item_reward || (isZh ? '優惠券' : 'Coupon');
      const expiry = c.valid_until
        ? (isZh
            ? `到期：${new Date(c.valid_until).toLocaleDateString('zh-HK', { month: 'short', day: 'numeric' })}`
            : `Exp ${new Date(c.valid_until).toLocaleDateString('en-HK', { month: 'short', day: 'numeric' })}`)
        : (isZh ? '永久有效' : 'No expiry');
      const isSelected = appliedCoupon && appliedCoupon.code === c.coupon_code;
      const btn = document.createElement('button');
      btn.style.cssText = `width:100%;display:flex;align-items:center;gap:12px;padding:12px 20px;background:none;border:none;border-bottom:1px solid #f9fafb;cursor:pointer;text-align:left;`;
      btn.innerHTML = `
        <div style="width:18px;height:18px;border-radius:50%;border:2px solid ${isSelected ? 'var(--restaurant-color,#667eea)' : '#d1d5db'};background:${isSelected ? 'var(--restaurant-color,#667eea)' : 'transparent'};flex-shrink:0;display:flex;align-items:center;justify-content:center;">
          ${isSelected ? '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
        </div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:14px;font-weight:600;color:#1f2937;">${escXish(label)}</div>
          <div style="font-size:11px;color:#9ca3af;margin-top:2px;">${expiry} · ×${c.qty_remaining}</div>
        </div>
        <span style="font-family:monospace;font-size:12px;font-weight:700;color:var(--restaurant-color,#667eea);background:#f0f4ff;padding:3px 8px;border-radius:4px;flex-shrink:0;">${escXish(c.coupon_code)}</span>
      `;
      btn.addEventListener('click', () => {
        const input = document.getElementById('coupon-sheet-input');
        if (input) input.value = c.coupon_code;
        applyCouponFromSheet();
      });
      listEl.appendChild(btn);
    });
  }
}

async function applyCouponFromSheet() {
  const lang = localStorage.getItem('language') || 'zh';
  const isZh = lang === 'zh';
  const input = document.getElementById('coupon-sheet-input');
  const errorEl = document.getElementById('coupon-sheet-error');
  const code = input ? input.value.trim().toUpperCase() : '';
  if (!code) {
    if (errorEl) errorEl.innerHTML = `<span style="color:#ef4444;">${isZh ? '請輸入優惠碼' : 'Please enter a coupon code.'}</span>`;
    return;
  }
  if (errorEl) errorEl.innerHTML = `<span style="color:#9ca3af;">${isZh ? '驗證中…' : 'Checking…'}</span>`;

  try {
    // If no sessionId yet (order-now before first order), just store code locally and validate later
    if (!sessionId) {
      appliedCoupon = { code, discount_cents: 0, pending: true };
      _updateReviewCouponRow(code, 0, isZh);
      document.getElementById('coupon-sheet')?.remove();
      return;
    }
    const response = await fetch(`${API_BASE}/sessions/${sessionId}/apply-coupon`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ coupon_code: code })
    });
    const data = await response.json();
    if (response.ok) {
      appliedCoupon = {
        code: data.coupon_code,
        discount_cents: data.discount_applied_cents,
        discount_type: data.discount_type,
        discount_value: data.discount_value
      };
      _updateReviewCouponRow(data.coupon_code, data.discount_applied_cents, isZh);
      document.getElementById('coupon-sheet')?.remove();
    } else {
      if (errorEl) errorEl.innerHTML = `<span style="color:#ef4444;">${escXish(data.error || (isZh ? '優惠碼無效' : 'Invalid coupon code.'))}</span>`;
    }
  } catch (e) {
    if (errorEl) errorEl.innerHTML = `<span style="color:#ef4444;">${isZh ? '無法驗證優惠碼' : 'Could not verify coupon.'}</span>`;
  }
}

function _updateReviewCouponRow(code, discountCents, isZh) {
  const label = document.getElementById('review-coupon-label');
  if (label) {
    label.style.color = '#059669';
    label.textContent = discountCents > 0
      ? `-$${(discountCents/100).toFixed(2)} (${code})`
      : code;
  }
  // Recalculate and update total
  const totalEl = document.getElementById('review-total-value');
  if (totalEl) {
    const items = pendingOrderItems.length > 0 ? pendingOrderItems : cart.items;
    let sub = items.reduce((s, i) => {
      const addonTotal = (i.addons || []).reduce((a, ad) => a + (ad.priceCents || 0) * (ad.quantity || 1), 0);
      return s + (i.totalPriceCents + addonTotal) * i.quantity;
    }, 0);
    const sc = Math.round(sub * serviceChargePct / 100);
    const xish = (xishMember && xishMember.discount_percent > 0) ? Math.round(sub * xishMember.discount_percent / 100) : 0;
    totalEl.textContent = '$' + ((sub + sc - xish - discountCents) / 100).toFixed(2);
  }
}

async function applyCouponFromReview() {
  // Legacy — redirect to sheet
  openCouponSheet();
}

async function initReviewCouponPicker() {
  // No-op — replaced by openCouponSheet
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
      lastOrdersHash = null;
      loadOrderStatus({ forceRender: true });
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
      lastOrdersHash = null;
      loadOrderStatus({ forceRender: true });
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
    _activateMainTab('home');
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
          <div class="pay-screen-meta">Order #${order?.restaurant_order_number || orderId} · ${orderTime} · Table ${tableName}</div>
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
  lastOrdersHash = null;
  loadOrderStatus({ forceRender: true });
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

/* ─── ORDER-NOW / TO-GO CONFIRMATION & PICKUP POLLING ──────── */

// Restore an active to-go order from localStorage after a page refresh
window.openOrderHistory = async function() {
  const lang = localStorage.getItem('language') || 'zh';
  const isZh = lang === 'zh';
  const histKey = 'togo_history_r' + restaurantId;
  let hist = [];
  try { hist = JSON.parse(localStorage.getItem(histKey) || '[]'); } catch (_) {}

  // Also include current session if not already in history
  if (sessionId && !hist.find(e => e.sessionId === sessionId)) {
    hist.unshift({ sessionId, orderNumber: null, placedAt: Date.now() });
  }

  const overlay = document.createElement('div');
  overlay.id = 'order-history-overlay';
  overlay.style.cssText = 'position:absolute;inset:0;background:#fff;z-index:1100;display:flex;flex-direction:column;overflow:hidden;';
  overlay.innerHTML = `
    <div style="display:flex;align-items:center;padding:16px;border-bottom:1px solid #e5e7eb;flex-shrink:0;">
      <button onclick="document.getElementById('order-history-overlay').remove()" style="background:none;border:none;cursor:pointer;color:#374151;width:36px;height:36px;display:flex;align-items:center;justify-content:center;border-radius:50%;flex-shrink:0;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <h2 style="flex:1;text-align:center;margin:0;font-size:17px;font-weight:700;color:#1f2937;">${isZh ? '所有訂單' : 'All Orders'}</h2>
      <div style="width:36px;flex-shrink:0;"></div>
    </div>
    <div style="flex:1;overflow-y:auto;padding:16px;" id="order-history-body">
      <div style="text-align:center;padding:40px 0;color:#9ca3af;">${isZh ? '載入中…' : 'Loading…'}</div>
    </div>
  `;
  (document.getElementById('phone-frame') || document.body).appendChild(overlay);

  const body = document.getElementById('order-history-body');
  if (!hist.length) {
    body.innerHTML = `<div style="text-align:center;padding:40px 16px;color:#9ca3af;">${isZh ? '暫無歷史訂單' : 'No order history yet.'}</div>`;
    return;
  }

  try {
    // Fetch orders for all sessions in parallel
    const results = await Promise.all(hist.map(async entry => {
      try {
        const res = await fetch(`${API_BASE}/sessions/${entry.sessionId}/orders?restaurantId=${restaurantId}`);
        if (!res.ok) return null;
        const data = await res.json();
        return { entry, orders: data.items || [] };
      } catch (_) { return null; }
    }));

    const allGroups = results.filter(Boolean);
    if (!allGroups.length) {
      body.innerHTML = `<div style="text-align:center;padding:40px 16px;color:#9ca3af;">${isZh ? '無法載入訂單記錄' : 'Could not load order history.'}</div>`;
      return;
    }

    // Store groups so the detail view can access them
    window._orderHistoryGroups = allGroups;

    let html = '';
    allGroups.forEach(({ entry, orders }, groupIdx) => {
      if (!orders.length) return;
      const placedAt = entry.placedAt || Date.now();
      const dateStr = new Date(placedAt).toLocaleDateString(isZh ? 'zh-HK' : 'en-HK', { month: 'short', day: 'numeric' });
      const timeStr = new Date(placedAt).toLocaleTimeString(isZh ? 'zh-HK' : 'en-HK', { hour: '2-digit', minute: '2-digit' });
      const firstOrder = orders[0];
      const orderNum = entry.orderNumber || firstOrder.restaurant_order_number || firstOrder.order_id;
      const allPaid = orders.every(o => o.order_status === 'completed');
      const hasPendingPA = orders.some(o => o.order_payment_method === 'payment-asia' && o.order_status !== 'completed');
      const statusText = allPaid ? (isZh ? '已付款' : 'Paid') : hasPendingPA ? (isZh ? '付款處理中' : 'Processing') : (isZh ? '未付款' : 'Unpaid');

      // Collect all item images for the thumbnail row
      const allItems = orders.flatMap(o => o.items || []);
      const thumbsHtml = allItems.slice(0, 5).map(item => {
        const menuItem = window.menu && window.menu.items
          ? window.menu.items.find(i => i.id === item.menu_item_id)
          : null;
        const imgUrl = menuItem && menuItem.image_url ? menuItem.image_url : null;
        return imgUrl
          ? `<img src="${imgUrl}" style="width:40px;height:40px;border-radius:6px;object-fit:cover;flex-shrink:0;" loading="lazy">`
          : `<div style="width:40px;height:40px;border-radius:6px;background:#f3f4f6;flex-shrink:0;"></div>`;
      }).join('');

      // Total
      const subtotalCents = orders.reduce((s, o) => s + (o.items || []).reduce((ss, i) => ss + (i.item_total_cents || 0) + ((i.addons || []).reduce((a, ad) => a + (ad.item_total_cents || 0), 0)), 0), 0);
      const totalCents = subtotalCents + Math.round(subtotalCents * serviceChargePct / 100);

      html += `
        <div onclick="showOrderHistoryDetail(${groupIdx})" style="border:1px solid #e5e7eb;border-radius:12px;padding:14px 16px;margin-bottom:12px;cursor:pointer;background:#fff;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px;">
            <span style="font-weight:700;font-size:15px;color:#1f2937;">${isZh ? '訂單' : 'Order'} #${orderNum}</span>
            <span style="font-size:13px;color:#374151;font-weight:500;">${statusText}</span>
          </div>
          <div style="font-size:11px;color:#9ca3af;margin-bottom:10px;">${dateStr} ${isZh ? '於' : 'at'} ${timeStr}</div>
          ${thumbsHtml ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;">${thumbsHtml}</div>` : ''}
          <div style="display:flex;justify-content:space-between;font-size:14px;font-weight:700;color:#1f2937;"><span>${isZh ? '合計' : 'Total'}</span><span>$${(totalCents / 100).toFixed(2)}</span></div>
        </div>`;
    });

    body.innerHTML = html || `<div style="text-align:center;padding:40px 16px;color:#9ca3af;">${isZh ? '暫無歷史訂單' : 'No order history yet.'}</div>`;
  } catch (e) {
    body.innerHTML = `<div style="text-align:center;padding:40px 16px;color:#ef4444;">${isZh ? '無法載入訂單記錄' : 'Could not load order history.'}</div>`;
  }
};

window.showOrderHistoryDetail = function(groupIdx) {
  const group = window._orderHistoryGroups && window._orderHistoryGroups[groupIdx];
  if (!group) return;
  const { entry, orders } = group;
  const lang = localStorage.getItem('language') || 'zh';
  const isZh = lang === 'zh';
  const orderNum = entry.orderNumber || (orders[0] && (orders[0].restaurant_order_number || orders[0].order_id)) || '';
  const allPaid = orders.every(o => o.order_status === 'completed');
  const hasPendingPA = orders.some(o => o.order_payment_method === 'payment-asia' && o.order_status !== 'completed');
  const unpaidOrder = orders.find(o => o.order_status !== 'completed' && o.order_payment_method !== 'payment-asia');
  const statusText = allPaid ? (isZh ? '已付款' : 'Paid') : hasPendingPA ? (isZh ? '付款處理中' : 'Processing') : (isZh ? '未付款' : 'Unpaid');

  // Build items HTML
  let subtotalCents = 0;
  let itemsHtml = '';
  orders.forEach(order => {
    (order.items || []).forEach(item => {
      const name = (lang === 'zh' && (item.menu_item_name_zh || item.name_zh)) ? (item.menu_item_name_zh || item.name_zh) : (item.menu_item_name || item.name || 'Item');
      const lineCents = (item.item_total_cents || 0) + ((item.addons || []).reduce((a, ad) => a + (ad.item_total_cents || 0), 0));
      subtotalCents += lineCents;
      const menuItem = window.menu && window.menu.items ? window.menu.items.find(i => i.id === item.menu_item_id) : null;
      const imgUrl = menuItem && menuItem.image_url ? menuItem.image_url : null;
      const thumbHtml = imgUrl
        ? `<img src="${imgUrl}" style="width:48px;height:48px;border-radius:8px;object-fit:cover;flex-shrink:0;" loading="lazy">`
        : `<div style="width:48px;height:48px;border-radius:8px;background:#f3f4f6;flex-shrink:0;"></div>`;
      itemsHtml += `
        <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid #f3f4f6;">
          ${thumbHtml}
          <div style="flex:1;min-width:0;">
            <div style="font-size:14px;font-weight:600;color:#1f2937;">${escXish(name)}</div>
            ${item.variants ? `<div style="font-size:11px;color:#9ca3af;">${escXish(item.variants)}</div>` : ''}
          </div>
          <div style="text-align:right;flex-shrink:0;">
            <div style="font-size:13px;color:#6b7280;">×${item.quantity}</div>
            <div style="font-size:14px;font-weight:700;color:#1f2937;">$${(lineCents / 100).toFixed(2)}</div>
          </div>
        </div>`;
    });
  });
  const scCents = Math.round(subtotalCents * serviceChargePct / 100);
  const totalCents = subtotalCents + scCents;

  const detail = document.createElement('div');
  detail.id = 'order-detail-overlay';
  detail.style.cssText = 'position:absolute;inset:0;background:#fff;z-index:1200;display:flex;flex-direction:column;overflow:hidden;';
  detail.innerHTML = `
    <div style="display:flex;align-items:center;padding:16px;border-bottom:1px solid #e5e7eb;flex-shrink:0;">
      <button onclick="document.getElementById('order-detail-overlay').remove()" style="background:none;border:none;cursor:pointer;color:#374151;width:36px;height:36px;display:flex;align-items:center;justify-content:center;border-radius:50%;flex-shrink:0;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <h2 style="flex:1;text-align:center;margin:0;font-size:17px;font-weight:700;color:#1f2937;">${isZh ? '訂單' : 'Order'} #${orderNum}</h2>
      <div style="width:36px;flex-shrink:0;"></div>
    </div>
    <div style="flex:1;overflow-y:auto;padding:16px;">
      <div style="font-size:13px;color:#6b7280;margin-bottom:16px;">${statusText}</div>
      ${itemsHtml}
      <div style="margin-top:16px;padding-top:16px;border-top:1px solid #e5e7eb;">
        <div style="display:flex;justify-content:space-between;font-size:13px;color:#6b7280;margin-bottom:6px;">
          <span>${isZh ? '小計' : 'Subtotal'}</span><span>$${(subtotalCents / 100).toFixed(2)}</span>
        </div>
        ${scCents > 0 ? `<div style="display:flex;justify-content:space-between;font-size:13px;color:#6b7280;margin-bottom:6px;">
          <span>${isZh ? '服務費' : 'Service Charge'} (${serviceChargePct}%)</span><span>$${(scCents / 100).toFixed(2)}</span>
        </div>` : ''}
        <div style="display:flex;justify-content:space-between;font-size:16px;font-weight:700;color:#1f2937;margin-top:8px;">
          <span>${isZh ? '合計' : 'Total'}</span><span>$${(totalCents / 100).toFixed(2)}</span>
        </div>
        <div style="font-size:13px;color:#6b7280;margin-top:4px;text-align:right;">${statusText}</div>
      </div>
      ${(orderPayEnabled && unpaidOrder && !allPaid && !hasPendingPA) ? `
      <div style="margin-top:16px;display:flex;gap:8px;">
        <button onclick="document.getElementById('order-detail-overlay').remove();document.getElementById('order-history-overlay').remove();showPaymentPage(${unpaidOrder.order_id});"
          style="flex:1;padding:12px;background:var(--restaurant-color,#667eea);color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;">${isZh ? '立即付款' : 'Pay Now'}</button>
      </div>` : ''}
    </div>
  `;
  (document.getElementById('phone-frame') || document.body).appendChild(detail);
};

function restoreSavedToGoOrder() {
  if (!IS_ORDER_NOW || !restaurantId) return;
  const key = 'togo_r' + restaurantId;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return;
    const saved = JSON.parse(raw);
    // Expire after 4 hours
    if (!saved.sessionId || Date.now() - (saved.placedAt || 0) > 4 * 60 * 60 * 1000) {
      localStorage.removeItem(key);
      return;
    }
    sessionId = saved.sessionId;
    // Start polling for ready status
    startPickupPolling(saved.sessionId);
  } catch (_) {}
}

function startNewOrder() {
  if (!IS_ORDER_NOW) return;
  _clearCompletedSession();
  _activateMainTab('menu');
}

function _clearCompletedSession() {
  if (_pickupPollTimer) { clearInterval(_pickupPollTimer); _pickupPollTimer = null; }
  sessionId = null;
  lastOrderId = null;
  lastOrdersHash = null;
  paOrderLocked = false;
  try { localStorage.removeItem('togo_r' + restaurantId); } catch (_) {}
}

function showToGoConfirmation(customerName, order) {
  const app = document.getElementById('app');
  if (!app) return;

  const lang = localStorage.getItem('language') || 'zh';
  const isZh = lang === 'zh';
  const orderNum = order ? `#${order.restaurant_order_number || order.id}` : '';

  const confirmEl = document.createElement('div');
  confirmEl.id = 'togo-confirmation';
  confirmEl.style.cssText = `
    position:absolute; inset:0; background:#fff; z-index:1100;
    display:flex; flex-direction:column; align-items:center;
    justify-content:center; padding:32px; text-align:center;
  `;
  confirmEl.innerHTML = `
    <div style="font-size:56px; margin-bottom:20px;">🥡</div>
    <div style="font-size:24px; font-weight:800; color:#1f2937; margin-bottom:8px;">${isZh ? '訂單已提交！' : 'Order Placed!'}</div>
    ${orderNum ? `<div style="font-size:22px; font-weight:700; color:#667eea; margin-bottom:12px;">${orderNum}</div>` : ''}
    ${customerName ? `<div style="font-size:15px; color:#6b7280; margin-bottom:6px;">Hi <strong>${escXish(customerName)}</strong> 👋</div>` : ''}
    <div style="font-size:14px; color:#6b7280; margin-bottom:24px;">${isZh ? '餐廳正在為你準備，準備好後會通知你！' : "We'll prepare your order right away.<br>We'll let you know when it's ready!"}</div>
    <div id="togo-status-banner" style="
      font-size:14px; font-weight:600; color:#d97706;
      background:#fef3c7; border:1px solid #fde68a;
      border-radius:8px; padding:10px 20px; margin-bottom:16px;
    ">⏳ ${isZh ? '正在準備中…' : 'Preparing your order…'}</div>
    <div style="font-size:12px;color:#9ca3af;margin-bottom:24px;">${isZh ? '你可以關閉此頁面，訂單號碼會保留在「查看訂單」中' : 'You can close this screen — your order number is saved in "Check Orders"'}</div>
    <button onclick="document.getElementById('togo-confirmation').remove(); openOrdersDrawer();" style="
      padding:12px 28px; background:#667eea; color:white;
      border:none; border-radius:12px; font-size:14px;
      font-weight:600; cursor:pointer; margin-bottom:10px; width:220px;
    ">${isZh ? '查看訂單狀態' : 'Track My Order'}</button>
    ${order ? `<button onclick="showOrderQrCode('${order.id}','${order.restaurant_order_number || order.id}')" style="
      padding:12px 28px; background:#f3f4f6; color:#374151;
      border:none; border-radius:12px; font-size:14px;
      font-weight:600; cursor:pointer; margin-bottom:10px; width:220px;
    ">${isZh ? '📱 顯示訂單 QR' : '📱 Show Order QR'}</button>` : ''}
    <button onclick="document.getElementById('togo-confirmation').remove()" style="
      padding:10px 28px; background:#f3f4f6; color:#374151;
      border:none; border-radius:12px; font-size:13px;
      font-weight:600; cursor:pointer; width:220px;
    ">${isZh ? '繼續瀏覽菜單' : 'Browse Menu'}</button>
  `;
  (document.getElementById('phone-frame') || document.body).appendChild(confirmEl);

  // Poll for pickup_ready_at via order status endpoint (also updates orders drawer)
  if (sessionId) startPickupPolling(sessionId);
}

function showOrderQrCode(orderId, orderNum) {
  const lang = localStorage.getItem('language') || 'zh';
  const isZh = lang === 'zh';
  // Remove any existing QR modal
  const existing = document.getElementById('order-qr-modal');
  if (existing) existing.remove();
  const modal = document.createElement('div');
  modal.id = 'order-qr-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:2000;display:flex;align-items:center;justify-content:center;';
  modal.innerHTML = `
    <div style="background:#fff;border-radius:20px;padding:28px 24px;width:280px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
      <div style="font-size:15px;font-weight:700;color:#1f2937;margin-bottom:4px">${isZh ? '訂單 QR' : 'Order QR'}</div>
      <div style="font-size:22px;font-weight:800;color:#667eea;margin-bottom:16px">#${escXish(String(orderNum))}</div>
      <div id="order-qr-container" style="display:flex;align-items:center;justify-content:center;margin-bottom:16px"></div>
      <div style="font-size:12px;color:#9ca3af;margin-bottom:16px">${isZh ? '向餐廳出示此 QR 碼' : 'Show this QR code to the restaurant'}</div>
      <button onclick="document.getElementById('order-qr-modal').remove()"
        style="padding:12px 28px;background:#f3f4f6;color:#374151;border:none;border-radius:12px;font-size:14px;font-weight:600;cursor:pointer;">
        ${isZh ? '關閉' : 'Close'}
      </button>
    </div>
  `;
  document.body.appendChild(modal);
  modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });
  const container = document.getElementById('order-qr-container');
  if (container && typeof QRCode !== 'undefined') {
    new QRCode(container, {
      text: String(orderId),
      width: 180,
      height: 180,
      colorDark: '#1f2937',
      colorLight: '#ffffff',
    });
  }
}
window.showOrderQrCode = showOrderQrCode;


function startPickupPolling(sid) {
  if (_pickupPollTimer) clearInterval(_pickupPollTimer);
  _pickupPollTimer = setInterval(async () => {
    try {
      // Use loadOrderStatus to refresh both order data and queue position
      await loadOrderStatus({ forceRender: false });

      // Also update the confirmation banner if still visible
      const res = await fetch(`${API_BASE}/sessions/${sid}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.pickup_ready_at) {
        clearInterval(_pickupPollTimer);
        _pickupPollTimer = null;
        const banner = document.getElementById('togo-status-banner');
        const lang = localStorage.getItem('language') || 'zh';
        const isZh = lang === 'zh';
        if (banner) {
          banner.style.background = '#d1fae5';
          banner.style.borderColor = '#6ee7b7';
          banner.style.color = '#065f46';
          banner.textContent = isZh ? '✓ 可以取餐了！' : '✓ Your order is ready for pickup!';
        }
        // Force refresh orders drawer too
        loadOrderStatus({ forceRender: true });
      }
    } catch (e) {}
  }, 12000); // poll every 12s
}

/* ═══════════════════════════════════════════════════════════════
   XISH PHASE 5+6 — Customer Menu Integration & Smart QR Auth
   ═══════════════════════════════════════════════════════════════ */

async function initXishMode(session) {
  xishEnabled = true;

  // Phase 6: Try auto-login from URL params (wallet_id or token)
  const walletId    = urlParams.get('wallet_id');
  const memberToken = urlParams.get('token');

  if (walletId) {
    try {
      const r = await fetch(`${API_BASE}/xish/auth/qr-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurant_id: restaurantId, table_id: tableUnitId, wallet_id: walletId }),
      });
      const loginRes = await r.json();
      if (loginRes && loginRes.mode === 'member') {
        xishMember = loginRes.member;
        xishToken  = loginRes.token;
        localStorage.setItem('xish_token', loginRes.token);
      }
    } catch (e) { console.warn('[XISH] qr-login failed:', e); }
  } else if (memberToken) {
    try {
      const r = await fetch(`${API_BASE}/xish/auth/wallet-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: memberToken, restaurant_id: restaurantId }),
      });
      const loginRes = await r.json();
      if (loginRes && loginRes.mode === 'member') {
        xishMember = loginRes.member;
        xishToken  = loginRes.token;
        localStorage.setItem('xish_token', loginRes.token);
      }
    } catch (e) { console.warn('[XISH] wallet-login failed:', e); }
  }

  // Try existing stored token (persisted across page loads)
  if (!xishMember) {
    const storedToken = localStorage.getItem('xish_token');
    if (storedToken) {
      try {
        const r = await fetch(`${API_BASE}/xish/auth/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: storedToken }),
        });
        if (r.ok) {
          const data = await r.json();
          if (data.valid && data.member) {
            xishMember = data.member;
            xishToken  = storedToken;
          }
        } else {
          localStorage.removeItem('xish_token'); // expired
        }
      } catch (e) { /* silent */ }
    }
  }

  // Try xish_pass_ from previous join (customer scanned join QR before visiting menu)
  if (!xishMember) {
    try {
      const passRaw = localStorage.getItem('xish_pass_' + restaurantId);
      if (passRaw) {
        const passData = JSON.parse(passRaw);
        if (passData && passData.xish_id) {
          const r = await fetch(`${API_BASE}/xish/auth/xish-id-login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ xish_id: passData.xish_id, restaurant_id: restaurantId }),
          });
          if (r.ok) {
            const data = await r.json();
            if (data.mode === 'member') {
              xishMember = data.member;
              xishToken  = data.token;
              localStorage.setItem('xish_token', data.token);
            }
          }
        }
      }
    } catch (e) { /* silent */ }
  }

  // Transform the landing page
  decorateLandingXish(session);
}


// Order type: 'takeaway' | 'dine-in'
let orderType = 'takeaway';
let hasScannedTable = false; // true after user scans a table QR from order-now mode
let _customerTableScanner = null; // Html5Qrcode instance for customer table scan

// Active XISH panel tab
let xishActiveTab = 'points';

function decorateLandingXish(session) {
  const flags = (window.sessionData && window.sessionData.feature_flags) || {};
  const membersAreaEnabled = flags.members_area !== false;
  const couponsEnabled = flags.coupons !== false;

  // Show XISH hero badge
  const heroBadge = document.getElementById('xish-hero-badge');
  if (heroBadge) heroBadge.style.display = 'inline-flex';

  const xishSection = document.getElementById('xish-landing-section');
  const signinCta = document.getElementById('xish-signin-cta');

  if (!membersAreaEnabled) {
    // Loyalty entirely disabled — hide both
    if (xishSection) xishSection.style.display = 'none';
    if (signinCta) signinCta.style.display = 'none';
  } else if (xishMember) {
    // Logged-in member: show loyalty row, hide sign-in CTA
    if (signinCta) signinCta.style.display = 'none';
    if (xishSection) {
      xishSection.style.display = 'flex';
      const pointsBtn = document.getElementById('my-points-btn');
      if (pointsBtn) pointsBtn.style.display = '';
      const couponsBtn = document.getElementById('coupons-btn');
      if (couponsBtn) couponsBtn.style.display = couponsEnabled ? '' : 'none';
    }

    // Update counts
    const pointsCountEl = document.getElementById('lqb-points-count');
    const couponsCountEl = document.getElementById('lqb-coupons-count');
    if (pointsCountEl) pointsCountEl.textContent = (xishMember.points_balance || 0).toLocaleString();
    if (couponsCountEl) couponsCountEl.textContent = xishMember.active_coupons || xishMember.coupon_count || 0;

    // Tier progression bar (show if member has a non-basic tier, or if members_tiers flag set)
    const tiersEnabled = flags.members_tiers !== false;
    if (tiersEnabled && xishMember.tier && xishMember.tier !== 'basic') {
      const TIER_THRESHOLDS = { basic: 0, silver: 500, gold: 2000, platinum: 5000 };
      const TIER_ORDER = ['basic', 'silver', 'gold', 'platinum'];
      const tierIdx = TIER_ORDER.indexOf(xishMember.tier);
      const nextTier = TIER_ORDER[tierIdx + 1];
      const currentMin = TIER_THRESHOLDS[xishMember.tier] || 0;
      const nextMin = nextTier ? TIER_THRESHOLDS[nextTier] : null;
      const pts = xishMember.points_balance || 0;
      const pct = nextMin ? Math.min(100, Math.round(((pts - currentMin) / (nextMin - currentMin)) * 100)) : 100;
      const tierLabels = { basic: 'Basic', silver: 'Silver', gold: 'Gold', platinum: 'Platinum' };
      const tierRow = document.getElementById('lqb-tier-row');
      const tierBadge = document.getElementById('lqb-tier-badge');
      const progressFill = document.getElementById('lqb-progress-fill');
      if (tierRow) tierRow.style.display = 'flex';
      if (tierBadge) tierBadge.textContent = tierLabels[xishMember.tier] || xishMember.tier;
      if (progressFill) progressFill.style.width = pct + '%';
    }
  } else {
    // Not logged in: show loyalty row with placeholder values, hide sign-in CTA
    if (signinCta) signinCta.style.display = 'none';
    if (xishSection) {
      xishSection.style.display = 'flex';
      const pointsBtn = document.getElementById('my-points-btn');
      if (pointsBtn) {
        pointsBtn.style.display = '';
        pointsBtn.onclick = openXishOrJoin;
      }
      const couponsBtn = document.getElementById('coupons-btn');
      if (couponsBtn) {
        couponsBtn.style.display = couponsEnabled ? '' : 'none';
        couponsBtn.onclick = openXishOrJoin;
      }
    }
    const pointsCountEl = document.getElementById('lqb-points-count');
    const couponsCountEl = document.getElementById('lqb-coupons-count');
    if (pointsCountEl) pointsCountEl.textContent = '—';
    if (couponsCountEl) couponsCountEl.textContent = '—';
  }

  // Populate new home membership card
  if (xishMember) renderMembershipCard(xishMember);

  // Landing banners (featured_banners shown below loyalty section)
  _renderHomeLandingBanners();

  // Legacy hidden xish-member-bar (still referenced elsewhere)
  const memberBarEl = document.getElementById('xish-member-bar');
  if (memberBarEl) {
    if (xishMember) {
      const tierSvg = { platinum: '<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>', gold: '<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>', silver: '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>', basic: '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>' }[xishMember.tier] || '';
      const tierZh = { platinum: '白金', gold: '黃金', silver: '銀維', basic: '普通會員' }[xishMember.tier] || '普通會員';
      const tierEn = { platinum: 'Platinum', gold: 'Gold', silver: 'Silver', basic: 'General Member' }[xishMember.tier] || 'General Member';
      const lang = localStorage.getItem('language') || 'zh';
      const tierLabel = lang === 'zh' ? tierZh : tierEn;
      memberBarEl.innerHTML = `
        <div class="xish-mbc-left">
          <span class="xish-mbc-tier">${tierSvg} ${tierLabel}</span>
          <span class="xish-mbc-name">${escXish(xishMember.name || 'Member')}</span>
          <span class="xish-mbc-sub">${escXish(xishMember.xish_id || '')}</span>
        </div>
        <div class="xish-mbc-right">
          <div class="xish-mbc-pts">${(xishMember.points_balance || 0).toLocaleString()}</div>
          <div class="xish-mbc-pts-label">積分 &middot; POINTS</div>
        </div>
      `;
      memberBarEl.style.display = 'flex';
      memberBarEl.onclick = () => openXishTab('points');
    }
  }

  // Inject XISH panel into DOM (hidden)
  if (!document.getElementById('xish-panel-overlay')) {
    injectXishPanel();
  }
}

function injectXishPanel() {
  const frame = document.getElementById('phone-frame') || document.body;
  const overlay = document.createElement('div');
  overlay.id = 'xish-panel-overlay';
  overlay.className = 'xish-panel-overlay';
  overlay.onclick = (e) => { if (e.target === overlay) window.closeXishPanel(); };
  overlay.innerHTML = `
    <div id="xish-panel" class="xish-panel">
      <div class="xish-panel-header">
        <div class="xish-panel-logo"><span class="xish-x"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></span> XISH Loyalty</div>
        <button class="xish-panel-close" onclick="closeXishPanel()"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
      </div>
      <div class="xish-panel-tabs" id="xish-panel-tabs">
        <button class="xish-tab-btn active" data-tab="points" onclick="switchXishTab('points')"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:4px"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg><span class="xish-tab-zh">積分</span><span class="xish-tab-en"> Points</span></button>
        <button class="xish-tab-btn" data-tab="coupons" onclick="switchXishTab('coupons')"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:4px"><path d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 0 0-2 2v3a2 2 0 0 1 0 4v3a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3a2 2 0 0 1 0-4V7a2 2 0 0 0-2-2H5z"/></svg><span class="xish-tab-zh">優惠券</span><span class="xish-tab-en"> Coupons</span></button>
        <button class="xish-tab-btn" data-tab="gifts" onclick="switchXishTab('gifts')"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:4px"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg><span class="xish-tab-zh">禮品卡</span><span class="xish-tab-en"> Gift Cards</span></button>
      </div>
      <div class="xish-panel-body" id="xish-panel-body">
        <div class="xish-loading-text">Loading…</div>
      </div>
      <div class="xish-panel-footer" id="xish-panel-footer" style="display:none">
        <button class="xish-btn-outline" onclick="xishLogout()">${(localStorage.getItem('language')||'zh')==='zh' ? '登出' : 'Sign Out'}</button>
      </div>
    </div>
  `;
  frame.appendChild(overlay);
}

/* ── My Points / My Coupons standalone panels (no XISH branding) ──── */
window.openMyPointsPanel = async function () {
  const frame = document.getElementById('phone-frame') || document.body;
  const existing = document.getElementById('my-points-panel');
  if (existing) { existing.style.display = 'flex'; return; }
  const lang = localStorage.getItem('language') || 'zh';
  const isZh = lang === 'zh';

  const panel = document.createElement('div');
  panel.id = 'my-points-panel';
  panel.style.cssText = 'position:absolute;inset:0;z-index:1100;background:#fff;display:flex;flex-direction:column;overflow:hidden;';

  if (!xishMember) {
    // Not logged in — show sign-in prompt
    panel.innerHTML = `
      <div style="display:flex;align-items:center;padding:16px;border-bottom:1px solid #f3f4f6;flex-shrink:0">
        <button onclick="document.getElementById('my-points-panel').style.display='none'" style="background:none;border:none;font-size:22px;cursor:pointer;color:#374151;padding:0;margin-right:12px">←</button>
        <span style="font-size:17px;font-weight:700;color:#1f2937">我的積分 · My Points</span>
      </div>
      <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px 24px;gap:16px;text-align:center;">
        <div style="width:64px;height:64px;border-radius:50%;background:#f3f4f6;display:flex;align-items:center;justify-content:center;">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        </div>
        <div>
          <div style="font-size:16px;font-weight:700;color:#1f2937;margin-bottom:6px">${isZh ? '登入以查看您的積分' : 'Sign in to view your points'}</div>
          <div style="font-size:13px;color:#9ca3af">${isZh ? '成為會員，賺取積分兌換優惠' : 'Join to earn points and redeem rewards'}</div>
        </div>
        <button onclick="document.getElementById('my-points-panel').style.display='none';openXishOrJoin();" style="margin-top:8px;padding:13px 32px;background:var(--restaurant-color,#f97316);color:#fff;border:none;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;-webkit-tap-highlight-color:transparent;">${isZh ? '會員登入 / 立即加入' : 'Sign In / Join Now'}</button>
      </div>
    `;
    frame.appendChild(panel);
    return;
  }

  // Logged in — show tier header + history
  const TIER_THRESHOLDS = { basic: 0, silver: 500, gold: 2000, platinum: 5000 };
  const TIER_ORDER = ['basic', 'silver', 'gold', 'platinum'];
  const TIER_LABELS = { basic: isZh ? '普通會員' : 'Basic', silver: isZh ? '銀級' : 'Silver', gold: isZh ? '黃金' : 'Gold', platinum: isZh ? '白金' : 'Platinum' };
  const TIER_NEXT_LABELS = { basic: isZh ? '銀級' : 'Silver', silver: isZh ? '黃金' : 'Gold', gold: isZh ? '白金' : 'Platinum', platinum: null };
  const flags = (window.sessionData && window.sessionData.feature_flags) || {};
  const tiersEnabled = flags.members_tiers !== false;
  const tier = xishMember.tier || 'basic';
  const tierIdx = TIER_ORDER.indexOf(tier);
  const nextTier = TIER_ORDER[tierIdx + 1];
  const currentMin = TIER_THRESHOLDS[tier] || 0;
  const nextMin = nextTier ? TIER_THRESHOLDS[nextTier] : null;
  const pts = xishMember.points_balance || 0;
  const pct = nextMin ? Math.min(100, Math.round(((pts - currentMin) / (nextMin - currentMin)) * 100)) : 100;
  const tierBarHtml = tiersEnabled ? `
    <div style="padding:16px;background:#f9fafb;border-bottom:1px solid #f3f4f6;flex-shrink:0">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <span style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:var(--restaurant-color,#f97316)">${TIER_LABELS[tier] || tier}</span>
        ${nextTier ? `<span style="font-size:11px;color:#9ca3af">${isZh ? '距' : 'To'} ${TIER_NEXT_LABELS[tier] || nextTier}: ${Math.max(0,(nextMin||0) - pts)} ${isZh ? '積分' : 'pts'}</span>` : `<span style="font-size:11px;color:#9ca3af">${isZh ? '最高等級' : 'Top Tier'} 🏆</span>`}
      </div>
      <div style="height:6px;background:#e5e7eb;border-radius:3px;overflow:hidden"><div style="height:100%;width:${pct}%;background:var(--restaurant-color,#f97316);border-radius:3px;transition:width 0.5s ease"></div></div>
    </div>` : '';

  panel.innerHTML = `
    <div style="display:flex;align-items:center;padding:16px;border-bottom:1px solid #f3f4f6;flex-shrink:0">
      <button onclick="document.getElementById('my-points-panel').style.display='none'" style="background:none;border:none;font-size:22px;cursor:pointer;color:#374151;padding:0;margin-right:12px">←</button>
      <span style="font-size:17px;font-weight:700;color:#1f2937">我的積分 · My Points</span>
    </div>
    <div style="padding:20px 16px;text-align:center;background:#f9fafb;border-bottom:1px solid #f3f4f6;flex-shrink:0">
      <div style="font-size:36px;font-weight:800;color:var(--restaurant-color,#f97316)" id="mpp-balance">${pts.toLocaleString()}</div>
      <div style="font-size:13px;color:#9ca3af;margin-top:4px">${isZh ? '積分餘額' : 'Points Balance'}</div>
    </div>
    ${tierBarHtml}
    <div style="flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;" id="mpp-history">
      <div style="padding:40px 16px;text-align:center;color:#9ca3af;font-size:13px">${isZh ? '載入中…' : 'Loading…'}</div>
    </div>
  `;
  frame.appendChild(panel);
  if (xishToken) {
    try {
      const r = await fetch(`${API_BASE}/xish/members/${xishMember.member_id}`, { headers: { 'Authorization': `Bearer ${xishToken}` } });
      const detail = r.ok ? await r.json() : null;
      const history = detail ? (detail.point_history || []).slice(0, 30) : [];
      const histEl = document.getElementById('mpp-history');
      if (!histEl) return;
      if (!history.length) {
        histEl.innerHTML = `<div style="padding:40px 16px;text-align:center;color:#9ca3af;font-size:13px">${isZh ? '尚無積分記錄' : 'No points history yet'}</div>`;
        return;
      }
      histEl.innerHTML = history.map(row => {
        const pts = row.points_delta || row.points_awarded || 0;
        const isPos = pts >= 0;
        const date = new Date(row.created_at).toLocaleDateString(isZh ? 'zh-HK' : 'en-HK', { day: 'numeric', month: 'short' });
        return `<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:1px solid #f3f4f6">
          <div>
            <div style="font-size:14px;font-weight:500;color:#1f2937">${row.restaurant_name || (isZh ? '訂單' : 'Order')}</div>
            <div style="font-size:11px;color:#9ca3af;margin-top:2px">${date}</div>
          </div>
          <div style="font-size:15px;font-weight:700;color:${isPos ? 'var(--restaurant-color,#f97316)' : '#ef4444'}">${isPos?'+':''}${pts}</div>
        </div>`;
      }).join('');
    } catch(e) {
      const histEl = document.getElementById('mpp-history');
      if (histEl) histEl.innerHTML = `<div style="padding:40px 16px;text-align:center;color:#9ca3af;font-size:13px">${isZh ? '載入失敗' : 'Failed to load'}</div>`;
    }
  }
};

window.openMyCouponsPanel = async function () {
  const frame = document.getElementById('phone-frame') || document.body;
  const existing = document.getElementById('my-coupons-panel');
  if (existing) { existing.style.display = 'flex'; existing._refresh && existing._refresh(); return; }
  const lang = localStorage.getItem('language') || 'zh';
  const isZh = lang === 'zh';
  const panel = document.createElement('div');
  panel.id = 'my-coupons-panel';
  panel.style.cssText = 'position:absolute;inset:0;z-index:1100;background:#fff;display:flex;flex-direction:column;overflow:hidden;';

  if (!xishMember) {
    // Not logged in
    panel.innerHTML = `
      <div style="display:flex;align-items:center;padding:16px;border-bottom:1px solid #f3f4f6;flex-shrink:0">
        <button onclick="document.getElementById('my-coupons-panel').style.display='none'" style="background:none;border:none;font-size:22px;cursor:pointer;color:#374151;padding:0;margin-right:12px">←</button>
        <span style="font-size:17px;font-weight:700;color:#1f2937">我的優惠券 · My Coupons</span>
      </div>
      <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px 24px;gap:16px;text-align:center;">
        <div style="width:64px;height:64px;border-radius:50%;background:#f3f4f6;display:flex;align-items:center;justify-content:center;">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 0 0-2 2v3a2 2 0 0 1 0 4v3a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3a2 2 0 0 1 0-4V7a2 2 0 0 0-2-2H5z"/></svg>
        </div>
        <div>
          <div style="font-size:16px;font-weight:700;color:#1f2937;margin-bottom:6px">${isZh ? '登入以查看您的優惠券' : 'Sign in to view your coupons'}</div>
          <div style="font-size:13px;color:#9ca3af">${isZh ? '成為會員，獲取專屬優惠' : 'Join to get exclusive coupons'}</div>
        </div>
        <button onclick="document.getElementById('my-coupons-panel').style.display='none';openXishOrJoin();" style="margin-top:8px;padding:13px 32px;background:var(--restaurant-color,#f97316);color:#fff;border:none;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;-webkit-tap-highlight-color:transparent;">${isZh ? '會員登入 / 立即加入' : 'Sign In / Join Now'}</button>
      </div>
    `;
    frame.appendChild(panel);
    return;
  }

  panel.innerHTML = `
    <div style="display:flex;align-items:center;padding:16px;border-bottom:1px solid #f3f4f6;flex-shrink:0">
      <button onclick="document.getElementById('my-coupons-panel').style.display='none'" style="background:none;border:none;font-size:22px;cursor:pointer;color:#374151;padding:0;margin-right:12px">←</button>
      <span style="font-size:17px;font-weight:700;color:#1f2937">我的優惠券 · My Coupons</span>
    </div>
    <div style="flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;" id="mcp-list">
      <div style="padding:40px 16px;text-align:center;color:#9ca3af;font-size:13px">${isZh ? '載入中…' : 'Loading…'}</div>
    </div>
  `;
  frame.appendChild(panel);
  const loadCoupons = async () => {
    const listEl = document.getElementById('mcp-list');
    if (!listEl) return;
    if (xishToken) {
      try {
        const r = await fetch(`${API_BASE}/xish/members/${xishMember.member_id}`, { headers: { 'Authorization': `Bearer ${xishToken}` } });
        const detail = r.ok ? await r.json() : null;
        const allCoupons = detail ? (detail.gift_coupons || []).filter(c => {
          const t = (c.item_type || c.setting_type || '').toLowerCase();
          return t === 'coupon' && c.qty_remaining > 0;
        }) : [];
        if (!allCoupons.length) {
          listEl.innerHTML = `<div style="padding:40px 16px;text-align:center;color:#9ca3af;font-size:13px">${isZh ? '尚無優惠券' : 'No coupons yet'}</div>`;
          return;
        }
        listEl.innerHTML = allCoupons.map(c => {
          const expiry = c.valid_until ? new Date(c.valid_until).toLocaleDateString(isZh ? 'zh-HK' : 'en-HK', { day: 'numeric', month: 'short', year: 'numeric' }) : (isZh ? '永久有效' : 'No expiry');
          return `<div style="margin:12px 16px;padding:14px;border:1px solid #e5e7eb;border-radius:12px;background:#fafafa">
            <div style="font-size:15px;font-weight:700;color:#1f2937;margin-bottom:4px">${c.item_name || c.gift_name || (isZh ? '優惠券' : 'Coupon')}</div>
            ${c.description ? `<div style="font-size:12px;color:#6b7280;margin-bottom:6px">${c.description}</div>` : ''}
            <div style="display:flex;justify-content:space-between;align-items:center">
              <span style="font-size:11px;color:#9ca3af">${isZh ? '到期：' : 'Expires: '}${expiry}</span>
              <span style="font-size:12px;font-weight:700;color:var(--restaurant-color,#f97316)">×${c.qty_remaining || 1}</span>
            </div>
          </div>`;
        }).join('');
      } catch(e) {
        const le = document.getElementById('mcp-list');
        if (le) le.innerHTML = `<div style="padding:40px 16px;text-align:center;color:#9ca3af;font-size:13px">${isZh ? '載入失敗' : 'Failed to load'}</div>`;
      }
    }
  };
  panel._refresh = loadCoupons;
  loadCoupons();
};

window.openXishTab = async function (tab) {
  xishActiveTab = tab || 'points';
  if (!xishMember) {
    if (!document.getElementById('xish-panel-overlay')) injectXishPanel();
    document.getElementById('xish-panel-overlay').style.display = 'flex';
    const tabs = document.getElementById('xish-panel-tabs');
    if (tabs) tabs.style.display = 'none';
    const footer = document.getElementById('xish-panel-footer');
    if (footer) footer.style.display = 'none';
    await renderXishGuestPanel();
    return;
  }
  if (!document.getElementById('xish-panel-overlay')) injectXishPanel();
  const tabs = document.getElementById('xish-panel-tabs');
  if (tabs) tabs.style.display = 'flex';
  document.getElementById('xish-panel-overlay').style.display = 'flex';
  document.querySelectorAll('.xish-tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === xishActiveTab);
  });
  await renderXishTabContent(xishActiveTab);
};

window.openXishPanel = async function () {
  await window.openXishTab(xishActiveTab);
};

window.switchXishTab = async function (tab) {
  xishActiveTab = tab;
  document.querySelectorAll('.xish-tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });
  await renderXishTabContent(tab);
};

window.closeXishPanel = function () {
  const overlay = document.getElementById('xish-panel-overlay');
  if (overlay) overlay.style.display = 'none';
};

async function renderXishGuestPanel() {
  const body = document.getElementById('xish-panel-body');
  if (!body) return;
  const gLang = localStorage.getItem('language') || 'zh';
  body.innerHTML = `
    <div class="xish-panel-guest" style="padding:8px 4px 0">
      <div style="text-align:center;margin-bottom:20px">
        <div style="font-size:19px;font-weight:800;letter-spacing:.04em;color:var(--restaurant-color,#f97316);margin-bottom:6px">XISH</div>
        <div style="font-size:17px;font-weight:700;color:#1f2937;margin-bottom:6px">${gLang === 'zh' ? '會員登入 / 加入' : 'Sign In / Join'}</div>
        <div style="font-size:13px;color:#6b7280">${gLang === 'zh' ? '輸入電子郵件以登入或建立帳戶' : 'Enter your email to sign in or create an account'}</div>
      </div>

      <div id="xish-step-email" style="width:100%">
        <input type="email" id="xish-email-input" placeholder="${gLang === 'zh' ? '電子郵件地址' : 'Email address'}"
          style="width:100%;padding:13px 14px;border-radius:12px;border:1px solid #e5e7eb;font-size:15px;outline:none;background:#f9fafb;margin-bottom:12px;box-sizing:border-box;"
          onkeydown="if(event.key==='Enter')window.xishSendOtp()"/>
        <button id="xish-send-otp-btn" onclick="window.xishSendOtp()"
          style="width:100%;padding:14px;background:var(--restaurant-color,#f97316);color:#fff;border:none;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;">
          ${gLang === 'zh' ? '發送驗證碼' : 'Send Code'}
        </button>
      </div>

      <div id="xish-step-otp" style="display:none;width:100%">
        <div style="font-size:13px;color:#6b7280;text-align:center;margin-bottom:14px" id="xish-otp-label">${gLang === 'zh' ? '驗證碼已發送至你的電子郵件' : 'Code sent to your email'}</div>
        <input type="tel" id="xish-otp-input" placeholder="${gLang === 'zh' ? '6 位驗證碼' : '6-digit code'}"
          maxlength="6"
          style="width:100%;padding:13px 14px;border-radius:12px;border:1px solid #e5e7eb;font-size:22px;outline:none;background:#f9fafb;margin-bottom:12px;letter-spacing:8px;text-align:center;box-sizing:border-box;"
          onkeydown="if(event.key==='Enter')window.xishVerifyOtp()"/>
        <button id="xish-verify-btn" onclick="window.xishVerifyOtp()"
          style="width:100%;padding:14px;background:var(--restaurant-color,#f97316);color:#fff;border:none;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;">
          ${gLang === 'zh' ? '驗證並登入' : 'Verify & Sign In'}
        </button>
        <button onclick="document.getElementById('xish-step-otp').style.display='none';document.getElementById('xish-step-email').style.display='block';"
          style="width:100%;padding:10px;background:none;border:none;color:#6b7280;font-size:13px;cursor:pointer;margin-top:4px;">
          ${gLang === 'zh' ? '← 返回' : '← Back'}
        </button>
      </div>

      <div id="xish-signin-status" style="min-height:18px;margin-top:6px;font-size:13px;text-align:center;color:#ef4444;"></div>

      <div style="margin-top:10px;display:flex;align-items:center;gap:8px">
        <div style="flex:1;height:1px;background:#e5e7eb"></div>
        <span style="font-size:11px;color:#9ca3af">${gLang === 'zh' ? '或' : 'or'}</span>
        <div style="flex:1;height:1px;background:#e5e7eb"></div>
      </div>
      <button onclick="window.closeXishPanel()"
        style="width:100%;padding:13px;background:none;border:1px solid #e5e7eb;border-radius:12px;font-size:14px;font-weight:600;cursor:pointer;color:#6b7280;margin-top:10px;">
        ${gLang === 'zh' ? '以訪客身份繼續' : 'Continue as Guest'}
      </button>
    </div>
  `;
}

window.xishSendOtp = async function() {
  const emailInput = document.getElementById('xish-email-input');
  const statusEl = document.getElementById('xish-signin-status');
  const btn = document.getElementById('xish-send-otp-btn');
  const gLang = localStorage.getItem('language') || 'zh';
  const email = emailInput ? emailInput.value.trim() : '';
  if (!email || !email.includes('@')) {
    if (statusEl) statusEl.textContent = gLang === 'zh' ? '請輸入有效的電子郵件地址' : 'Please enter a valid email address';
    return;
  }
  if (statusEl) statusEl.textContent = '';
  if (btn) { btn.disabled = true; btn.textContent = gLang === 'zh' ? '發送中…' : 'Sending…'; }
  try {
    const res = await fetch(API_BASE + '/api/xish/send-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restaurant_id: restaurantId, method: 'email', contact: email }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || (gLang === 'zh' ? '發送失敗，請重試' : 'Failed to send, please try again'));
    document.getElementById('xish-step-email').style.display = 'none';
    document.getElementById('xish-step-otp').style.display = 'block';
    const otpLabel = document.getElementById('xish-otp-label');
    if (otpLabel) otpLabel.textContent = (gLang === 'zh' ? '驗證碼已發送至 ' : 'Code sent to ') + email;
    const otpInput = document.getElementById('xish-otp-input');
    if (otpInput) setTimeout(() => otpInput.focus(), 100);
  } catch (e) {
    if (statusEl) statusEl.textContent = e.message;
    if (btn) { btn.disabled = false; btn.textContent = gLang === 'zh' ? '發送驗證碼' : 'Send Code'; }
  }
};

window.xishVerifyOtp = async function() {
  const emailInput = document.getElementById('xish-email-input');
  const otpInput = document.getElementById('xish-otp-input');
  const statusEl = document.getElementById('xish-signin-status');
  const btn = document.getElementById('xish-verify-btn');
  const gLang = localStorage.getItem('language') || 'zh';
  const email = emailInput ? emailInput.value.trim() : '';
  const code = otpInput ? otpInput.value.trim() : '';
  if (!code || code.length < 4) {
    if (statusEl) statusEl.textContent = gLang === 'zh' ? '請輸入驗證碼' : 'Please enter the verification code';
    return;
  }
  if (statusEl) statusEl.textContent = '';
  if (btn) { btn.disabled = true; btn.textContent = gLang === 'zh' ? '驗證中…' : 'Verifying…'; }
  try {
    const joinRes = await fetch(API_BASE + '/api/xish/join-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restaurant_id: restaurantId, email, code }),
    });
    const joinData = await joinRes.json();
    if (!joinRes.ok) throw new Error(joinData.error || (gLang === 'zh' ? '驗證失敗，請重試' : 'Verification failed, please try again'));
    // Auto-login with the returned xish_id
    const loginRes = await fetch(API_BASE + '/api/xish/auth/xish-id-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ xish_id: joinData.xish_id, restaurant_id: restaurantId }),
    });
    const loginData = await loginRes.json();
    if (!loginRes.ok || loginData.mode === 'guest') throw new Error(gLang === 'zh' ? '登入失敗，請重試' : 'Login failed, please try again');
    // Store session data
    xishToken = loginData.token;
    xishMember = loginData.member;
    if (joinData.xish_id) localStorage.setItem('xish_id', joinData.xish_id);
    window.closeXishPanel();
    // Refresh loyalty display
    decorateLandingXish(window.sessionData);
    if (typeof _renderProfileTabContent === 'function') _renderProfileTabContent();
  } catch (e) {
    if (statusEl) statusEl.textContent = e.message;
    if (btn) { btn.disabled = false; btn.textContent = gLang === 'zh' ? '驗證並登入' : 'Verify & Sign In'; }
  }
};

let _xishMemberDetail = null;

async function getXishMemberDetail() {
  if (_xishMemberDetail) return _xishMemberDetail;
  if (!xishMember || !xishMember.member_id) return null;
  try {
    const r = await fetch(`${API_BASE}/xish/members/${xishMember.member_id}`, {
      headers: xishToken ? { 'Authorization': 'Bearer ' + xishToken } : {},
    });
    if (!r.ok) return null;
    _xishMemberDetail = await r.json();
    return _xishMemberDetail;
  } catch { return null; }
}

async function renderXishTabContent(tab) {
  const body = document.getElementById('xish-panel-body');
  const footer = document.getElementById('xish-panel-footer');
  if (!body) return;
  body.innerHTML = `<div class="xish-loading-text">${(localStorage.getItem('language')||'zh')==='zh' ? '載入中…' : 'Loading…'}</div>`;
  if (footer) footer.style.display = 'none';
  if (tab === 'points') {
    await renderXishPointsTab(body);
    if (footer) footer.style.display = 'block';
  } else if (tab === 'coupons') {
    await renderXishCouponsTab(body);
  } else if (tab === 'gifts') {
    await renderXishGiftsTab(body);
  }
}

async function renderXishPointsTab(body) {
  const lang = localStorage.getItem('language') || 'zh';
  const tierSvg = {
    platinum: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
    gold:     `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
    silver:   `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
    basic:    `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/></svg>`,
  }[xishMember.tier] || '';
    const tierZhMap = { platinum: '白金', gold: '黃金', silver: '銀維', basic: '基礎' };
  const tierLabel = lang === 'zh'
    ? (tierZhMap[xishMember.tier] || '基礎')
    : (xishMember.tier || 'basic').charAt(0).toUpperCase() + (xishMember.tier || 'basic').slice(1);
  const discountHtml = (xishMember.discount_percent > 0)
    ? `<div class="xish-discount-active">${xishMember.discount_percent}% ${lang === 'zh' ? '會員折扣生效中' : 'member discount active'}</div>`
    : '';
  body.innerHTML = `
    <div class="xish-member-hero">
      <div class="xish-tier-badge-large ${xishMember.tier}">${tierSvg} ${tierLabel}</div>
      <div class="xish-member-greeting">${escXish(xishMember.name || 'Member')}</div>
      <div class="xish-points-row">
        <div class="xish-pts-label">${lang === 'zh' ? '積分餘額' : 'POINTS BALANCE'}</div>
        <div class="xish-pts-value">${(xishMember.points_balance || 0).toLocaleString()}</div>
      </div>
      ${discountHtml}
      <div class="xish-xish-id">ID: ${escXish(xishMember.xish_id || '—')}</div>
      <div class="xish-tier-progress-wrap" id="xish-progress-wrap">
        <div class="xish-tier-progress-label">
          <span>${lang === 'zh' ? '升級進度' : 'Progress to next tier'}</span><span id="xish-progress-text">—</span>
        </div>
        <div class="xish-tier-progress-bar">
          <div class="xish-tier-progress-fill" id="xish-progress-fill" style="width:0%"></div>
        </div>
      </div>
    </div>
    <div class="xish-panel-section">
      <div class="xish-section-title">${lang === 'zh' ? '最近積分記錄' : 'Recent Points History'}</div>
      <div id="xish-history-list" class="xish-loading-text">${lang === 'zh' ? '載入中…' : 'Loading history…'}</div>
    </div>
  `;
  const targetRestaurantId = (xishMember && xishMember.restaurant_id) || restaurantId;
  const tiersPromise = targetRestaurantId
    ? fetch(`${API_BASE}/xish/tiers/${targetRestaurantId}`).then(r => r.ok ? r.json() : []).catch(() => [])
    : Promise.resolve([]);

  const [detail, tiersRes] = await Promise.all([
    getXishMemberDetail(),
    tiersPromise,
  ]);
  const progressFill = document.getElementById('xish-progress-fill');
  const progressText = document.getElementById('xish-progress-text');
  if (tiersRes && tiersRes.length > 0 && progressFill && progressText) {
    const pts = xishMember.points_balance || 0;
    const sorted = tiersRes.sort((a, b) => a.points_threshold - b.points_threshold);
    const nextTier = sorted.find(t => t.points_threshold > pts);
    const currentTierData = sorted.filter(t => t.points_threshold <= pts).pop();
    if (nextTier) {
      const base = currentTierData ? currentTierData.points_threshold : 0;
      const pct = Math.min(100, ((pts - base) / (nextTier.points_threshold - base)) * 100);
      progressFill.style.width = pct.toFixed(1) + '%';
      progressText.textContent = `${(nextTier.points_threshold - pts).toLocaleString()} pts to ${nextTier.tier.charAt(0).toUpperCase() + nextTier.tier.slice(1)}`;
    } else {
      progressFill.style.width = '100%';
      const tierNames = { platinum: '白金', gold: '黃金', silver: '銀維', basic: '基礎' };
      progressText.textContent = lang === 'zh' ? '已達最高等級' : 'Max tier reached';
    }
  }
  const historyEl = document.getElementById('xish-history-list');
  if (!historyEl) return;
  const history = (detail && detail.point_history) ? detail.point_history.slice(0, 20) : [];
  if (!history.length) {
    historyEl.innerHTML = `<div class="xish-empty-rewards">${lang === 'zh' ? '尚未有交易記錄。開始點餐即可累積積分！' : 'No transactions yet. Start ordering to earn points!'}</div>`;
    return;
  }
  historyEl.innerHTML = history.map(row => {
    const pts = row.points_delta || row.points_awarded || 0;
    const isPos = pts >= 0;
    const date = new Date(row.created_at).toLocaleDateString('en-HK', { day: 'numeric', month: 'short' });
    return `
      <div class="xish-point-row">
        <div>
          <div class="xish-point-desc">${escXish(row.restaurant_name || 'Order')}</div>
          <div class="xish-point-meta">${date}</div>
        </div>
        <div class="xish-point-val ${isPos ? 'positive' : 'negative'}">${isPos ? '+' : ''}${pts}</div>
      </div>`;
  }).join('');
}

async function renderXishCouponsTab(body) {
  const lang = localStorage.getItem('language') || 'zh';
  const [detail, catalogRaw] = await Promise.all([
    getXishMemberDetail(),
    (async () => {
      const targetRestaurantId = (xishMember && xishMember.restaurant_id) || restaurantId;
      if (!targetRestaurantId) return [];
      return fetch(`${API_BASE}/xish/gift-catalog/${targetRestaurantId}`)
        .then(r => r.ok ? r.json() : []).catch(() => []);
    })(),
  ]);

  // Member's owned coupons (item_type = 'coupon') — unused ones
  const allGiftCoupons = detail ? (detail.gift_coupons || []) : [];
  const myCoupons  = allGiftCoupons.filter(c => (c.item_type || c.setting_type || '').toLowerCase() === 'coupon' && c.qty_remaining > 0);
  const usedCoupons = allGiftCoupons.filter(c => (c.item_type || c.setting_type || '').toLowerCase() === 'coupon' && c.qty_remaining <= 0);

  // Catalog coupons available to redeem with points
  const ownedSettingIds = new Set(allGiftCoupons.map(c => c.gift_setting_id).filter(Boolean));
  const catalogCoupons = catalogRaw.filter(g => (g.item_type || 'gift').toLowerCase() === 'coupon' && !ownedSettingIds.has(g.id));
  const userPoints = xishMember ? (xishMember.points_balance || 0) : 0;

  const couponIconSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 0 0-2 2v3a2 2 0 0 1 0 4v3a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3a2 2 0 0 1 0-4V7a2 2 0 0 0-2-2H5z"/></svg>`;
  const usedIconSvg   = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`;

  const renderOwned = (c, faded) => {
    const expiry = c.valid_until
      ? (lang === 'zh' ? `到期：${new Date(c.valid_until).toLocaleDateString('zh-HK', { day: 'numeric', month: 'short' })}` : `Expires ${new Date(c.valid_until).toLocaleDateString('en-HK', { day: 'numeric', month: 'short', year: 'numeric' })}`)
      : (lang === 'zh' ? '永久有效' : 'No expiry');
    const label = c.name || c.item_reward || (lang === 'zh' ? '優惠券' : 'Coupon');
    const codeTag = c.coupon_code ? `<span style="background:#f0f0f0;border-radius:4px;padding:2px 7px;font-size:11px;font-family:monospace;letter-spacing:1px;font-weight:700;">${escXish(c.coupon_code)}</span>` : '';
    return `
      <div class="xish-coupon-card" style="${faded ? 'opacity:0.45' : ''}">
        <span class="xish-coupon-icon">${faded ? usedIconSvg : couponIconSvg}</span>
        <div style="flex:1;min-width:0;">
          <div class="xish-coupon-name">${escXish(label)}</div>
          ${codeTag ? `<div style="margin:3px 0;">${codeTag}</div>` : ''}
          <div class="xish-coupon-meta">${expiry}</div>
        </div>
        ${!faded ? `<div class="xish-coupon-qty" style="font-size:11px;color:#888;">×${c.qty_remaining}</div>` : ''}
      </div>`;
  };

  const renderCatalogCoupon = (g) => {
    const expires = g.redemption_end
      ? (lang === 'zh' ? `到期：${new Date(g.redemption_end).toLocaleDateString('zh-HK', { day: 'numeric', month: 'short' })}` : `Valid until ${new Date(g.redemption_end).toLocaleDateString('en-HK', { day: 'numeric', month: 'short' })}`)
      : (lang === 'zh' ? '永久有效' : 'Always available');
    const cost = g.points_cost || 0;
    const costLabel = cost > 0
      ? (lang === 'zh' ? `${cost.toLocaleString()} 積分` : `${cost.toLocaleString()} pts`)
      : (lang === 'zh' ? '免費兌換' : 'Free');
    const canAfford = cost === 0 || userPoints >= cost;
    return `
      <div class="xish-coupon-card" style="${!canAfford ? 'opacity:0.5' : ''}">
        <span class="xish-coupon-icon">${couponIconSvg}</span>
        <div style="flex:1;min-width:0;">
          <div class="xish-coupon-name">${escXish(g.item_name)}</div>
          <div class="xish-coupon-meta">${expires}</div>
        </div>
        <button
          onclick="redeemXishCatalogItem(${g.id}, 'coupon')"
          ${!canAfford ? 'disabled' : ''}
          style="flex-shrink:0;background:${canAfford ? 'var(--xish-accent,#a10035)' : '#ccc'};color:white;border:none;border-radius:6px;padding:5px 10px;font-size:11px;font-weight:600;cursor:${canAfford ? 'pointer' : 'not-allowed'};"
        >${costLabel}</button>
      </div>`;
  };

  const hasAnything = myCoupons.length || usedCoupons.length || catalogCoupons.length;
  if (!hasAnything) {
    body.innerHTML = `
      <div class="xish-panel-section">
        <div class="xish-empty-rewards">${lang === 'zh' ? '暫時沒有優惠券。<br/>兌換積分即可獲得！' : 'No coupons yet.<br/>Redeem your points to get one!'}</div>
      </div>`;
    return;
  }

  body.innerHTML = `
    ${myCoupons.length ? `
    <div class="xish-panel-section">
      <div class="xish-section-title">${lang === 'zh' ? `我的優惠券 (${myCoupons.length})` : `My Coupons (${myCoupons.length})`}</div>
      ${myCoupons.map(c => renderOwned(c, false)).join('')}
    </div>` : ''}
    ${catalogCoupons.length ? `
    <div class="xish-panel-section">
      <div class="xish-section-title">${lang === 'zh' ? '可兌換優惠券' : 'Available to Redeem'}</div>
      ${catalogCoupons.map(g => renderCatalogCoupon(g)).join('')}
    </div>` : ''}
    ${usedCoupons.length ? `
    <div class="xish-panel-section">
      <div class="xish-section-title" style="opacity:0.6;">${lang === 'zh' ? '已使用' : 'Used'}</div>
      ${usedCoupons.map(c => renderOwned(c, true)).join('')}
    </div>` : ''}
  `;
}

async function renderXishGiftsTab(body) {
  try {
    const targetRestaurantId = (xishMember && xishMember.restaurant_id) || restaurantId;
    if (!targetRestaurantId) {
      const giftLangMissing = localStorage.getItem('language') || 'zh';
      body.innerHTML = `<div class="xish-loading-text">${giftLangMissing === 'zh' ? '目前無法載入禮品' : 'Could not load gifts right now'}</div>`;
      return;
    }

    const [catalogRes, detail] = await Promise.all([
      fetch(`${API_BASE}/xish/gift-catalog/${targetRestaurantId}`).then(r => r.ok ? r.json() : []).catch(() => []),
      getXishMemberDetail(),
    ]);

    // Filter to gift-type items only (not coupons)
    const giftCatalog = catalogRes.filter(g => (g.item_type || 'gift').toLowerCase() === 'gift');
    const allGiftCoupons = (detail && detail.gift_coupons) || [];
    const ownedSettingIds = new Set(allGiftCoupons
      .filter(c => (c.item_type || c.setting_type || 'gift').toLowerCase() === 'gift' && c.qty_remaining > 0)
      .map(c => c.gift_setting_id).filter(Boolean));
    const myGifts = allGiftCoupons.filter(c => (c.item_type || c.setting_type || 'gift').toLowerCase() === 'gift' && c.qty_remaining > 0);
    const giftLang = localStorage.getItem('language') || 'zh';
    const userPoints = xishMember ? (xishMember.points_balance || 0) : 0;

    const giftIconSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>`;
    const checkIconSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`;

    const renderMyGift = (gc) => {
      const expiry = gc.valid_until
        ? (giftLang === 'zh' ? `到期：${new Date(gc.valid_until).toLocaleDateString('zh-HK', { day: 'numeric', month: 'short' })}` : `Expires ${new Date(gc.valid_until).toLocaleDateString('en-HK', { day: 'numeric', month: 'short', year: 'numeric' })}`)
        : (giftLang === 'zh' ? '永久有效' : 'No expiry');
      return `
        <div class="xish-gift-card">
          <span class="xish-gift-icon">${checkIconSvg}</span>
          <div>
            <div class="xish-gift-name">${escXish(gc.name || gc.item_reward)}</div>
            <div class="xish-gift-meta">${expiry}${giftLang === 'zh' ? ' · 已加入錢包' : ' · In your wallet'}</div>
          </div>
        </div>`;
    };

    const renderCatalogGift = (g) => {
      const expires = g.redemption_end
        ? (giftLang === 'zh' ? `到期：${new Date(g.redemption_end).toLocaleDateString('zh-HK', { day: 'numeric', month: 'short' })}` : `Valid until ${new Date(g.redemption_end).toLocaleDateString('en-HK', { day: 'numeric', month: 'short' })}`)
        : (giftLang === 'zh' ? '永久有效' : 'Always available');
      const cost = g.points_cost || 0;
      const costLabel = cost > 0
        ? (giftLang === 'zh' ? `${cost.toLocaleString()} 積分` : `${cost.toLocaleString()} pts`)
        : (giftLang === 'zh' ? '免費兌換' : 'Free');
      const owned = ownedSettingIds.has(g.id);
      const canAfford = cost === 0 || userPoints >= cost;
      return `
        <div class="xish-gift-card" style="${!canAfford && !owned ? 'opacity:0.5' : ''}">
          <span class="xish-gift-icon">${owned ? checkIconSvg : giftIconSvg}</span>
          <div style="flex:1;min-width:0;">
            <div class="xish-gift-name">${escXish(g.item_name)}</div>
            <div class="xish-gift-meta">${expires}${owned ? (giftLang === 'zh' ? ' · 已加入錢包' : ' · In your wallet') : ''}</div>
          </div>
          ${!owned ? `<button
            onclick="redeemXishCatalogItem(${g.id}, 'gift')"
            ${!canAfford ? 'disabled' : ''}
            style="flex-shrink:0;background:${canAfford ? 'var(--xish-accent,#a10035)' : '#ccc'};color:white;border:none;border-radius:6px;padding:5px 10px;font-size:11px;font-weight:600;cursor:${canAfford ? 'pointer' : 'not-allowed'};"
          >${costLabel}</button>` : ''}
        </div>`;
    };

    if (!myGifts.length && !giftCatalog.length) {
      body.innerHTML = `
        <div class="xish-panel-section">
          <div class="xish-empty-rewards">${giftLang === 'zh' ? '目前沒有可兌禮品。累積更多積分之後將會解鎖！' : 'No gift rewards available yet.<br/>Check back after earning more points!'}</div>
        </div>`;
      return;
    }

    body.innerHTML = `
      ${myGifts.length ? `
      <div class="xish-panel-section">
        <div class="xish-section-title">${giftLang === 'zh' ? `我的禮品 (${myGifts.length})` : `My Gifts (${myGifts.length})`}</div>
        ${myGifts.map(g => renderMyGift(g)).join('')}
      </div>` : ''}
      ${giftCatalog.length ? `
      <div class="xish-panel-section">
        <div class="xish-section-title">${giftLang === 'zh' ? '可兌換禮品' : 'Available Gifts'}</div>
        ${giftCatalog.map(g => renderCatalogGift(g)).join('')}
      </div>` : ''}
    `;
  } catch {
    const giftLangErr = localStorage.getItem('language') || 'zh';
    body.innerHTML = `<div class="xish-loading-text">${giftLangErr === 'zh' ? '無法載入禮品列表' : 'Could not load gift catalog'}</div>`;
  }
}

async function renderXishPanel() {
  await renderXishTabContent(xishActiveTab);
}

window.redeemXishCatalogItem = async function(giftSettingId, type) {
  if (!xishMember || !xishMember.member_id) return;
  const lang = localStorage.getItem('language') || 'zh';
  const confirmMsg = lang === 'zh'
    ? '確認兌換此獎勵？'
    : 'Confirm redeem this reward?';
  if (!confirm(confirmMsg)) return;

  try {
    const res = await fetch(`${API_BASE}/xish/members/${xishMember.member_id}/redeem-catalog/${giftSettingId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (xishToken || '') },
    });
    const data = await res.json();
    if (res.ok) {
      // Invalidate cached member detail so tabs refresh
      _xishMemberDetail = null;
      // Refresh the active tab
      const tab = type === 'coupon' ? 'coupons' : 'gifts';
      xishActiveTab = tab;
      document.querySelectorAll('.xish-tab-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.tab === tab);
      });
      await renderXishTabContent(tab);
      // Update points badge in member bar (subtract cost)
      if (xishMember) {
        const cost = data.reward ? 0 : 0; // balance already updated server-side; reload
        // Re-fetch member info
        const mRes = await fetch(`${API_BASE}/xish/me`, {
          headers: { 'Authorization': 'Bearer ' + (xishToken || '') },
        }).catch(() => null);
        if (mRes && mRes.ok) {
          const mData = await mRes.json();
          if (mData && mData.member) {
            xishMember = { ...xishMember, ...mData.member };
            const ptsEl = document.querySelector('.xish-mbc-pts');
            if (ptsEl) ptsEl.textContent = (xishMember.points_balance || 0).toLocaleString();
          }
        }
      }
    } else {
      alert(data.error || (lang === 'zh' ? '兌換失敗，請重試' : 'Redemption failed. Please try again.'));
    }
  } catch {
    const lang2 = localStorage.getItem('language') || 'zh';
    alert(lang2 === 'zh' ? '網絡錯誤，請重試' : 'Network error. Please try again.');
  }
};

window.xishLogout = function () {
  localStorage.removeItem('xish_token');
  if (restaurantId) localStorage.removeItem('xish_pass_' + restaurantId);
  xishMember = null;
  xishToken  = null;
  _xishMemberDetail = null;
  window.closeXishPanel();
  const bar = document.getElementById('xish-member-bar');
  if (bar) { bar.style.display = 'none'; bar.innerHTML = ''; }
  const pip = document.querySelector('#coupons-btn .xish-btn-badge');
  if (pip) pip.remove();
};
function escXish(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ══════════════════════════════════════════════════════════════ */

  initLanding();
