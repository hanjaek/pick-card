import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import CardItem from '../components/CardItem'
import './Home.css'

function Home() {
  const [featuredCards, setFeaturedCards] = useState([])
  const navigate = useNavigate()

  useEffect(() => {
    fetch('/api/cards')
      .then(r => r.json())
      .then(data => setFeaturedCards(Array.isArray(data) ? data.slice(0, 3) : []))
      .catch(() => {})
  }, [])

  return (
    <div className="home">
      {/* ====== 히어로 섹션 ====== */}
      <section className="hero">
        <div className="hero-content">
          <div className="hero-badge">AI 맞춤 카드 추천</div>
          <h1 className="hero-title">
            나에게 딱 맞는<br />
            <span className="highlight">Pickard 카드</span>를<br />
            AI가 찾아드립니다
          </h1>
          <p className="hero-sub">
            소비 패턴 분석 기반의 맞춤 카드 추천<br />
            부산은행만의 특화 혜택을 누려보세요
          </p>
          <div className="hero-btns">
            <Link to="/cards" className="btn-primary">카드 둘러보기</Link>
            <Link to="/signup" className="btn-ghost">회원가입</Link>
          </div>
        </div>

        <div className="hero-visual">
          <div
            className="float-card fc-1"
            style={{ background: 'linear-gradient(135deg, #8B0304, #D71919)' }}
          >
            <div className="fc-chip" />
            <span className="fc-network">VISA</span>
            <span className="fc-label">Pickard AI 마스터카드</span>
          </div>
          <div
            className="float-card fc-2"
            style={{ background: 'linear-gradient(135deg, #2D2D2D, #555555)' }}
          >
            <div className="fc-chip" />
            <span className="fc-network">MASTER</span>
            <span className="fc-label">Pickard 자기개발카드</span>
          </div>
          <div
            className="float-card fc-3"
            style={{ background: 'linear-gradient(135deg, #D71919, #E84040)' }}
          >
            <div className="fc-chip" />
            <span className="fc-network">VISA</span>
            <span className="fc-label">Pickard 엔터카드</span>
          </div>
          <div className="hero-glow" />
        </div>
      </section>

      {/* ====== AI 디자인 배너 ====== */}
      <section className="ai-design-banner">
        <div className="section-inner">
          <div className="adb-content">
            <div className="adb-left">
              <div className="adb-badge">NEW</div>
              <h2 className="adb-title">✨ AI로 나만의 카드 디자인</h2>
              <p className="adb-desc">
                원하는 디자인을 글로 설명하면 AI가<br />
                세상에 하나뿐인 카드를 만들어드립니다
              </p>
              <Link to="/cards" className="adb-btn">지금 만들어보기</Link>
            </div>
            <div className="adb-cards">
              {[
                ['#667eea', '#764ba2'],
                ['#f7971e', '#ffd200'],
                ['#11998e', '#38ef7d'],
              ].map(([from, to], i) => (
                <div
                  key={i}
                  className={`adb-card adb-card-${i + 1}`}
                  style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
                >
                  <div className="adb-chip" />
                  <span className="adb-net">VISA</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ====== 추천 카드 섹션 ====== */}
      <section className="featured-section">
        <div className="section-inner">
          <div className="section-header">
            <h2 className="section-title">인기 카드</h2>
            <p className="section-sub">
              카드를 클릭하면 상세 정보를 확인할 수 있습니다
            </p>
          </div>
          <div className="card-grid">
            {featuredCards.map(card => (
              <CardItem
                key={card.id}
                card={card}
                onClick={() => navigate(`/cards/${card.id}`)}
              />
            ))}
          </div>
          <div className="section-cta">
            <Link to="/cards" className="btn-more">전체 카드 보기</Link>
          </div>
        </div>
      </section>

      {/* ====== 혜택 소개 섹션 ====== */}
      <section className="why-section">
        <div className="section-inner">
          <h2 className="section-title center">BNK 카드만의 특별한 혜택</h2>
          <div className="why-grid">
            <div className="why-card">
              <div className="why-icon icon-ai" />
              <h3>AI 맞춤 추천</h3>
              <p>소비 패턴을 분석해 가장 혜택이 큰 카드를 자동으로 추천합니다</p>
            </div>
            <div className="why-card">
              <div className="why-icon icon-design" />
              <h3>AI 커스텀 디자인</h3>
              <p>원하는 테마를 설명하면 AI가 세상에 하나뿐인 나만의 카드를 만들어드립니다</p>
            </div>
            <div className="why-card">
              <div className="why-icon icon-secure" />
              <h3>비대면 실명확인</h3>
              <p>신분증 촬영 한 번으로 빠르고 안전하게 카드를 신청하세요</p>
            </div>
            <div className="why-card">
              <div className="why-icon icon-global" />
              <h3>글로벌 결제</h3>
              <p>VISA / MASTER 제휴로 전 세계 어디서나 편리하게 사용하세요</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

export default Home
