/**
 * prototype2 전용 Redis 스텁 (no-op)
 * ────────────────────────────────────────────────────────────
 * prototype2 는 도커/Redis 없이 단독 실행하는 실험용 사본입니다.
 * (Redis HA·세션·캐시 인프라는 원본 prototype 에 이미 구성되어 있음)
 *
 * 따라서 여기서는 실제 Redis 에 연결하지 않고, 같은 인터페이스만 제공합니다.
 *   - cache.get  → 항상 null (캐시 미스) → 라우트가 DB 를 직접 조회
 *   - cache.set/del → 아무 동작 안 함
 * 이렇게 하면 cards.js·admin.js 등 기존 코드를 수정하지 않아도 그대로 동작하고,
 * 나중에 원본 prototype 으로 병합할 때 이 파일만 교체하면 됩니다.
 */

const noopClient = {
  async ping()    { return 'PONG' },
  async ttl()     { return -1 },
  async get()     { return null },
  async set()     {},
  async del()     {},
  async connect() {},
  on() {},
}

const cache = {
  async get()  { return null },  // 항상 미스 → DB 폴백
  async set()  {},               // 저장 안 함
  async del()  {},               // 무시
}

module.exports = { master: noopClient, replica: noopClient, cache }
