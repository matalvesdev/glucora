import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  use: { baseURL: 'http://127.0.0.1:5173', trace: 'retain-on-failure' },
  webServer: [
    {
      command: 'node --env-file=.env.local services/api/dist/server.js',
      url: 'http://127.0.0.1:3001/v1/health',
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'pnpm dev:web',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: !process.env.CI,
    },
  ],
});
