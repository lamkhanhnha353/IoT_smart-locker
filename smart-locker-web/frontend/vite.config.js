import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  // mới thêm cấu hình server
  server: {
    allowedHosts: true,
    proxy: {
      '/api': 'http://localhost:5000' // Mọi API gọi từ React sẽ tự động chui xuống Backend
    }
  }
})