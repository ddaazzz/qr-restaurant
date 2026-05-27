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

  window.consoleSwitchSection = function (name, btn) {
    // Stop live queue auto-refresh when leaving queue section
    if (name !== 'queue' && _liveQueueTimer) { clearInterval(_liveQueueTimer); _liveQueueTimer = null; }
    // Stop tables auto-refresh when leaving tables section
    if (name !== 'tables' && _tablesAutoRefreshTimer) { clearInterval(_tablesAutoRefreshTimer); _tablesAutoRefreshTimer = null; }
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
      return '<li class="console-cat-item' + (_menuSelectedCatId === c.id ? ' active' : '') + '" draggable="true" data-catid="' + c.id + '" data-catname="' + escHtml(c.name) + '">'
        + '<span class="console-cat-drag-handle" title="Drag to reorder">⠿</span>'
        + '<span style="flex:1;">' + escHtml(c.name) + '</span>'
        + '<span class="console-cat-item-actions">'
        + '<button class="console-cat-action-btn cat-edit-btn" title="Edit" data-catid="' + c.id + '" data-catname="' + escHtml(c.name) + '">✏️</button>'
        + '<button class="console-cat-action-btn cat-del-btn" title="Delete" data-catid="' + c.id + '" data-catname="' + escHtml(c.name) + '">🗑</button>'
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
          + ' <button type="button" class="cv-opt-del" onclick="consoleDeleteVariantOpt(' + o.id + ',' + v.id + ',' + itemId + ')">✕</button></span>';
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
        + '<button type="button" class="console-btn console-btn-sm" onclick="consoleShowAddOptForm(' + v.id + ',' + itemId + ')">＋ Add Option</button>'
        + '<div class="cv-opt-form" id="cv-opt-form-' + v.id + '" style="display:none;margin-top:6px;">'
        + '<input type="text" class="console-input" id="cv-opt-name-' + v.id + '" placeholder="Option name" style="width:120px;margin-right:4px;" />'
        + '<input type="number" class="console-input" id="cv-opt-price-' + v.id + '" placeholder="Price ±cents" style="width:80px;margin-right:4px;" />'
        + '<button type="button" class="console-btn console-btn-sm console-btn-primary" onclick="consoleSaveNewOpt(' + v.id + ',' + itemId + ')">Add</button>'
        + '<button type="button" class="console-btn console-btn-sm" onclick="document.getElementById(\'cv-opt-form-' + v.id + '\').style.display=\'none\'">Cancel</button>'
        + '</div></div>'
        + '</div>';
    }).join('');
    sec.innerHTML = '<div style="margin-top:12px;border-top:1px solid #e5e7eb;padding-top:10px;">'
      + '<div style="display:flex;align-items:center;margin-bottom:8px;">'
      + '<span style="font-size:12px;font-weight:600;color:#374151;">Variants / Options</span>'
      + '<button type="button" class="console-btn console-btn-sm console-btn-primary" style="margin-left:auto;" onclick="consoleShowAddVariantForm(' + itemId + ')">＋ Add Variant</button>'
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
    row.innerHTML = '<div style="background:#fff9e6;border:1px solid #fde68a;border-radius:6px;padding:8px;margin-bottom:4px;">'
      + '<div style="display:grid;grid-template-columns:1fr auto auto auto;gap:6px;align-items:center;margin-bottom:6px;">'
      + '<input type="text" class="console-input" id="cv-edit-v-name-' + variantId + '" value="' + escHtml(v.name) + '" />'
      + '<input type="number" class="console-input" id="cv-edit-v-min-' + variantId + '" value="' + (v.min_select != null ? v.min_select : '') + '" placeholder="Min" style="width:60px;" />'
      + '<input type="number" class="console-input" id="cv-edit-v-max-' + variantId + '" value="' + (v.max_select != null ? v.max_select : '') + '" placeholder="Max" style="width:60px;" />'
      + '<label style="display:flex;align-items:center;gap:4px;font-size:12px;white-space:nowrap;"><input type="checkbox" id="cv-edit-v-req-' + variantId + '"' + (v.required ? ' checked' : '') + ' /> Req</label>'
      + '</div>'
      + '<div style="display:flex;gap:6px;">'
      + '<button type="button" class="console-btn console-btn-sm console-btn-primary" onclick="consoleSaveEditVariant(' + variantId + ',' + itemId + ')">Save</button>'
      + '<button type="button" class="console-btn console-btn-sm" onclick="consoleRenderItemVariants(' + itemId + ')">Cancel</button>'
      + '</div></div>';
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
      var opt = await api('POST', '/variant-options', { variant_id: variantId, name, price_cents: price });
      var v = _consoleItemVariants.find(function(x) { return x.id === variantId; });
      if (v) { if (!v.options) v.options = []; v.options.push(opt); }
      consoleRenderItemVariants(itemId);
    } catch(e) { toast('Failed to add option', 'error'); }
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
    try {
      if (id) {
        var body = { name: name, name_zh: name_zh, description: desc, price_cents: price_cents, category_id: parseInt(catId), is_meal_combo: isCombo, restaurantId: restaurantId };
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
        + '<div style="font-size:22px;margin-bottom:4px;">＋</div>'
        + '<div style="font-size:11px;">Add Table</div>'
        + '</div>';
      return '<div class="console-zone-section" draggable="true" data-zoneid="' + zone.id + '">'
        + '<div class="console-zone-title">'
        + '<span class="console-zone-drag-handle" title="Drag to reorder zones">⠿</span>'
        + '🪑 ' + escHtml(zone.key || zone.name || '') + ' '
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
      if (order.cp_refund_amount_cents) payBlock += '<div style="background:#fee2e2;border-radius:5px;padding:8px 10px;font-size:12px;margin-top:6px;"><strong style="color:#dc2626;">Refund: HK$' + (order.cp_refund_amount_cents/100).toFixed(2) + '</strong>' + (order.cp_refunded_at ? '<div style="color:#b91c1c;margin-top:2px;">Refunded at ' + new Date(order.cp_refunded_at).toLocaleString() + '</div>' : '') + '</div>';
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

  window.consoleSetReportRange = function (range, btn) {
    _reportRange = range;
    document.querySelectorAll('.console-report-range-btn').forEach(function (b) { b.classList.remove('active-range'); });
    if (btn) btn.classList.add('active-range');
    consoleLoadReports();
  };

  window.consoleLoadReports = async function () {
    var daysMap = { today: 1, week: 7, month: 30, all: 9999 };
    var days = daysMap[_reportRange] || 30;
    // Set KPI to loading
    ['rpt-revenue','rpt-orders','rpt-avg-bill','rpt-discounts','rpt-net','rpt-avg-day'].forEach(function(id) {
      var el = document.getElementById(id); if (el) el.textContent = '…';
    });
    try {
      var limitVal = days >= 9999 ? 1000 : days * 50;
      var [orders, topItems] = await Promise.all([
        api('GET', '/restaurants/' + restaurantId + '/orders?limit=' + limitVal),
        api('GET', '/restaurants/' + restaurantId + '/reports/top-items?days=' + days).catch(function() { return []; })
      ]);
      if (!Array.isArray(orders)) orders = [];

      // Filter by date range
      var now = Date.now();
      if (days < 9999) {
        orders = orders.filter(function(o) {
          return (now - new Date(o.created_at).getTime()) / 86400000 <= days;
        });
      }

      var totalRevenue = 0, totalDiscount = 0, totalOrders = orders.length;
      var revenueByDay = {}, revenueByHour = {};
      var payByMethod = {}, statusCount = {}, typeCount = {};

      orders.forEach(function(o) {
        var rev = parseInt(o.total_cents) || 0;
        var disc = parseInt(o.discount_cents) || 0;
        totalRevenue += rev;
        totalDiscount += disc;

        var dateStr = new Date(o.created_at).toLocaleDateString('en-HK', { timeZone: 'Asia/Hong_Kong', year: 'numeric', month: '2-digit', day: '2-digit' });
        if (!revenueByDay[dateStr]) revenueByDay[dateStr] = { rev: 0, orders: 0, disc: 0 };
        revenueByDay[dateStr].rev += rev;
        revenueByDay[dateStr].orders++;
        revenueByDay[dateStr].disc += disc;

        var hour = new Date(o.created_at).toLocaleString('en-HK', { timeZone: 'Asia/Hong_Kong', hour: '2-digit', hour12: false });
        var hKey = (hour || '00') + ':00';
        if (!revenueByHour[hKey]) revenueByHour[hKey] = { rev: 0, orders: 0 };
        revenueByHour[hKey].rev += rev;
        revenueByHour[hKey].orders++;

        var pm = o.cp_vendor || o.payment_method_online || 'cash';
        payByMethod[pm] = (payByMethod[pm] || 0) + rev;

        var st = o.status || 'unknown';
        statusCount[st] = (statusCount[st] || 0) + 1;

        var ot = o.order_type || 'counter';
        typeCount[ot] = (typeCount[ot] || 0) + 1;
      });

      var avgBill = totalOrders > 0 ? totalRevenue / totalOrders : 0;
      var netSales = totalRevenue - totalDiscount;
      var dayKeys = Object.keys(revenueByDay);
      var numDays = dayKeys.length || 1;
      var avgPerDay = totalRevenue / numDays;

      // Update KPI
      var kpi = { 'rpt-revenue': 'HK$'+(totalRevenue/100).toFixed(0), 'rpt-orders': totalOrders,
        'rpt-avg-bill': 'HK$'+(avgBill/100).toFixed(0), 'rpt-discounts': 'HK$'+(totalDiscount/100).toFixed(0),
        'rpt-net': 'HK$'+(netSales/100).toFixed(0), 'rpt-avg-day': 'HK$'+(avgPerDay/100).toFixed(0) };
      Object.keys(kpi).forEach(function(k) { var el = document.getElementById(k); if (el) el.textContent = kpi[k]; });

      // Revenue by Day table
      var byDayTbody = document.getElementById('rpt-by-day-tbody');
      if (byDayTbody) {
        var dates = Object.keys(revenueByDay).sort().reverse();
        byDayTbody.innerHTML = dates.length === 0 ? '<tr><td colspan="4" class="console-empty">No data</td></tr>'
          : dates.map(function(d) {
              var row = revenueByDay[d];
              return '<tr><td>' + d + '</td><td>' + row.orders + '</td>'
                + '<td style="color:#f59e0b;">' + (row.disc > 0 ? '-HK$'+(row.disc/100).toFixed(0) : '—') + '</td>'
                + '<td style="font-weight:700;color:#A10035;">HK$' + (row.rev/100).toFixed(0) + '</td></tr>';
            }).join('');
      }

      // Busiest hours bar chart (text-based)
      var byHourEl = document.getElementById('rpt-by-hour');
      if (byHourEl) {
        var hours = Object.keys(revenueByHour).sort();
        var maxOrders = Math.max.apply(null, hours.map(function(h) { return revenueByHour[h].orders; })) || 1;
        byHourEl.innerHTML = hours.length === 0 ? '<p style="color:#9ca3af;font-size:13px;text-align:center;padding:20px;">No data</p>'
          : hours.map(function(h) {
              var data = revenueByHour[h];
              var pct = Math.round((data.orders / maxOrders) * 100);
              return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;font-size:12px;">'
                + '<span style="width:44px;color:#6b7280;">' + h + '</span>'
                + '<div style="flex:1;background:#f3f4f6;border-radius:4px;height:18px;">'
                + '<div style="width:' + pct + '%;background:#A10035;height:18px;border-radius:4px;transition:width .3s;"></div></div>'
                + '<span style="width:28px;text-align:right;font-weight:600;">' + data.orders + '</span>'
                + '</div>';
            }).join('');
      }

      // Top items
      var topItemsEl = document.getElementById('rpt-top-items');
      if (topItemsEl) {
        var ti = Array.isArray(topItems) ? topItems.slice(0, 15) : [];
        var maxQty = ti.length > 0 ? (parseInt(ti[0].total_quantity) || 1) : 1;
        topItemsEl.innerHTML = ti.length === 0 ? '<p style="color:#9ca3af;font-size:13px;text-align:center;padding:20px;">No data</p>'
          : ti.map(function(item) {
              var qty = parseInt(item.total_quantity) || 0;
              var rev = parseInt(item.total_revenue) || 0;
              var pct = Math.round((qty / maxQty) * 100);
              return '<div style="margin-bottom:8px;">'
                + '<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px;">'
                + '<span style="font-weight:600;color:#111;">' + escHtml(item.name || '?') + '</span>'
                + '<span style="color:#6b7280;">' + qty + ' sold · HK$' + (rev/100).toFixed(0) + '</span></div>'
                + '<div style="background:#f3f4f6;border-radius:4px;height:6px;">'
                + '<div style="width:' + pct + '%;background:#A10035;height:6px;border-radius:4px;"></div></div>'
                + '</div>';
            }).join('');
      }

      // Order types
      var orderTypesEl = document.getElementById('rpt-order-types');
      if (orderTypesEl) {
        var typeKeys = Object.keys(typeCount);
        var typeLabels = { table: 'Table', 'to-go': 'To-Go / Takeaway', counter: 'Counter' };
        orderTypesEl.innerHTML = typeKeys.length === 0 ? '<p style="color:#9ca3af;font-size:13px;text-align:center;padding:20px;">No data</p>'
          : typeKeys.map(function(k) {
              var pct = Math.round((typeCount[k] / totalOrders) * 100);
              return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">'
                + '<span style="width:120px;font-size:13px;">' + (typeLabels[k] || k) + '</span>'
                + '<div style="flex:1;background:#f3f4f6;border-radius:4px;height:20px;">'
                + '<div style="width:' + pct + '%;background:#667eea;height:20px;border-radius:4px;"></div></div>'
                + '<span style="width:60px;text-align:right;font-size:12px;color:#6b7280;">' + typeCount[k] + ' (' + pct + '%)</span>'
                + '</div>';
            }).join('');
      }

      // Payment methods
      var pmEl = document.getElementById('rpt-payment-methods');
      if (pmEl) {
        var pmLabels = { kpay: 'KPay Terminal', 'payment-asia': 'PA Online', 'payment-asia-offline': 'PA Terminal', cash: 'Cash', card: 'Card' };
        var pmKeys = Object.keys(payByMethod);
        var maxPmRev = Math.max.apply(null, pmKeys.map(function(k) { return payByMethod[k]; })) || 1;
        pmEl.innerHTML = pmKeys.length === 0 ? '<p style="color:#9ca3af;font-size:13px;text-align:center;padding:20px;">No data</p>'
          : pmKeys.map(function(k) {
              var rev = payByMethod[k];
              var pct = Math.round((rev / maxPmRev) * 100);
              return '<div style="margin-bottom:8px;">'
                + '<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px;">'
                + '<span style="font-weight:600;">' + (pmLabels[k] || k) + '</span>'
                + '<span style="color:#A10035;">HK$' + (rev/100).toFixed(0) + '</span></div>'
                + '<div style="background:#f3f4f6;border-radius:4px;height:8px;">'
                + '<div style="width:' + pct + '%;background:#10b981;height:8px;border-radius:4px;"></div></div>'
                + '</div>';
            }).join('');
      }

      // Status breakdown
      var stEl = document.getElementById('rpt-status-breakdown');
      if (stEl) {
        var stColors = { pending: '#3b82f6', completed: '#10b981', cancelled: '#ef4444' };
        var stKeys = Object.keys(statusCount);
        stEl.innerHTML = stKeys.length === 0 ? '<p style="color:#9ca3af;font-size:13px;text-align:center;padding:20px;">No data</p>'
          : stKeys.map(function(k) {
              var n = statusCount[k];
              var pct = Math.round((n / totalOrders) * 100);
              var col = stColors[k] || '#6b7280';
              return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">'
                + '<span style="width:90px;font-size:13px;text-transform:capitalize;">' + k + '</span>'
                + '<div style="flex:1;background:#f3f4f6;border-radius:4px;height:20px;">'
                + '<div style="width:' + pct + '%;background:' + col + ';height:20px;border-radius:4px;"></div></div>'
                + '<span style="width:60px;text-align:right;font-size:12px;color:#6b7280;">' + n + ' (' + pct + '%)</span>'
                + '</div>';
            }).join('');
      }

    } catch (e) {
      console.error('[Reports]', e);
      toast('Failed to load reports', 'error');
    }
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

  // Stamp icons available for selection
  var LP_STAMP_ICONS = ['☕','⭐','🍕','🍜','❤️','🌸','🎁','🍺','🍣','🍰','🌟','🔥'];

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
    stamp:  { enabled: true,  stamps_required: 10, reward_description: 'Free Coffee', icon: '☕' },
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
    var cur = lpState.stamp.icon || '☕';
    grid.innerHTML = LP_STAMP_ICONS.map(function(ic) {
      return '<button class="lp-icon-btn' + (ic === cur ? ' active' : '') + '" data-icon="' + ic + '" onclick="lpSelectIcon(\'' + ic + '\')" title="' + ic + '">' + ic + '</button>';
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
    var icon   = lpState.stamp.icon || '☕';
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
      var cells = '';
      for (var i = 0; i < count; i++) {
        var filled = i < filledCount;
        cells += '<div class="lp-stamp-cell' + (filled ? ' filled' : '') + '" style="background:' + (filled ? accent : 'rgba(255,255,255,.12)') + ';font-size:' + (count > 12 ? '10px' : '14px') + ';">' + (filled ? icon : '') + '</div>';
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

  window.consoleSaveLoyaltyPass = async function () {
    try {
      lpReadAll();
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
        '<button class="console-btn console-btn-sm console-btn-danger cs-sr-del-btn" data-idx="' + i + '">✕</button>' +
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
