const router = require('express').Router()

const RAG_URL = process.env.RAG_URL || 'http://localhost:8000'

/* POST /api/recommend
   body: { query: string, model?: "claude"|"gemini"|"groq", top_k?: number } */
router.post('/', async (req, res) => {
  try {
    const { query, model = 'groq', top_k = 5 } = req.body
    if (!query) return res.status(400).json({ message: 'query가 필요합니다.' })

    const response = await fetch(`${RAG_URL}/recommend`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ query, model, top_k }),
    })

    if (!response.ok) {
      const detail = await response.text()
      return res.status(502).json({ message: 'RAG 서비스 오류', detail })
    }

    res.json(await response.json())
  } catch (err) {
    if (err.cause?.code === 'ECONNREFUSED') {
      return res.status(503).json({ message: 'RAG 서비스가 실행 중이지 않습니다. (http://localhost:8000)' })
    }
    console.error('[recommend POST /]', err)
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

/* POST /api/recommend/index  - 카드 인덱싱 트리거 */
router.post('/index', async (req, res) => {
  try {
    const response = await fetch(`${RAG_URL}/index`, { method: 'POST' })
    if (!response.ok) {
      const detail = await response.text()
      return res.status(502).json({ message: 'RAG 인덱싱 오류', detail })
    }
    res.json(await response.json())
  } catch (err) {
    if (err.cause?.code === 'ECONNREFUSED') {
      return res.status(503).json({ message: 'RAG 서비스가 실행 중이지 않습니다.' })
    }
    console.error('[recommend POST /index]', err)
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

module.exports = router
