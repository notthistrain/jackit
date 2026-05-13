// packages/jackcom/vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

const root = resolve(__dirname, 'src/pages')

export default defineConfig({
  root,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },

  build: {
    outDir: resolve(__dirname, 'dist'),
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
            if (id.includes('@tauri-apps')) return 'vendor-tauri'
            if (id.includes('react') || id.includes('react-dom'))
              return 'vendor-react'
            return 'vendor'
          }
        },
      },
    },
  },

  server: {
    port: 4321,
    strictPort: true,
    open: false,
  },

  optimizeDeps: {
    include: ['react', 'react-dom', 'zustand'],
  },
})
