import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: false,
    // `npm run dev -w @typefight/api` (wrangler) serves the API on 8787.
    proxy: { '/api': 'http://localhost:8787' },
  },
});
