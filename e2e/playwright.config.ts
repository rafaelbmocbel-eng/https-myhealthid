import { defineConfig, devices } from '@playwright/test';

// Por padrão sobe o site LOCAL (build de teste + vite preview) em 127.0.0.1:4173. Para testar um endereço já publicado
// (por exemplo uma prévia da Vercel), defina E2E_BASE_URL. PW_CHROMIUM_PATH aponta para um Chromium já instalado.
const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:4173';
const servidorLocal = !process.env.E2E_BASE_URL;
const navegador = process.env.PW_CHROMIUM_PATH
  ? { launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH, args: ['--no-sandbox'] } }
  : {};

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.e2e.ts',
  outputDir: './resultados',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: { baseURL, serviceWorkers: 'block', trace: 'retain-on-failure', screenshot: 'only-on-failure', ...navegador },
  projects: [
    { name: 'computador', use: { ...devices['Desktop Chrome'] } },
    { name: 'celular-android', use: { ...devices['Pixel 7'] } },
    { name: 'celular-iphone', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
  ],
  webServer: servidorLocal
    ? { command: 'npm run servir', url: baseURL, reuseExistingServer: true, timeout: 240_000 }
    : undefined,
});
