import { useEffect, useRef } from 'react'
import { parseMoveLine } from '../runner/logFormat'
import type { LogLine } from '../runner/logFormat'

export interface LogPanelProps {
  lines: LogLine[]
}

function LogRow({ line }: { line: LogLine }) {
  if (line.kind === 'move') {
    const move = parseMoveLine(line.text)
    if (move) {
      return (
        <div className="log-row log-move">
          <span className="log-node" aria-hidden="true">
            <i className={`log-stone log-stone-${move.color}`} />
          </span>
          <span className="log-no">{move.no}</span>
          <span className="log-who">{move.who}</span>
          <code className="log-coord">{move.coord}</code>
        </div>
      )
    }
  }

  if (line.kind === 'print') {
    return (
      <div className="log-row log-print">
        <span className="log-node log-node-print" aria-hidden="true">
          p
        </span>
        <code className="log-print-text">{line.text.replace(/^print: /, '')}</code>
      </div>
    )
  }

  if (line.kind === 'error') {
    return (
      <div className="log-row log-error" role="alert">
        <span className="log-node log-node-error" aria-hidden="true">
          !
        </span>
        <span className="log-message">{line.text}</span>
      </div>
    )
  }

  if (line.kind === 'result') {
    return (
      <div className="log-row log-result">
        <span className="log-node log-node-result" aria-hidden="true">
          ★
        </span>
        <span className="log-message">{line.text}</span>
      </div>
    )
  }

  return (
    <div className="log-row log-info">
      <span className="log-node log-node-info" aria-hidden="true" />
      <span className="log-message">{line.text}</span>
    </div>
  )
}

/** 로그 창. 새 줄이 생기면 아래로 따라가되, 사용자가 위로 올려 둔 동안에는 방해하지 않는다. */
export default function LogPanel({ lines }: LogPanelProps) {
  const ref = useRef<HTMLDivElement>(null)
  const stick = useRef(true)
  // 우리가 스크롤을 옮겨서 생긴 scroll 이벤트인지 구분한다. 내용이 빠르게 늘어나는 중에는
  // 그 이벤트가 "위로 올렸다"로 잘못 읽혀 자동 따라가기가 풀리는 문제가 있었다.
  const auto = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el || !stick.current) return
    const target = el.scrollHeight - el.clientHeight
    if (Math.abs(el.scrollTop - target) > 1) {
      auto.current = true
      el.scrollTop = target
    }
  }, [lines])

  return (
    <div
      ref={ref}
      className="log"
      role="log"
      aria-live="polite"
      aria-label="대국 로그"
      tabIndex={0}
      onScroll={(e) => {
        if (auto.current) {
          auto.current = false
          return
        }
        const el = e.currentTarget
        stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24
      }}
    >
      {lines.length === 0 ? (
        <div className="log-empty">
          <span className="log-empty-icon" aria-hidden="true">
            ▶
          </span>
          <span>실행하면 대국 기록이 여기에 나옵니다.</span>
        </div>
      ) : (
        <div className="log-timeline">
          {lines.map((line, i) => (
            <LogRow key={i} line={line} />
          ))}
        </div>
      )}
    </div>
  )
}
