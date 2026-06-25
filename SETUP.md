# Pickard 실행 가이드 (팀원용)

> BNK Pickard 카드몰 로컬 실행 방법.
> **방법 A (npm + 워크벤치)** 가 기본, **방법 B (도커)** 는 선택사항입니다.
> ⚠️ 비밀번호·시크릿은 각자 `.env` 에 직접 넣습니다 (git 에 올리지 않음).

---

## 0. 사전 준비
- **Node.js** 18+ (필수)
- **MySQL** 8.x (방법 A) — 또는 **Docker Desktop** (방법 B)
- 저장소 클론 후 항상 최신화: `git pull`

---

## 방법 A — npm 으로 실행 (도커 없이, 기본)

### 1) 의존성 설치
```bash
# 루트에서
npm install
npm install --prefix prototype/server
npm install --prefix prototype/client
```

### 2) 서버 환경변수(.env) 만들기
`prototype/server/.env.example` 를 복사해 `.env` 를 만들고 본인 값으로 채웁니다.
```bash
# prototype/server 폴더에서
cp .env.example .env
```
`.env` 에서 본인 MySQL 비밀번호 등을 입력:
```
DB_PASSWORD=본인_MySQL_비밀번호
JWT_SECRET=아무_긴_랜덤_문자열
```

### 3) 데이터베이스 준비 (MySQL 워크벤치)
`prototype/server/schema.sql` 한 방에 실행하면 DB·테이블·기본데이터가 생성됩니다.
- 워크벤치: `File > Open SQL Script > schema.sql` → ⚡ 실행
- 또는 CMD: `mysql -u root -p < prototype/server/schema.sql`

> ⚠️ **스키마가 바뀐 날(컬럼·테이블 추가)** 에는 기존 DB에 그냥 다시 돌리면
> 추가분이 반영되지 않습니다. 아래처럼 새로 만들어야 확실합니다:
> ```sql
> DROP DATABASE IF EXISTS bnk_card;
> -- 그 다음 schema.sql 통째로 실행
> ```
> (데이터는 초기화되지만 카드·관리자 시드는 schema.sql 에 포함되어 자동 복구됩니다.)

### 4) 실행
```bash
# 루트에서 (서버 + 프론트 동시 실행)
npm run dev
```
접속: http://localhost:3000

---

## 방법 B — 도커로 실행 (선택, 올인원)

도커가 있으면 MySQL·Redis·서버·프론트를 **한 번에** 띄울 수 있습니다.
(MySQL 설치/스키마 실행 불필요 — 컨테이너가 자동 처리)

### 1) 도커용 비밀값 파일
`docker/.env.example` 를 복사해 `docker/.env` 생성 후 값 입력:
```bash
# docker 폴더에서
cp .env.example .env
```

### 2) 실행
```bash
# docker 폴더에서
docker compose up -d --build
```
접속: http://localhost:3000

### 3) 종료
```bash
docker compose down
```

> 도커 버전은 Redis 고가용성(마스터/레플리카/센티넬), 서버 2대 무중단 등
> 운영 구조까지 포함합니다. 자세한 건 담당자에게 문의.

---

## 기본 계정 (schema.sql 시드)
| 구분 | 아이디 | 비밀번호 |
|------|--------|----------|
| 관리자 | `adminmaster` | `admin1234` |
| 일반 | `testuser` | `test1234` |

> 관리자로 로그인하면 관리자 페이지(`/admin`)로 이동합니다.

---

## 주요 주소
| 대상 | 주소 |
|------|------|
| 웹 (프론트) | http://localhost:3000 |
| 백엔드 API | http://localhost:4000 (방법 A) |
| 헬스체크 | http://localhost:4000/api/health |

---

## 자주 묻는 것
- **Q. 스키마 바뀌었다는데?** → `git pull` 후 방법 A-3 의 `DROP DATABASE` + `schema.sql` 재실행.
- **Q. 포트 충돌(EADDRINUSE)?** → 3000/4000 을 이미 다른 게 쓰는 중. 기존 실행 종료 후 재시도.
- **Q. .env 가 없다는데?** → `.env.example` 복사해서 `.env` 만들기 (위 2번).
