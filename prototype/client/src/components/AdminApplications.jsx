import { useState, useEffect } from 'react'
import axios from 'axios'
import './AdminApplications.css'

const authHeader = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })

const FILTERS = [
  { key: '',          label: '전체' },
  { key: 'PENDING',   label: '대기중' },
  { key: 'APPROVED',  label: '승인' },
  { key: 'REJECTED',  label: '거절' },
  { key: 'CANCELLED', label: '취소' },
]
const STATUS = {
  PENDING:   { label: '대기중', cls: 'pending' },
  APPROVED:  { label: '승인',   cls: 'approved' },
  REJECTED:  { label: '거절',   cls: 'rejected' },
  CANCELLED: { label: '취소',   cls: 'cancelled' },
}
const fmt = (d) => d ? new Date(d).toLocaleDateString('ko-KR') : '-'

export default function AdminApplications() {
  const [apps, setApps]       = useState([])
  const [filter, setFilter]   = useState('')
  const [loading, setLoading] = useState(true)
  const [msg, setMsg]         = useState('')

  const load = async (status) => {
    setLoading(true)
    try {
      const q = status ? `?status=${status}` : ''
      const res = await axios.get(`/api/admin/applications${q}`, authHeader())
      setApps(res.data)
    } catch (e) {
      setMsg(e.response?.data?.message || '조회 실패')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load(filter) }, [filter])

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 2500) }

  const process = async (app, status) => {
    const label = status === 'APPROVED' ? '승인' : '거절'
    if (!window.confirm(`${app.applicantName}님의 '${app.cardName}' 신청을 ${label}할까요?`)) return
    try {
      const res = await axios.patch(`/api/admin/applications/${app.id}/status`, { status }, authHeader())
      flash(res.data.message)
      load(filter)
    } catch (e) {
      flash(e.response?.data?.message || '처리 실패')
    }
  }

  return (
    <div className="aa-wrap">
      <div className="aa-head">
        <h2 className="aa-title">신청 관리</h2>
        <span className="aa-sub">회원 카드 신청 조회 및 승인·거절 처리</span>
      </div>

      {/* 상태 필터 */}
      <div className="aa-filters">
        {FILTERS.map(f => (
          <button key={f.key} className={`aa-filter ${filter === f.key ? 'on' : ''}`}
            onClick={() => setFilter(f.key)}>{f.label}</button>
        ))}
      </div>

      {msg && <div className="aa-msg">{msg}</div>}

      {loading ? (
        <div className="aa-loading">불러오는 중…</div>
      ) : apps.length === 0 ? (
        <div className="aa-empty">해당하는 신청 내역이 없습니다.</div>
      ) : (
        <table className="aa-table">
          <thead>
            <tr>
              <th>신청자</th>
              <th>카드</th>
              <th>연락처</th>
              <th>주거/소득</th>
              <th>신청일</th>
              <th>상태</th>
              <th>처리</th>
            </tr>
          </thead>
          <tbody>
            {apps.map(a => (
              <tr key={a.id}>
                <td>
                  <div className="aa-applicant">{a.applicantName}</div>
                  <div className="aa-userid">@{a.userId}</div>
                </td>
                <td>
                  <div className="aa-cardname">{a.cardName}</div>
                  <div className="aa-cardtype">{a.cardType}</div>
                </td>
                <td className="aa-small">{a.phoneNo || '-'}</td>
                <td className="aa-small">{a.residenceType || '-'} / {a.incomeType || '-'}</td>
                <td className="aa-small">{fmt(a.appliedDt)}</td>
                <td><span className={`aa-status ${STATUS[a.status]?.cls}`}>{STATUS[a.status]?.label}</span></td>
                <td>
                  {a.status === 'PENDING' ? (
                    <div className="aa-actions">
                      <button className="aa-btn-approve" onClick={() => process(a, 'APPROVED')}>승인</button>
                      <button className="aa-btn-reject"  onClick={() => process(a, 'REJECTED')}>거절</button>
                    </div>
                  ) : (
                    <span className="aa-processed">{fmt(a.processedDt)} 처리</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
