import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { sentryVitePlugin } from '@sentry/vite-plugin'

// Source maps are built and uploaded only when a token is present, so a build
// without one still succeeds — which is what local builds and anyone cloning
// the repo will do. Without maps a production stack trace is minified
// nonsense and Sentry is worth about half of what it should be.
const uploadSourcemaps = Boolean(process.env.SENTRY_AUTH_TOKEN)

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // 'prompt' hands the decision to the app rather than reloading on its
      // own. ReloadPrompt then applies updates silently wherever a reload
      // costs nothing and only asks when there are unsaved picks — neither
      // 'autoUpdate' nor an always-visible prompt can express that.
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
    // Last in the list on purpose: it needs the finished bundle to work from.
    ...(uploadSourcemaps
      ? [sentryVitePlugin({
          org: process.env.SENTRY_ORG,
          project: process.env.SENTRY_PROJECT,
          authToken: process.env.SENTRY_AUTH_TOKEN,
          // Deleted once uploaded. Serving them would ship the whole source
          // tree to every visitor for no benefit — Sentry already has its copy.
          sourcemaps: { filesToDeleteAfterUpload: ['./dist/**/*.map'] },
        })]
      : []),
  ],
  build: {
    // Only worth generating when something is going to consume them.
    sourcemap: uploadSourcemaps,
  },
  test: {
    // The Supabase client is built at module load, so importing any module
    // that touches it — even to reach a pure helper beside it — fails without
    // these. The values are never used: nothing under test makes a request.
    env: {
      VITE_SUPABASE_URL: 'http://localhost:54321',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key',
    },
  },
})
