import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  server: {
    fs: {
      allow: ['..']
    }
  },
  resolve: {
    alias: {
      'core-saas': path.resolve(__dirname, '../core-saas'),
      // Forzamos a que las dependencias de la carpeta externa se busquen aquí
      '@supabase/supabase-js': path.resolve(__dirname, 'node_modules/@supabase/supabase-js'),
      '@tanstack/react-query': path.resolve(__dirname, 'node_modules/@tanstack/react-query')
    }
  }
})
