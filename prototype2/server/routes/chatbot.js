const router    = require('express').Router()
const Anthropic = require('@anthropic-ai/sdk')
const jwt       = require('jsonwebtoken')
const pool      = require('../db')

let anthropic = null
try {
  if (process.env.ANTHROPIC_API_KEY) {
    anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }
} catch { /* no-op */ }

const LIFE_CARD_NAME = 'BNK 01카드'

async function getCardsContext() {
  try {
    const [rows] = await pool.query(`
      SELECT c.id, c.prd_nm AS name, c.card_type_cd AS type,
             c.annual_fee AS annualFee, c.network, c.brand,
             c.traffic_yn AS trafficYn, c.product_feature AS productFeature,
             c.color_from AS colorFrom, c.color_to AS colorTo,
             GROUP_CONCAT(b.bnft_desc SEPARATOR ' / ') AS benefitsSummary
      FROM cards c
      LEFT JOIN card_benefits b ON b.card_id = c.id
      WHERE c.sale_status_cd = 'ON_SALE'
      GROUP BY c.id
      ORDER BY (c.prd_nm = '${LIFE_CARD_NAME}') DESC, c.id
    `)
    return rows
  } catch {
    return []
  }
}

const SYSTEM_PROMPT = `당신은 BNK 부산은행 카드몰 "Pickard"의 AI 상담 챗봇 "피카"입니다. 친근하고 전문적인 톤으로 답하세요.

역할:
- 고객의 소비 패턴·고민(PainPoint)을 파악해 최적의 BNK 카드를 추천
- 카드 혜택·연회비·발급 절차 안내

★ 최우선 추천 상품: "BNK 01카드"
- 어릴 때부터 노년까지 한 장으로 평생 쓰는 카드
- AI가 나이·소비를 분석해 생애단계마다 혜택을 자동으로 바꿔줌 (카페·배달·마트 등)
- 오래 쓸수록 적립률이 오르는 성장형 (카페 20%→최대 28%)
- 고객이 "뭘 골라야 할지 모르겠다 / 카드가 처음이다 / 오래 쓸 카드 / 소비가 다양하다" 는 고민을 보이면 반드시 이 카드를 우선 추천

규칙:
- 항상 한국어, 3~4문장 이내로 간결하게
- 카드 추천 시 구체적 혜택과 함께, 반드시 JSON 블록 포함: <!--CARDS:{"ids":[9]}-->
- 모르면 솔직히 안내 + 고객센터(1588-6200)
`

/* JWT 있으면 회원, 없으면 비회원(NULL) 상담 */
function getUserId(req) {
  const auth = req.headers.authorization
  if (!auth) return null
  try { return jwt.verify(auth.replace('Bearer ', ''), process.env.JWT_SECRET || 'dev_secret').id } catch { return null }
}

/* 상담 세션·대화를 DB에 기록 (consultations / consultation_messages) */
async function logConsultation({ consultationId, userId, entryPoint, userMsg, aiMsg, recommendedCardId }) {
  try {
    let cid = consultationId
    if (!cid) {
      const [r] = await pool.query(
        `INSERT INTO consultations (user_id, channel, entry_point, recommended_card_id, summary)
         VALUES (?, 'POPUP', ?, ?, ?)`,
        [userId, entryPoint || 'POPUP', recommendedCardId || null, userMsg.slice(0, 280)]
      )
      cid = r.insertId
    } else if (recommendedCardId) {
      await pool.query('UPDATE consultations SET recommended_card_id = ? WHERE id = ?', [recommendedCardId, cid])
    }
    await pool.query(
      'INSERT INTO consultation_messages (consultation_id, sender, content) VALUES (?, ?, ?), (?, ?, ?)',
      [cid, 'USER', userMsg, cid, 'AI', aiMsg]
    )
    return cid
  } catch (e) {
    console.error('[consult log]', e.message)
    return consultationId || null
  }
}

router.post('/', async (req, res) => {
  const { message, history = [], consultationId, entryPoint } = req.body
  if (!message) return res.status(400).json({ message: '메시지가 필요합니다.' })
  const userId = getUserId(req)

  try {
    const cards = await getCardsContext()
    const lifeCard = cards.find(c => c.name === LIFE_CARD_NAME)

    const cardInfo = cards.map(c =>
      `[ID:${c.id}] ${c.name} (${c.type}, 연회비:${c.annualFee === 0 ? '무료' : c.annualFee.toLocaleString() + '원'}) - ${c.productFeature} | 혜택: ${c.benefitsSummary || '없음'}`
    ).join('\n')
    const systemWithCards = `${SYSTEM_PROMPT}\n\n현재 판매 중인 BNK 카드 목록:\n${cardInfo}`

    let cleanReply, recommendedCards

    if (!anthropic) {
      const fb = generateFallbackReply(message, cards, lifeCard)
      cleanReply = fb.text
      recommendedCards = fb.recommendedCards || []
    } else {
      try {
        const messages = [
          ...history.slice(-10).map(h => ({ role: h.role, content: h.content })),
          { role: 'user', content: message },
        ]
        const response = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001', max_tokens: 1024, system: systemWithCards, messages,
        })
        const reply = response.content[0].text
        let ids = []
        const m = reply.match(/<!--CARDS:\{.*?\}-->/)
        if (m) { try { ids = JSON.parse(m[0].replace('<!--CARDS:', '').replace('-->', '')).ids || [] } catch {} }
        cleanReply = reply.replace(/<!--CARDS:\{.*?\}-->/g, '').trim()
        recommendedCards = cards.filter(c => ids.includes(c.id))
      } catch (e) {
        const fb = generateFallbackReply(message, cards, lifeCard)
        cleanReply = fb.text
        recommendedCards = fb.recommendedCards || []
      }
    }

    // 상담 로그 기록 (대표 추천카드 = 첫 추천)
    const recId = recommendedCards[0]?.id || null
    const cid = await logConsultation({ consultationId, userId, entryPoint, userMsg: message, aiMsg: cleanReply, recommendedCardId: recId })

    res.json({ reply: cleanReply, cards: recommendedCards, consultationId: cid })
  } catch (err) {
    console.error('[chatbot POST /]', err)
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

/* ── 규칙 기반 폴백 (Anthropic 키 없거나 실패 시) — 평생카드 우선 ── */
function generateFallbackReply(message, cards, lifeCard) {
  const msg = message.toLowerCase()
  const life = lifeCard ? [lifeCard] : []

  // PainPoint / 평생 / 추천 / 처음 → 라이프 평생카드 우선
  if (/평생|오래|처음|막막|모르|추천|어떤 카드|뭐가 좋|골라|다양/.test(msg)) {
    return {
      text: `"BNK 01카드"를 추천드려요! 어릴 때부터 노년까지 한 장으로, AI가 나이·소비를 분석해 혜택을 자동으로 바꿔주고 오래 쓸수록 적립률이 올라가요 (카페 20%→최대 28%). 지금 바로 확인해보세요.`,
      recommendedCards: life,
    }
  }
  if (/카페|커피|배달|편의점|구독|월급|사회초년/.test(msg)) {
    return {
      text: `카페·배달·구독을 자주 쓰신다면 "BNK 01카드"가 딱이에요. 카페 20%·배달 10% 적립에, 오래 쓸수록 혜택이 자라요. 20대 사회초년생에게 가장 인기예요!`,
      recommendedCards: life,
    }
  }
  if (/마트|주유|가족|아이|육아/.test(msg)) {
    return {
      text: `가정 지출이 많으시군요! "BNK 01카드"는 생애단계가 바뀌면 마트·주유·교육 혜택으로 자동 전환돼요. 한 장으로 평생 쓰는 카드예요.`,
      recommendedCards: life,
    }
  }
  if (/체크/.test(msg)) {
    const checks = cards.filter(c => c.type === '체크카드')
    return { text: `연회비 없는 체크카드를 찾으시는군요! 그중에서도 평생 쓰는 "BNK 01카드"(체크·연회비 무료)를 가장 추천해요.`, recommendedCards: life.concat(checks.filter(c => c.name !== LIFE_CARD_NAME)).slice(0, 3) }
  }
  if (/신청|발급|만들/.test(msg)) {
    return { text: `"BNK 01카드" 상세 페이지에서 "이 카드 만들기"로 바로 신청하실 수 있어요. 신분증 인증 후 발급돼요!`, recommendedCards: life }
  }
  if (/안녕|하이|hello/.test(msg)) {
    return { text: `안녕하세요! BNK 카드 AI 상담사 피카예요 :) 어떤 소비를 자주 하시는지 알려주시면 딱 맞는 카드를 찾아드릴게요!`, recommendedCards: [] }
  }
  return {
    text: `어떤 곳에 소비를 많이 하시나요? 카페·배달이 많으면 "BNK 01카드"처럼 소비에 맞춰 자라는 카드를 추천해드릴 수 있어요.`,
    recommendedCards: life,
  }
}

module.exports = router
