// 영문 enum → 화면 표시용 한글 라벨 매핑. API 계약값 자체는 영문 유지.

export const USER_ROLE_LABELS = {
  SUPER_ADMIN: '플랫폼관리자',
  ADMIN: '현장관리자',
  GENERAL: '일반직원',
}

export const PANEL_STATUS_LABELS = {
  NORMAL: '정상',
  CAUTION: '주의',
  RISK: '위험',
  OFFLINE: '오프라인',
}

export const VERDICT_LABELS = {
  NORMAL: '정상',
  ARC: '아크 감지',
}

// riskLevel(종합 위험도) - VERDICT_LABELS(아크 판정)와 별개 의미. UI에서도 혼동하지 않는다(ADR-002, firesafety-ai)
export const RISK_LEVEL_LABELS = {
  NORMAL: '정상',
  WARNING: '주의',
  DANGER: '위험',
}

export const DIAGNOSIS_TRIGGER_TYPE_LABELS = {
  AUTO: '자동',
  MANUAL: '수동',
  MOCK: '데모',
  UNKNOWN: '알 수 없음',
}

export const ALERT_SOURCE_LABELS = {
  DEVICE: '장비',
  AI: 'AI',
  SYSTEM: '시스템',
}

export const ALERT_TYPE_LABELS = {
  ARC: '아크',
  OVERHEAT: '과열',
  LEAKAGE: '누설전류',
  OVERCURRENT: '과전류',
  HUMIDITY: '습도',
  GAS: '가스',
  FIRE: '화재',
  DOOR_OPEN: '도어 개방',
  DEVICE_ERROR: '장비 오류',
  COMM_LOST: '통신 두절',
}

export const ALERT_SEVERITY_LABELS = {
  CAUTION: '주의',
  RISK: '위험',
}

export const ALERT_STATUS_LABELS = {
  UNCONFIRMED: '미확인',
  CONFIRMED: '확인',
  RESOLVED: '조치완료',
}

export const INSPECTION_RESULT_LABELS = {
  NORMAL: '정상',
  ABNORMAL: '이상',
  UNCHECKED: '미확인',
}

// 매핑 없으면 원본 값 그대로 (신규 enum 대비)
export function labelOf(map, value) {
  return map[value] ?? value
}
