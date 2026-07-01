/**
 * Redis 클라이언트 — 환경에 따라 자동 전환
 * ────────────────────────────────────────────────────────────
 *  ① 도커 스택 (REDIS_SENTINELS 설정) → 실제 Redis HA(센티넬) 연결 + 자동 페일오버
 *  ② 직접 연결 (REDIS_MASTER_HOST 설정) → localhost Redis 직접 연결
 *  ③ 단독 실행 (아무 설정 없음)       → no-op 스텁 (캐시 미스=DB 폴백, 에러 없음)
 *
 * prototype2 는 단독 node 실행이 기본이라 ③(스텁)로 동작하고,
 * 도커로 띄우면(REDIS_SENTINELS 주입) ①(실제 Redis)로 동작한다.
 */

const useRedis = !!(
  process.env.REDIS_SENTINELS ||
  process.env.REDIS_MASTER_HOST ||
  process.env.USE_REDIS === 'true'
)

let master, replica, cache

if (!useRedis) {
  /* ── ③ 단독 실행: no-op 스텁 ── */
  const noop = {
    async ping()    { return 'PONG' },
    async ttl()     { return -1 },
    async get()     { return null },
    async set()     {},
    async del()     {},
    async connect() {},
    on() {},
  }
  master  = noop
  replica = noop
  cache   = { async get() { return null }, async set() {}, async del() {} }
  console.log('[Redis] 비활성 (단독 실행) — 캐시 미스=DB 폴백')
} else {
  const Redis       = require('ioredis')
  const RETRY       = (times) => Math.min(times * 200, 5000)
  const MASTER_NAME = process.env.REDIS_MASTER_NAME || 'mymaster'
  const SENTINELS   = process.env.REDIS_SENTINELS

  if (SENTINELS) {
    /* ── ① Sentinel 모드 (도커 · 자동 페일오버) ── */
    const sentinels = SENTINELS.split(',').map(s => {
      const [host, port] = s.trim().split(':')
      return { host, port: Number(port) || 26379 }
    })
    const common = {
      sentinels, name: MASTER_NAME,
      sentinelRetryStrategy: RETRY, enableReadyCheck: true,
      commandTimeout: 2000, maxRetriesPerRequest: 1,
    }
    master  = new Redis({ ...common, role: 'master' })
    replica = new Redis({ ...common, role: 'slave'  })
    master.on('+switch-master', (m) => console.log('[Redis] 페일오버 → 새 마스터:', m))
    console.log('[Redis] Sentinel 모드 (auto-failover):', SENTINELS)
  } else {
    /* ── ② 직접 연결 모드 ── */
    const common = { retryStrategy: RETRY, maxRetriesPerRequest: 1, connectTimeout: 2000, commandTimeout: 2000, enableReadyCheck: true, lazyConnect: true }
    master  = new Redis({ host: process.env.REDIS_MASTER_HOST || '127.0.0.1', port: Number(process.env.REDIS_MASTER_PORT) || 6379, ...common })
    replica = new Redis({ host: process.env.REDIS_REPLICA_HOST || '127.0.0.1', port: Number(process.env.REDIS_REPLICA_PORT) || 6380, ...common })
    master.connect().catch(() => {})
    replica.connect().catch(() => {})
    console.log('[Redis] 직접 연결 모드')
  }

  master.on('ready',  () => console.log('[Redis Master] 준비 완료'))
  master.on('error',  (e) => { if (!String(e.message).includes('ECONNREFUSED')) console.error('[Redis Master]', e.message) })
  replica.on('error', () => {})

  let ready = false
  replica.on('ready', () => { ready = true })
  replica.on('error', () => { ready = false })
  replica.on('close', () => { ready = false })

  cache = {
    async get(key) {
      if (!ready) return null
      try { const v = await replica.get(key); return v ? JSON.parse(v) : null } catch { return null }
    },
    async set(key, value, ttlSeconds = 60) {
      if (!ready) return
      try { await master.set(key, JSON.stringify(value), 'EX', ttlSeconds) } catch {}
    },
    async del(key) {
      if (!ready) return
      try { await master.del(key) } catch {}
    },
  }
}

module.exports = { master, replica, cache }
