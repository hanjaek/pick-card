import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
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
import Admin       from './pages/Admin'

function AdminRoute({ children }) {
  const isAdmin = localStorage.getItem('isAdmin') === 'true'
  return isAdmin ? children : <Navigate to="/login" replace />
}

function App() {
  return (
    <BrowserRouter>
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
          path="*"
          element={
            <>
              <Header />
              <main>
                <Routes>
                  <Route path="/"                      element={<Home />}       />
                  <Route path="/cards"                 element={<Cards />}      />
                  <Route path="/search"                element={<CardSearch />} />
                  <Route path="/cards/:id"             element={<CardDetail />} />
                  <Route path="/cards/:id/apply"       element={<CardApply />}  />
                  <Route path="/cards/:id/design"      element={<CardDesign />} />
                  <Route path="/mypage"                element={<MyPage />}     />
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
