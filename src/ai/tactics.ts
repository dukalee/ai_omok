import { cloneBoard, isValidMove, placeStone, removeStone } from '../engine/board'
import { getForbiddenReason } from '../engine/forbidden'
import { findWinningLine } from '../engine/rules'
import { BOARD_SIZE } from '../engine/types'
import type { Board, Color, Move } from '../engine/types'
import { candidateMoves } from './evaluate'

/** color가 한 수로 승리할 수 있는 칸. 없으면 null. 입력 판은 변경하지 않는다. */
export function findWinningMove(board: Board, color: Color, moves: Move[]): Move | null {
  const work = cloneBoard(board)
  for (const move of moves) {
    if (!isValidMove(work, move)) continue
    placeStone(work, move, color)
    const wins = findWinningLine(work, move) !== null
    removeStone(work, move)
    if (wins) return move
  }
  return null
}

/** color가 둘 수 있는 칸인가: 흑이면 금수가 아니어야 한다. (칸이 비어 있다고 가정) */
export function isAllowedFor(board: Board, move: Move, color: Color): boolean {
  return color === 2 || getForbiddenReason(board, move) === null
}

/**
 * 후보 칸(기존 돌 주변) 중 color가 둘 수 있는 칸.
 * 후보가 모두 금수이면 판 전체의 빈 칸에서 찾는다. 둘 수 있는 칸이 없으면 빈 배열.
 */
export function legalCandidates(board: Board, color: Color): Move[] {
  const near = candidateMoves(board).filter((m) => isAllowedFor(board, m, color))
  if (near.length > 0) return near

  const all: Move[] = []
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      if (board[row][col] === 0 && isAllowedFor(board, { row, col }, color)) {
        all.push({ row, col })
      }
    }
  }
  return all
}
