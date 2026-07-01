import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import './MyPage.css'

/* ── 카테고리 설정 (아이콘·매칭 키워드) — 금액은 DB(거래내역)에서 ── */
const CATEGORY_CONFIG = {
  CAFE:      { category: '카페·편의점', icon: '☕', keywords: ['카페', '편의점', '커피'] },
  TRANSPORT: { category: '대중교통',   icon: '🚌', keywords: ['대중교통', '버스', '지하철', '택시', '교통', 'KTX'] },
  SHOPPING:  { category: '마트·쇼핑',  icon: '🛍', keywords: ['마트', '쇼핑', '온라인', '쿠팡', '백화점'] },
  TELECOM:   { category: '통신요금',   icon: '📱', keywords: ['통신', '휴대폰', '휴대'] },
  CULTURE:   { category: '영화·문화',  icon: '🎬', keywords: ['영화', '문화', '공연', '도서'] },
  PAY:       { category: '간편결제',   icon: '💳', keywords: ['간편결제', '페이'] },
}
const CATEGORY_ORDER = ['CAFE', 'TRANSPORT', 'SHOPPING', 'TELECOM', 'CULTURE', 'PAY']

function calcSavings(benefits = [], spending = []) {
  let total = 0
  for (const b of benefits) {
    const rate = parseFloat(b.discountRate) || 0
    if (rate === 0) continue
    const desc = (b.desc || '')
    for (const cat of spending) {
      if (cat.keywords.some(k => desc.includes(k))) {
        const raw   = cat.amount * (rate / 100)
        const limit = b.monthlyLimit ? Number(b.monthlyLimit) : Infinity
        total += Math.min(raw, limit)
        break
      }
    }
  }
  return Math.round(total)
}

/* ── 미니 카드 비주얼 ─────────────────────────────────────── */
function MiniCard({ card }) {
  return (
    <div
      className="mp-mini-card"
      style={{ background: `linear-gradient(145deg,${card.colorFrom || '#1C1C2E'},${card.colorTo || '#2D2D3E'})` }}
    >
      <div className="mp-mini-chip" />
      <span className="mp-mini-network">{card.network || 'VISA'}</span>
      <span className="mp-mini-name">{card.name}</span>
    </div>
  )
}

/* ── 메인 ─────────────────────────────────────────────────── */
export default function MyPage() {
  const navigate = useNavigate()
  const token    = localStorage.getItem('token')
  const userName = localStorage.getItem('userName') || '회원'

  const [allCards, setAllCards] = useState([])
  const [applied,  setApplied]  = useState([])
  const [spending, setSpending] = useState([])   // DB 거래 집계 (카테고리별)
  const [lifeMy,   setLifeMy]   = useState(null) // 라이프카드 사후관리(성장·알림)
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    if (!token) { navigate('/login'); return }
    const auth = { headers: { Authorization: `Bearer ${token}` } }
    Promise.all([
      fetch('/api/cards').then(r => r.json()),
      fetch('/api/applications/me', auth).then(r => r.json()),
      fetch('/api/mypage/spending', auth).then(r => r.json()),
      fetch('/api/life-card/my', auth).then(r => (r.ok ? r.json() : null)).catch(() => null),
    ])
      .then(([cards, apps, spend, life]) => {
        setAllCards(Array.isArray(cards) ? cards : [])
        setApplied(Array.isArray(apps)  ? apps  : [])
        setLifeMy(life)
        // DB 집계(카테고리·금액)를 config(아이콘·키워드)와 합쳐 표시용 배열 구성
        const amountByCat = {}
        ;(Array.isArray(spend) ? spend : []).forEach(s => { amountByCat[s.category] = Number(s.amount) })
        const merged = CATEGORY_ORDER
          .map(cd => ({ ...CATEGORY_CONFIG[cd], amount: amountByCat[cd] || 0 }))
          .filter(c => c.amount > 0)
        setSpending(merged)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="mp-loading"><div className="mp-spinner" /></div>
  )

  const TOTAL   = spending.reduce((s, c) => s + c.amount, 0)
  const MAX_CAT = Math.max(1, ...spending.map(c => c.amount))

  const appliedIds    = new Set(applied.map(a => a.cardId))
  const myCards       = allCards.filter(c =>  appliedIds.has(c.id))
  const notApplied    = allCards.filter(c => !appliedIds.has(c.id))

  const mySavings     = myCards.reduce((s, c) => s + calcSavings(c.benefits, spending), 0)
  const opportunities = notApplied
    .map(c => ({ ...c, savings: calcSavings(c.benefits, spending) }))
    .filter(c => c.savings > 0)
    .sort((a, b) => b.savings - a.savings)
    .slice(0, 3)

  const extraSavings  = opportunities.reduce((s, c) => s + c.savings, 0)

  return (
    <div className="mp-page">

      {/* ── 상단 내 정보 ── */}
      <div className="mp-hero">
        <div className="mp-hero-inner">
          <div className="mp-greeting">
            <p className="mp-greeting-sub">BNK Pickard 회원</p>
            <h1 className="mp-greeting-name">{userName}님, 안녕하세요</h1>
            <p className="mp-greeting-period">2026년 6월 소비 분석</p>
          </div>
          <div className="mp-stats">
            <div className="mp-stat">
              <span className="mp-stat-label">이달 총 소비</span>
              <span className="mp-stat-value">{TOTAL.toLocaleString()}<em>원</em></span>
            </div>
            <div className="mp-stat mp-stat--save">
              <span className="mp-stat-label">절약한 금액</span>
              <span className="mp-stat-value">
                {mySavings > 0 ? `${mySavings.toLocaleString()}` : '—'}<em>{mySavings > 0 ? '원' : ''}</em>
              </span>
              {mySavings === 0 && (
                <span className="mp-stat-hint">신청 카드 없음</span>
              )}
            </div>
            <div className="mp-stat mp-stat--potential">
              <span className="mp-stat-label">더 절약 가능</span>
              <span className="mp-stat-value">+{extraSavings.toLocaleString()}<em>원</em></span>
              <span className="mp-stat-hint">추천 카드 {opportunities.length}종 기준</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mp-body">

        {/* ── 내 BNK 라이프 카드 관리 (사후관리) ── */}
        {lifeMy?.isHolder && (
          <section className="mp-section">
            <h2 className="mp-section-title">내 BNK 라이프 카드 관리</h2>
            <p className="mp-section-sub">시간이 지날수록 혜택이 자라는 평생 카드예요</p>

            <div className="mp-life-top">
              {/* 카드 비주얼 */}
              <div className="mp-life-visual">
                <span className="mp-life-net">{lifeMy.stageLabel ? 'VISA' : 'VISA'}</span>
                <div className="mp-life-chip" />
                <div className="mp-life-visual-bottom">
                  <p className="mp-life-brand">BNK LIFE</p>
                  <p className="mp-life-name">BNK 라이프</p>
                  <p className="mp-life-no">{lifeMy.membership.cardNo}</p>
                </div>
                <span className="mp-life-tenure">{lifeMy.membership.tenureYear}년차</span>
              </div>

              {/* 성장 진행률 + 상태 */}
              <div className="mp-life-info">
                <div className="mp-life-status">
                  <span className={`mp-life-onoff ${lifeMy.membership.onoff === 'ON' ? 'on' : 'off'}`}>
                    {lifeMy.membership.onoff === 'ON' ? '● 사용 중' : '○ 사용 중지'}
                  </span>
                  <span className="mp-life-stage">{lifeMy.stageLabel?.label}</span>
                </div>
                {lifeMy.nextUpgrade ? (
                  <div className="mp-life-grow">
                    <p className="mp-life-grow-title">다음 혜택 업그레이드</p>
                    <p className="mp-life-grow-desc">
                      {lifeMy.nextUpgrade.benefit} <strong>{lifeMy.nextUpgrade.fromRate}% → {lifeMy.nextUpgrade.toRate}%</strong>
                      <span className="mp-life-grow-year"> ({lifeMy.nextUpgrade.atYear}년차)</span>
                    </p>
                    <div className="mp-life-bar"><div className="mp-life-bar-fill" style={{ width: `${lifeMy.nextUpgrade.yearProgress}%` }} /></div>
                    <p className="mp-life-grow-hint">다음 단계까지 <strong>{100 - lifeMy.nextUpgrade.yearProgress}%</strong> 남았어요</p>
                  </div>
                ) : (
                  <div className="mp-life-grow"><p className="mp-life-grow-title">최고 등급 혜택 적용 중 🎉</p></div>
                )}
                <p className="mp-life-saved">이번 달 <strong>{lifeMy.totalSaved.toLocaleString()}원</strong> 절약 중</p>
              </div>
            </div>

            {/* 켜진 혜택 (성장 적용) */}
            <div className="mp-life-benefits">
              {lifeMy.active.filter(b => b.saved > 0 || b.grown).slice(0, 4).map((b, i) => (
                <div key={i} className="mp-life-bnf">
                  <div className="mp-life-bnf-main">
                    <p className="mp-life-bnf-name">
                      {b.desc}
                      {b.grown && <span className="mp-grow-tag">성장 {b.effRate}%</span>}
                    </p>
                    {b.reason && <p className="mp-life-bnf-why">{b.reason}</p>}
                  </div>
                  {b.saved > 0 && <span className="mp-life-bnf-saved">+{b.saved.toLocaleString()}원</span>}
                </div>
              ))}
            </div>

            {/* 사후관리 알림 */}
            {lifeMy.notifications?.length > 0 && (
              <div className="mp-noti">
                {lifeMy.notifications.slice(0, 3).map(n => (
                  <div key={n.id} className={`mp-noti-item type-${n.type}`}>
                    <span className="mp-noti-ic">
                      {n.type === 'MISSED_BENEFIT' ? '⚠️' : n.type === 'UPGRADE_SOON' ? '⏳' : '🎁'}
                    </span>
                    <div>
                      <p className="mp-noti-t">{n.title}</p>
                      <p className="mp-noti-b">{n.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── 이달 소비 패턴 ── */}
        <section className="mp-section">
          <h2 className="mp-section-title">이달 소비 패턴</h2>
          <div className="mp-card-box">
            <p className="mp-spending-total">
              이달 총 <strong>{TOTAL.toLocaleString()}원</strong> 소비
            </p>
            <div className="mp-spending-list">
              {spending.map(cat => (
                <div key={cat.category} className="mp-spending-row">
                  <span className="mp-spending-icon">{cat.icon}</span>
                  <span className="mp-spending-cat">{cat.category}</span>
                  <div className="mp-bar-track">
                    <div
                      className="mp-bar-fill"
                      style={{ width: `${(cat.amount / MAX_CAT) * 100}%` }}
                    />
                  </div>
                  <span className="mp-spending-amt">{cat.amount.toLocaleString()}원</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 내 카드 혜택 현황 ── */}
        {myCards.length > 0 && (
          <section className="mp-section">
            <h2 className="mp-section-title">내 카드 혜택 현황</h2>
            <p className="mp-section-sub">신청한 카드로 이번 달 받은 혜택이에요</p>
            <div className="mp-rows">
              {myCards.map(card => {
                const saved = calcSavings(card.benefits)
                return (
                  <div key={card.id} className="mp-row">
                    <MiniCard card={card} />
                    <div className="mp-row-info">
                      <p className="mp-row-name">{card.name}</p>
                      {saved > 0 ? (
                        <>
                          <p className="mp-row-msg mp-row-msg--saved">
                            이번 달 <strong>{saved.toLocaleString()}원</strong>을 절약했어요!
                          </p>
                          <ul className="mp-row-details">
                            {(card.benefits || [])
                              .filter(b => parseFloat(b.discountRate) > 0)
                              .slice(0, 2)
                              .map((b, i) => <li key={i}>{b.desc}</li>)}
                          </ul>
                        </>
                      ) : (
                        <p className="mp-row-msg mp-row-msg--zero">
                          이번 달 해당 카드 혜택 내역이 없어요
                        </p>
                      )}
                    </div>
                    <Link to={`/cards/${card.id}`} className="mp-row-link">상세보기 →</Link>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* ── 놓치고 있는 혜택 ── */}
        {opportunities.length > 0 && (
          <section className="mp-section">
            <h2 className="mp-section-title">놓치고 있는 혜택</h2>
            <p className="mp-section-sub">현재 소비 패턴 기준, 이 카드를 사용했다면 더 절약할 수 있었어요</p>
            <div className="mp-rows">
              {opportunities.map((card, idx) => (
                <div key={card.id} className={`mp-row mp-opp-row${idx === 0 ? ' mp-opp--best' : ''}`}>
                  {idx === 0 && <span className="mp-best-badge">최고 절약</span>}
                  <MiniCard card={card} />
                  <div className="mp-row-info">
                    <p className="mp-row-name">{card.name}</p>
                    <p className="mp-row-msg mp-row-msg--potential">
                      이 카드를 사용하면 <strong>{card.savings.toLocaleString()}원</strong>을 더 절약할 수 있어요
                    </p>
                    <ul className="mp-row-details">
                      {(card.benefits || [])
                        .filter(b => parseFloat(b.discountRate) > 0)
                        .slice(0, 2)
                        .map((b, i) => <li key={i}>{b.desc}</li>)}
                    </ul>
                  </div>
                  <Link to={`/cards/${card.id}`} className="mp-apply-btn">상세보기</Link>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── 신청 카드 없을 때 ── */}
        {myCards.length === 0 && (
          <section className="mp-section">
            <div className="mp-empty">
              <p className="mp-empty-icon">✦</p>
              <p className="mp-empty-title">아직 신청한 카드가 없어요</p>
              <p className="mp-empty-sub">내 소비 패턴에 맞는 BNK 카드를 찾아보세요</p>
              <Link to="/cards" className="mp-empty-btn">내게 맞는 카드 찾기</Link>
            </div>
          </section>
        )}

        {/* ── 모든 추천 완료 ── */}
        {opportunities.length === 0 && myCards.length > 0 && (
          <section className="mp-section">
            <div className="mp-empty">
              <p className="mp-empty-icon">✦</p>
              <p className="mp-empty-title">소비 패턴에 맞는 카드를 모두 보유하고 계세요!</p>
              <Link to="/cards" className="mp-empty-btn">다른 카드 둘러보기</Link>
            </div>
          </section>
        )}

      </div>
    </div>
  )
}
