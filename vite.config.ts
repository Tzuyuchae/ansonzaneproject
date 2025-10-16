import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/',        // ensures JS/CSS assets load from root in production
  plugins: [react()],
  server: {
    port: 3000,
  },
});