import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// If you want real PWA features later, uncomment the plugin below
// import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    // VitePWA({
    //   registerType: 'autoUpdate',
    //   devOptions: { enabled: true },
    //   includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
    //   manifest: {
    //     name: 'OSM Counter NG',
    //     short_name: 'OSMCounter',
    //     description: 'Advanced OSM tactical engine',
    //     theme_color: '#0c1120',
    //     background_color: '#0c1120',
    //     display: 'standalone',
    //     icons: [
    //       { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
    //       { src: 'icon-512.png', sizes: '512x512', type: 'image/png' }
    //     ]
    //   }
    // })
  ],
  // Helps with asset paths on Vercel
  base: '/',
  build: {
    // Ensures clean builds
    sourcemap: true,
    // Forces fresh assets
    rollupOptions: {
      output: {
        manualChunks: undefined,
      }
    }
  },
  server: {
    port: 5173,
    open: true
  }
})
