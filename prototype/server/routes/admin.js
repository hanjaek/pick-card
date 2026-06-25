const router = require('express').Router()
const jwt    = require('jsonwebtoken')
const pool   = require('../db')
const { cache } = require('../redis')

/* ======================================================
   requireAdmin — 관리자 전용 미들웨어
   JWT 의 is_admin 을 검증. 일반 사용자는 403 차단.
   (프론트 숨김에 의존하지 않고 서버에서 권한 통제)
   ====================================================== */
function requireAdmin(req, res, next) {
  const auth = req.headers.authorization
  if (!auth) return res.status(401).json({ message: '로그인이 필요합니다.' })
  try {
    const payload = jwt.verify(auth.replace('Bearer ', ''), process.env.JWT_SECRET || 'dev_secret')
    if (!payload.is_admin) {
      return res.status(403).json({ message: '관리자 권한이 필요합니다.' })
    }
    req.admin = payload
    next()
  } catch {
    res.status(401).json({ message: '유효하지 않은 토큰입니다.' })
  }
}

/* 관리자 활동 로그 기록 헬퍼 */
async function writeLog(admin, action, targetType, targetId, detail) {
  try {
    await pool.query(
      `INSERT INTO admin_logs (admin_id, admin_name, action, target_type, target_id, detail)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [admin.id, admin.username || null, action, targetType, targetId, detail]
    )
  } catch (e) {
    console.error('[admin writeLog]', e.message)
  }
}

/* 카드 목록 캐시 무효화 (관리자 변경 시 사용자 화면 즉시 반영) */
async function bustCardCache() {
  await cache.del('cards:list:all')
  await cache.del('cards:list:신용카드')
  await cache.del('cards:list:체크카드')
}

/* ======================================================
   GET /api/admin/cards  -  전체 카드 (판매중지·점검중 포함)
   사용자용 GET /api/cards 는 ON_SALE 만 보여주지만,
   관리자는 모든 상태의 카드를 봐야 함.
   ====================================================== */
router.get('/cards', requireAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        c.id, c.prd_nm AS name, c.card_type_cd AS type,
        c.annual_fee AS annualFee, c.network,
        c.color_from AS colorFrom, c.color_to AS colorTo,
        c.brand, c.traffic_yn AS trafficYn,
        c.product_feature AS productFeature,
        c.sale_status_cd AS saleStatus, c.view_count AS viewCount,
        c.launch_dt AS launchDt,
        (SELECT COUNT(*) FROM card_applications a
          WHERE a.card_id = c.id AND a.status != 'CANCELLED') AS applyCount
      FROM cards c
      ORDER BY c.id
    `)
    res.json(rows)
  } catch (err) {
    console.error('[admin GET /cards]', err)
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

/* ======================================================
   POST /api/admin/cards  -  카드 신규 등록 (혜택 함께)
   ====================================================== */
router.post('/cards', requireAdmin, async (req, res) => {
  const {
    name, type, annualFee, network, colorFrom, colorTo,
    brand, trafficYn, productFeature, benefits,
  } = req.body

  if (!name || !type) {
    return res.status(400).json({ message: '카드명과 종류는 필수입니다.' })
  }
  if (!['신용카드', '체크카드'].includes(type)) {
    return res.status(400).json({ message: '카드 종류가 올바르지 않습니다.' })
  }

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    // 1) 카드 본체 등록 (등록 직후엔 판매중지 상태로 시작 — 검수 후 판매중 전환)
    const [result] = await conn.query(
      `INSERT INTO cards
        (prd_nm, card_type_cd, annual_fee, network, color_from, color_to,
         brand, traffic_yn, product_feature, sale_status_cd, launch_dt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'OFF_SALE', CURDATE())`,
      [name, type, annualFee || 0, network || 'VISA',
       colorFrom || '#1C1C2E', colorTo || '#2D2D3E',
       brand || '국내전용', trafficYn || 'N', productFeature || null]
    )
    const cardId = result.insertId

    // 2) 혜택 등록 (선택, 배열)
    if (Array.isArray(benefits)) {
      for (const b of benefits) {
        if (!b.desc) continue
        await conn.query(
          `INSERT INTO card_benefits (card_id, bnft_type_cd, bnft_desc, discount_rate, monthly_limit_amt)
           VALUES (?, ?, ?, ?, ?)`,
          [cardId, b.type || '할인', b.desc, b.discountRate || null, b.monthlyLimit || null]
        )
      }
    }

    await conn.commit()
    await writeLog(req.admin, 'CARD_CREATE', 'CARD', cardId, `카드 등록: ${name} (판매중지 상태로 생성)`)
    await bustCardCache()
    res.status(201).json({ id: cardId, message: '카드가 등록되었습니다. (판매중지 상태 — 검수 후 판매중으로 전환하세요)' })
  } catch (err) {
    await conn.rollback()
    console.error('[admin POST /cards]', err)
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  } finally {
    conn.release()
  }
})

/* ======================================================
   PUT /api/admin/cards/:id  -  카드 정보 수정
   ====================================================== */
router.put('/cards/:id', requireAdmin, async (req, res) => {
  const { id } = req.params
  const { name, annualFee, productFeature, colorFrom, colorTo, brand, trafficYn } = req.body

  if (!name) return res.status(400).json({ message: '카드명은 필수입니다.' })

  try {
    const [result] = await pool.query(
      `UPDATE cards SET
         prd_nm = ?, annual_fee = ?, product_feature = ?,
         color_from = ?, color_to = ?, brand = ?, traffic_yn = ?
       WHERE id = ?`,
      [name, annualFee || 0, productFeature || null,
       colorFrom || null, colorTo || null, brand || '국내전용', trafficYn || 'N', id]
    )
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: '카드를 찾을 수 없습니다.' })
    }
    await writeLog(req.admin, 'CARD_UPDATE', 'CARD', id, `카드정보 수정: ${name}`)
    await bustCardCache()
    res.json({ message: '카드 정보가 수정되었습니다.' })
  } catch (err) {
    console.error('[admin PUT /cards/:id]', err)
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

/* ======================================================
   PATCH /api/admin/cards/:id/status  -  판매 상태 변경
   ON_SALE(판매중) / OFF_SALE(판매중지) / MAINTENANCE(점검중)
   ====================================================== */
router.patch('/cards/:id/status', requireAdmin, async (req, res) => {
  const { id } = req.params
  const { status } = req.body
  const ALLOWED = ['ON_SALE', 'OFF_SALE', 'MAINTENANCE']
  const LABEL   = { ON_SALE: '판매중', OFF_SALE: '판매중지', MAINTENANCE: '점검중' }

  if (!ALLOWED.includes(status)) {
    return res.status(400).json({ message: '잘못된 상태값입니다.' })
  }
  try {
    const [result] = await pool.query(
      'UPDATE cards SET sale_status_cd = ? WHERE id = ?', [status, id]
    )
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: '카드를 찾을 수 없습니다.' })
    }
    await writeLog(req.admin, 'CARD_STATUS', 'CARD', id, `상태 변경 → ${LABEL[status]}`)
    await bustCardCache()
    res.json({ message: `상태가 '${LABEL[status]}'(으)로 변경되었습니다.` })
  } catch (err) {
    console.error('[admin PATCH /cards/:id/status]', err)
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

/* ======================================================
   DELETE /api/admin/cards/:id  -  카드 삭제
   ====================================================== */
router.delete('/cards/:id', requireAdmin, async (req, res) => {
  const { id } = req.params
  try {
    const [[card]] = await pool.query('SELECT prd_nm FROM cards WHERE id = ?', [id])
    if (!card) return res.status(404).json({ message: '카드를 찾을 수 없습니다.' })

    await pool.query('DELETE FROM cards WHERE id = ?', [id])
    await writeLog(req.admin, 'CARD_DELETE', 'CARD', id, `카드 삭제: ${card.prd_nm}`)
    await bustCardCache()
    res.json({ message: '카드가 삭제되었습니다.' })
  } catch (err) {
    console.error('[admin DELETE /cards/:id]', err)
    // FK 제약(신청 내역 등)으로 삭제 불가한 경우 안내
    if (err.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(409).json({ message: '신청 내역이 있는 카드는 삭제할 수 없습니다. 판매중지로 변경하세요.' })
    }
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

/* ======================================================
   GET /api/admin/applications  -  신청 목록 (회원·카드 조인)
   ?status=PENDING|APPROVED|REJECTED|CANCELLED (선택)
   ====================================================== */
router.get('/applications', requireAdmin, async (req, res) => {
  const { status } = req.query
  try {
    let sql = `
      SELECT
        a.id, a.status, a.applied_dt AS appliedDt, a.processed_dt AS processedDt,
        a.applicant_name AS applicantName, a.phone_no AS phoneNo, a.email,
        a.address, a.residence_type AS residenceType, a.income_type AS incomeType,
        a.job_yn AS jobYn, a.billing_day AS billingDay, a.credit_limit AS creditLimit,
        c.id AS cardId, c.prd_nm AS cardName, c.card_type_cd AS cardType,
        u.username AS userId
      FROM card_applications a
      JOIN cards c ON c.id = a.card_id
      JOIN users u ON u.id = a.user_id
    `
    const params = []
    if (status) { sql += ' WHERE a.status = ?'; params.push(status) }
    sql += ' ORDER BY a.applied_dt DESC'

    const [rows] = await pool.query(sql, params)
    res.json(rows)
  } catch (err) {
    console.error('[admin GET /applications]', err)
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

/* ======================================================
   PATCH /api/admin/applications/:id/status  -  승인/거절
   APPROVED(승인) / REJECTED(거절)
   ====================================================== */
router.patch('/applications/:id/status', requireAdmin, async (req, res) => {
  const { id } = req.params
  const { status } = req.body
  const ALLOWED = ['APPROVED', 'REJECTED']
  const LABEL   = { APPROVED: '승인', REJECTED: '거절' }

  if (!ALLOWED.includes(status)) {
    return res.status(400).json({ message: '승인 또는 거절만 가능합니다.' })
  }
  try {
    const [[app]] = await pool.query(
      `SELECT a.id, a.applicant_name, c.prd_nm AS cardName
       FROM card_applications a JOIN cards c ON c.id = a.card_id WHERE a.id = ?`, [id]
    )
    if (!app) return res.status(404).json({ message: '신청을 찾을 수 없습니다.' })

    await pool.query(
      'UPDATE card_applications SET status = ?, processed_dt = NOW() WHERE id = ?',
      [status, id]
    )
    await writeLog(req.admin, 'APP_PROCESS', 'APPLICATION', id,
      `${app.applicant_name}님의 '${app.cardName}' 신청 ${LABEL[status]}`)
    res.json({ message: `신청을 ${LABEL[status]} 처리했습니다.` })
  } catch (err) {
    console.error('[admin PATCH /applications/:id/status]', err)
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

/* ======================================================
   GET /api/admin/dashboard  -  운영 통계 (실제 DB 집계)
   ====================================================== */
router.get('/dashboard', requireAdmin, async (req, res) => {
  try {
    // 요약 카운트 (한 번에)
    const [[summary]] = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM users WHERE is_admin = 0)                      AS memberCount,
        (SELECT COUNT(*) FROM card_applications)                            AS applyTotal,
        (SELECT COUNT(*) FROM cards WHERE sale_status_cd = 'ON_SALE')       AS onSaleCards,
        (SELECT COUNT(*) FROM card_applications WHERE status = 'PENDING')   AS pendingCount
    `)

    // 상태별 분포
    const [statusRows] = await pool.query(
      `SELECT status, COUNT(*) AS cnt FROM card_applications GROUP BY status`
    )
    const byStatus = { PENDING: 0, APPROVED: 0, REJECTED: 0, CANCELLED: 0 }
    statusRows.forEach(r => { byStatus[r.status] = r.cnt })

    // 카드별 신청 수 (인기 순위) — 취소 제외
    const [popular] = await pool.query(`
      SELECT c.id, c.prd_nm AS name, c.card_type_cd AS type, c.view_count AS viewCount,
             COUNT(a.id) AS applyCount
      FROM cards c
      LEFT JOIN card_applications a ON a.card_id = c.id AND a.status != 'CANCELLED'
      GROUP BY c.id
      ORDER BY applyCount DESC, viewCount DESC
    `)

    res.json({ summary, byStatus, popular })
  } catch (err) {
    console.error('[admin GET /dashboard]', err)
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

/* ======================================================
   GET /api/admin/logs  -  관리자 활동 로그 (최근 50건)
   ====================================================== */
router.get('/logs', requireAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, admin_name AS adminName, action, target_type AS targetType,
              target_id AS targetId, detail, created_at AS createdAt
       FROM admin_logs ORDER BY created_at DESC LIMIT 50`
    )
    res.json(rows)
  } catch (err) {
    console.error('[admin GET /logs]', err)
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

module.exports = router
