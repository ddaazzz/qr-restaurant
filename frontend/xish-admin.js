/* ═══════════════════════════════════════════════════════
   XISH Admin Dashboard — Client Logic
   ═══════════════════════════════════════════════════════ */

(function () {
  "use strict";

  /* ─── State ────────────────────────────────────────── */
  const state = {
    token: localStorage.getItem("xish_merchant_token"),
    restaurantId: localStorage.getItem("xish_restaurantId"),
    restaurantName: "",
    currentSection: "stats",
    crmPage: 1,
    crmTotal: 0,
    crmPageSize: 20,
    crmSearchTimer: null,
    awardMemberId: null,
    editingDiscountId: null,
  };

  /* ─── Auth guard ───────────────────────────────────── */
  if (!state.token || !state.restaurantId) {
    window.location.href = "/xish/login?redirect=" + encodeURIComponent(window.location.pathname);
  }

  /* ─── API helper ───────────────────────────────────── */
  async function api(method, path, body) {
    const opts = {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + state.token,
      },
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch("/api" + path, opts);
    if (res.status === 401) {
      localStorage.removeItem("xish_merchant_token");
      localStorage.removeItem("xish_restaurantId");
      localStorage.removeItem("xish_role");
      localStorage.removeItem("xish_restaurantTimezone");
      window.location.href = "/xish/login";
      return null;
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || data.message || "Request failed");
    return data;
  }

  /* ─── Toast ─────────────────────────────────────────── */
  function toast(msg, type = "success") {
    const el = document.getElementById("xa-toast");
    el.textContent = msg;
    el.className = "xa-toast show " + type;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { el.className = "xa-toast"; }, 3200);
  }

  /* ─── Modal helpers ─────────────────────────────────── */
  window.xaCloseModal = function (id) {
    document.getElementById(id).style.display = "none";
  };
  function openModal(id) {
    document.getElementById(id).style.display = "flex";
  }
  // Close on overlay click
  document.querySelectorAll(".xa-modal-overlay").forEach(el => {
    el.addEventListener("click", e => { if (e.target === el) el.style.display = "none"; });
  });

  /* ─── Sidebar toggle ────────────────────────────────── */
  window.xaToggleSidebar = function () {
    document.getElementById("xa-sidebar").classList.toggle("open");
  };

  /* ─── Section switching ─────────────────────────────── */
  window.xaSwitchSection = function (name, btn) {
    // Deactivate all
    document.querySelectorAll(".xa-section").forEach(s => s.classList.remove("active"));
    document.querySelectorAll(".xa-nav-btn").forEach(b => b.classList.remove("active"));

    document.getElementById("section-" + name).classList.add("active");
    if (btn) btn.classList.add("active");

    const titles = { stats: "Statistics", crm: "Members CRM", discounts: "Discounts", gifts: "Gift Cards", campaigns: "Campaigns", coupons: "Coupons", tiers: "Member Tiers", wallet: "Wallet Pass" };
    document.getElementById("xa-page-title").textContent = titles[name] || name;

    state.currentSection = name;

    // Load data on first visit
    if (name === "stats") xaLoadStats();
    if (name === "crm")   { state.crmPage = 1; xaLoadCrm(); }
    if (name === "tiers") xaLoadTiers();
    if (name === "discounts") xaLoadDiscounts();
    if (name === "gifts") xaLoadGifts();
    if (name === "coupons") xaLoadCoupons();
    if (name === "campaigns") xaLoadCampaigns();
    if (name === "wallet") xaLoadWalletSettings();

    // Close sidebar on mobile after selection
    if (window.innerWidth <= 900) document.getElementById("xa-sidebar").classList.remove("open");
  };

  /* ═════════════════════════════════════════════════════
     STATS
  ═════════════════════════════════════════════════════ */
  window.xaLoadStats = async function () {
    const days = document.getElementById("xa-period-select").value;
    try {
      const data = await api("GET", `/restaurants/${state.restaurantId}/xish/analytics/stats?days=${days}`);
      if (!data) return;
      renderKpis(data);
      xaLoadTierBreakdown();
      xaLoadRecentTx();
    } catch (e) {
      console.error("Stats load error:", e);
    }
  };

  function fmt(cents) {
    if (cents == null) return "—";
    return "$" + (cents / 100).toLocaleString("en-HK", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }
  function fmtPct(v) {
    if (v == null) return "";
    const n = parseFloat(v);
    if (isNaN(n)) return "";
    return (n >= 0 ? "+" : "") + n.toFixed(1) + "%";
  }
  function fmtChange(v) {
    if (!v) return { text: "", cls: "neutral" };
    const n = parseFloat(v);
    return { text: fmtPct(v), cls: n > 0 ? "up" : n < 0 ? "down" : "neutral" };
  }

  function renderKpis(d) {
    const kpis = [
      { label: "TOTAL MEMBERS",     value: (d.total_xish_members || 0).toLocaleString(), change: null },
      { label: "NEW REGISTRATIONS", value: (d.new_registrations || 0).toLocaleString(), change: d.new_registrations_change_pct },
      { label: "GROSS SALES",       value: fmt(d.gross_transacted_cents), change: d.gross_transacted_cents_change_pct },
      { label: "DISCOUNTS GIVEN",   value: fmt(d.total_discount_cents), change: null },
      { label: "NET SALES",         value: fmt(d.net_sales_cents), change: d.net_sales_cents_change_pct },
      { label: "AVG ORDER VALUE",   value: fmt(d.avg_order_value_cents), change: d.avg_order_value_cents_change_pct },
    ];
    const grid = document.getElementById("xa-kpi-grid");
    grid.innerHTML = kpis.map(k => {
      const ch = fmtChange(k.change);
      return `<div class="xa-kpi-card">
        <div class="xa-kpi-label">${k.label}</div>
        <div class="xa-kpi-value">${k.value}</div>
        ${ch.text ? `<div class="xa-kpi-change ${ch.cls}">${ch.text} vs prev period</div>` : ""}
      </div>`;
    }).join("");
  }

  async function xaLoadTierBreakdown() {
    try {
      const data = await api("GET", `/restaurants/${state.restaurantId}/xish/members?limit=1`);
      if (!data) return;
      // Separately fetch tier counts
      const tiers = ["platinum", "gold", "silver", "basic"];
      const counts = await Promise.all(tiers.map(t =>
        api("GET", `/restaurants/${state.restaurantId}/xish/members?tier=${t}&limit=1`)
          .then(r => r?.total || 0).catch(() => 0)
      ));
      const total = counts.reduce((a, b) => a + b, 0) || 1;
      tiers.forEach((t, i) => {
        const pct = Math.round((counts[i] / total) * 100);
        const bar = document.getElementById("bar-" + t);
        const pctEl = document.getElementById("pct-" + t);
        if (bar) bar.style.width = pct + "%";
        if (pctEl) pctEl.textContent = pct + "% (" + counts[i] + ")";
      });
    } catch (e) { /* silent */ }
  }

  async function xaLoadRecentTx() {
    try {
      const data = await api("GET", `/restaurants/${state.restaurantId}/xish/recent-transactions`);
      const tbody = document.getElementById("xa-recent-tx-body");
      if (!data || !data.transactions || data.transactions.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="xa-empty">No transactions yet</td></tr>`;
        return;
      }
      tbody.innerHTML = data.transactions.map(tx => `
        <tr>
          <td>${escHtml(tx.member_name || "Guest")}</td>
          <td style="color:var(--green);font-weight:600">+${tx.points_delta}</td>
          <td>${escHtml(tx.reason || "—")}</td>
          <td style="color:var(--text-dim)">${fmtDate(tx.created_at)}</td>
        </tr>
      `).join("");
    } catch (e) {
      document.getElementById("xa-recent-tx-body").innerHTML = `<tr><td colspan="4" class="xa-empty">Could not load transactions</td></tr>`;
    }
  }

  /* ═════════════════════════════════════════════════════
     CRM
  ═════════════════════════════════════════════════════ */
  window.xaDebounceCrm = function () {
    clearTimeout(state.crmSearchTimer);
    state.crmSearchTimer = setTimeout(() => { state.crmPage = 1; xaLoadCrm(); }, 320);
  };

  window.xaLoadCrm = async function () {
    const search = document.getElementById("crm-search").value.trim();
    const tier   = document.getElementById("crm-tier-filter").value;
    const diner  = document.getElementById("crm-diner-filter").value;
    const offset = (state.crmPage - 1) * state.crmPageSize;

    let qs = `?limit=${state.crmPageSize}&offset=${offset}`;
    if (search) qs += "&search=" + encodeURIComponent(search);
    if (tier)   qs += "&tier=" + tier;
    if (diner !== "") qs += "&is_previous_diner=" + diner;

    const tbody = document.getElementById("crm-table-body");
    tbody.innerHTML = `<tr><td colspan="8" class="xa-empty">Loading…</td></tr>`;

    try {
      const data = await api("GET", `/restaurants/${state.restaurantId}/xish/members${qs}`);
      if (!data) return;
      state.crmTotal = data.total || 0;

      if (!data.members || data.members.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="xa-empty">No members found</td></tr>`;
        document.getElementById("crm-pagination").innerHTML = "";
        return;
      }

      tbody.innerHTML = data.members.map(m => `
        <tr>
          <td style="font-family:monospace;font-size:11px;color:var(--text-dim)">${escHtml(m.xish_id || "—")}</td>
          <td style="font-weight:600;color:var(--text)">${escHtml(m.name || "—")}</td>
          <td>${escHtml(m.phone || "—")}</td>
          <td><span class="xa-tier-badge ${m.tier || "basic"}">${m.tier || "basic"}</span></td>
          <td style="color:var(--gold);font-weight:600">${(m.points_balance || 0).toLocaleString()}</td>
          <td style="color:${m.is_previous_diner ? "var(--green)" : "var(--text-dim)"}">${m.is_previous_diner ? "✓" : "—"}</td>
          <td style="color:var(--text-dim)">${fmtDate(m.joined_at)}</td>
          <td>
            <button class="xa-btn-sm" onclick="xaOpenAwardModal(${m.xish_member_id}, '${escHtml(m.name || "Guest")}')">Award Points</button>
          </td>
        </tr>
      `).join("");

      renderCrmPagination();
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="8" class="xa-empty">Error loading members</td></tr>`;
    }
  };

  function renderCrmPagination() {
    const totalPages = Math.ceil(state.crmTotal / state.crmPageSize);
    const el = document.getElementById("crm-pagination");
    if (totalPages <= 1) { el.innerHTML = ""; return; }
    let html = "";
    if (state.crmPage > 1) html += `<button class="xa-page-btn" onclick="xaCrmGoPage(${state.crmPage - 1})">← Prev</button>`;
    html += `<span class="xa-page-btn active">${state.crmPage} / ${totalPages}</span>`;
    if (state.crmPage < totalPages) html += `<button class="xa-page-btn" onclick="xaCrmGoPage(${state.crmPage + 1})">Next →</button>`;
    el.innerHTML = html;
  }

  window.xaCrmGoPage = function (page) {
    state.crmPage = page;
    xaLoadCrm();
  };

  /* ─── Award Points ──────────────────────────────────── */
  window.xaOpenAwardModal = function (memberId, name) {
    state.awardMemberId = memberId;
    document.getElementById("award-member-name").textContent = name;
    document.getElementById("award-points").value = "";
    document.getElementById("award-reason").value = "";
    openModal("modal-award");
  };

  window.xaSubmitAwardPoints = async function () {
    const points = parseInt(document.getElementById("award-points").value);
    const reason = document.getElementById("award-reason").value.trim();
    if (!points || points < 1) { toast("Enter a valid point amount", "error"); return; }
    try {
      await api("POST", `/xish/members/${state.awardMemberId}/award-points`, { points_delta: points, restaurant_id: parseInt(state.restaurantId), reason: reason || "Manual award" });
      toast("Points awarded successfully");
      xaCloseModal("modal-award");
      if (state.currentSection === "crm") xaLoadCrm();
    } catch (e) {
      toast(e.message, "error");
    }
  };

  /* ─── Register Member ───────────────────────────────── */
  window.xaOpenRegisterModal = function () {
    ["reg-name","reg-phone","reg-email","reg-dob"].forEach(id => { document.getElementById(id).value = ""; });
    document.getElementById("reg-gender").value = "";
    openModal("modal-register");
  };

  window.xaSubmitRegister = async function () {
    const name  = document.getElementById("reg-name").value.trim();
    const phone = document.getElementById("reg-phone").value.trim();
    if (!phone) { toast("Phone number is required", "error"); return; }
    const body = { name, phone };
    const email = document.getElementById("reg-email").value.trim();
    const dob   = document.getElementById("reg-dob").value;
    const gender= document.getElementById("reg-gender").value;
    if (email)  body.email = email;
    if (dob)    body.date_of_birth = dob;
    if (gender) body.gender = gender;
    try {
      const res = await api("POST", `/restaurants/${state.restaurantId}/xish/members`, body);
      toast("Member registered! XISH ID: " + (res.xish_id || "—"));
      xaCloseModal("modal-register");
      state.crmPage = 1;
      xaLoadCrm();
    } catch (e) {
      toast(e.message, "error");
    }
  };

  /* ═════════════════════════════════════════════════════
     MEMBER TIERS
  ═════════════════════════════════════════════════════ */
  const TIER_META = {
    basic:    { label: "Basic",    icon: "⭐",   cls: "basic",    desc: "All new members" },
    silver:   { label: "Silver",   icon: "🤈",   cls: "silver",   desc: "Regular diners" },
    gold:     { label: "Gold",     icon: "🌟",   cls: "gold",     desc: "Loyal members" },
    platinum: { label: "Platinum", icon: "💫",   cls: "platinum", desc: "VIP members" },
  };

  async function xaLoadTiers() {
    const grid = document.getElementById("tiers-grid");
    try {
      const data = await api("GET", `/restaurants/${state.restaurantId}/xish/tier-settings`);
      if (!data || !data.tiers) return;
      grid.innerHTML = data.tiers.map(t => {
        const m = TIER_META[t.tier] || { label: t.tier, icon: "", cls: t.tier, desc: "" };
        return `<div class="xa-tier-config-card ${m.cls}">
          <div class="xa-tier-config-header">
            <div>
              <div style="font-size:22px;margin-bottom:4px">${m.icon}</div>
              <div class="xa-tier-config-title">${m.label}</div>
              <div style="font-size:11px;color:var(--text-dim);margin-top:2px">${m.desc}</div>
            </div>
            <span class="xa-tier-badge ${m.cls}">${m.label}</span>
          </div>
          <div class="xa-tier-config-field">
            <label>POINTS TO REACH TIER</label>
            <input type="number" class="xa-tier-threshold" data-tier="${t.tier}"
              value="${t.points_threshold}" min="0" step="100"
              ${t.tier === 'basic' ? 'readonly style="opacity:0.4;cursor:not-allowed"' : ''} />
          </div>
          <div class="xa-tier-config-field">
            <label>AUTO DISCOUNT %</label>
            <input type="number" class="xa-input-pct xa-tier-discount" data-tier="${t.tier}"
              value="${t.discount_percent}" min="0" max="100" step="0.5" />
          </div>
        </div>`;
      }).join("");
    } catch (e) {
      grid.innerHTML = `<div style="color:var(--red);padding:20px">${escHtml(e.message)}</div>`;
    }
  }

  window.xaSaveTiers = async function () {
    const thresholds = document.querySelectorAll(".xa-tier-threshold");
    const discounts  = document.querySelectorAll(".xa-tier-discount");
    const tiers = [];
    thresholds.forEach(el => {
      const tier = el.dataset.tier;
      const discEl = document.querySelector(`.xa-tier-discount[data-tier="${tier}"]`);
      tiers.push({
        tier,
        points_threshold: parseInt(el.value) || 0,
        discount_percent: parseFloat(discEl ? discEl.value : "0") || 0,
        is_active: true,
      });
    });
    // Basic always threshold 0
    const basicTier = tiers.find(t => t.tier === "basic");
    if (basicTier) basicTier.points_threshold = 0;

    try {
      await api("PUT", `/restaurants/${state.restaurantId}/xish/tier-settings`, { tiers });
      toast("Tier settings saved ✓");
    } catch (e) {
      toast(e.message, "error");
    }
  };

  /* ═════════════════════════════════════════════════════
     COUPONS
  ═════════════════════════════════════════════════════ */
  window.xaLoadCoupons = async function () {
    const el = document.getElementById("coupons-list");
    el.innerHTML = `<div class="xa-empty-state">Loading…</div>`;
    try {
      const data = await api("GET", `/restaurants/${state.restaurantId}/coupons`);
      if (!data || data.length === 0) {
        el.innerHTML = `<div class="xa-empty-state">No coupons yet. Create coupons in the Chuio admin settings → Coupons.</div>`;
        return;
      }
      el.innerHTML = data.map(c => {
        const discLabel = c.discount_type === "percentage"
          ? `${c.discount_value}% off`
          : `$${c.discount_value} off`;
        const meta = [
          c.coupon_type === "customer_specific" ? "Customer-specific" : "Universal",
          c.max_uses ? `Max ${c.max_uses} uses` : "Unlimited uses",
          c.valid_until ? `Expires ${fmtDate(c.valid_until)}` : "No expiry",
        ].join(" · ");
        const isSynced = false; // Could track via gift_settings metadata
        return `<div class="xa-item-card">
          <div class="xa-item-card-body">
            <div class="xa-item-card-title">
              <span class="xa-coupon-badge">${escHtml(c.code)}</span>
              &nbsp; ${discLabel}
              ${c.description ? `<span style="color:var(--text-dim);font-weight:400;font-size:12px;margin-left:8px">${escHtml(c.description)}</span>` : ""}
            </div>
            <div class="xa-item-card-meta" style="margin-top:6px">${meta}</div>
          </div>
          <div class="xa-item-card-actions">
            <button class="xa-btn-sync ${isSynced ? 'synced' : ''}" onclick="xaSyncCoupon(${c.id}, this)">
              ${isSynced ? '✓ Synced' : '↑ Sync to XISH'}
            </button>
          </div>
        </div>`;
      }).join("");
    } catch (e) {
      el.innerHTML = `<div class="xa-empty-state">Error loading coupons: ${escHtml(e.message)}</div>`;
    }
  };

  window.xaSyncCoupon = async function (couponId, btn) {
    btn.textContent = "Syncing…";
    btn.disabled = true;
    try {
      await api("POST", `/restaurants/${state.restaurantId}/xish/sync-coupon`, { coupon_id: couponId });
      btn.textContent = "✓ Synced";
      btn.className = "xa-btn-sync synced";
      toast("Coupon synced to XISH Gift Cards ✓");
    } catch (e) {
      btn.textContent = "↑ Sync to XISH";
      btn.disabled = false;
      toast(e.message, "error");
    }
  };

  /* ═════════════════════════════════════════════════════
     DISCOUNTS
  ═════════════════════════════════════════════════════ */
  async function xaLoadDiscounts() {
    const el = document.getElementById("discount-list");
    el.innerHTML = `<div class="xa-empty-state">Loading…</div>`;
    try {
      const data = await api("GET", `/restaurants/${state.restaurantId}/xish/discount-settings`);
      if (!data || !data.length) {
        el.innerHTML = `<div class="xa-empty-state">No discount rules yet. Add one to get started.</div>`;
        return;
      }
      el.innerHTML = data.map(s => {
        const days = Array.isArray(s.valid_days_of_week) && s.valid_days_of_week.length < 7
          ? "Days: " + s.valid_days_of_week.map(d => ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d]).join(", ")
          : "All days";
        return `<div class="xa-item-card">
          <div class="xa-item-card-body">
            <div class="xa-item-card-title">
              <span class="xa-tier-badge ${s.tier}">${s.tier}</span>
              &nbsp; ${s.discount_percent}% off
            </div>
            <div class="xa-item-card-meta">${days} · Uses per member: ${s.usage_limit_per_member || "Unlimited"}</div>
          </div>
          <div class="xa-item-card-actions">
            <button class="xa-btn-sm" onclick="xaEditDiscount(${s.id}, '${escHtml(JSON.stringify(s))}')">Edit</button>
            <button class="xa-btn-danger" onclick="xaDeleteDiscount(${s.id})">Delete</button>
          </div>
        </div>`;
      }).join("");
    } catch (e) {
      el.innerHTML = `<div class="xa-empty-state">Error loading discounts</div>`;
    }
  }

  window.xaOpenDiscountModal = function () {
    state.editingDiscountId = null;
    document.getElementById("discount-modal-title").textContent = "Add Discount Rule";
    document.getElementById("ds-tier").value = "basic";
    document.getElementById("ds-pct").value = "";
    document.getElementById("ds-limit").value = "";
    document.getElementById("ds-editing-id").value = "";
    document.querySelectorAll("#ds-days input").forEach(cb => { cb.checked = false; });
    openModal("modal-discount");
  };

  window.xaEditDiscount = function (id, rawJson) {
    let s;
    try { s = JSON.parse(rawJson); } catch { return; }
    state.editingDiscountId = id;
    document.getElementById("discount-modal-title").textContent = "Edit Discount Rule";
    document.getElementById("ds-tier").value = s.tier || "basic";
    document.getElementById("ds-pct").value = s.discount_percent || "";
    document.getElementById("ds-limit").value = s.usage_limit_per_member || "";
    document.getElementById("ds-editing-id").value = id;
    const days = Array.isArray(s.valid_days_of_week) ? s.valid_days_of_week.map(String) : [];
    document.querySelectorAll("#ds-days input").forEach(cb => { cb.checked = days.includes(cb.value); });
    openModal("modal-discount");
  };

  window.xaSubmitDiscount = async function () {
    const tier  = document.getElementById("ds-tier").value;
    const pct   = parseInt(document.getElementById("ds-pct").value);
    const limit = document.getElementById("ds-limit").value ? parseInt(document.getElementById("ds-limit").value) : null;
    if (!pct || pct < 1 || pct > 100) { toast("Enter a valid discount percentage (1-100)", "error"); return; }
    const days = Array.from(document.querySelectorAll("#ds-days input:checked")).map(cb => parseInt(cb.value));
    const body = { tier, discount_percent: pct, usage_limit_per_member: limit, valid_days_of_week: days.length ? days : [0,1,2,3,4,5,6] };
    try {
      const editId = state.editingDiscountId;
      if (editId) {
        await api("PATCH", `/restaurants/${state.restaurantId}/xish/discount-settings/${editId}`, body);
        toast("Discount rule updated");
      } else {
        await api("POST", `/restaurants/${state.restaurantId}/xish/discount-settings`, body);
        toast("Discount rule added");
      }
      xaCloseModal("modal-discount");
      xaLoadDiscounts();
    } catch (e) {
      toast(e.message, "error");
    }
  };

  window.xaDeleteDiscount = async function (id) {
    if (!confirm("Delete this discount rule?")) return;
    try {
      await api("DELETE", `/restaurants/${state.restaurantId}/xish/discount-settings/${id}`);
      toast("Discount rule deleted");
      xaLoadDiscounts();
    } catch (e) {
      toast(e.message, "error");
    }
  };

  /* ═════════════════════════════════════════════════════
     GIFTS
  ═════════════════════════════════════════════════════ */
  async function xaLoadGifts() {
    const el = document.getElementById("gift-list");
    el.innerHTML = `<div class="xa-empty-state">Loading…</div>`;
    try {
      const data = await api("GET", `/restaurants/${state.restaurantId}/xish/gift-settings`);
      if (!data || !data.length) {
        el.innerHTML = `<div class="xa-empty-state">No gift cards yet. Add one to delight your members.</div>`;
        return;
      }
      el.innerHTML = data.map(g => `
        <div class="xa-item-card">
          <div class="xa-item-card-body">
            <div class="xa-item-card-title">🎁 ${escHtml(g.item_name)}</div>
            <div class="xa-item-card-meta">Qty per redemption: ${g.quantity} · Valid: ${fmtDate(g.redemption_start)} – ${fmtDate(g.redemption_end)}</div>
          </div>
          <div class="xa-item-card-actions">
            <button class="xa-btn-danger" onclick="xaDeleteGift(${g.id})">Delete</button>
          </div>
        </div>
      `).join("");
    } catch (e) {
      el.innerHTML = `<div class="xa-empty-state">Error loading gifts</div>`;
    }
  }

  window.xaOpenGiftModal = function () {
    ["gift-name","gift-start","gift-end"].forEach(id => { document.getElementById(id).value = ""; });
    document.getElementById("gift-qty").value = "1";
    openModal("modal-gift");
  };

  window.xaSubmitGift = async function () {
    const name  = document.getElementById("gift-name").value.trim();
    const qty   = parseInt(document.getElementById("gift-qty").value) || 1;
    const start = document.getElementById("gift-start").value;
    const end   = document.getElementById("gift-end").value;
    if (!name) { toast("Enter a gift item name", "error"); return; }
    const body = { item_name: name, quantity: qty };
    if (start) body.redemption_start = start;
    if (end)   body.redemption_end   = end;
    try {
      await api("POST", `/restaurants/${state.restaurantId}/xish/gift-settings`, body);
      toast("Gift reward added");
      xaCloseModal("modal-gift");
      xaLoadGifts();
    } catch (e) {
      toast(e.message, "error");
    }
  };

  window.xaDeleteGift = async function (id) {
    if (!confirm("Delete this gift reward?")) return;
    try {
      await api("DELETE", `/restaurants/${state.restaurantId}/xish/gift-settings/${id}`);
      toast("Gift reward deleted");
      xaLoadGifts();
    } catch (e) {
      toast(e.message, "error");
    }
  };

  /* ═════════════════════════════════════════════════════
     CAMPAIGNS
  ═════════════════════════════════════════════════════ */
  async function xaLoadCampaigns() {
    const el = document.getElementById("campaign-list");
    el.innerHTML = `<div class="xa-empty-state">Loading…</div>`;
    try {
      const data = await api("GET", `/restaurants/${state.restaurantId}/xish/campaigns`);
      if (!data || !data.length) {
        el.innerHTML = `<div class="xa-empty-state">No campaigns yet. Create your first push notification.</div>`;
        return;
      }
      el.innerHTML = data.map(c => {
        const status = c.sent_at ? "sent" : c.scheduled_at ? "scheduled" : "draft";
        const statusLabel = c.sent_at ? "Sent" : c.scheduled_at ? "Scheduled" : "Draft";
        const meta = c.sent_at
          ? `Sent ${fmtDate(c.sent_at)}`
          : c.scheduled_at ? `Scheduled ${fmtDate(c.scheduled_at)}`
          : "Draft";
        return `<div class="xa-item-card">
          <div class="xa-item-card-body">
            <div class="xa-item-card-title">${escHtml(c.title)} <span class="xa-campaign-badge ${status}">${statusLabel}</span></div>
            <div class="xa-item-card-meta">${escHtml(c.body || "")} · ${meta}</div>
          </div>
          <div class="xa-item-card-actions">
            ${!c.sent_at ? `<button class="xa-btn-gold" onclick="xaSendCampaign(${c.id})">Send Now</button>` : ""}
          </div>
        </div>`;
      }).join("");
    } catch (e) {
      el.innerHTML = `<div class="xa-empty-state">Error loading campaigns</div>`;
    }
  }

  window.xaOpenCampaignModal = function () {
    ["camp-title","camp-body","camp-age-min","camp-age-max","camp-scheduled"].forEach(id => { document.getElementById(id).value = ""; });
    document.getElementById("camp-gender").value = "";
    document.getElementById("camp-bday-month").value = "";
    document.getElementById("camp-prev-diner").checked = false;
    openModal("modal-campaign");
  };

  window.xaSubmitCampaign = async function (sendNow) {
    const title = document.getElementById("camp-title").value.trim();
    const body  = document.getElementById("camp-body").value.trim();
    if (!title || !body) { toast("Title and message are required", "error"); return; }
    const payload = {
      title, body,
      target_previous_diners_only: document.getElementById("camp-prev-diner").checked,
    };
    const ageMin = document.getElementById("camp-age-min").value;
    const ageMax = document.getElementById("camp-age-max").value;
    const gender = document.getElementById("camp-gender").value;
    const bday   = document.getElementById("camp-bday-month").value;
    const sched  = document.getElementById("camp-scheduled").value;
    if (ageMin) payload.filter_age_min = parseInt(ageMin);
    if (ageMax) payload.filter_age_max = parseInt(ageMax);
    if (gender) payload.filter_gender = gender;
    if (bday)   payload.filter_birthday_month = parseInt(bday);
    if (sched)  payload.scheduled_at = new Date(sched).toISOString();
    try {
      const res = await api("POST", `/restaurants/${state.restaurantId}/xish/campaigns`, payload);
      if (sendNow && res && res.id) {
        await api("POST", `/restaurants/${state.restaurantId}/xish/campaigns/${res.id}/send`);
        toast("Campaign sent successfully!");
      } else {
        toast("Campaign saved");
      }
      xaCloseModal("modal-campaign");
      xaLoadCampaigns();
    } catch (e) {
      toast(e.message, "error");
    }
  };

  window.xaSendCampaign = async function (id) {
    if (!confirm("Send this campaign to all matching members now?")) return;
    try {
      await api("POST", `/restaurants/${state.restaurantId}/xish/campaigns/${id}/send`);
      toast("Campaign sent!");
      xaLoadCampaigns();
    } catch (e) {
      toast(e.message, "error");
    }
  };

  /* ─── Utility ───────────────────────────────────────── */
  function escHtml(str) {
    if (!str) return "";
    return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }
  function fmtDate(str) {
    if (!str) return "—";
    try {
      return new Date(str).toLocaleDateString("en-HK", { day: "numeric", month: "short", year: "numeric" });
    } catch { return str; }
  }

  /* ─── Wallet Pass ───────────────────────────────────── */

  // Helper: convert CSS rgb() string to hex for <input type="color">
  function rgbToHex(rgb) {
    const m = rgb.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
    if (!m) return "#000000";
    return "#" + [m[1], m[2], m[3]].map(n => parseInt(n).toString(16).padStart(2, "0")).join("");
  }

  // Helper: convert hex to rgb() string
  function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgb(${r},${g},${b})`;
  }

  async function xaLoadWalletSettings() {
    try {
      const s = await api("GET", `/xish/wallet-settings/${state.restaurantId}`);
      if (!s) return;

      // Populate fields
      document.getElementById("wp-program-name").value  = s.program_name || "";
      document.getElementById("wp-logo-text").value     = s.logo_text || "";
      document.getElementById("wp-org-name").value      = s.organization_name || "";
      document.getElementById("wp-description").value   = s.description || "";
      document.getElementById("wp-bg-color").value      = s.background_color || "rgb(15,15,20)";
      document.getElementById("wp-fg-color").value      = s.foreground_color || "rgb(255,255,255)";
      document.getElementById("wp-lbl-color").value     = s.label_color || "rgb(201,168,76)";
      document.getElementById("wp-header-lbl").value    = s.header_field_label || "TIER";
      document.getElementById("wp-primary-lbl").value   = s.primary_field_label || "POINTS BALANCE";
      document.getElementById("wp-sec1-lbl").value      = s.secondary1_label || "MEMBER";
      document.getElementById("wp-sec2-lbl").value      = s.secondary2_label || "XISH ID";
      document.getElementById("wp-back1-lbl").value     = s.back1_label || "";
      document.getElementById("wp-back1-val").value     = s.back1_value || "";
      document.getElementById("wp-back2-lbl").value     = s.back2_label || "";
      document.getElementById("wp-back2-val").value     = s.back2_value || "";
      document.getElementById("wp-back3-lbl").value     = s.back3_label || "";
      document.getElementById("wp-back3-val").value     = s.back3_value || "";
      document.getElementById("wp-barcode-format").value = s.barcode_format || "PKBarcodeFormatQR";
      document.getElementById("wp-location-lat").value  = s.location_lat || "";
      document.getElementById("wp-location-lng").value  = s.location_lng || "";
      document.getElementById("wp-location-label").value = s.location_label || "";

      // Sync colour pickers
      document.getElementById("wp-bg-picker").value  = rgbToHex(s.background_color || "rgb(15,15,20)");
      document.getElementById("wp-fg-picker").value  = rgbToHex(s.foreground_color || "rgb(255,255,255)");
      document.getElementById("wp-lbl-picker").value = rgbToHex(s.label_color || "rgb(201,168,76)");

      // Show cert warning if still stub
      if (s.apple_cert_required !== false) {
        document.getElementById("wallet-cert-notice").style.display = "block";
      }

      xaWalletPreview();
      xaWalletGenerateJoinQR();
    } catch (err) {
      console.error("[Wallet] load failed", err);
    }
  }

  // ── Join QR ──────────────────────────────────────────────
  function xaWalletGenerateJoinQR() {
    const baseUrl = window.location.origin;
    const joinUrl = `${baseUrl}/xish/join/${state.restaurantId}`;
    const urlInput = document.getElementById("wp-join-url");
    if (urlInput) urlInput.value = joinUrl;
    const qrEl = document.getElementById("wp-join-qr");
    if (!qrEl) return;
    qrEl.innerHTML = "";
    if (typeof QRCode !== "undefined") {
      new QRCode(qrEl, {
        text: joinUrl,
        width: 160,
        height: 160,
        correctLevel: (QRCode.CorrectLevel && QRCode.CorrectLevel.H) || 3,
      });
    } else {
      qrEl.innerHTML = `<img src="https://chart.googleapis.com/chart?cht=qr&chs=160x160&chl=${encodeURIComponent(joinUrl)}&choe=UTF-8" style="display:block;">`;
    }
  }

  window.xaCopyJoinUrl = function () {
    const val = document.getElementById("wp-join-url")?.value;
    if (!val) return;
    navigator.clipboard.writeText(val).then(() => {
      const btn = document.querySelector("[onclick=\"xaCopyJoinUrl()\"]");
      if (btn) { const orig = btn.textContent; btn.textContent = "Copied!"; setTimeout(() => btn.textContent = orig, 1800); }
    });
  };

  window.xaPrintJoinQR = function () {
    const url    = document.getElementById("wp-join-url")?.value || "";
    const canvas = document.querySelector("#wp-join-qr canvas");
    const imgSrc = canvas ? canvas.toDataURL("image/png")
                          : `https://chart.googleapis.com/chart?cht=qr&chs=280x280&chl=${encodeURIComponent(url)}&choe=UTF-8`;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>Loyalty Join QR</title><style>
      body{font-family:-apple-system,BlinkMacSystemFont,'Inter',sans-serif;text-align:center;padding:60px 40px;background:#fff;color:#111;}
      h1{font-size:26px;font-weight:800;margin-bottom:8px;}
      p{font-size:14px;color:#555;margin:6px 0;}
      img{display:block;margin:24px auto;width:260px;height:260px;}
      .url{font-size:11px;color:#888;word-break:break-all;margin-top:16px;}
    </style></head><body>
      <h1>Join Our Loyalty Programme</h1>
      <p>Scan with your iPhone camera to get your loyalty card instantly.</p>
      <img src="${imgSrc}" alt="Join QR">
      <p class="url">${url}</p>
      <script>window.onload=function(){window.print();};<\/script>
    </body></html>`);
    w.document.close();
  };

  // Sync colour picker → text input → preview
  window.xaWalletColorSync = function (field) {
    const map = { bg: ["wp-bg-picker", "wp-bg-color"], fg: ["wp-fg-picker", "wp-fg-color"], lbl: ["wp-lbl-picker", "wp-lbl-color"] };
    const [pickerId, inputId] = map[field];
    document.getElementById(inputId).value = hexToRgb(document.getElementById(pickerId).value);
    xaWalletPreview();
  };

  // Live preview update
  window.xaWalletPreview = function () {
    const bg  = document.getElementById("wp-bg-color").value  || "rgb(15,15,20)";
    const fg  = document.getElementById("wp-fg-color").value  || "rgb(255,255,255)";
    const lbl = document.getElementById("wp-lbl-color").value || "rgb(201,168,76)";

    const card = document.getElementById("wp-preview-card");
    if (!card) return;
    card.style.background = bg;
    card.style.color      = fg;

    const logoText   = document.getElementById("wp-logo-text").value  || "XISH";
    const headerLbl  = document.getElementById("wp-header-lbl").value || "TIER";
    const primaryLbl = document.getElementById("wp-primary-lbl").value || "POINTS BALANCE";
    const sec1Lbl    = document.getElementById("wp-sec1-lbl").value   || "MEMBER";
    const sec2Lbl    = document.getElementById("wp-sec2-lbl").value   || "XISH ID";

    document.getElementById("wp-prev-logo-text").textContent  = logoText;
    document.getElementById("wp-prev-logo-text").style.color  = lbl;
    document.getElementById("wp-prev-header-lbl").textContent = headerLbl;
    document.getElementById("wp-prev-header-lbl").style.color = lbl;
    document.getElementById("wp-prev-primary-lbl").textContent = primaryLbl;
    document.getElementById("wp-prev-primary-lbl").style.color = lbl;
    document.getElementById("wp-prev-sec1-lbl").textContent   = sec1Lbl;
    document.getElementById("wp-prev-sec1-lbl").style.color   = lbl;
    document.getElementById("wp-prev-sec2-lbl").textContent   = sec2Lbl;
    document.getElementById("wp-prev-sec2-lbl").style.color   = lbl;
    document.getElementById("wp-prev-header-val").style.color = fg;
    document.getElementById("wp-prev-primary-val").style.color = fg;

    // Strip accent colour
    const strip = document.getElementById("wp-prev-strip");
    if (strip) strip.style.background = `linear-gradient(90deg,${lbl},rgba(${lbl.replace("rgb(","").replace(")","")},0.25))`;

    // Barcode label
    const barcodeFormat = document.getElementById("wp-barcode-format").value;
    const barcodeEl = document.getElementById("wp-prev-barcode");
    if (barcodeEl) {
      const isQR = barcodeFormat === "PKBarcodeFormatQR" || barcodeFormat === "PKBarcodeFormatAztec";
      if (!isQR) {
        // Show barcode lines placeholder
        barcodeEl.innerHTML = `<svg viewBox="0 0 100 60" width="160" height="60" xmlns="http://www.w3.org/2000/svg">
          ${Array.from({length:30}, (_, i) => `<rect x="${i*3+2}" y="0" width="${i%3===0?2:1}" height="60" fill="#111"/>`).join("")}
        </svg>`;
      } else {
        barcodeEl.innerHTML = `<svg viewBox="0 0 100 100" width="80" height="80" xmlns="http://www.w3.org/2000/svg">
          <rect x="5" y="5" width="35" height="35" fill="none" stroke="#111" stroke-width="5"/>
          <rect x="15" y="15" width="15" height="15" fill="#111"/>
          <rect x="60" y="5" width="35" height="35" fill="none" stroke="#111" stroke-width="5"/>
          <rect x="70" y="15" width="15" height="15" fill="#111"/>
          <rect x="5" y="60" width="35" height="35" fill="none" stroke="#111" stroke-width="5"/>
          <rect x="15" y="70" width="15" height="15" fill="#111"/>
          <rect x="55" y="55" width="10" height="10" fill="#111"/>
          <rect x="70" y="55" width="10" height="10" fill="#111"/>
          <rect x="85" y="55" width="10" height="10" fill="#111"/>
          <rect x="55" y="70" width="10" height="10" fill="#111"/>
          <rect x="85" y="70" width="10" height="10" fill="#111"/>
          <rect x="55" y="85" width="10" height="10" fill="#111"/>
          <rect x="70" y="85" width="10" height="10" fill="#111"/>
        </svg>`;
      }
    }
  };

  window.xaSaveWalletSettings = async function () {
    try {
      await api("PATCH", `/xish/wallet-settings/${state.restaurantId}`, {
        program_name:        document.getElementById("wp-program-name").value.trim(),
        logo_text:           document.getElementById("wp-logo-text").value.trim(),
        organization_name:   document.getElementById("wp-org-name").value.trim(),
        description:         document.getElementById("wp-description").value.trim(),
        background_color:    document.getElementById("wp-bg-color").value.trim(),
        foreground_color:    document.getElementById("wp-fg-color").value.trim(),
        label_color:         document.getElementById("wp-lbl-color").value.trim(),
        header_field_label:  document.getElementById("wp-header-lbl").value.trim(),
        primary_field_label: document.getElementById("wp-primary-lbl").value.trim(),
        secondary1_label:    document.getElementById("wp-sec1-lbl").value.trim(),
        secondary2_label:    document.getElementById("wp-sec2-lbl").value.trim(),
        back1_label:         document.getElementById("wp-back1-lbl").value.trim(),
        back1_value:         document.getElementById("wp-back1-val").value.trim(),
        back2_label:         document.getElementById("wp-back2-lbl").value.trim(),
        back2_value:         document.getElementById("wp-back2-val").value.trim(),
        back3_label:         document.getElementById("wp-back3-lbl").value.trim(),
        back3_value:         document.getElementById("wp-back3-val").value.trim(),
        barcode_format:      document.getElementById("wp-barcode-format").value,
        location_lat:        parseFloat(document.getElementById("wp-location-lat").value) || null,
        location_lng:        parseFloat(document.getElementById("wp-location-lng").value) || null,
        location_label:      document.getElementById("wp-location-label").value.trim() || null,
      });
      toast("Wallet pass settings saved ✓");
    } catch (err) {
      toast("Failed to save: " + err.message, "error");
    }
  };

  // Member search for the pass QR generator
  let _wpSearchTimer = null;
  window.xaWalletSearchMembers = function () {
    clearTimeout(_wpSearchTimer);
    _wpSearchTimer = setTimeout(async () => {
      const q = document.getElementById("wp-member-search").value.trim();
      if (!q) { document.getElementById("wp-member-results").innerHTML = ""; return; }
      try {
        const data = await api("GET", `/restaurants/${state.restaurantId}/xish/members?search=${encodeURIComponent(q)}&limit=10`);
        const members = Array.isArray(data) ? data : (data.members || []);
        if (!members.length) {
          document.getElementById("wp-member-results").innerHTML = `<p style="color:#9ca3af;font-size:13px;padding:8px 0;">No members found.</p>`;
          return;
        }
        document.getElementById("wp-member-results").innerHTML = members.map(m => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:#f9fafb;border-radius:8px;margin-bottom:6px;cursor:pointer;" onclick="xaShowMemberPassQR(${m.id || m.xish_member_id}, '${(m.name || "").replace(/'/g, "\\'")}', '${m.tier || "basic"}')">
            <div>
              <div style="font-weight:600;font-size:14px;">${m.name || "—"}</div>
              <div style="font-size:12px;color:#6b7280;">${m.tier || "basic"} · ${m.points_balance || 0} pts</div>
            </div>
            <button class="xa-btn-outline" style="font-size:12px;padding:5px 10px;">Show QR</button>
          </div>
        `).join("");
      } catch (err) {
        document.getElementById("wp-member-results").innerHTML = `<p style="color:#ef4444;font-size:13px;">${err.message}</p>`;
      }
    }, 400);
  };

  window.xaShowMemberPassQR = async function (memberId, memberName, tier) {
    const area = document.getElementById("wp-member-qr-area");
    const nameEl = document.getElementById("wp-member-qr-name");
    const qrEl = document.getElementById("wp-member-qr-code");
    const urlEl = document.getElementById("wp-member-qr-url");

    nameEl.textContent = `${memberName} — ${tier.toUpperCase()}`;
    qrEl.innerHTML = "<p style='color:#9ca3af;font-size:12px;'>Loading…</p>";
    area.style.display = "block";

    try {
      const data = await api("GET", `/xish/wallet/member-pass/${memberId}`);
      const passUrl = data.qr_data || data.pass_url;
      urlEl.textContent = passUrl;

      qrEl.innerHTML = "";
      if (typeof QRCode !== "undefined") {
        new QRCode(qrEl, {
          text: passUrl,
          width: 200,
          height: 200,
          correctLevel: QRCode.CorrectLevel ? QRCode.CorrectLevel.H : 3,
        });
      } else {
        // Fallback: use Google Charts QR API
        const img = document.createElement("img");
        img.src = `https://chart.googleapis.com/chart?cht=qr&chs=200x200&chl=${encodeURIComponent(passUrl)}`;
        img.width = 200;
        img.height = 200;
        img.style.borderRadius = "8px";
        qrEl.appendChild(img);
      }
    } catch (err) {
      qrEl.innerHTML = `<p style="color:#ef4444;font-size:13px;">${err.message}</p>`;
    }
  };

  window.xaDownloadMemberQR = function () {
    const qrEl = document.getElementById("wp-member-qr-code");
    const canvas = qrEl.querySelector("canvas");
    const img = qrEl.querySelector("img");
    if (canvas) {
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = "xish-member-pass-qr.png";
      a.click();
    } else if (img) {
      const a = document.createElement("a");
      a.href = img.src;
      a.download = "xish-member-pass-qr.png";
      a.click();
    }
  };

  /* ─── Init ──────────────────────────────────────────── */
  async function init() {
    // Get restaurant name for badge
    try {
      const res = await api("GET", `/restaurants/${state.restaurantId}`);
      if (res && res.name) {
        state.restaurantName = res.name;
        document.getElementById("xa-restaurant-badge").textContent = res.name;
      }
    } catch {
      document.getElementById("xa-restaurant-badge").textContent = "Restaurant #" + state.restaurantId;
    }
    // Load initial section
    xaLoadStats();
  }

  init();

})();
