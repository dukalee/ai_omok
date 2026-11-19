import { describe, expect, test } from 'vitest'
import type { Move } from '../../src/engine/types'
import { runGame } from '../../src/runner/runGame'
import type { GameEvent, PlayerAdapter } from '../../src/runner/types'
import { judgeLineResult } from '../../src/tutorial/judge'
import { LEVELS } from '../../src/tutorial/levels'
import type { LineDirection, LineLevel } from '../../src/tutorial/levels'
import { choosePassiveMove, createPassivePlayer } from '../../src/tutorial/passiveAi'
import { buildPlayerState } from '../../src/runner/playerState'
import { Game } from '../../src/engine/game'

const levelOf = (direction: LineDirection) =>
  LEVELS.find((l) => l.kind === 'make-line' && l.direction === direction) as LineLevel

/** 시작점에서 (dr, dc) 방향으로 한 칸씩 이어 두는 학습자 코드 */
const stepper = (start: [number, number], dr: number, dc: number): PlayerAdapter => {
  let n = 0
  return {
    name: 'Player',
    choose: async () => ({ move: { row: start[0] + dr * n, col: start[1] + dc * n++ } }),
  }
}

async function play(direction: LineDirection, player: PlayerAdapter, maxMoves = 10) {
  const level = levelOf(direction)
  const events: GameEvent[] = []
  let mine = 0
  const controller = new AbortController()
  await runGame({
    black: player,
    white: createPassivePlayer(direction),
    signal: controller.signal,
    onEvent: (e) => {
      events.push(e)
      if (e.type === 'move' && e.color === 1 && ++mine >= maxMoves) controller.abort()
    },
  })
  const end = events.find((e) => e.type === 'end')
  return { events, result: end && end.type === 'end' ? judgeLineResult(level, end) : null }
}

describe('방해하지 않는 상대', () => {
  test('목표 방향으로 내 돌이 들어 있는 5칸 구간에는 두지 않는다', () => {
    for (const [direction, dr, dc] of [
      ['horizontal', 0, 1],
      ['vertical', 1, 0],
    ] as const) {
      const game = new Game()
      const player = createPassivePlayer(direction)
      // 흑이 (7,7)부터 한 칸씩 이어 두는 동안 백이 둔 자리는 흑의 구간 밖이어야 한다
      for (let i = 0; i < 4; i++) {
        game.play({ row: 7 + dr * i, col: 7 + dc * i })
        const white = choosePassiveMove(buildPlayerState(game, 2), direction)
        const near = (m: Move) => {
          for (let k = -4; k <= 4; k++) if (m.row === 7 + dr * k && m.col === 7 + dc * k) return true
          return false
        }
        expect(near(white)).toBe(false)
        game.play(white)
      }
      expect(player.name).toBeTruthy()
    }
  })

  test('내 마지막 돌 바로 옆(1칸 거리)에 두되 내 줄은 피한다', () => {
    for (const direction of ['horizontal', 'vertical', 'diagonal'] as const) {
      const game = new Game()
      game.play({ row: 7, col: 7 })
      const m = choosePassiveMove(buildPlayerState(game, 2), direction)
      expect(Math.max(Math.abs(m.row - 7), Math.abs(m.col - 7))).toBe(1)
    }
    const game = new Game()
    game.play({ row: 7, col: 7 })
    const h = choosePassiveMove(buildPlayerState(game, 2), 'horizontal')
    expect(h.row).not.toBe(7)
  })

  test('대각선 레벨에서는 두 대각선 모두 피한다', () => {
    const game = new Game()
    game.play({ row: 7, col: 7 })
    const m = choosePassiveMove(buildPlayerState(game, 2), 'diagonal')
    const dr = m.row - 7
    const dc = m.col - 7
    const onDiagonal = dr === dc || dr === -dc
    expect(onDiagonal && Math.abs(dr) <= 4).toBe(false)
  })

  test('학습자가 가로로 이어 두면 방해받지 않고 가로 5개로 통과한다', async () => {
    const { result } = await play('horizontal', stepper([7, 3], 0, 1))
    expect(result?.passed).toBe(true)
  })

  test('세로로 이어 두면 세로 레벨을 통과한다', async () => {
    const { result } = await play('vertical', stepper([3, 7], 1, 0))
    expect(result?.passed).toBe(true)
  })

  test('대각선(\\, /)으로 이어 두면 대각선 레벨을 통과한다', async () => {
    expect((await play('diagonal', stepper([3, 3], 1, 1))).result?.passed).toBe(true)
    expect((await play('diagonal', stepper([3, 11], 1, -1))).result?.passed).toBe(true)
  })

  test('다른 방향으로 5개를 만들면 통과하지 못한다', async () => {
    const { result } = await play('horizontal', stepper([3, 7], 1, 0))
    expect(result?.passed).toBe(false)
  })

  test('10수 안에 5개를 못 만들면 end 없이 끝난다', async () => {
    let n = 0
    // 한 칸씩 띄워 두어(0행 짝수 열, 2행 짝수 열) 5개가 이어지지 않는다
    const scattered: PlayerAdapter = {
      name: 'Player',
      choose: async () => {
        const i = n++
        return { move: { row: i < 8 ? 0 : 2, col: (i % 8) * 2 } }
      },
    }
    const { events, result } = await play('horizontal', scattered)
    expect(result).toBeNull()
    expect(events.filter((e) => e.type === 'move' && e.color === 1)).toHaveLength(10)
  })

  test('어떤 상황에서도 반칙하지 않는다: 무작위 학습자 상대로 여러 판', async () => {
    // 간단한 난수(재현 가능). 학습자는 항상 합법적인 빈 칸을 무작위로 두고, 상대(백)의 반칙 여부를 본다
    let seed = 12345
    const rand = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296
    for (const direction of ['horizontal', 'vertical', 'diagonal'] as const) {
      for (let g = 0; g < 40; g++) {
        const random: PlayerAdapter = {
          name: 'Player',
          choose: async (state) => {
            const empty: Move[] = []
            state.board.forEach((row, r) => row.forEach((v, c) => v === 0 && empty.push({ row: r, col: c })))
            return { move: empty[Math.floor(rand() * empty.length)] }
          },
        }
        const events: GameEvent[] = []
        await runGame({
          black: random,
          white: createPassivePlayer(direction),
          sleep: async () => {},
          onEvent: (e) => events.push(e),
        })
        const whiteFoul = events.some((e) => e.type === 'foul' && e.color === 2)
        expect(whiteFoul).toBe(false)
      }
    }
  }, 60_000)

  test('빈 칸이 하나뿐이어도 그 칸을 고른다 (4개가 이어지는 칸, 내 줄 위의 칸이어도)', () => {
    // 한 칸(7,7)만 빼고 흑백 번갈아 채운 판. 백(AI) 관점: 1 내 돌, 2 상대 돌
    const board = Array.from({ length: 15 }, (_, r) =>
      Array.from({ length: 15 }, (_, c) => ((r + c + Math.floor(r / 2)) % 3 === 0 ? 1 : 2)),
    )
    board[7][7] = 0
    const state = {
      board,
      my_color: 'white' as const,
      move_number: 224,
      last_move: [7, 6] as [number, number],
      my_last_move: null,
      history: [],
    }
    for (const direction of ['horizontal', 'vertical', 'diagonal'] as const) {
      expect(choosePassiveMove(state, direction)).toEqual({ row: 7, col: 7 })
    }
  })
})
