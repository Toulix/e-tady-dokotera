import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Bind to all interfaces so the dev server is reachable from the Docker host.
    // Without this, Vite only listens on 127.0.0.1 inside the container and
    // port 5173 is never forwarded correctly.
    host: true,
    port: 5173,
  },
})
