/* ══════════════════════════════════════════════════════════
   queue.js — Customer-facing queue page logic
   ══════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── Config ─────────────────────────────────────────── */
  var API_BASE = '';  // same origin

  /* ── State ──────────────────────────────────────────── */
  var queueToken   = null;  // from URL path /queue/:token
  var restaurantId = null;
  var themeColor   = null;
  var entryId      = null;
  var queueNumber  = null;
  var groupsAhead  = 0;
  var paxBands     = [];

  // Pre-order state
  var qCart = [];          // [{ menuItemId, name, nameZh, priceCents, quantity, variantId, variantLabel }]
  var allCategories = [];
  var allItems = [];
  var activeCatId = null;

  // Status polling
  var currentCalledNumber = null;
  var _pollTimer = null;

  // QR scanner instance
  var html5Scanner = null;
  var scanBusy = false;

  /* ── Helpers ────────────────────────────────────────── */
  function showStep(id) {
    document.querySelectorAll('.q-step').forEach(function (el) {
      el.style.display = 'none';
      el.classList.remove('active');
    });
    var el = document.getElementById(id);
    if (el) { el.style.display = 'flex'; el.classList.add('active'); }
  }

  function fmt(cents) {
    return '$' + (cents / 100).toFixed(0);
  }

  function applyTheme(color) {
    if (!color) return;
    themeColor = color;
    document.documentElement.style.setProperty('--q-accent', color);
  }

  function escHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ── Bilingual ──────────────────────────────────────── */
  function applyBilingual() {
    document.querySelectorAll('[data-zh][data-en]').forEach(function(el) {
      if (el.getAttribute('data-bi')) return; // already processed
      var zh = el.getAttribute('data-zh');
      var en = el.getAttribute('data-en');
      if (!zh || !en) return;
      el.setAttribute('data-bi', '1');
      var tag = el.tagName.toLowerCase();
      if (tag === 'div') {
        el.innerHTML = '<span class="q-bi-zh">' + escHtml(zh) + '</span>'
          + '<span class="q-bi-en">' + escHtml(en) + '</span>';
      } else {
        el.textContent = zh + ' / ' + en;
      }
    });
  }

  /* ── Init ───────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', function () {
    // Extract queue token from URL: /queue/:token
    var parts = window.location.pathname.split('/');
    queueToken = parts[parts.length - 1] || null;

    if (!queueToken) {
      document.getElementById('q-restaurant-name').textContent = 'Invalid link';
      showStep('step-closed');
      return;
    }

    loadQueueStatus();

    // Restore session from localStorage
    var saved = localStorage.getItem('qe_' + queueToken);
    if (saved) {
      try {
        var s = JSON.parse(saved);
        entryId = s.entryId;
        queueNumber = s.queueNumber;
        qCart = s.cart || [];
      } catch (_) {}
    }

    applyBilingual();
  });

  /* ── Load queue status (public) ─────────────────────── */
  async function loadQueueStatus() {
    showStep('step-loading');
    try {
      var res = await fetch(API_BASE + '/api/queue/' + queueToken + '/status');
      var data = await res.json();

      if (!data.enabled) {
        showStep('step-closed');
        return;
      }

      restaurantId = data.restaurant_id;
      paxBands = data.pax_bands || [];
      currentCalledNumber = data.current_called !== undefined ? data.current_called : null;
      applyTheme(data.theme_color);

      // Header
      document.getElementById('q-restaurant-name').textContent = data.restaurant_name || '';
      if (data.logo_url) {
        var logo = document.getElementById('q-logo');
        logo.src = data.logo_url;
        logo.style.display = '';
        logo.onerror = function () { logo.style.display = 'none'; };
      }
      document.title = (data.restaurant_name || 'Queue') + ' — Queue';

      // If we have a saved entry, show number screen
      if (entryId) {
        await refreshEntryStatus();
        return;
      }

      renderPaxBands(data.band_counts || []);
      showStep('step-pax');
    } catch (e) {
      console.error('[Queue]', e);
      showStep('step-closed');
    }
  }

  /* ── Render pax band buttons ─────────────────────────── */
  function renderPaxBands(bandCounts) {
    var container = document.getElementById('q-bands');
    container.innerHTML = '';
    var countMap = {};
    bandCounts.forEach(function (b) { countMap[b.pax_band_label] = parseInt(b.cnt, 10) || 0; });

    paxBands.forEach(function (band) {
      var btn = document.createElement('button');
      btn.className = 'q-band-btn';
      var cnt = countMap[band.label] || 0;
      var waitingText = cnt > 0 ? cnt + ' waiting' : 'No wait';
      btn.innerHTML = '<span class="q-band-label">' + escHtml(band.label) + '</span>'
        + '<span class="q-band-count">' + escHtml(waitingText) + '</span>';
      btn.onclick = function () { qJoinBand(band); };
      container.appendChild(btn);
    });
  }

  /* ── Join with a band ────────────────────────────────── */
  window.qJoinBand = async function (band) {
    var pax = band.min; // use min of band as representative pax
    await joinQueue(pax);
  };

  window.qJoinWithCustomPax = async function () {
    var input = document.getElementById('q-pax-custom-input');
    var pax = parseInt(input ? input.value : '', 10);
    if (!pax || pax < 1) { alert('Please enter a valid number'); return; }
    await joinQueue(pax);
  };

  async function joinQueue(pax) {
    try {
      var res = await fetch(API_BASE + '/api/queue/' + queueToken + '/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pax: pax })
      });
      if (!res.ok) {
        var err = await res.json();
        alert(err.error || 'Failed to join queue');
        return;
      }
      var data = await res.json();
      entryId = data.entry.id;
      queueNumber = data.entry.queue_number;
      groupsAhead = data.groups_ahead;

      // Persist to localStorage
      saveSession();

      showNumberStep();
    } catch (e) {
      alert('Network error — please try again');
    }
  }

  /* ── Show queue number ───────────────────────────────── */
  function showNumberStep() {
    document.getElementById('q-number-display').textContent = queueNumber;
    document.getElementById('q-ahead-count').textContent = groupsAhead;
    // Show currently called number
    var servingWrap = document.getElementById('q-serving-wrap');
    var servingNum = document.getElementById('q-serving-number');
    if (servingWrap && servingNum) {
      if (currentCalledNumber !== null) {
        servingNum.textContent = '#' + currentCalledNumber;
        servingWrap.style.display = '';
      } else {
        servingWrap.style.display = 'none';
      }
    }
    startPolling();
    showStep('step-number');
    applyBilingual();
  }

  /* ── Refresh entry (poll) ────────────────────────────── */
  async function refreshEntryStatus() {
    try {
      var res = await fetch(API_BASE + '/api/queue/entry/' + entryId);
      if (!res.ok) {
        clearSession();
        showStep('step-pax');
        return;
      }
      var data = await res.json();
      if (data.entry.status === 'cancelled') {
        clearSession();
        renderPaxBands([]);
        showStep('step-pax');
        return;
      }
      if (data.entry.status === 'seated') {
        clearSession();
        showStep('step-seated');
        return;
      }
      queueNumber = data.entry.queue_number;
      groupsAhead = data.groups_ahead;
      showNumberStep();
    } catch (e) {
      showStep('step-pax');
    }
  }

  /* ── Cancel queue entry ──────────────────────────────── */
  window.qCancelEntry = async function () {
    if (!confirm('Cancel your queue number?')) return;
    try {
      await fetch(API_BASE + '/api/queue/entry/' + entryId + '/cancel', { method: 'POST' });
    } catch (_) {}
    stopPolling();
    clearSession();
    renderPaxBands([]);
    showStep('step-pax');
  };

  /* ── Status polling ─────────────────────────────────── */
  function startPolling() {
    stopPolling();
    _pollTimer = setInterval(pollQueueStatus, 20000);
  }
  function stopPolling() {
    if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
  }
  async function pollQueueStatus() {
    if (!entryId) { stopPolling(); return; }
    // Refresh current_called from queue status
    try {
      var res = await fetch(API_BASE + '/api/queue/' + queueToken + '/status');
      if (res.ok) {
        var data = await res.json();
        currentCalledNumber = data.current_called !== undefined ? data.current_called : null;
      }
    } catch (_) {}
    await refreshEntryStatus();
  }

  /* ── Session persistence ─────────────────────────────── */
  function saveSession() {
    try {
      localStorage.setItem('qe_' + queueToken, JSON.stringify({
        entryId: entryId,
        queueNumber: queueNumber,
        cart: qCart
      }));
    } catch (_) {}
  }
  function clearSession() {
    entryId = null; queueNumber = null; qCart = [];
    try { localStorage.removeItem('qe_' + queueToken); } catch (_) {}
  }

  /* ══════════════════════════════════════════════════════
     PRE-ORDER MENU
  ══════════════════════════════════════════════════════ */

  window.qStartPreorder = async function () {
    if (!allItems.length) {
      await loadMenu();
    }
    document.getElementById('q-menu-number-badge').textContent = '#' + queueNumber;
    showStep('step-menu');
  };

  window.qBackToNumber = function () {
    showStep('step-number');
  };

  async function loadMenu() {
    var catRes = await fetch(API_BASE + '/api/restaurants/' + restaurantId + '/menu_categories');
    allCategories = await catRes.json();

    var itemRes = await fetch(API_BASE + '/api/restaurants/' + restaurantId + '/menu/staff');
    allItems = await itemRes.json();

    renderCatBar();
    if (allCategories.length > 0) {
      activeCatId = allCategories[0].id;
      renderItems(activeCatId);
    }
  }

  function renderCatBar() {
    var bar = document.getElementById('q-cat-bar');
    bar.innerHTML = '';
    allCategories.forEach(function (cat) {
      var btn = document.createElement('button');
      btn.className = 'q-cat-btn' + (cat.id === activeCatId ? ' active' : '');
      btn.textContent = cat.name_zh || cat.name;
      btn.onclick = function () {
        activeCatId = cat.id;
        document.querySelectorAll('.q-cat-btn').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        renderItems(cat.id);
      };
      bar.appendChild(btn);
    });
  }

  function renderItems(catId) {
    var scroll = document.getElementById('q-items-scroll');
    scroll.innerHTML = '';
    var items = allItems.filter(function (i) { return i.category_id === catId; });
    items.forEach(function (item) {
      var qty = qCartQty(item.id);
      var imgHtml = item.image_url
        ? '<img class="q-item-img" src="' + escHtml(item.image_url) + '" alt="" onerror="this.parentNode.innerHTML=\'<div class=q-item-img-placeholder>🍽</div>\'" />'
        : '<div class="q-item-img-placeholder">🍽</div>';
      var card = document.createElement('div');
      card.className = 'q-item-card';
      card.id = 'q-ic-' + item.id;
      card.innerHTML = imgHtml
        + '<div class="q-item-info">'
        +   '<div class="q-item-name">' + escHtml(item.name_zh || item.name) + '</div>'
        +   (item.description ? '<div class="q-item-desc">' + escHtml(item.description) + '</div>' : '')
        +   '<div class="q-item-price">' + fmt(item.price_cents) + '</div>'
        + '</div>'
        + '<div class="q-item-stepper">'
        +   '<button class="q-stepper-btn minus" style="' + (qty === 0 ? 'visibility:hidden' : '') + '">−</button>'
        +   '<span class="q-stepper-qty" id="q-qty-' + item.id + '">' + (qty || '') + '</span>'
        +   '<button class="q-stepper-btn plus">+</button>'
        + '</div>';
      // Bind events with closure to avoid inline onclick escaping issues
      (function(it) {
        card.querySelector('.q-stepper-btn.minus').onclick = function(e) { e.stopPropagation(); qDecItem(it.id); };
        card.querySelector('.q-stepper-btn.plus').onclick = function(e) { e.stopPropagation(); qIncItem(it.id, it.price_cents, it.name_zh || it.name, it.name); };
      })(item);
      scroll.appendChild(card);
    });
    if (items.length === 0) {
      scroll.innerHTML = '<div style="text-align:center;color:#9ca3af;padding:40px 0;">No items in this category</div>';
    }
  }

  function qCartQty(menuItemId) {
    return qCart.filter(function (c) { return c.menuItemId === menuItemId; })
                .reduce(function (s, c) { return s + c.quantity; }, 0);
  }

  function qCartTotal() {
    return qCart.reduce(function (s, c) { return s + c.priceCents * c.quantity; }, 0);
  }

  function qCartTotalCount() {
    return qCart.reduce(function (s, c) { return s + c.quantity; }, 0);
  }

  window.qIncItem = function (menuItemId, priceCents, nameZh, name) {
    var idx = qCart.findIndex(function (c) { return c.menuItemId === menuItemId && !c.variantId; });
    if (idx >= 0) {
      qCart[idx].quantity++;
    } else {
      qCart.push({ menuItemId: menuItemId, priceCents: priceCents, nameZh: nameZh, name: name, quantity: 1, variantId: null });
    }
    refreshItemStepper(menuItemId);
    refreshCartBar();
    saveSession();
  };

  window.qDecItem = function (menuItemId) {
    var idx = qCart.findIndex(function (c) { return c.menuItemId === menuItemId && !c.variantId; });
    if (idx < 0) return;
    qCart[idx].quantity--;
    if (qCart[idx].quantity <= 0) qCart.splice(idx, 1);
    refreshItemStepper(menuItemId);
    refreshCartBar();
    saveSession();
  };

  function refreshItemStepper(menuItemId) {
    var qty = qCartQty(menuItemId);
    var qtyEl = document.getElementById('q-qty-' + menuItemId);
    if (qtyEl) qtyEl.textContent = qty || '';
    var card = document.getElementById('q-ic-' + menuItemId);
    if (card) {
      var minus = card.querySelector('.q-stepper-btn.minus');
      if (minus) minus.style.visibility = qty === 0 ? 'hidden' : '';
    }
  }

  function refreshCartBar() {
    var bar = document.getElementById('q-cart-bar');
    var count = qCartTotalCount();
    if (count === 0) { bar.style.display = 'none'; return; }
    bar.style.display = 'flex';
    document.getElementById('q-cart-count').textContent = count;
    document.getElementById('q-cart-total').textContent = fmt(qCartTotal());
  }

  /* ── Cart review ─────────────────────────────────────── */
  window.qShowCart = function () {
    renderCartList();
    showStep('step-cart');
  };

  window.qBackToMenu = function () {
    showStep('step-menu');
    refreshCartBar();
  };

  function renderCartList() {
    var list = document.getElementById('q-cart-list');
    list.innerHTML = '';
    qCart.forEach(function (c, i) {
      var row = document.createElement('div');
      row.className = 'q-cart-item';
      row.innerHTML = '<div style="flex:1">'
        + '<div class="q-cart-item-name">' + escHtml(c.nameZh || c.name) + '</div>'
        + (c.variantLabel ? '<div class="q-cart-item-sub">' + escHtml(c.variantLabel) + '</div>' : '')
        + '</div>'
        + '<div class="q-item-stepper">'
        +   '<button class="q-stepper-btn minus" onclick="qCartDec(' + i + ')">−</button>'
        +   '<span class="q-stepper-qty">' + c.quantity + '</span>'
        +   '<button class="q-stepper-btn plus" onclick="qCartInc(' + i + ')">+</button>'
        + '</div>'
        + '<div class="q-cart-item-price">' + fmt(c.priceCents * c.quantity) + '</div>';
      list.appendChild(row);
    });
    document.getElementById('q-cart-total-big').textContent = fmt(qCartTotal());
  }

  window.qCartInc = function (idx) {
    if (qCart[idx]) { qCart[idx].quantity++; renderCartList(); saveSession(); }
  };
  window.qCartDec = function (idx) {
    if (!qCart[idx]) return;
    qCart[idx].quantity--;
    if (qCart[idx].quantity <= 0) qCart.splice(idx, 1);
    renderCartList(); saveSession();
    if (qCart.length === 0) { qBackToMenu(); }
  };

  window.qSkipPreorder = function () {
    qCart = [];
    saveSession();
    showNumberStep();
  };

  /* ══════════════════════════════════════════════════════
     QR SCANNER
  ══════════════════════════════════════════════════════ */

  window.qScanTableQR = function () {
    startScanner();
    showStep('step-scanner');
  };

  window.qCancelScan = function () {
    stopScanner();
    showStep('step-cart');
  };

  function startScanner() {
    if (html5Scanner) { html5Scanner.clear(); html5Scanner = null; }
    scanBusy = false;
    document.getElementById('q-scan-status').textContent = '';

    html5Scanner = new Html5Qrcode('q-scanner-container');
    html5Scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 240, height: 240 } },
      onScanSuccess,
      function () {}
    ).catch(function (e) {
      document.getElementById('q-scan-status').textContent = 'Camera error: ' + e;
    });
  }

  function stopScanner() {
    if (html5Scanner) {
      html5Scanner.stop().catch(function () {});
      html5Scanner = null;
    }
  }

  async function onScanSuccess(decodedText) {
    if (scanBusy) return;
    scanBusy = true;
    stopScanner();

    document.getElementById('q-scan-status').textContent = 'Linking table…';

    // Extract qr_token from URL: /{token} or /?token=...
    var qrToken = extractQrToken(decodedText);
    if (!qrToken) {
      document.getElementById('q-scan-status').textContent = 'Invalid QR — please scan a table QR';
      scanBusy = false;
      startScanner();
      return;
    }

    try {
      var payload = {
        qr_token: qrToken,
        pre_order_items: qCart.map(function (c) {
          return {
            menu_item_id: c.menuItemId,
            quantity: c.quantity,
            variant_id: c.variantId || null
          };
        })
      };
      var res = await fetch(API_BASE + '/api/queue/entry/' + entryId + '/link-table', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        var err = await res.json();
        document.getElementById('q-scan-status').textContent = err.error || 'Failed — try again';
        scanBusy = false;
        startScanner();
        return;
      }
      var data = await res.json();
      clearSession();

      // Redirect to menu page with session
      showStep('step-seated');
      var sub = document.getElementById('step-seated-sub');
      if (sub) sub.textContent = 'Redirecting to ' + (data.table_name || 'your table') + '…';

      // Determine base URL and redirect to table QR landing
      setTimeout(function () {
        var base = window.location.origin;
        window.location.href = base + '/' + qrToken;
      }, 1500);
    } catch (e) {
      document.getElementById('q-scan-status').textContent = 'Network error — please try again';
      scanBusy = false;
      startScanner();
    }
  }

  function extractQrToken(text) {
    // If it's a URL like https://chuio.io/abc123 or https://dev.chuio.io/abc123
    try {
      var url = new URL(text);
      var parts = url.pathname.split('/').filter(Boolean);
      if (parts.length > 0) return parts[parts.length - 1];
    } catch (_) {}
    // Plain token string
    if (/^[a-f0-9]{32,}$/.test(text.trim())) return text.trim();
    return null;
  }

})();
