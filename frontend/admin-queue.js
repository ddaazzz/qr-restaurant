/* ══════════════════════════════════════════════════════════
   admin-queue.js — iOS-optimised live queue management
   ══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var restaurantId = localStorage.getItem('restaurantId');
  var authToken    = localStorage.getItem('authToken');
  var queueSettings = null;
  var liveEntries   = [];
  var _refreshTimer = null;

  /* ── Auth check ─────────────────────────────────────── */
  if (!authToken || !restaurantId) {
    window.location.href = '/console.html';
  }

  /* ── API helper ─────────────────────────────────────── */
  async function api(method, path, body) {
    var opts = {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + authToken
      }
    };
    if (body !== undefined) opts.body = JSON.stringify(body);
    var res = await fetch('/api' + path, opts);
    if (res.status === 401) { window.location.href = '/console.html'; throw new Error('Unauthorized'); }
    if (!res.ok) { var e = await res.json().catch(function(){ return {}; }); throw new Error(e.error || 'Request failed'); }
    return res.json();
  }

  function escHtml(s) {
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  /* ── Init ───────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', async function () {
    await loadSettings();
    await loadLiveQueue();
    _refreshTimer = setInterval(loadLiveQueue, 10000);
  });

  /* ── Load settings ──────────────────────────────────── */
  async function loadSettings() {
    try {
      queueSettings = await api('GET', '/restaurants/' + restaurantId + '/queue/settings');
      renderGroupCards();
    } catch (e) {
      console.error('[AdminQueue] settings:', e);
    }
  }

  /* ── Render group cards ─────────────────────────────── */
  function renderGroupCards() {
    var bar = document.getElementById('aq-groups-bar');
    if (!bar || !queueSettings) return;
    var groups = (queueSettings.groups || []).filter(function(g){ return g.active !== false; });
    if (!groups.length) {
      bar.innerHTML = '<div style="color:#9ca3af;font-size:13px;padding:8px;">No groups configured</div>';
      return;
    }
    bar.innerHTML = groups.map(function(g) {
      var waiting = countGroupWaiting(g.letter);
      var called  = currentGroupCalling(g.letter);
      return '<div class="aq-group-card' + (waiting > 0 ? ' has-waiting' : '') + '" '
        + 'onclick="aqCallNext(\'' + escHtml(g.letter) + '\')" '
        + 'id="aqcard-' + escHtml(g.letter) + '">'
        + '<div class="aq-group-letter">' + escHtml(g.letter) + '</div>'
        + '<div class="aq-group-label">' + escHtml(g.label || g.letter) + '</div>'
        + '<div class="aq-group-waiting"><strong>' + waiting + '</strong> waiting</div>'
        + '<div class="aq-group-calling' + (called ? ' visible' : '') + '" id="aqcalling-' + escHtml(g.letter) + '">'
        + 'Calling: ' + escHtml(called || '') + '</div>'
        + '<div class="aq-group-tap-hint">Tap to call next</div>'
        + '</div>';
    }).join('');
  }

  function countGroupWaiting(letter) {
    return liveEntries.filter(function(e){ return e.group_letter === letter && e.status === 'waiting'; }).length;
  }
  function currentGroupCalling(letter) {
    var called = liveEntries
      .filter(function(e){ return e.group_letter === letter && e.status === 'called'; })
      .sort(function(a,b){ return (b.group_number||0) - (a.group_number||0); });
    if (!called.length) return null;
    var e = called[0];
    return e.group_letter + String(e.group_number).padStart(3,'0');
  }

  /* ── Call next in group ─────────────────────────────── */
  window.aqCallNext = async function(letter) {
    try {
      var data = await api('POST', '/restaurants/' + restaurantId + '/queue/call-next/' + letter);
      // Update calling label immediately
      var callingEl = document.getElementById('aqcalling-' + letter);
      if (callingEl) { callingEl.textContent = 'Calling: ' + data.display_number; callingEl.classList.add('visible'); }
      await loadLiveQueue();
    } catch (e) {
      var msg = e.message || '';
      if (msg.includes('No waiting')) {
        alert('No waiting entries in group ' + letter);
      } else {
        alert('Failed: ' + msg);
      }
    }
  };

  /* ── Load live queue ────────────────────────────────── */
  async function loadLiveQueue() {
    try {
      liveEntries = await api('GET', '/restaurants/' + restaurantId + '/queue?status=waiting,called');
      renderGroupCards();
      renderList();
    } catch (e) {
      console.error('[AdminQueue] live:', e);
    }
  }

  /* ── Render entry list ──────────────────────────────── */
  function renderList() {
    var list = document.getElementById('aq-list');
    if (!list) return;
    if (!liveEntries.length) {
      list.innerHTML = '<div class="aq-empty">Queue is empty</div>';
      return;
    }
    list.innerHTML = liveEntries.map(function(e) {
      var disp = e.group_letter
        ? e.group_letter + String(e.group_number).padStart(3,'0')
        : '#' + e.queue_number;
      var wait = Math.round((Date.now() - new Date(e.created_at).getTime()) / 60000);
      var statusCls = e.status === 'called' ? 'aq-status-called' : 'aq-status-waiting';
      var contact = [e.contact_name, e.contact_phone].filter(Boolean).join(' · ');
      return '<div class="aq-entry' + (e.status === 'called' ? ' is-called' : '') + '" id="aqe-' + e.id + '">'
        + '<div class="aq-entry-number">' + escHtml(disp) + '</div>'
        + '<div class="aq-entry-info">'
        + '<div style="display:flex;align-items:center;gap:8px;">'
        + '<span class="aq-entry-pax">' + e.pax + ' pax</span>'
        + '<span class="aq-entry-status ' + statusCls + '">' + e.status + '</span>'
        + '</div>'
        + (contact ? '<div class="aq-entry-contact">' + escHtml(contact) + '</div>' : '')
        + '<div class="aq-entry-wait">' + wait + ' min ago</div>'
        + '</div>'
        + '<div class="aq-entry-actions">'
        + (e.status === 'waiting'
          ? '<button class="aq-act-btn aq-btn-call" onclick="aqCall(' + e.id + ')">Call</button>'
          : '')
        + '<button class="aq-act-btn aq-btn-seat" onclick="aqSeat(' + e.id + ')">Seat</button>'
        + '<button class="aq-act-btn aq-btn-cancel" onclick="aqCancel(' + e.id + ')">✕</button>'
        + '</div>'
        + '</div>';
    }).join('');
  }

  /* ── Entry actions ──────────────────────────────────── */
  window.aqCall = async function(id) {
    try { await api('POST', '/restaurants/' + restaurantId + '/queue/' + id + '/call', {}); await loadLiveQueue(); }
    catch (e) { alert('Failed: ' + e.message); }
  };
  window.aqSeat = async function(id) {
    try { await api('POST', '/restaurants/' + restaurantId + '/queue/' + id + '/seat', {}); await loadLiveQueue(); }
    catch (e) { alert('Failed: ' + e.message); }
  };
  window.aqCancel = async function(id) {
    if (!confirm('Remove this entry?')) return;
    try { await api('DELETE', '/restaurants/' + restaurantId + '/queue/' + id); await loadLiveQueue(); }
    catch (e) { alert('Failed: ' + e.message); }
  };
  window.aqClearAll = async function() {
    if (!confirm('Clear entire queue? This cannot be undone.')) return;
    try {
      var data = await api('DELETE', '/restaurants/' + restaurantId + '/queue');
      alert('Cleared ' + data.cleared + ' entries');
      await loadLiveQueue();
    } catch (e) { alert('Failed: ' + e.message); }
  };

})();
