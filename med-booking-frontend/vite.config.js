import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Redirection des appels d'authentification Keycloak
      '/keycloak': {
        target: 'http://localhost:8085',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/keycloak/, ''),
      },
      // Redirection des fichiers de styles CSS, polices et scripts du thème Keycloak
      '/resources': {
        target: 'http://localhost:8085',
        changeOrigin: true,
      },
      // Redirection des endpoints de royaumes et thèmes
      '/realms': {
        target: 'http://localhost:8085',
        changeOrigin: true,
      },
    },
  },
});