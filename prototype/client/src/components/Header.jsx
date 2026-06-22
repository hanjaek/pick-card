import { Link, useLocation, useNavigate } from 'react-router-dom'
import './Header.css'

function Header() {
  const location = useLocation()
  const navigate = useNavigate()

  // 현재 경로와 일치하는 링크에 active 클래스 추가
  const isActive = (path) => (location.pathname === path ? 'active' : '')

  // 로그인 상태 확인 (localStorage에 JWT 토큰 존재 여부)
  const isLoggedIn = !!localStorage.getItem('token')

  const handleLogout = () => {
    localStorage.removeItem('token')
    navigate('/')
  }

  return (
    <header className="header">
      <div className="header-inner">
        {/* 브랜드 로고 */}
        <Link to="/" className="header-logo">
          <div className="logo-mark">BNK</div>
          <div className="logo-text">
            <span className="logo-main">Pickard</span>
            <span className="logo-sub">부산은행 카드몰</span>
          </div>
        </Link>

        {/* 주요 네비게이션 링크 */}
        <nav className="header-nav">
          <Link to="/"      className={`nav-link ${isActive('/')}`}>홈</Link>
          <Link to="/cards" className={`nav-link ${isActive('/cards')}`}>카드 상품</Link>
        </nav>

        {/* 로그인 상태에 따라 버튼 분기 */}
        <div className="header-auth">
          {isLoggedIn ? (
            <button className="btn-logout" onClick={handleLogout}>로그아웃</button>
          ) : (
            <>
              <Link to="/login"  className="btn-login">로그인</Link>
              <Link to="/signup" className="btn-signup">회원가입</Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

export default Header
