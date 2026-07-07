import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LIFE_CARD_GROWTH, currentLifeCardTier } from '../constants/lifeCardBenefit'
import './LifeCard.css'

/* BNK 영원카드 — 상세 설명 + AI 소비 분석 + 발급(테스트: 신분증 생략) */

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
          <img
            src="/cards/card-25.jpeg"
            alt="BNK 영원카드"
            className="lc-card-img"
          />
        </div>

        <div className="lc-hero-text">
          <p className="lc-eyebrow">BNK 영원카드</p>
          <h1 className="lc-title">고르지 마세요.<br />AI가 평생 챙겨드립니다.</h1>
          <p className="lc-desc">
            전 가맹점 기본 0.5% 자동 할인, 별도 신청 없이 연차가 쌓일수록<br />
            할인율이 최대 1.6%까지 자동으로 올라가는 신용카드예요.
          </p>
          <ul className="lc-quick">
            <li>전 가맹점 자동 할인</li>
            <li>연회비 15,000원 고정</li>
            <li>연차마다 할인율 UP</li>
            <li>AI 소비 분석 제공</li>
          </ul>
          <button
            className="lc-btn-primary"
            onClick={() => navigate(card ? `/cards/${card.id}/apply` : `/login?redirect=${encodeURIComponent('/life-card')}`)}
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
              <button className="lc-lock-btn" onClick={() => navigate(`/login?redirect=${encodeURIComponent('/life-card')}`)}>로그인하고 내 리포트 보기</button>
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

      {/* ── 연차별 자동 할인 ── */}
      <section className="lc-builder-sec">
        <div className="lc-builder-head">
          <span className="lc-badge-builder">전 가맹점 자동 할인</span>
          <h2 className="lc-section-title" style={{ marginTop: 12 }}>고르지 않아도,<br />연차가 쌓일수록 할인율이 올라가요</h2>
          <p className="lc-section-sub">전 가맹점에 동일하게 적용되는 자동 할인이에요. 신청이나 변경 없이 연차에 맞춰 자동으로 올라갑니다.</p>
        </div>
        <div className="lc-benefit-grid">
          {LIFE_CARD_GROWTH.map((t, i) => {
            const isCurrent = analysis?.membership && currentLifeCardTier(analysis.membership.tenureYear).year === t.year
            return (
              <div key={i} className={`lc-benefit-tile${isCurrent ? ' current' : ''}`}>
                {isCurrent && <span className="lc-tile-current-tag">현재</span>}
                <span className="lc-tile-icon">{i === 0 ? '🎉' : '📈'}</span>
                <p className="lc-tile-label">{t.label}</p>
                <p className="lc-tile-desc">{t.rate}% 할인</p>
                <p className="lc-tile-grow">월 한도 {t.cap.toLocaleString()}원</p>
              </div>
            )
          })}
        </div>
        <div className="lc-builder-cta">
          <p className="lc-builder-cta-text">연회비 15,000원 · 전 가맹점 공통 적용 · 20년차 최대 1.6%</p>
        </div>
      </section>

      {/* ── 생애단계별 혜택 (카드 설명) ── */}
      <section className="lc-stages-sec">
        <h2 className="lc-section-title">만 14세부터 시니어까지,<br />카드 하나로 평생</h2>
        <p className="lc-section-sub">생애 단계마다 소비가 달라지면 혜택도 따라 바뀝니다. 카드를 바꾸지 않아도 됩니다.</p>
        <div className="lc-loyalty-badges">
          <span>🎂 카드 생일 혜택</span>
          <span>🏅 10년 장기고객 추가 혜택</span>
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
        <button className="lc-btn-white" onClick={() => navigate(card ? `/cards/${card.id}/apply` : `/login?redirect=${encodeURIComponent('/life-card')}`)}>
          이 카드 만들기
        </button>
      </section>

    </div>
  )
}
