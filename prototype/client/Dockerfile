# ============================================================
#  프론트엔드 이미지 (멀티스테이지)
#  1단계: React 앱 빌드 (vite build → dist)
#  2단계: nginx 가 정적 빌드 서빙 + /api 백엔드 프록시
# ============================================================

# ── 1단계: 빌드 ──
FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# ── 2단계: nginx 서빙 ──
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
