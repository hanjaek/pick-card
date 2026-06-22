const router = require('express').Router()
const pool   = require('../db')
const multer = require('multer')
const path   = require('path')
const fs     = require('fs')
const jwt    = require('jsonwebtoken')

// PDF 저장 디렉터리 (서버 기동 시 없으면 자동 생성)
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'terms')
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true })

// ---- multer 설정 ----
// 파일명 형식: YYYY-MM-DD_NNN.pdf
// NNN = 같은 날 업로드된 파일 순번 (001, 002, ...)
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, UPLOAD_DIR),
  filename: (_, file, cb) => {
    const today    = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
    const existing = fs.readdirSync(UPLOAD_DIR).filter(f => f.startsWith(today))
    const seq      = String(existing.length + 1).padStart(3, '0')
    cb(null, `${today}_${seq}.pdf`)
  }
})

const upload = multer({
  storage,
  fileFilter: (_, file, cb) => {
    // PDF만 허용
    if (file.mimetype === 'application/pdf') cb(null, true)
    else cb(new Error('PDF 파일만 업로드할 수 있습니다.'))
  },
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB 제한
})

// ---- 관리자 권한 미들웨어 ----
// Authorization: Bearer <token> 헤더를 검증하고 is_admin 확인
function adminOnly(req, res, next) {
  const auth = req.headers.authorization
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ message: '인증이 필요합니다.' })
  }

  try {
    const payload = jwt.verify(
      auth.split(' ')[1],
      process.env.JWT_SECRET || 'dev_secret_change_in_prod'
    )
    if (!payload.is_admin) {
      return res.status(403).json({ message: '관리자 권한이 필요합니다.' })
    }
    req.admin = payload
    next()
  } catch {
    res.status(401).json({ message: '유효하지 않은 토큰입니다.' })
  }
}

/* ======================================================
   GET /api/terms?card_id=1  -  카드별 약관 목록 조회
   ====================================================== */
router.get('/', async (req, res) => {
  try {
    const { card_id } = req.query

    let sql    = 'SELECT * FROM terms ORDER BY card_id, reg_dt DESC'
    let params = []

    if (card_id) {
      sql    = 'SELECT * FROM terms WHERE card_id = ? ORDER BY reg_dt DESC'
      params = [card_id]
    }

    const [rows] = await pool.query(sql, params)
    res.json(rows)
  } catch (err) {
    console.error('[terms GET /]', err)
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

/* ======================================================
   GET /api/terms/:id/history  -  약관 변경 이력 조회
   ====================================================== */
router.get('/:id/history', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM terms_history WHERE terms_id = ? ORDER BY change_dt DESC',
      [req.params.id]
    )
    res.json(rows)
  } catch (err) {
    console.error('[terms GET /:id/history]', err)
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

/* ======================================================
   POST /api/terms/upload  -  약관 PDF 등록/수정 (관리자 전용)
   Body (multipart/form-data):
     - card_id, version_no, terms_title, terms_content,
       effective_dt, change_reason, file (PDF)
   ====================================================== */
router.post('/upload', adminOnly, upload.single('file'), async (req, res) => {
  const { card_id, version_no, terms_title, terms_content, effective_dt, change_reason } = req.body
  const pdf_path = req.file ? req.file.filename : null

  if (!card_id || !version_no) {
    return res.status(400).json({ message: 'card_id와 version_no는 필수입니다.' })
  }

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    // 기존 현행 약관을 비활성화 (같은 카드의 이전 버전)
    await conn.query(
      'UPDATE terms SET is_active = 0 WHERE card_id = ? AND is_active = 1',
      [card_id]
    )

    // 새 약관 등록
    const [result] = await conn.query(
      `INSERT INTO terms (card_id, version_no, terms_title, terms_content, pdf_path, effective_dt, is_active)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [card_id, version_no, terms_title || null, terms_content || null, pdf_path, effective_dt || null]
    )

    // 변경 이력 기록
    await conn.query(
      `INSERT INTO terms_history (terms_id, version_no, change_content, modifier_id, pdf_path)
       VALUES (?, ?, ?, ?, ?)`,
      [result.insertId, version_no, change_reason || '신규 등록', req.admin.username, pdf_path]
    )

    await conn.commit()
    res.status(201).json({ message: '약관이 등록되었습니다.', pdf_path })
  } catch (err) {
    await conn.rollback()
    // 트랜잭션 실패 시 업로드된 파일 삭제
    if (pdf_path) {
      const filePath = path.join(UPLOAD_DIR, pdf_path)
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
    }
    console.error('[terms POST /upload]', err)
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  } finally {
    conn.release()
  }
})

module.exports = router
