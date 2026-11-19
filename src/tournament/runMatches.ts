import { supabase } from '../auth/supabase'
import { PythonPlayer } from '../python/PythonPlayer'
import type { WorkerLike } from '../runner/aiPlayer'
import { runGame } from '../runner/runGame'
import type { GameEvent, PlayerAdapter } from '../runner/types'
import { pickBlack } from './bracket'
import { nextSlot } from './bracket'
import { setTournamentStatus } from './service'
import type { MatchRow, MoveRecord, Tournament } from './types'

export type RunOutcome = 'finished' | 'stopped'

export interface RunOptions {
  tournament: Tournament
  signal: AbortSignal
  /** 매치 상태가 DB에서 바뀔 때마다 (화면 새로고침용) */
  onChange: () => void
  onLog: (text: string) => void
  /** 테스트에서 가짜 Worker를 넣기 위한 자리 */
  createWorker?: () => WorkerLike
  /** 한 수와 다음 수 사이 대기(ms) */
  pauseMs?: number
}

const defaultWorker = () =>
  new Worker(new URL('../python/pyodide.worker.ts', import.meta.url), { type: 'module' }) as unknown as WorkerLike

function db() {
  if (!supabase) throw new Error('서버가 설정되지 않았습니다.')
  return supabase
}

async function allMatches(tournamentId: string): Promise<MatchRow[]> {
  const r = await db()
    .from('tournament_matches')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('round', { ascending: true })
    .order('position', { ascending: true })
  if (r.error) throw new Error(`대진을 불러오지 못했습니다: ${r.error.message}`)
  return r.data as MatchRow[]
}

async function updateMatch(id: string, patch: Record<string, unknown>): Promise<void> {
  const r = await db().from('tournament_matches').update(patch).eq('id', id)
  if (r.error) throw new Error(`매치를 저장하지 못했습니다: ${r.error.message}`)
}

/**
 * 관리자의 브라우저에서 남은 매치를 차례로 진행한다 (PRD: 실행 주체).
 * 중단(signal)되면 진행 중이던 매치는 처음 상태(pending)로 되돌리고 멈춘다. 같은 토너먼트를 다시 실행하면 이어서 진행한다.
 */
export async function runTournamentMatches(options: RunOptions): Promise<RunOutcome> {
  const { tournament, signal, onChange, onLog } = options
  const create = options.createWorker ?? defaultWorker
  const players = [new PythonPlayer({ createWorker: create }), new PythonPlayer({ createWorker: create })]
  const onAbort = () => players.forEach((p) => p.cancel())
  signal.addEventListener('abort', onAbort)

  try {
    const names = new Map<string, string>()
    const entries = await db().from('tournament_entries').select('id, player_name').eq('tournament_id', tournament.id)
    for (const e of (entries.data ?? []) as { id: string; player_name: string }[]) names.set(e.id, e.player_name)
    const nameOf = (id: string | null) => (id ? (names.get(id) ?? '?') : '?')

    for (;;) {
      if (signal.aborted) return 'stopped'
      const matches = await allMatches(tournament.id)
      const rounds = Math.max(...matches.map((m) => m.round))
      const match = matches.find((m) => m.status !== 'done' && m.entry_a && m.entry_b)
      if (!match) {
        if (matches.every((m) => m.status === 'done')) {
          await setTournamentStatus(tournament.id, 'finished')
          onChange()
          return 'finished'
        }
        return 'stopped'
      }

      const outcome = await playMatch(match)
      if (outcome === 'aborted') return 'stopped'
      // 결승이 끝나면 토너먼트 종료
      if (match.round === rounds) {
        await setTournamentStatus(tournament.id, 'finished')
        onChange()
        return 'finished'
      }
    }

    async function playMatch(match: MatchRow): Promise<'done' | 'aborted'> {
      const a = match.entry_a as string
      const b = match.entry_b as string
      const black = pickBlack(tournament.seed, match.round, match.position, a, b)
      const white = black === a ? b : a
      const label = `${nameOf(a)} vs ${nameOf(b)}`

      await updateMatch(match.id, { status: 'running', black_entry: black, moves: [], winner_entry: null, result_reason: null })
      onChange()
      onLog(`${label} 시작 (흑 ${nameOf(black)})`)

      const reset = async () => {
        await updateMatch(match.id, { status: 'pending', moves: [], winner_entry: null, result_reason: null })
        onChange()
      }

      const codes = await db().from('entry_codes').select('entry_id, code').in('entry_id', [a, b])
      if (codes.error) throw new Error(`코드를 불러오지 못했습니다: ${codes.error.message}`)
      const codeOf = new Map((codes.data as { entry_id: string; code: string }[]).map((c) => [c.entry_id, c.code]))

      const playerOf = new Map<string, PythonPlayer>([
        [a, players[0]],
        [b, players[1]],
      ])

      // 코드를 불러온다. 불러오지 못하면(문법 오류 등) 그 참가자의 반칙패
      const loadFailure = new Map<string, string>()
      for (const id of [a, b]) {
        try {
          const loaded = await playerOf.get(id)!.prepare(codeOf.get(id) ?? '')
          if (!loaded.ok) loadFailure.set(id, `코드 오류: ${loaded.failure.message}`)
        } catch {
          if (signal.aborted) {
            await reset()
            return 'aborted'
          }
          loadFailure.set(id, '코드를 실행할 수 없습니다')
        }
      }

      const moves: MoveRecord[] = []
      let winner: string
      let reason: string

      if (loadFailure.size > 0) {
        // 한쪽만 실패하면 상대 승리. 양쪽 모두 실패하면 백이 이긴다 (무승부 없음).
        winner = loadFailure.has(black) && !loadFailure.has(white) ? white : loadFailure.has(white) && !loadFailure.has(black) ? black : white
        const loser = winner === black ? white : black
        reason = `${nameOf(loser)} ${loadFailure.get(loser)}`
      } else {
        let lastFoul = ''
        const adapterOf = (id: string): PlayerAdapter => playerOf.get(id)!
        const end = await runGame({
          black: adapterOf(black),
          white: adapterOf(white),
          signal,
          pauseMs: options.pauseMs ?? 0,
          onEvent: (e: GameEvent) => {
            if (e.type === 'move') moves.push({ color: e.color === 1 ? 'black' : 'white', row: e.move.row, col: e.move.col })
            else if (e.type === 'foul') lastFoul = e.message
          },
        })
        if (!end) {
          await reset()
          return 'aborted'
        }
        winner = end.winner === 1 ? black : white
        reason =
          end.reason === 'five'
            ? '5목 완성'
            : end.reason === 'full'
              ? '판이 가득 차서 백 승리'
              : `${nameOf(end.winner === 1 ? white : black)} 반칙패: ${lastFoul}`
      }

      await updateMatch(match.id, { status: 'done', winner_entry: winner, result_reason: reason, moves })
      onLog(`${label} → ${nameOf(winner)} 승 (${reason})`)

      // 승자를 다음 라운드 자리에 올린다
      const slot = nextSlot(match.round, match.position)
      const all = await allMatches(tournament.id)
      const target = all.find((m) => m.round === slot.round && m.position === slot.position)
      if (target) await updateMatch(target.id, { [slot.side === 'a' ? 'entry_a' : 'entry_b']: winner })
      onChange()
      return 'done'
    }
  } finally {
    signal.removeEventListener('abort', onAbort)
    players.forEach((p) => p.dispose())
  }
}
