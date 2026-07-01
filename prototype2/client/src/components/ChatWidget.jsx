import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import './ChatWidget.css'

/* BNK 피카 — 하단 플로팅 AI 상담 팝업 (평생카드 중심, 상담 DB 기록) */

const GREETING = { role: 'assistant', content: '안녕하세요! BNK AI 상담사 피카예요 😊\n어떤 소비를 자주 하세요? 딱 맞는 카드를 찾아드릴게요.', cards: [] }
const QUICK = ['카드가 처음인데 뭐가 좋아요?', '카페·배달 자주 써요', '오래 쓸 카드 찾고 있어요']

export default function ChatWidget() {
  const [open, setOpen]       = useState(false)
  const [messages, setMsgs]   = useState([GREETING])
  const [input, setInput]     = useState('')
  const [loading, setLoading] = useState(false)
  const [consultationId, setCid] = useState(null)
  const navigate = useNavigate()
  const location = useLocation()
  const bodyRef  = useRef(null)

  useEffect(() => { if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight }, [messages, open, loading])

  const entryPoint =
    location.pathname.startsWith('/life-card') ? 'LIFE_CARD'
    : location.pathname.startsWith('/cards/')  ? 'CARD_DETAIL'
    : location.pathname === '/'                ? 'HOME' : 'OTHER'

  async function send(text) {
    const msg = (text ?? input).trim()
    if (!msg || loading) return
    setInput('')
    setMsgs(prev => [...prev, { role: 'user', content: msg }])
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/chatbot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          message: msg,
          history: messages.slice(-10).map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
          consultationId, entryPoint,
        }),
      })
      const data = await res.json()
      if (data.consultationId) setCid(data.consultationId)
      setMsgs(prev => [...prev, { role: 'assistant', content: data.reply || '잠시 후 다시 시도해주세요.', cards: data.cards || [] }])
    } catch {
      setMsgs(prev => [...prev, { role: 'assistant', content: '연결에 문제가 생겼어요. 잠시 후 다시 시도해주세요.', cards: [] }])
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
                <div className="cw-bubble">{m.content}</div>
                {m.cards?.length > 0 && (
                  <div className="cw-cards">
                    {m.cards.map(c => (
                      <button key={c.id} className="cw-card" onClick={() => { navigate(cardLink(c)); setOpen(false) }}>
                        <span className="cw-card-name">{c.name}</span>
                        <span className="cw-card-go">자세히 보기 →</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="cw-row assistant">
                <div className="cw-bubble cw-typing"><span /><span /><span /></div>
              </div>
            )}
          </div>

          {messages.length <= 1 && (
            <div className="cw-quick">
              {QUICK.map(q => <button key={q} onClick={() => send(q)}>{q}</button>)}
            </div>
          )}

          <div className="cw-input">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
              placeholder="메시지를 입력하세요…"
            />
            <button onClick={() => send()} disabled={loading} aria-label="전송">➤</button>
          </div>
        </div>
      )}
    </>
  )
}
