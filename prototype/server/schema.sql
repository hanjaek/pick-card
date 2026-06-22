-- ============================================================
-- BNK 카드몰 프로토타입 DB 스키마
-- ERD 기반 (TB_ 접두사 제거, 영문 소문자로 가독성 확보)
-- 실행: mysql -u root -p < schema.sql
-- ============================================================

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
  cust_status_cd VARCHAR(20)   DEFAULT 'ACTIVE',  -- 고객 상태 (ACTIVE/INACTIVE)
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
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================================
-- 3. cards  (ERD: TB_CARD_PRD_BC - 카드 상품 기본)
-- ============================================================
CREATE TABLE IF NOT EXISTS cards (
  id             BIGINT AUTO_INCREMENT PRIMARY KEY,
  prd_nm         VARCHAR(200)  NOT NULL,           -- 상품명 (ERD: prd_nm)
  card_type_cd   VARCHAR(20)   NOT NULL,           -- 카드 종류 (신용카드/체크카드)
  annual_fee     INT           DEFAULT 0,          -- 연회비
  sale_status_cd VARCHAR(20)   DEFAULT 'ON_SALE',  -- 판매 상태 (ON_SALE/STOP)
  launch_dt      DATE,                             -- 출시일
  color_from     VARCHAR(20),                      -- 카드 앞면 그라디언트 시작색
  color_to       VARCHAR(20),                      -- 카드 앞면 그라디언트 종료색
  network        ENUM('VISA','MASTER') DEFAULT 'VISA',
  reg_dt         TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
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
  FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
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
  FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
);

-- ============================================================
-- 기본 데이터 삽입
-- ============================================================

-- 관리자 계정 (비밀번호: admin1234 -> bcrypt 해시)
-- 실제 실행 전 node -e "require('bcrypt').hash('admin1234',10).then(console.log)" 로 해시 생성 후 교체
INSERT INTO users (username, password, cust_nm, is_admin) VALUES
('adminmaster', '$2b$10$rQ5KfgMF7QVZ3v2KQ8KJse7Fk6cO5d8xC3Y9mVBz1iXuHfYdE3V0C', '관리자', 1);
-- 위 해시는 예시값이므로 반드시 재생성 필요 (아래 주석 참고)
-- node -e "const b=require('bcrypt'); b.hash('admin1234',10).then(h=>console.log(h))"

-- 카드 상품 6종
INSERT INTO cards (prd_nm, card_type_cd, annual_fee, network, launch_dt, color_from, color_to) VALUES
('BNK AI 마스터카드',  '신용카드', 15000, 'VISA',   '2024-01-15', '#667eea', '#764ba2'),
('BNK 자기개발카드',   '체크카드',  5000, 'MASTER', '2024-02-01', '#11998e', '#38ef7d'),
('BNK 엔터카드',       '신용카드', 12000, 'VISA',   '2024-03-10', '#f7971e', '#ffd200'),
('BNK 라이프카드',     '신용카드', 10000, 'VISA',   '2024-04-01', '#fc466b', '#3f5efb'),
('BNK 글로벌카드',     '신용카드', 30000, 'VISA',   '2024-05-01', '#003882', '#0052A5'),
('BNK 그린카드',       '체크카드',  3000, 'MASTER', '2024-06-01', '#56ab2f', '#a8e063');

-- 카드 혜택
INSERT INTO card_benefits (card_id, bnft_type_cd, bnft_desc, discount_rate, monthly_limit_amt) VALUES
(1, '할인', 'ChatGPT · Claude 구독 30% 할인',    30.00, 30000),
(1, '캐시백', 'AI 교육 플랫폼 20% 캐시백',         20.00, 20000),
(1, '할인', '클라우드 서비스 5% 청구할인',          5.00, 10000),
(2, '환급', '자격증 응시료 10% 환급',              10.00, 15000),
(2, '캐시백', '온·오프라인 서점 5% 캐시백',         5.00, 10000),
(2, '할인', '강의 플랫폼 월 1만원 할인',           NULL, 10000),
(3, '할인', 'OTT 4종 구독료 50% 할인',            50.00, 25000),
(3, '할인', '영화관 2인 1인 요금',                NULL, 20000),
(3, '무료', '음원 스트리밍 무료 이용',             NULL, NULL),
(4, '캐시백', '배달 앱 5% 캐시백',                5.00, 10000),
(4, '할인', '쿠팡 월 최대 3만원 할인',             NULL, 30000),
(4, '적립', '편의점 3% 적립',                     3.00, 5000),
(5, '면제', '해외 결제 수수료 면제',               NULL, NULL),
(5, '무료', '공항 라운지 연 2회 무료',             NULL, NULL),
(5, '우대', '환전 우대율 90%',                    NULL, NULL),
(6, '적립', '대중교통 10% 적립',                  10.00, 15000),
(6, '캐시백', '친환경 가맹점 5% 캐시백',            5.00, 10000),
(6, '할인', '전기차 충전 할인',                    NULL, 10000);

-- 공시 승인번호
INSERT INTO disclosures (card_id, disclosure_no, disclosure_dt, dept_nm) VALUES
(1, 'BNK-2024-AI-001',    '2024-01-10', '카드사업부'),
(2, 'BNK-2024-EDU-002',   '2024-01-25', '카드사업부'),
(3, 'BNK-2024-ENT-003',   '2024-03-05', '카드사업부'),
(4, 'BNK-2024-LIFE-004',  '2024-03-25', '카드사업부'),
(5, 'BNK-2024-GLB-005',   '2024-04-20', '카드사업부'),
(6, 'BNK-2024-GREEN-006', '2024-05-20', '카드사업부');

-- 약관 초기 버전 (PDF는 관리자 페이지에서 업로드)
INSERT INTO terms (card_id, version_no, terms_title, effective_dt) VALUES
(1, 'v1.0', 'BNK AI 마스터카드 이용약관',  '2024-01-15'),
(2, 'v1.0', 'BNK 자기개발카드 이용약관',   '2024-02-01'),
(3, 'v1.0', 'BNK 엔터카드 이용약관',       '2024-03-10'),
(4, 'v1.0', 'BNK 라이프카드 이용약관',     '2024-04-01'),
(5, 'v1.0', 'BNK 글로벌카드 이용약관',     '2024-05-01'),
(6, 'v1.0', 'BNK 그린카드 이용약관',       '2024-06-01');
