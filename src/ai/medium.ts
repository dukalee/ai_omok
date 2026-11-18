import { opponent } from '../engine/rules'
import type { Move } from '../engine/types'
import { scoreMove } from './evaluate'
import { legalCandidates } from './tactics'
import type { AI } from './types'

/** 공격 점수에 곱하는 가중치. 같은 수준의 위협이면 막기보다 내 공격을 우선한다. */
const ATTACK_WEIGHT = 1.1

/**
 * 중 난이도: 후보 칸마다 (내 연결 점수 × 가중치 + 상대 연결 점수)를 매겨
 * 가장 높은 칸을 고른다. 동점이면 rng로 고른다.
 */
export function createMediumAI(rng: () => number = Math.random): AI {
  return (board, color) => {
    const enemy = opponent(color)
    let best: Move[] = []
    let bestScore = -Infinity

    for (const move of legalCandidates(board, color)) {
      const score =
        scoreMove(board, move, color) * ATTACK_WEIGHT + scoreMove(board, move, enemy)
      if (score > bestScore) {
        bestScore = score
        best = [move]
      } else if (score === bestScore) {
        best.push(move)
      }
    }
    return best[Math.floor(rng() * best.length)]
  }
}
