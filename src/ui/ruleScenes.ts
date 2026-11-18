import type { ForbiddenReason } from '../engine/forbidden'

export type Tone = 'danger' | 'ok'

export interface SceneStone {
  r: number
  c: number
  color: 'black' | 'white'
}

export interface SceneLine {
  /** 강조할 줄의 칸들 (같은 가로 또는 세로줄) */
  cells: [number, number][]
  label: string
  tone: Tone
}

/**
 * 금수 설명 그림 한 장면. 9×9 창 안에서 "흑이 목표 자리에 두면 어떻게 되는가"를 네 단계로 보여준다.
 * 단계 0: 돌 배치 / 1: 목표 자리 표시 / 2: 두었을 때 만들어지는 줄 / 3: 결론.
 * `expected`가 실제 규칙 엔진의 판정과 같은지는 tests/ui/ruleScenes.test.ts가 확인한다.
 */
export interface RuleScene {
  id: 'overline' | 'double-four' | 'double-three' | 'exception'
  title: string
  summary: string
  size: number
  stones: SceneStone[]
  target: { r: number; c: number }
  lines: SceneLine[]
  /** 금수 종류. 금수가 아니면 null */
  expected: ForbiddenReason | null
  captions: [string, string, string, string]
  /** 팝업에 글로 보여줄 설명 */
  details: string[]
}

const black = (r: number, c: number): SceneStone => ({ r, c, color: 'black' })
const white = (r: number, c: number): SceneStone => ({ r, c, color: 'white' })

export const SCENES: RuleScene[] = [
  {
    id: 'overline',
    title: '장목 (6목 이상)',
    summary: '6개 이상 이어지는 수',
    size: 9,
    stones: [black(4, 1), black(4, 2), black(4, 3), black(4, 5), black(4, 6), black(4, 7)],
    target: { r: 4, c: 4 },
    lines: [
      {
        cells: [
          [4, 1],
          [4, 2],
          [4, 3],
          [4, 4],
          [4, 5],
          [4, 6],
          [4, 7],
        ],
        label: '7개',
        tone: 'danger',
      },
    ],
    expected: 'overline',
    captions: [
      '흑돌이 ●●●_●●● 모양으로 놓여 있습니다.',
      '가운데 빈 칸에 흑이 두려고 합니다.',
      '두면 한 줄에 흑돌이 7개가 이어집니다.',
      '6개 이상(장목)은 금수입니다.',
    ],
    details: [
      '한 줄에 흑돌 6개 이상이 이어지는 수는 금수입니다.',
      '흑은 정확히 5개를 이어야 이깁니다.',
      '다른 방향에서 5목이 완성돼도 장목이면 금수입니다.',
    ],
  },
  {
    id: 'double-four',
    title: '사사 (4-4)',
    summary: '사를 둘 이상 만드는 수',
    size: 9,
    stones: [
      black(4, 1),
      black(4, 2),
      black(4, 3),
      white(4, 0),
      black(1, 4),
      black(2, 4),
      black(3, 4),
      white(0, 4),
    ],
    target: { r: 4, c: 4 },
    lines: [
      {
        cells: [
          [4, 1],
          [4, 2],
          [4, 3],
          [4, 4],
        ],
        label: '사',
        tone: 'danger',
      },
      {
        cells: [
          [1, 4],
          [2, 4],
          [3, 4],
          [4, 4],
        ],
        label: '사',
        tone: 'danger',
      },
    ],
    expected: 'double-four',
    captions: [
      '가로·세로에 흑돌이 3개씩, 한쪽은 백돌로 막혀 있습니다.',
      '두 줄이 만나는 빈 칸에 흑이 두려고 합니다.',
      '가로와 세로에서 동시에 "사"가 만들어집니다.',
      '한 수로 사를 둘 이상 만드는 사사(4-4)는 금수입니다.',
    ],
    details: [
      '"사"는 한 수만 더 두면 정확히 5개가 되는 줄입니다.',
      '가운데가 비어 있어도 사입니다(●●●_●).',
      '한 줄에서 5목 자리가 둘이어도 사사입니다(●_●●●_●).',
      '양쪽이 열린 연속 4개(열린 사)는 하나로 셉니다.',
    ],
  },
  {
    id: 'double-three',
    title: '삼삼 (3-3)',
    summary: '열린 삼을 둘 이상 만드는 수',
    size: 9,
    stones: [black(4, 2), black(4, 3), black(2, 4), black(3, 4)],
    target: { r: 4, c: 4 },
    lines: [
      {
        cells: [
          [4, 2],
          [4, 3],
          [4, 4],
        ],
        label: '삼',
        tone: 'danger',
      },
      {
        cells: [
          [2, 4],
          [3, 4],
          [4, 4],
        ],
        label: '삼',
        tone: 'danger',
      },
    ],
    expected: 'double-three',
    captions: [
      '가로·세로에 흑돌이 2개씩, 양쪽 끝이 열려 있습니다.',
      '두 줄이 만나는 빈 칸에 흑이 두려고 합니다.',
      '가로와 세로에서 동시에 "열린 삼"이 만들어집니다.',
      '열린 삼을 둘 이상 만드는 삼삼(3-3)은 금수입니다.',
    ],
    details: [
      '"열린 삼"은 한 수 더 두면 열린 사가 되는 줄입니다.',
      '열린 사는 양쪽이 열린 연속 4개입니다.',
      '한쪽이 막힌 삼은 세지 않습니다.',
      '열린 사를 만드는 자리가 금수면 열린 삼이 아닙니다.',
    ],
  },
  {
    id: 'exception',
    title: '예외 (5목 완성)',
    summary: '5목 완성이면 금수 아님',
    size: 9,
    stones: [black(4, 1), black(4, 2), black(4, 3), black(4, 4), black(2, 5), black(3, 5)],
    target: { r: 4, c: 5 },
    lines: [
      {
        cells: [
          [4, 1],
          [4, 2],
          [4, 3],
          [4, 4],
          [4, 5],
        ],
        label: '5목',
        tone: 'ok',
      },
    ],
    expected: null,
    captions: [
      '가로에 흑돌 4개, 세로에 흑돌 2개가 있습니다.',
      '교차점의 빈 칸에 흑이 두려고 합니다.',
      '가로로 정확히 5개가 완성됩니다.',
      '정확히 5목이 되는 수는 금수가 아니라 승리입니다.',
    ],
    details: [
      '삼삼, 사사여도 정확히 5개가 완성되면 금수가 아닙니다.',
      '세로가 삼 모양이 되는 것은 상관없습니다.',
      '단, 장목(6개 이상)은 예외가 없습니다.',
    ],
  },
]
