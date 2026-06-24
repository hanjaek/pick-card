require('dotenv').config()

const express    = require('express')
const cors       = require('cors')
const path       = require('path')
const session    = require('express-session')

const authRoutes         = require('./routes/auth')
const cardRoutes         = require('./routes/cards')
const termsRoutes        = require('./routes/terms')
const applicationsRoutes = require('./routes/applications')
const designRoutes       = require('./routes/design')
const recommendRoutes    = require('./routes/recommend')

const app  = express()
const PORT = process.env.PORT || 4000

/* ================================================================
   Redis 세션 스토어 설정
   - Redis가 실행 중이면 세션을 Redis에 저장 (Master에 씀)
   - Redis 미연결 시 MemoryStore 폴백 (개발 편의)
   ================================================================ */
let sessionStore
try {
  const connectRedis = require('connect-redis')
  const { master }   = require('./redis')
  const RedisStore   = connectRedis(session)
  sessionStore       = new RedisStore({ client: master })
  console.log('[Session] Redis 세션 스토어 사용')
} catch {
  console.log('[Session] MemoryStore 사용 (Redis 미연결)')
}

app.use(session({
  store:             sessionStore,                         // Redis or Memory
  secret:            process.env.SESSION_SECRET || 'bnk-pickard-dev-secret',
  resave:            false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,    // JS에서 쿠키 접근 차단 (XSS 방어)
    secure:   false,   // HTTPS 환경에서는 true 로 변경
    maxAge:   24 * 60 * 60 * 1000,   // 24시간
  },
}))

app.use(express.json())

app.use(cors({
  origin:      'http://localhost:3000',
  credentials: true,
}))

/* ================================================================
   API 라우터
   ================================================================ */
app.use('/api/auth',         authRoutes)
app.use('/api/cards',        cardRoutes)
app.use('/api/terms',        termsRoutes)
app.use('/api/applications', applicationsRoutes)
app.use('/api/design',       designRoutes)
app.use('/api/recommend',    recommendRoutes)

/* ================================================================
   정적 파일 서빙 (약관 PDF 등)
   ================================================================ */
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))

/* ================================================================
   헬스체크 — Redis 연결 상태도 함께 반환
   ================================================================ */
app.get('/api/health', async (_, res) => {
  let redisStatus = 'disconnected'
  try {
    const { master } = require('./redis')
    await master.ping()
    redisStatus = 'connected'
  } catch {}

  res.json({ status: 'ok', redis: redisStatus })
})

app.listen(PORT, () => {
  console.log(`BNK 카드 서버 실행 중 → http://localhost:${PORT}`)
})
