import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './LifeCard.css'

/* BNK 라이프 평생 카드 — 상세 설명 + AI 소비 분석 + 발급(테스트: 신분증 생략) */

export default function LifeCard() {
  const navigate  = useNavigate()
  const token     = localStorage.getItem('token')
  const userName  = localStorage.getItem('userName') || '회원'

  const [info,     setInfo]     = useState(null)   // /api/life-card (카드 + 단계별 혜택)
  const [analysis, setAnalysis] = useState(null)   // /api/life-card/my (개인화 분석)
  const [loadingA, setLoadingA] = useState(!!token)
  const [issued,   setIssued]   = useState(false)

  useEffect(() => {
    fetch('/api/life-card')
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(setInfo).catch(() => {})
  }, [])

  useEffect(() => {
    if (!token) return
    fetch('/api/life-card/my', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(setAnalysis).catch(() => {}).finally(() => setLoadingA(false))
  }, [])

  const card    = info?.card
  const stages  = info?.stages || []
  const common  = info?.common || []
  const active  = analysis?.active || []
  const matched = active.filter(b => b.matched && b.saved > 0)
  const others  = active.filter(b => !(b.matched && b.saved > 0))

  return (
    <div className="lc-page">

      {/* ── 상단: 카드 + 발급 ── */}
      <section className="lc-hero">
        <div className="lc-hero-card">
          <div className="hero-card hero-card--static">
            <div className="hero-card-shine" />
            <span className="hero-card-net">{card?.network || 'VISA'}</span>
            <div className="hero-card-chip" />
            <div className="hero-card-bottom">
              <p className="hero-card-brand">BNK LIFE</p>
              <p className="hero-card-name">BNK 라이프</p>
              <p className="hero-card-num">1234&nbsp;56•• &nbsp;•••• &nbsp;7890</p>
            </div>
            <span className="hero-card-badge">∞ 평생</span>
          </div>
        </div>

        <div className="lc-hero-text">
          <p className="lc-eyebrow">BNK 라이프 평생 카드</p>
          <h1 className="lc-title">고르지 마세요.<br />AI가 평생 챙겨드립니다.</h1>
          <p className="lc-desc">
            수십 장의 카드 중 나에게 맞는 걸 고르는 데 지치셨나요?<br />
            평생카드는 만 14세부터 시니어까지 — AI가 내 소비 패턴을 분석해 혜택을 자동으로 설정합니다. 카드를 바꿀 필요 없어요.
          </p>
          <ul className="lc-quick">
            <li>만 14세부터 발급</li>
            <li>AI 혜택 자동 설정</li>
            <li>연회비 선택형</li>
            <li>장기고객 추가 혜택</li>
          </ul>
          <button
            className="lc-btn-primary"
            onClick={() => navigate(card ? `/cards/${card.id}/apply` : '/login')}
          >
            이 카드 만들기
          </button>
        </div>
      </section>

      {/* ── AI 소비 분석 리포트 ── */}
      <section className="lc-report">
        <div className="lc-report-head">
          <span className="lc-badge-ai">AI 소비 분석</span>
          <h2 className="lc-report-title">어떤 혜택이 맞는지 모르겠다면<br />AI가 내 소비 패턴을 보고 직접 골라드려요</h2>
          <p className="lc-report-sub">카드 혜택표를 직접 비교할 필요 없어요. 소비 내역을 분석해 지금 내게 가장 유리한 혜택을 자동으로 설정합니다.</p>
        </div>

        {!token ? (
          <div className="lc-demo">
            <p className="lc-demo-notice">✦ 아래는 20대 사회초년생 기준 샘플 예시입니다</p>
            {/* 샘플 분석 카드 3종 */}
            <div className="lc-report-grid">
              <div className="lc-card-box lc-diagnosis">
                <p className="lc-box-label">생애단계 진단</p>
                <p className="lc-stage-big">20대 · 사회초년생</p>
                <p className="lc-stage-desc">카페·배달·구독 중심 소비 패턴. 저축 습관 형성 단계.</p>
              </div>
              <div className="lc-card-box lc-spending">
                <p className="lc-box-label">이번 달 소비 분석</p>
                <p className="lc-total">312,000<em>원</em></p>
                <div className="lc-bars">
                  {[
                    { label: '카페·음료', pct: 78, amount: 86000 },
                    { label: '배달·외식', pct: 54, amount: 62000 },
                    { label: '구독 서비스', pct: 38, amount: 41000 },
                    { label: '교통', pct: 24, amount: 28000 },
                  ].map((s, i) => (
                    <div key={i} className="lc-bar-row">
                      <span className="lc-bar-label">{s.label}</span>
                      <div className="lc-bar-track"><div className="lc-bar-fill" style={{ width: `${s.pct}%` }} /></div>
                      <span className="lc-bar-amt">{s.amount.toLocaleString()}원</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="lc-card-box lc-saving">
                <p className="lc-box-label">이 카드를 쓰면</p>
                <p className="lc-save-big">+24,000<em>원</em></p>
                <p className="lc-save-sub">이번 달 소비 기준 예상 절약액</p>
              </div>
            </div>
            {/* 샘플 켜진 혜택 */}
            <div className="lc-active">
              <h3 className="lc-active-title">✦ 이 소비 패턴에 켜지는 혜택</h3>
              <div className="lc-active-list">
                {[
                  { desc: '카페 20% 적립', reason: '카페·음료 지출 1위', saved: 17200 },
                  { desc: '배달앱 10% 적립', reason: '배달·외식 지출 2위', saved: 6200 },
                  { desc: '구독 서비스 5% 적립', reason: '구독 서비스 월정액 감지', saved: 2050 },
                ].map((b, i) => (
                  <div key={i} className="lc-active-item on">
                    <div className="lc-active-main">
                      <p className="lc-active-name">{b.desc}</p>
                      <p className="lc-active-why">📊 {b.reason}</p>
                    </div>
                    <p className="lc-active-saved">+{b.saved.toLocaleString()}원</p>
                  </div>
                ))}
                {[
                  { desc: '후불 교통카드 기본 제공' },
                  { desc: '해외결제 수수료 무료' },
                ].map((b, i) => (
                  <div key={`o${i}`} className="lc-active-item">
                    <div className="lc-active-main"><p className="lc-active-name">{b.desc}</p></div>
                    <p className="lc-active-tag">기본 제공</p>
                  </div>
                ))}
              </div>
            </div>
            {/* 로그인 CTA 배너 */}
            <div className="lc-demo-cta">
              <div className="lc-demo-cta-text">
                <p className="lc-demo-cta-title">내 실제 소비 데이터로 분석받고 싶다면?</p>
                <p className="lc-demo-cta-desc">로그인하면 내 소비 내역을 AI가 직접 분석해 켜지는 혜택을 실시간으로 보여드려요.</p>
              </div>
              <button className="lc-lock-btn" onClick={() => navigate('/login')}>로그인하고 내 리포트 보기</button>
            </div>
          </div>
        ) : loadingA ? (
          <div className="lc-loading"><div className="lc-spinner" /></div>
        ) : !analysis ? (
          <div className="lc-login-prompt"><p>소비 내역이 아직 없어요. 카드를 사용하면 분석이 시작됩니다.</p></div>
        ) : (
          <div className="lc-report-grid">

            {/* 생애단계 진단 */}
            <div className="lc-card-box lc-diagnosis">
              <p className="lc-box-label">생애단계 진단</p>
              <p className="lc-stage-big">
                {analysis.age ? `${analysis.age}세 · ` : ''}{analysis.stageLabel?.label}
              </p>
              <p className="lc-stage-desc">{analysis.stageLabel?.desc}</p>
            </div>

            {/* 이번 달 소비 분석 */}
            <div className="lc-card-box lc-spending">
              <p className="lc-box-label">이번 달 소비 분석</p>
              <p className="lc-total">{(analysis.totalSpend || 0).toLocaleString()}<em>원</em></p>
              <div className="lc-bars">
                {(analysis.spending || []).map((s, i) => (
                  <div key={i} className="lc-bar-row">
                    <span className="lc-bar-label">{s.label}</span>
                    <div className="lc-bar-track"><div className="lc-bar-fill" style={{ width: `${s.pct}%` }} /></div>
                    <span className="lc-bar-amt">{s.amount.toLocaleString()}원</span>
                  </div>
                ))}
                {(!analysis.spending || analysis.spending.length === 0) && (
                  <p className="lc-empty">이번 달 소비 내역이 없어요.</p>
                )}
              </div>
            </div>

            {/* 절약 요약 */}
            <div className="lc-card-box lc-saving">
              <p className="lc-box-label">이 카드를 쓰면</p>
              <p className="lc-save-big">+{(analysis.totalSaved || 0).toLocaleString()}<em>원</em></p>
              <p className="lc-save-sub">이번 달 소비 기준 예상 절약액</p>
            </div>
          </div>
        )}

        {/* 켜진 혜택 (See Why) */}
        {analysis && matched.length > 0 && (
          <div className="lc-active">
            <h3 className="lc-active-title">✦ 당신에게 켜진 혜택</h3>
            <div className="lc-active-list">
              {matched.map((b, i) => (
                <div key={i} className="lc-active-item on">
                  <div className="lc-active-main">
                    <p className="lc-active-name">{b.desc}</p>
                    {b.reason && <p className="lc-active-why">📊 {b.reason}</p>}
                  </div>
                  <p className="lc-active-saved">+{b.saved.toLocaleString()}원</p>
                </div>
              ))}
              {others.slice(0, 4).map((b, i) => (
                <div key={`o${i}`} className="lc-active-item">
                  <div className="lc-active-main"><p className="lc-active-name">{b.desc}</p></div>
                  <p className="lc-active-tag">기본 제공</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ── 생애단계별 혜택 (카드 설명) ── */}
      <section className="lc-stages-sec">
        <h2 className="lc-section-title">만 14세부터 시니어까지,<br />카드 하나로 평생</h2>
        <p className="lc-section-sub">생애 단계마다 소비가 달라지면 혜택도 따라 바뀝니다. 카드를 바꾸지 않아도 됩니다.</p>
        <div className="lc-loyalty-badges">
          <span>🎂 카드 생일 혜택</span>
          <span>🏅 10년 장기고객 추가 혜택</span>
          <span>💳 체크 → 신용 전환 특별 혜택</span>
          <span>👨‍👩‍👧 부모 알림 서비스</span>
        </div>
        <div className="lc-stage-grid">
          {stages.map((s, i) => (
            <div key={i} className="lc-stage-card">
              <span className="lc-stage-age">{s.age}</span>
              <p className="lc-stage-label">{s.label}</p>
              <ul className="lc-stage-benefits">
                {s.benefits.map((b, j) => <li key={j}>{b.desc}</li>)}
              </ul>
            </div>
          ))}
        </div>
        {common.length > 0 && (
          <div className="lc-common">
            <p className="lc-common-label">전 생애 공통</p>
            <div className="lc-common-list">
              {common.map((b, i) => <span key={i} className="lc-common-tag">{b.desc}</span>)}
            </div>
          </div>
        )}
      </section>

      {/* ── 하단 CTA ── */}
      <section className="lc-cta-sec">
        <h2 className="lc-cta-title">카드 고르는 데 시간 낭비하지 마세요.<br />평생 함께할 내 카드, 지금 만드세요</h2>
        <button className="lc-btn-white" onClick={() => navigate(card ? `/cards/${card.id}/apply` : '/login')}>
          이 카드 만들기
        </button>
      </section>

    </div>
  )
}
