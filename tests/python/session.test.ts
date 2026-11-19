import { loadPyodide } from 'pyodide'
import { beforeAll, describe, expect, test } from 'vitest'
import { Game } from '../../src/engine/game'
import { HARNESS_PY } from '../../src/python/harness'
import { createPythonSession } from '../../src/python/session'
import type { PyodideLike } from '../../src/python/session'
import { STARTER_CODE } from '../../src/python/starter'
import { buildPlayerState } from '../../src/runner/playerState'

let session: ReturnType<typeof createPythonSession>

beforeAll(async () => {
  const py = await loadPyodide()
  py.runPython(HARNESS_PY)
  session = createPythonSession(py as unknown as PyodideLike)
}, 60_000)

const emptyState = () => buildPlayerState(new Game(), 1)

function loadOk(code: string) {
  const result = session.load(code)
  if (!result.ok) throw new Error('load 실패: ' + result.failure.message)
  return result
}

describe('load', () => {
  test('예제 코드는 return (7, 7)만 있는 함수이다', () => {
    expect(loadOk(STARTER_CODE)).toEqual({ ok: true })
    expect(session.choose(emptyState())).toMatchObject({ ok: true, move: { row: 7, col: 7 } })
    expect(STARTER_CODE).toContain('return (7, 7)')
    expect(STARTER_CODE).not.toContain('for ')
    expect(STARTER_CODE).not.toContain('if ')
  })

  test('예제 코드에는 NAME 변수가 없다', () => {
    expect(STARTER_CODE).not.toContain('NAME')
  })

  test('코드에 NAME 변수가 있어도 아무 기능이 없고, load 결과에 이름이 담기지 않는다', () => {
    expect(loadOk('NAME = "팀"\ndef play(state):\n    return (1, 2)\n')).toEqual({ ok: true })
  })

  test('문법 오류: kind syntax와 줄 번호', () => {
    const result = session.load('def play(state:\n    return (1, 2)\n')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.failure.kind).toBe('syntax')
      expect(typeof result.failure.line).toBe('number')
      expect(result.failure.message).toContain('문법 오류')
    }
  })

  test('최상위 실행 중 예외: kind exception, 예외 이름과 줄 번호', () => {
    const result = session.load('x = 1 / 0\ndef play(state):\n    return (0, 0)\n')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.failure.kind).toBe('exception')
      expect(result.failure.message).toContain('ZeroDivisionError')
      expect(result.failure.line).toBe(1)
    }
  })

  test('play 함수가 없으면 안내 오류', () => {
    const result = session.load('x = 1\n')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.failure.kind).toBe('missing-function')
      expect(result.failure.message).toContain('play(state)')
    }
  })

  test('예전 이름 choose만 있는 코드는 이름이 play로 바뀌었다고 안내한다', () => {
    const result = session.load('def choose(state):\n    return (1, 2)\n')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.failure.kind).toBe('missing-function')
      expect(result.failure.message).toContain('choose')
      expect(result.failure.message).toContain('def play(state)')
    }
  })

  test('play와 choose가 모두 있으면 play를 쓴다', () => {
    loadOk('def choose(state):\n    return (9, 9)\ndef play(state):\n    return (1, 2)\n')
    expect(session.choose(emptyState())).toMatchObject({ ok: true, move: { row: 1, col: 2 } })
  })

  test('표준 라이브러리 import가 동작한다', () => {
    loadOk('import math\ndef play(state):\n    return (int(math.sqrt(49)), 7)\n')
    expect(session.choose(emptyState())).toMatchObject({ ok: true, move: { row: 7, col: 7 } })
  })
})

describe('choose', () => {
  test('예외: kind exception, 메시지, 줄 번호', () => {
    loadOk('def play(state):\n    # 주석\n    raise ValueError("x")\n')
    const result = session.choose(emptyState())
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.failure.kind).toBe('exception')
      expect(result.failure.message).toBe('ValueError: x')
      expect(result.failure.line).toBe(3)
    }
  })

  test('sys.exit() 같은 시스템 종료 예외도 오류로 안내된다', () => {
    loadOk('import sys\ndef play(state):\n    sys.exit(1)\n')
    const result = session.choose(emptyState())
    expect(result.ok).toBe(false)
  })

  test.each([
    ['None', 'None'],
    ['5', '5'],
    ['(1,)', '(1,)'],
    ['(1, 2, 3)', '(1, 2, 3)'],
    ['(True, 1)', '(True, 1)'],
    ['(1.5, 2)', '(1.5, 2)'],
    ['"ab"', "'ab'"],
  ])('잘못된 반환값 %s → bad-return', (expr, shown) => {
    loadOk(`def play(state):\n    return ${expr}\n`)
    const result = session.choose(emptyState())
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.failure.kind).toBe('bad-return')
      expect(result.failure.message).toContain('(행, 열)')
      expect(result.failure.message).toContain(shown)
    }
  })

  test.each(['[3, 4]', '(3, 4)'])('올바른 반환값 %s', (expr) => {
    loadOk(`def play(state):\n    return ${expr}\n`)
    expect(session.choose(emptyState())).toMatchObject({ ok: true, move: { row: 3, col: 4 } })
  })

  test('전역 변수는 한 판 동안 유지되고, 다시 load하면 초기화된다', () => {
    const code = 'count = 0\ndef play(state):\n    global count\n    count += 1\n    return (0, count)\n'
    loadOk(code)
    const cols = [1, 2, 3].map((n) => {
      const r = session.choose(emptyState())
      return r.ok ? r.move.col : -n
    })
    expect(cols).toEqual([1, 2, 3])
    loadOk(code)
    const again = session.choose(emptyState())
    expect(again.ok && again.move.col).toBe(1)
  })

  test('state를 바꿔도 JS 쪽 값과 다음 호출에는 영향이 없다', () => {
    loadOk(
      'def play(state):\n' +
        '    n = state["board"][0][0]\n' +
        '    state["board"][0][0] = 9\n' +
        '    return (n, 3)\n',
    )
    const state = emptyState()
    const first = session.choose(state)
    const second = session.choose(state)
    expect(state.board[0][0]).toBe(0)
    expect(first).toEqual(second)
    expect(first).toMatchObject({ ok: true, move: { row: 0, col: 3 } })
  })

  test('print 출력이 stdout으로 전달된다', () => {
    loadOk('def play(state):\n    print("hi")\n    return (0, 0)\n')
    const result = session.choose(emptyState())
    expect(result.ok && result.stdout).toContain('hi')
  })

  test('아주 긴 출력은 잘린다', () => {
    loadOk('def play(state):\n    print("x" * 10000)\n    return (0, 0)\n')
    const result = session.choose(emptyState())
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.stdout.length).toBeLessThanOrEqual(2100)
      expect(result.stdout).toContain('이하 생략')
    }
  })

  test('예외가 나도 그 전까지의 print 출력이 stdout에 담긴다', () => {
    loadOk('def play(state):\n    print("전")\n    raise RuntimeError("후")\n')
    const result = session.choose(emptyState())
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.failure.stdout).toContain('전')
  })

  test('last_move는 상대가 마지막으로 둔 돌의 (행, 열) 튜플이다', () => {
    loadOk('def play(state):\n    print(state["last_move"])\n    return (0, 0)\n')

    const twoMoves = new Game()
    twoMoves.play({ row: 7, col: 7 }) // 흑
    twoMoves.play({ row: 7, col: 8 }) // 백
    const blackTurn = session.choose(buildPlayerState(twoMoves, 1)) // 상대(백)의 마지막 수
    expect(blackTurn.ok && blackTurn.stdout).toContain('(7, 8)')

    const oneMove = new Game()
    oneMove.play({ row: 7, col: 7 }) // 흑
    const whiteTurn = session.choose(buildPlayerState(oneMove, 2)) // 상대(흑)의 마지막 수
    expect(whiteTurn.ok && whiteTurn.stdout).toContain('(7, 7)')
  })

  test('state에는 board, last_move, my_last_move, my_color 네 항목만 있다 (move_number, history, legal_moves 없음)', () => {
    loadOk(
      'def play(state):\n' +
        '    keys = sorted(state.keys())\n' +
        '    ok = state["last_move"] is None and state["my_last_move"] is None\n' +
        '    print(keys, ok, state["my_color"])\n' +
        '    return (0, 0)\n',
    )
    const result = session.choose(emptyState())
    expect(result.ok && result.stdout).toContain(
      "['board', 'last_move', 'my_color', 'my_last_move'] True black",
    )
  })

  test('my_last_move는 내가 마지막으로 둔 돌의 (행, 열) 튜플이다', () => {
    loadOk('def play(state):\n    print(state["my_last_move"], state["last_move"])\n    return (0, 0)\n')
    const g = new Game()
    g.play({ row: 7, col: 7 }) // 흑
    g.play({ row: 7, col: 8 }) // 백
    g.play({ row: 8, col: 7 }) // 흑
    const result = session.choose(buildPlayerState(g, 2)) // 백: 내 마지막 (7, 8), 상대 마지막 (8, 7)
    expect(result.ok && result.stdout).toContain('(7, 8) (8, 7)')
  })
})
