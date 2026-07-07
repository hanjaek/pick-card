// BNK 영원카드 — 가입연차에 따라 자동으로 오르는 할인율 · 월 할인한도
// 선택/구성 없이 전 가맹점에 동일하게 적용된다.
export const LIFE_CARD_GROWTH = [
  { year: 0,  label: '기본',  rate: 0.5, cap: 10000 },
  { year: 5,  label: '5년',  rate: 0.6, cap: 12000 },
  { year: 10, label: '10년', rate: 0.8, cap: 15000 },
  { year: 15, label: '15년', rate: 1.1, cap: 17000 },
  { year: 20, label: '20년', rate: 1.6, cap: 20000 },
]

export function currentLifeCardTier(tenureYear = 0) {
  let tier = LIFE_CARD_GROWTH[0]
  for (const t of LIFE_CARD_GROWTH) {
    if (tenureYear >= t.year) tier = t
  }
  return tier
}

export function nextLifeCardTier(tenureYear = 0) {
  return LIFE_CARD_GROWTH.find(t => t.year > tenureYear) || null
}

// "전체 카테고리 자동" 옵션 — 카테고리를 고르기 어려운 사람을 위해
// 한도 안에서 고르지 않고 전 카테고리에 낮은 할인율을 자동 적용한다.
export const LIFE_CARD_SIMPLE_GROWTH = [
  { year: 0,  label: '기본',  rate: 0.2 },
  { year: 5,  label: '5년',  rate: 0.3 },
  { year: 10, label: '10년', rate: 0.4 },
  { year: 15, label: '15년', rate: 0.5 },
  { year: 20, label: '20년', rate: 0.8 },
]

export function currentSimpleRate(tenureYear = 0) {
  let tier = LIFE_CARD_SIMPLE_GROWTH[0]
  for (const t of LIFE_CARD_SIMPLE_GROWTH) {
    if (tenureYear >= t.year) tier = t
  }
  return tier.rate
}
