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
  -- 상품명이 시드·조인의 자연키로 쓰이므로 중복 차단
  -- (이름 중복 시 'WHERE prd_nm=...' 서브쿼리가 다중 행을 반환해 발급/혜택 시드가 깨지는 것을 방지)
  UNIQUE KEY uk_cards_prd_nm (prd_nm),
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
  -- 소비 카테고리 = 혜택 카테고리(card_benefits.category_cd)와 동일 코드 체계로 통일.
  -- → "내 소비 ↔ 카드 혜택" 을 문자열이 아닌 코드(category_cd)로 매칭할 수 있음.
  category_cd  ENUM('CAFE','DELIVERY','TRANSPORT','SHOPPING','SUBSCRIPTION',
                    'TELECOM','CULTURE','PAY','MEDICAL','FUEL','EDUCATION',
                    'TRAVEL','CONVENIENCE') NOT NULL,
  merchant_nm  VARCHAR(100),                          -- 가맹점명
  amount       INT           NOT NULL,                -- 결제금액(원)
  paid_dt      DATE          NOT NULL,                -- 결제일
  reg_dt       TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_tx_user_date (user_id, paid_dt)
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
-- 18. user_benefit_configs  (회원 커스텀 혜택 구성 — 혜택 구성 빌더)
--   BNK 라이프 '혜택 구성 빌더'에서 회원이 연회비(=예산)에 맞춰 직접 고른
--   혜택 조합을 저장. 회원당 1건(UNIQUE user_id) → 재저장 시 덮어씀(UPSERT).
--   ※ 과거 routes/lifecard.js 에서 런타임 CREATE 하던 테이블을 스키마로 승격
--     (스키마 단일 출처화 + FK 무결성 확보).
-- ============================================================
CREATE TABLE IF NOT EXISTS user_benefit_configs (
  id                BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id           BIGINT        NOT NULL,                 -- 구성 소유 회원
  selected_fee      INT           NOT NULL DEFAULT 30000,   -- 선택 연회비(=혜택 예산)
  selected_benefits JSON          NOT NULL,                 -- 선택 혜택 id 배열 (예: ["cafe","delivery","pay"])
  reg_dt            TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  -- 회원당 1건만 유지 → 라우트의 ON DUPLICATE KEY UPDATE(업서트) 기준 키
  UNIQUE KEY uq_user_benefit_config (user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================================
-- 19. benefit_catalog  (혜택 구성 빌더 — 선택 가능한 혜택 모듈)
--   '혜택 구성 빌더'에서 회원이 고르는 혜택 후보. cost(예산 소진)로 조립.
--   user_benefit_configs.selected_benefits(JSON)가 이 표의 benefit_cd 를 참조
--   → 빌더 혜택 목록을 프론트 하드코딩이 아닌 DB에서 관리(관리자 편집 가능).
-- ============================================================
CREATE TABLE IF NOT EXISTS benefit_catalog (
  id            BIGINT AUTO_INCREMENT PRIMARY KEY,
  benefit_cd    VARCHAR(30)   NOT NULL,              -- 안정 코드(cafe/pay/…) — 구성 저장의 참조 키
  label         VARCHAR(50)   NOT NULL,              -- 표시명(카페·편의점)
  icon          VARCHAR(10),                         -- 이모지 아이콘
  base_desc     VARCHAR(100),                        -- 기본 혜택 문구(5% 적립)
  note          VARCHAR(100),                        -- 부가 설명(월 최대 3,000원)
  cost          INT           NOT NULL,              -- 예산 소진 비용(원)
  color         VARCHAR(20),                         -- 표시 색
  -- 연동용 숫자 필드: 소비(transactions)와 매칭해 절약액(spent×rate, limit 상한) 계산
  --   rate NULL = 정률이 아닌 정액/횟수형 혜택(예: 통신 월 2,000원, 문화 월 1회) → 매칭 시 limit 만큼 적용
  discount_rate     DECIMAL(5,2) NULL,               -- 1년차 기본 할인/적립률(%)
  monthly_limit_amt INT          NULL,               -- 1년차 월 한도(원)
  category_cd   ENUM('CAFE','DELIVERY','TRANSPORT','SHOPPING','SUBSCRIPTION',
                     'TELECOM','CULTURE','PAY','MEDICAL','FUEL','EDUCATION',
                     'TRAVEL','CONVENIENCE') NULL,    -- 소비 카테고리(card_benefits와 동일 체계)
  sort_order    INT           DEFAULT 0,             -- 노출 순서
  is_active     TINYINT(1)    DEFAULT 1,             -- 노출 여부(끄면 빌더에서 숨김)
  reg_dt        TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_benefit_cd (benefit_cd)
);

-- ============================================================
-- 20. benefit_catalog_tiers  (빌더 혜택의 연차별 성장 표시값)
--   benefit_tiers(라이프카드 자동혜택 성장)와 같은 원리 — 빌더 혜택도 연차로 성장.
-- ============================================================
CREATE TABLE IF NOT EXISTS benefit_catalog_tiers (
  id           BIGINT AUTO_INCREMENT PRIMARY KEY,
  catalog_id   BIGINT        NOT NULL,
  tenure_year  INT           NOT NULL,               -- 1,3,5…
  display_val  VARCHAR(30)   NOT NULL,               -- 그 연차의 표시값(5% / 2,000원 / 월 2회)
  -- 연동용 숫자값(연차별 성장) — display_val 은 표시, 아래는 계산용
  rate              DECIMAL(5,2) NULL,               -- 그 연차의 할인/적립률(%) (정액형은 NULL)
  monthly_limit_amt INT          NULL,               -- 그 연차의 월 한도(원)
  FOREIGN KEY (catalog_id) REFERENCES benefit_catalog(id) ON DELETE CASCADE,
  UNIQUE KEY uq_catalog_year (catalog_id, tenure_year)
);

-- ############################################################
-- #                                                          #
-- #                  ↓↓↓  더미(시드) 데이터  ↓↓↓               #
-- #                                                          #
-- #  위쪽 = 스키마(DDL, 테이블 정의)  /  아래 = 데모용 데이터      #
-- #  · 모든 테이블 생성 후 한 번에 실행됨                        #
-- #  · INSERT 순서는 FK 의존성 때문에 그대로 유지 (섞지 말 것)     #
-- #                                                          #
-- ############################################################


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

-- 카드 상품 12종 (실제 부산은행 카드 라인업 기반)
INSERT IGNORE INTO cards (prd_nm, card_type_cd, annual_fee, network, launch_dt, color_from, color_to, brand, traffic_yn, product_feature) VALUES
('REX2 포인트형',          '신용카드', 15000, 'VISA',   '2024-01-15', '#14213D', '#22304F', '국내전용', 'N', '생활 속 모든 결제에 리워드 포인트를 적립하는 대표 신용카드. 적립 포인트로 결제·상품권 교환이 자유롭습니다.'),
('REX2 대한항공마일리지형', '신용카드', 30000, 'VISA',   '2024-02-01', '#0A3D62', '#146394', '해외겸용', 'N', '결제할수록 대한항공 마일리지가 쌓이는 항공 특화 신용카드. 여행·해외 결제에 강합니다.'),
('빵빵 체크카드',          '체크카드',  0,     'VISA',   '2024-03-01', '#8A5A2B', '#C98A3E', '국내전용', 'Y', '베이커리·카페·디저트에 특화된 체크카드. 빵·커피 결제에 두둑한 적립을 제공합니다.'),
('캐쉬백카드',             '신용카드', 15000, 'VISA',   '2024-04-01', '#1C1C2E', '#33334D', '해외겸용', 'N', '전 가맹점 캐시백 신용카드. 국내 0.2~0.4%, 해외 2% 캐시백을 한도 없이 제공합니다.'),
('국민행복 체크카드',      '체크카드',  0,     'VISA',   '2024-05-01', '#0F5C3E', '#1E8C5F', '국내전용', 'N', '정부 복지·바우처 연계 체크카드. 아이행복·국민행복 바우처 결제와 생활 할인을 지원합니다.'),
('부산 동백전 체크카드',   '체크카드',  0,     'VISA',   '2024-06-01', '#7A1515', '#C0392B', '국내전용', 'Y', '부산 지역화폐 동백전 연동 체크카드. 부산 가맹점 캐시백과 대중교통 혜택을 제공합니다.'),
('딩딩 체크카드',          '체크카드',  0,     'VISA',   '2024-07-01', '#5B2C83', '#8E44AD', '국내전용', 'N', 'MZ세대를 위한 편의점·간편결제 특화 체크카드. 편의점·배달·구독에 적립을 제공합니다.'),
('어디로든 그린 체크카드', '체크카드',  0,     'MASTER', '2024-08-01', '#0F3D28', '#1B6340', '국내전용', 'Y', '대중교통·친환경 특화 체크카드. 버스·지하철·따릉이·전기차 충전에 적립을 제공합니다.'),
('2030 언택트 체크카드',   '체크카드',  0,     'VISA',   '2024-09-01', '#16213E', '#2C3E6B', '국내전용', 'N', '비대면·온라인 소비에 최적화된 체크카드. OTT·구독·간편결제·온라인쇼핑에 적립을 제공합니다.'),
('오늘은e 체크카드',       '체크카드',  0,     'VISA',   '2024-10-01', '#0B486B', '#1B6CA8', '국내전용', 'N', '이커머스·온라인쇼핑 특화 체크카드. 쿠팡·11번가·네이버쇼핑 등 온라인 결제에 적립합니다.'),
('ZipL 체크카드',          '체크카드',  0,     'VISA',   '2024-11-01', '#2C3E50', '#465A70', '국내전용', 'N', '주거·생활비 특화 체크카드. 공과금·관리비·통신비 등 고정지출에 캐시백을 제공합니다.'),
('후불 하이패스카드',      '체크카드',  0,     'MASTER', '2024-12-01', '#34495E', '#5D6D7E', '국내전용', 'Y', '후불 하이패스 기능을 담은 교통 특화 체크카드. 고속도로 통행료를 후불로 편리하게 결제합니다.');

-- 카드 혜택 (12종)
INSERT IGNORE INTO card_benefits (card_id, bnft_type_cd, bnft_desc, discount_rate, monthly_limit_amt) VALUES
-- 1. REX2 포인트형
(1, '적립',   '전 가맹점 이용금액 1% 포인트 적립',           1.00,  NULL),
(1, '적립',   '주요 온라인몰·배달앱 2% 추가 적립',           2.00,  20000),
(1, '우대',   '적립 포인트로 결제·상품권 교환 가능',         NULL,  NULL),
-- 2. REX2 대한항공마일리지형
(2, '적립',   '이용금액 1,000원당 대한항공 1마일 적립',      NULL,  NULL),
(2, '적립',   '해외 이용 시 2배 마일리지 적립',             NULL,  NULL),
(2, '무료',   '연 1회 공항 라운지 이용',                    NULL,  NULL),
-- 3. 빵빵 체크카드
(3, '적립',   '베이커리·카페 10% 적립(파리바게뜨·뚜레쥬르)', 10.00, 5000),
(3, '적립',   '디저트·아이스크림 5% 적립',                  5.00,  5000),
(3, '할인',   '편의점 5% 할인',                             5.00,  3000),
-- 4. 캐쉬백카드 (실제 혜택)
(4, '캐시백', '국내 이용금액 0.2~0.4% 캐시백(한도 없음)',    0.40,  NULL),
(4, '캐시백', '해외 이용금액 2% 캐시백',                    2.00,  NULL),
(4, '할인',   '커피 3% 할인(메가·컴포즈·더벤티 등, 월 4회)', 3.00,  3000),
-- 5. 국민행복 체크카드
(5, '할인',   '아이행복·국민행복 바우처 가맹점 이용',        NULL,  NULL),
(5, '적립',   '병원·약국·학원 3% 적립',                     3.00,  10000),
(5, '할인',   '대형마트·생필품 5% 할인',                    5.00,  20000),
-- 6. 부산 동백전 체크카드
(6, '캐시백', '부산 동백전 가맹점 10% 캐시백',              10.00, 30000),
(6, '무료',   '부산 시내버스·지하철 후불 결제',             NULL,  NULL),
(6, '할인',   '부산 전통시장·소상공인 5% 추가 할인',        5.00,  10000),
-- 7. 딩딩 체크카드
(7, '적립',   '편의점·배달앱 7% 적립',                      7.00,  7000),
(7, '적립',   '구독서비스(OTT·음악) 10% 적립',              10.00, 5000),
(7, '할인',   '간편결제(네이버·카카오·토스) 3% 할인',       3.00,  5000),
-- 8. 어디로든 그린 체크카드
(8, '적립',   '대중교통(버스·지하철) 10% 적립',             10.00, 10000),
(8, '할인',   '따릉이·공유킥보드 20% 할인',                 20.00, 5000),
(8, '캐시백', '전기차 충전소 5% 캐시백',                    5.00,  10000),
-- 9. 2030 언택트 체크카드
(9, '적립',   'OTT·구독서비스 10% 적립',                    10.00, 5000),
(9, '적립',   '온라인쇼핑·간편결제 5% 적립',                5.00,  20000),
(9, '할인',   '배달앱 5% 할인',                             5.00,  5000),
-- 10. 오늘은e 체크카드
(10, '캐시백', '쿠팡·11번가·G마켓 5% 캐시백',               5.00,  30000),
(10, '적립',   '네이버쇼핑·SSG 3% 적립',                    3.00,  20000),
(10, '할인',   '올리브영·무신사 10% 할인',                  10.00, 15000),
-- 11. ZipL 체크카드
(11, '캐시백', '공과금·관리비 1% 캐시백',                   1.00,  5000),
(11, '할인',   '이동통신 요금 3% 할인',                     3.00,  3000),
(11, '무료',   'ATM 수수료 전액 무료(타행 포함)',            NULL,  NULL),
-- 12. 후불 하이패스카드
(12, '무료',   '고속도로 통행료 후불 결제',                 NULL,  NULL),
(12, '할인',   '주유소 리터당 40원 할인',                   NULL,  30000),
(12, '적립',   '고속도로 휴게소 5% 적립',                   5.00,  10000);

-- 공시 승인번호 (12종)
INSERT IGNORE INTO disclosures (card_id, disclosure_no, disclosure_dt, dept_nm) VALUES
(1,  'BNK-2024-RX2P-001', '2024-01-10', '카드사업부'),
(2,  'BNK-2024-RX2M-002', '2024-01-25', '카드사업부'),
(3,  'BNK-2024-BBBB-003', '2024-02-20', '카드사업부'),
(4,  'BNK-2024-CASH-004', '2024-03-25', '카드사업부'),
(5,  'BNK-2024-HAPY-005', '2024-04-20', '카드사업부'),
(6,  'BNK-2024-DBEK-006', '2024-05-20', '카드사업부'),
(7,  'BNK-2024-DING-007', '2024-06-20', '카드사업부'),
(8,  'BNK-2024-GREN-008', '2024-07-20', '카드사업부'),
(9,  'BNK-2024-UNTC-009', '2024-08-20', '카드사업부'),
(10, 'BNK-2024-TODE-010', '2024-09-20', '카드사업부'),
(11, 'BNK-2024-ZIPL-011', '2024-10-20', '카드사업부'),
(12, 'BNK-2024-HIPS-012', '2024-11-20', '카드사업부');

-- [추가] 실제 부산은행 카드 (2·3페이지 — 실제 상품 한 줄 설명 반영)
INSERT IGNORE INTO cards (prd_nm, card_type_cd, annual_fee, network, launch_dt, color_from, color_to, brand, traffic_yn, product_feature) VALUES
('SOHO-BIZ카드',                    '신용카드', 10000, 'VISA',   '2025-01-10', '#16223E', '#2A3A5E', '국내전용', 'N', '당행 최초로 보증료(신용보증기금·기술보증기금·신용보증재단) 할인 서비스를 탑재한 소상공인 특화 카드.'),
('오늘은e 신용카드',               '신용카드', 12000, 'MASTER', '2025-02-01', '#C0392B', '#E15241', '국내전용', 'N', '각종 페이 및 생활 서비스 할인되는 오늘은e 신용카드.'),
('BNK 부자되세요 홈쇼핑카드',      '신용카드', 12000, 'VISA',   '2025-02-20', '#B03A5B', '#D9587B', '국내전용', 'N', '한 장의 카드로 폭 넓게 즐기는 쇼핑 특화 카드.'),
('부산체육사랑카드',               '신용카드', 10000, 'VISA',   '2025-03-05', '#1A1A1A', '#333333', '국내전용', 'Y', 'Sports is Busan! 부산시체육회 지정 체육시설 10%, 스포츠·의료·학원 등 생활 곳곳에서 할인.'),
('팟(pod) 카드',                   '체크카드',  0,     'VISA',   '2025-03-20', '#2C2C34', '#4A4A55', '국내전용', 'N', 'MZ 감성 디자인의 개성 만점 체크카드, 팟(pod) 카드.'),
('ZipL 신용카드',                  '신용카드', 12000, 'VISA',   '2025-04-01', '#D98E3E', '#E8A860', '국내전용', 'N', '생활에 특별한 혜택, 더 나은 일상을 위한 카드.'),
('SK OIL&LPG카드',                 '신용카드', 15000, 'VISA',   '2025-04-20', '#5B5A83', '#7A79A8', '국내전용', 'Y', '주유특화 할인 혜택과 생활 서비스 할인까지 가능한 SK OIL&LPG카드.'),
('BNK 프렌즈 신용카드',            '신용카드', 10000, 'MASTER', '2025-05-01', '#E8709A', '#F0A0BE', '국내전용', 'N', '간단 명료한 기본할인과 통큰 연간 캐시백을 주는 캐릭터 카드.'),
('딩딩 신용카드',                  '신용카드', 10000, 'VISA',   '2025-05-20', '#14503A', '#1E7D5A', '국내전용', 'N', '즐거움 가득, 혜택 가득 DingDing 신용카드.'),
('팜코(PAMCO)카드',                '신용카드', 0,     'VISA',   '2025-06-01', '#16305A', '#2A4E82', '국내전용', 'N', '의약품 구입대금만 전문으로 결제하는 의약품 결제전용 기업카드.'),
('BNK SIMPLE AMEX BLUE BUSINESS',  '신용카드', 20000, 'VISA',   '2025-06-20', '#0A4B8C', '#1666B0', '해외겸용', 'N', '하나의 카드로 사업을 심플하게, BNK SIMPLE AMEX BLUE BUSINESS 카드.'),
('BNK Simple카드',                 '신용카드', 0,     'MASTER', '2025-07-01', '#1A1A1A', '#3A3A3A', '국내전용', 'N', '포인트 적립의 심플한 상품서비스에 지역사회 공헌하는 ESG 카드.');

INSERT IGNORE INTO card_benefits (card_id, bnft_type_cd, bnft_desc, discount_rate, monthly_limit_amt) VALUES
-- 13. SOHO-BIZ
(13, '할인',   '보증기관(신보·기보·신용보증재단) 보증료 할인',  NULL,  NULL),
(13, '적립',   '사업장 운영비·세금 0.5% 적립',               0.50,  NULL),
-- 14. 오늘은e 신용
(14, '할인',   '간편결제(네이버·카카오·토스페이) 3% 할인',     3.00,  5000),
(14, '할인',   '생활서비스(통신·구독) 5% 할인',              5.00,  10000),
-- 15. 부자되세요 홈쇼핑
(15, '적립',   '홈쇼핑(GS·롯데·CJ온스타일) 7% 적립',          7.00,  20000),
(15, '적립',   '온라인쇼핑 3% 적립',                         3.00,  20000),
-- 16. 부산체육사랑
(16, '할인',   '부산시체육회 지정 체육시설 10% 할인',         10.00, 20000),
(16, '할인',   '스포츠·의료·학원 5% 할인',                   5.00,  10000),
-- 17. 팟(pod)
(17, '적립',   '편의점·카페 5% 적립',                        5.00,  5000),
(17, '할인',   '간편결제 3% 할인',                           3.00,  5000),
-- 18. ZipL 신용
(18, '캐시백', '공과금·관리비 1% 캐시백',                    1.00,  5000),
(18, '할인',   '생활편의(마트·통신) 5% 할인',                5.00,  15000),
-- 19. SK OIL&LPG
(19, '할인',   'SK주유소 리터당 60원 할인',                  NULL,  30000),
(19, '할인',   'LPG 충전 리터당 40원 할인',                  NULL,  20000),
-- 20. BNK 프렌즈
(20, '캐시백', '전 가맹점 0.7% 기본 캐시백',                 0.70,  NULL),
(20, '캐시백', '연간 이용실적 통큰 캐시백',                  NULL,  NULL),
-- 21. 딩딩 신용
(21, '적립',   '편의점·배달·구독 7% 적립',                   7.00,  7000),
(21, '할인',   '영화·문화 3,000원 할인',                     NULL,  6000),
-- 22. 팜코
(22, '우대',   '의약품 도매 결제 전용 우대',                 NULL,  NULL),
(22, '적립',   '약국·제약 결제 0.5% 적립',                   0.50,  NULL),
-- 23. SIMPLE AMEX BUSINESS
(23, '적립',   '사업 관련 전 가맹점 1% 적립',                1.00,  NULL),
(23, '무료',   'AMEX 비즈니스 전용 서비스',                  NULL,  NULL),
-- 24. BNK Simple
(24, '적립',   '전 가맹점 포인트 적립',                      NULL,  NULL),
(24, '우대',   '지역사회 공헌 ESG 우대 서비스',              NULL,  NULL);

INSERT IGNORE INTO disclosures (card_id, disclosure_no, disclosure_dt, dept_nm) VALUES
(13, 'BNK-2025-SOHO-013', '2025-01-08', '카드사업부'),
(14, 'BNK-2025-TDES-014', '2025-01-28', '카드사업부'),
(15, 'BNK-2025-SHOP-015', '2025-02-18', '카드사업부'),
(16, 'BNK-2025-SPRT-016', '2025-03-03', '카드사업부'),
(17, 'BNK-2025-POD0-017', '2025-03-18', '카드사업부'),
(18, 'BNK-2025-ZIPC-018', '2025-03-28', '카드사업부'),
(19, 'BNK-2025-SKOL-019', '2025-04-18', '카드사업부'),
(20, 'BNK-2025-FRND-020', '2025-04-28', '카드사업부'),
(21, 'BNK-2025-DINC-021', '2025-05-18', '카드사업부'),
(22, 'BNK-2025-PMCO-022', '2025-05-28', '카드사업부'),
(23, 'BNK-2025-AMEX-023', '2025-06-18', '카드사업부'),
(24, 'BNK-2025-SIMP-024', '2025-06-28', '카드사업부');

-- ============================================================
-- ★ BNK 라이프 평생 카드 (prototype2 대표 상품) — id 25
--   생애단계(life_stage_cd) × 소비 카테고리(category_cd) 태그로
--   "나이 + 소비" 기반 자동 혜택 매칭(개인화)의 기반 데이터
--   ※ 아래 약관·공시 시드에 포함되도록 반드시 그 시드보다 위에서 생성함
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

-- 라이프 카드 공시 (대표 상품도 공시번호 보유 — 이름으로 안전하게 연결)
INSERT IGNORE INTO disclosures (card_id, disclosure_no, disclosure_dt, dept_nm)
SELECT id, 'BNK-2026-LIFE-025', '2025-12-20', '카드사업부'
FROM cards WHERE prd_nm = 'BNK 라이프 평생 카드';

-- 카드 실물 이미지 연결 (파일: prototype2/client/public/cards/card-NN.*)
--   이미지 있으면 화면에 실물 이미지, 없으면(예: id 12) 색 그라디언트로 폴백
UPDATE cards SET image_url = CONCAT('/cards/card-', LPAD(id, 2, '0'), '.png')
  WHERE id BETWEEN 1 AND 24 AND id <> 12;
UPDATE cards SET image_url = CONCAT('/cards/card-', LPAD(id, 2, '0'), '.jpg')
  WHERE id IN (10, 13, 14, 18);

-- 약관 초기 시드: 전 카드 × 문서 3종(상품안내장/이용약관/포인트이용약관)
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
-- ★ BNK 라이프 평생 카드는 약관·공시 시드보다 먼저 존재해야 하므로
--   위쪽(cards 13~24 삽입 직후)으로 이동했습니다. 여기서는 생성하지 않습니다.
-- ============================================================

-- ============================================================
-- ★ BNK 라이프 데모 테스트 계정 2종 (소비 패턴 대비 — 개인화 비교용)
--   life_young  : 26세 사회초년생(YOUNG)·카페/교통 → "카페 20% 적립" 켜짐
--   life_family : 38세 가정형성(FAMILY)·마트/통신   → "대형마트 5% 할인" 켜짐
--   (둘 다 비밀번호: test1234)  ※ scripts/seed-life-testusers.js 로도 재시드 가능
-- ============================================================
INSERT IGNORE INTO users (username, password, cust_nm, is_admin) VALUES
('testuser1', '$2b$10$dNx7zXUKI9V1w03bL7lSK.XPrzTa8fKEXzd9Gx1xsrvBUev9.fFiy', '김도윤', 0),
('testuser2', '$2b$10$dNx7zXUKI9V1w03bL7lSK.XPrzTa8fKEXzd9Gx1xsrvBUev9.fFiy', '박민준', 0);

INSERT IGNORE INTO user_details (user_id, birth_dt, phone_no, email)
SELECT id, '1990-05-15', '010-9999-1234', 'testuser@bnk.com'  FROM users WHERE username = 'testuser'
UNION ALL
SELECT id, '2000-03-15', '010-1234-5678', 'doyun@example.com' FROM users WHERE username = 'testuser1'
UNION ALL
SELECT id, '1988-07-20', '010-5678-9012', 'minjun@example.com' FROM users WHERE username = 'testuser2';

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

-- 커스텀 혜택 구성 데모 (testuser1, 사회초년생 → 카페·배달·간편결제, 연회비 3만원)
INSERT IGNORE INTO user_benefit_configs (user_id, selected_fee, selected_benefits)
SELECT id, 30000, JSON_ARRAY('cafe', 'delivery', 'pay')
FROM users WHERE username = 'testuser1';

-- 혜택 구성 빌더 카탈로그 (선택 가능한 혜택 8종 — 프론트 하드코딩 POOL 이관)
INSERT IGNORE INTO benefit_catalog (benefit_cd, label, icon, base_desc, note, cost, color, category_cd, discount_rate, monthly_limit_amt, sort_order) VALUES
('transport', '대중교통',    '🚌', '3% 할인',         '월 최대 2,000원', 5000,  '#2563EB', 'TRANSPORT',  3.00, 2000, 1),
('pay',       '간편결제',    '💳', '1% 적립',         '월 최대 1,500원', 4000,  '#0891B2', 'PAY',        1.00, 1500, 2),
('cafe',      '카페·편의점', '☕', '5% 적립',         '월 최대 3,000원', 8000,  '#D97706', 'CAFE',       5.00, 3000, 3),
('shopping',  '온라인쇼핑',  '🛍', '2% 캐시백',       '월 최대 4,000원', 10000, '#7C3AED', 'SHOPPING',   2.00, 4000, 4),
('medical',   '약국·의료',   '💊', '5% 할인',         '월 최대 2,000원', 7000,  '#059669', 'MEDICAL',    5.00, 2000, 5),
('telecom',   '통신요금',    '📱', '월 2,000원 할인', '자동 적용',       12000, '#DC2626', 'TELECOM',    NULL, 2000, 6),
('delivery',  '배달앱',      '🛵', '3% 할인',         '월 최대 3,000원', 15000, '#EA580C', 'DELIVERY',   3.00, 3000, 7),
('culture',   '영화·문화',   '🎬', '월 1회 50% 할인', '최대 7,000원',    20000, '#9333EA', 'CULTURE',   50.00, 7000, 8);

-- 카탈로그 혜택별 연차 성장값 (benefit_cd 로 안전하게 연결)
INSERT IGNORE INTO benefit_catalog_tiers (catalog_id, tenure_year, display_val, rate, monthly_limit_amt)
SELECT c.id, t.yr, t.val, t.rate, t.lim
FROM benefit_catalog c
JOIN (
            SELECT 'transport' AS cd, 1 AS yr, '3%'      AS val,  3.00 AS rate,  2000 AS lim
  UNION ALL SELECT 'transport', 3, '5%',       5.00,  3000
  UNION ALL SELECT 'transport', 5, '7%',       7.00,  4000
  UNION ALL SELECT 'pay',       1, '1%',       1.00,  1500
  UNION ALL SELECT 'pay',       3, '2%',       2.00,  2000
  UNION ALL SELECT 'pay',       5, '3%',       3.00,  2500
  UNION ALL SELECT 'cafe',      1, '5%',       5.00,  3000
  UNION ALL SELECT 'cafe',      3, '8%',       8.00,  4000
  UNION ALL SELECT 'cafe',      5, '10%',     10.00,  5000
  UNION ALL SELECT 'shopping',  1, '2%',       2.00,  4000
  UNION ALL SELECT 'shopping',  3, '3%',       3.00,  5000
  UNION ALL SELECT 'shopping',  5, '5%',       5.00,  6000
  UNION ALL SELECT 'medical',   1, '5%',       5.00,  2000
  UNION ALL SELECT 'medical',   3, '7%',       7.00,  3000
  UNION ALL SELECT 'medical',   5, '10%',     10.00,  4000
  UNION ALL SELECT 'telecom',   1, '2,000원',  NULL,  2000
  UNION ALL SELECT 'telecom',   3, '4,000원',  NULL,  4000
  UNION ALL SELECT 'telecom',   5, '6,000원',  NULL,  6000
  UNION ALL SELECT 'delivery',  1, '3%',       3.00,  3000
  UNION ALL SELECT 'delivery',  3, '5%',       5.00,  4000
  UNION ALL SELECT 'delivery',  5, '7%',       7.00,  5000
  UNION ALL SELECT 'culture',   1, '월 1회',  50.00,  7000
  UNION ALL SELECT 'culture',   3, '월 2회',  50.00, 14000
  UNION ALL SELECT 'culture',   5, '월 3회',  50.00, 21000
) t ON t.cd = c.benefit_cd;