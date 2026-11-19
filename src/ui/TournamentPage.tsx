import { useEffect, useState } from 'react'
import { useAccount } from '../auth/AccountContext'
import { PythonPlayer } from '../python/PythonPlayer'
import type { WorkerLike } from '../runner/aiPlayer'
import { joinTournament, leaveTournament, listTournaments } from '../tournament/service'
import { STATUS_LABEL } from '../tournament/types'
import type { Tournament } from '../tournament/types'
import { useTournamentDetail } from '../tournament/useTournamentDetail'
import BracketView from './BracketView'
import { PRACTICE_SLOT, loadSlot } from '../storage/cloud'
import { STARTER_CODE } from '../python/starter'

const newPythonWorker = () =>
  new Worker(new URL('../python/pyodide.worker.ts', import.meta.url), { type: 'module' }) as unknown as WorkerLike

/** 제출하기 전에 코드를 검사한다. 문제가 있으면 안내 문구, 없으면 null (PRD 3.2: 등록 시점에 알려준다). */
async function checkCode(code: string): Promise<string | null> {
  if (!code.trim()) return '연습 화면에서 코드를 먼저 작성하세요.'
  const player = new PythonPlayer({ createWorker: newPythonWorker })
  try {
    const loaded = await player.prepare(code)
    if (loaded.ok) return null
    const where = typeof loaded.failure.line === 'number' ? ` (${loaded.failure.line}번째 줄)` : ''
    return `${loaded.failure.message}${where}`
  } catch {
    return 'Python을 불러오지 못했습니다. 인터넷 연결을 확인하고 다시 시도하세요.'
  } finally {
    player.dispose()
  }
}

/** 토너먼트 화면: 목록을 보고, 접수 중이면 내 코드로 참가하고, 대진표와 결과를 본다. 누구나 볼 수 있다. */
export default function TournamentPage() {
  const account = useAccount()
  const [list, setList] = useState<Tournament[] | null>(null)
  const [listError, setListError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const { detail, error, reload } = useTournamentDetail(selectedId)

  useEffect(() => {
    let alive = true
    listTournaments()
      .then((l) => alive && setList(l))
      .catch((e) => alive && setListError(e instanceof Error ? e.message : String(e)))
    return () => {
      alive = false
    }
  }, [])

  const t = detail?.tournament
  const mine = detail?.entries.find((e) => e.user_id === account?.userId)

  async function join() {
    if (!t) return
    setBusy(true)
    setNotice(null)
    let code: string
    try {
      // 이 계정에 저장된 연습 코드를 제출한다 (저장한 적이 없으면 시작 코드)
      code = (await loadSlot(PRACTICE_SLOT)) ?? STARTER_CODE
    } catch (e) {
      setNotice({ kind: 'error', text: e instanceof Error ? e.message : String(e) })
      setBusy(false)
      return
    }
    const problem = await checkCode(code)
    if (problem) {
      setNotice({ kind: 'error', text: `코드를 제출할 수 없습니다: ${problem}` })
      setBusy(false)
      return
    }
    try {
      await joinTournament(t.id, code)
      setNotice({ kind: 'ok', text: mine ? '코드를 새로 제출했습니다.' : '참가 신청을 했습니다.' })
      await reload()
    } catch (e) {
      setNotice({ kind: 'error', text: e instanceof Error ? e.message : String(e) })
    }
    setBusy(false)
  }

  async function leave() {
    if (!t) return
    setBusy(true)
    setNotice(null)
    try {
      await leaveTournament(t.id)
      setNotice({ kind: 'ok', text: '참가를 취소했습니다.' })
      await reload()
    } catch (e) {
      setNotice({ kind: 'error', text: e instanceof Error ? e.message : String(e) })
    }
    setBusy(false)
  }

  return (
    <div className="admin-page">
      <div className="admin-tournaments">
        <section className="card admin-card" aria-label="토너먼트 목록">
          <h4 className="card-title">
            <span>토너먼트</span>
          </h4>
          <ul className="admin-list">
            {list?.map((x) => (
              <li key={x.id}>
                <button
                  type="button"
                  className={x.id === selectedId ? 'admin-item on' : 'admin-item'}
                  onClick={() => {
                    setSelectedId(x.id)
                    setNotice(null)
                  }}
                >
                  <b>{x.name}</b>
                  <span className={`status status-${x.status}`}>{STATUS_LABEL[x.status]}</span>
                </button>
              </li>
            ))}
            {list?.length === 0 && <li className="admin-empty">열린 토너먼트가 없습니다.</li>}
          </ul>
          {listError && <p className="admin-error">{listError}</p>}
        </section>

        <section className="card admin-card" aria-label="토너먼트 상세">
          {!selectedId && <p className="admin-empty">토너먼트를 고르면 참가자와 대진표를 볼 수 있습니다.</p>}
          {selectedId && error && <p className="admin-error">{error}</p>}
          {t && detail && (
            <>
              <h4 className="card-title">
                <span>{t.name}</span>
                <span className={`status status-${t.status}`}>{STATUS_LABEL[t.status]}</span>
              </h4>

              {t.status === 'open' && (
                <div className="admin-controls">
                  {!account ? (
                    <p className="admin-hint">참가하려면 먼저 시작 화면에서 로그인하세요.</p>
                  ) : (
                    <>
                      <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void join()}>
                        {busy ? '확인 중…' : mine ? '코드 다시 제출' : '내 코드로 참가'}
                      </button>
                      {mine && (
                        <button type="button" className="btn btn-outline" disabled={busy} onClick={() => void leave()}>
                          참가 취소
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
              {t.status === 'open' && account && (
                <p className="admin-hint">내 계정의 연습 화면에 저장된 코드(code.py)가 제출됩니다. 제출 전에 문법 검사를 합니다.</p>
              )}
              {mine && t.status !== 'open' && <p className="admin-hint">내 코드로 참가한 토너먼트입니다.</p>}
              {notice && <p className={notice.kind === 'ok' ? 'admin-ok' : 'admin-error'}>{notice.text}</p>}

              <h4 className="card-title">
                <span>참가자 {detail.entries.length}명</span>
              </h4>
              <ul className="entry-list">
                {detail.entries.map((e) => (
                  <li key={e.id}>
                    {e.player_name}
                    {e.user_id === account?.userId && <span className="admin-badge">나</span>}
                  </li>
                ))}
                {detail.entries.length === 0 && <li className="admin-empty">아직 참가자가 없습니다.</li>}
              </ul>

              <h4 className="card-title">
                <span>대진표</span>
              </h4>
              <BracketView detail={detail} />
            </>
          )}
        </section>
      </div>
    </div>
  )
}
