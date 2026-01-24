import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // IMPORTANT: Set base to './' for GitHub Pages to load assets correctly 
  // regardless of the repository name/subdirectory.
  base: './',
  build: {
    outDir: 'dist',
  }
});