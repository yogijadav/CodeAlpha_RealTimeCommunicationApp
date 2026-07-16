import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // FIX: Force Vite to load the combined .env file from the root directory
  envDir: '../', 
});
