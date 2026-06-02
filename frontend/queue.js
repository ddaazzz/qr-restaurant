/* ══════════════════════════════════════════════════════════
   queue.js v4 — Customer-facing queue page
   ══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── i18n ───────────────────────────────────────────── */
  var LANGS = ['zh', 'en'];
  var LANG_LABELS = { zh: '中', en: 'EN' };
  var STRINGS = {
    zh: {
      'loading':        'Loading…',
      'closed-title':   '排隊未開放',
      'closed-sub':     '目前暫停網上取號。',
      'pax-title':      '幾位用餐？',
      'pax-sub':        '請輸入人數，再按確認',
      'confirm':        '確認',
      'clear':          '清除',
      'back':           '返回',
      'next':           '下一步',
      'contact-title':  '聯絡資料',
      'contact-sub':    '請填寫以下資料',
      'contact-name':   '姓名',
      'contact-phone':  '電話號碼',
      'contact-email':  '電郵地址',
      'your-number':    '您的取號',
      'ahead-label':    '組在您前面',
      'now-serving':    '現正叫號',
      'cancel-queue':   '取消取號',
      'seated-title':   '入座成功！',
      'seated-sub':     '祝您用餐愉快！',
      'group-hint':     '→ 隊伍 {letter}（{pax_min}–{pax_max}位）',
      'no-wait':        '無需等候',
      'groups-waiting': '{n}組等候中'
    },
    en: {
      'loading':        'Loading…',
      'closed-title':   'Queue Not Active',
      'closed-sub':     'Online queuing is currently unavailable.',
      'pax-title':      'Party size?',
      'pax-sub':        'Enter number of guests, then confirm',
      'confirm':        'Confirm',
      'clear':          'Clear',
      'back':           'Back',
      'next':           'Next',
      'contact-title':  'Contact Details',
      'contact-sub':    'Please fill in your details',
      'contact-name':   'Name',
      'contact-phone':  'Phone number',
      'contact-email':  'Email address',
      'your-number':    'Your queue number',
      'ahead-label':    'group(s) ahead',
      'now-serving':    'Now serving',
      'cancel-queue':   'Cancel queue number',
      'seated-title':   'Seated!',
      'seated-sub':     'Enjoy your meal!',
      'group-hint':     '→ Group {letter} ({pax_min}–{pax_max} pax)',
      'no-wait':        'No wait',
      'groups-waiting': '{n} waiting'
    }
  };

  var lang = 'zh';
  function t(key, vars) {
    var s = (STRINGS[lang] || STRINGS.zh)[key] || key;
    if (vars) Object.keys(vars).forEach(function(k){ s = s.replace('{'+k+'}', vars[k]); });
    return s;
  }
  function applyLang() {
    document.querySelectorAll('[data-i18n]').forEach(function(el) {
      var key = el.getAttribute('data-i18n');
      el.textContent = t(key);
    });
    var langLabel = document.getElementById('q-lang-label');
    if (langLabel) langLabel.textContent = LANG_LABELS[lang] || lang;
  }
  window.qCycleLang = function() {
    var idx = LANGS.indexOf(lang);
    lang = LANGS[(idx + 1) % LANGS.length];
    applyLang();
    updateGroupHint();
    showNumberStep(); // refresh if on ticket step
  };

  /* ── State ──────────────────────────────────────────── */
  var queueToken   = null;
  var restaurantId = null;
  var entryId      = null;
  var displayNumber = null;
  var groupsAhead  = 0;
  var groupLetter  = null;
  var groupNumber  = null;
  var queueGroups  = [];
  var collectName  = false;
  var collectPhone = false;
  var collectEmail = false;
  var maxPax       = 20;
  var paxInput     = '';   // keypad buffer
  var pendingPax   = null; // confirmed pax awaiting contact

  var _pollTimer = null;

  /* ── Helpers ────────────────────────────────────────── */
  function showStep(id) {
    document.querySelectorAll('.q-step').forEach(function (el) {
      el.style.display = 'none';
      el.classList.remove('active');
    });
    var el = document.getElementById(id);
    if (el) { el.style.display = 'flex'; el.classList.add('active'); }
  }
  function escHtml(s) {
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  /* ── Init ───────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', function () {
    var parts = window.location.pathname.split('/');
    queueToken = parts[parts.length - 1] || null;
    if (!queueToken) { showStep('step-closed'); return; }

    // Restore session
    var saved = localStorage.getItem('qe_' + queueToken);
    if (saved) {
      try {
        var s = JSON.parse(saved);
        entryId      = s.entryId;
        displayNumber = s.displayNumber;
        groupLetter  = s.groupLetter;
        groupNumber  = s.groupNumber;
      } catch (_) {}
    }
    loadQueueStatus();
  });

  /* ── Load status ────────────────────────────────────── */
  async function loadQueueStatus() {
    showStep('step-loading');
    try {
      var res = await fetch('/api/queue/' + queueToken + '/status');
      if (!res.ok) { showStep('step-closed'); return; }
      var data = await res.json();
      if (!data.enabled) { showStep('step-closed'); return; }

      restaurantId = data.restaurant_id;
      queueGroups  = data.groups || [];
      collectName  = !!data.collect_name;
      collectPhone = !!data.collect_phone;
      collectEmail = !!data.collect_email;
      maxPax       = data.max_pax || 20;

      // Apply theme colour
      if (data.theme_color) {
        document.documentElement.style.setProperty('--q-accent', data.theme_color);
      }

      // Hero: cover image
      var cover = document.getElementById('q-hero-cover');
      if (cover && data.background_url) {
        cover.style.backgroundImage = 'url(' + escHtml(data.background_url) + ')';
      }
      // Logo
      if (data.logo_url) {
        var logo = document.getElementById('q-logo');
        logo.src = data.logo_url;
        logo.style.display = '';
        logo.onerror = function() { logo.style.display = 'none'; };
      }
      // Name
      document.getElementById('q-restaurant-name').textContent = data.restaurant_name || '';
      document.title = (data.restaurant_name || 'Queue') + ' — Queue';

      applyLang();

      if (entryId) {
        await refreshEntryStatus();
        return;
      }
      showStep('step-pax');
    } catch (e) {
      console.error('[Queue]', e);
      showStep('step-closed');
    }
  }

  /* ── Keypad ─────────────────────────────────────────── */
  window.qKeyPress = function(digit) {
    if (paxInput.length >= 2) return; // max 2 digits
    paxInput += digit;
    updatePaxDisplay();
  };
  window.qKeyBackspace = function() {
    paxInput = paxInput.slice(0, -1);
    updatePaxDisplay();
  };
  window.qKeyClear = function() {
    paxInput = '';
    updatePaxDisplay();
  };
  function updatePaxDisplay() {
    var el = document.getElementById('q-pax-display');
    if (el) el.textContent = paxInput || '—';
    var confirmBtn = document.getElementById('q-confirm-pax-btn');
    if (confirmBtn) confirmBtn.style.display = paxInput ? '' : 'none';
    updateGroupHint();
  }
  function updateGroupHint() {
    var hint = document.getElementById('q-group-hint');
    if (!hint) return;
    var pax = parseInt(paxInput, 10);
    if (!pax || !queueGroups.length) { hint.style.display = 'none'; return; }
    var g = queueGroups.filter(function(g){ return g.active !== false; })
      .find(function(g){ return pax >= g.pax_min && pax <= g.pax_max; });
    if (!g) g = queueGroups.filter(function(g){ return g.active !== false; }).slice(-1)[0];
    if (!g) { hint.style.display = 'none'; return; }
    hint.textContent = t('group-hint', { letter: g.label || g.letter, pax_min: g.pax_min, pax_max: g.pax_max });
    hint.style.display = '';
  }

  window.qConfirmPax = function() {
    var pax = parseInt(paxInput, 10);
    if (!pax || pax < 1 || pax > maxPax) {
      alert(lang === 'zh' ? '請輸入正確人數（1–' + maxPax + '）' : 'Please enter a valid party size (1–' + maxPax + ')');
      return;
    }
    pendingPax = pax;
    if (collectName || collectPhone || collectEmail) {
      showContactForm();
    } else {
      joinQueue(pax, null, null, null);
    }
  };

  /* ── Contact form ───────────────────────────────────── */
  function showContactForm() {
    document.getElementById('contact-name-row').style.display  = collectName  ? '' : 'none';
    document.getElementById('contact-phone-row').style.display = collectPhone ? '' : 'none';
    document.getElementById('contact-email-row').style.display = collectEmail ? '' : 'none';
    document.getElementById('q-contact-name').value  = '';
    document.getElementById('q-contact-phone').value = '';
    document.getElementById('q-contact-email').value = '';
    applyLang();
    showStep('step-contact');
  }
  window.qBackToPax = function() { showStep('step-pax'); };
  window.qSubmitContact = function() {
    var name  = collectName  ? document.getElementById('q-contact-name').value.trim()  : null;
    var phone = collectPhone ? document.getElementById('q-contact-phone').value.trim() : null;
    var email = collectEmail ? document.getElementById('q-contact-email').value.trim() : null;
    // Phone required if collect_phone is on
    if (collectPhone && !phone) {
      alert(lang === 'zh' ? '請輸入電話號碼' : 'Please enter a phone number');
      return;
    }
    joinQueue(pendingPax, name, phone, email);
  };

  /* ── Join queue ─────────────────────────────────────── */
  async function joinQueue(pax, name, phone, email) {
    try {
      var body = { pax: pax };
      if (name)  body.contact_name  = name;
      if (phone) body.contact_phone = phone;
      if (email) body.contact_email = email;
      var res = await fetch('/api/queue/' + queueToken + '/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        var err = await res.json();
        alert(err.error || (lang === 'zh' ? '加入排隊失敗，請重試' : 'Failed to join queue'));
        return;
      }
      var data = await res.json();
      entryId       = data.entry.id;
      displayNumber = data.display_number;
      groupLetter   = data.group_letter;
      groupNumber   = data.group_number;
      groupsAhead   = data.groups_ahead;
      saveSession();
      showNumberStep();
      startPolling();
    } catch (e) {
      alert(lang === 'zh' ? '網絡錯誤，請重試' : 'Network error — please try again');
    }
  }

  /* ── Show ticket ────────────────────────────────────── */
  function showNumberStep() {
    if (!entryId) return;
    var grpEl = document.getElementById('q-ticket-group');
    var numEl = document.getElementById('q-ticket-number');
    if (grpEl && displayNumber) {
      grpEl.textContent = displayNumber.charAt(0);
      numEl.textContent = displayNumber.slice(1);
    }
    var aheadEl = document.getElementById('q-ahead-count');
    if (aheadEl) aheadEl.textContent = groupsAhead;
    applyLang();
    showStep('step-number');
  }

  /* ── Refresh entry ──────────────────────────────────── */
  async function refreshEntryStatus() {
    try {
      var res = await fetch('/api/queue/entry/' + entryId);
      if (!res.ok) { clearSession(); showStep('step-pax'); return; }
      var data = await res.json();
      if (data.entry.status === 'cancelled') { clearSession(); showStep('step-pax'); return; }
      if (data.entry.status === 'seated')    { clearSession(); showStep('step-seated'); return; }
      displayNumber = data.display_number;
      groupLetter   = data.entry.group_letter;
      groupNumber   = data.entry.group_number;
      groupsAhead   = data.groups_ahead;

      var servingWrap = document.getElementById('q-serving-wrap');
      var servingNum  = document.getElementById('q-serving-number');
      if (servingWrap && servingNum) {
        if (data.current_called) {
          servingNum.textContent = data.current_called;
          servingWrap.style.display = '';
        } else {
          servingWrap.style.display = 'none';
        }
      }
      showNumberStep();
      startPolling();
    } catch (e) {
      showStep('step-pax');
    }
  }

  /* ── Cancel ─────────────────────────────────────────── */
  window.qCancelEntry = async function() {
    if (!confirm(lang === 'zh' ? '確定取消取號？' : 'Cancel your queue number?')) return;
    try { await fetch('/api/queue/entry/' + entryId + '/cancel', { method: 'POST' }); } catch(_){}
    stopPolling();
    clearSession();
    paxInput = '';
    updatePaxDisplay();
    showStep('step-pax');
  };

  /* ── Polling ────────────────────────────────────────── */
  function startPolling() {
    stopPolling();
    _pollTimer = setInterval(function() { if (entryId) refreshEntryStatus(); else stopPolling(); }, 20000);
  }
  function stopPolling() {
    if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
  }

  /* ── Session ────────────────────────────────────────── */
  function saveSession() {
    try {
      localStorage.setItem('qe_' + queueToken, JSON.stringify({
        entryId: entryId, displayNumber: displayNumber,
        groupLetter: groupLetter, groupNumber: groupNumber
      }));
    } catch(_){}
  }
  function clearSession() {
    entryId = null; displayNumber = null; groupLetter = null; groupNumber = null;
    try { localStorage.removeItem('qe_' + queueToken); } catch(_){}
  }

})();
