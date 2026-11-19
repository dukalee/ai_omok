import { BOARD_SIZE } from '../engine/types'
import type { PlayerAdapter, PlayerState } from '../runner/types'
import type { LineDirection } from './levels'

const DIRS: Record<LineDirection, [number, number][]> = {
  horizontal: [[0, 1]],
  vertical: [[1, 0]],
  diagonal: [
    [1, 1],
    [1, -1],
  ],
}

const inside = (r: number, c: number) => r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE

const ALL_DIRS: [number, number][] = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
]

/** (r, c)에 두면 내 돌이 4개 이상 이어지는가. 상대가 스스로 이겨 버리지 않게 미리 피한다. */
function makesFour(board: number[][], r: number, c: number): boolean {
  return ALL_DIRS.some(([dr, dc]) => {
    let count = 1
    for (const sign of [1, -1]) {
      for (let k = 1; k < 5; k++) {
        const rr = r + dr * k * sign
        const cc = c + dc * k * sign
        if (!inside(rr, cc) || board[rr][cc] !== 1) break
        count++
      }
    }
    return count >= 4
  })
}

/**
 * 방해하지 않는 상대. 목표 방향으로 학습자의 돌이 들어 있는 5칸 구간에는 두지 않고,
 * 그런 칸 중에서는 학습자가 마지막에 둔 돌에서 가장 가까운 빈 칸에 둔다(진짜 상대처럼 보이게).
 * 자기 돌이 4개 이상 이어지는 칸은 피한다(스스로 이기지 않도록).
 * 항상 판 안의 빈 칸만 고르므로 반칙하지 않는다(백은 금수도 없다). 판이 이미 가득 차면 대국이 끝나 있어 불리지 않는다.
 * state는 이 AI의 관점이라 학습자의 돌이 2이다.
 */
export function choosePassiveMove(state: PlayerState, direction: LineDirection): { row: number; col: number } {
  const board = state.board
  const theirs: [number, number][] = []
  const danger = new Set<number>()
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] !== 2) continue
      theirs.push([r, c])
      for (const [dr, dc] of DIRS[direction]) {
        for (let k = -4; k <= 4; k++) {
          const rr = r + dr * k
          const cc = c + dc * k
          if (inside(rr, cc)) danger.add(rr * BOARD_SIZE + cc)
        }
      }
    }
  }

  // 학습자가 마지막에 둔 돌 근처에 둔다. 거리가 같으면 위쪽, 왼쪽 칸을 고른다 (항상 같은 결과가 나오도록)
  const [fr, fc] = state.last_move ?? theirs[0] ?? [7, 7]
  let best: { row: number; col: number } | null = null
  let bestKey: [number, number] = [Infinity, Infinity]
  let fallback: { row: number; col: number } | null = null
  /** 최후의 수단: 아무 빈 칸. 이 AI가 반칙(이미 돌이 있는 칸 등)을 하는 일이 없도록 항상 빈 칸을 돌려준다 */
  let anyEmpty: { row: number; col: number } | null = null
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] !== 0) continue
      anyEmpty ??= { row: r, col: c }
      if (makesFour(board, r, c)) continue
      fallback ??= { row: r, col: c }
      if (danger.has(r * BOARD_SIZE + c)) continue
      const key: [number, number] = [Math.max(Math.abs(fr - r), Math.abs(fc - c)), Math.abs(fr - r) + Math.abs(fc - c)]
      if (key[0] < bestKey[0] || (key[0] === bestKey[0] && key[1] < bestKey[1])) {
        bestKey = key
        best = { row: r, col: c }
      }
    }
  }
  return best ?? fallback ?? anyEmpty ?? { row: 0, col: 0 }
}

export function createPassivePlayer(direction: LineDirection): PlayerAdapter {
  return {
    name: '연습 상대',
    choose: async (state) => ({ move: choosePassiveMove(state, direction) }),
  }
}
