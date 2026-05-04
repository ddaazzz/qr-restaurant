(function () {
  'use strict';

  // ── NAVBAR SCROLL EFFECT ──────────────────────────────────────────────────
  const nav = document.getElementById('nh-nav');
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 20);
  }, { passive: true });

  // ── MOBILE MENU ───────────────────────────────────────────────────────────
  const hamburger = document.getElementById('nh-hamburger');
  const mobileMenu = document.getElementById('nh-mobile-menu');
  hamburger.addEventListener('click', () => {
    mobileMenu.classList.toggle('open');
  });
  mobileMenu.querySelectorAll('a, button').forEach(el => {
    el.addEventListener('click', () => mobileMenu.classList.remove('open'));
  });

  // ── REVEAL ON SCROLL (IntersectionObserver) ───────────────────────────────
  const revealTargets = document.querySelectorAll('[data-reveal],[data-reveal-left],[data-reveal-right]');
  const revealObs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('revealed');
        revealObs.unobserve(e.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '-70px' });
  revealTargets.forEach(el => revealObs.observe(el));

  // ── STAGGERED CARDS IN HOW-IT-WORKS ───────────────────────────────────────
  const stagTargets = document.querySelectorAll('.nh-stag');
  const stagObs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        const delay = parseFloat(e.target.dataset.stagDelay || '0');
        setTimeout(() => e.target.classList.add('visible'), delay * 1000);
        stagObs.unobserve(e.target);
      }
    });
  }, { threshold: 0.2 });
  stagTargets.forEach(el => stagObs.observe(el));

  // ── COUNTER ANIMATION ─────────────────────────────────────────────────────
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

  function animateCounter(el, end, suffix, duration) {
    const start = performance.now();
    function step(now) {
      const p = Math.min((now - start) / duration, 1);
      const val = Math.floor(easeOutCubic(p) * end);
      el.textContent = (end === 0 ? '$0' : val + suffix);
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = (end === 0 ? '$0' : end + suffix);
    }
    requestAnimationFrame(step);
  }

  const statsSection = document.getElementById('nh-stats');
  let countersStarted = false;
  const statsObs = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && !countersStarted) {
      countersStarted = true;
      document.querySelectorAll('[data-counter]').forEach(el => {
        const end = parseInt(el.dataset.counter, 10);
        const suffix = el.dataset.suffix || '';
        animateCounter(el, end, suffix, 1800);
      });
      statsObs.disconnect();
    }
  }, { threshold: 0.3 });
  statsObs.observe(statsSection);

  // ── FAQ ACCORDION ─────────────────────────────────────────────────────────
  document.querySelectorAll('.nh-faq-item').forEach(item => {
    const btn = item.querySelector('.nh-faq-btn');
    btn.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');
      // Close all
      document.querySelectorAll('.nh-faq-item.open').forEach(i => i.classList.remove('open'));
      // Open this one if it was closed
      if (!isOpen) item.classList.add('open');
    });
  });

  // ── DEMO MODAL ────────────────────────────────────────────────────────────
  const modal = document.getElementById('nh-demo-modal');
  const modalOverlay = document.getElementById('nh-modal-overlay');

  function openModal() {
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }
  function closeModal() {
    modal.style.display = 'none';
    document.body.style.overflow = '';
  }

  document.querySelectorAll('[data-open-demo]').forEach(btn => {
    btn.addEventListener('click', (e) => { e.preventDefault(); openModal(); });
  });

  if (modalOverlay) {
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) closeModal();
    });
  }
  document.getElementById('nh-modal-close')?.addEventListener('click', closeModal);

  // Demo form submission — opens WhatsApp
  const demoForm = document.getElementById('nh-demo-form');
  if (demoForm) {
    demoForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = demoForm.querySelector('#demo-name').value;
      const email = demoForm.querySelector('#demo-email').value;
      const phone = demoForm.querySelector('#demo-phone').value;
      const text = encodeURIComponent(
        `Hi Chuio, I'd like to book a demo!\nRestaurant: ${name}\nEmail: ${email}\nPhone: ${phone}`
      );
      window.open(
        `https://api.whatsapp.com/send/?phone=85267455358&text=${text}&type=phone_number&app_absent=0`,
        '_blank'
      );
      closeModal();
    });
  }

  // ── SERVICE PACK HOVER COLORS ─────────────────────────────────────────────
  // Already handled by CSS var(--sp-accent) defined inline on each card element

  // ── ACTIVE NAV HIGHLIGHT ON SCROLL ────────────────────────────────────────
  const navLinks = document.querySelectorAll('.nh-nav-links a[href^="#"]');
  const sectionIds = Array.from(navLinks).flatMap(a => [
    a.getAttribute('href').slice(1),
    ...(a.dataset.alsoActive ? a.dataset.alsoActive.split(',') : [])
  ]);
  const sections = [...new Set(sectionIds)].map(id => document.getElementById(id)).filter(Boolean);

  if (sections.length) {
    const navObs = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          navLinks.forEach(a => {
            const ids = [a.getAttribute('href').slice(1), ...(a.dataset.alsoActive ? a.dataset.alsoActive.split(',') : [])];
            a.classList.toggle('nh-nav-active', ids.includes(id));
          });
        }
      });
    }, { rootMargin: '-30% 0px -60% 0px', threshold: 0 });
    sections.forEach(sec => navObs.observe(sec));
  }

  // ── SMOOTH SCROLL for anchor links ────────────────────────────────────────
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      // If a real navigation URL is set, follow it instead of scrolling
      const navHref = this.dataset.navHref;
      if (navHref) {
        window.location.href = navHref;
        return;
      }
      const href = this.getAttribute('href');
      if (href === '#') return;
      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        const offset = 80; // nav height
        const top = target.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top, behavior: 'smooth' });
        mobileMenu.classList.remove('open');
      }
    });
  });

})();
