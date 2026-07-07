import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { renderChatText } from '../utils/renderChatText'
import './Chatbot.css'

const QUICK_ACTIONS = [
  { label: '카드추천',     value: '내게 맞는 카드 추천해줘' },
  { label: '체크카드',     value: '체크카드 종류 알려줘' },
  { label: '신용카드',     value: '신용카드 추천해줘' },
  { label: '연회비 무료',  value: '연회비 무료 카드 알려줘' },
  { label: '카드 신청',    value: '카드 신청은 어떻게 해?' },
]

const HASHTAGS = [
  { label: '# 인기카드 TOP 3',    value: '인기 카드 TOP 3 추천해줘' },
  { label: '# 부산 지역 혜택',    value: '부산 지역 특화 카드 알려줘' },
  { label: '# 해외여행 필수카드',  value: '해외여행 갈 때 좋은 카드 추천해줘' },
  { label: '# 온라인 쇼핑 할인',   value: '온라인 쇼핑 할인 많은 카드 추천해줘' },
]

function CardRecommendation({ card, onClick }) {
  return (
    <div className="cb-card-rec" onClick={onClick}>
      <div
        className="cb-card-visual"
        style={{ background: `linear-gradient(135deg, ${card.colorFrom || card.color_from || '#D71919'}, ${card.colorTo || card.color_to || '#8B0304'})` }}
      >
        <div className="cb-card-chip" />
        <span className="cb-card-net">{card.network || 'VISA'}</span>
        <span className="cb-card-label">{card.name || card.prd_nm}</span>
      </div>
      <div className="cb-card-info">
        <p className="cb-card-name">{card.name || card.prd_nm}</p>
        <p className="cb-card-type">
          {card.type || card.card_type_cd} · 연회비 {(card.annualFee ?? card.annual_fee) === 0 ? '무료' : `${(card.annualFee ?? card.annual_fee)?.toLocaleString()}원`}
        </p>
        <p className="cb-card-feature">{card.productFeature || card.product_feature || ''}</p>
      </div>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="cb-msg bot">
      <div className="cb-avatar"><div className="cb-avatar-inner">P</div></div>
      <div className="cb-bubble bot">
        <div className="cb-typing"><span /><span /><span /></div>
      </div>
    </div>
  )
}

export default function Chatbot() {
  const [messages, setMessages] = useState([
    {
      id: 0, role: 'assistant',
      content: '안녕하세요!\nBNK 카드몰 AI 상담사 피카입니다.\n궁금한 점이 있으시면 편하게 질문해주세요!',
      cards: [], isWelcome: true,
    },
  ])
  const [input, setInput]     = useState('')
  const [loading, setLoading] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const chatEndRef = useRef(null)
  const inputRef   = useRef(null)
  const navigate   = useNavigate()

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const sendMessage = async (text) => {
    const msg = text || input.trim()
    if (!msg || loading) return
    setInput('')
    setMenuOpen(false)

    const userMsg = { id: Date.now(), role: 'user', content: msg, cards: [] }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    try {
      const res = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: msg, model: 'groq', top_k: 5 }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, {
        id: Date.now() + 1, role: 'assistant',
        content: data.recommendation || data.reply || '죄송합니다. 잠시 후 다시 시도해주세요.',
        cards: data.retrieved_cards || data.cards || [],
      }])
    } catch {
      setMessages(prev => [...prev, {
        id: Date.now() + 1, role: 'assistant',
        content: 'RAG 서비스에 연결할 수 없어요. 서버가 실행 중인지 확인해주세요.', cards: [],
      }])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  return (
    <div className="cb-page">
      <div className="cb-container">

        {/* Messages */}
        <div className="cb-messages">
          {messages.map((msg) => (
            <div key={msg.id} className={`cb-msg ${msg.role === 'user' ? 'user' : 'bot'}`}>
              {msg.role === 'assistant' && (
                <div className="cb-avatar"><div className="cb-avatar-inner">P</div></div>
              )}
              <div className="cb-content-wrap">
                {msg.role === 'assistant' && <span className="cb-sender">피카</span>}
                <div className={`cb-bubble ${msg.role === 'user' ? 'user' : 'bot'}`}>
                  {renderChatText(msg.content)}
                </div>

                {msg.isWelcome && (
                  <div className="cb-welcome-banner">
                    <div className="cb-welcome-badge">Pickard AI</div>
                    <p className="cb-welcome-title">AI가 추천하는<br />나만의 BNK 카드</p>
                    <p className="cb-welcome-desc">소비 패턴을 분석해서<br />딱 맞는 카드를 찾아드려요!</p>
                    <button className="cb-welcome-btn" onClick={() => sendMessage('내게 맞는 카드 추천해줘')}>
                      카드 추천 받기
                    </button>
                  </div>
                )}

                {msg.cards && msg.cards.length > 0 && (
                  <div className="cb-cards-list">
                    {msg.cards.map((card) => (
                      <CardRecommendation
                        key={card.id}
                        card={card}
                        onClick={() => navigate(`/cards/${card.id}`)}
                      />
                    ))}
                  </div>
                )}

                {msg.isWelcome && (
                  <div className="cb-quick-actions">
                    {QUICK_ACTIONS.map((a) => (
                      <button key={a.label} className="cb-quick-btn" onClick={() => sendMessage(a.value)}>{a.label}</button>
                    ))}
                  </div>
                )}

                {msg.role === 'assistant' && (
                  <span className="cb-time">
                    {new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
            </div>
          ))}

          {loading && <TypingIndicator />}

          {messages.length <= 2 && !loading && (
            <div className="cb-hashtags">
              {HASHTAGS.map((tag) => (
                <button key={tag.label} className="cb-hashtag" onClick={() => sendMessage(tag.value)}>{tag.label}</button>
              ))}
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div className="cb-input-area">
          <div className="cb-input-wrap">
            <button className={`cb-menu-btn ${menuOpen ? 'open' : ''}`} onClick={() => setMenuOpen(!menuOpen)}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <rect x="3" y="5" width="14" height="1.5" rx="0.75" fill="currentColor" />
                <rect x="3" y="9.25" width="14" height="1.5" rx="0.75" fill="currentColor" />
                <rect x="3" y="13.5" width="14" height="1.5" rx="0.75" fill="currentColor" />
              </svg>
            </button>
            <input
              ref={inputRef}
              className="cb-input"
              type="text"
              placeholder="여기에 질문을 입력해 주세요."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
            />
            <button
              className={`cb-send-btn ${input.trim() ? 'active' : ''}`}
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M3 10L17 3L13 10L17 17L3 10Z" fill="currentColor" />
              </svg>
            </button>
          </div>

          {menuOpen && (
            <div className="cb-menu-panel">
              {QUICK_ACTIONS.map((a) => (
                <button key={a.label} className="cb-menu-item" onClick={() => sendMessage(a.value)}>{a.label}</button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
