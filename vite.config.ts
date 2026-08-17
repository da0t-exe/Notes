import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Tauri drives the dev server on a fixed port and reads the build from ../dist.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    watch: {
      // Cargo writes into src-tauri/target while the dev server is running, and
      // the watcher dies with EBUSY the moment it opens a build artifact mid-write.
      ignored: ['**/src-tauri/**'],
    },
  },
  build: {
    target: 'es2023',
    sourcemap: true,
  },
})
