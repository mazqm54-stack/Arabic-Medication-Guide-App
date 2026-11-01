import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.dalili.medicationguide',
  appName: 'دليلي الدوائي',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
