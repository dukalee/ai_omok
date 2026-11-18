import { describe, expect, test } from 'vitest'
import type { AI } from '../../src/ai/types'
import { Game } from '../../src/engine/game'
import { createAiPlayer, createSyncAiPlayer, createWorkerAiPlayer } from '../../src/runner/aiPlayer'
import type { WorkerLike } from '../../src/runner/aiPlayer'
import { buildPlayerState } from '../../src/runner/playerState'
import { PlayerFailureError } from '../../src/runner/types'

class FakeWorker implements WorkerLike {
  onmessage: ((event: { data: unknown }) => void) | null = null
  onerror: ((event: unknown) => void) | null = null
  posted: unknown[] = []
  terminated = false
  postMessage(message: unknown) {
    this.posted.push(message)
  }
  terminate() {
    this.terminated = true
  }
  respond(data: unknown) {
    this.onmessage?.({ data })
  }
}

describe('createSyncAiPlayer', () => {
  test('AI에는 절대 색의 판과 색이 넘어간다 (백 관점이면 color 2)', async () => {
    const g = new Game()
    g.play({ row: 7, col: 7 }) // 흑
    const state = buildPlayerState(g, 2) // 백 관점: 흑 돌이 2로 보인다
    let received: { board: number[][]; color: number } | null = null
    const ai: AI = (board, color) => {
      received = { board, color }
      return { row: 0, col: 0 }
    }
    const choice = await createSyncAiPlayer('t', ai).choose(state)
    expect(choice.move).toEqual({ row: 0, col: 0 })
    expect(received!.color).toBe(2)
    expect(received!.board[7][7]).toBe(1) // 절대 색: 흑
  })

  test('name이 그대로 노출된다', () => {
    expect(createSyncAiPlayer('내 이름', () => ({ row: 0, col: 0 })).name).toBe('내 이름')
  })
})

describe('createAiPlayer', () => {
  test('하/중/상 이름', () => {
    expect(createAiPlayer('easy').name).toBe('AI 하')
    expect(createAiPlayer('medium').name).toBe('AI 중')
    expect(createAiPlayer('hard').name).toBe('AI 상')
  })

  test.each(['easy', 'medium', 'hard'] as const)('%s: 빈 판에서는 중앙에 둔다', async (level) => {
    const state = buildPlayerState(new Game(), 1)
    const choice = await createAiPlayer(level).choose(state)
    expect(choice.move).toEqual({ row: 7, col: 7 })
  })
})

describe('createWorkerAiPlayer', () => {
  test('Worker에 절대 판/색을 보내고 응답 Move를 돌려준다', async () => {
    const worker = new FakeWorker()
    const player = createWorkerAiPlayer('AI 상', () => worker)
    const g = new Game()
    g.play({ row: 7, col: 7 })
    const pending = player.choose(buildPlayerState(g, 2))
    expect(worker.posted).toHaveLength(1)
    const sent = worker.posted[0] as { board: number[][]; color: number }
    expect(sent.color).toBe(2)
    expect(sent.board[7][7]).toBe(1)
    worker.respond({ row: 3, col: 4 })
    expect(await pending).toEqual({ move: { row: 3, col: 4 } })
  })

  test('dispose하면 Worker를 terminate한다', async () => {
    const worker = new FakeWorker()
    const player = createWorkerAiPlayer('AI 상', () => worker)
    const pending = player.choose(buildPlayerState(new Game(), 1))
    worker.respond({ row: 7, col: 7 })
    await pending
    player.dispose()
    expect(worker.terminated).toBe(true)
  })

  test('Worker 오류는 PlayerFailureError(internal)로 reject된다', async () => {
    const worker = new FakeWorker()
    const player = createWorkerAiPlayer('AI 상', () => worker)
    const pending = player.choose(buildPlayerState(new Game(), 1))
    worker.onerror?.(new Error('x'))
    await expect(pending).rejects.toBeInstanceOf(PlayerFailureError)
    await expect(pending).rejects.toMatchObject({ failure: { kind: 'internal' } })
  })

  test('아직 choose하지 않았으면 dispose해도 Worker를 만들지 않는다', () => {
    let created = 0
    const player = createWorkerAiPlayer('AI 상', () => {
      created++
      return new FakeWorker()
    })
    player.dispose()
    expect(created).toBe(0)
  })
})
