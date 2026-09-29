// 화면 URL 목록 (브라우저 주소창 기준, 백엔드 API 주소와는 무관 — API는 httpRequester가 baseURL '/api'로 따로 호출)
// 운영 URL 고정 — 값 변경 시 북마크/딥링크 깨짐
export const ROUTE_PATHS = {
  // 인증
  login: '/login',
  passwordResetRequest: '/reset-password/request',
  passwordResetConfirm: '/reset-password',

  // 현장 (사이드바 진입 전 독립 화면)
  siteSelect: '/select-site',
  siteUnassigned: '/site-unassigned',

  // 관제/통계 (PC)
  dashboard: '/dashboard',
  alerts: '/alerts',
  equipmentList: '/equipment',
  equipmentDetail: '/equipment/:panelId',
  statistics: '/statistics',

  // 설정/관리 (PC)
  settings: '/settings',
  settingsFacilities: '/settings/facilities',
  settingsFacilitiesHistory: '/settings/facilities/history',
  settingsAccounts: '/settings/accounts',
  settingsAccountHistory: '/settings/accounts/history',
  settingsInspectionChecklist: '/settings/inspections', // [GAP] REQ-511, 백엔드 완료
  settingsInspectionHistory: '/settings/inspections/history', // [GAP] REQ-512, 백엔드 완료

  // 시스템
  systemAbout: '/system/about', // [GAP] REQ-702, 백엔드 완료

  // 모바일
  mobileLogin: '/m/login',
  mobileSiteSelect: '/m/select-site',
  mobileDashboard: '/m/dashboard',
  mobileAlerts: '/m/alerts',
  mobileAlertSettings: '/m/alerts/settings',
  mobileEquipmentList: '/m/equipment',
  mobileEquipmentDetail: '/m/equipment/:panelId',
  mobileInspection: '/m/inspections',
  mobileAccountsContacts: '/m/accounts',

  // 디자인 시스템
  designSystem: '/design-system',
}

// 경로 패턴의 :key를 실제 값으로 치환 (예: '/equipment/:panelId' → '/equipment/5')
export function buildPath(pattern, params = {}) {
  return Object.entries(params).reduce(
    (path, [key, value]) => path.replace(`:${key}`, encodeURIComponent(value)),
    pattern,
  )
}
