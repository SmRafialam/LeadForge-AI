import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev server proxies API + websocket traffic to the Node backend on :5178.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:5178',
      '/socket.io': { target: 'http://localhost:5178', ws: true },
    },
  },
});
