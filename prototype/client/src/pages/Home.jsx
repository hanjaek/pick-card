import { Link } from 'react-router-dom'
import CardItem from '../components/CardItem'
import './Home.css'

// 메인 페이지에 노출할 추천 카드 데이터
// 실제 구현 시: useEffect + axios.get('/api/cards') 로 대체
const FEATURED_CARDS = [
  {
    id: 1,
    name: 'BNK AI 마스터카드',
    type: '신용카드',
    colorFrom: '#667eea',
    colorTo: '#764ba2',
    benefits: ['ChatGPT · Claude 구독 30% 할인', 'AI 교육 플랫폼 20% 캐시백', '클라우드 서비스 5% 청구할인'],
    annualFee: 15000,
    network: 'VISA',
    approvalCode: 'BNK-2024-AI-001'
  },
  {
    id: 2,
    name: 'BNK 자기개발카드',
    type: '체크카드',
    colorFrom: '#11998e',
    colorTo: '#38ef7d',
    benefits: ['자격증 응시료 10% 환급', '온·오프라인 서점 5% 캐시백', '강의 플랫폼 월 1만원 할인'],
    annualFee: 5000,
    network: 'MASTER',
    approvalCode: 'BNK-2024-EDU-002'
  },
  {
    id: 3,
    name: 'BNK 엔터카드',
    type: '신용카드',
    colorFrom: '#f7971e',
    colorTo: '#ffd200',
    benefits: ['OTT 4종 구독료 50% 할인', '영화관 2인 1인 요금', '음원 스트리밍 무료 이용'],
    annualFee: 12000,
    network: 'VISA',
    approvalCode: 'BNK-2024-ENT-003'
  }
]

function Home() {
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

        {/* 우측: 떠다니는 카드 3장 */}
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
          {/* 배경 글로우 원 */}
          <div className="hero-glow" />
        </div>
      </section>

      {/* ====== 추천 카드 섹션 ====== */}
      <section className="featured-section">
        <div className="section-inner">
          <div className="section-header">
            <h2 className="section-title">AI 추천 카드</h2>
            <p className="section-sub">
              카드에 마우스를 올리면 혜택을 확인할 수 있습니다
            </p>
          </div>
          <div className="card-grid">
            {FEATURED_CARDS.map(card => (
              <CardItem key={card.id} card={card} />
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
