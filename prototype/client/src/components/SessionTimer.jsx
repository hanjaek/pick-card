import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import './SessionTimer.css'

const SESSION_MS = 60 * 60 * 1000   // 60분
const WARN_MS    = 5 * 60 * 1000    // 5분 남으면 경고

export default function SessionTimer({ onLogout }) {
  const navigate = useNavigate()
  const [remaining, setRemaining] = useState(SESSION_MS)
  const [warned, setWarned]       = useState(false)   // 경고 모달 표시 여부
  const warnedOnce = useRef(false)

  // 만료 시각 읽기 (없으면 지금 기준 60분으로 초기화)
  const getExpiresAt = () => {
    let exp = Number(localStorage.getItem('sessionExpiresAt'))
    if (!exp || Number.isNaN(exp)) {
      exp = Date.now() + SESSION_MS
      localStorage.setItem('sessionExpiresAt', String(exp))
    }
    return exp
  }

  // 로그아웃 처리 (만료 또는 수동)
  const doLogout = useCallback((expired) => {
    localStorage.removeItem('token')
    localStorage.removeItem('sessionExpiresAt')
    axios.post('/api/auth/logout').catch(() => {})   // Redis 세션도 삭제 (실패 무시)
    if (onLogout) onLogout()
    if (expired) {
      alert('로그인 시간이 만료되어 자동 로그아웃되었습니다.')
    }
    navigate('/login')
  }, [navigate, onLogout])

  // 세션 연장
  const extend = useCallback(async () => {
    const newExp = Date.now() + SESSION_MS
    localStorage.setItem('sessionExpiresAt', String(newExp))
    setRemaining(SESSION_MS)
    setWarned(false)
    warnedOnce.current = false
    // 백엔드 Redis 세션도 연장
    try { await axios.post('/api/auth/extend') } catch {}
  }, [])

  // 1초마다 남은 시간 갱신
  useEffect(() => {
    const tick = () => {
      const rem = getExpiresAt() - Date.now()
      if (rem <= 0) {
        doLogout(true)
        return
      }
      setRemaining(rem)
      if (rem <= WARN_MS && !warnedOnce.current) {
        warnedOnce.current = true
        setWarned(true)
      }
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [doLogout])

  // mm:ss 포맷
  const mm = String(Math.floor(remaining / 60000)).padStart(2, '0')
  const ss = String(Math.floor((remaining % 60000) / 1000)).padStart(2, '0')
  const isUrgent = remaining <= WARN_MS

  return (
    <>
      {/* 헤더 안 타이머 칩 */}
      <button
        className={`st-chip${isUrgent ? ' st-chip--urgent' : ''}`}
        onClick={extend}
        title="클릭하면 시간이 연장됩니다"
      >
        <span className="st-clock">⏱</span>
        <span className="st-time">{mm}:{ss}</span>
        <span className="st-extend">연장</span>
      </button>

      {/* 만료 임박 경고 모달 */}
      {warned && (
        <div className="st-modal-backdrop">
          <div className="st-modal">
            <p className="st-modal-icon">⏰</p>
            <h3 className="st-modal-title">로그인 시간이 곧 만료돼요</h3>
            <p className="st-modal-desc">
              남은 시간 <strong>{mm}:{ss}</strong><br />
              계속 이용하시려면 시간을 연장해주세요.
            </p>
            <div className="st-modal-actions">
              <button className="st-btn-extend" onClick={extend}>시간 연장하기</button>
              <button className="st-btn-logout" onClick={() => doLogout(false)}>로그아웃</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
