import React from 'react'
import ReactDOM from 'react-dom/client'
import axios from 'axios'
import App from './App.jsx'
import './index.css'

// 세션 쿠키(connect.sid)를 모든 요청에 함께 보내고 받기 위해 전역 설정.
// 서버 CORS 가 credentials: true 이므로 쿠키가 정상적으로 왕복함.
axios.defaults.withCredentials = true

// React 18의 createRoot API: concurrent 기능 활성화
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
