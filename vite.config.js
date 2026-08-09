import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Ship a new service worker on every deploy, but hand control of the
      // reload to the app rather than swapping assets under a user mid-pick.
      // See ReloadPrompt: it waits for an explicit "Update".
      registerType: 'prompt',
      // injectManifest rather than generateSW: the service worker needs push
      // and notificationclick handlers, which a generated worker can't carry.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Under Achievers — NFL Prediction League',
        short_name: 'Under Achievers',
        description: 'Weekly NFL spread picks and survivor pools with your friends.',
        // Matches the theme-color meta in index.html and the app's own paper
        // surface. A green bar here would sit as a hard band above the
        // paper-white nav on an installed device.
        theme_color: '#f7f6f1',
        background_color: '#f7f6f1',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          // Android crops to its own shape; this one keeps the mark inside
          // the safe zone so it isn't clipped.
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
    }),
  ],
})
