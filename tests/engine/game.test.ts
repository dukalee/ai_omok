import { describe, expect, test } from 'vitest'
import { Game, tossCoin } from '../../src/engine/game'
import type { Move } from '../../src/engine/types'

function play(game: Game, cells: [number, number][]): void {
  for (const [row, col] of cells) game.play({ row, col })
}

describe('tossCoin', () => {
  test('rng < 0.5이면 흑(1), 아니면 백(2)', () => {
    expect(tossCoin(() => 0.1)).toBe(1)
    expect(tossCoin(() => 0.9)).toBe(2)
  })
})

describe('Game', () => {
  test('새 게임은 흑 차례이고 진행 중이며 기록이 비어 있다', () => {
    const g = new Game()
    expect(g.toMove).toBe(1)
    expect(g.status.state).toBe('playing')
    expect(g.history).toHaveLength(0)
  })

  test('두 수를 두면 기록에 흑, 백 순서로 남는다', () => {
    const g = new Game()
    play(g, [[7, 7], [7, 8]])
    expect(g.history.map((h) => h.color)).toEqual([1, 2])
    expect(g.history[1].move).toEqual({ row: 7, col: 8 })
    expect(g.toMove).toBe(1)
  })

  test('흑이 다섯 개를 이으면 흑이 이기고 이긴 줄을 반환한다', () => {
    const g = new Game()
    // 흑: (7,3)~(7,7), 백: (8,3)~(8,6)
    play(g, [[7, 3], [8, 3], [7, 4], [8, 4], [7, 5], [8, 5], [7, 6], [8, 6], [7, 7]])
    expect(g.status.state).toBe('won')
    if (g.status.state === 'won') {
      expect(g.status.winner).toBe(1)
      expect(g.status.reason).toBe('five')
      expect(g.status.line).toHaveLength(5)
    }
  })

  test('게임이 끝난 뒤에 play하면 Error', () => {
    const g = new Game()
    play(g, [[7, 3], [8, 3], [7, 4], [8, 4], [7, 5], [8, 5], [7, 6], [8, 6], [7, 7]])
    expect(() => g.play({ row: 0, col: 0 })).toThrow()
  })

  test('흑이 금수 자리에 play하면 Error이고 차례와 판은 바뀌지 않는다', () => {
    const g = new Game()
    // 흑: (7,5)(7,6)(5,7)(6,7), 백은 멀리 둔다 → 흑이 (7,7)에 두면 삼삼
    play(g, [[7, 5], [0, 0], [7, 6], [0, 2], [5, 7], [0, 4], [6, 7], [0, 6]])
    expect(g.toMove).toBe(1)
    expect(() => g.play({ row: 7, col: 7 })).toThrow(/삼삼/)
    expect(g.toMove).toBe(1)
    expect(g.board[7][7]).toBe(0)
    expect(g.history).toHaveLength(8)
  })

  test('백은 같은 모양의 자리에 둘 수 있다', () => {
    const g = new Game()
    // 백: (7,5)(7,6)(5,7)(6,7). 흑은 멀리 둔다
    play(g, [[0, 0], [7, 5], [0, 2], [7, 6], [0, 4], [5, 7], [0, 6], [6, 7], [14, 14]])
    expect(() => g.play({ row: 7, col: 7 })).not.toThrow()
  })

  test('흑이 정확히 다섯 개를 이루는 수는 삼삼 모양이어도 둘 수 있고 승리한다', () => {
    const g = new Game()
    // 흑: 가로 (7,3)~(7,6) 네 개 + 세로 (5,7),(6,7) → (7,7)은 가로 5목
    play(g, [[7, 3], [0, 0], [7, 4], [0, 2], [7, 5], [0, 4], [7, 6], [0, 6], [5, 7], [0, 8], [6, 7], [0, 10]])
    g.play({ row: 7, col: 7 })
    expect(g.status.state).toBe('won')
  })

  test('이미 돌이 있는 칸에 play하면 Error이고 차례는 바뀌지 않는다', () => {
    const g = new Game()
    g.play({ row: 7, col: 7 })
    expect(() => g.play({ row: 7, col: 7 })).toThrow()
    expect(g.toMove).toBe(2)
    expect(g.history).toHaveLength(1)
  })

  test('판이 가득 차도 5목이 없으면 백이 승리한다 (225수)', () => {
    // 색 = ((col >> 1) + row) % 2 패턴은 어느 방향으로도 같은 색이 3개 이상 이어지지 않는다.
    // 값 0인 칸이 113개(흑), 값 1인 칸이 112개(백)이다.
    const blackCells: Move[] = []
    const whiteCells: Move[] = []
    for (let row = 0; row < 15; row++) {
      for (let col = 0; col < 15; col++) {
        ;(((col >> 1) + row) % 2 === 0 ? blackCells : whiteCells).push({ row, col })
      }
    }
    expect(blackCells).toHaveLength(113)
    expect(whiteCells).toHaveLength(112)

    const g = new Game()
    for (let i = 0; i < 225; i++) {
      const cell = i % 2 === 0 ? blackCells[i / 2] : whiteCells[(i - 1) / 2]
      expect(g.status.state).toBe('playing')
      g.play(cell)
    }
    expect(g.status).toEqual({ state: 'won', winner: 2, reason: 'full', line: null })
  })
})
