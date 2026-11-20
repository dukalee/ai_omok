import { cloneBoard, isInside } from '../engine/board'
import { BOARD_SIZE } from '../engine/types'
import type { Board, Color, Move } from '../engine/types'

/**
 * 어느 색이든 쓸 수 있는 공격 모양 분석. 흑 금수 판정(`engine/forbidden.ts`)은 흑 전용이라,
 * 튜토리얼에서 상대(백)가 한 수로 만드는 3-3, 4-4, 4-3을 찾기 위해 따로 둔다.
 * 백은 5개 이상이면 이기므로 6개 이상도 5목으로 센다.
 */
export type AttackKind = 'three-three' | 'four-four' | 'four-three'

export const ATTACK_LABEL: Record<AttackKind, string> = {
  'three-three': '3-3',
  'four-four': '4-4',
  'four-three': '4-3',
}

const DIRECTIONS: [number, number][] = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
]
const REACH = 5
const CENTER = REACH

/** 'o': 공격하는 색의 돌, 'e': 빈 칸, 'x': 상대 돌 또는 판 밖 */
type Cell = 'o' | 'e' | 'x'
type Line = Cell[]

function readLine(board: Board, move: Move, dr: number, dc: number, color: Color): Line {
  const line: Line = []
  for (let k = -REACH; k <= REACH; k++) {
    const at = { row: move.row + dr * k, col: move.col + dc * k }
    if (!isInside(at)) line.push('x')
    else {
      const c = board[at.row][at.col]
      line.push(c === 0 ? 'e' : c === color ? 'o' : 'x')
    }
  }
  return line
}

function runOf(line: Line, index: number): [number, number] {
  let s = index
  let e = index
  while (s > 0 && line[s - 1] === 'o') s--
  while (e < line.length - 1 && line[e + 1] === 'o') e++
  return [s, e]
}

/** 돌 하나를 더 놓으면 가운데 돌을 포함한 5개 이상이 되는 빈 칸들 */
function completions(line: Line): Set<number> {
  const found = new Set<number>()
  for (let q = 0; q < line.length; q++) {
    if (line[q] !== 'e') continue
    const next = line.slice()
    next[q] = 'o'
    const [s, e] = runOf(next, q)
    if (e - s + 1 >= 5 && s <= CENTER && CENTER <= e) found.add(q)
  }
  return found
}

/** 이 줄에서 만들어진 사의 수 (양쪽이 열린 연속 네 개는 하나) */
function fourCount(line: Line): number {
  const found = completions(line)
  if (found.size === 0) return 0
  const [s, e] = runOf(line, CENTER)
  if (e - s + 1 === 4 && found.has(s - 1) && found.has(e + 1)) return 1
  return found.size
}

/** 가운데 돌을 포함한, 양쪽이 빈 칸인 연속 네 개 */
function isOpenFour(line: Line): boolean {
  const [s, e] = runOf(line, CENTER)
  return e - s + 1 === 4 && s > 0 && e < line.length - 1 && line[s - 1] === 'e' && line[e + 1] === 'e'
}

/** 한 수를 더 두면 열린 사가 되는 자리가 있으면 열린 삼이다 */
function hasOpenThree(line: Line): boolean {
  for (let q = 0; q < line.length; q++) {
    if (line[q] !== 'e') continue
    const next = line.slice()
    next[q] = 'o'
    if (isOpenFour(next)) return true
  }
  return false
}

/** color가 빈 칸 move에 두면 만들어지는 공격 모양. 아니면 null (바로 5목이 되는 수도 null) */
export function attackKindAt(board: Board, move: Move, color: Color): AttackKind | null {
  if (!isInside(move) || board[move.row][move.col] !== 0) return null
  const after = cloneBoard(board)
  after[move.row][move.col] = color

  const lines = DIRECTIONS.map(([dr, dc]) => readLine(after, move, dr, dc, color))
  const five = lines.some((line) => {
    const [s, e] = runOf(line, CENTER)
    return e - s + 1 >= 5
  })
  if (five) return null

  const fours = lines.map(fourCount)
  const fourTotal = fours.reduce((a, b) => a + b, 0)
  const threes = lines.filter((line, i) => fours[i] === 0 && hasOpenThree(line)).length

  if (fourTotal >= 2) return 'four-four'
  if (fourTotal >= 1 && threes >= 1) return 'four-three'
  if (threes >= 2) return 'three-three'
  return null
}

/** color가 한 수로 3-3, 4-4, 4-3을 만들 수 있는 빈 칸 전부 */
export function attackCells(board: Board, color: Color): { move: Move; kind: AttackKind }[] {
  const cells: { move: Move; kind: AttackKind }[] = []
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const kind = attackKindAt(board, { row, col }, color)
      if (kind) cells.push({ move: { row, col }, kind })
    }
  }
  return cells
}
