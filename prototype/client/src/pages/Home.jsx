import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import './Home.css'

const FILTERS = [
  { label: '어디서나',     value: '어디서나' },
  { label: '카페/베이커리', value: '카페' },
  { label: '할인',         value: '할인' },
  { label: '여행/숙박',    value: '여행' },
  { label: '주유',         value: '주유' },
  { label: '쇼핑',         value: '쇼핑' },
  { label: '교통',         value: '교통' },
]

const CARD_COLORS = [
  ['#1B3A5C', '#2D6195'],  // Young: 스틸블루
  ['#1C1C2E', '#2D2D3E'],  // 마이플러스: 다크챠콜
  ['#7A1515', '#B82020'],  // 부산사랑: 딥레드
  ['#111111', '#222222'],  // 하이라이프: 럭셔리블랙
  ['#0F3D28', '#1B6340'],  // 그린라이프: 포레스트그린
  ['#280B42', '#4A1578'],  // 쇼핑플러스: 딥바이올렛
  ['#0A1628', '#122240'],  // 트래블: 딥네이비
  ['#5C3A1E', '#8A5C2E'],  // 알뜰: 브론즈
]

const PARTNERS = [
  '스타벅스', '쿠팡', '배달의민족', 'GS25', '다이소', '이마트',
  'CGV', '버스·지하철', 'SK주유소', '롯데마트', '올리브영', '네이버페이',
]

const FEATURES = [
  { icon: '♾️', title: '연회비 무료', desc: '발급 비용 없음' },
  { icon: '🚇', title: '후불 교통카드', desc: '전국 대중교통 이용' },
  { icon: '🌐', title: '해외 결제', desc: '해외 가맹점 이용' },
  { icon: '⚡', title: 'On/Off 관리', desc: '즉시 차단·해제' },
  { icon: '🏧', title: 'ATM 수수료 무료', desc: '공지 전까지 무료' },
]

function CardSlide({ card, index, onClick }) {
  const colorFrom = card.color_from || CARD_COLORS[index % CARD_COLORS.length][0]
  const colorTo   = card.color_to   || CARD_COLORS[index % CARD_COLORS.length][1]
  const name      = card.prd_nm || card.name || `카드 ${index + 1}`
  const benefits  = card.benefits || []
  const annualFee = card.annual_fee ?? card.annualFee ?? 0

  return (
    <div className="csl-wrap" onClick={onClick}>
      <div className="csl-flip">
        <div className="csl-flip-inner">
          {/* 앞면 */}
          <div
            className="csl-front"
            style={{ background: `linear-gradient(145deg, ${colorFrom}, ${colorTo})` }}
          >
            <div className="csl-chip" />
            <span className="csl-net">{card.network || 'VISA'}</span>
            <div className="csl-front-bottom">
              <span className="csl-front-name">{name}</span>
            </div>
            <div className="csl-gloss" />
          </div>
          {/* 뒷면 */}
          <div className="csl-back-face">
            <p className="csl-back-title">{name}</p>
            <ul className="csl-back-benefits">
              {benefits.slice(0, 3).map((b, i) => (
                <li key={i}>{typeof b === 'string' ? b : b.desc}</li>
              ))}
              {benefits.length === 0 && <li>혜택 정보 없음</li>}
            </ul>
            <p className="csl-back-fee">
              연회비 {annualFee > 0 ? `${annualFee.toLocaleString()}원` : '없음'}
            </p>
          </div>
        </div>
      </div>
      <p className="csl-name">{name}</p>
      <p className="csl-sub">{benefits?.[0]?.desc || '혜택 카드'}</p>
    </div>
  )
}

export default function Home() {
  const [allCards, setAllCards] = useState([])
  const [filter,   setFilter]   = useState('all')
  const navigate = useNavigate()
  const sectionsRef = useRef([])

  useEffect(() => {
    fetch('/api/cards')
      .then(r => r.json())
      .then(d => setAllCards(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [])

  // 스크롤 페이드인
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach(e => {
        if (e.isIntersecting) e.target.classList.add('sec-visible')
      }),
      { threshold: 0.12 }
    )
    document.querySelectorAll('.sec-animate').forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [allCards])

  const displayed = filter === 'all'
    ? allCards
    : allCards.filter(c => (c.benefit_category || '').includes(filter))

  return (
    <div className="home">

      {/* ── KV HERO ── */}
      <section className="kv">
        <div className="kv-img" />
        <div className="kv-overlay" />
        <div className="kv-inner">
          <p className="kv-eyebrow">AI 맞춤 카드 추천</p>
          <h1 className="kv-title">
            BNK Pickard<br />
            카드몰
          </h1>
          <p className="kv-sub">소비 패턴 분석 기반의 맞춤 카드 추천</p>
          <Link to="/cards" className="kv-cta">카드 둘러보기</Link>
        </div>
        <div className="kv-scroll-hint">
          <div className="kv-scroll-line" />
        </div>
      </section>

      {/* ── CARD LINEUP ── */}
      <section className="lineup-sec">
        <div className="sec-inner sec-animate">
          <p className="sec-eyebrow">추천 카드</p>
          <h2 className="sec-title">
            <span className="sec-sub-title">나에게 딱 맞는</span><br />
            카드를 찾아보세요
          </h2>
          <div className="filter-chips">
            <button
              className="fchip fchip-find"
              onClick={() => navigate('/cards')}
            >
              ✦ 내게 맞는 카드 찾기
            </button>
            {FILTERS.map(f => (
              <button
                key={f.value}
                className={`fchip${filter === f.value ? ' on' : ''}`}
                onClick={() => setFilter(filter === f.value ? 'all' : f.value)}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="card-slider">
            {displayed.length > 0
              ? displayed.slice(0, 8).map((card, i) => (
                  <CardSlide key={card.id} card={card} index={i} onClick={() => navigate(`/cards/${card.id}`)} />
                ))
              : Array.from({ length: 5 }).map((_, i) => <div key={i} className="csl-skeleton" />)
            }
          </div>
          <div className="sec-more">
            <Link to="/cards" className="btn-outline">카드 전체보기</Link>
          </div>
        </div>
      </section>

      <div className="sec-divider" />

      {/* ── AI RECOMMEND ── */}
      <section className="ai-rec-sec">
        <div className="sec-inner hori sec-animate">
          <div className="ar-text">
            <p className="sec-eyebrow">AI 추천</p>
            <h2 className="sec-title">
              <span className="sec-sub-title">소비 패턴 분석으로</span><br />
              최적의 카드를<br />
              추천해드려요
            </h2>
            <p className="ar-desc">연회비·실적 조건 없이, AI가 내 소비에 맞는<br />카드를 즉시 찾아드립니다.</p>
            <Link to="/chatbot" className="btn-filled">AI 챗봇 상담</Link>
          </div>
          <div className="ar-visual">
            <div className="ar-chat">
              <div className="arc-bubble bot">어떤 혜택을 주로 이용하시나요?</div>
              <div className="arc-bubble user">카페랑 대중교통 자주 써요</div>
              <div className="arc-bubble bot">
                분석 완료! 3가지 카드를 추천해드릴게요 ✦
                <div className="arc-card-list">
                  {['Young 체크카드', '그린라이프 카드', '마이플러스 카드'].map((nm, i) => (
                    <div key={i} className="arc-card-item">
                      <div className="arc-card-dot" style={{ background: CARD_COLORS[i][0] }} />
                      {nm}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="sec-divider" />

      {/* ── PARTNERS ── */}
      <section className="partners-sec">
        <div className="sec-inner sec-animate">
          <p className="sec-eyebrow">제휴 혜택</p>
          <h2 className="sec-title">
            <span className="sec-sub-title">많이 쓰는 곳에서</span><br />
            더 많은 혜택을
          </h2>
        </div>
        <div className="marquee-wrap">
          <div className="marquee-track">
            {[...PARTNERS, ...PARTNERS].map((name, i) => (
              <div key={i} className="marquee-item">{name}</div>
            ))}
          </div>
        </div>
      </section>

      <div className="sec-divider" />

      {/* ── AI DESIGN CTA ── */}
      <section className="design-cta-sec">
        <div className="sec-inner sec-animate">
          <p className="sec-eyebrow light">나만의 카드</p>
          <h2 className="sec-title light">
            <span className="sec-sub-title light">AI로 만드는</span><br />
            나만의 카드 디자인
          </h2>
          <p className="design-cta-desc">프롬프트 한 줄로 세상에 하나뿐인 카드를 만들어보세요</p>
          <Link to="/ai-design" className="btn-white">AI 디자인 시작하기</Link>
        </div>
        <div className="design-cta-cards" aria-hidden>
          {CARD_COLORS.slice(0, 4).map(([from, to], i) => (
            <div
              key={i}
              className={`dcc-card dcc-${i}`}
              style={{ background: `linear-gradient(145deg, ${from}, ${to})` }}
            >
              <div className="dcc-gloss" />
            </div>
          ))}
        </div>
      </section>

      <div className="sec-divider" />

      {/* ── FEATURES ── */}
      <section className="features-sec">
        <div className="sec-inner sec-animate">
          <p className="sec-eyebrow">기본 혜택</p>
          <h2 className="sec-title">
            <span className="sec-sub-title">어디서나 편리하게</span><br />
            안전하고 간편하게
          </h2>
          <div className="features-grid">
            {FEATURES.map((f, i) => (
              <div key={i} className="feat-item" style={{ transitionDelay: `${i * 80}ms` }}>
                <span className="feat-icon">{f.icon}</span>
                <p className="feat-title">{f.title}</p>
                <p className="feat-desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

    </div>
  )
}
