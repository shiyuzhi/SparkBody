import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // 窮途末路了
  base: "/SparkBody/",
  optimizeDeps: {
    include: [
      "@mediapipe/holistic",
      "@mediapipe/camera_utils",
      "@mediapipe/drawing_utils",
    ],
  },
  server: {
    hmr: { overlay: false },
    watch: { ignored: ['**/node_modules/**', '**/dist/**'] },
  },
})