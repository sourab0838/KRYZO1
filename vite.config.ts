import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react-router') || id.includes('/react/') || id.includes('/react-dom/') || id.includes('scheduler/')) {
              return 'react-vendor';
            }
            if (id.includes('@supabase/supabase-js') || id.includes('@supabase/')) {
              return 'supabase';
            }
            if (id.includes('lucide-react') || id.includes('lucide/')) {
              return 'lucide';
            }
            return 'vendor';
          }
        },
      },
    },
  },
});
