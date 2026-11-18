import type { WorkerLike } from '../runner/aiPlayer'
import { PlayerFailureError } from '../runner/types'
import type { PlayerAdapter, PlayerChoice, PlayerState } from '../runner/types'
import type { WorkerIn, WorkerOut } from './protocol'
import type { LoadResult } from './session'

export interface PythonPlayerOptions {
  createWorker: () => WorkerLike
  /** 한 수당 제한 시간 */
  moveTimeoutMs?: number
  /** 코드를 불러오는(최상위가 실행되는) 데 허용하는 시간 */
  loadTimeoutMs?: number
  /** Pyodide를 내려받고 준비하는 데 허용하는 시간 */
  initTimeoutMs?: number
}

/** Worker가 보낸 메시지 외에, Worker 자체의 오류를 같은 흐름으로 다루기 위한 값 */
type Incoming = WorkerOut | { type: 'worker-error' }
const TIMEOUT = Symbol('timeout')
const CANCELLED = Symbol('cancelled')

const seconds = (ms: number) => String(ms / 1000)

/**
 * Pyodide Worker에서 학습자의 play(state) 함수를 호출하는 PlayerAdapter.
 * - 수 하나가 시간 제한을 넘기면 Worker를 종료하고(무한 반복 대비) 시간 초과로 처리한다.
 * - Worker는 재사용하며, 종료된 경우 다음 prepare에서 새로 만든다.
 * - 한 번에 하나의 요청만 보낸다. prepare가 겹쳐 호출되면 차례대로 처리한다.
 */
export class PythonPlayer implements PlayerAdapter {
  name = 'Player'

  private worker: WorkerLike | null = null
  private handler: ((data: Incoming) => void) | null = null
  /** 진행 중인 요청을 CANCELLED로 끝내는 함수 */
  private pending: ((value: typeof CANCELLED) => void) | null = null
  private chain: Promise<unknown> = Promise.resolve()
  /** 마지막으로 prepare한 코드. 시간 초과로 Worker가 종료됐을 때 같은 코드로 다시 준비하는 데 쓴다 */
  private lastCode: string | null = null
  private disposed = false
  private nextId = 1
  private readonly options: PythonPlayerOptions
  private readonly moveTimeoutMs: number
  private readonly loadTimeoutMs: number
  private readonly initTimeoutMs: number

  constructor(options: PythonPlayerOptions) {
    this.options = options
    this.moveTimeoutMs = options.moveTimeoutMs ?? 2000
    this.loadTimeoutMs = options.loadTimeoutMs ?? 5000
    this.initTimeoutMs = options.initTimeoutMs ?? 60000
  }

  /** 메시지를 보내고, accept가 값을 돌려주는 첫 응답(또는 시간 초과, 취소)을 기다린다. */
  private request<T>(
    message: WorkerIn,
    accept: (data: Incoming) => T | undefined,
    timeoutMs: number,
  ): Promise<T | typeof TIMEOUT | typeof CANCELLED> {
    return new Promise((resolve) => {
      const finish = (value: T | typeof TIMEOUT | typeof CANCELLED) => {
        clearTimeout(timer)
        this.handler = null
        this.pending = null
        resolve(value)
      }
      const timer = setTimeout(() => finish(TIMEOUT), timeoutMs)
      this.pending = finish
      this.handler = (data) => {
        const value = accept(data)
        if (value !== undefined) finish(value)
      }
      this.worker?.postMessage(message)
    })
  }

  /** Worker를 종료한다. 기다리던 요청이 있으면 취소로 끝낸다. */
  private kill(): void {
    const pending = this.pending
    this.pending = null
    this.handler = null
    this.worker?.terminate()
    this.worker = null
    pending?.(CANCELLED)
  }

  /** 코드를 불러온다. Worker가 없으면 만들고 Pyodide를 준비한다(첫 실행은 몇 초 걸린다). */
  prepare(code: string): Promise<LoadResult> {
    const run = this.chain.then(
      () => this.prepareNow(code),
      () => this.prepareNow(code),
    )
    this.chain = run.catch(() => undefined)
    return run
  }

  private async prepareNow(code: string): Promise<LoadResult> {
    this.lastCode = code
    this.disposed = false
    if (!this.worker) {
      const worker = this.options.createWorker()
      worker.onmessage = (event) => this.handler?.(event.data as WorkerOut)
      worker.onerror = () => this.handler?.({ type: 'worker-error' })
      this.worker = worker

      const init = await this.request(
        { type: 'init' },
        (d) => (d.type === 'ready' || d.type === 'init-error' || d.type === 'worker-error' ? d : undefined),
        this.initTimeoutMs,
      )
      if (init === CANCELLED) throw new Error('취소되었습니다.')
      if (init === TIMEOUT || init.type !== 'ready') {
        this.kill()
        const reason =
          init === TIMEOUT
            ? 'Python을 불러오는 데 너무 오래 걸립니다.'
            : init.type === 'init-error'
              ? init.message
              : 'Python 실행 환경에서 오류가 발생했습니다.'
        throw new Error(reason)
      }
    }

    const loaded = await this.request(
      { type: 'load', code },
      (d) => (d.type === 'loaded' || d.type === 'worker-error' ? d : undefined),
      this.loadTimeoutMs,
    )
    if (loaded === CANCELLED) throw new Error('취소되었습니다.')
    if (loaded === TIMEOUT) {
      this.kill()
      return {
        ok: false,
        failure: {
          kind: 'timeout',
          message: `코드를 불러오는 데 ${seconds(this.loadTimeoutMs)}초가 넘게 걸렸습니다. 최상위에 끝나지 않는 반복이 없는지 확인하세요.`,
        },
      }
    }
    if (loaded.type === 'worker-error') {
      this.kill()
      return { ok: false, failure: { kind: 'internal', message: 'Python 실행 환경에서 오류가 발생했습니다.' } }
    }
    return loaded.result
  }

  async choose(state: PlayerState): Promise<PlayerChoice> {
    if (!this.worker) {
      // 시간 초과로 Worker를 종료했다면 같은 코드로 다시 준비한 뒤 이어서 둔다.
      // (Python 실행은 중간에 끊을 수 없어서 Worker를 종료했기 때문에, 전역 변수는 처음 상태로 돌아간다)
      if (this.lastCode === null || this.disposed) {
        throw new PlayerFailureError({ kind: 'internal', message: 'Python이 준비되지 않았습니다.' })
      }
      let loaded: LoadResult
      try {
        loaded = await this.prepare(this.lastCode)
      } catch {
        throw new PlayerFailureError({
          kind: 'internal',
          message: 'Python을 다시 준비하지 못했습니다. 인터넷 연결을 확인하세요.',
        })
      }
      if (!loaded.ok) throw new PlayerFailureError(loaded.failure)
    }
    const id = this.nextId++
    const response = await this.request(
      { type: 'choose', id, state },
      (d) => (d.type === 'chosen' && d.id === id ? d : d.type === 'worker-error' ? d : undefined),
      this.moveTimeoutMs,
    )

    if (response === CANCELLED) {
      throw new PlayerFailureError({ kind: 'internal', message: '실행이 취소되었습니다.' })
    }
    if (response === TIMEOUT) {
      this.kill()
      throw new PlayerFailureError({
        kind: 'timeout',
        message: `play()가 ${seconds(this.moveTimeoutMs)}초 안에 끝나지 않았습니다. 무한 반복이나 너무 오래 걸리는 계산이 없는지 확인하세요.`,
      })
    }
    if (response.type === 'worker-error') {
      this.kill()
      throw new PlayerFailureError({ kind: 'internal', message: 'Python 실행 환경에서 오류가 발생했습니다.' })
    }
    if (!response.result.ok) throw new PlayerFailureError(response.result.failure)
    return { move: response.result.move, stdout: response.result.stdout }
  }

  /**
   * 진행 중인 요청을 취소한다. 요청이 있으면 Worker를 종료한다(Python 실행은 중간에 끊을 수 없으므로).
   * 아무 요청도 없으면 Worker를 그대로 둬서 다음 실행이 빠르게 시작되게 한다.
   */
  cancel(): void {
    if (this.pending) this.kill()
  }

  dispose(): void {
    this.disposed = true
    this.kill()
  }
}
