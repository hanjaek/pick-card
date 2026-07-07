import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom'
import { LIFE_CARD_GROWTH, currentSimpleRate } from '../constants/lifeCardBenefit'
import './CardApply.css'

const BASE_STEPS    = ['약관 동의', '본인 확인', '신청 정보', '완료']
const LIFE_STEPS    = ['약관 동의', '본인 확인', '신청 정보', '혜택 안내', '완료']

const REQUIRED_TERMS = [
  { key: 'service',  label: '카드 서비스 이용약관 (필수)' },
  { key: 'privacy',  label: '개인정보 수집·이용 동의 (필수)' },
  { key: 'credit',   label: '신용정보 조회 동의 (필수)' },
]
const OPTIONAL_TERMS = [
  { key: 'marketing', label: '마케팅 정보 수신 동의 (선택)' },
  { key: 'third',     label: '제3자 정보 제공 동의 (선택)' },
]

const DOC_TYPE_KEY = { '이용약관': 'service', '포인트이용약관': 'points', '상품안내장': 'guide' }

const GENERIC_TERMS = {
  privacy: {
    title: '개인정보 수집·이용 동의',
    content: `■ 개인정보 수집·이용 동의\n\n부산은행(이하 "은행")은 카드 발급 및 서비스 운영을 위해 아래와 같이 개인정보를 수집·이용합니다.\n\n【 수집·이용 목적 】\n- 카드 발급 심사 및 본인 확인\n- 카드 이용 관련 서비스 제공(청구서 발송, 결제 처리 등)\n- 이상거래 탐지 및 부정사용 방지\n- 법령상 의무 이행\n\n【 수집 항목 】\n필수: 성명, 생년월일, 연락처(전화번호·이메일), 주소, 직업정보, 소득정보, 결제계좌 정보\n\n【 보유 및 이용 기간 】\n카드 해지 후 5년 (관련 법령에 따라 일부 항목은 최대 10년까지 보유)\n\n※ 위 동의를 거부할 권리가 있으나, 거부 시 카드 발급이 불가합니다.`,
  },
  credit: {
    title: '신용정보 조회 동의',
    content: `■ 신용정보 조회 동의\n\n부산은행은 카드 발급 심사를 위해 아래와 같이 신용정보를 조회합니다.\n\n【 조회 목적 】\n카드 발급 적격 여부 심사 및 이용한도 산정\n\n【 조회 기관 】\n- 나이스평가정보(주)\n- 코리아크레딧뷰로(주)\n- 한국신용정보원\n\n【 조회 항목 】\n- 신용등급(점수) 및 신용거래 현황\n- 연체 정보, 공공기록 정보\n- 금융거래 실적 정보\n\n【 보유 및 이용 기간 】\n조회일로부터 3년\n\n※ 위 동의를 거부할 권리가 있으나, 거부 시 카드 발급이 불가합니다.`,
  },
  marketing: {
    title: '마케팅 정보 수신 동의',
    content: `■ 마케팅 정보 수신 동의 (선택)\n\n부산은행은 아래와 같이 마케팅 정보를 발송할 수 있습니다.\n\n【 이용 목적 】\n- 은행 및 제휴사 상품·서비스 안내\n- 이벤트, 프로모션, 혜택 정보 발송\n- 고객 맞춤형 금융상품 추천\n\n【 수신 채널 】\n문자(SMS/LMS), 이메일, 앱 푸시 알림\n\n【 보유 및 이용 기간 】\n동의일로부터 수신 거부 시까지 (최대 2년)\n\n※ 본 동의는 선택 사항이며, 동의하지 않아도 카드 발급에 영향이 없습니다.\n※ 수신 동의 후에도 언제든지 고객센터(1588-0145) 또는 앱을 통해 수신 거부할 수 있습니다.`,
  },
  third: {
    title: '제3자 정보 제공 동의',
    content: `■ 제3자 정보 제공 동의 (선택)\n\n부산은행은 서비스 제공을 위해 아래 제3자에게 개인정보를 제공할 수 있습니다.\n\n【 제공 받는 자 】\n- 카드 네트워크사(VISA, MASTER 등)\n- 제휴 포인트 운영사\n- 보험사(여행보험, 구매보험 등 카드 부가서비스 운영)\n\n【 제공 목적 】\n카드 결제 처리, 부가서비스 운영, 포인트 적립·사용\n\n【 제공 항목 】\n성명, 카드번호(일부), 이용내역, 포인트 잔액\n\n【 보유 기간 】\n제공 목적 달성 시 즉시 파기(최대 5년)\n\n※ 본 동의는 선택 사항이며, 동의하지 않아도 카드 발급에 영향이 없습니다.\n※ 단, 동의하지 않는 경우 일부 제휴 서비스 이용이 제한될 수 있습니다.`,
  },
}

function StepDots({ current, steps }) {
  return (
    <div className="apply-steps">
      {steps.map((s, i) => (
        <div key={i} className={`apply-step ${i === current ? 'active' : i < current ? 'done' : ''}`}>
          <div className="apply-step-dot">{i < current ? '✓' : i + 1}</div>
          <span>{s}</span>
          {i < steps.length - 1 && <div className="apply-step-line" />}
        </div>
      ))}
    </div>
  )
}

export default function CardApply() {
  const { id }     = useParams()
  const navigate   = useNavigate()
  const location   = useLocation()

  const [step, setStep]     = useState(0)
  const [card, setCard]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [resultId, setResultId] = useState(null)
  const [resultCardNo, setResultCardNo]   = useState(null)
  const [resultValid,  setResultValid]    = useState(null)

  // 평생카드 혜택 구성 (연회비는 고정, 가입 시점 한도 안에서 카테고리만 선택)
  const [benefitMode,  setBenefitMode]  = useState(null)   // null | 'simple' | 'custom'
  const [catalog,      setCatalog]      = useState([])
  const [benefitPicks, setBenefitPicks] = useState(new Set())

  // Step 1: 약관 동의 상태
  const [agreed, setAgreed] = useState({})
  const allRequired = REQUIRED_TERMS.every(t => agreed[t.key])
  const [termsData, setTermsData] = useState(GENERIC_TERMS)
  const [expandedTerm, setExpandedTerm] = useState(null)

  // Step 2: 본인 확인
  const [verify, setVerify] = useState({ name: '', birth: '', phone: '', otp: '' })
  const [otpSent, setOtpSent] = useState(false)
  const [autoFilled, setAutoFilled] = useState(false)

  // Step 3: 신청 정보
  const [form, setForm] = useState({
    email: '', zipCode: '', address: '', homePhone: '',
    residenceType: '', incomeType: '', jobYn: 'N',
    billingAccount: '', statementMethod: 'EMAIL',
    contractMethod: 'EMAIL', paperTermsYn: 'N',
    billingDay: '15', creditLimit: '3000000',
  })

  const token = localStorage.getItem('token')

  useEffect(() => {
    if (!token) { navigate(`/login?redirect=${encodeURIComponent(location.pathname)}`); return }
    fetch(`/api/cards/${id}`)
      .then(r => r.json())
      .then(data => { setCard(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [id, token, navigate])

  useEffect(() => {
    fetch('/api/auth/profile', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(profile => {
        if (!profile) return
        setVerify(p => ({
          ...p,
          name:  profile.name  || p.name,
          birth: profile.birth || p.birth,
          phone: profile.phone || p.phone,
        }))
        setForm(p => ({ ...p, email: profile.email || p.email }))
        if (profile.name || profile.birth || profile.phone || profile.email) {
          setAutoFilled(true)
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!card) return
    fetch(`/api/terms?card_id=${id}`)
      .then(r => r.ok ? r.json() : [])
      .then(rows => {
        const extra = {}
        rows.forEach(r => {
          const key = DOC_TYPE_KEY[r.doc_type]
          if (key && r.terms_content) extra[key] = { title: r.terms_title, content: r.terms_content }
        })
        setTermsData(prev => ({ ...prev, ...extra }))
      })
      .catch(() => {})
  }, [card, id])

  useEffect(() => {
    if (!card) return
    if (card.name !== 'BNK 영원카드') return
    fetch('/api/life-card/benefit-catalog')
      .then(r => r.ok ? r.json() : [])
      .then(setCatalog)
      .catch(() => {})
  }, [card])

  if (loading) return <div className="apply-loading"><div className="spinner" /></div>
  if (!card)   return <div className="apply-error">카드 정보를 찾을 수 없습니다.</div>

  const isLifeCard = card.name === 'BNK 영원카드'
  const STEPS      = isLifeCard ? LIFE_STEPS : BASE_STEPS
  const DONE_STEP  = isLifeCard ? 4 : 3

  // 신규 가입은 0년차 기준 한도(=기본 한도)로 시작
  const startBudget = LIFE_CARD_GROWTH[0].cap
  const startRate   = LIFE_CARD_GROWTH[0].rate
  const usedCost    = catalog.filter(b => benefitPicks.has(b.id)).reduce((s, b) => s + b.cost, 0)
  const remaining   = startBudget - usedCost
  const pct         = Math.min(100, Math.round(usedCost / startBudget * 100))

  function toggleBenefit(b) {
    setBenefitPicks(prev => {
      const n = new Set(prev)
      if (n.has(b.id)) { n.delete(b.id) } else {
        if (usedCost + b.cost > startBudget) return prev
        n.add(b.id)
      }
      return n
    })
  }

  const handleSendOtp = () => {
    if (!verify.name.trim()) { alert('이름을 입력해주세요.'); return }
    if (!verify.birth)       { alert('생년월일을 입력해주세요.'); return }
    if (!verify.phone.trim()) { alert('휴대폰 번호를 입력해주세요.'); return }
    if (!/^[0-9]{3}-[0-9]{3,4}-[0-9]{4}$/.test(verify.phone)) {
      alert('휴대폰 번호 형식이 올바르지 않습니다. (예: 010-1234-5678)')
      return
    }
    setOtpSent(true)
    alert('인증번호가 발송되었습니다.')
    // 실제 SMS 연동 전 데모 환경 — 문자 수신 후 자동입력되는 흐름을 흉내내기 위해
    // 발송 후 잠시 뒤 인증번호를 자동으로 채워준다 (화면에 코드값을 노출하지 않음)
    setTimeout(() => setVerify(p => ({ ...p, otp: '123456' })), 1400)
  }

  function validateStep2() {
    if (!form.billingAccount.trim()) { alert('결제 계좌번호를 입력해주세요.'); return false }
    if (!form.zipCode.trim())        { alert('우편번호를 입력해주세요.'); return false }
    if (!/^[0-9]{4,6}$/.test(form.zipCode)) { alert('우편번호는 숫자 4~6자리로 입력해주세요.'); return false }
    if (!form.address.trim())        { alert('주소를 입력해주세요.'); return false }
    if (!form.email.trim())          { alert('이메일을 입력해주세요.'); return false }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) { alert('이메일 형식이 올바르지 않습니다.'); return false }
    if (!form.residenceType)         { alert('주거형태를 선택해주세요.'); return false }
    if (!form.incomeType)            { alert('소득분류를 선택해주세요.'); return false }
    return true
  }

  const handleSubmit = async () => {
    if (!validateStep2()) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          cardId:         id,
          applicantName:  verify.name,
          birthDt:        verify.birth,
          phoneNo:        verify.phone,
          homePhone:      form.homePhone,
          email:          form.email,
          zipCode:        form.zipCode,
          address:        form.address,
          residenceType:  form.residenceType,
          incomeType:     form.incomeType,
          jobYn:          form.jobYn,
          billingAccount: form.billingAccount,
          statementMethod: form.statementMethod,
          contractMethod: form.contractMethod,
          paperTermsYn:   form.paperTermsYn,
          billingDay:     Number(form.billingDay),
          creditLimit:    card.type === '체크카드' ? 0 : Number(form.creditLimit),
          applyMethod:    'INTERNET'
        })
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.message || '신청에 실패했습니다.')
        setSubmitting(false)
        return
      }
      setResultId(data.id)
      setResultCardNo(data.cardNo || null)
      setResultValid(data.validThru || null)
      // 평생카드: 고른 혜택 구성 서버에 저장 (전체자동 모드면 전 카테고리를 저장)
      if (isLifeCard && token) {
        const benefitsToSave = benefitMode === 'simple' ? catalog.map(b => b.id) : [...benefitPicks]
        fetch('/api/life-card/my/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ selectedFee: startBudget, selectedBenefits: benefitsToSave, benefitMode }),
        }).catch(() => {})
      }
      setStep(DONE_STEP)
    } catch {
      alert('서버 오류가 발생했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  const cardGrad = `linear-gradient(135deg, ${card.colorFrom}, ${card.colorTo})`

  return (
    <div className="apply-page">

      {/* ── 히어로 ── */}
      <div className="apply-hero">
        <div className="apply-hero-color" style={{ background: cardGrad }} />
        <div className="apply-wrap apply-hero-inner">
          <div className="apply-hero-text">
            <Link to={`/cards/${id}`} className="apply-back">← 상세로 돌아가기</Link>
            <h1 className="apply-hero-name">{card.name}</h1>
            <div className="apply-hero-meta">
              <span>{card.network}</span>
              <span className="hero-sep">·</span>
              <span>{card.type}</span>
              <span className="hero-sep">·</span>
              <span>연회비 {card.annualFee == null ? '선택형' : card.annualFee == null ? '선택형' : card.annualFee === 0 ? '없음' : `${card.annualFee.toLocaleString()}원`}</span>
            </div>
            <p className="apply-hero-sub">카드 신청 · 발급까지 약 3분</p>
          </div>
          <div className="apply-hero-visual">
            {card.imageUrl ? (
              <img src={card.imageUrl} alt={card.name} className="apply-big-card-img" />
            ) : (
              <div className="apply-big-card" style={{ background: cardGrad }}>
                <span className="abc-network">{card.network}</span>
                <div className="abc-chip" />
                <span className="abc-name">{card.name}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── 스텝 바 ── */}
      <div className="apply-steps-bar">
        <div className="apply-wrap">
          <StepDots current={step} steps={STEPS} />
        </div>
      </div>

      {/* ── 본문 ── */}
      <div className="apply-wrap">
        <div className={`apply-grid ${step === DONE_STEP ? 'apply-grid--done' : ''}`}>

          <div className="apply-main">

        {/* ===== STEP 0: 약관 동의 ===== */}
        {step === 0 && (
          <div className="apply-step-panel">
            <h2 className="apply-step-title">약관 동의</h2>

            <div className="terms-all">
              <label className="terms-row all">
                <input
                  type="checkbox"
                  checked={[...REQUIRED_TERMS, ...OPTIONAL_TERMS].every(t => agreed[t.key])}
                  onChange={e => {
                    const val = e.target.checked
                    const next = {}
                    ;[...REQUIRED_TERMS, ...OPTIONAL_TERMS].forEach(t => { next[t.key] = val })
                    setAgreed(next)
                  }}
                />
                <span className="terms-label-all">전체 동의</span>
              </label>
            </div>

            <div className="terms-divider" />

            <div className="terms-list">
              {[
                ...REQUIRED_TERMS.map(t => ({ ...t, optional: false })),
                ...OPTIONAL_TERMS.map(t => ({ ...t, optional: true })),
              ].map(t => (
                <div key={t.key} className="terms-item">
                  <div className="terms-row-wrap">
                    <label className={`terms-row ${t.optional ? 'optional' : ''}`}>
                      <input
                        type="checkbox"
                        checked={!!agreed[t.key]}
                        onChange={e => setAgreed(p => ({ ...p, [t.key]: e.target.checked }))}
                      />
                      <span>{t.label}</span>
                    </label>
                    {termsData[t.key] && (
                      <button
                        type="button"
                        className="terms-view-btn"
                        onClick={() => setExpandedTerm(expandedTerm === t.key ? null : t.key)}
                      >
                        {expandedTerm === t.key ? '접기 ▲' : '보기 ▼'}
                      </button>
                    )}
                  </div>
                  {expandedTerm === t.key && termsData[t.key] && (
                    <div className="terms-content-box">
                      <p className="terms-content-title">{termsData[t.key].title}</p>
                      <pre className="terms-content-text">{termsData[t.key].content}</pre>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <button
              className="apply-btn-next"
              disabled={!allRequired}
              onClick={() => setStep(1)}
            >
              다음 단계
            </button>
          </div>
        )}

        {/* ===== STEP 1: 본인 확인 ===== */}
        {step === 1 && (
          <div className="apply-step-panel">
            <h2 className="apply-step-title">본인 확인</h2>
            <p className="apply-step-desc">실명확인을 위해 정보를 입력해주세요.</p>
            {autoFilled && (
              <div className="apply-autofill-banner">
                <span className="apply-autofill-icon">✓</span>
                회원정보로 자동 입력되었습니다. 내용을 확인 후 수정하세요.
              </div>
            )}

            <div className="apply-form">
              <label className="apply-field">
                <span>이름</span>
                <input
                  type="text"
                  placeholder="실명 입력"
                  value={verify.name}
                  onChange={e => setVerify(p => ({ ...p, name: e.target.value }))}
                />
              </label>
              <label className="apply-field">
                <span>생년월일</span>
                <input
                  type="date"
                  value={verify.birth}
                  onChange={e => setVerify(p => ({ ...p, birth: e.target.value }))}
                />
              </label>
              <label className="apply-field">
                <span>휴대폰 번호</span>
                <div className="apply-field-row">
                  <input
                    type="tel"
                    placeholder="010-0000-0000"
                    maxLength={13}
                    value={verify.phone}
                    onChange={e => setVerify(p => ({ ...p, phone: e.target.value.replace(/[^0-9-]/g, '') }))}
                  />
                  <button className="btn-otp-send" onClick={handleSendOtp}>인증번호 발송</button>
                </div>
              </label>
              {otpSent && (
                <label className="apply-field">
                  <span>인증번호</span>
                  <input
                    type="text"
                    placeholder="6자리 숫자 입력"
                    maxLength={6}
                    value={verify.otp}
                    onChange={e => setVerify(p => ({ ...p, otp: e.target.value }))}
                  />
                </label>
              )}
            </div>

            <div className="apply-btns">
              <button className="apply-btn-back" onClick={() => setStep(0)}>이전</button>
              <button
                className="apply-btn-next"
                disabled={!otpSent || verify.otp !== '123456'}
                onClick={() => setStep(2)}
              >
                다음 단계
              </button>
            </div>
          </div>
        )}

        {/* ===== STEP 2: 신청 정보 ===== */}
        {step === 2 && (
          <div className="apply-step-panel">
            <h2 className="apply-step-title">신청 정보 입력</h2>

            <div className="apply-form">

              {/* 청구 정보 */}
              <p className="apply-subhead">청구 정보</p>
              <label className="apply-field">
                <span>결제 계좌 <em className="apply-req">*</em></span>
                <div className="apply-field-row">
                  <input type="text" value="부산은행" disabled className="apply-fixed" />
                  <input
                    type="text"
                    placeholder="계좌번호 입력 (숫자)"
                    inputMode="numeric"
                    maxLength={20}
                    value={form.billingAccount}
                    onChange={e => setForm(p => ({ ...p, billingAccount: e.target.value.replace(/[^0-9]/g, '') }))}
                  />
                </div>
              </label>
              <label className="apply-field">
                <span>청구서 수령방법</span>
                <select
                  value={form.statementMethod}
                  onChange={e => setForm(p => ({ ...p, statementMethod: e.target.value }))}
                >
                  <option value="EMAIL">E-mail</option>
                  <option value="SMART">스마트 명세서</option>
                  <option value="POST_HOME">자택(우편)</option>
                  <option value="POST_WORK">직장(우편)</option>
                </select>
              </label>

              {/* 고객 정보 */}
              <p className="apply-subhead">고객 정보</p>
              <label className="apply-field">
                <span>우편번호 / 주소 <em className="apply-req">*</em></span>
                <input
                  type="text"
                  placeholder="우편번호 (숫자)"
                  inputMode="numeric"
                  maxLength={6}
                  value={form.zipCode}
                  onChange={e => setForm(p => ({ ...p, zipCode: e.target.value.replace(/[^0-9]/g, '') }))}
                  style={{ maxWidth: 140, marginBottom: 8 }}
                />
                <input
                  type="text"
                  placeholder="도로명 주소 입력"
                  value={form.address}
                  onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
                />
              </label>
              <label className="apply-field">
                <span>이메일 <em className="apply-req">*</em>{autoFilled && form.email && <span className="apply-autofill-tag">자동입력</span>}</span>
                <input
                  type="email"
                  placeholder="example@email.com"
                  value={form.email}
                  onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                />
              </label>
              <label className="apply-field">
                <span>자택전화 (선택)</span>
                <input
                  type="tel"
                  placeholder="051-000-0000"
                  maxLength={13}
                  value={form.homePhone}
                  onChange={e => setForm(p => ({ ...p, homePhone: e.target.value.replace(/[^0-9-]/g, '') }))}
                />
              </label>
              <label className="apply-field">
                <span>주거형태 <em className="apply-req">*</em></span>
                <select
                  value={form.residenceType}
                  onChange={e => setForm(p => ({ ...p, residenceType: e.target.value }))}
                >
                  <option value="">선택하세요</option>
                  <option value="자가">자가</option>
                  <option value="전세">전세</option>
                  <option value="월세">월세</option>
                  <option value="기타">기타</option>
                </select>
              </label>
              <label className="apply-field">
                <span>소득분류 <em className="apply-req">*</em></span>
                <select
                  value={form.incomeType}
                  onChange={e => setForm(p => ({ ...p, incomeType: e.target.value }))}
                >
                  <option value="">선택하세요</option>
                  <option value="근로소득">근로소득</option>
                  <option value="사업소득">사업소득</option>
                  <option value="기타">기타</option>
                </select>
              </label>
              <label className="apply-field">
                <span>직장유무 <em className="apply-req">*</em></span>
                <div className="apply-radio-row">
                  <label><input type="radio" name="jobYn" checked={form.jobYn === 'Y'} onChange={() => setForm(p => ({ ...p, jobYn: 'Y' }))} /> 유</label>
                  <label><input type="radio" name="jobYn" checked={form.jobYn === 'N'} onChange={() => setForm(p => ({ ...p, jobYn: 'N' }))} /> 무</label>
                </div>
              </label>

              {/* 계약서류 제공 */}
              <p className="apply-subhead">계약서류 제공</p>
              <label className="apply-field">
                <span>계약서류 수령방법 <em className="apply-req">*</em></span>
                <div className="apply-radio-row">
                  <label><input type="radio" name="contractM" checked={form.contractMethod === 'SMS'} onChange={() => setForm(p => ({ ...p, contractMethod: 'SMS' }))} /> 문자</label>
                  <label><input type="radio" name="contractM" checked={form.contractMethod === 'EMAIL'} onChange={() => setForm(p => ({ ...p, contractMethod: 'EMAIL' }))} /> 이메일</label>
                </div>
              </label>
              <label className="apply-field">
                <span>종이약관 추가수령</span>
                <div className="apply-radio-row">
                  <label><input type="radio" name="paperT" checked={form.paperTermsYn === 'Y'} onChange={() => setForm(p => ({ ...p, paperTermsYn: 'Y' }))} /> 수령</label>
                  <label><input type="radio" name="paperT" checked={form.paperTermsYn === 'N'} onChange={() => setForm(p => ({ ...p, paperTermsYn: 'N' }))} /> 미수령</label>
                </div>
              </label>

              {/* 카드 옵션 */}
              <p className="apply-subhead">카드 옵션</p>
              <label className="apply-field">
                <span>결제일</span>
                <select
                  value={form.billingDay}
                  onChange={e => setForm(p => ({ ...p, billingDay: e.target.value }))}
                >
                  {[10, 15, 20, 25].map(d => (
                    <option key={d} value={d}>매월 {d}일</option>
                  ))}
                </select>
              </label>
              {card.type === '신용카드' && (
                <label className="apply-field">
                  <span>신청 한도</span>
                  <select
                    value={form.creditLimit}
                    onChange={e => setForm(p => ({ ...p, creditLimit: e.target.value }))}
                  >
                    <option value="1000000">100만원</option>
                    <option value="3000000">300만원</option>
                    <option value="5000000">500만원</option>
                    <option value="10000000">1,000만원</option>
                  </select>
                </label>
              )}

            </div>

            <div className="apply-summary">
              <h3>신청 내역 확인</h3>
              <ul>
                <li><span>카드명</span><span>{card.name}</span></li>
                <li><span>신청자</span><span>{verify.name}</span></li>
                <li><span>연회비</span><span>{card.annualFee == null ? '선택형' : card.annualFee === 0 ? '없음' : `${card.annualFee.toLocaleString()}원`}</span></li>
                <li><span>결제일</span><span>매월 {form.billingDay}일</span></li>
                {card.type === '신용카드' && (
                  <li><span>신청한도</span><span>{Number(form.creditLimit).toLocaleString()}원</span></li>
                )}
              </ul>
            </div>

            <div className="apply-btns">
              <button className="apply-btn-back" onClick={() => setStep(1)}>이전</button>
              <button
                className="apply-btn-next"
                disabled={submitting}
                onClick={() => isLifeCard ? (validateStep2() && setStep(3)) : handleSubmit()}
              >
                {isLifeCard ? '다음 단계' : (submitting ? '신청 중...' : '신청 완료')}
              </button>
            </div>
          </div>
        )}

        {/* ===== STEP 3: 혜택 구성 (평생카드 전용) ===== */}
        {step === 3 && isLifeCard && (
          <div className="apply-step-panel apply-benefit-panel">

            <div className="apply-benefit-header">
              <span className="apply-benefit-eyebrow">평생카드 전용</span>
              <h2 className="apply-benefit-title">혜택을 어떻게<br/>받으시겠어요?</h2>
              <p className="apply-benefit-sub">연회비는 15,000원 고정이에요. 방식은 언제든 마이페이지에서 바꿀 수 있어요</p>
            </div>

            {/* 선택 카드 2종 */}
            <div className="apply-bc-list">
              <button
                className={`apply-bc-row ${benefitMode === 'simple' ? 'active' : ''}`}
                onClick={() => setBenefitMode('simple')}
              >
                <div className="apply-bc-left">
                  <div className="apply-bc-pct">{currentSimpleRate(0)}%</div>
                </div>
                <div className="apply-bc-body">
                  <p className="apply-bc-name">편하게 할게요</p>
                  <p className="apply-bc-info">고르지 않고 전 카테고리에 자동 적용 · 할인율은 낮아요</p>
                </div>
                <div className={`apply-bc-radio ${benefitMode === 'simple' ? 'on' : ''}`} />
              </button>

              <button
                className={`apply-bc-row ${benefitMode === 'custom' ? 'active' : ''}`}
                onClick={() => setBenefitMode('custom')}
              >
                <div className="apply-bc-left apply-bc-left--icons">
                  {(catalog.length ? catalog : [{icon:'☕'},{icon:'🚌'},{icon:'💳'},{icon:'🛍'}]).slice(0,4).map((b,i) => (
                    <span key={i} className="apply-bc-mini">{b.icon}</span>
                  ))}
                </div>
                <div className="apply-bc-body">
                  <p className="apply-bc-name">직접 골라볼게요</p>
                  <p className="apply-bc-info">한도 안에서 원하는 카테고리만 · 할인율은 정상({startRate}%)</p>
                </div>
                <div className={`apply-bc-radio ${benefitMode === 'custom' ? 'on' : ''}`} />
              </button>
            </div>

            {/* 편하게: 전체 카테고리 자동 확인 */}
            {benefitMode === 'simple' && (
              <div className="apply-auto-confirm">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <circle cx="10" cy="10" r="10" fill="#22C55E"/>
                  <path d="M5.5 10.5L8.5 13.5L14.5 7" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <div>
                  <p className="apply-auto-confirm-title">전 카테고리에 {currentSimpleRate(0)}% 자동 할인이 적용돼요</p>
                  <p className="apply-auto-confirm-desc">카테고리를 고를 필요 없이 모든 소비에 자동으로 적용돼요. 연차가 쌓이면 할인율도 자동으로 올라가요.</p>
                </div>
              </div>
            )}

            {/* 직접 선택: 한도 안에서 카테고리 선택 */}
            {benefitMode === 'custom' && (
              <div className="apply-mini-builder">

                {/* 한도 바 */}
                <div className="apply-mb-section apply-budget-bar">
                  <div className="apply-budget-info">
                    <span className="apply-budget-used">{usedCost.toLocaleString()}원</span>
                    <span className="apply-budget-sep">&nbsp;/&nbsp;{startBudget.toLocaleString()}원</span>
                    <span className="apply-budget-pct">{pct}%</span>
                    {remaining > 0 && <span className="apply-budget-remain">잔여 {remaining.toLocaleString()}원</span>}
                  </div>
                  <div className="apply-bar-track">
                    {catalog.filter(b => benefitPicks.has(b.id)).map(b => (
                      <div key={b.id} className="apply-bar-seg"
                        style={{ width: `${(b.cost / startBudget) * 100}%`, background: b.color, minWidth: 4 }}
                      />
                    ))}
                    {pct === 0 && <div className="apply-bar-empty" />}
                  </div>
                </div>

                {/* 혜택 카탈로그 */}
                <div className="apply-mb-section">
                  <p className="apply-mb-label">혜택 선택
                    <span className="apply-mb-badge">{benefitPicks.size}개 선택됨</span>
                  </p>
                  <div className="apply-catalog-grid">
                    {catalog.map(b => {
                      const on        = benefitPicks.has(b.id)
                      const wouldOver = !on && usedCost + b.cost > startBudget
                      return (
                        <button
                          key={b.id}
                          className={`apply-cat-item ${on ? 'on' : ''} ${wouldOver ? 'dim' : ''}`}
                          style={on ? { borderColor: b.color, background: `${b.color}10` } : {}}
                          onClick={() => toggleBenefit(b)}
                          disabled={wouldOver}
                        >
                          {on && (
                            <span className="apply-cat-on" style={{ background: b.color }}>
                              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                <path d="M1.5 5L4 7.5L8.5 2.5" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </span>
                          )}
                          <span className="apply-cat-icon">{b.icon}</span>
                          <span className="apply-cat-label">{b.label}</span>
                          <span className="apply-cat-val" style={on ? { color: b.color } : {}}>{startRate}% 할인</span>
                          <span className={`apply-cat-cost ${wouldOver ? 'over' : ''}`}>{(b.cost / 1000).toLocaleString()}천원</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            <div className="apply-btns">
              <button className="apply-btn-back" onClick={() => setStep(2)}>이전</button>
              <button
                className="apply-btn-next"
                disabled={!benefitMode || (benefitMode === 'custom' && benefitPicks.size === 0) || submitting}
                onClick={handleSubmit}
              >
                {submitting ? '신청 중…' : !benefitMode ? '방식을 선택해주세요' : '이 방식으로 신청하기'}
              </button>
            </div>
          </div>
        )}

        {/* ===== STEP 4: 발급 완료 (평생카드) / STEP 3: 발급 완료 (일반) ===== */}
        {step === DONE_STEP && (
          <div className="apply-step-panel apply-done">
            <div className="apply-done-icon">✓</div>
            <h2 className="apply-done-title">카드가 발급되었습니다! 🎉</h2>
            <p className="apply-done-desc">
              축하합니다, <strong>{verify.name}</strong>님!<br />
              <strong>{card.name}</strong>가 발급되어 지금 바로 사용하실 수 있어요.
            </p>

            <div className="apply-done-card adc"
              style={{ background: `linear-gradient(135deg, ${card.colorFrom}, ${card.colorTo})` }}
            >
              <span className="adc-net">{card.network}</span>
              <div className="adc-chip" />
              <span className="adc-name">{card.name}</span>
              <span className="adc-no">{resultCardNo || '5310-••**-****-••••'}</span>
              <span className="adc-valid">VALID THRU&nbsp;&nbsp;{resultValid || '--/--'}</span>
            </div>

            <div className="apply-done-info">
              <div><span>발급 상태</span><strong className="ok">발급 완료</strong></div>
              <div><span>결제일</span><strong>매월 {form.billingDay}일</strong></div>
              <div><span>연회비</span><strong>{card.annualFee == null ? '선택형' : card.annualFee === 0 ? '없음' : `${card.annualFee.toLocaleString()}원`}</strong></div>
            </div>

            <div className="apply-done-btns">
              <Link to="/mypage" className="apply-btn-next">MY페이지에서 관리하기 →</Link>
              <Link to="/" className="apply-btn-back">홈으로</Link>
            </div>
          </div>
        )}

          </div>{/* apply-main */}

          {/* ── 사이드바 ── */}
          {step !== DONE_STEP && (
            <aside className="apply-sidebar">
              {card.imageUrl ? (
                <img src={card.imageUrl} alt={card.name} className="sidebar-card-img" />
              ) : (
                <div className="sidebar-card" style={{ background: cardGrad }}>
                  <span className="scard-network">{card.network}</span>
                  <div className="scard-chip" />
                  <div className="scard-bottom">
                    <span className="scard-name">{card.name}</span>
                  </div>
                </div>
              )}
              <div className="sidebar-info">
                <div className="sinfo-row"><span>카드 유형</span><strong>{card.type}</strong></div>
                <div className="sinfo-row"><span>네트워크</span><strong>{card.network}</strong></div>
                <div className="sinfo-row"><span>연회비</span><strong>{card.annualFee == null ? '선택형' : card.annualFee === 0 ? '없음' : `${card.annualFee.toLocaleString()}원`}</strong></div>
                {verify.name && step >= 1 && (
                  <div className="sinfo-row sinfo-row--highlight"><span>신청자</span><strong>{verify.name}</strong></div>
                )}
              </div>
              <div className="sidebar-step-guide">
                <p className="ssg-step">STEP {step + 1} / {STEPS.length}</p>
                <p className="ssg-label">{STEPS[step]}</p>
                <p className="ssg-desc">{[
                  '필수 약관에 동의해주세요. 선택 약관은 동의하지 않아도 신청 가능합니다.',
                  '본인 명의 휴대폰으로 실명을 인증합니다.',
                  '결제 계좌, 주소 등 신청에 필요한 정보를 입력합니다.',
                  '원하는 혜택 구성 방식을 선택합니다. 나중에 마이페이지에서 변경 가능합니다.',
                ][step]}</p>
              </div>
            </aside>
          )}

        </div>{/* apply-grid */}
      </div>{/* apply-wrap */}

    </div>
  )
}
