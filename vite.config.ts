import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  base: '/simple-generation-page/',
  plugins: [react(), tailwindcss()],
})
