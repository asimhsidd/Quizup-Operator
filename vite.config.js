import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev proxy target: the local KWIZ backend (Quizup/docs/local-dev.md). Pointing dev at prod is
// opt-in with VITE_PROXY_TARGET=https://play.kwiz.live, and then everything you click is real.
const PROXY_TARGET = process.env.VITE_PROXY_TARGET || 'http://localhost:3001';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174, // the game frontend owns 5173
    proxy: {
      '/api':       { target: PROXY_TARGET, changeOrigin: true },
      '/uploads':   { target: PROXY_TARGET, changeOrigin: true },
      '/socket.io': { target: PROXY_TARGET, ws: true, changeOrigin: true },
    },
  },
});
