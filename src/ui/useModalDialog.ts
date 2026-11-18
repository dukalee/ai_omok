import { useEffect, useRef } from 'react'
import type { MouseEvent } from 'react'

/**
 * <dialog> 팝업의 공통 동작. showModal()이 포커스 가두기, Esc 닫기, 닫은 뒤 포커스 복귀를 처리한다.
 * - 바깥(배경) 클릭도 닫기로 처리한다.
 * - 개발 모드(StrictMode)는 효과를 두 번 실행하는데, 정리 단계의 close()가 만든 늦은 'close' 이벤트가
 *   다시 열린 팝업을 닫아 버리지 않도록, 이미 열려 있으면 그 이벤트는 무시한다.
 */
export function useModalDialog(onClose: () => void) {
  const ref = useRef<HTMLDialogElement>(null)

  // 최신 onClose를 항상 부르되, 효과를 다시 실행하지 않도록 ref에 담아 둔다.
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    const handleClose = () => {
      if (!dialog.open) onCloseRef.current()
    }
    dialog.addEventListener('close', handleClose)
    if (!dialog.open) dialog.showModal()
    return () => {
      dialog.removeEventListener('close', handleClose)
      if (dialog.open) dialog.close()
    }
  }, [])

  const onBackdropClick = (e: MouseEvent<HTMLDialogElement>) => {
    if (e.target === e.currentTarget) onClose()
  }

  return { ref, onBackdropClick }
}
