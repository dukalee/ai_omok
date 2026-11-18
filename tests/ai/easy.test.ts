import { describe, expect, test } from 'vitest'
import { candidateMoves } from '../../src/ai/evaluate'
import { createEasyAI } from '../../src/ai/easy'
import { cloneBoard, createBoard, placeStone } from '../../src/engine/board'
import type { Board } from '../../src/engine/types'

function boardWith(black: [number, number][], white: [number, number][] = []): Board {
  const b = createBoard()
  for (const [row, col] of black) placeStone(b, { row, col }, 1)
  for (const [row, col] of white) placeStone(b, { row, col }, 2)
  return b
}

const fixed = (v: number) => () => v

describe('createEasyAI', () => {
  test('빈 판에서는 중앙에 둔다', () => {
    expect(createEasyAI()(createBoard(), 1)).toEqual({ row: 7, col: 7 })
  })

  test('내 4목(열린 4)이 있으면 5목을 완성한다', () => {
    const b = boardWith([[7, 3], [7, 4], [7, 5], [7, 6]], [[0, 0], [0, 2], [0, 4]])
    const move = createEasyAI(fixed(0.5))(b, 1)
    expect([`${move.row},${move.col}`]).toEqual(
      expect.arrayContaining([expect.stringMatching(/^7,(2|7)$/)]),
    )
  })

  test('상대의 4목이 한쪽만 열려 있으면 그 칸을 막는다', () => {
    const b = boardWith([[7, 2]], [[7, 3], [7, 4], [7, 5], [7, 6]])
    expect(createEasyAI(fixed(0.5))(b, 1)).toEqual({ row: 7, col: 7 })
  })

  test('내 5목 완성과 상대 5목 저지가 동시에 가능하면 내 5목 완성을 우선한다', () => {
    const b = boardWith(
      [[3, 3], [3, 4], [3, 5], [3, 6], [7, 2]],
      [[7, 3], [7, 4], [7, 5], [7, 6]],
    )
    const move = createEasyAI(fixed(0.5))(b, 1)
    expect(move.row).toBe(3)
    expect([2, 7]).toContain(move.col)
  })

  test('그 외에는 놓인 돌 주변의 빈 칸에 둔다', () => {
    const b = boardWith([[7, 7]], [[7, 8]])
    const candidates = candidateMoves(b)
    for (const v of [0, 0.25, 0.5, 0.75, 0.999]) {
      const move = createEasyAI(fixed(v))(b, 1)
      expect(candidates).toContainEqual(move)
      expect(b[move.row][move.col]).toBe(0)
    }
  })

  test('입력 판을 변경하지 않는다', () => {
    const b = boardWith([[7, 3], [7, 4], [7, 5], [7, 6]])
    const before = cloneBoard(b)
    createEasyAI()(b, 1)
    expect(b).toEqual(before)
  })
})
