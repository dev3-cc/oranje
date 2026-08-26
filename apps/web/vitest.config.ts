import { fileURLToPath, URL } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  assetsInclude: ['**/*.lottie'],
  resolve: {
    alias: {
      '@lottiefiles/dotlottie-react': fileURLToPath(
        new URL('./src/test/stubs/dotlottie-react.tsx', import.meta.url),
      ),
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@ui': fileURLToPath(new URL('../../packages/ui/src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
    env: { VITE_USE_MOCKS: 'true', VITE_GOOGLE_MAPS_API_KEY: '' },
    coverage: {
      provider: 'v8',
      include: ['src/features/**', 'src/shared/**'],
    },
  },
})
