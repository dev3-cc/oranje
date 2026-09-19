import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  reporter: [['list']],
  use: {
    viewport: { width: 1440, height: 1024 },
  },
  projects: [
    {
      name: 'preview-prod',
      use: { baseURL: 'http://localhost:4373' },
    },
    {
      name: 'dev-local',
      use: { baseURL: 'http://localhost:5373' },
    },
  ],
  webServer: [
    {
      command: 'pnpm exec vite --port 5373 --strictPort',
      url: 'http://localhost:5373',
      env: { VITE_USE_MOCKS: 'true' },
      reuseExistingServer: true,
      timeout: 90_000,
    },
    {
      command: 'pnpm exec vite build && pnpm exec vite preview --port 4373 --strictPort',
      url: 'http://localhost:4373',
      env: { VITE_USE_MOCKS: 'true' },
      reuseExistingServer: false,
      timeout: 300_000,
    },
  ],
})
