import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import CardSearchItem from '../components/CardSearchItem'
import './Cards.css'

const FILTERS = ['전체', '신용카드', '체크카드']

export default function Cards() {
  const [allCards, setAllCards]       = useState([])
  const [loading, setLoading]         = useState(true)
  const [activeFilter, setActiveFilter] = useState('전체')

  useEffect(() => {
    fetch('/api/cards')
      .then(r => r.json())
      .then(d => { setAllCards(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const displayed = activeFilter === '전체'
    ? allCards
    : allCards.filter(c => c.type === activeFilter)

  const countFor = f =>
    f === '전체' ? allCards.length : allCards.filter(c => c.type === f).length

  return (
    <div className="cards-page">

      {/* Hero */}
      <div className="cards-hero">
        <p className="cards-eyebrow">카드 상품</p>
        <h1 className="cards-title">BNK 카드 전체 보기</h1>
        <p className="cards-sub">BNK 부산은행의 다양한 카드 혜택을 비교해보세요</p>
      </div>

      <div className="cards-body">

        {/* 탭 필터 */}
        <div className="cards-tabs">
          {FILTERS.map(f => (
            <button
              key={f}
              className={`cards-tab${activeFilter === f ? ' on' : ''}`}
              onClick={() => setActiveFilter(f)}
            >
              {f}
              {!loading && (
                <span className="cards-tab-cnt">{countFor(f)}</span>
              )}
            </button>
          ))}
        </div>

        {/* 로딩 */}
        {loading && (
          <div className="cards-loading">
            <div className="cards-spinner" />
          </div>
        )}

        {/* 카드 그리드 */}
        {!loading && (
          <div className="cards-grid">
            {displayed.map(card => (
              <CardSearchItem key={card.id} card={card} />
            ))}
          </div>
        )}

        {/* 하단 CTA */}
        {!loading && (
          <div className="cards-bottom-cta">
            <p className="cards-cta-label">내 소비에 맞는 카드를 찾고 계신가요?</p>
            <Link to="/search" className="cards-find-link">✦ 내게 맞는 카드 찾기</Link>
          </div>
        )}

      </div>
    </div>
  )
}
