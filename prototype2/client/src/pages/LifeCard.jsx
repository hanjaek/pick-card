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
          <p className="lc-desc">{card?.feature || '어릴 때부터 노년까지, 하나의 카드로 평생. AI가 나이와 소비를 분석해 생애 단계마다 혜택을 자동으로 바꿔줍니다.'}</p>
          <ul className="lc-quick">
            <li>연회비 평생 무료</li>
            <li>후불 교통카드</li>
            <li>나이·소비 맞춤 자동 혜택</li>
          </ul>
          {!issued ? (
            <button className="lc-btn-primary" onClick={() => setIssued(true)}>이 카드 만들기</button>
          ) : (
            <div className="lc-issued">
              <p className="lc-issued-title">🎉 BNK 라이프 카드 발급 완료!</p>
              <p className="lc-issued-sub">테스트 모드 — 신분증 확인 절차는 생략되었습니다.</p>
              <button className="lc-btn-ghost" onClick={() => navigate('/mypage')}>마이페이지로</button>
            </div>
          )}
        </div>
      </section>

      {/* ── AI 소비 분석 리포트 ── */}
      <section className="lc-report">
        <div className="lc-report-head">
          <span className="lc-badge-ai">AI 소비 분석</span>
          <h2 className="lc-report-title">내 소비를 분석해, 켜질 혜택을 미리 보여드려요</h2>
        </div>

        {!token ? (
          <div className="lc-login-prompt">
            <p>로그인하면 <strong>내 소비 패턴 분석</strong>과 <strong>나에게 켜지는 혜택</strong>을 바로 확인할 수 있어요.</p>
            <button className="lc-btn-primary" onClick={() => navigate('/login')}>로그인하고 분석 받기</button>
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
        <h2 className="lc-section-title">나이에 따라, 혜택이 자랍니다</h2>
        <p className="lc-section-sub">하나의 카드로 평생 — AI가 생애 단계마다 혜택을 자동으로 바꿔드려요.</p>
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
        <h2 className="lc-cta-title">평생 함께할 내 카드, 지금 만드세요</h2>
        {!issued && (
          <button className="lc-btn-white" onClick={() => { setIssued(true); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>
            이 카드 만들기
          </button>
        )}
      </section>

    </div>
  )
}
