import { useState, useEffect } from 'react'
import axios from 'axios'
import './AdminLogs.css'

const authHeader = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })

// action 코드 → 한글 라벨 + 색
const ACTION = {
  CARD_CREATE: { label: '카드 등록',   cls: 'create' },
  CARD_UPDATE: { label: '카드 수정',   cls: 'update' },
  CARD_STATUS: { label: '상태 변경',   cls: 'status' },
  CARD_DELETE: { label: '카드 삭제',   cls: 'delete' },
  APP_PROCESS: { label: '신청 처리',   cls: 'process' },
}
const fmt = (d) => d ? new Date(d).toLocaleString('ko-KR', {
  month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
}) : '-'

export default function AdminLogs() {
  const [logs, setLogs]       = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    axios.get('/api/admin/logs', authHeader())
      .then(res => setLogs(res.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="al-wrap">
      <div className="al-head">
        <h2 className="al-title">관리자 활동 로그</h2>
        <span className="al-sub">모든 변경 이력 (감사 추적) · 최근 50건</span>
      </div>

      {loading ? (
        <div className="al-loading">불러오는 중…</div>
      ) : logs.length === 0 ? (
        <div className="al-empty">아직 기록된 활동이 없습니다.</div>
      ) : (
        <table className="al-table">
          <thead>
            <tr>
              <th>일시</th>
              <th>관리자</th>
              <th>작업</th>
              <th>내용</th>
            </tr>
          </thead>
          <tbody>
            {logs.map(l => (
              <tr key={l.id}>
                <td className="al-time">{fmt(l.createdAt)}</td>
                <td className="al-admin">{l.adminName || '-'}</td>
                <td>
                  <span className={`al-action ${ACTION[l.action]?.cls || ''}`}>
                    {ACTION[l.action]?.label || l.action}
                  </span>
                </td>
                <td className="al-detail">{l.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
