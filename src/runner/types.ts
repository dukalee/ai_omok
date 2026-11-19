import type { Color, Move } from '../engine/types'

/**
 * 대국에서 플레이어에게 주는 판 상태. 학습자 코드(Python)에는 board와 last_move만 전달하고,
 * my_color, move_number, history는 AI 어댑터가 쓰는 내부용이다 (src/python/session.ts).
 */
export interface PlayerState {
  /** 15×15. 0 빈 칸, 1 내 돌, 2 상대 돌 (항상 내 관점) */
  board: number[][]
  my_color: 'black' | 'white'
  /** 지금까지 놓인 돌의 수 */
  move_number: number
  /** 상대가 마지막으로 둔 (행, 열). 첫 수면 null */
  last_move: [number, number] | null
  /** 내가 마지막으로 둔 (행, 열). 내 첫 수면 null */
  my_last_move: [number, number] | null
  history: { color: 'black' | 'white'; move: [number, number] }[]
}

export type FailureKind =
  | 'exception'
  | 'timeout'
  | 'bad-return'
  | 'missing-function'
  | 'syntax'
  | 'internal'

export interface PlayerFailure {
  kind: FailureKind
  message: string
  line?: number | null
  stdout?: string
}

/** 플레이어가 수를 내지 못한 이유를 담아 던지는 오류. 해당 플레이어의 반칙패로 처리된다. */
export class PlayerFailureError extends Error {
  failure: PlayerFailure
  constructor(failure: PlayerFailure) {
    super(failure.message)
    this.name = 'PlayerFailureError'
    this.failure = failure
  }
}

export interface PlayerChoice {
  move: Move
  /** 학습자 코드의 print 출력 */
  stdout?: string
}

/** 학습자 코드와 AI가 같은 모양으로 대국에 참여하게 하는 인터페이스 */
export interface PlayerAdapter {
  name: string
  choose(state: PlayerState): Promise<PlayerChoice>
}

export type GameEvent =
  | { type: 'start'; black: string; white: string }
  | { type: 'move'; moveNumber: number; color: Color; move: Move; stdout?: string }
  | {
      type: 'foul'
      color: Color
      reason: 'out-of-board' | 'occupied' | 'forbidden' | 'failure'
      message: string
      move?: Move
      failure?: PlayerFailure
      /** 반칙이 난 수를 고르면서 찍은 print 출력 (failure가 없는 반칙용) */
      stdout?: string
    }
  | { type: 'end'; winner: Color; reason: 'five' | 'full' | 'foul'; line: Move[] | null }
