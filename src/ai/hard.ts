import { cloneBoard, placeStone, removeStone } from '../engine/board'
import { findWinningLine, opponent } from '../engine/rules'
import type { Board, Color, Move } from '../engine/types'
import { candidateMoves, evaluateBoard, scoreMove } from './evaluate'
import { findWinningMove, isAllowedFor, legalCandidates } from './tactics'
import type { AI } from './types'

export interface HardOptions {
  maxDepth?: number
  timeLimitMs?: number
}

/** 한 노드에서 탐색할 후보 칸의 최대 개수 (정렬 상위 N개). */
const BRANCH_LIMIT = 12
const WIN_SCORE = 1_000_000
const ATTACK_WEIGHT = 1.1

class SearchTimeout extends Error {}

function orderedMoves(board: Board, color: Color): Move[] {
  const enemy = opponent(color)
  const ranked = candidateMoves(board)
    .map((move) => ({
      move,
      score: scoreMove(board, move, color) * ATTACK_WEIGHT + scoreMove(board, move, enemy),
    }))
    .sort((a, b) => b.score - a.score)

  // 점수 순으로 보면서 color가 둘 수 있는 칸(흑이면 금수 제외)만 상위 BRANCH_LIMIT개 고른다.
  // 금수 판정은 비싸므로 필요한 만큼만 검사한다.
  const moves: Move[] = []
  for (const { move } of ranked) {
    if (!isAllowedFor(board, move, color)) continue
    moves.push(move)
    if (moves.length === BRANCH_LIMIT) break
  }
  return moves
}

/**
 * 상 난이도: 알파-베타 가지치기를 쓰는 Minimax(negamax)를 반복 심화로 실행한다.
 * 깊이 3부터 maxDepth까지 홀수 깊이(3, 5, ...)로 시간 제한 안에서 가능한 만큼 깊게 보고,
 * 시간이 부족하면 직전 깊이의 최선 수를 반환한다.
 * (짝수 깊이는 말단 평가가 "내 차례" 쪽으로 치우쳐 같은 시간에 더 약했다: 깊이 2/3/4에서 중 상대 승수 5/10, 9/10, 6/10)
 */
export function createHardAI(options: HardOptions = {}): AI {
  const maxDepth = options.maxDepth ?? 5
  const timeLimitMs = options.timeLimitMs ?? 1500

  return (input, color) => {
    const board = cloneBoard(input)
    const deadline = Date.now() + timeLimitMs
    const all = legalCandidates(board, color)

    const win = findWinningMove(board, color, all)
    if (win) return win
    const block = findWinningMove(board, opponent(color), all)
    if (block) return block

    const rootMoves = orderedMoves(board, color)
    if (rootMoves.length === 0) return all[0]
    let best = rootMoves[0]
    if (rootMoves.length === 1) return best

    function negamax(depth: number, alpha: number, beta: number, side: Color): number {
      if (Date.now() > deadline) throw new SearchTimeout()
      if (depth === 0) return evaluateBoard(board, side)

      const moves = orderedMoves(board, side)
      if (moves.length === 0) return 0

      let value = -Infinity
      for (const move of moves) {
        placeStone(board, move, side)
        const score =
          findWinningLine(board, move) !== null
            ? WIN_SCORE + depth
            : -negamax(depth - 1, -beta, -alpha, opponent(side))
        removeStone(board, move)

        if (score > value) value = score
        if (value > alpha) alpha = value
        if (alpha >= beta) break
      }
      return value
    }

    try {
      for (let depth = 3; depth <= maxDepth; depth += 2) {
        let iterationBest = rootMoves[0]
        let alpha = -Infinity
        for (const move of rootMoves) {
          placeStone(board, move, color)
          const score = -negamax(depth - 1, -Infinity, -alpha, opponent(color))
          removeStone(board, move)
          if (score > alpha) {
            alpha = score
            iterationBest = move
          }
        }
        best = iterationBest
        // 다음 깊이에서는 이번 최선 수를 먼저 탐색해 가지치기 효율을 높인다.
        rootMoves.splice(rootMoves.indexOf(best), 1)
        rootMoves.unshift(best)
      }
    } catch (error) {
      if (!(error instanceof SearchTimeout)) throw error
    }
    return best
  }
}
