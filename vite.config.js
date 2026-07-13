import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Honor the port assigned by the harness (PORT env), fall back to 5173.
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
  },
})
