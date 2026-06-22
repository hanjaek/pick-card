const router = require('express').Router()
const pool   = require('../db')

/* ======================================================
   GET /api/cards  -  카드 목록 조회
   쿼리 파라미터: ?type=신용카드  또는  ?type=체크카드
   ====================================================== */
router.get('/', async (req, res) => {
  try {
    const { type } = req.query

    // type 파라미터 유무에 따라 쿼리 분기
    let sql    = 'SELECT * FROM cards ORDER BY id'
    let params = []

    if (type) {
      sql    = 'SELECT * FROM cards WHERE type = ? ORDER BY id'
      params = [type]
    }

    const [rows] = await pool.query(sql, params)

    // DB에 JSON 문자열로 저장된 benefits 필드를 배열로 파싱
    const cards = rows.map(row => ({
      ...row,
      benefits: typeof row.benefits === 'string'
        ? JSON.parse(row.benefits)
        : row.benefits
    }))

    res.json(cards)
  } catch (err) {
    console.error('[cards GET /]', err)
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

/* ======================================================
   GET /api/cards/:id  -  카드 상세 조회
   ====================================================== */
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM cards WHERE id = ?', [req.params.id])

    if (rows.length === 0) {
      return res.status(404).json({ message: '해당 카드를 찾을 수 없습니다.' })
    }

    const card = rows[0]
    if (typeof card.benefits === 'string') {
      card.benefits = JSON.parse(card.benefits)
    }

    res.json(card)
  } catch (err) {
    console.error('[cards GET /:id]', err)
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

module.exports = router
