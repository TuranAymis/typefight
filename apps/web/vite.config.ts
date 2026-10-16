import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const CRAZYGAMES_SDK = 'https://sdk.crazygames.com/crazygames-sdk-v2.js';

/**
 * The CrazyGames upload: the portal SDK goes in, the Google Fonts links go out (a portal build must
 * be self-contained; the CSS font stacks fall back to system fonts).
 */
const crazygamesHtml = (): Plugin => ({
  name: 'typefight-crazygames-html',
  transformIndexHtml: (html) =>
    html
      .replace(/\s*<link\b[^>]*?fonts\.(?:googleapis|gstatic)\.com[^>]*>/g, '')
      .replace('</head>', `    <script src="${CRAZYGAMES_SDK}"></script>\n  </head>`),
});

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const portal = mode === 'crazygames';
  if (portal && !loadEnv(mode, process.cwd(), 'VITE_')['VITE_API_BASE']) {
    // On the portal's domain a relative /api would hit the portal, so the API address is required.
    throw new Error(
      'The CrazyGames build needs VITE_API_BASE (the deployed API URL), e.g. ' +
        'VITE_API_BASE=https://typefight-api.example.workers.dev npm run build:crazygames',
    );
  }
  return {
    // Portals serve the game from a sub-path: every asset URL must be relative.
    base: portal ? './' : '/',
    plugins: [react(), ...(portal ? [crazygamesHtml()] : [])],
    build: { outDir: portal ? 'dist-crazygames' : 'dist' },
    server: {
      port: 5173,
      open: false,
      // `npm run dev -w @typefight/api` (wrangler) serves the API on 8787.
      proxy: { '/api': 'http://localhost:8787' },
    },
  };
});
