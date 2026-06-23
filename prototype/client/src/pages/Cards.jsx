import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import CardItem from '../components/CardItem'
import './Cards.css'

const FILTERS = ['전체', '신용카드', '체크카드']

function Cards() {
  const [activeFilter, setActiveFilter] = useState('전체')
  const [cards, setCards]               = useState([])
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    const params = activeFilter !== '전체' ? `?type=${encodeURIComponent(activeFilter)}` : ''
    setLoading(true)
    fetch(`/api/cards${params}`)
      .then(r => r.json())
      .then(data => { setCards(data); setLoading(false) })
      .catch(() => { setError('카드 목록을 불러오지 못했습니다.'); setLoading(false) })
  }, [activeFilter])

  const countFor = (f) => {
    if (f === '전체') return cards.length
    return cards.filter(c => c.type === f).length
  }

  const handleCardClick = (cardId) => navigate(`/cards/${cardId}`)

  return (
    <div className="cards-page">
      <div className="cards-hero">
        <h1 className="cards-hero-title">카드 상품</h1>
        <p className="cards-hero-sub">BNK 부산은행의 다양한 카드 혜택을 비교해보세요</p>
      </div>

      <div className="cards-inner">
        <div className="filter-tabs">
          {FILTERS.map(f => (
            <button
              key={f}
              className={`filter-tab ${activeFilter === f ? 'active' : ''}`}
              onClick={() => setActiveFilter(f)}
            >
              {f}
              {!loading && <span className="filter-count">{countFor(f)}</span>}
            </button>
          ))}
        </div>

        <p className="hover-hint">카드를 클릭하면 상세 정보를 확인할 수 있습니다</p>

        {loading && <div className="cards-loading"><div className="spinner" /></div>}
        {error   && <p className="cards-error">{error}</p>}

        {!loading && !error && (
          <div className="cards-grid">
            {cards.map(card => (
              <CardItem key={card.id} card={card} onClick={() => handleCardClick(card.id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default Cards
