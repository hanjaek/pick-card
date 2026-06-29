const router = require('express').Router()
const jwt    = require('jsonwebtoken')
const pool   = require('../db')

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization
  if (!auth) return res.status(401).json({ message: '로그인이 필요합니다.' })
  try {
    req.user = jwt.verify(auth.replace('Bearer ', ''), process.env.JWT_SECRET || 'dev_secret')
    next()
  } catch {
    res.status(401).json({ message: '유효하지 않은 토큰입니다.' })
  }
}

/* ======================================================
   GET /api/mypage/spending  -  이번 달 카테고리별 소비 집계
   (transactions 테이블 실제 집계 — 사용자마다 다름)
   ====================================================== */
router.get('/spending', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT category_cd AS category, SUM(amount) AS amount, COUNT(*) AS cnt
       FROM transactions
       WHERE user_id = ?
         AND paid_dt >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
       GROUP BY category_cd`,
      [req.user.id]
    )
    res.json(rows)
  } catch (err) {
    console.error('[mypage GET /spending]', err)
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

module.exports = router
