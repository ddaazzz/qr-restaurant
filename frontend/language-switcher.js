// Language Switcher Module
class LanguageSwitcher {
  constructor() {
    this.currentLang = getCurrentLanguage();
    console.log('[LanguageSwitcher] Initialized with language:', this.currentLang);
    this.init();
  }

  init() {
    // Translate initial page content
    this.translatePage();
    
    // Create language picker HTML
    const picker = document.querySelector('[data-language-picker]');
    if (picker) {
      console.log('[LanguageSwitcher] Language picker element found');
      this.setupPicker(picker);
    } else {
      console.warn('[LanguageSwitcher] Language picker element not found');
    }
    
    // Set initial language
    document.documentElement.lang = this.currentLang;
    
    // Listen for language changes
    window.addEventListener('languageChanged', (e) => {
      this.currentLang = e.detail.language;
      console.log('[LanguageSwitcher] Language changed to:', this.currentLang);
      this.updatePageContent();
    });
  }

  setupPicker(pickerElement) {
    const currentLang = getCurrentLanguage();
    console.log('[LanguageSwitcher] Setting up picker for language:', currentLang);
    
    const html = `
      <div class="language-selector">
        <button class="lang-toggle" aria-label="Toggle language menu">
          <span class="lang-text">${currentLang === 'en' ? t('lang.english') : t('lang.chinese')}</span>
        </button>
        <div class="lang-dropdown">
          <a href="#" class="lang-option" data-lang="en" ${currentLang === 'en' ? 'class="lang-option active"' : 'class="lang-option"'}>
            ${t('lang.english')}
          </a>
          <a href="#" class="lang-option" data-lang="zh" ${currentLang === 'zh' ? 'class="lang-option active"' : 'class="lang-option"'}>
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
    
    console.log('[LanguageSwitcher] Found', options.length, 'language options');
    
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const dropdown = pickerElement.querySelector('.lang-dropdown');
      if (dropdown) {
        dropdown.classList.toggle('show');
        console.log('[LanguageSwitcher] Dropdown toggled');
      }
    });
    
    options.forEach(option => {
      option.addEventListener('click', (e) => {
        e.preventDefault();
        const lang = option.getAttribute('data-lang');
        console.log('[LanguageSwitcher] Language option clicked:', lang);
        setLanguage(lang);
        this.updatePickerDisplay(pickerElement);
        this.updatePageContent();
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
    const langText = toggle?.querySelector('.lang-text');
    
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
