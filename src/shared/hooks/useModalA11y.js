import { useEffect, useLayoutEffect, useRef } from 'react'

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'

// ESC 닫기 + Tab 포커스 트랩 + 닫힐 때 이전 포커스 복원
export function useModalA11y({ visible, onClose }) {
  const panelRef = useRef(null)
  const previousFocusRef = useRef(null)
  // onClose가 호출부에서 인라인 함수로 넘어오는 경우가 많아 매 렌더 참조가 바뀜 —
  // effect 의존성에 그대로 넣으면 모달 내부 상태가 바뀔 때마다(예: 입력창 타이핑) 이 effect가 재실행되어
  // "열리자마자 첫 포커스 요소로 이동"이 반복 발동, 타이핑 중인 입력에서 포커스를 계속 뺏어감
  const onCloseRef = useRef(onClose)
  // 렌더 중 ref를 직접 쓰지 않고, paint 전(useLayoutEffect)에 최신값으로 갱신한다 —
  // 아래 focus trap effect의 의존성 배열에는 onClose를 넣지 않는다(넣으면 타이핑마다 재실행돼 포커스를 뺏음)
  useLayoutEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    if (!visible) return undefined // 비표시 상태면 리스너 등록 불필요

    previousFocusRef.current = document.activeElement // 닫을 때 복원할 포커스 기억
    const panel = panelRef.current
    const focusables = panel ? panel.querySelectorAll(FOCUSABLE_SELECTOR) : []
    focusables[0]?.focus() // 열리자마자 첫 포커스 가능 요소로 이동

    function handleKeydown(event) {
      if (event.key === 'Escape') {
        onCloseRef.current?.()
        return
      }
      if (event.key !== 'Tab' || focusables.length === 0) return

      // 첫/마지막 요소에서 Tab 순환 → 모달 밖으로 포커스 못 나가게
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeydown)
    return () => {
      document.removeEventListener('keydown', handleKeydown)
      previousFocusRef.current?.focus?.() // 닫힐 때 원래 포커스로 복귀
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible])

  return panelRef
}
