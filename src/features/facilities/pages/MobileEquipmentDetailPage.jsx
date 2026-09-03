import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { confirmAlert, getAlerts, resolveAlert } from '@/features/alerts/api/alertApi'
import { formatAlertSeverity, formatAlertStatus, formatAlertType } from '@/features/alerts/utils/alertFormatters'
import { getPanelDetail } from '../api/facilityApi'
import {
  extractServerMessage,
  formatOnline,
  formatPanelStatus,
  formatValue,
  getCircuitRiskLevel,
  getDoorStatusTone,
  getSensorFieldStatus,
  SENSOR_FIELDS,
} from '../utils/facilityFormatters'
import { useAuth } from '@/features/auth/useAuth'
import { useMonitoring } from '@/features/monitoring/useMonitoring'
import { useSite } from '@/features/sites/useSite'
import AlertSeverityIcon from '@/shared/components/feedback/AlertSeverityIcon'
import EmptyState from '@/shared/components/feedback/EmptyState'
import ErrorState from '@/shared/components/feedback/ErrorState'
import LoadingState from '@/shared/components/feedback/LoadingState'
import StatusBadge from '@/shared/components/feedback/StatusBadge'
import Button from '@/shared/components/buttons/Button'
import Input from '@/shared/components/forms/Input'
import ActionResultModal from '@/shared/components/modals/ActionResultModal'
import BaseModal from '@/shared/components/modals/BaseModal'
import ConfirmModal from '@/shared/components/modals/ConfirmModal'
import { ALERT_SEVERITY_COLOR } from '@/shared/constants/domainColors'
import { ROUTE_PATHS } from '@/shared/constants/routePaths'
import { formatDateTime, formatResultDateTime } from '@/shared/utils/formatters'
import './MobileEquipmentPages.css'

const RECENT_ALERT_SIZE = 5
const RESOLUTION_NOTE_MAX_LENGTH = 500

// 최근 경보 뱃지는 폭이 고정이라 "조치완료"(4자)가 깨진다 — 모바일에서만 짧게 표시(PC 라벨 맵은 그대로 둠)
function formatMobileAlertStatus(status) {
  if (status === 'RESOLVED') return '  완료'
  if (status === 'CONFIRMED') return '  확인'
  return formatAlertStatus(status)
}

// 최근 경보 목록은 한 줄에 넣을 자리가 좁아 연도/초는 빼고 "MM-DD HH:mm"만 표시
function formatMobileAlertTime(value) {
  if (!value) return '-'
  const [date, time] = value.split('T')
  return `${date?.slice(5) ?? ''} ${time?.slice(0, 5) ?? ''}`.trim()
}

// SCR-202-M 설비 상세 — 목록에서 바로 진입, 상단에서 이 설비의 최신 미처리 경보를 즉시 확인/조치완료할 수 있다
export default function MobileEquipmentDetailPage() {
  const { panelId } = useParams()
  const [searchParams] = useSearchParams()
  const focusAlertId = searchParams.get('alertId')
  const navigate = useNavigate()
  const { user } = useAuth()
  const { currentSiteId } = useSite()
  const { refreshedAt } = useMonitoring()
  const requestSeqRef = useRef(0)
  const alertSeqRef = useRef(0)

  const [panel, setPanel] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [alerts, setAlerts] = useState([])
  const [alertsError, setAlertsError] = useState('')

  const [actionTarget, setActionTarget] = useState(null) // { alert, mode: 'confirm' | 'resolve' }
  const [resolutionNote, setResolutionNote] = useState('')
  const [actionError, setActionError] = useState('')
  const [actionResult, setActionResult] = useState(null)
  const [detailTarget, setDetailTarget] = useState(null) // 조치완료(RESOLVED) 행 탭 시 읽기전용 상세

  const load = useCallback(
    async ({ silent = false } = {}) => {
      const seq = requestSeqRef.current + 1
      requestSeqRef.current = seq
      if (!silent) {
        setPanel(null)
        setLoading(true)
        setLoadError('')
      }

      try {
        const data = await getPanelDetail(panelId)
        if (requestSeqRef.current !== seq) return
        if (currentSiteId && data?.siteId !== currentSiteId) {
          if (!silent) setLoadError('현재 선택 현장에 속한 설비가 아닙니다.')
          return
        }
        setPanel(data)
      } catch (error) {
        if (requestSeqRef.current !== seq || silent) return
        const status = error?.response?.status
        setLoadError(
          extractServerMessage(
            error,
            status === 403 ? '이 설비를 조회할 권한이 없습니다.' : status === 404 ? '분전반을 찾을 수 없습니다.' : '설비 상세를 불러오지 못했습니다.',
          ),
        )
      } finally {
        if (requestSeqRef.current === seq) setLoading(false)
      }
    },
    [panelId, currentSiteId],
  )

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
    return () => {
      requestSeqRef.current += 1
    }
  }, [load])

  useEffect(() => {
    if (!refreshedAt) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load({ silent: true })
  }, [refreshedAt, load])

  const loadAlerts = useCallback(() => {
    const seq = alertSeqRef.current + 1
    alertSeqRef.current = seq
    setAlertsError('')

    getAlerts({ panelId, size: RECENT_ALERT_SIZE })
      .then((data) => {
        if (alertSeqRef.current !== seq) return
        setAlerts(Array.isArray(data?.content) ? data.content : [])
      })
      .catch((error) => {
        if (alertSeqRef.current !== seq) return
        setAlertsError(extractServerMessage(error, '최근 경보를 불러오지 못했습니다.'))
      })
  }, [panelId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAlerts()
    return () => {
      alertSeqRef.current += 1
    }
  }, [loadAlerts])

  // focusAlertId가 있으면 그 경보가 처리 대상의 SSOT다 - "최근 N건" 목록(alerts, RECENT_ALERT_SIZE)에
  // 없다고 해서 다른 경보로 조용히 대체하면 안 된다(MOBILE-P1: 목록에서 클릭한 항목과 실제 조치 대상이
  // 달라지던 버그). alertId 단건 필터(API-301, GET /alerts?alertId=)로 정확히 그 경보만 재조회한다.
  const [focusedAlert, setFocusedAlert] = useState(null)
  const [focusedAlertStatus, setFocusedAlertStatus] = useState('idle') // idle | loading | found | not-found | error

  useEffect(() => {
    if (!focusAlertId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFocusedAlert(null)
      setFocusedAlertStatus('idle')
      return undefined
    }
    let cancelled = false
    setFocusedAlertStatus('loading')
    getAlerts({ alertId: focusAlertId })
      .then((data) => {
        if (cancelled) return
        const found = (Array.isArray(data?.content) ? data.content : [])[0] ?? null
        setFocusedAlert(found)
        setFocusedAlertStatus(found ? 'found' : 'not-found')
      })
      .catch(() => {
        if (cancelled) return
        setFocusedAlert(null)
        setFocusedAlertStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [focusAlertId])

  // focusAlertId가 없을 때만(목록에서 특정 항목을 지목하지 않고 들어온 경우) 처리 안 된 가장 최근 알림을 대신 보여준다
  const topAlert = useMemo(() => {
    if (focusAlertId) return focusedAlert
    return alerts.find((alert) => alert.status !== 'RESOLVED') ?? null
  }, [alerts, focusAlertId, focusedAlert])

  function openAction(alert) {
    if (alert.status === 'RESOLVED') {
      setDetailTarget(alert)
      return
    }
    setResolutionNote('')
    setActionError('')
    setActionTarget({ alert, mode: alert.status === 'UNCONFIRMED' ? 'confirm' : 'resolve' })
  }

  async function handleActionConfirm() {
    setActionError('')
    try {
      if (actionTarget.mode === 'confirm') {
        await confirmAlert(actionTarget.alert.alertId)
        setActionResult({
          title: '확인 처리되었습니다.',
          infoRows: [
            { label: '확인 항목', value: formatAlertType(actionTarget.alert.type) },
            { label: '확인 시각', value: formatResultDateTime() },
            { label: '확인자', value: user?.name ?? '-' },
          ],
        })
      } else {
        await resolveAlert(actionTarget.alert.alertId, resolutionNote.trim())
        setActionResult({
          title: '조치완료 처리되었습니다.',
          infoRows: [
            { label: '조치 항목', value: formatAlertType(actionTarget.alert.type) },
            { label: '조치 시각', value: formatResultDateTime() },
            { label: '조치자', value: user?.name ?? '-' },
          ],
        })
      }
      setActionTarget(null)
      setResolutionNote('')
      loadAlerts()
      load({ silent: true }) // 조치 결과로 panel.status/센서 알람 플래그가 바뀔 수 있어 같이 갱신
    } catch (error) {
      setActionError(extractServerMessage(error, '처리에 실패했습니다.'))
    }
  }

  if (loading) return <LoadingState label="설비 상세를 불러오는 중입니다..." />

  if (loadError) return <ErrorState message={loadError} onRetry={load} />

  if (!panel) return null

  return (
    <div className="mobile-equipment-detail">
      <div className="mobile-equipment-detail__header">
        <span className="mobile-equipment-detail__name-row">
          <strong className="mobile-equipment-detail__name">{panel.name}</strong>
          <button type="button" className="mobile-equipment-detail__select-btn" onClick={() => navigate(ROUTE_PATHS.mobileEquipmentList)}>
            설비선택 →
          </button>
        </span>
        <span className="mobile-equipment-detail__meta">
          <StatusBadge status={panel.status} label={formatPanelStatus(panel.status)} />
          <span>{formatOnline(panel.isOnline)}</span>
        </span>
      </div>

      {/* 이 설비의 처리 필요한 경보를 바로 확인/조치완료 — 눌러도 페이지 이동 없이 하단 시트만 뜬다 */}
      {focusAlertId && focusedAlertStatus === 'not-found' && (
        <div className="mobile-equipment-action-banner mobile-equipment-action-banner--notice">
          <span>선택한 경보를 찾을 수 없습니다. 삭제되었거나 조회 권한이 없는 경보일 수 있습니다.</span>
        </div>
      )}
      {focusAlertId && focusedAlertStatus === 'error' && (
        <div className="mobile-equipment-action-banner mobile-equipment-action-banner--notice">
          <span>경보 정보를 불러오지 못했습니다.</span>
        </div>
      )}
      {topAlert && topAlert.status === 'RESOLVED' && (
        <div className="mobile-equipment-action-banner mobile-equipment-action-banner--notice">
          <span className="mobile-equipment-action-banner__info">
            <StatusBadge status={topAlert.severity} label={formatAlertSeverity(topAlert.severity)} color={ALERT_SEVERITY_COLOR[topAlert.severity]} />
            <strong>{formatAlertType(topAlert.type)} 경보 — 이미 조치완료됨</strong>
          </span>
        </div>
      )}
      {topAlert && topAlert.status !== 'RESOLVED' && (
        <div className="mobile-equipment-action-banner">
          <span className="mobile-equipment-action-banner__info">
            <StatusBadge
              status={topAlert.severity}
              label={formatAlertSeverity(topAlert.severity)}
              color={ALERT_SEVERITY_COLOR[topAlert.severity]}
            />
            <strong>{formatAlertType(topAlert.type)} 경보</strong>
          </span>
          <Button variant="primary" onClick={() => openAction(topAlert)}>
            {topAlert.status === 'UNCONFIRMED' ? '확인처리' : '조치처리'}
          </Button>
        </div>
      )}

      <section>
        <h2 className="mobile-equipment-section-title">센서 상태</h2>
        <div className="mobile-equipment-sensor-grid">
          {SENSOR_FIELDS.map((field) => {
            const status = getSensorFieldStatus(panel, field)
            const statusClass = status !== 'normal' ? ` mobile-equipment-sensor-tile--${status}` : ''
            return (
              <div key={field.key} className={`mobile-equipment-sensor-tile${statusClass}`}>
                <span className="mobile-equipment-sensor-tile__label">
                  {field.icon} {field.label}
                </span>
                <strong className="mobile-equipment-sensor-tile__value">{formatValue(panel[field.key], field.unit)}</strong>
              </div>
            )
          })}
          {(() => {
            const doorTone = getDoorStatusTone(panel)
            const doorClass = doorTone !== 'normal' ? ` mobile-equipment-sensor-tile--${doorTone}` : ''
            return (
              <div className={`mobile-equipment-sensor-tile${doorClass}`}>
                <span className="mobile-equipment-sensor-tile__label">🚪 도어</span>
                <strong className="mobile-equipment-sensor-tile__value">
                  {panel.doorStatus == null ? '-' : panel.doorStatus ? '열림' : '닫힘'}
                </strong>
              </div>
            )
          })()}
        </div>
      </section>

      <section>
        <h2 className="mobile-equipment-section-title">회로 상태</h2>
        {panel.circuits?.length ? (
          <div className="mobile-equipment-circuit-grid">
            {panel.circuits.map((circuit) => {
              const riskLevel = getCircuitRiskLevel(circuit.status)
              const riskClass = riskLevel !== 'normal' ? ` mobile-equipment-circuit-card--${riskLevel}` : ''
              return (
                <div key={circuit.circuitId} className={`mobile-equipment-circuit-card${riskClass}`}>
                  <span className="mobile-equipment-circuit-card__top">
                    <span>회로 {circuit.channelNo}</span>
                    {circuit.loadType && <span>{circuit.loadType}</span>}
                  </span>
                  <p className="mobile-equipment-circuit-card__current">{formatValue(circuit.currentA, 'A')}</p>
                  <p className="mobile-equipment-circuit-card__meta">아크 {circuit.arcCounter ?? 0}회</p>
                </div>
              )
            })}
          </div>
        ) : (
          <EmptyState message="등록된 회로가 없습니다." />
        )}
      </section>

      <section>
        <h2 className="mobile-equipment-section-title">최근 경보</h2>
        {alertsError ? (
          <ErrorState message={alertsError} />
        ) : alerts.length ? (
          <div className="mobile-equipment-alert-divided-list">
            {alerts.map((alert) => (
              <button
                key={alert.alertId}
                type="button"
                className="mobile-equipment-alert-divided-row"
                onClick={() => openAction(alert)}
              >
                <span className="mobile-equipment-alert-divided-row__type">
                  <AlertSeverityIcon severity={alert.severity} size={16} />
                  {formatAlertType(alert.type)}
                </span>
                <StatusBadge status={alert.status} label={formatMobileAlertStatus(alert.status)} />
                <span className="mobile-equipment-alert-row__meta">{formatMobileAlertTime(alert.triggeredAt)}</span>
              </button>
            ))}
          </div>
        ) : (
          <EmptyState message="최근 경보 이력이 없습니다." />
        )}
      </section>

      {/* 단건 확인/조치완료 — 상단 배너/최근 경보 목록 둘 다 여기로 모인다 */}
      {actionTarget && (
        <ConfirmModal
          visible={Boolean(actionTarget)}
          title={actionTarget.mode === 'confirm' ? '경보 확인' : '조치완료 처리'}
          confirmLabel={actionTarget.mode === 'confirm' ? '확인' : '조치완료'}
          onCancel={() => {
            setActionTarget(null)
            setResolutionNote('')
            setActionError('')
          }}
          onConfirm={handleActionConfirm}
        >
          <div className="confirm-modal__summary">
            <span className="confirm-modal__summary-icon" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path
                  d="M9 12l2 2 4-4M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <div className="confirm-modal__summary-body">
              <p className="confirm-modal__summary-row">
                <span className="confirm-modal__summary-label">대상 경보</span>
                <span className="confirm-modal__summary-value">{formatAlertType(actionTarget.alert.type)}</span>
                <span className="confirm-modal__summary-badge">{actionTarget.mode === 'confirm' ? '확인' : '조치완료'}</span>
              </p>
              <p className="confirm-modal__summary-detail">{panel.name} 분전반 · {formatDateTime(actionTarget.alert.triggeredAt)} 발생</p>
            </div>
          </div>
          {actionError && (
            <p className="banner banner-danger" role="alert">
              {actionError}
            </p>
          )}
          {actionTarget.mode === 'resolve' && (
            <Input
              label="조치 비고"
              placeholder="예: 케이블 재접속 (참고용, 선택 입력)"
              value={resolutionNote}
              maxLength={RESOLUTION_NOTE_MAX_LENGTH}
              onChange={(event) => setResolutionNote(event.target.value)}
            />
          )}
        </ConfirmModal>
      )}

      <ActionResultModal
        visible={Boolean(actionResult)}
        title={actionResult?.title}
        infoRows={actionResult?.infoRows ?? []}
        onClose={() => setActionResult(null)}
      />

      {/* 조치완료 경보는 처리할 액션이 없어 누가 언제 확인/조치했는지만 하단 시트로 보여준다(PC 상세 모달과 동일 정보) */}
      <BaseModal
        visible={Boolean(detailTarget)}
        onClose={() => setDetailTarget(null)}
        title="이상 감지 상세"
        className="modal-panel--narrow"
        footer={
          <Button variant="primary" onClick={() => setDetailTarget(null)}>
            닫기
          </Button>
        }
      >
        {detailTarget && (
          <div className="mobile-equipment-alert-detail">
            <div className="mobile-equipment-alert-detail__summary">
              <StatusBadge
                status={detailTarget.severity}
                label={formatAlertSeverity(detailTarget.severity)}
                color={ALERT_SEVERITY_COLOR[detailTarget.severity]}
              />
              <StatusBadge status={detailTarget.status} label="완료" />
              <strong>{formatAlertType(detailTarget.type)} 경보</strong>
            </div>

            <div className="mobile-equipment-alert-detail__rows">
              <div className="mobile-equipment-alert-detail__row">
                <span>발생 시각</span>
                <strong>{formatDateTime(detailTarget.triggeredAt)}</strong>
              </div>
              <div className="mobile-equipment-alert-detail__row">
                <span>확인자</span>
                <strong>{detailTarget.confirmedByName ?? '-'}</strong>
              </div>
              <div className="mobile-equipment-alert-detail__row">
                <span>확인 시각</span>
                <strong>{formatDateTime(detailTarget.confirmedAt)}</strong>
              </div>
              <div className="mobile-equipment-alert-detail__row">
                <span>조치자</span>
                <strong>{detailTarget.resolvedByName ?? '-'}</strong>
              </div>
              <div className="mobile-equipment-alert-detail__row">
                <span>조치 시각</span>
                <strong>{formatDateTime(detailTarget.resolvedAt)}</strong>
              </div>
            </div>

            <div className="mobile-equipment-alert-detail__note">
              <span className="mobile-equipment-alert-detail__note-label">조치 비고</span>
              <p>{detailTarget.resolutionNote || '입력된 비고 없음'}</p>
            </div>
          </div>
        )}
      </BaseModal>
    </div>
  )
}
