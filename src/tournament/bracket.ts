/** 단일 토너먼트 대진. 같은 시드와 같은 참가자 목록은 항상 같은 대진을 만든다. */

export interface PlannedMatch {
  round: number
  position: number
  entryA: string | null
  entryB: string | null
  winner: string | null
  status: 'pending' | 'done'
  /** 부전승이면 'bye' */
  reason: string | null
}

/** 재현 가능한 난수 (mulberry32) */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const a = items.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** 참가자 수 n(≥2)을 담는 가장 작은 2의 거듭제곱 */
export const bracketSize = (n: number): number => 2 ** Math.ceil(Math.log2(Math.max(2, n)))
export const totalRounds = (n: number): number => Math.log2(bracketSize(n))

/** 한 매치의 승자가 올라가는 다음 라운드 자리 */
export function nextSlot(round: number, position: number): { round: number; position: number; side: 'a' | 'b' } {
  return { round: round + 1, position: Math.floor(position / 2), side: position % 2 === 0 ? 'a' : 'b' }
}

/**
 * 대진을 만든다. 참가자를 섞어 1라운드에 놓고, 2의 거듭제곱에 모자란 자리는 부전승으로 한다.
 * 부전승은 서로 다른 매치에 하나씩 돌아가며(한 매치에 두 자리가 모두 비는 일이 없다), 승자는 바로 다음 라운드에 올라간다.
 */
export function planBracket(entryIds: string[], seed: number): PlannedMatch[] {
  if (entryIds.length < 2) throw new Error('토너먼트는 참가자가 2명 이상이어야 합니다.')
  const size = bracketSize(entryIds.length)
  const rounds = Math.log2(size)
  const players = shuffle(entryIds, makeRng(seed))
  const half = size / 2

  const matches: PlannedMatch[] = []
  for (let round = 1; round <= rounds; round++) {
    for (let position = 0; position < size / 2 ** round; position++) {
      matches.push({ round, position, entryA: null, entryB: null, winner: null, status: 'pending', reason: null })
    }
  }
  const find = (round: number, position: number) => matches.find((m) => m.round === round && m.position === position)!

  for (let p = 0; p < half; p++) {
    const m = find(1, p)
    m.entryA = players[p]
    m.entryB = players[half + p] ?? null
    if (m.entryB === null) {
      m.winner = m.entryA
      m.status = 'done'
      m.reason = 'bye'
      if (rounds > 1) {
        const next = nextSlot(1, p)
        const target = find(next.round, next.position)
        if (next.side === 'a') target.entryA = m.winner
        else target.entryB = m.winner
      }
    }
  }
  return matches
}

/** 매치 시작 전 코인 던지기: 흑이 될 참가자. 시드와 자리로 정해져 다시 실행해도 같다. */
export function pickBlack(seed: number, round: number, position: number, a: string, b: string): string {
  return makeRng((seed ^ (round * 7919 + position * 104729)) >>> 0)() < 0.5 ? a : b
}

/** 라운드 이름: 결승, 준결승, 8강 … */
export function roundLabel(round: number, rounds: number): string {
  const left = 2 ** (rounds - round + 1)
  if (left === 2) return '결승'
  if (left === 4) return '준결승'
  return `${left}강`
}
