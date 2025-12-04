(() => {
  const COOKIE_NAME = 'googtrans';
  const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;

  const getCurrentLang = () => {
    const match = document.cookie.match(/(?:^|;)\s*googtrans=([^;]+)/);
    if (!match) return 'en';
    const value = decodeURIComponent(match[1]);
    return value.includes('/es') ? 'es' : 'en';
  };

  const setCookie = (value) => {
    const expires = new Date(Date.now() + ONE_YEAR_MS).toUTCString();
    const host = window.location.hostname;
    const domains = [host, `.${host}`];
    domains.forEach((domain) => {
      document.cookie = `${COOKIE_NAME}=${value};expires=${expires};path=/;domain=${domain}`;
    });
    document.cookie = `${COOKIE_NAME}=${value};expires=${expires};path=/`;
  };

  const applyLangAttributes = (lang) => {
    document.documentElement.lang = lang;
    document.documentElement.setAttribute('data-lang', lang);
  };

  const updateButtonUI = (lang) => {
    // highlight active option
    const options = document.querySelectorAll('.lang-option');
    options.forEach((opt) => {
      const isActive = (opt.dataset.target === lang);
      if (isActive) {
        opt.style.fontWeight = '700';
        opt.style.color = 'var(--charcoal)';
      } else {
        opt.style.fontWeight = '500';
        opt.style.color = '';
      }
    });
  };

  const switchLanguage = (targetLang) => {
    const next = targetLang === 'es' ? '/en/es' : '/en/en';
    setCookie(next);
    const langCode = next.includes('/es') ? 'es' : 'en';
    updateButtonUI(langCode);
    applyLangAttributes(langCode);
    window.location.reload();
  };

  const initButton = () => {
    const lang = getCurrentLang();
    applyLangAttributes(lang);
    updateButtonUI(lang);
    const options = document.querySelectorAll('.lang-option');
    options.forEach((opt) => {
      if (!opt.dataset.bound) {
        opt.addEventListener('click', (e) => {
          e.preventDefault();
          const targetLang = opt.dataset.target;
          if (targetLang) switchLanguage(targetLang);
        });
        opt.dataset.bound = 'true';
      }
    });
  };

  const loadGoogleTranslate = () => {
    if (document.getElementById('google-translate-script')) return;
    const s = document.createElement('script');
    s.id = 'google-translate-script';
    s.src = '//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
    document.body.appendChild(s);
  };

  window.googleTranslateElementInit = () => {
    if (window.google && window.google.translate) {
      new window.google.translate.TranslateElement(
        {
          pageLanguage: 'en',
          includedLanguages: 'en,es',
          layout: window.google.translate.TranslateElement.InlineLayout.SIMPLE,
          autoDisplay: false,
        },
        'google_translate_element'
      );
    }
    initButton();
  };

  document.addEventListener('DOMContentLoaded', () => {
    initButton();
    loadGoogleTranslate();
  });
})();
