# ============================================================
#  BNK Pickard 백엔드 서버 이미지
#  - debian 기반(node:20-slim): bcrypt 등 네이티브 모듈 호환성 안정
# ============================================================
FROM node:20-slim

WORKDIR /app

# 의존성 먼저 설치 (레이어 캐시 활용)
COPY package*.json ./
RUN npm install --omit=dev

# 앱 소스 복사
COPY . .

EXPOSE 4000

CMD ["node", "server.js"]