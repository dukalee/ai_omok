import { isValidMove } from './board'
import { BOARD_SIZE } from './types'
import type { Board, Color, Move } from './types'

/** 흑의 금수 종류 */
export type ForbiddenReason = 'overline' | 'double-four' | 'double-three'

const DIRECTIONS: [number, number][] = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
]

/** 착수 지점에서 양쪽으로 읽는 칸 수 */
const REACH = 5
const CENTER = REACH
const WALL = 3
/** 삼삼 판정에서 "열린 사를 만드는 자리가 금수인가"를 따지는 재귀의 최대 깊이 */
const MAX_DEPTH = 3

type Line = number[] // 0: 빈 칸, 1: 흑, 2: 백, 3: 판 밖. 인덱스 CENTER가 착수 지점

function readLine(board: Board, move: Move, dr: number, dc: number): Line {
  const line: Line = []
  for (let k = -REACH; k <= REACH; k++) {
    const r = move.row + dr * k
    const c = move.col + dc * k
    const inside = r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE
    line.push(inside ? board[r][c] : WALL)
  }
  return line
}

/** index의 흑 돌을 포함하는 연속 구간 [시작, 끝] */
function runOf(line: Line, index: number): [number, number] {
  let start = index
  let end = index
  while (start > 0 && line[start - 1] === 1) start--
  while (end < line.length - 1 && line[end + 1] === 1) end++
  return [start, end]
}

function runLengthAtCenter(line: Line): number {
  const [s, e] = runOf(line, CENTER)
  return e - s + 1
}

/** 돌 하나만 더 놓으면 착수 지점을 포함한 정확히 다섯 개가 되는 빈 칸들 */
function completions(line: Line): Set<number> {
  const result = new Set<number>()
  for (let q = 0; q < line.length; q++) {
    if (line[q] !== 0) continue
    line[q] = 1
    const [s, e] = runOf(line, q)
    if (e - s + 1 === 5 && s <= CENTER && CENTER <= e) result.add(q)
    line[q] = 0
  }
  return result
}

/** 이 줄에서 만들어진 사의 수. 양쪽이 열린 연속 네 개(열린 사)는 하나로 센다. */
function fourCount(line: Line): number {
  const found = completions(line)
  if (found.size === 0) return 0
  const [s, e] = runOf(line, CENTER)
  if (e - s + 1 === 4 && found.has(s - 1) && found.has(e + 1)) return 1
  return found.size
}

/** 착수 지점을 포함한 연속 네 개이고 양쪽 끝에 정확히 다섯 개를 만들 자리가 모두 있는가 */
function isStraightFour(line: Line): boolean {
  const [s, e] = runOf(line, CENTER)
  if (e - s + 1 !== 4) return false
  const found = completions(line)
  return found.has(s - 1) && found.has(e + 1)
}

function forbiddenReasonAt(board: Board, move: Move, depth: number): ForbiddenReason | null {
  board[move.row][move.col] = 1
  try {
    const lines = DIRECTIONS.map(([dr, dc]) => ({ dr, dc, line: readLine(board, move, dr, dc) }))

    if (lines.some(({ line }) => runLengthAtCenter(line) >= 6)) return 'overline'
    if (lines.some(({ line }) => runLengthAtCenter(line) === 5)) return null

    const fours = lines.map(({ line }) => fourCount(line))
    if (fours.reduce((a, b) => a + b, 0) >= 2) return 'double-four'

    let threes = 0
    lines.forEach(({ dr, dc, line }, i) => {
      if (fours[i] > 0) return
      if (hasOpenThree(board, move, dr, dc, line, depth)) threes++
    })
    return threes >= 2 ? 'double-three' : null
  } finally {
    board[move.row][move.col] = 0
  }
}

/** 한 수를 더 두면 열린 사가 되는 자리 중 금수가 아닌 자리가 있으면 열린 삼이다. */
function hasOpenThree(
  board: Board,
  move: Move,
  dr: number,
  dc: number,
  line: Line,
  depth: number,
): boolean {
  for (let q = 0; q < line.length; q++) {
    if (line[q] !== 0) continue
    const next = line.slice()
    next[q] = 1
    if (!isStraightFour(next)) continue

    const qMove: Move = { row: move.row + dr * (q - CENTER), col: move.col + dc * (q - CENTER) }
    if (depth < MAX_DEPTH && forbiddenReasonAt(board, qMove, depth + 1) !== null) continue
    return true
  }
  return false
}

/**
 * 흑이 빈 칸 move에 둘 때 걸리는 금수. 금수가 아니면 null.
 * 이미 돌이 있거나 판 밖이면 null이다(착수 가능 여부는 isLegalMove로 판단한다).
 * 판을 일시적으로 바꾸지만 반환 전에 되돌린다.
 */
export function getForbiddenReason(board: Board, move: Move): ForbiddenReason | null {
  if (!isValidMove(board, move)) return null
  return forbiddenReasonAt(board, move, 0)
}

/** color가 move에 둘 수 있는가: 판 안의 빈 칸이고, 흑이면 금수가 아니어야 한다. */
export function isLegalMove(board: Board, move: Move, color: Color): boolean {
  if (!isValidMove(board, move)) return false
  return color === 2 || getForbiddenReason(board, move) === null
}
