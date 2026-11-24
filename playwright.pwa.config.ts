import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  testMatch: 'pwa.spec.ts',
  use: { baseURL: 'http://localhost:4173/50days/' },
  webServer: {
    command: 'npm run preview -- --base /50days/ --port 4173 --strictPort',
    url: 'http://localhost:4173/50days/',
  },
})
