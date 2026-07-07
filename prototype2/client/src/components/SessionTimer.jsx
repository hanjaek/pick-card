import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import axios from 'axios'
import './SessionTimer.css'

const WARN_MS      = 5 * 60 * 1000   // 5분 이하 남으면 경고
const SYNC_EVERY   = 30 * 1000       // 30초마다 서버와 재동기화
const TICK_EVERY   = 1000            // 화면은 1초마다 갱신

/**
 * 로그인 세션 타이머
 *
 * [구조] Redis 세션이 유일한 기준(source of truth).
 *  - 서버 GET /api/auth/me 가 돌려주는 expiresIn(남은 ms)으로 만료 시각을 잡고,
 *    그 사이에는 로컬에서 1초마다 부드럽게 카운트다운만 표시한다.
 *  - 30초마다 + 창 포커스 시 서버와 재동기화 → 다른 탭에서 연장/로그아웃해도 반영.
 *  - 연장/로그아웃/만료 판정 모두 서버 응답을 따른다. (localStorage 자체 계산 X)
 */
export default function SessionTimer({ onLogout }) {
  const navigate     = useNavigate()
  const location     = useLocation()
  const expiryRef    = useRef(null)   // 만료 절대시각(ms epoch). 서버 동기화로만 설정
  const [remaining, setRemaining] = useState(null)
  const [warned, setWarned]       = useState(false)

  /* ── 로그아웃 (수동 또는 만료) ── */
  const doLogout = useCallback(async (expired) => {
    try { await axios.post('/api/auth/logout') } catch {}
    localStorage.removeItem('token')
    localStorage.removeItem('isAdmin')
    localStorage.removeItem('userName')
    if (onLogout) onLogout()
    if (expired) {
      alert('로그인 시간이 만료되어 자동 로그아웃되었습니다.')
      navigate(`/login?redirect=${encodeURIComponent(location.pathname)}`)
    } else {
      navigate('/login')
    }
  }, [navigate, onLogout, location])

  /* ── 서버와 동기화: 실제 남은 시간을 받아 만료시각 재설정 ── */
  const sync = useCallback(async () => {
    try {
      const { data } = await axios.get('/api/auth/me')
      if (data.loggedIn && typeof data.expiresIn === 'number') {
        expiryRef.current = Date.now() + data.expiresIn
        setRemaining(data.expiresIn)
        if (data.expiresIn > WARN_MS) setWarned(false)
        return true
      }
      return false
    } catch (err) {
      // 401(세션 없음/만료) → 로그아웃
      if (err.response && err.response.status === 401) {
        doLogout(!!err.response.data?.expired)
      }
      return false
    }
  }, [doLogout])

  /* ── 세션 연장 ── */
  const extend = useCallback(async () => {
    try {
      const { data } = await axios.post('/api/auth/extend')
      expiryRef.current = Date.now() + data.expiresIn
      setRemaining(data.expiresIn)
      setWarned(false)
    } catch {
      doLogout(false)
    }
  }, [doLogout])

  /* ── 최초 동기화 + 30초 주기 재동기화 + 창 포커스 시 재동기화 ── */
  useEffect(() => {
    sync()
    const syncId = setInterval(sync, SYNC_EVERY)
    const onFocus = () => sync()
    window.addEventListener('focus', onFocus)
    return () => {
      clearInterval(syncId)
      window.removeEventListener('focus', onFocus)
    }
  }, [sync])

  /* ── 1초마다 화면 카운트다운 (서버가 준 만료시각 기준) ── */
  useEffect(() => {
    const id = setInterval(() => {
      if (expiryRef.current == null) return
      const rem = expiryRef.current - Date.now()
      if (rem <= 0) {
        sync()          // 만료 추정 → 서버 확인 후 로그아웃 처리
        return
      }
      setRemaining(rem)
      if (rem <= WARN_MS) setWarned(true)
    }, TICK_EVERY)
    return () => clearInterval(id)
  }, [sync])

  // 아직 동기화 전이면 표시하지 않음
  if (remaining == null) return null

  const mm = String(Math.floor(remaining / 60000)).padStart(2, '0')
  const ss = String(Math.floor((remaining % 60000) / 1000)).padStart(2, '0')
  const isUrgent = remaining <= WARN_MS

  return (
    <>
      <button
        className={`st-chip${isUrgent ? ' st-chip--urgent' : ''}`}
        onClick={extend}
        title="클릭하면 시간이 연장됩니다"
      >
        <span className="st-clock">⏱</span>
        <span className="st-time">{mm}:{ss}</span>
        <span className="st-extend">연장</span>
      </button>

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
