import { describe, expect, test } from 'vitest'
import { runGame } from '../../src/runner/runGame'
import { PlayerFailureError } from '../../src/runner/types'
import type { GameEvent, PlayerAdapter, PlayerChoice, PlayerState } from '../../src/runner/types'
import type { Move } from '../../src/engine/types'

const mv = (row: number, col: number): Move => ({ row, col })

/** 정해진 수를 차례로 반환하는 어댑터. 받은 상태를 seen에 기록한다. */
function scripted(name: string, moves: [number, number][], stdout?: string) {
  const seen: PlayerState[] = []
  let i = 0
  const adapter: PlayerAdapter = {
    name,
    async choose(state): Promise<PlayerChoice> {
      seen.push(state)
      const [row, col] = moves[i++]
      return { move: mv(row, col), stdout }
    },
  }
  return { adapter, seen }
}

const throwing = (name: string, error: Error): PlayerAdapter => ({
  name,
  async choose() {
    throw error
  },
})

const noSleep = async () => {}

async function run(black: PlayerAdapter, white: PlayerAdapter, extra: Partial<Parameters<typeof runGame>[0]> = {}) {
  const events: GameEvent[] = []
  const result = await runGame({ black, white, onEvent: (e) => events.push(e), sleep: noSleep, ...extra })
  return { events, result }
}

const FIVE_BLACK: [number, number][] = [[7, 3], [7, 4], [7, 5], [7, 6], [7, 7]]
const FILLER_WHITE: [number, number][] = [[8, 3], [8, 4], [8, 5], [8, 6]]

describe('runGame', () => {
  test('정상 진행: start, move×9, end(흑 5목 승리)', async () => {
    const { events, result } = await run(
      scripted('흑이', FIVE_BLACK).adapter,
      scripted('백이', FILLER_WHITE).adapter,
    )
    expect(events.map((e) => e.type)).toEqual([
      'start', ...Array(9).fill('move'), 'end',
    ])
    expect(events[0]).toEqual({ type: 'start', black: '흑이', white: '백이' })
    const end = events[events.length - 1]
    expect(end).toMatchObject({ type: 'end', winner: 1, reason: 'five' })
    if (end.type === 'end') expect(end.line).toHaveLength(5)
    expect(result).toEqual(end)
    const numbers = events.filter((e) => e.type === 'move').map((e) => (e.type === 'move' ? e.moveNumber : 0))
    expect(numbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
  })

  test('백이 받는 첫 상태: move_number 1, last_move는 흑의 첫 수, 내 돌은 1', async () => {
    const white = scripted('백', FILLER_WHITE)
    await run(scripted('흑', FIVE_BLACK).adapter, white.adapter)
    const first = white.seen[0]
    expect(first.my_color).toBe('white')
    expect(first.move_number).toBe(1)
    expect(first.last_move).toEqual([7, 3])
    expect(first.board[7][3]).toBe(2) // 상대(흑) 돌
  })

  test('move 이벤트에 stdout이 전달된다', async () => {
    const { events } = await run(
      scripted('흑', FIVE_BLACK, '디버그').adapter,
      scripted('백', FILLER_WHITE).adapter,
    )
    const first = events.find((e) => e.type === 'move')
    expect(first).toMatchObject({ stdout: '디버그' })
  })

  test.each([
    ['판 밖 (15, 3)', [15, 3], '판 밖'],
    ['판 밖 (-1, 0)', [-1, 0], '판 밖'],
  ] as [string, [number, number], string][])('%s → foul out-of-board', async (_, cell, text) => {
    const { events, result } = await run(
      scripted('흑', [cell]).adapter,
      scripted('백', [[0, 0]]).adapter,
    )
    expect(events.map((e) => e.type)).toEqual(['start', 'foul', 'end'])
    const foul = events[1]
    expect(foul).toMatchObject({ type: 'foul', color: 1, reason: 'out-of-board' })
    if (foul.type === 'foul') {
      expect(foul.message).toContain(text)
      expect(foul.message).toContain(`${cell[0]}, ${cell[1]}`)
    }
    expect(result).toMatchObject({ type: 'end', winner: 2, reason: 'foul', line: null })
  })

  test('반칙이 난 수에서 찍은 print 출력도 foul 이벤트에 담긴다 (판 밖/돌 있음/금수)', async () => {
    const outOfBoard = await run(scripted('흑', [[15, 3]], '디버그1').adapter, scripted('백', [[0, 0]]).adapter)
    expect(outOfBoard.events.find((e) => e.type === 'foul')).toMatchObject({ reason: 'out-of-board', stdout: '디버그1' })

    const occupied = await run(
      scripted('흑', [[7, 7], [3, 3]]).adapter,
      scripted('백', [[7, 7]], '디버그2').adapter,
    )
    expect(occupied.events.find((e) => e.type === 'foul')).toMatchObject({ reason: 'occupied', stdout: '디버그2' })

    const forbidden = await run(
      scripted('흑', [[7, 5], [7, 6], [5, 7], [6, 7], [7, 7]], '디버그3').adapter,
      scripted('백', [[0, 0], [0, 2], [0, 4], [0, 6]]).adapter,
    )
    expect(forbidden.events.find((e) => e.type === 'foul')).toMatchObject({ reason: 'forbidden', stdout: '디버그3' })
  })

  test('이미 돌이 있는 칸 → foul occupied', async () => {
    const { events } = await run(
      scripted('흑', [[7, 7], [3, 3]]).adapter,
      scripted('백', [[7, 7]]).adapter,
    )
    const foul = events.find((e) => e.type === 'foul')
    expect(foul).toMatchObject({ color: 2, reason: 'occupied' })
    expect(events[events.length - 1]).toMatchObject({ type: 'end', winner: 1, reason: 'foul' })
  })

  test('흑이 삼삼 자리에 두면 foul forbidden (메시지에 삼삼)', async () => {
    // 흑: (7,5)(7,6)(5,7)(6,7) 뒤 (7,7) → 삼삼
    const { events, result } = await run(
      scripted('흑', [[7, 5], [7, 6], [5, 7], [6, 7], [7, 7]]).adapter,
      scripted('백', [[0, 0], [0, 2], [0, 4], [0, 6]]).adapter,
    )
    const foul = events.find((e) => e.type === 'foul')
    expect(foul).toMatchObject({ color: 1, reason: 'forbidden' })
    if (foul?.type === 'foul') {
      expect(foul.message).toContain('삼삼')
      expect(foul.move).toEqual(mv(7, 7))
    }
    expect(result).toMatchObject({ winner: 2, reason: 'foul' })
  })

  test('백은 같은 모양의 자리에 둬도 반칙이 아니다', async () => {
    const { events } = await run(
      scripted('흑', [[0, 0], [0, 2], [0, 4], [0, 6], [14, 14]]).adapter,
      scripted('백', [[7, 5], [7, 6], [5, 7], [6, 7], [7, 7]]).adapter,
    )
    // (7,7)이 반칙 없이 놓인다. (그 뒤 흑의 스크립트가 끝나 대국이 끊기는 것은 이 테스트의 관심 밖이다)
    expect(events.some((e) => e.type === 'foul' && e.reason === 'forbidden')).toBe(false)
    expect(events.some((e) => e.type === 'move' && e.color === 2 && e.move.row === 7 && e.move.col === 7)).toBe(true)
  })

  test('예외 같은 PlayerFailureError는 그 플레이어의 반칙패이고 failure가 전달된다', async () => {
    const failure = { kind: 'exception' as const, message: 'ValueError: x' }
    const { events, result } = await run(
      throwing('흑', new PlayerFailureError(failure)),
      scripted('백', [[0, 0]]).adapter,
    )
    const foul = events.find((e) => e.type === 'foul')
    expect(foul).toMatchObject({ color: 1, reason: 'failure', message: failure.message, failure })
    expect(result).toMatchObject({ winner: 2, reason: 'foul' })
  })

  test('시간 초과는 그 플레이어의 반칙패이다 (대신 두지 않는다)', async () => {
    const failure = { kind: 'timeout' as const, message: 'play()가 2초 안에 끝나지 않았습니다.' }
    const { events, result } = await run(
      throwing('흑', new PlayerFailureError(failure)),
      scripted('백', [[0, 0]]).adapter,
    )
    expect(events.map((e) => e.type)).toEqual(['start', 'foul', 'end'])
    expect(events[1]).toMatchObject({ type: 'foul', color: 1, reason: 'failure', message: failure.message })
    expect(result).toMatchObject({ winner: 2, reason: 'foul' })
  })

  test('일반 Error는 kind internal로 바뀐다', async () => {
    const { events } = await run(
      scripted('흑', [[7, 7]]).adapter,
      throwing('백', new Error('boom')),
    )
    const foul = events.find((e) => e.type === 'foul')
    expect(foul).toMatchObject({ color: 2, reason: 'failure' })
    if (foul?.type === 'foul') expect(foul.failure?.kind).toBe('internal')
  })

  test('판이 가득 차면 백 승리 (reason full)', async () => {
    const blackCells: [number, number][] = []
    const whiteCells: [number, number][] = []
    for (let row = 0; row < 15; row++) {
      for (let col = 0; col < 15; col++) {
        ;(((col >> 1) + row) % 2 === 0 ? blackCells : whiteCells).push([row, col])
      }
    }
    const { result } = await run(scripted('흑', blackCells).adapter, scripted('백', whiteCells).adapter)
    expect(result).toMatchObject({ type: 'end', winner: 2, reason: 'full', line: null })
  })

  test('pauseMs가 주어지면 수마다 sleep(pauseMs)가 호출된다', async () => {
    const calls: number[] = []
    await run(
      scripted('흑', FIVE_BLACK).adapter,
      scripted('백', FILLER_WHITE).adapter,
      { pauseMs: 250, sleep: async (ms) => { calls.push(ms) } },
    )
    expect(calls.length).toBeGreaterThanOrEqual(8)
    expect(calls.every((ms) => ms === 250)).toBe(true)
  })

  test('pauseMs에 함수를 주면 수마다 새로 불러서 실행 중에도 대기 시간을 바꿀 수 있다', async () => {
    const waited: number[] = []
    let current = 100
    await run(scripted('흑', FIVE_BLACK).adapter, scripted('백', FILLER_WHITE).adapter, {
      pauseMs: () => current,
      sleep: async (ms) => {
        waited.push(ms)
        // 한 번 기다릴 때마다 다음 대기 시간을 줄인다 (사용자가 슬라이더를 올리는 상황)
        current = ms === 100 ? 50 : 10
      },
    })
    expect(waited.slice(0, 3)).toEqual([100, 50, 10])
  })

  test('중단: 첫 choose가 끝나는 순간 abort하면 null이고 이후 이벤트가 없다', async () => {
    const controller = new AbortController()
    const events: GameEvent[] = []
    const black: PlayerAdapter = {
      name: '흑',
      async choose() {
        controller.abort()
        return { move: mv(7, 7) }
      },
    }
    const result = await runGame({
      black,
      white: scripted('백', [[0, 0]]).adapter,
      onEvent: (e) => events.push(e),
      signal: controller.signal,
      sleep: noSleep,
    })
    expect(result).toBeNull()
    expect(events.map((e) => e.type)).toEqual(['start']) // move, foul, end 없음
  })

  test('시작 전에 이미 abort되어 있으면 아무 이벤트도 없이 null', async () => {
    const controller = new AbortController()
    controller.abort()
    const events: GameEvent[] = []
    const result = await runGame({
      black: scripted('흑', [[7, 7]]).adapter,
      white: scripted('백', [[0, 0]]).adapter,
      onEvent: (e) => events.push(e),
      signal: controller.signal,
      sleep: noSleep,
    })
    expect(result).toBeNull()
    expect(events).toEqual([])
  })

  test('sleep 도중 abort해도 그 뒤 이벤트가 나오지 않는다', async () => {
    const controller = new AbortController()
    const events: GameEvent[] = []
    const result = await runGame({
      black: scripted('흑', FIVE_BLACK).adapter,
      white: scripted('백', FILLER_WHITE).adapter,
      onEvent: (e) => events.push(e),
      signal: controller.signal,
      pauseMs: 10,
      sleep: async () => { controller.abort() },
    })
    expect(result).toBeNull()
    expect(events.map((e) => e.type)).toEqual(['start', 'move'])
  })
})
