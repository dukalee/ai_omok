# 연습 모드 (사람 vs AI 오목) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** title 페이지와, 사람이 상/중/하 AI와 오목을 두는 연습 모드를 만든다.

**Architecture:** 규칙 엔진(`src/engine`)과 AI(`src/ai`)는 React에 의존하지 않는 순수 TypeScript이고, React(`src/ui`)는 화면만 담당한다. 상 난이도는 Minimax(알파-베타, 반복 심화)를 Web Worker에서 실행한다.

**Tech Stack:** React, Vite, TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-18-practice-mode-design.md` (규칙: `game_rules.md`)

> 이 폴더는 Git 저장소가 아니므로 커밋 단계는 두지 않는다. 각 태스크는 테스트 통과로 완료를 확인한다.

## Global Constraints

- React, Vite, TypeScript. 테스트는 Vitest. 패키지 관리자는 npm.
- 판은 15×15, 좌표는 `(row, col)`이며 0~14. `0`은 빈 칸, `1`은 흑, `2`는 백.
- 자유 룰: 다섯 개 이상 연속이면 승리(6목 이상도 승리). 금수 없음.
- 흑 선공. 흑백은 코인 던지기로 정한다. 판이 가득 차도 승자가 없으면 백 승리. 무승부는 없다.
- 규칙 엔진과 AI는 React를 import하지 않는다.
- 상 난이도: 후보 칸은 기존 돌에서 2칸 이내, 반복 심화로 깊이 2부터, 최대 깊이 4, 시간 제한 약 1500ms, Web Worker에서 실행.
- 라우터 라이브러리를 쓰지 않는다. 화면 전환은 상태 하나로 처리한다.
- title 페이지의 "토너먼트" 버튼은 "준비 중"으로 비활성화한다.
- 이번 범위 밖: 토너먼트, Supabase, Pyodide, 렌주 룰, 무르기, 대국 저장, 착수 기록 재생.

## Review Focus

- 백이 승리할 판이 가득 찬 경우(225수)에 승자가 백이어야 한다. → Task 3 테스트
- 판 가장자리(모서리 포함)에서 완성된 오목이 판정된다. → Task 2 테스트
- 사람이 백으로 정해지면 AI(흑)가 먼저 두어야 한다. → Task 9 검증
- AI가 생각하는 중이거나 이미 돌이 있는 칸을 클릭해도 아무 일도 없어야 한다. → Task 9 검증
- 상 난이도 계산 중 "다시 하기"나 "title로"를 눌러도 이전 대국의 AI 응답이 새 대국에 적용되지 않아야 한다. → Task 9 검증

---

### Task 1: 프로젝트 스캐폴딩과 Vitest

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig*.json`, `index.html`, `src/main.tsx`, `src/ui/App.tsx` (Vite react-ts 템플릿을 프로젝트 루트에 풀어서 생성)
- Create: `tests/smoke.test.ts`

**Interfaces:**
- Produces: `npm run dev`, `npm run build`, `npm test`(= `vitest run`) 스크립트. `src/` 아래 `engine/`, `ai/`, `ui/` 폴더 구조.

- [ ] **Step 1:** 스크래치패드의 새 빈 폴더에서 `npm create vite@latest app -- --template react-ts`로 템플릿을 만들고, `CLAUDE.md`, `game_rules.md`, `PRD.md`, `docs/`를 덮어쓰지 않도록 주의해 프로젝트 루트로 복사한다. 템플릿의 `README.md`와 기본 예제(카운터, 로고, `App.css`)는 복사하지 않는다. `src/App.tsx`는 `src/ui/App.tsx`로 옮기고 `src/main.tsx`의 import를 맞춘다.
- [ ] **Step 2:** `npm install`, `npm install -D vitest`. `package.json`에 `"test": "vitest run"`을 추가한다. 테스트는 `tests/**/*.test.ts`를 대상으로 하고 환경은 `node`이다.
- [ ] **Step 3: 스모크 테스트를 작성한다.** `tests/smoke.test.ts`에서 `expect(1 + 1).toBe(2)`.
- [ ] **Step 4: 검증.** `npm test` → PASS. `npm run build` → 성공. `npm run dev`가 기동되어 빈 App이 보인다.

---

### Task 2: 판 타입과 오목 판정

**Files:**
- Create: `src/engine/types.ts`, `src/engine/board.ts`, `src/engine/rules.ts`
- Test: `tests/engine/rules.test.ts`

**Interfaces:**
- Produces (`types.ts`): `type Color = 1 | 2`, `type Cell = 0 | Color`, `type Board = Cell[][]`, `interface Move { row: number; col: number }`, `const BOARD_SIZE = 15`
- Produces (`board.ts`): `createBoard(): Board`, `cloneBoard(board: Board): Board`, `isValidMove(board: Board, move: Move): boolean`(판 안이고 빈 칸), `placeStone(board: Board, move: Move, color: Color): void`(제자리 변경, 유효하지 않으면 `Error`), `removeStone(board: Board, move: Move): void`, `isBoardFull(board: Board): boolean`
- Produces (`rules.ts`): `opponent(color: Color): Color`, `findWinningLine(board: Board, move: Move): Move[] | null` — `move` 위치의 돌을 지나는 가로/세로/대각선 중 다섯 개 이상 연속인 줄의 좌표들(연속 구간 전체)을 반환하고, 없으면 `null`

- [ ] **Step 1: 실패하는 테스트를 작성한다** (`tests/engine/rules.test.ts`). 각 케이스는 `createBoard()`에 돌을 직접 놓고 마지막 돌 위치로 `findWinningLine`을 호출한다.
  - 가로 5목, 세로 5목, `\` 대각선 5목, `/` 대각선 5목 → 길이 5인 좌표 배열
  - 6목(가로) → 길이 6 (자유 룰이므로 승리)
  - 4목 → `null`
  - 다섯 개 중간에 상대 돌이 끼면 → `null`
  - 모서리 `(0,0)`~`(0,4)` 가로 5목과 `(14,14)` 쪽 대각선 5목 → 판정됨
  - 마지막 돌이 줄의 중간에 놓여 5목이 완성되는 경우 → 판정됨
  - `placeStone`: 이미 돌이 있는 칸, 판 밖 `(-1,0)`, `(0,15)` → `Error`; `isValidMove`는 같은 입력에 `false`
  - `isBoardFull`: 빈 판 `false`, 모든 칸이 채워진 판 `true`
- [ ] **Step 2:** `npx vitest run tests/engine/rules.test.ts` → FAIL (모듈 없음).
- [ ] **Step 3:** 위 시그니처대로 구현한다. 판정은 네 방향(가로, 세로, 두 대각선)에 대해 `move`에서 양쪽으로 같은 색이 이어지는 길이를 센다.
- [ ] **Step 4:** 같은 명령 → PASS.

---

### Task 3: 한 판의 진행 (`Game`)과 코인 던지기

**Files:**
- Create: `src/engine/game.ts`
- Test: `tests/engine/game.test.ts`

**Interfaces:**
- Consumes: Task 2의 `Board`, `Color`, `Move`, `createBoard`, `placeStone`, `isBoardFull`, `findWinningLine`, `opponent`
- Produces:
  - `tossCoin(rng?: () => number): Color` — `rng() < 0.5`이면 `1`, 아니면 `2`. `rng` 기본값은 `Math.random`
  - `type GameStatus = { state: 'playing' } | { state: 'won'; winner: Color; line: Move[] | null; reason: 'five' | 'full' }`
  - `class Game { board: Board; toMove: Color; status: GameStatus; history: { color: Color; move: Move }[]; play(move: Move): void }`
    - 시작 시 `toMove`는 `1`(흑). `play`는 현재 `toMove`의 돌을 놓고 차례를 넘기며 `history`에 기록한다. 이긴 경우 `status`가 `won`(reason `five`, `line`은 이긴 줄)이 된다. 판이 가득 차도 승자가 없으면 `winner: 2`, `reason: 'full'`, `line: null`
    - 게임이 끝난 뒤나 유효하지 않은 칸에 `play`하면 `Error`

- [ ] **Step 1: 실패하는 테스트를 작성한다** (`tests/engine/game.test.ts`).
  - `tossCoin(() => 0.1)` → `1`, `tossCoin(() => 0.9)` → `2`
  - 새 `Game`: `toMove === 1`, `status.state === 'playing'`, `history`가 비어 있음
  - 두 수를 두면 `history` 길이 2이고 색이 `1`, `2` 순서
  - 흑이 다섯 개를 이으면 `status`가 `{ state: 'won', winner: 1, reason: 'five' }`이고 `line.length === 5`
  - 게임 종료 후 `play` 호출과, 이미 돌이 있는 칸에 `play` 호출 → `Error`
  - **225수 시나리오:** 어느 쪽도 5목이 나오지 않는 패턴으로 판을 모두 채운다(행마다 `1,1,2,2` 반복을 한 칸씩 어긋나게 배치하는 식으로, 테스트 안에서 5목이 없음을 검증하는 헬퍼를 둔다). 마지막 수 이후 `status`가 `{ state: 'won', winner: 2, reason: 'full', line: null }`
- [ ] **Step 2:** `npx vitest run tests/engine/game.test.ts` → FAIL.
- [ ] **Step 3:** 위 시그니처대로 구현한다.
- [ ] **Step 4:** 같은 명령 → PASS. `npm test` 전체도 PASS.

---

### Task 4: AI 공통 타입, 후보 칸, 패턴 평가

**Files:**
- Create: `src/ai/types.ts`, `src/ai/evaluate.ts`
- Test: `tests/ai/evaluate.test.ts`

**Interfaces:**
- Consumes: Task 2의 `Board`, `Color`, `Move`, `BOARD_SIZE`, `isValidMove`, `placeStone`, `removeStone`, `opponent`
- Produces:
  - `types.ts`: `type AI = (board: Board, color: Color) => Move`, `type Difficulty = 'easy' | 'medium' | 'hard'`
  - `evaluate.ts`:
    - `candidateMoves(board: Board, radius?: number): Move[]` — 기존 돌에서 `radius`(기본 2)칸 이내의 빈 칸. 판이 비어 있으면 중앙 `(7,7)` 하나만 반환
    - `scoreMove(board: Board, move: Move, color: Color): number` — `color`가 `move`에 둘 때 만드는 연결 형태의 점수. 네 방향의 연속 길이와 양 끝의 열림/막힘으로 점수를 매긴다. 상대 우선순위(큰 값 순): 5목 이상 완성 > 열린 4 > 막힌 4 > 열린 3 > 막힌 3 > 열린 2 > 그 외. 구체 숫자는 이 순서를 지키는 범위에서 구현자가 정한다
    - `evaluateBoard(board: Board, color: Color): number` — `color` 관점의 판 전체 평가값(내 형태 점수 합 − 상대 형태 점수 합). 상 난이도의 말단 평가에 쓴다

- [ ] **Step 1: 실패하는 테스트를 작성한다** (`tests/ai/evaluate.test.ts`).
  - 빈 판의 `candidateMoves` → `[{row:7,col:7}]`
  - 돌이 `(7,7)` 하나일 때 `candidateMoves` → `(5..9, 5..9)` 범위의 빈 칸 24개이고 `(7,7)`을 포함하지 않음
  - 판 모서리 돌의 후보는 판 밖 좌표를 포함하지 않음
  - `scoreMove` 순서: 같은 판 구성에서 (5목 완성 칸) > (열린 4를 만드는 칸) > (열린 3을 만드는 칸) > (연결 없는 칸). 각각의 판은 테스트에서 직접 구성한다
  - 열린 3이 막힌 3보다 점수가 높다
  - `evaluateBoard`: 흑 열린 3이 있는 판에서 `evaluateBoard(board, 1) > 0`이고 `evaluateBoard(board, 2) < 0`
- [ ] **Step 2:** `npx vitest run tests/ai/evaluate.test.ts` → FAIL.
- [ ] **Step 3:** 위 시그니처대로 구현한다. `scoreMove`는 판을 변경하지 않아야 한다(변경했다면 되돌린다).
- [ ] **Step 4:** 같은 명령 → PASS.

---

### Task 5: 하 난이도 AI

**Files:**
- Create: `src/ai/easy.ts`
- Test: `tests/ai/easy.test.ts`

**Interfaces:**
- Consumes: Task 4의 `AI`, `candidateMoves`; Task 2의 `placeStone`, `removeStone`, `findWinningLine`, `opponent`, `cloneBoard`
- Produces: `createEasyAI(rng?: () => number): AI` (`rng` 기본값 `Math.random`)

- [ ] **Step 1: 실패하는 테스트를 작성한다** (`tests/ai/easy.test.ts`).
  - 빈 판 → `{row:7,col:7}` (중앙)
  - 내 돌 4개가 일렬(열린 4)이면 5목을 완성하는 칸 중 하나를 둔다 (두 칸 모두 정답)
  - 상대 돌 4개가 일렬이면 상대의 완성 칸을 막는다 (막힌 4 형태로 한쪽만 열려 있는 경우의 유일한 칸)
  - 내 5목 완성과 상대 5목 저지가 동시에 가능하면 내 5목 완성을 우선한다
  - 위에 해당하지 않으면 반환한 칸이 `candidateMoves(board)`에 포함된다 (여러 `rng` 값으로 반복)
  - 반환한 칸은 항상 빈 칸이다
- [ ] **Step 2:** `npx vitest run tests/ai/easy.test.ts` → FAIL.
- [ ] **Step 3:** 우선순위는 (1) 내가 두면 5목이 되는 칸, (2) 상대가 두면 5목이 되는 칸, (3) `candidateMoves` 중 `rng`로 선택. 판단을 위해 후보 칸에 임시로 돌을 놓고 `findWinningLine`을 호출한 뒤 되돌린다.
- [ ] **Step 4:** 같은 명령 → PASS.

---

### Task 6: 중 난이도 AI

**Files:**
- Create: `src/ai/medium.ts`
- Test: `tests/ai/medium.test.ts`

**Interfaces:**
- Consumes: Task 4의 `AI`, `candidateMoves`, `scoreMove`; Task 2의 `opponent`
- Produces: `createMediumAI(rng?: () => number): AI`

- [ ] **Step 1: 실패하는 테스트를 작성한다** (`tests/ai/medium.test.ts`).
  - 빈 판 → `{row:7,col:7}`
  - 내 열린 4가 있으면 5목을 완성한다
  - 상대의 열린 3(양 끝이 열린 3목)이 있고 내게 더 급한 수가 없을 때, 상대 열린 3의 양 끝 칸 중 하나를 둔다
  - 상대의 4목(한쪽만 열림)이 있으면 그 칸을 막는다
  - 점수가 같은 후보가 여럿이면 `rng`에 따라 서로 다른 칸이 나온다 (두 개의 서로 다른 `rng` 고정값으로 확인)
- [ ] **Step 2:** `npx vitest run tests/ai/medium.test.ts` → FAIL.
- [ ] **Step 3:** 각 후보 `m`에 대해 `scoreMove(board, m, color)`(공격) + `scoreMove(board, m, opponent(color))`(수비)를 합산해 최고점 후보를 고른다. 동점이면 `rng`로 선택한다. 공격 점수에 약간의 가중을 두어 내가 이길 수 있을 때 막기보다 이기도록 한다.
- [ ] **Step 4:** 같은 명령 → PASS.

---

### Task 7: 상 난이도 AI와 Worker

**Files:**
- Create: `src/ai/hard.ts`, `src/ai/hard.worker.ts`
- Test: `tests/ai/hard.test.ts`

**Interfaces:**
- Consumes: Task 4의 `AI`, `candidateMoves`, `scoreMove`, `evaluateBoard`; Task 2의 `placeStone`, `removeStone`, `findWinningLine`, `opponent`, `cloneBoard`
- Produces:
  - `hard.ts`: `createHardAI(options?: { maxDepth?: number; timeLimitMs?: number; rng?: () => number }): AI` — 기본값 `maxDepth: 4`, `timeLimitMs: 1500`
  - `hard.worker.ts`: 메시지 `{ board: Board; color: Color }`를 받아 `createHardAI()`로 계산한 `Move`를 `postMessage`로 돌려준다

- [ ] **Step 1: 실패하는 테스트를 작성한다** (`tests/ai/hard.test.ts`). 테스트는 `createHardAI({ maxDepth: 3, timeLimitMs: 1000 })`를 쓴다.
  - 빈 판 → `{row:7,col:7}`
  - 내 4목 → 5목 완성 칸을 둔다
  - 상대의 4목(한쪽 열림) → 그 칸을 막는다
  - **두 수 앞 승리:** 내 열린 3 하나와 연결되는 형태에서, 한 수로 열린 4를 만들어 이기는 판을 구성하면 열린 4를 만드는 칸을 둔다
  - **상대 열린 3 대응:** 내 즉시 승리가 없고 상대가 열린 3이면 그 3을 막는 칸(양 끝 또는 그에 준하는 수)을 둔다
  - `timeLimitMs: 100`을 주면 호출이 약 300ms 안에 반환된다 (시간 제한 준수)
  - 호출 전후 입력 `board`가 변경되지 않는다 (깊은 비교)
- [ ] **Step 2:** `npx vitest run tests/ai/hard.test.ts` → FAIL.
- [ ] **Step 3:** 구현: 반복 심화로 깊이 2부터 `maxDepth`까지 알파-베타 Minimax를 반복하되, 시간이 `timeLimitMs`를 넘으면 직전 깊이의 최선 수를 반환한다. 각 노드에서 후보 칸은 `candidateMoves`를 `scoreMove` 합계(공격+수비)로 내림차순 정렬하고 상위 N개(구현자 선택, 시작값 12~15)만 탐색한다. 즉시 승리 수는 탐색 전에 바로 반환한다. 말단 평가는 `evaluateBoard`. 탐색 중에는 `placeStone`/`removeStone`으로 판을 변경하고 되돌리며, 외부에 노출되는 `board`는 변경하지 않도록 진입 시 `cloneBoard`한다.
- [ ] **Step 4:** `hard.worker.ts`를 `self.onmessage`로 작성한다.
- [ ] **Step 5:** `npx vitest run tests/ai/hard.test.ts` → PASS.

---

### Task 8: 난이도 순서 검증

**Files:**
- Test: `tests/ai/strength.test.ts`

**Interfaces:**
- Consumes: `createEasyAI`, `createMediumAI`, `createHardAI`, `Game`, `AI`, `Color`
- Produces: 없음 (검증 전용)

- [ ] **Step 1:** 헬퍼 `playMatch(blackAI: AI, whiteAI: AI): Color`를 테스트 안에 작성한다. `Game`을 만들어 차례대로 각 AI의 `chooseMove(game.board, game.toMove)`를 호출하고 승자를 반환한다. AI의 `rng`는 시드 고정된 간단한 의사난수 함수(테스트 파일 안에 정의)로 준다.
- [ ] **Step 2: 테스트를 작성한다.**
  - `medium vs easy`: 흑백을 번갈아 총 10판 → 중이 8판 이상 이긴다
  - `hard vs medium`: 흑백을 번갈아 총 6판(`createHardAI({ maxDepth: 2, timeLimitMs: 300 })`) → 상이 4판 이상 이긴다
  - 테스트 타임아웃은 넉넉히(예: 120초) 설정한다
- [ ] **Step 3:** `npx vitest run tests/ai/strength.test.ts` → 실패 시 `evaluate.ts`의 점수 값, 후보 칸 개수 등 튜닝값을 조정한다. 조정 후 `npm test` 전체가 PASS해야 한다. 기준을 낮추는 것으로 통과시키지 않는다.

---

### Task 9: 화면 (오목판, title, 연습 모드)

**Files:**
- Create: `src/ui/Board.tsx`, `src/ui/TitlePage.tsx`, `src/ui/PracticePage.tsx`, 스타일 파일(`src/ui/*.css` 또는 CSS 모듈)
- Modify: `src/ui/App.tsx`, `index.html`(문서 제목)
- Test: 화면 로직은 아래 수동 검증과 `npm run build`로 확인 (이 단계에서 컴포넌트 테스트 도구는 추가하지 않는다)

**Interfaces:**
- Consumes: `Game`, `tossCoin`, `Board`, `Color`, `Move`, `isValidMove`(`src/engine`); `createEasyAI`, `createMediumAI`, `Difficulty`, `AI`, `hard.worker.ts`(`src/ai`)
- Produces:
  - `Board.tsx`: `Board({ board, lastMove, winningLine, hoverColor, disabled, onCellClick }: { board: BoardState; lastMove: Move | null; winningLine: Move[] | null; hoverColor: Color; disabled: boolean; onCellClick: (move: Move) => void })` — 15×15 격자의 교차점에 돌을 그리고(SVG 권장), 마우스를 올린 빈 교차점에 `hoverColor`의 반투명 돌을 보여주며, 마지막 수와 이긴 줄을 강조한다. `disabled`이거나 돌이 있는 칸 클릭은 `onCellClick`을 호출하지 않는다.
  - `App.tsx`: 상태 `'title' | 'practice'`로 `TitlePage`와 `PracticePage`를 전환한다.
  - `TitlePage({ onStartPractice }: { onStartPractice: () => void })`: 게임 이름, "연습 모드" 버튼, 비활성화된 "토너먼트 (준비 중)" 버튼.
  - `PracticePage({ onExit }: { onExit: () => void })`: 단계 `select`(난이도 선택) → `playing` → `finished`.

- [ ] **Step 1: `Board.tsx`를 작성한다.** 위 인터페이스대로. 구체 디자인(색, 크기, 반응형)은 구현자가 정한다. 모바일 폭에서도 판이 가로로 넘치지 않게 한다.
- [ ] **Step 2: `TitlePage.tsx`, `App.tsx`를 작성한다.** "연습 모드" 클릭 시 `practice`로 전환한다.
- [ ] **Step 3: `PracticePage.tsx`를 작성한다.**
  - `select`: 하/중/상 버튼. 선택하면 `tossCoin()`으로 사람의 색을 정하고 "당신은 흑(선공)/백입니다"를 표시하며 `Game`을 시작한다.
  - 사람 차례에 `onCellClick`으로 `game.play`. AI 차례에는 `disabled`를 켜고 "AI 생각 중"을 표시한다.
  - 사람이 백이면 대국 시작 직후 AI(흑)가 먼저 둔다.
  - 하/중은 `createEasyAI()`/`createMediumAI()`를 약 300ms 지연 후 실행하고, 상은 `new Worker(new URL('../ai/hard.worker.ts', import.meta.url), { type: 'module' })`로 계산한다.
  - 각 AI 요청에 증가하는 요청 번호(또는 세대 번호)를 붙이고, 응답이 돌아왔을 때 현재 대국의 번호와 다르면 무시한다. 대국이 끝나거나 화면을 떠날 때(`onExit`, 난이도 변경, 다시 하기) Worker를 `terminate`한다.
  - `finished`: 승자("당신이 이겼습니다"/"AI가 이겼습니다")와 이긴 줄 강조를 표시한다. `reason === 'full'`이면 "판이 가득 차서 백이 승리했습니다"를 함께 표시한다. 버튼: "다시 하기"(같은 난이도, 코인 던지기 새로), "난이도 변경", "title로".
- [ ] **Step 4: 정적 검증.** `npx tsc --noEmit`과 `npm run build` → 오류 없음.
- [ ] **Step 5: 수동 검증** (`npm run dev` 후 브라우저에서 확인. Playwright MCP 사용 가능):
  - title에서 "연습 모드"로 이동하고, "토너먼트" 버튼은 눌리지 않는다.
  - 하/중/상 각각 한 판을 시작해 AI가 응답한다. 상은 약 2초 안에 응답하고 그동안 화면이 멈추지 않는다.
  - 사람이 백이 나올 때까지 "다시 하기"를 반복해, AI(흑)가 먼저 두는 것을 확인한다.
  - AI 생각 중에 판을 클릭해도 돌이 놓이지 않고, 이미 돌이 있는 칸을 클릭해도 변화가 없다.
  - 상 난이도 AI가 생각하는 중에 "title로"를 눌러 이동한 뒤 연습 모드에 다시 들어가 새 대국을 해도, 이전 대국의 AI 수가 나타나지 않는다.
  - 5목이 완성되면 이긴 줄이 강조되고 결과와 세 개의 버튼이 표시된다.

---

### Task 10: 마무리 검증

**Files:**
- Modify: `CLAUDE.md` (실행 명령 추가)

- [ ] **Step 1:** `CLAUDE.md`에 `npm run dev`, `npm test`, `npm run build` 명령과 `src/engine`, `src/ai`, `src/ui` 구조 한 줄 설명을 추가한다.
- [ ] **Step 2:** `npm test` 전체 PASS, `npx tsc --noEmit` 오류 없음, `npm run build` 성공을 확인한다.
- [ ] **Step 3:** 설계 문서의 목표 4개(title→연습 이동, 난이도 선택 후 한 판 완주, 엔진 분리, 난이도 순서 테스트)를 하나씩 대조해 충족되었는지 확인한다.
