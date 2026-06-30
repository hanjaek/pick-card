require('dotenv').config()

const express    = require('express')
const cors       = require('cors')
const path       = require('path')
const fs         = require('fs')
const session    = require('express-session')

// 시드 약관용 공용 PDF(sample.pdf)를 업로드 폴더에 보장 (없으면 복사)
// → schema.sql 이 pdf_path='sample.pdf' 로 시드한 약관 다운로드가 항상 동작
try {
  const termsDir = path.join(__dirname, 'uploads', 'terms')
  fs.mkdirSync(termsDir, { recursive: true })
  const dst = path.join(termsDir, 'sample.pdf')
  const src = path.join(__dirname, 'seed-assets', 'sample.pdf')
  if (!fs.existsSync(dst) && fs.existsSync(src)) {
    fs.copyFileSync(src, dst)
    console.log('[seed] sample.pdf 복사 완료')
  }
} catch (e) { console.error('[seed] sample.pdf 복사 실패:', e.message) }

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
const mypageRoutes       = require('./routes/mypage')
const lifeCardRoutes     = require('./routes/lifecard')

const app  = express()
const PORT = process.env.PORT || 4000

/* ================================================================
   Redis 세션 스토어 설정
   ================================================================ */
let sessionStore
// prototype2 는 단독 실행(도커/Redis 없이)이 기본 → MemoryStore 사용.
// Redis 세션이 필요하면 .env 에 USE_REDIS_SESSION=true 설정 시에만 연결.
if (process.env.USE_REDIS_SESSION === 'true') {
  try {
    const connectRedis = require('connect-redis')
    const { master }   = require('./redis')
    const RedisStore   = connectRedis(session)
    sessionStore       = new RedisStore({ client: master, disableTouch: true })
    console.log('[Session] Redis 세션 스토어 사용')
  } catch {
    console.log('[Session] MemoryStore 사용 (Redis 미연결)')
  }
} else {
  console.log('[Session] MemoryStore 사용 (prototype2 단독 실행)')
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
app.use('/api/mypage',       mypageRoutes)
app.use('/api/life-card',    lifeCardRoutes)

/* ================================================================
   정적 파일 서빙 (약관 PDF 등)
   ================================================================ */
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))

/* ================================================================
   헬스체크
   ================================================================ */
app.get('/api/health', (_, res) => {
  // prototype2 는 Redis 없이 단독 실행 (DB만 사용)
  res.json({ status: 'ok', mode: 'standalone' })
})

app.listen(PORT, () => {
  console.log(`BNK 카드 서버 실행 중 → http://localhost:${PORT}`)
})
