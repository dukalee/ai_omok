import { describe, expect, test } from 'vitest'
import { createMediumAI } from '../../src/ai/medium'
import { createBoard, placeStone } from '../../src/engine/board'
import type { Board } from '../../src/engine/types'

function boardWith(black: [number, number][], white: [number, number][] = []): Board {
  const b = createBoard()
  for (const [row, col] of black) placeStone(b, { row, col }, 1)
  for (const [row, col] of white) placeStone(b, { row, col }, 2)
  return b
}

const fixed = (v: number) => () => v
const key = (m: { row: number; col: number }) => `${m.row},${m.col}`

describe('createMediumAI', () => {
  test('빈 판에서는 중앙에 둔다', () => {
    expect(createMediumAI()(createBoard(), 1)).toEqual({ row: 7, col: 7 })
  })

  test('내 열린 4가 있으면 5목을 완성한다', () => {
    const b = boardWith([[7, 3], [7, 4], [7, 5], [7, 6]], [[0, 0], [0, 2], [0, 4]])
    expect(['7,2', '7,7']).toContain(key(createMediumAI(fixed(0.5))(b, 1)))
  })

  test('상대의 열린 3은 양 끝 칸 중 하나로 막는다', () => {
    const b = boardWith([[0, 0]], [[7, 6], [7, 7], [7, 8]])
    expect(['7,5', '7,9']).toContain(key(createMediumAI(fixed(0.5))(b, 1)))
  })

  test('상대의 4목(한쪽만 열림)이 있으면 그 칸을 막는다', () => {
    const b = boardWith([[7, 2]], [[7, 3], [7, 4], [7, 5], [7, 6]])
    expect(createMediumAI(fixed(0.5))(b, 1)).toEqual({ row: 7, col: 7 })
  })

  test('내 5목 완성과 상대 5목 저지가 모두 가능하면 내 5목을 완성한다', () => {
    const b = boardWith(
      [[3, 3], [3, 4], [3, 5], [3, 6], [7, 2]],
      [[7, 3], [7, 4], [7, 5], [7, 6]],
    )
    const move = createMediumAI(fixed(0.5))(b, 1)
    expect(move.row).toBe(3)
    expect([2, 7]).toContain(move.col)
  })

  test('점수가 같은 후보가 여럿이면 rng에 따라 다른 칸을 고른다', () => {
    const b = boardWith([[7, 7]])
    const a = createMediumAI(fixed(0))(b, 2)
    const c = createMediumAI(fixed(0.999))(b, 2)
    expect(key(a)).not.toBe(key(c))
  })
})
