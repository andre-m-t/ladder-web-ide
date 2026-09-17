/**
 * Configuração do Playwright (spec 002, tarefa #14, CA-8).
 *
 * Roda contra um `vite preview` já de pé em 127.0.0.1:4173 (subido por
 * `rodar.sh`, dentro do contêiner, sem publicar porta nenhuma — Regra 5 do
 * CLAUDE.md: 8000 e 5173 já estão ocupadas por outros projetos nesta
 * máquina, e mesmo a 4173 fica só dentro do contêiner). Por isso não há
 * `webServer` aqui: subir o servidor é responsabilidade do script, que
 * também espera a porta ficar pronta antes de chamar `playwright test`.
 *
 * Só o projeto `chromium` — a imagem `mcr.microsoft.com/playwright` já traz
 * os navegadores; nenhum outro é necessário para este teste.
 */
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  outputDir: 'test-results',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
