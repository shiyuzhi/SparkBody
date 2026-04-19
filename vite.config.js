import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: "/SparkBody/",
  optimizeDeps: {
    include: [
      "@mediapipe/holistic",
      "@mediapipe/camera_utils",
      "@mediapipe/drawing_utils",
    ],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("DraggableyouTube"))          return "yt-player";
          if (id.includes("bootstrap"))                  return "bootstrap";
          if (id.includes("node_modules/react-dom"))     return "vendor";
          if (id.includes("node_modules/react/"))        return "vendor";
        }
      }
    }
  },
  server: {
    hmr: { overlay: false },
    watch: { ignored: ['**/node_modules/**', '**/dist/**'] },
  },
})