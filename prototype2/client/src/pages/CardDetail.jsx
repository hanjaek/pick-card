import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import './CardDetail.css'

function CardVisual({ card, design }) {
  const colorFrom = design?.colorFrom || design?.color_from || card.colorFrom
  const colorTo   = design?.colorTo   || design?.color_to   || card.colorTo
  // AI 커스텀 디자인이 없고 실물 이미지가 있으면 실물 이미지
  const img = !design && card.imageUrl ? card.imageUrl : null

  return (
    <div
      className="cd-card-visual"
      style={img ? undefined : { background: `linear-gradient(135deg, ${colorFrom}, ${colorTo})` }}
    >
      {img ? (
        <img className="cd-card-img" src={img} alt={card.name} />
      ) : (
        <>
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
        </>
      )}
    </div>
  )
}

function CardDetail() {
  const { id }   = useParams()
  const navigate = useNavigate()
  const [card, setCard]             = useState(null)
  const [loading, setLoading]       = useState(true)
  const [activeTab, setTab]         = useState('info')
  const [lifeCardInfo, setLifeInfo] = useState(null)

  const token = localStorage.getItem('token')

  useEffect(() => {
    fetch(`/api/cards/${id}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(data => { setCard(data); setLoading(false) })
      .catch(() => { setLoading(false) })
  }, [id])

  useEffect(() => {
    if (id === '9') {
      fetch('/api/life-card')
        .then(r => r.ok ? r.json() : null)
        .then(setLifeInfo)
        .catch(() => {})
    }
  }, [id])

  if (loading) return <div className="cd-loading"><div className="spinner" /></div>
  if (!card)   return <div className="cd-error">카드 정보를 불러올 수 없습니다.</div>

  const handleApply = () => {
    if (!token) { navigate('/login'); return }
    navigate(`/cards/${id}/apply`)
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
              { key: 'info',    label: '상품안내' },
              { key: 'service', label: '서비스안내' },
              { key: 'fee',     label: '연회비·수수료' },
              { key: 'etc',     label: '기타' },
              { key: 'terms',   label: '상품약관' },
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

          {/* ---- 상품안내 탭 ---- */}
          {activeTab === 'info' && (
            <div className="cd-tab-content">
              <div className="cd-highlight-box">
                <p className="cd-highlight-title">{card.name}</p>
                {lifeCardInfo ? (
                  <ul className="cd-highlight-list">
                    <li>원하는 혜택을 직접 선택 가능</li>
                    <li>소득에 맞춰 연회비 선택 가능</li>
                    <li>연차가 쌓일수록 할인율 자동 UP</li>
                    <li>AI 소비 분석으로 혜택 추천</li>
                  </ul>
                ) : (
                  <ul className="cd-highlight-list">
                    {(card.benefits || []).map((b, i) => (
                      <li key={i}>{b.desc}</li>
                    ))}
                  </ul>
                )}
              </div>
              <table className="cd-info-table">
                <tbody>
                  <tr>
                    <th>연회비</th>
                    <td>
                      {card.annualFee == null ? '선택형' : card.annualFee === 0
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
                  <tr>
                    <th>발급대상</th>
                    <td>개인회원{card.type === '신용카드' ? '(가족카드 발급불가)' : ''}</td>
                  </tr>
                  <tr>
                    <th>가입방법</th>
                    <td>영업점, 인터넷, 스마트폰</td>
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

          {/* ---- 서비스안내 탭 ---- */}
          {activeTab === 'service' && (
            <div className="cd-tab-content">
              {lifeCardInfo ? (
                <>
                  {lifeCardInfo.common.length > 0 && (
                    <div className="cd-stage-group">
                      <p className="cd-stage-group-label">전 생애 공통 혜택</p>
                      <div className="cd-benefits-grid">
                        {lifeCardInfo.common.map((b, i) => (
                          <div key={i} className="cd-benefit-card">
                            <span className="cd-bnft-badge">{b.type}</span>
                            <p className="cd-bnft-desc">{b.desc}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {lifeCardInfo.stages.map((s, i) => (
                    <div key={i} className="cd-stage-group">
                      <p className="cd-stage-group-label">{s.age} · {s.label}</p>
                      <p className="cd-stage-group-desc">{s.desc}</p>
                      <div className="cd-benefits-grid">
                        {s.benefits.map((b, j) => (
                          <div key={j} className="cd-benefit-card">
                            <span className="cd-bnft-badge">{b.type}</span>
                            <p className="cd-bnft-desc">{b.desc}</p>
                            <div className="cd-bnft-meta">
                              {b.rate > 0 && <span>적용률 {b.rate}%</span>}
                              {b.monthlyLimit > 0 && <span>월 한도 {Number(b.monthlyLimit).toLocaleString()}원</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                <div className="cd-benefits-grid">
                  {(card.benefits || []).map((b, i) => (
                    <div key={i} className="cd-benefit-card">
                      <span className="cd-bnft-badge">{b.type}</span>
                      <p className="cd-bnft-desc">{b.desc}</p>
                      <div className="cd-bnft-meta">
                        {b.discountRate > 0 && <span>할인율 {b.discountRate}%</span>}
                        {b.monthlyLimit > 0 && (
                          <span>월 한도 {Number(b.monthlyLimit).toLocaleString()}원</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <p className="cd-service-notice">
                ※ 전월실적 및 서비스 세부조건은 상품안내장 및 홈페이지 참고<br />
                ※ 서비스 제공 조건: 전월 실적 전 1일부터 말일까지(승인시점 기준) 국내외 가맹점에서의 원시점/부분 이용실적 기준으로 적립됩니다.
              </p>
            </div>
          )}

          {/* ---- 연회비·수수료 탭 ---- */}
          {activeTab === 'fee' && (
            <div className="cd-tab-content">
              <div className="cd-fee-section">
                <h3 className="cd-fee-title">연회비</h3>
                {card.type === '신용카드' ? (
                  <ul className="cd-fee-list">
                    <li>국내전용(국내 로컬) 개인회원 : {card.annualFee == null ? '선택형 (10,000~100,000원)' : card.annualFee == null ? '선택형' : card.annualFee > 0 ? `${card.annualFee.toLocaleString()}원` : '없음'}</li>
                    <li>국내외겸용(마스터) 개인회원 : {card.annualFee == null ? '선택형 (13,000~103,000원)' : card.annualFee == null ? '선택형' : card.annualFee > 0 ? `${(card.annualFee + 3000).toLocaleString()}원` : '없음'}</li>
                    <li>국내외겸용(비자) 개인회원 : {card.annualFee == null ? '선택형 (13,000~103,000원)' : card.annualFee == null ? '선택형' : card.annualFee > 0 ? `${(card.annualFee + 3000).toLocaleString()}원` : '없음'}</li>
                  </ul>
                ) : (
                  <ul className="cd-fee-list">
                    <li>발급수수료 : 1,000원 (발급 시 1회 부과)</li>
                    <li>연회비 : 없음</li>
                  </ul>
                )}
              </div>
              <div className="cd-fee-section">
                <h3 className="cd-fee-title">연회비 반환조건 안내</h3>
                <p className="cd-fee-text">
                  카드 유효기간이 도래하기 전에 카드를 해지하는 경우 연회비 반환 금액은 계약을 해지한 날로부터 일할 계산하며, 10영업일 이내 반환 처리됩니다.
                  다만 부가서비스 제공내역 확인에 시간이 소요되는 등의 불가피한 사유로 10영업일 이내에 반환하기 어려운 경우 계약서 해지일로부터 3개월 이내에 반환할 수 있습니다.
                </p>
              </div>
              <div className="cd-fee-section">
                <h3 className="cd-fee-title">해외이용 수수료 안내</h3>
                <ul className="cd-fee-list">
                  <li>해외 가맹점 이용 수수료 : 국제브랜드 수수료(1.0%) + 해외이용수수료(0.25%)</li>
                  <li>해외 현금인출 조회수수료 : 거래 건당 USD 0.5$</li>
                  <li>해외 현금인출 인출수수료 : 거래 건당 USD 3$ + 국제브랜드 수수료(1.0%)</li>
                  <li>해외 현금인출 한도 : 계좌 잔액 범위 내 가능, 현금인출 등록 시 1일 500만원·월간 500만원 한도</li>
                </ul>
              </div>
            </div>
          )}

          {/* ---- 기타 탭 ---- */}
          {activeTab === 'etc' && (
            <div className="cd-tab-content">
              <div className="cd-etc-section">
                <h3 className="cd-fee-title">회원님을 위한 기타 안내 사항</h3>
                <ul className="cd-fee-list">
                  <li>카드 이용 시 제공되는 포인트 및 할인혜택 등의 부가서비스는 상품출시일로부터 3년 이상 축소·폐지 없이 유지됩니다.</li>
                  <li>2개 이상의 복수카드 소지자 정보는 한국신용정보원을 통해 신용사간 공유됨에 따라 본인의 신용등급 또는 개인신용평점에 영향을 줄 수 있습니다.</li>
                  <li>결제계좌 개설기관의 영업 마감시간(16시) 이후 결제계좌에 입금된 금액에 대해서는 당일 출금되지 못하여 연체로 처리될 수 있으므로 유의하시기 바랍니다.</li>
                  <li>자동납부 업무 마감시간 이후 카드 대금결제는 BNK부산은행 홈페이지 및 부산은행 모바일 앱 등에서 즉시 결제 또는 가상계좌 입금(송금납부)을 통해 당일 결제가 가능합니다.</li>
                </ul>
              </div>
              <div className="cd-etc-section">
                <h3 className="cd-fee-title">유의사항</h3>
                <ul className="cd-fee-list cd-fee-list--notice">
                  <li>※ 상환능력에 비해 신용카드 사용액이 과도할 경우, 귀하의 개인신용평점이 하락할 수 있습니다.</li>
                  <li>※ 개인신용평점 하락 시 금융거래와 관련된 불이익이 발생할 수 있습니다.</li>
                  <li>※ 일정기간 납부대금 등을 연체할 경우, 모든 원리금을 변제할 의무가 발생할 수 있습니다.</li>
                  <li>※ 신용카드 발급이 부적정한 경우(연체금 보유, 신용점수 등 낮음) 카드발급이 제한될 수 있습니다.</li>
                  <li>※ 연체이자율(약정이율+최대 3%)은 정상 이자율에 따라 차등 적용되며, 법정 최고금리(연 20%)를 초과하지 않습니다.</li>
                </ul>
              </div>
            </div>
          )}

          {/* ---- 상품약관 탭 ---- */}
          {activeTab === 'terms' && (
            <div className="cd-tab-content">
              {(card.terms && card.terms.length > 0) ? (
                <ul className="cd-terms-list">
                  {card.terms.map(t => (
                    t.pdfPath ? (
                      <li key={t.id}>
                        <a className="cd-terms-item" href={`/uploads/terms/${t.pdfPath}`} target="_blank" rel="noreferrer">
                          <span className="cd-terms-itemname">{t.docType || t.title}</span>
                          <span className="cd-terms-itemmeta">약관 보기 ›</span>
                        </a>
                      </li>
                    ) : (
                      <li key={t.id}>
                        <div className="cd-terms-item cd-terms-item--none">
                          <span className="cd-terms-itemname">{t.docType || t.title}</span>
                          <span className="cd-terms-itemmeta">준비중</span>
                        </div>
                      </li>
                    )
                  ))}
                </ul>
              ) : (
                <p className="cd-no-content">아직 등록된 약관이 없습니다.</p>
              )}

              {card.disclosure && (
                <p className="cd-service-notice" style={{ marginTop: 20 }}>
                  공시승인번호: {card.disclosure.approvalCode}
                  {card.disclosure.disclosureDt && ` (공시일자: ${card.disclosure.disclosureDt.slice(0, 10)})`}
                </p>
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
          <CardVisual card={card} design={null} />

          {/* 신청 버튼 */}
          <div className="cd-actions">
            <button className="cd-btn-primary" onClick={handleApply}>
              인터넷 신청
            </button>
          </div>

          <Link to={`/terms?card_id=${id}`} className="cd-terms-link">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            약관·상품설명서 조회
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 'auto' }}>
              <path d="M9 18l6-6-6-6" />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  )
}

export default CardDetail
