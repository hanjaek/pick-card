import { useState, useEffect } from 'react'
import axios from 'axios'
import './AdminCards.css'

const authHeader = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })

const STATUS = {
  ON_SALE:     { label: '판매중',   cls: 'on' },
  OFF_SALE:    { label: '판매중지', cls: 'off' },
  MAINTENANCE: { label: '점검중',   cls: 'maint' },
}

export default function AdminCards() {
  const [cards, setCards]     = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)   // 수정 중인 카드 (모달)
  const [msg, setMsg]         = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const res = await axios.get('/api/admin/cards', authHeader())
      setCards(res.data)
    } catch (e) {
      setMsg(e.response?.data?.message || '목록 조회 실패')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 2500) }

  // 상태 변경
  const changeStatus = async (card, status) => {
    try {
      const res = await axios.patch(`/api/admin/cards/${card.id}/status`, { status }, authHeader())
      flash(res.data.message)
      setCards(prev => prev.map(c => c.id === card.id ? { ...c, saleStatus: status } : c))
    } catch (e) {
      flash(e.response?.data?.message || '상태 변경 실패')
    }
  }

  // 삭제
  const remove = async (card) => {
    if (!window.confirm(`'${card.name}' 카드를 삭제할까요?`)) return
    try {
      const res = await axios.delete(`/api/admin/cards/${card.id}`, authHeader())
      flash(res.data.message)
      setCards(prev => prev.filter(c => c.id !== card.id))
    } catch (e) {
      flash(e.response?.data?.message || '삭제 실패')
    }
  }

  // 수정 저장
  const saveEdit = async () => {
    try {
      const res = await axios.put(`/api/admin/cards/${editing.id}`, {
        name:           editing.name,
        annualFee:      Number(editing.annualFee) || 0,
        productFeature: editing.productFeature,
        colorFrom:      editing.colorFrom,
        colorTo:        editing.colorTo,
        brand:          editing.brand,
        trafficYn:      editing.trafficYn,
      }, authHeader())
      flash(res.data.message)
      setEditing(null)
      load()
    } catch (e) {
      flash(e.response?.data?.message || '수정 실패')
    }
  }

  return (
    <div className="ac-wrap">
      <div className="ac-head">
        <h2 className="ac-title">카드 상품 관리</h2>
        <span className="ac-sub">카드 정보 수정 · 판매 상태(판매중/중지/점검중) · 삭제</span>
      </div>

      {msg && <div className="ac-msg">{msg}</div>}

      {loading ? (
        <div className="ac-loading">불러오는 중…</div>
      ) : (
        <table className="ac-table">
          <thead>
            <tr>
              <th></th>
              <th>카드명</th>
              <th>종류</th>
              <th>연회비</th>
              <th>신청수</th>
              <th>조회수</th>
              <th>판매 상태</th>
              <th>작업</th>
            </tr>
          </thead>
          <tbody>
            {cards.map(c => (
              <tr key={c.id} className={c.saleStatus !== 'ON_SALE' ? 'ac-row-dim' : ''}>
                <td>
                  <span className="ac-dot" style={{ background: `linear-gradient(135deg, ${c.colorFrom}, ${c.colorTo})` }} />
                </td>
                <td className="ac-name">{c.name}</td>
                <td>{c.type}</td>
                <td>{c.annualFee === 0 ? '없음' : `${c.annualFee.toLocaleString()}원`}</td>
                <td className="ac-num">{c.applyCount}</td>
                <td className="ac-num">{c.viewCount}</td>
                <td>
                  <select
                    className={`ac-status ac-status--${STATUS[c.saleStatus]?.cls}`}
                    value={c.saleStatus}
                    onChange={e => changeStatus(c, e.target.value)}
                  >
                    {Object.entries(STATUS).map(([val, s]) => (
                      <option key={val} value={val}>{s.label}</option>
                    ))}
                  </select>
                </td>
                <td className="ac-actions">
                  <button className="ac-btn-edit" onClick={() => setEditing({ ...c })}>수정</button>
                  <button className="ac-btn-del" onClick={() => remove(c)}>삭제</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* 수정 모달 */}
      {editing && (
        <div className="ac-modal-bg" onClick={() => setEditing(null)}>
          <div className="ac-modal" onClick={e => e.stopPropagation()}>
            <h3 className="ac-modal-title">카드 수정 — {editing.name}</h3>

            <label className="ac-field"><span>카드명</span>
              <input value={editing.name} onChange={e => setEditing(p => ({ ...p, name: e.target.value }))} />
            </label>
            <label className="ac-field"><span>연회비 (원)</span>
              <input type="number" value={editing.annualFee} onChange={e => setEditing(p => ({ ...p, annualFee: e.target.value }))} />
            </label>
            <label className="ac-field"><span>상품 특징</span>
              <textarea rows={3} value={editing.productFeature || ''} onChange={e => setEditing(p => ({ ...p, productFeature: e.target.value }))} />
            </label>
            <div className="ac-field-row">
              <label className="ac-field"><span>색상 시작</span>
                <input value={editing.colorFrom || ''} onChange={e => setEditing(p => ({ ...p, colorFrom: e.target.value }))} placeholder="#1B3A5C" />
              </label>
              <label className="ac-field"><span>색상 끝</span>
                <input value={editing.colorTo || ''} onChange={e => setEditing(p => ({ ...p, colorTo: e.target.value }))} placeholder="#2D6195" />
              </label>
            </div>
            <div className="ac-preview" style={{ background: `linear-gradient(135deg, ${editing.colorFrom}, ${editing.colorTo})` }}>
              {editing.name}
            </div>
            <div className="ac-field-row">
              <label className="ac-field"><span>브랜드</span>
                <input value={editing.brand || ''} onChange={e => setEditing(p => ({ ...p, brand: e.target.value }))} />
              </label>
              <label className="ac-field"><span>후불교통</span>
                <select value={editing.trafficYn} onChange={e => setEditing(p => ({ ...p, trafficYn: e.target.value }))}>
                  <option value="Y">가능</option>
                  <option value="N">불가</option>
                </select>
              </label>
            </div>

            <div className="ac-modal-actions">
              <button className="ac-btn-cancel" onClick={() => setEditing(null)}>취소</button>
              <button className="ac-btn-save" onClick={saveEdit}>저장</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
