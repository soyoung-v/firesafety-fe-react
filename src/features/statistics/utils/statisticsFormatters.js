// 서버 응답 [{key,label,count}] 목록에서 특정 key의 count만 뽑기
export function countOf(counts, key) {
  return counts?.find((item) => item.key === key)?.count ?? 0
}

// 여러 key의 count 합산 (예: 미처리 경보 = UNCONFIRMED + CONFIRMED)
export function sumCounts(counts, keys) {
  return keys.reduce((sum, key) => sum + countOf(counts, key), 0)
}

// 0건일 때 나눗셈 방지 — 비율(%) 계산 (정수 반올림, 회로 진단 커버리지 등 기존 지표 전용)
export function percentOf(part, total) {
  if (!total) return 0
  return Math.round((part / total) * 100)
}

// 소수점 1자리 비율(%) 계산 — AI 진단 현황(정상/아크 감지)처럼 작은 비율이 정수 반올림으로
// 0%가 되어 실제로는 발생 건수가 있는데도 "0%"로 보이면 안 되는 지표 전용.
// total이 0/falsy이거나 part가 없으면 0을 반환해 NaN/Infinity를 만들지 않는다.
export function percentOneDecimal(part, total) {
  if (!total) return 0
  return Math.round((part / total) * 1000) / 10
}
