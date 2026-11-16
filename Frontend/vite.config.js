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
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('elkjs')) {
              return 'elk';
            }
            if (id.includes('cytoscape')) {
              return 'cytoscape';
            }
            if (id.includes('mermaid') || id.includes('dagre')) {
              return 'mermaid';
            }
            if (id.includes('katex')) {
              return 'katex';
            }
            if (id.includes('three')) {
              return 'three';
            }
            if (id.includes('recharts') || id.includes('d3-')) {
              return 'charts';
            }
            if (id.includes('jspdf') || id.includes('html2canvas') || id.includes('html2pdf')) {
              return 'pdf';
            }
            if (id.includes('framer-motion')) {
              return 'framer';
            }
            if (id.includes('lucide-react')) {
              return 'icons';
            }
            if (id.includes('react-markdown') || id.includes('remark') || id.includes('rehype') || id.includes('prismjs')) {
              return 'markdown';
            }
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
              return 'react-vendor';
            }
          }
        },
      },
    },
  },
})

