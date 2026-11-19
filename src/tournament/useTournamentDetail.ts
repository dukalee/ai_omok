import { useCallback, useEffect, useRef, useState } from 'react'
import { loadTournament } from './service'
import type { TournamentDetail } from './types'

/**
 * 토너먼트 하나의 상세(참가자, 대진)를 불러온다. 접수 중이거나 진행 중이면 몇 초마다 다시 불러 화면을 갱신한다.
 * (Realtime 대신 주기적으로 읽는 단순한 방식)
 */
export function useTournamentDetail(id: string | null, pollMs = 4000) {
  const [detail, setDetail] = useState<TournamentDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const reload = useCallback(async () => {
    if (!id) return
    try {
      const d = await loadTournament(id)
      if (!alive.current) return
      setDetail(d)
      setError(d ? null : '토너먼트를 찾을 수 없습니다.')
    } catch (e) {
      if (alive.current) setError(e instanceof Error ? e.message : String(e))
    }
  }, [id])

  useEffect(() => {
    setDetail(null)
    setError(null)
    void reload()
  }, [reload])

  const status = detail?.tournament.status
  useEffect(() => {
    if (!id || (status !== 'open' && status !== 'running')) return
    const timer = setInterval(() => void reload(), pollMs)
    return () => clearInterval(timer)
  }, [id, status, pollMs, reload])

  return { detail, error, reload }
}
