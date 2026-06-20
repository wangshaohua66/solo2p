import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  server: {
    port: 3000,
    open: true
  },
  build: {
    target: 'es2015',
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: {
          vue: ['vue', 'vue-router', 'pinia'],
          pdf: ['pdfjs-dist'],
          audio: ['wavesurfer.js']
        }
      }
    }
  },
  optimizeDeps: {
    include: ['localforage', 'dayjs', 'jspdf', 'jszip']
  }
})
