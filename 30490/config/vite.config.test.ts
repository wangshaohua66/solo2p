import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  mode: 'test',
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
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['../tests/setup.ts'],
    include: ['../tests/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['../node_modules', '../dist'],
    css: {
      modules: {
        classNameStrategy: 'non-scoped',
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.d.ts',
        'src/main.tsx',
        'src/**/*.stories.{ts,tsx}',
      ],
    },
  },
  css: {
    modules: {
      localsConvention: 'camelCase',
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify('test'),
  },
});
