import { cloneBoard, createBoard, isInside, placeStone } from '../engine/board'
import { getForbiddenReason } from '../engine/forbidden'
import { findWinningLine } from '../engine/rules'
import type { Board, Move } from '../engine/types'
import type { PlayerState } from '../runner/types'
import { ATTACK_LABEL, attackCells } from './attack'
import { DIRECTION_LABEL, colorOf } from './levels'
import type {
  BlockLevel,
  DecideLevel,
  FindWinLevel,
  LineDirection,
  LineLevel,
  OpenFourLevel,
  TutorialLevel,
  WinInTwoLevel,
} from './levels'

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

/** color가 한 수로 5목을 만들 수 있는 빈 칸 전부 */
export function winningCells(board: Board, color: 1 | 2): Move[] {
  const cells: Move[] = []
  for (let row = 0; row < board.length; row++) {
    for (let col = 0; col < board[row].length; col++) {
      if (board[row][col] !== 0) continue
      const after = cloneBoard(board)
      placeStone(after, { row, col }, color)
      if (findWinningLine(after, { row, col })) cells.push({ row, col })
    }
  }
  return cells
}

/** 상대(내 반대 색)가 한 수로 5목을 만들 수 있는 칸 전부 */
export function opponentWinningCells(board: Board, myColor: 'black' | 'white'): Move[] {
  return winningCells(board, colorOf(myColor) === 1 ? 2 : 1)
}

/** "열린 4 만들기" 레벨의 판정: 내 수를 둔 뒤 내가 한 수로 5목을 만들 칸이 둘 이상이면 통과 */
export function judgeOpenFour(level: OpenFourLevel, move: Move): Verdict {
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
  const wins = winningCells(after, colorOf(level.myColor))
  if (wins.length >= 2) {
    return {
      passed: true,
      message: `${where}에 두어 열린 4를 만들었습니다! 상대가 한쪽을 막아도 반대쪽에 두면 5목입니다.`,
      board: after,
      line: null,
      foulMove: null,
    }
  }
  const message =
    wins.length === 1
      ? `${where}에 두어 4개가 되었지만 한쪽만 열려 있어서 상대가 막을 수 있습니다. 양쪽이 모두 열린 4를 찾아보세요.`
      : `${where}에 두었지만 4개가 이어지지 않습니다. 다시 찾아보세요.`
  return { passed: false, message, board: after, line: null, foulMove: null }
}

/** "공격 막기" 레벨의 판정: 내 수를 둔 뒤 상대가 한 수로 이길 칸이 남지 않으면 통과 */
export function judgeBlock(level: BlockLevel, move: Move): Verdict {
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
  if (level.threat) {
    const theirs = colorOf(level.myColor) === 1 ? 2 : 1
    const left = attackCells(after, theirs)
    if (left.length === 0) {
      const name = ATTACK_LABEL[level.threat]
      return { passed: true, message: `${where}에 두어 상대의 ${name} 공격을 막았습니다!`, board: after, line: null, foulMove: null }
    }
    const first = left[0]
    return {
      passed: false,
      message: `${where}에 두었지만 상대가 (${first.move.row}, ${first.move.col})에 두면 ${ATTACK_LABEL[first.kind]} 모양이 됩니다. 다시 찾아보세요.`,
      board: after,
      line: null,
      foulMove: null,
    }
  }
  const left = opponentWinningCells(after, level.myColor)
  if (left.length === 0) {
    return { passed: true, message: `${where}에 두어 상대의 5목을 막았습니다!`, board: after, line: null, foulMove: null }
  }
  const at = `(${left[0].row}, ${left[0].col})`
  return {
    passed: false,
    message: `${where}에 두었지만 상대가 ${at}에 두면 5목이 됩니다. 다시 찾아보세요.`,
    board: after,
    line: null,
    foulMove: null,
  }
}

/**
 * "2수 안에 이기기" 레벨의 판정. 내 수를 둔 뒤 내가 한 수로 5목을 만들 칸이 둘 이상이고 상대에게는 먼저 이길 칸이
 * 없으면 통과한다. (상대가 한 칸을 막아도 다른 칸으로 이기므로 어떻게 막아도 다음 수에 이긴다)
 */
export function judgeWinInTwo(level: WinInTwoLevel, move: Move): Verdict {
  const board = buildLevelBoard(level)
  const where = `(${move.row}, ${move.col})`
  const mine = colorOf(level.myColor)
  const theirs = mine === 1 ? 2 : 1

  if (!isInside(move)) {
    return { passed: false, message: `${where}는 판 밖입니다.`, board, line: null, foulMove: move }
  }
  if (board[move.row][move.col] !== 0) {
    return { passed: false, message: `${where}에는 이미 돌이 있습니다.`, board, line: null, foulMove: move }
  }

  // 흑이면 금수 자리에는 둘 수 없다 (5목이 되는 수는 예외라서 getForbiddenReason이 알아서 거른다)
  if (mine === 1) {
    const reason = getForbiddenReason(board, move)
    if (reason) {
      const name = { overline: '장목', 'double-four': '4-4', 'double-three': '3-3' }[reason]
      return { passed: false, message: `${where}는 흑에게 ${name} 금수라서 둘 수 없습니다.`, board, line: null, foulMove: move }
    }
  }

  const after = cloneBoard(board)
  placeStone(after, move, mine)
  const fail = (message: string): Verdict => ({ passed: false, message, board: after, line: null, foulMove: null })

  const line = findWinningLine(after, move)
  if (line) return { passed: true, message: `${where}에 두어 바로 5목을 완성했습니다!`, board: after, line, foulMove: null }

  const danger = winningCells(after, theirs)
  if (danger.length > 0) {
    return fail(`${where}에 두었지만 상대가 (${danger[0].row}, ${danger[0].col})에 두면 먼저 5목이 됩니다.`)
  }
  const wins = winningCells(after, mine)
  if (wins.length >= 2) {
    return {
      passed: true,
      message: `${where}에 두어 5목 자리가 두 곳 생겼습니다! 상대가 한쪽을 막아도 반대쪽에 두면 이깁니다.`,
      board: after,
      line: null,
      foulMove: null,
    }
  }
  if (wins.length === 1) {
    return fail(`${where}에 두면 5목 자리가 (${wins[0].row}, ${wins[0].col}) 한 곳뿐이라 상대가 막을 수 있습니다. 5목 자리가 두 곳이 되는 칸을 찾아보세요.`)
  }
  return fail(`${where}에 두어도 다음 수에 5목이 되지 않습니다. 한 수 뒤에 5목 자리가 두 곳 생기는 칸을 찾아보세요.`)
}

/**
 * "막을까 공격할까" 레벨의 판정. 내가 한 수로 이길 수 있으면 그 수(5목)를 두어야 통과한다.
 * 이길 수 없으면 상대가 한 수로 5목을 만들 칸이 남지 않게 막아야 통과한다.
 */
export function judgeDecide(level: DecideLevel, move: Move): Verdict {
  const board = buildLevelBoard(level)
  const where = `(${move.row}, ${move.col})`
  const mine = colorOf(level.myColor)

  if (!isInside(move)) {
    return { passed: false, message: `${where}는 판 밖입니다.`, board, line: null, foulMove: move }
  }
  if (board[move.row][move.col] !== 0) {
    return { passed: false, message: `${where}에는 이미 돌이 있습니다.`, board, line: null, foulMove: move }
  }

  const after = cloneBoard(board)
  placeStone(after, move, mine)
  const fail = (message: string): Verdict => ({ passed: false, message, board: after, line: null, foulMove: null })

  const canWin = winningCells(board, mine).length > 0
  if (canWin) {
    const line = findWinningLine(after, move)
    if (line) return { passed: true, message: `${where}에 두어 5목을 완성했습니다! 이길 수 있을 때는 막지 않고 이깁니다.`, board: after, line, foulMove: null }
    return fail(`${where}에 두었지만 내가 한 수로 이길 수 있는 칸이 있었습니다. 상대를 막기 전에 내가 먼저 이길 수 있는지 살펴보세요.`)
  }

  const left = opponentWinningCells(after, level.myColor)
  if (left.length === 0) return { passed: true, message: `${where}에 두어 상대의 5목을 막았습니다!`, board: after, line: null, foulMove: null }
  return fail(`${where}에 두었지만 상대가 (${left[0].row}, ${left[0].col})에 두면 5목이 됩니다. 이길 수 없다면 상대의 5목을 먼저 막아야 합니다.`)
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
