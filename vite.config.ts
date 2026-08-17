import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Tauri drives the dev server on a fixed port and reads the build from ../dist.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    target: 'es2023',
    sourcemap: true,
  },
})
