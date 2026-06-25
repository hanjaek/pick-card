import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import AdminCards from '../components/AdminCards'
import AdminDashboard from '../components/AdminDashboard'
import AdminApplications from '../components/AdminApplications'
import AdminLogs from '../components/AdminLogs'
import './Admin.css'

// 인증 헤더 생성 헬퍼: 모든 관리자 API 요청에 Bearer 토큰 첨부
const authHeader = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
})

// 좌측 내비게이션 메뉴
const NAV = [
  { key: 'dashboard', label: '대시보드',  icon: '◴' },
  { key: 'cards',     label: '카드 관리',  icon: '▦' },
  { key: 'apps',      label: '신청 관리',  icon: '▤' },
  { key: 'terms',     label: '약관 관리',  icon: '▣' },
  { key: 'logs',      label: '활동 로그',  icon: '☷' },
]
// 페이지 제목/설명
const PAGE = {
  dashboard: ['대시보드',   '운영 현황을 한눈에'],
  cards:     ['카드 관리',   '카드 상품 등록 · 수정 · 노출 제어'],
  apps:      ['신청 관리',   '회원 카드 신청 승인 · 거절'],
  terms:     ['약관 관리',   '약관 PDF · 버전 · 변경 이력'],
  logs:      ['활동 로그',   '관리자 변경 이력 · 감사 추적'],
}

function Admin() {
  const navigate = useNavigate()

  // ---- 상태 ----
  const [cards,         setCards]         = useState([])   // 카드 상품 목록
  const [selectedCard,  setSelectedCard]  = useState(null) // 선택된 카드
  const [termsList,     setTermsList]     = useState([])   // 해당 카드의 약관 목록
  const [history,       setHistory]       = useState([])   // 약관 변경 이력
  const [historyTarget, setHistoryTarget] = useState(null) // 이력 조회 중인 terms row
  const [showUpload,    setShowUpload]    = useState(false) // 업로드 모달 표시
  const [uploadForm,    setUploadForm]    = useState({
    doc_type: '이용약관', version_no: '', terms_title: '', effective_dt: '', change_reason: ''
  })
  const [file,     setFile]    = useState(null)
  const [loading,  setLoading] = useState(false)
  const [message,  setMessage] = useState('')
  const [tab,      setTab]     = useState('dashboard')   // dashboard | cards | apps | terms
  const fileRef = useRef()

  // ---- 초기 로드 ----
  useEffect(() => {
    fetchCards()
  }, [])

  // 카드 선택 시 약관 목록 로드
  useEffect(() => {
    if (selectedCard) fetchTerms(selectedCard.id)
  }, [selectedCard])

  const fetchCards = async () => {
    const res = await axios.get('/api/cards')
    setCards(res.data)
    if (res.data.length > 0) setSelectedCard(res.data[0])
  }

  const fetchTerms = async (cardId) => {
    const res = await axios.get(`/api/terms?card_id=${cardId}`)
    setTermsList(res.data)
    setHistory([])
    setHistoryTarget(null)
  }

  const fetchHistory = async (terms) => {
    // 이미 열린 이력을 다시 클릭하면 닫기
    if (historyTarget?.id === terms.id) {
      setHistoryTarget(null)
      setHistory([])
      return
    }
    const res = await axios.get(`/api/terms/${terms.id}/history`)
    setHistory(res.data)
    setHistoryTarget(terms)
  }

  // ---- 약관 PDF 업로드 ----
  const handleUpload = async (e) => {
    e.preventDefault()
    if (!file) return setMessage('PDF 파일을 선택해주세요.')

    setLoading(true)
    setMessage('')

    const fd = new FormData()
    fd.append('card_id',       selectedCard.id)
    fd.append('doc_type',      uploadForm.doc_type)
    fd.append('version_no',    uploadForm.version_no)
    fd.append('terms_title',   uploadForm.terms_title)
    fd.append('effective_dt',  uploadForm.effective_dt)
    fd.append('change_reason', uploadForm.change_reason)
    fd.append('file',          file) // PDF 파일

    try {
      const res = await axios.post('/api/terms/upload', fd, {
        ...authHeader(),
        headers: {
          ...authHeader().headers,
          'Content-Type': 'multipart/form-data'
        }
      })
      setMessage(`등록 완료: ${res.data.pdf_path}`)
      setShowUpload(false)
      setFile(null)
      setUploadForm({ doc_type: '이용약관', version_no: '', terms_title: '', effective_dt: '', change_reason: '' })
      fetchTerms(selectedCard.id) // 목록 새로고침
    } catch (err) {
      setMessage(err.response?.data?.message || '업로드 실패')
    } finally {
      setLoading(false)
    }
  }

  // ---- 약관 삭제 ----
  const handleDeleteTerms = async (t) => {
    if (!window.confirm(`'${t.doc_type || ''} ${t.version_no}' 약관을 삭제할까요?`)) return
    try {
      await axios.delete(`/api/terms/${t.id}`, authHeader())
      setMessage('약관이 삭제되었습니다.')
      fetchTerms(selectedCard.id)
    } catch (err) {
      setMessage(err.response?.data?.message || '삭제 실패')
    }
  }

  const handleLogout = () => {
    localStorage.clear()
    navigate('/login')
  }

  const userName = localStorage.getItem('userName') || '관리자'

  return (
    <div className="admin-shell">

      {/* ───── 좌측 내비게이션 ───── */}
      <aside className="admin-nav">
        <div className="admin-nav-brand">
          <span className="admin-nav-logo">BNK</span>
          <div className="admin-nav-brandtext">
            <span className="admin-nav-name">Pickard</span>
            <span className="admin-nav-sub">Admin Console</span>
          </div>
        </div>

        <nav className="admin-nav-menu">
          {NAV.map(n => (
            <button
              key={n.key}
              className={`admin-nav-item ${tab === n.key ? 'on' : ''}`}
              onClick={() => setTab(n.key)}
            >
              <span className="admin-nav-ic">{n.icon}</span>
              {n.label}
            </button>
          ))}
        </nav>

        <div className="admin-nav-foot">
          <div className="admin-nav-user">
            <span className="admin-nav-avatar">{userName[0]}</span>
            <div className="admin-nav-utext">
              <span className="admin-nav-uname">{userName}</span>
              <span className="admin-nav-urole">시스템 관리자</span>
            </div>
          </div>
          <button className="admin-nav-logout" onClick={handleLogout}>로그아웃</button>
        </div>
      </aside>

      {/* ───── 콘텐츠 ───── */}
      <div className="admin-content">
        <header className="admin-topbar">
          <div>
            <div className="admin-crumb">관리자 &rsaquo; {PAGE[tab][0]}</div>
            <h1 className="admin-topbar-title">{PAGE[tab][0]}</h1>
          </div>
          <span className="admin-topbar-sub">{PAGE[tab][1]}</span>
        </header>

        <div className="admin-view">

      {/* ===== 대시보드 탭 ===== */}
      {tab === 'dashboard' && <AdminDashboard />}

      {/* ===== 카드 관리 탭 ===== */}
      {tab === 'cards' && <AdminCards />}

      {/* ===== 신청 관리 탭 ===== */}
      {tab === 'apps' && <AdminApplications />}

      {/* ===== 활동 로그 탭 ===== */}
      {tab === 'logs' && <AdminLogs />}

      {/* ===== 약관 관리 탭 ===== */}
      {tab === 'terms' && (
      <div className="admin-body">

        {/* ---- 좌측 사이드바: 카드 상품 목록 ---- */}
        <aside className="admin-sidebar">
          <div className="sidebar-label">카드 상품</div>
          <ul className="sidebar-list">
            {cards.map(card => (
              <li
                key={card.id}
                className={`sidebar-item ${selectedCard?.id === card.id ? 'active' : ''}`}
                onClick={() => {
                  setSelectedCard(card)
                  setShowUpload(false)
                  setMessage('')
                }}
              >
                {/* 카드 색상 인디케이터 */}
                <span
                  className="sidebar-dot"
                  style={{ background: `linear-gradient(135deg, ${card.color_from}, ${card.color_to})` }}
                />
                <div className="sidebar-item-text">
                  <span className="sidebar-item-name">{card.prd_nm}</span>
                  <span className="sidebar-item-type">{card.card_type_cd}</span>
                </div>
              </li>
            ))}
          </ul>
        </aside>

        {/* ---- 메인 콘텐츠 ---- */}
        <main className="admin-main">
          {selectedCard && (
            <>
              {/* 섹션 헤더 */}
              <div className="admin-section-header">
                <div>
                  <h2 className="admin-section-title">{selectedCard.prd_nm}</h2>
                  <span className="admin-section-sub">이 카드의 약관 · 추가 / 수정(새 버전) / 삭제</span>
                </div>
                <button
                  className="btn-new-terms"
                  onClick={() => { setShowUpload(true); setMessage('') }}
                >
                  + 이 카드에 약관 추가
                </button>
              </div>

              {/* 피드백 메시지 */}
              {message && (
                <div className={`admin-msg ${message.includes('완료') ? 'success' : 'error'}`}>
                  {message}
                </div>
              )}

              {/* ---- 약관 PDF 업로드 모달 ---- */}
              {showUpload && (
                <div className="upload-box">
                  <div className="upload-box-header">
                    <h3>새 약관 PDF 등록 <span className="upload-box-card">— {selectedCard.prd_nm}</span></h3>
                    <button className="btn-close" onClick={() => setShowUpload(false)}>X</button>
                  </div>
                  <form onSubmit={handleUpload} className="upload-form">
                    <div className="upload-form-row">
                      <div className="uf-group">
                        <label>문서 종류</label>
                        <select
                          value={uploadForm.doc_type}
                          onChange={e => setUploadForm(p => ({ ...p, doc_type: e.target.value }))}
                        >
                          <option value="상품안내장">상품안내장</option>
                          <option value="이용약관">이용약관</option>
                          <option value="포인트이용약관">포인트이용약관</option>
                          <option value="표준약관">표준약관</option>
                          <option value="부속약관">부속약관</option>
                        </select>
                      </div>
                      <div className="uf-group">
                        <label>버전 번호</label>
                        <input
                          type="text"
                          placeholder="예: v2.0"
                          value={uploadForm.version_no}
                          onChange={e => setUploadForm(p => ({ ...p, version_no: e.target.value }))}
                          required
                        />
                      </div>
                      <div className="uf-group">
                        <label>시행일자</label>
                        <input
                          type="date"
                          value={uploadForm.effective_dt}
                          onChange={e => setUploadForm(p => ({ ...p, effective_dt: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div className="uf-group">
                      <label>약관 제목</label>
                      <input
                        type="text"
                        placeholder="예: BNK AI 마스터카드 이용약관 (2차 개정)"
                        value={uploadForm.terms_title}
                        onChange={e => setUploadForm(p => ({ ...p, terms_title: e.target.value }))}
                      />
                    </div>
                    <div className="uf-group">
                      <label>변경 사유</label>
                      <input
                        type="text"
                        placeholder="예: 혜택 조건 개정, 연회비 조정 등"
                        value={uploadForm.change_reason}
                        onChange={e => setUploadForm(p => ({ ...p, change_reason: e.target.value }))}
                      />
                    </div>

                    {/* PDF 파일 선택 영역 */}
                    <div
                      className="upload-drop-area"
                      onClick={() => fileRef.current.click()}
                    >
                      {file ? (
                        <span className="upload-filename">{file.name}</span>
                      ) : (
                        <span className="upload-placeholder">
                          클릭하여 PDF 파일 선택<br />
                          <small>저장 파일명: {new Date().toISOString().slice(0,10)}_NNN.pdf</small>
                        </span>
                      )}
                      <input
                        ref={fileRef}
                        type="file"
                        accept="application/pdf"
                        style={{ display: 'none' }}
                        onChange={e => setFile(e.target.files[0])}
                      />
                    </div>

                    <div className="upload-form-actions">
                      <button type="button" className="btn-cancel" onClick={() => setShowUpload(false)}>
                        취소
                      </button>
                      <button type="submit" className="btn-upload-submit" disabled={loading}>
                        {loading ? '업로드 중...' : '등록하기'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* ---- 약관 목록 테이블 ---- */}
              <div className="terms-table-wrap">
                <table className="terms-table">
                  <thead>
                    <tr>
                      <th>문서종류</th>
                      <th>버전</th>
                      <th>제목</th>
                      <th>시행일</th>
                      <th>PDF 파일</th>
                      <th>등록일</th>
                      <th>상태</th>
                      <th>관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {termsList.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="terms-empty">
                          등록된 약관이 없습니다. 새 약관을 등록해주세요.
                        </td>
                      </tr>
                    ) : (
                      termsList.map(t => (
                        <>
                          <tr key={t.id} className={t.is_active ? 'row-active' : ''}>
                            <td><span className="doctype-badge">{t.doc_type || '이용약관'}</span></td>
                            <td><span className="version-badge">{t.version_no}</span></td>
                            <td className="td-title">{t.terms_title || '-'}</td>
                            <td>{t.effective_dt ? t.effective_dt.slice(0, 10) : '-'}</td>
                            <td>
                              {t.pdf_path ? (
                                <a
                                  href={`/uploads/terms/${t.pdf_path}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="pdf-link"
                                >
                                  {t.pdf_path}
                                </a>
                              ) : (
                                <span className="no-pdf">미첨부</span>
                              )}
                            </td>
                            <td>{new Date(t.reg_dt).toLocaleDateString('ko-KR')}</td>
                            <td>
                              {t.is_active
                                ? <span className="badge-active">현행</span>
                                : <span className="badge-old">구버전</span>
                              }
                            </td>
                            <td className="terms-manage">
                              <button
                                className="btn-history"
                                onClick={() => fetchHistory(t)}
                              >
                                이력 {historyTarget?.id === t.id ? '닫기' : '보기'}
                              </button>
                              <button
                                className="btn-terms-del"
                                onClick={() => handleDeleteTerms(t)}
                              >
                                삭제
                              </button>
                            </td>
                          </tr>

                          {/* 인라인 이력 행 */}
                          {historyTarget?.id === t.id && history.length > 0 && (
                            <tr key={`hist-${t.id}`} className="row-history">
                              <td colSpan={8}>
                                <div className="history-panel">
                                  <div className="history-panel-title">변경 이력</div>
                                  <table className="history-table">
                                    <thead>
                                      <tr>
                                        <th>버전</th>
                                        <th>변경 내용</th>
                                        <th>수정자</th>
                                        <th>PDF</th>
                                        <th>변경일시</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {history.map(h => (
                                        <tr key={h.id}>
                                          <td>{h.version_no}</td>
                                          <td>{h.change_content || '-'}</td>
                                          <td>{h.modifier_id}</td>
                                          <td>
                                            {h.pdf_path ? (
                                              <a
                                                href={`/uploads/terms/${h.pdf_path}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="pdf-link"
                                              >
                                                {h.pdf_path}
                                              </a>
                                            ) : '-'}
                                          </td>
                                          <td>{new Date(h.change_dt).toLocaleString('ko-KR')}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </main>

      </div>
      )}

        </div>{/* admin-view */}
      </div>{/* admin-content */}
    </div>
  )
}

export default Admin
