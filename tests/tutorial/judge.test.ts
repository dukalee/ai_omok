import { describe, expect, test } from 'vitest'
import { LEVELS } from '../../src/tutorial/levels'
import type { FindWinLevel, LineLevel } from '../../src/tutorial/levels'
import { buildLevelState, judgeLineResult, judgeMove, lineDirection } from '../../src/tutorial/judge'

const level4 = LEVELS.find((l) => l.id === 4) as FindWinLevel
const lineLevel = (direction: LineLevel['direction']) =>
  LEVELS.find((l) => l.kind === 'make-line' && l.direction === direction) as LineLevel

describe('레벨 목록', () => {
  test('레벨 1~6이 순서대로 있고 id가 겹치지 않는다', () => {
    expect(LEVELS.map((l) => l.id)).toEqual([1, 2, 3, 4, 5, 6])
    expect(LEVELS.map((l) => l.kind)).toEqual([
      'make-line',
      'make-line',
      'make-line',
      'find-win',
      'find-win',
      'find-win',
    ])
  })

  test('레벨 1~3은 가로, 세로, 대각선이다', () => {
    expect(LEVELS.slice(0, 3).map((l) => (l as LineLevel).direction)).toEqual(['horizontal', 'vertical', 'diagonal'])
  })
})

describe('레벨 4: 마지막 한 수 두기 1', () => {
  test('state는 내 관점의 판이다 (내 흑돌 1, 상대 백돌 2)', () => {
    const state = buildLevelState(level4)
    expect(state.my_color).toBe('black')
    expect(state.board[7].slice(4, 9)).toEqual([2, 1, 1, 1, 1])
    expect(state.last_move).toEqual([9, 9])
  })

  test('(7, 9)에 두면 5목이 되어 통과한다', () => {
    const v = judgeMove(level4, { row: 7, col: 9 })
    expect(v.passed).toBe(true)
    expect(v.line).toHaveLength(5)
  })

  test('백돌에 막힌 (7, 4)는 이미 돌이 있어 실패한다', () => {
    const v = judgeMove(level4, { row: 7, col: 4 })
    expect(v.passed).toBe(false)
    expect(v.foulMove).toEqual({ row: 7, col: 4 })
  })

  test('판 밖이면 실패한다', () => {
    expect(judgeMove(level4, { row: 20, col: 0 }).passed).toBe(false)
  })

  test('빈 칸이지만 5목이 안 되면 실패하고 돌은 놓인다', () => {
    const v = judgeMove(level4, { row: 0, col: 0 })
    expect(v.passed).toBe(false)
    expect(v.foulMove).toBeNull()
    expect(v.board[0][0]).toBe(1)
  })

  test('정답은 (7, 9) 하나뿐이다', () => {
    expect(winningCells(level4)).toEqual(['7,9'])
  })
})

/** 한 수로 이기는 칸 전부 ("행,열") */
function winningCells(level: FindWinLevel): string[] {
  const wins: string[] = []
  for (let r = 0; r < 15; r++)
    for (let c = 0; c < 15; c++) if (judgeMove(level, { row: r, col: c }).passed) wins.push(`${r},${c}`)
  return wins
}

describe('레벨 5, 6: 세로, 대각선 줄의 끝 칸으로 이기기', () => {
  test('레벨 5는 세로 줄의 끝 칸 (9, 7) 하나가 정답이다', () => {
    const level = LEVELS.find((l) => l.id === 5) as FindWinLevel
    expect(winningCells(level)).toEqual(['9,7'])
    const v = judgeMove(level, { row: 9, col: 7 })
    expect(v.line?.map((m) => m.col)).toEqual([7, 7, 7, 7, 7])
  })

  test('레벨 6은 대각선 줄의 끝 칸 (9, 9) 하나가 정답이다', () => {
    const level = LEVELS.find((l) => l.id === 6) as FindWinLevel
    expect(winningCells(level)).toEqual(['9,9'])
    const v = judgeMove(level, { row: 9, col: 9 })
    expect(v.line?.map((m) => m.row - m.col)).toEqual([0, 0, 0, 0, 0])
  })
})

describe('방향 판정', () => {
  const cells = (pairs: [number, number][]) => pairs.map(([row, col]) => ({ row, col }))

  test('lineDirection', () => {
    expect(lineDirection(cells([[3, 3], [3, 4], [3, 5], [3, 6], [3, 7]]))).toBe('horizontal')
    expect(lineDirection(cells([[3, 3], [4, 3], [5, 3], [6, 3], [7, 3]]))).toBe('vertical')
    expect(lineDirection(cells([[3, 3], [4, 4], [5, 5], [6, 6], [7, 7]]))).toBe('diagonal')
    expect(lineDirection(cells([[7, 3], [6, 4], [5, 5], [4, 6], [3, 7]]))).toBe('diagonal')
  })

  test('목표 방향이면 통과, 다른 방향이면 실패, 반칙패면 실패', () => {
    const horizontal = lineLevel('horizontal')
    const row = cells([[7, 3], [7, 4], [7, 5], [7, 6], [7, 7]])
    const col = cells([[3, 7], [4, 7], [5, 7], [6, 7], [7, 7]])
    expect(judgeLineResult(horizontal, { winner: 1, reason: 'five', line: row }).passed).toBe(true)
    const wrong = judgeLineResult(horizontal, { winner: 1, reason: 'five', line: col })
    expect(wrong.passed).toBe(false)
    expect(wrong.message).toContain('세로')
    expect(judgeLineResult(horizontal, { winner: 2, reason: 'foul', line: null }).passed).toBe(false)
  })
})
