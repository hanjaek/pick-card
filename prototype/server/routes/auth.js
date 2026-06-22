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

module.exports = router
