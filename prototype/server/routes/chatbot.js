const router    = require('express').Router()
const Anthropic = require('@anthropic-ai/sdk')
const pool      = require('../db')

let anthropic = null
try {
  if (process.env.ANTHROPIC_API_KEY) {
    anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }
} catch { /* no-op */ }

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
      ORDER BY c.id
    `)
    return rows
  } catch {
    return []
  }
}

const SYSTEM_PROMPT = `당신은 BNK 부산은행 카드몰 "Pickard"의 AI 상담 챗봇입니다.
이름은 "피카"입니다. 친근하고 전문적인 톤으로 답변하세요.

역할:
- 고객의 소비 패턴과 니즈를 파악해 최적의 BNK 카드를 추천
- 카드 혜택, 연회비, 발급 조건 등 상세 정보 안내
- 카드 신청 절차 안내

규칙:
- 항상 한국어로 답변
- 답변은 간결하게 (3~4문장 이내)
- 카드 추천 시 구체적인 혜택과 함께 안내
- 카드 추천 시 JSON 블록을 포함: <!--CARDS:{"ids":[1,2,3]}-->
- 모르는 정보는 솔직하게 안내하고 고객센터(1588-6200) 안내
- 금융 상품 권유 시 "이 상품은 예금자보호 대상이 아닙니다" 등 필수 고지 포함하지 마세요 (프로토타입)
`

router.post('/', async (req, res) => {
  const { message, history = [] } = req.body
  if (!message) return res.status(400).json({ message: '메시지가 필요합니다.' })

  try {
    const cards = await getCardsContext()

    const cardInfo = cards.map(c =>
      `[ID:${c.id}] ${c.name} (${c.type}, 연회비:${c.annualFee === 0 ? '무료' : c.annualFee.toLocaleString() + '원'}, ${c.network}, ${c.brand}) - ${c.productFeature} | 혜택: ${c.benefitsSummary || '없음'}`
    ).join('\n')

    const systemWithCards = `${SYSTEM_PROMPT}\n\n현재 판매 중인 BNK 카드 목록:\n${cardInfo}`

    if (!anthropic) {
      const fallback = generateFallbackReply(message, cards)
      return res.json({ reply: fallback.text, cards: fallback.recommendedCards || [] })
    }

    const messages = [
      ...history.slice(-10).map(h => ({
        role: h.role,
        content: h.content
      })),
      { role: 'user', content: message }
    ]

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: systemWithCards,
      messages
    })

    const reply = response.content[0].text

    let recommendedCardIds = []
    const cardMatch = reply.match(/<!--CARDS:\{.*?\}-->/)
    if (cardMatch) {
      try {
        const parsed = JSON.parse(cardMatch[0].replace('<!--CARDS:', '').replace('-->', ''))
        recommendedCardIds = parsed.ids || []
      } catch { /* no-op */ }
    }

    const cleanReply = reply.replace(/<!--CARDS:\{.*?\}-->/g, '').trim()
    const recommendedCards = cards.filter(c => recommendedCardIds.includes(c.id))

    res.json({ reply: cleanReply, cards: recommendedCards })
  } catch (err) {
    console.error('[chatbot POST /]', err)
    if (err.status === 401 || err.message?.includes('API key')) {
      const cards = await getCardsContext()
      const reply = generateFallbackReply(message, cards)
      return res.json({ reply: reply.text, cards: reply.recommendedCards || [] })
    }
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

function generateFallbackReply(message, cards) {
  const msg = message.toLowerCase()

  if (msg.includes('추천') || msg.includes('어떤 카드') || msg.includes('뭐가 좋')) {
    const top3 = cards.slice(0, 3)
    return {
      text: `고객님께 인기 있는 카드 3종을 추천드릴게요! 소비 패턴에 맞는 카드를 골라보세요.`,
      recommendedCards: top3
    }
  }

  if (msg.includes('체크') || msg.includes('체크카드')) {
    const checkCards = cards.filter(c => c.type === '체크카드')
    return {
      text: `BNK 체크카드 ${checkCards.length}종을 안내해드릴게요. 연회비 없이 실속 있는 혜택을 누려보세요!`,
      recommendedCards: checkCards
    }
  }

  if (msg.includes('신용') || msg.includes('신용카드')) {
    const creditCards = cards.filter(c => c.type === '신용카드')
    return {
      text: `BNK 신용카드 ${creditCards.length}종을 안내해드릴게요. 다양한 할인과 적립 혜택이 준비되어 있습니다!`,
      recommendedCards: creditCards
    }
  }

  if (msg.includes('여행') || msg.includes('해외')) {
    const travelCards = cards.filter(c => c.brand === '해외겸용' || (c.name && c.name.includes('트래블')))
    return {
      text: `해외여행에 딱 맞는 카드를 찾아드렸어요! 해외 결제 수수료 면제와 공항 라운지 혜택을 확인해보세요.`,
      recommendedCards: travelCards.length > 0 ? travelCards : cards.slice(3, 5)
    }
  }

  if (msg.includes('카페') || msg.includes('커피') || msg.includes('편의점') || msg.includes('교통')) {
    const youngCards = cards.filter(c => c.name && (c.name.includes('Young') || c.name.includes('그린')))
    return {
      text: `일상 소비에 최적화된 카드를 추천드려요! 편의점, 카페, 대중교통에서 높은 적립률을 누려보세요.`,
      recommendedCards: youngCards.length > 0 ? youngCards : cards.slice(0, 2)
    }
  }

  if (msg.includes('쇼핑') || msg.includes('온라인') || msg.includes('쿠팡')) {
    const shopCards = cards.filter(c => c.name && c.name.includes('쇼핑'))
    return {
      text: `온라인 쇼핑을 자주 하시는군요! 쿠팡, 네이버페이 등에서 최대 5% 캐시백 혜택을 드리는 카드를 추천합니다.`,
      recommendedCards: shopCards.length > 0 ? shopCards : cards.slice(5, 7)
    }
  }

  if (msg.includes('연회비') || msg.includes('무료')) {
    const freeCards = cards.filter(c => c.annualFee === 0)
    return {
      text: `연회비 무료 카드를 찾으시는군요! 체크카드는 모두 연회비가 없어요.`,
      recommendedCards: freeCards
    }
  }

  if (msg.includes('부산') || msg.includes('지역')) {
    const busanCards = cards.filter(c => c.name && c.name.includes('부산'))
    return {
      text: `부산 지역 특화 카드를 안내드릴게요! 부산 가맹점 추가 할인과 대중교통 무료 혜택이 있습니다.`,
      recommendedCards: busanCards.length > 0 ? busanCards : cards.slice(2, 4)
    }
  }

  if (msg.includes('프리미엄') || msg.includes('vip') || msg.includes('라운지')) {
    const premiumCards = cards.filter(c => c.name && c.name.includes('하이라이프'))
    return {
      text: `프리미엄 서비스를 원하시는군요! 공항 라운지 무제한, 해외 수수료 면제 등 VIP 혜택을 확인해보세요.`,
      recommendedCards: premiumCards.length > 0 ? premiumCards : cards.slice(3, 5)
    }
  }

  if (msg.includes('신청') || msg.includes('발급') || msg.includes('만들')) {
    return {
      text: `카드 신청은 원하시는 카드 상세 페이지에서 "카드 신청하기" 버튼을 눌러 진행하실 수 있어요. 어떤 카드에 관심이 있으시나요?`,
      recommendedCards: []
    }
  }

  if (msg.includes('안녕') || msg.includes('하이') || msg.includes('hello')) {
    return {
      text: `안녕하세요! BNK 카드몰 AI 상담사 피카입니다 :) 카드 추천, 혜택 안내 등 무엇이든 물어봐주세요!`,
      recommendedCards: []
    }
  }

  return {
    text: `네, 말씀해주신 내용을 확인했어요. 원하시는 카드 유형이나 주로 사용하시는 곳을 알려주시면 딱 맞는 카드를 추천해드릴게요!`,
    recommendedCards: []
  }
}

module.exports = router
