import { execSync } from 'node:child_process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// A short, human-readable build id (git short SHA) so a running device can
// report exactly which build it is on — invaluable for telling a fresh deploy
// apart from a stale PWA cache.
let buildId = 'dev'
try {
  buildId = execSync('git rev-parse --short HEAD').toString().trim()
} catch {
  // no git (e.g. a tarball build) — leave the default
}

// https://vite.dev/config/
export default defineConfig({
  define: {
    __BUILD_ID__: JSON.stringify(buildId),
  },
  base: '/mygame/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'icons/icon-180.png'],
      manifest: {
        name: 'Court of Beasts',
        short_name: 'Court of Beasts',
        description: 'A Triple Triad style card battle: capture the board with mythic beasts.',
        id: '/mygame/',
        start_url: '/mygame/',
        scope: '/mygame/',
        display: 'fullscreen',
        display_override: ['fullscreen', 'standalone'],
        orientation: 'any',
        background_color: '#05030a',
        theme_color: '#05030a',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache everything the game needs so it plays fully offline:
        // card art, backdrops, coins and sounds included.
        globPatterns: ['**/*.{js,css,html,png,jpg,svg,wav,mp4,webm}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
})
