import { useMemo, useState } from 'react'
import RuleBoard from './RuleBoard'
import type { RuleScene } from './ruleScenes'
import { useModalDialog } from './useModalDialog'
import { LAST_PHASE, prefersReducedMotion, useScenePhase } from './useScenePhase'

export interface RuleModalProps {
  scene: RuleScene
  onClose: () => void
}

const STEP_LABEL = ['돌 배치', '두려는 자리', '만들어지는 줄', '결론']

/** 금수 한 가지를 큰 그림과 단계별 설명으로 보여주는 팝업. Esc, 바깥 클릭, 닫기 버튼으로 닫는다. */
export default function RuleModal({ scene, onClose }: RuleModalProps) {
  const { ref: dialogRef, onBackdropClick } = useModalDialog(onClose)
  const reduced = useMemo(prefersReducedMotion, [])
  const [playing, setPlaying] = useState(!reduced)
  const [phase, setPhase] = useScenePhase(playing, 0, 1800, 3200)

  const go = (next: number) => {
    setPlaying(false)
    setPhase(Math.min(LAST_PHASE, Math.max(0, next)))
  }
  const replay = () => {
    setPhase(0)
    setPlaying(true)
  }

  const titleId = `rule-title-${scene.id}`

  return (
    <dialog
      ref={dialogRef}
      className="rule-dialog"
      aria-labelledby={titleId}
      onClick={onBackdropClick}
    >
      <div className="rule-modal">
        <header className="rule-modal-head">
          <h2 id={titleId}>{scene.title}</h2>
          <button type="button" className="rule-close" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </header>

        <div className="rule-modal-body">
          <div className="rule-modal-board">
            <RuleBoard scene={scene} phase={phase} />
          </div>

          <div className="rule-modal-side">
            <ol className="rule-steps" aria-label="단계">
              {STEP_LABEL.map((label, i) => (
                <li key={label}>
                  <button
                    type="button"
                    className={i === phase ? 'rule-step on' : i < phase ? 'rule-step done' : 'rule-step'}
                    aria-current={i === phase ? 'step' : undefined}
                    onClick={() => go(i)}
                  >
                    <span className="rule-step-no">{i + 1}</span>
                    {label}
                  </button>
                </li>
              ))}
            </ol>

            <p className={`rule-caption ${phase === LAST_PHASE ? (scene.expected ? 'bad' : 'good') : ''}`} aria-live="polite">
              {scene.captions[phase]}
            </p>

            <div className="rule-controls">
              <button type="button" className="btn btn-outline" onClick={() => go(phase - 1)} disabled={phase === 0}>
                ◀ 이전
              </button>
              <button type="button" className="btn btn-primary" onClick={() => (playing ? setPlaying(false) : setPlaying(true))}>
                {playing ? '❚❚ 멈춤' : '▶ 재생'}
              </button>
              <button type="button" className="btn btn-outline" onClick={() => go(phase + 1)} disabled={phase === LAST_PHASE}>
                다음 ▶
              </button>
              <button type="button" className="btn btn-outline" onClick={replay}>
                ↺ 처음부터
              </button>
            </div>

            <ul className="rule-details">
              {scene.details.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </dialog>
  )
}
