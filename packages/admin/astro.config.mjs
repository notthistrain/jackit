// @ts-check

import vue from '@astrojs/vue'
import tailwindcss from '@tailwindcss/vite'

import { defineConfig } from 'astro/config'

const HOST = {
  local: 'localhost',
}

// https://astro.build/config
export default defineConfig({
  output: 'static',
  outDir: '../server/admin',
  build: {
    assets: 'assets',
  },
  vite: {
    plugins: [tailwindcss()],
    server: {
      proxy: {
        '/api': {
          target: `http://${HOST.local}:7001`,
          changeOrigin: true,
        },
      },
    },
  },
  integrations: [vue()],
})
