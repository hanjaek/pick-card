import { useNavigate } from 'react-router-dom'
import './CardSearchItem.css'

const BADGES = {
  1: { label: '인기',    cls: 'popular'  },
  2: { label: '인기',    cls: 'popular'  },
  3: { label: '지역특화', cls: 'regional' },
  4: { label: '프리미엄', cls: 'premium'  },
  5: { label: '신규',    cls: 'new'      },
  6: { label: '신규',    cls: 'new'      },
  7: { label: '신규',    cls: 'new'      },
  8: { label: '신규',    cls: 'new'      },
}

const TAGS = {
  1: ['편의점', '카페', '대중교통', '영화'],
  2: ['대형마트', '주유', '병원', '온라인쇼핑'],
  3: ['지역가맹점', '대중교통', '주차', '관광'],
  4: ['공항라운지', '해외결제', '호텔', '골프'],
  5: ['대중교통', '전기차', '친환경', '공유'],
  6: ['쿠팡', '간편결제', 'SSG', '올리브영'],
  7: ['해외결제', '공항라운지', '면세점', '환전'],
  8: ['캐시백', '통신', 'ATM', '공과금'],
}

export default function CardSearchItem({ card }) {
  const navigate  = useNavigate()
  const colorFrom = card.colorFrom || '#1C1C2E'
  const colorTo   = card.colorTo   || '#2D2D3E'
  const name      = card.name      || ''
  const type      = card.type      || ''
  const benefits  = card.benefits  || []
  const annualFee = card.annualFee ?? 0
  const badge     = BADGES[card.id]
  const tags      = TAGS[card.id]  || []

  const goDetail = ()  => navigate(`/cards/${card.id}`)
  const goApply  = (e) => { e.stopPropagation(); navigate(`/cards/${card.id}/apply`) }

  return (
    <div className="csi-wrap">

      {/* ── 카드 그래픽 (hover 시 flip) ── */}
      <div className="csi-flip" onClick={goDetail}>
        <div className="csi-flip-inner">

          {/* 앞면 */}
          <div
            className="csi-front"
            style={{ background: `linear-gradient(145deg, ${colorFrom}, ${colorTo})` }}
          >
            <div className="csi-chip" />
            <span className="csi-network">{card.network || 'VISA'}</span>
            <div className="csi-front-bottom">
              <span className="csi-front-name">{name}</span>
              <span className="csi-front-type">{type}</span>
            </div>
            <div className="csi-gloss" />
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

        {/* 배지 행 */}
        <div className="csi-badge-row">
          {badge && <span className={`csi-badge csi-badge--${badge.cls}`}>{badge.label}</span>}
          <span className="csi-type-tag">{type}</span>
        </div>

        {/* 카드명 */}
        <h3 className="csi-name" onClick={goDetail}>{name}</h3>

        {/* 혜택 카테고리 태그 */}
        {tags.length > 0 && (
          <div className="csi-tags">
            {tags.map(t => <span key={t} className="csi-tag">{t}</span>)}
          </div>
        )}

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
