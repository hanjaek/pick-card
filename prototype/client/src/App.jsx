import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Header from './components/Header'
import Footer from './components/Footer'
import Home   from './pages/Home'
import Login  from './pages/Login'
import Signup from './pages/Signup'
import Cards  from './pages/Cards'
import Admin  from './pages/Admin'

// 관리자 전용 라우트: localStorage의 isAdmin 값으로 접근 제어
function AdminRoute({ children }) {
  const isAdmin = localStorage.getItem('isAdmin') === 'true'
  return isAdmin ? children : <Navigate to="/login" replace />
}

// 관리자 페이지는 Header/Footer 없이 독립 레이아웃으로 표시
function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 관리자 페이지: 헤더/푸터 제외 */}
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <Admin />
            </AdminRoute>
          }
        />

        {/* 일반 사용자 페이지: 헤더/푸터 포함 */}
        <Route
          path="*"
          element={
            <>
              <Header />
              <main>
                <Routes>
                  <Route path="/"       element={<Home />}   />
                  <Route path="/cards"  element={<Cards />}  />
                  <Route path="/login"  element={<Login />}  />
                  <Route path="/signup" element={<Signup />} />
                </Routes>
              </main>
              <Footer />
            </>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}

export default App
