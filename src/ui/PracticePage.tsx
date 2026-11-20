import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { cloneBoard, createBoard, placeStone } from '../engine/board'
import { tossCoin } from '../engine/game'
import { opponent } from '../engine/rules'
import type { Board as BoardState, Color, Move } from '../engine/types'
import type { Difficulty } from '../ai/types'
import { PythonPlayer } from '../python/PythonPlayer'
import { STARTER_CODE } from '../python/starter'
import { DEFAULT_CODE_SIZE, MAX_CODE_SIZE, MIN_CODE_SIZE, stepCodeSize } from './codeZoom'
import { createAiPlayer } from '../runner/aiPlayer'
import type { AiPlayer, WorkerLike } from '../runner/aiPlayer'
import { formatEvent } from '../runner/logFormat'
import type { LogLine, PlayerNames } from '../runner/logFormat'
import type { ResultSummary } from '../runner/resultSummary'
import { summarizeResult } from '../runner/resultSummary'
import { runGame } from '../runner/runGame'
import type { GameEvent } from '../runner/types'
import Board from './Board'
import CodeEditor from './CodeEditor'
import FunctionHelp from './FunctionHelp'
import LogPanel from './LogPanel'
import ResultModal from './ResultModal'
import ForbiddenRules from './ForbiddenRules'
import { PRACTICE_SLOT } from '../storage/cloud'
import { useCloudCode } from '../storage/useCloudCode'

type ColorChoice = 'coin' | 'black' | 'white'
type Phase = 'idle' | 'preparing' | 'running'

const LEVELS: { id: Difficulty; label: string }[] = [
  { id: 'easy', label: '하' },
  { id: 'medium', label: '중' },
  { id: 'hard', label: '상' },
]
const SPEEDS: { ms: number; label: string }[] = [
  { ms: 800, label: '느리게' },
  { ms: 400, label: '보통' },
  { ms: 100, label: '빠르게' },
  { ms: 0, label: '매우 빠르게' },
]

const newPythonWorker = () =>
  new Worker(new URL('../python/pyodide.worker.ts', import.meta.url), { type: 'module' }) as unknown as WorkerLike
const newHardWorker = () =>
  new Worker(new URL('../ai/hard.worker.ts', import.meta.url), { type: 'module' }) as unknown as WorkerLike


export default function PracticePage() {
  // 코드는 이 계정에 저장된다(저장한 적이 없으면 시작 코드)
  const { code, setCode, ready, saveState, loadError, saveNow } = useCloudCode(PRACTICE_SLOT, STARTER_CODE)
  const [colorChoice, setColorChoice] = useState<ColorChoice>('coin')
  const [level, setLevel] = useState<Difficulty>('medium')
  // 속도 슬라이더의 위치(SPEEDS의 인덱스). 실행 중에도 바꿀 수 있다
  const [speedIndex, setSpeedIndex] = useState(1)
  const speedRef = useRef(speedIndex)
  useEffect(() => {
    speedRef.current = speedIndex
  }, [speedIndex])
  const [phase, setPhase] = useState<Phase>('idle')

  const [board, setBoard] = useState<BoardState>(createBoard)
  const [lastMove, setLastMove] = useState<Move | null>(null)
  const [winningLine, setWinningLine] = useState<Move[] | null>(null)
  const [foulMove, setFoulMove] = useState<Move | null>(null)
  const [names, setNames] = useState<PlayerNames | null>(null)
  const [moveCount, setMoveCount] = useState(0)
  const [toMove, setToMove] = useState<Color | null>(null)
  const [codeSize, setCodeSize] = useState(DEFAULT_CODE_SIZE)
  const [outcome, setOutcome] = useState<string | null>(null)
  // 대국이 끝나면 결과 팝업으로 보여준다. 닫으면 null이 된다
  const [result, setResult] = useState<ResultSummary | null>(null)
  const [lines, setLines] = useState<LogLine[]>([])

  const pythonRef = useRef<PythonPlayer | null>(null)
  const aiRef = useRef<AiPlayer | null>(null)
  const controllerRef = useRef<AbortController | null>(null)

  // 화면을 떠날 때 진행 중인 대국과 Worker를 모두 정리한다
  useEffect(() => {
    return () => {
      controllerRef.current?.abort()
      aiRef.current?.dispose()
      pythonRef.current?.dispose()
    }
  }, [])

  const append = (more: LogLine[]) => setLines((prev) => [...prev, ...more])

  function resetView() {
    setBoard(createBoard())
    setLastMove(null)
    setWinningLine(null)
    setFoulMove(null)
    setNames(null)
    setMoveCount(0)
    setToMove(null)
    setOutcome(null)
    setResult(null)
    setLines([])
  }

  async function run() {
    controllerRef.current?.abort()
    pythonRef.current?.cancel()
    aiRef.current?.dispose()
    const controller = new AbortController()
    controllerRef.current = controller
    const isCurrent = () => controllerRef.current === controller && !controller.signal.aborted

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

    const myColor: Color = colorChoice === 'coin' ? tossCoin() : colorChoice === 'black' ? 1 : 2
    const ai = createAiPlayer(level, level === 'hard' ? newHardWorker : undefined)
    aiRef.current = ai
    const black = myColor === 1 ? python : ai
    const white = myColor === 1 ? ai : python
    const playerNames: PlayerNames = { black: black.name, white: white.name }
    const working = createBoard()

    setNames(playerNames)
    setPhase('running')

    let moves = 0
    const onEvent = (event: GameEvent) => {
      if (!isCurrent()) return
      append(formatEvent(event, playerNames))
      if (event.type === 'start') {
        setToMove(1)
      } else if (event.type === 'move') {
        placeStone(working, event.move, event.color)
        setBoard(cloneBoard(working))
        setLastMove(event.move)
        setMoveCount(event.moveNumber)
        moves = event.moveNumber
        setToMove(opponent(event.color))
      } else if (event.type === 'foul') {
        setFoulMove(event.move ?? null)
      } else if (event.type === 'end') {
        setWinningLine(event.line)
        setToMove(null)
        const winnerName = event.winner === 1 ? playerNames.black : playerNames.white
        const loserName = event.winner === 1 ? playerNames.white : playerNames.black
        setOutcome(event.reason === 'foul' ? `${winnerName} 승리 · ${loserName} 반칙패` : `${winnerName} 승리`)
        setResult(summarizeResult(event, playerNames, myColor, moves))
      }
    }

    await runGame({ black, white, signal: controller.signal, pauseMs: () => SPEEDS[speedRef.current].ms, onEvent })
    ai.dispose()
    if (isCurrent()) setPhase('idle')
  }

  function stop() {
    controllerRef.current?.abort()
    pythonRef.current?.cancel()
    aiRef.current?.dispose()
    setPhase('idle')
    setToMove(null)
    append([{ kind: 'info', text: '중지했습니다.' }])
  }

  const busy = phase !== 'idle'
  const blackName = names?.black ?? '흑'
  const whiteName = names?.white ?? '백'

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
            onClick={() => setCode(STARTER_CODE)}
            title="예제 코드로 되돌립니다"
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

      <section className="card card-stage" aria-label="대국">
        <div className="plates">
          <div className={`plate ${toMove === 1 ? 'plate-on' : ''}`}>
            <i className="plate-stone plate-black" aria-hidden="true" />
            <span>{blackName}</span>
          </div>
          <div className="plate-move" aria-label="수 번호">
            {moveCount > 0 ? `${moveCount}수` : phase === 'preparing' ? '준비 중' : '—'}
          </div>
          <div className={`plate ${toMove === 2 ? 'plate-on' : ''}`}>
            <i className="plate-stone plate-white" aria-hidden="true" />
            <span>{whiteName}</span>
          </div>
        </div>

        <div className="banner" role="status">
          {outcome}
        </div>

        <div className="board-wrap">
          <Board board={board} lastMove={lastMove} winningLine={winningLine} foulMove={foulMove} />
        </div>

        <div className="stage-log">
          <h4 className="card-title">
            <span>로그</span>
            <span>{moveCount > 0 ? `${moveCount}수` : ''}</span>
          </h4>
          <LogPanel lines={lines} />
        </div>
      </section>

      <section className="card card-side" aria-label="설정과 로그">
        <h4 className="card-title">
          <span>설정</span>
        </h4>
        <div className="ctrl">
          <label>
            내 색
            <select
              value={colorChoice}
              disabled={busy}
              onChange={(e) => setColorChoice(e.target.value as ColorChoice)}
            >
              <option value="coin">랜덤</option>
              <option value="black">흑</option>
              <option value="white">백</option>
            </select>
          </label>
          <label>
            상대
            <select value={level} disabled={busy} onChange={(e) => setLevel(e.target.value as Difficulty)}>
              {LEVELS.map((l) => (
                <option key={l.id} value={l.id}>
                  AI {l.label}
                </option>
              ))}
            </select>
          </label>
          <div className="speed" style={{ '--max': SPEEDS.length - 1 } as CSSProperties}>
            <label htmlFor="speed-slider">
              속도 <b className="speed-now">{SPEEDS[speedIndex].label}</b>
            </label>
            <div className="speed-rail" style={{ '--i': speedIndex } as CSSProperties}>
              <i className="speed-track" aria-hidden="true" />
              <i className="speed-fill" aria-hidden="true" />
              {SPEEDS.map((s, i) => (
                <i
                  key={s.label}
                  className={i <= speedIndex ? 'speed-stop reached' : 'speed-stop'}
                  style={{ '--k': i } as CSSProperties}
                  aria-hidden="true"
                />
              ))}
              <input
                id="speed-slider"
                className="speed-slider"
                type="range"
                min={0}
                max={SPEEDS.length - 1}
                step={1}
                value={speedIndex}
                aria-valuetext={SPEEDS[speedIndex].label}
                onChange={(e) => setSpeedIndex(Number(e.target.value))}
              />
            </div>
            <div className="speed-labels" aria-hidden="true">
              {SPEEDS.map((s, i) => (
                <span
                  key={s.label}
                  className={i === speedIndex ? 'on' : ''}
                  style={{ '--k': i } as CSSProperties}
                >
                  {s.label}
                </span>
              ))}
            </div>
          </div>

          {busy ? (
            <button type="button" className="btn btn-stop" onClick={stop}>
              ■ 중지
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={() => void run()}>
              ▶ 실행
            </button>
          )}
        </div>

        <ForbiddenRules />
      </section>

      {result && (
        <ResultModal
          result={result}
          blackName={blackName}
          whiteName={whiteName}
          onClose={() => setResult(null)}
          onRerun={() => {
            setResult(null)
            void run()
          }}
        />
      )}
    </div>
  )
}
