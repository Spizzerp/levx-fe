import { resolve } from 'node:path'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const loadedEnv = loadEnv(mode, process.cwd(), '')

  return {
    envPrefix: 'APP_',
    plugins: [react(), tailwindcss()],
    define: {
      'import.meta.env.VITE_EIGENCACHE_QUOTES_ENABLED': JSON.stringify(
        loadedEnv.VITE_EIGENCACHE_QUOTES_ENABLED ?? '',
      ),
      'process.env': {},
      global: 'globalThis',
    },
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
  }
})
