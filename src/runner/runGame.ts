import { isInside } from '../engine/board'
import { getForbiddenReason } from '../engine/forbidden'
import { FORBIDDEN_LABEL, Game } from '../engine/game'
import type { GameStatus } from '../engine/game'
import { opponent } from '../engine/rules'
import type { Color, Move } from '../engine/types'
import { buildPlayerState } from './playerState'
import { PlayerFailureError } from './types'
import type { GameEvent, PlayerAdapter, PlayerFailure } from './types'

type EndEvent = Extract<GameEvent, { type: 'end' }>

export interface RunGameOptions {
  black: PlayerAdapter
  white: PlayerAdapter
  onEvent: (event: GameEvent) => void
  /** abort되면 그 이후에는 어떤 이벤트도 내지 않고 null을 반환한다 */
  signal?: AbortSignal
  /** 수와 수 사이에 기다리는 시간(ms). 화면에서 진행을 눈으로 따라가게 할 때 쓴다 */
  /** 숫자이면 고정 대기 시간, 함수이면 수마다 새로 불러서 실행 중에도 바꿀 수 있다 */
  pauseMs?: number | (() => number)
  sleep?: (ms: number) => Promise<void>
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** while 조건으로 좁혀진 타입이 아니라 play() 뒤의 실제 상태를 읽기 위한 도우미 */
function currentStatus(game: Game): GameStatus {
  return game.status
}

const at = (move: Move) => `(${move.row}, ${move.col})`

function toFailure(error: unknown): PlayerFailure {
  if (error instanceof PlayerFailureError) return error.failure
  const message = error instanceof Error ? error.message : String(error)
  return { kind: 'internal', message: `내부 오류: ${message}` }
}

/**
 * 두 플레이어(학습자 코드 또는 AI)를 차례로 불러 한 판을 진행한다.
 * 규칙을 어긴 수, 금수, 오류, 시간 초과는 그 플레이어의 패배(반칙패)로 끝낸다.
 */
export async function runGame(options: RunGameOptions): Promise<EndEvent | null> {
  const { black, white, onEvent, signal } = options
  const sleep = options.sleep ?? defaultSleep
  const aborted = () => signal?.aborted === true

  if (aborted()) return null
  const game = new Game()
  onEvent({ type: 'start', black: black.name, white: white.name })

  function foulEnd(color: Color, foul: Omit<Extract<GameEvent, { type: 'foul' }>, 'type' | 'color'>): EndEvent {
    onEvent({ type: 'foul', color, ...foul })
    const end: EndEvent = { type: 'end', winner: opponent(color), reason: 'foul', line: null }
    onEvent(end)
    return end
  }

  while (game.status.state === 'playing') {
    if (aborted()) return null
    const color = game.toMove
    const player = color === 1 ? black : white

    let choice
    try {
      choice = await player.choose(buildPlayerState(game, color))
    } catch (error) {
      if (aborted()) return null
      const failure = toFailure(error)
      return foulEnd(color, { reason: 'failure', message: failure.message, failure })
    }
    if (aborted()) return null

    const move = choice.move
    if (!isInside(move)) {
      return foulEnd(color, {
        reason: 'out-of-board',
        message: `${at(move)}은 판 밖입니다. 행과 열은 0부터 14까지입니다.`,
        move,
        stdout: choice.stdout,
      })
    }
    if (game.board[move.row][move.col] !== 0) {
      return foulEnd(color, {
        reason: 'occupied',
        message: `${at(move)}에는 이미 돌이 있습니다. state["board"]에서 빈 칸(0)을 골라 보세요.`,
        move,
        stdout: choice.stdout,
      })
    }
    if (color === 1) {
      const reason = getForbiddenReason(game.board, move)
      if (reason) {
        return foulEnd(color, {
          reason: 'forbidden',
          message: `${at(move)}은 금수입니다 (${FORBIDDEN_LABEL[reason]}). 흑은 이 자리에 둘 수 없습니다.`,
          move,
          stdout: choice.stdout,
        })
      }
    }

    game.play(move)
    onEvent({ type: 'move', moveNumber: game.history.length, color, move, stdout: choice.stdout })

    const status: GameStatus = currentStatus(game)
    if (status.state === 'won') {
      const end: EndEvent = { type: 'end', winner: status.winner, reason: status.reason, line: status.line }
      onEvent(end)
      return end
    }

    const pause = options.pauseMs
    await sleep(typeof pause === 'function' ? pause() : (pause ?? 0))
    if (aborted()) return null
  }
  return null
}
