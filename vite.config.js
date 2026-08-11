import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  // GitHub Pages serves the site from /<repo-name>/, not the domain root.
  base: process.env.GITHUB_PAGES ? '/MediSuite/' : '/',
  plugins: [react()],
  server: {
    // Honor the port assigned by the harness (PORT env), fall back to 5173.
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
    // The NestJS backend (server/) — reports & vaccine-card documents.
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
})
