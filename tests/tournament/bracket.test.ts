import { describe, expect, test } from 'vitest'
import { bracketSize, nextSlot, pickBlack, planBracket, roundLabel, totalRounds } from '../../src/tournament/bracket'

const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`)

describe('planBracket', () => {
  test('참가자가 2명 미만이면 오류', () => {
    expect(() => planBracket(['a'], 1)).toThrow()
  })

  test('크기와 라운드 수', () => {
    expect([2, 3, 4, 5, 8, 9].map(bracketSize)).toEqual([2, 4, 4, 8, 8, 16])
    expect([2, 3, 4, 5, 8, 9].map(totalRounds)).toEqual([1, 2, 2, 3, 3, 4])
  })

  test('2~33명: 모든 참가자가 1라운드에 정확히 한 번 나오고, 매치 수와 부전승 수가 맞다', () => {
    for (let n = 2; n <= 33; n++) {
      const plan = planBracket(ids(n), 42)
      const size = bracketSize(n)
      expect(plan).toHaveLength(size - 1)
      const round1 = plan.filter((m) => m.round === 1)
      const seen = round1.flatMap((m) => [m.entryA, m.entryB]).filter((x): x is string => x !== null)
      expect(seen.sort()).toEqual(ids(n).sort())
      const byes = round1.filter((m) => m.reason === 'bye')
      expect(byes).toHaveLength(size - n)
      // 한 매치에 두 자리가 모두 비는 일은 없다
      for (const m of round1) expect(m.entryA).not.toBeNull()
      for (const m of byes) {
        expect(m.winner).toBe(m.entryA)
        expect(m.status).toBe('done')
      }
    }
  })

  test('부전승 승자는 다음 라운드 자리에 올라가 있다', () => {
    const plan = planBracket(ids(5), 7) // 8자리, 부전승 3
    const byes = plan.filter((m) => m.round === 1 && m.reason === 'bye')
    expect(byes).toHaveLength(3)
    for (const m of byes) {
      const slot = nextSlot(m.round, m.position)
      const target = plan.find((x) => x.round === slot.round && x.position === slot.position)!
      expect(slot.side === 'a' ? target.entryA : target.entryB).toBe(m.winner)
    }
  })

  test('같은 시드는 같은 대진, 다른 시드는 (보통) 다른 대진', () => {
    expect(planBracket(ids(10), 5)).toEqual(planBracket(ids(10), 5))
    expect(planBracket(ids(10), 5)).not.toEqual(planBracket(ids(10), 6))
  })

  test('2의 거듭제곱이면 부전승이 없고 2라운드 이후는 비어 있다', () => {
    const plan = planBracket(ids(8), 3)
    expect(plan.filter((m) => m.reason === 'bye')).toHaveLength(0)
    for (const m of plan.filter((x) => x.round > 1)) {
      expect(m.entryA).toBeNull()
      expect(m.entryB).toBeNull()
    }
  })
})

describe('보조 함수', () => {
  test('nextSlot', () => {
    expect(nextSlot(1, 0)).toEqual({ round: 2, position: 0, side: 'a' })
    expect(nextSlot(1, 1)).toEqual({ round: 2, position: 0, side: 'b' })
    expect(nextSlot(2, 3)).toEqual({ round: 3, position: 1, side: 'b' })
  })

  test('pickBlack은 두 참가자 중 하나를 항상 같게 고른다', () => {
    const first = pickBlack(11, 1, 2, 'a', 'b')
    expect(['a', 'b']).toContain(first)
    expect(pickBlack(11, 1, 2, 'a', 'b')).toBe(first)
  })

  test('roundLabel', () => {
    expect(roundLabel(3, 3)).toBe('결승')
    expect(roundLabel(2, 3)).toBe('준결승')
    expect(roundLabel(1, 3)).toBe('8강')
    expect(roundLabel(1, 4)).toBe('16강')
  })
})
