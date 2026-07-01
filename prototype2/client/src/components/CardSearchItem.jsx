import { useNavigate } from 'react-router-dom'
import './CardSearchItem.css'

export default function CardSearchItem({ card }) {
  const navigate  = useNavigate()
  const colorFrom = card.colorFrom || '#1C1C2E'
  const colorTo   = card.colorTo   || '#2D2D3E'
  const name      = card.name      || ''
  const type      = card.type      || ''
  const benefits  = card.benefits  || []
  const annualFee = card.annualFee ?? 0
  const img       = card.imageUrl  || null   // 실물 이미지(있으면) / 없으면 그라디언트

  const goDetail = ()  => navigate(`/cards/${card.id}`)
  const goApply  = (e) => { e.stopPropagation(); navigate(`/cards/${card.id}/apply`) }

  return (
    <div className="csi-wrap">

      {/* ── 카드 그래픽 (hover 시 flip) ── */}
      <div className="csi-flip" onClick={goDetail}>
        <div className="csi-flip-inner">

          {/* 앞면 — 실물 이미지 있으면 이미지, 없으면 그라디언트 */}
          <div
            className="csi-front"
            style={img ? undefined : { background: `linear-gradient(145deg, ${colorFrom}, ${colorTo})` }}
          >
            {img ? (
              <img className="csi-img" src={img} alt={name} loading="lazy" />
            ) : (
              <>
                <div className="csi-chip" />
                <span className="csi-network">{card.network || 'VISA'}</span>
                <div className="csi-front-bottom">
                  <span className="csi-front-name">{name}</span>
                  <span className="csi-front-type">{type}</span>
                </div>
                <div className="csi-gloss" />
              </>
            )}
          </div>

          {/* 뒷면 (모든 혜택) */}
          <div className="csi-back">
            <p className="csi-back-title">{name}</p>
            <ul className="csi-back-list">
              {benefits.map((b, i) => (
                <li key={i}>
                  <span className="csi-back-dot" />
                  {typeof b === 'string' ? b : b.desc}
                </li>
              ))}
              {benefits.length === 0 && <li>혜택 정보 없음</li>}
            </ul>
            <p className="csi-back-fee">
              연회비 {annualFee > 0 ? `${annualFee.toLocaleString()}원` : '없음'}
            </p>
          </div>

        </div>
      </div>

      {/* ── 항상 보이는 정보 영역 ── */}
      <div className="csi-info">

        {/* 종류 태그 */}
        <div className="csi-badge-row">
          <span className="csi-type-tag">{type}</span>
        </div>

        {/* 카드명 */}
        <h3 className="csi-name" onClick={goDetail}>{name}</h3>

        {/* 주요 혜택 2줄 */}
        <ul className="csi-benefits">
          {benefits.slice(0, 2).map((b, i) => (
            <li key={i}>{typeof b === 'string' ? b : b.desc}</li>
          ))}
        </ul>

        {/* 연회비 + 신청 버튼 */}
        <div className="csi-footer">
          <span className="csi-fee">
            연회비 {annualFee > 0 ? `${annualFee.toLocaleString()}원` : '없음'}
          </span>
          <button className="csi-apply" onClick={goApply}>신청하기</button>
        </div>

      </div>
    </div>
  )
}
