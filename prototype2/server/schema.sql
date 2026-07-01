-- ============================================================
-- BNK 카드몰 프로토타입 DB 스키마
-- ERD 기반 (TB_ 접두사 제거, 영문 소문자로 가독성 확보)
-- 실행: mysql -u root -p < schema.sql
-- ============================================================

-- 초기화 시 클라이언트 연결 charset 을 utf8mb4 로 강제
-- (없으면 일부 환경(도커 초기 시드 등)에서 한글이 latin1 로 해석돼 깨진 채 저장됨)
SET NAMES utf8mb4;

-- 항상 깨끗한 상태로 재생성 (테이블/컬럼이 바뀌어도 매 실행 시 최신 스키마 보장)
-- ※ 기존 데이터는 초기화되지만, 카드·관리자·약관 등 시드가 아래에 포함돼 자동 복구됨
-- ※ 도커는 최초 1회만 실행되므로 영향 없음 (워크벤치 재실행 시에도 에러 없이 동작)
-- prototype2 전용 DB — 원본 prototype 의 bnk_card 와 분리(충돌 없음)
DROP DATABASE IF EXISTS bnk_life;

CREATE DATABASE IF NOT EXISTS bnk_life
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE bnk_life;

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
  -- [라이프 카드] 생애단계·소비 카테고리 태그 — 나이/소비 기반 자동 혜택 매칭용
  life_stage_cd    ENUM('TEEN','YOUNG','FAMILY','SENIOR','ALL') DEFAULT 'ALL',  -- 생애단계(ALL=전단계 공통)
  category_cd      ENUM('CAFE','DELIVERY','TRANSPORT','SHOPPING','SUBSCRIPTION',
                        'TELECOM','CULTURE','PAY','MEDICAL','FUEL','EDUCATION',
                        'TRAVEL','CONVENIENCE') NULL,  -- 소비 카테고리(개인화 매칭 키)
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
  doc_type       VARCHAR(30)   DEFAULT '이용약관',   -- 문서 종류(상품안내장/이용약관/포인트이용약관 등)
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

-- 약관 초기 시드: 카드 8종 × 문서 3종(상품안내장/이용약관/포인트이용약관)
-- PDF는 일단 공용 sample.pdf 로 통일 (관리자가 실제 PDF로 교체). CROSS JOIN 으로 한 번에 생성.
-- 카드 종류별 문서 차등: 모든 카드(상품안내장·이용약관), 신용카드만(포인트이용약관)
-- → 신용카드 3개 / 체크카드 2개 (카드마다 약관 개수가 다를 수 있음을 반영)
INSERT IGNORE INTO terms (card_id, doc_type, version_no, terms_title, pdf_path, effective_dt, is_active)
SELECT c.id, d.doc_type, 'v1.0',
       CONCAT(c.prd_nm, ' ', d.doc_type), 'sample.pdf', c.launch_dt, 1
FROM cards c
JOIN (
  SELECT '상품안내장'     AS doc_type, 'ALL'    AS applies
  UNION ALL SELECT '이용약관',       'ALL'
  UNION ALL SELECT '포인트이용약관', '신용카드'
) d ON (d.applies = 'ALL' OR d.applies = c.card_type_cd);

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
-- 11-1. transactions  (회원 결제/거래 내역 - 소비 분석용)
--    실제 결제 시스템 대용: 회원가입 시 모의 거래를 생성해 채움
-- ============================================================
CREATE TABLE IF NOT EXISTS transactions (
  id           BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id      BIGINT        NOT NULL,
  category_cd  ENUM('CAFE','TRANSPORT','SHOPPING','TELECOM','CULTURE','PAY') NOT NULL,
  merchant_nm  VARCHAR(100),                          -- 가맹점명
  amount       INT           NOT NULL,                -- 결제금액(원)
  paid_dt      DATE          NOT NULL,                -- 결제일
  reg_dt       TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_tx_user_date (user_id, paid_dt)
);

-- 데모 계정(testuser)에 이번 달 모의 거래 시드 (소비 분석 즉시 동작)
INSERT IGNORE INTO transactions (user_id, category_cd, merchant_nm, amount, paid_dt)
SELECT u.id, t.category_cd, t.merchant_nm, t.amount, DATE_FORMAT(CURDATE(), '%Y-%m-05')
FROM users u
CROSS JOIN (
            SELECT 'CAFE'      AS category_cd, '스타벅스 서면점'  AS merchant_nm, 22000 AS amount
  UNION ALL SELECT 'CAFE',      'GS25 광안점',     18000
  UNION ALL SELECT 'TRANSPORT', '부산교통공사',     41000
  UNION ALL SELECT 'SHOPPING',  '이마트 해운대점',  56000
  UNION ALL SELECT 'SHOPPING',  '쿠팡',            33000
  UNION ALL SELECT 'TELECOM',   'SKT 통신요금',     55000
  UNION ALL SELECT 'CULTURE',   'CGV 센텀시티',     28000
  UNION ALL SELECT 'PAY',       '네이버페이',       47000
) t
WHERE u.username = 'testuser';

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

-- ============================================================
-- ★ BNK 라이프 평생 카드 (prototype2 대표 상품)
--   생애단계(life_stage_cd) × 소비 카테고리(category_cd) 태그로
--   "나이 + 소비" 기반 자동 혜택 매칭(개인화)의 기반 데이터
-- ============================================================
INSERT IGNORE INTO cards
  (prd_nm, card_type_cd, annual_fee, network, launch_dt, color_from, color_to, brand, traffic_yn, product_feature)
VALUES
  ('BNK 라이프 평생 카드', '체크카드', 0, 'VISA', '2026-01-01', '#D71919', '#7A1010', '국내전용', 'Y',
   '어릴 때부터 노년까지, 하나의 카드로 평생. AI가 나이와 소비를 분석해 생애 단계마다 혜택을 자동으로 바꿔주는 BNK 평생 카드입니다.');

-- 라이프 카드 혜택 (ALL=전 단계 공통 / 단계별 자동 적용 혜택)
INSERT INTO card_benefits
  (card_id, bnft_type_cd, bnft_desc, discount_rate, monthly_limit_amt, life_stage_cd, category_cd)
SELECT c.id, x.bnft_type_cd, x.bnft_desc, x.discount_rate, x.monthly_limit_amt, x.life_stage_cd, x.category_cd
FROM cards c
JOIN (
            SELECT '면제' AS bnft_type_cd, '연회비 평생 무료'             AS bnft_desc, NULL AS discount_rate, NULL AS monthly_limit_amt, 'ALL'    AS life_stage_cd, NULL          AS category_cd
  UNION ALL SELECT '무료', '후불 교통카드 (전국 버스·지하철)',           NULL,  NULL,  'ALL',    'TRANSPORT'
  UNION ALL SELECT '우대', '해외 결제 수수료 우대',                      NULL,  NULL,  'ALL',    'TRAVEL'
  UNION ALL SELECT '적립', '편의점 5% 적립',                            5.00,  3000,  'TEEN',   'CONVENIENCE'
  UNION ALL SELECT '적립', '대중교통 10% 적립',                        10.00,  3000,  'TEEN',   'TRANSPORT'
  UNION ALL SELECT '적립', '배달앱 10% 적립',                          10.00,  8000,  'YOUNG',  'DELIVERY'
  UNION ALL SELECT '적립', '카페 20% 적립',                            20.00,  8000,  'YOUNG',  'CAFE'
  UNION ALL SELECT '할인', '구독서비스(OTT·음악) 10% 할인',            10.00,  5000,  'YOUNG',  'SUBSCRIPTION'
  UNION ALL SELECT '할인', '대형마트 5% 할인',                          5.00, 20000,  'FAMILY', 'SHOPPING'
  UNION ALL SELECT '할인', '주유 리터당 60원 할인',                    NULL, 30000,  'FAMILY', 'FUEL'
  UNION ALL SELECT '할인', '학원·교육비 5% 할인',                       5.00, 20000,  'FAMILY', 'EDUCATION'
  UNION ALL SELECT '할인', '병원·약국 10% 할인',                       10.00, 10000,  'SENIOR', 'MEDICAL'
  UNION ALL SELECT '적립', '여행·관광 10% 적립',                       10.00,  NULL,  'SENIOR', 'TRAVEL'
) x
WHERE c.prd_nm = 'BNK 라이프 평생 카드';

-- ============================================================
-- ★ BNK 라이프 데모 테스트 계정 2종 (소비 패턴 대비 — 개인화 비교용)
--   life_young  : 26세 사회초년생(YOUNG)·카페/교통 → "카페 20% 적립" 켜짐
--   life_family : 38세 가정형성(FAMILY)·마트/통신   → "대형마트 5% 할인" 켜짐
--   (둘 다 비밀번호: test1234)  ※ scripts/seed-life-testusers.js 로도 재시드 가능
-- ============================================================
INSERT IGNORE INTO users (username, password, cust_nm, is_admin) VALUES
('testuser1', '$2b$10$dNx7zXUKI9V1w03bL7lSK.XPrzTa8fKEXzd9Gx1xsrvBUev9.fFiy', '김도윤', 0),
('testuser2', '$2b$10$dNx7zXUKI9V1w03bL7lSK.XPrzTa8fKEXzd9Gx1xsrvBUev9.fFiy', '박민준', 0);

INSERT IGNORE INTO user_details (user_id, birth_dt)
SELECT id, '2000-03-15' FROM users WHERE username = 'testuser1'
UNION ALL
SELECT id, '1988-07-20' FROM users WHERE username = 'testuser2';

-- life_young 거래 (카페·교통 중심)
INSERT IGNORE INTO transactions (user_id, category_cd, merchant_nm, amount, paid_dt)
SELECT u.id, t.category_cd, t.merchant_nm, t.amount, DATE_FORMAT(CURDATE(), '%Y-%m-05')
FROM users u CROSS JOIN (
            SELECT 'CAFE'      AS category_cd, '스타벅스 서면점' AS merchant_nm, 16000 AS amount
  UNION ALL SELECT 'CAFE',      '메가커피 광안점',  12000
  UNION ALL SELECT 'CAFE',      '투썸플레이스',     17000
  UNION ALL SELECT 'TRANSPORT', '부산교통공사',     38000
  UNION ALL SELECT 'CULTURE',   'CGV 센텀시티',     22000
  UNION ALL SELECT 'PAY',       '네이버페이',       30000
) t WHERE u.username = 'testuser1';

-- life_family 거래 (마트·통신 중심)
INSERT IGNORE INTO transactions (user_id, category_cd, merchant_nm, amount, paid_dt)
SELECT u.id, t.category_cd, t.merchant_nm, t.amount, DATE_FORMAT(CURDATE(), '%Y-%m-05')
FROM users u CROSS JOIN (
            SELECT 'SHOPPING'  AS category_cd, '이마트 해운대점' AS merchant_nm, 86000 AS amount
  UNION ALL SELECT 'SHOPPING',  '쿠팡',            94000
  UNION ALL SELECT 'SHOPPING',  '롯데마트 동래점',  42000
  UNION ALL SELECT 'TELECOM',   'SKT 통신요금',     60000
  UNION ALL SELECT 'TRANSPORT', '부산교통공사',     30000
) t WHERE u.username = 'testuser2';

-- ============================================================
-- [확장] 시나리오·성장형·사후관리 테이블 (prototype2 본체화)
--   회원→상담→신청→발급→성장→사후관리 전 생애주기 커버
-- ============================================================

-- ============================================================
-- 13. card_memberships  (발급된 보유 카드)
--   card_applications(신청) 과 구분: 신청이 승인되면 "발급"되어
--   회원이 실제 보유하는 카드. issued_dt 는 성장형(가입연차)의 기준.
-- ============================================================
CREATE TABLE IF NOT EXISTS card_memberships (
  id                BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id           BIGINT        NOT NULL,             -- 보유 회원
  card_id           BIGINT        NOT NULL,             -- 발급된 카드 상품
  application_id    BIGINT,                             -- 발급 근거 신청건 (선택)
  card_no_masked    VARCHAR(25),                        -- 마스킹 카드번호 (5310-98**-****-2749)
  issued_dt         DATE          NOT NULL,             -- 발급일 = 가입연차(성장형) 기준
  valid_thru        CHAR(5),                            -- 유효기간 MM/YY
  membership_status ENUM('ACTIVE','BLOCKED','EXPIRED','CANCELLED') DEFAULT 'ACTIVE',  -- 카드 상태
  card_onoff        ENUM('ON','OFF') DEFAULT 'ON',      -- 시나리오의 즉시 On/Off 관리
  reg_dt            TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  upd_dt            TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id)        REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (card_id)        REFERENCES cards(id),
  FOREIGN KEY (application_id) REFERENCES card_applications(id) ON DELETE SET NULL,
  -- 내 보유카드 조회( WHERE user_id=? AND status=ACTIVE )용 인덱스
  INDEX idx_membership_user (user_id, membership_status)
);

-- ============================================================
-- 14. benefit_tiers  (성장형 혜택 단계)
--   혜택(card_benefits)의 기본율은 1년차. 오래 쓸수록(가입연차)
--   적립/할인율이 상승 → 이 표에 "N년차부터 적용될 율" 을 단계로 저장.
--   적용 규칙: 내 연차 이하 tenure_year 중 가장 큰 단계의 율을 사용.
-- ============================================================
CREATE TABLE IF NOT EXISTS benefit_tiers (
  id                BIGINT AUTO_INCREMENT PRIMARY KEY,
  benefit_id        BIGINT        NOT NULL,             -- 대상 혜택
  tenure_year       INT           NOT NULL,             -- 가입 N년차부터 적용 (2,3,5 …)
  discount_rate     DECIMAL(5,2),                       -- 그 시점 적립/할인율
  monthly_limit_amt INT,                                -- 그 시점 월 한도(상향 가능)
  tier_label        VARCHAR(50),                        -- 표시용 ("3년차 우대")
  reg_dt            TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (benefit_id) REFERENCES card_benefits(id) ON DELETE CASCADE,
  INDEX idx_tier_benefit_year (benefit_id, tenure_year)
);

-- ============================================================
-- 15. notifications  (사후관리 알림)
--   MY페이지의 "놓친 혜택 / 업그레이드 임박 / 혜택 추가" 등을 저장.
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id            BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id       BIGINT        NOT NULL,                 -- 수신 회원
  membership_id BIGINT,                                 -- 관련 보유카드 (선택)
  noti_type     ENUM('MISSED_BENEFIT','UPGRADE_SOON','BENEFIT_ADDED','STAGE_CHANGE','GENERAL') NOT NULL,
  title         VARCHAR(200),
  body          TEXT,
  is_read       TINYINT(1)    DEFAULT 0,                -- 읽음 여부
  created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id)       REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (membership_id) REFERENCES card_memberships(id) ON DELETE CASCADE,
  INDEX idx_noti_user (user_id, is_read, created_at)
);

-- ============================================================
-- 16. consultations  (AI 상담 세션)
--   시나리오의 "AI 상담 팝업" 1건. 비회원도 상담 가능(user_id NULL).
--   상담 결과 추천 카드/요약을 기록 → 상담 데이터 자산화.
-- ============================================================
CREATE TABLE IF NOT EXISTS consultations (
  id                  BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id             BIGINT,                           -- 상담 회원 (비회원=NULL)
  channel             ENUM('POPUP','PAGE') DEFAULT 'POPUP',  -- 상담 진입 형태
  entry_point         VARCHAR(50),                      -- 유입 지점 (HOME/CARD_DETAIL 등)
  recommended_card_id BIGINT,                           -- 상담 결과 추천 카드
  summary             VARCHAR(300),                     -- 상담 요약
  started_at          TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  ended_at            TIMESTAMP     NULL,
  FOREIGN KEY (user_id)             REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (recommended_card_id) REFERENCES cards(id) ON DELETE SET NULL,
  INDEX idx_consult_user (user_id, started_at)
);

-- ============================================================
-- 17. consultation_messages  (상담 대화 로그)
--   상담 세션 안의 USER/AI 메시지. 상담 품질 분석·재현에 사용.
-- ============================================================
CREATE TABLE IF NOT EXISTS consultation_messages (
  id              BIGINT AUTO_INCREMENT PRIMARY KEY,
  consultation_id BIGINT        NOT NULL,               -- 소속 상담 세션
  sender          ENUM('USER','AI') NOT NULL,           -- 발화 주체
  content         TEXT,
  created_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (consultation_id) REFERENCES consultations(id) ON DELETE CASCADE,
  INDEX idx_msg_consult (consultation_id, created_at)
);

-- ============================================================
-- [확장 시드] 성장형·발급·알림·상담 데모 데이터
-- ============================================================

-- 성장형 혜택 단계 (BNK 라이프 주요 혜택: 카페·배달·마트) — 1년차=기본, 이후 상승
INSERT INTO benefit_tiers (benefit_id, tenure_year, discount_rate, monthly_limit_amt, tier_label)
SELECT b.id, t.yr, t.rate, t.lim, t.label
FROM card_benefits b
JOIN cards c ON c.id = b.card_id AND c.prd_nm = 'BNK 라이프 평생 카드'
JOIN (
            SELECT '카페 20% 적립'  AS desc_match, 2 AS yr, 22.00 AS rate,  9000 AS lim, '2년차 우대'        AS label
  UNION ALL SELECT '카페 20% 적립',  3, 25.00, 10000, '3년차 우대'
  UNION ALL SELECT '카페 20% 적립',  5, 28.00, 12000, '5년차 우대(최대)'
  UNION ALL SELECT '배달앱 10% 적립', 2, 12.00,  9000, '2년차 우대'
  UNION ALL SELECT '배달앱 10% 적립', 3, 15.00, 10000, '3년차 우대(최대)'
  UNION ALL SELECT '대형마트 5% 할인', 3,  7.00, 25000, '3년차 우대'
  UNION ALL SELECT '대형마트 5% 할인', 5,  9.00, 30000, '5년차 우대(최대)'
) t ON t.desc_match = b.bnft_desc;

-- testuser1 의 BNK 라이프 카드 신청(승인) — 발급 근거 (2년 전 신청)
INSERT INTO card_applications
  (user_id, card_id, applicant_name, birth_dt, phone_no, email, status, applied_dt, processed_dt)
SELECT u.id, c.id, '김도윤', '2000-03-15', '010-1234-5678', 'doyun@example.com', 'APPROVED',
       DATE_SUB(CURDATE(), INTERVAL 2 YEAR), DATE_SUB(CURDATE(), INTERVAL 2 YEAR)
FROM users u JOIN cards c ON c.prd_nm = 'BNK 라이프 평생 카드'
WHERE u.username = 'testuser1';

-- testuser1 의 BNK 라이프 카드 발급 (2년차 → 성장형/사후관리 데모)
INSERT INTO card_memberships
  (user_id, card_id, application_id, card_no_masked, issued_dt, valid_thru, membership_status, card_onoff)
SELECT u.id, c.id, a.id, '5310-98**-****-2749',
       DATE_SUB(CURDATE(), INTERVAL 2 YEAR), '12/31', 'ACTIVE', 'ON'
FROM users u
JOIN cards c ON c.prd_nm = 'BNK 라이프 평생 카드'
JOIN card_applications a ON a.user_id = u.id AND a.card_id = c.id AND a.status = 'APPROVED'
WHERE u.username = 'testuser1';

-- 사후관리 알림 (testuser1)
INSERT INTO notifications (user_id, membership_id, noti_type, title, body)
SELECT u.id, m.id, t.ntype, t.title, t.body
FROM users u
JOIN card_memberships m ON m.user_id = u.id
JOIN (
            SELECT 'BENEFIT_ADDED'  AS ntype, '2년차 우대가 적용됐어요'      AS title, '가입 2년차가 되어 카페 적립이 20% → 22% 로 올랐어요.'                AS body
  UNION ALL SELECT 'UPGRADE_SOON',   '곧 혜택이 더 올라가요',        '3년차가 되면 카페 적립이 25% 로 상향됩니다. 조금만 더 함께해요!'
  UNION ALL SELECT 'MISSED_BENEFIT', '놓친 혜택이 있어요',          '이번 달 배달 결제가 있었지만 배달 적립 혜택을 아직 활용하지 않았어요.'
) t
WHERE u.username = 'testuser1';

-- AI 상담 세션 + 대화 로그 (testuser1, 홈 팝업 유입 예시)
INSERT INTO consultations (user_id, channel, entry_point, recommended_card_id, summary, ended_at)
SELECT u.id, 'POPUP', 'HOME', c.id,
       '카페·배달 소비가 많은 사회초년생 → BNK 라이프 평생 카드 추천', NOW()
FROM users u JOIN cards c ON c.prd_nm = 'BNK 라이프 평생 카드'
WHERE u.username = 'testuser1';

INSERT INTO consultation_messages (consultation_id, sender, content)
SELECT co.id, m.sender, m.content
FROM consultations co
JOIN (
            SELECT 'USER' AS sender, '카페랑 배달 자주 쓰는데 나한테 맞는 카드 있어요?' AS content, 1 AS ord
  UNION ALL SELECT 'AI',   'BNK 라이프 평생 카드를 추천해요. 카페 20% 적립이 기본이고, 오래 쓸수록 최대 28%까지 올라가요.', 2
  UNION ALL SELECT 'USER', '오 좋다, 배달도 되나요?', 3
  UNION ALL SELECT 'AI',   '네, 배달앱 10% 적립도 포함돼요. 지금 가입하면 평생 함께 자라는 혜택을 받아요.', 4
) m ON 1=1
WHERE co.entry_point = 'HOME' AND co.user_id = (SELECT id FROM users WHERE username='testuser1')
ORDER BY m.ord;
