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

  window.consoleSwitchSection = function (name, btn) {
    document.querySelectorAll('.console-section').forEach(function (s) { s.classList.remove('active'); });
    document.querySelectorAll('.console-nav-btn').forEach(function (b) { b.classList.remove('active'); });
    if (btn) btn.classList.add('active');

    var target = document.getElementById('section-' + name);
    if (target) target.classList.add('active');

    var titles = {
      dashboard: 'Dashboard',
      menu: 'Menu Management · 菜單管理',
      tables: 'Table Management · 桌台管理',
      queue: 'Queue Management · 排隊管理',
      crm: 'CRM · 顧客管理',
      tiers: 'Members Area · 會員專區',
      discounts: 'Discounts · 折扣',
      gifts: 'Gift Cards · 禮品卡',
      coupons: 'Coupons · 優惠券',
      campaigns: 'Campaigns · 推廣活動',
      wallet: 'Wallet Pass · 電子錢包',
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

    // Load data on first visit (or always for dashboard)
    var loyaltySections = ['tiers', 'campaigns', 'wallet'];
    if (loyaltySections.indexOf(name) !== -1) {
      // Delegate to xish-admin.js
      if (_xaOrigSwitch) _xaOrigSwitch.call(window, name, null);
      if (name === 'tiers') consoleLoadMembersAreaFlags();
    } else if (name === 'coupons') {
      consoleLoadCoupons();
    } else if (name === 'dashboard') {
      consoleLoadDashboard();
    } else if (name === 'menu' && !_sectionLoaded.menu) {
      _sectionLoaded.menu = true;
      consoleLoadMenu();
    } else if (name === 'tables' && !_sectionLoaded.tables) {
      _sectionLoaded.tables = true;
      consoleLoadTables();
    } else if (name === 'queue' && !_sectionLoaded.queue) {
      _sectionLoaded.queue = true;
      consoleLoadQueue();
    } else if (name === 'crm' && !_sectionLoaded.crm) {
      _sectionLoaded.crm = true;
      consoleLoadCrmMembers();
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

  async function consoleLoadMenu() {
    try {
      var cats = await api('GET', '/restaurants/' + restaurantId + '/menu_categories');
      _menuCategories = Array.isArray(cats) ? cats : [];
      renderMenuCategories();
      // Load all items
      var items = await api('GET', '/restaurants/' + restaurantId + '/menu/staff');
      _menuItems = Array.isArray(items) ? items : (items && Array.isArray(items.items) ? items.items : []);
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
      return '<li class="console-cat-item' + (_menuSelectedCatId === c.id ? ' active' : '') + '" onclick="consoleSelectCategory(' + c.id + ', ' + JSON.stringify(c.name) + ')">'
        + '<span>' + escHtml(c.name) + '</span>'
        + '<span class="console-cat-item-actions">'
        + '<button class="console-cat-action-btn" title="Edit" onclick="event.stopPropagation();consoleOpenCategoryModal(' + c.id + ', ' + JSON.stringify(c.name) + ', ' + (c.sort_order || 0) + ')">✏️</button>'
        + '<button class="console-cat-action-btn" title="Delete" onclick="event.stopPropagation();consoleDeleteCategory(' + c.id + ', ' + JSON.stringify(c.name) + ')">🗑</button>'
        + '</span></li>';
    }).join('');
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
      return '<div class="console-item-card">'
        + imgHtml
        + '<div class="console-item-body">'
        + '<div class="console-item-name">' + escHtml(it.name) + '</div>'
        + '<div class="console-item-desc">' + escHtml(it.description || '') + '</div>'
        + '<div class="console-item-price">HK$' + parseFloat(it.price || 0).toFixed(0) + '</div>'
        + '</div>'
        + '<div class="console-item-actions">'
        + '<button class="console-btn console-btn-sm" onclick="consoleOpenItemModal(' + it.id + ')">Edit</button>'
        + '<button class="console-btn console-btn-sm console-btn-danger" onclick="consoleDeleteItem(' + it.id + ', ' + JSON.stringify(it.name) + ')">Delete</button>'
        + '</div>'
        + '</div>';
    }).join('');
  }

  window.consoleFilterItems = function () {
    if (_menuSelectedCatId) {
      var search = (document.getElementById('menu-search') || {}).value || '';
      renderMenuItems(_menuSelectedCatId, search);
    }
  };

  /* ── Category CRUD ── */
  window.consoleOpenCategoryModal = function (id, name, order) {
    document.getElementById('modal-category-title').textContent = id ? 'Edit Category' : 'Add Category';
    document.getElementById('modal-category-id').value = id || '';
    document.getElementById('modal-category-name').value = name || '';
    document.getElementById('modal-category-order').value = order !== undefined ? order : 0;
    openConsoleModal('modal-category');
  };

  window.consoleSaveCategory = async function () {
    var id = document.getElementById('modal-category-id').value;
    var name = document.getElementById('modal-category-name').value.trim();
    var order = parseInt(document.getElementById('modal-category-order').value) || 0;
    if (!name) { toast('Category name is required', 'error'); return; }
    try {
      if (id) {
        await api('PUT', '/menu_categories/' + id, { name: name, sort_order: order });
        toast('Category updated');
      } else {
        await api('POST', '/restaurants/' + restaurantId + '/menu_categories', { name: name, sort_order: order });
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
    document.getElementById('modal-item-desc').value = item ? (item.description || '') : '';
    document.getElementById('modal-item-price').value = item ? (item.price || '') : '';
    document.getElementById('modal-item-order').value = item ? (item.sort_order || 0) : 0;
    // Populate category select
    var sel = document.getElementById('modal-item-category');
    sel.innerHTML = _menuCategories.map(function (c) {
      return '<option value="' + c.id + '"' + (item && String(item.category_id) === String(c.id) ? ' selected' : '') + '>' + escHtml(c.name) + '</option>';
    }).join('');
    if (!item && _menuSelectedCatId) sel.value = _menuSelectedCatId;
    openConsoleModal('modal-item');
  };

  window.consoleSaveItem = async function () {
    var id = document.getElementById('modal-item-id').value;
    var name = document.getElementById('modal-item-name').value.trim();
    var desc = document.getElementById('modal-item-desc').value.trim();
    var price = parseFloat(document.getElementById('modal-item-price').value) || 0;
    var order = parseInt(document.getElementById('modal-item-order').value) || 0;
    var catId = document.getElementById('modal-item-category').value;
    if (!name) { toast('Item name is required', 'error'); return; }
    try {
      var body = { name: name, description: desc, price: price, sort_order: order, category_id: parseInt(catId) };
      if (id) {
        await api('PUT', '/menu-items/' + id, body);
        toast('Item updated');
      } else {
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
      await api('DELETE', '/menu-items/' + id);
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

  window.consoleLoadTables = async function () {
    var container = document.getElementById('tables-zones-container');
    if (!container) return;
    container.innerHTML = '<div class="console-empty">Loading…</div>';
    try {
      var zones = await api('GET', '/restaurants/' + restaurantId + '/table-categories');
      var tables = await api('GET', '/restaurants/' + restaurantId + '/tables');
      var zoneList = Array.isArray(zones) ? zones : [];
      var tableList = Array.isArray(tables) ? tables : [];
      _tableZones = zoneList.map(function (z) {
        return Object.assign({}, z, {
          tables: tableList.filter(function (t) { return String(t.category_id) === String(z.id); })
        });
      });
      renderTableZones();
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
        return '<div class="console-table-cell">'
          + '<div class="console-table-name">' + escHtml(t.name || t.label || '') + '</div>'
          + '<div class="console-table-cap">cap. ' + (t.capacity || t.seats || '—') + '</div>'
          + '<div class="console-table-actions">'
          + '<button class="console-table-action-btn" onclick="consoleOpenEditTableModal(' + t.id + ', ' + JSON.stringify(t.name || t.label || '') + ', ' + (t.capacity || t.seats || 4) + ', ' + zone.id + ')">Edit</button>'
          + '<button class="console-table-action-btn" style="color:#dc2626;" onclick="consoleDeleteTable(' + t.id + ', ' + JSON.stringify(t.name || t.label || '') + ')">Del</button>'
          + '</div></div>';
      }).join('');
      var addBtn = '<div class="console-table-cell" style="border-style:dashed;cursor:pointer;color:#9ca3af;" onclick="consoleOpenAddTableModal(' + zone.id + ')">'
        + '<div style="font-size:22px;margin-bottom:4px;">＋</div>'
        + '<div style="font-size:11px;">Add Table</div>'
        + '</div>';
      return '<div class="console-zone-section">'
        + '<div class="console-zone-title">'
        + '🪑 ' + escHtml(zone.key || zone.name || '') + ' '
        + '<button class="console-btn console-btn-sm" onclick="consoleOpenAddZoneModal(' + zone.id + ', ' + JSON.stringify(zone.key || zone.name || '') + ')">Edit Zone</button> '
        + '<button class="console-btn console-btn-sm console-btn-danger" onclick="consoleDeleteZone(' + zone.id + ', ' + JSON.stringify(zone.key || zone.name || '') + ')">Delete Zone</button>'
        + '</div>'
        + '<div class="console-tables-grid">' + tablesHtml + addBtn + '</div>'
        + '</div>';
    }).join('');
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
          + '<button class="console-btn console-btn-sm" onclick="xaOpenAwardModal(' + mid + ', ' + JSON.stringify(m.name || '') + ')" style="margin-right:4px;">+Pts</button>'
          + '<button class="console-btn console-btn-sm" onclick="xaOpenEditMember(' + mid + ', ' + JSON.stringify(m.name || '') + ', ' + JSON.stringify(m.phone || '') + ', ' + (m.points_balance || 0) + ')">Edit</button>'
          + '</td>'
          + '</tr>';
      }).join('');

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
      renderQueueBands(data.pax_bands || []);
      consoleLoadLiveQueue();
    } catch (e) {
      console.error('[Queue]', e);
    }
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
    tbody.innerHTML = '<tr><td colspan="10" class="console-empty">Loading…</td></tr>';
    try {
      var coupons = await api('GET', '/restaurants/' + restaurantId + '/coupons');
      _allCoupons = Array.isArray(coupons) ? coupons : [];
      if (_allCoupons.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="console-empty">No coupons yet.</td></tr>';
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
          + '<button class="console-btn console-btn-sm console-btn-danger" onclick="consoleDeleteCoupon(' + c.id + ', ' + JSON.stringify(c.code) + ')">Del</button>'
          + '</td></tr>';
      }).join('');
    } catch (e) {
      tbody.innerHTML = '<tr><td colspan="10" class="console-empty" style="color:#e74c3c;">Failed to load coupons.</td></tr>';
    }
  };

  window.consoleOpenCouponModal = function (id) {
    document.getElementById('modal-coupon-title').textContent = id ? 'Edit Coupon' : 'Add Coupon';
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
    if (!code) { toast('Coupon code is required', 'error'); return; }
    if (isNaN(discountValue) || discountValue <= 0) { toast('Please enter a valid discount value', 'error'); return; }
    var body = { code: code, discount_type: discountType, discount_value: discountValue, minimum_order_value: minOrder, max_uses: maxUses, valid_from: validFrom, valid_until: validUntil, coupon_type: couponType, description: description };
    try {
      if (id) {
        await api('PUT', '/coupons/' + id, body);
        toast('Coupon updated');
      } else {
        await api('POST', '/restaurants/' + restaurantId + '/coupons', body);
        toast('Coupon created');
      }
      consoleCloseModal('modal-coupon');
      consoleLoadCoupons();
    } catch (e) {
      toast(e.message || 'Failed to save coupon', 'error');
    }
  };

  window.consoleDeleteCoupon = async function (id, code) {
    if (!confirm('Delete coupon "' + code + '"?')) return;
    try {
      await api('DELETE', '/coupons/' + id);
      toast('Coupon deleted');
      consoleLoadCoupons();
    } catch (e) {
      toast(e.message || 'Failed to delete coupon', 'error');
    }
  };

  /* ═══════════════════════════════════════════════════════
     CRM MEMBER DETAIL
  ═══════════════════════════════════════════════════════ */
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

      var couponsHtml = coupons.length === 0 ? '<p style="color:#9ca3af;font-size:13px;">No eligible coupons.</p>' :
        coupons.map(function (cp) {
          var disc = cp.discount_type === 'percentage' ? cp.discount_value + '% off' : 'HK$' + cp.discount_value + ' off';
          return '<span style="display:inline-block;margin:3px;padding:3px 8px;background:#fef3c7;border:1px solid #fbbf24;border-radius:4px;font-size:12px;">' + escHtml(cp.code) + ' — ' + disc + '</span>';
        }).join('');

      body.innerHTML = '<div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:16px;">'
        + '<div style="flex:1;min-width:180px;background:#f9fafb;border-radius:8px;padding:14px;">'
        + '<div style="font-size:18px;font-weight:700;margin-bottom:4px;">' + escHtml(c.name || '—') + '</div>'
        + '<div style="font-size:12px;color:#6b7280;margin-bottom:2px;">' + escHtml(c.phone || '—') + '</div>'
        + (c.email ? '<div style="font-size:12px;color:#6b7280;margin-bottom:2px;">' + escHtml(c.email) + '</div>' : '')
        + '</div>'
        + '<div style="flex:1;min-width:180px;background:#f9fafb;border-radius:8px;padding:14px;">'
        + '<div style="font-size:12px;color:#6b7280;">Total Spent</div><div style="font-size:16px;font-weight:600;">' + spent + '</div>'
        + '<div style="font-size:12px;color:#6b7280;margin-top:8px;">Visits</div><div style="font-size:16px;font-weight:600;">' + (c.total_visits || 0) + '</div>'
        + '<div style="font-size:12px;color:#6b7280;margin-top:8px;">Last Visit</div><div style="font-size:13px;">' + lastVisit + '</div>'
        + '</div>'
        + '</div>'
        + '<div style="margin-bottom:12px;"><strong style="font-size:13px;">Eligible Coupons</strong><div style="margin-top:6px;">' + couponsHtml + '</div></div>'
        + '<div><strong style="font-size:13px;">Order History</strong><div style="margin-top:6px;">' + ordersHtml + '</div></div>';
    } catch (e) {
      body.innerHTML = '<div class="console-empty" style="color:#e74c3c;">Failed to load member profile.</div>';
    }
  };

  window.consoleViewOrder = function (orderId) {
    // TODO: open order detail if needed
    alert('Order #' + orderId);
  };

  /* ═══════════════════════════════════════════════════════
     MEMBERS AREA FEATURE FLAGS
  ═══════════════════════════════════════════════════════ */
  window.consoleLoadMembersAreaFlags = async function () {
    try {
      var data = await api('GET', '/restaurants/' + restaurantId + '/settings');
      var flags = (data && data.feature_flags) || {};
      var membersOn = flags.members_area !== false;
      var couponsOn = flags.coupons !== false;
      var membersEl = document.getElementById('flag-members-area');
      var couponsEl = document.getElementById('flag-coupons');
      var couponsWrap = document.getElementById('flag-coupons-wrap');
      if (membersEl) membersEl.checked = membersOn;
      if (couponsEl) {
        couponsEl.checked = couponsOn;
        couponsEl.disabled = !membersOn;
      }
      if (couponsWrap) couponsWrap.style.opacity = membersOn ? '' : '0.4';
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
      var toggle = function (id, val) { var el = document.getElementById(id); if (el) el.checked = !!val; };
      toggle('signup-wallet-pass-toggle', s.wallet_pass_enabled);
      toggle('signup-google-toggle', s.google_oauth && s.google_oauth.enabled);
      toggle('signup-wechat-toggle', s.wechat && s.wechat.enabled);
      var gc = document.getElementById('signup-google-client-id');
      if (gc && s.google_oauth) gc.value = s.google_oauth.client_id || '';
      var wai = document.getElementById('signup-wechat-app-id');
      if (wai && s.wechat) wai.value = s.wechat.app_id || '';
      var was = document.getElementById('signup-wechat-app-secret');
      if (was && s.wechat) was.value = s.wechat.app_secret || '';
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
      var wechatAppSecret = document.getElementById('signup-wechat-app-secret').value.trim();
      await api('PATCH', '/restaurants/' + restaurantId + '/settings', {
        wallet_pass_enabled: walletEnabled,
        google_oauth: { enabled: googleEnabled, client_id: googleClientId },
        wechat: { enabled: wechatEnabled, app_id: wechatAppId, app_secret: wechatAppSecret }
      });
      toast('Sign-up methods saved');
      var saved = document.getElementById('signup-methods-saved');
      if (saved) { saved.style.display = 'inline'; setTimeout(function () { saved.style.display = 'none'; }, 3000); }
    } catch (e) {
      toast(e.message || 'Save failed', 'error');
    }
  };

  /* ═══════════════════════════════════════════════════════
     LOYALTY PASS SETTINGS
  ═══════════════════════════════════════════════════════ */
  async function consoleLoadLoyaltyPassSettings() {
    try {
      var s = await api('GET', '/restaurants/' + restaurantId + '/settings');
      if (!s) return;
      var lp = s.loyalty_pass || {};
      var stamp = lp.stamp_card || {};
      var toggle = function (id, val) { var el = document.getElementById(id); if (el) el.checked = !!val; };
      toggle('lp-stamp-toggle', stamp.enabled);
      consoleToggleLpSection('stamp', !!stamp.enabled);
      var sc = document.getElementById('lp-stamp-count');
      if (sc) sc.value = stamp.stamps_required || 10;
      var sr = document.getElementById('lp-stamp-reward');
      if (sr) sr.value = stamp.reward_description || '';
      toggle('lp-points-toggle', lp.points !== false);
      toggle('lp-vip-toggle', lp.vip !== false);
      var display = lp.display || {};
      toggle('lp-show-qr', display.show_qr !== false);
      toggle('lp-show-points', display.show_points !== false);
      toggle('lp-show-stamps', !!display.show_stamps);
      // Show tier names in VIP config area
      var tierPreview = document.getElementById('lp-vip-tiers-preview');
      if (tierPreview && s.tiers && Array.isArray(s.tiers)) {
        tierPreview.innerHTML = s.tiers.map(function (t) {
          return '<span style="display:inline-block;background:#f3f4f6;border-radius:6px;padding:2px 10px;margin-right:6px;margin-bottom:4px;font-size:12px;">' + escHtml(t.name || t.tier_name || 'Tier') + '</span>';
        }).join('');
      }
    } catch (e) {
      toast('Failed to load loyalty pass settings', 'error');
    }
  }

  window.consoleToggleLpSection = function (section, show) {
    var cfg = document.getElementById('lp-' + section + '-config');
    if (cfg) cfg.style.display = show ? 'block' : 'none';
  };

  window.consoleSaveLoyaltyPass = async function () {
    try {
      var stampEnabled = document.getElementById('lp-stamp-toggle').checked;
      var stampCount = parseInt(document.getElementById('lp-stamp-count').value) || 10;
      var stampReward = document.getElementById('lp-stamp-reward').value.trim();
      var pointsEnabled = document.getElementById('lp-points-toggle').checked;
      var vipEnabled = document.getElementById('lp-vip-toggle').checked;
      var showQr = document.getElementById('lp-show-qr').checked;
      var showPoints = document.getElementById('lp-show-points').checked;
      var showStamps = document.getElementById('lp-show-stamps').checked;
      await api('PATCH', '/restaurants/' + restaurantId + '/settings', {
        loyalty_pass: {
          stamp_card: { enabled: stampEnabled, stamps_required: stampCount, reward_description: stampReward },
          points: pointsEnabled,
          vip: vipEnabled,
          display: { show_qr: showQr, show_points: showPoints, show_stamps: showStamps }
        }
      });
      toast('Loyalty pass settings saved');
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
    } catch (e) {
      toast('Failed to load QR settings', 'error');
    }
  }

  window.csSaveVenueType = async function (value) {
    var desc = document.getElementById('cs-venue-desc');
    if (desc) desc.textContent = CS_VENUE_DESCS[value] || '';
    try {
      var patch = { venue_type: value };
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
        '<button class="console-btn console-btn-sm console-btn-danger" onclick="csRemoveBanner(' + i + ')">✕</button>' +
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
      _csPaymentMethods = (s.custom_payment_methods || []).slice();
      csRenderPaymentMethods();
      csRenderTerminals(s);
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
      await api('PATCH', '/restaurants/' + restaurantId + '/settings', { custom_payment_methods: _csPaymentMethods });
    } catch (e) {
      toast('Failed to save payment methods', 'error');
    }
  }

  function csRenderTerminals(s) {
    var el = document.getElementById('cs-terminals-list');
    if (!el) return;
    var html = '';
    var term = s.payment_terminals || s.terminals || {};
    // KPay
    var kpay = term.kpay || s.kpay || {};
    html += '<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px;margin-bottom:8px;display:flex;align-items:flex-start;gap:14px;">' +
      '<div style="flex:1;"><div style="font-size:14px;font-weight:700;margin-bottom:4px;">KPay Terminal</div>' +
      '<div style="font-size:12px;color:#6b7280;">Payment terminal integration. Requires KPay merchant credentials.</div></div>' +
      '<span style="font-size:12px;font-weight:600;padding:3px 10px;border-radius:20px;' + (kpay.enabled ? 'background:#dcfce7;color:#16a34a;' : 'background:#f3f4f6;color:#9ca3af;') + '">' + (kpay.enabled ? 'Active' : 'Inactive') + '</span>' +
      '</div>';
    // Payment Asia
    var pa = term.payment_asia || s.payment_asia || {};
    html += '<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px;margin-bottom:8px;display:flex;align-items:flex-start;gap:14px;">' +
      '<div style="flex:1;"><div style="font-size:14px;font-weight:700;margin-bottom:4px;">Payment Asia</div>' +
      '<div style="font-size:12px;color:#6b7280;">Online card payment gateway. Requires Payment Asia credentials.</div></div>' +
      '<span style="font-size:12px;font-weight:600;padding:3px 10px;border-radius:20px;' + (pa.enabled ? 'background:#dcfce7;color:#16a34a;' : 'background:#f3f4f6;color:#9ca3af;') + '">' + (pa.enabled ? 'Active' : 'Inactive') + '</span>' +
      '</div>';
    html += '<p style="font-size:12px;color:#9ca3af;margin-top:8px;">To configure or activate a payment terminal, please contact <a href="mailto:support@chuio.com" style="color:#A10035;">support@chuio.com</a>.</p>';
    el.innerHTML = html;
  }

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
    api('GET', '/restaurants/' + restaurantId + '/settings').then(function (s) {
      if (!s) return;
      var srEnabled = document.getElementById('cs-sr-enabled');
      if (srEnabled) srEnabled.checked = !!(s.feature_flags && s.feature_flags.service_requests);
      _csSrItems = (s.service_request_types || []).slice();
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
    list.innerHTML = _csSrItems.map(function (item, i) {
      var label = (item.label_en || item.label || item.type || 'Request');
      return '<div style="display:flex;align-items:center;gap:10px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:10px 14px;">' +
        '<span style="width:12px;height:12px;border-radius:50%;background:' + escHtml(item.color || '#6366f1') + ';flex-shrink:0;display:inline-block;"></span>' +
        '<span style="flex:1;font-size:13.5px;font-weight:600;color:#1f2937;">' + escHtml(label) + (item.label_zh ? ' · ' + escHtml(item.label_zh) : '') + '</span>' +
        '<span style="font-size:11px;font-weight:600;padding:2px 8px;border-radius:20px;' + (item.active !== false ? 'background:#dcfce7;color:#16a34a;' : 'background:#f3f4f6;color:#9ca3af;') + '">' + (item.active !== false ? 'Active' : 'Off') + '</span>' +
        '<button class="console-btn console-btn-sm" onclick="csOpenSrModal(' + i + ')">Edit</button>' +
        '<button class="console-btn console-btn-sm console-btn-danger" onclick="csDeleteSrItem(' + i + ')">✕</button>' +
        '</div>';
    }).join('');
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
      // New
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
      if (typeInp) typeInp.value = item.type || '';
      if (enInp) enInp.value = item.label_en || item.label || '';
      if (zhInp) zhInp.value = item.label_zh || '';
      if (colorInp) colorInp.value = item.color || '#4f46e5';
      if (activeInp) activeInp.checked = item.active !== false;
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
    var item = { type: type, label: labelEn, label_en: labelEn, label_zh: labelZh, color: color, active: active };
    if (editing !== '') {
      _csSrItems[parseInt(editing)] = item;
    } else {
      _csSrItems.push(item);
    }
    document.getElementById('cs-sr-modal').style.display = 'none';
    try {
      await api('PATCH', '/restaurants/' + restaurantId + '/settings', { service_request_types: _csSrItems });
      toast('Service request saved');
      csRenderSrList();
    } catch (e) {
      toast(e.message || 'Save failed', 'error');
    }
  };

  window.csDeleteSrItem = async function (idx) {
    _csSrItems.splice(idx, 1);
    csRenderSrList();
    try {
      await api('PATCH', '/restaurants/' + restaurantId + '/settings', { service_request_types: _csSrItems });
      toast('Deleted');
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
