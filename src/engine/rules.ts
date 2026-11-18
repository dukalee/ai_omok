import { BOARD_SIZE } from './types'
import type { Board, Color, Move } from './types'

export function opponent(color: Color): Color {
  return color === 1 ? 2 : 1
}

const DIRECTIONS: [number, number][] = [
  [0, 1], // 가로
  [1, 0], // 세로
  [1, 1], // \ 대각선
  [1, -1], // / 대각선
]

function inBounds(row: number, col: number): boolean {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE
}

/**
 * move 위치의 돌을 지나는 줄 중 승리 조건을 만족하는 연속 구간을 반환한다. 없으면 null.
 * 흑은 정확히 5개일 때만 승리하고(6개 이상은 장목이라 승리가 아니다),
 * 백은 5개 이상이면 승리한다.
 */
export function findWinningLine(board: Board, move: Move): Move[] | null {
  const color = board[move.row][move.col]
  if (color === 0) return null

  for (const [dr, dc] of DIRECTIONS) {
    const line: Move[] = [{ row: move.row, col: move.col }]

    let r = move.row - dr
    let c = move.col - dc
    while (inBounds(r, c) && board[r][c] === color) {
      line.unshift({ row: r, col: c })
      r -= dr
      c -= dc
    }

    r = move.row + dr
    c = move.col + dc
    while (inBounds(r, c) && board[r][c] === color) {
      line.push({ row: r, col: c })
      r += dr
      c += dc
    }

    const wins = color === 1 ? line.length === 5 : line.length >= 5
    if (wins) return line
  }
  return null
}
