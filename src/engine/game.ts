import { createBoard, isBoardFull, isValidMove, placeStone } from './board'
import { getForbiddenReason } from './forbidden'
import type { ForbiddenReason } from './forbidden'
import { findWinningLine, opponent } from './rules'
import type { Board, Color, Move } from './types'

/** 흑백 결정용 코인 던지기. 반환값은 "앞면"에 해당하는 색(rng < 0.5이면 흑). */
export function tossCoin(rng: () => number = Math.random): Color {
  return rng() < 0.5 ? 1 : 2
}

/** 금수 이름 (화면 표시와 오류 메시지용) */
export const FORBIDDEN_LABEL: Record<ForbiddenReason, string> = {
  overline: '장목',
  'double-four': '사사',
  'double-three': '삼삼',
}

export type GameStatus =
  | { state: 'playing' }
  | { state: 'won'; winner: Color; line: Move[] | null; reason: 'five' | 'full' }

export class Game {
  board: Board = createBoard()
  toMove: Color = 1
  status: GameStatus = { state: 'playing' }
  history: { color: Color; move: Move }[] = []

  play(move: Move): void {
    if (this.status.state !== 'playing') {
      throw new Error('이미 끝난 게임입니다')
    }
    if (!isValidMove(this.board, move)) {
      throw new Error(`둘 수 없는 칸입니다: (${move.row}, ${move.col})`)
    }

    const color = this.toMove
    if (color === 1) {
      const reason = getForbiddenReason(this.board, move)
      if (reason) {
        throw new Error(
          `금수입니다 (${FORBIDDEN_LABEL[reason]}): (${move.row}, ${move.col})`,
        )
      }
    }
    placeStone(this.board, move, color)
    this.history.push({ color, move })

    const line = findWinningLine(this.board, move)
    if (line) {
      this.status = { state: 'won', winner: color, line, reason: 'five' }
    } else if (isBoardFull(this.board)) {
      this.status = { state: 'won', winner: 2, line: null, reason: 'full' }
    }
    this.toMove = opponent(color)
  }
}
