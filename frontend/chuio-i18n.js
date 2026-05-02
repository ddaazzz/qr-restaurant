/**
 * chuio-i18n.js
 * Language (EN / ZH Traditional Chinese) + Currency switching for Chuio website.
 * Shared by home.html and servicepacks.html.
 */
(function () {
  'use strict';

  // ── Exchange rates (base: HKD) ─────────────────────────────────────────
  var RATES = {
    HKD: { rate: 1,      symbol: 'HKD $' },
    USD: { rate: 0.128,  symbol: 'USD $' },
    EUR: { rate: 0.118,  symbol: 'EUR €' },
    CNY: { rate: 0.928,  symbol: 'CNY ¥' },
    GBP: { rate: 0.101,  symbol: 'GBP £' },
    JPY: { rate: 19.5,   symbol: 'JPY ¥' },
    AUD: { rate: 0.205,  symbol: 'AUD $' },
    SGD: { rate: 0.173,  symbol: 'SGD $' },
    TWD: { rate: 4.24,   symbol: 'TWD $' }
  };

  var currentLang = 'en';
  var currentCurrency = 'HKD';

  // ── Auto-detect ────────────────────────────────────────────────────────
  function detectLang() {
    var l = ((navigator.language || navigator.userLanguage) || '').toLowerCase();
    return l.startsWith('zh') ? 'zh' : 'en';
  }

  function detectCurrency() {
    var l = ((navigator.language || navigator.userLanguage) || '').toLowerCase();
    if (l === 'zh-hk' || l === 'zh-hant-hk') return 'HKD';
    if (l.startsWith('zh-cn') || l === 'zh') return 'CNY';
    if (l.startsWith('zh-tw') || l === 'zh-hant') return 'TWD';
    if (l.startsWith('zh-sg')) return 'SGD';
    if (l.startsWith('ja')) return 'JPY';
    if (l.startsWith('en-us')) return 'USD';
    if (l.startsWith('en-gb')) return 'GBP';
    if (l.startsWith('en-au')) return 'AUD';
    if (l.startsWith('en-sg')) return 'SGD';
    return 'HKD';
  }

  // ── Price formatting ───────────────────────────────────────────────────
  function convertHkd(hkdAmount) {
    var cfg = RATES[currentCurrency];
    if (!cfg) return 'HKD $' + hkdAmount;
    var converted = Math.round(hkdAmount * cfg.rate);
    return cfg.symbol + converted.toLocaleString();
  }

  function updatePrices() {
    // Elements with data-hkd attribute
    document.querySelectorAll('[data-hkd]').forEach(function (el) {
      var hkd = parseFloat(el.getAttribute('data-hkd'));
      if (!isNaN(hkd)) el.textContent = convertHkd(hkd);
    });
    // Currency code label next to the monthly price
    var curLabel = document.getElementById('nh-plan-currency-label');
    if (curLabel) curLabel.textContent = currentCurrency;
    // USD equivalent line
    document.querySelectorAll('[data-usd-equiv]').forEach(function (el) {
      var usd = Math.round(500 * RATES['USD'].rate);
      el.textContent = currentLang === 'zh'
        ? '\u2248 USD $' + usd + ' / \u6708 \u00a0\u2022\u00a0 \u96a8\u6642\u53d6\u6d88'
        : '\u2248 USD $' + usd + ' / month \u00a0\u2022\u00a0 Cancel anytime';
    });
    // Sync all currency selectors on page
    document.querySelectorAll('.nh-currency-select').forEach(function (sel) {
      if (sel.value !== currentCurrency) sel.value = currentCurrency;
    });
  }

  // ── Language switching ─────────────────────────────────────────────────
  function applyLang() {
    var isZh = currentLang === 'zh';

    // data-zh elements: swap textContent
    document.querySelectorAll('[data-zh]').forEach(function (el) {
      if (isZh) {
        // Save original EN text on first run
        if (!el.hasAttribute('data-en')) {
          el.setAttribute('data-en', el.textContent);
        }
        el.textContent = el.getAttribute('data-zh');
      } else {
        var en = el.getAttribute('data-en');
        if (en !== null) el.textContent = en;
      }
    });

    // Placeholder translations
    document.querySelectorAll('[data-zh-ph]').forEach(function (el) {
      if (isZh) {
        if (!el.hasAttribute('data-en-ph')) el.setAttribute('data-en-ph', el.placeholder || '');
        el.placeholder = el.getAttribute('data-zh-ph');
      } else {
        var enPh = el.getAttribute('data-en-ph');
        if (enPh !== null) el.placeholder = enPh;
      }
    });

    // Update lang toggle labels
    var label = document.getElementById('nh-lang-label');
    if (label) label.textContent = isZh ? '中文' : 'EN';
    document.querySelectorAll('.nh-lang-label-m').forEach(function (el) {
      el.textContent = isZh ? '中文' : 'EN';
    });

    // Update <html lang>
    document.documentElement.lang = isZh ? 'zh-Hant' : 'en';
  }

  // ── Public API ─────────────────────────────────────────────────────────
  window.chuioI18n = {
    toggleLang: function () {
      currentLang = currentLang === 'en' ? 'zh' : 'en';
      try { localStorage.setItem('chuio-lang', currentLang); } catch (e) {}
      applyLang();
      updatePrices();
    },
    setCurrency: function (cur) {
      if (RATES[cur]) {
        currentCurrency = cur;
        try { localStorage.setItem('chuio-currency', currentCurrency); } catch (e) {}
        updatePrices();
      }
    },
    getLang: function () { return currentLang; },
    getCurrency: function () { return currentCurrency; }
  };

  // ── Init ───────────────────────────────────────────────────────────────
  function init() {
    try { currentLang = localStorage.getItem('chuio-lang') || detectLang(); } catch (e) { currentLang = detectLang(); }
    try { currentCurrency = localStorage.getItem('chuio-currency') || detectCurrency(); } catch (e) { currentCurrency = detectCurrency(); }
    applyLang();
    updatePrices();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
