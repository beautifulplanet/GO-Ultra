import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:5177',
    headless: true,
    viewport: { width: 1280, height: 720 },
  },
  webServer: {
    command: 'npx vite --port 5177 --force',
    port: 5177,
    reuseExistingServer: true,
    timeout: 15000,
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
})
