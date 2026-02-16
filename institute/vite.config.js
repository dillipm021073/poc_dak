import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import noHostCheck from './vite-no-host-check.js'

export default defineConfig({
  plugins: [react(), noHostCheck()],
  server: {
    host: '0.0.0.0',
    port: 5175,
    strictPort: false,
    hmr: {
      protocol: 'wss',
      clientPort: 443,
      host: 'localhost'
    },
    proxy: {}
  }
})
