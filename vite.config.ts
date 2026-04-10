import { resolve } from 'node:path'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  envPrefix: 'APP_',
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
    extensions: ['.ts', '.tsx', '.json', '.js', '.jsx'],
  },
  server: {
    port: 3030,
  },
  preview: {
    port: 3030,
  },
})
