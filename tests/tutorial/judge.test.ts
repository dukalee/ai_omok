import { describe, expect, test } from 'vitest'
import { LEVELS } from '../../src/tutorial/levels'
import { attackCells, attackKindAt } from '../../src/tutorial/attack'
import type { AttackKind } from '../../src/tutorial/attack'
import { resolveLevel } from '../../src/tutorial/levels'
import type { BlockLevel, DecideLevel, FindWinLevel, LineLevel, OpenFourLevel, WinInTwoLevel } from '../../src/tutorial/levels'
import {
  buildLevelBoard,
  buildLevelState,
  judgeBlock,
  judgeDecide,
  judgeLineResult,
  judgeMove,
  judgeOpenFour,
  judgeWinInTwo,
  lineDirection,
  opponentWinningCells,
  winningCells as fiveCells,
} from '../../src/tutorial/judge'

const level4 = LEVELS.find((l) => l.id === 4) as FindWinLevel
const lineLevel = (direction: LineLevel['direction']) =>
  LEVELS.find((l) => l.kind === 'make-line' && l.direction === direction) as LineLevel

describe('레벨 목록', () => {
  test('레벨 1~20이 순서대로 있고 id가 겹치지 않는다', () => {
    expect(LEVELS.map((l) => l.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20])
    expect(LEVELS.map((l) => l.kind)).toEqual([
      'make-line',
      'make-line',
      'make-line',
      'find-win',
      'find-win',
      'find-win',
      'block',
      'block',
      'block',
      'block',
      'block',
      'block',
      'open-four',
      'open-four',
      'decide',
      'decide',
      'win-in-two',
      'win-in-two',
      'win-in-two',
      'win-in-two',
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

describe('레벨 7~9: 공격 막기', () => {
  const blockLevel = (id: number) => LEVELS.find((l) => l.id === id) as BlockLevel
  /** 통과하는 칸 전부 ("행,열") */
  const blockingCells = (level: BlockLevel): string[] => {
    const cells: string[] = []
    for (let r = 0; r < 15; r++)
      for (let c = 0; c < 15; c++) if (judgeBlock(level, { row: r, col: c }).passed) cells.push(`${r},${c}`)
    return cells
  }

  test('처음 판에서는 상대가 한 수로 이길 칸이 정답 하나뿐이다', () => {
    expect(opponentWinningCells(buildLevelBoard(blockLevel(7)), 'black')).toEqual([{ row: 7, col: 9 }])
    expect(opponentWinningCells(buildLevelBoard(blockLevel(8)), 'black')).toEqual([{ row: 6, col: 7 }])
    expect(opponentWinningCells(buildLevelBoard(blockLevel(9)), 'black')).toEqual([{ row: 7, col: 7 }])
  })

  test('통과하는 칸은 레벨마다 하나뿐이다 (가로, 세로, 대각선)', () => {
    expect(blockingCells(blockLevel(7))).toEqual(['7,9'])
    expect(blockingCells(blockLevel(8))).toEqual(['6,7'])
    expect(blockingCells(blockLevel(9))).toEqual(['7,7'])
  })

  test('엉뚱한 칸, 돌이 있는 칸, 판 밖은 실패한다', () => {
    const level = blockLevel(7)
    const wrong = judgeBlock(level, { row: 0, col: 0 })
    expect(wrong.passed).toBe(false)
    expect(wrong.message).toContain('(7, 9)')
    expect(judgeBlock(level, { row: 7, col: 5 }).foulMove).toEqual({ row: 7, col: 5 })
    expect(judgeBlock(level, { row: -1, col: 3 }).passed).toBe(false)
  })

  test('state는 내 관점이다 (내 돌 1, 상대 돌 2)', () => {
    const state = buildLevelState(blockLevel(7))
    expect(state.board[7].slice(4, 9)).toEqual([1, 2, 2, 2, 2])
  })
})

describe('레벨 10~12: 삼삼, 사사, 사삼 막기', () => {
  const level = (id: number) => LEVELS.find((l) => l.id === id) as BlockLevel
  const cases: [number, AttackKind][] = [
    [10, 'three-three'],
    [11, 'four-four'],
    [12, 'four-three'],
  ]

  test.each(cases)('레벨 %i: 처음 판에서 상대가 만들 수 있는 공격은 (7, 7)의 한 가지뿐이다', (id, kind) => {
    expect(level(id).threat).toBe(kind)
    expect(attackCells(buildLevelBoard(level(id)), 2)).toEqual([{ move: { row: 7, col: 7 }, kind }])
  })

  test.each(cases)('레벨 %i: 그 칸 (7, 7)에 두면 통과하고, 엉뚱한 칸은 실패한다', (id) => {
    expect(judgeBlock(level(id), { row: 7, col: 7 }).passed).toBe(true)
    const wrong = judgeBlock(level(id), { row: 0, col: 0 })
    expect(wrong.passed).toBe(false)
    expect(wrong.message).toContain('(7, 7)')
  })

  test('공격 모양 분류: 열린 삼 둘은 삼삼, 4목과 열린 삼은 사삼', () => {
    const b = buildLevelBoard(level(10))
    expect(attackKindAt(b, { row: 7, col: 7 }, 2)).toBe('three-three')
    expect(attackKindAt(b, { row: 0, col: 0 }, 2)).toBeNull()
    expect(attackKindAt(b, { row: 7, col: 5 }, 2)).toBeNull() // 돌이 있는 칸
  })
})

describe('레벨 13, 14: 열린 4 만들기', () => {
  const level = (id: number) => LEVELS.find((l) => l.id === id) as OpenFourLevel
  /** 통과하는 칸 전부 ("행,열") */
  const passingCells = (l: OpenFourLevel): string[] => {
    const cells: string[] = []
    for (let r = 0; r < 15; r++)
      for (let c = 0; c < 15; c++) if (judgeOpenFour(l, { row: r, col: c }).passed) cells.push(`${r},${c}`)
    return cells
  }

  test('처음 판에는 이미 5목이 되는 칸이 없다', () => {
    expect(fiveCells(buildLevelBoard(level(13)), 1)).toEqual([])
    expect(fiveCells(buildLevelBoard(level(14)), 1)).toEqual([])
  })

  test('레벨 13(연속된 3)은 양 끝 칸 (7, 5), (7, 9)가 정답이다', () => {
    expect(passingCells(level(13))).toEqual(['7,5', '7,9'])
  })

  test('레벨 14(2 + 빈칸 + 1)는 가운데 빈 칸 (7, 7)이 정답 하나뿐이다', () => {
    expect(passingCells(level(14))).toEqual(['7,7'])
  })

  test('한쪽만 열린 4, 4가 안 되는 수, 돌이 있는 칸은 실패한다', () => {
    const half = judgeOpenFour(level(13), { row: 7, col: 4 }) // ●_●●● : 5목 자리가 하나뿐
    expect(half.passed).toBe(false)
    expect(half.message).toContain('한쪽만')
    const none = judgeOpenFour(level(13), { row: 0, col: 0 })
    expect(none.passed).toBe(false)
    expect(none.message).toContain('이어지지 않습니다')
    expect(judgeOpenFour(level(13), { row: 7, col: 6 }).foulMove).toEqual({ row: 7, col: 6 })
  })
})

describe('레벨 15, 16: 막을까 공격할까', () => {
  const level = (id: number) => LEVELS.find((l) => l.id === id) as DecideLevel
  const passingCells = (l: DecideLevel): string[] => {
    const cells: string[] = []
    for (let r = 0; r < 15; r++)
      for (let c = 0; c < 15; c++) if (judgeDecide(l, { row: r, col: c }).passed) cells.push(`${r},${c}`)
    return cells
  }

  test('레벨 15: 내가 이길 수 없으면 상대의 5목 자리 (7, 10)을 막아야 한다', () => {
    const board = buildLevelBoard(level(15))
    expect(fiveCells(board, 1)).toEqual([])
    expect(fiveCells(board, 2)).toEqual([{ row: 7, col: 10 }])
    expect(passingCells(level(15))).toEqual(['7,10'])
    // 열린 4를 만드는 공격 수는 상대가 먼저 이겨서 실패한다
    const attack = judgeDecide(level(15), { row: 10, col: 8 })
    expect(attack.passed).toBe(false)
    expect(attack.message).toContain('(7, 10)')
  })

  test('레벨 16: 내 4목이 있으면 상대 3목을 막지 않고 (9, 6)으로 이긴다', () => {
    expect(fiveCells(buildLevelBoard(level(16)), 1)).toEqual([{ row: 9, col: 6 }])
    expect(passingCells(level(16))).toEqual(['9,6'])
    const blocked = judgeDecide(level(16), { row: 6, col: 6 })
    expect(blocked.passed).toBe(false)
    expect(blocked.message).toContain('이길 수 있는 칸')
  })

  test('돌이 있는 칸과 판 밖은 실패한다', () => {
    expect(judgeDecide(level(15), { row: 3, col: 10 }).foulMove).toEqual({ row: 3, col: 10 })
    expect(judgeDecide(level(15), { row: -1, col: 0 }).passed).toBe(false)
  })
})

describe('레벨 17, 18: 2수 안에 이기기', () => {
  const level = (id: number) => LEVELS.find((l) => l.id === id) as WinInTwoLevel
  const passingCells = (l: WinInTwoLevel): string[] => {
    const cells: string[] = []
    for (let r = 0; r < 15; r++)
      for (let c = 0; c < 15; c++) if (judgeWinInTwo(l, { row: r, col: c }).passed) cells.push(`${r},${c}`)
    return cells
  }

  test('처음 판에서는 아무도 한 수로 이길 수 없다', () => {
    for (const id of [17, 18]) {
      const l = level(id)
      const board = buildLevelBoard(l)
      expect(fiveCells(board, 1)).toEqual([])
      expect(fiveCells(board, 2)).toEqual([])
    }
  })

  test('레벨 17(흑): 양쪽이 열린 세로 3개의 양 끝 (3, 10), (7, 10)만 정답이다', () => {
    expect(passingCells(level(17))).toEqual(['3,10', '7,10'])
    // 한쪽이 막힌 가로 3개를 4개로 만들면 5목 자리가 하나뿐이다
    const closed = judgeWinInTwo(level(17), { row: 7, col: 7 })
    expect(closed.passed).toBe(false)
    expect(closed.message).toContain('한 곳뿐')
  })

  test('레벨 18(백): 4-4가 되는 (7, 7) 하나만 정답이다', () => {
    expect(level(18).myColor).toBe('white')
    expect(passingCells(level(18))).toEqual(['7,7'])
    expect(judgeWinInTwo(level(18), { row: 8, col: 7 }).message).toContain('한 곳뿐')
    expect(judgeWinInTwo(level(18), { row: 0, col: 0 }).message).toContain('되지 않습니다')
  })

  test('돌이 있는 칸과 판 밖은 실패한다', () => {
    expect(judgeWinInTwo(level(17), { row: 7, col: 3 }).foulMove).toEqual({ row: 7, col: 3 })
    expect(judgeWinInTwo(level(17), { row: 15, col: 0 }).passed).toBe(false)
  })
})

describe('레벨 19, 20: 랜덤 색으로 막으면서 이기기', () => {
  const base = (id: number) => LEVELS.find((l) => l.id === id) as WinInTwoLevel
  const passing = (l: WinInTwoLevel): string[] => {
    const cells: string[] = []
    for (let r = 0; r < 15; r++)
      for (let c = 0; c < 15; c++) if (judgeWinInTwo(l, { row: r, col: c }).passed) cells.push(`${r},${c}`)
    return cells
  }

  test('랜덤 색 레벨로 표시되어 있고 학습자 state는 어느 색이든 같은 모양이다', () => {
    for (const id of [19, 20]) {
      expect(base(id).randomColor).toBe(true)
      const asBlack = buildLevelState(resolveLevel(base(id), 'black'))
      const asWhite = buildLevelState(resolveLevel(base(id), 'white'))
      expect(asBlack.my_color).toBe('black')
      expect(asWhite.my_color).toBe('white')
      expect(asWhite.board).toEqual(asBlack.board) // 1 = 나, 2 = 상대
    }
  })

  test('resolveLevel은 흑이 나인 기준 판의 돌 색을 바꾼다', () => {
    const white = resolveLevel(base(19), 'white')
    expect(white.myColor).toBe('white')
    expect(buildLevelBoard(white)[5][7]).toBe(2) // 기준 판의 내 돌(흑)이 백이 된다
    expect(buildLevelBoard(white)[4][3]).toBe(1) // 상대 돌(백)은 흑이 된다
    expect(resolveLevel(base(1), 'white')).toBe(base(1)) // 랜덤 색 레벨이 아니면 그대로
  })

  test('레벨 19: 흑이든 백이든 상대 4목을 막으면서 열린 4가 되는 (4, 7)만 정답이다', () => {
    for (const color of ['black', 'white'] as const) {
      const l = resolveLevel(base(19), color)
      const board = buildLevelBoard(l)
      const mine = color === 'black' ? 1 : 2
      expect(fiveCells(board, mine)).toEqual([])
      expect(fiveCells(board, mine === 1 ? 2 : 1)).toEqual([{ row: 4, col: 7 }]) // 막지 않으면 진다
      expect(passing(l)).toEqual(['4,7'])
    }
  })

  test('레벨 19: 막지 않고 열린 4를 만들면 상대가 먼저 이긴다', () => {
    const v = judgeWinInTwo(resolveLevel(base(19), 'black'), { row: 3, col: 7 })
    expect(v.passed).toBe(false)
    expect(v.message).toContain('(4, 7)')
  })

  test('레벨 20: 흑이든 백이든 대각선 4목을 막는 (7, 7)만 정답이다', () => {
    for (const color of ['black', 'white'] as const) {
      const l = resolveLevel(base(20), color)
      const mine = color === 'black' ? 1 : 2
      expect(fiveCells(buildLevelBoard(l), mine === 1 ? 2 : 1)).toEqual([{ row: 7, col: 7 }])
      expect(passing(l)).toEqual(['7,7'])
    }
    // 따로 만들어 둔 열린 3을 열린 4로 늘려도 상대가 먼저 이긴다
    const decoy = judgeWinInTwo(resolveLevel(base(20), 'black'), { row: 8, col: 3 })
    expect(decoy.passed).toBe(false)
    expect(decoy.message).toContain('(7, 7)')
  })

  test('흑이 4-4 금수 자리에 두면 실패한다 (백이면 같은 판에서 통과)', () => {
    const asWhite = base(18) // 백이 4-4로 이기는 판
    const asBlack: WinInTwoLevel = {
      ...asWhite,
      myColor: 'black',
      stones: asWhite.stones.map((s) => ({ ...s, color: s.color === 'black' ? 'white' : 'black' })),
    }
    expect(judgeWinInTwo(asWhite, { row: 7, col: 7 }).passed).toBe(true)
    const foul = judgeWinInTwo(asBlack, { row: 7, col: 7 })
    expect(foul.passed).toBe(false)
    expect(foul.message).toContain('금수')
    expect(foul.foulMove).toEqual({ row: 7, col: 7 })
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
