import { useId } from 'react'
import { BOARD_SIZE } from '../engine/types'
import type { Board as BoardState, Move } from '../engine/types'

const CELL = 30
const PAD = 26
const SIZE = CELL * (BOARD_SIZE - 1) + PAD * 2
const STONE_R = 13.5
const STAR_POINTS = [3, 7, 11]

const pos = (i: number) => PAD + i * CELL

export interface BoardProps {
  board: BoardState
  lastMove: Move | null
  winningLine: Move[] | null
  /** 반칙으로 진 수의 자리. 붉은 ×로 표시한다 */
  foulMove: Move | null
}

/** 읽기 전용 오목판 */
export default function Board({ board, lastMove, winningLine, foulMove }: BoardProps) {
  const uid = useId().replace(/:/g, '')
  const winKeys = new Set((winningLine ?? []).map((m) => `${m.row},${m.col}`))
  const indices = Array.from({ length: BOARD_SIZE }, (_, i) => i)

  return (
    <svg
      className="board"
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      role="img"
      aria-label="오목판"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <radialGradient id={`${uid}-black`} cx="35%" cy="32%" r="75%">
          <stop offset="0" stopColor="#4a4a4f" />
          <stop offset="1" stopColor="#101014" />
        </radialGradient>
        <radialGradient id={`${uid}-white`} cx="35%" cy="32%" r="75%">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#e9e9f0" />
        </radialGradient>
        <filter id={`${uid}-shadow`} x="-30%" y="-30%" width="160%" height="170%">
          <feDropShadow dx="0" dy="3" stdDeviation="2.5" floodColor="#000" floodOpacity="0.3" />
        </filter>
      </defs>

      <rect className="board-bg" width={SIZE} height={SIZE} rx={6} />
      <g className="board-lines">
        {indices.map((i) => (
          <g key={i}>
            <line x1={pos(0)} y1={pos(i)} x2={pos(BOARD_SIZE - 1)} y2={pos(i)} />
            <line x1={pos(i)} y1={pos(0)} x2={pos(i)} y2={pos(BOARD_SIZE - 1)} />
          </g>
        ))}
      </g>

      {STAR_POINTS.flatMap((r) =>
        STAR_POINTS.map((c) => (
          <circle key={`star-${r}-${c}`} className="board-star" cx={pos(c)} cy={pos(r)} r={3.5} />
        )),
      )}

      {board.flatMap((rowCells, row) =>
        rowCells.map((cell, col) => {
          if (cell === 0) return null
          const key = `${row},${col}`
          const isLast = lastMove?.row === row && lastMove?.col === col
          return (
            <g key={key}>
              <circle
                cx={pos(col)}
                cy={pos(row)}
                r={STONE_R}
                fill={`url(#${uid}-${cell === 1 ? 'black' : 'white'})`}
                filter={`url(#${uid}-shadow)`}
              />
              {winKeys.has(key) && (
                <circle className="stone-win" cx={pos(col)} cy={pos(row)} r={STONE_R + 2.5} />
              )}
              {isLast && <circle className="stone-last" cx={pos(col)} cy={pos(row)} r={3.5} />}
            </g>
          )
        }),
      )}

      {foulMove && isOnBoard(foulMove) && (
        <g className="foul-mark">
          <line
            x1={pos(foulMove.col) - 9}
            y1={pos(foulMove.row) - 9}
            x2={pos(foulMove.col) + 9}
            y2={pos(foulMove.row) + 9}
          />
          <line
            x1={pos(foulMove.col) - 9}
            y1={pos(foulMove.row) + 9}
            x2={pos(foulMove.col) + 9}
            y2={pos(foulMove.row) - 9}
          />
        </g>
      )}
    </svg>
  )
}

function isOnBoard(m: Move): boolean {
  return m.row >= 0 && m.row < BOARD_SIZE && m.col >= 0 && m.col < BOARD_SIZE
}
