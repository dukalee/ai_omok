import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { runTournamentMatches } from '../tournament/runMatches'
import {
  createTournament,
  deleteTournament,
  listTournaments,
  setTournamentStatus,
  startTournament,
} from '../tournament/service'
import { STATUS_LABEL } from '../tournament/types'
import type { Tournament } from '../tournament/types'
import { useTournamentDetail } from '../tournament/useTournamentDetail'
import BracketView from './BracketView'
import ConfirmModal from './ConfirmModal'

const formatDate = (iso: string) => new Date(iso).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' })

/**
 * 관리자용 토너먼트 관리: 만들기(접수 시작), 참가자 확인, 시작, 중단, 재개, 삭제.
 * 매치는 이 화면(관리자의 브라우저)에서 실행되므로, 진행 중에는 이 화면을 닫지 말아야 한다.
 */
export default function AdminTournaments() {
  const [list, setList] = useState<Tournament[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [runningId, setRunningId] = useState<string | null>(null)
  const [log, setLog] = useState<string[]>([])
  const [confirmDelete, setConfirmDelete] = useState(false)

  const controllerRef = useRef<AbortController | null>(null)
  const runningRef = useRef<string | null>(null)
  const { detail, error, reload } = useTournamentDetail(selectedId)

  const refreshList = useCallback(async () => {
    try {
      setList(await listTournaments())
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e))
    }
  }, [])

  useEffect(() => {
    void refreshList()
  }, [refreshList])

  // 화면을 떠나면 진행 중인 토너먼트를 멈춘다 (매치는 이 브라우저에서 실행되기 때문)
  useEffect(() => {
    return () => {
      controllerRef.current?.abort()
    }
  }, [])

  const append = (text: string) => setLog((prev) => [...prev, `${new Date().toLocaleTimeString('ko-KR')} ${text}`])

  async function create(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    setMessage(null)
    try {
      const t = await createTournament(name)
      setName('')
      await refreshList()
      setSelectedId(t.id)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err))
    }
    setBusy(false)
  }

  /** 남은 매치를 진행한다. 끝나거나 중단되면 상태를 맞춘다. */
  async function run(t: Tournament) {
    const controller = new AbortController()
    controllerRef.current = controller
    runningRef.current = t.id
    setRunningId(t.id)
    setMessage(null)
    try {
      await setTournamentStatus(t.id, 'running')
      void reload()
      const outcome = await runTournamentMatches({
        tournament: t,
        signal: controller.signal,
        onChange: () => void reload(),
        onLog: append,
      })
      if (outcome === 'stopped') {
        await setTournamentStatus(t.id, 'stopped')
        append('중단했습니다.')
      } else append('토너먼트가 끝났습니다.')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err))
      try {
        await setTournamentStatus(t.id, 'stopped')
      } catch {
        // 상태 저장에 실패해도 화면은 계속 쓸 수 있게 한다
      }
    }
    controllerRef.current = null
    runningRef.current = null
    setRunningId(null)
    void reload()
    void refreshList()
  }

  async function start() {
    if (!detail) return
    setBusy(true)
    setMessage(null)
    try {
      await startTournament(detail.tournament, detail.entries)
      setLog([])
      append('대진을 만들고 시작합니다.')
      setBusy(false)
      await run({ ...detail.tournament, status: 'running' })
      return
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err))
    }
    setBusy(false)
  }

  async function remove() {
    if (!detail) return
    setBusy(true)
    try {
      if (runningRef.current === detail.tournament.id) controllerRef.current?.abort()
      await deleteTournament(detail.tournament.id)
      setConfirmDelete(false)
      setSelectedId(null)
      await refreshList()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err))
      setConfirmDelete(false)
    }
    setBusy(false)
  }

  const t = detail?.tournament
  const thisRunning = t !== undefined && runningId === t.id
  const otherRunning = runningId !== null && !thisRunning

  return (
    <div className="admin-tournaments">
      <section className="card admin-card" aria-label="토너먼트 목록">
        <h4 className="card-title">
          <span>토너먼트</span>
        </h4>
        <form className="admin-create" onSubmit={(e) => void create(e)}>
          <input
            type="text"
            value={name}
            maxLength={50}
            placeholder="새 토너먼트 이름"
            aria-label="새 토너먼트 이름"
            disabled={busy}
            onChange={(e) => setName(e.target.value)}
          />
          <button type="submit" className="btn btn-primary" disabled={busy || !name.trim()}>
            만들기
          </button>
        </form>
        <p className="admin-hint">만들면 바로 참가 접수가 시작됩니다.</p>
        <ul className="admin-list">
          {list.map((x) => (
            <li key={x.id}>
              <button
                type="button"
                className={x.id === selectedId ? 'admin-item on' : 'admin-item'}
                onClick={() => setSelectedId(x.id)}
              >
                <b>{x.name}</b>
                <span className={`status status-${x.status}`}>{STATUS_LABEL[x.status]}</span>
              </button>
            </li>
          ))}
          {list.length === 0 && <li className="admin-empty">토너먼트가 없습니다.</li>}
        </ul>
        {message && <p className="admin-error">{message}</p>}
      </section>

      <section className="card admin-card" aria-label="토너먼트 상세">
        {!selectedId && <p className="admin-empty">왼쪽에서 토너먼트를 고르세요.</p>}
        {selectedId && error && <p className="admin-error">{error}</p>}
        {t && detail && (
          <>
            <h4 className="card-title">
              <span>{t.name}</span>
              <span className={`status status-${t.status}`}>{STATUS_LABEL[t.status]}</span>
            </h4>

            <div className="admin-controls">
              {t.status === 'open' && (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy || otherRunning || detail.entries.length < 2}
                  onClick={() => void start()}
                >
                  ▶ 시작 (참가 마감)
                </button>
              )}
              {(t.status === 'running' || t.status === 'stopped') && !thisRunning && (
                <button type="button" className="btn btn-primary" disabled={busy || otherRunning} onClick={() => void run(t)}>
                  ▶ {t.status === 'stopped' ? '재개' : '이어서 진행'}
                </button>
              )}
              {thisRunning && (
                <button type="button" className="btn btn-stop" onClick={() => controllerRef.current?.abort()}>
                  ■ 중단
                </button>
              )}
              <button type="button" className="btn btn-outline" disabled={busy} onClick={() => setConfirmDelete(true)}>
                삭제
              </button>
            </div>
            {t.status === 'open' && detail.entries.length < 2 && (
              <p className="admin-hint">시작하려면 참가자가 2명 이상 필요합니다.</p>
            )}
            {thisRunning && <p className="admin-hint">진행 중입니다. 이 화면을 닫으면 진행이 멈춥니다.</p>}
            {(t.status === 'running' || t.status === 'stopped') && !thisRunning && (
              <p className="admin-hint">이 브라우저에서 진행하고 있지 않습니다. 재개하면 남은 매치부터 이어서 진행합니다.</p>
            )}

            <h4 className="card-title">
              <span>참가자 {detail.entries.length}명</span>
            </h4>
            <ul className="entry-list">
              {detail.entries.map((e) => (
                <li key={e.id}>
                  {e.player_name} <small>{formatDate(e.joined_at)}</small>
                </li>
              ))}
              {detail.entries.length === 0 && <li className="admin-empty">아직 참가자가 없습니다.</li>}
            </ul>

            <h4 className="card-title">
              <span>대진표</span>
            </h4>
            <BracketView detail={detail} />

            {log.length > 0 && (
              <>
                <h4 className="card-title">
                  <span>진행 기록</span>
                </h4>
                <pre className="admin-log">{log.join('\n')}</pre>
              </>
            )}
          </>
        )}
      </section>

      {confirmDelete && t && (
        <ConfirmModal
          title="토너먼트 삭제"
          message={`"${t.name}" 토너먼트와 참가자, 대진, 결과가 모두 지워집니다. 되돌릴 수 없습니다.`}
          confirmLabel="삭제"
          danger
          busy={busy}
          onConfirm={() => void remove()}
          onClose={() => !busy && setConfirmDelete(false)}
        />
      )}
    </div>
  )
}
