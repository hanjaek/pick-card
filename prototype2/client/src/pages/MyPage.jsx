import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import './MyPage.css'

/* ── 소비 분석용 카테고리 ── */
const CAT_LABEL = {
  CAFE: '카페·디저트', TRANSPORT: '대중교통', SHOPPING: '쇼핑·마트',
  TELECOM: '통신요금',  CULTURE:   '영화·문화', PAY:      '간편결제',
  FOOD:    '식비·외식', MEDICAL:   '의료·건강',
}
const CAT_ORDER = ['CAFE', 'TRANSPORT', 'SHOPPING', 'TELECOM', 'CULTURE', 'PAY']
const CAT_META  = {
  CAFE:      { icon: '☕', keywords: ['카페', '편의점', '커피'] },
  TRANSPORT: { icon: '🚌', keywords: ['대중교통', '버스', '지하철', '교통'] },
  SHOPPING:  { icon: '🛍', keywords: ['마트', '쇼핑', '쿠팡'] },
  TELECOM:   { icon: '📱', keywords: ['통신', '휴대폰'] },
  CULTURE:   { icon: '🎬', keywords: ['영화', '문화', '공연'] },
  PAY:       { icon: '💳', keywords: ['간편결제', '페이'] },
}

/* ── 혜택 구성 데이터 ── */
const FEE_TIERS = [
  { fee: 10000,  label: '10,000원', sub: '기본 혜택 2개',  color: '#6B7280' },
  { fee: 30000,  label: '30,000원', sub: '일반 혜택 3~4개', color: '#2563EB', recommended: true },
  { fee: 50000,  label: '50,000원', sub: '프리미엄 5~6개', color: '#7C3AED' },
  { fee: 100000, label: '100,000원',sub: '모든 혜택 자유', color: '#B45309' },
]

const BENEFIT_POOL = [
  { id: 'transport', icon: '🚌', label: '대중교통',    desc: '3% 할인',          note: '월 최대 2,000원',   cost: 5000,  color: '#2563EB' },
  { id: 'pay',       icon: '💳', label: '간편결제',    desc: '1% 적립',          note: '월 최대 1,500원',   cost: 4000,  color: '#0891B2' },
  { id: 'cafe',      icon: '☕', label: '카페·편의점', desc: '5% 적립',          note: '월 최대 3,000원',   cost: 8000,  color: '#D97706' },
  { id: 'shopping',  icon: '🛍', label: '온라인쇼핑', desc: '2% 캐시백',        note: '월 최대 4,000원',   cost: 10000, color: '#7C3AED' },
  { id: 'medical',   icon: '💊', label: '약국·의료',  desc: '5% 할인',          note: '월 최대 2,000원',   cost: 7000,  color: '#059669' },
  { id: 'telecom',   icon: '📱', label: '통신요금',   desc: '월 2,000원 할인',  note: '자동 적용',          cost: 12000, color: '#DC2626' },
  { id: 'delivery',  icon: '🛵', label: '배달앱',     desc: '3% 할인',          note: '월 최대 3,000원',   cost: 15000, color: '#EA580C' },
  { id: 'culture',   icon: '🎬', label: '영화·문화',  desc: '월 1회 50% 할인',  note: '최대 7,000원',       cost: 20000, color: '#9333EA' },
]

function calcSavings(benefits = [], spending = []) {
  let total = 0
  for (const b of benefits) {
    const rate = parseFloat(b.discountRate) || 0
    if (!rate) continue
    for (const cat of spending) {
      if ((cat.keywords || []).some(k => (b.desc || '').includes(k))) {
        total += Math.min(cat.amount * (rate / 100), b.monthlyLimit ? Number(b.monthlyLimit) : Infinity)
        break
      }
    }
  }
  return Math.round(total)
}

const IconCheck = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <circle cx="8" cy="8" r="8" fill="#22C55E"/>
    <path d="M4.5 8.5L7 11L11.5 6" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)
const IconWarn = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <circle cx="8" cy="8" r="8" fill="#F59E0B" fillOpacity=".15"/>
    <circle cx="8" cy="8" r="7.5" stroke="#F59E0B" strokeWidth="1"/>
    <path d="M8 5V8.5" stroke="#F59E0B" strokeWidth="1.5" strokeLinecap="round"/>
    <circle cx="8" cy="11" r=".8" fill="#F59E0B"/>
  </svg>
)
const IconPlus = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <path d="M9 4V14M4 9H14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
)

/* ════════════════════════════════════════════════
   혜택 구성 탭
   ════════════════════════════════════════════════ */
function BenefitBuilder() {
  const LS_FEE    = 'bnk_selected_fee'
  const LS_PICKS  = 'bnk_selected_benefits'

  const [selectedFee,   setSelectedFee]   = useState(() => Number(localStorage.getItem(LS_FEE)) || 30000)
  const [picked,        setPicked]         = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(LS_PICKS) || '[]')) }
    catch { return new Set() }
  })
  const [shake,         setShake]         = useState(null)
  const [saved,         setSaved]         = useState(false)

  const usedCost   = BENEFIT_POOL.filter(b => picked.has(b.id)).reduce((s, b) => s + b.cost, 0)
  const remaining  = selectedFee - usedCost
  const pct        = Math.min(100, Math.round((usedCost / selectedFee) * 100))

  function toggleBenefit(b) {
    if (picked.has(b.id)) {
      setPicked(prev => { const n = new Set(prev); n.delete(b.id); return n })
    } else {
      if (usedCost + b.cost > selectedFee) {
        setShake(b.id)
        setTimeout(() => setShake(null), 500)
        return
      }
      setPicked(prev => new Set([...prev, b.id]))
    }
    setSaved(false)
  }

  function changeFee(fee) {
    setSelectedFee(fee)
    setSaved(false)
    // 예산 초과 혜택 자동 해제
    let budget = fee
    const newPicked = new Set()
    for (const b of BENEFIT_POOL) {
      if (picked.has(b.id) && budget >= b.cost) {
        newPicked.add(b.id)
        budget -= b.cost
      }
    }
    setPicked(newPicked)
  }

  function save() {
    localStorage.setItem(LS_FEE,   String(selectedFee))
    localStorage.setItem(LS_PICKS, JSON.stringify([...picked]))
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const pickedList = BENEFIT_POOL.filter(b => picked.has(b.id))

  return (
    <div className="bb-root">

      {/* ── 연회비 선택 ── */}
      <div className="bb-section">
        <div className="bb-section-head">
          <h2 className="bb-section-title">연회비 선택</h2>
          <p className="bb-section-sub">연회비가 혜택 예산이 돼요. 연회비만큼 혜택을 고를 수 있어요.</p>
        </div>
        <div className="bb-fee-grid">
          {FEE_TIERS.map(t => (
            <button
              key={t.fee}
              className={`bb-fee-card ${selectedFee === t.fee ? 'selected' : ''} ${t.recommended ? 'recommended' : ''}`}
              onClick={() => changeFee(t.fee)}
            >
              {t.recommended && <span className="bb-rec-tag">추천</span>}
              <span className="bb-fee-amt">{t.label}</span>
              <span className="bb-fee-sub">{t.sub}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── 예산 현황 ── */}
      <div className="bb-budget-card">
        <div className="bb-budget-row">
          <div>
            <p className="bb-budget-label">혜택 예산 사용 현황</p>
            <p className="bb-budget-num">
              <span className="bb-budget-used">{usedCost.toLocaleString()}원</span>
              <span className="bb-budget-sep"> / </span>
              <span className="bb-budget-total">{selectedFee.toLocaleString()}원</span>
            </p>
          </div>
          <div className="bb-budget-pct-wrap">
            <svg width="56" height="56" viewBox="0 0 56 56">
              <circle cx="28" cy="28" r="23" fill="none" stroke="#F2F3F5" strokeWidth="6"/>
              <circle cx="28" cy="28" r="23" fill="none"
                stroke={pct >= 100 ? '#22C55E' : pct >= 70 ? '#F59E0B' : 'var(--bnk-red)'}
                strokeWidth="6"
                strokeDasharray={`${2 * Math.PI * 23}`}
                strokeDashoffset={`${2 * Math.PI * 23 * (1 - pct / 100)}`}
                strokeLinecap="round"
                transform="rotate(-90 28 28)"
                style={{ transition: 'stroke-dashoffset .5s ease, stroke .3s' }}
              />
              <text x="28" y="33" textAnchor="middle" fontSize="13" fontWeight="700"
                fill={pct >= 100 ? '#22C55E' : '#1C1C1E'}>{pct}%</text>
            </svg>
          </div>
        </div>

        {/* 스택형 진행바 */}
        <div className="bb-stack-bar">
          {pickedList.map(b => (
            <div
              key={b.id}
              className="bb-stack-seg"
              style={{
                width: `${(b.cost / selectedFee) * 100}%`,
                background: b.color,
                minWidth: 4,
              }}
              title={`${b.label}: ${b.cost.toLocaleString()}원`}
            />
          ))}
          <div className="bb-stack-empty" style={{ flex: 1 }} />
        </div>
        <div className="bb-stack-labels">
          {pickedList.map(b => (
            <span key={b.id} className="bb-stack-label" style={{ color: b.color }}>
              {b.icon} {b.label} {b.cost.toLocaleString()}원
            </span>
          ))}
          {remaining > 0 && (
            <span className="bb-stack-label-gray">잔여 {remaining.toLocaleString()}원</span>
          )}
        </div>

        {pct >= 100 && (
          <div className="bb-full-msg">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="8" fill="#22C55E"/><path d="M4.5 8.5L7 11L11.5 6" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            예산을 100% 활용했어요!
          </div>
        )}
      </div>

      {/* ── 혜택 선택 ── */}
      <div className="bb-section">
        <div className="bb-section-head">
          <h2 className="bb-section-title">혜택 고르기</h2>
          <p className="bb-section-sub">원하는 혜택을 골라서 예산을 채워보세요</p>
        </div>
        <div className="bb-benefit-grid">
          {BENEFIT_POOL.map(b => {
            const isPicked   = picked.has(b.id)
            const wouldOver  = !isPicked && (usedCost + b.cost > selectedFee)
            const costPct    = Math.round((b.cost / selectedFee) * 100)
            return (
              <button
                key={b.id}
                className={`bb-benefit-card
                  ${isPicked   ? 'picked'   : ''}
                  ${wouldOver  ? 'disabled' : ''}
                  ${shake === b.id ? 'shake' : ''}
                `}
                onClick={() => toggleBenefit(b)}
                disabled={false}
              >
                <div className="bb-benefit-top">
                  <span className="bb-benefit-icon">{b.icon}</span>
                  {isPicked && (
                    <span className="bb-check-wrap">
                      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                        <circle cx="9" cy="9" r="9" fill={b.color}/>
                        <path d="M5 9.5L7.5 12L13 7" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </span>
                  )}
                  {!isPicked && (
                    <span className={`bb-plus-wrap ${wouldOver ? 'over' : ''}`}>
                      <IconPlus />
                    </span>
                  )}
                </div>
                <p className="bb-benefit-label">{b.label}</p>
                <p className="bb-benefit-desc">{b.desc}</p>
                <p className="bb-benefit-note">{b.note}</p>
                <div className="bb-benefit-cost-row">
                  <span className="bb-cost-amt" style={{ color: isPicked ? b.color : undefined }}>
                    {b.cost.toLocaleString()}원
                  </span>
                  <span className={`bb-cost-pct ${wouldOver ? 'over' : ''}`}>
                    {costPct}%
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── 저장 ── */}
      <div className="bb-save-row">
        <button className={`bb-save-btn ${saved ? 'saved' : ''}`} onClick={save}>
          {saved
            ? <><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="8" fill="#22C55E"/><path d="M4.5 8.5L7 11L11.5 6" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg> 저장 완료</>
            : `혜택 구성 저장하기 (${pickedList.length}개 선택)`
          }
        </button>
      </div>

    </div>
  )
}

/* ════════════════════════════════════════════════
   메인
   ════════════════════════════════════════════════ */
export default function MyPage() {
  const navigate = useNavigate()
  const token    = localStorage.getItem('token')
  const userName = localStorage.getItem('userName') || '회원'

  const [tab,      setTab]      = useState('analysis')
  const [allCards, setAllCards] = useState([])
  const [applied,  setApplied]  = useState([])
  const [spending, setSpending] = useState([])
  const [lifeMy,   setLifeMy]   = useState(null)
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    if (!token) { navigate('/login'); return }
    const auth = { headers: { Authorization: `Bearer ${token}` } }
    Promise.all([
      fetch('/api/cards').then(r => r.json()),
      fetch('/api/applications/me', auth).then(r => r.json()),
      fetch('/api/mypage/spending', auth).then(r => r.json()),
      fetch('/api/life-card/my', auth).then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([cards, apps, spend, life]) => {
      setAllCards(Array.isArray(cards) ? cards : [])
      setApplied(Array.isArray(apps)  ? apps  : [])
      setLifeMy(life)
      const byKey = {}
      ;(Array.isArray(spend) ? spend : []).forEach(s => { byKey[s.category] = Number(s.amount) })
      setSpending(
        CAT_ORDER
          .map(cd => ({ cd, label: CAT_LABEL[cd] || cd, icon: CAT_META[cd]?.icon || '•', keywords: CAT_META[cd]?.keywords || [], amount: byKey[cd] || 0 }))
          .filter(c => c.amount > 0)
      )
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="mp-loading"><div className="mp-spinner" /></div>

  const total    = spending.reduce((s, c) => s + c.amount, 0)
  const maxAmt   = Math.max(1, ...spending.map(c => c.amount))
  const benefits = (lifeMy?.active || []).filter(b => b.category)
  const used     = benefits.filter(b => b.matched)
  const missed   = benefits.filter(b => !b.matched)
  const saved    = lifeMy?.totalSaved ?? used.reduce((s, b) => s + (b.saved || 0), 0)
  const nextUp   = lifeMy?.nextUpgrade

  const appliedIds = new Set(applied.map(a => a.cardId))
  const myCards    = allCards.filter(c => appliedIds.has(c.id))
  const opps       = allCards
    .filter(c => !appliedIds.has(c.id))
    .map(c => ({ ...c, savings: calcSavings(c.benefits, spending) }))
    .filter(c => c.savings > 0)
    .sort((a, b) => b.savings - a.savings)
    .slice(0, 2)

  const now    = new Date()
  const period = `${now.getFullYear()}년 ${now.getMonth() + 1}월`

  return (
    <div className="mp-page">
      <div className="mp-inner">

        {/* ── 페이지 헤더 ── */}
        <div className="mp-page-header">
          <div>
            <h1 className="mp-page-title">{userName}님의 BNK 라이프 카드</h1>
            <p className="mp-page-sub">{period} · 소비 분석 및 혜택 관리</p>
          </div>
          {lifeMy?.isHolder && (
            <div className="mp-tenure-tag">
              {lifeMy.membership?.tenureYear || 1}년차 · {lifeMy.stageLabel?.label || ''}
            </div>
          )}
        </div>

        {/* ── 탭 (라이프 카드 보유자만 혜택 구성 탭 노출) ── */}
        <div className="mp-tabs">
          <button className={`mp-tab ${tab === 'analysis' ? 'active' : ''}`} onClick={() => setTab('analysis')}>
            소비 분석
          </button>
          {lifeMy?.isHolder && (
            <button className={`mp-tab ${tab === 'builder' ? 'active' : ''}`} onClick={() => setTab('builder')}>
              혜택 구성
            </button>
          )}
        </div>

        {/* ════════ 소비 분석 탭 ════════ */}
        {tab === 'analysis' && (
          <>
            {/* 상단 요약 바 */}
            <div className="mp-summary-bar">
              <div className="mp-summary-main">
                <p className="mp-summary-label">이달 절약한 금액</p>
                <p className="mp-summary-num">
                  {saved > 0 ? saved.toLocaleString() : '0'}
                  <span className="mp-summary-unit">원</span>
                </p>
              </div>
              <div className="mp-summary-divider" />
              <div className="mp-summary-stats">
                <div className="mp-sstat">
                  <span className="mp-sstat-label">이달 총 소비</span>
                  <span className="mp-sstat-val">{total > 0 ? total.toLocaleString() + '원' : '—'}</span>
                </div>
                <div className="mp-sstat">
                  <span className="mp-sstat-label">활용한 혜택</span>
                  <span className="mp-sstat-val" style={{ color: '#22C55E' }}>{used.length}개</span>
                </div>
                <div className="mp-sstat">
                  <span className="mp-sstat-label">미사용 혜택</span>
                  <span className="mp-sstat-val" style={{ color: missed.length > 0 ? '#F59E0B' : '#AEAEB2' }}>
                    {missed.length}개
                  </span>
                </div>
              </div>
            </div>

            {/* 2컬럼 그리드 */}
            <div className="mp-grid">

              {/* ── 좌측 ── */}
              <div className="mp-col">

                {/* 혜택 현황 */}
                {benefits.length > 0 && (
                  <div className="mp-card">
                    <div className="mp-card-head">
                      <h2 className="mp-card-title">이번 달 혜택 현황</h2>
                      <span className="mp-chip">{used.length}개 활용 · {missed.length}개 미사용</span>
                    </div>
                    <table className="mp-benefit-table">
                      <thead>
                        <tr>
                          <th>혜택</th>
                          <th>카테고리</th>
                          <th>이달 소비</th>
                          <th>절약</th>
                          <th>상태</th>
                        </tr>
                      </thead>
                      <tbody>
                        {benefits.map((b, i) => (
                          <tr key={i} className={b.matched ? '' : 'row-miss'}>
                            <td className="td-desc">{b.desc}</td>
                            <td className="td-cat">{CAT_LABEL[b.category] || b.category}</td>
                            <td className="td-num">{b.matched ? (b.spent || 0).toLocaleString() + '원' : '—'}</td>
                            <td className="td-save">{b.matched ? '+' + (b.saved || 0).toLocaleString() + '원' : '—'}</td>
                            <td className="td-status">
                              {b.matched
                                ? <span className="status-on"><IconCheck /> 활용 중</span>
                                : <span className="status-off"><IconWarn /> 미사용</span>
                              }
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {missed.length > 0 && (
                      <div className="mp-missed-note">
                        <IconWarn />
                        <span>{missed.length}개 혜택을 이번 달 쓰지 않았어요. 해당 카테고리에서 소비하면 할인이 자동 적용돼요.</span>
                      </div>
                    )}
                  </div>
                )}

                {/* 알림 */}
                {lifeMy?.notifications?.length > 0 && (
                  <div className="mp-card">
                    <h2 className="mp-card-title" style={{ marginBottom: 16 }}>사후관리 알림</h2>
                    <div className="mp-noti-list">
                      {lifeMy.notifications.slice(0, 3).map(n => (
                        <div key={n.id} className={`mp-noti-item ${!n.isRead ? 'unread' : ''}`}>
                          <div className={`mp-noti-dot-icon type-${n.type}`} />
                          <div className="mp-noti-body">
                            <p className="mp-noti-title">{n.title}</p>
                            <p className="mp-noti-desc">{n.body}</p>
                          </div>
                          {!n.isRead && <span className="mp-unread-dot" />}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 빈 상태 */}
                {myCards.length === 0 && !lifeMy?.isHolder && (
                  <div className="mp-card mp-empty-card">
                    <p className="mp-empty-title">아직 신청한 카드가 없어요</p>
                    <p className="mp-empty-sub">내 소비 패턴에 맞는 BNK 카드를 찾아보세요</p>
                    <Link to="/cards" className="mp-empty-btn">카드 찾아보기</Link>
                  </div>
                )}
              </div>

              {/* ── 우측 ── */}
              <div className="mp-col mp-col--right">

                {/* 업그레이드 */}
                {lifeMy?.isHolder && (
                  <div className={`mp-card ${!nextUp ? 'mp-card--green' : ''}`}>
                    <h2 className="mp-card-title">혜택 업그레이드</h2>
                    {nextUp ? (
                      (() => {
                        const curYear    = lifeMy.membership?.tenureYear || 1
                        const targetYear = nextUp.atYear
                        const barPct     = Math.round((curYear / targetYear) * 100)
                        const yearsLeft  = targetYear - curYear
                        return (
                          <>
                            <div className="mp-upgrade-row">
                              <div>
                                <p className="mp-upgrade-label">다음 업그레이드까지</p>
                                <p className="mp-upgrade-big">
                                  {yearsLeft}년<span className="mp-upgrade-pct"> 남았어요</span>
                                </p>
                              </div>
                              <span className="mp-year-badge">{targetYear}년차 달성 시</span>
                            </div>
                            <div className="mp-progress-wrap">
                              <div className="mp-progress-track">
                                <div className="mp-progress-fill" style={{ width: `${barPct}%` }} />
                              </div>
                              <div className="mp-progress-labels">
                                <span>현재 {curYear}년차</span>
                                <span>{targetYear}년차</span>
                              </div>
                            </div>
                            <div className="mp-upgrade-benefit">
                              <span className="mp-rate-from">{nextUp.fromRate}%</span>
                              <svg width="20" height="12" viewBox="0 0 20 12" fill="none">
                                <path d="M1 6H19M14 1L19 6L14 11" stroke="#D71919" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                              <span className="mp-rate-to">{nextUp.toRate}%</span>
                              <span className="mp-benefit-name">{nextUp.benefit}</span>
                            </div>
                          </>
                        )
                      })()
                    ) : (
                      <div className="mp-best-grade">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="10" fill="#D1FAE5" stroke="#22C55E" strokeWidth="1.5"/>
                          <path d="M7 12L10.5 15.5L17 9" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        <p>최고 등급 혜택이 모두 적용되고 있어요</p>
                      </div>
                    )}
                  </div>
                )}

                {/* 소비 패턴 */}
                {spending.length > 0 && (
                  <div className="mp-card">
                    <div className="mp-card-head">
                      <h2 className="mp-card-title">이달 소비 패턴</h2>
                      <span className="mp-chip mp-chip--gray">총 {total.toLocaleString()}원</span>
                    </div>
                    <div className="mp-spend-list">
                      {spending.map(cat => (
                        <div key={cat.cd} className="mp-spend-row">
                          <span className="mp-spend-icon">{cat.icon}</span>
                          <span className="mp-spend-label">{cat.label}</span>
                          <div className="mp-bar-track">
                            <div className="mp-bar-fill" style={{ width: `${(cat.amount / maxAmt) * 100}%` }} />
                          </div>
                          <span className="mp-spend-pct">{Math.round(cat.amount / total * 100)}%</span>
                          <span className="mp-spend-amt">{cat.amount.toLocaleString()}원</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 다른 카드 추천 */}
                {opps.length > 0 && (
                  <div className="mp-card">
                    <div className="mp-card-head">
                      <h2 className="mp-card-title">이 카드도 써보세요</h2>
                      <span className="mp-chip mp-chip--gray">소비 패턴 기반</span>
                    </div>
                    <div className="mp-opp-list">
                      {opps.map(card => (
                        <Link key={card.id} to={`/cards/${card.id}`} className="mp-opp-item">
                          <div className="mp-opp-color" style={{ background: card.colorFrom || '#1C1C2E' }} />
                          <div className="mp-opp-info">
                            <p className="mp-opp-name">{card.name}</p>
                            <p className="mp-opp-save">월 +{card.savings.toLocaleString()}원 더 절약 가능</p>
                          </div>
                          <span className="mp-opp-arrow">보러가기 →</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            </div>
          </>
        )}

        {/* ════════ 혜택 구성 탭 (라이프 카드 보유자 전용) ════════ */}
        {tab === 'builder' && (
          lifeMy?.isHolder
            ? <BenefitBuilder />
            : (
              <div className="mp-card mp-builder-locked">
                <div className="mp-builder-lock-icon">🔒</div>
                <p className="mp-empty-title">BNK 라이프 평생 카드 전용 기능이에요</p>
                <p className="mp-empty-sub">라이프 카드를 신청하면 연회비에 맞는 혜택을 직접 골라 구성할 수 있어요</p>
                <Link to="/life-card" className="mp-empty-btn">라이프 카드 알아보기</Link>
              </div>
            )
        )}

      </div>
    </div>
  )
}
