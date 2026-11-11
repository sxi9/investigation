import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  base: '/',
  build: { rollupOptions: { input: { login: path.resolve(__dirname, 'index.html'), desk: path.resolve(__dirname, 'desk.html'), board: path.resolve(__dirname, 'board.html'), share: path.resolve(__dirname, 'share.html') } }, chunkSizeWarningLimit: 1500 },
  server: { port: 5173, host: true, proxy: { '/api': { target: 'http://127.0.0.1:8787', changeOrigin: false } } },
  preview: { port: 4173, proxy: { '/api': { target: 'http://127.0.0.1:8787', changeOrigin: false } } },
});
