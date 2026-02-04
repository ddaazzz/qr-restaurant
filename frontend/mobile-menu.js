// Mobile hamburger menu handler
document.addEventListener('DOMContentLoaded', function() {
  const hamburger = document.getElementById('hamburger');
  const navLinks = document.getElementById('navLinks');
  
  if (!hamburger || !navLinks) return;
  
  // Toggle menu on hamburger click
  hamburger.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    const isActive = hamburger.classList.contains('active');
    
    if (isActive) {
      hamburger.classList.remove('active');
      navLinks.classList.remove('active');
      navLinks.style.maxHeight = '0px';
    } else {
      hamburger.classList.add('active');
      navLinks.classList.add('active');
      navLinks.style.maxHeight = '999px';
    }
    console.log('Menu toggled - navLinks active class:', navLinks.classList.contains('active'));
    console.log('navLinks max-height:', window.getComputedStyle(navLinks).maxHeight);
  });
  
  // Close menu when clicking a link
  navLinks.querySelectorAll('a').forEach(function(link) {
    link.addEventListener('click', function(e) {
      const isDropdown = this.parentElement.classList.contains('dropdown');
      const hasDropdownMenu = this.nextElementSibling && this.nextElementSibling.classList.contains('dropdown-menu');
      const isInDropdownMenu = this.parentElement.classList.contains('dropdown-menu');
      
      if (isDropdown && hasDropdownMenu && window.innerWidth <= 768) {
        // Toggle dropdown on mobile (only if it has a dropdown menu)
        e.preventDefault();
        e.stopPropagation();
        this.parentElement.classList.toggle('active');
        console.log('Dropdown toggled:', this.parentElement.classList.contains('active'));
      } else if (isInDropdownMenu) {
        // Link inside dropdown menu - allow navigation and close menu
        if (window.innerWidth <= 768) {
          e.stopPropagation();
          hamburger.classList.remove('active');
          navLinks.classList.remove('active');
          navLinks.style.maxHeight = '0px';
        }
      } else if (!isDropdown || (isDropdown && !hasDropdownMenu)) {
        // Regular link or dropdown without submenu - close menu on mobile
        if (window.innerWidth <= 768) {
          hamburger.classList.remove('active');
          navLinks.classList.remove('active');
          navLinks.style.maxHeight = '0px';
        }
      }
    });
  });
  
  // Close menu when clicking outside
  document.addEventListener('click', function(e) {
    if (!e.target.closest('nav')) {
      hamburger.classList.remove('active');
      navLinks.classList.remove('active');
      navLinks.style.maxHeight = '0px';
    }
  });
});
