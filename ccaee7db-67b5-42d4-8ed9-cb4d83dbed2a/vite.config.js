import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src'),
        },
    },
    server: {
        port: 3000,
        host: '0.0.0.0',
    },
    css: {
        preprocessorOptions: {
            less: {
                javascriptEnabled: true,
            },
        },
    },
    build: {
        target: 'es2020',
        sourcemap: false,
        rollupOptions: {
            output: {
                manualChunks: {
                    'react-vendor': ['react', 'react-dom', 'react-router-dom'],
                    'ui-vendor': ['antd', '@ant-design/icons'],
                    'chart-vendor': ['echarts', 'echarts-for-react'],
                    'state-vendor': ['zustand', 'immer'],
                },
            },
        },
        chunkSizeWarningLimit: 1000,
    },
});
