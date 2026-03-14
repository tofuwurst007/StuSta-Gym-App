import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId:   'de.stusta.gymapp',
  appName: 'StuSta Gym',
  webDir:  'dist',
  server: {
    // Use HTTPS scheme on Android (required for cookies + OAuth redirects)
    androidScheme: 'https',
  },
  plugins: {
    // Deep-link intent filter — receives the OAuth2 redirect from the system browser
    // The full intent filter is configured in android/app/src/main/AndroidManifest.xml
  },
};

export default config;
