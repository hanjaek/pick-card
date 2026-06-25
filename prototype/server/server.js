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
const ocrRouter          = require('./routes/ocr')
const chatbotRoutes      = require('./routes/chatbot')
const verifyRoutes       = require('./routes/verify')
const adminRoutes        = require('./routes/admin')

const app  = express()
const PORT = process.env.PORT || 4000

/* ================================================================
   Redis 세션 스토어 설정
   ================================================================ */
let sessionStore
try {
  const connectRedis = require('connect-redis')
  const { master }   = require('./redis')
  const RedisStore   = connectRedis(session)
  // disableTouch: 요청마다 TTL 자동연장 끔 → 고정 60분 만료.
  // 연장은 오직 명시적 /api/auth/extend 호출로만 발생 (카운트다운 타이머가 의미를 가짐)
  sessionStore       = new RedisStore({ client: master, disableTouch: true })
  console.log('[Session] Redis 세션 스토어 사용')
} catch {
  console.log('[Session] MemoryStore 사용 (Redis 미연결)')
}

app.use(session({
  store:             sessionStore,
  secret:            process.env.SESSION_SECRET || 'bnk-pickard-dev-secret',
  resave:            false,
  saveUninitialized: false,
  rolling:           false,
  cookie: {
    httpOnly: true,
    secure:   false,
    maxAge:   60 * 60 * 1000,
  },
}))

app.use(express.json({ limit: '10mb' }))

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
app.use('/api/ocr',          ocrRouter)
app.use('/api/chatbot',      chatbotRoutes)
app.use('/api/verify',       verifyRoutes)
app.use('/api/admin',        adminRoutes)

/* ================================================================
   정적 파일 서빙 (약관 PDF 등)
   ================================================================ */
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))

/* ================================================================
   헬스체크
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
