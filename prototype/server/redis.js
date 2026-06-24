/**
 * Redis 클라이언트 — Master / Replica / Sentinel 구조
 *
 * ioredis의 Sentinel 지원으로:
 *  - master : 쓰기 전용 (세션 저장, 캐시 SET)
 *  - replica: 읽기 전용 (캐시 GET — DB 부하 분산)
 *  페일오버 발생 시 ioredis가 Sentinel에 물어 새 마스터를 자동으로 찾음
 */

const Redis = require('ioredis')

const SENTINEL = [{ host: '127.0.0.1', port: 26379 }]
const RETRY    = (times) => Math.min(times * 200, 5000)

/* ── 마스터 연결 (쓰기) ── */
const master = new Redis({
  sentinels:              SENTINEL,
  name:                   'mymaster',
  role:                   'master',
  sentinelRetryStrategy:  RETRY,
  lazyConnect:            true,
  enableReadyCheck:       true,
})

/* ── 레플리카 연결 (읽기) ── */
const replica = new Redis({
  sentinels:              SENTINEL,
  name:                   'mymaster',
  role:                   'slave',
  sentinelRetryStrategy:  RETRY,
  lazyConnect:            true,
  enableReadyCheck:       true,
})

/* ── 연결 이벤트 로그 ── */
master.on('connect',  ()  => console.log('[Redis Master]  연결 성공'))
master.on('ready',    ()  => console.log('[Redis Master]  준비 완료'))
master.on('+failover-end', (m) => console.log('[Redis Sentinel] 페일오버 완료:', m))
master.on('error',    (e)  => {
  if (!e.message.includes('ECONNREFUSED')) {
    console.error('[Redis Master]  오류:', e.message)
  }
})

replica.on('connect', ()  => console.log('[Redis Replica] 연결 성공'))
replica.on('ready',   ()  => console.log('[Redis Replica] 준비 완료'))
replica.on('error',   (e) => {
  if (!e.message.includes('ECONNREFUSED')) {
    console.error('[Redis Replica] 오류:', e.message)
  }
})

/* ── 캐시 헬퍼 ────────────────────────────────────────────────────
   사용법:
     const cached = await cache.get('cards:all')
     if (!cached) {
       const data = await db.query(...)
       await cache.set('cards:all', data, 60)   // 60초 TTL
     }
   ─────────────────────────────────────────────────────────────── */
const cache = {
  async get(key) {
    try {
      const val = await replica.get(key)   // 읽기 → 레플리카
      return val ? JSON.parse(val) : null
    } catch {
      return null
    }
  },

  async set(key, value, ttlSeconds = 60) {
    try {
      await master.set(key, JSON.stringify(value), 'EX', ttlSeconds) // 쓰기 → 마스터
    } catch (e) {
      console.error('[Cache] SET 실패:', e.message)
    }
  },

  async del(key) {
    try {
      await master.del(key)
    } catch (e) {
      console.error('[Cache] DEL 실패:', e.message)
    }
  },
}

module.exports = { master, replica, cache }
