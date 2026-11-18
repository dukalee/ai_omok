import type { Color } from '../engine/types'
import type { GameEvent } from './types'
import type { PlayerNames } from './logFormat'

type EndEvent = Extract<GameEvent, { type: 'end' }>

/** 대국이 끝났을 때 결과 팝업에 보여줄 내용 */
export interface ResultSummary {
  winnerColor: 'black' | 'white'
  winnerName: string
  loserName: string
  /** 예: "Player 승리" */
  headline: string
  /** 이긴 이유 한 줄 */
  reasonText: string
  /** 대국에서 놓인 돌의 수 */
  moves: number
  /** 내 코드(Python 플레이어)가 이겼는가 */
  playerWon: boolean
}

/**
 * 대국 결과를 팝업용 문구로 정리한다.
 * myColor는 내 코드(Python 플레이어)가 맡은 색이다.
 */
export function summarizeResult(
  end: EndEvent,
  names: PlayerNames,
  myColor: Color,
  moves: number,
): ResultSummary {
  const winnerName = end.winner === 1 ? names.black : names.white
  const loserName = end.winner === 1 ? names.white : names.black
  const reasonText =
    end.reason === 'five'
      ? '5목을 완성했습니다'
      : end.reason === 'full'
        ? '판이 가득 차서 백이 이겼습니다'
        : `${loserName}의 반칙패입니다`

  return {
    winnerColor: end.winner === 1 ? 'black' : 'white',
    winnerName,
    loserName,
    headline: `${winnerName} 승리`,
    reasonText,
    moves,
    playerWon: end.winner === myColor,
  }
}
