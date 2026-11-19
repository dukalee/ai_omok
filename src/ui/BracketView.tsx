import { roundLabel } from '../tournament/bracket'
import type { TournamentDetail } from '../tournament/types'

/** 대진표. 라운드별 열에 매치를 쌓고, 승자는 굵게 표시한다. 진행 중인 매치는 따로 표시한다. */
export default function BracketView({ detail }: { detail: TournamentDetail }) {
  const { matches, entries, tournament } = detail
  if (matches.length === 0) {
    return <p className="bracket-empty">아직 대진이 없습니다. 시작하면 참가자가 무작위로 배치됩니다.</p>
  }

  const names = new Map(entries.map((e) => [e.id, e.player_name]))
  const rounds = Math.max(...matches.map((m) => m.round))
  const final = matches.find((m) => m.round === rounds)
  const champion = tournament.status === 'finished' && final?.winner_entry ? names.get(final.winner_entry) : null

  return (
    <div className="bracket-wrap">
      {champion && (
        <p className="bracket-champion" role="status">
          우승 · <b>{champion}</b>
        </p>
      )}
      <div className="bracket" role="group" aria-label="대진표">
        {Array.from({ length: rounds }, (_, i) => i + 1).map((round) => (
          <div key={round} className="bracket-round">
            <h5>{roundLabel(round, rounds)}</h5>
            {matches
              .filter((m) => m.round === round)
              .map((m) => {
                const row = (id: string | null) => {
                  const isWinner = m.status === 'done' && id !== null && m.winner_entry === id
                  const isLoser = m.status === 'done' && id !== null && m.winner_entry !== id
                  return (
                    <div
                      className={isWinner ? 'bracket-player bracket-win' : isLoser ? 'bracket-player bracket-lose' : 'bracket-player'}
                    >
                      <span>{id ? (names.get(id) ?? '(탈퇴)') : m.status === 'done' && m.result_reason === 'bye' ? '부전승' : '—'}</span>
                      {isWinner && <span aria-label="승리">✓</span>}
                    </div>
                  )
                }
                return (
                  <div
                    key={m.id}
                    className={m.status === 'running' ? 'bracket-match bracket-running' : 'bracket-match'}
                    title={m.result_reason && m.result_reason !== 'bye' ? m.result_reason : undefined}
                  >
                    {row(m.entry_a)}
                    {row(m.entry_b)}
                    {m.status === 'running' && <span className="bracket-tag">진행 중</span>}
                  </div>
                )
              })}
          </div>
        ))}
      </div>
    </div>
  )
}
