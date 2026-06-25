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
  const [creating, setCreating] = useState(null) // 신규 등록 (모달)
  const [msg, setMsg]         = useState('')

  const blankCard = () => ({
    name: '', type: '신용카드', annualFee: '', network: 'VISA',
    brand: '국내전용', trafficYn: 'N', colorFrom: '#1C1C2E', colorTo: '#2D2D3E',
    productFeature: '', benefits: [{ type: '할인', desc: '', discountRate: '', monthlyLimit: '' }],
  })

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

  // 신규 등록 저장
  const saveCreate = async () => {
    if (!creating.name.trim()) { flash('카드명을 입력하세요.'); return }
    try {
      const res = await axios.post('/api/admin/cards', {
        ...creating,
        annualFee: Number(creating.annualFee) || 0,
        benefits: creating.benefits
          .filter(b => b.desc.trim())
          .map(b => ({
            type: b.type, desc: b.desc,
            discountRate: b.discountRate ? Number(b.discountRate) : null,
            monthlyLimit: b.monthlyLimit ? Number(b.monthlyLimit) : null,
          })),
      }, authHeader())
      flash(res.data.message)
      setCreating(null)
      load()
    } catch (e) {
      flash(e.response?.data?.message || '등록 실패')
    }
  }

  // 등록 모달 혜택 행 조작
  const addBenefit = () => setCreating(p => ({ ...p, benefits: [...p.benefits, { type: '할인', desc: '', discountRate: '', monthlyLimit: '' }] }))
  const removeBenefit = (i) => setCreating(p => ({ ...p, benefits: p.benefits.filter((_, idx) => idx !== i) }))
  const setBenefit = (i, key, val) => setCreating(p => ({
    ...p, benefits: p.benefits.map((b, idx) => idx === i ? { ...b, [key]: val } : b)
  }))

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
        <div>
          <h2 className="ac-title">카드 상품 관리</h2>
          <span className="ac-sub">카드 등록 · 정보 수정 · 판매 상태(판매중/중지/점검중) · 삭제</span>
        </div>
        <button className="ac-btn-new" onClick={() => setCreating(blankCard())}>+ 새 카드 등록</button>
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

      {/* 신규 등록 모달 */}
      {creating && (
        <div className="ac-modal-bg" onClick={() => setCreating(null)}>
          <div className="ac-modal" onClick={e => e.stopPropagation()}>
            <h3 className="ac-modal-title">새 카드 등록</h3>

            <div className="ac-field-row">
              <label className="ac-field"><span>카드명 *</span>
                <input value={creating.name} onChange={e => setCreating(p => ({ ...p, name: e.target.value }))} placeholder="BNK ○○ 카드" />
              </label>
              <label className="ac-field"><span>종류 *</span>
                <select value={creating.type} onChange={e => setCreating(p => ({ ...p, type: e.target.value }))}>
                  <option value="신용카드">신용카드</option>
                  <option value="체크카드">체크카드</option>
                </select>
              </label>
            </div>
            <div className="ac-field-row">
              <label className="ac-field"><span>연회비 (원)</span>
                <input type="number" value={creating.annualFee} onChange={e => setCreating(p => ({ ...p, annualFee: e.target.value }))} placeholder="0" />
              </label>
              <label className="ac-field"><span>브랜드</span>
                <select value={creating.network} onChange={e => setCreating(p => ({ ...p, network: e.target.value }))}>
                  <option value="VISA">VISA</option>
                  <option value="MASTER">MASTER</option>
                </select>
              </label>
              <label className="ac-field"><span>후불교통</span>
                <select value={creating.trafficYn} onChange={e => setCreating(p => ({ ...p, trafficYn: e.target.value }))}>
                  <option value="Y">가능</option>
                  <option value="N">불가</option>
                </select>
              </label>
            </div>
            <label className="ac-field"><span>상품 특징</span>
              <textarea rows={2} value={creating.productFeature} onChange={e => setCreating(p => ({ ...p, productFeature: e.target.value }))} />
            </label>
            <div className="ac-field-row">
              <label className="ac-field"><span>색상 시작</span>
                <input value={creating.colorFrom} onChange={e => setCreating(p => ({ ...p, colorFrom: e.target.value }))} />
              </label>
              <label className="ac-field"><span>색상 끝</span>
                <input value={creating.colorTo} onChange={e => setCreating(p => ({ ...p, colorTo: e.target.value }))} />
              </label>
            </div>
            <div className="ac-preview" style={{ background: `linear-gradient(135deg, ${creating.colorFrom}, ${creating.colorTo})` }}>
              {creating.name || '카드 미리보기'}
            </div>

            {/* 혜택 입력 */}
            <div className="ac-benefit-head">
              <span>혜택</span>
              <button className="ac-benefit-add" onClick={addBenefit}>+ 혜택 추가</button>
            </div>
            {creating.benefits.map((b, i) => (
              <div key={i} className="ac-benefit-row">
                <select value={b.type} onChange={e => setBenefit(i, 'type', e.target.value)}>
                  {['할인', '적립', '캐시백', '무료', '면제', '우대'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <input className="ac-benefit-desc" placeholder="혜택 설명" value={b.desc} onChange={e => setBenefit(i, 'desc', e.target.value)} />
                <input className="ac-benefit-rate" type="number" placeholder="%" value={b.discountRate} onChange={e => setBenefit(i, 'discountRate', e.target.value)} />
                <button className="ac-benefit-del" onClick={() => removeBenefit(i)}>×</button>
              </div>
            ))}

            <div className="ac-modal-actions">
              <button className="ac-btn-cancel" onClick={() => setCreating(null)}>취소</button>
              <button className="ac-btn-save" onClick={saveCreate}>등록</button>
            </div>
            <p className="ac-create-note">등록 시 '판매중지' 상태로 생성됩니다. 검수 후 판매중으로 바꿔주세요.</p>
          </div>
        </div>
      )}
    </div>
  )
}
