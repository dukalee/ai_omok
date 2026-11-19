import { supabase } from '../auth/supabase'

/**
 * 계정별 저장. 연습/튜토리얼 코드와 튜토리얼 통과 기록은 브라우저가 아니라 Supabase에 둔다.
 * 읽기는 RLS가 본인 행만 돌려주므로 user_id를 따로 거르지 않는다. 쓰기는 본인 user_id로만 된다.
 */

export const PRACTICE_SLOT = 'practice'
export const tutorialSlot = (levelId: number) => `tutorial:${levelId}`

function db() {
  if (!supabase) throw new Error('서버가 설정되지 않았습니다.')
  return supabase
}

/** 저장해 둔 코드. 저장한 적이 없으면 null (새 계정은 항상 null) */
export async function loadSlot(slot: string): Promise<string | null> {
  const r = await db().from('user_codes').select('code').eq('slot', slot).maybeSingle()
  if (r.error) throw new Error(`코드를 불러오지 못했습니다: ${r.error.message}`)
  return (r.data as { code: string } | null)?.code ?? null
}

export async function saveSlot(userId: string, slot: string, code: string): Promise<void> {
  const r = await db()
    .from('user_codes')
    .upsert({ user_id: userId, slot, code, updated_at: new Date().toISOString() }, { onConflict: 'user_id,slot' })
  if (r.error) throw new Error(`코드를 저장하지 못했습니다: ${r.error.message}`)
}

/** 통과한 튜토리얼 레벨 id들 */
export async function loadClearedLevels(): Promise<number[]> {
  const r = await db().from('tutorial_cleared').select('level_id')
  if (r.error) throw new Error(`진행 기록을 불러오지 못했습니다: ${r.error.message}`)
  return (r.data as { level_id: number }[]).map((x) => x.level_id)
}

export async function markLevelCleared(userId: string, levelId: number): Promise<void> {
  const r = await db()
    .from('tutorial_cleared')
    .upsert({ user_id: userId, level_id: levelId }, { onConflict: 'user_id,level_id' })
  if (r.error) throw new Error(`진행 기록을 저장하지 못했습니다: ${r.error.message}`)
}

/**
 * 예전에는 코드와 진행 기록을 이 컴퓨터의 브라우저(localStorage)에 저장했다.
 * 계정별 저장으로 바뀌었으므로, 남아 있는 예전 데이터가 다른 계정에 섞여 보이지 않게 한 번 지운다.
 */
export function clearLegacyLocalData(): void {
  try {
    const stale: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && (key === 'omok.code.v1' || key.startsWith('omok.tutorial.'))) stale.push(key)
    }
    stale.forEach((key) => localStorage.removeItem(key))
  } catch {
    // localStorage를 쓸 수 없으면 지울 것도 없다
  }
}
