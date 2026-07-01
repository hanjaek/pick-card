import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import './ChatWidget.css'

const GREETING = {
  role: 'assistant',
  content: '안녕하세요!\nBNK 카드몰 AI 상담사 피카입니다.\n궁금한 점이 있으시면 편하게 질문해주세요!',
  cards: [], isWelcome: true,
}
const QUICK_ACTIONS = [
  { label: '카드추천',    value: '내게 맞는 카드 추천해줘' },
  { label: '체크카드',    value: '체크카드 종류 알려줘' },
  { label: '신용카드',    value: '신용카드 추천해줘' },
  { label: '연회비 무료', value: '연회비 무료 카드 알려줘' },
  { label: '카드 신청',   value: '카드 신청은 어떻게 해?' },
]
const HASHTAGS = [
  { label: '# 인기카드 TOP 3',   value: '인기 카드 TOP 3 추천해줘' },
  { label: '# 부산 지역 혜택',   value: '부산 지역 특화 카드 알려줘' },
  { label: '# 해외여행 필수카드', value: '해외여행 갈 때 좋은 카드 추천해줘' },
  { label: '# 온라인 쇼핑 할인',  value: '온라인 쇼핑 할인 많은 카드 추천해줘' },
]

export default function ChatWidget() {
  const [open, setOpen]       = useState(false)
  const [messages, setMsgs]   = useState([GREETING])
  const [input, setInput]     = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const bodyRef  = useRef(null)

  useEffect(() => { if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight }, [messages, open, loading])

  async function send(text) {
    const msg = (text ?? input).trim()
    if (!msg || loading) return
    setInput('')
    setMsgs(prev => [...prev, { role: 'user', content: msg, cards: [] }])
    setLoading(true)
    try {
      const res = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: msg, model: 'groq', top_k: 5 }),
      })
      const data = await res.json()
      setMsgs(prev => [...prev, {
        role: 'assistant',
        content: data.recommendation || data.reply || '죄송합니다. 잠시 후 다시 시도해주세요.',
        cards: data.retrieved_cards || data.cards || [],
      }])
    } catch {
      setMsgs(prev => [...prev, { role: 'assistant', content: 'RAG 서비스에 연결할 수 없어요. 서버가 실행 중인지 확인해주세요.', cards: [] }])
    } finally {
      setLoading(false)
    }
  }

  const cardLink = (c) => (c.name === 'BNK 라이프 평생 카드' ? '/life-card' : `/cards/${c.id}`)

  return (
    <>
      {!open && (
        <button className="cw-fab" onClick={() => setOpen(true)} aria-label="AI 상담 열기">
          <span className="cw-fab-emoji">💬</span>
          <span className="cw-fab-label">AI 상담</span>
        </button>
      )}

      {open && (
        <div className="cw-panel" role="dialog" aria-label="AI 카드 상담">
          <div className="cw-head">
            <div className="cw-head-title"><span className="cw-live" />피카 · AI 카드 상담</div>
            <button className="cw-close" onClick={() => setOpen(false)} aria-label="닫기">✕</button>
          </div>

          <div className="cw-body" ref={bodyRef}>
            {messages.map((m, i) => (
              <div key={i} className={`cw-row ${m.role}`}>
                {m.role === 'assistant' && (
                  <div className="cw-avatar"><div className="cw-avatar-inner">P</div></div>
                )}
                <div className="cw-content-wrap">
                  {m.role === 'assistant' && <span className="cw-sender">피카</span>}
                  <div className="cw-bubble">
                    {m.content.split('\n').map((line, j, arr) => (
                      <span key={j}>{line}{j < arr.length - 1 && <br />}</span>
                    ))}
                  </div>
                  {m.isWelcome && (
                    <div className="cw-quick-actions">
                      {QUICK_ACTIONS.map(a => (
                        <button key={a.label} className="cw-quick-btn" onClick={() => send(a.value)}>{a.label}</button>
                      ))}
                    </div>
                  )}
                  {m.cards?.length > 0 && (
                    <div className="cw-cards">
                      {m.cards.map(c => (
                        <button key={c.id} className="cw-card" onClick={() => { navigate(cardLink(c)); setOpen(false) }}>
                          <span className="cw-card-name">{c.name || c.prd_nm}</span>
                          <span className="cw-card-go">자세히 보기 →</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="cw-row assistant">
                <div className="cw-avatar"><div className="cw-avatar-inner">P</div></div>
                <div className="cw-bubble cw-typing"><span /><span /><span /></div>
              </div>
            )}
            {messages.length <= 2 && !loading && (
              <div className="cw-hashtags">
                {HASHTAGS.map(tag => (
                  <button key={tag.label} className="cw-hashtag" onClick={() => send(tag.value)}>{tag.label}</button>
                ))}
              </div>
            )}
          </div>

          <div className="cw-input">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
              placeholder="여기에 질문을 입력해 주세요."
            />
            <button onClick={() => send()} disabled={loading} aria-label="전송">➤</button>
          </div>
        </div>
      )}
    </>
  )
}
