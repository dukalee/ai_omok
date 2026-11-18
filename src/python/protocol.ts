import type { PlayerState } from '../runner/types'
import type { ChooseResult, LoadResult } from './session'

/** 화면 → Pyodide Worker */
export type WorkerIn =
  | { type: 'init' }
  | { type: 'load'; code: string }
  | { type: 'choose'; id: number; state: PlayerState }

/** Pyodide Worker → 화면 */
export type WorkerOut =
  | { type: 'ready' }
  | { type: 'init-error'; message: string }
  | { type: 'loaded'; result: LoadResult }
  | { type: 'chosen'; id: number; result: ChooseResult }

/** Pyodide 본체는 번들에 넣지 않고 CDN에서 Worker가 불러온다. */
export const PYODIDE_URL: string = 'https://cdn.jsdelivr.net/pyodide/v314.0.8/full/pyodide.mjs'
