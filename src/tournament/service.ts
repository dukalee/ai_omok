import { supabase } from '../auth/supabase'
import { planBracket } from './bracket'
import type { Entry, MatchRow, Tournament, TournamentDetail, TournamentStatus } from './types'

/** Supabase 호출 모음. 권한은 DB의 RLS와 함수가 강제하고, 여기서는 호출만 한다. */

function db() {
  if (!supabase) throw new Error('서버가 설정되지 않았습니다.')
  return supabase
}

function check<T>(result: { data: T | null; error: { message: string } | null }, what: string): T {
  if (result.error) throw new Error(`${what}: ${result.error.message}`)
  return result.data as T
}

export async function listTournaments(): Promise<Tournament[]> {
  const r = await db().from('tournaments').select('*').order('created_at', { ascending: false })
  return check(r, '토너먼트 목록을 불러오지 못했습니다') as Tournament[]
}

export async function loadTournament(id: string): Promise<TournamentDetail | null> {
  const client = db()
  const t = await client.from('tournaments').select('*').eq('id', id).maybeSingle()
  const tournament = check(t, '토너먼트를 불러오지 못했습니다') as Tournament | null
  if (!tournament) return null
  const [e, m] = await Promise.all([
    client.from('tournament_entries').select('*').eq('tournament_id', id).order('joined_at', { ascending: true }),
    client
      .from('tournament_matches')
      .select('*')
      .eq('tournament_id', id)
      .order('round', { ascending: true })
      .order('position', { ascending: true }),
  ])
  return {
    tournament,
    entries: check(e, '참가자를 불러오지 못했습니다') as Entry[],
    matches: check(m, '대진을 불러오지 못했습니다') as MatchRow[],
  }
}

export async function createTournament(name: string): Promise<Tournament> {
  const r = await db().from('tournaments').insert({ name: name.trim() }).select('*').single()
  return check(r, '토너먼트를 만들지 못했습니다') as Tournament
}

export async function deleteTournament(id: string): Promise<void> {
  const r = await db().from('tournaments').delete().eq('id', id)
  check({ data: true, error: r.error }, '토너먼트를 삭제하지 못했습니다')
}

export async function setTournamentStatus(id: string, status: TournamentStatus): Promise<void> {
  const patch: Record<string, unknown> = { status }
  if (status === 'finished') patch.finished_at = new Date().toISOString()
  const r = await db().from('tournaments').update(patch).eq('id', id)
  check({ data: true, error: r.error }, '상태를 바꾸지 못했습니다')
}

/** 참가를 확정하고 대진을 만든다. 접수 중(open)이고 참가자가 2명 이상이어야 한다. */
export async function startTournament(tournament: Tournament, entries: Entry[]): Promise<void> {
  if (tournament.status !== 'open') throw new Error('접수 중인 토너먼트만 시작할 수 있습니다.')
  const plan = planBracket(
    entries.map((e) => e.id),
    tournament.seed,
  )
  const rows = plan.map((m) => ({
    tournament_id: tournament.id,
    round: m.round,
    position: m.position,
    entry_a: m.entryA,
    entry_b: m.entryB,
    winner_entry: m.winner,
    status: m.status,
    result_reason: m.reason,
  }))
  const client = db()
  check(await client.from('tournament_matches').insert(rows).select('id'), '대진을 만들지 못했습니다')
  const r = await client
    .from('tournaments')
    .update({ status: 'running', started_at: new Date().toISOString() })
    .eq('id', tournament.id)
  check({ data: true, error: r.error }, '토너먼트를 시작하지 못했습니다')
}

export async function joinTournament(tournamentId: string, code: string): Promise<void> {
  const r = await db().rpc('join_tournament', { p_tournament: tournamentId, p_code: code })
  if (r.error) throw new Error(r.error.message.includes('not open') ? '지금은 참가를 받지 않습니다.' : '참가하지 못했습니다.')
}

export async function leaveTournament(tournamentId: string): Promise<void> {
  const r = await db().rpc('leave_tournament', { p_tournament: tournamentId })
  if (r.error) throw new Error(r.error.message.includes('not open') ? '지금은 참가를 취소할 수 없습니다.' : '참가를 취소하지 못했습니다.')
}
