import { describe, expect, test } from 'vitest'
import { summarizeResult } from '../../src/runner/resultSummary'
import type { GameEvent } from '../../src/runner/types'

type End = Extract<GameEvent, { type: 'end' }>

const names = { black: 'Player', white: 'AI 중' }
const five = (winner: 1 | 2): End => ({ type: 'end', winner, reason: 'five', line: [] })

describe('summarizeResult', () => {
  test('오목 완성: 이긴 쪽 이름, 헤드라인, 이유, 수 번호', () => {
    const s = summarizeResult(five(1), names, 1, 33)
    expect(s).toMatchObject({
      winnerColor: 'black',
      winnerName: 'Player',
      loserName: 'AI 중',
      headline: 'Player 승리',
      reasonText: '5목을 완성했습니다',
      moves: 33,
    })
  })

  test('백이 이기면 winnerColor가 white이고 이름도 백 쪽이다', () => {
    const s = summarizeResult(five(2), names, 1, 40)
    expect(s).toMatchObject({ winnerColor: 'white', winnerName: 'AI 중', loserName: 'Player', headline: 'AI 중 승리' })
  })

  test('playerWon: 내 코드가 맡은 색이 이겼을 때만 true', () => {
    expect(summarizeResult(five(1), names, 1, 9).playerWon).toBe(true) // 내 코드=흑, 흑 승
    expect(summarizeResult(five(2), names, 1, 9).playerWon).toBe(false) // 내 코드=흑, 백 승
    expect(summarizeResult(five(2), { black: 'AI 상', white: 'Player' }, 2, 9).playerWon).toBe(true) // 내 코드=백, 백 승
  })

  test('판이 가득 차서 백이 이긴 경우', () => {
    const s = summarizeResult({ type: 'end', winner: 2, reason: 'full', line: null }, names, 1, 225)
    expect(s.reasonText).toBe('판이 가득 차서 백이 이겼습니다')
    expect(s.moves).toBe(225)
  })

  test('상대 반칙으로 이긴 경우: 진 쪽의 반칙패라고 알려 준다', () => {
    const s = summarizeResult({ type: 'end', winner: 2, reason: 'foul', line: null }, names, 1, 12)
    expect(s.reasonText).toBe('Player의 반칙패입니다')
    expect(s.headline).toBe('AI 중 승리')
    expect(s.playerWon).toBe(false)
  })
})
