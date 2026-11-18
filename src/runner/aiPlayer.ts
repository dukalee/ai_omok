import type { HardRequest } from '../ai/hard.worker'
import { createEasyAI } from '../ai/easy'
import { createHardAI } from '../ai/hard'
import { createMediumAI } from '../ai/medium'
import type { AI, Difficulty } from '../ai/types'
import type { Color, Move } from '../engine/types'
import { toAbsoluteBoard } from './playerState'
import { PlayerFailureError } from './types'
import type { PlayerAdapter, PlayerState } from './types'

/** Web Worker 중 이 프로젝트가 쓰는 부분. 테스트에서는 가짜로 대신한다. */
export interface WorkerLike {
  postMessage(message: unknown): void
  terminate(): void
  onmessage: ((event: { data: unknown }) => void) | null
  onerror: ((event: unknown) => void) | null
}

export interface AiPlayer extends PlayerAdapter {
  dispose(): void
}

const myColor = (state: PlayerState): Color => (state.my_color === 'black' ? 1 : 2)

/** 동기 AI 함수를 PlayerAdapter로 감싼다. */
export function createSyncAiPlayer(name: string, ai: AI): AiPlayer {
  return {
    name,
    async choose(state) {
      return { move: ai(toAbsoluteBoard(state), myColor(state)) }
    },
    dispose() {},
  }
}

/** Worker에서 계산하는 AI(상 난이도)를 PlayerAdapter로 감싼다. Worker는 첫 choose에서 만든다. */
export function createWorkerAiPlayer(name: string, createWorker: () => WorkerLike): AiPlayer {
  let worker: WorkerLike | null = null
  return {
    name,
    choose(state) {
      return new Promise((resolve, reject) => {
        worker ??= createWorker()
        worker.onmessage = (event) => resolve({ move: event.data as Move })
        worker.onerror = () =>
          reject(new PlayerFailureError({ kind: 'internal', message: 'AI가 수를 계산하지 못했습니다.' }))
        const request: HardRequest = { board: toAbsoluteBoard(state), color: myColor(state) }
        worker.postMessage(request)
      })
    },
    dispose() {
      worker?.terminate()
      worker = null
    },
  }
}

const LEVEL_NAME: Record<Difficulty, string> = { easy: 'AI 하', medium: 'AI 중', hard: 'AI 상' }

/**
 * 난이도별 AI 선수. 상은 createHardWorker가 있으면 Worker에서(화면이 멈추지 않게),
 * 없으면 같은 스레드에서 계산한다.
 */
export function createAiPlayer(difficulty: Difficulty, createHardWorker?: () => WorkerLike): AiPlayer {
  const name = LEVEL_NAME[difficulty]
  if (difficulty === 'easy') return createSyncAiPlayer(name, createEasyAI())
  if (difficulty === 'medium') return createSyncAiPlayer(name, createMediumAI())
  if (createHardWorker) return createWorkerAiPlayer(name, createHardWorker)
  return createSyncAiPlayer(name, createHardAI())
}
