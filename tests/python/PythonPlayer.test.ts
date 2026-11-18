import { describe, expect, test } from 'vitest'
import { Game } from '../../src/engine/game'
import { PythonPlayer } from '../../src/python/PythonPlayer'
import type { WorkerLike } from '../../src/runner/aiPlayer'
import { buildPlayerState } from '../../src/runner/playerState'
import { PlayerFailureError } from '../../src/runner/types'

class FakeWorker implements WorkerLike {
  onmessage: ((event: { data: unknown }) => void) | null = null
  onerror: ((event: unknown) => void) | null = null
  posted: { type: string; id?: number; code?: string }[] = []
  terminated = false
  postMessage(message: unknown) {
    this.posted.push(message as FakeWorker['posted'][number])
  }
  terminate() {
    this.terminated = true
  }
  respond(data: unknown) {
    this.onmessage?.({ data })
  }
  last(type: string) {
    return [...this.posted].reverse().find((m) => m.type === type)
  }
}

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0))
const state = () => buildPlayerState(new Game(), 1)

function setup(options: { moveTimeoutMs?: number; loadTimeoutMs?: number; initTimeoutMs?: number } = {}) {
  const workers: FakeWorker[] = []
  const player = new PythonPlayer({
    createWorker: () => {
      const w = new FakeWorker()
      workers.push(w)
      return w
    },
    ...options,
  })
  return { player, workers }
}

/** init → ready → load → loaded 까지 진행해 준비된 플레이어를 만든다 */
async function prepared(options = {}) {
  const ctx = setup(options)
  const pending = ctx.player.prepare('code')
  await tick()
  ctx.workers[0].respond({ type: 'ready' })
  await tick()
  ctx.workers[0].respond({ type: 'loaded', result: { ok: true } })
  await pending
  return ctx
}

describe('prepare', () => {
  test('init → ready 뒤에야 load를 보낸다. 결과를 그대로 반환한다', async () => {
    const { player, workers } = setup()
    const pending = player.prepare('print(1)')
    await tick()
    expect(workers[0].posted.map((m) => m.type)).toEqual(['init'])
    workers[0].respond({ type: 'ready' })
    await tick()
    expect(workers[0].posted.map((m) => m.type)).toEqual(['init', 'load'])
    expect(workers[0].last('load')?.code).toBe('print(1)')
    workers[0].respond({ type: 'loaded', result: { ok: true } })
    expect(await pending).toEqual({ ok: true })
  })

  test('이름은 항상 "Player"이다 (load 결과에 name이 들어 있어도 무시)', async () => {
    const { player, workers } = setup()
    expect(player.name).toBe('Player')
    const pending = player.prepare('x')
    await tick()
    workers[0].respond({ type: 'ready' })
    await tick()
    workers[0].respond({ type: 'loaded', result: { ok: true, name: '다른 이름' } })
    await pending
    expect(player.name).toBe('Player')
  })

  test('init-error를 받으면 Error로 reject하고 Worker를 종료한다', async () => {
    const { player, workers } = setup()
    const pending = player.prepare('x')
    await tick()
    workers[0].respond({ type: 'init-error', message: '네트워크' })
    await expect(pending).rejects.toThrow()
    expect(workers[0].terminated).toBe(true)
  })

  test('init 시간이 초과되면 Error로 reject하고 Worker를 종료한다', async () => {
    const { player, workers } = setup({ initTimeoutMs: 20 })
    await expect(player.prepare('x')).rejects.toThrow()
    expect(workers[0].terminated).toBe(true)
  })

  test('다시 prepare해도 새 Worker를 만들지 않고 load만 다시 보낸다', async () => {
    const { player, workers } = await prepared()
    const second = player.prepare('다른 코드')
    await tick()
    expect(workers).toHaveLength(1)
    expect(workers[0].posted.filter((m) => m.type === 'init')).toHaveLength(1)
    expect(workers[0].last('load')?.code).toBe('다른 코드')
    workers[0].respond({ type: 'loaded', result: { ok: true } })
    await second
  })

  test('load 시간이 초과되면 Worker를 종료하고 timeout 실패를 반환한다', async () => {
    const ctx = setup({ loadTimeoutMs: 20 })
    const pending = ctx.player.prepare('while True: pass')
    await tick()
    ctx.workers[0].respond({ type: 'ready' })
    const result = await pending
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.failure.kind).toBe('timeout')
      expect(result.failure.message).toContain('불러오는 데')
    }
    expect(ctx.workers[0].terminated).toBe(true)
  })

  test('load 실패 결과는 그대로 반환한다 (문법 오류 등)', async () => {
    const ctx = setup()
    const pending = ctx.player.prepare('x')
    await tick()
    ctx.workers[0].respond({ type: 'ready' })
    await tick()
    const failure = { kind: 'syntax', message: '문법 오류: x', line: 2 }
    ctx.workers[0].respond({ type: 'loaded', result: { ok: false, failure } })
    expect(await pending).toEqual({ ok: false, failure })
  })
})

describe('choose', () => {
  test('성공: 같은 id의 chosen 응답으로 resolve한다', async () => {
    const { player, workers } = await prepared()
    const pending = player.choose(state())
    await tick()
    const sent = workers[0].last('choose')!
    expect(typeof sent.id).toBe('number')
    workers[0].respond({
      type: 'chosen',
      id: sent.id,
      result: { ok: true, move: { row: 3, col: 4 }, stdout: 'x' },
    })
    expect(await pending).toEqual({ move: { row: 3, col: 4 }, stdout: 'x' })
  })

  test('실패 결과(ok:false)는 PlayerFailureError로 reject하고 failure가 그대로 전달된다', async () => {
    const { player, workers } = await prepared()
    const pending = player.choose(state())
    await tick()
    const failure = { kind: 'exception', message: 'ValueError: x', line: 3 }
    workers[0].respond({ type: 'chosen', id: workers[0].last('choose')!.id, result: { ok: false, failure } })
    await expect(pending).rejects.toBeInstanceOf(PlayerFailureError)
    await expect(pending).rejects.toMatchObject({ failure })
  })

  test('시간 초과: timeout으로 reject하고 Worker를 종료한다. 다음 prepare는 새 Worker를 만든다', async () => {
    const { player, workers } = await prepared({ moveTimeoutMs: 30 })
    await expect(player.choose(state())).rejects.toMatchObject({ failure: { kind: 'timeout' } })
    expect(workers[0].terminated).toBe(true)

    const again = player.prepare('다시')
    await tick()
    expect(workers).toHaveLength(2)
    workers[1].respond({ type: 'ready' })
    await tick()
    workers[1].respond({ type: 'loaded', result: { ok: true } })
    expect((await again).ok).toBe(true)
  })

  test('시간 초과 메시지에 안내가 들어 있다', async () => {
    const { player } = await prepared({ moveTimeoutMs: 20 })
    await expect(player.choose(state())).rejects.toThrow(/끝나지 않았습니다/)
  })

  test('시간 초과 뒤에 늦게 온 응답과 다른 id의 응답은 무시된다', async () => {
    const { player, workers } = await prepared({ moveTimeoutMs: 30 })
    const pending = player.choose(state())
    const id = (await tick(), workers[0].last('choose')!.id)
    await expect(pending).rejects.toBeInstanceOf(PlayerFailureError)
    expect(() =>
      workers[0].respond({ type: 'chosen', id, result: { ok: true, move: { row: 1, col: 1 }, stdout: '' } }),
    ).not.toThrow()
  })

  test('다른 id의 응답은 기다리는 요청을 끝내지 않는다', async () => {
    const { player, workers } = await prepared({ moveTimeoutMs: 60 })
    let settled = false
    const pending = player.choose(state()).then(
      () => (settled = true),
      () => (settled = true),
    )
    await tick()
    const id = workers[0].last('choose')!.id as number
    workers[0].respond({ type: 'chosen', id: id + 100, result: { ok: true, move: { row: 1, col: 1 }, stdout: '' } })
    await tick()
    expect(settled).toBe(false)
    await pending // 시간 초과로 끝난다
  })

  test('Worker 오류는 internal 실패로 reject된다', async () => {
    const { player, workers } = await prepared()
    const pending = player.choose(state())
    await tick()
    workers[0].onerror?.(new Error('x'))
    await expect(pending).rejects.toMatchObject({ failure: { kind: 'internal' } })
  })

  test('prepare하지 않았으면 internal 실패', async () => {
    const { player } = setup()
    await expect(player.choose(state())).rejects.toMatchObject({ failure: { kind: 'internal' } })
  })
})

describe('시간 초과 뒤 자동 복구', () => {
  test('시간 초과로 Worker가 종료돼도 다음 choose에서 같은 코드로 다시 준비해 계속 둔다', async () => {
    const { player, workers } = await prepared({ moveTimeoutMs: 30 })
    await expect(player.choose(state())).rejects.toMatchObject({ failure: { kind: 'timeout' } })
    expect(workers[0].terminated).toBe(true)

    const next = player.choose(state())
    await tick()
    expect(workers).toHaveLength(2) // 새 Worker
    workers[1].respond({ type: 'ready' })
    await tick()
    expect(workers[1].last('load')?.code).toBe('code') // prepare('code')로 불러온 같은 코드
    workers[1].respond({ type: 'loaded', result: { ok: true } })
    await tick()
    const sent = workers[1].last('choose')!
    workers[1].respond({ type: 'chosen', id: sent.id, result: { ok: true, move: { row: 3, col: 4 }, stdout: '' } })
    expect(await next).toEqual({ move: { row: 3, col: 4 }, stdout: '' })
  })

  test('다시 준비하는 중 코드를 불러오지 못하면 그 실패로 reject한다', async () => {
    const { player, workers } = await prepared({ moveTimeoutMs: 30 })
    await expect(player.choose(state())).rejects.toMatchObject({ failure: { kind: 'timeout' } })
    const next = player.choose(state())
    await tick()
    workers[1].respond({ type: 'ready' })
    await tick()
    const failure = { kind: 'syntax', message: '문법 오류: x', line: 1 }
    workers[1].respond({ type: 'loaded', result: { ok: false, failure } })
    await expect(next).rejects.toMatchObject({ failure })
  })

  test('다시 준비하는 중 Python을 불러오지 못하면 internal 실패로 reject한다', async () => {
    const { player, workers } = await prepared({ moveTimeoutMs: 30 })
    await expect(player.choose(state())).rejects.toMatchObject({ failure: { kind: 'timeout' } })
    const next = player.choose(state())
    await tick()
    workers[1].respond({ type: 'init-error', message: '네트워크' })
    await expect(next).rejects.toMatchObject({ failure: { kind: 'internal' } })
  })

  test('dispose한 뒤에는 다시 준비하지 않는다', async () => {
    const { player, workers } = await prepared()
    player.dispose()
    await expect(player.choose(state())).rejects.toMatchObject({ failure: { kind: 'internal' } })
    expect(workers).toHaveLength(1)
  })
})

describe('cancel과 동시 호출', () => {
  test('choose가 진행 중일 때 cancel하면 reject되고 Worker가 종료되며, 늦은 타이머가 새 Worker를 건드리지 않는다', async () => {
    const { player, workers } = await prepared({ moveTimeoutMs: 40 })
    const pending = player.choose(state())
    await tick()
    player.cancel()
    await expect(pending).rejects.toBeInstanceOf(PlayerFailureError)
    expect(workers[0].terminated).toBe(true)

    // 새 실행을 준비한다. 원래 시간 제한(40ms)이 지난 뒤에도 새 Worker는 살아 있어야 한다.
    const again = player.prepare('새 코드')
    await tick()
    workers[1].respond({ type: 'ready' })
    await tick()
    workers[1].respond({ type: 'loaded', result: { ok: true } })
    await again
    await new Promise((resolve) => setTimeout(resolve, 80))
    expect(workers[1].terminated).toBe(false)
  })

  test('아무 요청도 없을 때 cancel해도 Worker는 그대로 둔다', async () => {
    const { player, workers } = await prepared()
    player.cancel()
    expect(workers[0].terminated).toBe(false)
  })

  test('prepare가 겹쳐 호출되면 차례대로 처리한다 (init은 한 번, load는 순서대로)', async () => {
    const { player, workers } = setup()
    const first = player.prepare('a')
    const second = player.prepare('b')
    await tick()
    expect(workers).toHaveLength(1)
    expect(workers[0].posted.map((m) => m.type)).toEqual(['init'])
    workers[0].respond({ type: 'ready' })
    await tick()
    expect(workers[0].posted.map((m) => `${m.type}:${m.code ?? ''}`)).toEqual(['init:', 'load:a'])
    workers[0].respond({ type: 'loaded', result: { ok: true } })
    expect(await first).toEqual({ ok: true })
    await tick()
    expect(workers[0].last('load')?.code).toBe('b')
    workers[0].respond({ type: 'loaded', result: { ok: true } })
    expect(await second).toEqual({ ok: true })
  })

  test('prepare가 진행 중일 때 cancel하면 그 prepare는 Error로 끝난다', async () => {
    const { player, workers } = setup()
    const pending = player.prepare('a')
    await tick()
    player.cancel()
    await expect(pending).rejects.toThrow()
    expect(workers[0].terminated).toBe(true)
  })
})

describe('dispose', () => {
  test('Worker를 terminate한다', async () => {
    const { player, workers } = await prepared()
    player.dispose()
    expect(workers[0].terminated).toBe(true)
  })

  test('Worker가 없을 때 dispose해도 오류가 없다', () => {
    expect(() => setup().player.dispose()).not.toThrow()
  })
})
