import { useState, useEffect } from 'react'
import CardSearchItem from '../components/CardSearchItem'
import './CardSearch.css'

const CARD_TYPES = ['신용카드', '체크카드']

const BENEFIT_TYPE_OPTIONS = [
  { label: '할인',     match: ['할인'] },
  { label: '적립',     match: ['적립'] },
  { label: '캐시백',   match: ['캐시백'] },
  { label: '무료/면제', match: ['무료', '면제', '우대'] },
]

const HABIT_CATEGORIES = [
  {
    label: '일상소비', icon: '🛒',
    items: [
      { label: '편의점',   keywords: ['편의점'] },
      { label: '카페',     keywords: ['카페', '커피'] },
      { label: '쇼핑',     keywords: ['쇼핑', '쿠팡', '무신사', 'SSG', '올리브영'] },
      { label: '대형마트', keywords: ['마트'] },
    ]
  },
  {
    label: '교통', icon: '🚇',
    items: [
      { label: '주유',        keywords: ['주유'] },
      { label: '대중교통',    keywords: ['버스', '지하철', '교통', 'KTX'] },
      { label: '전기차/공유', keywords: ['전기차', '자전거', '킥보드'] },
    ]
  },
  {
    label: '여행', icon: '✈️',
    items: [
      { label: '해외결제',    keywords: ['해외'] },
      { label: '공항라운지',  keywords: ['공항', '라운지'] },
      { label: '면세점/환전', keywords: ['면세', '환전'] },
      { label: '호텔/리조트', keywords: ['호텔', '리조트'] },
    ]
  },
  {
    label: '문화/취미', icon: '🎭',
    items: [
      { label: '영화/공연', keywords: ['영화', '공연', 'CGV', '메가박스'] },
      { label: '골프/스파',  keywords: ['골프', '스파'] },
    ]
  },
  {
    label: '생활', icon: '🏠',
    items: [
      { label: '병원/약국', keywords: ['병원', '약국'] },
      { label: '통신',     keywords: ['통신'] },
      { label: '공과금',   keywords: ['공과금', '관리비'] },
      { label: 'ATM',      keywords: ['ATM'] },
    ]
  },
]

const ALL_HABIT_ITEMS = HABIT_CATEGORIES.flatMap(c => c.items)
const MAX_FEE = 50000

export default function CardSearch() {
  const [allCards, setAllCards]                     = useState([])
  const [loading, setLoading]                       = useState(true)
  const [cardType, setCardType]                     = useState(null)
  const [selectedBenefitTypes, setSelectedBenefitTypes] = useState(new Set())
  const [selectedHabits, setSelectedHabits]         = useState(new Set())
  const [maxFee, setMaxFee]                         = useState(MAX_FEE)

  useEffect(() => {
    fetch('/api/cards')
      .then(r => r.json())
      .then(d => { setAllCards(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const filtered = allCards.filter(card => {
    if (cardType && card.type !== cardType) return false
    if (card.annualFee > maxFee) return false

    if (selectedBenefitTypes.size > 0) {
      const matchTypes = BENEFIT_TYPE_OPTIONS
        .filter(bt => selectedBenefitTypes.has(bt.label))
        .flatMap(bt => bt.match)
      const cardBenefitTypes = (card.benefits || []).map(b => b.type)
      if (!cardBenefitTypes.some(t => matchTypes.includes(t))) return false
    }

    if (selectedHabits.size > 0) {
      const allDesc = (card.benefits || []).map(b => b.desc || '').join(' ')
      const selectedKws = ALL_HABIT_ITEMS
        .filter(item => selectedHabits.has(item.label))
        .flatMap(item => item.keywords)
      if (!selectedKws.some(kw => allDesc.includes(kw))) return false
    }

    return true
  })

  const toggleBenefitType = (label) => {
    setSelectedBenefitTypes(prev => {
      const next = new Set(prev)
      if (next.has(label)) { next.delete(label) } else { next.add(label) }
      return next
    })
  }

  const toggleHabit = (label) => {
    setSelectedHabits(prev => {
      const next = new Set(prev)
      if (next.has(label)) { next.delete(label) } else { next.add(label) }
      return next
    })
  }

  const reset = () => {
    setCardType(null)
    setSelectedBenefitTypes(new Set())
    setSelectedHabits(new Set())
    setMaxFee(MAX_FEE)
  }

  const hasFilters = cardType !== null
    || selectedBenefitTypes.size > 0
    || selectedHabits.size > 0
    || maxFee < MAX_FEE

  return (
    <div className="csrch-page">

      {/* Hero */}
      <div className="csrch-hero">
        <p className="csrch-eyebrow">카드 찾기</p>
        <h1 className="csrch-title">내게 맞는 카드 찾기</h1>
        <p className="csrch-sub">원하는 혜택을 선택하면 딱 맞는 카드를 찾아드려요</p>
      </div>

      {/* Body */}
      <div className="csrch-body">

        {/* ── 좌측 사이드바 ── */}
        <aside className="csrch-sidebar">
          <div className="csf-inner">

            {/* 카드 종류 */}
            <div className="csf-section">
              <p className="csf-title">카드 종류</p>
              <div className="csf-type-row">
                {CARD_TYPES.map(t => (
                  <button
                    key={t}
                    className={`csf-type-btn${cardType === t ? ' on' : ''}`}
                    onClick={() => setCardType(prev => prev === t ? null : t)}
                  >{t}</button>
                ))}
              </div>
            </div>

            {/* 혜택 유형 */}
            <div className="csf-section">
              <p className="csf-title">혜택 유형</p>
              <div className="csf-chips">
                {BENEFIT_TYPE_OPTIONS.map(bt => (
                  <button
                    key={bt.label}
                    className={`csf-chip${selectedBenefitTypes.has(bt.label) ? ' on' : ''}`}
                    onClick={() => toggleBenefitType(bt.label)}
                  >{bt.label}</button>
                ))}
              </div>
            </div>

            {/* 자주 이용하는 혜택 */}
            <div className="csf-section">
              <p className="csf-title">
                자주 이용하는 혜택
                <span className="csf-title-hint">복수 선택 가능</span>
              </p>
              {HABIT_CATEGORIES.map(cat => (
                <div key={cat.label} className="csf-habit-group">
                  <p className="csf-habit-cat">{cat.icon} {cat.label}</p>
                  <div className="csf-chips">
                    {cat.items.map(item => (
                      <button
                        key={item.label}
                        className={`csf-chip${selectedHabits.has(item.label) ? ' on' : ''}`}
                        onClick={() => toggleHabit(item.label)}
                      >{item.label}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* 연회비 */}
            <div className="csf-section">
              <p className="csf-title">연회비</p>
              <p className="csf-fee-range">
                0원 ~ {maxFee >= MAX_FEE ? '5만원 이상' : `${maxFee.toLocaleString()}원`}
              </p>
              <input
                type="range"
                min={0}
                max={MAX_FEE}
                step={5000}
                value={maxFee}
                onChange={e => setMaxFee(Number(e.target.value))}
                className="csf-slider"
              />
              <div className="csf-slider-labels">
                <span>0원</span>
                <span>1만원</span>
                <span>3만원</span>
                <span>5만원</span>
              </div>
            </div>

            {hasFilters && (
              <button className="csf-reset-btn" onClick={reset}>↺ 필터 초기화</button>
            )}

          </div>
        </aside>

        {/* ── 우측 결과 ── */}
        <section className="csrch-results">
          <p className="csrch-count">
            총 <strong>{loading ? '-' : filtered.length}건</strong>의 카드가 검색되었습니다
          </p>

          {loading ? (
            <div className="csrch-loading"><div className="csrch-spinner" /></div>
          ) : filtered.length === 0 ? (
            <div className="csrch-empty">
              <p className="csrch-empty-msg">조건에 맞는 카드가 없습니다</p>
              <button className="csf-reset-btn csf-reset-btn--inline" onClick={reset}>
                필터 초기화
              </button>
            </div>
          ) : (
            <div className="csrch-grid">
              {filtered.map(card => (
                <CardSearchItem key={card.id} card={card} />
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  )
}
