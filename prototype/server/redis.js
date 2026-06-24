/**
 * Redis 클라이언트 — 2가지 연결 모드 지원
 *
 * ① Sentinel 모드 (정석 · 앱이 도커 네트워크 안에서 실행될 때)
 *    - REDIS_SENTINELS 환경변수가 있으면 활성화 (예: "redis-sentinel:26379")
 *    - ioredis 가 센티넬에 물어 현재 마스터를 자동으로 찾고,
 *      페일오버(마스터 교체) 시 새 마스터로 자동 재연결 → 무중단
 *
 * ② 직접 연결 모드 (호스트에서 npm run dev 로 실행할 때)
 *    - 환경변수 없으면 localhost:6379(쓰기) / localhost:6380(읽기) 직접 연결
 *
 * 두 모드 모두: 쓰기=master, 읽기=replica 로 분리.
 */

const Redis = require('ioredis')

const RETRY       = (times) => Math.min(times * 200, 5000)
const MASTER_NAME = process.env.REDIS_MASTER_NAME || 'mymaster'
const SENTINELS   = process.env.REDIS_SENTINELS   // 예: "redis-sentinel:26379"

let master, replica

if (SENTINELS) {
  /* ── ① Sentinel 모드 (자동 페일오버) ── */
  const sentinels = SENTINELS.split(',').map(s => {
    const [host, port] = s.trim().split(':')
    return { host, port: Number(port) || 26379 }
  })

  const common = {
    sentinels,
    name:                  MASTER_NAME,
    sentinelRetryStrategy: RETRY,
    enableReadyCheck:      true,
  }

  master  = new Redis({ ...common, role: 'master' })   // 쓰기 (마스터 자동추적)
  replica = new Redis({ ...common, role: 'slave'  })   // 읽기 (레플리카)

  master.on('+switch-master', (m) => console.log('[Redis] 페일오버 감지 → 새 마스터로 전환:', m))
  console.log('[Redis] Sentinel 모드 활성화 (auto-failover):', SENTINELS)
} else {
  /* ── ② 직접 연결 모드 (호스트 개발) ── */
  const common = { retryStrategy: RETRY, maxRetriesPerRequest: 2, enableReadyCheck: true }

  master  = new Redis({ host: process.env.REDIS_MASTER_HOST || '127.0.0.1',
                        port: Number(process.env.REDIS_MASTER_PORT) || 6379, ...common })
  replica = new Redis({ host: process.env.REDIS_REPLICA_HOST || '127.0.0.1',
                        port: Number(process.env.REDIS_REPLICA_PORT) || 6380, ...common })

  console.log('[Redis] 직접 연결 모드 (localhost 6379/6380)')
}

/* ── 공통 이벤트 로그 ── */
master.on('ready',  () => console.log('[Redis Master]  준비 완료'))
master.on('error',  (e) => { if (!e.message.includes('ECONNREFUSED')) console.error('[Redis Master]  오류:', e.message) })
replica.on('ready', () => console.log('[Redis Replica] 준비 완료'))
replica.on('error', (e) => { if (!e.message.includes('ECONNREFUSED')) console.error('[Redis Replica] 오류:', e.message) })

/* ── 캐시 헬퍼 (읽기=replica, 쓰기=master) ── */
const cache = {
  async get(key) {
    try {
      const val = await replica.get(key)
      return val ? JSON.parse(val) : null
    } catch {
      return null
    }
  },
  async set(key, value, ttlSeconds = 60) {
    try {
      await master.set(key, JSON.stringify(value), 'EX', ttlSeconds)
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
