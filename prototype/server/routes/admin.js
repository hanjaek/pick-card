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
