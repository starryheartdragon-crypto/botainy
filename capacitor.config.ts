import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.botainy.app',
  appName: 'Botainy',
  webDir: 'public',
  server: {
    // Dev (Android emulator): 10.0.2.2 maps to host localhost
    // Dev (physical device): use your machine's LAN IP, e.g. http://192.168.1.x:3000
    // Production: https://botainy.workers.dev
    url: 'https://botainy.workers.dev', // your Cloudflare URL
  
    androidScheme: 'https',
  },
  android: {
  
  },
  ios: {
    contentInset: 'always',
  },
};

export default config;
