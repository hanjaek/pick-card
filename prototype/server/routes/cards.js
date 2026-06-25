const router = require('express').Router()
const pool   = require('../db')
const { cache } = require('../redis')

const fallbackCards = [
  {
    id: 1,
    name: 'BNK 모두의 카드',
    type: '신용카드',
    annualFee: 0,
    network: 'VISA',
    colorFrom: '#D71919',
    colorTo: '#8B0304',
    brand: 'BNK',
    trafficYn: 'Y',
    productFeature: '생활·쇼핑·교통 혜택을 한 장에 담은 대표 카드',
    imageUrl: '',
    saleStatus: 'ON_SALE',
    launchDt: '2026-01-01',
    approvalCode: '2026-BNK-001',
    benefits: [
      { id: 1, type: '생활', desc: '마트, 편의점 5% 할인', discountRate: 5, monthlyLimit: 10000 },
      { id: 2, type: '교통', desc: '대중교통 10% 할인', discountRate: 10, monthlyLimit: 5000 },
      { id: 3, type: '온라인', desc: '온라인 쇼핑 7% 할인', discountRate: 7, monthlyLimit: 15000 }
    ]
  },
  {
    id: 2,
    name: 'BNK 체크 플러스',
    type: '체크카드',
    annualFee: 0,
    network: 'LOCAL',
    colorFrom: '#175CFF',
    colorTo: '#0B2F8A',
    brand: 'BNK',
    trafficYn: 'N',
    productFeature: '실속형 생활 할인에 집중한 체크카드',
    imageUrl: '',
    saleStatus: 'ON_SALE',
    launchDt: '2026-01-01',
    approvalCode: '2026-BNK-002',
    benefits: [
      { id: 4, type: '커피', desc: '커피전문점 10% 할인', discountRate: 10, monthlyLimit: 5000 },
      { id: 5, type: '배달', desc: '배달앱 5% 할인', discountRate: 5, monthlyLimit: 8000 }
    ]
  }
]

const fallbackCardById = id => {
  const card = fallbackCards.find(item => String(item.id) === String(id))
  if (!card) return null
  return {
    ...card,
    disclosure: {
      approvalCode: card.approvalCode,
      disclosureDt: '2026-01-01',
      deptNm: '카드사업팀'
    },
    terms: {
      id: card.id * 10,
      version: '1.0',
      title: '기본 이용약관',
      content: '샘플 약관 데이터입니다.',
      pdfPath: '',
      effectiveDt: '2026-01-01'
    }
  }
}

const normalizeBenefits = benefits => (typeof benefits === 'string' ? JSON.parse(benefits) : (benefits || []))

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
      benefits: normalizeBenefits(row.benefits)
    }))

    // 2) DB 결과를 캐시에 저장 (fire-and-forget: 캐시 쓰기가 응답을 지연시키지 않음)
    cache.set(cacheKey, cards, 60)

    res.set('X-Cache', 'MISS')
    res.json(cards)
  } catch (err) {
    console.error('[cards GET /]', err)
    res.json(fallbackCards)
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

    // 조회수 +1 (모니터링용, fire-and-forget — 응답 지연 없음)
    pool.query('UPDATE cards SET view_count = view_count + 1 WHERE id = ?', [id]).catch(() => {})

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
    const fallbackCard = fallbackCardById(req.params.id)
    if (!fallbackCard) {
      return res.status(404).json({ message: '카드를 찾을 수 없습니다.' })
    }
    res.json(fallbackCard)
  }
})

module.exports = router
