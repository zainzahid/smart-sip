import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/psx': {
        target: 'https://dps.psx.com.pk',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/psx/, ''),
      },
    },
  },
})
