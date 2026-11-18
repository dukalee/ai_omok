# UI 교체(시안 3+2)와 "코드로 두기" 연습 모드 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 학습자가 연습 모드에서 Python `choose(state)` 함수를 작성하면, 그 함수가 AI(하/중/상)와 자동으로 대국하고 진행이 판과 로그에 표시된다. 화면은 시안 3(대국장)에 시안 2(코드 에디터)를 섞는다.

**Architecture:** 규칙 엔진(`src/engine`)과 AI(`src/ai`)는 그대로 쓰고, 대국 진행 `src/runner`(React 무관, 플레이어 어댑터 추상화)와 Python 실행 `src/python`(Pyodide Web Worker)을 새로 만든다. 학습자 코드와 AI는 같은 `PlayerAdapter` 모양이라서 토너먼트에서 그대로 쓴다.

**Tech Stack:** React, Vite, TypeScript, Vitest, Pyodide(Worker, CDN), CodeMirror 6, @fontsource.

**Spec:** `docs/superpowers/specs/2026-11-18-code-practice-design.md` (규칙: `game_rules.md`)

> 이 폴더는 Git 저장소가 아니므로 커밋 단계는 두지 않는다. 진행 원장은 `docs/superpowers/plans/2026-11-18-practice-mode.progress.md`에 이어서 적는다.

## Global Constraints

- 학습자 코드는 **함수** `choose(state)`이다(클래스 아님). 반환값은 `(행, 열)`(튜플 또는 길이 2 리스트, 정수). 선택 변수 `NAME`은 이름판에 표시하고, 없으면 "내 코드".
- `state` 항목(키 이름 그대로): `board`(15×15, 0 빈 칸/1 내 돌/2 상대 돌), `my_color`(`"black"`/`"white"`), `move_number`, `last_move`((행,열) 또는 `None`), `history`(`{"color": "black"|"white", "move": (행,열)}` 리스트), `legal_moves`((행,열) 리스트, 흑이면 금수 제외). 호출마다 새로 만든 복사본이다.
- 전역 변수는 한 판 동안 유지되고, 실행(코드 로드)할 때마다 초기화된다.
- 잘못된 수(판 밖, 이미 돌이 있음), 흑의 금수, 예외, 시간 초과, 잘못된 반환값은 모두 그 플레이어(학습자)의 패배(반칙)이다.
- 한 수당 제한 시간 2000ms(첫 Pyodide 로딩 제외). 코드 로드 제한 5000ms. Pyodide 로딩 제한 60000ms.
- Pyodide는 `https://cdn.jsdelivr.net/pyodide/v314.0.8/full/pyodide.mjs`에서 Worker가 불러온다(번들에 넣지 않는다). 테스트용으로만 npm `pyodide@314.0.8`을 devDependency로 둔다.
- 코드 저장은 localStorage 키 `omok.code.v1` (접근 실패 시에도 화면이 정상 동작해야 한다).
- 규칙은 `game_rules.md`(렌주 룰). 판 15×15, 좌표 `(행, 열)` 0~14. 색: 흑 1, 백 2(`src/engine/types.ts`).
- `src/engine`, `src/ai`, `src/runner`, `src/python`(Worker 진입 파일 제외)은 React를 import하지 않는다.
- 사람이 클릭해서 두는 기능은 없앤다. title의 토너먼트 버튼은 "준비 중" 비활성.
- 글꼴은 npm 패키지(`@fontsource/gowun-batang`, `@fontsource/jetbrains-mono`)로 포함하고 CDN 링크를 쓰지 않는다.
- 사용자에게 보이는 오류 문구는 학습자 눈높이로 쓰고 문장 끝의 안내를 포함한다(예: "…판 밖입니다.").

## Review Focus

- 학습자 코드가 `while True: pass`로 끝나지 않아도 화면이 멈추지 않고, 한 수 2초 뒤 시간 초과로 끊기며, 다음 실행이 정상 동작한다. → Task 5(`PythonPlayer` 시간 초과·재초기화), Task 8 수동 검증
- 실행 중 "중지"하거나 곧바로 다시 실행해도 이전 실행의 이벤트가 로그/판에 섞이지 않는다. → Task 2(`signal`), Task 8
- `choose`가 `None`, 숫자 하나, `(True, 1)`, `(1.5, 2)`, 세 개짜리 튜플을 반환해도 앱이 깨지지 않고 이유가 안내된다. → Task 4 테스트
- 학습자 코드가 `state["board"]`나 `legal_moves`를 바꿔도 다음 호출과 실제 판에 영향이 없다. → Task 1, Task 4 테스트
- `print()` 출력이 로그에 보이고, 아주 긴 출력은 잘린다. → Task 4 테스트, Task 6 테스트

---

### Task 1: 러너 타입과 플레이어 상태(`buildPlayerState`)

**Files:**
- Create: `src/runner/types.ts`, `src/runner/playerState.ts`
- Test: `tests/runner/playerState.test.ts`

**Interfaces:**
- Consumes: `Game`(`src/engine/game.ts`), `Color`/`Move`/`Board`(`src/engine/types.ts`), `isLegalMove`(`src/engine/forbidden.ts`)
- Produces (`types.ts`):
  - `interface PlayerState { board: number[][]; my_color: 'black' | 'white'; move_number: number; last_move: [number, number] | null; history: { color: 'black' | 'white'; move: [number, number] }[]; legal_moves: [number, number][] }`
  - `type FailureKind = 'exception' | 'timeout' | 'bad-return' | 'missing-function' | 'syntax' | 'internal'`
  - `interface PlayerFailure { kind: FailureKind; message: string; line?: number | null; stdout?: string }`
  - `class PlayerFailureError extends Error { failure: PlayerFailure; constructor(failure: PlayerFailure) }` (`message`는 `failure.message`)
  - `interface PlayerChoice { move: Move; stdout?: string }`
  - `interface PlayerAdapter { name: string; choose(state: PlayerState): Promise<PlayerChoice> }`
  - `type GameEvent = { type: 'start'; black: string; white: string } | { type: 'move'; moveNumber: number; color: Color; move: Move; stdout?: string } | { type: 'foul'; color: Color; reason: 'out-of-board' | 'occupied' | 'forbidden' | 'failure'; message: string; move?: Move; failure?: PlayerFailure } | { type: 'end'; winner: Color; reason: 'five' | 'full' | 'foul'; line: Move[] | null }`
- Produces (`playerState.ts`): `buildPlayerState(game: Game, color: Color): PlayerState`, `toAbsoluteBoard(state: PlayerState): Board`(상대 관점 판을 `state.my_color` 기준 절대 색 판으로 되돌린다)

- [ ] **Step 1: 실패하는 테스트를 작성한다** (`tests/runner/playerState.test.ts`)
  - 새 `Game`에서 흑 상태: `board` 전부 0, `my_color 'black'`, `move_number 0`, `last_move null`, `history []`, `legal_moves` 길이 225
  - `(7,7)` 흑, `(7,8)` 백을 둔 뒤 백 관점: `board[7][7] === 2`(상대=흑), `board[7][8] === 1`(내 돌), `my_color 'white'`, `last_move` `[7,8]`... 주의: 마지막 수는 상대의 마지막 수이므로 흑 차례 시점의 `last_move`는 `[7,8]`, 백 차례 시점은 `[7,7]` — 두 시점 모두 확인
  - `history`는 `[{color:'black', move:[7,7]}, {color:'white', move:[7,8]}]` 형태
  - 흑 금수 상황(삼삼 모양: 흑 `(7,5)(7,6)(5,7)(6,7)`, 백은 멀리)에서 흑의 `legal_moves`에 `[7,7]`이 없고, 같은 모양의 백의 `legal_moves`에는 있다(색을 뒤집은 판)
  - `legal_moves`에 돌이 있는 칸이 없다
  - 반환한 `state.board`를 바꿔도 `game.board`가 그대로이고, `buildPlayerState`를 두 번 호출하면 서로 다른 배열이다 (Review Focus)
  - `toAbsoluteBoard(buildPlayerState(game, color))`가 흑/백 모두 `game.board`와 같다
- [ ] **Step 2:** `npx vitest run tests/runner/playerState.test.ts` → FAIL (모듈 없음)
- [ ] **Step 3:** `types.ts`와 `playerState.ts`를 위 시그니처대로 구현한다. `legal_moves`는 모든 칸을 `isLegalMove(game.board, move, color)`로 거른다.
- [ ] **Step 4:** 같은 명령 → PASS. `npm test` 전체 PASS.

---

### Task 2: 대국 진행(`runGame`)

**Files:**
- Create: `src/runner/runGame.ts`
- Test: `tests/runner/runGame.test.ts`

**Interfaces:**
- Consumes: Task 1의 모든 타입, `buildPlayerState`; `Game`, `FORBIDDEN_LABEL`(`src/engine/game.ts`); `getForbiddenReason`(`src/engine/forbidden.ts`); `isInside`(`src/engine/board.ts`); `opponent`(`src/engine/rules.ts`)
- Produces:
  - `interface RunGameOptions { black: PlayerAdapter; white: PlayerAdapter; onEvent: (event: GameEvent) => void; signal?: AbortSignal; pauseMs?: number; sleep?: (ms: number) => Promise<void> }`
  - `runGame(options: RunGameOptions): Promise<Extract<GameEvent, { type: 'end' }> | null>` — 끝나면 `end` 이벤트를, 중단되면 `null`을 반환한다.

동작: 먼저 `start` 이벤트. 차례마다 해당 어댑터에 `buildPlayerState`를 넘겨 `choose`를 호출한다. (a) `PlayerFailureError`가 던져지면 `foul`(reason `failure`, `failure` 포함, 메시지는 `failure.message`) 후 상대 승리로 `end`(reason `foul`, `line null`). (b) 반환한 수가 판 밖이면 `foul('out-of-board', "(r, c)은 판 밖입니다.")`, 돌이 있으면 `foul('occupied', "(r, c)에는 이미 돌이 있습니다.")`, 흑의 금수이면 `foul('forbidden', "(r, c)은 금수입니다 (삼삼).")`(금수 이름은 `FORBIDDEN_LABEL`) 후 같은 방식으로 `end`. (c) 유효하면 `game.play`, `move` 이벤트(`moveNumber`는 1부터, `stdout` 전달), 게임이 끝났으면 `end`(reason `five`/`full`, `winner`, `line`). 수를 둔 뒤 `await sleep(pauseMs ?? 0)`. `signal.aborted`는 각 `choose` 호출 전, 호출 직후(수를 적용하기 전), `sleep` 직후에 확인하고, 중단이면 그 이후에는 어떤 이벤트도 내지 않고 `null`을 반환한다. 어댑터가 `PlayerFailureError`가 아닌 예외를 던지면 `failure.kind 'internal'`로 바꿔 같은 방식으로 처리한다.

- [ ] **Step 1: 실패하는 테스트를 작성한다** (`tests/runner/runGame.test.ts`). 테스트 도우미: 정해진 수 목록을 차례로 반환하는 `scripted(name, moves)` 어댑터, 호출 시 throw하는 어댑터. `sleep`은 즉시 resolve하는 가짜.
  - 정상 진행: 흑이 `(7,3)`~`(7,7)`, 백이 `(8,3)`~`(8,6)`을 두면 이벤트 순서가 `start, move×9, end`이고 `end`가 `{winner:1, reason:'five', line 길이 5}`이며 `moveNumber`가 1..9
  - `start` 이벤트의 이름이 각 어댑터의 `name`
  - 어댑터에 넘어가는 상태: 백이 처음 받는 `state.move_number === 1`, `last_move`는 흑의 첫 수, 자기 돌이 1
  - 판 밖 `(15, 3)`/`(-1, 0)` → `foul out-of-board` + `end{winner: 상대, reason:'foul'}`, 이후 이벤트 없음. 메시지에 좌표 포함
  - 이미 돌이 있는 칸 → `foul occupied`
  - 흑이 삼삼 자리(`(7,7)`, 흑 `(7,5)(7,6)(5,7)(6,7)` 상황)에 두면 `foul forbidden`이고 메시지에 "삼삼" 포함, 백이 같은 모양의 자리에 두는 것은 반칙이 아님 (Review Focus 흑 금수)
  - `PlayerFailureError({kind:'timeout', message:'…'})` → `foul failure`가 그 `failure`를 담고 학습자 패배로 `end`
  - 일반 `Error`를 던지는 어댑터 → `failure.kind === 'internal'`
  - 판이 가득 차서 백 승리(`end.reason 'full'`): 두 어댑터가 225수 패턴(`tests/engine/game.test.ts`의 패턴과 같은 모양)을 두게 한다
  - `stdout`이 `move` 이벤트에 전달된다
  - 취소: 첫 `choose`가 끝나는 순간 `controller.abort()`를 호출하면 `runGame`이 `null`을 반환하고 그 이후 이벤트가 하나도 나오지 않는다. 시작 전에 이미 abort된 signal이면 `start`도 내지 않고 `null` (Review Focus 중지/재실행)
  - `pauseMs`가 주어지면 수마다 `sleep(pauseMs)`가 호출된다(가짜 sleep의 호출 인자 기록)
- [ ] **Step 2:** `npx vitest run tests/runner/runGame.test.ts` → FAIL
- [ ] **Step 3:** `runGame`을 위 동작대로 구현한다.
- [ ] **Step 4:** 같은 명령 → PASS. `npm test` 전체 PASS.

---

### Task 3: AI 어댑터

**Files:**
- Create: `src/runner/aiPlayer.ts`
- Test: `tests/runner/aiPlayer.test.ts`

**Interfaces:**
- Consumes: Task 1의 `PlayerAdapter`, `PlayerState`, `PlayerChoice`, `toAbsoluteBoard`; `AI`, `Difficulty`(`src/ai/types.ts`); `createEasyAI`, `createMediumAI`, `createHardAI`; `Color`(engine)
- Produces:
  - `interface WorkerLike { postMessage(message: unknown): void; terminate(): void; onmessage: ((event: { data: unknown }) => void) | null; onerror: ((event: unknown) => void) | null }`
  - `interface AiPlayer extends PlayerAdapter { dispose(): void }`
  - `createSyncAiPlayer(name: string, ai: AI): AiPlayer` — `choose`에서 `toAbsoluteBoard(state)`와 `state.my_color`(흑 1/백 2)로 `ai`를 호출한다.
  - `createWorkerAiPlayer(name: string, createWorker: () => WorkerLike): AiPlayer` — `{board, color}`(절대 판, 색)를 Worker에 보내고 응답 `Move`를 돌려준다. `onerror`면 `PlayerFailureError(internal)`로 reject. `dispose`는 Worker를 `terminate`한다(Worker는 첫 `choose`에서 만든다).
  - `createAiPlayer(difficulty: Difficulty, createHardWorker?: () => WorkerLike): AiPlayer` — 이름은 `AI 하`/`AI 중`/`AI 상`. `hard`이고 `createHardWorker`가 있으면 Worker 방식, 없으면 `createHardAI()`를 동기로 쓴다.

- [ ] **Step 1: 실패하는 테스트를 작성한다** (`tests/runner/aiPlayer.test.ts`)
  - `createSyncAiPlayer('t', ai)`: 가짜 `ai`가 받은 `(board, color)`가 절대 판/색이다 — 백 관점 상태(`my_color 'white'`)를 넣으면 `color === 2`이고 상대 돌 위치의 값이 1
  - `createAiPlayer('easy')`로 빈 판 상태(`my_color 'black'`)를 주면 `{row:7, col:7}`을 `move`로 반환, 이름 `AI 하`
  - `createAiPlayer('medium')`/`('hard')` 이름 `AI 중`/`AI 상`; `hard`(Worker 없음)는 빈 판에서 `(7,7)`
  - `createWorkerAiPlayer`: 가짜 Worker가 `postMessage`로 받은 `{board, color}`가 절대 값이고, 가짜가 `onmessage({data: {row:3,col:4}})`를 호출하면 `choose`가 `{move:{row:3,col:4}}`로 resolve. `dispose` 후 `terminate`가 호출됨. 에러 시 reject(`PlayerFailureError`)
- [ ] **Step 2:** `npx vitest run tests/runner/aiPlayer.test.ts` → FAIL
- [ ] **Step 3:** 위 시그니처대로 구현한다.
- [ ] **Step 4:** 같은 명령 → PASS. `npm test` 전체 PASS.

---

### Task 4: Python 하네스와 세션

**Files:**
- Create: `src/python/harness.ts`(Python 하네스 코드를 문자열 `HARNESS_PY`로 내보낸다), `src/python/session.ts`, `src/python/starter.ts`
- Modify: `package.json` (devDependency `pyodide@314.0.8`)
- Test: `tests/python/session.test.ts`

**Interfaces:**
- Consumes: Task 1의 `PlayerState`, `PlayerFailure`; `Move`(engine)
- Produces:
  - `session.ts`: `interface PyodideLike { runPython(code: string): unknown; globals: { get(name: string): ((...args: unknown[]) => unknown) | undefined } }`, `type LoadResult = { ok: true; name: string | null } | { ok: false; failure: PlayerFailure }`, `type ChooseResult = { ok: true; move: Move; stdout: string } | { ok: false; failure: PlayerFailure }`, `createPythonSession(py: PyodideLike): { load(code: string): LoadResult; choose(state: PlayerState): ChooseResult }`
  - `starter.ts`: `export const STARTER_CODE: string` — `NAME = "내 코드"`와, 한가운데 `(7, 7)`이 둘 수 있으면 거기에 두고 아니면 `state["legal_moves"][0]`을 반환하는 `choose(state)`(주석으로 `state` 항목 설명 포함)
  - Python 쪽 함수: `omok_load(code) -> str(JSON)`, `omok_choose(state_json) -> str(JSON)`. 학습자 코드는 새 네임스페이스에서 파일명 `my_code.py`로 컴파일/실행한다(줄 번호는 이 파일명 프레임에서 뽑는다).

하네스 규칙:
- `omok_load`: 호출할 때마다 네임스페이스를 새로 만든다. `SyntaxError` → `kind 'syntax'`, 메시지 `문법 오류: <msg>`, `line`. 실행 중 예외 → `kind 'exception'`, 메시지 `<예외이름>: <내용>`, `line`. `choose`가 호출 가능하지 않으면 `kind 'missing-function'`, 메시지 `choose(state) 함수가 없습니다. def choose(state): 로 만들어 주세요.` 성공이면 `name`은 `NAME`이 있으면 `str`, 없으면 null.
- `omok_choose`: JSON에서 `state`를 만들고 `last_move`, `history[].move`, `legal_moves`의 좌표는 튜플로 바꾼다. `choose(state)`의 `print`는 가로채 `stdout`로 돌려주며 최대 2000자로 자른다(잘렸으면 끝에 `…(이하 생략)`). 반환값이 길이 2의 튜플/리스트이고 두 값이 모두 `int`(`bool` 제외)이면 `{ok:true, move:[r,c], stdout}`, 아니면 `kind 'bad-return'`, 메시지 `choose()는 (행, 열) 형태로 반환해야 하는데 <repr>을(를) 반환했습니다.` 예외는 `kind 'exception'`, 메시지, `line`, `stdout` 포함.
- `session.ts`의 `choose`는 `state`를 JSON으로 보내 매번 새 복사본을 만들게 하고, 결과 JSON을 `ChooseResult`로 바꾼다(`[r,c]` → `{row, col}`). JSON 파싱 실패나 하네스 자체 오류는 `kind 'internal'`.

- [ ] **Step 1:** `npm install -D pyodide@314.0.8`
- [ ] **Step 2: 실패하는 테스트를 작성한다** (`tests/python/session.test.ts`). `beforeAll`에서 `loadPyodide()`(npm `pyodide`)로 Pyodide를 한 번 만들고 하네스 코드를 `runPython`으로 등록한 뒤 `createPythonSession`을 만든다(로딩 제한 60초). 상태 도우미: `emptyState()`(빈 판, 흑, `legal_moves` 225칸)와 `(7,7)`이 이미 찬 상태.
  - `STARTER_CODE` 로드가 `{ok:true, name:'내 코드'}`이고, 빈 판에서 `choose`가 `{row:7,col:7}`, `(7,7)`이 찬 상태에서는 `legal_moves[0]`
  - `NAME` 없는 코드 → `name null`
  - 문법 오류 코드(`def choose(state:` 등) → `{ok:false, failure.kind 'syntax', line 숫자}`
  - 로드 중 예외(`1/0`을 최상위에서) → `exception`, 메시지에 `ZeroDivisionError`, `line` 있음
  - `choose` 없는 코드 → `missing-function`, 메시지에 `choose(state)`
  - `choose`가 예외(`raise ValueError("x")` 3번째 줄) → `exception`, 메시지 `ValueError: x`, `line 3`
  - 반환 형태: `None`, `5`, `(1,)`, `(1,2,3)`, `(True, 1)`, `(1.5, 2)`, `"ab"`, `[3, 4]`, `(3, 4)` — 앞의 일곱 개는 `bad-return`(안내 메시지에 반환값 표시), 마지막 두 개는 `ok`이고 `{row:3,col:4}` (Review Focus)
  - 전역 변수 유지: 호출마다 카운터를 올려 그 값을 `(0, n)`으로 반환하는 코드에서 세 번 호출하면 `col`이 1,2,3. 같은 코드를 다시 `load`하면 카운터가 처음부터 (실행마다 초기화)
  - `state` 수정: 코드가 `state["board"][0][0] = 9`와 `state["legal_moves"].clear()`를 한 뒤 `(7, 7)`을 반환해도, 같은 JS `state` 객체의 값이 바뀌지 않고 다음 `choose` 호출에서 새로운 값이 전달됨 (Review Focus)
  - `print("hi")` → `stdout`에 `hi`가 포함. 10000자를 출력하면 `stdout` 길이가 2100자 이하이고 끝이 생략 표시 (Review Focus)
  - `import math` 같은 표준 라이브러리 import가 동작한다
- [ ] **Step 3:** `npx vitest run tests/python/session.test.ts` → FAIL (모듈 없음)
- [ ] **Step 4:** 하네스 Python 코드, `session.ts`, `starter.ts`를 위 규칙대로 구현한다. 하네스 코드는 `omok_load`/`omok_choose`와 두 개의 작은 도우미(실패 JSON 만들기, 예외에서 `my_code.py` 줄 번호 뽑기)로 충분하다.
- [ ] **Step 5:** 같은 명령 → PASS (수 초 걸린다). `npm test` 전체 PASS.

---

### Task 5: Pyodide Worker와 `PythonPlayer`

**Files:**
- Create: `src/python/pyodide.worker.ts`, `src/python/PythonPlayer.ts`
- Test: `tests/python/PythonPlayer.test.ts`

**Interfaces:**
- Consumes: Task 3의 `WorkerLike`; Task 4의 `HARNESS_PY`, `createPythonSession`, `LoadResult`, `ChooseResult`; Task 1의 `PlayerAdapter`, `PlayerChoice`, `PlayerState`, `PlayerFailureError`
- Produces:
  - `pyodide.worker.ts` 메시지 규약(입력 → 출력): `{type:'init'}` → `{type:'ready'}` 또는 `{type:'init-error', message}`; `{type:'load', code}` → `{type:'loaded', result: LoadResult}`; `{type:'choose', id, state}` → `{type:'chosen', id, result: ChooseResult}`. Pyodide는 `await import(/* @vite-ignore */ PYODIDE_URL)`의 `loadPyodide()`로 불러온다(`PYODIDE_URL`은 Global Constraints의 값).
  - `PythonPlayer.ts`: `interface PythonPlayerOptions { createWorker: () => WorkerLike; moveTimeoutMs?: number /*2000*/; loadTimeoutMs?: number /*5000*/; initTimeoutMs?: number /*60000*/ }`, `class PythonPlayer implements PlayerAdapter { constructor(options: PythonPlayerOptions); name: string /* 초기값 '내 코드' */; prepare(code: string): Promise<LoadResult>; choose(state: PlayerState): Promise<PlayerChoice>; dispose(): void }`

동작:
- `prepare(code)`: 살아 있는 Worker가 없으면 `createWorker()`로 만들고 `init`을 보내 `ready`를 기다린다(`initTimeoutMs` 초과나 `init-error`이면 `Error`로 reject하고 Worker를 정리한다). 그 뒤 `load`를 보내 `loaded`를 기다린다(`loadTimeoutMs` 초과 시 Worker를 `terminate`하고 `{ok:false, failure:{kind:'timeout', message:'코드를 불러오는 데 5초가 넘게 걸렸습니다. 최상위에 끝나지 않는 반복이 없는지 확인하세요.'}}` 반환). 성공하면 `name`을 `NAME` 값 또는 '내 코드'로 설정한다. 이미 살아 있는 Worker는 재사용한다(재실행 시 로딩 생략).
- `choose(state)`: `{type:'choose', id, state}`를 보내고 같은 `id`의 `chosen`을 기다린다. `ok:true`이면 `{move, stdout}`로 resolve, `ok:false`이면 `PlayerFailureError(failure)`로 reject. `moveTimeoutMs` 안에 오지 않으면 Worker를 `terminate`하고(이후 `prepare` 시 새로 만든다) `PlayerFailureError({kind:'timeout', message:'choose()가 2초 안에 끝나지 않았습니다. 무한 반복이나 너무 오래 걸리는 계산이 없는지 확인하세요.'})`로 reject. 시간 값은 옵션 값에서 계산해 문구의 "2초"에 반영한다. 다른 `id`의 응답이나 시간 초과 뒤의 늦은 응답은 무시한다. Worker가 없으면 `internal` 오류.
- `dispose()`: Worker를 `terminate`하고 대기 중인 요청은 무시한다.

- [ ] **Step 1: 실패하는 테스트를 작성한다** (`tests/python/PythonPlayer.test.ts`). `FakeWorker`(`WorkerLike` 구현)는 `postMessage`로 받은 메시지를 기록하고, 테스트가 `respond(data)`로 `onmessage`를 호출한다. 시간 제한 테스트는 `moveTimeoutMs: 30`처럼 짧은 값을 쓴다.
  - `prepare`: `init`을 보내고 `ready` 응답 전에는 `load`를 보내지 않으며, `ready` 후 `load`를 보낸다. `loaded {ok:true, name:'나'}`이면 `prepare`가 그 결과를 반환하고 `player.name === '나'`; `name null`이면 '내 코드'
  - `prepare`에서 `init-error`를 받으면 `Error`로 reject하고 Worker가 `terminate`됨
  - 재사용: 두 번째 `prepare`는 새 Worker를 만들지 않고(`createWorker` 호출 횟수 1) `load`만 다시 보낸다
  - `choose` 성공: 보낸 `choose` 메시지의 `id`로 `chosen {ok:true, move:{row:3,col:4}, stdout:'x'}`를 응답하면 `{move:{row:3,col:4}, stdout:'x'}`로 resolve
  - `choose` 실패 결과(`ok:false`)는 `PlayerFailureError`로 reject하고 `failure`가 그대로 전달됨
  - 시간 초과: 응답하지 않으면 `PlayerFailureError(kind 'timeout')`로 reject하고 Worker가 `terminate`됨. 그 뒤 다시 `prepare`하면 `createWorker`가 새로 호출됨 (Review Focus 무한 반복 후 재실행)
  - 시간 초과 뒤에 늦게 온 `chosen` 응답은 무시되고(예외 없음), 다른 `id`의 응답도 무시됨
  - `load` 시간 초과(응답 없음): `terminate`되고 `{ok:false, failure.kind 'timeout'}` 반환
  - `dispose`는 `terminate`를 호출함
- [ ] **Step 2:** `npx vitest run tests/python/PythonPlayer.test.ts` → FAIL
- [ ] **Step 3:** `PythonPlayer.ts`를 위 동작대로 구현한다. 요청-응답 대응은 증가하는 `id`로 한다.
- [ ] **Step 4:** `pyodide.worker.ts`를 메시지 규약대로 작성한다(`self.onmessage`, `createPythonSession`, `HARNESS_PY` 등록). 단위 테스트는 없고 Task 8에서 브라우저로 검증한다.
- [ ] **Step 5:** `npx vitest run tests/python/PythonPlayer.test.ts` → PASS. `npm test` 전체 PASS, `npx tsc -b` 오류 없음.

---

### Task 6: 로그 문구(`formatEvent`)

**Files:**
- Create: `src/runner/logFormat.ts`
- Test: `tests/runner/logFormat.test.ts`

**Interfaces:**
- Consumes: Task 1의 `GameEvent`; `Color`/`Move`(engine)
- Produces:
  - `interface LogLine { kind: 'info' | 'move' | 'print' | 'error' | 'result'; text: string }`
  - `formatEvent(event: GameEvent, names: { black: string; white: string }): LogLine[]`
  - `coordText(move: Move): string` — `(행, 열)` 형식, 예 `(7, 7)`

문구(정확히):
- `start` → `info` `대국 시작 · 흑 <black> / 백 <white>`
- `move` → `move` `<수번호>. <흑|백> <이름> (r, c)`; `stdout`이 있으면 줄마다 `print` `print: <줄>`을 추가(빈 줄 제외)
- `foul` → `error` `<흑|백> <이름> 반칙: <message>`; `failure.stdout`이 있으면 `print` 줄 추가
- `end` → `result`: `reason 'five'`이면 `<이름> 승리`, `'full'`이면 `<이름> 승리 (판이 가득 차서 백 승리)`, `'foul'`이면 `<이름> 승리 (상대 반칙)`

- [ ] **Step 1: 실패하는 테스트를 작성한다** (`tests/runner/logFormat.test.ts`): 각 이벤트 종류별 위 문구, 여러 줄 `stdout`이 줄 단위 `print`로 나뉘고 빈 줄이 빠짐, `foul`의 `failure.stdout` 처리, 흑/백 이름이 올바르게 매핑됨, `coordText({row:7,col:7})`가 `(7, 7)`
- [ ] **Step 2:** `npx vitest run tests/runner/logFormat.test.ts` → FAIL
- [ ] **Step 3:** 구현한다.
- [ ] **Step 4:** 같은 명령 → PASS. `npm test` 전체 PASS.

---

### Task 7: 테마, 오목판, title 페이지

**Files:**
- Modify: `package.json`(의존성), `src/main.tsx`(글꼴 import), `src/index.css`, `src/ui/ui.css`(교체), `src/ui/Board.tsx`(읽기 전용으로 단순화·시안 3 스타일), `src/ui/TitlePage.tsx`(시안 3), `src/ui/App.tsx`
- Test: 컴포넌트 테스트 도구는 추가하지 않는다. `npx tsc -b`, `npm run build`와 Task 9의 수동 검증으로 확인한다.

**Interfaces:**
- Consumes: `Board as BoardState`, `Color`, `Move`(engine)
- Produces:
  - `Board({ board, lastMove, winningLine, foulMove }: { board: BoardState; lastMove: Move | null; winningLine: Move[] | null; foulMove: Move | null })` — 클릭/호버 없음. `foulMove`는 반칙한 자리에 붉은 ×. 호두나무색 판(결 무늬), 별점, 광택 있는 돌, 마지막 수는 붉은 점, 이긴 줄은 붉은 링. 폭 100%(최대 560px), 비율 유지.
  - `TitlePage({ onStartPractice }: { onStartPractice: () => void })` — 시안 3: 어두운 방 배경과 위에서 비치는 조명, 금색 "오목", 한 줄 소개, 기울여 놓은 작은 판(샘플 대국 위치, `Board` 재사용), "연습 모드" 금색 버튼, 비활성 "토너먼트 · 준비 중".
  - 공용 테마 변수(CSS 사용자 지정 속성)와 클래스: 대국장 배경, 금색, 호두나무색, "종이 패널"(에디터를 담는 밝은 패널), 버튼 스타일. 글꼴: 제목/본문 `Gowun Batang`, 코드/로그 `JetBrains Mono`.
- 의존성: `@fontsource/gowun-batang`, `@fontsource/jetbrains-mono`를 설치하고 `main.tsx`에서 필요한 굵기 CSS를 import한다.

- [ ] **Step 1:** `npm install @fontsource/gowun-batang @fontsource/jetbrains-mono`
- [ ] **Step 2:** `Board.tsx`를 위 인터페이스대로 다시 쓴다. 기존의 `onCellClick`, `hoverColor`, `disabled`, `forbiddenCells` 속성과 호버 로직은 삭제한다.
- [ ] **Step 3:** 테마 CSS(`ui.css`)와 `TitlePage.tsx`를 시안 3대로 작성한다. 시안 파일(`public/mockups.html`의 `.t3` 부분)을 참고하되 값은 CSS 변수로 정리한다. `prefers-reduced-motion`을 존중하고(이 화면은 정적이다) 키보드 포커스가 보이게 한다.
- [ ] **Step 4:** `App.tsx`가 `title`과 `practice` 두 화면을 상태로 전환하게 둔다(이 시점에는 `PracticePage`가 임시 자리표시자여도 된다. Task 8에서 교체).
- [ ] **Step 5: 검증.** `npx tsc -b`, `npm run build` 오류 없음. `npm run dev`로 title을 열어 조명, 금색 제목, 작은 판, 버튼이 보이고 토너먼트 버튼이 눌리지 않는다.

---

### Task 8: 연습 모드 화면(에디터, 컨트롤, 판, 로그)

**Files:**
- Create: `src/ui/CodeEditor.tsx`, `src/ui/LogPanel.tsx`, `src/ui/storage.ts`
- Modify: `src/ui/PracticePage.tsx`(전면 교체), `src/ui/ui.css`
- Modify: `package.json`(의존성 `@uiw/react-codemirror`, `@codemirror/lang-python`)
- Test: `tests/ui/storage.test.ts`

**Interfaces:**
- Consumes: Task 2 `runGame`, `RunGameOptions`; Task 3 `createAiPlayer`, `WorkerLike`; Task 5 `PythonPlayer`; Task 6 `formatEvent`, `LogLine`; Task 4 `STARTER_CODE`; `Game`/`tossCoin`(engine), `Board`(Task 7), `Difficulty`
- Produces:
  - `storage.ts`: `loadCode(storage?: Pick<Storage, 'getItem'>): string`(저장된 코드 또는 `STARTER_CODE`, 접근 중 예외가 나도 `STARTER_CODE`), `saveCode(code: string, storage?: Pick<Storage, 'setItem'>): void`(예외 무시), 상수 `CODE_KEY = 'omok.code.v1'`. 기본 `storage`는 `localStorage`.
  - `CodeEditor({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled: boolean })` — CodeMirror 6, Python 문법 강조, 줄 번호, 밝은 "종이 패널" 테마, JetBrains Mono. 실행 중에는 읽기 전용.
  - `LogPanel({ lines }: { lines: LogLine[] })` — 고정폭 로그. 종류별 색(오류 붉은색, print 보라/파란색, 결과 굵게), 새 줄이 생기면 아래로 스크롤하되 사용자가 위로 올려 둔 경우는 방해하지 않는다. `aria-live="polite"`.
  - `PracticePage({ onExit }: { onExit: () => void })`

`PracticePage` 동작:
- 레이아웃: 넓은 화면은 왼쪽 에디터 패널 + 오른쪽 판 패널, 좁은 화면(≤ 860px)은 위아래. 에디터 위에 접히는 도움말("choose(state)가 받는 state 항목과 반환 형식", Global Constraints의 항목 목록).
- 컨트롤: 내 색(흑/백/코인), 상대(하/중/상), 속도(느리게 800/보통 400/빠르게 100/즉시 0ms), 버튼 "실행"/"중지", "예제로 되돌리기"(확인 없이 `STARTER_CODE`로 교체).
- 코드는 변경 시 `saveCode`로 저장한다(과도한 쓰기를 피하려고 300ms 디바운스).
- 이름판 두 개(나의 코드 · 흑/백, AI · 하/중/상)와 현재 수 번호. 진행 중인 쪽이 강조된다.
- "실행": ① 이전 실행을 중단(`AbortController.abort()`)하고 새 컨트롤러를 만든다. 로그와 판을 비운다. ② 상태 `준비 중`(로그에 "Python 준비 중… 처음에는 몇 초 걸립니다.")에서 `PythonPlayer.prepare(code)`. 인스턴스는 페이지 수명 동안 하나를 재사용한다(Worker 생성 함수는 `new Worker(new URL('../python/pyodide.worker.ts', import.meta.url), { type: 'module' })`). `prepare`가 `ok:false`이면 오류 로그(`failure.message`, 줄 번호가 있으면 `n번째 줄`)만 남기고 종료, `Error`로 reject하면 "Python을 불러오지 못했습니다. 인터넷 연결을 확인하고 다시 실행하세요." ③ 색 결정(코인이면 `tossCoin()`), AI는 `createAiPlayer(difficulty, difficulty === 'hard' ? () => new Worker(new URL('../ai/hard.worker.ts', import.meta.url), { type: 'module' }) : undefined)`. ④ `runGame({ black, white, onEvent, signal, pauseMs })`. `onEvent`는 컨트롤러가 현재 것일 때만 판/로그/수 번호를 갱신한다(판은 `move` 이벤트를 받아 `placeStone`으로 갱신, `foul`의 `move`가 있으면 `foulMove`, `end`의 `line`을 `winningLine`). ⑤ 끝나면 AI Worker를 `dispose`.
- "중지": 컨트롤러를 abort하고 AI Worker를 정리, 로그에 `중지했습니다.`. Python Worker는 살아 있는 채로 둔다(재사용). 시간 초과로 Worker가 이미 종료된 경우는 다음 `prepare`가 새로 만든다.
- 페이지를 떠날 때(`onExit`/언마운트): abort, AI와 Python Worker 모두 `dispose`.
- 실행 중에는 "실행"이 "중지"로 바뀌고, 에디터와 컨트롤(색/상대/속도)이 비활성이다.
- 결과 배너: 판 위에 `<이름> 승리` 한 줄. 반칙으로 진 경우 이유가 로그에 이미 있으므로 배너에는 "반칙패"만 덧붙인다.

- [ ] **Step 1:** `npm install @uiw/react-codemirror @codemirror/lang-python`
- [ ] **Step 2: 실패하는 테스트를 작성한다** (`tests/ui/storage.test.ts`): 가짜 storage에 값이 있으면 그 값을 반환, 없으면 `STARTER_CODE`, `getItem`이 throw해도 `STARTER_CODE`, `saveCode`가 `CODE_KEY`로 `setItem`을 호출, `setItem`이 throw해도 예외가 밖으로 나오지 않음
- [ ] **Step 3:** `npx vitest run tests/ui/storage.test.ts` → FAIL
- [ ] **Step 4:** `storage.ts`를 구현한다 → PASS.
- [ ] **Step 5:** `CodeEditor.tsx`, `LogPanel.tsx`를 위 인터페이스대로 구현하고 `PracticePage.tsx`를 위 동작대로 작성한다. 이전 `PracticePage`의 사람 직접 두기 코드는 모두 지운다.
- [ ] **Step 6:** 스타일(`ui.css`): 시안 3의 대국장 배경 위에 에디터는 "종이 패널"로 놓이고, 로그 패널은 시안 2의 연한 로그 창 느낌을 어두운 방에 맞춰 조정한다. 키보드 포커스 표시, 모바일 폭에서 가로 스크롤 없음.
- [ ] **Step 7: 정적 검증.** `npx tsc -b`와 `npm run build` 오류 없음. `npm test` 전체 PASS.

---

### Task 9: 정리와 종합 검증

**Files:**
- Modify: `CLAUDE.md`(구조·명령 갱신), `docs/superpowers/plans/2026-11-18-practice-mode.progress.md`(원장 추가)
- Delete: `public/mockups.html`(선택이 끝난 시안 페이지)

- [ ] **Step 1:** `CLAUDE.md`의 "구조"를 `src/runner`, `src/python` 포함으로 갱신하고, 연습 모드가 코드로 두기라는 한 줄과 `npm test`에 Pyodide 테스트(수 초 소요)가 포함됨을 적는다.
- [ ] **Step 2:** `public/mockups.html`을 삭제한다.
- [ ] **Step 3: 수동 검증** (`npm run dev`, Playwright 또는 브라우저). 각 항목의 기대 결과를 확인한다.
  - title → "연습 모드" → 예제 코드로 "실행": "Python 준비 중" 표시 후 대국이 끝까지 진행되고, 판에 수가 놓이며 로그에 착수 기록과 결과가 나온다. 상(hard)도 한 판 완주한다.
  - 두 번째 "실행"은 첫 번째보다 빠르게 시작한다(Worker 재사용).
  - 코드를 `def choose(state):\n    while True:\n        pass`로 바꾸고 실행: 화면(버튼, 스크롤)이 계속 반응하고 약 2초 뒤 시간 초과 반칙으로 끝난다. 이어서 예제 코드로 다시 실행하면 정상 동작한다. (Review Focus)
  - 대국 도중 "중지" → 로그에 `중지했습니다.`, 이후 로그가 더 늘지 않는다. 느린 속도로 실행하다가 바로 다시 "실행"해도 이전 대국의 수가 새 판에 나타나지 않는다. (Review Focus)
  - 문법 오류 코드: 줄 번호가 있는 안내가 나오고 대국은 시작하지 않는다. `choose`가 없는 코드, `return None`, `raise ValueError`, `print("디버그")` 각각 로그에 문구가 올바르게 나온다.
  - 흑 금수 자리를 반환하는 코드(예: 삼삼 자리)를 만들 수 있으면 반칙 문구에 금수 이름과 자리가 나오고 판에 × 가 표시된다. 판 밖 `(20, 3)` 반환은 "판 밖입니다".
  - 코드를 수정하고 새로고침해도 코드가 유지된다. "예제로 되돌리기"가 동작한다.
  - 내 색 흑/백/코인과 AI 하/중/상 조합이 모두 시작된다. 백일 때 AI가 먼저 둔다.
  - 모바일 폭(약 390px)에서 가로 스크롤이 없고 에디터, 판, 로그가 위아래로 쌓인다.
  - 브라우저 콘솔에 예기치 않은 오류가 없다.
- [ ] **Step 4:** `npm test`(전체), `npx tsc -b`, `npm run build`가 모두 통과하는지 확인한다. 개발 서버를 띄웠다면 종료하지 않고 둔다(사용자가 사용 중).
- [ ] **Step 5:** 설계 문서의 목표 4개(코드 작성→자동 대국, 판/로그 표시, 화면이 멈추지 않고 시간 초과로 끊김, 토너먼트 재사용 가능한 호출 구조)를 하나씩 대조해 충족을 확인하고 원장에 적는다.
