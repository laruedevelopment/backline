import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// En GitHub Pages el sitio vive en /backline/ (el workflow define VITE_BASE); en Cloudflare/Vercel o local es /.
const base = process.env.VITE_BASE ?? '/'

// Política de contenido: GitHub Pages no deja poner cabeceras, así que va como <meta>. Solo en el build (en desarrollo Vite inyecta scripts en línea).
// Lista exacta de lo que la app usa: Supabase (datos, fotos, tiempo real), YouTube/Spotify/OpenStreetMap (reproductores y mapa),
// la API de YouTube para importar listas, Nominatim (buscar direcciones) y jsDelivr (motor del lector de fotos, Tesseract).
const csp = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval' https://cdn.jsdelivr.net",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co https://*.tile.openstreetmap.org https://www.openstreetmap.org https://i.ytimg.com",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://www.googleapis.com https://nominatim.openstreetmap.org https://cdn.jsdelivr.net",
  "frame-src https://www.youtube-nocookie.com https://www.youtube.com https://open.spotify.com https://www.openstreetmap.org",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [
    react(),
    {
      name: 'backline-csp',
      apply: 'build',
      transformIndexHtml: () => [
        { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: csp }, injectTo: 'head-prepend' },
        { tag: 'meta', attrs: { name: 'referrer', content: 'strict-origin-when-cross-origin' }, injectTo: 'head-prepend' },
      ],
    },
    VitePWA({
      // Service worker propio (sw/sw.ts): además de funcionar sin conexión, recibe las notificaciones push.
      strategies: 'injectManifest',
      srcDir: 'sw',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectManifest: { globPatterns: ['**/*.{js,css,html,svg,woff2,png}'] },
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Backline',
        short_name: 'Backline',
        description: 'El lugar donde vive tu banda.',
        lang: 'es',
        theme_color: '#0d0c0a',
        background_color: '#0d0c0a',
        display: 'standalone',
        start_url: base,
        scope: base,
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
    }),
  ],
})
