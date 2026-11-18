import { useEffect, useState } from 'react'

/** 장면의 마지막 단계 번호 (0: 돌 배치, 1: 목표 자리, 2: 만들어지는 줄, 3: 결론) */
export const LAST_PHASE = 3

export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

/**
 * 장면의 단계를 시간에 따라 자동으로 넘긴다. 마지막 단계에서는 잠시 머문 뒤 처음으로 돌아가 반복한다.
 * playing이 false이면 멈춰 있고, setPhase로 직접 옮길 수 있다.
 */
export function useScenePhase(playing: boolean, initial = 0, stepMs = 1500, holdMs = 2800) {
  const [phase, setPhase] = useState(initial)

  useEffect(() => {
    if (!playing) return
    const wait = phase >= LAST_PHASE ? holdMs : stepMs
    const timer = setTimeout(() => setPhase((p) => (p >= LAST_PHASE ? 0 : p + 1)), wait)
    return () => clearTimeout(timer)
  }, [phase, playing, stepMs, holdMs])

  return [phase, setPhase] as const
}
