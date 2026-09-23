import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Source lives in web/, the build goes to dist/ (served by server/index.js).
// shared/ sits outside web/, so the dev server is allowed to read it.
export default defineConfig({
  root: 'web',
  plugins: [react()],
  build: { outDir: '../dist', emptyOutDir: true },
  server: {
    fs: { allow: ['..'] },
    proxy: { '/api': 'http://127.0.0.1:3000', '/health': 'http://127.0.0.1:3000' },
  },
})
