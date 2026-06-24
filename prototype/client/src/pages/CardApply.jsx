import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom'
import './CardApply.css'

const STEPS = ['약관 동의', '본인 확인', '신청 정보', '완료']

const REQUIRED_TERMS = [
  { key: 'service',  label: '카드 서비스 이용약관 (필수)' },
  { key: 'privacy',  label: '개인정보 수집·이용 동의 (필수)' },
  { key: 'credit',   label: '신용정보 조회 동의 (필수)' },
]
const OPTIONAL_TERMS = [
  { key: 'marketing', label: '마케팅 정보 수신 동의 (선택)' },
  { key: 'third',     label: '제3자 정보 제공 동의 (선택)' },
]

function StepDots({ current }) {
  return (
    <div className="apply-steps">
      {STEPS.map((s, i) => (
        <div key={i} className={`apply-step ${i === current ? 'active' : i < current ? 'done' : ''}`}>
          <div className="apply-step-dot">{i < current ? '✓' : i + 1}</div>
          <span>{s}</span>
          {i < STEPS.length - 1 && <div className="apply-step-line" />}
        </div>
      ))}
    </div>
  )
}

export default function CardApply() {
  const { id }     = useParams()
  const navigate   = useNavigate()
  const location   = useLocation()
  const savedDesign = location.state?.design || null

  const [step, setStep]     = useState(0)
  const [card, setCard]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [resultId, setResultId] = useState(null)

  // Step 1: 약관 동의 상태
  const [agreed, setAgreed] = useState({})
  const allRequired = REQUIRED_TERMS.every(t => agreed[t.key])

  // Step 2: 본인 확인
  const [verify, setVerify] = useState({ name: '', birth: '', phone: '', otp: '' })
  const [otpSent, setOtpSent] = useState(false)

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
    if (!token) { navigate('/login'); return }
    fetch(`/api/cards/${id}`)
      .then(r => r.json())
      .then(data => { setCard(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [id, token, navigate])

  if (loading) return <div className="apply-loading"><div className="spinner" /></div>
  if (!card)   return <div className="apply-error">카드 정보를 찾을 수 없습니다.</div>

  const handleSendOtp = () => {
    if (!verify.name || !verify.birth || !verify.phone) {
      alert('이름, 생년월일, 전화번호를 입력해주세요.')
      return
    }
    setOtpSent(true)
    alert('인증번호가 발송되었습니다. (시뮬레이션: 123456)')
  }

  const handleSubmit = async () => {
    // 필수 항목 검증
    if (!form.billingAccount || !form.zipCode || !form.address ||
        !form.email || !form.residenceType || !form.incomeType) {
      alert('필수 항목(*)을 모두 입력해주세요.')
      return
    }
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
          applyMethod:    'INTERNET',
          designId:       savedDesign?.id || null
        })
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.message || '신청에 실패했습니다.')
        setSubmitting(false)
        return
      }
      setResultId(data.id)
      setStep(3)
    } catch {
      alert('서버 오류가 발생했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="apply-page">
      <div className="apply-header">
        <Link to={`/cards/${id}`} className="apply-back">← 상세로 돌아가기</Link>
        <h1 className="apply-title">{card.name} <span>신청</span></h1>
      </div>

      <StepDots current={step} />

      <div className="apply-body">
        {/* 카드 미니 프리뷰 */}
        <div
          className="apply-card-preview"
          style={{
            background: `linear-gradient(135deg, ${savedDesign?.colorFrom || savedDesign?.color_from || card.colorFrom}, ${savedDesign?.colorTo || savedDesign?.color_to || card.colorTo})`
          }}
        >
          <span className="acp-network">{card.network}</span>
          <span className="acp-name">{card.name}</span>
          {savedDesign && <span className="acp-design">✨ {savedDesign.themeName || savedDesign.theme_name}</span>}
        </div>

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
              {REQUIRED_TERMS.map(t => (
                <label key={t.key} className="terms-row">
                  <input
                    type="checkbox"
                    checked={!!agreed[t.key]}
                    onChange={e => setAgreed(p => ({ ...p, [t.key]: e.target.checked }))}
                  />
                  <span>{t.label}</span>
                </label>
              ))}
              {OPTIONAL_TERMS.map(t => (
                <label key={t.key} className="terms-row optional">
                  <input
                    type="checkbox"
                    checked={!!agreed[t.key]}
                    onChange={e => setAgreed(p => ({ ...p, [t.key]: e.target.checked }))}
                  />
                  <span>{t.label}</span>
                </label>
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
                    value={verify.phone}
                    onChange={e => setVerify(p => ({ ...p, phone: e.target.value }))}
                  />
                  <button className="btn-otp-send" onClick={handleSendOtp}>인증번호 발송</button>
                </div>
              </label>
              {otpSent && (
                <label className="apply-field">
                  <span>인증번호</span>
                  <input
                    type="text"
                    placeholder="123456"
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
                    placeholder="계좌번호 입력 (- 없이)"
                    value={form.billingAccount}
                    onChange={e => setForm(p => ({ ...p, billingAccount: e.target.value }))}
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
                  placeholder="우편번호"
                  value={form.zipCode}
                  onChange={e => setForm(p => ({ ...p, zipCode: e.target.value }))}
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
                <span>이메일 <em className="apply-req">*</em></span>
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
                  value={form.homePhone}
                  onChange={e => setForm(p => ({ ...p, homePhone: e.target.value }))}
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

              {savedDesign && (
                <div className="apply-design-confirm">
                  <span className="apply-design-label">선택된 AI 디자인</span>
                  <div className="apply-design-preview">
                    <div
                      className="apply-design-swatch"
                      style={{ background: `linear-gradient(135deg, ${savedDesign.colorFrom || savedDesign.color_from}, ${savedDesign.colorTo || savedDesign.color_to})` }}
                    />
                    <div>
                      <p className="apply-design-name">{savedDesign.themeName || savedDesign.theme_name}</p>
                      <p className="apply-design-desc">{savedDesign.designDescription || savedDesign.ai_description}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="apply-summary">
              <h3>신청 내역 확인</h3>
              <ul>
                <li><span>카드명</span><span>{card.name}</span></li>
                <li><span>신청자</span><span>{verify.name}</span></li>
                <li><span>연회비</span><span>{card.annualFee === 0 ? '없음' : `${card.annualFee.toLocaleString()}원`}</span></li>
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
                onClick={handleSubmit}
              >
                {submitting ? '신청 중...' : '신청 완료'}
              </button>
            </div>
          </div>
        )}

        {/* ===== STEP 3: 완료 ===== */}
        {step === 3 && (
          <div className="apply-step-panel apply-done">
            <div className="apply-done-icon">✓</div>
            <h2 className="apply-done-title">카드 신청이 완료되었습니다!</h2>
            <p className="apply-done-desc">
              신청번호 <strong>#{resultId}</strong><br />
              심사 결과는 영업일 기준 3~5일 이내에<br />
              등록하신 연락처로 안내드립니다.
            </p>
            <div className="apply-done-card"
              style={{ background: `linear-gradient(135deg, ${savedDesign?.colorFrom || savedDesign?.color_from || card.colorFrom}, ${savedDesign?.colorTo || savedDesign?.color_to || card.colorTo})` }}
            >
              <span>{card.name}</span>
            </div>
            <div className="apply-done-btns">
              <Link to="/cards" className="apply-btn-next">카드 더 보기</Link>
              <Link to="/" className="apply-btn-back">홈으로</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
