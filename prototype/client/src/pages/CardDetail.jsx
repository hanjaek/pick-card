import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import './CardDetail.css'

function CardVisual({ card, design }) {
  const colorFrom = design?.colorFrom || design?.color_from || card.colorFrom
  const colorTo   = design?.colorTo   || design?.color_to   || card.colorTo

  return (
    <div
      className="cd-card-visual"
      style={{ background: `linear-gradient(135deg, ${colorFrom}, ${colorTo})` }}
    >
      <div className="cd-card-chip" />
      <div className="cd-card-network">{card.network}</div>
      <div className="cd-card-number">**** **** **** 1234</div>
      <div className="cd-card-footer">
        <span className="cd-card-name">{card.name}</span>
        <span className="cd-card-badge">{card.type}</span>
      </div>
      {design && (
        <div className="cd-card-design-badge">✨ {design.themeName || design.theme_name}</div>
      )}
      <div className="cd-card-shine" />
    </div>
  )
}

function CardDetail() {
  const { id }   = useParams()
  const navigate = useNavigate()
  const [card, setCard]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setTab]   = useState('info')
  const [myDesigns, setMyDesigns] = useState([])
  const [selectedDesign, setSelectedDesign] = useState(null)

  const token = localStorage.getItem('token')

  useEffect(() => {
    fetch(`/api/cards/${id}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(data => { setCard(data); setLoading(false) })
      .catch(() => { setLoading(false) })
  }, [id])

  useEffect(() => {
    if (!token) return
    fetch('/api/design/mine', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        const forThisCard = (Array.isArray(data) ? data : []).filter(d => String(d.card_id) === String(id))
        setMyDesigns(forThisCard)
      })
      .catch(() => {})
  }, [id, token])

  if (loading) return <div className="cd-loading"><div className="spinner" /></div>
  if (!card)   return <div className="cd-error">카드 정보를 불러올 수 없습니다.</div>

  const handleApply = () => {
    if (!token) { navigate('/login'); return }
    navigate(`/cards/${id}/apply`, { state: { design: selectedDesign } })
  }

  const billingDays = [10, 15, 20, 25]

  return (
    <div className="cd-page">
      {/* 브레드크럼 */}
      <nav className="cd-breadcrumb">
        <Link to="/">홈</Link>
        <span>›</span>
        <Link to="/cards">카드상품</Link>
        <span>›</span>
        <span>{card.type}</span>
        <span>›</span>
        <span className="cd-bc-current">{card.name}</span>
      </nav>

      <div className="cd-layout">
        {/* ===== 좌측: 카드 정보 ===== */}
        <div className="cd-main">
          <p className="cd-card-type-label">{card.type}</p>
          <h1 className="cd-card-title">{card.name}</h1>

          {/* 탭 */}
          <div className="cd-tabs">
            {[
              { key: 'info',      label: '상품정보' },
              { key: 'benefits',  label: '혜택상세' },
              { key: 'terms',     label: '약관' },
              { key: 'disclosure',label: '공시정보' }
            ].map(t => (
              <button
                key={t.key}
                className={`cd-tab ${activeTab === t.key ? 'active' : ''}`}
                onClick={() => setTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* ---- 상품정보 탭 ---- */}
          {activeTab === 'info' && (
            <div className="cd-tab-content">
              <table className="cd-info-table">
                <tbody>
                  <tr>
                    <th>연회비</th>
                    <td>
                      {card.annualFee === 0
                        ? '없음'
                        : `${card.annualFee.toLocaleString()}원`}
                      {card.type === '체크카드' && ' (발급수수료 1천원)'}
                    </td>
                  </tr>
                  <tr>
                    <th>브랜드</th>
                    <td>{card.brand || '국내전용'} / {card.network}</td>
                  </tr>
                  <tr>
                    <th>후불교통</th>
                    <td>{card.trafficYn === 'Y' ? '후불교통 가능' : '비후불'}</td>
                  </tr>
                  <tr>
                    <th>주요혜택</th>
                    <td>
                      <ul className="cd-benefit-summary">
                        {(card.benefits || []).slice(0, 3).map((b, i) => (
                          <li key={i}>
                            <span className="cd-bnft-type">{b.type}</span>
                            {b.desc}
                          </li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                  <tr>
                    <th>상품특징</th>
                    <td>{card.productFeature || '-'}</td>
                  </tr>
                  {card.disclosure && (
                    <tr>
                      <th>공시승인번호</th>
                      <td>{card.disclosure.approvalCode}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* ---- 혜택상세 탭 ---- */}
          {activeTab === 'benefits' && (
            <div className="cd-tab-content">
              <div className="cd-benefits-grid">
                {(card.benefits || []).map((b, i) => (
                  <div key={i} className="cd-benefit-card">
                    <span className="cd-bnft-badge">{b.type}</span>
                    <p className="cd-bnft-desc">{b.desc}</p>
                    <div className="cd-bnft-meta">
                      {b.discountRate && <span>할인율 {b.discountRate}%</span>}
                      {b.monthlyLimit && (
                        <span>월 한도 {b.monthlyLimit.toLocaleString()}원</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ---- 약관 탭 ---- */}
          {activeTab === 'terms' && (
            <div className="cd-tab-content">
              {card.terms ? (
                <div className="cd-terms">
                  <div className="cd-terms-header">
                    <h3>{card.terms.title}</h3>
                    <span className="cd-terms-version">{card.terms.version}</span>
                    <span className="cd-terms-date">시행일: {card.terms.effectiveDt?.slice(0, 10)}</span>
                  </div>
                  {card.terms.content && (
                    <div className="cd-terms-body">{card.terms.content}</div>
                  )}
                  {card.terms.pdfPath && (
                    <a
                      className="btn-pdf"
                      href={`/uploads/terms/${card.terms.pdfPath}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      약관 PDF 다운로드
                    </a>
                  )}
                  {!card.terms.content && !card.terms.pdfPath && (
                    <p className="cd-no-content">약관 내용이 아직 등록되지 않았습니다.</p>
                  )}
                </div>
              ) : (
                <p className="cd-no-content">등록된 약관이 없습니다.</p>
              )}
            </div>
          )}

          {/* ---- 공시정보 탭 ---- */}
          {activeTab === 'disclosure' && (
            <div className="cd-tab-content">
              {card.disclosure ? (
                <table className="cd-info-table">
                  <tbody>
                    <tr><th>공시 승인번호</th><td>{card.disclosure.approvalCode}</td></tr>
                    <tr><th>공시일자</th><td>{card.disclosure.disclosureDt?.slice(0, 10)}</td></tr>
                    <tr><th>담당부서</th><td>{card.disclosure.deptNm}</td></tr>
                  </tbody>
                </table>
              ) : (
                <p className="cd-no-content">공시 정보가 없습니다.</p>
              )}
            </div>
          )}

          {/* 결제일 선택 */}
          <div className="cd-billing-section">
            <h3 className="cd-section-label">결제일 선택</h3>
            <div className="cd-billing-days">
              {billingDays.map(d => (
                <button key={d} className="cd-billing-day">매월 {d}일</button>
              ))}
            </div>
          </div>
        </div>

        {/* ===== 우측: 카드 비주얼 + 신청 ===== */}
        <div className="cd-sidebar">
          <CardVisual card={card} design={selectedDesign} />

          {/* 내 저장 디자인 */}
          {myDesigns.length > 0 && (
            <div className="cd-my-designs">
              <p className="cd-my-designs-label">저장된 내 디자인</p>
              <div className="cd-design-list">
                <button
                  className={`cd-design-item ${!selectedDesign ? 'selected' : ''}`}
                  onClick={() => setSelectedDesign(null)}
                >
                  <div
                    className="cd-design-swatch"
                    style={{ background: `linear-gradient(135deg, ${card.colorFrom}, ${card.colorTo})` }}
                  />
                  <span>기본</span>
                </button>
                {myDesigns.map(d => (
                  <button
                    key={d.id}
                    className={`cd-design-item ${selectedDesign?.id === d.id ? 'selected' : ''}`}
                    onClick={() => setSelectedDesign(d)}
                  >
                    <div
                      className="cd-design-swatch"
                      style={{ background: `linear-gradient(135deg, ${d.color_from}, ${d.color_to})` }}
                    />
                    <span>{d.theme_name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 신청 버튼들 */}
          <div className="cd-actions">
            <button className="cd-btn-primary" onClick={handleApply}>
              인터넷 신청
            </button>
            <Link
              to={`/cards/${id}/design`}
              className="cd-btn-design"
            >
              ✨ AI 커스텀 디자인 만들기
            </Link>
            <button className="cd-btn-secondary">상담 신청</button>
          </div>

          <div className="cd-share">
            <button className="cd-share-btn">관심카드 저장</button>
            <button className="cd-share-btn">상품 문자받기</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CardDetail
