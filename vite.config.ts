import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    open: false,
    port: 3000,
  },
  build: {
    outDir: 'build'
  },
//   base: '/',
  plugins: [react()],
  optimizeDeps: {
    include: ['@mui/material', '@emotion/react', '@emotion/styled']
  },
//   test: {
//     globals: true,
//     environment: 'jsdom',
//     setupFiles: './src/setupTests.ts',
//     css: true,
//     reporters: ['verbose'],
//     coverage: {
//         reporter: ['text', 'json', 'html'],
//         include: ['src/**/*'],
//         exclude: [],
//     }
//   },
})
