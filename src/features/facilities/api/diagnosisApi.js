import httpRequester from '@/shared/api/httpRequester'
import { unwrap } from '@/shared/api/response'

// 회로 AI 진단 이력 조회 (REQ-103)
export async function getCircuitDiagnosis(circuitId, params = {}) {
  const res = await httpRequester.get(`/circuits/${circuitId}/diagnosis`, { params })
  return unwrap(res)
}

// 회로 AI 진단 수동 실행 (REQ-102) — 비동기 트리거, 결과는 위 조회로 재확인해야 한다
export async function triggerCircuitDiagnosis(circuitId) {
  const res = await httpRequester.post(`/circuits/${circuitId}/diagnosis/trigger`)
  return unwrap(res)
}

// 분전반 AI 진단 현황 조회 — 회로별 상세 이력보다 한 단계 위의 요약 정보
export async function getPanelDiagnosisSummary(panelId) {
  const res = await httpRequester.get(`/panels/${panelId}/diagnosis/summary`)
  return unwrap(res)
}

// AI 진단 설명(analysisSummary) 생성/조회 (Phase 12) — 이미 저장되어 있으면 서버가 DB 값을 그대로
// 반환한다(OpenAI 재호출 없음). 실패해도 이미 표시된 ML 진단 결과에는 영향이 없어야 하므로, 실패 시
// 전역 알림(httpRequester 인터셉터의 showAlert)을 띄우지 않고 호출부가 AI 분석 영역에서만 조용히 처리한다.
export async function generateDiagnosisExplanation(circuitId, resultId) {
  const res = await httpRequester.post(
    `/circuits/${circuitId}/diagnosis/${resultId}/explanation`,
    undefined,
    { suppressGlobalAlert: true },
  )
  return unwrap(res)
}
