import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import './Terms.css'

const TABS = [
  { key: 'terms',   label: '약관' },
  { key: 'product', label: '카드상품' },
  { key: 'guide',   label: '공시이용매뉴얼' },
]

export default function Terms() {
  const [searchParams, setSearchParams] = useSearchParams()
  const filterCardId = searchParams.get('card_id')

  const [allCards, setAllCards]   = useState([])
  const [termsMap, setTermsMap]   = useState({})
  const [loading, setLoading]     = useState(true)
  const [activeTab, setActiveTab] = useState('terms')
  const [modalCard, setModalCard] = useState(null)
  const [history, setHistory]     = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/cards').then(r => r.json()),
      fetch('/api/terms').then(r => r.json()),
    ])
      .then(([cardsData, termsData]) => {
        setAllCards(Array.isArray(cardsData) ? cardsData : [])
        const map = {}
        ;(Array.isArray(termsData) ? termsData : []).forEach(t => {
          if (!map[t.card_id]) map[t.card_id] = []
          map[t.card_id].push(t)
        })
        setTermsMap(map)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const cards = filterCardId
    ? allCards.filter(c => String(c.id) === filterCardId)
    : allCards

  const filterCardName = filterCardId
    ? allCards.find(c => String(c.id) === filterCardId)?.name
    : null

  const clearFilter = () => {
    setSearchParams({})
  }

  const openHistory = async (card) => {
    setModalCard(card)
    setHistoryLoading(true)
    const cardTerms = termsMap[card.id] || []
    if (cardTerms.length > 0) {
      try {
        const res = await fetch(`/api/terms/${cardTerms[0].id}/history`)
        const data = await res.json()
        setHistory(Array.isArray(data) ? data : [])
      } catch {
        setHistory([])
      }
    } else {
      setHistory([])
    }
    setHistoryLoading(false)
  }

  return (
    <div className="terms-page">

      {/* Hero */}
      <div className="terms-hero">
        <p className="terms-eyebrow">상품공시</p>
        <h1 className="terms-hero-title">약관·상품설명서</h1>
        <p className="terms-hero-sub">BNK 부산은행 카드 상품의 약관 및 설명서를 확인하세요</p>
      </div>

      <div className="terms-body">

        {/* Tabs */}
        <div className="terms-tabs">
          {TABS.map(t => (
            <button
              key={t.key}
              className={`terms-tab${activeTab === t.key ? ' on' : ''}`}
              onClick={() => setActiveTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Quick downloads */}
        <div className="terms-quick">
          <button className="terms-quick-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            신용카드 개인회원 표준약관
          </button>
          <button className="terms-quick-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            체크카드 개인회원 표준약관
          </button>
        </div>

        {/* Filter banner */}
        {filterCardName && (
          <div className="terms-filter-banner">
            <span className="terms-filter-label">
              <strong>{filterCardName}</strong>의 약관·설명서를 보고 있습니다
            </span>
            <button className="terms-filter-clear" onClick={clearFilter}>전체 카드 보기</button>
          </div>
        )}

        {/* Count */}
        <p className="terms-count">
          총 <strong>{loading ? '-' : cards.length}건</strong>
        </p>

        {/* Table */}
        {loading ? (
          <div className="terms-loading"><div className="terms-spinner" /></div>
        ) : (
          <div className="terms-table-wrap">
            <table className="terms-table">
              <thead>
                <tr>
                  <th className="terms-th-no">번호</th>
                  <th className="terms-th-name">상품명</th>
                  <th>상품설명서</th>
                  <th>상품안내장</th>
                  <th>발급 여부</th>
                  <th>출시일</th>
                </tr>
              </thead>
              <tbody>
                {cards.map((card, i) => {
                  const cardTerms = termsMap[card.id] || []
                  const activeTerm = cardTerms.find(t => t.is_active)
                  return (
                    <tr key={card.id}>
                      <td className="terms-td-no">{i + 1}</td>
                      <td className="terms-td-name">
                        <Link to={`/cards/${card.id}`}>{card.name}</Link>
                      </td>
                      <td>
                        <button
                          className="terms-link-btn"
                          onClick={() => openHistory(card)}
                        >
                          상세내역
                        </button>
                      </td>
                      <td>
                        {activeTerm?.pdf_path ? (
                          <a
                            href={`/uploads/terms/${activeTerm.pdf_path}`}
                            target="_blank"
                            rel="noreferrer"
                            className="terms-link-btn"
                          >
                            약관 보기
                          </a>
                        ) : (
                          <span className="terms-empty">-</span>
                        )}
                      </td>
                      <td>
                        <span className={`terms-status ${card.saleStatus === 'ON_SALE' ? 'on' : 'off'}`}>
                          {card.saleStatus === 'ON_SALE' ? '발급가능' : '발급중지'}
                        </span>
                      </td>
                      <td className="terms-td-date">
                        {card.launchDt ? new Date(card.launchDt).toLocaleDateString('ko-KR') : '-'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: 상품설명서 이력 */}
      {modalCard && (
        <div className="terms-modal-backdrop" onClick={() => setModalCard(null)}>
          <div className="terms-modal" onClick={e => e.stopPropagation()}>
            <div className="terms-modal-header">
              <h2 className="terms-modal-title">상품설명서 이력</h2>
              <button className="terms-modal-close" onClick={() => setModalCard(null)}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <p className="terms-modal-card-name">{modalCard.name}</p>

            {historyLoading ? (
              <div className="terms-loading"><div className="terms-spinner" /></div>
            ) : (
              <table className="terms-modal-table">
                <thead>
                  <tr>
                    <th>버전</th>
                    <th>등록일</th>
                    <th>변경내용</th>
                    <th>상품설명서</th>
                  </tr>
                </thead>
                <tbody>
                  {(termsMap[modalCard.id] || []).map((t, i) => (
                    <tr key={t.id || i}>
                      <td className="terms-td-ver">{t.version_no}</td>
                      <td className="terms-td-date">
                        {t.reg_dt ? new Date(t.reg_dt).toLocaleDateString('ko-KR') : '-'}
                      </td>
                      <td>{t.terms_content || (i === 0 ? '최초 등록' : '약관 변경')}</td>
                      <td>
                        {t.pdf_path ? (
                          <a
                            href={`/uploads/terms/${t.pdf_path}`}
                            target="_blank"
                            rel="noreferrer"
                            className="terms-download-btn"
                          >
                            약관 보기
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M9 18l6-6-6-6" />
                            </svg>
                          </a>
                        ) : (
                          <span className="terms-empty">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {(termsMap[modalCard.id] || []).length === 0 && (
                    <tr>
                      <td colSpan={4} className="terms-no-data">등록된 이력이 없습니다</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
