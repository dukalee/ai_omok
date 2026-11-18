import type { ResultSummary } from '../runner/resultSummary'
import { useModalDialog } from './useModalDialog'

export interface ResultModalProps {
  result: ResultSummary
  blackName: string
  whiteName: string
  onClose: () => void
  /** 같은 설정으로 한 번 더 실행한다 */
  onRerun: () => void
}

/** 대국이 끝났을 때 결과를 알려 주는 팝업. Esc, 바깥 클릭, 닫기 버튼으로 닫는다. */
export default function ResultModal({ result, blackName, whiteName, onClose, onRerun }: ResultModalProps) {
  const { ref, onBackdropClick } = useModalDialog(onClose)

  return (
    <dialog
      ref={ref}
      className="result-dialog"
      aria-labelledby="result-title"
      aria-describedby="result-reason"
      onClick={onBackdropClick}
    >
      <div className={result.playerWon ? 'result-modal result-won' : 'result-modal'}>
        <span className={`result-stone result-stone-${result.winnerColor}`} aria-hidden="true" />
        <h2 id="result-title" className="result-headline">
          {result.headline}
        </h2>
        <p id="result-reason" className="result-reason">
          {result.reasonText}
        </p>
        <p className="result-meta">
          {result.moves}수 · 흑 {blackName} / 백 {whiteName}
        </p>
        <div className="result-actions">
          <button type="button" className="btn btn-primary" onClick={onRerun}>
            ▶ 다시 실행
          </button>
          <button type="button" className="btn btn-outline" onClick={onClose}>
            닫기
          </button>
        </div>
      </div>
    </dialog>
  )
}
