import './Footer.css'

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        {/* 브랜드 설명 */}
        <div className="footer-brand">
          <div className="footer-logo">Pickard</div>
          <p className="footer-desc">
            Pickard는 BNK 부산은행 카드몰 프로토타입입니다.<br />
            실제 금융 거래는 공식 BNK 부산은행 앱 및 홈페이지를 이용하세요.
          </p>
        </div>

        {/* 링크 그룹 */}
        <div className="footer-links">
          <div className="footer-col">
            <h4>카드 상품</h4>
            <ul>
              <li>신용카드</li>
              <li>체크카드</li>
              <li>AI 추천 카드</li>
            </ul>
          </div>
          <div className="footer-col">
            <h4>고객 서비스</h4>
            <ul>
              <li>이용 안내</li>
              <li>약관 및 정책</li>
              <li>자주 묻는 질문</li>
            </ul>
          </div>
        </div>
      </div>

      {/* 하단 법적 고지 */}
      <div className="footer-bottom">
        <span>개인정보처리방침</span>
        <span>이용약관</span>
        <span className="footer-copy">
          2024 Pickard - BNK 부산은행 카드몰. All rights reserved.
        </span>
      </div>
    </footer>
  )
}

export default Footer
