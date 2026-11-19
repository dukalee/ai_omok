import { useCallback, useEffect, useRef, useState } from 'react'
import { useAccount } from '../auth/AccountContext'
import { loadSlot, saveSlot } from './cloud'

export type SaveState = 'idle' | 'saving' | 'saved' | 'error'

const SAVE_DELAY_MS = 800

/**
 * 계정에 저장되는 코드 한 칸(slot). 처음에 서버에서 불러오고(저장한 적이 없으면 fallback), 고치면 잠시 뒤 서버에 저장한다.
 * - 불러오기가 끝나기 전(ready === false)에는 저장하지 않는다. 시작 코드가 저장된 코드를 덮어쓰는 일을 막는다.
 * - 사용자가 직접 고치지 않은 값은 저장하지 않는다. 그래서 새 계정에는 아무 행도 생기지 않는다.
 * - 화면을 떠날 때 아직 저장되지 않은 수정이 있으면 바로 저장한다.
 */
export function useCloudCode(slot: string, fallback: string) {
  const account = useAccount()
  const userId = account?.userId ?? null
  const [code, setCodeState] = useState(fallback)
  const [ready, setReady] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [loadError, setLoadError] = useState<string | null>(null)

  const latest = useRef(code)
  const dirty = useRef(false)
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  // 불러오기
  useEffect(() => {
    let cancelled = false
    dirty.current = false
    setReady(false)
    setLoadError(null)
    setSaveState('idle')
    loadSlot(slot)
      .then((saved) => {
        if (cancelled) return
        const value = saved ?? fallback
        latest.current = value
        setCodeState(value)
        setReady(true)
      })
      .catch((e) => {
        if (cancelled) return
        setLoadError(e instanceof Error ? e.message : String(e))
        setReady(true)
      })
    return () => {
      cancelled = true
    }
    // fallback(시작 코드)은 슬롯마다 고정이라 의존성에서 뺀다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slot])

  const persist = useCallback(
    async (value: string) => {
      if (!userId) return
      setSaveState('saving')
      try {
        await saveSlot(userId, slot, value)
        if (alive.current && latest.current === value) {
          dirty.current = false
          setSaveState('saved')
        }
      } catch {
        if (alive.current) setSaveState('error')
      }
    },
    [slot, userId],
  )

  const setCode = useCallback((value: string) => {
    latest.current = value
    dirty.current = true
    setCodeState(value)
  }, [])

  // 고친 뒤 잠시 기다렸다가 저장
  useEffect(() => {
    if (!ready || !dirty.current) return
    const timer = setTimeout(() => void persist(code), SAVE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [code, ready, persist])

  // 화면을 떠날 때 남은 수정을 바로 저장
  useEffect(() => {
    return () => {
      if (dirty.current && userId) void saveSlot(userId, slot, latest.current).catch(() => undefined)
    }
  }, [slot, userId])

  /** 지금 값을 바로 저장한다 (실행 직전에 부른다) */
  const saveNow = useCallback(async () => {
    if (dirty.current) await persist(latest.current)
  }, [persist])

  return { code, setCode, ready, saveState, loadError, saveNow }
}
