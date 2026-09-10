import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { getStatistics } from '../api/statisticsApi'
import { countOf, percentOf, percentOneDecimal, sumCounts } from '../utils/statisticsFormatters'
import { useSite } from '@/features/sites/useSite'
import BaseCard from '@/shared/components/data-display/BaseCard'
import EmptyState from '@/shared/components/feedback/EmptyState'
import ErrorState from '@/shared/components/feedback/ErrorState'
import LoadingState from '@/shared/components/feedback/LoadingState'
import StatusBadge from '@/shared/components/feedback/StatusBadge'
import Input from '@/shared/components/forms/Input'
import FilterBar from '@/shared/components/layout/FilterBar'
import { PANEL_STATUS_COLOR, STATUS_BADGE_COLOR } from '@/shared/constants/domainColors'
import { isoDate } from '@/shared/utils/formatters'
import './StatisticsPage.css'

// 통계 화면 숫자 표기 통일
function formatNumber(value) {
  return Number(value ?? 0).toLocaleString('ko-KR')
}

// 소수점 1자리 비율 텍스트(항상 1자리 - 100 -> "100.0", 0 -> "0.0")
function formatRate(rate) {
  return rate.toFixed(1)
}

// AI 진단 현황 progress bar fill 스타일 - width는 실제 비율값을 그대로 쓰되(데이터 왜곡 금지),
// 발생 건수가 있는데 비율이 너무 작아(예: 0.1%) 막대가 안 보이는 것만 시각적으로 보정한다.
// 텍스트 표시값(formatRate)은 이 보정과 무관하게 항상 실제 비율 그대로 나간다.
function diagnosisBarFillStyle(rate, count, color) {
  return {
    width: `${rate}%`,
    minWidth: count > 0 && rate > 0 ? '3px' : undefined,
    background: color,
  }
}

// 예방조치 이행률 목표선 
const RESOLUTION_TARGET_RATE = 90

// 기본 조회 기간: 최근 7일(다른 이력 화면들과 동일 기준)
function defaultFromDate() {
  const date = new Date()
  date.setDate(date.getDate() - 7)
  return isoDate(date)
}

// SCR-601 통계 — /api/statistics 하나로 경보/AI진단/분전반/점검 현황을 받아 그린다.
// 무거운 집계(일자별 상태 추이 등)는 프론트에서 계산하지 않고, 전부 백엔드가 미리 계산해 내려주는 값만 사용한다.
export default function StatisticsPage() {
  const { currentSiteId } = useSite()
  const [from, setFrom] = useState(defaultFromDate)
  const [to, setTo] = useState(() => isoDate(new Date()))
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const load = useCallback(async () => {
    if (!currentSiteId) {
      setLoading(false)
      setLoadError('통계는 현장 선택 후 이용할 수 있습니다.')
      return
    }
    setLoading(true)
    setLoadError('')
    try {
      const result = await getStatistics({ siteId: currentSiteId, from, to })
      setData(result)
    } catch (error) {
      setLoadError(error?.response?.data?.resultMessage || '통계를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [currentSiteId, from, to])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  function handleReset() {
    setFrom(defaultFromDate())
    setTo(isoDate(new Date()))
  }

  const alerts = data?.alerts
  const diagnoses = data?.diagnoses
  const panels = data?.panels

  const unresolvedAlertCount = useMemo(() => sumCounts(alerts?.statusCounts, ['UNCONFIRMED', 'CONFIRMED']), [alerts])
  const arcDiagnosisCount = useMemo(() => countOf(diagnoses?.verdictCounts, 'ARC'), [diagnoses])
  const normalDiagnosisCount = useMemo(() => countOf(diagnoses?.verdictCounts, 'NORMAL'), [diagnoses])
  const resolvedRate = useMemo(
    () => percentOf(countOf(alerts?.statusCounts, 'RESOLVED'), alerts?.totalCount),
    [alerts],
  )
  // 정상/아크 감지 비율은 소수점 1자리로 표시한다 - 정수 반올림(percentOf)을 쓰면 예:
  // 2117/2119건처럼 발생 건수가 있는데도 0%로 보여 사용자에게 잘못된 인상을 줄 수 있다.
  const arcRate = useMemo(
    () => percentOneDecimal(arcDiagnosisCount, diagnoses?.totalCount),
    [arcDiagnosisCount, diagnoses],
  )
  const normalDiagnosisRate = useMemo(
    () => percentOneDecimal(normalDiagnosisCount, diagnoses?.totalCount),
    [normalDiagnosisCount, diagnoses],
  )
  const diagnosisCoverageRate = useMemo(
    () => percentOf(diagnoses?.diagnosedCircuitCount, diagnoses?.totalCircuitCount),
    [diagnoses],
  )

  const dailyChartData = useMemo(() => alerts?.dailyCounts ?? [], [alerts])
  // rate는 서버가 이미 0~100 스케일로 계산해서 내려줌(발생 건수가 0인 날은 null — "0%"와 "데이터 없음"을 구분)
  // 예방조치 이행률(dailyResolutionRates)은 주의(CAUTION) 알림만 대상 — 조치완료 후 24시간 내 위험 미전환 비율
  const dailyResolutionChartData = useMemo(() => alerts?.dailyResolutionRates ?? [], [alerts])

  // 예방조치 이행률 카드 상단 보조 지표 — 백엔드가 미리 합산해 내려준 값만 사용
  const cautionAlertCount = alerts?.cautionAlertCount ?? 0
  const cautionResolvedCount = alerts?.cautionResolvedCount ?? 0
  const cautionEscalatedCount = alerts?.cautionEscalatedCount ?? 0
  const cautionResolvedRate = useMemo(() => percentOf(cautionResolvedCount, cautionAlertCount), [cautionResolvedCount, cautionAlertCount])
  const cautionEscalatedRate = useMemo(() => percentOf(cautionEscalatedCount, cautionAlertCount), [cautionEscalatedCount, cautionAlertCount])

  const panelChartData = useMemo(
    () => (panels?.statusCounts ?? []).filter((row) => row.count > 0).map((row) => ({ ...row, fill: PANEL_STATUS_COLOR[row.key] })),
    [panels],
  )
  const normalPanelRate = useMemo(
    () => percentOf(countOf(panels?.statusCounts, 'NORMAL'), panels?.totalCount),
    [panels],
  )

  const alertTypeChartData = useMemo(
    () => (alerts?.typeCounts ?? []).filter((row) => row.count > 0).sort((a, b) => b.count - a.count),
    [alerts],
  )

  if (loading) return <LoadingState label="통계를 불러오는 중입니다..." />
  if (loadError) return <ErrorState message={loadError} onRetry={load} />
  if (!data) return null

  return (
    <div className="statistics-page">
      <div className="statistics-kpi-grid">
        <BaseCard className="statistics-kpi">
          <span className="statistics-kpi__label">전체 경보</span>
          <strong className="statistics-kpi__value">
            {formatNumber(alerts?.totalCount)}
            <span>건</span>
          </strong>
        </BaseCard>
        <BaseCard className="statistics-kpi">
          <span className="statistics-kpi__label">미처리 경보</span>
          <strong className="statistics-kpi__value">
            {formatNumber(unresolvedAlertCount)}
            <span>건</span>
          </strong>
        </BaseCard>
        <BaseCard className="statistics-kpi">
          <span className="statistics-kpi__label">AI 이상감지</span>
          <strong className="statistics-kpi__value">
            {formatNumber(arcDiagnosisCount)}
            <span>건</span>
          </strong>
        </BaseCard>
        <BaseCard className="statistics-kpi">
          <span className="statistics-kpi__label">조치완료율</span>
          <strong className="statistics-kpi__value">
            {resolvedRate}
            <span>%</span>
          </strong>
        </BaseCard>
      </div>

      <BaseCard className="card--filter statistics-filter-card">
        <FilterBar onReset={handleReset}>
          <Input
            id="statistics-from"
            label="검색일"
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            className="statistics-filter-field"
          />
          <span className="statistics-date-separator" aria-hidden="true">
            ~
          </span>
          <Input
            id="statistics-to"
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            className="statistics-filter-field"
          />
        </FilterBar>
      </BaseCard>

      <div className="statistics-split-grid">
        <BaseCard header={<h2 className="statistics-section-title">일자별 경보 발생 추이</h2>}>
          {dailyChartData.length ? (
            <div className="statistics-chart">
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={dailyChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
                  <Tooltip />
                  <Bar dataKey="count" name="경보 건수" fill="var(--color-brand)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState message="기간 내 경보가 없습니다." />
          )}
        </BaseCard>

        <BaseCard header={<h2 className="statistics-section-title">분전반 상태 분포</h2>}>
          {panelChartData.length ? (
            <div className="statistics-chart statistics-donut-wrap">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={panelChartData} dataKey="count" nameKey="label" cx="50%" cy="42%" innerRadius={40} outerRadius={62} paddingAngle={2}>
                    {panelChartData.map((entry) => (
                      <Cell key={entry.key} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: 11 }} />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="statistics-donut-center" style={{ left: '50%', top: '42%' }}>
                <span className="statistics-donut-center__label">정상</span>
                <strong className="statistics-donut-center__value">{normalPanelRate}%</strong>
              </div>
            </div>
          ) : (
            <EmptyState message="등록된 분전반이 없습니다." />
          )}
        </BaseCard>

        <BaseCard header={<h2 className="statistics-section-title">경보 유형별 발생</h2>}>
          {alertTypeChartData.length ? (
            <div className="statistics-chart">
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={alertTypeChartData} layout="vertical" margin={{ left: 0, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="label" width={56} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" name="건수" fill="var(--color-brand)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState message="기간 내 경보가 없습니다." />
          )}
        </BaseCard>
      </div>

      <div className="statistics-half-grid">
        <BaseCard header={<h2 className="statistics-section-title">예방조치 이행률 추이</h2>}>
          {/* 주의(CAUTION) 알림 발생/조치완료/위험 전환 건수 — 카드/여백 없이 한 줄 요약으로만 보여줘서 그래프 자리를 침범하지 않는다 */}
          <p className="statistics-prevention-summary">
            주의 알림 발생 <strong>{formatNumber(cautionAlertCount)}건</strong>
            <span className="statistics-prevention-summary__divider">·</span>
            주의 조치완료{' '}
            <strong style={{ color: STATUS_BADGE_COLOR.RESOLVED }}>
              {formatNumber(cautionResolvedCount)}건({cautionResolvedRate}%)
            </strong>
            <span className="statistics-prevention-summary__divider">·</span>
            위험 전환{' '}
            <strong style={{ color: STATUS_BADGE_COLOR.RISK }}>
              {formatNumber(cautionEscalatedCount)}건({cautionEscalatedRate}%)
            </strong>
          </p>

          {dailyResolutionChartData.length ? (
            <div className="statistics-chart">
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={dailyResolutionChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} width={32} unit="%" />
                  <Tooltip formatter={(value) => (value == null ? '데이터 없음' : `${value}%`)} />
                  <ReferenceLine
                    y={RESOLUTION_TARGET_RATE}
                    stroke="var(--color-warning)"
                    strokeDasharray="4 4"
                    label={{ value: `목표 ${RESOLUTION_TARGET_RATE}%`, position: 'insideTopRight', fontSize: 11, fill: 'var(--color-warning)' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="rate"
                    name="조치완료율"
                    stroke="var(--color-brand)"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    connectNulls={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState message="기간 내 경보가 없습니다." />
          )}
        </BaseCard>

        <BaseCard header={<h2 className="statistics-section-title">AI 진단 현황</h2>}>
          <div className="statistics-highlight">
            <div className="statistics-highlight__top">
              <span className="statistics-highlight__title">
                회로 진단 커버리지 <strong>{diagnosisCoverageRate}%</strong>
              </span>
            </div>
            <div className="statistics-progress-bar">
              <div
                className="statistics-progress-bar__fill"
                style={{ width: `${diagnosisCoverageRate}%`, background: 'var(--color-brand)' }}
              />
            </div>
            <p className="statistics-highlight__desc">
              전체 회로 {formatNumber(diagnoses?.totalCircuitCount)}개 중 {formatNumber(diagnoses?.diagnosedCircuitCount)}개
              진단
            </p>

            <hr className="statistics-highlight__divider" />

            <div className="statistics-diagnosis-boxes">
              <div className="statistics-diagnosis-box">
                <div className="statistics-diagnosis-box__top">
                  <span className="statistics-diagnosis-box__label">정상</span>
                  <StatusBadge status="NORMAL" label="정상" />
                </div>
                <strong className="statistics-diagnosis-box__value">{formatNumber(normalDiagnosisCount)}건</strong>
                <div className="statistics-diagnosis-box__bar">
                  <div
                    className="statistics-diagnosis-box__bar-fill"
                    style={diagnosisBarFillStyle(normalDiagnosisRate, normalDiagnosisCount, STATUS_BADGE_COLOR.NORMAL)}
                  />
                </div>
                <span className="statistics-diagnosis-box__percent">비율 {formatRate(normalDiagnosisRate)}%</span>
              </div>

              <div className="statistics-diagnosis-box">
                <div className="statistics-diagnosis-box__top">
                  <span className="statistics-diagnosis-box__label">아크 감지</span>
                  <StatusBadge status={arcDiagnosisCount > 0 ? 'ARC' : 'NORMAL'} label={arcDiagnosisCount > 0 ? '주의' : '정상'} />
                </div>
                <strong className="statistics-diagnosis-box__value">{formatNumber(arcDiagnosisCount)}건</strong>
                <div className="statistics-diagnosis-box__bar">
                  <div
                    className="statistics-diagnosis-box__bar-fill"
                    style={diagnosisBarFillStyle(arcRate, arcDiagnosisCount, STATUS_BADGE_COLOR.ARC)}
                  />
                </div>
                <span className="statistics-diagnosis-box__percent">비율 {formatRate(arcRate)}%</span>
              </div>
            </div>
          </div>
        </BaseCard>
      </div>
    </div>
  )
}
