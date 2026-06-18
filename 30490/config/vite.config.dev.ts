import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import checker from 'vite-plugin-checker';
import path from 'path';

export default defineConfig({
  mode: 'development',
  plugins: [
    react(),
    checker({
      typescript: true,
      eslint: {
        lintCommand: 'eslint "./src/**/*.{ts,tsx}"',
      },
    }),
  ],
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
  server: {
    port: 5173,
    open: true,
    host: true,
    hmr: true,
  },
  css: {
    modules: {
      localsConvention: 'camelCase',
      generateScopedName: '[name]__[local]___[hash:base64:5]',
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '0.1.0'),
  },
});
