import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'

try {
  process.chdir(fs.realpathSync('.'))
} catch {}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          // React runtime
          'react-vendor': ['react', 'react-dom'],
          // Animation library
          'framer': ['framer-motion'],
          // Markdown rendering
          'markdown': ['react-markdown', 'remark-gfm'],
          // PDF export
          'pdf': ['jspdf', 'html2canvas'],
          // Charts
          'charts': ['recharts'],
        },
      },
    },
  },
})

