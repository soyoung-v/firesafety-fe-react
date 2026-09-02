// 상태값별 색상 매핑 (화면마다 중복 정의 방지, 한 곳으로 통합)

export const PANEL_STATUS_COLOR = {
  NORMAL: 'var(--color-success)',
  CAUTION: 'var(--color-warning)',
  RISK: 'var(--color-danger)',
  OFFLINE: 'var(--color-offline)',
}

export const ALERT_STATUS_COLOR = {
  UNCONFIRMED: 'var(--color-danger)',
  CONFIRMED: 'var(--color-warning)',
  RESOLVED: 'var(--color-success)',
}

export const ALERT_SEVERITY_COLOR = {
  CAUTION: 'var(--color-warning)',
  RISK: 'var(--color-danger)',
}

export const INSPECTION_RESULT_COLOR = {
  NORMAL: 'var(--color-success)',
  ABNORMAL: 'var(--color-danger)',
  UNCHECKED: 'var(--color-text-muted)',
}

// 매핑 없으면 회색(muted) 대체
export function colorOf(map, value) {
  return map[value] ?? 'var(--color-text-muted)'
}

// StatusBadge 기본 variant 7종 색상. 화면별 오버라이드는 color prop으로
export const STATUS_BADGE_COLOR = {
  NORMAL: 'var(--color-success)',
  CAUTION: 'var(--color-warning)',
  RISK: 'var(--color-danger)',
  OFFLINE: 'var(--color-offline)',
  UNCONFIRMED: 'var(--color-danger)',
  CONFIRMED: 'var(--color-warning)',
  RESOLVED: 'var(--color-success)',
  ARC: 'var(--color-danger)',
  // riskLevel(종합 위험도) 배지용 - NORMAL은 위 PANEL 계열과 동일 키 공유
  WARNING: 'var(--color-warning)',
  DANGER: 'var(--color-danger)',
}
