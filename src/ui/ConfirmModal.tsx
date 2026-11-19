import { useModalDialog } from './useModalDialog'

export interface ConfirmModalProps {
  title: string
  message: string
  confirmLabel: string
  /** 되돌릴 수 없는 작업이면 확인 버튼을 붉게 */
  danger?: boolean
  busy?: boolean
  error?: string | null
  onConfirm: () => void
  onClose: () => void
}

/** 확인이 필요한 작업(삭제 등)을 묻는 팝업. 브라우저 기본 confirm 대신 쓴다. */
export default function ConfirmModal({
  title,
  message,
  confirmLabel,
  danger,
  busy,
  error,
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  const { ref, onBackdropClick } = useModalDialog(onClose)
  return (
    <dialog
      ref={ref}
      className="result-dialog auth-dialog"
      aria-labelledby="confirm-title"
      aria-describedby="confirm-message"
      onClick={onBackdropClick}
    >
      <div className="auth-form">
        <h2 id="confirm-title" className="auth-title">
          {title}
        </h2>
        <p id="confirm-message" className="confirm-message">
          {message}
        </p>
        <p className="auth-error" role="alert">
          {error}
        </p>
        <button
          type="button"
          className={danger ? 'btn btn-danger btn-block' : 'btn btn-primary btn-block'}
          disabled={busy}
          onClick={onConfirm}
        >
          {busy ? '처리 중…' : confirmLabel}
        </button>
        <button type="button" className="btn btn-outline btn-block" disabled={busy} onClick={onClose}>
          취소
        </button>
      </div>
    </dialog>
  )
}
