import { describe, expect, test } from 'vitest'
import {
  cloneBoard,
  createBoard,
  isBoardFull,
  isValidMove,
  placeStone,
  removeStone,
} from '../../src/engine/board'
import { findWinningLine, opponent } from '../../src/engine/rules'
import type { Board, Color, Move } from '../../src/engine/types'

function put(board: Board, color: Color, cells: [number, number][]): void {
  for (const [row, col] of cells) placeStone(board, { row, col }, color)
}

const last = (row: number, col: number): Move => ({ row, col })

describe('findWinningLine', () => {
  test('가로 5목', () => {
    const b = createBoard()
    put(b, 1, [[7, 3], [7, 4], [7, 5], [7, 6], [7, 7]])
    expect(findWinningLine(b, last(7, 7))).toHaveLength(5)
  })

  test('세로 5목', () => {
    const b = createBoard()
    put(b, 2, [[3, 7], [4, 7], [5, 7], [6, 7], [7, 7]])
    expect(findWinningLine(b, last(7, 7))).toHaveLength(5)
  })

  test('\\ 대각선 5목', () => {
    const b = createBoard()
    put(b, 1, [[3, 3], [4, 4], [5, 5], [6, 6], [7, 7]])
    expect(findWinningLine(b, last(7, 7))).toHaveLength(5)
  })

  test('/ 대각선 5목', () => {
    const b = createBoard()
    put(b, 1, [[7, 3], [6, 4], [5, 5], [4, 6], [3, 7]])
    expect(findWinningLine(b, last(3, 7))).toHaveLength(5)
  })

  test('백은 6목도 승리이고 연속 구간 전체를 반환한다', () => {
    const b = createBoard()
    put(b, 2, [[7, 2], [7, 3], [7, 4], [7, 6], [7, 7], [7, 5]])
    const line = findWinningLine(b, last(7, 5))
    expect(line).toHaveLength(6)
  })

  test('흑은 6목(장목)이면 승리가 아니다', () => {
    const b = createBoard()
    put(b, 1, [[7, 2], [7, 3], [7, 4], [7, 6], [7, 7], [7, 5]])
    expect(findWinningLine(b, last(7, 5))).toBeNull()
  })

  test('흑이 한 방향은 6목, 다른 방향은 정확히 5목이면 5목 줄을 반환한다', () => {
    const b = createBoard()
    put(b, 1, [[7, 3], [7, 4], [7, 5], [7, 7], [7, 8], [3, 6], [4, 6], [5, 6], [6, 6], [7, 6]])
    const line = findWinningLine(b, last(7, 6))
    expect(line).toHaveLength(5)
    expect(line!.every((m) => m.col === 6)).toBe(true)
  })

  test('4목은 승리가 아니다', () => {
    const b = createBoard()
    put(b, 1, [[7, 3], [7, 4], [7, 5], [7, 6]])
    expect(findWinningLine(b, last(7, 6))).toBeNull()
  })

  test('중간에 상대 돌이 끼면 승리가 아니다', () => {
    const b = createBoard()
    put(b, 1, [[7, 3], [7, 4], [7, 6], [7, 7]])
    put(b, 2, [[7, 5]])
    expect(findWinningLine(b, last(7, 7))).toBeNull()
  })

  test('모서리 (0,0)~(0,4) 가로 5목', () => {
    const b = createBoard()
    put(b, 1, [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]])
    expect(findWinningLine(b, last(0, 0))).toHaveLength(5)
  })

  test('오른쪽 아래 모서리 대각선 5목', () => {
    const b = createBoard()
    put(b, 2, [[10, 10], [11, 11], [12, 12], [13, 13], [14, 14]])
    expect(findWinningLine(b, last(14, 14))).toHaveLength(5)
  })

  test('마지막 돌이 줄의 중간에 놓여 5목이 완성된다', () => {
    const b = createBoard()
    put(b, 1, [[7, 3], [7, 4], [7, 6], [7, 7], [7, 5]])
    expect(findWinningLine(b, last(7, 5))).toHaveLength(5)
  })

  test('반환한 좌표는 모두 같은 색 돌의 위치이다', () => {
    const b = createBoard()
    put(b, 1, [[7, 3], [7, 4], [7, 5], [7, 6], [7, 7]])
    const line = findWinningLine(b, last(7, 7))!
    for (const m of line) expect(b[m.row][m.col]).toBe(1)
  })
})

describe('board', () => {
  test('이미 돌이 있는 칸에 placeStone하면 Error', () => {
    const b = createBoard()
    placeStone(b, { row: 7, col: 7 }, 1)
    expect(() => placeStone(b, { row: 7, col: 7 }, 2)).toThrow()
    expect(isValidMove(b, { row: 7, col: 7 })).toBe(false)
  })

  test('판 밖에 placeStone하면 Error', () => {
    const b = createBoard()
    expect(() => placeStone(b, { row: -1, col: 0 }, 1)).toThrow()
    expect(() => placeStone(b, { row: 0, col: 15 }, 1)).toThrow()
    expect(isValidMove(b, { row: -1, col: 0 })).toBe(false)
    expect(isValidMove(b, { row: 0, col: 15 })).toBe(false)
  })

  test('빈 칸은 유효한 수이다', () => {
    expect(isValidMove(createBoard(), { row: 0, col: 0 })).toBe(true)
  })

  test('removeStone은 돌을 치운다', () => {
    const b = createBoard()
    placeStone(b, { row: 3, col: 3 }, 1)
    removeStone(b, { row: 3, col: 3 })
    expect(b[3][3]).toBe(0)
  })

  test('cloneBoard는 깊은 복사이다', () => {
    const b = createBoard()
    const c = cloneBoard(b)
    placeStone(c, { row: 1, col: 1 }, 1)
    expect(b[1][1]).toBe(0)
  })

  test('isBoardFull: 빈 판은 false, 가득 찬 판은 true', () => {
    expect(isBoardFull(createBoard())).toBe(false)
    const b = createBoard()
    for (let r = 0; r < 15; r++) for (let c = 0; c < 15; c++) b[r][c] = 1
    expect(isBoardFull(b)).toBe(true)
  })

  test('opponent는 색을 뒤집는다', () => {
    expect(opponent(1)).toBe(2)
    expect(opponent(2)).toBe(1)
  })
})
