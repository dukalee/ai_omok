export type TournamentStatus = 'open' | 'running' | 'stopped' | 'finished'

export const STATUS_LABEL: Record<TournamentStatus, string> = {
  open: '참가 접수 중',
  running: '진행 중',
  stopped: '중단됨',
  finished: '종료',
}

export interface Tournament {
  id: string
  name: string
  status: TournamentStatus
  seed: number
  created_at: string
  started_at: string | null
  finished_at: string | null
}

export interface Entry {
  id: string
  tournament_id: string
  user_id: string
  player_name: string
  joined_at: string
}

export interface MoveRecord {
  color: 'black' | 'white'
  row: number
  col: number
}

export interface MatchRow {
  id: string
  tournament_id: string
  round: number
  position: number
  entry_a: string | null
  entry_b: string | null
  black_entry: string | null
  winner_entry: string | null
  status: 'pending' | 'running' | 'done'
  result_reason: string | null
  moves: MoveRecord[]
}

export interface TournamentDetail {
  tournament: Tournament
  entries: Entry[]
  matches: MatchRow[]
}
