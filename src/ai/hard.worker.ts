import type { Board, Color, Move } from '../engine/types'
import { createHardAI } from './hard'

export interface HardRequest {
  board: Board
  color: Color
}

interface WorkerScope {
  onmessage: ((event: MessageEvent<HardRequest>) => void) | null
  postMessage(message: Move): void
}

const scope = self as unknown as WorkerScope
const ai = createHardAI()

scope.onmessage = (event) => {
  const { board, color } = event.data
  scope.postMessage(ai(board, color))
}
