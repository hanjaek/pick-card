import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import './CardDesign.css'

const PRESETS = {
  colorMood: [
    { label: '모던 블랙', value: 'modern dark' },
    { label: '로열 퍼플', value: 'royal purple luxury' },
    { label: '오션 블루', value: 'ocean blue deep sea' },
    { label: '선셋 오렌지', value: 'sunset orange warm' },
    { label: '포레스트 그린', value: 'forest green nature' },
    { label: '로즈 골드', value: 'rose gold elegant' },
  ],
  style: [
    { label: '미니멀', value: 'minimal clean simple' },
    { label: '럭셔리', value: 'luxury premium metallic' },
    { label: '자연', value: 'nature organic soft' },
    { label: '기하학', value: 'geometric abstract sharp' },
    { label: '그라디언트', value: 'gradient smooth vivid' },
    { label: '다크모드', value: 'dark mode sleek tech' },
  ],
}

function CardPreview({ card, design, generating }) {
  const colorFrom = design?.colorFrom || card.colorFrom
  const colorTo   = design?.colorTo   || card.colorTo

  return (
    <div className="design-preview-wrapper">
      <div
        className={`design-card ${generating ? 'generating' : ''}`}
        style={{ background: `linear-gradient(135deg, ${colorFrom}, ${colorTo})` }}
      >
        {generating && (
          <div className="design-card-overlay">
            <div className="design-generating-dots">
              <span /><span /><span />
            </div>
            <p>AI 디자인 생성 중...</p>
          </div>
        )}
        <div className="dc-chip" />
        <div className="dc-network">{card.network}</div>
        <div className="dc-number">**** **** **** 1234</div>
        <div className="dc-footer">
          <span className="dc-name">{card.name}</span>
          <span className="dc-badge">{card.type}</span>
        </div>
        {design?.themeName && !generating && (
          <div className="dc-theme-tag">✨ {design.themeName}</div>
        )}
        <div className="dc-shine" />
      </div>

      {design && !generating && (
        <div className="design-result-info">
          <h3 className="dri-theme">{design.themeName}</h3>
          <p className="dri-desc">{design.designDescription}</p>
          <div className="dri-colors">
            <div className="dri-color" style={{ background: design.colorFrom }} title={design.colorFrom} />
            <div className="dri-color" style={{ background: design.colorTo   }} title={design.colorTo}   />
            {design.accentColor && (
              <div className="dri-color" style={{ background: design.accentColor }} title={design.accentColor} />
            )}
          </div>
          <div className="dri-tags">
            {(design.keywords || []).map((k, i) => (
              <span key={i} className="dri-tag">{k}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function CardDesign() {
  const { id }   = useParams()
  const navigate = useNavigate()

  const [card, setCard]           = useState(null)
  const [loading, setLoading]     = useState(true)
  const [prompt, setPrompt]       = useState('')
  const [selected, setSelected]   = useState({ colorMood: '', style: '' })
  const [design, setDesign]       = useState(null)
  const [generating, setGenerating] = useState(false)
  const [error, setError]         = useState('')
  const [history, setHistory]     = useState([])

  const token = localStorage.getItem('token')

  useEffect(() => {
    if (!token) { navigate('/login'); return }
    fetch(`/api/cards/${id}`)
      .then(r => r.json())
      .then(data => { setCard(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [id, token, navigate])

  useEffect(() => {
    if (!token) return
    fetch('/api/design/mine', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        const mine = Array.isArray(data)
          ? data.filter(d => String(d.card_id) === String(id))
          : []
        setHistory(mine)
      })
      .catch(() => {})
  }, [id, token])

  if (loading) return <div className="dg-loading"><div className="spinner" /></div>
  if (!card)   return <div className="dg-error">카드를 찾을 수 없습니다.</div>

  const buildPrompt = () => {
    const parts = []
    if (prompt.trim()) parts.push(prompt.trim())
    if (selected.colorMood) parts.push(`색상 무드: ${selected.colorMood}`)
    if (selected.style)     parts.push(`스타일: ${selected.style}`)
    return parts.join('. ')
  }

  const handleGenerate = async () => {
    const finalPrompt = buildPrompt()
    if (!finalPrompt) { setError('디자인 설명을 입력하거나 옵션을 선택해주세요.'); return }
    setError('')
    setGenerating(true)
    setDesign(null)
    try {
      const res = await fetch('/api/design/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          cardId: id,
          prompt: finalPrompt,
          preferences: selected
        })
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.message || '디자인 생성에 실패했습니다.')
        return
      }
      setDesign(data)
      setHistory(prev => [{ ...data, card_id: id, id: data.id, theme_name: data.themeName }, ...prev])
    } catch {
      setError('서버 오류가 발생했습니다.')
    } finally {
      setGenerating(false)
    }
  }

  const handleApply = () => {
    if (!design) return
    navigate(`/cards/${id}/apply`, { state: { design } })
  }

  const selectPreset = (category, value) => {
    setSelected(p => ({ ...p, [category]: p[category] === value ? '' : value }))
  }

  return (
    <div className="dg-page">
      {/* 헤더 */}
      <div className="dg-header">
        <Link to={`/cards/${id}`} className="dg-back">← 상세로 돌아가기</Link>
        <h1 className="dg-title">
          <span>✨</span> AI 커스텀 카드 디자인
        </h1>
        <p className="dg-subtitle">원하는 디자인을 설명하면 AI가 나만의 카드를 만들어드립니다</p>
      </div>

      <div className="dg-layout">
        {/* 좌측: 입력 영역 */}
        <div className="dg-input-area">
          {/* 자유 입력 */}
          <div className="dg-section">
            <h3 className="dg-section-title">어떤 디자인을 원하시나요?</h3>
            <textarea
              className="dg-prompt"
              placeholder="예) 우주를 배경으로 한 다크 블루 카드&#10;밤하늘의 별이 빛나는 느낌&#10;세련되고 미니멀한 블랙 카드"
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              rows={4}
            />
          </div>

          {/* 색상 무드 */}
          <div className="dg-section">
            <h3 className="dg-section-title">색상 무드</h3>
            <div className="dg-preset-grid">
              {PRESETS.colorMood.map(p => (
                <button
                  key={p.value}
                  className={`dg-preset ${selected.colorMood === p.value ? 'selected' : ''}`}
                  onClick={() => selectPreset('colorMood', p.value)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* 스타일 */}
          <div className="dg-section">
            <h3 className="dg-section-title">스타일</h3>
            <div className="dg-preset-grid">
              {PRESETS.style.map(p => (
                <button
                  key={p.value}
                  className={`dg-preset ${selected.style === p.value ? 'selected' : ''}`}
                  onClick={() => selectPreset('style', p.value)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="dg-error">{error}</p>}

          <button
            className="dg-btn-generate"
            onClick={handleGenerate}
            disabled={generating}
          >
            {generating ? (
              <><span className="dg-btn-spinner" /> AI 디자인 생성 중...</>
            ) : (
              '✨ AI 디자인 생성'
            )}
          </button>

          {design && !generating && (
            <button className="dg-btn-apply" onClick={handleApply}>
              이 디자인으로 신청하기 →
            </button>
          )}
        </div>

        {/* 우측: 카드 프리뷰 */}
        <div className="dg-preview-area">
          <CardPreview card={card} design={design} generating={generating} />

          {/* 내 디자인 히스토리 */}
          {history.length > 0 && (
            <div className="dg-history">
              <h3 className="dg-history-title">이전에 만든 디자인</h3>
              <div className="dg-history-list">
                {history.map(d => (
                  <button
                    key={d.id}
                    className={`dg-history-item ${design?.id === d.id ? 'active' : ''}`}
                    onClick={() => setDesign({
                      id: d.id,
                      themeName: d.theme_name,
                      colorFrom: d.color_from,
                      colorTo: d.color_to,
                      accentColor: d.accent_color,
                      designDescription: d.ai_description,
                      keywords: d.design_data
                        ? (typeof d.design_data === 'string'
                          ? JSON.parse(d.design_data).keywords
                          : d.design_data.keywords) || []
                        : []
                    })}
                  >
                    <div
                      className="dg-hist-swatch"
                      style={{ background: `linear-gradient(135deg, ${d.color_from}, ${d.color_to})` }}
                    />
                    <div className="dg-hist-info">
                      <span className="dg-hist-name">{d.theme_name}</span>
                      <span className="dg-hist-date">{d.created_dt?.slice(0, 10)}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
