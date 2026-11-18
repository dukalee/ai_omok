import { isInside } from '../engine/board'
import { BOARD_SIZE } from '../engine/types'
import type { Board, Color, Move } from '../engine/types'

const DIRECTIONS: [number, number][] = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
]

const CENTER = Math.floor(BOARD_SIZE / 2)

/**
 * 연속된 돌의 길이와 열린 끝의 수(0~2)로 점수를 낸다.
 * 5목 이상 > 열린 4 > 막힌 4 > 열린 3 > 막힌 3 > 열린 2 > 막힌 2 > 한 개 순이다.
 */
export function patternScore(length: number, openEnds: number): number {
  if (length >= 5) return 100000
  if (openEnds === 0) return 0
  switch (length) {
    case 4:
      return openEnds === 2 ? 10000 : 1000
    case 3:
      return openEnds === 2 ? 500 : 100
    case 2:
      return openEnds === 2 ? 50 : 5
    default:
      return 1
  }
}

function isEmptyAt(board: Board, row: number, col: number): boolean {
  return isInside({ row, col }) && board[row][col] === 0
}

/** 기존 돌에서 radius칸 이내의 빈 칸. 판이 비어 있으면 중앙 하나만 반환한다. */
export function candidateMoves(board: Board, radius = 2): Move[] {
  const near: boolean[][] = Array.from({ length: BOARD_SIZE }, () =>
    Array<boolean>(BOARD_SIZE).fill(false),
  )
  let hasStone = false
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] === 0) continue
      hasStone = true
      for (let dr = -radius; dr <= radius; dr++) {
        for (let dc = -radius; dc <= radius; dc++) {
          const nr = r + dr
          const nc = c + dc
          if (isInside({ row: nr, col: nc })) near[nr][nc] = true
        }
      }
    }
  }
  if (!hasStone) return [{ row: CENTER, col: CENTER }]

  const moves: Move[] = []
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (near[r][c] && board[r][c] === 0) moves.push({ row: r, col: c })
    }
  }
  return moves
}

/**
 * color가 빈 칸 move에 두었을 때 만들어지는 연결 형태의 점수.
 * 네 방향의 점수를 합산한다. 판은 변경하지 않는다.
 */
export function scoreMove(board: Board, move: Move, color: Color): number {
  let total = 0
  for (const [dr, dc] of DIRECTIONS) {
    let length = 1

    let r = move.row + dr
    let c = move.col + dc
    while (isInside({ row: r, col: c }) && board[r][c] === color) {
      length++
      r += dr
      c += dc
    }
    let openEnds = isEmptyAt(board, r, c) ? 1 : 0

    r = move.row - dr
    c = move.col - dc
    while (isInside({ row: r, col: c }) && board[r][c] === color) {
      length++
      r -= dr
      c -= dc
    }
    if (isEmptyAt(board, r, c)) openEnds++

    total += patternScore(length, openEnds)
  }
  return total
}

/**
 * 평가 시점에 mover(이번에 둘 차례인 쪽)인지 여부를 반영한 연결 형태 점수.
 * 둘 차례인 쪽의 4목은 바로 5목을 완성하고, 둘 차례가 아닌 쪽의 열린 4는 막을 수 없다.
 */
function tempoScore(length: number, openEnds: number, mover: boolean): number {
  if (length >= 5) return 100000
  if (openEnds === 0) return 0
  if (length === 4) {
    if (mover) return 95000
    return openEnds === 2 ? 90000 : 1500
  }
  if (length === 3 && openEnds === 2) return mover ? 5000 : 500
  return patternScore(length, openEnds)
}

/**
 * color 관점의 판 전체 평가값: (내 연결 형태 점수 합) − (상대 연결 형태 점수 합).
 * color는 평가 관점이면서 이번에 둘 차례인 쪽이다. 열린 3이 둘 이상이거나
 * 4목과 열린 3이 함께 있는 포크 형태에는 보너스를 더한다.
 */
export function evaluateBoard(board: Board, color: Color): number {
  const totals = { 1: 0, 2: 0 }
  const openThrees = { 1: 0, 2: 0 }
  const fours = { 1: 0, 2: 0 }

  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const cell = board[row][col]
      if (cell === 0) continue
      for (const [dr, dc] of DIRECTIONS) {
        const pr = row - dr
        const pc = col - dc
        // 줄의 시작 돌에서만 한 번 센다
        if (isInside({ row: pr, col: pc }) && board[pr][pc] === cell) continue

        let length = 0
        let r = row
        let c = col
        while (isInside({ row: r, col: c }) && board[r][c] === cell) {
          length++
          r += dr
          c += dc
        }
        const openEnds = (isEmptyAt(board, pr, pc) ? 1 : 0) + (isEmptyAt(board, r, c) ? 1 : 0)
        totals[cell] += tempoScore(length, openEnds, cell === color)
        if (length === 3 && openEnds === 2) openThrees[cell]++
        if (length === 4 && openEnds >= 1) fours[cell]++
      }
    }
  }

  for (const c of [1, 2] as const) {
    if (openThrees[c] >= 2 || (fours[c] >= 1 && openThrees[c] >= 1)) {
      totals[c] += c === color ? 60000 : 55000
    }
  }
  return totals[color] - totals[color === 1 ? 2 : 1]
}
