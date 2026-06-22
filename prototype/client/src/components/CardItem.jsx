import './CardItem.css'

/**
 * 카드 한 장을 3D 플립으로 표현하는 컴포넌트
 * - 앞면: 실제 카드처럼 칩/번호/네트워크 로고 표시
 * - 뒷면: 혜택 목록 + 신청 버튼 (hover 시 뒤집힘)
 */
function CardItem({ card }) {
  const { name, type, colorFrom, colorTo, benefits, annualFee, network, approvalCode } = card

  return (
    <div className="card-wrapper">
      <div className="card-inner">

        {/* 카드 앞면: 그라디언트 배경 + 카드 정보 */}
        <div
          className="card-face card-front"
          style={{ background: `linear-gradient(135deg, ${colorFrom}, ${colorTo})` }}
        >
          {/* IC 칩 시각화 */}
          <div className="card-chip" />

          {/* 결제 네트워크 (VISA / MASTER) */}
          <div className="card-network">{network}</div>

          {/* 마스킹된 카드 번호 */}
          <div className="card-number">**** **** **** 1234</div>

          <div className="card-info">
            <span className="card-name">{name}</span>
            <span className="card-type-badge">{type}</span>
          </div>

          {/* 빛 반사 shimmer 애니메이션 */}
          <div className="card-shine" />
        </div>

        {/* 카드 뒷면: 혜택 요약 */}
        <div className="card-face card-back">
          <div className="card-back-header">
            <span className="card-back-name">{name}</span>
            <span className="card-type-badge dark">{type}</span>
          </div>

          <ul className="benefit-list">
            {benefits.map((b, i) => (
              <li key={i} className="benefit-item">
                <span className="benefit-dot" />
                {b}
              </li>
            ))}
          </ul>

          {/* 연회비 + 공시 승인번호 (실제 카드에는 금감원 승인번호 필수) */}
          <div className="card-meta">
            <span>연회비: {annualFee.toLocaleString()}원</span>
            <span className="approval-code">{approvalCode}</span>
          </div>

          <button className="btn-apply">신청하기</button>
        </div>

      </div>
    </div>
  )
}

export default CardItem
