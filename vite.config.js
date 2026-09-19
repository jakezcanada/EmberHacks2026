import { defineConfig } from 'vite';

const port = process.env.PORT || 3001;

export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: `http://localhost:${port}`,
        changeOrigin: true,
      },
    },
  },
  build: {
    target: 'esnext',
  },
});
