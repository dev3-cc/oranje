import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const { version } = JSON.parse(
  readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf8'),
) as { version: string }

export default defineConfig({
  plugins: [react(), tailwindcss()],
  assetsInclude: ['**/*.lottie'],
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@ui': fileURLToPath(new URL('../../packages/ui/src', import.meta.url)),
    },
  },
  server: { port: 5173, strictPort: true },
  preview: {
    port: 4173,
    strictPort: true,
    proxy: { '/api': 'http://localhost:3000' },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
})
