import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          konva: ['konva', 'react-konva'],
          dexie: ['dexie', 'dexie-react-hooks'],
          dndkit: ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],
          vendor: ['react', 'react-dom', 'react-router-dom', 'zustand', 'immer', 'lucide-react'],
        },
      },
    },
  },
});
