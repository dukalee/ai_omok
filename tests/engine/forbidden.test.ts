import { describe, expect, test } from 'vitest'
import { cloneBoard, createBoard, placeStone } from '../../src/engine/board'
import { getForbiddenReason, isLegalMove } from '../../src/engine/forbidden'
import type { Board } from '../../src/engine/types'

function boardWith(black: [number, number][], white: [number, number][] = []): Board {
  const b = createBoard()
  for (const [row, col] of black) placeStone(b, { row, col }, 1)
  for (const [row, col] of white) placeStone(b, { row, col }, 2)
  return b
}

const at = (row: number, col: number) => ({ row, col })

describe('장목', () => {
  test('여섯 개가 이어지면 금수이다', () => {
    const b = boardWith([[7, 3], [7, 4], [7, 5], [7, 7], [7, 8]])
    expect(getForbiddenReason(b, at(7, 6))).toBe('overline')
  })

  test('정확히 다섯 개가 되는 수는 금수가 아니다', () => {
    const b = boardWith([[7, 3], [7, 4], [7, 5], [7, 6]])
    expect(getForbiddenReason(b, at(7, 7))).toBeNull()
  })

  test('다른 방향에서 오목이 완성되어도 장목이 생기면 금수이다', () => {
    const b = boardWith([
      [7, 3], [7, 4], [7, 5], [7, 7], [7, 8], // (7,6)을 두면 가로 6목
      [3, 6], [4, 6], [5, 6], [6, 6], // (7,6)을 두면 세로 정확히 5목
    ])
    expect(getForbiddenReason(b, at(7, 6))).toBe('overline')
  })

  test('일곱 개 이상도 금수이다', () => {
    const b = boardWith([[7, 2], [7, 3], [7, 4], [7, 6], [7, 7], [7, 8]])
    expect(getForbiddenReason(b, at(7, 5))).toBe('overline')
  })
})

describe('사사', () => {
  test('서로 다른 두 방향에서 사가 만들어지면 금수이다', () => {
    const b = boardWith(
      [[7, 4], [7, 5], [7, 6], [4, 7], [5, 7], [6, 7]],
      [[7, 3], [3, 7]], // 양쪽을 막아 열린 사가 아니라 막힌 사로 만든다
    )
    expect(getForbiddenReason(b, at(7, 7))).toBe('double-four')
  })

  test('한 줄에서 완성 자리가 둘인 사사(●_●●●_●)도 금수이다', () => {
    const b = boardWith([[7, 2], [7, 4], [7, 6], [7, 8]])
    expect(getForbiddenReason(b, at(7, 5))).toBe('double-four')
  })

  test('사 하나는 금수가 아니다', () => {
    const b = boardWith([[7, 4], [7, 5], [7, 6]], [[7, 3]])
    expect(getForbiddenReason(b, at(7, 7))).toBeNull()
  })

  test('열린 사(양쪽이 열린 연속 네 개) 하나는 금수가 아니다', () => {
    const b = boardWith([[7, 4], [7, 5], [7, 6]])
    expect(getForbiddenReason(b, at(7, 7))).toBeNull()
  })

  test('중간이 비어 있는 사(●●●_●) 하나는 금수가 아니다', () => {
    // (7,6)을 두면 (7,4)(7,5)(7,6)_(7,8) 형태가 된다
    const b = boardWith([[7, 4], [7, 5], [7, 8]], [[7, 3]])
    expect(getForbiddenReason(b, at(7, 6))).toBeNull()
  })
})

describe('삼삼', () => {
  const twoThrees: [number, number][] = [[7, 5], [7, 6], [5, 7], [6, 7]]

  test('서로 다른 두 방향에서 열린 삼이 만들어지면 금수이다', () => {
    expect(getForbiddenReason(boardWith(twoThrees), at(7, 7))).toBe('double-three')
  })

  test('열린 삼 하나는 금수가 아니다', () => {
    expect(getForbiddenReason(boardWith([[7, 5], [7, 6]]), at(7, 7))).toBeNull()
  })

  test('중간이 비어 있는 삼(●●_●)도 열린 삼으로 센다', () => {
    // (7,7)을 두면 가로는 (7,5)_(7,7)(7,8), 세로는 (5,7)(6,7)(7,7)이 된다
    const b = boardWith([[7, 5], [7, 8], [5, 7], [6, 7]])
    expect(getForbiddenReason(b, at(7, 7))).toBe('double-three')
  })

  test('한쪽이 막힌 삼은 열린 삼이 아니므로 삼삼이 아니다', () => {
    const b = boardWith(twoThrees, [[7, 4]])
    expect(getForbiddenReason(b, at(7, 7))).toBeNull()
  })

  test('열린 사를 만드는 자리가 금수이면 그 삼은 열린 삼이 아니다', () => {
    // 가로 삼(5,6,7)은 오른쪽이 백으로 막혀 있어 (7,4)에서만 열린 사가 된다.
    // (7,4)는 세로로 흑 3개씩이 양쪽에 있어 두면 7목(장목)이 되는 금수 자리이다.
    const b = boardWith(
      [[7, 5], [7, 6], [5, 7], [6, 7], [4, 4], [5, 4], [6, 4], [8, 4], [9, 4], [10, 4]],
      [[7, 9]],
    )
    expect(getForbiddenReason(b, at(7, 4))).toBe('overline') // 전제: (7,4)는 금수
    expect(getForbiddenReason(b, at(7, 7))).toBeNull()
  })

  test('위 경우에서 (7,4)가 금수가 아니면 삼삼이다 (대조군)', () => {
    const b = boardWith([[7, 5], [7, 6], [5, 7], [6, 7]], [[7, 9]])
    expect(getForbiddenReason(b, at(7, 4))).toBeNull()
    expect(getForbiddenReason(b, at(7, 7))).toBe('double-three')
  })
})

describe('예외와 경계', () => {
  test('정확히 다섯 개가 완성되면 사사, 삼삼이어도 금수가 아니다', () => {
    const b = boardWith([
      [7, 3], [7, 4], [7, 5], [7, 6], // (7,7)에서 가로 5목
      [4, 7], [5, 7], [6, 7], // 세로로는 사
    ])
    expect(getForbiddenReason(b, at(7, 7))).toBeNull()
  })

  test('판 가장자리 근처에서도 오류 없이 판정한다', () => {
    const b = boardWith([[0, 0], [0, 1], [0, 2], [0, 4], [0, 5]])
    expect(getForbiddenReason(b, at(0, 3))).toBe('overline')
    expect(getForbiddenReason(createBoard(), at(14, 14))).toBeNull()
  })

  test('판을 변경하지 않는다', () => {
    const b = boardWith([[7, 5], [7, 6], [5, 7], [6, 7]])
    const before = cloneBoard(b)
    getForbiddenReason(b, at(7, 7))
    expect(b).toEqual(before)
  })

  test('이미 돌이 있거나 판 밖이면 null (유효성은 별도로 검사한다)', () => {
    const b = boardWith([[7, 7]])
    expect(getForbiddenReason(b, at(7, 7))).toBeNull()
    expect(getForbiddenReason(b, at(-1, 0))).toBeNull()
  })
})

describe('isLegalMove', () => {
  const b = boardWith([[7, 5], [7, 6], [5, 7], [6, 7]])

  test('흑은 금수 자리에 둘 수 없다', () => {
    expect(isLegalMove(b, at(7, 7), 1)).toBe(false)
  })

  test('백은 같은 자리에 둘 수 있다', () => {
    expect(isLegalMove(b, at(7, 7), 2)).toBe(true)
  })

  test('돌이 있는 자리와 판 밖은 누구도 둘 수 없다', () => {
    expect(isLegalMove(b, at(7, 5), 1)).toBe(false)
    expect(isLegalMove(b, at(7, 5), 2)).toBe(false)
    expect(isLegalMove(b, at(15, 0), 2)).toBe(false)
  })
})
