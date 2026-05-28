/* ═══════════════════════════════════════════════════════
   Chuio Web Console — Client Logic
   ═══════════════════════════════════════════════════════ */

(function () {
  'use strict';

  var API = window.location.origin + '/api';
  var token = localStorage.getItem('token');
  var restaurantId = localStorage.getItem('restaurantId');

  if (!token || !restaurantId) {
    window.location.href = '/login.html';
    return;
  }

  /* Expose globals needed by admin-settings-presets.js */
  window.restaurantId = restaurantId;
  window.API = window.location.origin + '/api';
  window.escapeHtml = function (str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  };
  window.t = function (key) {
    var m = {
      'admin.create-addon-preset': 'Create Addon Preset',
      'admin.edit-addon-preset': 'Edit Preset: {0}',
      'admin.add-items-to-preset': 'Add items to preset',
      'admin.select-menu-item': 'Select menu item\u2026',
      'admin.discount-price-label': 'Addon price',
      'admin.preset-add-btn': 'Add',
      'admin.preset-items-label': 'Preset Items',
      'admin.close': 'Close',
      'admin.no-items-in-preset': 'No items added yet',
      'admin.discount-display': '${0}',
      'admin.item-remove-btn': 'Remove',
      'admin.remove-item-from-preset': 'Remove this item from the preset?',
      'admin.preset-delete-confirm': 'Delete preset "{0}"?',
      'admin.create-variant-preset': 'Create Variant Preset',
      'admin.variant-title-label': 'Title',
      'admin.variant-title-placeholder': 'e.g. Size, Spiciness',
      'admin.preset-desc-label': 'Description',
      'admin.preset-desc-placeholder': 'Optional description',
      'admin.cancel-button': 'Cancel',
      'admin.create-preset-btn': 'Create',
      'admin.preset-name-label': 'Name',
      'admin.preset-name-placeholder': 'Preset name',
      'admin.add-new-option': 'Add New Option',
      'admin.add-option-btn': '+ Add Option',
      'admin.options-label': 'Options',
      'admin.add-option-title': 'Add Option',
      'admin.option-name-input': 'Option Name',
      'admin.option-name-placeholder': 'e.g. Small, Medium, Large',
      'admin.option-price-input': 'Price Adjustment (cents)',
      'admin.option-price-placeholder': '0',
      'admin.no-options-in-preset': 'No options yet',
      'admin.no-options-hint': 'Use the button above to add options',
      'admin.edit-option': 'Edit Option',
      'admin.save-option': 'Save',
      'admin.delete-option': 'Delete',
      'admin.option-name': 'Name',
      'admin.option-price': 'Price (cents)'
    };
    return m[key] || key;
  };

  /* ─── API Helper ─────────────────────────────────────── */
  async function api(method, path, body) {
    var opts = {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      }
    };
    if (body) opts.body = JSON.stringify(body);
    var res = await fetch(API + path, opts);
    if (res.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login.html';
      return null;
    }
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error(data.error || data.message || 'Request failed');
    return data;
  }

  /* ─── Toast ──────────────────────────────────────────── */
  function toast(msg, type) {
    var el = document.getElementById('console-toast');
    if (!el) return;
    el.textContent = msg;
    el.className = 'console-toast show ' + (type || 'success');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.className = 'console-toast'; }, 3000);
  }

  /* ─── Wrap xaSwitchSection from xish-admin.js ────────── */
  var _xaOrigSwitch = window.xaSwitchSection;
  window.xaSwitchSection = function (name, btn) {
    // Hide all console sections (new sections controlled by console)
    document.querySelectorAll('.console-section').forEach(function (s) { s.classList.remove('active'); });
    document.querySelectorAll('.console-nav-btn').forEach(function (b) { b.classList.remove('active'); });
    if (btn) btn.classList.add('active');
    // Call original to activate xa-section + load data
    if (_xaOrigSwitch) _xaOrigSwitch.call(window, name, null);
  };

  /* ─── Section Routing ────────────────────────────────── */
  var _sectionLoaded = {};
  var _liveQueueTimer = null;
  var _tablesAutoRefreshTimer = null;

  // Sub-sections of Members Area — keep tiers nav highlighted
  var _membersAreaSubSections = ['loyalty-pass', 'signup-methods'];

  // Switch Members Area sub-tab without leaving the Members Area context
  window.membersAreaSubTab = function (name, tabBtn) {
    // Highlight the clicked tab button, dim others
    document.querySelectorAll('.ma-subnav-btn').forEach(function (b) {
      b.style.background = 'transparent';
      b.style.boxShadow = 'none';
      b.style.color = '#6b7280';
    });
    if (tabBtn) {
      tabBtn.style.background = '#fff';
      tabBtn.style.boxShadow = '0 1px 3px rgba(0,0,0,.08)';
      tabBtn.style.color = '#1f2937';
    }
    if (name === 'overview') {
      // Show tiers section, hide loyalty-pass and signup-methods
      var tiersEl = document.getElementById('section-tiers');
      if (tiersEl) tiersEl.classList.add('active');
      ['loyalty-pass', 'signup-methods'].forEach(function (s) {
        var el = document.getElementById('section-' + s);
        if (el) el.classList.remove('active');
      });
    } else {
      consoleSwitchSection(name, null);
      // Re-highlight tiers nav button (since consoleSwitchSection cleared it)
      var tiersNavBtn = document.querySelector('.console-nav-btn[data-section="tiers"]');
      if (tiersNavBtn) tiersNavBtn.classList.add('active');
    }
  };

  window.consoleSwitchSection = function (name, btn) {
    // Stop live queue auto-refresh when leaving queue section
    if (name !== 'queue' && _liveQueueTimer) { clearInterval(_liveQueueTimer); _liveQueueTimer = null; }
    // Stop tables auto-refresh when leaving tables section
    if (name !== 'tables' && _tablesAutoRefreshTimer) { clearInterval(_tablesAutoRefreshTimer); _tablesAutoRefreshTimer = null; }
    document.querySelectorAll('.console-section').forEach(function (s) { s.classList.remove('active'); });
    document.querySelectorAll('.console-nav-btn').forEach(function (b) { b.classList.remove('active'); });
    if (btn) btn.classList.add('active');
    // Sub-sections of Members Area: keep tiers nav button highlighted
    if (_membersAreaSubSections.indexOf(name) !== -1) {
      var tiersNavBtn = document.querySelector('.console-nav-btn[data-section="tiers"]');
      if (tiersNavBtn) tiersNavBtn.classList.add('active');
    }

    var target = document.getElementById('section-' + name);
    if (target) target.classList.add('active');

    var titles = {
      dashboard: 'Dashboard',
      menu: 'Menu Management · 菜單管理',
      tables: 'Table Management · 桌台管理',
      queue: 'Queue Management · 排隊管理',
      crm: 'CRM · 顧客管理',
      orders: 'Order History · 訂單記錄',
      reports: 'Reports · 報告',
      tiers: 'Members Area · 會員專區',
      discounts: 'Discounts · 折扣',
      gifts: 'Gift Cards · 禮品卡',
      coupons: 'Voucher Codes · 優惠碼',
      'reward-catalog': 'Reward Catalog · 積分獎賞目錄',
      campaigns: 'Campaigns · 推廣活動',
      wallet: 'Loyalty &amp; Wallet · 忠誠計劃及電子錢包',
      'signup-methods': 'Sign-up Methods · 會員註冊方式',
      'loyalty-pass': 'Loyalty Pass · 會員卡功能',
      'settings-restaurant': 'Restaurant · 餐廳資料',
      'settings-qr': 'QR & Order · 二維碼與落單',
      'settings-menu': 'Menu Settings · 菜單設定',
      'settings-payment': 'Payment · 付款方式',
      'settings-booking': 'Booking · 預訂設定',
      'settings-service-req': 'Service Requests · 服務請求',
      'settings-staff': 'Staff & Login QR · 員工及廚房登入',
      'settings-feature-flags': 'Feature Flags · 功能開關',
      'settings-addon-presets': 'Addon Presets · 附加選項預設',
      'settings-variant-presets': 'Variant Presets · 款式選項預設'
    };
    var titleEl = document.getElementById('console-page-title');
    if (titleEl) titleEl.textContent = titles[name] || name;

    // Reset scroll to top on section switch
    var contentEl = document.querySelector('.console-content');
    if (contentEl) contentEl.scrollTop = 0;

    // Load data on first visit (or always for dashboard)
    var loyaltySections = ['tiers', 'campaigns', 'wallet'];
    if (loyaltySections.indexOf(name) !== -1) {
      // Delegate to xish-admin.js
      if (_xaOrigSwitch) _xaOrigSwitch.call(window, name, null);
      if (name === 'tiers') consoleLoadMembersAreaFlags();
    } else if (name === 'coupons') {
      consoleLoadCoupons();
    } else if (name === 'reward-catalog') {
      csLoadRewards();
    } else if (name === 'dashboard') {
      consoleLoadDashboard();
    } else if (name === 'menu' && !_sectionLoaded.menu) {
      _sectionLoaded.menu = true;
      consoleLoadMenu();
    } else if (name === 'tables' && !_sectionLoaded.tables) {
      _sectionLoaded.tables = true;
      consoleLoadTables();
      if (!_tablesAutoRefreshTimer) _tablesAutoRefreshTimer = setInterval(function() { consoleLoadTables(); }, 30000);
    } else if (name === 'tables') {
      if (!_tablesAutoRefreshTimer) _tablesAutoRefreshTimer = setInterval(function() { consoleLoadTables(); }, 30000);
    } else if (name === 'queue' && !_sectionLoaded.queue) {
      _sectionLoaded.queue = true;
      consoleLoadQueue();
      // Auto-refresh live queue every 15 seconds
      if (!_liveQueueTimer) _liveQueueTimer = setInterval(function() { consoleLoadLiveQueue(); }, 15000);
    } else if (name === 'queue') {
      // Already loaded but re-entering; restart auto-refresh if needed
      if (!_liveQueueTimer) _liveQueueTimer = setInterval(function() { consoleLoadLiveQueue(); }, 15000);
    } else if (name === 'crm' && !_sectionLoaded.crm) {
      _sectionLoaded.crm = true;
      consoleLoadCrmMembers();
    } else if (name === 'orders') {
      consoleLoadOrders();
    } else if (name === 'reports') {
      consoleLoadReports();
    } else if (name === 'signup-methods' && !_sectionLoaded['signup-methods']) {
      _sectionLoaded['signup-methods'] = true;
      consoleLoadSignupMethods();
    } else if (name === 'loyalty-pass' && !_sectionLoaded['loyalty-pass']) {
      _sectionLoaded['loyalty-pass'] = true;
      consoleLoadLoyaltyPassSettings();
    } else if (name === 'settings-restaurant' && !_sectionLoaded['settings-restaurant']) {
      _sectionLoaded['settings-restaurant'] = true;
      csLoadRestaurantInfo();
    } else if (name === 'settings-qr' && !_sectionLoaded['settings-qr']) {
      _sectionLoaded['settings-qr'] = true;
      csLoadQrSettings();
    } else if (name === 'settings-menu' && !_sectionLoaded['settings-menu']) {
      _sectionLoaded['settings-menu'] = true;
      csLoadMenuSettings();
    } else if (name === 'settings-payment' && !_sectionLoaded['settings-payment']) {
      _sectionLoaded['settings-payment'] = true;
      csLoadPaymentSettings();
    } else if (name === 'settings-booking' && !_sectionLoaded['settings-booking']) {
      _sectionLoaded['settings-booking'] = true;
      csLoadBookingSettings();
    } else if (name === 'settings-service-req') {
      csLoadServiceRequests();
    } else if (name === 'settings-staff') {
      csLoadStaffLoginLinks();
    } else if (name === 'settings-feature-flags') {
      csLoadFeatureFlags();
    } else if (name === 'settings-addon-presets') {
      loadAddonPresets();
    } else if (name === 'settings-variant-presets') {
      loadVariantPresets();
    }

    // Close sidebar on mobile
    if (window.innerWidth <= 900) {
      document.getElementById('console-sidebar').classList.remove('open');
    }
  };

  /* ─── Sidebar / Logout ───────────────────────────────── */
  window.consoleToggleSidebar = function () {
    document.getElementById('console-sidebar').classList.toggle('open');
    var bd = document.getElementById('console-sidebar-backdrop');
    if (bd) bd.classList.toggle('active');
  };

  window.consoleLogout = function () {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('restaurantId');
    localStorage.removeItem('userId');
    localStorage.removeItem('xish_merchant_token');
    localStorage.removeItem('xish_restaurantId');
    localStorage.removeItem('xish_role');
    window.location.href = '/login.html';
  };

  window.consoleCloseModal = function (id) {
    var el = document.getElementById(id);
    if (el) el.style.display = 'none';
  };

  function openConsoleModal(id) {
    var el = document.getElementById(id);
    if (el) el.style.display = 'flex';
  }

  /* ─── Restaurant Info ────────────────────────────────── */
  async function consoleLoadRestaurantInfo() {
    try {
      var data = await api('GET', '/restaurants/' + restaurantId);
      if (data && data.name) {
        var badge = document.getElementById('console-restaurant-badge');
        if (badge) badge.textContent = data.name;
      }
    } catch (e) {
      var badge = document.getElementById('console-restaurant-badge');
      if (badge) badge.textContent = 'Restaurant #' + restaurantId;
    }
    consoleLoadRestaurantSwitcher();
  }

  /* ═══════════════════════════════════════════════════════
     DASHBOARD  ═══════════════════════════════════════════════════════ */
  var _dashLoading = false;

  async function consoleLoadDashboard() {
    if (_dashLoading) return;
    _dashLoading = true;
    try {
      // Fetch recent orders (up to 200)
      var orders = await api('GET', '/restaurants/' + restaurantId + '/orders?limit=200');
      if (!Array.isArray(orders)) orders = [];

      var now = new Date();
      var todayStr = now.toISOString().slice(0, 10);
      var monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);

      var todayOrders = orders.filter(function (o) { return (o.created_at || '').slice(0, 10) === todayStr; });
      var monthOrders = orders.filter(function (o) { return (o.created_at || '').slice(0, 10) >= monthStart; });

      var todayRev = todayOrders.reduce(function (sum, o) { return sum + (o.total_cents || 0) / 100; }, 0);
      var monthRev = monthOrders.reduce(function (sum, o) { return sum + (o.total_cents || 0) / 100; }, 0);

      function fmt(v) { return 'HK$' + v.toFixed(0); }

      var el = document.getElementById('dash-rev-today');
      if (el) el.textContent = fmt(todayRev);
      var el2 = document.getElementById('dash-rev-today-sub');
      if (el2) el2.textContent = todayOrders.length + ' orders today';
      var el3 = document.getElementById('dash-rev-month');
      if (el3) el3.textContent = fmt(monthRev);
      var el4 = document.getElementById('dash-rev-month-sub');
      if (el4) el4.textContent = monthOrders.length + ' orders this month';
      var el5 = document.getElementById('dash-orders-today');
      if (el5) el5.textContent = todayOrders.length;
      var el6 = document.getElementById('dash-orders-sub');
      if (el6) el6.textContent = 'in last 24h: ' + orders.filter(function (o) {
        return o.created_at && (new Date() - new Date(o.created_at)) < 86400000;
      }).length;

      // Render recent orders table
      var tbody = document.getElementById('dash-orders-body');
      if (tbody) {
        if (orders.length === 0) {
          tbody.innerHTML = '<tr><td colspan="4" class="console-empty">No orders yet.</td></tr>';
        } else {
          var recent = orders.slice(0, 20);
          tbody.innerHTML = recent.map(function (o) {
            var d = o.created_at ? new Date(o.created_at) : null;
            var timeStr = d ? d.toLocaleTimeString('zh-HK', { hour: '2-digit', minute: '2-digit' }) + ' ' + d.toLocaleDateString('zh-HK', { month: 'short', day: 'numeric' }) : '—';
            var amt = (o.total_cents || 0) / 100;
            var status = o.status || 'unknown';
            var badgeCls = status === 'paid' ? 'badge-green' : status === 'pending' ? 'badge-yellow' : status === 'cancelled' ? 'badge-red' : 'badge-gray';
            return '<tr><td>' + timeStr + '</td><td>' + (o.table_name || o.table_label || '#' + o.id) + '</td><td>HK$' + amt.toFixed(0) + '</td><td><span class="badge ' + badgeCls + '">' + status + '</span></td></tr>';
          }).join('');
        }
      }
    } catch (e) {
      console.error('[Dashboard]', e);
    }

    // Load loyalty member count
    try {
      var stats = await api('GET', '/restaurants/' + restaurantId + '/xish/analytics/stats?days=30');
      if (stats) {
        var memEl = document.getElementById('dash-members');
        if (memEl) memEl.textContent = (stats.total_members || '—');
        var subEl = document.getElementById('dash-members-sub');
        if (subEl) subEl.textContent = (stats.new_members_30d || 0) + ' joined this month';
      }
    } catch (e) {
      // Loyalty stats unavailable
      var memEl = document.getElementById('dash-members');
      if (memEl) memEl.textContent = '—';
    }

    _dashLoading = false;
  }

  /* ═══════════════════════════════════════════════════════
     MENU MANAGEMENT
  ═══════════════════════════════════════════════════════ */
  var _menuCategories = [];
  var _menuItems = [];
  var _menuSelectedCatId = null;
  var _addonPresets = [];
  var _variantPresets = [];

  async function consoleLoadMenu() {
    try {
      var [cats, items, addonPresets, variantPresets] = await Promise.all([
        api('GET', '/restaurants/' + restaurantId + '/menu_categories'),
        api('GET', '/restaurants/' + restaurantId + '/menu/staff'),
        api('GET', '/restaurants/' + restaurantId + '/addon-presets'),
        api('GET', '/restaurants/' + restaurantId + '/variant-presets')
      ]);
      _menuCategories = Array.isArray(cats) ? cats : [];
      _menuItems = Array.isArray(items) ? items : (items && Array.isArray(items.items) ? items.items : []);
      _addonPresets = Array.isArray(addonPresets) ? addonPresets : [];
      _variantPresets = Array.isArray(variantPresets) ? variantPresets : [];
      renderMenuCategories();
      if (_menuCategories.length > 0) {
        consoleSelectCategory(_menuCategories[0].id, _menuCategories[0].name);
      }
    } catch (e) {
      console.error('[Menu]', e);
      var list = document.getElementById('menu-cat-list');
      if (list) list.innerHTML = '<li style="padding:16px;text-align:center;color:#e74c3c;font-size:13px;">Failed to load menu.</li>';
    }
  }

  function renderMenuCategories() {
    var list = document.getElementById('menu-cat-list');
    if (!list) return;
    if (_menuCategories.length === 0) {
      list.innerHTML = '<li style="padding:16px;text-align:center;color:#9ca3af;font-size:13px;">No categories yet.</li>';
      return;
    }
    list.innerHTML = _menuCategories.map(function (c) {
      return '<li class="console-cat-item' + (_menuSelectedCatId === c.id ? ' active' : '') + '" draggable="true" data-catid="' + c.id + '" data-catname="' + escHtml(c.name) + '">'
        + '<span class="console-cat-drag-handle" title="Drag to reorder">⠿</span>'
        + '<span style="flex:1;">' + escHtml(c.name) + '</span>'
        + '<span class="console-cat-item-actions">'
        + '<button class="console-cat-action-btn cat-edit-btn" title="Edit" data-catid="' + c.id + '" data-catname="' + escHtml(c.name) + '"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>'
        + '<button class="console-cat-action-btn cat-del-btn" title="Delete" data-catid="' + c.id + '" data-catname="' + escHtml(c.name) + '"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg></button>'
        + '</span></li>';
    }).join('');
    list.querySelectorAll('.console-cat-item').forEach(function (li) {
      li.addEventListener('click', function (e) {
        if (e.target.closest('.cat-edit-btn') || e.target.closest('.cat-del-btn') || e.target.closest('.console-cat-drag-handle')) return;
        consoleSelectCategory(parseInt(li.dataset.catid), li.dataset.catname);
      });
    });
    list.querySelectorAll('.cat-edit-btn').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        consoleOpenCategoryModal(parseInt(btn.dataset.catid), btn.dataset.catname);
      });
    });
    list.querySelectorAll('.cat-del-btn').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        consoleDeleteCategory(parseInt(btn.dataset.catid), btn.dataset.catname);
      });
    });
    // Drag-and-drop reorder for categories
    (function() {
      var dragged = null;
      list.querySelectorAll('.console-cat-item').forEach(function(li) {
        li.addEventListener('dragstart', function(e) {
          dragged = li;
          li.style.opacity = '0.5';
          e.dataTransfer.effectAllowed = 'move';
        });
        li.addEventListener('dragend', function() {
          dragged = null;
          li.style.opacity = '';
          list.querySelectorAll('.console-cat-item').forEach(function(l) { l.classList.remove('drag-over'); });
          // Save new order
          var cats = [];
          list.querySelectorAll('.console-cat-item[data-catid]').forEach(function(l, idx) {
            cats.push({ id: parseInt(l.dataset.catid), sort_order: idx });
          });
          api('PUT', '/restaurants/' + restaurantId + '/menu-categories/reorder', { categories: cats })
            .catch(function(e) { console.warn('Category reorder failed', e); });
        });
        li.addEventListener('dragover', function(e) {
          e.preventDefault();
          if (dragged && li !== dragged) {
            list.querySelectorAll('.console-cat-item').forEach(function(l) { l.classList.remove('drag-over'); });
            li.classList.add('drag-over');
            var rect = li.getBoundingClientRect();
            if (e.clientY < rect.top + rect.height / 2) {
              list.insertBefore(dragged, li);
            } else {
              list.insertBefore(dragged, li.nextSibling);
            }
          }
        });
        li.addEventListener('drop', function(e) {
          e.preventDefault();
          li.classList.remove('drag-over');
        });
      });
    }());
  }

  window.consoleSelectCategory = function (catId, catName) {
    _menuSelectedCatId = catId;
    renderMenuCategories();
    var header = document.getElementById('menu-items-header');
    if (header) header.textContent = catName;
    var search = (document.getElementById('menu-search') || {}).value || '';
    renderMenuItems(catId, search);
  };

  function renderMenuItems(catId, search) {
    var grid = document.getElementById('menu-items-grid');
    if (!grid) return;
    var items = _menuItems.filter(function (it) {
      return String(it.category_id) === String(catId) &&
        (!search || (it.name || '').toLowerCase().includes(search.toLowerCase()));
    });
    if (items.length === 0) {
      grid.innerHTML = '<div style="grid-column:1/-1;" class="console-empty">No items in this category.</div>';
      return;
    }
    grid.innerHTML = items.map(function (it) {
      var imgHtml = it.image_url
        ? '<img class="console-item-img" src="' + escHtml(it.image_url) + '" alt="" />'
        : '<div class="console-item-img-placeholder">🍽</div>';
      var variantBadge = (it.variants && it.variants.length > 0)
        ? '<span style="font-size:10px;background:#e0e7ff;color:#4338ca;border-radius:4px;padding:1px 5px;margin-left:4px;">' + it.variants.length + ' variant(s)</span>'
        : (it.is_meal_combo ? '<span style="font-size:10px;background:#fef3c7;color:#92400e;border-radius:4px;padding:1px 5px;margin-left:4px;">Combo</span>' : '');
      return '<div class="console-item-card" draggable="true" data-item-id="' + it.id + '">'
        + '<div class="console-item-drag-handle" title="Drag to reorder">⠿</div>'
        + imgHtml
        + '<div class="console-item-body">'
        + '<div class="console-item-name">' + escHtml(it.name) + variantBadge + '</div>'
        + '<div class="console-item-desc">' + escHtml(it.description || '') + '</div>'
        + '<div class="console-item-price">HK$' + ((it.price_cents || 0) / 100).toFixed(0) + '</div>'
        + '</div>'
        + '<div class="console-item-actions">'
        + '<button class="console-btn console-btn-sm" onclick="consoleOpenItemModal(' + it.id + ')">Edit</button>'
        + '<button class="console-btn console-btn-sm console-btn-danger item-del-btn" data-id="' + it.id + '" data-name="' + escHtml(it.name) + '">Delete</button>'
        + '</div>'
        + '</div>';
    }).join('');
    grid.querySelectorAll('.item-del-btn').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        consoleDeleteItem(parseInt(btn.dataset.id), btn.dataset.name);
      });
    });
    // Drag-and-drop reorder
    initMenuItemDragDrop(grid, catId);
  }

  function initMenuItemDragDrop(grid, catId) {
    var dragged = null;
    grid.querySelectorAll('.console-item-card').forEach(function (card) {
      card.addEventListener('dragstart', function (e) {
        dragged = card;
        card.style.opacity = '0.5';
        e.dataTransfer.effectAllowed = 'move';
      });
      card.addEventListener('dragend', function () {
        dragged = null;
        card.style.opacity = '';
        grid.querySelectorAll('.console-item-card').forEach(function(c) { c.classList.remove('drag-over'); });
      });
      card.addEventListener('dragover', function (e) {
        e.preventDefault();
        if (dragged && card !== dragged) {
          grid.querySelectorAll('.console-item-card').forEach(function(c) { c.classList.remove('drag-over'); });
          card.classList.add('drag-over');
          var rect = card.getBoundingClientRect();
          var mid = rect.top + rect.height / 2;
          if (e.clientY < mid) {
            grid.insertBefore(dragged, card);
          } else {
            grid.insertBefore(dragged, card.nextSibling);
          }
        }
      });
      card.addEventListener('drop', function (e) {
        e.preventDefault();
        card.classList.remove('drag-over');
      });
    });
    grid.addEventListener('dragend', function () {
      // Save new order
      var ids = [];
      grid.querySelectorAll('.console-item-card[data-item-id]').forEach(function(c) {
        ids.push(parseInt(c.dataset.itemId));
      });
      api('PUT', '/restaurants/' + restaurantId + '/menu-items/reorder', { item_ids: ids, category_id: parseInt(catId) })
        .then(function() { toast('Order saved'); })
        .catch(function(e) { console.warn('Reorder failed', e); });
    }, { once: false });
  }

  window.consoleFilterItems = function () {
    if (_menuSelectedCatId) {
      var search = (document.getElementById('menu-search') || {}).value || '';
      renderMenuItems(_menuSelectedCatId, search);
    }
  };

  /* ── Category CRUD ── */
  window.consoleOpenCategoryModal = function (id, name) {
    document.getElementById('modal-category-title').textContent = id ? 'Edit Category' : 'Add Category';
    document.getElementById('modal-category-id').value = id || '';
    document.getElementById('modal-category-name').value = name || '';
    var cat = id ? _menuCategories.find(function(c) { return c.id === id; }) : null;
    document.getElementById('modal-category-name-zh').value = cat ? (cat.name_zh || '') : '';
    openConsoleModal('modal-category');
  };

  window.consoleSaveCategory = async function () {
    var id = document.getElementById('modal-category-id').value;
    var name = document.getElementById('modal-category-name').value.trim();
    var name_zh = document.getElementById('modal-category-name-zh').value.trim() || null;
    if (!name) { toast('Category name is required', 'error'); return; }
    try {
      if (id) {
        await api('PATCH', '/menu_categories/' + id, { name: name, name_zh: name_zh });
        toast('Category updated');
      } else {
        await api('POST', '/restaurants/' + restaurantId + '/menu_categories', { name: name, name_zh: name_zh });
        toast('Category created');
      }
      consoleCloseModal('modal-category');
      _sectionLoaded.menu = false;
      consoleLoadMenu();
    } catch (e) {
      toast(e.message || 'Failed to save category', 'error');
    }
  };

  window.consoleDeleteCategory = async function (id, name) {
    if (!confirm('Delete category "' + name + '"? Items in this category will be unassigned.')) return;
    try {
      await api('DELETE', '/menu_categories/' + id);
      toast('Category deleted');
      _sectionLoaded.menu = false;
      consoleLoadMenu();
    } catch (e) {
      toast(e.message || 'Failed to delete', 'error');
    }
  };

  /* ── Item CRUD ── */
  window.consoleOpenItemModal = function (itemId) {
    var item = itemId ? _menuItems.find(function (i) { return i.id === itemId; }) : null;
    document.getElementById('modal-item-title').textContent = item ? 'Edit Item' : 'Add Menu Item';
    document.getElementById('modal-item-id').value = item ? item.id : '';
    document.getElementById('modal-item-name').value = item ? (item.name || '') : '';
    document.getElementById('modal-item-name-zh').value = item ? (item.name_zh || '') : '';
    document.getElementById('modal-item-desc').value = item ? (item.description || '') : '';
    document.getElementById('modal-item-price').value = item ? ((item.price_cents || 0) / 100).toFixed(2) : '0.00';
    var sel = document.getElementById('modal-item-category');
    sel.innerHTML = _menuCategories.map(function (c) {
      return '<option value="' + c.id + '"' + (item && String(item.category_id) === String(c.id) ? ' selected' : '') + '>' + escHtml(c.name) + '</option>';
    }).join('');
    if (!item && _menuSelectedCatId) sel.value = _menuSelectedCatId;
    var comboChk = document.getElementById('modal-item-is-combo');
    if (comboChk) comboChk.checked = item ? !!(item.is_meal_combo) : false;
    var addonSel = document.getElementById('modal-item-addon-preset');
    if (addonSel) {
      addonSel.innerHTML = '<option value="">\u2014 None \u2014</option>'
        + _addonPresets.map(function(p) {
          return '<option value="' + p.id + '"' + (item && String(item.addon_preset_id) === String(p.id) ? ' selected' : '') + '>' + escHtml(p.name) + '</option>';
        }).join('');
    }
    // Render variants editor section
    var variantsSection = document.getElementById('modal-item-variants-section');
    if (variantsSection) {
      if (item) {
        _consoleItemVariants = (Array.isArray(item.variants) ? item.variants : []).map(function(v) {
          return Object.assign({}, v, { options: Array.isArray(v.options) ? v.options.slice() : [] });
        });
        consoleRenderItemVariants(item.id);
      } else {
        variantsSection.innerHTML = '';
        _consoleItemVariants = [];
      }
    }
    openConsoleModal('modal-item');
  };

  var _consoleItemVariants = [];

  window.consoleRenderItemVariants = function consoleRenderItemVariants(itemId) {
    var sec = document.getElementById('modal-item-variants-section');
    if (!sec) return;
    var hasVariants = _consoleItemVariants.length > 0;
    var listHtml = _consoleItemVariants.map(function(v) {
      var optsHtml = (v.options || []).map(function(o) {
        var p = o.price_cents > 0 ? ' +HK$' + (o.price_cents/100).toFixed(2) : o.price_cents < 0 ? ' -HK$' + (Math.abs(o.price_cents)/100).toFixed(2) : '';
        return '<span class="cv-opt-chip" data-oid="' + o.id + '" data-vid="' + v.id + '">'
          + escHtml(o.name) + p
          + ' <button type="button" class="cv-opt-edit" onclick="consoleEditVariantOpt(' + o.id + ',' + v.id + ',' + itemId + ')" title="Edit option">\u270e</button>'
          + ' <button type="button" class="cv-opt-del" onclick="consoleDeleteVariantOpt(' + o.id + ',' + v.id + ',' + itemId + ')">&#x2715;</button></span>';
      }).join('');
      var req = v.required ? '<span style="color:#dc2626;font-size:10px;margin-left:4px;">required</span>' : '';
      var minMax = (v.min_select != null || v.max_select != null)
        ? '<span style="font-size:10px;color:#9ca3af;margin-left:6px;">'
          + (v.min_select != null ? 'min ' + v.min_select : '')
          + (v.min_select != null && v.max_select != null ? ', ' : '')
          + (v.max_select != null ? 'max ' + v.max_select : '') + '</span>' : '';
      return '<div class="cv-variant-row" id="cv-v-' + v.id + '">'
        + '<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">'
        + '<span style="font-weight:600;font-size:13px;">' + escHtml(v.name) + '</span>' + req + minMax
        + '<button type="button" class="console-btn console-btn-sm" style="margin-left:auto;" onclick="consoleEditVariantInline(' + v.id + ',' + itemId + ')">Edit</button>'
        + '<button type="button" class="console-btn console-btn-sm console-btn-danger" onclick="consoleDeleteVariant(' + v.id + ',' + itemId + ')">Del</button>'
        + '</div>'
        + '<div class="cv-opts-wrap" id="cv-opts-' + v.id + '">' + (optsHtml || '<span style="font-size:11px;color:#9ca3af;">No options</span>') + '</div>'
        + '<div style="margin-top:6px;">'
        + '<button type="button" class="console-btn console-btn-sm" onclick="consoleShowAddOptForm(' + v.id + ',' + itemId + ')">+ Add Option</button>'
        + '<div class="cv-opt-form" id="cv-opt-form-' + v.id + '" style="display:none;margin-top:6px;">'
        + '<input type="text" class="console-input" id="cv-opt-name-' + v.id + '" placeholder="Option name" style="width:120px;margin-right:4px;" />'
        + '<input type="number" class="console-input" id="cv-opt-price-' + v.id + '" placeholder="Price ±cents" style="width:80px;margin-right:4px;" />'
        + '<button type="button" class="console-btn console-btn-sm console-btn-primary" onclick="consoleSaveNewOpt(' + v.id + ',' + itemId + ')">Add</button>'
        + '<button type="button" class="console-btn console-btn-sm" onclick="document.getElementById(\'cv-opt-form-' + v.id + '\').style.display=\'none\'">Cancel</button>'
        + '</div></div>'
        + '</div>';
    }).join('');
    var variantPresetBar = _variantPresets.length > 0
      ? '<div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;padding:8px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:6px;">'
        + '<select class="console-input" id="cv-vpreset-sel" style="flex:1;">'
        + '<option value="">\u2014 Apply Variant Preset \u2014</option>'
        + _variantPresets.map(function(p) { return '<option value="' + p.id + '">' + escHtml(p.name) + '</option>'; }).join('')
        + '</select>'
        + '<button type="button" class="console-btn console-btn-sm console-btn-primary" onclick="consoleApplyVariantPreset(' + itemId + ')">Apply</button>'
        + '</div>'
      : '';
    sec.innerHTML = '<div style="margin-top:12px;border-top:1px solid #e5e7eb;padding-top:10px;">'
      + variantPresetBar
      + '<div style="display:flex;align-items:center;margin-bottom:8px;">'
      + '<span style="font-size:12px;font-weight:600;color:#374151;">Variants / Options</span>'
      + '<button type="button" class="console-btn console-btn-sm console-btn-primary" style="margin-left:auto;" onclick="consoleShowAddVariantForm(' + itemId + ')">&#xFF0B; Add Variant</button>'
      + '</div>'
      + '<div id="cv-add-variant-form" style="display:none;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:10px;margin-bottom:8px;">'
      + '<div style="display:grid;grid-template-columns:1fr auto auto auto;gap:6px;align-items:center;margin-bottom:6px;">'
      + '<input type="text" class="console-input" id="cv-new-v-name" placeholder="Variant name (e.g. Size)" />'
      + '<input type="number" class="console-input" id="cv-new-v-min" placeholder="Min" style="width:60px;" />'
      + '<input type="number" class="console-input" id="cv-new-v-max" placeholder="Max" style="width:60px;" />'
      + '<label style="display:flex;align-items:center;gap:4px;font-size:12px;white-space:nowrap;"><input type="checkbox" id="cv-new-v-req" /> Req</label>'
      + '</div>'
      + '<div style="display:flex;gap:6px;">'
      + '<button type="button" class="console-btn console-btn-sm console-btn-primary" onclick="consoleSaveNewVariant(' + itemId + ')">Save Variant</button>'
      + '<button type="button" class="console-btn console-btn-sm" onclick="document.getElementById(\'cv-add-variant-form\').style.display=\'none\'">Cancel</button>'
      + '</div></div>'
      + '<div id="cv-variant-list">' + (listHtml || '<div style="font-size:12px;color:#9ca3af;">No variants configured.</div>') + '</div>'
      + '</div>';
  }

  window.consoleShowAddVariantForm = function(itemId) {
    var f = document.getElementById('cv-add-variant-form');
    if (f) { f.style.display = 'block'; var n = document.getElementById('cv-new-v-name'); if (n) n.focus(); }
  };

  window.consoleShowAddOptForm = function(variantId, itemId) {
    var f = document.getElementById('cv-opt-form-' + variantId);
    if (f) { f.style.display = 'block'; var n = document.getElementById('cv-opt-name-' + variantId); if (n) n.focus(); }
  };

  window.consoleSaveNewVariant = async function(itemId) {
    var name = (document.getElementById('cv-new-v-name') || {}).value.trim();
    var min = parseInt((document.getElementById('cv-new-v-min') || {}).value) || null;
    var max = parseInt((document.getElementById('cv-new-v-max') || {}).value) || null;
    var req = !!(document.getElementById('cv-new-v-req') || {}).checked;
    if (!name) { toast('Variant name required', 'error'); return; }
    try {
      var v = await api('POST', '/menu-items/' + itemId + '/variants', { name, min_select: min, max_select: max, required: req });
      _consoleItemVariants.push(Object.assign({ options: [] }, v));
      consoleRenderItemVariants(itemId);
    } catch(e) { toast('Failed to add variant', 'error'); }
  };

  window.consoleDeleteVariant = async function(variantId, itemId) {
    if (!confirm('Delete this variant and all its options?')) return;
    try {
      await api('DELETE', '/menu-items/' + itemId + '/variants/' + variantId);
      _consoleItemVariants = _consoleItemVariants.filter(function(v) { return v.id !== variantId; });
      consoleRenderItemVariants(itemId);
    } catch(e) { toast('Failed to delete variant', 'error'); }
  };

  window.consoleEditVariantInline = function(variantId, itemId) {
    var v = _consoleItemVariants.find(function(x) { return x.id === variantId; });
    if (!v) return;
    var row = document.getElementById('cv-v-' + variantId);
    if (!row) return;
    var optsHtml = (v.options || []).map(function(o) {
      var p = o.price_cents > 0 ? ' +HK$' + (o.price_cents/100).toFixed(2) : o.price_cents < 0 ? ' -HK$' + (Math.abs(o.price_cents)/100).toFixed(2) : '';
      return '<span class="cv-opt-chip" data-oid="' + o.id + '" data-vid="' + v.id + '">'
        + escHtml(o.name) + p
        + ' <button type="button" class="cv-opt-edit" onclick="consoleEditVariantOpt(' + o.id + ',' + v.id + ',' + itemId + ')" title="Edit option">\u270e</button>'
        + ' <button type="button" class="cv-opt-del" onclick="consoleDeleteVariantOpt(' + o.id + ',' + v.id + ',' + itemId + ')">&#x2715;</button></span>';
    }).join('');
    row.innerHTML = '<div style="background:#fff9e6;border:1px solid #fde68a;border-radius:6px;padding:8px;margin-bottom:4px;">'
      + '<div style="display:grid;grid-template-columns:1fr auto auto auto;gap:6px;align-items:center;margin-bottom:6px;">'
      + '<input type="text" class="console-input" id="cv-edit-v-name-' + variantId + '" value="' + escHtml(v.name) + '" />'
      + '<input type="number" class="console-input" id="cv-edit-v-min-' + variantId + '" value="' + (v.min_select != null ? v.min_select : '') + '" placeholder="Min" style="width:60px;" />'
      + '<input type="number" class="console-input" id="cv-edit-v-max-' + variantId + '" value="' + (v.max_select != null ? v.max_select : '') + '" placeholder="Max" style="width:60px;" />'
      + '<label style="display:flex;align-items:center;gap:4px;font-size:12px;white-space:nowrap;"><input type="checkbox" id="cv-edit-v-req-' + variantId + '"' + (v.required ? ' checked' : '') + ' /> Req</label>'
      + '</div>'
      + '<div style="display:flex;gap:6px;margin-bottom:8px;">'
      + '<button type="button" class="console-btn console-btn-sm console-btn-primary" onclick="consoleSaveEditVariant(' + variantId + ',' + itemId + ')">Save</button>'
      + '<button type="button" class="console-btn console-btn-sm" onclick="consoleRenderItemVariants(' + itemId + ')">Cancel</button>'
      + '</div>'
      + '<div class="cv-opts-wrap" id="cv-opts-' + variantId + '" style="margin-bottom:6px;">' + (optsHtml || '<span style="font-size:11px;color:#9ca3af;">No options</span>') + '</div>'
      + '<div>'
      + '<button type="button" class="console-btn console-btn-sm" onclick="consoleShowAddOptForm(' + variantId + ',' + itemId + ')">&#xFF0B; Add Option</button>'
      + '<div class="cv-opt-form" id="cv-opt-form-' + variantId + '" style="display:none;margin-top:6px;">'
      + '<input type="text" class="console-input" id="cv-opt-name-' + variantId + '" placeholder="Option name" style="width:120px;margin-right:4px;" />'
      + '<input type="number" class="console-input" id="cv-opt-price-' + variantId + '" placeholder="Price \xb1cents" style="width:80px;margin-right:4px;" />'
      + '<button type="button" class="console-btn console-btn-sm console-btn-primary" onclick="consoleSaveNewOpt(' + variantId + ',' + itemId + ')">Add</button>'
      + '<button type="button" class="console-btn console-btn-sm" onclick="document.getElementById(\'cv-opt-form-' + variantId + '\').style.display=\'none\'">Cancel</button>'
      + '</div></div>'
      + '</div>';
  };

  window.consoleSaveEditVariant = async function(variantId, itemId) {
    var name = (document.getElementById('cv-edit-v-name-' + variantId) || {}).value.trim();
    var min = parseInt((document.getElementById('cv-edit-v-min-' + variantId) || {}).value) || null;
    var max = parseInt((document.getElementById('cv-edit-v-max-' + variantId) || {}).value) || null;
    var req = !!(document.getElementById('cv-edit-v-req-' + variantId) || {}).checked;
    if (!name) { toast('Variant name required', 'error'); return; }
    try {
      var updated = await api('PATCH', '/variants/' + variantId, { name, min_select: min, max_select: max, required: req });
      var idx = _consoleItemVariants.findIndex(function(x) { return x.id === variantId; });
      if (idx !== -1) Object.assign(_consoleItemVariants[idx], updated, { options: _consoleItemVariants[idx].options });
      consoleRenderItemVariants(itemId);
    } catch(e) { toast('Failed to update variant', 'error'); }
  };

  window.consoleSaveNewOpt = async function(variantId, itemId) {
    var name = (document.getElementById('cv-opt-name-' + variantId) || {}).value.trim();
    var price = parseInt((document.getElementById('cv-opt-price-' + variantId) || {}).value) || 0;
    if (!name) { toast('Option name required', 'error'); return; }
    try {
      var opt = await api('POST', '/variants/' + variantId + '/options', { name, price_cents: price });
      var v = _consoleItemVariants.find(function(x) { return x.id === variantId; });
      if (v) { if (!v.options) v.options = []; v.options.push(opt); }
      consoleRenderItemVariants(itemId);
    } catch(e) { toast('Failed to add option', 'error'); }
  };

  window.consoleEditVariantOpt = function(optId, variantId, itemId) {
    var v = _consoleItemVariants.find(function(x) { return x.id === variantId; });
    if (!v) return;
    var o = (v.options || []).find(function(x) { return x.id === optId; });
    if (!o) return;
    var wrap = document.getElementById('cv-opts-' + variantId);
    if (!wrap) return;
    var chip = wrap.querySelector('[data-oid="' + optId + '"]');
    if (!chip) return;
    chip.outerHTML = '<span class="cv-opt-chip cv-opt-chip--editing" data-oid="' + optId + '" data-vid="' + variantId + '">'
      + '<input type="text" class="console-input" id="cv-oe-name-' + optId + '" value="' + escHtml(o.name) + '" style="width:90px;height:22px;padding:2px 4px;font-size:11px;" />'
      + '<input type="number" class="console-input" id="cv-oe-price-' + optId + '" value="' + (o.price_cents || 0) + '" placeholder="\xb1cents" style="width:70px;height:22px;padding:2px 4px;font-size:11px;" />'
      + '<button type="button" class="cv-opt-edit" onclick="consoleSaveEditVariantOpt(' + optId + ',' + variantId + ',' + itemId + ')" style="color:#16a34a;">\u2713</button>'
      + '<button type="button" class="cv-opt-del" onclick="consoleRenderItemVariants(' + itemId + ')">&#x2715;</button>'
      + '</span>';
    var nameInput = document.getElementById('cv-oe-name-' + optId);
    if (nameInput) nameInput.focus();
  };

  window.consoleSaveEditVariantOpt = async function(optId, variantId, itemId) {
    var name = (document.getElementById('cv-oe-name-' + optId) || {}).value.trim();
    var price = parseInt((document.getElementById('cv-oe-price-' + optId) || {}).value) || 0;
    if (!name) { toast('Option name required', 'error'); return; }
    try {
      var updated = await api('PATCH', '/variant-options/' + optId, { name, price_cents: price });
      var v = _consoleItemVariants.find(function(x) { return x.id === variantId; });
      if (v) {
        var idx = (v.options || []).findIndex(function(x) { return x.id === optId; });
        if (idx !== -1) Object.assign(v.options[idx], updated);
      }
      consoleRenderItemVariants(itemId);
    } catch(e) { toast('Failed to update option', 'error'); }
  };

  window.consoleApplyVariantPreset = async function(itemId) {
    var sel = document.getElementById('cv-vpreset-sel');
    var presetId = sel ? parseInt(sel.value) : 0;
    if (!presetId) { toast('Select a variant preset first', 'error'); return; }
    try {
      var [preset, options] = await Promise.all([
        api('GET', '/restaurants/' + restaurantId + '/variant-presets/' + presetId),
        api('GET', '/restaurants/' + restaurantId + '/variant-presets/' + presetId + '/options')
      ]);
      var newVariant = await api('POST', '/menu-items/' + itemId + '/variants', {
        name: preset.name,
        required: false,
        min_select: null,
        max_select: null
      });
      var variantWithOpts = Object.assign({ options: [] }, newVariant);
      for (var i = 0; i < (options || []).length; i++) {
        var opt = await api('POST', '/variants/' + newVariant.id + '/options', {
          name: options[i].name,
          price_cents: options[i].price_cents
        });
        variantWithOpts.options.push(opt);
      }
      _consoleItemVariants.push(variantWithOpts);
      consoleRenderItemVariants(itemId);
      toast('Variant preset applied');
    } catch(e) { toast('Failed to apply variant preset', 'error'); }
  };

  window.consoleDeleteVariantOpt = async function(optionId, variantId, itemId) {
    try {
      await api('DELETE', '/variant-options/' + optionId);
      var v = _consoleItemVariants.find(function(x) { return x.id === variantId; });
      if (v) v.options = (v.options || []).filter(function(o) { return o.id !== optionId; });
      consoleRenderItemVariants(itemId);
    } catch(e) { toast('Failed to delete option', 'error'); }
  };

  window.consoleSaveItem = async function () {
    var id = document.getElementById('modal-item-id').value;
    var name = document.getElementById('modal-item-name').value.trim();
    var name_zh = document.getElementById('modal-item-name-zh').value.trim() || null;
    var desc = document.getElementById('modal-item-desc').value.trim();
    var priceHkd = parseFloat(document.getElementById('modal-item-price').value) || 0;
    var price_cents = Math.round(priceHkd * 100);
    var catId = document.getElementById('modal-item-category').value;
    var comboChk = document.getElementById('modal-item-is-combo');
    var isCombo = comboChk ? comboChk.checked : false;
    if (!name) { toast('Item name is required', 'error'); return; }
    var addonPresetSel = document.getElementById('modal-item-addon-preset');
    var addon_preset_id = addonPresetSel ? (parseInt(addonPresetSel.value) || null) : null;
    try {
      if (id) {
        var body = { name: name, name_zh: name_zh, description: desc, price_cents: price_cents, category_id: parseInt(catId), is_meal_combo: isCombo, restaurantId: restaurantId, addon_preset_id: addon_preset_id };
        await api('PATCH', '/menu-items/' + id, body);
        toast('Item updated');
      } else {
        var body = { name: name, name_zh: name_zh, description: desc, price_cents: price_cents, category_id: parseInt(catId), is_meal_combo: isCombo };
        await api('POST', '/restaurants/' + restaurantId + '/menu-items', body);
        toast('Item created');
      }
      consoleCloseModal('modal-item');
      _sectionLoaded.menu = false;
      consoleLoadMenu().then(function () {
        if (_menuSelectedCatId) consoleSelectCategory(_menuSelectedCatId, '');
      });
    } catch (e) {
      toast(e.message || 'Failed to save item', 'error');
    }
  };

  window.consoleDeleteItem = async function (id, name) {
    if (!confirm('Delete "' + name + '"?')) return;
    try {
      await api('DELETE', '/menu-items/' + id, { restaurantId: restaurantId });
      toast('Item deleted');
      _menuItems = _menuItems.filter(function (i) { return i.id !== id; });
      if (_menuSelectedCatId) renderMenuItems(_menuSelectedCatId, '');
    } catch (e) {
      toast(e.message || 'Failed to delete', 'error');
    }
  };

  /* ═══════════════════════════════════════════════════════
     TABLE MANAGEMENT
  ═══════════════════════════════════════════════════════ */
  var _tableZones = [];
  var _tableStateMap = {}; // table_id -> {session_id, pax, started_at}

  window.consoleLoadTables = async function () {
    var container = document.getElementById('tables-zones-container');
    if (!container) return;
    if (Object.keys(_tableStateMap).length === 0) {
      container.innerHTML = '<div class="console-empty">Loading…</div>';
    }
    try {
      var [zones, tables, stateRows] = await Promise.all([
        api('GET', '/restaurants/' + restaurantId + '/table-categories'),
        api('GET', '/restaurants/' + restaurantId + '/tables'),
        api('GET', '/restaurants/' + restaurantId + '/table-state')
      ]);
      var zoneList = Array.isArray(zones) ? zones : [];
      var tableList = Array.isArray(tables) ? tables : [];
      var stateList = Array.isArray(stateRows) ? stateRows : [];
      // Build table state lookup by table_id (keep first occupied row per table)
      _tableStateMap = {};
      stateList.forEach(function(row) {
        if (row.session_id && !_tableStateMap[row.table_id]) {
          _tableStateMap[row.table_id] = row;
        }
      });
      _tableZones = zoneList.map(function (z) {
        return Object.assign({}, z, {
          tables: tableList.filter(function (t) { return String(t.category_id) === String(z.id); })
        });
      });
      renderTableZones();
      var ts = document.getElementById('tables-last-refresh');
      if (ts) ts.textContent = 'Updated ' + new Date().toLocaleTimeString();
    } catch (e) {
      container.innerHTML = '<div class="console-empty" style="color:#e74c3c;">Failed to load tables.</div>';
    }
  };

  function renderTableZones() {
    var container = document.getElementById('tables-zones-container');
    if (!container) return;
    if (_tableZones.length === 0) {
      container.innerHTML = '<div class="console-empty">No zones or tables yet. Add a zone to get started.</div>';
      return;
    }
    container.innerHTML = _tableZones.map(function (zone) {
      var tables = Array.isArray(zone.tables) ? zone.tables : [];
      var tablesHtml = tables.map(function (t) {
        var state = _tableStateMap[t.id];
        var statusBadge = state
          ? '<div class="console-table-status occupied">● ' + (state.pax ? state.pax + ' pax' : 'Occupied') + '</div>'
          : '<div class="console-table-status available">● Available</div>';
        return '<div class="console-table-cell">'
          + '<div class="console-table-name">' + escHtml(t.name || t.label || '') + '</div>'
          + '<div class="console-table-cap">cap. ' + (t.seat_count || '—') + '</div>'
          + statusBadge
          + '<div class="console-table-actions">'
          + '<button class="console-table-action-btn table-edit-btn" data-tid="' + t.id + '" data-tname="' + escHtml(t.name || t.label || '') + '" data-tcap="' + (t.seat_count || 4) + '" data-zoneid="' + zone.id + '">Edit</button>'
          + '<button class="console-table-action-btn table-del-btn" style="color:#dc2626;" data-tid="' + t.id + '" data-tname="' + escHtml(t.name || t.label || '') + '">Del</button>'
          + '</div></div>';
      }).join('');
      var addBtn = '<div class="console-table-cell" style="border-style:dashed;cursor:pointer;color:#9ca3af;" onclick="consoleOpenAddTableModal(' + zone.id + ')">'
        + '<div style="font-size:22px;margin-bottom:4px;">+</div>'
        + '<div style="font-size:11px;">Add Table</div>'
        + '</div>';
      return '<div class="console-zone-section" draggable="true" data-zoneid="' + zone.id + '">'
        + '<div class="console-zone-title">'
        + '<span class="console-zone-drag-handle" title="Drag to reorder zones">⠿</span>'
        + '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="vertical-align:-2px;margin-right:5px;"><rect x="3" y="3" width="18" height="4" rx="1"/><path d="M5 7v14M19 7v14"/></svg>'
        + escHtml(zone.key || zone.name || '') + ' '
        + '<button class="console-btn console-btn-sm zone-edit-btn" data-zoneid="' + zone.id + '" data-zonename="' + escHtml(zone.key || zone.name || '') + '">Edit Zone</button> '
        + '<button class="console-btn console-btn-sm console-btn-danger zone-del-btn" data-zoneid="' + zone.id + '" data-zonename="' + escHtml(zone.key || zone.name || '') + '">Delete Zone</button>'
        + '</div>'
        + '<div class="console-tables-grid">' + tablesHtml + addBtn + '</div>'
        + '</div>';
    }).join('');
    container.querySelectorAll('.table-edit-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        consoleOpenEditTableModal(parseInt(btn.dataset.tid), btn.dataset.tname, parseInt(btn.dataset.tcap), parseInt(btn.dataset.zoneid));
      });
    });
    container.querySelectorAll('.table-del-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        consoleDeleteTable(parseInt(btn.dataset.tid), btn.dataset.tname);
      });
    });
    container.querySelectorAll('.zone-edit-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        consoleOpenAddZoneModal(parseInt(btn.dataset.zoneid), btn.dataset.zonename);
      });
    });
    container.querySelectorAll('.zone-del-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        consoleDeleteZone(parseInt(btn.dataset.zoneid), btn.dataset.zonename);
      });
    });
    // Drag-and-drop reorder for zones
    (function() {
      var dragged = null;
      container.querySelectorAll('.console-zone-section').forEach(function(section) {
        section.addEventListener('dragstart', function(e) {
          // Only start drag from drag handle
          if (!e.target.closest('.console-zone-drag-handle')) { e.preventDefault(); return; }
          dragged = section;
          section.style.opacity = '0.5';
          e.dataTransfer.effectAllowed = 'move';
        });
        section.addEventListener('dragend', function() {
          dragged = null;
          section.style.opacity = '';
          container.querySelectorAll('.console-zone-section').forEach(function(s) { s.classList.remove('drag-over'); });
          // Save new order
          var cats = [];
          container.querySelectorAll('.console-zone-section[data-zoneid]').forEach(function(s, idx) {
            cats.push({ id: parseInt(s.dataset.zoneid), sort_order: idx });
          });
          api('PUT', '/restaurants/' + restaurantId + '/table-categories/reorder', { categories: cats })
            .catch(function(e) { console.warn('Zone reorder failed', e); });
        });
        section.addEventListener('dragover', function(e) {
          e.preventDefault();
          if (dragged && section !== dragged) {
            container.querySelectorAll('.console-zone-section').forEach(function(s) { s.classList.remove('drag-over'); });
            section.classList.add('drag-over');
            var rect = section.getBoundingClientRect();
            if (e.clientY < rect.top + rect.height / 2) {
              container.insertBefore(dragged, section);
            } else {
              container.insertBefore(dragged, section.nextSibling);
            }
          }
        });
        section.addEventListener('drop', function(e) {
          e.preventDefault();
          section.classList.remove('drag-over');
        });
      });
    }());
  }

  /* ── Zone CRUD ── */
  window.consoleOpenAddZoneModal = function (id, name) {
    document.getElementById('modal-zone-title').textContent = id ? 'Edit Zone' : 'Add Zone';
    document.getElementById('modal-zone-id').value = id || '';
    document.getElementById('modal-zone-name').value = name || '';
    openConsoleModal('modal-zone');
  };

  window.consoleSaveZone = async function () {
    var id = document.getElementById('modal-zone-id').value;
    var name = document.getElementById('modal-zone-name').value.trim();
    if (!name) { toast('Zone name is required', 'error'); return; }
    try {
      if (id) {
        await api('PUT', '/restaurants/' + restaurantId + '/table-categories/' + id, { name: name });
        toast('Zone updated');
      } else {
        await api('POST', '/restaurants/' + restaurantId + '/table-categories', { name: name });
        toast('Zone created');
      }
      consoleCloseModal('modal-zone');
      _sectionLoaded.tables = false;
      consoleLoadTables();
    } catch (e) {
      toast(e.message || 'Failed to save zone', 'error');
    }
  };

  window.consoleDeleteZone = async function (id, name) {
    if (!confirm('Delete zone "' + name + '"? All tables in this zone will also be deleted.')) return;
    try {
      await api('DELETE', '/restaurants/' + restaurantId + '/table-categories/' + id);
      toast('Zone deleted');
      _sectionLoaded.tables = false;
      consoleLoadTables();
    } catch (e) {
      toast(e.message || 'Failed to delete zone', 'error');
    }
  };

  /* ── Table CRUD ── */
  window.consoleOpenAddTableModal = function (zoneId) {
    document.getElementById('modal-table-title').textContent = 'Add Table';
    document.getElementById('modal-table-id').value = '';
    document.getElementById('modal-table-name').value = '';
    document.getElementById('modal-table-capacity').value = 4;
    populateZoneSelect(zoneId);
    openConsoleModal('modal-table');
  };

  window.consoleOpenEditTableModal = function (tableId, tableName, capacity, zoneId) {
    document.getElementById('modal-table-title').textContent = 'Edit Table';
    document.getElementById('modal-table-id').value = tableId;
    document.getElementById('modal-table-name').value = tableName;
    document.getElementById('modal-table-capacity').value = capacity;
    populateZoneSelect(zoneId);
    openConsoleModal('modal-table');
  };

  function populateZoneSelect(selectedZoneId) {
    var sel = document.getElementById('modal-table-zone');
    sel.innerHTML = _tableZones.map(function (z) {
      return '<option value="' + z.id + '"' + (String(z.id) === String(selectedZoneId) ? ' selected' : '') + '>' + escHtml(z.key || z.name || '') + '</option>';
    }).join('');
  }

  window.consoleSaveTable = async function () {
    var id = document.getElementById('modal-table-id').value;
    var name = document.getElementById('modal-table-name').value.trim();
    var capacity = parseInt(document.getElementById('modal-table-capacity').value) || 4;
    var zoneId = document.getElementById('modal-table-zone').value;
    if (!name) { toast('Table name is required', 'error'); return; }
    try {
      var body = { name: name, capacity: capacity, category_id: parseInt(zoneId) };
      if (id) {
        await api('PUT', '/tables/' + id, body);
        toast('Table updated');
      } else {
        await api('POST', '/restaurants/' + restaurantId + '/tables', body);
        toast('Table created');
      }
      consoleCloseModal('modal-table');
      _sectionLoaded.tables = false;
      consoleLoadTables();
    } catch (e) {
      toast(e.message || 'Failed to save table', 'error');
    }
  };

  window.consoleDeleteTable = async function (id, name) {
    if (!confirm('Delete table "' + name + '"?')) return;
    try {
      await api('DELETE', '/restaurants/' + restaurantId + '/tables/' + id);
      toast('Table deleted');
      _sectionLoaded.tables = false;
      consoleLoadTables();
    } catch (e) {
      toast(e.message || 'Failed to delete table', 'error');
    }
  };

  /* ═══════════════════════════════════════════════════════
     CRM
  ═══════════════════════════════════════════════════════ */
  var _crmMemPage = 1;
  var _crmMemSearchTimer = null;

  /* ── Members ── */
  window.consoleDebounceCrmMembers = function () {
    clearTimeout(_crmMemSearchTimer);
    _crmMemSearchTimer = setTimeout(function () { _crmMemPage = 1; consoleLoadCrmMembers(); }, 350);
  };

  window.consoleLoadCrmMembers = async function () {
    var tbody = document.getElementById('crm-members-body');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="9" class="console-empty">Loading…</td></tr>';
    var search = (document.getElementById('crm-mem-search') || {}).value || '';
    var tier = (document.getElementById('crm-mem-tier') || {}).value || '';
    var pageSize = 30;
    var qs = '?limit=' + pageSize + '&page=' + _crmMemPage;
    if (search.trim()) qs += '&search=' + encodeURIComponent(search.trim());
    if (tier) qs += '&tier=' + encodeURIComponent(tier);
    try {
      var data = await api('GET', '/restaurants/' + restaurantId + '/xish/members' + qs);
      var items = Array.isArray(data) ? data : (data && Array.isArray(data.members) ? data.members : []);
      var total = data && data.total ? data.total : items.length;
      if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="console-empty">No members found.</td></tr>';
        return;
      }
      var tierColors = { platinum: '#7C3AED', gold: '#D97706', silver: '#6B7280', basic: '#374151' };
      tbody.innerHTML = items.map(function (m) {
        var joined = m.joined_at || m.registered_at || m.created_at;
        var joinedStr = joined ? new Date(joined).toLocaleDateString('zh-HK') : '—';
        var tc = tierColors[m.tier] || '#374151';
        var mid = m.xish_member_id || m.id;
        var memberId = m.xish_id || ('M-' + (m.crm_customer_id || m.id || ''));
        var spent = 'HK$' + ((m.total_spent_cents || 0) / 100).toFixed(0);
        var crmId = m.crm_customer_id || m.id;
        return '<tr style="cursor:pointer;" onclick="consoleMemberDetail(' + crmId + ')">'
          + '<td>' + escHtml(m.name || '—') + '</td>'
          + '<td style="font-size:11px;color:#6b7280;">' + escHtml(memberId) + '</td>'
          + '<td>' + escHtml(m.phone || '—') + '</td>'
          + '<td><span style="font-weight:600;color:' + tc + ';text-transform:capitalize;">' + (m.tier || '—') + '</span></td>'
          + '<td>' + (m.points_balance || 0) + '</td>'
          + '<td>' + joinedStr + '</td>'
          + '<td>' + spent + '</td>'
          + '<td>' + (m.total_visits || 0) + '</td>'
          + '<td style="white-space:nowrap;" onclick="event.stopPropagation();">'
          + '<button class="console-btn console-btn-sm crm-award-btn" data-mid="' + mid + '" data-mname="' + escHtml(m.name || '') + '" style="margin-right:4px;">+Pts</button>'
          + '<button class="console-btn console-btn-sm crm-edit-btn" data-mid="' + mid + '" data-mname="' + escHtml(m.name || '') + '" data-mphone="' + escHtml(m.phone || '') + '" data-mpts="' + (m.points_balance || 0) + '">Edit</button>'
          + '</td>'
          + '</tr>';
      }).join('');
      tbody.querySelectorAll('.crm-award-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          xaOpenAwardModal(parseInt(btn.dataset.mid), btn.dataset.mname);
        });
      });
      tbody.querySelectorAll('.crm-edit-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          xaOpenEditMember(parseInt(btn.dataset.mid), btn.dataset.mname, btn.dataset.mphone, parseInt(btn.dataset.mpts || '0'));
        });
      });

      // Pagination
      renderCrmMembersPagination(items.length >= pageSize);
    } catch (e) {
      tbody.innerHTML = '<tr><td colspan="9" class="console-empty" style="color:#e74c3c;">Failed to load members.</td></tr>';
    }
  };

  function renderCrmMembersPagination(hasMore) {
    var pag = document.getElementById('crm-members-pagination');
    if (!pag) return;
    var html = '';
    if (_crmMemPage > 1) html += '<button class="console-page-btn" onclick="consoleCrmMemPrev()">← Prev</button>';
    html += '<span class="console-page-btn active">' + _crmMemPage + '</span>';
    if (hasMore) html += '<button class="console-page-btn" onclick="consoleCrmMemNext()">Next →</button>';
    pag.innerHTML = html;
  }

  window.consoleCrmMemPrev = function () {
    if (_crmMemPage > 1) { _crmMemPage--; consoleLoadCrmMembers(); }
  };
  window.consoleCrmMemNext = function () {
    _crmMemPage++;
    consoleLoadCrmMembers();
  };

  /* ─── Escape HTML helper ─────────────────────────────── */
  function escHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ─── Queue Management ───────────────────────────────── */
  var _queueSettings = null;
  var _editingBandIdx = null;

  window.consoleLoadQueue = async function () {
    try {
      var data = await api('GET', '/restaurants/' + restaurantId + '/queue/settings');
      _queueSettings = data;
      var toggle = document.getElementById('queue-enabled-toggle');
      if (toggle) toggle.checked = !!data.enabled;
      var qrUrl = window.location.origin + '/queue/' + data.queue_qr_token;
      var qrUrlEl = document.getElementById('queue-qr-url');
      if (qrUrlEl) qrUrlEl.textContent = qrUrl;
      // Render QR code image
      var qrContainer = document.getElementById('queue-qr-container');
      if (qrContainer) {
        qrContainer.innerHTML = '';
        if (typeof QRCode !== 'undefined') {
          try {
            new QRCode(qrContainer, { text: qrUrl, width: 180, height: 180, correctLevel: QRCode.CorrectLevel.M });
          } catch (e) {
            qrContainer.innerHTML = '<p style="font-size:11px;color:#9ca3af;word-break:break-all;max-width:180px;">' + escHtml(qrUrl) + '</p>';
          }
        } else {
          qrContainer.innerHTML = '<p style="font-size:11px;color:#9ca3af;word-break:break-all;max-width:180px;">' + escHtml(qrUrl) + '</p>';
        }
      }
      renderQueueBands(data.pax_bands || []);
      consoleLoadLiveQueue();
    } catch (e) {
      console.error('[Queue]', e);
    }
  };

  window.consolePrintQueueQR = function () {
    var url = document.getElementById('queue-qr-url') ? document.getElementById('queue-qr-url').textContent.trim() : '';
    var container = document.getElementById('queue-qr-container');
    var canvas = container ? container.querySelector('canvas') : null;
    if (!canvas) { toast('QR not ready — please wait and try again', 'error'); return; }
    var imgData = canvas.toDataURL('image/png');
    var win = window.open('', '_blank', 'width=420,height=560');
    if (!win) { toast('Popup blocked — allow popups to print', 'error'); return; }
    win.document.write(
      '<html><head><title>Queue QR</title></head>'
      + '<body style="text-align:center;font-family:sans-serif;padding:32px">'
      + '<img src="' + imgData + '" width="240" height="240" style="display:block;margin:0 auto" />'
      + '<p style="font-size:13px;color:#555;margin-top:14px;word-break:break-all;">' + escHtml(url) + '</p>'
      + '<script>window.onload=function(){window.print();window.close()}<\/script>'
      + '</body></html>'
    );
    win.document.close();
  };

  window.consoleToggleQueueEnabled = async function (chk) {
    try {
      await api('PUT', '/restaurants/' + restaurantId + '/queue/settings', { enabled: chk.checked });
      toast(chk.checked ? 'Queue enabled' : 'Queue disabled');
    } catch (e) {
      toast('Failed to update queue status', 'error');
    }
  };

  function renderQueueBands(bands) {
    var tbody = document.getElementById('queue-bands-body');
    if (!tbody) return;
    if (!bands.length) { tbody.innerHTML = '<tr><td colspan="4" class="console-empty">No bands configured</td></tr>'; return; }
    tbody.innerHTML = bands.map(function (b, i) {
      return '<tr><td>' + escHtml(b.label) + '</td><td>' + b.min + '</td><td>' + b.max + '</td>'
        + '<td><button class="console-btn console-btn-sm" onclick="consoleEditBand(' + i + ')">Edit</button> '
        + '<button class="console-btn console-btn-sm" style="color:#e74c3c" onclick="consoleDeleteBand(' + i + ')">Del</button></td></tr>';
    }).join('');
  }

  window.consoleOpenAddBandModal = function () {
    _editingBandIdx = null;
    document.getElementById('modal-queue-band-title').textContent = 'Add Pax Band';
    document.getElementById('band-label-input').value = '';
    document.getElementById('band-min-input').value = '';
    document.getElementById('band-max-input').value = '';
    document.getElementById('modal-queue-band').style.display = 'flex';
  };

  window.consoleEditBand = function (idx) {
    _editingBandIdx = idx;
    var b = _queueSettings.pax_bands[idx];
    document.getElementById('modal-queue-band-title').textContent = 'Edit Pax Band';
    document.getElementById('band-label-input').value = b.label;
    document.getElementById('band-min-input').value = b.min;
    document.getElementById('band-max-input').value = b.max;
    document.getElementById('modal-queue-band').style.display = 'flex';
  };

  window.consoleSaveQueueBand = async function () {
    var label = document.getElementById('band-label-input').value.trim();
    var min = parseInt(document.getElementById('band-min-input').value, 10);
    var max = parseInt(document.getElementById('band-max-input').value, 10);
    if (!label || isNaN(min) || isNaN(max) || min < 1 || max < min) { toast('Please fill all fields correctly', 'error'); return; }
    var bands = JSON.parse(JSON.stringify(_queueSettings.pax_bands || []));
    if (_editingBandIdx !== null) { bands[_editingBandIdx] = { min: min, max: max, label: label }; }
    else { bands.push({ min: min, max: max, label: label }); }
    try {
      var data = await api('PUT', '/restaurants/' + restaurantId + '/queue/settings', { pax_bands: bands });
      _queueSettings = data;
      renderQueueBands(data.pax_bands);
      consoleCloseModal('modal-queue-band');
      toast('Saved');
    } catch (e) {
      toast('Failed to save band', 'error');
    }
  };

  window.consoleDeleteBand = async function (idx) {
    if (!confirm('Delete this pax band?')) return;
    var bands = JSON.parse(JSON.stringify(_queueSettings.pax_bands || []));
    bands.splice(idx, 1);
    try {
      var data = await api('PUT', '/restaurants/' + restaurantId + '/queue/settings', { pax_bands: bands });
      _queueSettings = data;
      renderQueueBands(data.pax_bands);
      toast('Deleted');
    } catch (e) {
      toast('Failed to delete band', 'error');
    }
  };

  window.consoleLoadLiveQueue = async function () {
    var tbody = document.getElementById('queue-live-body');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" class="console-empty">Loading…</td></tr>';
    try {
      var entries = await api('GET', '/restaurants/' + restaurantId + '/queue?status=waiting,called');
      if (!entries || !entries.length) { tbody.innerHTML = '<tr><td colspan="6" class="console-empty">Queue is empty</td></tr>'; return; }
      tbody.innerHTML = entries.map(function (e) {
        var wait = Math.round((Date.now() - new Date(e.created_at).getTime()) / 60000);
        var statusColor = e.status === 'called' ? '#d97706' : '#16a34a';
        return '<tr>'
          + '<td><strong style="color:#A10035;font-size:18px;">#' + e.queue_number + '</strong></td>'
          + '<td>' + e.pax + '</td>'
          + '<td>' + escHtml(e.pax_band_label || '') + '</td>'
          + '<td><span style="color:' + statusColor + ';font-weight:600;text-transform:capitalize;">' + e.status + '</span></td>'
          + '<td>' + wait + ' min</td>'
          + '<td style="white-space:nowrap;">'
          + (e.status === 'waiting' ? '<button class="console-btn console-btn-sm" style="background:#f59e0b;color:#fff;margin-right:4px;" onclick="consoleCallQueueEntry(' + e.id + ')">Call</button>' : '')
          + '<button class="console-btn console-btn-sm" style="background:#16a34a;color:#fff;margin-right:4px;" onclick="consoleSeatQueueEntry(' + e.id + ')">Seat</button>'
          + '<button class="console-btn console-btn-sm" onclick="consoleCancelQueueEntry(' + e.id + ')">Remove</button>'
          + '</td></tr>';
      }).join('');
    } catch (e) {
      tbody.innerHTML = '<tr><td colspan="6" class="console-empty">Failed to load queue</td></tr>';
    }
  };

  window.consoleCallQueueEntry = async function (id) {
    try { await api('POST', '/restaurants/' + restaurantId + '/queue/' + id + '/call', {}); consoleLoadLiveQueue(); }
    catch (e) { toast('Failed to call entry', 'error'); }
  };

  window.consoleSeatQueueEntry = async function (id) {
    try { await api('POST', '/restaurants/' + restaurantId + '/queue/' + id + '/seat', {}); consoleLoadLiveQueue(); }
    catch (e) { toast('Failed to seat entry', 'error'); }
  };

  window.consoleCancelQueueEntry = async function (id) {
    if (!confirm('Remove this entry from queue?')) return;
    try { await api('DELETE', '/restaurants/' + restaurantId + '/queue/' + id); consoleLoadLiveQueue(); }
    catch (e) { toast('Failed to remove entry', 'error'); }
  };

  /* ═══════════════════════════════════════════════════════
     COUPONS
  ═══════════════════════════════════════════════════════ */
  var _allCoupons = [];

  window.consoleLoadCoupons = async function () {
    var tbody = document.getElementById('coupons-table-body');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="11" class="console-empty">Loading…</td></tr>';
    try {
      var coupons = await api('GET', '/restaurants/' + restaurantId + '/coupons');
      _allCoupons = Array.isArray(coupons) ? coupons : [];
      if (_allCoupons.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" class="console-empty">No voucher codes yet.</td></tr>';
        return;
      }
      tbody.innerHTML = _allCoupons.map(function (c) {
        var disc = c.discount_type === 'percentage' ? c.discount_value + '%' : 'HK$' + c.discount_value;
        var minOrder = c.minimum_order_value ? 'HK$' + c.minimum_order_value : '—';
        var uses = (c.current_uses || 0) + (c.max_uses ? ' / ' + c.max_uses : '');
        var from = c.valid_from ? c.valid_from.slice(0, 10) : '—';
        var until = c.valid_until ? c.valid_until.slice(0, 10) : '—';
        var active = c.is_active !== false ? '<span style="color:#16a34a;font-weight:600;">Active</span>' : '<span style="color:#9ca3af;">Inactive</span>';
        return '<tr>'
          + '<td><strong>' + escHtml(c.code) + '</strong></td>'
          + '<td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#6b7280;font-size:12px;">' + (c.description ? escHtml(c.description) : '<span style="color:#d1d5db">—</span>') + '</td>'
          + '<td>' + (c.discount_type || '') + '</td>'
          + '<td>' + disc + '</td>'
          + '<td>' + minOrder + '</td>'
          + '<td>' + uses + '</td>'
          + '<td>' + from + '</td>'
          + '<td>' + until + '</td>'
          + '<td>' + escHtml(c.coupon_type || 'open') + '</td>'
          + '<td>' + active + '</td>'
          + '<td style="white-space:nowrap;">'
          + '<button class="console-btn console-btn-sm" onclick="consoleOpenCouponModal(' + c.id + ')" style="margin-right:4px;">Edit</button>'
          + '<button class="console-btn console-btn-sm console-btn-danger coupon-del-btn" data-id="' + c.id + '" data-code="' + escHtml(c.code) + '">Del</button>'
          + '</td></tr>';
      }).join('');
      tbody.querySelectorAll('.coupon-del-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          consoleDeleteCoupon(parseInt(btn.dataset.id), btn.dataset.code);
        });
      });
    } catch (e) {
      tbody.innerHTML = '<tr><td colspan="11" class="console-empty" style="color:#e74c3c;">Failed to load voucher codes.</td></tr>';
    }
  };

  window.consoleOpenCouponModal = function (id) {
    document.getElementById('modal-coupon-title').textContent = id ? 'Edit Voucher Code' : 'Add Voucher Code';
    document.getElementById('modal-coupon-id').value = id || '';
    if (id) {
      var c = _allCoupons.find(function (x) { return x.id === id; });
      if (c) {
        document.getElementById('modal-coupon-code').value = c.code || '';
        document.getElementById('modal-coupon-discount-type').value = c.discount_type || 'percentage';
        document.getElementById('modal-coupon-discount-value').value = c.discount_value || '';
        document.getElementById('modal-coupon-min-order').value = c.minimum_order_value || '';
        document.getElementById('modal-coupon-max-uses').value = c.max_uses || '';
        document.getElementById('modal-coupon-valid-from').value = c.valid_from ? c.valid_from.slice(0, 10) : '';
        document.getElementById('modal-coupon-valid-until').value = c.valid_until ? c.valid_until.slice(0, 10) : '';
        document.getElementById('modal-coupon-type').value = c.coupon_type || 'open';
        document.getElementById('modal-coupon-description').value = c.description || '';
      }
    } else {
      document.getElementById('modal-coupon-code').value = '';
      document.getElementById('modal-coupon-discount-type').value = 'percentage';
      document.getElementById('modal-coupon-discount-value').value = '';
      document.getElementById('modal-coupon-min-order').value = '';
      document.getElementById('modal-coupon-max-uses').value = '';
      document.getElementById('modal-coupon-valid-from').value = '';
      document.getElementById('modal-coupon-valid-until').value = '';
      document.getElementById('modal-coupon-type').value = 'open';
      document.getElementById('modal-coupon-description').value = '';
    }
    openConsoleModal('modal-coupon');
  };

  window.consoleSaveCoupon = async function () {
    var id = document.getElementById('modal-coupon-id').value;
    var code = document.getElementById('modal-coupon-code').value.trim().toUpperCase();
    var discountType = document.getElementById('modal-coupon-discount-type').value;
    var discountValue = parseFloat(document.getElementById('modal-coupon-discount-value').value);
    var minOrder = parseFloat(document.getElementById('modal-coupon-min-order').value) || 0;
    var maxUsesRaw = document.getElementById('modal-coupon-max-uses').value;
    var maxUses = maxUsesRaw ? parseInt(maxUsesRaw) : null;
    var validFrom = document.getElementById('modal-coupon-valid-from').value || null;
    var validUntil = document.getElementById('modal-coupon-valid-until').value || null;
    var couponType = document.getElementById('modal-coupon-type').value;
    var description = document.getElementById('modal-coupon-description').value.trim();
    if (!code) { toast('Voucher code is required', 'error'); return; }
    if (isNaN(discountValue) || discountValue <= 0) { toast('Please enter a valid discount value', 'error'); return; }
    var body = { code: code, discount_type: discountType, discount_value: discountValue, minimum_order_value: minOrder, max_uses: maxUses, valid_from: validFrom, valid_until: validUntil, coupon_type: couponType, description: description };
    try {
      if (id) {
        await api('PUT', '/coupons/' + id, body);
        toast('Voucher code updated');
      } else {
        await api('POST', '/restaurants/' + restaurantId + '/coupons', body);
        toast('Voucher code created');
      }
      consoleCloseModal('modal-coupon');
      consoleLoadCoupons();
    } catch (e) {
      toast(e.message || 'Failed to save voucher code', 'error');
    }
  };

  window.consoleDeleteCoupon = async function (id, code) {
    if (!confirm('Delete voucher code "' + code + '"?')) return;
    try {
      await api('DELETE', '/coupons/' + id);
      toast('Voucher code deleted');
      consoleLoadCoupons();
    } catch (e) {
      toast(e.message || 'Failed to delete voucher code', 'error');
    }
  };

  /* ═══════════════════════════════════════════════════════
     REWARD CATALOG (points-redeemable coupons & gifts)
  ═══════════════════════════════════════════════════════ */
  var _allRewards = [];

  window.csLoadRewards = async function () {
    var tbody = document.getElementById('rewards-table-body');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="8" class="console-empty">Loading…</td></tr>';
    try {
      _allRewards = await api('GET', '/restaurants/' + restaurantId + '/xish/gift-settings');
      if (!Array.isArray(_allRewards) || !_allRewards.length) {
        tbody.innerHTML = '<tr><td colspan="8" class="console-empty">No rewards yet.</td></tr>';
        return;
      }
      tbody.innerHTML = _allRewards.map(function (g) {
        var typeBadge = g.item_type === 'coupon'
          ? '<span style="background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;">COUPON</span>'
          : '<span style="background:#dcfce7;color:#166534;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;">GIFT</span>';
        var discount = g.discount_percent ? g.discount_percent + '% off' : '—';
        var expires = g.redemption_end ? g.redemption_end.slice(0, 10) : '—';
        var active = g.is_active !== false
          ? '<span style="color:#16a34a;font-weight:600;">Active</span>'
          : '<span style="color:#9ca3af;">Inactive</span>';
        return '<tr>'
          + '<td>' + escHtml(g.item_name) + '</td>'
          + '<td>' + typeBadge + '</td>'
          + '<td>' + (g.points_cost || 0) + ' pts</td>'
          + '<td>' + discount + '</td>'
          + '<td style="max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escHtml(g.description || '') + '</td>'
          + '<td>' + expires + '</td>'
          + '<td>' + active + '</td>'
          + '<td>'
          + '<button class="console-btn-link" onclick="csOpenRewardModal(' + g.id + ')">Edit</button> '
          + '<button class="console-btn-link" style="color:#ef4444;" onclick="csDeleteReward(' + g.id + ',\'' + escHtml(g.item_name) + '\')">Delete</button>'
          + '</td></tr>';
      }).join('');
    } catch (e) {
      tbody.innerHTML = '<tr><td colspan="8" class="console-empty" style="color:#e74c3c;">Failed to load rewards.</td></tr>';
    }
  };

  window.csOpenRewardModal = function (id) {
    document.getElementById('modal-reward-title').textContent = id ? 'Edit Reward' : 'Add Reward';
    document.getElementById('modal-reward-id').value = id || '';
    if (id) {
      var g = _allRewards.find(function (x) { return x.id === id; });
      if (g) {
        document.getElementById('modal-reward-type').value = g.item_type || 'gift';
        document.getElementById('modal-reward-name').value = g.item_name || '';
        document.getElementById('modal-reward-description').value = g.description || '';
        document.getElementById('modal-reward-points-cost').value = g.points_cost || '';
        document.getElementById('modal-reward-discount').value = g.discount_percent || '';
        document.getElementById('modal-reward-image').value = g.image_url || '';
        document.getElementById('modal-reward-quantity').value = g.quantity || 1;
        document.getElementById('modal-reward-valid-until').value = g.redemption_end ? g.redemption_end.slice(0, 10) : '';
        csToggleRewardType(g.item_type || 'gift');
      }
    } else {
      document.getElementById('modal-reward-type').value = 'coupon';
      document.getElementById('modal-reward-name').value = '';
      document.getElementById('modal-reward-description').value = '';
      document.getElementById('modal-reward-points-cost').value = '';
      document.getElementById('modal-reward-discount').value = '';
      document.getElementById('modal-reward-image').value = '';
      document.getElementById('modal-reward-quantity').value = 1;
      document.getElementById('modal-reward-valid-until').value = '';
      csToggleRewardType('coupon');
    }
    openConsoleModal('modal-reward');
  };

  window.csToggleRewardType = function (type) {
    var discountGroup = document.getElementById('modal-reward-discount-group');
    if (discountGroup) discountGroup.style.display = type === 'coupon' ? '' : 'none';
  };

  window.csSaveReward = async function () {
    var id = document.getElementById('modal-reward-id').value;
    var body = {
      item_type: document.getElementById('modal-reward-type').value,
      item_name: document.getElementById('modal-reward-name').value.trim(),
      description: document.getElementById('modal-reward-description').value.trim() || null,
      points_cost: parseInt(document.getElementById('modal-reward-points-cost').value) || 0,
      discount_percent: parseFloat(document.getElementById('modal-reward-discount').value) || null,
      image_url: document.getElementById('modal-reward-image').value.trim() || null,
      quantity: parseInt(document.getElementById('modal-reward-quantity').value) || 1,
      redemption_end: document.getElementById('modal-reward-valid-until').value || null,
      is_active: true,
    };
    if (!body.item_name) { toast('Name is required', 'error'); return; }
    try {
      if (id) {
        await api('PATCH', '/restaurants/' + restaurantId + '/xish/gift-settings/' + id, body);
        toast('Reward updated');
      } else {
        await api('POST', '/restaurants/' + restaurantId + '/xish/gift-settings', body);
        toast('Reward created');
      }
      consoleCloseModal('modal-reward');
      csLoadRewards();
    } catch (e) {
      toast(e.message || 'Failed to save reward', 'error');
    }
  };

  window.csDeleteReward = async function (id, name) {
    if (!confirm('Delete reward "' + name + '"?')) return;
    try {
      await api('DELETE', '/restaurants/' + restaurantId + '/xish/gift-settings/' + id);
      toast('Reward deleted');
      csLoadRewards();
    } catch (e) {
      toast(e.message || 'Failed to delete reward', 'error');
    }
  };


  window.consoleMemberDetail = async function (customerId) {
    var modal = document.getElementById('modal-member-detail');
    var body = document.getElementById('modal-member-detail-body');
    if (!modal || !body) return;
    body.innerHTML = '<div class="console-empty">Loading…</div>';
    openConsoleModal('modal-member-detail');
    try {
      var data = await api('GET', '/restaurants/' + restaurantId + '/crm/customers/' + customerId);
      var c = data.customer || {};
      var orders = Array.isArray(data.orders) ? data.orders : [];
      var bookings = Array.isArray(data.future_bookings) ? data.future_bookings : [];
      var coupons = Array.isArray(data.eligible_coupons) ? data.eligible_coupons : [];
      var spent = 'HK$' + ((c.total_spent_cents || 0) / 100).toFixed(0);
      var lastVisit = c.last_visit_at ? new Date(c.last_visit_at).toLocaleDateString('zh-HK') : '—';

      var ordersHtml = orders.length === 0 ? '<p style="color:#9ca3af;font-size:13px;">No previous orders.</p>' :
        '<table class="console-table" style="font-size:12px;">'
        + '<thead><tr><th>#</th><th>Date</th><th>Type</th><th>Table</th><th>Amount</th><th>Status</th></tr></thead>'
        + '<tbody>' + orders.map(function (o) {
          var d = o.created_at ? new Date(o.created_at).toLocaleDateString('zh-HK') : '—';
          var amt = 'HK$' + ((o.total_cents || 0) / 100).toFixed(0);
          return '<tr style="cursor:pointer;" onclick="consoleViewOrder(' + o.order_id + ')">'
            + '<td>#' + (o.restaurant_order_number || o.order_id) + '</td>'
            + '<td>' + d + '</td>'
            + '<td>' + (o.order_type || '—') + '</td>'
            + '<td>' + escHtml(o.table_label || '—') + '</td>'
            + '<td>' + amt + '</td>'
            + '<td>' + (o.status || '—') + '</td>'
            + '</tr>';
        }).join('') + '</tbody></table>';

      var couponsHtml = coupons.length === 0 ? '<p style="color:#9ca3af;font-size:13px;">No eligible voucher codes.</p>' :
        coupons.map(function (cp) {
          var disc = cp.discount_type === 'percentage' ? cp.discount_value + '% off' : 'HK$' + cp.discount_value + ' off';
          return '<span style="display:inline-block;margin:3px;padding:3px 8px;background:#fef3c7;border:1px solid #fbbf24;border-radius:4px;font-size:12px;">' + escHtml(cp.code) + ' — ' + disc + '</span>';
        }).join('');

      body.innerHTML = '<div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:16px;">'
        + '<div style="flex:1;min-width:180px;background:#f9fafb;border-radius:8px;padding:14px;">'
        + '<div style="font-size:18px;font-weight:700;margin-bottom:6px;">' + escHtml(c.name || '—') + '</div>'
        + '<div style="font-size:12px;color:#6b7280;margin-bottom:2px;"><span style="color:#9ca3af;">ID</span>&nbsp; <strong>CIO-' + String(c.id).padStart(5, '0') + '</strong></div>'
        + '<div style="font-size:12px;color:#6b7280;margin-bottom:2px;"><span style="color:#9ca3af;">📞</span>&nbsp;' + escHtml(c.phone || '—') + '</div>'
        + (c.email ? '<div style="font-size:12px;color:#6b7280;margin-bottom:2px;"><span style="color:#9ca3af;">✉</span>&nbsp;' + escHtml(c.email) + '</div>' : '')
        + '<div style="font-size:12px;color:#6b7280;margin-bottom:2px;"><span style="color:#9ca3af;">Joined</span>&nbsp;' + (c.created_at ? new Date(c.created_at).toLocaleDateString('zh-HK') : '—') + '</div>'
        + (c.notes ? '<div style="font-size:12px;color:#6b7280;margin-top:6px;font-style:italic;">' + escHtml(c.notes) + '</div>' : '')
        + '</div>'
        + '<div style="flex:1;min-width:180px;background:#f9fafb;border-radius:8px;padding:14px;">'
        + '<div style="font-size:12px;color:#6b7280;">Total Spent</div><div style="font-size:16px;font-weight:600;">' + spent + '</div>'
        + '<div style="font-size:12px;color:#6b7280;margin-top:8px;">Visits</div><div style="font-size:16px;font-weight:600;">' + (c.total_visits || 0) + '</div>'
        + '<div style="font-size:12px;color:#6b7280;margin-top:8px;">Last Visit</div><div style="font-size:13px;">' + lastVisit + '</div>'
        + '</div>'
        + '</div>'
        + '<div style="margin-bottom:12px;"><strong style="font-size:13px;">Eligible Voucher Codes</strong><div style="margin-top:6px;">' + couponsHtml + '</div></div>'
        + '<div><strong style="font-size:13px;">Order History</strong><div style="margin-top:6px;">' + ordersHtml + '</div></div>';
    } catch (e) {
      body.innerHTML = '<div class="console-empty" style="color:#e74c3c;">Failed to load member profile.</div>';
    }
  };

  window.consoleViewOrder = async function (orderId) {
    var modal = document.getElementById('modal-order-detail');
    var body = document.getElementById('modal-order-detail-body');
    var title = document.getElementById('modal-order-detail-title');
    if (!modal || !body) return;
    body.innerHTML = '<div class="console-empty">Loading…</div>';
    modal.style.display = 'flex';
    try {
      var order = await api('GET', '/restaurants/' + restaurantId + '/orders/' + orderId);
      if (title) title.textContent = 'Order #' + (order.restaurant_order_number || order.id);
      var items = Array.isArray(order.items) ? order.items : [];
      var createdTime = order.created_at ? new Date(order.created_at).toLocaleString('en-HK', { timeZone: 'Asia/Hong_Kong', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
      var statusColors = { pending: '#3b82f6', completed: '#10b981', cancelled: '#ef4444' };
      var statusColor = statusColors[order.status] || '#6b7280';

      var itemsHtml = items.length === 0
        ? '<p style="color:#9ca3af;font-size:13px;text-align:center;padding:12px;">No items</p>'
        : items.map(function (it) {
            var addons = Array.isArray(it.addons) ? it.addons : [];
            var addonHtml = addons.map(function(a) {
              return '<div style="font-size:11px;color:#6b7280;padding-left:12px;">+ ' + escHtml(a.menu_item_name || '?') + ' ×' + a.quantity + ' <span style="color:#A10035;">HK$' + ((a.item_total_cents || 0) / 100).toFixed(0) + '</span></div>';
            }).join('');
            return '<div style="border:1px solid #e5e7eb;border-radius:8px;padding:10px;margin-bottom:8px;">'
              + '<div style="display:flex;justify-content:space-between;">'
              + '<span style="font-weight:600;font-size:13px;">' + escHtml(it.menu_item_name || '?') + ' ×' + it.quantity + '</span>'
              + '<span style="font-weight:700;color:#A10035;">HK$' + ((it.item_total_cents || 0) / 100).toFixed(0) + '</span>'
              + '</div>'
              + (it.variants ? '<div style="font-size:11px;color:#6b7280;margin-top:3px;">' + escHtml(it.variants) + '</div>' : '')
              + addonHtml
              + '</div>';
          }).join('');

      var _payVendorLabels = { kpay: 'KPay', 'payment-asia': 'Payment Asia', 'payment-asia-offline': 'PA Terminal', cash: 'Cash', card: 'Card' };
      var _payStatusColors = { completed: '#10b981', paid: '#10b981', pending: '#f59e0b', failed: '#ef4444', voided: '#6b7280', refunded: '#dc2626', partial_refund: '#d97706' };

      // Subtotal, service charge, discount, total
      var subtotalCents = items.reduce(function(s, it) { return s + (it.item_total_cents || 0); }, 0);
      var scPct = order.service_charge_percent || 0;
      var scCents = scPct > 0 ? Math.round(subtotalCents * scPct / 100) : 0;
      var discCents = order.discount_cents || 0;
      var totalCents = order.total_cents || order.custom_amount_cents || (subtotalCents + scCents - discCents);

      var priceBlock = '<div style="border-top:2px solid #e5e7eb;margin-top:12px;padding-top:12px;">';
      priceBlock += '<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px;color:#6b7280;"><span>Subtotal</span><span>HK$' + (subtotalCents/100).toFixed(2) + '</span></div>';
      if (scPct > 0) priceBlock += '<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px;color:#6b7280;"><span>Service Charge (' + scPct + '%)</span><span>HK$' + (scCents/100).toFixed(2) + '</span></div>';
      if (discCents > 0) priceBlock += '<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px;color:#16a34a;"><span>Discount</span><span>-HK$' + (discCents/100).toFixed(2) + '</span></div>';
      priceBlock += '<div style="display:flex;justify-content:space-between;font-size:15px;font-weight:700;margin-top:6px;"><span>Total</span><span style="color:#A10035;">HK$' + (totalCents/100).toFixed(2) + '</span></div>';
      priceBlock += '</div>';

      // Payment gateway info
      var effectiveVendor = order.cp_vendor || order.payment_method_online || order.payment_method || 'cash';
      var effectiveStatus = order.cp_status || (order.payment_received ? 'completed' : null);
      var statusColor2 = _payStatusColors[effectiveStatus] || '#6b7280';
      var vendorLabel = _payVendorLabels[effectiveVendor] || effectiveVendor;

      var payBlock = '<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:14px;margin-top:14px;">';
      payBlock += '<div style="font-size:12px;font-weight:700;color:#374151;margin-bottom:10px;text-transform:uppercase;letter-spacing:.5px;">Payment</div>';
      payBlock += '<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px;"><span style="color:#6b7280;">Method</span><span style="font-weight:600;">' + escHtml(vendorLabel) + '</span></div>';
      if (effectiveStatus) payBlock += '<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px;"><span style="color:#6b7280;">Status</span><span style="font-weight:700;color:' + statusColor2 + ';">' + effectiveStatus + '</span></div>';
      if (order.cp_vendor_ref) payBlock += '<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:6px;"><span style="color:#6b7280;">Vendor Ref</span><code style="font-size:11px;word-break:break-all;text-align:right;max-width:200px;">' + escHtml(order.cp_vendor_ref) + '</code></div>';
      if (order.kpay_reference_id && effectiveVendor === 'kpay') payBlock += '<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:6px;"><span style="color:#6b7280;">KPay Ref</span><code style="font-size:11px;">' + escHtml(order.kpay_reference_id) + '</code></div>';
      if (order.kpay_reference_id && effectiveVendor === 'payment-asia') payBlock += '<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:6px;"><span style="color:#6b7280;">Merchant Ref</span><code style="font-size:11px;">' + escHtml(order.kpay_reference_id) + '</code></div>';
      if (order.cp_completed_at) payBlock += '<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:6px;"><span style="color:#6b7280;">Paid At</span><span>' + new Date(order.cp_completed_at).toLocaleString() + '</span></div>';
      if (order.cp_refund_amount_cents) payBlock += '<div style="background:#fee2e2;border-radius:5px;padding:8px 10px;font-size:12px;margin-top:6px;"><strong style="color:#dc2626;">Refund: HK$' + (order.cp_refund_amount_cents/100).toFixed(2) + '</strong>' + (order.cp_refunded_at ? '<div style="color:#b91c1c;margin-top:2px;">Refunded at ' + new Date(order.cp_refunded_at).toLocaleString('en-HK', { timeZone: 'Asia/Hong_Kong', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) + '</div>' : '') + (order.cp_refunded_by_name ? '<div style="color:#b91c1c;margin-top:2px;">By: ' + escHtml(order.cp_refunded_by_name) + '</div>' : '') + '</div>';
      payBlock += '</div>';

      // Payment ledger
      var ledgerBlock = '';
      if (Array.isArray(order.payment_records) && order.payment_records.length > 0) {
        var _cpStatusBadge = {
          completed: '<span style="background:#d1fae5;color:#065f46;padding:1px 7px;border-radius:3px;font-size:11px;font-weight:600;">✓ Paid</span>',
          pending:   '<span style="background:#fef9c3;color:#713f12;padding:1px 7px;border-radius:3px;font-size:11px;font-weight:600;">Pending</span>',
          failed:    '<span style="background:#fee2e2;color:#991b1b;padding:1px 7px;border-radius:3px;font-size:11px;font-weight:600;">✗ Failed</span>',
          voided:    '<span style="background:#fef3c7;color:#92400e;padding:1px 7px;border-radius:3px;font-size:11px;font-weight:600;">Voided</span>',
          refunded:  '<span style="background:#fee2e2;color:#dc2626;padding:1px 7px;border-radius:3px;font-size:11px;font-weight:600;">↩ Refunded</span>',
        };
        ledgerBlock = '<div style="background:white;border:1px solid #e5e7eb;border-radius:8px;padding:14px;margin-top:12px;">';
        ledgerBlock += '<div style="font-size:12px;font-weight:700;color:#374151;margin-bottom:10px;text-transform:uppercase;letter-spacing:.5px;">Payment Ledger</div>';
        order.payment_records.forEach(function(rec) {
          var rVendor = _payVendorLabels[rec.payment_vendor] || rec.payment_vendor || '—';
          var rStatus = _cpStatusBadge[rec.status] || '<span style="background:#f3f4f6;padding:1px 7px;border-radius:3px;font-size:11px;">' + (rec.status || '?') + '</span>';
          var rAmt = rec.total_cents ? 'HK$' + (rec.total_cents/100).toFixed(2) : rec.amount_cents ? 'HK$' + (rec.amount_cents/100).toFixed(2) : '—';
          var rDate = rec.created_at ? new Date(rec.created_at).toLocaleString() : '—';
          ledgerBlock += '<div style="display:flex;align-items:center;justify-content:space-between;font-size:12px;padding:8px 0;border-bottom:1px solid #f3f4f6;">';
          ledgerBlock += '<div><div style="font-weight:600;">' + escHtml(rVendor) + ' — ' + rAmt + '</div><div style="color:#9ca3af;margin-top:2px;">' + rDate + (rec.vendor_ref ? ' · <code>' + escHtml(rec.vendor_ref) + '</code>' : '') + '</div></div>';
          ledgerBlock += '<div>' + rStatus + '</div></div>';
        });
        ledgerBlock += '</div>';
      }

      body.innerHTML = '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px;">'
        + '<div style="flex:1;min-width:140px;background:#f9fafb;border-radius:8px;padding:12px;">'
        + '<div style="font-size:11px;color:#6b7280;text-transform:uppercase;">Date &amp; Time</div>'
        + '<div style="font-size:13px;font-weight:600;margin-top:4px;">' + createdTime + '</div>'
        + '</div>'
        + '<div style="flex:1;min-width:140px;background:#f9fafb;border-radius:8px;padding:12px;">'
        + '<div style="font-size:11px;color:#6b7280;text-transform:uppercase;">Table / Type</div>'
        + '<div style="font-size:13px;font-weight:600;margin-top:4px;">' + escHtml(order.table_name || '—') + ' <span style="font-weight:400;color:#6b7280;">' + (order.order_type || '') + '</span></div>'
        + '</div>'
        + '<div style="flex:1;min-width:140px;background:#f9fafb;border-radius:8px;padding:12px;">'
        + '<div style="font-size:11px;color:#6b7280;text-transform:uppercase;">Status</div>'
        + '<div style="font-size:13px;font-weight:700;margin-top:4px;color:' + statusColor + ';">' + (order.status || '—') + '</div>'
        + '</div>'
        + '</div>'
        + (order.customer_name || order.customer_phone
          ? '<div style="background:#f9fafb;border-radius:8px;padding:12px;margin-bottom:16px;font-size:13px;"><strong>Customer:</strong> ' + escHtml(order.customer_name || '—') + (order.customer_phone ? ' · ' + escHtml(order.customer_phone) : '') + '</div>'
          : '')
        + '<div style="font-weight:700;margin-bottom:8px;">Items</div>'
        + itemsHtml
        + priceBlock
        + payBlock
        + ledgerBlock;
    } catch (e) {
      body.innerHTML = '<div class="console-empty" style="color:#e74c3c;">Failed to load order details.</div>';
    }
  };

  /* ═══════════════════════════════════════════════════════
     ORDER HISTORY
  ═══════════════════════════════════════════════════════ */
  var _allOrdersData = [];
  var _ordersFiltered = [];

  window.consoleLoadOrders = async function () {
    var tbody = document.getElementById('orders-history-body');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="9" class="console-empty">Loading…</td></tr>';
    try {
      var daysEl = document.getElementById('orders-filter-days');
      var days = daysEl ? parseInt(daysEl.value) || 30 : 30;
      var limit = days >= 9999 ? 1000 : days * 50;
      _allOrdersData = await api('GET', '/restaurants/' + restaurantId + '/orders?limit=' + limit);
      if (!Array.isArray(_allOrdersData)) _allOrdersData = [];
      consoleFilterOrders();
    } catch (e) {
      tbody.innerHTML = '<tr><td colspan="9" class="console-empty" style="color:#e74c3c;">Failed to load orders.</td></tr>';
    }
  };

  window.consoleFilterOrders = function () {
    var search = ((document.getElementById('orders-search') || {}).value || '').toLowerCase();
    var filterStatus = ((document.getElementById('orders-filter-status') || {}).value || '');
    var filterType = ((document.getElementById('orders-filter-type') || {}).value || '');
    var daysEl = document.getElementById('orders-filter-days');
    var days = daysEl ? parseInt(daysEl.value) || 30 : 30;
    var now = Date.now();
    _ordersFiltered = _allOrdersData.filter(function (o) {
      if (filterStatus && o.status !== filterStatus) return false;
      if (filterType && (o.order_type || '').indexOf(filterType) === -1) return false;
      if (days < 9999) {
        var age = (now - new Date(o.created_at).getTime()) / 86400000;
        if (age > days) return false;
      }
      if (search) {
        var num = String(o.restaurant_order_number || o.id);
        var cust = (o.customer_name || '').toLowerCase();
        if (num.indexOf(search) === -1 && cust.indexOf(search) === -1) return false;
      }
      return true;
    });
    consoleRenderOrdersTable(_ordersFiltered);
  };

  function consoleRenderOrdersTable(orders) {
    var tbody = document.getElementById('orders-history-body');
    if (!tbody) return;
    if (!orders.length) {
      tbody.innerHTML = '<tr><td colspan="9" class="console-empty">No orders found.</td></tr>';
      return;
    }
    var statusColors = { pending: '#3b82f6', completed: '#10b981', cancelled: '#ef4444' };
    tbody.innerHTML = orders.map(function (o) {
      var d = o.created_at ? new Date(o.created_at).toLocaleString('en-HK', { timeZone: 'Asia/Hong_Kong', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
      var total = 'HK$' + ((o.total_cents || 0) / 100).toFixed(0);
      var statusColor = statusColors[o.status] || '#6b7280';
      var payMethod = o.cp_vendor || o.payment_method_online || 'cash';
      var payLabels = { kpay: 'KPay', 'payment-asia': 'PA Online', 'payment-asia-offline': 'PA Terminal', cash: 'Cash', card: 'Card' };
      var payLabel = payLabels[payMethod] || payMethod;
      var items = o.items_summary;
      var itemCount = o.item_count || (Array.isArray(items) ? items.length : 0);
      // Payment status badge
      var effectivePayStatus = o.cp_status || o.payment_status;
      var isPaid = o.payment_received || o.cp_status === 'completed';
      var payBadge;
      if (effectivePayStatus === 'refunded') {
        payBadge = '<span style="font-size:11px;background:#fee2e2;color:#dc2626;border-radius:4px;padding:2px 6px;white-space:nowrap;">↩ Refunded</span>';
      } else if (effectivePayStatus === 'partial_refund') {
        payBadge = '<span style="font-size:11px;background:#fef3c7;color:#d97706;border-radius:4px;padding:2px 6px;white-space:nowrap;">↩ Partial</span>';
      } else if (effectivePayStatus === 'voided') {
        payBadge = '<span style="font-size:11px;background:#fef3c7;color:#d97706;border-radius:4px;padding:2px 6px;white-space:nowrap;">⊘ Voided</span>';
      } else if (isPaid || effectivePayStatus === 'paid') {
        payBadge = '<span style="font-size:11px;background:#d1fae5;color:#065f46;border-radius:4px;padding:2px 6px;white-space:nowrap;">✓ Paid</span>';
      } else {
        payBadge = '<span style="font-size:11px;background:#f3f4f6;color:#6b7280;border-radius:4px;padding:2px 6px;white-space:nowrap;">Unpaid</span>';
      }
      return '<tr style="cursor:pointer;" onclick="consoleViewOrder(' + o.id + ')">'
        + '<td><strong style="color:#A10035;">#' + (o.restaurant_order_number || o.id) + '</strong></td>'
        + '<td>' + d + '</td>'
        + '<td>' + escHtml(o.order_type || '—') + '</td>'
        + '<td>' + escHtml(o.table_name || '—') + '</td>'
        + '<td>' + escHtml(o.customer_name || '—') + '</td>'
        + '<td>' + itemCount + '</td>'
        + '<td><strong>' + total + '</strong></td>'
        + '<td>' + escHtml(payLabel) + ' ' + payBadge + '</td>'
        + '<td><span style="color:' + statusColor + ';font-weight:600;">' + (o.status || '—') + '</span></td>'
        + '</tr>';
    }).join('');
  }

  /* ═══════════════════════════════════════════════════════
     REPORTS
  ═══════════════════════════════════════════════════════ */
  var _reportRange = 'month';
  var _rptTZ = 'Asia/Hong_Kong';

  function rptFmtDate(isoStr) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: _rptTZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(isoStr));
  }
  function rptFmtHour(isoStr) {
    return new Intl.DateTimeFormat('en-US', { timeZone: _rptTZ, hour: '2-digit', hour12: false }).format(new Date(isoStr)).replace(/^24/, '00');
  }
  function rptHKD(cents) { return 'HK$' + (cents / 100).toFixed(0); }
  function rptBar(pct, color, height) {
    height = height || 18;
    return '<div style="flex:1;background:#f3f4f6;border-radius:4px;height:' + height + 'px;">'
      + '<div style="width:' + pct + '%;background:' + color + ';height:' + height + 'px;border-radius:4px;transition:width .3s;"></div></div>';
  }

  window.consoleSetReportRange = function (range, btn) {
    _reportRange = range;
    document.querySelectorAll('.console-report-range-btn').forEach(function (b) { b.classList.remove('active-range'); });
    if (btn) btn.classList.add('active-range');
    consoleLoadReports();
  };

  window.consoleShowExportPage = function () {
    var dash = document.getElementById('reports-dashboard');
    var exp  = document.getElementById('reports-export-page');
    var tb   = document.querySelector('#section-reports .console-toolbar');
    if (dash) dash.style.display = 'none';
    if (exp)  exp.style.display  = '';
    if (tb)   tb.style.display   = 'none';
    // Set default date range based on current filter
    var daysMap = { today: 1, week: 7, month: 30, all: 9999 };
    var days = daysMap[_reportRange] || 30;
    var to = new Date(); var from = new Date();
    if (days < 9999) from.setDate(from.getDate() - days);
    var fmt = function(d) { return d.toISOString().split('T')[0]; };
    var fromEl = document.getElementById('export-date-from');
    var toEl   = document.getElementById('export-date-to');
    if (fromEl && !fromEl.value) fromEl.value = fmt(from);
    if (toEl   && !toEl.value)   toEl.value   = fmt(to);
  };

  window.consoleHideExportPage = function () {
    var dash = document.getElementById('reports-dashboard');
    var exp  = document.getElementById('reports-export-page');
    var tb   = document.querySelector('#section-reports .console-toolbar');
    if (dash) dash.style.display = '';
    if (exp)  exp.style.display  = 'none';
    if (tb)   tb.style.display   = '';
  };

  window.consoleSelectExportPeriod = function (period) {
    document.querySelectorAll('.export-period-btn').forEach(function (b) { b.classList.remove('active-range'); });
    var btn = document.querySelector('.export-period-btn[data-period="' + period + '"]');
    if (btn) btn.classList.add('active-range');
    var custom = document.getElementById('export-custom-time');
    if (custom) custom.style.display = (period === 'custom') ? 'flex' : 'none';
  };

  window.consoleDownloadExportCSV = function () {
    var from    = (document.getElementById('export-date-from') || {}).value || '';
    var to      = (document.getElementById('export-date-to')   || {}).value || '';
    var period  = (document.querySelector('.export-period-btn.active-range') || {}).dataset && document.querySelector('.export-period-btn.active-range').dataset.period || 'all';
    var pfrom   = (document.getElementById('export-period-from') || {}).value || '';
    var pto     = (document.getElementById('export-period-to')   || {}).value || '';
    var paxMin  = (document.getElementById('export-pax-min') || {}).value || '';
    var paxMax  = (document.getElementById('export-pax-max') || {}).value || '';
    var types   = [];
    if ((document.getElementById('export-type-table')  || {}).checked) types.push('table');
    if ((document.getElementById('export-type-now')    || {}).checked) types.push('now');
    if ((document.getElementById('export-type-to-go')  || {}).checked) types.push('to-go');

    var params = new URLSearchParams();
    if (from)   params.set('date_from', from);
    if (to)     params.set('date_to', to);
    if (period) params.set('period', period);
    if (period === 'custom' && pfrom) params.set('period_from', pfrom);
    if (period === 'custom' && pto)   params.set('period_to', pto);
    if (types.length) params.set('order_type', types.join(','));
    if (paxMin) params.set('pax_min', paxMin);
    if (paxMax) params.set('pax_max', paxMax);

    var url = window.API + '/restaurants/' + restaurantId + '/reports/export?' + params.toString();
    fetch(url, { headers: { 'Authorization': 'Bearer ' + token } })
      .then(function (r) {
        if (!r.ok) throw new Error('Export failed');
        return r.blob();
      })
      .then(function (blob) {
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'orders-export-' + (from || 'all') + '.csv';
        document.body.appendChild(a); a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      })
      .catch(function (e) { toast('Export failed: ' + e.message, 'error'); });
  };

  window.consoleLoadReports = async function () {
    var daysMap = { today: 1, week: 7, month: 30, all: 9999 };
    var days = daysMap[_reportRange] || 30;
    var loadEl = document.getElementById('reports-loading');
    var dashEl = document.getElementById('reports-dashboard');
    if (loadEl) { loadEl.style.display = ''; }
    if (dashEl) { dashEl.style.display = 'none'; }

    try {
      var limitVal = days >= 9999 ? 5000 : Math.max(days * 60, 200);
      var results = await Promise.all([
        api('GET', '/restaurants/' + restaurantId + '/orders?limit=' + limitVal),
        api('GET', '/restaurants/' + restaurantId + '/reports/top-items?days=' + days).catch(function() { return []; }),
        api('GET', '/restaurants/' + restaurantId + '/reports/top-tables?days=' + days).catch(function() { return []; }),
        api('GET', '/restaurants/' + restaurantId + '/tables').catch(function() { return []; }),
        api('GET', '/restaurants/' + restaurantId + '/menu').catch(function() { return {}; }),
        api('GET', '/restaurants/' + restaurantId + '/staff').catch(function() { return []; }),
        api('GET', '/restaurants/' + restaurantId + '/bookings?limit=2000').catch(function() { return []; })
      ]);
      var orders   = Array.isArray(results[0]) ? results[0] : [];
      var topItems = Array.isArray(results[1]) ? results[1] : [];
      var topTables = Array.isArray(results[2]) ? results[2] : [];
      var tables   = Array.isArray(results[3]) ? results[3] : [];
      var menu     = results[4] || {};
      var staff    = Array.isArray(results[5]) ? results[5] : [];
      var bookings = Array.isArray(results[6]) ? results[6] : [];

      // Date filter
      if (days < 9999) {
        var cutoff = Date.now() - days * 86400000;
        orders   = orders.filter(function(o) { return new Date(o.created_at).getTime() >= cutoff; });
        bookings = bookings.filter(function(b) { return new Date(b.created_at || b.date || b.booking_date || 0).getTime() >= cutoff; });
      }

      window._consoleAllOrders = orders;
      window._consoleTopItems  = topItems;
      window._consoleTables    = tables;
      window._consoleStaff     = staff;
      window._consoleMenu      = menu;
      window._consoleBookings  = bookings;

      var stats = consoleCalcStats(orders, topTables, bookings);
      window.consoleLastStats = stats;

      consoleRenderDashboard(stats, topItems, tables, menu, staff, bookings);

      // Load async endpoint sections in parallel
      var days2 = days;
      consoleLoadSalesByCategory(days2);
      consoleLoadSalesByItem(days2);
      consoleLoadOrderStatusTiming(days2);
      consoleLoadPaymentByType(days2);
      consoleLoadStaffHours(days2);

    } catch (e) {
      console.error('[Reports]', e);
      toast('Failed to load reports', 'error');
    } finally {
      if (loadEl) loadEl.style.display = 'none';
      if (dashEl) dashEl.style.display = '';
    }
  };

  function consoleCalcStats(orders, topTables, bookings) {
    var totalRevenue = 0, totalDiscount = 0;
    var revenueByDay = {}, revenueByHour = {}, dailyCustomers = {};
    var orderCountByStatus = {};

    orders.forEach(function (o) {
      var rev  = parseInt(o.total_cents) || 0;
      var disc = parseInt(o.discount_cents) || 0;
      totalRevenue  += rev;
      totalDiscount += disc;

      var dateStr = rptFmtDate(o.created_at);
      if (!revenueByDay[dateStr]) revenueByDay[dateStr] = { rev: 0, orders: 0, disc: 0, date: dateStr };
      revenueByDay[dateStr].rev    += rev;
      revenueByDay[dateStr].orders += 1;
      revenueByDay[dateStr].disc   += disc;

      var hr = rptFmtHour(o.created_at);
      if (!revenueByHour[hr]) revenueByHour[hr] = { rev: 0, orders: 0, hour: parseInt(hr) || 0 };
      revenueByHour[hr].rev    += rev;
      revenueByHour[hr].orders += 1;

      var pax = parseInt(o.party_size || o.pax) || 1;
      if (!dailyCustomers[dateStr]) dailyCustomers[dateStr] = 0;
      dailyCustomers[dateStr] += pax;

      var st = o.status || 'unknown';
      orderCountByStatus[st] = (orderCountByStatus[st] || 0) + 1;
    });

    var totalOrders = orders.length;
    var dayKeys = Object.keys(revenueByDay);
    var numDays = dayKeys.length || 1;
    var avgBill = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    var netSales = totalRevenue - totalDiscount;
    var avgPerDay = totalRevenue / numDays;
    var totalCustomers = Object.values(dailyCustomers).reduce(function(a,b){return a+b;},0);
    var avgCustPerDay = totalCustomers / numDays;
    var avgSpendCust  = totalCustomers > 0 ? totalRevenue / totalCustomers : 0;

    // Sort revenue by day for top days
    var sortedDays = dayKeys.map(function(d) { return revenueByDay[d]; })
      .sort(function(a,b) { return b.rev - a.rev; });

    return {
      totalRevenue: totalRevenue,
      totalDiscount: totalDiscount,
      totalOrders: totalOrders,
      avgBill: avgBill,
      netSales: netSales,
      avgPerDay: avgPerDay,
      avgCustPerDay: avgCustPerDay,
      avgSpendCust: avgSpendCust,
      revenueByDay: revenueByDay,
      revenueByHour: revenueByHour,
      sortedDays: sortedDays,
      orderCountByStatus: orderCountByStatus,
      topTables: topTables,
      allBookings: bookings
    };
  }

  function consoleRenderDashboard(stats, topItems, tables, menu, staff, bookings) {
    // KPI
    var set = function(id, v) { var el = document.getElementById(id); if (el) el.textContent = v; };
    set('rpt-orders',             stats.totalOrders);
    set('rpt-revenue',            rptHKD(stats.totalRevenue));
    set('rpt-avg-bill',           rptHKD(stats.avgBill));
    set('rpt-discounts',          rptHKD(stats.totalDiscount));
    set('rpt-net',                rptHKD(stats.netSales));
    set('rpt-avg-day',            rptHKD(stats.avgPerDay));
    set('rpt-customers-day',      stats.avgCustPerDay.toFixed(1));
    set('rpt-avg-customer',       rptHKD(stats.avgSpendCust));
    set('rpt-total-bookings',     bookings.length);
    set('rpt-confirmed-bookings', bookings.filter(function(b){return b.status==='confirmed';}).length);
    set('rpt-cancelled-bookings', bookings.filter(function(b){return b.status==='cancelled';}).length);

    consoleRenderTopRevenueDays(stats);
    consoleRenderRevenueReport(stats, tables, menu, staff);
    consoleRenderBusiestTables(stats);
    consoleRenderHourlyRevenue(stats);
    consoleRenderOrderStatusBreakdown(stats);
    consoleRenderTopItems(topItems);
    consoleRenderOrderTypes(stats);
    consoleRenderPaymentSummary(stats);
    consoleRenderDailyTrends(stats, 'daily', null);
    consoleRenderBookingsAnalytics(stats);
  }

  function consoleRenderTopRevenueDays(stats) {
    var el = document.getElementById('top-revenue-days');
    if (!el) return;
    var top5 = (stats.sortedDays || []).slice(0, 5);
    var colors = ['#A10035','#7C3AED','#2563EB','#D97706','#10b981'];
    if (!top5.length) { el.innerHTML = '<span style="color:#9ca3af;font-size:13px;">No data</span>'; return; }
    el.innerHTML = top5.map(function(d, i) {
      return '<div style="background:' + colors[i] + ';color:#fff;border-radius:8px;padding:12px 16px;min-width:120px;text-align:center;">'
        + '<div style="font-size:11px;opacity:.8;margin-bottom:4px;">' + escHtml(d.date) + '</div>'
        + '<div style="font-size:18px;font-weight:800;">' + rptHKD(d.rev) + '</div>'
        + '<div style="font-size:11px;opacity:.75;">' + d.orders + ' orders</div>'
        + '</div>';
    }).join('');
  }

  function consoleRenderRevenueReport(stats, tables, menu, staff) {
    // Populate filter dropdowns
    var categories = {};
    var menuItems = {};
    var menuData = window._consoleMenu || menu || {};
    var cats = menuData.categories || [];
    cats.forEach(function(c) {
      categories[c.id] = c.name;
      (c.items || []).forEach(function(it) { menuItems[it.id] = { name: it.name, cat: c.name, catId: c.id }; });
    });

    var populate = function(selectId, opts) {
      var sel = document.getElementById(selectId);
      if (!sel) return;
      var cur = sel.value;
      var first = sel.options[0];
      sel.innerHTML = '';
      sel.appendChild(first);
      opts.forEach(function(o) {
        var opt = document.createElement('option');
        opt.value = o.value; opt.textContent = o.label;
        if (o.value === cur) opt.selected = true;
        sel.appendChild(opt);
      });
    };

    populate('revenue-filter-category', Object.keys(categories).map(function(id) { return { value: id, label: categories[id] }; }));
    populate('revenue-filter-table', (window._consoleTables || tables || []).map(function(t) { return { value: String(t.id), label: t.name || ('Table ' + t.id) }; }));
    populate('revenue-filter-staff', (window._consoleStaff || staff || []).map(function(s) { return { value: String(s.id), label: s.name || s.username || ('Staff ' + s.id) }; }));
    var products = Object.keys(menuItems).map(function(id) { return { value: id, label: menuItems[id].name }; });
    products.sort(function(a,b) { return a.label.localeCompare(b.label); });
    populate('revenue-filter-product', products);

    consoleFilterRevenueReport();
  }

  window.consoleFilterRevenueReport = function () {
    var orders = window._consoleAllOrders || [];
    var catId  = (document.getElementById('revenue-filter-category') || {}).value || '';
    var staffId= (document.getElementById('revenue-filter-staff') || {}).value || '';
    var tableId= (document.getElementById('revenue-filter-table') || {}).value || '';
    var prodId = (document.getElementById('revenue-filter-product') || {}).value || '';

    var filtered = orders.filter(function(o) {
      if (staffId && String(o.staff_id) !== staffId) return false;
      if (tableId && String(o.table_id) !== tableId) return false;
      return true;
    });

    // If category or product filter: filter by items in order
    if (catId || prodId) {
      var menuData = window._consoleMenu || {};
      var cats = menuData.categories || [];
      var catItemIds = {};
      cats.forEach(function(c) {
        (c.items || []).forEach(function(it) { catItemIds[it.id] = c.id; });
      });
      filtered = filtered.filter(function(o) {
        var items = o.items || o.order_items || [];
        return items.some(function(it) {
          if (prodId && String(it.menu_item_id || it.item_id) !== prodId) return false;
          if (catId  && String(catItemIds[it.menu_item_id || it.item_id]) !== catId) return false;
          return true;
        });
      });
    }

    // Build daily revenue rows
    var byDay = {};
    filtered.forEach(function(o) {
      var d = rptFmtDate(o.created_at);
      if (!byDay[d]) byDay[d] = { date: d, orders: 0, disc: 0, rev: 0 };
      byDay[d].orders += 1;
      byDay[d].disc   += parseInt(o.discount_cents) || 0;
      byDay[d].rev    += parseInt(o.total_cents) || 0;
    });

    var rows = Object.values(byDay).sort(function(a,b) { return b.date.localeCompare(a.date); });
    var totalRev = rows.reduce(function(a,r){return a+r.rev;},0);
    var totalOrd = rows.reduce(function(a,r){return a+r.orders;},0);
    var totalDisc= rows.reduce(function(a,r){return a+r.disc;},0);

    var el = document.getElementById('revenue-report-content');
    if (!el) return;
    if (!rows.length) { el.innerHTML = '<p style="color:#9ca3af;font-size:13px;padding:12px 0;">No data for selected filters</p>'; return; }

    el.innerHTML = '<table class="console-table" style="font-size:12px;width:100%;">'
      + '<thead><tr>'
      + '<th style="cursor:pointer;" onclick="consoleRptSortRevenue(\'date\')">Date</th>'
      + '<th style="cursor:pointer;" onclick="consoleRptSortRevenue(\'orders\')">Orders</th>'
      + '<th style="cursor:pointer;" onclick="consoleRptSortRevenue(\'disc\')">Discount</th>'
      + '<th style="cursor:pointer;" onclick="consoleRptSortRevenue(\'rev\')">Revenue</th>'
      + '</tr></thead><tbody>'
      + rows.map(function(r) {
          return '<tr><td>' + r.date + '</td><td>' + r.orders + '</td>'
            + '<td style="color:#f59e0b;">' + (r.disc > 0 ? '-' + rptHKD(r.disc) : '—') + '</td>'
            + '<td style="font-weight:700;color:#A10035;">' + rptHKD(r.rev) + '</td></tr>';
        }).join('')
      + '</tbody><tfoot><tr style="font-weight:700;background:#f9fafb;">'
      + '<td>Total</td><td>' + totalOrd + '</td>'
      + '<td style="color:#f59e0b;">' + (totalDisc > 0 ? '-' + rptHKD(totalDisc) : '—') + '</td>'
      + '<td style="color:#A10035;">' + rptHKD(totalRev) + '</td>'
      + '</tr></tfoot></table>';
  };

  var _rptRevSortCol = 'date', _rptRevSortAsc = true;
  window.consoleRptSortRevenue = function (col) {
    if (_rptRevSortCol === col) { _rptRevSortAsc = !_rptRevSortAsc; } else { _rptRevSortCol = col; _rptRevSortAsc = false; }
    consoleFilterRevenueReport();
  };

  function consoleRenderBusiestTables(stats) {
    var el = document.getElementById('chart-busiest-tables');
    if (!el) return;
    var tables = stats.topTables || [];
    if (!tables.length) { el.innerHTML = '<p style="color:#9ca3af;font-size:13px;text-align:center;padding:20px;">No data</p>'; return; }
    var maxRev = Math.max.apply(null, tables.map(function(t){return parseInt(t.total_revenue||t.revenue)||0;})) || 1;
    el.innerHTML = tables.map(function(t) {
      var rev = parseInt(t.total_revenue || t.revenue) || 0;
      var cnt = parseInt(t.order_count || t.orders) || 0;
      var pct = Math.round((rev / maxRev) * 100);
      return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;font-size:12px;">'
        + '<span style="width:70px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escHtml(t.table_name || ('Table '+t.table_id)) + '</span>'
        + rptBar(pct, '#A10035', 18)
        + '<span style="width:55px;text-align:right;color:#6b7280;">' + cnt + ' · ' + rptHKD(rev) + '</span>'
        + '</div>';
    }).join('');
  }

  function consoleRenderHourlyRevenue(stats) {
    var el = document.getElementById('chart-hourly-revenue');
    if (!el) return;
    var byHour = stats.revenueByHour || {};
    var hrs = Object.keys(byHour).sort(function(a,b){ return parseInt(a)-parseInt(b); });
    if (!hrs.length) { el.innerHTML = '<p style="color:#9ca3af;font-size:13px;text-align:center;padding:20px;">No data</p>'; return; }
    var maxRev = Math.max.apply(null, hrs.map(function(h){return byHour[h].rev;})) || 1;
    el.innerHTML = hrs.map(function(h) {
      var d = byHour[h];
      var pct = Math.round((d.rev / maxRev) * 100);
      return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;font-size:12px;">'
        + '<span style="width:36px;color:#6b7280;">' + h + ':00</span>'
        + rptBar(pct, '#7C3AED', 18)
        + '<span style="width:66px;text-align:right;color:#6b7280;">' + d.orders + ' · ' + rptHKD(d.rev) + '</span>'
        + '</div>';
    }).join('');
  }

  function consoleRenderOrderStatusBreakdown(stats) {
    var el = document.getElementById('order-status-breakdown');
    if (!el) return;
    var sc = stats.orderCountByStatus || {};
    var total = stats.totalOrders || 1;
    var stColors = { pending:'#3b82f6', accepted:'#8b5cf6', preparing:'#f59e0b', ready:'#06b6d4', completed:'#10b981', cancelled:'#ef4444', refunded:'#6b7280' };
    var keys = Object.keys(sc);
    if (!keys.length) { el.innerHTML = '<p style="color:#9ca3af;font-size:13px;padding:12px 0;">No data</p>'; return; }
    el.innerHTML = keys.map(function(k) {
      var n = sc[k]; var pct = Math.round((n/total)*100); var col = stColors[k]||'#6b7280';
      return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">'
        + '<span style="width:86px;font-size:12px;text-transform:capitalize;">' + k + '</span>'
        + rptBar(pct, col, 20)
        + '<span style="width:64px;text-align:right;font-size:12px;color:#6b7280;">' + n + ' (' + pct + '%)</span>'
        + '</div>';
    }).join('');
  }

  function consoleRenderTopItems(topItems) {
    var el = document.getElementById('rpt-top-items');
    if (!el) return;
    var ti = (topItems || []).slice(0, 20);
    var maxQty = ti.length > 0 ? (parseInt(ti[0].total_quantity)||1) : 1;
    if (!ti.length) { el.innerHTML = '<p style="color:#9ca3af;font-size:13px;text-align:center;padding:20px;">No data</p>'; return; }
    el.innerHTML = ti.map(function(item) {
      var qty = parseInt(item.total_quantity)||0;
      var rev = parseInt(item.total_revenue)||0;
      var pct = Math.round((qty/maxQty)*100);
      return '<div style="margin-bottom:10px;">'
        + '<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px;">'
        + '<span style="font-weight:600;color:#111;">' + escHtml(item.name||'?') + '</span>'
        + '<span style="color:#6b7280;">' + qty + ' sold · ' + rptHKD(rev) + '</span></div>'
        + rptBar(pct, '#A10035', 6)
        + '</div>';
    }).join('');
  }

  function consoleRenderOrderTypes(stats) {
    var el = document.getElementById('rpt-order-types');
    if (!el) return;
    var orders = window._consoleAllOrders || [];
    var tc = {};
    orders.forEach(function(o){ var t=o.order_type||'counter'; tc[t]=(tc[t]||0)+1; });
    var total = orders.length || 1;
    var labels = { table:'Dine In', 'to-go':'To-Go', counter:'Counter', now:'Order Now' };
    var keys = Object.keys(tc);
    if (!keys.length) { el.innerHTML = '<p style="color:#9ca3af;font-size:13px;text-align:center;padding:20px;">No data</p>'; return; }
    el.innerHTML = keys.map(function(k) {
      var pct = Math.round((tc[k]/total)*100);
      return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">'
        + '<span style="width:100px;font-size:13px;">' + (labels[k]||k) + '</span>'
        + rptBar(pct, '#667eea', 20)
        + '<span style="width:60px;text-align:right;font-size:12px;color:#6b7280;">' + tc[k] + ' (' + pct + '%)</span>'
        + '</div>';
    }).join('');
  }

  function consoleRenderPaymentSummary(stats) {
    var el = document.getElementById('rpt-payment-methods');
    if (!el) return;
    var orders = window._consoleAllOrders || [];
    var pm = {};
    orders.forEach(function(o){ var v=o.cp_vendor||o.payment_method_online||'cash'; pm[v]=(pm[v]||0)+(parseInt(o.total_cents)||0); });
    var labels = { kpay:'KPay Terminal','payment-asia':'PA Online','payment-asia-offline':'PA Terminal',cash:'Cash',card:'Card' };
    var keys = Object.keys(pm);
    var maxRev = Math.max.apply(null,keys.map(function(k){return pm[k];}))||1;
    if (!keys.length) { el.innerHTML = '<p style="color:#9ca3af;font-size:13px;text-align:center;padding:20px;">No data</p>'; return; }
    el.innerHTML = keys.map(function(k) {
      var pct = Math.round((pm[k]/maxRev)*100);
      return '<div style="margin-bottom:8px;">'
        + '<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px;">'
        + '<span style="font-weight:600;">' + (labels[k]||k) + '</span>'
        + '<span style="color:#A10035;">' + rptHKD(pm[k]) + '</span></div>'
        + rptBar(pct, '#10b981', 8)
        + '</div>';
    }).join('');
  }

  window.consoleRenderDailyTrends = function (stats, mode, btn) {
    if (btn) {
      document.querySelectorAll('.console-trends-btn').forEach(function(b){b.classList.remove('active-range');});
      btn.classList.add('active-range');
    }
    if (!stats) return;
    var el = document.getElementById('table-daily-trends');
    if (!el) return;
    var byDay = stats.revenueByDay || {};
    var entries = Object.values(byDay).sort(function(a,b){return a.date<b.date?-1:1;});
    if (!entries.length) { el.innerHTML = '<p style="color:#9ca3af;font-size:13px;padding:12px;">No data</p>'; return; }

    var groups = {};
    entries.forEach(function(e) {
      var key;
      if (mode === 'monthly') {
        key = e.date.slice(0,7);
      } else if (mode === 'weekly') {
        var d = new Date(e.date); var day = d.getDay();
        var monday = new Date(d); monday.setDate(d.getDate() - ((day+6)%7));
        key = monday.toISOString().split('T')[0];
      } else {
        key = e.date;
      }
      if (!groups[key]) groups[key] = { key:key, orders:0, rev:0, disc:0 };
      groups[key].orders += e.orders;
      groups[key].rev    += e.rev;
      groups[key].disc   += e.disc;
    });

    var rows = Object.values(groups).sort(function(a,b){return b.key.localeCompare(a.key);});
    el.innerHTML = '<table class="console-table" style="font-size:12px;width:100%;">'
      + '<thead><tr><th>' + (mode==='monthly'?'Month':mode==='weekly'?'Week Starting':'Date') + '</th>'
      + '<th>Orders</th><th>Discount</th><th>Revenue</th></tr></thead><tbody>'
      + rows.map(function(r) {
          return '<tr><td>' + r.key + '</td><td>' + r.orders + '</td>'
            + '<td style="color:#f59e0b;">' + (r.disc>0?'-'+rptHKD(r.disc):'—') + '</td>'
            + '<td style="font-weight:700;color:#A10035;">' + rptHKD(r.rev) + '</td></tr>';
        }).join('')
      + '</tbody></table>';
  };

  function consoleRenderBookingsAnalytics(stats) {
    var bookings = stats.allBookings || [];
    var confirmed = bookings.filter(function(b){return b.status==='confirmed';}).length;
    var cancelled = bookings.filter(function(b){return b.status==='cancelled';}).length;
    var pending   = bookings.length - confirmed - cancelled;

    var smEl = document.getElementById('bookings-summary-stats');
    if (smEl) {
      var smItems = [
        { label: 'Total Bookings', val: bookings.length, color: '#111' },
        { label: 'Confirmed',      val: confirmed,       color: '#10b981' },
        { label: 'Cancelled',      val: cancelled,       color: '#ef4444' },
        { label: 'Pending',        val: pending,         color: '#f59e0b' }
      ];
      smEl.innerHTML = smItems.map(function(s) {
        return '<div class="console-card" style="padding:12px;text-align:center;border:1px solid #e5e7eb;">'
          + '<div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;">' + s.label + '</div>'
          + '<div style="font-size:20px;font-weight:800;color:' + s.color + ';margin-top:4px;">' + s.val + '</div>'
          + '</div>';
      }).join('');
    }

    consoleRenderBookingsTrends('daily', null);
    consoleRenderBookingsPeakHours(bookings);
    consoleRenderBookingsTopTables(bookings);
    consoleRenderBookingsStatusBar(bookings);
  }

  window.consoleRenderBookingsTrends = function (mode, btn) {
    if (btn) {
      document.querySelectorAll('.console-bookings-btn').forEach(function(b){b.classList.remove('active-range');});
      btn.classList.add('active-range');
    }
    var bookings = window._consoleBookings || [];
    var el = document.getElementById('bookings-trend-table');
    if (!el) return;
    if (!bookings.length) { el.innerHTML = '<p style="color:#9ca3af;font-size:13px;padding:8px;">No bookings data</p>'; return; }

    var groups = {};
    bookings.forEach(function(b) {
      var raw = b.booking_date || b.date || b.created_at;
      if (!raw) return;
      var d = new Date(raw);
      var key;
      if (mode === 'monthly') {
        key = d.toISOString().slice(0,7);
      } else if (mode === 'weekly') {
        var day = d.getDay(); var mon = new Date(d); mon.setDate(d.getDate()-((day+6)%7));
        key = mon.toISOString().split('T')[0];
      } else {
        key = d.toISOString().split('T')[0];
      }
      if (!groups[key]) groups[key] = { key:key, total:0, confirmed:0, cancelled:0 };
      groups[key].total++;
      if (b.status==='confirmed')  groups[key].confirmed++;
      if (b.status==='cancelled')  groups[key].cancelled++;
    });

    var rows = Object.values(groups).sort(function(a,b){return b.key.localeCompare(a.key);}).slice(0,30);
    el.innerHTML = '<table class="console-table" style="font-size:12px;width:100%;">'
      + '<thead><tr><th>Period</th><th>Total</th><th>Confirmed</th><th>Cancelled</th></tr></thead><tbody>'
      + rows.map(function(r) {
          return '<tr><td>' + r.key + '</td><td>' + r.total + '</td>'
            + '<td style="color:#10b981;">' + r.confirmed + '</td>'
            + '<td style="color:#ef4444;">' + r.cancelled + '</td></tr>';
        }).join('')
      + '</tbody></table>';
  };

  function consoleRenderBookingsPeakHours(bookings) {
    var el = document.getElementById('bookings-peak-hours');
    if (!el) return;
    var byHour = {};
    bookings.forEach(function(b) {
      var raw = b.booking_time || b.time;
      if (!raw) return;
      var hr = String(raw).split(':')[0].replace(/^(\d)$/,'0$1');
      byHour[hr] = (byHour[hr]||0)+1;
    });
    var hrs = Object.keys(byHour).sort();
    var max = Math.max.apply(null,hrs.map(function(h){return byHour[h];})) || 1;
    if (!hrs.length) { el.innerHTML = '<p style="color:#9ca3af;font-size:13px;padding:8px;">No data</p>'; return; }
    el.innerHTML = hrs.map(function(h) {
      var pct = Math.round((byHour[h]/max)*100);
      return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:5px;font-size:12px;">'
        + '<span style="width:36px;color:#6b7280;">' + h + ':00</span>'
        + rptBar(pct,'#2563EB',16)
        + '<span style="width:28px;text-align:right;">' + byHour[h] + '</span>'
        + '</div>';
    }).join('');
  }

  function consoleRenderBookingsTopTables(bookings) {
    var el = document.getElementById('bookings-top-tables');
    if (!el) return;
    var tc = {};
    bookings.forEach(function(b){ if (b.table_name||b.table_id) { var k=b.table_name||('Table '+b.table_id); tc[k]=(tc[k]||0)+1; } });
    var sorted = Object.keys(tc).sort(function(a,b){return tc[b]-tc[a];}).slice(0,8);
    var max = sorted.length ? tc[sorted[0]] : 1;
    if (!sorted.length) { el.innerHTML = '<p style="color:#9ca3af;font-size:13px;padding:8px;">No data</p>'; return; }
    el.innerHTML = sorted.map(function(k) {
      var pct = Math.round((tc[k]/max)*100);
      return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;font-size:12px;">'
        + '<span style="width:80px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escHtml(k) + '</span>'
        + rptBar(pct,'#7C3AED',16)
        + '<span style="width:28px;text-align:right;">' + tc[k] + '</span>'
        + '</div>';
    }).join('');
  }

  function consoleRenderBookingsStatusBar(bookings) {
    var el = document.getElementById('bookings-status-bar');
    if (!el) return;
    var total = bookings.length || 1;
    var confirmed = bookings.filter(function(b){return b.status==='confirmed';}).length;
    var cancelled = bookings.filter(function(b){return b.status==='cancelled';}).length;
    var pending   = total - confirmed - cancelled;
    var pcts = [
      { label:'Confirmed', val:confirmed, color:'#10b981' },
      { label:'Cancelled', val:cancelled, color:'#ef4444' },
      { label:'Pending',   val:pending,   color:'#f59e0b' }
    ];
    // Stacked bar
    el.innerHTML = '<div style="display:flex;height:24px;border-radius:6px;overflow:hidden;margin-bottom:10px;">'
      + pcts.map(function(p){ var w=Math.round((p.val/total)*100); return w>0?'<div style="width:'+w+'%;background:'+p.color+';"></div>':''; }).join('')
      + '</div>'
      + pcts.map(function(p) {
          return '<div style="display:flex;align-items:center;gap:6px;font-size:12px;margin-bottom:4px;">'
            + '<span style="width:10px;height:10px;border-radius:50%;background:'+p.color+';display:inline-block;"></span>'
            + p.label + ': ' + p.val + ' (' + Math.round((p.val/total)*100) + '%)</div>';
        }).join('');
  }

  // Async report sections
  async function consoleLoadSalesByCategory(days) {
    var el = document.getElementById('sales-by-category-content');
    if (!el) return;
    el.innerHTML = '<p style="color:#9ca3af;font-size:13px;padding:8px;">Loading…</p>';
    try {
      var data = await api('GET', '/restaurants/'+restaurantId+'/reports/sales-by-category?days='+days);
      if (!Array.isArray(data)||!data.length) { el.innerHTML='<p style="color:#9ca3af;font-size:13px;padding:8px;">No data</p>'; return; }
      var maxRev = Math.max.apply(null,data.map(function(d){return parseInt(d.total_revenue)||0;})) || 1;
      var colors = ['#A10035','#7C3AED','#2563EB','#D97706','#10b981','#06b6d4','#ec4899','#f97316'];
      el.innerHTML = data.map(function(d,i) {
        var rev = parseInt(d.total_revenue)||0;
        var qty = parseInt(d.total_quantity||d.quantity)||0;
        var pct = Math.round((rev/maxRev)*100);
        var col = colors[i%colors.length];
        return '<div style="margin-bottom:10px;">'
          + '<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px;">'
          + '<span style="font-weight:600;color:#111;">' + escHtml(d.category_name||d.name||'?') + '</span>'
          + '<span style="color:#6b7280;">' + qty + ' · ' + rptHKD(rev) + '</span></div>'
          + rptBar(pct,col,8)
          + '</div>';
      }).join('');
    } catch(e) { el.innerHTML='<p style="color:#ef4444;font-size:12px;padding:8px;">Failed to load</p>'; }
  }

  async function consoleLoadSalesByItem(days) {
    var el = document.getElementById('sales-by-item-content');
    if (!el) return;
    el.innerHTML = '<p style="color:#9ca3af;font-size:13px;padding:8px;">Loading…</p>';
    try {
      var data = await api('GET', '/restaurants/'+restaurantId+'/reports/sales-by-item?days='+days);
      if (!Array.isArray(data)||!data.length) { el.innerHTML='<p style="color:#9ca3af;font-size:13px;padding:8px;">No data</p>'; return; }
      el.innerHTML = '<table class="console-table" style="font-size:12px;width:100%;">'
        + '<thead><tr><th>Item</th><th>Qty</th><th>Revenue</th></tr></thead><tbody>'
        + data.slice(0,50).map(function(d) {
            var rev = parseInt(d.total_revenue||d.revenue)||0;
            var qty = parseInt(d.total_quantity||d.quantity)||0;
            return '<tr><td>' + escHtml(d.item_name||d.name||'?') + '</td><td>' + qty + '</td>'
              + '<td style="font-weight:600;color:#A10035;">' + rptHKD(rev) + '</td></tr>';
          }).join('')
        + '</tbody></table>';
    } catch(e) { el.innerHTML='<p style="color:#ef4444;font-size:12px;padding:8px;">Failed to load</p>'; }
  }

  async function consoleLoadOrderStatusTiming(days) {
    var el = document.getElementById('order-status-timing');
    if (!el) return;
    el.innerHTML = '<p style="color:#9ca3af;font-size:13px;padding:8px;">Loading…</p>';
    try {
      var data = await api('GET', '/restaurants/'+restaurantId+'/reports/order-status-timing?days='+days);
      if (!data||typeof data!=='object') { el.innerHTML='<p style="color:#9ca3af;font-size:13px;padding:8px;">No data</p>'; return; }
      var transitions = data.transitions || data || [];
      var fastestItems = data.fastest_items || [];
      var html = '';
      if (!transitions.length && !fastestItems.length) { el.innerHTML='<p style="color:#9ca3af;font-size:13px;padding:8px;">No timing data</p>'; return; }
      if (transitions.length) {
        html += '<table class="console-table" style="font-size:12px;width:100%;">'
          + '<thead><tr><th>Transition</th><th>Avg Time</th><th>Count</th></tr></thead><tbody>'
          + transitions.slice(0,15).map(function(t) {
              var avg = parseFloat(t.avg_minutes||t.avg_seconds/60||0).toFixed(1);
              var unit = (t.avg_minutes!=null)?'min':(t.avg_seconds!=null?'s':'');
              return '<tr><td>' + escHtml((t.from_status||'?')+' → '+(t.to_status||'?')) + '</td>'
                + '<td>' + avg + ' ' + unit + '</td><td>' + (t.count||t.total||0) + '</td></tr>';
            }).join('')
          + '</tbody></table>';
      }
      if (fastestItems.length) {
        html += '<div style="font-size:12px;font-weight:600;color:#374151;margin:12px 0 6px;">Fastest Prepared Items</div>'
          + '<table class="console-table" style="font-size:12px;width:100%;">'
          + '<thead><tr><th>Item</th><th>Avg Prep</th><th>Count</th></tr></thead><tbody>'
          + fastestItems.slice(0,10).map(function(f) {
              var mins = parseFloat(f.avg_minutes||0).toFixed(1);
              return '<tr><td>' + escHtml(f.item_name||'?') + '</td><td>' + mins + ' min</td><td>' + (f.count||0) + '</td></tr>';
            }).join('')
          + '</tbody></table>';
      }
      el.innerHTML = html;
    } catch(e) { el.innerHTML='<p style="color:#ef4444;font-size:12px;padding:8px;">Failed to load</p>'; }
  }

  async function consoleLoadPaymentByType(days) {
    var el = document.getElementById('payment-by-type-content');
    if (!el) return;
    el.innerHTML = '<p style="color:#9ca3af;font-size:13px;padding:8px;">Loading…</p>';
    try {
      var data = await api('GET', '/restaurants/'+restaurantId+'/reports/payment-by-type?days='+days);
      if (!Array.isArray(data)||!data.length) { el.innerHTML='<p style="color:#9ca3af;font-size:13px;padding:8px;">No data</p>'; return; }
      var total = data.reduce(function(a,d){return a+(parseInt(d.total_revenue||d.revenue)||0);},0)||1;
      el.innerHTML = data.map(function(d) {
        var rev = parseInt(d.total_revenue||d.revenue)||0;
        var cnt = parseInt(d.order_count||d.count)||0;
        var pct = Math.round((rev/total)*100);
        return '<div style="margin-bottom:10px;">'
          + '<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px;">'
          + '<span style="font-weight:600;">' + escHtml(d.vendor||d.payment_type||d.method||'?') + '</span>'
          + '<span>' + cnt + ' · <strong style="color:#A10035;">' + rptHKD(rev) + '</strong> (' + pct + '%)</span></div>'
          + rptBar(pct,'#2563EB',10)
          + '</div>';
      }).join('');
    } catch(e) { el.innerHTML='<p style="color:#ef4444;font-size:12px;padding:8px;">Failed to load</p>'; }
  }

  async function consoleLoadStaffHours(days) {
    var el = document.getElementById('staff-hours-content');
    if (!el) return;
    el.innerHTML = '<p style="color:#9ca3af;font-size:13px;padding:8px;">Loading…</p>';
    try {
      var data = await api('GET', '/restaurants/'+restaurantId+'/reports/staff-hours?days='+days);
      if (!Array.isArray(data)||!data.length) { el.innerHTML='<p style="color:#9ca3af;font-size:13px;padding:8px;">No data</p>'; return; }
      el.innerHTML = '<table class="console-table" style="font-size:12px;width:100%;">'
        + '<thead><tr><th>Staff</th><th>Hours</th><th>Sessions</th></tr></thead><tbody>'
        + data.map(function(d) {
            var hrs = parseFloat(d.total_hours||d.hours||0).toFixed(1);
            return '<tr><td>' + escHtml(d.staff_name||d.name||'?') + '</td>'
              + '<td style="font-weight:600;">' + hrs + 'h</td>'
              + '<td>' + (d.session_count||d.sessions||0) + '</td></tr>';
          }).join('')
        + '</tbody></table>';
    } catch(e) { el.innerHTML='<p style="color:#ef4444;font-size:12px;padding:8px;">Failed to load</p>'; }
  }

  /* ═══════════════════════════════════════════════════════
     MEMBERS AREA FEATURE FLAGS
  ═══════════════════════════════════════════════════════ */
  window.consoleLoadMembersAreaFlags = async function () {
    try {
      var data = await api('GET', '/restaurants/' + restaurantId + '/settings');
      var flags = (data && data.feature_flags) || {};
      var membersOn = flags.members_area !== false;
      var couponsOn = flags.coupons !== false;
      var requireGuestPhone = flags.require_guest_phone === true;
      var membersEl = document.getElementById('flag-members-area');
      var couponsEl = document.getElementById('flag-coupons');
      var couponsWrap = document.getElementById('flag-coupons-wrap');
      var guestPhoneEl = document.getElementById('flag-require-guest-phone');
      if (membersEl) membersEl.checked = membersOn;
      if (couponsEl) {
        couponsEl.checked = couponsOn;
        couponsEl.disabled = !membersOn;
      }
      if (couponsWrap) couponsWrap.style.opacity = membersOn ? '' : '0.4';
      if (guestPhoneEl) guestPhoneEl.checked = requireGuestPhone;
    } catch (e) { /* ignore */ }
  };

  window.consoleSaveMembersAreaFlag = async function (key, value) {
    if (key === 'coupons') {
      var membersEl = document.getElementById('flag-members-area');
      if (membersEl && !membersEl.checked) { return; }
    }
    try {
      await api('PATCH', '/restaurants/' + restaurantId + '/settings', { feature_flags: { [key]: value } });
      if (key === 'members_area') {
        var couponsEl = document.getElementById('flag-coupons');
        var couponsWrap = document.getElementById('flag-coupons-wrap');
        if (couponsEl) couponsEl.disabled = !value;
        if (couponsWrap) couponsWrap.style.opacity = value ? '' : '0.4';
      }
      toast(value ? 'Enabled' : 'Disabled');
    } catch (e) {
      toast('Failed to save setting', 'error');
    }
  };

  /* ═══════════════════════════════════════════════════════
     RESTAURANT SWITCHER
  ═══════════════════════════════════════════════════════ */
  async function consoleLoadRestaurantSwitcher() {
    try {
      var role = localStorage.getItem('role');
      if (role !== 'superadmin' && role !== 'admin') return;
      var restaurants = await api('GET', '/auth/admin-restaurants');
      if (!Array.isArray(restaurants) || restaurants.length <= 1) return;
      var sel = document.getElementById('console-restaurant-select');
      if (!sel) return;
      sel.innerHTML = restaurants.map(function (r) {
        return '<option value="' + r.id + '"' + (String(r.id) === String(restaurantId) ? ' selected' : '') + '>' + escHtml(r.name) + '</option>';
      }).join('');
      sel.style.display = '';
      // Hide the static badge since the select shows the current restaurant
      var badge = document.getElementById('console-restaurant-badge');
      if (badge) badge.style.display = 'none';
    } catch (e) {
      // Switcher unavailable — no action needed
    }
  }

  window.consoleSwitchRestaurant = function (id) {
    if (!id || String(id) === String(restaurantId)) return;
    restaurantId = String(id);
    window.restaurantId = restaurantId;
    localStorage.setItem('restaurantId', restaurantId);
    localStorage.setItem('xish_restaurantId', restaurantId);
    _sectionLoaded = {};
    consoleLoadRestaurantInfo();
    consoleLoadDashboard();
    consoleSwitchSection('dashboard', document.querySelector('.console-nav-btn[data-section="dashboard"]'));
    toast('Switched restaurant');
  };

  /* ═══════════════════════════════════════════════════════
     INIT
  ═══════════════════════════════════════════════════════ */
  document.addEventListener('DOMContentLoaded', function () {
    consoleLoadRestaurantInfo();
    consoleLoadDashboard();
    var dashBtn = document.querySelector('.console-nav-btn[data-section="dashboard"]');
    if (dashBtn) dashBtn.classList.add('active');
  });

  /* ═══════════════════════════════════════════════════════
     SIGN-UP METHODS
  ═══════════════════════════════════════════════════════ */
  async function consoleLoadSignupMethods() {
    try {
      var s = await api('GET', '/restaurants/' + restaurantId + '/settings');
      if (!s) return;
      var flags = s.feature_flags || {};
      var sm = flags.signup_methods || {};
      var toggle = function (id, val) { var el = document.getElementById(id); if (el) el.checked = !!val; };
      toggle('signup-wallet-pass-toggle', sm.wallet_pass !== false);
      toggle('signup-google-toggle', sm.google === true);
      toggle('signup-wechat-toggle', sm.wechat === true);
      var gc = document.getElementById('signup-google-client-id');
      if (gc) gc.value = sm.google_client_id || '';
      var wai = document.getElementById('signup-wechat-app-id');
      if (wai) wai.value = sm.wechat_app_id || '';
      var was = document.getElementById('signup-wechat-app-secret');
      if (was) was.value = sm.wechat_app_secret ? '••••••••' : '';
    } catch (e) {
      toast('Failed to load sign-up settings', 'error');
    }
  }

  window.consoleSaveSignupMethods = async function () {
    try {
      var walletEnabled = document.getElementById('signup-wallet-pass-toggle').checked;
      var googleEnabled = document.getElementById('signup-google-toggle').checked;
      var googleClientId = document.getElementById('signup-google-client-id').value.trim();
      var wechatEnabled = document.getElementById('signup-wechat-toggle').checked;
      var wechatAppId = document.getElementById('signup-wechat-app-id').value.trim();
      var wechatAppSecretEl = document.getElementById('signup-wechat-app-secret');
      var wechatAppSecret = wechatAppSecretEl && wechatAppSecretEl.value !== '••••••••' ? wechatAppSecretEl.value.trim() : undefined;
      var sm = {
        email_phone: true,
        wallet_pass: walletEnabled,
        google: googleEnabled,
        google_client_id: googleClientId,
        wechat: wechatEnabled,
        wechat_app_id: wechatAppId,
      };
      if (wechatAppSecret !== undefined) sm.wechat_app_secret = wechatAppSecret;
      await api('PATCH', '/restaurants/' + restaurantId + '/settings', {
        feature_flags: { signup_methods: sm }
      });
      toast('Sign-up methods saved');
      var saved = document.getElementById('signup-methods-saved');
      if (saved) { saved.style.display = 'inline'; setTimeout(function () { saved.style.display = 'none'; }, 3000); }
    } catch (e) {
      toast(e.message || 'Save failed', 'error');
    }
  };

  /* ═══════════════════════════════════════════════════════
     LOYALTY PASS CARD DESIGNER
  ═══════════════════════════════════════════════════════ */

  // Stamp icons available for selection (keyed by id → SVG string)
  var LP_STAMP_ICONS = {
    coffee: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/></svg>',
    star:   '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
    heart:  '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
    gift:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>',
    fire:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>',
    smile:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>',
    leaf:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M2 22c1.25-1.25 2.5-2.5 3.5-5C7 14 7 11 9 9s5-3 9-5c0 4-1 7-3 9s-5 2-8 3.5C4.5 17.5 2 22 2 22z"/><path d="M2 22L12 12"/></svg>',
    diamond:'<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="12 2 22 9 18 21 6 21 2 9"/></svg>',
    cup:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 2h8l1 9H7L8 2z"/><path d="M7 11c0 4 2 6 5 8 3-2 5-4 5-8"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="9" y1="22" x2="15" y2="22"/></svg>',
    bolt:   '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
    flower: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 3a2 2 0 0 1 2 2v2a2 2 0 0 1-4 0V5a2 2 0 0 1 2-2z"/><path d="M12 21a2 2 0 0 1-2-2v-2a2 2 0 0 1 4 0v2a2 2 0 0 1-2 2z"/><path d="M3 12a2 2 0 0 1 2-2h2a2 2 0 0 1 0 4H5a2 2 0 0 1-2-2z"/><path d="M21 12a2 2 0 0 1-2 2h-2a2 2 0 0 1 0-4h2a2 2 0 0 1 2 2z"/><path d="M5.64 5.64a2 2 0 0 1 2.83 0l1.41 1.41a2 2 0 0 1-2.83 2.83L5.64 8.46a2 2 0 0 1 0-2.82z"/><path d="M18.36 18.36a2 2 0 0 1-2.83 0l-1.41-1.41a2 2 0 0 1 2.83-2.83l1.41 1.41a2 2 0 0 1 0 2.83z"/><path d="M5.64 18.36a2 2 0 0 1 0-2.83l1.41-1.41a2 2 0 0 1 2.83 2.83l-1.41 1.41a2 2 0 0 1-2.83 0z"/><path d="M18.36 5.64a2 2 0 0 1 0 2.83l-1.41 1.41a2 2 0 0 1-2.83-2.83l1.41-1.41a2 2 0 0 1 2.83 0z"/></svg>',
    crown:  '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="12 2 15.5 8.5 22 6 19 14 5 14 2 6 8.5 8.5 12 2"/><rect x="5" y="16" width="14" height="2"/><rect x="7" y="20" width="10" height="2"/></svg>'
  };
  var LP_STAMP_ICON_KEYS = Object.keys(LP_STAMP_ICONS);

  // Shared colour presets for the unified card
  var LP_PRESETS = [
    { id: 'cafe',     label: 'Café',     bg: '#2d1b0e', fg: '#f5e6d3', accent: '#c8762a' },
    { id: 'midnight', label: 'Midnight', bg: '#1e1b4b', fg: '#e0e7ff', accent: '#818cf8' },
    { id: 'luxury',   label: 'Luxury',   bg: '#0f172a', fg: '#f1f5f9', accent: '#e8b84b' },
    { id: 'sakura',   label: 'Sakura',   bg: '#f7e7ef', fg: '#6b2142', accent: '#e05c8a' },
    { id: 'fresh',    label: 'Fresh',    bg: '#f0fdf4', fg: '#14532d', accent: '#22c55e' },
    { id: 'gold',     label: 'Gold',     bg: '#1c1504', fg: '#fef3c7', accent: '#fbbf24' },
    { id: 'royal',    label: 'Royal',    bg: '#1e003e', fg: '#ede9fe', accent: '#a78bfa' },
    { id: 'onyx',     label: 'Onyx',     bg: '#000000', fg: '#ffffff', accent: '#ef4444' },
  ];

  // Unified single-card state
  var lpState = {
    bg: '#2d1b0e', fg: '#f5e6d3', accent: '#c8762a',
    name: '', tagline: '',
    stamp:  { enabled: true,  stamps_required: 10, reward_description: 'Free Coffee', icon: 'coffee' },
    points: { enabled: true,  unit: 'pts' },
    tiers:  { enabled: true,  headline: 'Member Status' }
  };

  function lpGet(id)    { var el = document.getElementById(id); return el ? el.value : ''; }
  function lpGetCk(id)  { var el = document.getElementById(id); return el ? el.checked : false; }
  function lpSet(id, v) { var el = document.getElementById(id); if (el) el.value = v; }
  function lpSetCk(id, v){ var el = document.getElementById(id); if (el) el.checked = !!v; }

  function lpReadAll() {
    lpState.bg     = lpGet('lp-color-bg')     || lpState.bg;
    lpState.fg     = lpGet('lp-color-fg')     || lpState.fg;
    lpState.accent = lpGet('lp-color-accent') || lpState.accent;
    lpState.name    = lpGet('lp-card-name');
    lpState.tagline = lpGet('lp-card-tagline');
    lpState.stamp.enabled            = lpGetCk('lp-stamp-enabled');
    lpState.stamp.stamps_required    = parseInt(lpGet('lp-stamp-count')) || 10;
    lpState.stamp.reward_description = lpGet('lp-stamp-reward');
    lpState.points.enabled = lpGetCk('lp-points-enabled');
    lpState.points.unit    = lpGet('lp-points-unit') || 'pts';
    lpState.tiers.enabled  = lpGetCk('lp-tiers-enabled');
    lpState.tiers.headline = lpGet('lp-vip-headline');
  }

  function lpWriteAll() {
    lpSet('lp-color-bg', lpState.bg);     lpColorSyncPicker('bg', lpState.bg);
    lpSet('lp-color-fg', lpState.fg);     lpColorSyncPicker('fg', lpState.fg);
    lpSet('lp-color-accent', lpState.accent); lpColorSyncPicker('accent', lpState.accent);
    lpSet('lp-card-name',    lpState.name    || '');
    lpSet('lp-card-tagline', lpState.tagline || '');
    lpSetCk('lp-stamp-enabled',  lpState.stamp.enabled);
    lpSet('lp-stamp-count',  lpState.stamp.stamps_required);
    lpSet('lp-stamp-reward', lpState.stamp.reward_description || '');
    lpSetCk('lp-points-enabled', lpState.points.enabled);
    lpSet('lp-points-unit',  lpState.points.unit || 'pts');
    lpSetCk('lp-tiers-enabled',  lpState.tiers.enabled);
    lpSet('lp-vip-headline', lpState.tiers.headline || 'Member Status');
    lpRenderIconGrid();
    lpRenderPresetGrid();
    lpUpdatePreview();
    // Populate join link and QR
    var _joinUrl = window.location.origin + '/xish/join/' + restaurantId;
    var _urlEl = document.getElementById('lp-join-url');
    if (_urlEl) _urlEl.value = _joinUrl;
    var _qrEl = document.getElementById('lp-join-qr');
    if (_qrEl) {
      _qrEl.innerHTML = '';
      new QRCode(_qrEl, { text: _joinUrl, width: 120, height: 120, correctLevel: QRCode.CorrectLevel.M });
    }
  }

  function lpColorSyncPicker(key, hex) {
    var picker = document.getElementById('lp-color-' + key + '-picker');
    if (picker && /^#[0-9a-f]{6}$/i.test(hex)) picker.value = hex;
  }

  window.lpColorSync = function(key) {
    var picker = document.getElementById('lp-color-' + key + '-picker');
    var hex    = document.getElementById('lp-color-' + key);
    if (picker && hex) hex.value = picker.value;
  };
  window.lpColorSync2 = function(key) {
    var hex    = document.getElementById('lp-color-' + key);
    var picker = document.getElementById('lp-color-' + key + '-picker');
    if (hex && picker && /^#[0-9a-f]{6}$/i.test(hex.value)) picker.value = hex.value;
  };

  window.lpApplyPreset = function(presetId) {
    var p = LP_PRESETS.find(function(x) { return x.id === presetId; });
    if (!p) return;
    lpState.bg = p.bg; lpState.fg = p.fg; lpState.accent = p.accent;
    lpSet('lp-color-bg', p.bg);     lpColorSyncPicker('bg', p.bg);
    lpSet('lp-color-fg', p.fg);     lpColorSyncPicker('fg', p.fg);
    lpSet('lp-color-accent', p.accent); lpColorSyncPicker('accent', p.accent);
    document.querySelectorAll('.lp-preset-btn').forEach(function(b) {
      b.classList.toggle('active', b.dataset.preset === presetId);
    });
    lpUpdatePreview();
  };

  window.lpSelectIcon = function(icon) {
    lpState.stamp.icon = icon;
    document.querySelectorAll('.lp-icon-btn').forEach(function(b) {
      b.classList.toggle('active', b.dataset.icon === icon);
    });
    lpUpdatePreview();
  };

  function lpRenderPresetGrid() {
    var grid = document.getElementById('lp-preset-grid');
    if (!grid) return;
    grid.innerHTML = LP_PRESETS.map(function(p) {
      return '<button class="lp-preset-btn" data-preset="' + p.id + '" onclick="lpApplyPreset(\'' + p.id + '\')">' +
        '<div class="lp-preset-swatch" style="background:' + p.bg + ';border:1px solid rgba(0,0,0,.1);"></div>' +
        '<div style="color:#374151;">' + escHtml(p.label) + '</div>' +
        '</button>';
    }).join('');
  }

  function lpRenderIconGrid() {
    var grid = document.getElementById('lp-icon-grid');
    if (!grid) return;
    var cur = lpState.stamp.icon || 'coffee';
    grid.innerHTML = LP_STAMP_ICON_KEYS.map(function(key) {
      var svgStr = LP_STAMP_ICONS[key];
      // inject size attributes into the SVG
      var sized = svgStr.replace('<svg ', '<svg width="22" height="22" ');
      return '<button class="lp-icon-btn' + (key === cur ? ' active' : '') + '" data-icon="' + key + '" onclick="lpSelectIcon(\'' + key + '\')" title="' + key + '">' + sized + '</button>';
    }).join('');
  }

  window.lpUpdatePreview = function() {
    var preview = document.getElementById('lp-card-preview');
    if (!preview) return;

    var bg     = lpGet('lp-color-bg')     || lpState.bg;
    var fg     = lpGet('lp-color-fg')     || lpState.fg;
    var accent = lpGet('lp-color-accent') || lpState.accent;
    var cardName  = lpGet('lp-card-name')    || 'My Loyalty Card';
    var tagline   = lpGet('lp-card-tagline') || '';
    var showStamp  = lpGetCk('lp-stamp-enabled');
    var showPoints = lpGetCk('lp-points-enabled');
    var showTiers  = lpGetCk('lp-tiers-enabled');
    var count  = parseInt(lpGet('lp-stamp-count')) || 10;
    var reward = lpGet('lp-stamp-reward') || 'Free Reward';
    var icon   = lpState.stamp.icon || 'coffee';
    var unit   = lpGet('lp-points-unit') || 'pts';
    var tierLabel = lpGet('lp-vip-headline') || 'Member Status';

    var inner = '';

    // ── Header ──────────────────────────────────────────
    inner += '<div class="lp-card-header">' +
      '<div class="lp-card-logo-text" style="color:' + fg + ';">' + escHtml(cardName) + '</div>';
    if (showTiers) {
      inner += '<div class="lp-card-header-field" style="color:' + fg + ';">' +
        '<div class="lp-card-header-field-label" style="opacity:.65;">' + escHtml(tierLabel).toUpperCase() + '</div>' +
        '<div class="lp-card-header-field-val" style="color:' + accent + ';">GOLD</div>' +
        '</div>';
    }
    inner += '</div>';

    // Tagline
    if (tagline) {
      inner += '<div style="font-size:10px;padding:0 16px 6px;color:' + fg + ';opacity:.7;">' + escHtml(tagline) + '</div>';
    }

    // ── Accent strip ──────────────────────────────────────
    inner += '<div class="lp-card-strip" style="background:linear-gradient(90deg,' + accent + ',transparent);"></div>';

    // ── Stamp grid ────────────────────────────────────────
    if (showStamp) {
      var filledCount = Math.ceil(count * 0.4);
      var iconSize = count > 12 ? '10' : '14';
      var iconSvg = LP_STAMP_ICONS[icon] ? LP_STAMP_ICONS[icon].replace('<svg ', '<svg width="' + iconSize + '" height="' + iconSize + '" style="display:block;color:' + fg + ';" ') : '';
      var cells = '';
      for (var i = 0; i < count; i++) {
        var filled = i < filledCount;
        cells += '<div class="lp-stamp-cell' + (filled ? ' filled' : '') + '" style="background:' + (filled ? accent : 'rgba(255,255,255,.12)') + ';display:flex;align-items:center;justify-content:center;">' + (filled ? iconSvg : '') + '</div>';
      }
      inner += '<div class="lp-stamp-grid">' + cells + '</div>';
      inner += '<div style="display:flex;justify-content:space-between;padding:4px 16px 8px;">' +
        '<div style="font-size:10px;color:' + fg + ';opacity:.7;">STAMPS: ' + filledCount + ' / ' + count + '</div>' +
        '<div style="font-size:10px;color:' + accent + ';">REWARD: ' + escHtml(reward) + '</div>' +
        '</div>';
    }

    // ── Points balance ────────────────────────────────────
    if (showPoints) {
      if (showStamp) inner += '<div style="height:1px;background:rgba(255,255,255,.1);margin:0 16px 8px;"></div>';
      inner += '<div class="lp-card-primary" style="color:' + fg + ';padding-top:4px;">' +
        '<div class="lp-card-primary-label" style="color:' + accent + ';">POINTS BALANCE</div>' +
        '<div class="lp-card-primary-val">1,250 <span style="font-size:14px;font-weight:400;">' + escHtml(unit) + '</span></div>' +
        '</div>';
    }

    // ── Footer ────────────────────────────────────────────
    inner += '<div class="lp-card-secondary-row" style="margin-top:' + (showStamp || showPoints ? '0' : '12px') + ';">' +
      '<div class="lp-card-secondary-field" style="color:' + fg + ';"><div class="lp-card-secondary-label">NAME</div><div class="lp-card-secondary-val">Alex Chan</div></div>' +
      '<div class="lp-card-secondary-field" style="color:' + fg + ';text-align:right;"><div class="lp-card-secondary-label">MEMBER ID</div><div class="lp-card-secondary-val">XSH-000001</div></div>' +
      '</div>';

    preview.style.background = bg;
    preview.innerHTML = inner;
  };

  async function consoleLoadLoyaltyPassSettings() {
    try {
      var s = await api('GET', '/restaurants/' + restaurantId + '/settings');
      if (!s) return;
      var lp = s.loyalty_pass || {};
      // Unified card colours / identity
      if (lp.bg)     lpState.bg     = lp.bg;
      if (lp.fg)     lpState.fg     = lp.fg;
      if (lp.accent) lpState.accent = lp.accent;
      if (lp.name)    lpState.name    = lp.name;
      if (lp.tagline) lpState.tagline = lp.tagline;
      // Stamp feature
      if (lp.stamp) {
        Object.assign(lpState.stamp, lp.stamp);
        // Migrate legacy emoji icons to SVG key names
        var _emojiToKey = {'☕':'coffee','⭐':'star','🌟':'star','❤️':'heart','🎁':'gift','🔥':'fire','😊':'smile','🌿':'leaf','🌸':'flower','💎':'diamond','🍺':'cup','⚡':'bolt','🍕':'coffee','🍜':'coffee','🍣':'coffee','🍰':'coffee','👑':'crown'};
        if (lpState.stamp.icon && !LP_STAMP_ICONS[lpState.stamp.icon]) {
          lpState.stamp.icon = _emojiToKey[lpState.stamp.icon] || 'coffee';
        }
      } else if (lp.stamp_card) {
        // backward compat
        lpState.stamp.enabled = !!lp.stamp_card.enabled;
        if (lp.stamp_card.stamps_required)    lpState.stamp.stamps_required    = lp.stamp_card.stamps_required;
        if (lp.stamp_card.reward_description) lpState.stamp.reward_description = lp.stamp_card.reward_description;
      }
      // Points feature
      if (lp.points && typeof lp.points === 'object') {
        Object.assign(lpState.points, lp.points);
      } else if (typeof lp.points === 'boolean') {
        lpState.points.enabled = lp.points;
      }
      // Tiers feature
      if (lp.tiers && typeof lp.tiers === 'object') {
        Object.assign(lpState.tiers, lp.tiers);
      } else if (lp.vip_card) {
        lpState.tiers.enabled  = !!lp.vip_card.enabled;
        if (lp.vip_card.headline) lpState.tiers.headline = lp.vip_card.headline;
      } else if (typeof lp.vip === 'boolean') {
        lpState.tiers.enabled = lp.vip;
      }
      lpWriteAll();
    } catch (e) {
      toast('Failed to load loyalty pass settings', 'error');
    }
  }

  window.consoleCopyJoinLink = function() {
    var el = document.getElementById('lp-join-url');
    if (!el) return;
    navigator.clipboard.writeText(el.value).then(function() { toast('Link copied!', 'success'); }).catch(function() {
      el.select(); document.execCommand('copy'); toast('Link copied!', 'success');
    });
  };

  window.consolePrintJoinQr = function() {
    var url = (document.getElementById('lp-join-url') || {}).value || '';
    if (!url) return;
    var w = window.open('', '_blank', 'width=480,height=560');
    w.document.write('<html><body style="text-align:center;font-family:sans-serif;padding:32px;">'
      + '<h2 style="margin-bottom:8px;">Join Our Loyalty Programme</h2>'
      + '<p style="color:#6b7280;margin-bottom:20px;">Scan the QR code to become a member</p>'
      + '<div id="pqr"></div>'
      + '<p style="font-size:12px;color:#9ca3af;margin-top:16px;word-break:break-all;">' + url + '</p>'
      + '<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"><\/script>'
      + '<script>window.onload=function(){new QRCode(document.getElementById("pqr"),{text:"' + url.replace(/"/g,'&quot;') + '",width:200,height:200});window.print();}<\/script>'
      + '</body></html>');
    w.document.close();
  };

  window.consoleSaveLoyaltyPass = async function () {
    try {
      await api('PATCH', '/restaurants/' + restaurantId + '/settings', {
        loyalty_pass: {
          bg: lpState.bg, fg: lpState.fg, accent: lpState.accent,
          name: lpState.name, tagline: lpState.tagline,
          stamp:  lpState.stamp,
          points: lpState.points,
          tiers:  lpState.tiers,
          // backward compat keys
          stamp_card: { enabled: lpState.stamp.enabled, stamps_required: lpState.stamp.stamps_required, reward_description: lpState.stamp.reward_description },
          vip_card:   { enabled: lpState.tiers.enabled, headline: lpState.tiers.headline }
        }
      });
      toast('Card design saved');
      var saved = document.getElementById('loyalty-pass-saved');
      if (saved) { saved.style.display = 'inline'; setTimeout(function () { saved.style.display = 'none'; }, 3000); }
    } catch (e) {
      toast(e.message || 'Save failed', 'error');
    }
  };

  /* ═══════════════════════════════════════════════════════
     SETTINGS — RESTAURANT INFO
  ═══════════════════════════════════════════════════════ */
  async function csLoadRestaurantInfo() {
    try {
      var s = await api('GET', '/restaurants/' + restaurantId + '/settings');
      if (!s) return;
      var set = function (id, val) { var el = document.getElementById(id); if (el) el.value = val || ''; };
      set('cs-rest-name', s.name);
      set('cs-rest-phone', s.phone);
      set('cs-rest-address', s.address);
      set('cs-rest-sc', s.service_charge_percent);
      set('cs-rest-color', s.theme_color);
      set('cs-rest-timezone', s.timezone);
      var picker = document.getElementById('cs-rest-color-picker');
      if (picker && s.theme_color && /^#[0-9a-f]{6}$/i.test(s.theme_color)) picker.value = s.theme_color;
      var tzSel = document.getElementById('cs-rest-timezone');
      if (tzSel && s.timezone) tzSel.value = s.timezone;
      if (s.logo_url) {
        var img = document.getElementById('cs-rest-logo-preview');
        if (img) { img.src = s.logo_url; img.style.display = 'block'; }
      }
    } catch (e) {
      toast('Failed to load restaurant info', 'error');
    }
  }

  window.csSaveRestaurantInfo = async function () {
    try {
      var btn = event && event.target;
      if (btn) btn.disabled = true;
      await api('PATCH', '/restaurants/' + restaurantId + '/settings', {
        name: document.getElementById('cs-rest-name').value.trim(),
        phone: document.getElementById('cs-rest-phone').value.trim(),
        address: document.getElementById('cs-rest-address').value.trim(),
        service_charge_percent: parseFloat(document.getElementById('cs-rest-sc').value) || 0,
        theme_color: document.getElementById('cs-rest-color').value.trim(),
        timezone: document.getElementById('cs-rest-timezone').value
      });
      toast('Restaurant info saved');
      var saved = document.getElementById('cs-rest-saved');
      if (saved) { saved.style.display = 'inline'; setTimeout(function () { saved.style.display = 'none'; }, 3000); }
      consoleLoadRestaurantInfo();
    } catch (e) {
      toast(e.message || 'Save failed', 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  };

  window.csUploadLogo = async function (file) {
    if (!file) return;
    try {
      var fd = new FormData();
      fd.append('logo', file);
      var res = await fetch(API + '/restaurants/' + restaurantId + '/logo', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token },
        body: fd
      });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      if (data.logo_url) {
        var img = document.getElementById('cs-rest-logo-preview');
        if (img) { img.src = data.logo_url; img.style.display = 'block'; }
      }
      toast('Logo uploaded');
      var saved = document.getElementById('cs-rest-logo-saved');
      if (saved) { saved.style.display = 'inline'; setTimeout(function () { saved.style.display = 'none'; }, 3000); }
    } catch (e) {
      toast(e.message || 'Upload failed', 'error');
    }
  };

  /* ═══════════════════════════════════════════════════════
     SETTINGS — QR & ORDER
  ═══════════════════════════════════════════════════════ */
  var CS_VENUE_DESCS = {
    restaurant: 'Customers are seated at a table. They scan a QR code on the table to browse the menu and order. A waiter serves them.',
    counter: 'Customers order at the counter or use self-service kiosk. No table assignment required.',
    counter_only: 'Takeaway or counter service only. No dine-in orders are accepted from the menu.'
  };

  async function csLoadQrSettings() {
    try {
      var s = await api('GET', '/restaurants/' + restaurantId + '/settings');
      if (!s) return;
      var vt = s.venue_type || 'restaurant';
      if (s.feature_flags && s.feature_flags.counter_only) vt = 'counter_only';
      var vtSel = document.getElementById('cs-venue-type');
      if (vtSel) vtSel.value = vt;
      var desc = document.getElementById('cs-venue-desc');
      if (desc) desc.textContent = CS_VENUE_DESCS[vt] || '';
      var qmSel = document.getElementById('cs-qr-mode');
      if (qmSel) qmSel.value = s.qr_mode || 'regenerate';
      var sis = document.getElementById('cs-show-item-status');
      if (sis) sis.checked = !!s.show_item_status_to_diners;
      var ppEl = document.getElementById('cs-force-pay-on-phone');
      if (ppEl) ppEl.checked = s.force_pay_on_phone === true;
      var bpEl = document.getElementById('cs-show-being-prepared');
      if (bpEl) bpEl.checked = s.show_being_prepared !== false;
    } catch (e) {
      toast('Failed to load QR settings', 'error');
    }
  }

  window.csSaveVenueType = async function (value) {
    var desc = document.getElementById('cs-venue-desc');
    if (desc) desc.textContent = CS_VENUE_DESCS[value] || '';
    var isCounter = value === 'counter' || value === 'counter_only';
    var bpEl = document.getElementById('cs-show-being-prepared');
    if (bpEl) bpEl.checked = isCounter;
    try {
      var patch = { venue_type: value, show_being_prepared: isCounter };
      if (value === 'restaurant') {
        patch.has_table_service = true;
        patch.feature_flags = { counter_only: false };
      } else if (value === 'counter') {
        patch.has_table_service = false;
        patch.feature_flags = { counter_only: false };
      } else if (value === 'counter_only') {
        patch.has_table_service = false;
        patch.feature_flags = { counter_only: true };
      }
      await api('PATCH', '/restaurants/' + restaurantId + '/settings', patch);
      toast('Venue type saved');
    } catch (e) {
      toast(e.message || 'Save failed', 'error');
    }
  };

  window.csSaveQrMode = async function (value) {
    try {
      await api('PATCH', '/restaurants/' + restaurantId + '/settings', { qr_mode: value });
      toast('QR mode saved');
    } catch (e) {
      toast(e.message || 'Save failed', 'error');
    }
  };

  window.csSaveShowItemStatus = async function (enabled) {
    try {
      await api('PATCH', '/restaurants/' + restaurantId + '/settings', { show_item_status_to_diners: enabled });
      toast(enabled ? 'Kitchen status now visible to diners' : 'Kitchen status hidden from diners');
    } catch (e) {
      toast(e.message || 'Save failed', 'error');
    }
  };

  window.csSaveForcePayOnPhone = async function (enabled) {
    try {
      await api('PATCH', '/restaurants/' + restaurantId + '/settings', { force_pay_on_phone: enabled });
      toast(enabled ? 'Customers will be required to pay on phone' : 'Pay on phone disabled — staff will collect payment');
    } catch (e) {
      toast(e.message || 'Save failed', 'error');
    }
  };

  window.csSaveShowBeingPrepared = async function (enabled) {
    try {
      await api('PATCH', '/restaurants/' + restaurantId + '/settings', { show_being_prepared: enabled });
      toast(enabled ? 'Order preparation status visible to customers' : 'Order preparation status hidden from customers');
    } catch (e) {
      toast(e.message || 'Save failed', 'error');
    }
  };

  /* ═══════════════════════════════════════════════════════
     SETTINGS — MENU SETTINGS
  ═══════════════════════════════════════════════════════ */
  var _csBanners = [];

  async function csLoadMenuSettings() {
    try {
      var s = await api('GET', '/restaurants/' + restaurantId + '/settings');
      if (!s) return;
      var ui = s.ui_config || {};
      var cfi = document.getElementById('cs-custom-food-item');
      if (cfi) cfi.checked = !!(s.feature_flags && s.feature_flags.allow_custom_food_items);
      // Menu layout
      var cols = ui.menu_layout || ui.menu_columns || 2;
      var radios = document.querySelectorAll('input[name="cs-menu-cols"]');
      radios.forEach(function (r) { r.checked = (r.value === String(cols)); });
      // Portal styling
      var setColor = function (inputId, pickerId, val) {
        var el = document.getElementById(inputId);
        var pk = document.getElementById(pickerId);
        if (el) el.value = val || '';
        if (pk && val && /^#[0-9a-f]{6}$/i.test(val)) pk.value = val;
      };
      setColor('cs-portal-bg', 'cs-portal-bg-picker', ui.portal_bg);
      setColor('cs-portal-card', 'cs-portal-card-picker', ui.portal_card_bg);
      // Cover image
      if (s.background_url || (s.menu_images && s.menu_images.cover_url)) {
        var coverUrl = s.background_url || s.menu_images.cover_url;
        var bgPrev = document.getElementById('cs-menu-bg-preview');
        if (bgPrev) { bgPrev.src = coverUrl; bgPrev.style.display = 'block'; }
      }
      // Featured banners
      _csBanners = (ui.featured_banners || []).slice();
      var bannersEnabled = document.getElementById('cs-banners-enabled');
      if (bannersEnabled) bannersEnabled.checked = !!ui.featured_strip_enabled;
      csRenderBanners();
    } catch (e) {
      toast('Failed to load menu settings', 'error');
    }
  }

  window.csSaveCustomFoodItem = async function (enabled) {
    try {
      await api('PATCH', '/restaurants/' + restaurantId + '/settings', { feature_flags: { allow_custom_food_items: enabled } });
      toast(enabled ? 'Custom food item enabled' : 'Custom food item disabled');
    } catch (e) {
      toast(e.message || 'Save failed', 'error');
    }
  };

  window.csSaveMenuLayout = async function (cols) {
    try {
      await api('PATCH', '/restaurants/' + restaurantId + '/settings', { ui_config: { menu_layout: cols, menu_columns: cols } });
      toast('Menu layout saved');
    } catch (e) {
      toast(e.message || 'Save failed', 'error');
    }
  };

  window.csSavePortalStyling = async function () {
    try {
      var bg = document.getElementById('cs-portal-bg').value.trim();
      var card = document.getElementById('cs-portal-card').value.trim();
      await api('PATCH', '/restaurants/' + restaurantId + '/settings', { ui_config: { portal_bg: bg, portal_card_bg: card } });
      toast('Portal styling saved');
      var saved = document.getElementById('cs-portal-saved');
      if (saved) { saved.style.display = 'inline'; setTimeout(function () { saved.style.display = 'none'; }, 3000); }
    } catch (e) {
      toast(e.message || 'Save failed', 'error');
    }
  };

  window.csUploadBackground = async function (file) {
    if (!file) return;
    try {
      var fd = new FormData();
      fd.append('background', file);
      var res = await fetch(API + '/restaurants/' + restaurantId + '/background', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token },
        body: fd
      });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      var url = data.background_url || data.url;
      if (url) {
        var bgPrev = document.getElementById('cs-menu-bg-preview');
        if (bgPrev) { bgPrev.src = url; bgPrev.style.display = 'block'; }
      }
      toast('Cover image uploaded');
      var saved = document.getElementById('cs-menu-bg-saved');
      if (saved) { saved.style.display = 'inline'; setTimeout(function () { saved.style.display = 'none'; }, 3000); }
    } catch (e) {
      toast(e.message || 'Upload failed', 'error');
    }
  };

  window.csSaveFeaturedStripEnabled = async function (enabled) {
    try {
      await api('PATCH', '/restaurants/' + restaurantId + '/settings', { ui_config: { featured_strip_enabled: enabled } });
      toast(enabled ? 'Featured banners enabled' : 'Featured banners disabled');
    } catch (e) {
      toast(e.message || 'Save failed', 'error');
    }
  };

  function csRenderBanners() {
    var list = document.getElementById('cs-banners-list');
    if (!list) return;
    if (!_csBanners.length) {
      list.innerHTML = '<p style="color:#9ca3af;font-size:13px;">No banners. Add one below.</p>';
      return;
    }
    list.innerHTML = _csBanners.map(function (b, i) {
      return '<div style="display:flex;align-items:center;gap:10px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:8px 12px;">' +
        '<img src="' + escHtml(b.image_url || b.url || '') + '" style="width:64px;height:40px;object-fit:cover;border-radius:4px;" />' +
        '<span style="flex:1;font-size:12px;color:#374151;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escHtml(b.label || b.image_url || b.url || 'Banner ' + (i + 1)) + '</span>' +
        '<button class="console-btn console-btn-sm console-btn-danger" onclick="csRemoveBanner(' + i + ')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>' +
        '</div>';
    }).join('');
  }

  window.csAddBannerWithFile = async function (file) {
    if (!file) return;
    try {
      var fd = new FormData();
      fd.append('banner', file);
      var res = await fetch(API + '/restaurants/' + restaurantId + '/banner', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token },
        body: fd
      });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      var url = data.banner_url || data.url;
      if (url) {
        _csBanners.push({ image_url: url, url: url });
        await csPersistBanners();
        csRenderBanners();
        var saved = document.getElementById('cs-banners-saved');
        if (saved) { saved.style.display = 'inline'; setTimeout(function () { saved.style.display = 'none'; }, 3000); }
      }
      toast('Banner added');
    } catch (e) {
      toast(e.message || 'Upload failed', 'error');
    }
  };

  window.csRemoveBanner = async function (idx) {
    _csBanners.splice(idx, 1);
    await csPersistBanners();
    csRenderBanners();
    toast('Banner removed');
  };

  async function csPersistBanners() {
    try {
      await api('PATCH', '/restaurants/' + restaurantId + '/settings', { ui_config: { featured_banners: _csBanners } });
    } catch (e) {
      toast('Failed to save banners', 'error');
    }
  }

  /* ═══════════════════════════════════════════════════════
     SETTINGS — PAYMENT
  ═══════════════════════════════════════════════════════ */
  var _csPaymentMethods = [];

  async function csLoadPaymentSettings() {
    try {
      var s = await api('GET', '/restaurants/' + restaurantId + '/settings');
      if (!s) return;
      _csPaymentMethods = ((s.feature_flags && s.feature_flags.custom_payment_methods) || []).slice();
      csRenderPaymentMethods();
      // Show/hide online payment section based on whether it's activated by super admin
      var onlinePaySection = document.getElementById('cs-online-pay-section');
      if (onlinePaySection) {
        if (s.order_pay_enabled) {
          onlinePaySection.style.display = '';
        } else {
          onlinePaySection.innerHTML = '<div style="background:#f9fafb;border:1px dashed #d1d5db;border-radius:10px;padding:20px;text-align:center;color:#9ca3af;font-size:13px;margin-bottom:20px;">' +
            '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" stroke-width="1.5" style="margin-bottom:8px;display:block;margin-left:auto;margin-right:auto;"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>' +
            '<div style="font-weight:600;color:#6b7280;margin-bottom:4px;">Online Payment not activated</div>' +
            '<div style="font-size:12px;">Contact Chuio to enable online self-checkout payment for this restaurant.</div>' +
            '<a href="https://wa.me/85267455358?text=Hi%20Chuio%2C%20I\'m%20interested%20in%20Online%20Payment" target="_blank" style="display:inline-flex;align-items:center;gap:6px;background:#25D366;color:#fff;padding:8px 14px;border-radius:8px;font-weight:700;font-size:12px;text-decoration:none;margin-top:12px;">Contact Us on WhatsApp</a>' +
            '</div>';
          onlinePaySection.style.display = '';
        }
      }
      // Fetch real terminal data from the dedicated endpoint
      var terminals = [];
      try { terminals = await api('GET', '/restaurants/' + restaurantId + '/payment-terminals'); } catch (_) {}
      csRenderTerminals(terminals || [], s.active_payment_terminal_id, s.active_payment_vendor);
    } catch (e) {
      toast('Failed to load payment settings', 'error');
    }
  }

  function csRenderPaymentMethods() {
    var list = document.getElementById('cs-payment-methods-list');
    if (!list) return;
    list.innerHTML = _csPaymentMethods.map(function (m, i) {
      var label = typeof m === 'string' ? m : (m.label || m.name || m);
      return '<div style="display:flex;align-items:center;gap:10px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:10px 14px;margin-bottom:6px;">' +
        '<span style="flex:1;font-size:14px;font-weight:600;color:#1f2937;">' + escHtml(label) + '</span>' +
        '<button class="console-btn console-btn-sm console-btn-danger" onclick="csRemovePaymentMethod(' + i + ')">Remove</button>' +
        '</div>';
    }).join('');
  }

  window.csAddPaymentMethod = async function () {
    var inp = document.getElementById('cs-new-payment-method');
    var val = inp ? inp.value.trim() : '';
    if (!val) return;
    _csPaymentMethods.push(val);
    inp.value = '';
    csRenderPaymentMethods();
    await csPersistPaymentMethods();
    toast('Payment method added');
  };

  window.csRemovePaymentMethod = async function (idx) {
    _csPaymentMethods.splice(idx, 1);
    csRenderPaymentMethods();
    await csPersistPaymentMethods();
    toast('Payment method removed');
  };

  async function csPersistPaymentMethods() {
    try {
      await api('PATCH', '/restaurants/' + restaurantId + '/settings', { feature_flags: { custom_payment_methods: _csPaymentMethods } });
    } catch (e) {
      toast('Failed to save payment methods', 'error');
    }
  }

  var _csTerminals = [];
  var _csActiveTerminalId = null;
  var _csActiveVendor = null;

  function csRenderTerminals(terminals, activeId, activeVendor) {
    _csTerminals = terminals || [];
    _csActiveTerminalId = activeId;
    _csActiveVendor = activeVendor;
    var el = document.getElementById('cs-terminals-list');
    if (!el) return;
    if (!_csTerminals.length) {
      el.innerHTML = '<p style="font-size:13px;color:#9ca3af;padding:12px 0;">No payment terminals configured yet. Click <strong>+ Add Terminal</strong> to add one.</p>';
      return;
    }
    var vendorLabels = { kpay: 'KPay', 'payment-asia': 'Payment Asia (Online)', 'payment-asia-offline': 'PA Terminal' };
    el.innerHTML = _csTerminals.map(function (t) {
      var isActive = t.id === activeId || t.vendor_name === activeVendor;
      var label = vendorLabels[t.vendor_name] || t.vendor_name;
      var activeIndicator = isActive
        ? '<span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:12px;background:#dcfce7;color:#16a34a;white-space:nowrap;">Active</span>'
        : '<span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:12px;background:#f3f4f6;color:#9ca3af;white-space:nowrap;">' + (t.is_active ? 'Enabled' : 'Inactive') + '</span>';
      var details = '';
      if (t.vendor_name === 'kpay') details = (t.app_id ? '<div style="font-size:11px;color:#9ca3af;">App ID: ' + escHtml(t.app_id) + '</div>' : '') + (t.terminal_ip ? '<div style="font-size:11px;color:#9ca3af;">IP: ' + escHtml(t.terminal_ip) + (t.terminal_port ? ':' + t.terminal_port : '') + '</div>' : '');
      else if (t.vendor_name === 'payment-asia') details = (t.payment_gateway_env ? '<div style="font-size:11px;color:#9ca3af;">Env: ' + escHtml(t.payment_gateway_env) + '</div>' : '');
      else if (t.vendor_name === 'payment-asia-offline') details = (t.terminal_ip ? '<div style="font-size:11px;color:#9ca3af;">IP: ' + escHtml(t.terminal_ip) + (t.terminal_port ? ':' + t.terminal_port : '') + '</div>' : '');
      return '<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px;margin-bottom:8px;display:flex;align-items:center;gap:14px;">'
        + '<div style="flex:1;">'
        + '<div style="font-size:14px;font-weight:700;margin-bottom:2px;">' + escHtml(label) + '</div>'
        + details
        + '</div>'
        + activeIndicator
        + '<button class="console-btn console-btn-sm" onclick="csOpenTerminalModal(' + t.id + ')">Edit</button>'
        + '<button class="console-btn console-btn-sm console-btn-danger" onclick="csDeleteTerminal(' + t.id + ')">Delete</button>'
        + '</div>';
    }).join('');
  }

  window.csOpenTerminalModal = function (id) {
    var t = id ? _csTerminals.find(function(x) { return x.id === id; }) : null;
    document.getElementById('modal-terminal-title').textContent = t ? 'Edit Terminal' : 'Add Terminal';
    document.getElementById('modal-terminal-id').value = t ? t.id : '';
    var vendor = t ? (t.vendor_name || 'kpay') : 'kpay';
    document.getElementById('modal-terminal-vendor').value = vendor;
    // KPay fields
    document.getElementById('modal-terminal-app-id').value = t ? (t.app_id || '') : '';
    document.getElementById('modal-terminal-app-secret').value = t ? (t.app_secret || '') : '';
    document.getElementById('modal-terminal-ip').value = t ? (t.terminal_ip || '') : '';
    document.getElementById('modal-terminal-port').value = t ? (t.terminal_port || '') : '';
    document.getElementById('modal-terminal-endpoint').value = t ? (t.endpoint_path || '') : '';
    // PA Online fields
    document.getElementById('modal-terminal-merchant-token').value = t ? (t.merchant_token || '') : '';
    document.getElementById('modal-terminal-secret-code').value = t ? (t.secret_code || '') : '';
    document.getElementById('modal-terminal-env').value = t ? (t.payment_gateway_env || 'production') : 'production';
    // PA Offline fields
    document.getElementById('modal-terminal-pa-ip').value = t ? (t.terminal_ip || '') : '';
    document.getElementById('modal-terminal-pa-port').value = t ? (t.terminal_port || '') : '';
    document.getElementById('modal-terminal-pa-api-key').value = t ? (t.app_secret || '') : '';
    csUpdateTerminalFields();
    openConsoleModal('modal-terminal');
  };

  window.csUpdateTerminalFields = function () {
    var vendor = (document.getElementById('modal-terminal-vendor') || {}).value;
    var kf = document.getElementById('terminal-fields-kpay');
    var paf = document.getElementById('terminal-fields-pa');
    var paof = document.getElementById('terminal-fields-pa-offline');
    if (kf) kf.style.display = vendor === 'kpay' ? '' : 'none';
    if (paf) paf.style.display = vendor === 'payment-asia' ? '' : 'none';
    if (paof) paof.style.display = vendor === 'payment-asia-offline' ? '' : 'none';
  };

  window.csSaveTerminal = async function () {
    var id = document.getElementById('modal-terminal-id').value;
    var vendor = document.getElementById('modal-terminal-vendor').value;
    var body = { vendor_name: vendor };
    if (vendor === 'kpay') {
      body.app_id = document.getElementById('modal-terminal-app-id').value.trim();
      body.app_secret = document.getElementById('modal-terminal-app-secret').value.trim();
      body.terminal_ip = document.getElementById('modal-terminal-ip').value.trim();
      body.terminal_port = parseInt(document.getElementById('modal-terminal-port').value) || null;
      body.endpoint_path = document.getElementById('modal-terminal-endpoint').value.trim();
    } else if (vendor === 'payment-asia') {
      body.merchant_token = document.getElementById('modal-terminal-merchant-token').value.trim();
      body.secret_code = document.getElementById('modal-terminal-secret-code').value.trim();
      body.payment_gateway_env = document.getElementById('modal-terminal-env').value;
    } else if (vendor === 'payment-asia-offline') {
      body.terminal_ip = document.getElementById('modal-terminal-pa-ip').value.trim();
      body.terminal_port = parseInt(document.getElementById('modal-terminal-pa-port').value) || null;
      body.app_secret = document.getElementById('modal-terminal-pa-api-key').value.trim();
    }
    try {
      if (id) {
        await api('PATCH', '/restaurants/' + restaurantId + '/payment-terminals/' + id, body);
        toast('Terminal updated');
      } else {
        await api('POST', '/restaurants/' + restaurantId + '/payment-terminals', body);
        toast('Terminal added');
      }
      consoleCloseModal('modal-terminal');
      _sectionLoaded['settings-payment'] = false;
      csLoadPaymentSettings();
    } catch (e) {
      toast(e.message || 'Failed to save terminal', 'error');
    }
  };

  window.csDeleteTerminal = async function (id) {
    if (!confirm('Delete this payment terminal?')) return;
    try {
      await api('DELETE', '/restaurants/' + restaurantId + '/payment-terminals/' + id);
      toast('Terminal deleted');
      _sectionLoaded['settings-payment'] = false;
      csLoadPaymentSettings();
    } catch (e) {
      toast(e.message || 'Failed to delete terminal', 'error');
    }
  };

  /* ═══════════════════════════════════════════════════════
     SETTINGS — BOOKING
  ═══════════════════════════════════════════════════════ */
  async function csLoadBookingSettings() {
    try {
      var s = await api('GET', '/restaurants/' + restaurantId + '/settings');
      if (!s) return;
      var inp = document.getElementById('cs-booking-allowance');
      if (inp) inp.value = s.booking_time_allowance || 15;
    } catch (e) {
      toast('Failed to load booking settings', 'error');
    }
  }

  window.csSaveBookingSettings = async function () {
    try {
      var minutes = parseInt(document.getElementById('cs-booking-allowance').value) || 15;
      await api('PATCH', '/restaurants/' + restaurantId + '/settings', { booking_time_allowance: minutes });
      toast('Booking settings saved');
      var saved = document.getElementById('cs-booking-saved');
      if (saved) { saved.style.display = 'inline'; setTimeout(function () { saved.style.display = 'none'; }, 3000); }
    } catch (e) {
      toast(e.message || 'Save failed', 'error');
    }
  };

  /* ═══════════════════════════════════════════════════════
     SETTINGS — SERVICE REQUESTS
  ═══════════════════════════════════════════════════════ */
  var _csSrItems = [];

  function csLoadServiceRequests() {
    // Load feature flag state from settings
    api('GET', '/restaurants/' + restaurantId + '/settings').then(function (s) {
      if (!s) return;
      var srEnabled = document.getElementById('cs-sr-enabled');
      if (srEnabled) srEnabled.checked = !!(s.feature_flags && s.feature_flags.service_requests);
    }).catch(function () {});

    // Load service request items from dedicated table
    api('GET', '/restaurants/' + restaurantId + '/service-request-items/all').then(function (items) {
      _csSrItems = (items || []).slice();
      csRenderSrList();
    }).catch(function () {
      toast('Failed to load service requests', 'error');
    });
  }

  function csRenderSrList() {
    var list = document.getElementById('cs-sr-list');
    if (!list) return;
    if (!_csSrItems.length) {
      list.innerHTML = '<p style="text-align:center;color:#9ca3af;padding:20px 0;font-size:13px;">No service requests configured.</p>';
      return;
    }
    var html = _csSrItems.map(function (item, i) {
      var label = (item.label_en || item.label || item.request_type || 'Request');
      return '<div style="display:flex;align-items:center;gap:10px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:10px 14px;">' +
        '<span style="width:12px;height:12px;border-radius:50%;background:' + escHtml(item.color || '#6366f1') + ';flex-shrink:0;display:inline-block;"></span>' +
        '<span style="flex:1;font-size:13.5px;font-weight:600;color:#1f2937;">' + escHtml(label) + (item.label_zh ? ' · ' + escHtml(item.label_zh) : '') + '</span>' +
        '<span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:20px;' + (item.is_active !== false ? 'background:#dcfce7;color:#16a34a;' : 'background:#f3f4f6;color:#9ca3af;') + '">' + (item.is_active !== false ? 'Active' : 'Off') + '</span>' +
        '<button class="console-btn console-btn-sm cs-sr-edit-btn" data-idx="' + i + '">Edit</button>' +
        '<button class="console-btn console-btn-sm console-btn-danger cs-sr-del-btn" data-idx="' + i + '"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>' +
        '</div>';
    }).join('');
    list.innerHTML = html;
    list.querySelectorAll('.cs-sr-edit-btn').forEach(function(btn) {
      btn.onclick = function() { csOpenSrModal(parseInt(btn.dataset.idx)); };
    });
    list.querySelectorAll('.cs-sr-del-btn').forEach(function(btn) {
      btn.onclick = function() { csDeleteSrItem(parseInt(btn.dataset.idx)); };
    });
  }

  window.csSaveServiceRequestsEnabled = async function (enabled) {
    try {
      await api('PATCH', '/restaurants/' + restaurantId + '/settings', { feature_flags: { service_requests: enabled } });
      toast(enabled ? 'Service requests enabled' : 'Service requests disabled');
    } catch (e) {
      toast(e.message || 'Save failed', 'error');
    }
  };

  window.csOpenSrModal = function (idx) {
    var modal = document.getElementById('cs-sr-modal');
    if (!modal) return;
    var editing = document.getElementById('cs-sr-editing-id');
    var typeInp = document.getElementById('cs-sr-type');
    var enInp = document.getElementById('cs-sr-label-en');
    var zhInp = document.getElementById('cs-sr-label-zh');
    var colorInp = document.getElementById('cs-sr-color');
    var activeInp = document.getElementById('cs-sr-active');
    var titleEl = document.getElementById('cs-sr-modal-title');
    if (idx === null) {
      if (titleEl) titleEl.textContent = 'Add Service Request';
      if (editing) editing.value = '';
      if (typeInp) typeInp.value = '';
      if (enInp) enInp.value = '';
      if (zhInp) zhInp.value = '';
      if (colorInp) colorInp.value = '#4f46e5';
      if (activeInp) activeInp.checked = true;
    } else {
      var item = _csSrItems[idx];
      if (!item) return;
      if (titleEl) titleEl.textContent = 'Edit Service Request';
      if (editing) editing.value = String(idx);
      if (typeInp) typeInp.value = item.request_type || '';
      if (enInp) enInp.value = item.label_en || '';
      if (zhInp) zhInp.value = item.label_zh || '';
      if (colorInp) colorInp.value = item.color || '#4f46e5';
      if (activeInp) activeInp.checked = item.is_active !== false;
    }
    modal.style.display = 'flex';
  };

  window.csSaveSrItem = async function () {
    var editing = document.getElementById('cs-sr-editing-id').value;
    var type = document.getElementById('cs-sr-type').value.trim().replace(/[^a-z0-9_]/g, '_');
    var labelEn = document.getElementById('cs-sr-label-en').value.trim();
    var labelZh = document.getElementById('cs-sr-label-zh').value.trim();
    var color = document.getElementById('cs-sr-color').value;
    var active = document.getElementById('cs-sr-active').checked;
    if (!type || !labelEn) { toast('Type and English label are required', 'error'); return; }
    document.getElementById('cs-sr-modal').style.display = 'none';
    try {
      if (editing !== '') {
        var existingItem = _csSrItems[parseInt(editing)];
        if (existingItem && existingItem.id) {
          await api('PATCH', '/restaurants/' + restaurantId + '/service-request-items/' + existingItem.id, {
            request_type: type, label_en: labelEn, label_zh: labelZh || null, color: color, is_active: active
          });
        }
      } else {
        await api('POST', '/restaurants/' + restaurantId + '/service-request-items', {
          request_type: type, label_en: labelEn, label_zh: labelZh || null, color: color, is_active: active, sort_order: _csSrItems.length
        });
      }
      toast('Service request saved');
      csLoadServiceRequests();
    } catch (e) {
      toast(e.message || 'Save failed', 'error');
    }
  };

  window.csDeleteSrItem = async function (idx) {
    var item = _csSrItems[idx];
    if (!item) return;
    if (!confirm('Delete this service request type?')) return;
    try {
      if (item.id) {
        await api('DELETE', '/restaurants/' + restaurantId + '/service-request-items/' + item.id);
      }
      toast('Deleted');
      csLoadServiceRequests();
    } catch (e) {
      toast(e.message || 'Delete failed', 'error');
    }
  };

  /* ═══════════════════════════════════════════════════════
     SETTINGS — STAFF & LOGIN QR
  ═══════════════════════════════════════════════════════ */
  function csLoadStaffLoginLinks() {
    var base = window.location.origin;
    var staffUrl = base + '/login.html?role=staff&restaurantId=' + encodeURIComponent(restaurantId);
    var kitchenUrl = base + '/login.html?role=kitchen&restaurantId=' + encodeURIComponent(restaurantId);
    var sl = document.getElementById('cs-staff-link');
    if (sl) sl.textContent = staffUrl;
    var kl = document.getElementById('cs-kitchen-link');
    if (kl) kl.textContent = kitchenUrl;
    csGenLoginQR('cs-qr-staff', staffUrl);
    csGenLoginQR('cs-qr-kitchen', kitchenUrl);
  }

  function csGenLoginQR(containerId, url) {
    var container = document.getElementById(containerId);
    if (!container) return;
    // Use qrcode.js library if available (loaded via xish-admin.js or console.html)
    if (typeof QRCode !== 'undefined') {
      container.innerHTML = '';
      try {
        new QRCode(container, { text: url, width: 160, height: 160, correctLevel: QRCode.CorrectLevel.M });
      } catch (e) {
        container.innerHTML = '<p style="font-size:11px;color:#9ca3af;word-break:break-all;max-width:160px;">' + escHtml(url) + '</p>';
      }
    } else {
      container.innerHTML = '<p style="font-size:11px;color:#9ca3af;word-break:break-all;max-width:160px;">' + escHtml(url) + '</p>';
    }
  }

  window.csDownloadQR = function (containerId, filename) {
    var container = document.getElementById(containerId);
    if (!container) return;
    var canvas = container.querySelector('canvas');
    if (!canvas) { toast('QR not ready', 'error'); return; }
    var link = document.createElement('a');
    link.download = (filename || 'qr') + '.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  /* ═══════════════════════════════════════════════════════
     SETTINGS — FEATURE FLAGS
  ═══════════════════════════════════════════════════════ */
  var CS_FLAG_LABELS = {
    orders: 'Online Ordering · 線上落單',
    kitchen: 'Kitchen Display · 廚房顯示',
    bookings: 'Reservations / Bookings · 預訂系統',
    members_area: 'Members Area & Loyalty · 會員專區',
    coupons: 'Coupons · 優惠券',
    service_requests: 'Service Requests · 服務請求',
    crm: 'CRM Customer List · 顧客名單',
    allow_custom_food_items: 'Custom Food Items (staff) · 自訂食品項目',
    counter_only: 'Counter / Takeaway Only Mode · 純外賣模式'
  };

  function csLoadFeatureFlags() {
    api('GET', '/restaurants/' + restaurantId + '/settings').then(function (s) {
      if (!s) return;
      var flags = s.feature_flags || {};
      var list = document.getElementById('cs-feature-flags-list');
      if (!list) return;
      var html = Object.keys(CS_FLAG_LABELS).map(function (key) {
        var enabled = !!flags[key];
        return '<div style="display:flex;justify-content:space-between;align-items:center;padding:11px 16px;border-bottom:1px solid #f3f4f6;">' +
          '<span style="font-size:13.5px;color:#1f2937;">' + escHtml(CS_FLAG_LABELS[key]) + '</span>' +
          '<label class="console-toggle"><input type="checkbox" ' + (enabled ? 'checked' : '') + ' onchange="csSaveFlagToggle(\'' + key + '\', this.checked)"><span class="console-toggle-slider"></span></label>' +
          '</div>';
      }).join('');
      list.innerHTML = html || '<p style="color:#9ca3af;text-align:center;padding:20px;">No flags found.</p>';
    }).catch(function () {
      toast('Failed to load feature flags', 'error');
    });
  }

  window.csSaveFlagToggle = async function (key, enabled) {
    try {
      var patch = { feature_flags: {} };
      patch.feature_flags[key] = enabled;
      await api('PATCH', '/restaurants/' + restaurantId + '/settings', patch);
      toast((CS_FLAG_LABELS[key] || key) + ': ' + (enabled ? 'ON' : 'OFF'));
    } catch (e) {
      toast(e.message || 'Save failed', 'error');
    }
  };

})();
