import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import './Auth.css'

const DECO_CARDS = [
  { from: '#2563EB', to: '#60A5FA', net: 'VISA',   name: 'BNK Young 체크카드' },
  { from: '#1E1E2E', to: '#44445C', net: 'VISA',   name: 'BNK 하이라이프 신용카드' },
  { from: '#D4451A', to: '#F59E0B', net: 'MASTER', name: 'BNK 부산사랑 신용카드' },
]

export default function Login() {
  const [step, setStep]         = useState(0)
  const [username, setUsername]  = useState('')
  const [password, setPassword]  = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const navigate                = useNavigate()
  const inputRef                = useRef(null)

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 120)
  }, [step])

  const goNext = () => {
    if (!username.trim()) return
    setError('')
    setStep(1)
  }

  const handleLogin = async () => {
    if (!password) return
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      })
      const text = await res.text()
      let data
      try { data = JSON.parse(text) } catch {
        console.error('서버 응답(JSON 아님):', text.slice(0, 300))
        setError('서버 응답 오류 — 브라우저 주소가 localhost:3000인지 확인해주세요.')
        setLoading(false)
        return
      }

      if (!res.ok) {
        setError(data.message || '로그인에 실패했습니다.')
        setLoading(false)
        return
      }

      localStorage.setItem('token',    data.token)
      localStorage.setItem('isAdmin',  data.is_admin ? 'true' : 'false')
      localStorage.setItem('userName', data.name || '')
      navigate(data.is_admin ? '/admin' : '/')
    } catch (err) {
      console.error('로그인 오류:', err)
      setError(`서버 연결 실패: ${err.message || err}`)
      setLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (step === 0) goNext()
      else handleLogin()
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">

        {/* Left: Brand Panel */}
        <div className="auth-brand">
          <div className="auth-brand-logo">
            <div className="auth-brand-mark">BNK</div>
            <span className="auth-brand-name">Pickard</span>
          </div>
          <h2 className="auth-brand-title">
            AI가 추천하는<br />
            나만의 카드
          </h2>
          <p className="auth-brand-sub">
            소비 패턴을 분석해서<br />
            딱 맞는 카드를 찾아드려요
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

        {/* Right: Form */}
        <div className="auth-form-side">

          {step > 0 && (
            <button className="auth-back" onClick={() => { setStep(0); setError('') }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
              뒤로
            </button>
          )}

          {step === 0 && <div style={{ height: 46 }} />}

          {/* Step indicator */}
          <div className="auth-steps">
            <div className={`auth-step-dot ${step >= 1 ? 'done' : 'active'}`} />
            <div className={`auth-step-dot ${step >= 1 ? 'active' : ''}`} />
          </div>

          {/* Step 0: Username */}
          {step === 0 && (
            <>
              <h1 className="auth-title">
                안녕하세요!<br />
                아이디를 입력해주세요
              </h1>
              <p className="auth-subtitle">Pickard 카드몰에 오신 것을 환영합니다</p>

              <div className="auth-form">
                <div className="auth-field">
                  <label className="auth-label">아이디</label>
                  <input
                    ref={inputRef}
                    className="auth-input"
                    type="text"
                    placeholder="아이디 입력"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    onKeyDown={handleKeyDown}
                    autoComplete="username"
                  />
                </div>

                <div className="auth-btn-area">
                  <button
                    className="auth-btn auth-btn-primary"
                    disabled={!username.trim()}
                    onClick={goNext}
                  >
                    다음
                  </button>
                  <p className="auth-footer">
                    아직 계정이 없으신가요? <Link to="/signup">회원가입</Link>
                  </p>
                </div>
              </div>
            </>
          )}

          {/* Step 1: Password */}
          {step === 1 && (
            <>
              <h1 className="auth-title">
                비밀번호를<br />
                입력해주세요
              </h1>
              <p className="auth-subtitle">{username} 님으로 로그인합니다</p>

              <div className="auth-form">
                <div className="auth-field">
                  <label className="auth-label">비밀번호</label>
                  <div className="auth-input-wrap">
                    <input
                      ref={inputRef}
                      className={`auth-input${error ? ' error' : ''}`}
                      type={showPw ? 'text' : 'password'}
                      placeholder="비밀번호 입력"
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setError('') }}
                      onKeyDown={handleKeyDown}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      className="auth-pw-toggle"
                      onClick={() => setShowPw(!showPw)}
                      tabIndex={-1}
                    >
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
                  {error && <p className="auth-hint error">{error}</p>}
                </div>

                <div className="auth-btn-area">
                  <button
                    className="auth-btn auth-btn-primary"
                    disabled={!password || loading}
                    onClick={handleLogin}
                  >
                    {loading ? '로그인 중...' : '로그인'}
                  </button>
                </div>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  )
}
