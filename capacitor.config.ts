import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.myhealthid.app',
  appName: 'myhealthid',
  webDir: 'dist',
  server: {
    // Carrega sempre do site ao vivo — atualizações chegam ao app sem rebuild
    url: 'https://www.myhealthid.com.br',
    cleartext: false,
  },
};

export default config;
