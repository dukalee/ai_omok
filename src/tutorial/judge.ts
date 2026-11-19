import { cloneBoard, createBoard, isInside, placeStone } from '../engine/board'
import { findWinningLine } from '../engine/rules'
import type { Board, Move } from '../engine/types'
import type { PlayerState } from '../runner/types'
import { DIRECTION_LABEL, colorOf } from './levels'
import type { FindWinLevel, LineDirection, LineLevel, TutorialLevel } from './levels'

function boardOf(stones: { row: number; col: number; color: 'black' | 'white' }[]): Board {
  const board = createBoard()
  for (const s of stones) placeStone(board, { row: s.row, col: s.col }, colorOf(s.color))
  return board
}

/** 레벨의 시작 판 (절대 색: 1 흑, 2 백) */
export function buildLevelBoard(level: TutorialLevel): Board {
  return boardOf(level.stones)
}

/** 레벨 목록 카드에 보여 줄 판 */
export function buildPreviewBoard(level: TutorialLevel): Board {
  return boardOf(level.preview ?? level.stones)
}

/** 학습자 코드에 넘길 state. 연습 모드와 같은 모양이다(내 관점의 판). */
export function buildLevelState(level: TutorialLevel): PlayerState {
  const mine = colorOf(level.myColor)
  const board = buildLevelBoard(level).map((row) => row.map((c) => (c === 0 ? 0 : c === mine ? 1 : 2)))
  return {
    board,
    my_color: level.myColor,
    move_number: level.stones.length,
    last_move: level.lastMove,
    my_last_move: null,
    history: [],
  }
}

export interface Verdict {
  passed: boolean
  message: string
  /** 수를 반영한 판. 둘 수 없는 칸이면 시작 판 그대로 */
  board: Board
  /** 5목 줄 (통과했을 때) */
  line: Move[] | null
  /** 둘 수 없는 칸을 골랐을 때 붉은 ×로 표시할 자리 */
  foulMove: Move | null
}

/** "한 수로 이기기" 레벨의 판정 */
export function judgeMove(level: FindWinLevel, move: Move): Verdict {
  const board = buildLevelBoard(level)
  const where = `(${move.row}, ${move.col})`

  if (!isInside(move)) {
    return { passed: false, message: `${where}는 판 밖입니다.`, board, line: null, foulMove: move }
  }
  if (board[move.row][move.col] !== 0) {
    return { passed: false, message: `${where}에는 이미 돌이 있습니다.`, board, line: null, foulMove: move }
  }

  const after = cloneBoard(board)
  placeStone(after, move, colorOf(level.myColor))
  const line = findWinningLine(after, move)
  if (line) {
    return { passed: true, message: `${where}에 두어 5목을 완성했습니다!`, board: after, line, foulMove: null }
  }
  return {
    passed: false,
    message: `${where}에 두었지만 5목이 완성되지 않습니다. 다시 찾아보세요.`,
    board: after,
    line: null,
    foulMove: null,
  }
}

/** 5목 줄이 가로, 세로, 대각선 중 어느 방향인지 */
export function lineDirection(line: Move[]): LineDirection {
  const dr = line[1].row - line[0].row
  const dc = line[1].col - line[0].col
  if (dr === 0) return 'horizontal'
  if (dc === 0) return 'vertical'
  return 'diagonal'
}

export interface LineResult {
  passed: boolean
  message: string
}

/** "정해진 방향으로 5개 두기" 레벨의 판정. 대국이 끝난 결과(end 이벤트)를 받는다. */
export function judgeLineResult(
  level: LineLevel,
  end: { winner: 1 | 2; reason: 'five' | 'full' | 'foul'; line: Move[] | null },
): LineResult {
  const goal = DIRECTION_LABEL[level.direction]
  if (end.reason !== 'five' || end.winner !== colorOf(level.myColor) || !end.line) {
    return { passed: false, message: `${goal} 5개를 만들지 못하고 대국이 끝났습니다. 로그의 반칙 내용을 확인하세요.` }
  }
  const got = lineDirection(end.line)
  if (got !== level.direction) {
    return {
      passed: false,
      message: `${DIRECTION_LABEL[got]} 방향으로 5개가 만들어졌습니다. 이 레벨의 목표는 ${goal} 5개입니다.`,
    }
  }
  return { passed: true, message: `${goal} 방향으로 연속 5개를 만들었습니다!` }
}
