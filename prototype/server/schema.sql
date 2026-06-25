-- ============================================================
-- BNK 카드몰 프로토타입 DB 스키마
-- ERD 기반 (TB_ 접두사 제거, 영문 소문자로 가독성 확보)
-- 실행: mysql -u root -p < schema.sql
-- ============================================================

-- 초기화 시 클라이언트 연결 charset 을 utf8mb4 로 강제
-- (없으면 일부 환경(도커 초기 시드 등)에서 한글이 latin1 로 해석돼 깨진 채 저장됨)
SET NAMES utf8mb4;

CREATE DATABASE IF NOT EXISTS bnk_card
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE bnk_card;

-- ============================================================
-- 1. users  (ERD: TB_CUST_BC - 고객 기본)
--    고객 식별 정보 + 인증 정보를 함께 관리 (프로토타입 단순화)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id             BIGINT AUTO_INCREMENT PRIMARY KEY,
  username       VARCHAR(50)   NOT NULL UNIQUE,   -- 로그인 아이디
  password       VARCHAR(255)  NOT NULL,           -- bcrypt 해시
  cust_nm        VARCHAR(100)  NOT NULL,           -- 고객명 (ERD: cust_nm)
  cust_status_cd ENUM('ACTIVE','INACTIVE') DEFAULT 'ACTIVE',  -- 고객 상태
  is_admin       TINYINT(1)    DEFAULT 0,          -- 관리자 여부 (1=관리자)
  reg_dt         TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  upd_dt         TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================================
-- 2. user_details  (ERD: TB_CUST_DL - 고객 상세)
--    실명확인 등 민감 정보 분리 보관
-- ============================================================
CREATE TABLE IF NOT EXISTS user_details (
  id            BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id       BIGINT        NOT NULL UNIQUE,     -- users.id 참조
  birth_dt      DATE,                              -- 생년월일
  phone_no      VARCHAR(20),                       -- 전화번호
  email         VARCHAR(100),
  real_name_yn  CHAR(1)       DEFAULT 'N',         -- 실명확인 완료 여부 (Y/N)
  reg_dt        TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  upd_dt        TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================================
-- 3. cards  (ERD: TB_CARD_PRD_BC - 카드 상품 기본)
-- ============================================================
CREATE TABLE IF NOT EXISTS cards (
  id               BIGINT AUTO_INCREMENT PRIMARY KEY,
  prd_nm           VARCHAR(200)  NOT NULL,
  card_type_cd     ENUM('신용카드','체크카드')        NOT NULL,   -- 코드 무결성: 잘못된 값 차단
  annual_fee       INT           DEFAULT 0,
  sale_status_cd   ENUM('ON_SALE','OFF_SALE','MAINTENANCE') DEFAULT 'ON_SALE',  -- 판매중/판매중지/점검중
  view_count       INT           DEFAULT 0,           -- 상세 조회수 (모니터링용)
  launch_dt        DATE,
  color_from       VARCHAR(20),
  color_to         VARCHAR(20),
  network          ENUM('VISA','MASTER') DEFAULT 'VISA',
  brand            VARCHAR(50)   DEFAULT '국내전용',
  traffic_yn       CHAR(1)       DEFAULT 'N',
  product_feature  TEXT,
  image_url        VARCHAR(300),
  reg_dt           TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  upd_dt           TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  -- 목록 조회( WHERE sale_status_cd=? AND card_type_cd=? )용 복합 인덱스
  INDEX idx_cards_status_type (sale_status_cd, card_type_cd)
);

-- ============================================================
-- 4. card_benefits  (ERD: TB_CARD_BNFT_DL - 카드 혜택 상세)
--    혜택 항목을 행 단위로 관리 (기존 JSON 배열 방식 개선)
-- ============================================================
CREATE TABLE IF NOT EXISTS card_benefits (
  id               BIGINT AUTO_INCREMENT PRIMARY KEY,
  card_id          BIGINT        NOT NULL,
  bnft_type_cd     VARCHAR(50),                    -- 혜택 유형 (할인/캐시백/포인트)
  bnft_desc        TEXT,                           -- 혜택 설명
  discount_rate    DECIMAL(5,2),                   -- 할인율 (%)
  monthly_limit_amt INT,                           -- 월 한도 (원)
  reg_dt           TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  upd_dt           TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
);

-- ============================================================
-- 5. card_descriptions  (ERD: TB_PRD_DESC_BC - 상품설명서)
--    버전 관리 가능 (약관과 독립적으로 관리)
-- ============================================================
CREATE TABLE IF NOT EXISTS card_descriptions (
  id            BIGINT AUTO_INCREMENT PRIMARY KEY,
  card_id       BIGINT        NOT NULL,
  version_no    VARCHAR(20)   NOT NULL,            -- 버전 번호 (예: v1.0)
  desc_title    VARCHAR(200),
  desc_content  TEXT,
  apply_dt      DATE,                             -- 적용 일자
  reg_dt        TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  upd_dt        TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
);

-- ============================================================
-- 6. terms  (ERD: TB_TERMS_BC - 약관 기본)
--    관리자가 PDF를 업로드하면 pdf_path에 파일명 저장
--    파일명 형식: YYYY-MM-DD_NNN.pdf
-- ============================================================
CREATE TABLE IF NOT EXISTS terms (
  id             BIGINT AUTO_INCREMENT PRIMARY KEY,
  card_id        BIGINT        NOT NULL,
  version_no     VARCHAR(20)   NOT NULL,           -- 버전 번호
  terms_title    VARCHAR(200),
  terms_content  TEXT,                             -- 약관 본문 (텍스트 요약)
  pdf_path       VARCHAR(200),                     -- 저장된 PDF 파일명 (2026-06-23_001.pdf)
  effective_dt   DATE,                             -- 시행일자
  is_active      TINYINT(1)    DEFAULT 1,          -- 현행 약관 여부
  reg_dt         TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  upd_dt         TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE,
  -- 카드별 현행 약관 조회용 인덱스
  INDEX idx_terms_card_active (card_id, is_active)
);

-- ============================================================
-- 7. terms_history  (ERD: TB_TERMS_HS - 약관 변경 이력)
--    약관 수정/등록 시마다 이력 자동 기록
-- ============================================================
CREATE TABLE IF NOT EXISTS terms_history (
  id              BIGINT AUTO_INCREMENT PRIMARY KEY,
  terms_id        BIGINT        NOT NULL,
  version_no      VARCHAR(20),
  change_content  TEXT,                            -- 변경 사유/내용 요약
  modifier_id     VARCHAR(50),                     -- 수정자 username
  pdf_path        VARCHAR(200),                    -- 해당 시점의 PDF 파일명
  change_dt       TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (terms_id) REFERENCES terms(id) ON DELETE CASCADE
);

-- ============================================================
-- 8. disclosures  (ERD: TB_DISCLOSURE_BC - 공시 정보)
--    금융감독원 공시 승인번호 관리 (카드 출시 필수)
-- ============================================================
CREATE TABLE IF NOT EXISTS disclosures (
  id              BIGINT AUTO_INCREMENT PRIMARY KEY,
  card_id         BIGINT        NOT NULL,
  disclosure_no   VARCHAR(100),                    -- 공시 승인번호
  disclosure_dt   DATE,                            -- 공시일자
  dept_nm         VARCHAR(100),                    -- 담당 부서명
  reg_dt          TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  upd_dt          TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
);

-- ============================================================
-- 기본 데이터 삽입
-- ============================================================

-- 관리자 계정 (비밀번호: admin1234 -> bcrypt 해시)
-- 실제 실행 전 node -e "require('bcrypt').hash('admin1234',10).then(console.log)" 로 해시 생성 후 교체
-- adminmaster / admin1234
-- testuser / test1234
INSERT IGNORE INTO users (username, password, cust_nm, is_admin) VALUES
('adminmaster', '$2b$10$zoeq5fvWhqtb9MgVoqp1n.X08mtkJzXguJ5bLpeGXNGKx73sygEVu', '관리자', 1),
('testuser',    '$2b$10$dNx7zXUKI9V1w03bL7lSK.XPrzTa8fKEXzd9Gx1xsrvBUev9.fFiy', '홍길동', 0);

-- 카드 상품 8종 (v5 자연스러운 딥톤 색상)
INSERT IGNORE INTO cards (prd_nm, card_type_cd, annual_fee, network, launch_dt, color_from, color_to, brand, traffic_yn, product_feature) VALUES
('BNK Young 체크카드',      '체크카드',  0,     'VISA',   '2024-01-15', '#1B3A5C', '#2D6195', '국내전용', 'Y', 'MZ세대를 위한 라이프스타일 체크카드. 편의점, 카페, 대중교통 등 일상에서 가장 자주 쓰는 곳에서 실속 있는 혜택을 제공합니다.'),
('BNK 마이플러스 신용카드', '신용카드', 15000, 'VISA',   '2024-02-01', '#1C1C2E', '#2D2D3E', '국내전용', 'N', '생활 전반의 지출을 한 장으로 커버하는 올인원 신용카드. 마트, 주유, 병원, 온라인쇼핑까지 두루 쓸 수 있는 혜택을 제공합니다.'),
('BNK 부산사랑 신용카드',   '신용카드', 10000, 'VISA',   '2024-03-01', '#7A1515', '#B82020', '국내전용', 'N', '부산 시민을 위한 지역 특화 신용카드. 부산 지역 가맹점 추가 할인과 시내버스·지하철 무료 이용 혜택을 제공합니다.'),
('BNK 하이라이프 신용카드', '신용카드', 50000, 'VISA',   '2024-04-01', '#111111', '#222222', '해외겸용', 'N', '상위 1%를 위한 프리미엄 신용카드. 공항 라운지 무제한, 해외 수수료 면제, 특급 호텔 우대 등 격이 다른 혜택을 경험하세요.'),
('BNK 그린라이프 체크카드', '체크카드',  0,     'MASTER', '2024-05-01', '#0F3D28', '#1B6340', '국내전용', 'Y', '지구를 생각하는 친환경 체크카드. 대중교통과 전기차 충전, 친환경 가맹점에서 알찬 적립 혜택을 제공합니다.'),
('BNK 쇼핑플러스 신용카드', '신용카드', 12000, 'VISA',   '2024-06-01', '#280B42', '#4A1578', '국내전용', 'N', '온라인 쇼핑 특화 신용카드. 쿠팡, 네이버페이, 무신사, 올리브영 등 주요 쇼핑 채널에서 최고의 적립·할인 혜택을 드립니다.'),
('BNK 트래블 신용카드',     '신용카드', 30000, 'VISA',   '2024-07-01', '#0A1628', '#122240', '해외겸용', 'N', '해외여행 특화 카드. 해외 결제 수수료 면제, 공항 라운지, 면세점 할인 등 여행 전 과정에서 프리미엄 서비스를 누리세요.'),
('BNK 알뜰 체크카드',       '체크카드',  0,     'MASTER', '2024-08-01', '#5C3A1E', '#8A5C2E', '국내전용', 'Y', '꼼꼼한 절약을 도와주는 실속 체크카드. 전 가맹점 캐시백, 이동통신 요금 할인, ATM 수수료 무료 등 생활비를 아껴드립니다.');

-- 카드 혜택
INSERT IGNORE INTO card_benefits (card_id, bnft_type_cd, bnft_desc, discount_rate, monthly_limit_amt) VALUES
(1, '적립',   '편의점(GS25·CU·세븐일레븐) 10% 적립',       10.00, 5000),
(1, '적립',   '카페(스타벅스·메가커피·컴포즈) 5% 적립',     5.00,  5000),
(1, '캐시백', '대중교통(버스·지하철) 10% 캐시백',           10.00, 5000),
(1, '할인',   '영화관(CGV·메가박스) 1인 2,000원 할인',      NULL,  10000),
(2, '할인',   '대형마트(이마트·롯데·홈플러스) 5% 할인',     5.00,  20000),
(2, '할인',   '주유소(SK·GS·현대) 리터당 60원 할인',        NULL,  30000),
(2, '캐시백', '병원·약국 3% 캐시백',                        3.00,  10000),
(2, '적립',   '온라인쇼핑(쿠팡·11번가·G마켓) 3% 적립',     3.00,  20000),
(3, '할인',   '부산 지역 가맹점 10% 추가 할인',             10.00, 30000),
(3, '무료',   '부산 시내버스·지하철 월 20회 무료',          NULL,  NULL),
(3, '할인',   '해운대·광안리 주차장 50% 할인',              50.00, 10000),
(3, '무료',   '부산 관광지(동래온천·용두산 등) 무료 입장',  NULL,  NULL),
(4, '무료',   '공항 라운지 무제한 이용(인천·김해)',          NULL,  NULL),
(4, '면제',   '해외 결제 수수료 100% 면제',                 NULL,  NULL),
(4, '할인',   '특급 호텔·리조트 15% 우대',                  15.00, NULL),
(4, '할인',   '골프장·스파 VIP 특별 할인',                  NULL,  NULL),
(5, '적립',   '대중교통(버스·지하철·KTX) 10% 적립',         10.00, 15000),
(5, '할인',   '전기차 충전소 5% 할인',                      5.00,  10000),
(5, '캐시백', '친환경 가맹점 5% 캐시백',                    5.00,  10000),
(5, '할인',   '공유 자전거·킥보드 20% 할인',                20.00, 5000),
(6, '캐시백', '쿠팡 5% 캐시백',                             5.00,  30000),
(6, '적립',   '네이버페이·카카오페이 3% 적립',              3.00,  20000),
(6, '할인',   'SSG닷컴·무신사 5% 할인',                     5.00,  20000),
(6, '할인',   '올리브영 10% 할인',                          10.00, 15000),
(7, '면제',   '해외 결제 수수료 전액 면제',                 NULL,  NULL),
(7, '무료',   '공항 라운지 연 4회 이용',                    NULL,  NULL),
(7, '할인',   '면세점(롯데·신라면세점) 10% 할인',           10.00, NULL),
(7, '우대',   '환전 우대율 90% + 해외 ATM 수수료 무료',     NULL,  NULL),
(8, '캐시백', '전 가맹점 0.3% 캐시백(한도 없음)',            0.30,  NULL),
(8, '할인',   '이동통신 요금 3% 할인',                      3.00,  3000),
(8, '무료',   'ATM 수수료 전액 무료(타행 포함)',             NULL,  NULL),
(8, '캐시백', '관리비·공과금 1% 캐시백',                    1.00,  5000);

-- 공시 승인번호
INSERT IGNORE INTO disclosures (card_id, disclosure_no, disclosure_dt, dept_nm) VALUES
(1, 'BNK-2024-YNG-001', '2024-01-10', '카드사업부'),
(2, 'BNK-2024-MPL-002', '2024-01-25', '카드사업부'),
(3, 'BNK-2024-BSN-003', '2024-02-20', '카드사업부'),
(4, 'BNK-2024-HLF-004', '2024-03-25', '카드사업부'),
(5, 'BNK-2024-GRN-005', '2024-04-20', '카드사업부'),
(6, 'BNK-2024-SHP-006', '2024-05-20', '카드사업부'),
(7, 'BNK-2024-TRV-007', '2024-06-20', '카드사업부'),
(8, 'BNK-2024-ALT-008', '2024-07-20', '카드사업부');

-- 약관 초기 버전 (PDF는 관리자 페이지에서 업로드)
INSERT IGNORE INTO terms (card_id, version_no, terms_title, effective_dt) VALUES
(1, 'v1.0', 'BNK Young 체크카드 이용약관',      '2024-01-15'),
(2, 'v1.0', 'BNK 마이플러스 신용카드 이용약관', '2024-02-01'),
(3, 'v1.0', 'BNK 부산사랑 신용카드 이용약관',   '2024-03-01'),
(4, 'v1.0', 'BNK 하이라이프 신용카드 이용약관', '2024-04-01'),
(5, 'v1.0', 'BNK 그린라이프 체크카드 이용약관', '2024-05-01'),
(6, 'v1.0', 'BNK 쇼핑플러스 신용카드 이용약관', '2024-06-01'),
(7, 'v1.0', 'BNK 트래블 신용카드 이용약관',     '2024-07-01'),
(8, 'v1.0', 'BNK 알뜰 체크카드 이용약관',       '2024-08-01');

-- ============================================================
-- [v2] 고도화 확장 스키마
-- 실행: MySQL Workbench 또는 mysql -u root -p bnk_card < schema.sql
-- ============================================================

-- cards 시드 데이터: INSERT 시 이미 brand/traffic_yn/product_feature 포함됨
-- (v2 별도 UPDATE 불필요)

-- ============================================================
-- 9. card_applications  (카드 신청 내역)
-- ============================================================
CREATE TABLE IF NOT EXISTS card_applications (
  id              BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id         BIGINT        NOT NULL,
  card_id         BIGINT        NOT NULL,
  -- 신청자 정보
  applicant_name  VARCHAR(100)  NOT NULL,
  birth_dt        DATE,
  phone_no        VARCHAR(20),
  home_phone      VARCHAR(20),                        -- 자택전화 (선택)
  email           VARCHAR(100),
  zip_code        VARCHAR(10),                        -- 우편번호
  address         TEXT,
  -- 고객 추가정보 (심사용)
  residence_type  ENUM('자가','전세','월세','기타'),    -- 주거형태
  income_type     ENUM('근로소득','사업소득','기타'),   -- 소득분류
  job_yn          CHAR(1)       DEFAULT 'N',           -- 직장유무 (Y/N)
  -- 청구/계약 정보
  billing_bank      VARCHAR(50)  DEFAULT '부산은행',    -- 결제은행
  billing_account   VARCHAR(50),                       -- 결제 계좌번호
  statement_method  ENUM('POST_HOME','POST_WORK','EMAIL','SMART') DEFAULT 'EMAIL',  -- 청구서 수령방법
  contract_method   ENUM('SMS','EMAIL') DEFAULT 'EMAIL',  -- 계약서류 수령방법
  paper_terms_yn    CHAR(1)     DEFAULT 'N',           -- 종이약관 추가수령 (Y/N)
  -- 카드 옵션
  billing_day     INT           DEFAULT 15,           -- 결제일 (매월 N일)
  credit_limit    INT           DEFAULT 0,            -- 한도 (체크카드=0)
  apply_method    ENUM('INTERNET','MOBILE','BRANCH') DEFAULT 'INTERNET',
  -- AI 커스텀 디자인 연결 (선택)
  design_id       BIGINT,
  -- 상태: 대기 / 승인 / 거절(관리자) / 취소(사용자)
  status          ENUM('PENDING','APPROVED','REJECTED','CANCELLED') DEFAULT 'PENDING',
  applied_dt      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  processed_dt    TIMESTAMP     NULL,
  FOREIGN KEY (user_id)  REFERENCES users(id),
  FOREIGN KEY (card_id)  REFERENCES cards(id),
  -- 내 신청내역 조회( WHERE user_id=? )용 인덱스
  INDEX idx_app_user (user_id, status)
);

-- ============================================================
-- 10. custom_designs  (AI 커스텀 카드 디자인)
-- ============================================================
CREATE TABLE IF NOT EXISTS custom_designs (
  id              BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id         BIGINT        NOT NULL,
  card_id         BIGINT        NOT NULL,
  -- 사용자 입력
  user_prompt     TEXT,                               -- 자유 입력 프롬프트
  -- AI 생성 결과
  theme_name      VARCHAR(100),                       -- AI가 생성한 테마명
  color_from      VARCHAR(20),                        -- 그라디언트 시작색
  color_to        VARCHAR(20),                        -- 그라디언트 종료색
  accent_color    VARCHAR(20),                        -- 강조색
  pattern_type    VARCHAR(50),                        -- geometric/organic/minimal/abstract
  ai_description  TEXT,                               -- AI 디자인 설명
  design_data     JSON,                               -- 전체 파라미터 JSON
  created_dt      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  upd_dt          TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (card_id) REFERENCES cards(id)
);

-- ============================================================
-- 11. admin_logs  (관리자 활동 로그 - 감사 추적)
--     누가/언제/무엇을/어떤 대상에 했는지 기록
-- ============================================================
CREATE TABLE IF NOT EXISTS admin_logs (
  id           BIGINT AUTO_INCREMENT PRIMARY KEY,
  admin_id     BIGINT        NOT NULL,                -- 수행한 관리자 (users.id)
  admin_name   VARCHAR(100),                          -- 관리자명 (조회 편의)
  action       VARCHAR(50)   NOT NULL,                -- CARD_UPDATE/CARD_STATUS/CARD_DELETE/APP_PROCESS 등
  target_type  VARCHAR(30),                           -- CARD / APPLICATION / BENEFIT
  target_id    BIGINT,                                -- 대상 ID
  detail       TEXT,                                  -- 변경 내용 요약
  created_at   TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES users(id),
  INDEX idx_adminlog_created (created_at)
);
