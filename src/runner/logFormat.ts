import type { Color, Move } from '../engine/types'
import type { GameEvent } from './types'

export interface LogLine {
  kind: 'info' | 'move' | 'print' | 'error' | 'result'
  text: string
}

export interface PlayerNames {
  black: string
  white: string
}

export const coordText = (move: Move): string => `(${move.row}, ${move.col})`

const colorLabel = (c: Color) => (c === 1 ? '흑' : '백')

function printLines(stdout: string | undefined): LogLine[] {
  if (!stdout) return []
  return stdout
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => ({ kind: 'print' as const, text: `print: ${line}` }))
}

export interface ParsedMove {
  no: number
  color: 'black' | 'white'
  who: string
  coord: string
}

/**
 * formatEvent가 만든 이동 기록 줄("3. 흑 Player (7, 8)")을 구조로 읽는다.
 * 로그 화면에서 번호, 돌 모양, 이름, 좌표를 따로 꾸미기 위한 것이다. 이동 기록이 아니면 null.
 */
export function parseMoveLine(text: string): ParsedMove | null {
  const m = /^(\d+)\. (흑|백) (.+) (\(\d+, \d+\))$/.exec(text)
  if (!m) return null
  return { no: Number(m[1]), color: m[2] === '흑' ? 'black' : 'white', who: m[3], coord: m[4] }
}

/** 대국 이벤트를 로그 창에 보여줄 줄들로 바꾼다. 문구는 학습자 눈높이로 쓴다. */
export function formatEvent(event: GameEvent, names: PlayerNames): LogLine[] {
  const nameOf = (c: Color) => (c === 1 ? names.black : names.white)

  switch (event.type) {
    case 'start':
      return [{ kind: 'info', text: `대국 시작 · 흑 ${event.black} / 백 ${event.white}` }]

    case 'move':
      return [
        {
          kind: 'move',
          text: `${event.moveNumber}. ${colorLabel(event.color)} ${nameOf(event.color)} ${coordText(event.move)}`,
        },
        ...printLines(event.stdout),
      ]

    case 'foul': {
      const line = event.failure?.line
      const where = typeof line === 'number' ? ` (${line}번째 줄)` : ''
      return [
        {
          kind: 'error',
          text: `${colorLabel(event.color)} ${nameOf(event.color)} 반칙: ${event.message}${where}`,
        },
        ...printLines(event.failure?.stdout ?? event.stdout),
      ]
    }

    case 'end': {
      // 오목을 완성한 보통의 승리는 덧붙이는 말 없이 "<이름> 승리"만 보여준다
      const reason =
        event.reason === 'full' ? ' (판이 가득 차서 백 승리)' : event.reason === 'foul' ? ' (상대 반칙)' : ''
      return [{ kind: 'result', text: `${nameOf(event.winner)} 승리${reason}` }]
    }
  }
}
