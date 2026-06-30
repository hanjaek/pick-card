/**
 * BNK 라이프 데모용 테스트 계정 2종 시드 (소비 패턴 대비)
 * 실행: node scripts/seed-life-testusers.js
 *
 * - life_young  : 26세 사회초년생(YOUNG) · 카페/교통 소비  → "카페 20% 적립" 켜짐
 * - life_family : 38세 가정형성(FAMILY) · 마트/통신 소비   → "대형마트 5% 할인" 켜짐
 * (둘 다 비밀번호: test1234)
 */
require('dotenv').config()
const pool = require('../db')

// bcrypt('test1234', 10) — schema.sql 의 testuser 와 동일 해시 재사용
const PW = '$2b$10$dNx7zXUKI9V1w03bL7lSK.XPrzTa8fKEXzd9Gx1xsrvBUev9.fFiy'

const USERS = [
  {
    username: 'testuser1', name: '김도윤', birth: '2000-03-15',
    tx: [
      ['CAFE',      '스타벅스 서면점',  16000],
      ['CAFE',      '메가커피 광안점',  12000],
      ['CAFE',      '투썸플레이스',     17000],
      ['TRANSPORT', '부산교통공사',     38000],
      ['CULTURE',   'CGV 센텀시티',     22000],
      ['PAY',       '네이버페이',       30000],
    ],
  },
  {
    username: 'testuser2', name: '박민준', birth: '1988-07-20',
    tx: [
      ['SHOPPING',  '이마트 해운대점',  86000],
      ['SHOPPING',  '쿠팡',            94000],
      ['SHOPPING',  '롯데마트 동래점',  42000],
      ['TELECOM',   'SKT 통신요금',     60000],
      ['TRANSPORT', '부산교통공사',     30000],
    ],
  },
]

async function main() {
  const ym = new Date().toISOString().slice(0, 7) // YYYY-MM
  // 이전 데모 계정 정리(있으면) — FK CASCADE 로 거래/상세도 함께 삭제
  await pool.query("DELETE FROM users WHERE username IN ('life_young','life_family')")
  for (const u of USERS) {
    await pool.query(
      'INSERT IGNORE INTO users (username, password, cust_nm) VALUES (?, ?, ?)',
      [u.username, PW, u.name]
    )
    const [[row]] = await pool.query('SELECT id FROM users WHERE username = ?', [u.username])
    const uid = row.id

    await pool.query(
      `INSERT INTO user_details (user_id, birth_dt) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE birth_dt = VALUES(birth_dt)`,
      [uid, u.birth]
    )

    // 이번 달 거래 새로 채움(중복 방지 위해 기존 삭제 후 삽입)
    await pool.query('DELETE FROM transactions WHERE user_id = ?', [uid])
    const rows = u.tx.map((t, i) => [uid, t[0], t[1], t[2], `${ym}-${String(5 + i).padStart(2, '0')}`])
    await pool.query(
      'INSERT INTO transactions (user_id, category_cd, merchant_nm, amount, paid_dt) VALUES ?',
      [rows]
    )

    const total = u.tx.reduce((s, t) => s + t[2], 0)
    console.log(`✓ ${u.username} (${u.name}, id ${uid}) — 거래 ${u.tx.length}건 / 총 ${total.toLocaleString()}원`)
  }
  console.log('\n완료. 로그인: testuser1 / testuser2  (비번 test1234)')
  await pool.end()
}

main().catch(err => { console.error(err); process.exit(1) })
