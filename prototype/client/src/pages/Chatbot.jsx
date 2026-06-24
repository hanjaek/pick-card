import { useState, useRef, useEffect } from 'react'
import axios from 'axios'
import { Link } from 'react-router-dom'
import './Chatbot.css'

export default function Chatbot() {
  const [messages, setMessages] = useState([
    {
      role: 'ai',
      content: '안녕하세요! BNK 카드몰 AI 챗봇입니다. 원하시는 혜택이나 라이프스타일(예: 주유 할인, 대중교통, 쇼핑 등)을 말씀해주시면 딱 맞는 카드를 추천해 드릴게요!'
    }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isLoading])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!input.trim()) return

    const userQuery = input.trim()
    setMessages(prev => [...prev, { role: 'user', content: userQuery }])
    setInput('')
    setIsLoading(true)

    try {
      const response = await axios.post('/api/recommend', {
        query: userQuery,
        model: 'groq'
      })

      const aiResponse = response.data
      setMessages(prev => [
        ...prev,
        {
          role: 'ai',
          content: aiResponse.recommendation,
          cards: aiResponse.retrieved_cards
        }
      ])
    } catch (error) {
      console.error(error)
      setMessages(prev => [
        ...prev,
        {
          role: 'ai',
          content: error.response?.data?.message || '추천 서버와 통신하는 중 문제가 발생했습니다. 백엔드와 파이썬 서버가 모두 켜져 있는지 확인해 주세요.'
        }
      ])
    } finally {
      setIsLoading(false)
    }
  }

  // 간단한 마크다운 파서 (줄바꿈과 굵은 글씨 정도만 처리)
  const formatText = (text) => {
    return text.split('\n').map((line, i) => {
      // 굵은 글씨 처리 (**텍스트**)
      const formattedLine = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      return (
        <span key={i}>
          <span dangerouslySetInnerHTML={{ __html: formattedLine }} />
          <br />
        </span>
      )
    })
  }

  return (
    <div className="chatbot-container">
      <div className="chatbot-header">
        <h2>✨ AI 챗봇 상담</h2>
        <p>어떤 카드를 원하시는지 자유롭게 말씀해 주세요!</p>
      </div>

      <div className="chatbot-messages">
        {messages.map((msg, index) => (
          <div key={index} className={`chat-bubble-wrapper ${msg.role}`}>
            <div className={`chat-bubble ${msg.role}`}>
              <div className="chat-text">{formatText(msg.content)}</div>
              
              {/* 추천된 카드가 있으면 표시 */}
              {msg.cards && msg.cards.length > 0 && (
                <div className="recommended-cards-wrapper">
                  <h4>💡 이 카드들을 추천드려요:</h4>
                  <div className="recommended-cards-list">
                    {msg.cards.map(card => (
                      <Link to={`/cards/${card.id}`} key={card.id} className="recommended-card-item">
                        <div className="rc-info">
                          <h5>{card.prd_nm}</h5>
                          <p>{card.brand} | {card.card_type_cd}</p>
                          <span className="rc-fee">연회비: {card.annual_fee?.toLocaleString()}원</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="chat-bubble-wrapper ai">
            <div className="chat-bubble ai loading-bubble">
              <span className="dot"></span>
              <span className="dot"></span>
              <span className="dot"></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className="chatbot-input-area" onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="예: 편의점이랑 교통 할인되는 체크카드 알려줘"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isLoading}
        />
        <button type="submit" disabled={isLoading || !input.trim()}>전송</button>
      </form>
    </div>
  )
}
