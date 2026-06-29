import { useState } from 'react'
import { Link } from 'react-router-dom'
import './Support.css'

const QUICK_MENUS = [
  { icon: '🤖', label: 'AI 챗봇 상담',  desc: 'AI가 즉시 답변해드려요',    link: '/chatbot' },
  { icon: '📋', label: '약관·설명서',   desc: '카드 약관 조회·다운로드',    link: '/terms' },
  { icon: '💳', label: '카드 둘러보기',  desc: 'BNK 카드 전체 보기',        link: '/cards' },
]

const FAQS = [
  {
    category: '카드 발급',
    items: [
      { q: '카드 발급은 얼마나 걸리나요?', a: '인터넷/모바일 신청 시 심사 후 약 5~7 영업일 이내 배송됩니다. 영업점 방문 시 즉시 발급도 가능합니다.' },
      { q: '카드 발급 시 필요한 서류가 있나요?', a: '비대면 신청 시 신분증(주민등록증 또는 운전면허증) 촬영이 필요합니다. 영업점 방문 시 신분증 원본을 지참해주세요.' },
      { q: '미성년자도 카드를 발급받을 수 있나요?', a: '체크카드는 만 14세 이상부터 발급 가능합니다. 신용카드는 만 19세 이상, 소득이 있는 경우 신청 가능합니다.' },
    ]
  },
  {
    category: '연회비·수수료',
    items: [
      { q: '연회비는 언제 청구되나요?', a: '카드 발급일로부터 1년 단위로 청구됩니다. 체크카드는 연회비가 없으며, 발급수수료 1,000원이 최초 1회 부과됩니다.' },
      { q: '연회비 환불은 어떻게 되나요?', a: '카드 해지 시 잔여 기간에 대해 일할 계산하여 10영업일 이내에 환불됩니다. 부가서비스 이용 내역 확인이 필요한 경우 최대 3개월 이내 환불됩니다.' },
      { q: '해외 결제 수수료가 어떻게 되나요?', a: '해외 가맹점 이용 시 국제브랜드 수수료(1.0%) + 해외이용수수료(0.25%)가 부과됩니다. BNK 트래블 카드는 수수료가 면제됩니다.' },
    ]
  },
  {
    category: '카드 이용',
    items: [
      { q: '카드 한도를 변경하고 싶어요.', a: 'BNK 부산은행 앱 또는 홈페이지에서 한도 변경 신청이 가능합니다. 일시적 한도 상향은 고객센터(1588-6200)로 전화해주세요.' },
      { q: '카드를 분실했어요. 어떻게 해야 하나요?', a: '즉시 고객센터(1588-6200, 24시간)에 전화하시거나 BNK 앱에서 카드 잠금 처리해주세요. 분실신고 후 재발급 신청이 가능합니다.' },
      { q: '결제일을 변경할 수 있나요?', a: '매월 10일, 15일, 20일, 25일 중 선택 가능합니다. BNK 앱 또는 고객센터에서 변경할 수 있으며, 변경 후 익월부터 적용됩니다.' },
    ]
  },
  {
    category: '혜택·포인트',
    items: [
      { q: '적립 포인트는 어디서 확인하나요?', a: 'BNK 부산은행 앱 > 카드 > 포인트 조회에서 확인 가능합니다. 포인트는 결제 취소 등을 감안해 결제일 +5 영업일 후 적립됩니다.' },
      { q: '혜택 할인은 자동으로 적용되나요?', a: '네, 해당 가맹점에서 카드 결제 시 자동으로 할인/적립이 적용됩니다. 전월 실적 조건을 충족해야 혜택이 제공되는 카드도 있으니 상품안내를 확인해주세요.' },
    ]
  },
]


export default function Support() {
  const [openFaq, setOpenFaq] = useState(null)
  const [faqCat, setFaqCat]   = useState(FAQS[0].category)

  const toggleFaq = (key) => setOpenFaq(prev => prev === key ? null : key)

  return (
    <div className="sp-page">

      {/* Hero */}
      <div className="sp-hero">
        <p className="sp-eyebrow">고객센터</p>
        <h1 className="sp-hero-title">무엇을 도와드릴까요?</h1>
        <p className="sp-hero-sub">카드 이용 관련 궁금한 점을 빠르게 해결하세요</p>
      </div>

      <div className="sp-body">

        {/* ── 빠른 메뉴 ── */}
        <section className="sp-section">
          <h2 className="sp-section-title">빠른 메뉴</h2>
          <div className="sp-quick-grid">
            {QUICK_MENUS.map((m) => {
              const inner = (
                <>
                  <span className="sp-quick-icon">{m.icon}</span>
                  <p className="sp-quick-label">{m.label}</p>
                  <p className="sp-quick-desc">{m.desc}</p>
                </>
              )
              return m.link ? (
                <Link key={m.label} to={m.link} className="sp-quick-card">{inner}</Link>
              ) : (
                <div key={m.label} className="sp-quick-card">{inner}</div>
              )
            })}
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="sp-section">
          <h2 className="sp-section-title">자주 묻는 질문</h2>

          <div className="sp-faq-cats">
            {FAQS.map(f => (
              <button
                key={f.category}
                className={`sp-faq-cat${faqCat === f.category ? ' on' : ''}`}
                onClick={() => { setFaqCat(f.category); setOpenFaq(null) }}
              >
                {f.category}
              </button>
            ))}
          </div>

          <div className="sp-faq-list">
            {FAQS.find(f => f.category === faqCat)?.items.map((item, i) => {
              const key = `${faqCat}-${i}`
              const isOpen = openFaq === key
              return (
                <div key={key} className={`sp-faq-item${isOpen ? ' open' : ''}`}>
                  <button className="sp-faq-q" onClick={() => toggleFaq(key)}>
                    <span className="sp-faq-q-badge">Q</span>
                    <span className="sp-faq-q-text">{item.q}</span>
                    <svg className="sp-faq-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>
                  {isOpen && (
                    <div className="sp-faq-a">
                      <span className="sp-faq-a-badge">A</span>
                      <p>{item.a}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>


      </div>
    </div>
  )
}
