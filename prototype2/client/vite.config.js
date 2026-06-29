import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5180,  // prototype2 미리보기용 (도커 3000과 충돌 회피)
    // /api 요청을 prototype2 자체 백엔드(4000 · bnk_life DB)로 프록시
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true
      }
    }
  }
})
