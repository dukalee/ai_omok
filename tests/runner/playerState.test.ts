import { describe, expect, test } from 'vitest'
import { Game } from '../../src/engine/game'
import { buildPlayerState, toAbsoluteBoard } from '../../src/runner/playerState'

function play(game: Game, cells: [number, number][]): void {
  for (const [row, col] of cells) game.play({ row, col })
}

describe('buildPlayerState', () => {
  test('새 게임의 흑 상태', () => {
    const state = buildPlayerState(new Game(), 1)
    expect(state.my_color).toBe('black')
    expect(state.move_number).toBe(0)
    expect(state.last_move).toBeNull()
    expect(state.history).toEqual([])
    expect(state.board.every((row) => row.every((c) => c === 0))).toBe(true)
  })

  test('내 돌은 1, 상대 돌은 2로 바뀐다 (내 관점)', () => {
    const g = new Game()
    play(g, [[7, 7], [7, 8]])
    const asWhite = buildPlayerState(g, 2)
    expect(asWhite.my_color).toBe('white')
    expect(asWhite.board[7][7]).toBe(2) // 상대(흑)
    expect(asWhite.board[7][8]).toBe(1) // 내(백) 돌
    const asBlack = buildPlayerState(g, 1)
    expect(asBlack.board[7][7]).toBe(1)
    expect(asBlack.board[7][8]).toBe(2)
  })

  test('last_move는 상대의 마지막 수이고, move_number와 history가 맞다', () => {
    const g = new Game()
    g.play({ row: 7, col: 7 })
    const whiteTurn = buildPlayerState(g, 2)
    expect(whiteTurn.last_move).toEqual([7, 7])
    expect(whiteTurn.move_number).toBe(1)

    g.play({ row: 7, col: 8 })
    const blackTurn = buildPlayerState(g, 1)
    expect(blackTurn.last_move).toEqual([7, 8])
    expect(blackTurn.move_number).toBe(2)
    expect(blackTurn.history).toEqual([
      { color: 'black', move: [7, 7] },
      { color: 'white', move: [7, 8] },
    ])
  })

  test('state에는 문서에 적은 다섯 항목만 있다 (둘 수 있는 자리 목록은 주지 않는다)', () => {
    const state = buildPlayerState(new Game(), 1)
    expect(Object.keys(state).sort()).toEqual(['board', 'history', 'last_move', 'move_number', 'my_color'])
    expect(state).not.toHaveProperty('legal_moves')
  })

  test('상태를 바꿔도 실제 판에는 영향이 없고, 호출마다 새 복사본이다', () => {
    const g = new Game()
    g.play({ row: 7, col: 7 })
    const a = buildPlayerState(g, 2)
    a.board[0][0] = 9
    a.history.length = 0
    expect(g.board[0][0]).toBe(0)
    expect(g.history).toHaveLength(1)

    const b = buildPlayerState(g, 2)
    expect(b.board[0][0]).toBe(0)
    expect(b.history).toHaveLength(1)
    expect(b.board).not.toBe(a.board)
  })
})

describe('toAbsoluteBoard', () => {
  test('흑/백 관점 모두 원래 판으로 되돌린다', () => {
    const g = new Game()
    play(g, [[7, 7], [7, 8], [6, 6]])
    expect(toAbsoluteBoard(buildPlayerState(g, 1))).toEqual(g.board)
    expect(toAbsoluteBoard(buildPlayerState(g, 2))).toEqual(g.board)
  })
})
