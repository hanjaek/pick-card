const router = require('express').Router()
const jwt    = require('jsonwebtoken')
const pool   = require('../db')

/* ======================================================
   BNK 라이프 평생 카드 — 생애단계·소비 기반 자동 혜택
   ====================================================== */

const LIFE_CARD_NAME = 'BNK 라이프 평생 카드'

const STAGE_ORDER = ['TEEN', 'YOUNG', 'FAMILY', 'SENIOR']
const STAGE_META  = {
  TEEN:   { age: '10대',    label: '청소년',     desc: '용돈과 작은 소비로 금융을 배우는 시기' },
  YOUNG:  { age: '20대',    label: '사회초년생', desc: '첫 월급, 배달·카페·구독이 소비의 중심' },
  FAMILY: { age: '30~40대', label: '가정 형성',  desc: '마트·주유·교육 등 생활비 지출이 커지는 시기' },
  SENIOR: { age: '60대+',   label: '시니어',     desc: '의료·여행 중심, 안정적인 소비' },
}

// 거래 카테고리 한글 라벨 (소비 분석 표시용)
const CAT_LABEL = {
  CAFE: '카페·디저트', TRANSPORT: '대중교통', SHOPPING: '쇼핑·마트',
  TELECOM: '통신요금', CULTURE: '문화·여가', PAY: '간편결제',
  DELIVERY: '배달', SUBSCRIPTION: '구독', MEDICAL: '의료·약국',
  FUEL: '주유', EDUCATION: '교육', TRAVEL: '여행', CONVENIENCE: '편의점',
}

// 라이프 카드 + 혜택 전체 로드
async function loadLifeCard() {
  const [cards] = await pool.query('SELECT * FROM cards WHERE prd_nm = ? LIMIT 1', [LIFE_CARD_NAME])
  if (cards.length === 0) return null
  const card = cards[0]
  const [benefits] = await pool.query(
    `SELECT bnft_type_cd AS type, bnft_desc AS \`desc\`, discount_rate AS rate,
            monthly_limit_amt AS monthlyLimit, life_stage_cd AS stage, category_cd AS category
     FROM card_benefits WHERE card_id = ? ORDER BY id`,
    [card.id]
  )
  return { card, benefits }
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
      benefits: data.benefits.filter(b => b.stage === cd),
    }))
    const common = data.benefits.filter(b => b.stage === 'ALL')

    res.json({
      card: {
        id:        data.card.id,
        name:      data.card.prd_nm,
        network:   data.card.network,
        colorFrom: data.card.color_from,
        colorTo:   data.card.color_to,
        feature:   data.card.product_feature,
      },
      stages,
      common,
    })
  } catch (err) {
    console.error('[life-card GET /]', err)
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

/* ------------------------------------------------------
   GET /api/life-card/my  —  나이 + 소비 기반 개인화 (See Why)
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
      category: s.category_cd,
      label:    CAT_LABEL[s.category_cd] || s.category_cd,
      amount:   Number(s.amt),
      pct:      totalSpend ? Math.round(Number(s.amt) / totalSpend * 100) : 0,
    }))

    // 3) 내 단계 + 공통 혜택 → 소비 매칭 혜택을 "활성"으로 (See Why)
    const eligible = data.benefits.filter(b => b.stage === stage || b.stage === 'ALL')
    const active = eligible.map(b => {
      const matched = !!(b.category && topCats.includes(b.category))
      const spent   = b.category ? (spendByCat[b.category] || 0) : 0
      const saved   = (matched && b.rate)
        ? Math.min(Math.round(spent * Number(b.rate) / 100), b.monthlyLimit || Infinity)
        : 0
      return {
        ...b, matched, spent, saved,
        reason: matched && b.rate
          ? `이번 달 ${CAT_LABEL[b.category] || b.category} ${spent.toLocaleString()}원 사용 → ${Number(b.rate)}% 적용`
          : null,
      }
    }).sort((a, b) => b.saved - a.saved)

    res.json({
      stage,
      stageLabel: STAGE_META[stage],
      age,
      spending,            // 카테고리별 소비 분석
      totalSpend,          // 이번 달 총 소비
      topCats,
      active,              // 켜진 혜택 (See Why 포함)
      totalSaved: active.reduce((s, b) => s + b.saved, 0),
    })
  } catch (err) {
    console.error('[life-card GET /my]', err)
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

module.exports = router
