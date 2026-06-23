const router = require('express').Router()
const pool   = require('../db')

/* ======================================================
   GET /api/cards  -  카드 목록 (혜택 배열 포함)
   ?type=신용카드 | 체크카드
   ====================================================== */
router.get('/', async (req, res) => {
  try {
    const { type } = req.query

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
