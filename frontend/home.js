// Smooth scroll for internal links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    e.preventDefault();
    const targetId = this.getAttribute('href');
    if (targetId === '#home') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      const target = document.querySelector(targetId);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
      }
    }
  });
});

// WhatsApp contact function
function contactWhatsApp(plan) {
  const phoneNumber = '85267455358';
  const message = `I want to enquire about Chuio.io ${plan}`;
  const encodedMessage = encodeURIComponent(message);
  const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;
  window.open(whatsappUrl, '_blank');
}

// Contact form submission
document.addEventListener('DOMContentLoaded', function() {
  // Mobile hamburger menu
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

  const contactForm = document.getElementById('contactForm');
  
  if (contactForm) {
    contactForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      // Get form data
      const formData = {
        name: document.getElementById('contactName').value,
        phone: document.getElementById('contactPhone').value,
        email: document.getElementById('contactEmail').value || 'Not provided',
        restaurant: document.getElementById('contactRestaurant').value || 'Not provided',
        message: document.getElementById('contactMessage').value || 'No message'
      };
      
      try {
        // Send to backend
        const response = await fetch('/api/contact-demo', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(formData)
        });
        
        if (response.ok) {
          // Show success message
          const submitBtn = contactForm.querySelector('.contact-submit');
          const originalText = submitBtn.textContent;
          submitBtn.textContent = 'Demo Request Sent! ✓';
          submitBtn.style.backgroundColor = '#059669';
          
          // Reset form
          contactForm.reset();
          
          // Restore button after 3 seconds
          setTimeout(() => {
            submitBtn.textContent = originalText;
            submitBtn.style.backgroundColor = '';
          }, 3000);
          
          // Optionally send WhatsApp notification to admin
          const adminPhoneNumber = '85267455358';
          const adminMessage = `New Demo Request: ${formData.name}, Phone: ${formData.phone}`;
          const encodedAdminMessage = encodeURIComponent(adminMessage);
          const whatsappUrl = `https://wa.me/${adminPhoneNumber}?text=${encodedAdminMessage}`;
          // Uncomment to auto-send to admin WhatsApp
          // window.open(whatsappUrl, '_blank');
        } else {
          alert('Failed to submit. Please try WhatsApp instead.');
          // Fallback to WhatsApp
          const phoneNumber = '85267455358';
          const fallbackMessage = `Hi, I'm interested in a demo. Name: ${formData.name}, Phone: ${formData.phone}`;
          const encodedMessage = encodeURIComponent(fallbackMessage);
          const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;
          window.open(whatsappUrl, '_blank');
        }
      } catch (error) {
        console.error('Error submitting form:', error);
        alert('Error submitting form. Please try WhatsApp instead.');
        // Fallback to WhatsApp
        const phoneNumber = '85267455358';
        const fallbackMessage = `Hi, I'm interested in a demo. Name: ${formData.name}, Phone: ${formData.phone}`;
        const encodedMessage = encodeURIComponent(fallbackMessage);
        const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;
        window.open(whatsappUrl, '_blank');
      }
    });
  }

  // Waitlist form handler
  const waitlistForm = document.getElementById('waitlist-form');
  if (waitlistForm) {
    waitlistForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      const restaurantName = this.querySelector('input[placeholder="Restaurant Name"]').value;
      const email = this.querySelector('input[placeholder="Email Address"]').value;
      const phone = this.querySelector('input[placeholder="Phone Number"]').value;
      
      try {
        // Submit to backend for email notification
        const response = await fetch('/api/waitlist', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            restaurantName,
            email,
            phone,
          }),
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to submit waitlist form');
        }
        
        const result = await response.json();
        console.log('✅ Waitlist submission successful:', result);
        
        // Show success message
        alert('Thank you for joining our waitlist! Check your email for confirmation.');
        
      } catch (error) {
        console.error('❌ Error submitting waitlist:', error);
        alert('There was an error submitting your information. Please try again or contact us via WhatsApp.');
      } finally {
        // Also send to WhatsApp for immediate contact
        const phoneNumber = '85267455358';
        const message = `Hello! I'd like to join the Chuio waitlist.\n\nRestaurant Name: ${restaurantName}\nEmail: ${email}\nPhone: ${phone}`;
        const encodedMessage = encodeURIComponent(message);
        const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;
        window.open(whatsappUrl, '_blank');
        
        // Reset form
        this.reset();
      }
    });
  }
});

// Initialize translations on page load and when language changes
window.addEventListener('pageTranslationUpdated', function() {
  console.log('[Home] Language changed, re-translating...');
  const lang = getCurrentLanguage();
  const elements = document.querySelectorAll('[data-i18n]');
  elements.forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (key) {
      el.textContent = t(key, lang);
    }
  });
});

// Force initial translation when page loads
if (typeof getCurrentLanguage === 'function' && typeof t === 'function') {
  const initialLang = getCurrentLanguage();
  const translateOnLoad = () => {
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
  };
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', translateOnLoad);
  } else {
    translateOnLoad();
  }
}
