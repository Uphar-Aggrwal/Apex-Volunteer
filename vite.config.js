import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Vite 8 (Rolldown) requires manualChunks as a function
        manualChunks(id) {
          if (id.includes('firebase')) return 'firebase-core';
          if (id.includes('papaparse')) return 'papaparse';
        },
      },
    },
    chunkSizeWarningLimit: 800,
  },
});
