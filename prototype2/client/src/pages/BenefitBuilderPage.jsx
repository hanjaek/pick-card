import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { LIFE_CARD_GROWTH, currentLifeCardTier, nextLifeCardTier, currentSimpleRate } from '../constants/lifeCardBenefit'
import './BenefitBuilderPage.css'

const IconPlus = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
)

export default function BenefitBuilderPage() {
  const navigate   = useNavigate()
  const location   = useLocation()
  const token      = localStorage.getItem('token')
  const [lifeMy,   setLifeMy]   = useState(null)
  const [POOL,     setPool]     = useState([])   // 혜택 카탈로그(DB에서 로드)
  const [loading,  setLoading]  = useState(true)

  const LS_PICKS = 'bnk_selected_benefits'
  const LS_MODE  = 'bnk_benefit_mode'
  const [picked,      setPicked]      = useState(new Set())
  const [mode,        setMode]        = useState(() => localStorage.getItem(LS_MODE) || 'custom')
  const [shake,       setShake]       = useState(null)
  const [saved,       setSaved]       = useState(false)
  const [saving,      setSaving]      = useState(false)

  useEffect(() => {
    if (!token) { navigate(`/login?redirect=${encodeURIComponent(location.pathname)}`); return }
    Promise.all([
      fetch('/api/life-card/my', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/life-card/benefit-catalog')
        .then(r => r.ok ? r.json() : []).catch(() => []),
    ]).then(([life, catalog]) => {
      const pool = Array.isArray(catalog) ? catalog : []
      setPool(pool)
      setLifeMy(life)
      const saved = life?.savedConfig?.selectedBenefits
      if (saved && saved.length > 0 && saved.length === pool.length) {
        // 전 카테고리가 저장돼 있으면 "편하게" 모드로 저장했던 것 — 개별 선택은 비워둠
        setMode('simple')
        localStorage.setItem(LS_MODE, 'simple')
        setPicked(new Set())
      } else if (saved && saved.length > 0) {
        // 일부만 저장돼 있으면 "직접 선택" 모드 — 그 선택을 그대로 복원
        setMode('custom')
        localStorage.setItem(LS_MODE, 'custom')
        setPicked(new Set(saved))
      } else {
        const lsPicks = (() => { try { return JSON.parse(localStorage.getItem(LS_PICKS) || '[]') } catch { return [] } })()
        setPicked(new Set(lsPicks))
      }
      setLoading(false)
    })
  }, [])

  if (loading) return <div className="bb-loading"><div className="bb-spinner" /></div>

  if (!lifeMy?.isHolder) return (
    <div className="bb-page">
      <div className="bb-inner">
        <div className="bb-locked">
          <p className="bb-locked-icon">🔒</p>
          <h2>BNK 영원카드 전용 기능이에요</h2>
          <p>BNK 영원카드를 신청하면 받을 수 있는 한도에 맞춰 원하는 혜택을 직접 고를 수 있어요</p>
          <Link to="/life-card" className="bb-cta-btn">BNK 영원카드 알아보기</Link>
        </div>
      </div>
    </div>
  )

  const tenureYear = lifeMy?.membership?.tenureYear || 0
  const tier       = currentLifeCardTier(tenureYear)
  const next       = nextLifeCardTier(tenureYear)
  const budget     = tier.cap   // 예산 = 연회비가 아니라 "현재 연차의 월 할인한도"

  const usedCost   = POOL.filter(b => picked.has(b.id)).reduce((s, b) => s + b.cost, 0)
  const remaining  = budget - usedCost
  const pct        = Math.min(100, Math.round((usedCost / budget) * 100))
  const pickedList = POOL.filter(b => picked.has(b.id))

  function toggle(b) {
    if (picked.has(b.id)) {
      setPicked(prev => { const n = new Set(prev); n.delete(b.id); return n })
    } else {
      if (usedCost + b.cost > budget) {
        setShake(b.id); setTimeout(() => setShake(null), 500); return
      }
      setPicked(prev => new Set([...prev, b.id]))
    }
    setSaved(false)
  }

  function changeMode(next) {
    setMode(next)
    localStorage.setItem(LS_MODE, next)
    setSaved(false)
  }

  async function save() {
    setSaving(true)
    try {
      const benefitsToSave = mode === 'simple' ? POOL.map(b => b.id) : [...picked]
      const res = await fetch('/api/life-card/my/config', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ selectedFee: budget, selectedBenefits: benefitsToSave }),
      })
      if (!res.ok) throw new Error('저장 실패')
      localStorage.setItem(LS_PICKS, JSON.stringify([...picked]))
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch {
      alert('저장에 실패했습니다. 다시 시도해 주세요.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bb-page">
      <div className="bb-inner">

        {/* ── 상단 내비 ── */}
        <div className="bb-nav">
          <Link to="/mypage" className="bb-back">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M13 4L7 10L13 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            마이페이지로
          </Link>
          <div className="bb-nav-title">혜택 구성</div>
          <div style={{ width: 80 }} />
        </div>

        {/* ── 히어로 ── */}
        <div className="bb-hero">
          <div className="bb-hero-left">
            <h1 className="bb-hero-title">
              연회비는 고정,<br/>혜택은 한도 안에서 직접 골라요
            </h1>
            <p className="bb-hero-desc">
              연회비 15,000원은 정해져 있어요. 대신 가입 연차가 쌓일수록<br/>
              월 할인한도가 늘어나서, 그만큼 더 많은 혜택을 담을 수 있어요.
            </p>
            <div className="bb-hero-pills">
              <span className="bb-pill">연회비 15,000원 고정</span>
              <span className="bb-pill">한도 = 연차마다 자동 증가</span>
              <span className="bb-pill">언제든 재구성 가능</span>
            </div>
          </div>
          <div className="bb-hero-right">
            <div className="bb-preview-card">
              <img src="/cards/card-25.jpeg" alt="BNK 영원카드" className="bb-preview-img" />
            </div>
            <p className="bb-preview-name">BNK 영원카드</p>
            {pickedList.length > 0 && (
              <div className="bb-preview-slots">
                {pickedList.slice(0, 4).map(b => (
                  <span key={b.id} className="bb-slot filled" style={{ background: b.color }}>{b.icon}</span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── 현재 한도 안내 ── */}
        <div className="bb-section">
          <div className="bb-step-label">지금 내 월 할인한도 ({tenureYear}년차)</div>
          {next && (
            <p className="bb-step-desc">
              {next.year}년차가 되면 한도가 {next.cap.toLocaleString()}원으로 늘어나요 (앞으로 {next.year - tenureYear}년 남음)
            </p>
          )}
        </div>

        {/* ── 방식 선택 ── */}
        <div className="bb-section">
          <div className="bb-step-label">혜택을 어떻게 받으시겠어요?</div>
          <div className="bb-mode-row">
            <button className={`bb-mode-btn ${mode === 'simple' ? 'active' : ''}`} onClick={() => changeMode('simple')}>
              <span className="bb-mode-pct">{currentSimpleRate(tenureYear)}%</span>
              <span className="bb-mode-name">편하게 할게요</span>
              <span className="bb-mode-info">고르지 않고 전 카테고리 자동 적용 · 할인율은 낮아요</span>
            </button>
            <button className={`bb-mode-btn ${mode === 'custom' ? 'active' : ''}`} onClick={() => changeMode('custom')}>
              <span className="bb-mode-pct">{tier.rate}%</span>
              <span className="bb-mode-name">직접 골라볼게요</span>
              <span className="bb-mode-info">한도 안에서 원하는 카테고리만 · 할인율은 정상</span>
            </button>
          </div>
        </div>

        {/* 편하게: 전체 카테고리 자동 확인 */}
        {mode === 'simple' && (
          <div className="bb-section">
            <div className="bb-auto-confirm">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="10" r="10" fill="#22C55E"/>
                <path d="M5.5 10.5L8.5 13.5L14.5 7" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <div>
                <p className="bb-auto-confirm-title">전 카테고리에 {currentSimpleRate(tenureYear)}% 자동 할인이 적용돼요</p>
                <p className="bb-auto-confirm-desc">카테고리를 고를 필요 없이 모든 소비에 자동으로 적용돼요.</p>
              </div>
            </div>
          </div>
        )}

        {/* 직접 선택: 한도 안에서 혜택 고르기 */}
        {mode === 'custom' && (
          <div className="bb-section">
            <div className="bb-step-label">한도 안에서 혜택을 골라보세요</div>
            <p className="bb-step-desc">고른 혜택은 모두 현재 할인율 {tier.rate}%가 동일하게 적용돼요.</p>

            {/* 한도 현황 */}
            <div className="bb-budget">
              <div className="bb-budget-top">
                <div className="bb-budget-nums">
                  <span className="bb-used">{usedCost.toLocaleString()}원</span>
                  <span className="bb-slash"> / </span>
                  <span className="bb-total">{budget.toLocaleString()}원</span>
                </div>
                <span className="bb-pct-big">{pct}%</span>
              </div>
              <div className="bb-bar-track">
                {pickedList.map(b => (
                  <div key={b.id} className="bb-bar-seg"
                    style={{ width: `${(b.cost / budget) * 100}%`, background: b.color, minWidth: 4 }}
                    title={`${b.label}: ${b.cost.toLocaleString()}원`}
                  />
                ))}
              </div>
              <div className="bb-bar-legend">
                {pickedList.map(b => (
                  <span key={b.id} style={{ color: b.color }}>{b.icon} {b.label}</span>
                ))}
                {remaining > 0 && <span className="bb-remain">잔여 {remaining.toLocaleString()}원</span>}
              </div>
              {pct >= 100 && (
                <div className="bb-full-badge">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="7" fill="#22C55E"/><path d="M3.5 7L6 9.5L10.5 5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  한도 100% 활용!
                </div>
              )}
            </div>

            {/* 혜택 카드 그리드 */}
            <div className="bb-grid">
              {POOL.map(b => {
                const isPicked  = picked.has(b.id)
                const wouldOver = !isPicked && (usedCost + b.cost > budget)
                const costPct   = Math.round((b.cost / budget) * 100)
                return (
                  <button key={b.id}
                    className={`bb-card ${isPicked ? 'on' : ''} ${wouldOver ? 'dim' : ''} ${shake === b.id ? 'shake' : ''}`}
                    style={isPicked ? { borderColor: b.color, boxShadow: `0 0 0 3px ${b.color}18` } : {}}
                    onClick={() => toggle(b)}
                  >
                    <div className="bb-card-top">
                      <span className="bb-icon">{b.icon}</span>
                      {isPicked
                        ? <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                            <circle cx="10" cy="10" r="10" fill={b.color}/>
                            <path d="M5.5 10.5L8.5 13.5L14.5 7.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        : <span className={`bb-add ${wouldOver ? 'over' : ''}`}><IconPlus /></span>
                      }
                    </div>
                    <p className="bb-card-label">{b.label}</p>
                    <p className="bb-card-val" style={{ color: isPicked ? b.color : '#3C3C43' }}>{tier.rate}% 할인</p>
                    <p className="bb-card-note">{b.note}</p>
                    <div className="bb-card-foot">
                      <span className="bb-cost">{b.cost.toLocaleString()}원</span>
                      <span className={`bb-cpct ${wouldOver ? 'over' : ''}`}>{costPct}%</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* ── 전체 연차별 한도 테이블 ── */}
        <div className="bb-section">
          <div className="bb-step-label">가입 연차별 할인율 · 한도</div>
          <div className="bb-growth">
            <div className="bb-growth-head tiers5">
              <div />
              {LIFE_CARD_GROWTH.map(t => (
                <div key={t.year} className={`bb-yr-head ${t.year === tier.year ? 'now' : ''}`}>
                  <span className="bb-yr">{t.label}</span>
                  {t.year === tier.year && <span className="bb-now-tag">현재</span>}
                </div>
              ))}
            </div>
            <div className="bb-growth-row tiers5">
              <div className="bb-growth-name"><span>💳</span><span>할인율 · 한도</span></div>
              {LIFE_CARD_GROWTH.map(t => {
                const reached = tenureYear >= t.year
                return (
                  <div key={t.year} className={`bb-growth-cell ${reached ? 'reached' : ''}`}>
                    <span className="bb-gval" style={reached ? { color: '#D71919' } : {}}>{t.rate}%</span>
                    <span className="bb-growth-cap">한도 {(t.cap / 1000).toLocaleString()}천원</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── 저장 ── */}
        <div className="bb-footer">
          <p className="bb-footer-info">
            {mode === 'simple'
              ? `전 카테고리 자동 · ${currentSimpleRate(tenureYear)}% 할인`
              : pickedList.length > 0
                ? `${pickedList.length}개 혜택 선택 · 한도 ${budget.toLocaleString()}원 중 ${usedCost.toLocaleString()}원 사용`
                : '혜택을 골라보세요'}
          </p>
          <button className={`bb-save ${saved ? 'done' : ''}`} onClick={save} disabled={(mode === 'custom' && pickedList.length === 0) || saving}>
            {saved
              ? <><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="8" fill="#22C55E"/><path d="M4.5 8.5L7 11L11.5 6" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg> 저장 완료!</>
              : saving ? '저장 중...' : '내 혜택 구성 저장하기'
            }
          </button>
        </div>

      </div>
    </div>
  )
}
