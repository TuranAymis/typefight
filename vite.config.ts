/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@engine': path.resolve(__dirname, './src/engine'),
      '@ui': path.resolve(__dirname, './src/ui'),
      '@store': path.resolve(__dirname, './src/store'),
      '@content': path.resolve(__dirname, './src/content'),
    },
  },
  server: {
    port: 5173,
    open: false,
  },
  test: {
    environment: 'node',
  },
});
