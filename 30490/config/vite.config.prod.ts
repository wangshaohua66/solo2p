import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  mode: 'production',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../src'),
      '@components': path.resolve(__dirname, '../src/components'),
      '@pages': path.resolve(__dirname, '../src/pages'),
      '@store': path.resolve(__dirname, '../src/store'),
      '@db': path.resolve(__dirname, '../src/db'),
      '@storage': path.resolve(__dirname, '../src/storage'),
      '@hooks': path.resolve(__dirname, '../src/hooks'),
      '@utils': path.resolve(__dirname, '../src/utils'),
      '@i18n': path.resolve(__dirname, '../src/i18n'),
      '@styles': path.resolve(__dirname, '../src/styles'),
      '@types': path.resolve(__dirname, '../src/types'),
    },
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    sourcemap: false,
    minify: 'esbuild',
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom', 'zustand'],
          db: ['dexie'],
          utils: ['jszip', 'uuid'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
  css: {
    modules: {
      localsConvention: 'camelCase',
      generateScopedName: '[hash:base64:8]',
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '0.1.0'),
  },
});
