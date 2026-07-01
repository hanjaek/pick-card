import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import './BenefitBuilderPage.css'

const FEE_TIERS = [
  { fee: 10000,  label: '10,000원', sub: '기본 혜택 1~2개', color: '#6B7280' },
  { fee: 30000,  label: '30,000원', sub: '일반 혜택 3~4개', color: '#2563EB', recommended: true },
  { fee: 50000,  label: '50,000원', sub: '프리미엄 5~6개', color: '#7C3AED' },
  { fee: 100000, label: '100,000원',sub: '모든 혜택 자유',  color: '#B45309' },
]

// 혜택 목록(POOL)은 하드코딩하지 않고 DB(benefit_catalog)에서 로드 — GET /api/life-card/benefit-catalog

function currentVal(b, tenureYear) {
  if (!b.growth?.length) return b.desc || ''
  let v = b.growth[0].val
  for (const t of b.growth) { if (tenureYear >= t.year) v = t.val }
  return v
}

const IconPlus = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
)

export default function BenefitBuilderPage() {
  const navigate   = useNavigate()
  const token      = localStorage.getItem('token')
  const [lifeMy,   setLifeMy]   = useState(null)
  const [POOL,     setPool]     = useState([])   // 혜택 카탈로그(DB에서 로드)
  const [loading,  setLoading]  = useState(true)

  const LS_FEE   = 'bnk_selected_fee'
  const LS_PICKS = 'bnk_selected_benefits'
  const [selectedFee, setSelectedFee] = useState(30000)
  const [picked,      setPicked]      = useState(new Set())
  const [shake,       setShake]       = useState(null)
  const [saved,       setSaved]       = useState(false)
  const [saving,      setSaving]      = useState(false)

  useEffect(() => {
    if (!token) { navigate('/login'); return }
    Promise.all([
      fetch('/api/life-card/my', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/life-card/benefit-catalog')
        .then(r => r.ok ? r.json() : []).catch(() => []),
    ]).then(([life, catalog]) => {
      setPool(Array.isArray(catalog) ? catalog : [])
      setLifeMy(life)
      if (life?.savedConfig) {
        setSelectedFee(life.savedConfig.selectedFee)
        setPicked(new Set(life.savedConfig.selectedBenefits))
      } else {
        const lsFee = Number(localStorage.getItem(LS_FEE)) || 30000
        const lsPicks = (() => { try { return JSON.parse(localStorage.getItem(LS_PICKS) || '[]') } catch { return [] } })()
        setSelectedFee(lsFee)
        setPicked(new Set(lsPicks))
      }
      setLoading(false)
    })
  }, [])

  const tenureYear = lifeMy?.membership?.tenureYear || 1

  const usedCost   = POOL.filter(b => picked.has(b.id)).reduce((s, b) => s + b.cost, 0)
  const remaining  = selectedFee - usedCost
  const pct        = Math.min(100, Math.round((usedCost / selectedFee) * 100))
  const pickedList = POOL.filter(b => picked.has(b.id))

  function toggle(b) {
    if (picked.has(b.id)) {
      setPicked(prev => { const n = new Set(prev); n.delete(b.id); return n })
    } else {
      if (usedCost + b.cost > selectedFee) {
        setShake(b.id); setTimeout(() => setShake(null), 500); return
      }
      setPicked(prev => new Set([...prev, b.id]))
    }
    setSaved(false)
  }

  function changeFee(fee) {
    setSelectedFee(fee); setSaved(false)
    let budget = fee; const next = new Set()
    for (const b of POOL) {
      if (picked.has(b.id) && budget >= b.cost) { next.add(b.id); budget -= b.cost }
    }
    setPicked(next)
  }

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/life-card/my/config', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ selectedFee, selectedBenefits: [...picked] }),
      })
      if (!res.ok) throw new Error('저장 실패')
      localStorage.setItem(LS_FEE,   String(selectedFee))
      localStorage.setItem(LS_PICKS, JSON.stringify([...picked]))
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch {
      alert('저장에 실패했습니다. 다시 시도해 주세요.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="bb-loading"><div className="bb-spinner" /></div>

  if (!lifeMy?.isHolder) return (
    <div className="bb-page">
      <div className="bb-inner">
        <div className="bb-locked">
          <p className="bb-locked-icon">🔒</p>
          <h2>BNK 라이프 평생 카드 전용 기능이에요</h2>
          <p>라이프 카드를 신청하면 연회비에 맞는 혜택을 직접 구성할 수 있어요</p>
          <Link to="/life-card" className="bb-cta-btn">라이프 카드 알아보기</Link>
        </div>
      </div>
    </div>
  )

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
            <span className="bb-hero-tag">평생카드 전용 · {tenureYear}년차</span>
            <h1 className="bb-hero-title">
              내가 고른 혜택,<br/>연차마다 할인율이 올라가요
            </h1>
            <p className="bb-hero-desc">
              일반 카드는 혜택이 처음부터 고정돼 있어요.<br/>
              라이프 카드는 연회비만큼 혜택을 직접 고르고,<br/>
              연차가 쌓일수록 할인율 자체가 높아져요.
            </p>
            <div className="bb-hero-pills">
              <span className="bb-pill">연회비 = 혜택 예산</span>
              <span className="bb-pill">연차마다 자동 업그레이드</span>
              <span className="bb-pill">언제든 재구성 가능</span>
            </div>
          </div>
          <div className="bb-hero-right">
            <div className="bb-preview-card">
              <div className="bb-preview-chip" />
              <span className="bb-preview-net">VISA</span>
              <div className="bb-preview-slots">
                {pickedList.slice(0, 4).map(b => (
                  <span key={b.id} className="bb-slot filled" style={{ background: b.color }}>{b.icon}</span>
                ))}
                {Array.from({ length: Math.max(0, 4 - pickedList.length) }).map((_, i) => (
                  <span key={i} className="bb-slot empty">+</span>
                ))}
              </div>
              <div className="bb-preview-info">
                <p className="bb-preview-brand">BNK LIFE</p>
                <p className="bb-preview-name">라이프 평생 카드</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── STEP 1: 연회비 ── */}
        <div className="bb-section">
          <div className="bb-step-label"><span className="bb-step-num">01</span>연회비를 선택하세요</div>
          <p className="bb-step-desc">연회비가 혜택 예산이 돼요. 높을수록 더 많은 혜택을 담을 수 있어요.</p>
          <div className="bb-fee-grid">
            {FEE_TIERS.map(t => (
              <button key={t.fee}
                className={`bb-fee-card ${selectedFee === t.fee ? 'active' : ''} ${t.recommended ? 'rec' : ''}`}
                onClick={() => changeFee(t.fee)}
              >
                {t.recommended && <span className="bb-rec-badge">추천</span>}
                <span className="bb-fee-num">{t.label}</span>
                <span className="bb-fee-desc">{t.sub}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── STEP 2: 예산 + 혜택 선택 ── */}
        <div className="bb-section">
          <div className="bb-step-label"><span className="bb-step-num">02</span>혜택을 골라서 예산을 채우세요</div>
          <p className="bb-step-desc">현재 연차({tenureYear}년차) 기준 할인율이 카드에 표시돼요.</p>

          {/* 예산 현황 */}
          <div className="bb-budget">
            <div className="bb-budget-top">
              <div className="bb-budget-nums">
                <span className="bb-used">{usedCost.toLocaleString()}원</span>
                <span className="bb-slash"> / </span>
                <span className="bb-total">{selectedFee.toLocaleString()}원</span>
              </div>
              <span className="bb-pct-big">{pct}%</span>
            </div>
            <div className="bb-bar-track">
              {pickedList.map(b => (
                <div key={b.id} className="bb-bar-seg"
                  style={{ width: `${(b.cost / selectedFee) * 100}%`, background: b.color, minWidth: 4 }}
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
                예산 100% 활용!
              </div>
            )}
          </div>

          {/* 혜택 카드 그리드 */}
          <div className="bb-grid">
            {POOL.map(b => {
              const isPicked  = picked.has(b.id)
              const wouldOver = !isPicked && (usedCost + b.cost > selectedFee)
              const costPct   = Math.round((b.cost / selectedFee) * 100)
              const val       = currentVal(b, tenureYear)
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
                  <p className="bb-card-val" style={{ color: isPicked ? b.color : '#3C3C43' }}>{val}</p>
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

        {/* ── STEP 3: 성장 미리보기 ── */}
        {pickedList.length > 0 && (
          <div className="bb-section">
            <div className="bb-step-label"><span className="bb-step-num">03</span>선택한 혜택이 이렇게 자라요</div>
            <p className="bb-step-desc">연차가 쌓이면 별도 신청 없이 할인율이 자동으로 높아져요.</p>
            <div className="bb-growth">
              {/* 헤더 */}
              <div className="bb-growth-head">
                <div />
                {[1, 3, 5].map(yr => (
                  <div key={yr} className={`bb-yr-head ${yr === tenureYear || (yr === 1 && tenureYear < 3) ? 'now' : ''}`}>
                    <span className="bb-yr">{yr}년차</span>
                    {((yr === 1 && tenureYear < 3) || yr === tenureYear) &&
                      <span className="bb-now-tag">현재</span>}
                  </div>
                ))}
              </div>
              {pickedList.map(b => (
                <div key={b.id} className="bb-growth-row">
                  <div className="bb-growth-name">
                    <span style={{ color: b.color }}>{b.icon}</span>
                    <span>{b.label}</span>
                  </div>
                  {b.growth.map((g, gi) => {
                    const reached = tenureYear >= g.year
                    const isNext  = !reached && (gi === 0 || tenureYear >= b.growth[gi - 1].year)
                    return (
                      <div key={g.year} className={`bb-growth-cell ${reached ? 'reached' : ''} ${isNext ? 'next' : ''}`}>
                        <span className="bb-gval" style={reached ? { color: b.color } : {}}>{g.val}</span>
                        {gi > 0 && reached && <span className="bb-up">↑</span>}
                        {isNext && <span className="bb-next-tag">다음 목표</span>}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 저장 ── */}
        <div className="bb-footer">
          <p className="bb-footer-info">
            {pickedList.length > 0
              ? `${pickedList.length}개 혜택 선택 · 연회비 ${selectedFee.toLocaleString()}원`
              : '혜택을 골라보세요'}
          </p>
          <button className={`bb-save ${saved ? 'done' : ''}`} onClick={save} disabled={pickedList.length === 0 || saving}>
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
