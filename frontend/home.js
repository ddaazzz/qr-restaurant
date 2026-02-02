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
  const phoneNumber = '85263433995';
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
          const adminPhoneNumber = '85263433995';
          const adminMessage = `New Demo Request: ${formData.name}, Phone: ${formData.phone}`;
          const encodedAdminMessage = encodeURIComponent(adminMessage);
          const whatsappUrl = `https://wa.me/${adminPhoneNumber}?text=${encodedAdminMessage}`;
          // Uncomment to auto-send to admin WhatsApp
          // window.open(whatsappUrl, '_blank');
        } else {
          alert('Failed to submit. Please try WhatsApp instead.');
          // Fallback to WhatsApp
          const phoneNumber = '85263433995';
          const fallbackMessage = `Hi, I'm interested in a demo. Name: ${formData.name}, Phone: ${formData.phone}`;
          const encodedMessage = encodeURIComponent(fallbackMessage);
          const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;
          window.open(whatsappUrl, '_blank');
        }
      } catch (error) {
        console.error('Error submitting form:', error);
        alert('Error submitting form. Please try WhatsApp instead.');
        // Fallback to WhatsApp
        const phoneNumber = '85263433995';
        const fallbackMessage = `Hi, I'm interested in a demo. Name: ${formData.name}, Phone: ${formData.phone}`;
        const encodedMessage = encodeURIComponent(fallbackMessage);
        const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;
        window.open(whatsappUrl, '_blank');
      }
    });
  }
});
