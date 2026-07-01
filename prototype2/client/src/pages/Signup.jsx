import { useState, useRef, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import './Auth.css'

const DECO_CARDS = [
  { from: '#0E9F6E', to: '#6EE7B7', net: 'MASTER', name: 'BNK 그린라이프 체크카드' },
  { from: '#7C3AED', to: '#C084FC', net: 'VISA',   name: 'BNK 쇼핑플러스 신용카드' },
  { from: '#B45309', to: '#FCD34D', net: 'MASTER', name: 'BNK 알뜰 체크카드' },
]

const STEPS = [
  { key: 'idCapture',  title: '신분증을 촬영해주세요',              sub: '주민등록증 또는 운전면허증을 준비해주세요' },
  { key: 'idConfirm',  title: '정보를 확인해주세요',                sub: '신분증에서 읽어낸 정보입니다' },
  { key: 'faceVerify', title: '얼굴 인식으로\n본인을 확인해요',     sub: '카메라를 정면으로 바라봐주세요' },
  { key: 'username',   title: '사용할 아이디를\n입력해주세요',      sub: '영문/숫자 조합 6자 이상' },
  { key: 'password',   title: '비밀번호를\n설정해주세요',           sub: '8자 이상으로 입력해주세요' },
  { key: 'email',      title: '이메일 주소를\n입력해주세요',        sub: '카드 발급 안내를 받을 주소예요' },
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

  // ID Card Camera
  const [cameraOn, setCameraOn]             = useState(false)
  const [captured, setCaptured]             = useState(null)
  const [verifying, setVerifying]           = useState(false)
  const [idAutoCapturing, setIdAutoCapturing] = useState(false)
  const videoRef    = useRef(null)
  const streamRef   = useRef(null)
  const canvasRef   = useRef(null)
  const idTimerRef  = useRef(null)

  // 본인확인 방식 선택 (null=선택화면, 'face'=얼굴인식, 'video'=영상통화, 'phone'=전화)
  const [verifyMethod, setVerifyMethod]         = useState(null)

  // Face Verify Camera
  const [faceCameraOn, setFaceCameraOn]         = useState(false)
  const [faceCaptured, setFaceCaptured]         = useState(null)
  const [faceVerifying, setFaceVerifying]       = useState(false)
  const [faceVerified, setFaceVerified]         = useState(false)
  const [faceAutoCapturing, setFaceAutoCapturing] = useState(false)
  const faceVideoRef  = useRef(null)
  const faceStreamRef = useRef(null)
  const faceCanvasRef = useRef(null)
  const faceTimerRef  = useRef(null)

  const navigate = useNavigate()
  const inputRef = useRef(null)

  useEffect(() => {
    if (step >= 2) setTimeout(() => inputRef.current?.focus(), 120)
  }, [step])

  // Cleanup cameras on unmount
  useEffect(() => {
    return () => { stopCamera(); stopFaceCamera() }
  }, [])

  // 카메라 정리: step 2 벗어나면 카메라 끄고 방식 선택 초기화
  useEffect(() => {
    if (step !== 2) { stopFaceCamera(); setVerifyMethod(null) }
  }, [step])

  useEffect(() => {
    if (faceCameraOn && faceVideoRef.current && faceStreamRef.current) {
      faceVideoRef.current.srcObject = faceStreamRef.current
    }
  }, [faceCameraOn])

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

  // Face detection via canvas pixel analysis — auto-captures when face is actually in frame
  useEffect(() => {
    if (!faceCameraOn) return
    let goodFrames = 0
    let didCapture = false

    const interval = setInterval(async () => {
      if (didCapture || !faceVideoRef.current || !faceCanvasRef.current) return
      const video = faceVideoRef.current
      if (video.videoWidth === 0) return

      const canvas = faceCanvasRef.current
      canvas.width = 64; canvas.height = 64
      const ctx = canvas.getContext('2d')
      ctx.translate(64, 0); ctx.scale(-1, 1)
      ctx.drawImage(video, 0, 0, 64, 64)

      const { data: px } = ctx.getImageData(8, 0, 48, 64)
      let sum = 0
      for (let i = 0; i < px.length; i += 4)
        sum += px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114
      const mean = sum / (px.length / 4)
      let variance = 0
      for (let i = 0; i < px.length; i += 4) {
        const lum = px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114
        variance += (lum - mean) ** 2
      }
      variance /= (px.length / 4)

      // Face-like: decent brightness + enough color variation
      if (mean > 40 && mean < 230 && variance > 150) {
        goodFrames++
        if (goodFrames >= 3) {
          didCapture = true
          clearInterval(interval)
          setFaceAutoCapturing(true)
          setTimeout(async () => {
            if (!faceVideoRef.current || !faceCanvasRef.current) return
            const v = faceVideoRef.current; const c = faceCanvasRef.current
            c.width = v.videoWidth; c.height = v.videoHeight
            const ctx2 = c.getContext('2d')
            ctx2.drawImage(v, 0, 0)
            const resized = await resizeImage(c.toDataURL('image/jpeg', 0.8))
            setFaceCaptured(resized); stopFaceCamera(); setFaceAutoCapturing(false)
            setFaceVerifying(true)
            setTimeout(() => { setFaceVerifying(false); setFaceVerified(true) }, 2000)
          }, 500)
        }
      } else {
        goodFrames = Math.max(0, goodFrames - 1)
      }
    }, 500)

    return () => clearInterval(interval)
  }, [faceCameraOn])

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

  const resizeImage = (dataUrl, maxWidth = 1200) => {
    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let w = img.width, h = img.height
        if (w > maxWidth) { h = (h * maxWidth) / w; w = maxWidth }
        canvas.width = w; canvas.height = h
        canvas.getContext('2d').drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', 0.7))
      }
      img.src = dataUrl
    })
  }

  const capturePhoto = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0)
    const resized = await resizeImage(canvas.toDataURL('image/jpeg', 0.8))
    setCaptured(resized)
    stopCamera()
  }, [stopCamera])

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const resized = await resizeImage(ev.target.result)
      setCaptured(resized)
      stopCamera()
    }
    reader.readAsDataURL(file)
  }

  const retakePhoto = () => {
    clearTimeout(idTimerRef.current)
    setIdAutoCapturing(false)
    setCaptured(null)
    setError('')
    startCamera()
  }

  /* ---- Face Camera ---- */
  const startFaceCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
      })
      faceStreamRef.current = stream
      setFaceCameraOn(true)
      setError('')
    } catch {
      setError('카메라 접근 권한이 필요합니다')
    }
  }

  const stopFaceCamera = () => {
    if (faceStreamRef.current) {
      faceStreamRef.current.getTracks().forEach(t => t.stop())
      faceStreamRef.current = null
    }
    setFaceCameraOn(false)
  }

  const captureFace = async () => {
    if (!faceVideoRef.current || !faceCanvasRef.current) return
    const video = faceVideoRef.current
    const canvas = faceCanvasRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0)
    const resized = await resizeImage(canvas.toDataURL('image/jpeg', 0.8))
    setFaceCaptured(resized)
    stopFaceCamera()
    setFaceVerifying(true)
    setTimeout(() => { setFaceVerifying(false); setFaceVerified(true) }, 2200)
  }

  const retakeFace = () => {
    clearTimeout(faceTimerRef.current)
    setFaceAutoCapturing(false)
    setFaceCaptured(null)
    setFaceVerified(false)
    setFaceVerifying(false)
    setError('')
    startFaceCamera()
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
      const text = await res.text()
      let data
      try { data = JSON.parse(text) } catch {
        console.error('서버 응답(JSON 아님):', text.slice(0, 200))
        setError('서버에서 비정상 응답을 받았습니다. 다시 시도해주세요.')
        setVerifying(false)
        return
      }

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
    } catch (err) {
      console.error('신분증 확인 오류:', err)
      setError(`서버 연결 실패: ${err.message || err}`)
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
    } else if (step === 2) {
      if (verifyMethod) {
        // 방식 선택 화면으로 되돌아가기
        stopFaceCamera()
        setFaceCaptured(null)
        setFaceVerified(false)
        setFaceVerifying(false)
        setFaceAutoCapturing(false)
        setVerifyMethod(null)
      } else {
        setStep(1)
      }
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
      const text = await res.text()
      let data
      try { data = JSON.parse(text) } catch {
        console.error('서버 응답(JSON 아님):', text.slice(0, 200))
        setError('서버에서 비정상 응답을 받았습니다.'); setLoading(false); return
      }
      if (!res.ok) { setError(data.message || '회원가입에 실패했습니다.'); setLoading(false); return }
      setDone(true)
    } catch (err) {
      console.error('회원가입 오류:', err)
      setError(`서버 연결 실패: ${err.message || err}`)
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
            {(step === 2 && verifyMethod === 'face' ? '얼굴 인식으로\n본인을 확인해요'
              : step === 2 && verifyMethod === 'video' ? '영상통화로\n본인을 확인해요'
              : step === 2 && verifyMethod === 'phone' ? 'ARS 전화로\n본인을 확인해요'
              : currentStep.title
            ).split('\n').map((line, i, arr) => (
              <span key={i}>{line}{i < arr.length - 1 && <br />}</span>
            ))}
          </h1>
          <p className="auth-subtitle">
            {step === 2 && verifyMethod === 'face' ? '카메라를 정면으로 바라봐주세요'
              : step === 2 && verifyMethod === 'video' ? '상담사와 화상 통화로 본인을 확인합니다'
              : step === 2 && verifyMethod === 'phone' ? '등록된 번호로 ARS 전화가 발신됩니다'
              : step === 2 ? '본인확인 방식을 선택해주세요'
              : currentStep.sub}
          </p>

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
                      <video ref={videoRef} autoPlay playsInline muted className="id-video" />
                      <div className="id-guide-overlay">
                        <div className={`id-guide-rect${idAutoCapturing ? ' detected' : ''}`}>
                          <span className="id-corner tl" /><span className="id-corner tr" />
                          <span className="id-corner bl" /><span className="id-corner br" />
                        </div>
                        <p className="id-guide-label">신분증을 가이드 안에 맞춰주세요</p>
                      </div>
                    </div>
                    <button
                      className={`id-capture-btn${idAutoCapturing ? ' capturing' : ''}`}
                      disabled={idAutoCapturing}
                      onClick={() => {
                        setIdAutoCapturing(true)
                        capturePhoto().then(() => setIdAutoCapturing(false))
                      }}
                    >
                      <span className="id-capture-btn-circle" />
                      {idAutoCapturing ? '촬영 중...' : '촬영하기'}
                    </button>
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

            {/* ===== Step 2: 본인확인 방식 선택 + 각 방식 ===== */}
            {step === 2 && (
              <>
                <canvas ref={faceCanvasRef} style={{ display: 'none' }} />

                {/* 방식 선택 화면 */}
                {!verifyMethod && !faceVerified && (
                  <div className="verify-method-list">
                    {/* 얼굴인식 — 메인 */}
                    <button className="verify-method-item primary" onClick={() => { setVerifyMethod('face'); startFaceCamera() }}>
                      <div className="vmi-icon">
                        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="8" r="3.5"/>
                          <path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7"/>
                          <path d="M9 3.5C9 3.5 9.5 2 12 2s3 1.5 3 1.5"/>
                          <path d="M8 8s.5 2 4 2 4-2 4-2"/>
                        </svg>
                      </div>
                      <div className="vmi-text">
                        <span className="vmi-title">얼굴 인식 <span className="vmi-badge">추천</span></span>
                        <span className="vmi-desc">카메라로 실시간 얼굴을 대조해요</span>
                      </div>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
                    </button>

                    {/* 영상통화 */}
                    <button className="verify-method-item" onClick={() => setVerifyMethod('video')}>
                      <div className="vmi-icon secondary">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="23 7 16 12 23 17 23 7"/>
                          <rect x="1" y="5" width="15" height="14" rx="2"/>
                        </svg>
                      </div>
                      <div className="vmi-text">
                        <span className="vmi-title">영상 통화</span>
                        <span className="vmi-desc">상담사와 화상 통화로 본인을 확인해요</span>
                      </div>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
                    </button>

                    {/* 전화 인증 */}
                    <button className="verify-method-item" onClick={() => setVerifyMethod('phone')}>
                      <div className="vmi-icon secondary">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.45 2 2 0 0 1 3.59 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.55a16 16 0 0 0 6.54 6.54l.85-.85a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                        </svg>
                      </div>
                      <div className="vmi-text">
                        <span className="vmi-title">ARS 전화 인증</span>
                        <span className="vmi-desc">자동 응답 전화로 간편하게 인증해요</span>
                      </div>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
                    </button>
                  </div>
                )}

                {/* 얼굴인식 플로우 */}
                {verifyMethod === 'face' && !faceVerified && (
                  <>
                    {/* 카메라 라이브 뷰 */}
                    {faceCameraOn && !faceCaptured && (
                      <div className="face-cam-wrap">
                        <div className="face-oval-wrap">
                          <div className="face-oval-clip">
                            <video ref={faceVideoRef} autoPlay playsInline muted className="face-video" />
                            <div className={`face-scan-line${faceAutoCapturing ? ' detected' : ''}`} />
                          </div>
                          <svg className="face-oval-svg" viewBox="0 0 206 266" fill="none">
                            <ellipse cx="103" cy="133" rx="100" ry="130" className="face-oval-track" strokeWidth="3" />
                            <ellipse cx="103" cy="133" rx="100" ry="130"
                              className={`face-oval-ring-path${faceAutoCapturing ? ' detected' : ''}`}
                              strokeWidth="3" fill="none" />
                          </svg>
                        </div>
                        <div className="face-status-text">
                          <span className={`face-status-dot${faceAutoCapturing ? ' ok' : ''}`} />
                          {faceAutoCapturing ? '촬영 중...' : '얼굴을 원 안에 맞춰주세요'}
                        </div>
                      </div>
                    )}
                    {/* 분석 중 */}
                    {faceCaptured && faceVerifying && (
                      <div className="face-cam-wrap">
                        <div className="face-oval-wrap">
                          <div className="face-oval-clip">
                            <img src={faceCaptured} alt="셀피" className="face-video" style={{ objectFit: 'cover', transform: 'none' }} />
                            <div className="face-analyzing-overlay" />
                          </div>
                          <svg className="face-oval-svg" viewBox="0 0 206 266" fill="none">
                            <ellipse cx="103" cy="133" rx="100" ry="130" className="face-oval-ring-path detected" strokeWidth="3" fill="none" />
                          </svg>
                        </div>
                        <div className="face-status-text">
                          <span className="face-status-dot ok" />
                          AI가 얼굴을 인식하고 있어요...
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* 영상통화 플로우 */}
                {verifyMethod === 'video' && (
                  <div className="verify-waiting">
                    <div className="verify-waiting-icon">
                      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--bnk-red)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>
                      </svg>
                    </div>
                    <p className="verify-waiting-title">영상통화 연결 중</p>
                    <p className="verify-waiting-desc">잠시만 기다려주세요.<br/>상담사와 연결되면 알려드립니다.</p>
                    <div className="verify-waiting-dots"><span/><span/><span/></div>
                  </div>
                )}

                {/* ARS 전화 인증 플로우 */}
                {verifyMethod === 'phone' && (
                  <div className="verify-waiting">
                    <div className="verify-waiting-icon">
                      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--bnk-red)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.45 2 2 0 0 1 3.59 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.55a16 16 0 0 0 6.54 6.54l.85-.85a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                      </svg>
                    </div>
                    <p className="verify-waiting-title">ARS 전화 발신 중</p>
                    <p className="verify-waiting-desc">등록된 번호로 전화가 갑니다.<br/>안내에 따라 인증 번호를 눌러주세요.</p>
                    <div className="verify-waiting-dots"><span/><span/><span/></div>
                  </div>
                )}

                {/* 인증 완료 */}
                {faceVerified && (
                  <div className="face-success-area">
                    <div className="face-success-icon">
                      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                    <p className="face-success-title">본인 확인 완료!</p>
                    <p className="face-success-desc">얼굴 인식이 성공적으로 완료되었습니다.<br/>이제 계정 정보를 입력해주세요.</p>
                    <div className="auth-btn-area" style={{ width: '100%' }}>
                      <button className="auth-btn auth-btn-primary" onClick={goNext}>다음으로</button>
                      <button className="auth-btn auth-btn-secondary" onClick={retakeFace}>다시 촬영</button>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ===== Step 3: Username ===== */}
            {step === 3 && (
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

            {/* ===== Step 4: Password ===== */}
            {step === 4 && (
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

            {/* ===== Step 5: Email ===== */}
            {step === 5 && (
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

            {/* Next button (steps 3~5) */}
            {step >= 3 && (
              <div className="auth-btn-area">
                <button
                  className="auth-btn auth-btn-primary"
                  disabled={loading}
                  onClick={goNext}
                >
                  {loading ? '처리 중...' : isLast ? '가입하기' : '다음'}
                </button>
                {step === 3 && (
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
