import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// En GitHub Pages el sitio vive en /backline/ (el workflow define VITE_BASE); en Cloudflare/Vercel o local es /.
const base = process.env.VITE_BASE ?? '/'

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: { globPatterns: ['**/*.{js,css,html,svg,woff2}'] },
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Backline',
        short_name: 'Backline',
        description: 'El lugar donde vive tu banda.',
        lang: 'es',
        theme_color: '#0F0E0D',
        background_color: '#0F0E0D',
        display: 'standalone',
        start_url: base,
        scope: base,
        icons: [{ src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
    }),
  ],
})
