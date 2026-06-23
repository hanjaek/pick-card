const mysql = require('mysql2/promise')

/**
 * 커넥션 풀 생성
 * - 매 요청마다 새 연결을 맺지 않고 풀에서 재사용 -> 성능 향상
 * - connectionLimit: 동시에 유지할 최대 연결 수
 */
const pool = mysql.createPool({
  host:             process.env.DB_HOST     || 'localhost',
  port:             process.env.DB_PORT     || 3306,
  user:             process.env.DB_USER     || 'root',
  password:         process.env.DB_PASSWORD || '',
  database:         process.env.DB_NAME     || 'bnk_card',
  charset:          'utf8mb4',
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0
})

module.exports = pool
