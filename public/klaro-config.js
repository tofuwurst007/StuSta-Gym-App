// Klaro GDPR Consent Manager Configuration
// Loaded before the app bundle — window.klaroConfig is picked up by GdprConsent.tsx

window.klaroConfig = {
  version:         1,
  elementID:       'klaro',
  storageMethod:   'localStorage',
  storageName:     'stusta-klaro',
  cookieExpiresAfterDays: 365,
  acceptAll:       true,
  hideDeclineAll:  false,
  hideLearnMore:   false,
  privacyPolicy:   '/privacy',
  default:         false,           // all services OFF by default (opt-in)

  translations: {
    en: {
      privacyPolicyUrl: '/privacy',
      consentNotice: {
        description: 'StuSta Gym uses optional analytics cookies to improve your experience. You can choose which services to enable.',
        learnMore:   'Manage cookies',
      },
      consentModal: {
        title:       'Cookie & Privacy Settings',
        description: 'Here you can review and customise the information we collect about you.',
      },
      acceptAll:   'Accept all',
      declineAll:  'Decline all',
      close:       'Close',
      save:        'Save preferences',
      service: {
        disableAll: { title: 'Enable / disable all services' },
      },
    },
    de: {
      privacyPolicyUrl: '/privacy',
      consentNotice: {
        description: 'StuSta Gym verwendet optionale Analyse-Cookies, um Ihr Erlebnis zu verbessern.',
        learnMore:   'Einstellungen',
      },
      consentModal: {
        title:       'Cookie- & Datenschutzeinstellungen',
        description: 'Hier können Sie die von uns erhobenen Daten einsehen und anpassen.',
      },
      acceptAll:  'Alle akzeptieren',
      declineAll: 'Alle ablehnen',
      close:      'Schließen',
      save:       'Einstellungen speichern',
    },
  },

  services: [
    {
      name:        'vercel-analytics',
      title:       'Vercel Analytics',
      purposes:    ['analytics'],
      description: 'Anonymous page-view analytics provided by Vercel. No personal data is collected.',
      default:     false,
      required:    false,
      onAccept:    `
        // Vercel Analytics is injected at build-time via @vercel/analytics.
        // We signal consent so it can start sending events.
        if (window.__VA_SEND) window.__VA_SEND();
      `,
      onDecline: `
        // Nothing to clean up — Vercel Analytics respects the absence of consent.
      `,
    },
  ],
};
