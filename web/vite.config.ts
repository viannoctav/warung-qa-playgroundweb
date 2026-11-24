import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Di laptop, request /api/... diteruskan ke API yang jalan di port 3000
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})
