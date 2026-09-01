import { useEffect, useState } from 'react'
import { createSiteWithAdmin } from '../api/siteApi'
import { checkEmailDuplicate } from '@/features/accounts/api/accountApi'
import { isValidPassword, PASSWORD_POLICY_MESSAGE } from '@/features/auth/utils/passwordPolicy'
import { useAuth } from '@/features/auth/useAuth'
import Button from '@/shared/components/buttons/Button'
import Input from '@/shared/components/forms/Input'
import BaseModal from '@/shared/components/modals/BaseModal'
import ActionResultModal from '@/shared/components/modals/ActionResultModal'
import ConfirmModal from '@/shared/components/modals/ConfirmModal'
import AddressSearchModal from './AddressSearchModal'
import { formatResultDateTime } from '@/shared/utils/formatters'
import '../pages/sitePageShell.css'
import '@/features/accounts/components/AccountModal.css'
import '@/features/accounts/pages/accountFormShell.css'

const INITIAL_FORM = {
  name: '',
  address: '',
  addressDetail: '',
  zipCode: '',
  adminName: '',
  adminEmail: '',
  adminPassword: '',
  adminPasswordConfirm: '',
  adminPhone: '',
}

// 현장 + 최초 현장관리자 통합 등록(POST /sites/with-admin) — 페이지 대신 모달로, 목록 화면에서 여닫는 흐름
export default function SiteCreateModal({ visible, onClose, onCreated }) {
  const { user } = useAuth()

  const [form, setForm] = useState(INITIAL_FORM)
  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [emailChecked, setEmailChecked] = useState(false)
  const [emailAvailable, setEmailAvailable] = useState(null)
  const [addressSearchOpen, setAddressSearchOpen] = useState(false)

  useEffect(() => {
    if (!visible) return
    // 모달을 열 때마다 이전 입력이 남지 않게 초기화
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm(INITIAL_FORM)
    setErrors({})
    setSubmitError('')
    setResult(null)
    setEmailChecked(false)
    setEmailAvailable(null)
  }, [visible])

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => (prev[field] ? { ...prev, [field]: '' } : prev))
    if (field === 'adminEmail') {
      // 이메일을 다시 고치면 이전 중복확인 결과는 무효 — 최종 검증은 어차피 제출 시 서버가 다시 함
      setEmailChecked(false)
      setEmailAvailable(null)
    }
  }

  async function handleCheckEmail() {
    if (!form.adminEmail) return
    const data = await checkEmailDuplicate(form.adminEmail)
    setEmailAvailable(!data.duplicate)
    setEmailChecked(true)
  }

  // 주소 검색 모달에서 후보를 고르면 주소/우편번호 확정
  function handlePickAddress(item) {
    setForm((prev) => ({ ...prev, address: item.address, zipCode: item.zipCode ?? '' }))
    setErrors((prev) => (prev.address ? { ...prev, address: '' } : prev))
  }

  // DB 스키마 기준 필수값(site.name/address, user.name/email/password) — 최종 검증 책임은 백엔드
  function validate() {
    const next = {}
    if (!form.name.trim()) next.name = '현장명을 입력해주세요.'
    if (!form.address.trim()) next.address = '주소를 입력해주세요.'
    if (!form.adminName.trim()) next.adminName = '관리자 이름을 입력해주세요.'
    if (!form.adminEmail.trim()) next.adminEmail = '관리자 이메일을 입력해주세요.'
    if (!form.adminPassword) next.adminPassword = '비밀번호를 입력해주세요.'
    else if (!isValidPassword(form.adminPassword)) next.adminPassword = PASSWORD_POLICY_MESSAGE
    if (form.adminPassword !== form.adminPasswordConfirm) next.adminPasswordConfirm = '비밀번호가 일치하지 않습니다.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  // 저장 전 항상 한 번 확인받는다(삭제/복구뿐 아니라 모든 변경에 통일된 흐름)
  function handleSubmit(event) {
    event?.preventDefault()
    setSubmitError('')
    if (!validate()) return
    setConfirmOpen(true)
  }

  async function handleConfirmSubmit() {
    setConfirmOpen(false)
    setSubmitting(true)
    try {
      const created = await createSiteWithAdmin({
        name: form.name.trim(),
        address: form.address.trim(),
        addressDetail: form.addressDetail.trim() || null,
        zipCode: form.zipCode.trim() || null,
        adminName: form.adminName.trim(),
        adminEmail: form.adminEmail.trim(),
        adminPassword: form.adminPassword,
        adminPhone: form.adminPhone.trim() || null,
      })
      setResult({ siteName: created?.siteName ?? form.name })
    } catch (error) {
      // 현장명/이메일 중복(409)은 어느 필드 문제인지 서버 메시지로만 구분 가능 → 폼 상단에 그대로 노출
      setSubmitError(error?.response?.data?.resultMessage ?? '현장 등록에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  function handleResultClose() {
    setResult(null)
    onCreated?.()
    onClose()
  }

  const footer = (
    <>
      <Button type="button" variant="secondary" onClick={onClose}>
        취소
      </Button>
      <Button type="button" variant="primary" loading={submitting} onClick={handleSubmit}>
        등록
      </Button>
    </>
  )

  return (
    <>
      <BaseModal visible={visible && !result} onClose={onClose} title="현장 등록" className="modal-panel--wide" footer={footer}>
        <form onSubmit={handleSubmit} className="site-form__body">
          {submitError && (
            <div className="banner banner-danger" role="alert">
              {submitError}
            </div>
          )}

          <fieldset className="site-form__group">
            <legend className="site-form__legend site-form__section-head">
              현장 정보
              <span className="site-form__legend-desc">
                <span className="field-required">*</span> 표시는 필수 항목입니다.
              </span>
            </legend>
            <div className="site-form__row-2-1">
              <Input
                label="현장명"
                requiredMark
                placeholder="예: 대구스마트팩토리1호점"
                value={form.name}
                error={errors.name}
                onChange={(event) => updateField('name', event.target.value)}
              />
              <Input
                label="우편번호"
                value={form.zipCode}
                onChange={(event) => updateField('zipCode', event.target.value)}
              />
            </div>
            <div className="site-form__row-2-1">
              <Input
                label="주소"
                requiredMark
                readOnly
                placeholder="주소 검색으로 입력해주세요"
                value={form.address}
                error={errors.address}
              />
              <Button type="button" variant="secondary" onClick={() => setAddressSearchOpen(true)}>
                주소 검색
              </Button>
            </div>
            <Input
              label="상세주소"
              placeholder="예: 5층 501호"
              value={form.addressDetail}
              onChange={(event) => updateField('addressDetail', event.target.value)}
            />
          </fieldset>

          <fieldset className="site-form__group">
            <legend className="site-form__legend site-form__section-head">
              최초 현장관리자
              <span className="site-form__legend-desc">이 현장을 담당할 현장관리자 계정이 함께 만들어집니다.</span>
            </legend>
            <div className="account-modal__row">
              <Input
                label="이름"
                requiredMark
                placeholder="예: 홍길동"
                value={form.adminName}
                error={errors.adminName}
                onChange={(event) => updateField('adminName', event.target.value)}
              />
              <Input
                label="연락처"
                placeholder="010-0000-0000"
                value={form.adminPhone}
                onChange={(event) => updateField('adminPhone', event.target.value)}
              />
            </div>
            <div className="account-form__email-row">
              <Input
                label="이메일"
                type="email"
                autoComplete="off"
                requiredMark
                placeholder="예: name@example.com"
                hint="로그인 아이디로 사용됩니다."
                value={form.adminEmail}
                error={errors.adminEmail}
                onChange={(event) => updateField('adminEmail', event.target.value)}
              />
              <Button type="button" variant="secondary" onClick={handleCheckEmail}>
                중복확인
              </Button>
            </div>
            {emailChecked && (
              <p className={`account-form__email-result ${emailAvailable ? 'is-ok' : 'is-taken'}`} role="status">
                {emailAvailable ? '사용 가능한 이메일입니다.' : '이미 사용 중인 이메일입니다.'}
              </p>
            )}
            <div className="account-modal__row">
              <Input
                label="비밀번호"
                type="password"
                autoComplete="new-password"
                requiredMark
                hint={PASSWORD_POLICY_MESSAGE}
                value={form.adminPassword}
                error={errors.adminPassword}
                onChange={(event) => updateField('adminPassword', event.target.value)}
              />
              <Input
                label="비밀번호 확인"
                type="password"
                autoComplete="new-password"
                requiredMark
                value={form.adminPasswordConfirm}
                error={errors.adminPasswordConfirm}
                onChange={(event) => updateField('adminPasswordConfirm', event.target.value)}
              />
            </div>
          </fieldset>
        </form>
      </BaseModal>

      <AddressSearchModal
        visible={addressSearchOpen}
        onClose={() => setAddressSearchOpen(false)}
        onSelect={handlePickAddress}
      />

      <ConfirmModal
        visible={confirmOpen}
        title="현장 등록"
        message="입력한 내용으로 현장과 현장관리자 계정을 등록하시겠습니까?"
        confirmLabel="등록"
        onConfirm={handleConfirmSubmit}
        onCancel={() => setConfirmOpen(false)}
      >
        <div className="confirm-modal__summary confirm-modal__summary--neutral">
          <span className="confirm-modal__summary-icon" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <div className="confirm-modal__summary-body">
            <p className="confirm-modal__summary-row">
              <span className="confirm-modal__summary-label">현장명</span>
              <span className="confirm-modal__summary-value">{form.name}</span>
              <span className="confirm-modal__summary-badge">등록</span>
            </p>
            <p className="confirm-modal__summary-detail">현장관리자 {form.adminName || '-'} 계정도 함께 만들어집니다.</p>
          </div>
        </div>
      </ConfirmModal>

      <ActionResultModal
        visible={Boolean(result)}
        type="success"
        title="등록이 완료되었습니다."
        subtitle="현장과 현장관리자 계정이 함께 등록되었습니다."
        infoRows={[
          { label: '등록 항목', value: result?.siteName },
          { label: '등록 시각', value: formatResultDateTime() },
          { label: '등록자', value: user?.name },
        ]}
        onClose={handleResultClose}
      />
    </>
  )
}
