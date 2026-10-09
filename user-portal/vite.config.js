import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The user portal always runs on 5174 (the backend's CORS allow-list expects this origin).
export default defineConfig({
  plugins: [react()],
  server: { port: 5174, strictPort: true },
});
