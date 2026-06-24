const router = require('express').Router()
const pool   = require('../db')
const { cache } = require('../redis')

/* ======================================================
   GET /api/cards  -  카드 목록 (혜택 배열 포함)
   ?type=신용카드 | 체크카드

   [Redis 캐싱 흐름]
   1. 캐시 조회(replica에서 읽기) → 있으면 즉시 반환 (DB 안 감)
   2. 없으면 DB 조회 → 결과를 캐시(master에 쓰기, TTL 60초)
   카드 목록은 자주 바뀌지 않으므로 캐싱 효과가 큼.
   ====================================================== */
router.get('/', async (req, res) => {
  try {
    const { type } = req.query
    const cacheKey = `cards:list:${type || 'all'}`

    // 1) 캐시 먼저 확인 (Redis Replica에서 읽기)
    const cached = await cache.get(cacheKey)
    if (cached) {
      res.set('X-Cache', 'HIT')   // 응답 헤더로 캐시 적중 여부 확인 가능
      return res.json(cached)
    }

    let sql = `
      SELECT
        c.id, c.prd_nm AS name, c.card_type_cd AS type,
        c.annual_fee AS annualFee, c.network,
        c.color_from AS colorFrom, c.color_to AS colorTo,
        c.brand, c.traffic_yn AS trafficYn,
        c.product_feature AS productFeature, c.image_url AS imageUrl,
        c.sale_status_cd AS saleStatus, c.launch_dt AS launchDt,
        d.disclosure_no AS approvalCode,
        JSON_ARRAYAGG(
          JSON_OBJECT(
            'id',            b.id,
            'type',          b.bnft_type_cd,
            'desc',          b.bnft_desc,
            'discountRate',  b.discount_rate,
            'monthlyLimit',  b.monthly_limit_amt
          )
        ) AS benefits
      FROM cards c
      LEFT JOIN card_benefits b   ON b.card_id = c.id
      LEFT JOIN disclosures  d    ON d.card_id = c.id
      WHERE c.sale_status_cd = 'ON_SALE'
    `
    const params = []
    if (type) {
      sql += ' AND c.card_type_cd = ?'
      params.push(type)
    }
    sql += ' GROUP BY c.id, d.disclosure_no ORDER BY c.id'

    const [rows] = await pool.query(sql, params)

    const cards = rows.map(row => ({
      ...row,
      benefits: typeof row.benefits === 'string'
        ? JSON.parse(row.benefits)
        : (row.benefits || [])
    }))

    // 2) DB 결과를 캐시에 저장 (Redis Master에 쓰기, 60초 후 만료)
    await cache.set(cacheKey, cards, 60)

    res.set('X-Cache', 'MISS')
    res.json(cards)
  } catch (err) {
    console.error('[cards GET /]', err)
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

/* ======================================================
   GET /api/cards/:id  -  카드 상세 (혜택 + 약관 + 공시 포함)
   ====================================================== */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params

    const [[card]] = await pool.query(`
      SELECT
        c.id, c.prd_nm AS name, c.card_type_cd AS type,
        c.annual_fee AS annualFee, c.network,
        c.color_from AS colorFrom, c.color_to AS colorTo,
        c.brand, c.traffic_yn AS trafficYn,
        c.product_feature AS productFeature, c.image_url AS imageUrl,
        c.sale_status_cd AS saleStatus, c.launch_dt AS launchDt
      FROM cards c
      WHERE c.id = ?
    `, [id])

    if (!card) return res.status(404).json({ message: '카드를 찾을 수 없습니다.' })

    const [benefits] = await pool.query(
      'SELECT id, bnft_type_cd AS type, bnft_desc AS `desc`, discount_rate AS discountRate, monthly_limit_amt AS monthlyLimit FROM card_benefits WHERE card_id = ? ORDER BY id',
      [id]
    )

    const [[disclosure]] = await pool.query(
      'SELECT disclosure_no AS approvalCode, disclosure_dt AS disclosureDt, dept_nm AS deptNm FROM disclosures WHERE card_id = ?',
      [id]
    )

    const [termsList] = await pool.query(
      'SELECT id, version_no AS version, terms_title AS title, terms_content AS content, pdf_path AS pdfPath, effective_dt AS effectiveDt FROM terms WHERE card_id = ? AND is_active = 1 ORDER BY reg_dt DESC LIMIT 1',
      [id]
    )

    res.json({
      ...card,
      benefits,
      disclosure: disclosure || null,
      terms: termsList[0] || null
    })
  } catch (err) {
    console.error('[cards GET /:id]', err)
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

module.exports = router
