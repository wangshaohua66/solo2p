import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  css: {
    preprocessorOptions: {
      less: {
        javascriptEnabled: true,
        modifyVars: {
          'primary-color': '#1890ff',
          'heading-color': 'rgba(255, 255, 255, 0.85)',
          'text-color': 'rgba(255, 255, 255, 0.75)',
          'text-color-secondary': 'rgba(255, 255, 255, 0.45)',
          'background-color': '#0a0e1a',
          'component-background': '#0f172a',
          'border-color-base': '#1e293b',
          'border-color-split': '#1e293b',
          'layout-body-background': '#0a0e1a',
          'layout-header-background': '#0f172a',
          'layout-sider-background': '#0f172a',
          'modal-mask-bg': 'rgba(0, 0, 0, 0.7)',
        },
      },
    },
  },
});
