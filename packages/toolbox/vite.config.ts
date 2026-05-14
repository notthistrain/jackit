import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
// packages/toolbox/vite.config.ts
import { defineConfig } from 'vite'

const root = resolve(import.meta.dirname, 'src/pages')

export default defineConfig({
  root,
  base: './',
  plugins: [vue(), tailwindcss()],
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
        index: resolve(root, 'index.html'),
        settings: resolve(root, 'settings/index.html'),
      },
      output: {
        entryFileNames: 'assets/[name]/index.js',
        chunkFileNames: 'assets/[name]/[hash].js',
        assetFileNames: 'assets/[name]/[hash][extname]',
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('/@tauri-apps/'))
              return 'vendor-tauri'
            if (id.includes('/vue/')
              || id.includes('/@vue/')
              || id.includes('/vue-demi/')
              || id.includes('/@vueuse/')
              || id.includes('/reka-ui/')
              || id.includes('/@floating-ui/')
              || id.includes('/vue-sonner/')
              || id.includes('/lucide-vue-next/')) {
              return 'vendor-vue'
            }
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
    include: ['vue', '@vueuse/core'],
  },
})
