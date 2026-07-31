import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// SI-04: the frontend consumes the backend exclusively over REST; nothing here proxies to a
// database or third party. `/api` forwards to packet 12's Express app during `npm run dev` so
// the browser can call relative paths with no CORS configuration to keep in sync.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
