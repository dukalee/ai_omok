import { useModalDialog } from './useModalDialog'

export interface ClearModalProps {
  levelId: number
  levelTitle: string
  message: string
  /** 다음 레벨로. 마지막 레벨이면 null */
  onNext: (() => void) | null
  onList: () => void
  onClose: () => void
}

/** 튜토리얼 레벨을 통과했을 때 뜨는 팝업. Esc, 바깥 클릭, 닫기 버튼으로 닫는다. */
export default function ClearModal({ levelId, levelTitle, message, onNext, onList, onClose }: ClearModalProps) {
  const { ref, onBackdropClick } = useModalDialog(onClose)

  return (
    <dialog
      ref={ref}
      className="result-dialog"
      aria-labelledby="clear-title"
      aria-describedby="clear-message"
      onClick={onBackdropClick}
    >
      <div className="result-modal result-won">
        <span className="result-stone result-stone-black" aria-hidden="true" />
        <h2 id="clear-title" className="result-headline">
          레벨 {levelId} 통과!
        </h2>
        <p id="clear-message" className="result-reason">
          {message}
        </p>
        <p className="result-meta">{levelTitle}</p>
        <div className="result-actions">
          {onNext ? (
            <button type="button" className="btn btn-primary" onClick={onNext}>
              다음 레벨 →
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={onList}>
              레벨 목록
            </button>
          )}
          {onNext && (
            <button type="button" className="btn btn-outline" onClick={onList}>
              레벨 목록
            </button>
          )}
          <button type="button" className="btn btn-outline" onClick={onClose}>
            닫기
          </button>
        </div>
      </div>
    </dialog>
  )
}
