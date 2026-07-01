const router = require('express').Router()
const jwt    = require('jsonwebtoken')
const pool   = require('../db')

// ※ user_benefit_configs 테이블은 schema.sql 에서 정식 생성(FK·UNIQUE 포함).
//   과거 여기서 런타임 CREATE 하던 것을 스키마 단일 출처로 이관함.

/* ======================================================
   BNK 라이프 평생 카드 — 생애단계·소비 기반 자동 혜택 + 성장형
   ====================================================== */

const LIFE_CARD_NAME = 'BNK 라이프 평생 카드'

const STAGE_ORDER = ['TEEN', 'YOUNG', 'FAMILY', 'SENIOR']
const STAGE_META  = {
  TEEN:   { age: '10대',    label: '청소년',     desc: '용돈과 작은 소비로 금융을 배우는 시기' },
  YOUNG:  { age: '20대',    label: '사회초년생', desc: '첫 월급, 배달·카페·구독이 소비의 중심' },
  FAMILY: { age: '30~40대', label: '가정 형성',  desc: '마트·주유·교육 등 생활비 지출이 커지는 시기' },
  SENIOR: { age: '60대+',   label: '시니어',     desc: '의료·여행 중심, 안정적인 소비' },
}

const CAT_LABEL = {
  CAFE: '카페·디저트', TRANSPORT: '대중교통', SHOPPING: '쇼핑·마트',
  TELECOM: '통신요금', CULTURE: '문화·여가', PAY: '간편결제',
  DELIVERY: '배달', SUBSCRIPTION: '구독', MEDICAL: '의료·약국',
  FUEL: '주유', EDUCATION: '교육', TRAVEL: '여행', CONVENIENCE: '편의점',
}

// 라이프 카드 + 혜택(+성장형 단계 benefit_tiers) 로드
async function loadLifeCard() {
  const [cards] = await pool.query('SELECT * FROM cards WHERE prd_nm = ? LIMIT 1', [LIFE_CARD_NAME])
  if (cards.length === 0) return null
  const card = cards[0]
  const [benefits] = await pool.query(
    `SELECT id, bnft_type_cd AS type, bnft_desc AS \`desc\`, discount_rate AS rate,
            monthly_limit_amt AS monthlyLimit, life_stage_cd AS stage, category_cd AS category
     FROM card_benefits WHERE card_id = ? ORDER BY id`,
    [card.id]
  )
  const ids = benefits.map(b => b.id)
  let tiers = []
  if (ids.length) {
    const [tr] = await pool.query(
      `SELECT benefit_id, tenure_year, discount_rate AS rate, monthly_limit_amt AS monthlyLimit, tier_label
       FROM benefit_tiers WHERE benefit_id IN (?) ORDER BY tenure_year`,
      [ids]
    )
    tiers = tr
  }
  const tierMap = {}
  tiers.forEach(t => { (tierMap[t.benefit_id] = tierMap[t.benefit_id] || []).push(t) })
  benefits.forEach(b => { b.tiers = tierMap[b.id] || [] })
  return { card, benefits }
}

// 성장형: 가입연차(tenureYear) 기준 유효 율/한도 계산
//  - benefit_tiers 중 tenure_year <= 내연차 인 것 중 가장 큰 단계를 적용
//  - 없으면 기본(card_benefits.rate)
function applyTenure(benefit, tenureYear) {
  const base = benefit.rate == null ? null : Number(benefit.rate)
  let rate = base, limit = benefit.monthlyLimit, appliedTier = null, nextTier = null
  for (const t of benefit.tiers) {          // tenure_year 오름차순
    if (t.tenure_year <= tenureYear) { rate = Number(t.rate); limit = t.monthlyLimit; appliedTier = t }
    else if (!nextTier) { nextTier = t }
  }
  return { base, rate, limit, appliedTier, nextTier }
}

// 유저의 라이프카드 발급(보유) 조회 — 가입연차는 달력기준(TIMESTAMPDIFF)으로 계산
async function getMembership(userId, cardId) {
  const [rows] = await pool.query(
    `SELECT id, card_no_masked, issued_dt, valid_thru, membership_status, card_onoff,
            TIMESTAMPDIFF(YEAR, issued_dt, CURDATE()) AS tenure_year
     FROM card_memberships
     WHERE user_id = ? AND card_id = ? AND membership_status = 'ACTIVE'
     ORDER BY issued_dt LIMIT 1`,
    [userId, cardId]
  )
  return rows[0] || null
}

// 발급일 → 올해(현재 가입연차 구간) 진행률 0~100 (마지막 기념일 기준)
function progressFrom(issuedDt) {
  const issued = new Date(issuedDt)
  const now = new Date()
  const anniv = new Date(now.getFullYear(), issued.getMonth(), issued.getDate())
  if (anniv > now) anniv.setFullYear(anniv.getFullYear() - 1)
  const nextAnniv = new Date(anniv.getFullYear() + 1, issued.getMonth(), issued.getDate())
  return Math.min(100, Math.max(0, Math.round((now - anniv) / (nextAnniv - anniv) * 100)))
}

/* ------------------------------------------------------
   GET /api/life-card  —  카드 + 생애단계별 혜택 (랜딩용)
   ------------------------------------------------------ */
router.get('/', async (req, res) => {
  try {
    const data = await loadLifeCard()
    if (!data) return res.status(404).json({ message: '라이프 카드를 찾을 수 없습니다.' })

    const stages = STAGE_ORDER.map(cd => ({
      stage:    cd,
      ...STAGE_META[cd],
      benefits: data.benefits.filter(b => b.stage === cd).map(b => ({ ...b, tiers: undefined })),
    }))
    const common = data.benefits.filter(b => b.stage === 'ALL').map(b => ({ ...b, tiers: undefined }))

    res.json({
      card: {
        id: data.card.id, name: data.card.prd_nm, network: data.card.network,
        colorFrom: data.card.color_from, colorTo: data.card.color_to, feature: data.card.product_feature,
      },
      stages, common,
    })
  } catch (err) {
    console.error('[life-card GET /]', err)
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

/* ------------------------------------------------------
   GET /api/life-card/my  —  나이+소비+성장형 개인화 (See Why)
   ------------------------------------------------------ */
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

function stageFromAge(age) {
  if (age == null) return 'YOUNG'
  if (age < 20) return 'TEEN'
  if (age < 35) return 'YOUNG'
  if (age < 60) return 'FAMILY'
  return 'SENIOR'
}

router.get('/my', authMiddleware, async (req, res) => {
  try {
    const data = await loadLifeCard()
    if (!data) return res.status(404).json({ message: '라이프 카드를 찾을 수 없습니다.' })

    // 1) 나이 → 생애단계
    const [details] = await pool.query('SELECT birth_dt FROM user_details WHERE user_id = ?', [req.user.id])
    let age = null
    if (details.length && details[0].birth_dt) {
      age = new Date().getFullYear() - new Date(details[0].birth_dt).getFullYear()
    }
    const stage = stageFromAge(age)

    // 2) 이번 달 소비 상위 카테고리
    const [spend] = await pool.query(
      `SELECT category_cd, SUM(amount) AS amt
       FROM transactions
       WHERE user_id = ? AND paid_dt >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
       GROUP BY category_cd ORDER BY amt DESC`,
      [req.user.id]
    )
    const spendByCat = {}
    spend.forEach(s => { spendByCat[s.category_cd] = Number(s.amt) })
    const topCats = spend.map(s => s.category_cd)
    const totalSpend = spend.reduce((sum, s) => sum + Number(s.amt), 0)
    const spending = spend.map(s => ({
      category: s.category_cd, label: CAT_LABEL[s.category_cd] || s.category_cd,
      amount: Number(s.amt), pct: totalSpend ? Math.round(Number(s.amt) / totalSpend * 100) : 0,
    }))

    // 3) 보유(발급) 카드 → 가입연차 (성장형 기준)
    const membership = await getMembership(req.user.id, data.card.id)
    const tenureYear   = membership ? Number(membership.tenure_year) : 0
    const yearProgress = membership ? progressFrom(membership.issued_dt) : 0
    const isHolder = !!membership

    // 4) 내 단계+공통 혜택 → 성장형 율 적용 + 소비 매칭(See Why)
    const eligible = data.benefits.filter(b => b.stage === stage || b.stage === 'ALL')
    let nextUpgrade = null
    const active = eligible.map(b => {
      const { base, rate, limit, appliedTier, nextTier } = applyTenure(b, tenureYear)
      const matched = !!(b.category && topCats.includes(b.category))
      const spent   = b.category ? (spendByCat[b.category] || 0) : 0
      const saved   = (matched && rate) ? Math.min(Math.round(spent * rate / 100), limit || Infinity) : 0
      const grown   = base != null && rate != null && rate > base
      // 매칭된 혜택 중 다음 단계가 있으면 대표 업그레이드로 노출
      if (matched && nextTier && !nextUpgrade) {
        nextUpgrade = {
          benefit: b.desc, fromRate: rate, toRate: Number(nextTier.rate),
          atYear: nextTier.tenure_year, label: nextTier.tier_label, yearProgress,
        }
      }
      return {
        type: b.type, desc: b.desc, category: b.category, stage: b.stage,
        baseRate: base, effRate: rate, monthlyLimit: limit, grown,
        matched, spent, saved,
        reason: matched && rate
          ? `이번 달 ${CAT_LABEL[b.category] || b.category} ${spent.toLocaleString()}원 사용 → ${rate}% 적용${grown ? ` (${tenureYear}년차 우대)` : ''}`
          : null,
      }
    }).sort((a, b) => b.saved - a.saved)

    // 5) 사후관리 알림
    const [notifications] = await pool.query(
      `SELECT id, noti_type AS type, title, body, is_read AS isRead, created_at AS createdAt
       FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 10`,
      [req.user.id]
    )

    // 6) 커스텀 혜택 구성 로드
    const [configs] = await pool.query(
      'SELECT selected_fee, selected_benefits FROM user_benefit_configs WHERE user_id = ?',
      [req.user.id]
    )
    const savedConfig = configs.length ? {
      selectedFee:      configs[0].selected_fee,
      selectedBenefits: Array.isArray(configs[0].selected_benefits)
        ? configs[0].selected_benefits
        : JSON.parse(configs[0].selected_benefits),
    } : null

    res.json({
      stage, stageLabel: STAGE_META[stage], age,
      spending, totalSpend, topCats,
      active, totalSaved: active.reduce((s, b) => s + b.saved, 0),
      isHolder,
      membership: membership ? {
        cardNo: membership.card_no_masked, issuedDt: membership.issued_dt,
        validThru: membership.valid_thru, onoff: membership.card_onoff,
        tenureYear, yearProgress,
      } : null,
      nextUpgrade,          // 다음 혜택 업그레이드 (연차·율·진행률)
      notifications,        // 사후관리 알림
      savedConfig,          // 커스텀 혜택 구성 (혜택 구성 빌더에서 저장한 값)
    })
  } catch (err) {
    console.error('[life-card GET /my]', err)
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

/* ------------------------------------------------------
   POST /api/life-card/my/config  —  커스텀 혜택 구성 저장
   ------------------------------------------------------ */
router.post('/my/config', authMiddleware, async (req, res) => {
  try {
    const { selectedFee, selectedBenefits } = req.body
    if (!selectedFee || !Array.isArray(selectedBenefits)) {
      return res.status(400).json({ message: '잘못된 요청입니다.' })
    }
    await pool.query(
      `INSERT INTO user_benefit_configs (user_id, selected_fee, selected_benefits)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE
         selected_fee      = VALUES(selected_fee),
         selected_benefits = VALUES(selected_benefits),
         updated_at        = CURRENT_TIMESTAMP`,
      [req.user.id, selectedFee, JSON.stringify(selectedBenefits)]
    )
    res.json({ ok: true })
  } catch (err) {
    console.error('[life-card POST /my/config]', err)
    res.status(500).json({ message: '저장에 실패했습니다.' })
  }
})

module.exports = router
