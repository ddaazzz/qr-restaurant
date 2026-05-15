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
      tiers: 'Member Tiers · 會員等級',
      discounts: 'Discounts · 折扣',
      gifts: 'Gift Cards · 禮品卡',
      coupons: 'Coupons · 優惠券',
      campaigns: 'Campaigns · 推廣活動',
      wallet: 'Wallet Pass · 電子錢包'
    };
    var titleEl = document.getElementById('console-page-title');
    if (titleEl) titleEl.textContent = titles[name] || name;

    // Load data on first visit (or always for dashboard)
    var loyaltySections = ['tiers', 'discounts', 'gifts', 'coupons', 'campaigns', 'wallet'];
    if (loyaltySections.indexOf(name) !== -1) {
      // Delegate to xish-admin.js
      if (_xaOrigSwitch) _xaOrigSwitch.call(window, name, null);
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
  }

  /* ═══════════════════════════════════════════════════════
     DASHBOARD
  ═══════════════════════════════════════════════════════ */
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

      var todayRev = todayOrders.reduce(function (sum, o) { return sum + (parseFloat(o.final_amount || o.total_amount || 0)); }, 0);
      var monthRev = monthOrders.reduce(function (sum, o) { return sum + (parseFloat(o.final_amount || o.total_amount || 0)); }, 0);

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
            var amt = parseFloat(o.final_amount || o.total_amount || 0);
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
      _tableZones = Array.isArray(zones) ? zones : [];
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
        + '🪑 ' + escHtml(zone.name) + ' '
        + '<button class="console-btn console-btn-sm" onclick="consoleOpenAddZoneModal(' + zone.id + ', ' + JSON.stringify(zone.name) + ')">Edit Zone</button> '
        + '<button class="console-btn console-btn-sm console-btn-danger" onclick="consoleDeleteZone(' + zone.id + ', ' + JSON.stringify(zone.name) + ')">Delete Zone</button>'
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
      return '<option value="' + z.id + '"' + (String(z.id) === String(selectedZoneId) ? ' selected' : '') + '>' + escHtml(z.name) + '</option>';
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
      await api('DELETE', '/tables/' + id);
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
    tbody.innerHTML = '<tr><td colspan="6" class="console-empty">Loading…</td></tr>';
    var search = (document.getElementById('crm-mem-search') || {}).value || '';
    var tier = (document.getElementById('crm-mem-tier') || {}).value || '';
    var pageSize = 30;
    var qs = '?limit=' + pageSize + '&offset=' + ((_crmMemPage - 1) * pageSize);
    if (search.trim()) qs += '&search=' + encodeURIComponent(search.trim());
    if (tier) qs += '&tier=' + encodeURIComponent(tier);
    try {
      var data = await api('GET', '/restaurants/' + restaurantId + '/xish/members' + qs);
      var items = Array.isArray(data) ? data : (data && Array.isArray(data.members) ? data.members : []);
      if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="console-empty">No members found.</td></tr>';
        return;
      }
      var tierColors = { platinum: '#7C3AED', gold: '#D97706', silver: '#6B7280', basic: '#374151' };
      tbody.innerHTML = items.map(function (m) {
        var joined = m.created_at ? new Date(m.created_at).toLocaleDateString('zh-HK') : '—';
        var tc = tierColors[m.tier] || '#374151';
        var mid = m.xish_member_id || m.id;
        return '<tr>'
          + '<td>' + escHtml(m.name || '—') + '</td>'
          + '<td>' + escHtml(m.phone || '—') + '</td>'
          + '<td><span style="font-weight:600;color:' + tc + ';text-transform:capitalize;">' + (m.tier || '—') + '</span></td>'
          + '<td>' + (m.points_balance || 0) + '</td>'
          + '<td>' + joined + '</td>'
          + '<td style="white-space:nowrap;">'
          + '<button class="console-btn console-btn-sm" onclick="xaOpenAwardModal(' + mid + ', ' + JSON.stringify(m.name || '') + ')" style="margin-right:4px;">+Pts</button>'
          + '<button class="console-btn console-btn-sm" onclick="xaOpenEditMember(' + mid + ', ' + JSON.stringify(m.name || '') + ', ' + JSON.stringify(m.phone || '') + ', ' + (m.points_balance || 0) + ')">Edit</button>'
          + '</td>'
          + '</tr>';
      }).join('');

      // Pagination
      renderCrmMembersPagination(items.length >= pageSize);
    } catch (e) {
      tbody.innerHTML = '<tr><td colspan="6" class="console-empty" style="color:#e74c3c;">Failed to load members.</td></tr>';
    }
  };

  function renderCrmMembersPagination(hasMore) {
    var pag = document.getElementById('crm-members-pagination');
    if (!pag) return;
    var html = '';
    if (_crmMemPage > 1) html += '<button class="console-page-btn" onclick="consoleCrmMemPrev()">← Prev</button>';
    html += '<button class="console-page-btn active">' + _crmMemPage + '</button>';
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
     INIT
  ═══════════════════════════════════════════════════════ */
  document.addEventListener('DOMContentLoaded', function () {
    consoleLoadRestaurantInfo();
    consoleLoadDashboard();
    // Activate dashboard nav button
    var dashBtn = document.querySelector('.console-nav-btn[data-section="dashboard"]');
    if (dashBtn) dashBtn.classList.add('active');
  });

})();
