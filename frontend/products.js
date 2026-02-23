// Mobile hamburger menu
document.addEventListener('DOMContentLoaded', function() {
  const hamburger = document.getElementById('hamburger');
  const navLinks = document.getElementById('navLinks');
  
  if (hamburger && navLinks) {
    hamburger.addEventListener('click', function() {
      hamburger.classList.toggle('active');
      navLinks.classList.toggle('active');
    });

    // Close menu when a link is clicked
    navLinks.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', function() {
        hamburger.classList.remove('active');
        navLinks.classList.remove('active');
      });
    });

    // Handle dropdown menus on mobile
    navLinks.querySelectorAll('.dropdown > a').forEach(dropdownToggle => {
      dropdownToggle.addEventListener('click', function(e) {
        if (window.innerWidth <= 768) {
          e.preventDefault();
          const dropdown = this.parentElement;
          dropdown.classList.toggle('active');
          
          // Close other dropdowns
          navLinks.querySelectorAll('.dropdown.active').forEach(other => {
            if (other !== dropdown) {
              other.classList.remove('active');
            }
          });
        }
      });
    });

    // Close menu when clicking outside
    document.addEventListener('click', function(e) {
      if (!e.target.closest('nav')) {
        hamburger.classList.remove('active');
        navLinks.classList.remove('active');
        navLinks.querySelectorAll('.dropdown.active').forEach(dropdown => {
          dropdown.classList.remove('active');
        });
      }
    });
  }
});

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      target.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  });
});

// WhatsApp contact function
function contactWhatsApp(plan) {
  const phoneNumber = '85263433995';
  const message = `I want to enquire about Chuio.io ${plan}`;
  const encodedMessage = encodeURIComponent(message);
  const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;
  window.open(whatsappUrl, '_blank');
}

// Intersection Observer for fade-in animations
const observerOptions = {
  threshold: 0.1,
  rootMargin: '0px 0px -100px 0px'
};

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.animation = 'none';
      // Retrigger animation
      void entry.target.offsetWidth;
      entry.target.style.animation = '';
    }
  });
}, observerOptions);

// Observe all animated elements
document.querySelectorAll('.step, .benefit, .feature-item').forEach(el => {
  observer.observe(el);
});

// Initialize translations on page load to ensure all data-i18n attributes are translated
window.addEventListener('pageTranslationUpdated', function() {
  console.log('[Products] Language changed, re-translating...');
  const lang = getCurrentLanguage();
  const elements = document.querySelectorAll('[data-i18n]');
  elements.forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (key) {
      el.textContent = t(key, lang);
    }
  });
});

// Also force initial translation when page loads
if (typeof getCurrentLanguage === 'function') {
  const initialLang = getCurrentLanguage();
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
      const elements = document.querySelectorAll('[data-i18n]');
      elements.forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (key) {
          const translated = t(key, initialLang);
          if (translated !== key) { // Only update if we got a translation
            el.textContent = translated;
          }
        }
      });
    }, 100);
  });
}
