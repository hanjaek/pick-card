import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import axios from 'axios'
import SessionTimer from './SessionTimer'
import './Header.css'

function Header() {
  const location   = useLocation()
  const navigate   = useNavigate()
  const [scrolled, setScrolled] = useState(false)

  const isHome    = location.pathname === '/'
  const isActive  = (path) => location.pathname.startsWith(path) ? 'active' : ''
  const isLoggedIn = !!localStorage.getItem('token')

  useEffect(() => {
    if (!isHome) {
      setScrolled(true)
      return
    }
    const onScroll = () => setScrolled(window.scrollY > 60)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [isHome])

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('isAdmin')
    localStorage.removeItem('userName')
    axios.post('/api/auth/logout').catch(() => {})   // Redis 세션 삭제
    navigate('/')
  }

  return (
    <header className={`header${scrolled ? '' : ' transparent'}`}>
      <div className="header-inner">
        <Link to="/" className="header-logo">
          <div className="logo-mark">BNK</div>
          <div className="logo-text">
            <span className="logo-main">Pickard</span>
            <span className="logo-sub">부산은행 카드몰</span>
          </div>
        </Link>

        <nav className="header-nav">
          <Link to="/cards"   className={`nav-link ${isActive('/cards')}`}>카드</Link>
          <Link to="/support" className={`nav-link ${isActive('/support')}`}>고객센터</Link>
        </nav>

        <div className="header-auth">
          {isLoggedIn ? (
            <>
              <SessionTimer onLogout={() => navigate('/')} />
              <Link to="/mypage" className={`btn-mypage ${isActive('/mypage')}`}>My페이지</Link>
              <button className="btn-logout" onClick={handleLogout}>로그아웃</button>
            </>
          ) : (
            <>
              <Link to={`/login?redirect=${encodeURIComponent(location.pathname)}`}  className="btn-login">로그인</Link>
              <Link to={`/signup?redirect=${encodeURIComponent(location.pathname)}`} className="btn-signup">회원가입</Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

export default Header
