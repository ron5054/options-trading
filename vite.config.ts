import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { optionPricesApiMiddleware } from './server/apiMiddleware'

const optionPricesApiPlugin = (): Plugin => ({
  name: 'option-prices-api',
  configureServer: (server) => {
    server.middlewares.use(optionPricesApiMiddleware)
  },
  configurePreviewServer: (server) => {
    server.middlewares.use(optionPricesApiMiddleware)
  },
})

export default defineConfig({
  plugins: [
    react(),
    optionPricesApiPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'pwa-icon.svg'],
      manifest: {
        name: 'Options Trade Tracker',
        short_name: 'Options',
        description: 'Track options trades and monthly revenue',
        theme_color: '#0f1117',
        background_color: '#0f1117',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: '/index.html',
      },
    }),
  ],
  preview: {
    allowedHosts: true,
    host: true,
  },
})
