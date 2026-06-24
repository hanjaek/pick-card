const router = require('express').Router()
const bcrypt = require('bcrypt')
const jwt    = require('jsonwebtoken')
const pool   = require('../db')

const SALT_ROUNDS = 10

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
    await pool.query(
      'INSERT INTO user_details (user_id, email, birth_dt) VALUES (?, ?, ?)',
      [inserted[0].id, email, birthdate || null]
    )

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
router.get('/me', (req, res) => {
  if (req.session && req.session.user) {
    return res.json({ loggedIn: true, user: req.session.user })
  }
  res.status(401).json({ loggedIn: false, message: '로그인 세션이 없습니다.' })
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
