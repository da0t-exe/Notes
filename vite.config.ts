import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Read rather than hard-coded, so the About row cannot drift from the release.
const { version } = JSON.parse(readFileSync('./package.json', 'utf-8')) as { version: string }

// Tauri drives the dev server on a fixed port and reads the build from ../dist.
export default defineConfig({
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(version) },
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
