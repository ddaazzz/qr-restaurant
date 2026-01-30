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
