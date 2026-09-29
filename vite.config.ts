import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Relative asset paths, so the build works under a sub-path such as GitHub Pages' /RouteWise/.
  base: './',
  plugins: [react()],
})
