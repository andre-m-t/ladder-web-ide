import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // `host: true` faz o dev server escutar em 0.0.0.0, necessário dentro do contêiner.
    host: true,
    port: 5173,
    strictPort: true,
    // Se o hot reload não disparar no seu ambiente (bind mount sem inotify),
    // habilite: watch: { usePolling: true }
  },
})
