import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    // Testes ponta a ponta (Playwright, tarefa #14) rodam por `e2e/rodar.sh`, não pelo vitest.
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
