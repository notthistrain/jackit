import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
// packages/jackcom/vite.config.ts
import { defineConfig } from 'vite'

const root = resolve(import.meta.dirname, 'src/pages')

export default defineConfig({
  root,
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': resolve(import.meta.dirname, 'src') },
  },

  build: {
    outDir: resolve(import.meta.dirname, 'dist'),
    emptyOutDir: true,
    target: 'esnext',
    sourcemap: false,
    reportCompressedSize: false,
    cssMinify: 'lightningcss',
    assetsInlineLimit: 4096,
    cssCodeSplit: true,
    rollupOptions: {
      input: {
        main: resolve(root, 'main/index.html'),
        decoder: resolve(root, 'decoder/index.html'),
        waveform: resolve(root, 'waveform/index.html'),
        history: resolve(root, 'history/index.html'),
      },
      output: {
        entryFileNames: 'assets/[name]/index.js',
        chunkFileNames: 'assets/[name]/[hash].js',
        assetFileNames: 'assets/[name]/[hash][extname]',
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('/@tauri-apps/'))
              return 'vendor-tauri'
            if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/scheduler/'))
              return 'vendor-react'
            return 'vendor'
          }
        },
      },
    },
  },

  server: {
    port: 5173,
    strictPort: true,
    open: false,
  },

  optimizeDeps: {
    include: ['react', 'react-dom', 'zustand'],
  },
})
