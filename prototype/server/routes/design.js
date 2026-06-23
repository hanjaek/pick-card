const router    = require('express').Router()
const jwt       = require('jsonwebtoken')
const Anthropic = require('@anthropic-ai/sdk')
const pool      = require('../db')

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

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
   POST /api/design/generate  -  AI 카드 디자인 생성
   body: { cardId, prompt, preferences: { colorMood, style, keyword } }
   ====================================================== */
router.post('/generate', authMiddleware, async (req, res) => {
  const { cardId, prompt, preferences = {} } = req.body

  if (!cardId || !prompt) {
    return res.status(400).json({ message: 'cardId와 prompt가 필요합니다.' })
  }

  try {
    const [[card]] = await pool.query(
      'SELECT prd_nm AS name, card_type_cd AS type FROM cards WHERE id = ?',
      [cardId]
    )
    if (!card) return res.status(404).json({ message: '카드를 찾을 수 없습니다.' })

    const systemPrompt = `당신은 프리미엄 신용카드 디자인 전문가입니다.
사용자의 요청을 분석해 카드 디자인 파라미터를 JSON으로 반환해야 합니다.
반드시 아래 JSON 형식만 반환하세요. 설명 텍스트나 마크다운 없이 JSON만 출력하세요.

{
  "themeName": "테마 이름 (20자 이내, 한국어)",
  "colorFrom": "#RRGGBB (그라디언트 시작색)",
  "colorTo": "#RRGGBB (그라디언트 종료색)",
  "accentColor": "#RRGGBB (강조색, 텍스트/아이콘에 사용)",
  "patternType": "geometric | organic | minimal | abstract | luxury | nature",
  "textColor": "white | dark (카드 위 텍스트 색상)",
  "designDescription": "이 디자인에 대한 감성적 설명 (100자 이내, 한국어)",
  "keywords": ["키워드1", "키워드2", "키워드3"]
}`

    const userMessage = `카드명: ${card.name} (${card.type})
사용자 요청: ${prompt}
추가 선호: ${JSON.stringify(preferences)}

위 카드에 어울리는 커스텀 디자인을 만들어주세요.`

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }]
    })

    let designData
    try {
      designData = JSON.parse(message.content[0].text)
    } catch {
      return res.status(500).json({ message: 'AI 응답 파싱에 실패했습니다. 다시 시도해주세요.' })
    }

    const [dbResult] = await pool.query(
      `INSERT INTO custom_designs
        (user_id, card_id, user_prompt, theme_name, color_from, color_to, accent_color, pattern_type, ai_description, design_data)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id, cardId, prompt,
        designData.themeName, designData.colorFrom, designData.colorTo,
        designData.accentColor, designData.patternType,
        designData.designDescription, JSON.stringify(designData)
      ]
    )

    res.json({ id: dbResult.insertId, ...designData })
  } catch (err) {
    console.error('[design POST /generate]', err)
    if (err.status === 401 || err.message?.includes('API key')) {
      return res.status(503).json({ message: 'AI 서비스 연결에 실패했습니다. ANTHROPIC_API_KEY를 확인해주세요.' })
    }
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

/* ======================================================
   GET /api/design/mine  -  내 커스텀 디자인 목록
   ====================================================== */
router.get('/mine', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT cd.*, c.prd_nm AS cardName, c.card_type_cd AS cardType
       FROM custom_designs cd
       JOIN cards c ON c.id = cd.card_id
       WHERE cd.user_id = ?
       ORDER BY cd.created_dt DESC`,
      [req.user.id]
    )
    res.json(rows)
  } catch (err) {
    console.error('[design GET /mine]', err)
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

/* ======================================================
   GET /api/design/:id  -  특정 디자인 조회
   ====================================================== */
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const [[row]] = await pool.query(
      'SELECT * FROM custom_designs WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    )
    if (!row) return res.status(404).json({ message: '디자인을 찾을 수 없습니다.' })
    res.json(row)
  } catch (err) {
    console.error('[design GET /:id]', err)
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

module.exports = router
