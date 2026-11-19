import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { cloneBoard, placeStone } from '../engine/board'
import type { Board as BoardState, Move } from '../engine/types'
import { PythonPlayer } from '../python/PythonPlayer'
import type { WorkerLike } from '../runner/aiPlayer'
import { formatEvent } from '../runner/logFormat'
import type { LogLine } from '../runner/logFormat'
import { runGame } from '../runner/runGame'
import { PlayerFailureError } from '../runner/types'
import type { GameEvent } from '../runner/types'
import { LEVELS } from '../tutorial/levels'
import { DIRECTION_LABEL } from '../tutorial/levels'
import type { FindWinLevel, LineLevel, TutorialLevel } from '../tutorial/levels'
import { buildLevelBoard, buildLevelState, buildPreviewBoard, judgeLineResult, judgeMove } from '../tutorial/judge'
import { createPassivePlayer } from '../tutorial/passiveAi'
import Board from './Board'
import ClearModal from './ClearModal'
import CodeEditor from './CodeEditor'
import { DEFAULT_CODE_SIZE, MAX_CODE_SIZE, MIN_CODE_SIZE, stepCodeSize } from './codeZoom'
import FunctionHelp from './FunctionHelp'
import LogPanel from './LogPanel'
import { useAccount } from '../auth/AccountContext'
import { loadClearedLevels, markLevelCleared, tutorialSlot } from '../storage/cloud'
import { useCloudCode } from '../storage/useCloudCode'

type Phase = 'idle' | 'preparing' | 'running'

const newPythonWorker = () =>
  new Worker(new URL('../python/pyodide.worker.ts', import.meta.url), { type: 'module' }) as unknown as WorkerLike

/** 튜토리얼: 먼저 레벨 목록을 보여 주고, 고른 레벨의 문제 화면으로 들어간다. */
export default function TutorialPage() {
  // 열려 있는 레벨의 인덱스. null이면 레벨 목록
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const account = useAccount()
  // 통과한 레벨은 이 계정에 저장된다. 불러오기 전에는 null (새 계정은 빈 목록)
  const [cleared, setCleared] = useState<Set<number> | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    loadClearedLevels()
      .then((ids) => !cancelled && setCleared(new Set(ids)))
      .catch((e) => {
        if (cancelled) return
        setLoadError(e instanceof Error ? e.message : String(e))
        setCleared(new Set())
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (cleared === null) {
    return (
      <div className="title-stage">
        <p className="title-tagline" role="status">
          진행 기록을 불러오는 중…
        </p>
      </div>
    )
  }

  if (openIndex === null) {
    return (
      <>
        <LevelList cleared={cleared} onSelect={setOpenIndex} />
        {loadError && (
          <p className="admin-error" role="alert">
            {loadError}
          </p>
        )}
      </>
    )
  }
  const level = LEVELS[openIndex]
  const hasNext = openIndex < LEVELS.length - 1
  return (
    <LevelPlay
      key={level.id}
      level={level}
      onCleared={() => {
        setCleared((prev) => new Set(prev ?? []).add(level.id))
        if (account) void markLevelCleared(account.userId, level.id).catch(() => setLoadError('통과 기록을 저장하지 못했습니다.'))
      }}
      onBack={() => setOpenIndex(null)}
      onNext={hasNext ? () => setOpenIndex(openIndex + 1) : null}
    />
  )
}

/** 레벨 목록: 가운데 카드가 크게, 양옆 카드는 비스듬히 물러나 보이는 커버플로 모양. */
function LevelList({ cleared, onSelect }: { cleared: Set<number>; onSelect: (index: number) => void }) {
  const [focus, setFocus] = useState(() => {
    // 처음 열 때는 아직 통과하지 못한 첫 레벨을 가운데에 둔다
    const next = LEVELS.findIndex((l) => !cleared.has(l.id))
    return next === -1 ? 0 : next
  })
  const move = (delta: number) => setFocus((f) => Math.min(LEVELS.length - 1, Math.max(0, f + delta)))
  const current = LEVELS[focus]

  return (
    <div className="title-stage">
      <section
        className="cf"
        aria-label="레벨 목록"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') move(-1)
          else if (e.key === 'ArrowRight') move(1)
          else if (e.key === 'Enter' && e.target === e.currentTarget) onSelect(focus)
        }}
      >
        <h1 className="title-name cf-title">튜토리얼</h1>
        <p className="title-tagline">레벨을 골라 풀어 보세요</p>

        <div className="cf-stage">
          {LEVELS.map((l, i) => {
            const offset = i - focus
            const abs = Math.abs(offset)
            const style = {
              '--o': offset,
              '--abs': Math.min(abs, 3),
              '--s': Math.sign(offset),
              zIndex: 10 - abs,
              opacity: abs > 2 ? 0 : 1,
              pointerEvents: abs > 2 ? 'none' : 'auto',
            } as CSSProperties
            return (
              <button
                key={l.id}
                type="button"
                className={offset === 0 ? 'cf-card cf-card-on' : 'cf-card'}
                style={style}
                tabIndex={-1}
                aria-label={`레벨 ${l.id} ${l.title}${cleared.has(l.id) ? ' (통과)' : ''}`}
                aria-current={offset === 0 ? 'true' : undefined}
                onClick={() => (offset === 0 ? onSelect(i) : setFocus(i))}
              >
                <span className="cf-board" aria-hidden="true">
                  <Board board={buildPreviewBoard(l)} lastMove={null} winningLine={null} foulMove={null} />
                </span>
                <span className="cf-meta">
                  <span className={cleared.has(l.id) ? 'level-no level-no-done' : 'level-no'}>
                    {cleared.has(l.id) ? '✓' : l.id}
                  </span>
                  <b>{l.title}</b>
                </span>
              </button>
            )
          })}
        </div>

        <p className="cf-mission">{current.mission}</p>
        <div className="cf-controls">
          <button type="button" className="btn btn-outline" onClick={() => move(-1)} disabled={focus === 0} aria-label="이전 레벨">
            ←
          </button>
          <button type="button" className="btn btn-primary" onClick={() => onSelect(focus)}>
            레벨 {current.id} 시작
          </button>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => move(1)}
            disabled={focus === LEVELS.length - 1}
            aria-label="다음 레벨"
          >
            →
          </button>
        </div>
      </section>
    </div>
  )
}

interface LevelPlayProps {
  level: TutorialLevel
  onCleared: () => void
  onBack: () => void
  /** 다음 레벨로. 마지막 레벨이면 null */
  onNext: (() => void) | null
}

/** 한 레벨의 문제 화면: 주어진 판에서 내 play(state)가 목표 수를 찾으면 통과한다. */
function LevelPlay({ level, onCleared, onBack, onNext }: LevelPlayProps) {
  // 코드는 이 계정에 저장된다(이 레벨에서 저장한 적이 없으면 시작 코드)
  const { code, setCode, ready, saveState, loadError, saveNow } = useCloudCode(tutorialSlot(level.id), level.starter)
  const [phase, setPhase] = useState<Phase>('idle')
  const [codeSize, setCodeSize] = useState(DEFAULT_CODE_SIZE)

  const [board, setBoard] = useState<BoardState>(() => buildLevelBoard(level))
  const [lastMove, setLastMove] = useState<Move | null>(null)
  const [winningLine, setWinningLine] = useState<Move[] | null>(null)
  const [foulMove, setFoulMove] = useState<Move | null>(null)
  const [outcome, setOutcome] = useState<string | null>(null)
  const [lines, setLines] = useState<LogLine[]>([])
  const [clearMessage, setClearMessage] = useState<string | null>(null)
  const [passed, setPassed] = useState(false)

  const pythonRef = useRef<PythonPlayer | null>(null)
  const runIdRef = useRef(0)
  const controllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => {
      runIdRef.current++
      controllerRef.current?.abort()
      pythonRef.current?.dispose()
    }
  }, [])

  function resetView() {
    setBoard(buildLevelBoard(level))
    setLastMove(null)
    setWinningLine(null)
    setFoulMove(null)
    setOutcome(null)
    setLines([])
    setClearMessage(null)
    setPassed(false)
  }

  async function run() {
    const runId = ++runIdRef.current
    const isCurrent = () => runIdRef.current === runId
    const append = (more: LogLine[]) => setLines((prev) => [...prev, ...more])

    void saveNow()
    resetView()
    setPhase('preparing')
    append([{ kind: 'info', text: 'Python 준비 중… 처음에는 몇 초 걸립니다.' }])

    const python = (pythonRef.current ??= new PythonPlayer({ createWorker: newPythonWorker }))
    let loaded
    try {
      loaded = await python.prepare(code)
    } catch {
      if (!isCurrent()) return
      append([{ kind: 'error', text: 'Python을 불러오지 못했습니다. 인터넷 연결을 확인하고 다시 실행하세요.' }])
      setPhase('idle')
      return
    }
    if (!isCurrent()) return
    if (!loaded.ok) {
      const where = typeof loaded.failure.line === 'number' ? ` (${loaded.failure.line}번째 줄)` : ''
      append([{ kind: 'error', text: `${loaded.failure.message}${where}` }])
      setPhase('idle')
      return
    }

    setPhase('running')
    const lv = level
    if (lv.kind === 'make-line') {
      await runLine(lv, python, runId)
    } else {
      await runFindWin(lv, python, runId)
    }
    if (isCurrent()) setPhase('idle')
  }

  function clear(message: string) {
    setPassed(true)
    setOutcome('통과!')
    onCleared()
    setClearMessage(message)
  }

  /** 한 번 불러 그 한 수로 판정한다 */
  async function runFindWin(lv: FindWinLevel, python: PythonPlayer, runId: number) {
    const isCurrent = () => runIdRef.current === runId
    const append = (more: LogLine[]) => setLines((prev) => [...prev, ...more])
    try {
      const choice = await python.choose(buildLevelState(lv))
      if (!isCurrent()) return
      const print = (choice.stdout ?? '')
        .split('\n')
        .filter((l) => l.trim() !== '')
        .map((l) => ({ kind: 'print' as const, text: `print: ${l}` }))
      const verdict = judgeMove(lv, choice.move)
      setBoard(verdict.board)
      setLastMove(verdict.foulMove ? null : choice.move)
      setWinningLine(verdict.line)
      setFoulMove(verdict.foulMove)
      append([...print, { kind: verdict.passed ? 'result' : 'error', text: verdict.message }])
      if (verdict.passed) clear(verdict.message)
      else setOutcome('다시 도전하세요')
    } catch (error) {
      if (!isCurrent()) return
      const failure = error instanceof PlayerFailureError ? error.failure : null
      const where = typeof failure?.line === 'number' ? ` (${failure.line}번째 줄)` : ''
      append([{ kind: 'error', text: `${failure?.message ?? String(error)}${where}` }])
    }
  }

  /** 방해하지 않는 상대와 번갈아 두며, 목표 방향의 5목이 만들어지는지 본다 */
  async function runLine(lv: LineLevel, python: PythonPlayer, runId: number) {
    const isCurrent = () => runIdRef.current === runId
    const append = (more: LogLine[]) => setLines((prev) => [...prev, ...more])
    const controller = new AbortController()
    controllerRef.current = controller

    const opponent = createPassivePlayer(lv.direction)
    const names = { black: python.name, white: opponent.name }
    const working = buildLevelBoard(lv)
    let myMoves = 0
    let ended = false

    const onEvent = (event: GameEvent) => {
      if (!isCurrent()) return
      append(formatEvent(event, names))
      if (event.type === 'move') {
        placeStone(working, event.move, event.color)
        setBoard(cloneBoard(working))
        setLastMove(event.move)
        if (event.color === 1 && ++myMoves >= lv.maxMoves) controller.abort()
      } else if (event.type === 'foul') {
        setFoulMove(event.move ?? null)
      } else if (event.type === 'end') {
        ended = true
        setWinningLine(event.line)
        const result = judgeLineResult(lv, event)
        append([{ kind: result.passed ? 'result' : 'error', text: result.message }])
        if (result.passed) clear(result.message)
        else setOutcome('다시 도전하세요')
      }
    }

    await runGame({ black: python, white: opponent, signal: controller.signal, pauseMs: 350, onEvent })
    if (isCurrent() && !ended && myMoves >= lv.maxMoves) {
      append([
        {
          kind: 'error',
          text: `${lv.maxMoves}수 안에 ${DIRECTION_LABEL[lv.direction]} 5개를 만들지 못했습니다. 다시 도전하세요.`,
        },
      ])
      setOutcome('다시 도전하세요')
    }
  }

  function stop() {
    runIdRef.current++
    controllerRef.current?.abort()
    pythonRef.current?.cancel()
    setPhase('idle')
    setLines((prev) => [...prev, { kind: 'info', text: '중지했습니다.' }])
  }

  const busy = phase !== 'idle'

  return (
    <div className="cols">
      <section className="card card-code" aria-label="코드 작성">
        <h4 className="card-title card-title-file">
          <span>code.py</span>
          <span className="save-state" role="status">
            {!ready ? '불러오는 중…' : loadError ? '불러오지 못했습니다' : saveState === 'saving' ? '저장 중…' : saveState === 'saved' ? '저장됨' : saveState === 'error' ? '저장 실패' : ''}
          </span>
          <button
            type="button"
            className="btn-reset"
            disabled={busy || !ready}
            onClick={() => setCode(level.starter)}
            title="처음 코드로 되돌립니다"
          >
            reset
          </button>
        </h4>

        <FunctionHelp />

        <CodeEditor value={code} onChange={setCode} disabled={busy || !ready} fontSize={codeSize}>
          <div className="zoom" role="group" aria-label="코드 글자 크기">
            <button
              type="button"
              className="btn-zoom"
              onClick={() => setCodeSize((s) => stepCodeSize(s, 'out'))}
              disabled={codeSize <= MIN_CODE_SIZE}
              aria-label="글자 작게"
              title="글자 작게"
            >
              −
            </button>
            <span className="zoom-size" aria-live="polite">
              {codeSize}
            </span>
            <button
              type="button"
              className="btn-zoom"
              onClick={() => setCodeSize((s) => stepCodeSize(s, 'in'))}
              disabled={codeSize >= MAX_CODE_SIZE}
              aria-label="글자 크게"
              title="글자 크게"
            >
              +
            </button>
          </div>
        </CodeEditor>
      </section>

      <section className="card card-stage" aria-label="문제 판">
        <div className="banner" role="status">
          {outcome}
        </div>
        <div className="board-wrap">
          <Board board={board} lastMove={lastMove} winningLine={winningLine} foulMove={foulMove} />
        </div>
        <div className="stage-log">
          <h4 className="card-title">
            <span>로그</span>
          </h4>
          <LogPanel lines={lines} />
        </div>
      </section>

      <section className="card card-side" aria-label="미션">
        <h4 className="card-title">
          <span>미션 · 레벨 {level.id}</span>
        </h4>
        <div className="ctrl">
          <p>{level.mission}</p>
          <p>
            내 돌: <b>{level.myColor === 'black' ? '흑' : '백'}</b>
          </p>
          {busy ? (
            <button type="button" className="btn btn-stop" onClick={stop}>
              ■ 중지
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={() => void run()}>
              ▶ 실행
            </button>
          )}
          {passed && onNext && (
            <button type="button" className="btn btn-outline" onClick={onNext}>
              다음 레벨 →
            </button>
          )}
          {passed && !onNext && <p>지금 준비된 레벨을 모두 통과했습니다.</p>}
          <button type="button" className="btn btn-outline" disabled={busy} onClick={onBack}>
            ← 레벨 목록
          </button>
        </div>
      </section>
      {clearMessage && (
        <ClearModal
          levelId={level.id}
          levelTitle={level.title}
          message={clearMessage}
          onNext={onNext}
          onList={onBack}
          onClose={() => setClearMessage(null)}
        />
      )}
    </div>
  )
}
