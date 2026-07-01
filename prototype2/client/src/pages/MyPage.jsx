import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import './MyPage.css'

/* ── 카테고리 표시용 (아이콘·라벨) ── */
const CAT_ICON = {
  CAFE: '☕', DELIVERY: '🛵', TRANSPORT: '🚌', SHOPPING: '🛍', SUBSCRIPTION: '📺',
  TELECOM: '📱', CULTURE: '🎬', PAY: '💳', MEDICAL: '💊', FUEL: '⛽',
  EDUCATION: '📚', TRAVEL: '✈️', CONVENIENCE: '🏪',
}
const CAT_FULL = {
  CAFE: '카페·편의점', DELIVERY: '배달', TRANSPORT: '대중교통', SHOPPING: '쇼핑·마트',
  SUBSCRIPTION: '구독', TELECOM: '통신', CULTURE: '문화·여가', PAY: '간편결제',
  MEDICAL: '의료·약국', FUEL: '주유', EDUCATION: '교육', TRAVEL: '여행', CONVENIENCE: '편의점',
}

/* 비보유자 소비 패턴용 (기존 6종) */
const CAT_LABEL = { CAFE: '카페·디저트', TRANSPORT: '대중교통', SHOPPING: '쇼핑·마트', TELECOM: '통신요금', CULTURE: '영화·문화', PAY: '간편결제' }
const CAT_ORDER = ['CAFE', 'TRANSPORT', 'SHOPPING', 'TELECOM', 'CULTURE', 'PAY']
const CAT_KEYWORD = {
  CAFE: ['카페', '편의점', '커피'], TRANSPORT: ['대중교통', '버스', '지하철', '교통'],
  SHOPPING: ['마트', '쇼핑', '쿠팡'], TELECOM: ['통신', '휴대폰'],
  CULTURE: ['영화', '문화', '공연'], PAY: ['간편결제', '페이'],
}

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

/* 숫자 카운트업 애니메이션 (0 → target, easeOutCubic) */
function useCountUp(target, dur = 1000) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!target) { setVal(0); return }
    let raf, start = null
    const step = (t) => {
      if (start === null) start = t
      const p = Math.min(1, (t - start) / dur)
      const e = 1 - Math.pow(1 - p, 3)
      setVal(Math.round(target * e))
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, dur])
  return val
}

/* 도넛 게이지 */
function Ring({ pct = 0, size = 208, stroke = 18, children }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const off = c * (1 - Math.min(100, Math.max(0, pct)) / 100)
  return (
    <div className="mp-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#EFEFF2" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke="url(#mp-ring-grad)" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={off}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(.2,.8,.2,1)' }}
        />
        <defs>
          <linearGradient id="mp-ring-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#D71919" />
            <stop offset="100%" stopColor="#FF7B7B" />
          </linearGradient>
        </defs>
      </svg>
      <div className="mp-ring-center">{children}</div>
    </div>
  )
}

const IconArrow = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M3 7H11M8 4L11 7L8 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export default function MyPage() {
  const navigate = useNavigate()
  const token    = localStorage.getItem('token')
  const userName = localStorage.getItem('userName') || '회원'

  const [allCards, setAllCards] = useState([])
  const [applied,  setApplied]  = useState([])
  const [spending, setSpending] = useState([])
  const [lifeMy,   setLifeMy]   = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [anim,     setAnim]     = useState(false)   // 마운트 후 애니메이션 트리거

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
          .map(cd => ({ cd, label: CAT_LABEL[cd] || cd, icon: CAT_ICON[cd] || '•', keywords: CAT_KEYWORD[cd] || [], amount: byKey[cd] || 0 }))
          .filter(c => c.amount > 0)
      )
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (loading) return
    const t = setTimeout(() => setAnim(true), 120)
    return () => clearTimeout(t)
  }, [loading])

  /* ── 파생 데이터 (null-safe: 로딩 중에도 hook 순서 유지) ── */
  const isHolder   = !!lifeMy?.isHolder
  const curYear    = lifeMy?.membership?.tenureYear || 1
  const nextUp     = lifeMy?.nextUpgrade

  // 카테고리형 혜택 → 활용 리포트
  const report = (lifeMy?.active || [])
    .filter(b => b.category)
    .map(b => {
      const cap = Number(b.monthlyLimit) || 0
      const sv  = Number(b.saved) || 0
      const util = cap > 0 ? Math.min(100, Math.round(sv / cap * 100)) : (b.matched ? 100 : 0)
      return { ...b, cap, sv, util }
    })
    .sort((a, b) => b.sv - a.sv)

  const usedCount  = report.filter(b => b.matched).length
  const totalCap   = report.reduce((s, b) => s + b.cap, 0)
  const totalSaved = report.reduce((s, b) => s + b.sv, 0)
  const overallUtil = totalCap > 0 ? Math.min(100, Math.round(totalSaved / totalCap * 100)) : 0

  // 성장형: 1년마다 +1%p
  const growth = report.filter(b => b.baseRate != null && Number(b.baseRate) > 0)
  const rep = growth.find(b => b.matched) || growth[0] || null
  const maxYear = Math.max(5, curYear + 1)
  const gcols = Array.from({ length: maxYear }, (_, i) => {
    const year = i + 1
    return { year, rate: (rep ? Number(rep.baseRate) : 0) + (year - 1) }
  })
  const gMax = gcols.length ? (gcols[gcols.length - 1].rate || 1) : 1

  // 카운트업 (anim 트리거 시 0→값)
  const savedCount = useCountUp(anim ? totalSaved : 0)
  const utilCount  = useCountUp(anim ? overallUtil : 0)

  // 신청 카드 / 추천
  const appliedIds = new Set(applied.map(a => a.cardId))
  const myCards    = allCards.filter(c => appliedIds.has(c.id))
  const opps = allCards
    .filter(c => !appliedIds.has(c.id))
    .map(c => ({ ...c, savings: calcSavings(c.benefits, spending) }))
    .filter(c => c.savings > 0)
    .sort((a, b) => b.savings - a.savings)
    .slice(0, 3)

  const now     = new Date()
  const period  = `${now.getFullYear()}년 ${now.getMonth() + 1}월`
  const total   = spending.reduce((s, c) => s + c.amount, 0)
  const maxAmt  = Math.max(1, ...spending.map(c => c.amount))
  const barPct  = nextUp ? Math.round((curYear / nextUp.atYear) * 100) : 100

  if (loading) return <div className="mp-loading"><div className="mp-spinner" /></div>

  return (
    <div className="mp-page">
      <div className="mp-inner">

        {/* ══════════════ 히어로 ══════════════ */}
        {isHolder ? (
          <div className="mp-life-hero">
            <div className="mp-life-visual">
              <div className="mp-life-card-wrap">
                <div className="mp-lc-chip" />
                <span className="mp-lc-net">VISA</span>
                <div className="mp-lc-bottom">
                  <p className="mp-lc-brand">BNK LIFE</p>
                  <p className="mp-lc-name">라이프 평생 카드</p>
                  <p className="mp-lc-no">{lifeMy.membership?.cardNo || '•••• •••• •••• ••••'}</p>
                </div>
              </div>
              <div className="mp-lc-meta">
                <span className="mp-lc-badge year">{curYear}년차</span>
                <span className="mp-lc-badge stage">{lifeMy.stageLabel?.label || ''}</span>
              </div>
            </div>

            <div className="mp-life-stats">
              <div className="mp-lstat">
                <p className="mp-lstat-label">이달 절약한 금액</p>
                <p className="mp-lstat-val">{totalSaved > 0 ? totalSaved.toLocaleString() : '0'}<em>원</em></p>
                <p className="mp-lstat-sub">{usedCount}개 혜택 활용 중</p>
              </div>
              <div className="mp-lstat-divider" />
              <div className="mp-lstat">
                <p className="mp-lstat-label">혜택 활용도</p>
                <p className="mp-lstat-val">{usedCount}<em>/{report.length}</em></p>
                {report.length - usedCount > 0
                  ? <p className="mp-lstat-sub warn">{report.length - usedCount}개 미사용</p>
                  : <p className="mp-lstat-sub good">모두 활용 중</p>}
              </div>
              <div className="mp-lstat-divider" />
              <div className="mp-lstat">
                <p className="mp-lstat-label">{nextUp ? '다음 업그레이드' : '업그레이드'}</p>
                {nextUp ? (
                  <>
                    <div className="mp-lstat-upgrade-row">
                      <p className="mp-lstat-val">{nextUp.atYear - curYear}년<em> 남음</em></p>
                      <span className="mp-lstat-yr">{nextUp.atYear}년차</span>
                    </div>
                    <div className="mp-lstat-bar"><div className="mp-lstat-bar-fill" style={{ width: anim ? `${barPct}%` : 0 }} /></div>
                    <p className="mp-lstat-sub">{nextUp.benefit} {nextUp.fromRate}% → {nextUp.toRate}%</p>
                  </>
                ) : (
                  <>
                    <p className="mp-lstat-val good">최고 등급</p>
                    <p className="mp-lstat-sub good">모든 혜택 최대 적용 중</p>
                  </>
                )}
              </div>
            </div>

            <div className="mp-life-actions">
              {lifeMy.savedConfig ? (
                <div className="mp-my-config">
                  <p className="mp-my-config-label">내 혜택 구성</p>
                  <div className="mp-my-config-chips">
                    {(lifeMy.savedConfig.items || []).map(it => (
                      <span key={it.cd} className="mp-my-chip">{it.icon} {it.label}</span>
                    ))}
                  </div>
                  <p className="mp-my-config-fee">연회비 {lifeMy.savedConfig.selectedFee.toLocaleString()}원</p>
                </div>
              ) : (
                <p className="mp-action-hint">연회비에 맞게 원하는 혜택을 직접 고를 수 있어요</p>
              )}
              <Link to="/benefit-builder" className="mp-action-btn primary">
                {lifeMy.savedConfig ? '혜택 변경하기' : '혜택 구성하기'}
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8H13M9 4L13 8L9 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </Link>
            </div>
          </div>
        ) : (
          <div className="mp-page-header">
            <div>
              <h1 className="mp-page-title">{userName}님의 소비 분석</h1>
              <p className="mp-page-sub">{period} · 카드 혜택 활용 현황</p>
            </div>
          </div>
        )}

        {/* ══════════════ ① 혜택 활용 리포트 (혜택현황 + 소비 통합) ══════════════ */}
        {isHolder && report.length > 0 && (
          <section className="mp-section">
            <div className="mp-section-head">
              <div>
                <h2 className="mp-section-title">이번 달 혜택 활용 리포트</h2>
                <p className="mp-section-sub">{period} · 받을 수 있는 할인 중 얼마나 챙겼는지 한눈에 보세요</p>
              </div>
              <span className="mp-chip">{usedCount} / {report.length} 활용</span>
            </div>

            <div className="mp-report">
              {/* 좌: 전체 활용률 게이지 */}
              <div className="mp-gauge">
                <Ring pct={anim ? overallUtil : 0}>
                  <span className="mp-gauge-pct">{utilCount}<em>%</em></span>
                  <span className="mp-gauge-cap">할인 활용률</span>
                </Ring>
                <div className="mp-gauge-nums">
                  <div className="mp-gn">
                    <span className="mp-gn-label">이번 달 받은 할인</span>
                    <span className="mp-gn-val green">{savedCount.toLocaleString()}원</span>
                  </div>
                  <div className="mp-gn">
                    <span className="mp-gn-label">받을 수 있는 최대</span>
                    <span className="mp-gn-val">{totalCap.toLocaleString()}원</span>
                  </div>
                </div>
                {overallUtil < 100 && (
                  <p className="mp-gauge-hint">아직 <b>{(totalCap - totalSaved).toLocaleString()}원</b> 더 아낄 수 있어요!</p>
                )}
              </div>

              {/* 우: 혜택별 활용 바 */}
              <div className="mp-util-list">
                {report.map((b, i) => (
                  <div key={i} className={`mp-util-row ${b.matched ? 'on' : 'off'}`}>
                    <div className="mp-util-head">
                      <span className="mp-util-icon">{CAT_ICON[b.category] || '•'}</span>
                      <div className="mp-util-txt">
                        <p className="mp-util-name">{b.desc}</p>
                        <p className="mp-util-meta">
                          {CAT_FULL[b.category] || b.category}
                          {b.matched ? ` · 이달 ${(b.spent || 0).toLocaleString()}원 소비` : ' · 이번 달 미사용'}
                        </p>
                      </div>
                      <span className="mp-util-rate">{b.effRate ?? b.baseRate ?? 0}%</span>
                    </div>
                    <div className="mp-util-barrow">
                      <div className="mp-util-track">
                        <div className={`mp-util-fill ${b.matched ? '' : 'zero'}`} style={{ width: anim ? `${b.util}%` : 0 }} />
                      </div>
                      <span className={`mp-util-pct ${b.matched ? '' : 'zero'}`}>{b.matched ? b.util : 0}%</span>
                    </div>
                    <div className="mp-util-foot">
                      {b.matched ? (
                        <span className="mp-util-saved">+{b.sv.toLocaleString()}원 아낌 <em>/ 최대 {b.cap.toLocaleString()}원</em></span>
                      ) : (
                        <span className="mp-util-cta">
                          0원 — 이 카테고리에서 결제하면 자동 적용돼요
                          <Link to="/benefit-builder" className="mp-util-swap">다른 혜택으로 변경 <IconArrow /></Link>
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ══════════════ ② 오래 쓸수록 오르는 할인율 ══════════════ */}
        {isHolder && rep && (
          <section className="mp-section">
            <div className="mp-section-head">
              <div>
                <h2 className="mp-section-title">오래 쓸수록 오르는 할인율</h2>
                <p className="mp-section-sub">가입 {curYear}년차 · 1년마다 할인율이 <b>+1%p</b>씩 자동으로 올라가요</p>
              </div>
              <span className="mp-chip mp-chip--gray">장기 이용 우대</span>
            </div>

            <div className="mp-growth">
              {/* 대표 혜택 성장 막대 그래프 */}
              <div className="mp-gchart">
                <p className="mp-gchart-subj"><span>{CAT_ICON[rep.category] || '•'}</span> {rep.desc} 기준</p>
                <div className="mp-gbars">
                  {gcols.map(d => (
                    <div key={d.year} className={`mp-gcol ${d.year === curYear ? 'now' : ''} ${d.year <= curYear ? 'reached' : ''}`}>
                      <span className="mp-gval">{d.rate}%</span>
                      <div className="mp-gbar-track">
                        <div className="mp-gbar-fill" style={{ height: anim ? `${(d.rate / gMax) * 100}%` : 0 }} />
                      </div>
                      <span className="mp-gyr">{d.year}년차</span>
                      {d.year === curYear && <span className="mp-gnow-tag">현재</span>}
                    </div>
                  ))}
                </div>
              </div>

              {/* 혜택별 1년차 → 현재 */}
              <div className="mp-glist">
                <p className="mp-glist-title">내 혜택 성장 현황</p>
                {growth.map((b, i) => {
                  const base = Number(b.baseRate)
                  const cur  = base + (curYear - 1)
                  return (
                    <div key={i} className="mp-grow-row">
                      <span className="mp-grow-name">{CAT_ICON[b.category] || '•'} {CAT_FULL[b.category] || b.category}</span>
                      <span className="mp-grow-flow">
                        <em>{base}%</em><i className="mp-grow-arrow"><IconArrow /></i><strong>{cur}%</strong>
                      </span>
                      {curYear > 1 && <span className="mp-grow-badge">+{curYear - 1}%p</span>}
                    </div>
                  )
                })}
              </div>
            </div>
          </section>
        )}

        {/* ══════════════ 비보유자: 소비 패턴 ══════════════ */}
        {!isHolder && (
          <div className="mp-summary-bar">
            <div className="mp-summary-main">
              <p className="mp-summary-label">이달 총 소비</p>
              <p className="mp-summary-num">{total > 0 ? total.toLocaleString() : '0'}<span className="mp-summary-unit">원</span></p>
            </div>
          </div>
        )}
        {!isHolder && spending.length > 0 && (
          <section className="mp-section">
            <div className="mp-section-head">
              <div><h2 className="mp-section-title">이달 소비 패턴</h2></div>
              <span className="mp-chip mp-chip--gray">총 {total.toLocaleString()}원</span>
            </div>
            <div className="mp-spend-list">
              {spending.map(cat => (
                <div key={cat.cd} className="mp-spend-row">
                  <span className="mp-spend-icon">{cat.icon}</span>
                  <span className="mp-spend-label">{cat.label}</span>
                  <div className="mp-bar-track"><div className="mp-bar-fill" style={{ width: anim ? `${(cat.amount / maxAmt) * 100}%` : 0 }} /></div>
                  <span className="mp-spend-pct">{Math.round(cat.amount / total * 100)}%</span>
                  <span className="mp-spend-amt">{cat.amount.toLocaleString()}원</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ══════════════ 하단: 알림 + 추천카드 ══════════════ */}
        <div className="mp-bottom">
          {isHolder && lifeMy?.notifications?.length > 0 && (
            <div className="mp-card">
              <h2 className="mp-card-title" style={{ marginBottom: 18 }}>사후관리 알림</h2>
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

        {myCards.length === 0 && !isHolder && (
          <div className="mp-card mp-empty-card">
            <p className="mp-empty-title">아직 신청한 카드가 없어요</p>
            <p className="mp-empty-sub">내 소비 패턴에 맞는 BNK 카드를 찾아보세요</p>
            <Link to="/cards" className="mp-empty-btn">카드 찾아보기</Link>
          </div>
        )}
      </div>
    </div>
  )
}
