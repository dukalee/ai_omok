import { describe, expect, test } from 'vitest'
import { candidateMoves, evaluateBoard, scoreMove } from '../../src/ai/evaluate'
import { cloneBoard, createBoard, placeStone } from '../../src/engine/board'
import type { Board, Color } from '../../src/engine/types'

function boardWith(black: [number, number][], white: [number, number][] = []): Board {
  const b = createBoard()
  for (const [row, col] of black) placeStone(b, { row, col }, 1)
  for (const [row, col] of white) placeStone(b, { row, col }, 2)
  return b
}

describe('candidateMoves', () => {
  test('빈 판이면 중앙 하나만 반환한다', () => {
    expect(candidateMoves(createBoard())).toEqual([{ row: 7, col: 7 }])
  })

  test('돌 하나(7,7)의 후보는 반경 2 안의 빈 칸 24개이다', () => {
    const moves = candidateMoves(boardWith([[7, 7]]))
    expect(moves).toHaveLength(24)
    expect(moves.some((m) => m.row === 7 && m.col === 7)).toBe(false)
    for (const m of moves) {
      expect(Math.abs(m.row - 7)).toBeLessThanOrEqual(2)
      expect(Math.abs(m.col - 7)).toBeLessThanOrEqual(2)
    }
  })

  test('모서리 돌의 후보는 판 밖 좌표를 포함하지 않는다', () => {
    const moves = candidateMoves(boardWith([[0, 0]]))
    expect(moves).toHaveLength(8)
    for (const m of moves) {
      expect(m.row).toBeGreaterThanOrEqual(0)
      expect(m.col).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('scoreMove', () => {
  const five = scoreMove(boardWith([[7, 3], [7, 4], [7, 5], [7, 6]]), { row: 7, col: 7 }, 1)
  const openFour = scoreMove(boardWith([[3, 3], [3, 4], [3, 5]]), { row: 3, col: 6 }, 1)
  const closedFour = scoreMove(boardWith([[3, 3], [3, 4], [3, 5]], [[3, 2]]), { row: 3, col: 6 }, 1)
  const openThree = scoreMove(boardWith([[5, 5], [5, 6]]), { row: 5, col: 7 }, 1)
  const closedThree = scoreMove(boardWith([[5, 5], [5, 6]], [[5, 4]]), { row: 5, col: 7 }, 1)
  const openTwo = scoreMove(boardWith([[5, 5]]), { row: 5, col: 6 }, 1)
  const isolated = scoreMove(boardWith([[0, 0]]), { row: 10, col: 10 }, 1)

  test('5목 완성 > 열린 4 > 막힌 4 > 열린 3 > 막힌 3 > 열린 2 > 연결 없음', () => {
    expect(five).toBeGreaterThan(openFour)
    expect(openFour).toBeGreaterThan(closedFour)
    expect(closedFour).toBeGreaterThan(openThree)
    expect(openThree).toBeGreaterThan(closedThree)
    expect(closedThree).toBeGreaterThan(openTwo)
    expect(openTwo).toBeGreaterThan(isolated)
  })

  test('판을 변경하지 않는다', () => {
    const b = boardWith([[5, 5], [5, 6]])
    const before = cloneBoard(b)
    scoreMove(b, { row: 5, col: 7 }, 1)
    expect(b).toEqual(before)
  })

  test('색에 따라 자신의 돌 기준으로 점수를 낸다', () => {
    const b = boardWith([[5, 5], [5, 6]], [[9, 9]])
    const asBlack = scoreMove(b, { row: 5, col: 7 }, 1)
    const asWhite = scoreMove(b, { row: 5, col: 7 }, 2 as Color)
    expect(asBlack).toBeGreaterThan(asWhite)
  })
})

describe('evaluateBoard', () => {
  test('흑 열린 3이 있으면 흑 관점은 양수, 백 관점은 음수이다', () => {
    const b = boardWith([[7, 6], [7, 7], [7, 8]])
    expect(evaluateBoard(b, 1)).toBeGreaterThan(0)
    expect(evaluateBoard(b, 2)).toBeLessThan(0)
  })

  test('빈 판은 0이다', () => {
    expect(evaluateBoard(createBoard(), 1)).toBe(0)
  })

  test('둘 차례인 쪽의 4목은 5목을 완성하므로 매우 크다', () => {
    const b = boardWith([[7, 3], [7, 4], [7, 5], [7, 6]])
    expect(evaluateBoard(b, 1)).toBeGreaterThan(50000)
  })

  test('둘 차례가 아닌 쪽의 열린 4는 막을 수 없으므로 매우 불리하다', () => {
    const b = boardWith([[7, 3], [7, 4], [7, 5], [7, 6]])
    expect(evaluateBoard(b, 2)).toBeLessThan(-50000)
  })

  test('둘 차례가 아닌 쪽의 막힌 4는 막을 수 있으므로 크지 않다', () => {
    const b = boardWith([[7, 3], [7, 4], [7, 5], [7, 6]], [[7, 2]])
    expect(evaluateBoard(b, 2)).toBeGreaterThan(-5000)
  })

  test('열린 3이 둘이면 하나일 때의 두 배보다 크다 (포크)', () => {
    const single = boardWith([[7, 6], [7, 7], [7, 8]])
    // (7,7)을 공유하는 가로 3목과 세로 3목
    const fork = boardWith([[7, 6], [7, 7], [7, 8], [6, 7], [8, 7]])
    expect(evaluateBoard(fork, 1)).toBeGreaterThan(2 * evaluateBoard(single, 1))
  })
})
