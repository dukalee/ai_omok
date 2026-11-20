import { useState } from 'react'
import RuleModal from './RuleModal'
import { RuleThumb } from './RuleBoard'
import { SCENES } from './ruleScenes'

/** "규칙 · 금지된 수" 영역: 금수 카드 목록과, 카드를 누르면 열리는 그림 설명 팝업. 연습, 튜토리얼에서 함께 쓴다. */
export default function ForbiddenRules() {
  // 금수 설명 팝업: 열려 있는 장면의 id
  const [openRule, setOpenRule] = useState<string | null>(null)
  const openScene = SCENES.find((s) => s.id === openRule) ?? null

  return (
    <>
      <h4 className="card-title">
        <span>규칙 · 금지된 수</span>
      </h4>
      <div className="rules">
        <ul className="rules-notes">
          <li>금수는 흑에게만 적용됩니다.</li>
          <li>금수 자리에 두면 반칙패 입니다.</li>
          <li>아래 블록을 누르면 상세 설명을 확인할 수 있습니다.</li>
        </ul>
        <ul className="rule-list">
          {SCENES.map((scene) => (
            <li key={scene.id}>
              <button
                type="button"
                className="rule-card"
                aria-haspopup="dialog"
                aria-label={scene.title + ' 그림 설명 열기'}
                onClick={() => setOpenRule(scene.id)}
              >
                <span className="rule-thumb" aria-hidden="true">
                  <RuleThumb scene={scene} />
                </span>
                <span className="rule-text">
                  <b>{scene.title}</b>
                  <span>{scene.summary}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      {openScene && <RuleModal scene={openScene} onClose={() => setOpenRule(null)} />}
    </>
  )
}
