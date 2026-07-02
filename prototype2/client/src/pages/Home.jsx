import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import './Home.css'

/* ─────────────────────────────────────────────
   BNK 영원카드 — 평생 카드 전용 랜딩 (프리미엄 제품 페이지)
   ───────────────────────────────────────────── */

/* 라인 SVG 아이콘 (이모지 대신 — 깔끔/일관) */
const IC = {
  target: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.4" />
    </svg>
  ),
  sprout: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21v-8" /><path d="M12 13c0-3.3 2.2-5.5 5.5-5.5 0 3.3-2.2 5.5-5.5 5.5Z" />
      <path d="M12 13c0-2.8-1.9-4.7-4.7-4.7C7.3 11.1 9.2 13 12 13Z" />
    </svg>
  ),
  trend: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 17l6-6 4 4 8-8" /><path d="M16 7h5v5" />
    </svg>
  ),
  coffee: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 8h13v5a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z" /><path d="M17 9h2a2 2 0 0 1 0 4h-2" /><path d="M8 2v2M12 2v2" />
    </svg>
  ),
  piggy: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 10c1.3 0 2 1 2 2s-.7 2-2 2c-.5 2.3-2.8 4-5.5 4S8.5 18 8 16H6l-2 3v-5a6 6 0 0 1 6-6h3c1.7 0 3.2.7 4.3 1.8" />
      <circle cx="14" cy="11" r="0.9" fill="currentColor" stroke="none" /><path d="M11 6.5C11 5 12 4 13.5 4" />
    </svg>
  ),
  bus: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="13" rx="2.5" /><path d="M4 11h16" /><circle cx="8" cy="20" r="1.4" /><circle cx="16" cy="20" r="1.4" />
    </svg>
  ),
  globe: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3c3 2.5 3 15.5 0 18M12 3c-3 2.5-3 15.5 0 18" />
    </svg>
  ),
  shield: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l7 3v5c0 4.5-3 7.8-7 9-4-1.2-7-4.5-7-9V6z" /><path d="M9 12l2 2 4-4" />
    </svg>
  ),
  infinity: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <path d="M7 9c-2 0-3.5 1.3-3.5 3S5 15 7 15c2.5 0 3.5-3 5-3s2.5-3 5-3 3.5 1.3 3.5 3-1.5 3-3.5 3c-2.5 0-3.5-3-5-3" />
    </svg>
  ),
}

const PILLARS = [
  { ic: IC.target, no: '01', title: '고를 필요 없어요', desc: 'AI가 내 소비를 분석해\n딱 맞는 혜택을 자동으로 켜줍니다' },
  { ic: IC.sprout, no: '02', title: '평생 함께 진화', desc: '나이와 소비가 바뀌면\n혜택도 알아서 따라 바뀝니다' },
  { ic: IC.trend,  no: '03', title: '자산이 자라요', desc: '아낀 돈을 모아 자산이\n커지는 걸 눈으로 확인합니다' },
]

/* DB(/api/life-card) 연결 실패 시 보여줄 기본값(폴백) */
const STAGES_FALLBACK = [
  { age: '10대',    label: '청소년',     benefit: '편의점·교통 적립\n＋ 용돈 관리' },
  { age: '20대',    label: '사회초년생', benefit: '배달·카페·구독 적립\n＋ 저축 습관' },
  { age: '30~40대', label: '가정 형성',  benefit: '마트·주유·교육 할인\n＋ 자산 형성' },
  { age: '60대+',   label: '시니어',     benefit: '의료·약국·여행\n＋ 안정·연금' },
]

const BENEFITS = [
  { ic: IC.coffee, title: '내 1순위에 자동 적립', desc: '배달·카페·구독 등 가장 많이 쓴 영역에 매달 최고 적립률을 자동 적용' },
  { ic: IC.piggy,  title: '아낀 돈 자동 저축',   desc: 'AI가 아껴준 금액을 그대로 저축통에. 안 쓰던 돈이 쌓입니다' },
  { ic: IC.bus,    title: '후불 교통카드',       desc: '전국 버스·지하철, 충전 없이 그대로 태그' },
  { ic: IC.globe,  title: '해외 결제 우대',       desc: '여행·직구에서 해외 수수료 우대' },
  { ic: IC.shield, title: 'On / Off 즉시 관리',   desc: '분실·미사용 시 앱에서 1초 만에 잠금·해제' },
  { ic: IC.infinity, title: '연회비 평생 무료',   desc: '발급부터 노년까지, 유지 비용 0원' },
]

export default function Home() {
  const heroCardRef = useRef(null)
  const [stages, setStages] = useState(STAGES_FALLBACK)

  // 라이프스테이지 혜택을 DB(/api/life-card)에서 로드 — 실패 시 폴백 유지
  useEffect(() => {
    fetch('/api/life-card')
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(d => {
        if (!d?.stages?.length) return
        setStages(d.stages.map(s => ({
          age:     s.age,
          label:   s.label,
          benefit: (s.benefits || []).map(b => b.desc).join('\n') || '맞춤 혜택',
        })))
      })
      .catch(() => {})
  }, [])

  function handleTilt(e) {
    const el = heroCardRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width
    const py = (e.clientY - r.top) / r.height
    el.style.transform = `rotateX(${(0.5 - py) * 16}deg) rotateY(${(px - 0.5) * 24}deg)`
    el.style.animation = 'none'
  }
  function resetTilt() {
    const el = heroCardRef.current
    if (!el) return
    el.style.transform = ''
    el.style.animation = ''
  }

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('sec-visible') }),
      { threshold: 0.12 }
    )
    document.querySelectorAll('.sec-animate').forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  return (
    <div className="home life-home">

      {/* ── HERO ── */}
      <section className="kv">
        <div className="kv-bg" />
        <div className="kv-glow kv-glow-1" />
        <div className="kv-glow kv-glow-2" />
        <div className="kv-grid">
          <div className="kv-inner">
            <p className="kv-eyebrow">평생 함께 자라는 AI 카드</p>
            <h1 className="kv-title">BNK 영원카드</h1>
            <p className="kv-sub">어릴 때부터 노년까지, AI가 내 소비와 나이에 맞춰<br />혜택을 알아서 바꿔주는 단 하나의 카드</p>
            <div className="kv-cta-row">
              <Link to="/life-card" className="kv-cta">내 카드 만들기</Link>
              <Link to="/cards" className="kv-cta-ghost">다른 BNK 카드 보러가기 →</Link>
            </div>
          </div>
          <div className="kv-card-stage" onMouseMove={handleTilt} onMouseLeave={resetTilt}>
            <img
              src="/cards/card-25.jpeg"
              alt="BNK 영원카드"
              className="hero-card"
              ref={heroCardRef}
            />
          </div>
        </div>
        <div className="kv-scroll-hint"><div className="kv-scroll-line" /></div>
      </section>

      {/* ── 카드 소개 (다크, 드라마틱) ── */}
      <section className="lh-sec lh-dark">
        <div className="lh-inner narrow sec-animate">
          <p className="lh-eyebrow">A CARD FOR LIFE</p>
          <h2 className="lh-title">
            첫 카드이자,<br />마지막 카드
          </h2>
          <p className="lh-lead">
            학생 때 만들어 노년까지. 카드는 그대로 두고,<br />
            혜택만 나와 함께 자랍니다.
          </p>
          <div className="lh-showcard">
            <img
              src="/cards/card-25.jpeg"
              alt="BNK 영원카드"
              className="hero-card hero-card--static"
            />
          </div>
        </div>
      </section>

      {/* ── 3 기둥 (라이트) ── */}
      <section className="lh-sec lh-cream">
        <div className="lh-inner sec-animate">
          <p className="lh-eyebrow accent">왜 BNK 영원카드인가</p>
          <h2 className="lh-title dark">고르지 말고, 맡기세요</h2>
          <div className="pillar-grid">
            {PILLARS.map((p, i) => (
              <div key={i} className="pillar-card" style={{ transitionDelay: `${i * 90}ms` }}>
                <span className="pillar-no">{p.no}</span>
                <span className="pillar-ic">{p.ic}</span>
                <p className="pillar-title">{p.title}</p>
                <p className="pillar-desc">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 라이프스테이지 (다크, 타임라인) ── */}
      <section className="lh-sec lh-dark">
        <div className="lh-inner sec-animate">
          <p className="lh-eyebrow">GROWS WITH YOU</p>
          <h2 className="lh-title">한 장으로 평생,<br />혜택은 매번 새롭게</h2>
          <p className="lh-lead center">AI가 나이와 소비를 분석해, 생애 단계마다 혜택을 자동으로 바꿔드립니다.</p>
          <div className="stage-line">
            {stages.map((s, i) => (
              <div key={i} className="stage-node" style={{ transitionDelay: `${i * 90}ms` }}>
                <span className="stage-dot" />
                <span className="stage-age">{s.age}</span>
                <p className="stage-label">{s.label}</p>
                <p className="stage-benefit">{s.benefit}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 이 카드만의 혜택 (라이트) ── */}
      <section className="lh-sec lh-cream">
        <div className="lh-inner sec-animate">
          <p className="lh-eyebrow accent">BNK 영원카드만의 혜택</p>
          <h2 className="lh-title dark">하나의 카드에<br />다 담았습니다</h2>
          <div className="bnf-grid">
            {BENEFITS.map((b, i) => (
              <div key={i} className="bnf-item" style={{ transitionDelay: `${i * 60}ms` }}>
                <span className="bnf-ic">{b.ic}</span>
                <div>
                  <p className="bnf-title">{b.title}</p>
                  <p className="bnf-desc">{b.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── AI 추천 (틴트) ── */}
      <section className="lh-sec lh-tint">
        <div className="lh-inner hori sec-animate">
          <div className="ar-text">
            <p className="lh-eyebrow accent">AI 자동 추천</p>
            <h2 className="lh-title dark">혜택표 안 봐도<br />AI가 챙겨드려요</h2>
            <p className="lh-lead">"이번 달 카페에 많이 쓰셨네요" —<br />소비를 읽고 받을 혜택을 먼저 알려드립니다.</p>
            <Link to="/chatbot" className="btn-filled">AI 상담 받기</Link>
          </div>
          <div className="ar-visual">
            <div className="ar-chat">
              <div className="arc-bubble bot">이번 달 어디에 많이 쓰셨어요?</div>
              <div className="arc-bubble user">카페랑 배달이요</div>
              <div className="arc-bubble bot">
                분석 완료! 이렇게 챙겨드릴게요 ✦
                <div className="arc-card-list">
                  <div className="arc-card-item"><div className="arc-card-dot" style={{ background: '#D71919' }} />카페 20% 적립 적용</div>
                  <div className="arc-card-item"><div className="arc-card-dot" style={{ background: '#8B0304' }} />배달 10% 적립 적용</div>
                  <div className="arc-card-item"><div className="arc-card-dot" style={{ background: '#896E4A' }} />아낀 2.4만원 자동 저축</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 마무리 CTA (딥그린) ── */}
      <section className="lh-sec lh-finale">
        <div className="lh-inner narrow sec-animate">
          <h2 className="lh-title">평생 함께할<br />내 카드 만들기</h2>
          <p className="lh-lead center">학생도, 사회초년생도, 시니어도 — 하나의 카드로 충분합니다.</p>
          <div className="kv-cta-row" style={{ justifyContent: 'center' }}>
            <Link to="/life-card" className="kv-cta">내 카드 만들기</Link>
            <Link to="/cards" className="kv-cta-ghost">다른 BNK 카드 보러가기 →</Link>
          </div>
        </div>
      </section>

    </div>
  )
}
