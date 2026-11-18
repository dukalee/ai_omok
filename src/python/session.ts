import type { Move } from '../engine/types'
import type { PlayerFailure, PlayerState } from '../runner/types'

/** Pyodide 중 이 프로젝트가 쓰는 부분. 브라우저 Worker와 Node 테스트가 같은 세션 코드를 쓰게 한다. */
export interface PyodideLike {
  runPython(code: string): unknown
  globals: { get(name: string): ((...args: unknown[]) => unknown) | undefined }
}

export type LoadResult = { ok: true } | { ok: false; failure: PlayerFailure }
export type ChooseResult =
  | { ok: true; move: Move; stdout: string }
  | { ok: false; failure: PlayerFailure }

const internal = (message: string): { ok: false; failure: PlayerFailure } => ({
  ok: false,
  failure: { kind: 'internal', message },
})

/** 학습자 코드에는 board와 last_move만 준다. 색, 수 번호, 기록은 내부용(AI)이라 넘기지 않는다. */
function toLearnerState(state: PlayerState) {
  return { board: state.board, last_move: state.last_move }
}

function parse(text: unknown): Record<string, unknown> | null {
  try {
    const value = JSON.parse(String(text))
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
  } catch {
    return null
  }
}

function toFailure(raw: Record<string, unknown>): PlayerFailure {
  return {
    kind: raw.kind as PlayerFailure['kind'],
    message: String(raw.message),
    line: typeof raw.line === 'number' ? raw.line : null,
    stdout: typeof raw.stdout === 'string' && raw.stdout !== '' ? raw.stdout : undefined,
  }
}

/** 하네스(HARNESS_PY)가 등록된 Pyodide 위에서 학습자 코드를 불러오고 호출한다. */
export function createPythonSession(py: PyodideLike) {
  const loadFn = py.globals.get('omok_load')
  const chooseFn = py.globals.get('omok_choose')
  if (!loadFn || !chooseFn) throw new Error('Python 하네스가 등록되지 않았습니다')

  return {
    load(code: string): LoadResult {
      let raw: Record<string, unknown> | null
      try {
        raw = parse(loadFn(code))
      } catch (error) {
        return internal(`코드를 불러오지 못했습니다: ${String(error)}`)
      }
      if (!raw) return internal('코드를 불러오는 중 알 수 없는 응답이 왔습니다.')
      if (raw.ok === true) return { ok: true }
      return { ok: false, failure: toFailure(raw) }
    },

    /** state는 JSON으로 보내므로 호출마다 Python 쪽에 새 복사본이 만들어진다. */
    choose(state: PlayerState): ChooseResult {
      let raw: Record<string, unknown> | null
      try {
        raw = parse(chooseFn(JSON.stringify(toLearnerState(state))))
      } catch (error) {
        return internal(`play()를 실행하지 못했습니다: ${String(error)}`)
      }
      if (!raw) return internal('play() 결과를 읽지 못했습니다.')
      if (raw.ok === true) {
        const move = raw.move as [number, number]
        return {
          ok: true,
          move: { row: move[0], col: move[1] },
          stdout: typeof raw.stdout === 'string' ? raw.stdout : '',
        }
      }
      return { ok: false, failure: toFailure(raw) }
    },
  }
}
