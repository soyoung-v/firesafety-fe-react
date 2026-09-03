// 하단탭/드로어 공용 아이콘 24x24 — 실제 모바일 라우트가 늘어나면 mobileNavIcons.jsx에 매핑만 추가
export function HomeIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 11l8-7 8 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 10v9a1 1 0 0 0 1 1h4v-6h2v6h4a1 1 0 0 0 1-1v-9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// 분전반(설비) — 사각 패널 + 채널 스위치 표현
export function EquipmentIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="5" y="3" width="14" height="18" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M9 8v3M12 8v3M15 8v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M8 15h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

// 점검 — 체크리스트
export function InspectionIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="3" width="16" height="18" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 9l1.5 1.5L12 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 9.5h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M8 15.5h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

// 직원(연락처) — 사람
export function AccountIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5 20c1-3.6 4-5.5 7-5.5s6 1.9 7 5.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}
