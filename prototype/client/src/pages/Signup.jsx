import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import axios from 'axios'
import './Auth.css'
import './Signup.css'

function Signup() {
  const [form, setForm] = useState({
    username: '', password: '', confirmPassword: '',
    name: '', email: '', birthdate: ''
  })
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)
  const navigate              = useNavigate()

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    // 비밀번호 일치 검사 (서버로 보내기 전 클라이언트에서 사전 검증)
    if (form.password !== form.confirmPassword) {
      return setError('비밀번호가 일치하지 않습니다.')
    }

    if (form.password.length < 8) {
      return setError('비밀번호는 8자 이상이어야 합니다.')
    }

    setLoading(true)
    try {
      await axios.post('/api/auth/register', {
        username:  form.username,
        password:  form.password,
        name:      form.name,
        email:     form.email,
        birthdate: form.birthdate || null
      })
      // 가입 성공 후 로그인 페이지로 이동
      navigate('/login')
    } catch (err) {
      setError(err.response?.data?.message || '회원가입에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card signup-card">

        {/* 좌측 브랜드 패널 */}
        <div className="auth-brand">
          <div className="brand-logo">Pickard</div>
          <h2 className="brand-title">회원가입</h2>
          <p className="brand-sub">
            Pickard 회원이 되시면<br />
            AI 맞춤 카드 추천을 받으실 수 있습니다
          </p>
          <div className="deco-card dc-1" style={{ background: 'linear-gradient(135deg,#F05A28,#f7971e)' }} />
          <div className="deco-card dc-2" style={{ background: 'linear-gradient(135deg,#003882,#0066CC)' }} />
        </div>

        {/* 우측 가입 폼 */}
        <div className="auth-form-side">
          <h2 className="form-title">회원가입</h2>
          <p className="form-sub">정보를 입력해 주세요</p>

          {error && <div className="form-error">{error}</div>}

          <form onSubmit={handleSubmit} className="form">
            <div className="form-row">
              <div className="form-group">
                <label>이름</label>
                <input
                  type="text" name="name"
                  placeholder="홍길동"
                  value={form.name} onChange={handleChange} required
                />
              </div>
              <div className="form-group">
                <label>생년월일</label>
                <input
                  type="date" name="birthdate"
                  value={form.birthdate} onChange={handleChange}
                />
              </div>
            </div>

            <div className="form-group">
              <label>아이디</label>
              <input
                type="text" name="username"
                placeholder="영문/숫자 조합 6자 이상"
                value={form.username} onChange={handleChange}
                required minLength={6}
                autoComplete="username"
              />
            </div>

            <div className="form-group">
              <label>이메일</label>
              <input
                type="email" name="email"
                placeholder="example@bnk.kr"
                value={form.email} onChange={handleChange} required
                autoComplete="email"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>비밀번호</label>
                <input
                  type="password" name="password"
                  placeholder="8자 이상"
                  value={form.password} onChange={handleChange}
                  required autoComplete="new-password"
                />
              </div>
              <div className="form-group">
                <label>비밀번호 확인</label>
                <input
                  type="password" name="confirmPassword"
                  placeholder="비밀번호 재입력"
                  value={form.confirmPassword} onChange={handleChange}
                  required autoComplete="new-password"
                />
              </div>
            </div>

            <button type="submit" className="btn-submit" disabled={loading}>
              {loading ? '처리 중...' : '가입하기'}
            </button>
          </form>

          <p className="form-footer">
            이미 계정이 있으신가요? <Link to="/login">로그인</Link>
          </p>
        </div>

      </div>
    </div>
  )
}

export default Signup
