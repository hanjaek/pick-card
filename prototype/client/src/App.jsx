import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Header     from './components/Header'
import Footer     from './components/Footer'
import Home       from './pages/Home'
import Login      from './pages/Login'
import Signup     from './pages/Signup'
import Cards      from './pages/Cards'
import CardDetail from './pages/CardDetail'
import CardApply  from './pages/CardApply'
import CardDesign  from './pages/CardDesign'
import CardSearch  from './pages/CardSearch'
import MyPage      from './pages/MyPage'
import Terms       from './pages/Terms'
import Support     from './pages/Support'
import Chatbot     from './pages/Chatbot'
import Admin       from './pages/Admin'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

function AdminRoute({ children }) {
  const isAdmin = localStorage.getItem('isAdmin') === 'true'
  return isAdmin ? children : <Navigate to="/login" replace />
}

function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <Admin />
            </AdminRoute>
          }
        />
        <Route
          path="/chatbot"
          element={
            <>
              <Header />
              <Chatbot />
            </>
          }
        />
        <Route
          path="*"
          element={
            <>
              <Header />
              <main>
                <Routes>
                  <Route path="/"                      element={<Home />}       />
                  <Route path="/cards"                 element={<Cards />}      />
                  <Route path="/search"                element={<Navigate to="/cards" replace />} />
                  <Route path="/cards/:id"             element={<CardDetail />} />
                  <Route path="/cards/:id/apply"       element={<CardApply />}  />
                  <Route path="/cards/:id/design"      element={<CardDesign />} />
                  <Route path="/mypage"                element={<MyPage />}     />
                  <Route path="/terms"                 element={<Terms />}      />
                  <Route path="/support"               element={<Support />}    />
                  <Route path="/login"                 element={<Login />}      />
                  <Route path="/signup"                element={<Signup />}     />
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
