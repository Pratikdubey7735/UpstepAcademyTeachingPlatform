// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5000', // Change this if your backend runs on a different port
        changeOrigin: true,
        secure: false, // Set to true if you're using HTTPS
      },
    },
  },
});
