import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import './MyPage.css'

const CAT_LABEL = {
  CAFE: '카페·디저트', TRANSPORT: '대중교통', SHOPPING: '쇼핑·마트',
  TELECOM: '통신요금',  CULTURE:   '영화·문화', PAY:      '간편결제',
  FOOD:    '식비·외식', MEDICAL:   '의료·건강',
}

// 저장된 혜택 구성 칩의 아이콘·라벨은 API(savedConfig.items, benefit_catalog 조인)에서 옴 — 하드코딩 제거
const CAT_ORDER = ['CAFE', 'TRANSPORT', 'SHOPPING', 'TELECOM', 'CULTURE', 'PAY']
const CAT_META  = {
  CAFE:      { icon: '☕', keywords: ['카페', '편의점', '커피'] },
  TRANSPORT: { icon: '🚌', keywords: ['대중교통', '버스', '지하철', '교통'] },
  SHOPPING:  { icon: '🛍', keywords: ['마트', '쇼핑', '쿠팡'] },
  TELECOM:   { icon: '📱', keywords: ['통신', '휴대폰'] },
  CULTURE:   { icon: '🎬', keywords: ['영화', '문화', '공연'] },
  PAY:       { icon: '💳', keywords: ['간편결제', '페이'] },
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

export default function MyPage() {
  const navigate = useNavigate()
  const token    = localStorage.getItem('token')
  const userName = localStorage.getItem('userName') || '회원'

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
  const curYear = lifeMy?.membership?.tenureYear || 1
  const barPct  = nextUp ? Math.round((curYear / nextUp.atYear) * 100) : 100

  return (
    <div className="mp-page">
      <div className="mp-inner">

        {/* ══════════════════════════════════════════
            라이프 카드 보유자 — 메인 히어로
            ══════════════════════════════════════════ */}
        {lifeMy?.isHolder ? (
          <div className="mp-life-hero">

            {/* 좌: 카드 비주얼 */}
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

            {/* 중: 핵심 지표 */}
            <div className="mp-life-stats">
              <div className="mp-lstat">
                <p className="mp-lstat-label">이달 절약한 금액</p>
                <p className="mp-lstat-val">
                  {saved > 0 ? saved.toLocaleString() : '0'}
                  <em>원</em>
                </p>
                <p className="mp-lstat-sub">{used.length}개 혜택 활용 중</p>
              </div>
              <div className="mp-lstat-divider" />
              <div className="mp-lstat">
                <p className="mp-lstat-label">혜택 활용도</p>
                <p className="mp-lstat-val">
                  {used.length}<em>/{benefits.length}</em>
                </p>
                {missed.length > 0
                  ? <p className="mp-lstat-sub warn">{missed.length}개 미사용</p>
                  : <p className="mp-lstat-sub good">모두 활용 중</p>
                }
              </div>
              <div className="mp-lstat-divider" />
              <div className="mp-lstat">
                <p className="mp-lstat-label">
                  {nextUp ? '다음 업그레이드' : '업그레이드'}
                </p>
                {nextUp ? (
                  <>
                    <div className="mp-lstat-upgrade-row">
                      <p className="mp-lstat-val">{nextUp.atYear - curYear}년<em> 남음</em></p>
                      <span className="mp-lstat-yr">{nextUp.atYear}년차</span>
                    </div>
                    <div className="mp-lstat-bar">
                      <div className="mp-lstat-bar-fill" style={{ width: `${barPct}%` }} />
                    </div>
                    <p className="mp-lstat-sub">
                      {nextUp.benefit} {nextUp.fromRate}% → {nextUp.toRate}%
                    </p>
                  </>
                ) : (
                  <>
                    <p className="mp-lstat-val good">최고 등급</p>
                    <p className="mp-lstat-sub good">모든 혜택 최대 적용 중</p>
                  </>
                )}
              </div>
            </div>

            {/* 우: 액션 */}
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
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8H13M9 4L13 8L9 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </Link>
              <div className="mp-action-period">{period} 소비 분석 ↓</div>
            </div>

          </div>
        ) : (
          /* 비보유자 — 일반 헤더 */
          <div className="mp-page-header">
            <div>
              <h1 className="mp-page-title">{userName}님의 소비 분석</h1>
              <p className="mp-page-sub">{period} · 카드 혜택 활용 현황</p>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════
            소비 분석 — 상단 요약 바 (비보유자 or 보충)
            ══════════════════════════════════════════ */}
        {!lifeMy?.isHolder && (
          <div className="mp-summary-bar">
            <div className="mp-summary-main">
              <p className="mp-summary-label">이달 총 소비</p>
              <p className="mp-summary-num">{total > 0 ? total.toLocaleString() : '0'}<span className="mp-summary-unit">원</span></p>
            </div>
            <div className="mp-summary-divider" />
            <div className="mp-summary-stats">
              <div className="mp-sstat">
                <span className="mp-sstat-label">활용한 혜택</span>
                <span className="mp-sstat-val" style={{ color: '#22C55E' }}>{used.length}개</span>
              </div>
              <div className="mp-sstat">
                <span className="mp-sstat-label">미사용 혜택</span>
                <span className="mp-sstat-val" style={{ color: missed.length > 0 ? '#F59E0B' : '#AEAEB2' }}>{missed.length}개</span>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════
            메인 2컬럼 그리드
            ══════════════════════════════════════════ */}
        <div className="mp-grid">

          {/* ── 좌측: 혜택 현황 + 알림 ── */}
          <div className="mp-col">

            {benefits.length > 0 && (
              <div className="mp-card">
                <div className="mp-card-head">
                  <h2 className="mp-card-title">이번 달 혜택 현황</h2>
                  <span className="mp-chip">{used.length}개 활용 · {missed.length}개 미사용</span>
                </div>
                <table className="mp-benefit-table">
                  <thead>
                    <tr>
                      <th>혜택</th><th>카테고리</th><th>이달 소비</th><th>절약</th><th>상태</th>
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
                    <span>{missed.length}개 혜택이 이번 달 사용되지 않았어요. 해당 카테고리에서 소비하면 자동 적용돼요.</span>
                  </div>
                )}
              </div>
            )}

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

            {myCards.length === 0 && !lifeMy?.isHolder && (
              <div className="mp-card mp-empty-card">
                <p className="mp-empty-title">아직 신청한 카드가 없어요</p>
                <p className="mp-empty-sub">내 소비 패턴에 맞는 BNK 카드를 찾아보세요</p>
                <Link to="/cards" className="mp-empty-btn">카드 찾아보기</Link>
              </div>
            )}
          </div>

          {/* ── 우측: 소비패턴 + 카드추천 ── */}
          <div className="mp-col mp-col--right">

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
      </div>
    </div>
  )
}
