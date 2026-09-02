import { useCallback, useEffect, useState } from 'react'
import { generateDiagnosisExplanation, getCircuitDiagnosis, triggerCircuitDiagnosis } from '../api/diagnosisApi'
import { extractServerMessage, formatDateTimeCell } from '../utils/facilityFormatters'
import { DIAGNOSIS_TRIGGER_TYPE_LABELS, RISK_LEVEL_LABELS, VERDICT_LABELS, labelOf } from '@/shared/constants/domainLabels'
import Button from '@/shared/components/buttons/Button'
import DataTable from '@/shared/components/data-display/DataTable'
import Pagination from '@/shared/components/data-display/Pagination'
import ErrorState from '@/shared/components/feedback/ErrorState'
import StatusBadge from '@/shared/components/feedback/StatusBadge'
import ActionResultModal from '@/shared/components/modals/ActionResultModal'
import BaseModal from '@/shared/components/modals/BaseModal'
import ConfirmModal from '@/shared/components/modals/ConfirmModal'

const PAGE_SIZE = 6

function formatConfidence(value) {
  return value == null ? '-' : `${Math.round(value * 100)}%`
}

function formatTriggerType(value) {
  return labelOf(DIAGNOSIS_TRIGGER_TYPE_LABELS, value)
}

// 회로 AI 진단 이력 + 수동 실행 (REQ-102/103) — SCR-202 통합, 새 라우트 없이 모달로만 존재. 조회/실행 모두 전체 역할 가능
export default function CircuitDiagnosisModal({ circuit, visible, onClose }) {
  const [history, setHistory] = useState([])
  const [totalElements, setTotalElements] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [triggerConfirmOpen, setTriggerConfirmOpen] = useState(false)
  const [triggering, setTriggering] = useState(false)
  const [triggerResult, setTriggerResult] = useState(null)
  // AI 분석(analysisSummary) 상태 - ML 결과(triggerResult)와 별개로 관리한다. ML 결과는 이미
  // 화면에 표시된 뒤 이어서 설명만 채워지는 상태를 표현할 수 있어야 한다(명세 13절).
  const [explanationLoading, setExplanationLoading] = useState(false)
  const [explanationError, setExplanationError] = useState('')
  const [explanationSummary, setExplanationSummary] = useState('')

  const load = useCallback(() => {
    if (!circuit) return
    setLoading(true)
    setLoadError('')
    getCircuitDiagnosis(circuit.circuitId, { page: page - 1, size: PAGE_SIZE })
      .then((data) => {
        setHistory(data?.content ?? [])
        setTotalElements(Number(data?.totalElements ?? 0))
      })
      .catch((error) => setLoadError(extractServerMessage(error, 'AI 진단 이력을 불러오지 못했습니다.')))
      .finally(() => setLoading(false))
  }, [circuit, page])

  // 모달을 열 때(또는 대상 회로가 바뀔 때)마다 1페이지부터 다시 본다
  useEffect(() => {
    if (!visible) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1)
  }, [visible, circuit])

  useEffect(() => {
    if (!visible) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [visible, load])

  // 진단 실행 API 자체는 동기(AI 서버 호출+저장까지 끝난 뒤 응답)라, 트리거 직후 이력을 다시 조회해
  // 새로 생긴 판정이 있으면 그 결과를 바로 보여준다. 샘플 부족 등으로 판정이 안 생겼을 수도 있어 그 경우만 별도 안내한다.
  // ML 결과가 화면에 반영된 뒤에만(순차) AI 설명을 요청한다 - trigger와 explanation을 병렬로 호출하지 않는다.
  async function handleTrigger() {
    if (triggering) return // 더블클릭 등으로 같은 진단이 중복 실행되지 않게 방어
    setTriggerConfirmOpen(false)
    setTriggering(true)
    setExplanationLoading(false)
    setExplanationError('')
    setExplanationSummary('')
    const previousLatestId = history[0]?.resultId ?? null
    try {
      await triggerCircuitDiagnosis(circuit.circuitId)
      const data = await getCircuitDiagnosis(circuit.circuitId, { page: 0, size: PAGE_SIZE })
      const freshHistory = data?.content ?? []
      setPage(1)
      setHistory(freshHistory)
      setTotalElements(Number(data?.totalElements ?? 0))

      const latest = freshHistory[0]
      if (latest && latest.resultId !== previousLatestId) {
        setTriggerResult({
          type: latest.verdict === 'ARC' ? 'danger' : 'success',
          title: `${VERDICT_LABELS[latest.verdict] ?? latest.verdict}(으)로 판정되었습니다.`,
          // 아크 판정(legacy ARC verdict)과 종합 위험도(riskLevel)는 서로 다른 모델의 별개 출력이라
          // 화면에서도 각각 다른 행으로 분리해서 보여준다(riskLevel=DANGER를 "아크 발생"으로 표시하지 않음)
          infoRows: [
            { label: '대상 회로', value: `회로 ${circuit.channelNo}` },
            { label: '아크 판정', value: VERDICT_LABELS[latest.verdict] ?? latest.verdict },
            { label: '신뢰도', value: formatConfidence(latest.confidence) },
            ...(latest.riskLevel
              ? [{ label: '종합 위험도', value: labelOf(RISK_LEVEL_LABELS, latest.riskLevel) }]
              : []),
            ...(latest.anomaly != null
              ? [{ label: '이상 패턴', value: latest.anomaly ? '감지됨' : '미감지' }]
              : []),
            ...(latest.predictedCurrent != null
              ? [{ label: '예측 전류', value: `${Number(latest.predictedCurrent).toFixed(1)} A` }]
              : []),
            { label: '샘플 수', value: latest.nSamples ?? '-' },
            { label: '진단 방식', value: formatTriggerType(latest.triggerType) },
            ...(latest.warning ? [{ label: '경고', value: latest.warning }] : []),
            { label: '판정 시각', value: formatDateTimeCell(latest.diagnosedAt) },
          ],
          showExplanation: true,
        })
        requestExplanation(latest)
      } else {
        setTriggerResult({
          type: 'warning',
          title: '새 판정이 생성되지 않았습니다.',
          infoRows: [
            { label: '대상 회로', value: `회로 ${circuit.channelNo}` },
            { label: '사유', value: '최근 샘플이 부족합니다. (최소 30개 이상 필요)' },
          ],
        })
      }
    } catch (error) {
      setTriggerResult({
        type: 'danger',
        title: 'AI 진단 요청에 실패했습니다.',
        infoRows: [{ label: '사유', value: extractServerMessage(error, '알 수 없는 오류') }],
      })
    } finally {
      setTriggering(false)
    }
  }

  // 이미 analysisSummary가 저장되어 있으면(캐시 hit) 그대로 쓰고 API를 호출하지 않는다.
  // 실패해도 이미 표시된 ML 결과에는 영향을 주지 않고, AI 분석 영역에서만 실패 상태를 보여준다.
  // 자동 재시도는 하지 않는다.
  async function requestExplanation(latest) {
    const cached = latest.analysisSummary?.trim()
    if (cached) {
      setExplanationSummary(cached)
      return
    }
    setExplanationLoading(true)
    try {
      const result = await generateDiagnosisExplanation(circuit.circuitId, latest.resultId)
      setExplanationSummary(result?.analysisSummary ?? '')
    } catch (error) {
      setExplanationError(extractServerMessage(error, 'AI 분석 설명을 불러오지 못했습니다.'))
    } finally {
      setExplanationLoading(false)
    }
  }

  const columns = [
    { key: 'diagnosedAt', header: '판정 시각', render: (row) => formatDateTimeCell(row.diagnosedAt) },
    {
      key: 'verdict',
      header: '판정',
      render: (row) => <StatusBadge status={row.verdict} label={VERDICT_LABELS[row.verdict] ?? row.verdict} />,
    },
    { key: 'confidence', header: '신뢰도', render: (row) => formatConfidence(row.confidence) },
    {
      // 경고는 회로 초기(샘플 충분히 쌓이기 전)에만 잠깐 나오는 값이라 별도 컬럼 대신 샘플 수 옆에 붙여서 보여준다
      key: 'nSamples',
      header: '샘플 수',
      render: (row) => (
        <>
          {row.nSamples ?? '-'}
          {row.warning && <span className="facility-diagnosis-warning"> ⚠ {row.warning}</span>}
        </>
      ),
    },
    { key: 'triggerType', header: '방식', render: (row) => formatTriggerType(row.triggerType) },
  ]

  return (
    <>
      <BaseModal
        visible={visible}
        onClose={onClose}
        title={circuit ? `회로 ${circuit.channelNo} AI 진단` : 'AI 진단'}
        className="facility-modal"
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>
              닫기
            </Button>
            <Button variant="primary" loading={triggering} onClick={() => setTriggerConfirmOpen(true)}>
              진단 실행
            </Button>
          </>
        }
      >
        {loadError ? (
          <ErrorState message={loadError} onRetry={load} />
        ) : (
          <>
            <p className="facility-muted">총 {totalElements}건 진단</p>
            <DataTable
              loading={loading}
              rows={history}
              rowKey={(row) => row.resultId}
              columns={columns}
              emptyMessage="AI 진단 이력이 없습니다."
              emptyDescription="진단 실행 버튼으로 지금 바로 진단할 수 있습니다."
            />
            {!loading && totalElements > 0 && (
              <Pagination
                page={page}
                totalPages={Math.max(1, Math.ceil(totalElements / PAGE_SIZE))}
                onChange={setPage}
                pageWindow={5}
              />
            )}
          </>
        )}
      </BaseModal>

      <ConfirmModal
        visible={triggerConfirmOpen}
        title="AI 진단 실행"
        confirmLabel="실행"
        onCancel={() => setTriggerConfirmOpen(false)}
        onConfirm={handleTrigger}
      >
        <div className="confirm-modal__summary confirm-modal__summary--neutral">
          <span className="confirm-modal__summary-icon" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path
                d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <div className="confirm-modal__summary-body">
            <p className="confirm-modal__summary-row">
              <span className="confirm-modal__summary-label">대상 회로</span>
              <span className="confirm-modal__summary-value">회로 {circuit?.channelNo}</span>
              <span className="confirm-modal__summary-badge">진단 실행</span>
            </p>
            <p className="confirm-modal__summary-detail">현재까지 쌓인 센서 데이터로 즉시 AI 판정을 실행합니다.</p>
          </div>
        </div>
      </ConfirmModal>

      <ActionResultModal
        visible={Boolean(triggerResult)}
        type={triggerResult?.type ?? 'info'}
        title={triggerResult?.title}
        infoRows={triggerResult?.infoRows ?? []}
        onClose={() => {
          setTriggerResult(null)
          setExplanationLoading(false)
          setExplanationError('')
          setExplanationSummary('')
          load()
        }}
      >
        {triggerResult?.showExplanation && (
          <div className="ai-analysis">
            <p className="ai-analysis__title">AI 분석</p>
            {explanationLoading && (
              <div className="ai-analysis__loading" role="status">
                <span className="spinner" aria-hidden="true" />
                <span>AI 분석 설명을 생성하는 중입니다...</span>
              </div>
            )}
            {!explanationLoading && explanationError && <p className="ai-analysis__error">{explanationError}</p>}
            {!explanationLoading && !explanationError && explanationSummary && (
              <p className="ai-analysis__summary">{explanationSummary}</p>
            )}
          </div>
        )}
      </ActionResultModal>
    </>
  )
}
