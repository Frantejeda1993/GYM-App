// Modo de prueba: la app con Firebase simulado y datos en el navegador.
// Uso: npm run dev:mock
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const mock = (f) => fileURLToPath(new URL(`./mocks/${f}`, import.meta.url));

export default defineConfig({
  root: fileURLToPath(new URL('..', import.meta.url)),
  plugins: [react()],
  resolve: {
    alias: {
      'firebase/app': mock('firebase-app.js'),
      'firebase/auth': mock('firebase-auth.js'),
      'firebase/firestore': mock('firebase-firestore.js'),
    },
  },
});
