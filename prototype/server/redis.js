/**
 * Redis 클라이언트 — Master(쓰기) / Replica(읽기) 분리
 *
 * [연결 방식 안내]
 * 이 Node 서버는 "도커 밖(호스트)"에서 실행되므로, 도커가 외부로 열어둔
 * 포트에 직접 연결한다.
 *   - Master  : localhost:6379  (docker-compose 에서 6379:6379 매핑)
 *   - Replica : localhost:6380  (docker-compose 에서 6380:6379 매핑)
 *
 * Sentinel 자동탐색(role 기반 master 찾기)은 "앱도 같은 도커 네트워크
 * 안의 컨테이너로 띄울 때" 사용한다. 그때는 아래 SENTINEL 설정을 쓰면 된다.
 * 호스트에서 센티넬에 물으면 'redis-master' 같은 내부 호스트명을 돌려줘서
 * 호스트가 해석하지 못한다. 그래서 호스트 개발 환경에서는 직접 연결한다.
 * (Sentinel 자동 페일오버 자체는 클러스터 레벨에서 정상 동작 — CLI로 확인 가능)
 */

const Redis = require('ioredis')

const RETRY = (times) => Math.min(times * 200, 5000)

const baseOpts = {
  retryStrategy:        RETRY,
  maxRetriesPerRequest: 2,
  lazyConnect:          false,
  enableReadyCheck:     true,
}

/* ── 마스터 연결 (쓰기 전용) ── */
const master = new Redis({
  host: process.env.REDIS_MASTER_HOST || '127.0.0.1',
  port: Number(process.env.REDIS_MASTER_PORT) || 6379,
  ...baseOpts,
})

/* ── 레플리카 연결 (읽기 전용) ── */
const replica = new Redis({
  host: process.env.REDIS_REPLICA_HOST || '127.0.0.1',
  port: Number(process.env.REDIS_REPLICA_PORT) || 6380,
  ...baseOpts,
})

/* ── 연결 이벤트 로그 ── */
master.on('ready',  () => console.log('[Redis Master]  준비 완료 (localhost:6379)'))
master.on('error',  (e) => {
  if (!e.message.includes('ECONNREFUSED')) console.error('[Redis Master]  오류:', e.message)
})

replica.on('ready', () => console.log('[Redis Replica] 준비 완료 (localhost:6380)'))
replica.on('error', (e) => {
  if (!e.message.includes('ECONNREFUSED')) console.error('[Redis Replica] 오류:', e.message)
})

/* ── 캐시 헬퍼 ────────────────────────────────────────────────────
   읽기는 Replica, 쓰기는 Master 로 분리해 마스터 부하를 낮춘다.
   Redis 장애 시에도 앱이 죽지 않도록 모든 작업을 try/catch 로 감싼다.
   ─────────────────────────────────────────────────────────────── */
const cache = {
  async get(key) {
    try {
      const val = await replica.get(key)        // 읽기 → 레플리카
      return val ? JSON.parse(val) : null
    } catch {
      return null   // 캐시 실패 시 null → 호출부는 DB로 폴백
    }
  },

  async set(key, value, ttlSeconds = 60) {
    try {
      await master.set(key, JSON.stringify(value), 'EX', ttlSeconds)  // 쓰기 → 마스터
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
