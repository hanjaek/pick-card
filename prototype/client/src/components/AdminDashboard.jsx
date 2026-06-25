import { useState, useEffect } from 'react'
import axios from 'axios'
import './AdminDashboard.css'

const authHeader = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })

const STATUS_LABEL = { PENDING: '대기중', APPROVED: '승인', REJECTED: '거절', CANCELLED: '취소' }
const STATUS_CLS   = { PENDING: 'pending', APPROVED: 'approved', REJECTED: 'rejected', CANCELLED: 'cancelled' }

export default function AdminDashboard() {
  const [data, setData]     = useState(null)
  const [loading, setLoad]  = useState(true)

  useEffect(() => {
    axios.get('/api/admin/dashboard', authHeader())
      .then(res => setData(res.data))
      .catch(() => {})
      .finally(() => setLoad(false))
  }, [])

  if (loading) return <div className="ad-loading">불러오는 중…</div>
  if (!data)   return <div className="ad-loading">데이터를 불러올 수 없습니다.</div>

  const { summary, byStatus, popular } = data
  const maxApply = Math.max(1, ...popular.map(p => p.applyCount))
  const statusTotal = Object.values(byStatus).reduce((a, b) => a + b, 0)

  return (
    <div className="ad-wrap">
      <div className="ad-head">
        <h2 className="ad-title">대시보드</h2>
        <span className="ad-sub">실시간 운영 통계 (실제 DB 집계)</span>
      </div>

      {/* 요약 카드 4개 */}
      <div className="ad-summary">
        <div className="ad-card">
          <span className="ad-card-label">전체 회원</span>
          <span className="ad-card-num">{summary.memberCount.toLocaleString()}<em>명</em></span>
        </div>
        <div className="ad-card">
          <span className="ad-card-label">전체 신청</span>
          <span className="ad-card-num">{summary.applyTotal.toLocaleString()}<em>건</em></span>
        </div>
        <div className="ad-card">
          <span className="ad-card-label">판매중 카드</span>
          <span className="ad-card-num">{summary.onSaleCards}<em>종</em></span>
        </div>
        <div className="ad-card ad-card--accent">
          <span className="ad-card-label">대기중 신청</span>
          <span className="ad-card-num">{summary.pendingCount}<em>건</em></span>
        </div>
      </div>

      <div className="ad-grid">
        {/* 인기 카드 순위 */}
        <div className="ad-panel">
          <h3 className="ad-panel-title">인기 카드 순위 <span>(신청 많은 순)</span></h3>
          <div className="ad-rank">
            {popular.map((p, i) => (
              <div key={p.id} className="ad-rank-row">
                <span className="ad-rank-no">{i + 1}</span>
                <div className="ad-rank-body">
                  <div className="ad-rank-top">
                    <span className="ad-rank-name">{p.name}</span>
                    <span className="ad-rank-count">{p.applyCount}건</span>
                  </div>
                  <div className="ad-bar-track">
                    <div className="ad-bar-fill" style={{ width: `${(p.applyCount / maxApply) * 100}%` }} />
                  </div>
                  <span className="ad-rank-view">조회 {p.viewCount}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 상태별 분포 */}
        <div className="ad-panel">
          <h3 className="ad-panel-title">신청 상태 분포</h3>
          <div className="ad-status-list">
            {Object.keys(STATUS_LABEL).map(st => (
              <div key={st} className="ad-status-row">
                <span className={`ad-status-dot ${STATUS_CLS[st]}`} />
                <span className="ad-status-label">{STATUS_LABEL[st]}</span>
                <div className="ad-status-track">
                  <div className={`ad-status-bar ${STATUS_CLS[st]}`}
                    style={{ width: statusTotal ? `${(byStatus[st] / statusTotal) * 100}%` : '0%' }} />
                </div>
                <span className="ad-status-num">{byStatus[st]}건</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
