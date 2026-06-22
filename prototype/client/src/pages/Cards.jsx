import { useState } from 'react'
import CardItem from '../components/CardItem'
import './Cards.css'

// 전체 카드 상품 목록
// 실제 구현 시: useEffect + axios.get('/api/cards') 로 DB에서 가져옴
const ALL_CARDS = [
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
  },
  {
    id: 4,
    name: 'BNK 라이프카드',
    type: '신용카드',
    colorFrom: '#fc466b',
    colorTo: '#3f5efb',
    benefits: ['배달 앱 5% 캐시백', '쿠팡 월 최대 3만원 할인', '편의점 3% 적립'],
    annualFee: 10000,
    network: 'VISA',
    approvalCode: 'BNK-2024-LIFE-004'
  },
  {
    id: 5,
    name: 'BNK 글로벌카드',
    type: '신용카드',
    colorFrom: '#003882',
    colorTo: '#0066CC',
    benefits: ['해외 결제 수수료 면제', '공항 라운지 연 2회 제공', '환전 우대율 90%'],
    annualFee: 30000,
    network: 'VISA',
    approvalCode: 'BNK-2024-GLB-005'
  },
  {
    id: 6,
    name: 'BNK 그린카드',
    type: '체크카드',
    colorFrom: '#56ab2f',
    colorTo: '#a8e063',
    benefits: ['대중교통 10% 적립', '친환경 가맹점 5% 캐시백', '전기차 충전 할인'],
    annualFee: 3000,
    network: 'MASTER',
    approvalCode: 'BNK-2024-GREEN-006'
  }
]

// 필터 옵션: '전체' / 카드 타입명 그대로 사용
const FILTERS = ['전체', '신용카드', '체크카드']

function Cards() {
  const [activeFilter, setActiveFilter] = useState('전체')

  // 선택 필터에 따른 카드 목록 필터링
  const filtered = activeFilter === '전체'
    ? ALL_CARDS
    : ALL_CARDS.filter(c => c.type === activeFilter)

  // 특정 필터의 카드 수 계산
  const countFor = (f) => f === '전체'
    ? ALL_CARDS.length
    : ALL_CARDS.filter(c => c.type === f).length

  return (
    <div className="cards-page">

      {/* 상단 배너 */}
      <div className="cards-hero">
        <h1 className="cards-hero-title">카드 상품</h1>
        <p className="cards-hero-sub">BNK 부산은행의 다양한 카드 혜택을 비교해보세요</p>
      </div>

      <div className="cards-inner">

        {/* 카드 타입 필터 탭 */}
        <div className="filter-tabs">
          {FILTERS.map(f => (
            <button
              key={f}
              className={`filter-tab ${activeFilter === f ? 'active' : ''}`}
              onClick={() => setActiveFilter(f)}
            >
              {f}
              <span className="filter-count">{countFor(f)}</span>
            </button>
          ))}
        </div>

        <p className="hover-hint">카드에 마우스를 올리면 혜택을 확인할 수 있습니다</p>

        {/* 카드 그리드 */}
        <div className="cards-grid">
          {filtered.map(card => (
            <CardItem key={card.id} card={card} />
          ))}
        </div>

      </div>
    </div>
  )
}

export default Cards
