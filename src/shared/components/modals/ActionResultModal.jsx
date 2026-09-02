import BaseModal from './BaseModal'
import Button from '../buttons/Button'

const ICON_BY_TYPE = {
  success: { symbol: '✓', color: 'var(--color-success)', bg: 'var(--color-success-bg)' },
  danger: { symbol: '✕', color: 'var(--color-danger)', bg: 'var(--color-danger-bg)' },
  warning: { symbol: '!', color: 'var(--color-warning)', bg: 'var(--color-warning-bg)' },
  info: { symbol: '✎', color: 'var(--color-brand)', bg: 'var(--color-surface-accent)' },
}

// 삭제/수정/승인/거부 등 작업 완료 후 결과만 알려주는 모달 (firesafety-fe ActionResultModal 형식)
// infoRows: [{ label, value }] — 처리 항목/시각/처리자 같은 요약 정보, 없으면 표 자체를 생략
export default function ActionResultModal({
  visible,
  type = 'success',
  title,
  subtitle,
  desc,
  infoRows = [],
  confirmText = '확인',
  onClose,
  children,
}) {
  const icon = ICON_BY_TYPE[type] ?? ICON_BY_TYPE.success

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      hideHeader
      className="modal-panel--narrow"
      footer={
        <Button variant="primary" onClick={onClose}>
          {confirmText}
        </Button>
      }
    >
      <div className="action-result">
        <span className="action-result__icon" style={{ color: icon.color, background: icon.bg }}>
          {icon.symbol}
        </span>
        <h3 className="action-result__title">{title}</h3>
        {subtitle && <p className="action-result__subtitle">{subtitle}</p>}
        {desc && <p className="action-result__desc">{desc}</p>}

        {infoRows.length > 0 && (
          // success/danger 색으로 튀지 않게, 타입 무관하게 항상 같은 옅은 회색 톤으로 통일
          <div className="action-result__info">
            {infoRows.map((row) => (
              <div key={row.label} className="action-result__info-row">
                <span className="action-result__info-label">{row.label}</span>
                <span className="action-result__info-value">{row.value}</span>
              </div>
            ))}
          </div>
        )}

        {children}
      </div>
    </BaseModal>
  )
}
