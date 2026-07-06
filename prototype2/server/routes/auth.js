const router = require('express').Router()
const bcrypt = require('bcrypt')
const jwt    = require('jsonwebtoken')
const pool   = require('../db')
// prototype2 는 Redis/도커 없이 단독 실행 — 세션은 MemoryStore + 쿠키 만료로 관리

const SALT_ROUNDS = 10

// 로그인 세션 유지 시간 (카드몰 기준 60분). 연장 시에도 이 값을 사용.
const SESSION_DURATION_MS = 60 * 60 * 1000

// 회원가입 시 이번 달 모의 거래를 생성 (소비 분석용, 사용자마다 다른 패턴)
async function seedTransactions(userId) {
  const CATS = [
    { cd: 'CAFE',      names: ['스타벅스', '메가커피', 'GS25', 'CU'],         range: [3000, 25000], n: [2, 4] },
    { cd: 'TRANSPORT', names: ['부산교통공사', '버스요금', '카카오택시'],       range: [1300, 15000], n: [2, 4] },
    { cd: 'SHOPPING',  names: ['이마트', '쿠팡', '롯데마트', '무신사'],         range: [15000, 80000], n: [1, 3] },
    { cd: 'TELECOM',   names: ['SKT 통신요금', 'KT 통신요금'],                 range: [40000, 70000], n: [1, 1] },
    { cd: 'CULTURE',   names: ['CGV', '메가박스', '교보문고'],                  range: [10000, 35000], n: [0, 2] },
    { cd: 'PAY',       names: ['네이버페이', '카카오페이', '토스'],             range: [5000, 60000], n: [1, 3] },
  ]
  const rnd = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min
  const rows = []
  const ym = new Date().toISOString().slice(0, 7) // YYYY-MM
  for (const c of CATS) {
    const count = rnd(c.n[0], c.n[1])
    for (let i = 0; i < count; i++) {
      const day = String(rnd(1, 27)).padStart(2, '0')
      rows.push([userId, c.cd, c.names[rnd(0, c.names.length - 1)], rnd(c.range[0], c.range[1]), `${ym}-${day}`])
    }
  }
  if (rows.length) {
    await pool.query(
      'INSERT INTO transactions (user_id, category_cd, merchant_nm, amount, paid_dt) VALUES ?',
      [rows]
    )
  }
}

/* ======================================================
   POST /api/auth/register  -  회원가입
   ====================================================== */
router.post('/register', async (req, res) => {
  const { username, password, name, email, birthdate } = req.body

  if (!username || !password || !name || !email) {
    return res.status(400).json({ message: '필수 항목을 모두 입력해주세요.' })
  }

  try {
    const [existing] = await pool.query(
      'SELECT id FROM users WHERE username = ?', [username]
    )
    if (existing.length > 0) {
      return res.status(409).json({ message: '이미 사용 중인 아이디입니다.' })
    }

    const hashed = await bcrypt.hash(password, SALT_ROUNDS)

    // users 테이블 컬럼명을 ERD 기준(cust_nm)으로 맞춤
    await pool.query(
      'INSERT INTO users (username, password, cust_nm) VALUES (?, ?, ?)',
      [username, hashed, name]
    )

    // 상세 정보는 user_details 테이블에 별도 저장
    const [inserted] = await pool.query('SELECT id FROM users WHERE username = ?', [username])
    const newUserId = inserted[0].id
    await pool.query(
      'INSERT INTO user_details (user_id, email, birth_dt) VALUES (?, ?, ?)',
      [newUserId, email, birthdate || null]
    )

    // 소비 분석용 모의 거래 자동 생성 (사용자마다 다른 패턴 — 카테고리별 랜덤 금액)
    await seedTransactions(newUserId)

    res.status(201).json({ message: '회원가입이 완료되었습니다.' })
  } catch (err) {
    console.error('[register]', err)
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

/* ======================================================
   POST /api/auth/login  -  로그인
   응답에 is_admin 포함 -> 프론트에서 관리자 페이지로 분기
   ====================================================== */
router.post('/login', async (req, res) => {
  const { username, password } = req.body

  try {
    const [rows] = await pool.query(
      'SELECT * FROM users WHERE username = ?', [username]
    )

    if (rows.length === 0) {
      return res.status(401).json({ message: '아이디 또는 비밀번호가 올바르지 않습니다.' })
    }

    const user  = rows[0]
    const match = await bcrypt.compare(password, user.password)
    if (!match) {
      return res.status(401).json({ message: '아이디 또는 비밀번호가 올바르지 않습니다.' })
    }

    // JWT 페이로드에 is_admin 포함 (terms 라우터 미들웨어에서 확인)
    const token = jwt.sign(
      { id: user.id, username: user.username, is_admin: !!user.is_admin },
      process.env.JWT_SECRET || 'dev_secret_change_in_prod',
      { expiresIn: '24h' }
    )

    // ── Redis 세션 저장 ──────────────────────────────────────────
    // express-session 미들웨어가 이 객체를 직렬화해 Redis(Master)에 저장.
    // 이후 요청에서 쿠키(connect.sid)로 세션을 찾아 req.session 복원.
    // 서버가 여러 대여도 모두 같은 Redis를 보므로 로그인 상태가 공유됨.
    // 세션에 사용자 정보 저장 → connect-redis 가 TTL=cookie.maxAge(60분)로 Redis에 기록.
    // 만료 기준은 "Redis 키의 TTL" 하나로 통일 (별도 expiresAt 필드 두지 않음).
    req.session.user = {
      id:       user.id,
      username: user.username,
      name:     user.cust_nm,
      is_admin: !!user.is_admin,
      loginAt:  new Date().toISOString(),
    }

    res.json({
      token,
      name:     user.cust_nm,
      is_admin: !!user.is_admin  // 프론트에서 관리자 페이지 분기에 사용
    })
  } catch (err) {
    console.error('[login]', err)
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

/* ======================================================
   GET /api/auth/me  -  현재 세션 정보 조회
   쿠키로 Redis 세션을 찾아 로그인 상태를 반환.
   (세션이 Redis에 잘 저장/복원되는지 증명용 + 프론트 확인용)
   ====================================================== */
router.get('/me', async (req, res) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ loggedIn: false, message: '로그인 세션이 없습니다.' })
  }

  // 남은 시간은 세션 쿠키의 maxAge(남은 ms)로 판단 — Redis 없이도 동작.
  // (USE_REDIS_SESSION 사용 시에도 connect-redis 가 쿠키 만료를 함께 관리)
  const remainingMs = req.session.cookie?.maxAge

  if (remainingMs != null && remainingMs <= 0) {
    return req.session.destroy(() => {
      res.status(401).json({ loggedIn: false, expired: true, message: '세션이 만료되었습니다.' })
    })
  }

  res.json({
    loggedIn:  true,
    user:      req.session.user,
    expiresIn: remainingMs != null ? remainingMs : SESSION_DURATION_MS,
  })
})

/* ======================================================
   GET /api/auth/profile  -  카드 신청 자동입력용 회원 프로필
   ====================================================== */
router.get('/profile', async (req, res) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ message: '로그인이 필요합니다.' })
  }
  try {
    const [rows] = await pool.query(
      `SELECT u.cust_nm, ud.birth_dt, ud.phone_no, ud.email
       FROM users u
       LEFT JOIN user_details ud ON ud.user_id = u.id
       WHERE u.id = ?`,
      [req.session.user.id]
    )
    if (rows.length === 0) return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' })
    const r = rows[0]
    const dt = r.birth_dt
    let birth = ''
    if (dt instanceof Date) {
      birth = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`
    } else if (dt) {
      birth = String(dt).slice(0, 10)
    }
    res.json({ name: r.cust_nm || '', birth, phone: r.phone_no || '', email: r.email || '' })
  } catch (err) {
    console.error('[profile]', err)
    res.status(500).json({ message: '서버 오류가 발생했습니다.' })
  }
})

/* ======================================================
   POST /api/auth/extend  -  세션 연장
   세션을 다시 저장(save)하면 connect-redis 가 Redis 키 TTL 을 60분으로 재설정.
   (TTL 이 곧 만료 기준이므로, TTL 갱신 = 세션 연장)
   ====================================================== */
router.post('/extend', (req, res) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ message: '로그인 세션이 없습니다.' })
  }

  req.session.cookie.maxAge = SESSION_DURATION_MS   // 새 TTL 기준
  // save() 가 connect-redis 의 SET ... EX 를 호출 → Redis 키 TTL 갱신
  req.session.save(err => {
    if (err) {
      console.error('[extend]', err)
      return res.status(500).json({ message: '세션 연장 중 오류가 발생했습니다.' })
    }
    res.json({ message: '세션이 연장되었습니다.', expiresIn: SESSION_DURATION_MS })
  })
})

/* ======================================================
   POST /api/auth/logout  -  로그아웃 (Redis 세션 삭제)
   ====================================================== */
router.post('/logout', (req, res) => {
  if (!req.session) return res.json({ message: '이미 로그아웃 상태입니다.' })
  req.session.destroy(err => {
    if (err) {
      console.error('[logout]', err)
      return res.status(500).json({ message: '로그아웃 처리 중 오류가 발생했습니다.' })
    }
    res.clearCookie('connect.sid')
    res.json({ message: '로그아웃되었습니다.' })
  })
})

module.exports = router
