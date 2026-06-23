const router  = require('express').Router()
const jwt     = require('jsonwebtoken')
const pool    = require('../db')

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
   POST /api/applications  -  카드 신청
   ====================================================== */
router.post('/', authMiddleware, async (req, res) => {
  const {
    cardId, applicantName, birthDt, phoneNo, email,
    address, billingDay, creditLimit, applyMethod, designId
  } = req.body

  if (!cardId || !applicantName || !birthDt || !phoneNo) {
    return res.status(400).json({ message: '필수 항목을 입력해주세요.' })
  }

  try {
    const [existing] = await pool.query(
      "SELECT id FROM card_applications WHERE user_id = ? AND card_id = ? AND status != 'CANCELLED'",
      [req.user.id, cardId]
    )
    if (existing.length > 0) {
      return res.status(409).json({ message: '이미 신청한 카드입니다.' })
    }

    const [result] = await pool.query(
      `INSERT INTO card_applications
        (user_id, card_id, applicant_name, birth_dt, phone_no, email, address, billing_day, credit_limit, apply_method, design_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, cardId, applicantName, birthDt, phoneNo,
       email || null, address || null,
       billingDay || 15, creditLimit || 0,
       applyMethod || 'INTERNET', designId || null]
    )

    res.status(201).json({ id: result.insertId, message: '카드 신청이 완료되었습니다.' })
  } catch (err) {
    console.error('[applications POST /]', err)
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

/* ======================================================
   GET /api/applications/me  -  내 신청 내역
   ====================================================== */
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
         a.id, a.status, a.apply_method AS applyMethod,
         a.billing_day AS billingDay, a.applied_dt AS appliedDt,
         c.id AS cardId, c.prd_nm AS cardName,
         c.card_type_cd AS cardType, c.color_from AS colorFrom, c.color_to AS colorTo,
         c.network, c.annual_fee AS annualFee,
         cd.theme_name AS designTheme, cd.color_from AS designColorFrom, cd.color_to AS designColorTo
       FROM card_applications a
       JOIN cards c ON c.id = a.card_id
       LEFT JOIN custom_designs cd ON cd.id = a.design_id
       WHERE a.user_id = ?
       ORDER BY a.applied_dt DESC`,
      [req.user.id]
    )
    res.json(rows)
  } catch (err) {
    console.error('[applications GET /me]', err)
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

/* ======================================================
   PATCH /api/applications/:id/cancel  -  신청 취소
   ====================================================== */
router.patch('/:id/cancel', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id FROM card_applications WHERE id = ? AND user_id = ? AND status = 'PENDING'",
      [req.params.id, req.user.id]
    )
    if (rows.length === 0) {
      return res.status(404).json({ message: '취소 가능한 신청 건이 없습니다.' })
    }
    await pool.query(
      "UPDATE card_applications SET status = 'CANCELLED', processed_dt = NOW() WHERE id = ?",
      [req.params.id]
    )
    res.json({ message: '신청이 취소되었습니다.' })
  } catch (err) {
    console.error('[applications PATCH /:id/cancel]', err)
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

module.exports = router
