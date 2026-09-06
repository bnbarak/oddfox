import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// Slides import the live JSON from ../data/json, so a deck can never drift
// from the library it is describing. Editing a dataset changes the deck.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@data': resolve(__dirname, '../data/json') },
    // recharts brings its own react resolution; without this the app ends up
    // with two React copies and every hook call throws.
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: { include: ['react', 'react-dom', 'react-dom/client', 'recharts'] },
  server: {
    fs: { allow: [resolve(__dirname), resolve(__dirname, '../data')] },
    // CRM pipeline state is read/written by ../server (server/src/index.ts),
    // which owns data/json/crm/*.json. Proxied so the app calls same-origin
    // /api and never needs CORS.
    proxy: { '/api': 'http://127.0.0.1:8787' },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        notes: resolve(__dirname, 'notes.html'),
      },
    },
  },
})
