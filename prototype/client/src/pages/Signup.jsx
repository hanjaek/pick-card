import { useState, useRef, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import './Auth.css'

const DECO_CARDS = [
  { from: '#0E9F6E', to: '#6EE7B7', net: 'MASTER', name: 'BNK 그린라이프 체크카드' },
  { from: '#7C3AED', to: '#C084FC', net: 'VISA',   name: 'BNK 쇼핑플러스 신용카드' },
  { from: '#B45309', to: '#FCD34D', net: 'MASTER', name: 'BNK 알뜰 체크카드' },
]

const STEPS = [
  { key: 'idCapture', title: '신분증을 촬영해주세요',             sub: '주민등록증 또는 운전면허증을 준비해주세요' },
  { key: 'idConfirm', title: '정보를 확인해주세요',               sub: '신분증에서 읽어낸 정보입니다' },
  { key: 'username',  title: '사용할 아이디를\n입력해주세요',      sub: '영문/숫자 조합 6자 이상' },
  { key: 'password',  title: '비밀번호를\n설정해주세요',           sub: '8자 이상으로 입력해주세요' },
  { key: 'email',     title: '이메일 주소를\n입력해주세요',        sub: '카드 발급 안내를 받을 주소예요' },
]

export default function Signup() {
  const [step, setStep]     = useState(0)
  const [form, setForm]     = useState({
    name: '', birthdate: '', idNumber: '',
    username: '', password: '', confirmPassword: '', email: ''
  })
  const [error, setError]       = useState('')
  const [hint, setHint]         = useState('')
  const [loading, setLoading]   = useState(false)
  const [done, setDone]         = useState(false)
  const [showPw, setShowPw]     = useState(false)

  // Camera
  const [cameraOn, setCameraOn]       = useState(false)
  const [captured, setCaptured]       = useState(null)
  const [verifying, setVerifying]     = useState(false)
  const videoRef    = useRef(null)
  const streamRef   = useRef(null)
  const canvasRef   = useRef(null)

  const navigate = useNavigate()
  const inputRef = useRef(null)

  useEffect(() => {
    if (step >= 2) setTimeout(() => inputRef.current?.focus(), 120)
  }, [step])

  // Cleanup camera on unmount
  useEffect(() => {
    return () => stopCamera()
  }, [])

  const set = (key, val) => {
    setForm(prev => ({ ...prev, [key]: val }))
    setError('')
    setHint('')
  }

  /* ---- Camera ---- */
  useEffect(() => {
    if (cameraOn && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current
    }
  }, [cameraOn])

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      })
      streamRef.current = stream
      setCameraOn(true)
      setError('')
    } catch {
      setError('카메라 접근 권한이 필요합니다')
    }
  }, [])

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    setCameraOn(false)
  }, [])

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
    setCaptured(dataUrl)
    stopCamera()
  }, [stopCamera])

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      setCaptured(ev.target.result)
      stopCamera()
    }
    reader.readAsDataURL(file)
  }

  const retakePhoto = () => {
    setCaptured(null)
    setError('')
    startCamera()
  }

  /* ---- Verify ID ---- */
  const verifyIdCard = async () => {
    if (!captured) return
    setVerifying(true)
    setError('')

    try {
      const res = await fetch('/api/verify/id-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: captured }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.message || '신분증 인식에 실패했습니다.')
        setVerifying(false)
        return
      }

      setForm(prev => ({
        ...prev,
        name: data.name || prev.name,
        birthdate: data.birthdate || prev.birthdate,
        idNumber: data.idNumber || '',
      }))
      setStep(1)
    } catch {
      setError('서버 연결에 실패했습니다.')
    } finally {
      setVerifying(false)
    }
  }

  /* ---- Validation ---- */
  const validate = () => {
    const s = STEPS[step]?.key
    if (s === 'idConfirm' && !form.name.trim()) { setError('이름을 입력해주세요'); return false }
    if (s === 'username') {
      if (form.username.length < 6) { setError('아이디는 6자 이상이어야 해요'); return false }
      if (!/^[a-zA-Z0-9]+$/.test(form.username)) { setError('영문과 숫자만 사용할 수 있어요'); return false }
    }
    if (s === 'password') {
      if (form.password.length < 8) { setError('비밀번호는 8자 이상이어야 해요'); return false }
      if (form.password !== form.confirmPassword) { setError('비밀번호가 일치하지 않아요'); return false }
    }
    if (s === 'email' && !form.email.includes('@')) { setError('올바른 이메일 주소를 입력해주세요'); return false }
    return true
  }

  const goNext = () => {
    if (!validate()) return
    setError('')
    if (step < STEPS.length - 1) setStep(step + 1)
    else handleSubmit()
  }

  const goBack = () => {
    if (step === 1) {
      setCaptured(null)
      setStep(0)
    } else if (step > 0) {
      setStep(step - 1)
    }
    setError('')
  }

  /* ---- Submit ---- */
  const handleSubmit = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: form.username.trim(),
          password: form.password,
          name:     form.name.trim(),
          email:    form.email.trim(),
          birthdate: form.birthdate || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.message || '회원가입에 실패했습니다.'); setLoading(false); return }
      setDone(true)
    } catch {
      setError('서버 연결에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); goNext() }
  }

  const currentStep = STEPS[step]
  const isLast = step === STEPS.length - 1

  /* ---------- Brand panel ---------- */
  const brandPanel = (
    <div className="auth-brand">
      <div className="auth-brand-logo">
        <div className="auth-brand-mark">BNK</div>
        <span className="auth-brand-name">Pickard</span>
      </div>
      <h2 className="auth-brand-title">
        {done ? '환영합니다!' : '회원가입'}
      </h2>
      <p className="auth-brand-sub">
        {done
          ? <>AI 맞춤 카드 추천을<br/>받아보세요</>
          : <>Pickard 회원이 되시면<br/>AI 맞춤 카드 추천을 받으실 수 있습니다</>
        }
      </p>
      <div className="auth-deco-area">
        {DECO_CARDS.map((card, i) => (
          <div
            key={i}
            className={`auth-deco-card dc-${i + 1}`}
            style={{ background: `linear-gradient(145deg, ${card.from}, ${card.to})` }}
          >
            <div className="auth-deco-chip" />
            <span className="auth-deco-net">{card.net}</span>
            <span className="auth-deco-name">{card.name}</span>
          </div>
        ))}
      </div>
    </div>
  )

  /* ---------- Completion ---------- */
  if (done) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          {brandPanel}
          <div className="auth-form-side">
            <div className="auth-complete">
              <div className="auth-complete-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h1 className="auth-complete-title">가입이 완료되었어요!</h1>
              <p className="auth-complete-desc">
                {form.name}님, 실명확인과 회원가입이<br />
                모두 완료되었습니다.
              </p>
              <div className="auth-btn-area" style={{ width: '100%' }}>
                <button className="auth-btn auth-btn-primary" onClick={() => navigate('/login')}>
                  로그인하러 가기
                </button>
                <button className="auth-btn auth-btn-secondary" onClick={() => navigate('/')}>
                  홈으로
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  /* ---------- Main form ---------- */
  return (
    <div className="auth-page">
      <div className="auth-card">
        {brandPanel}

        <div className="auth-form-side">
          {/* Back */}
          <button className="auth-back" onClick={step === 0 ? () => navigate(-1) : goBack}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            {step === 0 ? '뒤로' : '이전'}
          </button>

          {/* Step dots */}
          <div className="auth-steps">
            {STEPS.map((_, i) => (
              <div key={i} className={`auth-step-dot ${i < step ? 'done' : i === step ? 'active' : ''}`} />
            ))}
          </div>

          {/* Title */}
          <h1 className="auth-title">
            {currentStep.title.split('\n').map((line, i, arr) => (
              <span key={i}>{line}{i < arr.length - 1 && <br />}</span>
            ))}
          </h1>
          <p className="auth-subtitle">{currentStep.sub}</p>

          <div className="auth-form">

            {/* ===== Step 0: ID Card Capture ===== */}
            {step === 0 && (
              <>
                <canvas ref={canvasRef} style={{ display: 'none' }} />

                {!captured && !cameraOn && (
                  <>
                    <div className="id-start-area">
                      <div className="id-icon-box">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--bnk-red)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="2" y="4" width="20" height="16" rx="2" />
                          <circle cx="8.5" cy="11" r="2" />
                          <path d="M14 10h4M14 14h4" />
                          <path d="M6 16c0-1.5 1.1-2 2.5-2s2.5.5 2.5 2" />
                        </svg>
                      </div>
                      <p className="id-guide-text">주민등록증 또는 운전면허증의<br/>앞면을 촬영하거나 업로드해주세요</p>
                    </div>
                    <div className="auth-btn-area">
                      <button className="auth-btn auth-btn-primary" onClick={startCamera}>
                        카메라로 촬영하기
                      </button>
                      <label className="auth-btn auth-btn-secondary" style={{ textAlign: 'center', display: 'block', cursor: 'pointer' }}>
                        사진 업로드하기
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFileUpload}
                          style={{ display: 'none' }}
                        />
                      </label>
                    </div>
                  </>
                )}

                {cameraOn && !captured && (
                  <div className="id-camera-area">
                    <div className="id-viewfinder">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="id-video"
                      />
                      <div className="id-guide-overlay">
                        <div className="id-guide-rect">
                          <span className="id-corner tl" />
                          <span className="id-corner tr" />
                          <span className="id-corner bl" />
                          <span className="id-corner br" />
                        </div>
                        <p className="id-guide-label">신분증을 가이드 안에 맞춰주세요</p>
                      </div>
                    </div>
                    <div className="id-camera-btns">
                      <button className="id-capture-btn" onClick={capturePhoto}>
                        <div className="id-capture-inner" />
                      </button>
                    </div>
                  </div>
                )}

                {captured && (
                  <>
                    <div className="id-preview-wrap">
                      <img src={captured} alt="신분증" className="id-preview-img" />
                      <div className="id-preview-badge">촬영 완료</div>
                    </div>
                    {error && <div className="auth-error" style={{ marginTop: 16 }}>{error}</div>}
                    <div className="auth-btn-area">
                      <button className="auth-btn auth-btn-primary" onClick={verifyIdCard} disabled={verifying}>
                        {verifying ? '확인 중...' : '신분증 확인하기'}
                      </button>
                      <button className="auth-btn auth-btn-secondary" onClick={retakePhoto}>
                        다시 촬영하기
                      </button>
                    </div>
                  </>
                )}
              </>
            )}

            {/* ===== Step 1: ID Confirm ===== */}
            {step === 1 && (
              <>
                <div className="id-confirm-card">
                  <div className="id-confirm-badge">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                    실명확인 완료
                  </div>

                  <div className="id-confirm-row">
                    <span className="id-confirm-label">이름</span>
                    <span className="id-confirm-value">{form.name}</span>
                  </div>
                  <div className="id-confirm-row">
                    <span className="id-confirm-label">생년월일</span>
                    <span className="id-confirm-value">{form.birthdate || '-'}</span>
                  </div>
                  <div className="id-confirm-row">
                    <span className="id-confirm-label">주민등록번호</span>
                    <span className="id-confirm-value">{form.idNumber || '-'}</span>
                  </div>
                </div>

                <div className="auth-field" style={{ marginTop: 16 }}>
                  <label className="auth-label">이름 수정</label>
                  <input
                    ref={inputRef}
                    className="auth-input"
                    type="text"
                    placeholder="이름 확인"
                    value={form.name}
                    onChange={(e) => set('name', e.target.value)}
                    onKeyDown={handleKeyDown}
                  />
                  {error && <p className="auth-hint error">{error}</p>}
                  <p className="auth-hint">정보가 다르면 수정해주세요</p>
                </div>

                <div className="auth-btn-area">
                  <button className="auth-btn auth-btn-primary" onClick={goNext}>
                    확인했어요
                  </button>
                </div>
              </>
            )}

            {/* ===== Step 2: Username ===== */}
            {step === 2 && (
              <div className="auth-field">
                <label className="auth-label">아이디</label>
                <input
                  ref={inputRef}
                  className={`auth-input${error ? ' error' : ''}`}
                  type="text"
                  placeholder="pickard123"
                  value={form.username}
                  onChange={(e) => {
                    set('username', e.target.value)
                    if (e.target.value.length >= 6 && /^[a-zA-Z0-9]+$/.test(e.target.value)) {
                      setHint('사용 가능한 아이디예요')
                    }
                  }}
                  onKeyDown={handleKeyDown}
                  autoComplete="username"
                />
                {error && <p className="auth-hint error">{error}</p>}
                {!error && hint && <p className="auth-hint success">{hint}</p>}
              </div>
            )}

            {/* ===== Step 3: Password ===== */}
            {step === 3 && (
              <>
                <div className="auth-field">
                  <label className="auth-label">비밀번호</label>
                  <div className="auth-input-wrap">
                    <input
                      ref={inputRef}
                      className={`auth-input${error && form.password.length < 8 ? ' error' : ''}`}
                      type={showPw ? 'text' : 'password'}
                      placeholder="8자 이상 입력"
                      value={form.password}
                      onChange={(e) => set('password', e.target.value)}
                      onKeyDown={handleKeyDown}
                      autoComplete="new-password"
                    />
                    <button type="button" className="auth-pw-toggle" onClick={() => setShowPw(!showPw)} tabIndex={-1}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        {showPw ? (
                          <>
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </>
                        ) : (
                          <>
                            <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
                            <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
                            <line x1="1" y1="1" x2="23" y2="23" />
                          </>
                        )}
                      </svg>
                    </button>
                  </div>
                  {!error && form.password.length > 0 && form.password.length < 8 && (
                    <p className="auth-hint error">8자 이상 입력해주세요</p>
                  )}
                  {!error && form.password.length >= 8 && (
                    <p className="auth-hint success">사용 가능한 비밀번호예요</p>
                  )}
                  {error && error.includes('8자') && <p className="auth-hint error">{error}</p>}
                </div>
                <div className="auth-field">
                  <label className="auth-label">비밀번호 확인</label>
                  <input
                    className={`auth-input${error && form.password !== form.confirmPassword ? ' error' : ''}`}
                    type={showPw ? 'text' : 'password'}
                    placeholder="한번 더 입력해주세요"
                    value={form.confirmPassword}
                    onChange={(e) => set('confirmPassword', e.target.value)}
                    onKeyDown={handleKeyDown}
                    autoComplete="new-password"
                  />
                  {!error && form.confirmPassword && form.password === form.confirmPassword && (
                    <p className="auth-hint success">비밀번호가 일치해요</p>
                  )}
                  {!error && form.confirmPassword && form.password !== form.confirmPassword && (
                    <p className="auth-hint error">비밀번호가 일치하지 않아요</p>
                  )}
                  {error && error.includes('일치') && <p className="auth-hint error">{error}</p>}
                </div>
              </>
            )}

            {/* ===== Step 4: Email ===== */}
            {step === 4 && (
              <div className="auth-field">
                <label className="auth-label">이메일</label>
                <input
                  ref={inputRef}
                  className={`auth-input${error ? ' error' : ''}`}
                  type="email"
                  placeholder="example@email.com"
                  value={form.email}
                  onChange={(e) => set('email', e.target.value)}
                  onKeyDown={handleKeyDown}
                  autoComplete="email"
                />
                {error && <p className="auth-hint error">{error}</p>}
              </div>
            )}

            {/* Next button (steps 2~4) */}
            {step >= 2 && (
              <div className="auth-btn-area">
                <button
                  className="auth-btn auth-btn-primary"
                  disabled={loading}
                  onClick={goNext}
                >
                  {loading ? '처리 중...' : isLast ? '가입하기' : '다음'}
                </button>
                {step === 2 && (
                  <p className="auth-footer">
                    이미 계정이 있으신가요? <Link to="/login">로그인</Link>
                  </p>
                )}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
