import type { Color } from '../engine/types'
import type { AttackKind } from './attack'

export interface LevelStone {
  row: number
  col: number
  color: 'black' | 'white'
}

export type LineDirection = 'horizontal' | 'vertical' | 'diagonal'

export const DIRECTION_LABEL: Record<LineDirection, string> = {
  horizontal: '가로',
  vertical: '세로',
  diagonal: '대각선',
}

interface LevelBase {
  id: number
  title: string
  /** 레벨 목록에서 제목 옆에 보여 줄 짧은 설명 (예: "가로 5목") */
  tag: string
  /** 화면에 보여 줄 미션 설명 */
  mission: string
  /** 학습자의 돌 색 (state["my_color"]). randomColor 레벨에서는 판을 만든 기준 색이다(아래 randomColor 참고) */
  myColor: 'black' | 'white'
  /**
   * true이면 실행할 때마다 내 돌 색이 흑 또는 백으로 무작위로 정해진다. 이 레벨의 stones는 "흑이 나, 백이 상대"인
   * 기준으로 적어 두고(myColor는 'black'), 실행할 때 `resolveLevel`이 색을 정해 돌 색을 바꾼다.
   * 학습자 코드가 받는 state는 내 관점(1 나, 2 상대)이라 어느 색이든 판 모양이 같다.
   */
  randomColor?: boolean
  /** 시작할 때 판 위에 있는 돌 (절대 색) */
  stones: LevelStone[]
  /** 상대가 마지막으로 둔 돌 (state["last_move"]). 없으면 null */
  lastMove: [number, number] | null
  /** 레벨 목록 카드에 보여 줄 판. 없으면 stones를 보여 준다 */
  preview?: LevelStone[]
  /** 에디터에 처음 채워 둘 코드 */
  starter: string
}

/** 주어진 판에서 play(state)를 한 번 불러, 돌려준 한 수가 이기는 수이면 통과한다. (판정: judgeMove) */
export interface FindWinLevel extends LevelBase {
  kind: 'find-win'
}

/**
 * 빈 판에서 상대(방해하지 않는 AI)와 번갈아 두며, 정해진 방향으로 연속 5개를 만들면 통과한다.
 * 내가 둔 수가 maxMoves번을 넘기면 실패한다. (판정: judgeLineResult)
 */
export interface LineLevel extends LevelBase {
  kind: 'make-line'
  direction: LineDirection
  maxMoves: number
}

/**
 * 상대(백)가 한 수만 더 두면 5목이 되는 판에서, 내 play(state)가 그 위협을 막는 한 수를 두면 통과한다.
 * 내 수를 둔 뒤 상대가 한 수로 이길 수 있는 칸이 남아 있지 않아야 한다. (판정: judgeBlock)
 */
export interface BlockLevel extends LevelBase {
  kind: 'block'
  /**
   * 막아야 할 상대의 공격. 없으면 "한 수로 5목"이고, 있으면 상대가 한 수로 그 모양(3-3, 4-4, 4-3)을
   * 만들 수 있는 칸이 남지 않아야 통과한다. (판정: judgeBlock)
   */
  threat?: AttackKind
}

/**
 * 주어진 판에서 play(state)를 한 번 불러, 돌려준 한 수로 "열린 4"(양쪽 끝이 모두 비어 있는 연속된 4개)를
 * 만들면 통과한다. 열린 4는 상대가 한쪽만 막을 수 있어서 다음 수에 반드시 5목이 된다. (판정: judgeOpenFour)
 */
export interface OpenFourLevel extends LevelBase {
  kind: 'open-four'
}

/**
 * 내 돌과 상대 돌이 함께 위협하는 판에서 "공격할지 막을지" 고르는 레벨. 내가 한 수로 이길 수 있으면 그 수(5목)를 두어야
 * 통과하고, 이길 수 없으면 상대가 한 수로 5목을 만들 칸을 막아야 통과한다. (판정: judgeDecide)
 */
export interface DecideLevel extends LevelBase {
  kind: 'decide'
}

/**
 * "2수 안에 이기기": 주어진 판에서 play(state)를 한 번 불러, 돌려준 한 수 때문에 상대가 어떻게 막아도 다음 내 수로
 * 5목이 되면 통과한다. 곧 내 수를 둔 뒤 내가 한 수로 5목을 만들 칸이 둘 이상이고, 상대에게는 먼저 이길 칸이 없어야 한다.
 * (판정: judgeWinInTwo) 흑은 3-3, 4-4가 금수라서 흑 레벨은 열린 4로, 백 레벨은 4-4로 만든다.
 */
export interface WinInTwoLevel extends LevelBase {
  kind: 'win-in-two'
}

export type TutorialLevel = FindWinLevel | LineLevel | BlockLevel | OpenFourLevel | DecideLevel | WinInTwoLevel

/** 레벨 목록에서 유형별로 묶어 보여 주는 단위. 새 레벨을 만들면 알맞은 묶음의 ids에 추가한다. */
export const CHAPTERS: { name: string; ids: number[] }[] = [
  { name: '연속 두기', ids: [1, 2, 3] },
  { name: '마지막 한 수', ids: [4, 5, 6] },
  { name: '공격 막기', ids: [7, 8, 9] },
  { name: '모양 막기', ids: [10, 11, 12] },
  { name: '열린 4 만들기', ids: [13, 14] },
  { name: '막을까 공격할까', ids: [15, 16] },
  { name: '2수 안에 이기기', ids: [17, 18] },
  { name: '랜덤 색 2수 안에 이기기', ids: [19, 20] },
]

export const chapterNameOf = (id: number): string => CHAPTERS.find((c) => c.ids.includes(id))?.name ?? ''

/** 랜덤 색 레벨을 이번 실행의 색으로 확정한다. 흑이 나인 기준 판을 color 기준으로 바꾼다. 랜덤 색 레벨이 아니면 그대로. */
export function resolveLevel<L extends TutorialLevel>(level: L, color: 'black' | 'white'): L {
  if (!level.randomColor || color === level.myColor) return level
  const swap = (c: 'black' | 'white'): 'black' | 'white' => (c === 'black' ? 'white' : 'black')
  return { ...level, myColor: color, stones: level.stones.map((s) => ({ ...s, color: swap(s.color) })) }
}

export const colorOf = (c: 'black' | 'white'): Color => (c === 'black' ? 1 : 2)

const black = (row: number, col: number): LevelStone => ({ row, col, color: 'black' })
const white = (row: number, col: number): LevelStone => ({ row, col, color: 'white' })

const lineStarter = () => `def play(state):
    board = state["board"]
    return (7, 7)
`

/** 새 레벨은 끝에 추가한다. id는 겹치지 않게 정한다(저장된 코드와 통과 기록이 id로 구분된다). */
export const LEVELS: TutorialLevel[] = [
  {
    id: 1,
    kind: 'make-line',
    direction: 'horizontal',
    maxMoves: 10,
    title: '연속으로 둬서 승리하기 1',
    tag: '가로 5목',
    mission:
      '흑으로 가로 한 줄에 연속 5개를 두세요. 상대는 방해하지 않습니다. 내 차례마다 play(state)가 불리니, 빈 칸을 골라 (행, 열)로 반환하세요.',
    myColor: 'black',
    stones: [],
    lastMove: null,
    preview: [black(7, 5), black(7, 6), black(7, 7), black(7, 8), black(7, 9)],
    starter: lineStarter(),
  },
  {
    id: 2,
    kind: 'make-line',
    direction: 'vertical',
    maxMoves: 10,
    title: '연속으로 둬서 승리하기 2',
    tag: '세로 5목',
    mission: '흑으로 세로 한 줄에 연속 5개를 두세요. 상대는 방해하지 않습니다.',
    myColor: 'black',
    stones: [],
    lastMove: null,
    preview: [black(5, 7), black(6, 7), black(7, 7), black(8, 7), black(9, 7)],
    starter: lineStarter(),
  },
  {
    id: 3,
    kind: 'make-line',
    direction: 'diagonal',
    maxMoves: 10,
    title: '연속으로 둬서 승리하기 3',
    tag: '대각선 5목',
    mission:
      '흑으로 대각선 한 줄에 연속 5개를 두세요. 어느 쪽 대각선이든 괜찮습니다. 상대는 방해하지 않습니다.',
    myColor: 'black',
    stones: [],
    lastMove: null,
    preview: [black(5, 5), black(6, 6), black(7, 7), black(8, 8), black(9, 9)],
    starter: lineStarter(),
  },
  {
    id: 4,
    kind: 'find-win',
    title: '마지막 한 수 두기 1',
    tag: '가로 · 한 수로 승리',
    mission: '내 흑돌 4개가 한 줄로 놓여 있습니다. 한 수로 5목을 완성해 이기는 칸을 찾아 (행, 열)로 반환하세요.',
    myColor: 'black',
    stones: [
      black(7, 5),
      black(7, 6),
      black(7, 7),
      black(7, 8),
      white(7, 4),
      white(8, 6),
      white(6, 7),
      white(9, 9),
    ],
    lastMove: [9, 9],
    starter: `def play(state):
    board = state["board"]
    return (0, 0)
`,
  },
  {
    id: 5,
    kind: 'find-win',
    title: '마지막 한 수 두기 2',
    tag: '세로 · 한 수로 승리',
    mission:
      '세로로 내 흑돌 4개가 이어져 있고, 한쪽 끝은 상대의 돌로 막혀 있습니다. 반대쪽 끝의 빈 칸에 두어 5목을 완성하는 칸을 찾아 (행, 열)로 반환하세요.',
    myColor: 'black',
    stones: [
      black(5, 7),
      black(6, 7),
      black(7, 7),
      black(8, 7),
      white(4, 7),
      white(6, 6),
      white(8, 8),
      white(10, 3),
    ],
    lastMove: [10, 3],
    starter: `def play(state):
    board = state["board"]
    return (0, 0)
`,
  },
  {
    id: 6,
    kind: 'find-win',
    title: '마지막 한 수 두기 3',
    tag: '대각선 · 한 수로 승리',
    mission:
      '대각선으로 내 흑돌 4개가 이어져 있고, 한쪽 끝은 상대의 돌로 막혀 있습니다. 반대쪽 끝의 빈 칸에 두어 5목을 완성하는 칸을 찾아 (행, 열)로 반환하세요.',
    myColor: 'black',
    stones: [
      black(5, 5),
      black(6, 6),
      black(7, 7),
      black(8, 8),
      white(4, 4),
      white(6, 7),
      white(7, 6),
      white(11, 2),
    ],
    lastMove: [11, 2],
    starter: `def play(state):
    board = state["board"]
    return (0, 0)
`,
  },
  {
    id: 7,
    kind: 'block',
    title: '공격 막기 1',
    tag: '가로 · 4목 막기',
    mission:
      '상대의 백돌 4개가 가로로 이어져 있고, 한쪽 끝은 내 돌로 막혀 있습니다. 상대가 다음 수로 5목을 만들지 못하도록 막는 칸을 찾아 (행, 열)로 반환하세요.',
    myColor: 'black',
    stones: [
      white(7, 5),
      white(7, 6),
      white(7, 7),
      white(7, 8),
      black(7, 4),
      black(6, 6),
      black(8, 8),
      black(10, 3),
    ],
    lastMove: [7, 8],
    starter: `def play(state):
    board = state["board"]
    return (0, 0)
`,
  },
  {
    id: 8,
    kind: 'block',
    title: '공격 막기 2',
    tag: '세로 · 2-빈칸-2 막기',
    mission:
      '상대의 백돌이 세로로 2개, 빈 칸 하나, 2개 순서로 놓여 있습니다. 가운데 빈 칸에 상대가 두면 5목이 됩니다. 이를 막는 칸을 찾아 (행, 열)로 반환하세요.',
    myColor: 'black',
    stones: [
      white(4, 7),
      white(5, 7),
      white(7, 7),
      white(8, 7),
      black(6, 6),
      black(9, 8),
      black(3, 3),
      black(10, 11),
    ],
    lastMove: [8, 7],
    starter: `def play(state):
    board = state["board"]
    return (0, 0)
`,
  },
  {
    id: 9,
    kind: 'block',
    title: '공격 막기 3',
    tag: '대각선 · 3-빈칸-1 막기',
    mission:
      '상대의 백돌이 대각선으로 3개, 빈 칸 하나, 1개 순서로 놓여 있습니다. 가운데 빈 칸에 상대가 두면 5목이 됩니다. 이를 막는 칸을 찾아 (행, 열)로 반환하세요.',
    myColor: 'black',
    stones: [
      white(4, 4),
      white(5, 5),
      white(6, 6),
      white(8, 8),
      black(6, 7),
      black(8, 6),
      black(3, 10),
      black(11, 4),
    ],
    lastMove: [8, 8],
    starter: `def play(state):
    board = state["board"]
    return (0, 0)
`,
  },
  {
    id: 10,
    kind: 'block',
    threat: 'three-three',
    title: '3-3 막기',
    tag: '열린 삼 두 개 막기',
    mission:
      '상대(백)가 한 칸에 두면 열린 삼 두 개가 한꺼번에 생기는 자리(3-3)가 있습니다. 그대로 두면 막기 어려워집니다. 상대가 3-3 모양을 만들 수 없게 막는 칸을 찾아 (행, 열)로 반환하세요.',
    myColor: 'black',
    stones: [
      white(7, 5),
      white(7, 6),
      white(5, 5),
      white(6, 6),
      black(3, 3),
      black(10, 10),
      black(9, 4),
      black(4, 9),
    ],
    lastMove: [6, 6],
    starter: `def play(state):
    board = state["board"]
    return (0, 0)
`,
  },
  {
    id: 11,
    kind: 'block',
    threat: 'four-four',
    title: '4-4 막기',
    tag: '4목 두 개 막기',
    mission:
      '상대(백)가 한 칸에 두면 4목 두 개가 한꺼번에 생기는 자리(4-4)가 있습니다. 두 곳을 다 막을 수는 없으니 미리 막아야 합니다. 상대가 4-4 모양을 만들 수 없게 막는 칸을 찾아 (행, 열)로 반환하세요.',
    myColor: 'black',
    stones: [
      white(4, 7),
      white(5, 7),
      white(6, 7),
      white(6, 8),
      white(5, 9),
      white(4, 10),
      black(3, 7),
      black(8, 6),
      black(10, 3),
      black(11, 11),
    ],
    lastMove: [4, 10],
    starter: `def play(state):
    board = state["board"]
    return (0, 0)
`,
  },
  {
    id: 12,
    kind: 'block',
    threat: 'four-three',
    title: '4-3 막기',
    tag: '4목 + 열린 삼 막기',
    mission:
      '상대(백)가 한 칸에 두면 4목 하나와 열린 삼 하나가 한꺼번에 생기는 자리(4-3)가 있습니다. 4목을 막으면 열린 삼이 열린 사가 되어 막을 수 없습니다. 상대가 4-3 모양을 만들 수 없게 막는 칸을 찾아 (행, 열)로 반환하세요.',
    myColor: 'black',
    stones: [
      white(7, 4),
      white(7, 5),
      white(7, 6),
      white(5, 7),
      white(6, 7),
      black(7, 3),
      black(10, 10),
      black(3, 11),
      black(9, 4),
    ],
    lastMove: [6, 7],
    starter: `def play(state):
    board = state["board"]
    return (0, 0)
`,
  },
  {
    id: 13,
    kind: 'open-four',
    title: '열린 4 만들기 1',
    tag: '연속된 3 → 열린 4',
    mission:
      '내 흑돌 3개가 가로로 이어져 있고 양쪽이 모두 열려 있습니다. 한 수를 더 두어 양쪽 끝이 모두 열린 연속된 4개(열린 4)를 만드는 칸을 찾아 (행, 열)로 반환하세요. 열린 4는 상대가 한쪽만 막을 수 있어서 다음 수에 5목이 됩니다.',
    myColor: 'black',
    stones: [
      black(7, 6),
      black(7, 7),
      black(7, 8),
      white(6, 7),
      white(8, 6),
      white(9, 9),
    ],
    lastMove: [9, 9],
    starter: `def play(state):
    board = state["board"]
    return (0, 0)
`,
  },
  {
    id: 14,
    kind: 'open-four',
    title: '열린 4 만들기 2',
    tag: '2 + 빈칸 + 1 → 열린 4',
    mission:
      '내 흑돌이 대각선으로 2개, 빈 칸 하나, 1개 순서로 놓여 있습니다. 그 빈 칸에 두면 열린 4가 됩니다. 한 수로 열린 4를 만드는 칸을 찾아 (행, 열)로 반환하세요.',
    myColor: 'black',
    stones: [
      black(5, 5),
      black(6, 6),
      black(8, 8),
      white(7, 6),
      white(6, 7),
      white(10, 3),
    ],
    lastMove: [10, 3],
    starter: `def play(state):
    board = state["board"]
    return (0, 0)
`,
  },
  {
    id: 15,
    kind: 'decide',
    title: '막을까 공격할까 1',
    tag: '상대 4목, 내 열린 3',
    mission:
      '상대 백돌이 한 수만 더 두면 5목이 됩니다. 내 흑돌은 아직 4목도 못 만든 상태입니다. 지금 내 차례에 둘 최선의 한 수를 찾아 (행, 열)로 반환하세요. 이길 수 있으면 이기고, 이길 수 없으면 상대의 5목을 막아야 합니다.',
    myColor: 'black',
    stones: [
      white(3, 10),
      white(4, 10),
      white(5, 10),
      white(6, 10),
      black(2, 10),
      black(7, 5),
      black(8, 6),
      black(9, 7),
      white(10, 4),
    ],
    lastMove: [6, 10],
    starter: `def play(state):
    board = state["board"]
    return (0, 0)
`,
  },
  {
    id: 16,
    kind: 'decide',
    title: '막을까 공격할까 2',
    tag: '내 4목, 상대 열린 3',
    mission:
      '내 흑돌 4개가 가로로 놓여 있고 가운데가 비어 있습니다. 상대 백돌도 대각선으로 3개가 이어져 있습니다. 지금 내 차례에 둘 최선의 한 수를 찾아 (행, 열)로 반환하세요. 이길 수 있으면 이기고, 이길 수 없으면 상대의 5목을 막아야 합니다.',
    myColor: 'black',
    stones: [
      black(9, 4),
      black(9, 5),
      black(9, 7),
      black(9, 8),
      white(3, 3),
      white(4, 4),
      white(5, 5),
      white(6, 8),
      white(2, 10),
    ],
    lastMove: [5, 5],
    starter: `def play(state):
    board = state["board"]
    return (0, 0)
`,
  },
  {
    id: 17,
    kind: 'win-in-two',
    title: '2수 안에 이기기 1',
    tag: '열린 3로 2수 안에 승리',
    mission:
      '지금 한 수를 두면 상대가 어떻게 막아도 다음 내 수로 반드시 5목을 만들 수 있는 판입니다. 그런 칸을 찾아 (행, 열)로 반환하세요. 가로 3개는 한쪽이 막혀 있고, 세로 3개는 양쪽이 열려 있습니다.',
    myColor: 'black',
    stones: [
      black(7, 4),
      black(7, 5),
      black(7, 6),
      white(7, 3),
      black(4, 10),
      black(5, 10),
      black(6, 10),
      white(9, 8),
      white(2, 2),
      white(11, 5),
    ],
    lastMove: [9, 8],
    starter: `def play(state):
    board = state["board"]
    return (0, 0)
`,
  },
  {
    id: 18,
    kind: 'win-in-two',
    title: '2수 안에 이기기 2',
    tag: '백으로 4-4를 만들어 승리',
    mission:
      '이번에는 내가 백입니다. 한 수를 두면 5목 자리가 두 곳 생깁니다. 상대가 막아도 다음 수에 이깁니다. 그런 칸을 찾아 (행, 열)로 반환하세요. 백에게는 금수가 없습니다.',
    myColor: 'white',
    stones: [
      white(4, 7),
      white(5, 7),
      white(6, 7),
      white(6, 8),
      white(5, 9),
      white(4, 10),
      black(3, 7),
      black(8, 6),
      black(2, 12),
      black(10, 3),
      black(11, 11),
    ],
    lastMove: [8, 6],
    starter: `def play(state):
    board = state["board"]
    return (0, 0)
`,
  },
  // 19, 20은 randomColor 레벨이라 stones는 "흑이 나, 백이 상대" 기준이다
  // 상대가 4목이라 반드시 막아야 하고, 막는 칸이 동시에 내 열린 4가 된다 (막은 뒤 다음 수에 이긴다)
  {
    id: 19,
    kind: 'win-in-two',
    randomColor: true,
    title: '막으면서 이기기 1',
    tag: '흑 또는 백 · 막고 열린 4',
    mission:
      '내 돌의 색은 실행할 때마다 흑 또는 백으로 정해집니다. 상대가 한 수만 더 두면 5목이 됩니다. 막으면서 5목 자리를 두 곳 만드는 칸을 찾으세요. 그 칸을 (행, 열)로 반환하세요.',
    myColor: 'black',
    stones: [
      white(4, 3),
      white(4, 4),
      white(4, 5),
      white(4, 6),
      black(4, 2),
      black(5, 7),
      black(6, 7),
      black(7, 7),
      white(10, 10),
      white(9, 3),
    ],
    lastMove: [4, 6],
    starter: `def play(state):
    board = state["board"]
    my_color = state["my_color"]  # "black" 또는 "white" (실행할 때마다 달라집니다)
    return (0, 0)
`,
  },
  {
    id: 20,
    kind: 'win-in-two',
    randomColor: true,
    title: '막으면서 이기기 2',
    tag: '흑 또는 백 · 대각선 4목 막기',
    mission:
      '내 돌의 색은 실행할 때마다 흑 또는 백으로 정해집니다. 상대의 4목을 막아야 합니다. 막은 뒤 2수 안에 이길 수 있는 칸을 찾으세요. 그 칸을 (행, 열)로 반환하세요.',
    myColor: 'black',
    stones: [
      white(3, 11),
      white(4, 10),
      white(5, 9),
      white(6, 8),
      black(2, 12),
      black(7, 5),
      black(7, 6),
      black(7, 8),
      black(9, 3),
      black(10, 3),
      black(11, 3),
      white(12, 12),
      white(1, 5),
    ],
    lastMove: [6, 8],
    starter: `def play(state):
    board = state["board"]
    my_color = state["my_color"]  # "black" 또는 "white" (실행할 때마다 달라집니다)
    return (0, 0)
`,
  },
]
