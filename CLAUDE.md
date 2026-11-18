# 프로젝트 개요

오목 토너먼트 게임이다.

학습자들이 오목을 자동으로 진행하기 위한 로직을 함수(`play(state)`)의 형태로 제출하면, 이에 따라 토너먼트식으로 매칭하여 자동으로 플레이를 하여 승자를 가린다.

게임 규칙은 `game_rules.md`를 참고한다.

# 기술 스택

- React, Vite, TypeScript로 작성한다.
- 토너먼트 데이터(순위, 대진)는 Supabase 데이터베이스에 저장한다.
- 학습자는 `play(state)` 함수가 담긴 `.py` 파일을 제출한다. `state`로 판 상태를 받아 둘 위치 `(행, 열)`을 반환하면 그 자리에 둔다. 연습 모드에서는 브라우저에서 직접 작성해 AI와 대결시킨다.

# 명령

- `npm run dev`: 개발 서버 실행
- `npm test`: 테스트 실행 (Vitest)
- `npm run build`: 타입 검사와 프로덕션 빌드

# 구조

- `src/engine`: 오목 규칙 엔진 (판, 착수, 5목 판정, 흑 금수 판정 `forbidden.ts`, 한 판의 진행). React에 의존하지 않는다.
- `src/ai`: 상대 AI(하, 중, 상). 상은 `hard.worker.ts`로 Web Worker에서 실행한다. React에 의존하지 않는다.
- `src/runner`: 대국 진행. 학습자 코드와 AI를 같은 `PlayerAdapter`로 다루고(`runGame`), 반칙 처리(시간 초과 포함, 모두 반칙패), 로그 문구를 만든다. 토너먼트에서도 그대로 쓴다. React에 의존하지 않는다.
- `src/python`: 학습자 Python 실행. Pyodide를 Web Worker(`pyodide.worker.ts`)에서 CDN으로 불러오고, `harness.ts`의 Python 코드가 `play(state)`를 호출한다. 한 수 2초 제한은 `PythonPlayer`가 Worker를 종료하는 방식으로 지킨다.
- `src/ui`: React 화면 (title, 연습 모드, 에디터, 로그, 읽기 전용 오목판). 연습 모드는 사람이 직접 두는 모드가 아니라 내 `play` 함수를 AI와 대결시키는 모드이다. 화면 틀(`App.tsx`)은 상단바, 본문, footer로 이루어지고, 연습 화면은 코드 | 대국 | 설정과 로그 3패널이다(밝은 툴 패널 스타일, 색과 글꼴은 `ui.css` 맨 위 변수).
- 모든 페이지 하단에는 `© 2026 aishift. All rights reserved.` footer를 둔다(`App.tsx`에서 한 번만 렌더링해 모든 화면에 적용된다). footer에는 글자색(`color`)을 따로 지정하지 않고 상속받게 둔다.
- 학습자 코드에 주는 `state`는 `board`(0 빈 칸, 1 나의 돌, 2 상대의 돌)와 `last_move`(상대가 마지막으로 둔 돌의 위치) 두 항목뿐이다(`python/session.ts`의 `toLearnerState`). `my_color`, `move_number`, `history`는 AI가 쓰는 내부용이라 넘기지 않는다. 둘 수 있는 자리 목록도 주지 않으며, 선수 이름은 항상 "Player"이다(`NAME` 변수 없음). 내 색이 필요하면 판의 돌 수가 짝수일 때 흑이라고 알 수 있다.
- 금수 설명 그림: `src/ui/ruleScenes.ts`의 장면 데이터를 `RuleBoard`(미니 판 애니메이션)와 `RuleModal`(팝업)이 그린다. 장면이 실제 규칙과 어긋나지 않도록 `tests/ui/ruleScenes.test.ts`가 `src/engine/forbidden.ts`로 검증한다. 금수 규칙을 바꾸면 장면도 함께 고친다.
- `examples/play_baseline.py`: 성능 테스트용 기준 `play(state)` 코드. 알파-베타 탐색과 흑 금수 회피를 포함하며, AI 하/중에게 모두 이기고 상과 비슷한 수준이다. 한 수 평균 약 0.4초(최대 0.9초)로 제한 2초 안에서 돈다.
- `tests`: 엔진, AI, 러너, Python 테스트. `tests/ai/strength.test.ts`(AI끼리 대국)와 `tests/python/session.test.ts`(Node에서 Pyodide 로드)는 수 초 걸린다.
