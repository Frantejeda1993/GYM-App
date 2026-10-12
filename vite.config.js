import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// La app se publica en https://frantejeda1993.github.io/GYM-App/
export default defineConfig({
  base: '/GYM-App/',
  build: { chunkSizeWarningLimit: 1200 },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png'],
      manifest: {
        name: 'GYM App',
        short_name: 'GYM',
        description: 'Seguimiento de rutinas de gimnasio',
        lang: 'es',
        start_url: '/GYM-App/',
        scope: '/GYM-App/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#111316',
        theme_color: '#111316',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,json}'],
        navigateFallback: 'index.html',
        // Las imágenes del catálogo (~10 MB) no se precargan: se guardan al verlas por primera vez.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes('/ex/'),
            handler: 'CacheFirst',
            options: { cacheName: 'exercise-images', expiration: { maxEntries: 1600 } },
          },
        ],
      },
    }),
  ],
});
