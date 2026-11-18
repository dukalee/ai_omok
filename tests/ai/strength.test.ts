import { describe, expect, test } from 'vitest'
import { createEasyAI } from '../../src/ai/easy'
import { createHardAI } from '../../src/ai/hard'
import { createMediumAI } from '../../src/ai/medium'
import type { AI } from '../../src/ai/types'
import { Game } from '../../src/engine/game'
import type { Color } from '../../src/engine/types'

/** 시드 고정 의사난수 (mulberry32) */
function seeded(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function playMatch(blackAI: AI, whiteAI: AI): Color {
  const game = new Game()
  while (game.status.state === 'playing') {
    const ai = game.toMove === 1 ? blackAI : whiteAI
    game.play(ai(game.board, game.toMove))
  }
  return game.status.winner
}

/** a가 b를 상대로 흑/백을 번갈아 총 games판 둔 승수 */
function winsOf(makeA: (seed: number) => AI, makeB: (seed: number) => AI, games: number): number {
  let wins = 0
  for (let i = 0; i < games; i++) {
    const a = makeA(i + 1)
    const b = makeB(i + 101)
    if (i % 2 === 0) {
      if (playMatch(a, b) === 1) wins++
    } else if (playMatch(b, a) === 2) {
      wins++
    }
  }
  return wins
}

describe('난이도 순서', () => {
  test('중이 하를 10판 중 8판 이상 이긴다', () => {
    const wins = winsOf(
      (s) => createMediumAI(seeded(s)),
      (s) => createEasyAI(seeded(s)),
      10,
    )
    expect(wins).toBeGreaterThanOrEqual(8)
  }, 120_000)

  test('상이 중을 10판 중 7판 이상 이긴다', () => {
    const wins = winsOf(
      () => createHardAI({ maxDepth: 3, timeLimitMs: 800 }),
      (s) => createMediumAI(seeded(s)),
      10,
    )
    expect(wins).toBeGreaterThanOrEqual(7)
  }, 120_000)
})
