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
- 튜토리얼: 레벨마다 내 `play(state)`로 목표를 이루면 통과하는 모드이다. 레벨 데이터는 `src/tutorial/levels.ts`의 `LEVELS`(새 레벨은 끝에 추가, id는 겹치지 않게). 종류는 두 가지이다. `make-line`(레벨 1 가로, 2 세로, 3 대각선): 빈 판에서 방해하지 않는 상대 `passiveAi.ts`와 `runGame`으로 번갈아 두며, 10수 안에 정해진 방향으로 5개를 만들면 통과(`judgeLineResult`). 상대는 학습자의 마지막 돌 가까이에 두되(진짜 상대처럼 보이게) 학습자 돌이 든 5칸 구간은 피하고, 스스로 이기지도 않는다. `find-win`(레벨 4~6 "마지막 한 수 두기 1~3"): 주어진 판에서 한 수로 이기는 칸을 찾는다(`judgeMove`). 4는 가로, 5는 세로, 6은 대각선으로 흑 4개가 이어져 있고 한쪽 끝이 백돌로 막혀 있어, 반대쪽 끝 칸이 정답이다((7, 9), (9, 7), (9, 9)). 정답은 레벨마다 하나뿐이다. 판정은 `src/tutorial/judge.ts`(엔진 규칙 사용), 화면은 `src/ui/TutorialPage.tsx`(들어가면 먼저 커버플로 모양의 레벨 목록 `LevelList`(가운데 카드가 크고 양옆은 비스듬히, ←/→ 키와 버튼으로 넘김), 레벨을 고르면 코드 | 문제 판 | 미션의 `LevelPlay`). 통과하면 `ClearModal` 팝업(다음 레벨, 레벨 목록, 닫기)이 뜨고, 통과한 레벨과 작성한 코드는 계정별로 Supabase에 저장한다(아래 "계정별 저장"). 레벨 id는 저장된 기록의 키이므로 이미 있는 레벨의 id를 바꾸거나 재사용하지 않는다.
- 시작 화면(`TitlePage.tsx`)은 좌우 분할 카드(최대 1120x610px, 창 높이에 맞춰 440~610px)이다. 왼쪽은 어두운 남보라 메시 배경의 브랜드 영역으로, Outfit 800 글자(희미한 "CODE" 위에 흰 "OMOK"을 겹침)와 바닥 격자 위의 큰 흑돌, 백돌(`BrandArt.tsx`)로 이루어지고, 글자 크기와 위치는 패널 폭 단위(cqw)라서 카드 크기가 달라져도 같은 구도이다. Outfit은 `@fontsource/outfit`(main.tsx)로 묶는다. 오른쪽은 로그인 전에는 화면에 바로 보이는 로그인/회원가입 폼(`AuthForm.tsx`), 로그인 후에는 모드 메뉴(튜토리얼, 연습, 토너먼트, 관리자는 admin만; 마우스를 올린 칸이 포인트 색으로 채워진다)이며 로그아웃은 메뉴 아래 오른쪽 끝에 있다. 좁은 화면(760px 이하)에서는 위아래로 쌓인다.
- 화면 이동: 로그인해야 튜토리얼, 연습, 토너먼트를 쓸 수 있다(로그인 전에는 메뉴 대신 로그인 폼만 보이고, `App.tsx`가 로그아웃되면 시작 화면으로 돌려보낸다). 상단바에는 로고와, 시작 화면이 아닐 때 오른쪽 끝의 "← 처음으로" 버튼만 있다(모드 토글 없음). 관리자는 로그인하면 시작 화면에 "관리자" 버튼이 추가로 보인다.
- 로그인과 회원: `src/auth`. Supabase Auth(이메일+비밀번호)를 쓰되 화면에는 ID, 이름, 비밀번호만 받는다. ID를 가짜 이메일 `<id>@omok.app`으로 바꿔 가입시키고(`credentials.ts`), 이름은 `user_metadata`와 `profiles` 표(트리거가 가입 시 생성)에 둔다. 프로젝트 설정에서 "Confirm email"이 꺼져 있어야 한다. 계정 상태는 `AccountProvider`(`AccountContext.tsx`)가 앱 전체에 한 번만 구독하고 `useAccount()`로 읽는다. 로그인 서버 주소와 공개 키는 `.env.local`의 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`(`.env.example` 참고, git에 올리지 않는다). 없으면 로그인 기능만 "설정 필요"로 안내한다.
- 관리자(admin): 권한은 ID가 아니라 DB의 `profiles.role`로 정하며, 클라이언트는 이 값을 바꿀 수 없다(RLS). 관리자 지정은 대시보드 SQL로만 한다(`update public.profiles set role = 'admin' where login_id = 'admin'`). 관리자 비밀번호는 저장소에 적지 않는다. 관리자는 상단바 "관리자" 화면(`AdminPage`)에서 회원 보기, 삭제(`admin_delete_user` 함수)와 토너먼트 관리를 한다.
- 토너먼트: `src/tournament`와 `src/ui/AdminTournaments.tsx`, `TournamentPage.tsx`, `BracketView.tsx`. 상태는 `open`(참가 접수) → `running` ↔ `stopped` → `finished`. 관리자가 만들면 바로 접수가 시작되고, 시작하면 참가자를 확정해 무작위 단일 토너먼트 대진을 만든다(`bracket.ts`, 부전승 포함, 시드로 재현). 매치는 관리자의 브라우저에서 Pyodide로 실행하며(`runMatches.ts`), 이 화면을 닫으면 진행이 멈춘다. 중단하면 진행 중이던 매치는 처음 상태로 되돌리고, 재개하면 남은 매치부터 이어서 한다. 일반 회원은 토너먼트 화면에서 연습 모드에 저장한 코드(문법 검사 후)로 참가하거나 취소하고 대진표를 본다. 제출 코드(`entry_codes`)는 본인과 관리자만 읽을 수 있고, 조회(대진표 등)는 누구나 가능하다. 참가자 몇 명이든 대진 화면은 몇 초마다 다시 읽어 갱신한다(Realtime은 쓰지 않는다).
- 계정별 저장: 연습 코드, 튜토리얼 레벨별 코드, 튜토리얼 통과 기록은 브라우저(localStorage)가 아니라 계정에 저장한다(`src/storage`). 표는 `user_codes`(slot: `practice`, `tutorial:<레벨 id>`)와 `tutorial_cleared`이고, 본인 행만 읽고 쓴다(RLS). 화면은 `useCloudCode(slot, 시작 코드)` 훅으로 불러오고(불러오기 전에는 편집기를 잠그고 저장하지 않는다), 고친 뒤 0.8초 뒤 저장하며, 직접 고치지 않은 값은 저장하지 않는다. 그래서 새로 가입한 계정에는 저장된 코드도 통과 기록도 없다. 토너먼트 참가는 이 계정의 연습 코드를 제출한다. 예전 localStorage 키(`omok.code.v1`, `omok.tutorial.*`)는 앱이 시작될 때 지운다.
- DB 스키마: `supabase/migrations/001~004_*.sql`을 번호 순서대로 대시보드 SQL 편집기에서 실행한다(프로젝트를 새로 만들 때). 프로젝트에서 "새 테이블 API 권한 자동 부여"를 꺼 두어서, 각 SQL에 `grant`가 들어 있다.
- 모든 페이지 하단에는 `© 2026 aishift. All rights reserved.` footer를 둔다(`App.tsx`에서 한 번만 렌더링해 모든 화면에 적용된다). footer에는 글자색(`color`)을 따로 지정하지 않고 상속받게 둔다.
- 학습자 코드에 주는 `state`는 `board`(0 빈 칸, 1 나의 돌, 2 상대의 돌), `last_move`(상대가 마지막으로 둔 돌의 위치), `my_last_move`(내가 마지막으로 둔 돌의 위치, 내 첫 수면 `None`), `my_color`(`"black"` 또는 `"white"`) 네 항목뿐이다(`python/session.ts`의 `toLearnerState`). `move_number`, `history`는 AI가 쓰는 내부용이라 넘기지 않는다. 둘 수 있는 자리 목록도 주지 않으며, 선수 이름은 항상 "Player"이다(`NAME` 변수 없음).
- 금수 설명 그림: `src/ui/ruleScenes.ts`의 장면 데이터를 `RuleBoard`(미니 판 애니메이션)와 `RuleModal`(팝업)이 그린다. 장면이 실제 규칙과 어긋나지 않도록 `tests/ui/ruleScenes.test.ts`가 `src/engine/forbidden.ts`로 검증한다. 금수 규칙을 바꾸면 장면도 함께 고친다.
- `examples/play_baseline.py`: 성능 테스트용 기준 `play(state)` 코드. 알파-베타 탐색과 흑 금수 회피를 포함하며, AI 하/중에게 모두 이기고 상과 비슷한 수준이다. 한 수 평균 약 0.4초(최대 0.9초)로 제한 2초 안에서 돈다.
- `tests`: 엔진, AI, 러너, Python 테스트. `tests/ai/strength.test.ts`(AI끼리 대국)와 `tests/python/session.test.ts`(Node에서 Pyodide 로드)는 수 초 걸린다.
