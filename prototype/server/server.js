require('dotenv').config()

const express    = require('express')
const cors       = require('cors')
const path       = require('path')
const authRoutes  = require('./routes/auth')
const cardRoutes  = require('./routes/cards')
const termsRoutes = require('./routes/terms')

const app  = express()
const PORT = process.env.PORT || 4000

app.use(express.json())

app.use(cors({
  origin:      'http://localhost:3000',
  credentials: true
}))

// API 라우터
app.use('/api/auth',  authRoutes)
app.use('/api/cards', cardRoutes)
app.use('/api/terms', termsRoutes)

// PDF 파일 정적 서빙: /uploads/terms/2026-06-23_001.pdf 형태로 접근 가능
// 프론트에서 <a href="/uploads/terms/파일명.pdf"> 로 다운로드/미리보기
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))

app.get('/api/health', (_, res) => res.json({ status: 'ok' }))

app.listen(PORT, () => {
  console.log(`BNK 카드 서버 실행 중 -> http://localhost:${PORT}`)
})
