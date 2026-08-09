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
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // The app shell can be cached, but everything that matters is live
        // data. Supabase calls must never be served from cache -- a stale
        // leaderboard or a stale lock state is worse than a slow one.
        navigateFallbackDenylist: [/^\/rest\//, /^\/auth\//, /^\/functions\//],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com'
              || url.origin === 'https://fonts.gstatic.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Supabase: always go to the network. Listed explicitly so no
            // future default starts caching picks or standings.
            urlPattern: ({ url }) => url.hostname.endsWith('.supabase.co'),
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
})
