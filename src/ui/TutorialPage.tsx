import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { cloneBoard, placeStone } from '../engine/board'
import type { Board as BoardState, Move } from '../engine/types'
import { PythonPlayer } from '../python/PythonPlayer'
import type { WorkerLike } from '../runner/aiPlayer'
import { formatEvent } from '../runner/logFormat'
import type { LogLine } from '../runner/logFormat'
import { runGame } from '../runner/runGame'
import { PlayerFailureError } from '../runner/types'
import type { GameEvent } from '../runner/types'
import { LEVELS, resolveLevel } from '../tutorial/levels'
import { DIRECTION_LABEL } from '../tutorial/levels'
import type {
  BlockLevel,
  DecideLevel,
  FindWinLevel,
  LineLevel,
  OpenFourLevel,
  TutorialLevel,
  WinInTwoLevel,
} from '../tutorial/levels'
import { buildLevelBoard, buildLevelState, buildPreviewBoard, judgeBlock, judgeDecide, judgeLineResult, judgeMove, judgeOpenFour, judgeWinInTwo } from '../tutorial/judge'
import { createPassivePlayer } from '../tutorial/passiveAi'
import Board from './Board'
import ClearModal from './ClearModal'
import CodeEditor from './CodeEditor'
import { DEFAULT_CODE_SIZE, MAX_CODE_SIZE, MIN_CODE_SIZE, stepCodeSize } from './codeZoom'
import ForbiddenRules from './ForbiddenRules'
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
  // 브라우저 기록(history.state.level)에도 남겨서 뒤로가기로 레벨 목록에 돌아올 수 있다
  const [openIndex, setOpenIndex] = useState<number | null>(() => {
    const saved = (history.state as { level?: number } | null)?.level
    return typeof saved === 'number' && saved >= 0 && saved < LEVELS.length ? saved : null
  })
  const account = useAccount()

  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const saved = (e.state as { level?: number } | null)?.level
      setOpenIndex(typeof saved === 'number' && saved >= 0 && saved < LEVELS.length ? saved : null)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  /** 레벨 목록에서 레벨을 연다 (뒤로가기로 목록에 돌아올 수 있게 기록을 남긴다) */
  const openLevel = (index: number) => {
    history.pushState({ ...(history.state as object), level: index }, '')
    setOpenIndex(index)
  }
  /** 다음 레벨로 (기록은 새로 쌓지 않고 바꾼다) */
  const nextLevel = (index: number) => {
    history.replaceState({ ...(history.state as object), level: index }, '')
    setOpenIndex(index)
  }
  /** 레벨 목록으로 */
  const backToList = () => {
    if ((history.state as { level?: number } | null)?.level !== undefined) history.back()
    else setOpenIndex(null)
  }
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
        <LevelList cleared={cleared} onSelect={openLevel} />
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
      onBack={backToList}
      onNext={hasNext ? () => nextLevel(openIndex + 1) : null}
    />
  )
}

/** 커버플로 무대의 세로 여백(px): 카드 위(제목이 들어가는 자리) / 카드 아래(그림자가 잘리지 않게 두는 여백). 같은 값이라 카드가 상하 가운데에 온다 */
const GAP_TITLE_CARD = 64
const GAP_STAGE_BOTTOM = 64

/** 미션 글을 문장(마침표)마다 나눈다. 카드 안에서 한 문장씩 줄을 바꿔 보여 준다. */
const sentencesOf = (mission: string): string[] =>
  (mission.match(/[^.]+\.|[^.]+$/g) ?? [mission]).map((sentence) => sentence.trim())

/** 레벨 목록: 가운데 카드가 크게, 양옆 카드는 비스듬히 물러나 보이는 커버플로 모양. */
function LevelList({ cleared, onSelect }: { cleared: Set<number>; onSelect: (index: number) => void }) {
  const [focus, setFocus] = useState(() => {
    // 처음 열 때는 아직 통과하지 못한 첫 레벨을 가운데에 둔다
    const next = LEVELS.findIndex((l) => !cleared.has(l.id))
    return next === -1 ? 0 : next
  })
  const move = (delta: number) => setFocus((f) => Math.min(LEVELS.length - 1, Math.max(0, f + delta)))
  const sectionRef = useRef<HTMLElement | null>(null)
  const cardRefs = useRef<(HTMLButtonElement | null)[]>([])
  // 화면에 그려진 (소수) 위치. 카드 모양은 이 값으로 매 프레임 계산해서 부드럽게 따라가게 한다
  const posRef = useRef(focus)

  /** 위치 pos(소수 가능)에 맞춰 카드마다 이동, 기울기, 깊이, 투명도를 정한다 */
  const apply = useCallback((pos: number) => {
    cardRefs.current.forEach((el, i) => {
      if (!el) return
      const gap = el.offsetWidth * 0.8
      const o = i - pos
      const a = Math.abs(o)
      el.style.transform = `translateX(${o * gap}px) translateZ(${-Math.min(a, 3) * 180}px) rotateY(${-Math.max(-1, Math.min(1, o)) * 45}deg)`
      el.style.opacity = String(Math.max(0, Math.min(1, 3 - a)))
      el.style.zIndex = String(Math.round(100 - a * 10))
      el.style.filter = `brightness(${1 - 0.07 * Math.min(a, 1)})`
      el.style.pointerEvents = a > 2.2 ? 'none' : 'auto'
    })
  }, [])

  // 무대 높이를 (정사각형인) 카드 높이에 맞춘다
  const stageRef = useRef<HTMLDivElement | null>(null)
  const fit = useCallback(() => {
    const card = cardRefs.current[0]
    const stage = stageRef.current
    if (!card || !stage) return
    stage.style.setProperty('--cf-top', `${GAP_TITLE_CARD}px`)
    stage.style.height = `${GAP_TITLE_CARD + card.offsetHeight + GAP_STAGE_BOTTOM}px`
  }, [])

  useLayoutEffect(() => {
    fit()
    apply(posRef.current)
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [apply, fit])

  // 가운데로 올 카드(focus)를 향해 위치를 조금씩 옮긴다 (이어서 넘겨도 끊기지 않는다)
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(now - last, 50)
      last = now
      const diff = focus - posRef.current
      if (reduced || Math.abs(diff) < 0.002) {
        posRef.current = focus
        apply(focus)
        return
      }
      posRef.current += diff * (1 - Math.exp(-dt / 100))
      apply(posRef.current)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [focus, apply])

  // 마우스 휠, 트랙패드 스크롤로 넘긴다. 휠 한 번(트랙패드는 한 번 쓸기)에 한 장씩 넘어가도록
  // 짧은 시간 동안 이어지는 이벤트는 무시한다. 페이지가 같이 스크롤되지 않게 passive: false로 단다.
  useEffect(() => {
    const el = sectionRef.current
    if (!el) return
    let lastStep = 0
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
      if (Math.abs(delta) < 4) return
      const now = performance.now()
      if (now - lastStep < 130) return
      lastStep = now
      setFocus((f) => Math.min(LEVELS.length - 1, Math.max(0, f + Math.sign(delta))))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  return (
    <div className="title-stage cf-page">
      <section
        ref={sectionRef}
        className="cf"
        aria-label="레벨 목록"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') move(-1)
          else if (e.key === 'ArrowRight') move(1)
          else if (e.key === 'Enter' && e.target === e.currentTarget) onSelect(focus)
        }}
      >
        <div className="cf-top">
          <h1>튜토리얼</h1>
        </div>

        <div className="cf-stage" ref={stageRef}>
          {LEVELS.map((l, i) => {
            const offset = i - focus
            const done = cleared.has(l.id)
            return (
              <button
                key={l.id}
                ref={(el) => {
                  cardRefs.current[i] = el
                }}
                type="button"
                className={offset === 0 ? 'cf-card cf-card-on' : 'cf-card'}
                tabIndex={-1}
                aria-label={`레벨 ${l.id} ${l.title}${done ? ' (통과)' : ''}`}
                aria-current={offset === 0 ? 'true' : undefined}
                onClick={() => (offset === 0 ? onSelect(i) : setFocus(i))}
              >
                <span className="cf-meta">
                  <span className={done ? 'level-no level-no-done' : 'level-no'}>{done ? '✓' : l.id}</span>
                  <b>{l.title}</b>
                  {l.randomColor && <span className="cf-random">랜덤 색</span>}
                </span>
                <span className="cf-board" aria-hidden="true">
                  <Board board={buildPreviewBoard(l)} lastMove={null} winningLine={null} foulMove={null} />
                  {done && <span className="cf-done">✓</span>}
                </span>
                <span className="cf-desc">
                  {sentencesOf(l.mission).map((sentence) => (
                    <span key={sentence}>{sentence}</span>
                  ))}
                </span>
              </button>
            )
          })}
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
  // 랜덤 색 레벨에서 이번 실행에 정해진 내 돌 색. 실행하기 전에는 null
  const [playedColor, setPlayedColor] = useState<'black' | 'white' | null>(null)

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

  function resetView(shown: TutorialLevel = level) {
    setBoard(buildLevelBoard(shown))
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
    // 랜덤 색 레벨은 실행할 때마다 내 돌 색을 새로 정한다
    const played = level.randomColor ? resolveLevel(level, Math.random() < 0.5 ? 'black' : 'white') : level
    setPlayedColor(level.randomColor ? played.myColor : null)
    resetView(played)
    if (level.randomColor) {
      append([{ kind: 'info', text: `이번 실행: 내 돌은 ${played.myColor === 'black' ? '흑' : '백'}입니다.` }])
    }
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
    const lv = played
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
  async function runFindWin(lv: FindWinLevel | BlockLevel | OpenFourLevel | DecideLevel | WinInTwoLevel, python: PythonPlayer, runId: number) {
    const isCurrent = () => runIdRef.current === runId
    const append = (more: LogLine[]) => setLines((prev) => [...prev, ...more])
    try {
      const choice = await python.choose(buildLevelState(lv))
      if (!isCurrent()) return
      const print = (choice.stdout ?? '')
        .split('\n')
        .filter((l) => l.trim() !== '')
        .map((l) => ({ kind: 'print' as const, text: `print: ${l}` }))
      const verdict =
        lv.kind === 'block'
          ? judgeBlock(lv, choice.move)
          : lv.kind === 'open-four'
            ? judgeOpenFour(lv, choice.move)
            : lv.kind === 'decide'
              ? judgeDecide(lv, choice.move)
              : lv.kind === 'win-in-two'
                ? judgeWinInTwo(lv, choice.move)
                : judgeMove(lv, choice.move)
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
            내 돌:{' '}
            <b>
              {level.randomColor
                ? playedColor
                  ? `${playedColor === 'black' ? '흑' : '백'} (실행할 때마다 랜덤)`
                  : '랜덤 (실행할 때마다 흑 또는 백)'
                : level.myColor === 'black'
                  ? '흑'
                  : '백'}
            </b>
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
        </div>

        <ForbiddenRules />
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
