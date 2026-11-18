import { useId, useMemo } from 'react'
import type { RuleScene } from './ruleScenes'
import { LAST_PHASE, prefersReducedMotion, useScenePhase } from './useScenePhase'

const CELL = 36
const PAD = 22
const STONE_R = 14

export interface RuleBoardProps {
  scene: RuleScene
  /** 0: 돌 배치, 1: 목표 자리 표시, 2: 두었을 때 만들어지는 줄, 3: 결론 */
  phase: number
}

/** 금수 설명용 9×9 미니 판. 단계(phase)에 따라 요소가 나타나며 애니메이션된다. */
export default function RuleBoard({ scene, phase }: RuleBoardProps) {
  const uid = useId().replace(/:/g, '')
  const n = scene.size
  const size = (n - 1) * CELL + PAD * 2
  const x = (c: number) => PAD + c * CELL
  const y = (r: number) => PAD + r * CELL
  const indices = Array.from({ length: n }, (_, i) => i)
  const forbidden = scene.expected !== null
  const tone = forbidden ? 'danger' : 'ok'
  const { target } = scene

  return (
    <svg className="rb" viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${scene.title} 설명 그림`}>
      <defs>
        <radialGradient id={`${uid}-b`} cx="35%" cy="32%" r="75%">
          <stop offset="0" stopColor="#4a4a4f" />
          <stop offset="1" stopColor="#101014" />
        </radialGradient>
        <radialGradient id={`${uid}-w`} cx="35%" cy="32%" r="75%">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#e9e9f0" />
        </radialGradient>
      </defs>

      <rect className="rb-bg" width={size} height={size} rx={8} />
      <g className="rb-grid">
        {indices.map((i) => (
          <g key={i}>
            <line x1={x(0)} y1={y(i)} x2={x(n - 1)} y2={y(i)} />
            <line x1={x(i)} y1={y(0)} x2={x(i)} y2={y(n - 1)} />
          </g>
        ))}
      </g>

      {/* 단계 2 이후: 두었을 때 만들어지는 줄 */}
      {phase >= 2 &&
        scene.lines.map((line, i) => {
          const first = line.cells[0]
          const last = line.cells[line.cells.length - 1]
          const horizontal = first[0] === last[0]
          const mid = line.cells[Math.floor((line.cells.length - 1) / 2)]
          // 표시는 가로줄 아래, 세로줄 오른쪽에 둬서 두 줄이 만나는 자리에서 서로 겹치지 않게 한다
          const lx = horizontal ? (x(first[1]) + x(last[1])) / 2 : x(mid[1]) + 30
          const ly = horizontal ? y(first[0]) + 30 : (y(first[0]) + y(last[0])) / 2
          return (
            <g key={`line-${i}`} className={`rb-line rb-${line.tone}`}>
              <line x1={x(first[1])} y1={y(first[0])} x2={x(last[1])} y2={y(last[0])} />
              <g transform={`translate(${lx} ${ly})`}>
                <rect x={-20} y={-12} width={40} height={24} rx={12} />
                <text textAnchor="middle" dominantBaseline="central">
                  {line.label}
                </text>
              </g>
            </g>
          )
        })}

      {scene.stones.map((s, i) => (
        <circle
          key={`${s.r},${s.c}`}
          className="rb-stone rb-pop"
          style={{ animationDelay: `${i * 70}ms`, transformOrigin: `${x(s.c)}px ${y(s.r)}px` }}
          cx={x(s.c)}
          cy={y(s.r)}
          r={STONE_R}
          fill={`url(#${uid}-${s.color === 'black' ? 'b' : 'w'})`}
          stroke={s.color === 'white' ? '#9a9cb3' : 'none'}
        />
      ))}

      {/* 단계 1: 목표 자리에 물음표 */}
      {phase === 1 && (
        <g className="rb-target">
          <circle cx={x(target.c)} cy={y(target.r)} r={STONE_R + 2} />
          <text x={x(target.c)} y={y(target.r)} textAnchor="middle" dominantBaseline="central">
            ?
          </text>
        </g>
      )}

      {/* 단계 2 이후: 목표 자리에 흑돌을 둔 모습 */}
      {phase >= 2 && (
        <circle
          className="rb-stone rb-drop"
          style={{ transformOrigin: `${x(target.c)}px ${y(target.r)}px` }}
          cx={x(target.c)}
          cy={y(target.r)}
          r={STONE_R}
          fill={`url(#${uid}-b)`}
        />
      )}

      {/* 단계 3: 결론 */}
      {phase >= 3 &&
        (forbidden ? (
          <g className="rb-verdict rb-danger">
            <circle cx={x(target.c)} cy={y(target.r)} r={STONE_R + 5} />
            <line x1={x(target.c) - 9} y1={y(target.r) - 9} x2={x(target.c) + 9} y2={y(target.r) + 9} />
            <line x1={x(target.c) - 9} y1={y(target.r) + 9} x2={x(target.c) + 9} y2={y(target.r) - 9} />
          </g>
        ) : (
          <g className={`rb-verdict rb-${tone}`}>
            <circle cx={x(target.c)} cy={y(target.r)} r={STONE_R + 5} />
            <path
              d={`M ${x(target.c) - 8} ${y(target.r)} L ${x(target.c) - 2} ${y(target.r) + 7} L ${x(target.c) + 9} ${y(target.r) - 7}`}
            />
          </g>
        ))}
    </svg>
  )
}

/** 블록 안의 작은 그림: 단계가 자동으로 반복 재생된다. 모션 줄이기 설정이면 결론 장면만 정지해서 보여준다. */
export function RuleThumb({ scene }: { scene: RuleScene }) {
  const reduced = useMemo(prefersReducedMotion, [])
  const [phase] = useScenePhase(!reduced, reduced ? LAST_PHASE : 0)
  return <RuleBoard scene={scene} phase={phase} />
}
