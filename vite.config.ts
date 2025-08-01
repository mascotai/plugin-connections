import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  root: 'src/frontend',
  base: '/api/panels/connections/',
  build: {
    outDir: '../../dist/frontend',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'src/frontend/index.html'),
      },
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom', '@tanstack/react-query'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/frontend'),
      '@elizaos/core': path.resolve(__dirname, '../../node_modules/@elizaos/core'),
    },
  },
  server: {
    port: 5174, // Different port to avoid conflicts
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});