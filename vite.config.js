import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  // GitHub Pages serves the site from /<repo-name>/, not the domain root.
  // Read the name from GITHUB_REPOSITORY ("owner/repo", always set by Actions)
  // so a repo rename can't leave the build pointing at a stale path.
  base: process.env.GITHUB_PAGES
    ? `/${(process.env.GITHUB_REPOSITORY || '').split('/')[1] || 'AI-Powered-Telemedicine-Management-System'}/`
    : '/',
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
