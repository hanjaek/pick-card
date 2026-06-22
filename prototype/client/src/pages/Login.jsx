import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import axios from 'axios'
import './Auth.css'

function Login() {
  const [form, setForm]       = useState({ username: '', password: '' })
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)
  const navigate              = useNavigate()

  const handleChange = (e) => {
    // name 속성으로 어떤 필드인지 구분해 하나의 핸들러로 관리
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await axios.post('/api/auth/login', form)
      localStorage.setItem('token',    res.data.token)
      localStorage.setItem('isAdmin',  res.data.is_admin ? 'true' : 'false')
      localStorage.setItem('userName', res.data.name || '')

      // is_admin 이면 관리자 페이지로, 일반 사용자는 메인으로
      navigate(res.data.is_admin ? '/admin' : '/')
    } catch (err) {
      setError(err.response?.data?.message || '로그인에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">

        {/* 좌측 브랜드 패널 */}
        <div className="auth-brand">
          <div className="brand-logo">Pickard</div>
          <h2 className="brand-title">부산은행 카드몰</h2>
          <p className="brand-sub">AI가 추천하는 나만의 카드</p>

          <div className="deco-card dc-1" style={{ background: 'linear-gradient(135deg,#8B0304,#D71919)' }} />
          <div className="deco-card dc-2" style={{ background: 'linear-gradient(135deg,#2D2D2D,#555)' }} />
          <div className="deco-card dc-3" style={{ background: 'linear-gradient(135deg,#D71919,#E84040)' }} />
        </div>

        {/* 우측 로그인 폼 */}
        <div className="auth-form-side">
          <h2 className="form-title">로그인</h2>
          <p className="form-sub">Pickard에 오신 것을 환영합니다</p>

          {error && <div className="form-error">{error}</div>}

          <form onSubmit={handleSubmit} className="form">
            <div className="form-group">
              <label htmlFor="username">아이디</label>
              <input
                id="username"
                type="text"
                name="username"
                placeholder="아이디를 입력하세요"
                value={form.username}
                onChange={handleChange}
                required
                autoComplete="username"
              />
            </div>
            <div className="form-group">
              <label htmlFor="password">비밀번호</label>
              <input
                id="password"
                type="password"
                name="password"
                placeholder="비밀번호를 입력하세요"
                value={form.password}
                onChange={handleChange}
                required
                autoComplete="current-password"
              />
            </div>

            <button type="submit" className="btn-submit" disabled={loading}>
              {loading ? '로그인 중...' : '로그인'}
            </button>
          </form>

          <p className="form-footer">
            계정이 없으신가요? <Link to="/signup">회원가입</Link>
          </p>
        </div>

      </div>
    </div>
  )
}

export default Login
