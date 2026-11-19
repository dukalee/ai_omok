import { beforeEach, describe, expect, test, vi } from 'vitest'

/** 최소한의 가짜 Supabase 클라이언트: 표마다 행을 메모리에 두고, RLS처럼 "지금 사용자" 행만 읽게 한다. */
const state = vi.hoisted(() => ({
  me: 'user-a',
  tables: {} as Record<string, Record<string, unknown>[]>,
}))

vi.mock('../../src/auth/supabase', () => {
  const rows = (t: string) => (state.tables[t] ??= [])
  const fake = {
    from(table: string) {
      let eqs: [string, unknown][] = []
      const visible = () => rows(table).filter((r) => r.user_id === state.me && eqs.every(([k, v]) => r[k] === v))
      const builder = {
        select: () => builder,
        eq: (k: string, v: unknown) => {
          eqs.push([k, v])
          return builder
        },
        maybeSingle: async () => ({ data: visible()[0] ?? null, error: null }),
        then: (resolve: (v: unknown) => void) => resolve({ data: visible(), error: null }),
        upsert: async (row: Record<string, unknown>, opts: { onConflict: string }) => {
          const keys = opts.onConflict.split(',')
          const list = rows(table)
          const i = list.findIndex((r) => keys.every((k) => r[k] === row[k]))
          if (i >= 0) list[i] = { ...list[i], ...row }
          else list.push(row)
          eqs = []
          return { error: null }
        },
      }
      return builder
    },
  }
  return { supabase: fake }
})

import {
  PRACTICE_SLOT,
  clearLegacyLocalData,
  loadClearedLevels,
  loadSlot,
  markLevelCleared,
  saveSlot,
  tutorialSlot,
} from '../../src/storage/cloud'

beforeEach(() => {
  state.me = 'user-a'
  state.tables = {}
})

describe('계정별 코드 저장', () => {
  test('새 계정에는 저장된 코드도 통과 기록도 없다', async () => {
    expect(await loadSlot(PRACTICE_SLOT)).toBeNull()
    expect(await loadSlot(tutorialSlot(1))).toBeNull()
    expect(await loadClearedLevels()).toEqual([])
  })

  test('저장한 코드는 같은 계정에서 다시 불러온다 (덮어쓰기)', async () => {
    await saveSlot('user-a', PRACTICE_SLOT, 'v1')
    await saveSlot('user-a', PRACTICE_SLOT, 'v2')
    expect(await loadSlot(PRACTICE_SLOT)).toBe('v2')
    expect(state.tables.user_codes).toHaveLength(1)
  })

  test('연습과 튜토리얼 레벨마다 칸이 따로다', async () => {
    await saveSlot('user-a', PRACTICE_SLOT, 'practice code')
    await saveSlot('user-a', tutorialSlot(1), 'level 1 code')
    await saveSlot('user-a', tutorialSlot(4), 'level 4 code')
    expect(await loadSlot(PRACTICE_SLOT)).toBe('practice code')
    expect(await loadSlot(tutorialSlot(1))).toBe('level 1 code')
    expect(await loadSlot(tutorialSlot(4))).toBe('level 4 code')
    expect(await loadSlot(tutorialSlot(2))).toBeNull()
  })

  test('다른 계정은 내 코드와 통과 기록을 볼 수 없다', async () => {
    await saveSlot('user-a', PRACTICE_SLOT, 'secret')
    await markLevelCleared('user-a', 1)
    state.me = 'user-b'
    expect(await loadSlot(PRACTICE_SLOT)).toBeNull()
    expect(await loadClearedLevels()).toEqual([])
  })

  test('통과 기록은 중복 없이 쌓인다', async () => {
    await markLevelCleared('user-a', 1)
    await markLevelCleared('user-a', 1)
    await markLevelCleared('user-a', 3)
    expect((await loadClearedLevels()).sort()).toEqual([1, 3])
  })
})

describe('예전 브라우저 저장 데이터 정리', () => {
  test('omok.code.v1과 omok.tutorial.* 키만 지운다', () => {
    const store = new Map<string, string>([
      ['omok.code.v1', 'x'],
      ['omok.tutorial.code.v2.1', 'y'],
      ['omok.tutorial.cleared.v2', '[1]'],
      ['sb-abc-auth-token', 'keep'],
      ['other', 'keep'],
    ])
    const fake = {
      get length() {
        return store.size
      },
      key: (i: number) => [...store.keys()][i] ?? null,
      removeItem: (k: string) => void store.delete(k),
    }
    vi.stubGlobal('localStorage', fake)
    clearLegacyLocalData()
    expect([...store.keys()]).toEqual(['sb-abc-auth-token', 'other'])
    vi.unstubAllGlobals()
  })
})
