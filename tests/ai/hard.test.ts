import { describe, expect, test } from 'vitest'
import { createHardAI } from '../../src/ai/hard'
import { cloneBoard, createBoard, placeStone } from '../../src/engine/board'
import type { Board } from '../../src/engine/types'

function boardWith(black: [number, number][], white: [number, number][] = []): Board {
  const b = createBoard()
  for (const [row, col] of black) placeStone(b, { row, col }, 1)
  for (const [row, col] of white) placeStone(b, { row, col }, 2)
  return b
}

const key = (m: { row: number; col: number }) => `${m.row},${m.col}`
const ai = () => createHardAI({ maxDepth: 3, timeLimitMs: 1000 })

describe('createHardAI', () => {
  test('빈 판에서는 중앙에 둔다', () => {
    expect(ai()(createBoard(), 1)).toEqual({ row: 7, col: 7 })
  })

  test('내 4목이 있으면 5목을 완성한다', () => {
    const b = boardWith([[7, 3], [7, 4], [7, 5], [7, 6]], [[0, 0], [0, 2], [0, 4]])
    expect(['7,2', '7,7']).toContain(key(ai()(b, 1)))
  })

  test('상대의 4목(한쪽 열림)은 막는다', () => {
    const b = boardWith([[7, 2]], [[7, 3], [7, 4], [7, 5], [7, 6]])
    expect(ai()(b, 1)).toEqual({ row: 7, col: 7 })
  })

  test('열린 3에서 열린 4를 만들어 승리를 굳힌다', () => {
    const b = boardWith([[7, 6], [7, 7], [7, 8]], [[3, 3], [11, 11], [3, 11]])
    expect(['7,5', '7,9']).toContain(key(ai()(b, 1)))
  })

  test('내 즉시 승리가 없고 상대가 열린 3이면 그 3을 막는다', () => {
    const b = boardWith([[0, 0]], [[7, 6], [7, 7], [7, 8]])
    expect(['7,4', '7,5', '7,9', '7,10']).toContain(key(ai()(b, 1)))
  })

  test('시간 제한을 지킨다 (timeLimitMs 100 → 약 300ms 안에 반환)', () => {
    const b = boardWith(
      [[7, 7], [8, 8], [6, 9], [9, 6], [7, 10]],
      [[7, 8], [8, 7], [6, 8], [9, 9], [5, 7]],
    )
    const start = Date.now()
    createHardAI({ maxDepth: 4, timeLimitMs: 100 })(b, 1)
    expect(Date.now() - start).toBeLessThan(300)
  })

  test('입력 판을 변경하지 않는다', () => {
    const b = boardWith([[7, 7], [8, 8]], [[7, 8], [8, 7]])
    const before = cloneBoard(b)
    ai()(b, 1)
    expect(b).toEqual(before)
  })

  test('반환한 칸은 항상 빈 칸이다', () => {
    const b = boardWith([[7, 7], [8, 8], [6, 6]], [[7, 8], [8, 7], [9, 9]])
    const m = ai()(b, 2)
    expect(b[m.row][m.col]).toBe(0)
  })
})
