import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/desk-card-maker/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Desk Card Studio',
        short_name: '桌牌 Studio',
        description: 'A4 頭對頭桌牌排版工具，支援自動字級、本機圖片、列印與離線使用。',
        lang: 'zh-Hant',
        start_url: '/desk-card-maker/',
        scope: '/desk-card-maker/',
        display: 'standalone',
        background_color: '#f5f5f4',
        theme_color: '#18181b',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      }
    })
  ]
})
