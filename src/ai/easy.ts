import { opponent } from '../engine/rules'
import { findWinningMove, legalCandidates } from './tactics'
import type { AI } from './types'

/**
 * 하 난이도: 내가 이길 수 있으면 이기고, 상대가 이길 것 같으면 막고,
 * 그 외에는 놓인 돌 주변의 빈 칸에 무작위로 둔다. 흑이면 금수 자리는 피한다.
 */
export function createEasyAI(rng: () => number = Math.random): AI {
  return (board, color) => {
    const candidates = legalCandidates(board, color)

    const win = findWinningMove(board, color, candidates)
    if (win) return win

    const block = findWinningMove(board, opponent(color), candidates)
    if (block) return block

    return candidates[Math.floor(rng() * candidates.length)]
  }
}
