import type { Color } from '../engine/types'

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
  /** 화면에 보여 줄 미션 설명 */
  mission: string
  /** 학습자의 돌 색 (state["my_color"]) */
  myColor: 'black' | 'white'
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

export type TutorialLevel = FindWinLevel | LineLevel

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
    mission:
      '흑으로 가로 한 줄에 연속 5개를 두세요. 상대는 방해하지 않습니다. 내 차례마다 play(state)가 불리니, 빈 칸을 골라 (행, 열)로 반환하세요. 10수 안에 만들어야 합니다.',
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
    mission: '흑으로 세로 한 줄에 연속 5개를 두세요. 상대는 방해하지 않습니다. 10수 안에 만들어야 합니다.',
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
    mission:
      '흑으로 대각선 한 줄에 연속 5개를 두세요. 어느 쪽 대각선이든 괜찮습니다. 상대는 방해하지 않습니다. 10수 안에 만들어야 합니다.',
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
]
