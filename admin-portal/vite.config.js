import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The admin portal always runs on 5173 (the backend's CORS allow-list expects this origin).
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true },
});
