import { useEffect } from 'react';
import 'klaro/dist/klaro.css';

// Klaro is loaded as a UMD module via window.klaroConfig (set in public/klaro-config.js).
// We import the ES module here so it reads that config and renders the consent banner.
export default function GdprConsent() {
  useEffect(() => {
    // Dynamically import so we don't block the initial render
    import('klaro').then(Klaro => {
      Klaro.setup(
        (window as unknown as { klaroConfig?: object }).klaroConfig ?? {}
      );
    }).catch(() => {
      // Klaro is non-critical — silently ignore if it fails
    });
  }, []);

  return null; // Klaro injects its own DOM elements
}
