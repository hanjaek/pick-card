import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5180,  // prototype2 미리보기용 (도커 3000과 충돌 회피)
    // /api 요청을 현재 실행 중인 도커 스택(nginx 3000)으로 프록시
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  }
})
