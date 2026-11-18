import { describe, expect, test } from 'vitest'
import { createEasyAI } from '../../src/ai/easy'
import { createHardAI } from '../../src/ai/hard'
import { createMediumAI } from '../../src/ai/medium'
import { cloneBoard, createBoard, placeStone } from '../../src/engine/board'
import { getForbiddenReason } from '../../src/engine/forbidden'
import type { Board } from '../../src/engine/types'

// 흑이 (7,7)에 두면 삼삼(금수)이 되는 판. 흑에게 (7,7)은 가장 매력적인 자리이다.
function threeThreeBoard(): Board {
  const b = createBoard()
  for (const [row, col] of [[7, 5], [7, 6], [5, 7], [6, 7]]) placeStone(b, { row, col }, 1)
  for (const [row, col] of [[0, 0], [0, 2], [0, 4], [0, 6]]) placeStone(b, { row, col }, 2)
  return b
}

describe('흑 AI는 금수 자리에 두지 않는다', () => {
  test('전제: (7,7)은 흑에게 삼삼이다', () => {
    expect(getForbiddenReason(threeThreeBoard(), { row: 7, col: 7 })).toBe('double-three')
  })

  test('하: 어떤 rng 값이어도 금수를 고르지 않는다', () => {
    const b = threeThreeBoard()
    for (let i = 0; i < 100; i++) {
      const move = createEasyAI(() => i / 100)(b, 1)
      expect(getForbiddenReason(b, move)).toBeNull()
      expect(b[move.row][move.col]).toBe(0)
    }
  })

  test('중: 가장 높은 점수의 자리가 금수여도 고르지 않는다', () => {
    const b = threeThreeBoard()
    for (const v of [0, 0.5, 0.99]) {
      const move = createMediumAI(() => v)(b, 1)
      expect(getForbiddenReason(b, move)).toBeNull()
      expect(move).not.toEqual({ row: 7, col: 7 })
    }
  })

  test('상: 금수 자리를 고르지 않는다', () => {
    const b = threeThreeBoard()
    const move = createHardAI({ maxDepth: 3, timeLimitMs: 1000 })(b, 1)
    expect(getForbiddenReason(b, move)).toBeNull()
    expect(move).not.toEqual({ row: 7, col: 7 })
  })

  test('백 AI는 같은 자리에 둘 수 있다 (금수는 흑에게만 적용)', () => {
    // 색을 뒤집은 판: 백이 (7,7)에 두면 삼삼 모양이지만 허용된다
    const b = createBoard()
    for (const [row, col] of [[7, 5], [7, 6], [5, 7], [6, 7]]) placeStone(b, { row, col }, 2)
    for (const [row, col] of [[0, 0], [0, 2], [0, 4], [0, 6]]) placeStone(b, { row, col }, 1)
    const picks = new Set<string>()
    for (let i = 0; i < 100; i++) {
      const m = createEasyAI(() => i / 100)(b, 2)
      picks.add(`${m.row},${m.col}`)
    }
    expect(picks.has('7,7')).toBe(true)
  })

  test('AI는 입력 판을 변경하지 않는다', () => {
    const b = threeThreeBoard()
    const before = cloneBoard(b)
    createMediumAI()(b, 1)
    createHardAI({ maxDepth: 3, timeLimitMs: 500 })(b, 1)
    expect(b).toEqual(before)
  })
})
