// Language Switcher Module
class LanguageSwitcher {
  constructor() {
    this.currentLang = getCurrentLanguage();
    this.init();
  }

  init() {
    // Translate initial page content
    this.translatePage();
    
    // Create language picker HTML
    const picker = document.querySelector('[data-language-picker]');
    if (picker) {
      this.setupPicker(picker);
    } else {
      console.warn('[LanguageSwitcher] Language picker element not found');
    }
    
    // Set initial language
    document.documentElement.lang = this.currentLang;
    
    // Listen for language changes
    window.addEventListener('languageChanged', (e) => {
      this.currentLang = e.detail.language;
      this.updatePageContent();
    });
  }

  setupPicker(pickerElement) {
    const currentLang = getCurrentLanguage();
    
    // Check if picker already has button elements (like in admin.html)
    const existingButtons = pickerElement.querySelectorAll('button');
    if (existingButtons.length > 0) {
      // Just add event listeners to existing buttons
      existingButtons.forEach(btn => {
        const lang = btn.id.replace('lang-', '');
        if (lang === currentLang) {
          btn.classList.add('active');
        }
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          setLanguage(lang);
        });
      });
      return;
    }
    
    // Otherwise create dropdown menu (for other pages)
    const html = `
      <div class="language-selector">
        <button class="lang-toggle" aria-label="Toggle language menu">
          <span class="lang-text">${currentLang === 'en' ? t('lang.english') : t('lang.chinese')}</span>
        </button>
        <div class="lang-dropdown">
          <a href="#" class="lang-option" data-lang="en">
            ${t('lang.english')}
          </a>
          <a href="#" class="lang-option" data-lang="zh">
            ${t('lang.chinese')}
          </a>
        </div>
      </div>
    `;
    
    pickerElement.innerHTML = html;
    
    // Add event listeners
    const toggle = pickerElement.querySelector('.lang-toggle');
    const options = pickerElement.querySelectorAll('.lang-option');
    
    if (!toggle) {
      console.error('[LanguageSwitcher] Toggle button not found');
      return;
    }
    
    // Set initial active state
    options.forEach(option => {
      if (option.getAttribute('data-lang') === currentLang) {
        option.classList.add('active');
      } else {
        option.classList.remove('active');
      }
    });
    
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const dropdown = pickerElement.querySelector('.lang-dropdown');
      if (dropdown) {
        dropdown.classList.toggle('show');
      }
    });
    
    options.forEach(option => {
      option.addEventListener('click', (e) => {
        e.preventDefault();
        const lang = option.getAttribute('data-lang');
        setLanguage(lang);
        
        // Update active state
        options.forEach(opt => {
          if (opt.getAttribute('data-lang') === lang) {
            opt.classList.add('active');
          } else {
            opt.classList.remove('active');
          }
        });
        
        this.updatePickerDisplay(pickerElement);
        this.updatePageContent();
        
        // Close dropdown
        const dropdown = pickerElement.querySelector('.lang-dropdown');
        if (dropdown) {
          dropdown.classList.remove('show');
        }
      });
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!pickerElement.contains(e.target)) {
        const dropdown = pickerElement.querySelector('.lang-dropdown');
        if (dropdown) {
          dropdown.classList.remove('show');
        }
      }
    });
  }

  updatePickerDisplay(pickerElement) {
    const currentLang = getCurrentLanguage();
    const toggle = pickerElement.querySelector('.lang-toggle');
    const langText = toggle ? toggle.querySelector('.lang-text') : null;
    
    if (langText) {
      langText.textContent = currentLang === 'en' ? t('lang.english') : t('lang.chinese');
    }
    
    const options = pickerElement.querySelectorAll('.lang-option');
    options.forEach(option => {
      const lang = option.getAttribute('data-lang');
      if (lang === currentLang) {
        option.classList.add('active');
      } else {
        option.classList.remove('active');
      }
    });
  }

  updatePageContent() {
    // Translate all elements
    this.translatePage();
    // Dispatch event for page-specific scripts
    window.dispatchEvent(new CustomEvent('pageTranslationUpdated', { detail: { language: getCurrentLanguage() } }));
  }

  // Translate element content by data attributes
  translateElement(element) {
    const key = element.getAttribute('data-i18n');
    if (key) {
      const translated = t(key);
      element.textContent = translated;
    }
    
    const placeholderKey = element.getAttribute('data-i18n-placeholder');
    if (placeholderKey) {
      element.placeholder = t(placeholderKey);
    }
    
    const titleKey = element.getAttribute('data-i18n-title');
    if (titleKey) {
      element.title = t(titleKey);
    }
  }

  // Translate all elements with data-i18n attributes
  translatePage() {
    const elementsToTranslate = document.querySelectorAll('[data-i18n], [data-i18n-placeholder], [data-i18n-title]');
    console.log('[LanguageSwitcher] Translating', elementsToTranslate.length, 'elements');
    
    elementsToTranslate.forEach(el => {
      this.translateElement(el);
    });
  }
}

// Initialize language switcher when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('[LanguageSwitcher] DOM loaded, initializing...');
    window.languageSwitcher = new LanguageSwitcher();
  });
} else {
  console.log('[LanguageSwitcher] DOM already loaded, initializing...');
  window.languageSwitcher = new LanguageSwitcher();
}
