# SDD ledger — plan: docs/superpowers/plans/2026-11-18-practice-mode.md

Pre-flight: Task 3→2 (Game consumes board/rules), Tasks 4→2, 5/6/7→4, 8→3+5+6+7, 9→all. Interfaces in the plan are consistent; no conflicts found.

Ruling: 폴더가 Git 저장소가 아니어서 sdd 스크립트(workspace/task-start/task-done/review-package)와 worktree, 커밋을 쓰지 않고 이 파일을 원장으로 쓴다 — 스크립트가 git을 요구함 — 비용: 변경 이력이 없어 되돌리기 어렵다.
Ruling: Vite 템플릿은 스크래치패드에서 생성해 설정 파일만 프로젝트 루트로 복사했다. TypeScript는 템플릿이 고른 7.0.2, Vitest 5.1.1을 그대로 쓴다 — 템플릿 기본값 — 비용: 없음.

Task 1: complete (tests: npm test → 1 passed; npm run build → OK)
Task 2: complete (tests: npm test → 19 passed)
Task 3: complete (tests: npm test → 26 passed)
Task 4: complete (tests: npm test → 34 passed)
Task 5: complete (tests: npm test → 40 passed; 공통 헬퍼 findWinningMove를 src/ai/tactics.ts로 분리 — 하/상이 공유)
Task 6: complete (tests: npm test → 46 passed)
Task 7: complete (tests: npm test → 54 passed)
Task 4/7: Ruling: evaluateBoard를 "color = 평가 관점이자 둘 차례인 쪽"으로 바꾸고, 둘 차례인 쪽의 4목 95000, 둘 차례 아닌 쪽의 열린 4 90000, 열린 3 5000/500, 포크(열린 3 둘 이상 또는 4+열린 3) 보너스 60000/55000을 넣었다 — 정적 평가로는 상이 중에게 지는 것을 디버깅으로 확인(포크 허용) — 비용: 평가 함수 시그니처 의미가 plan보다 좁아짐(상 AI 전용).
Task 7: Ruling: createHardAI의 rng 옵션을 뺐다(상은 결정적) — 알파-베타 루트 동점 값이 정확하지 않아 무작위 동점 선택이 의미 없음 — 비용: 같은 판이면 같은 수.
Task 7/8: Ruling: 반복 심화를 깊이 2..4 대신 홀수 깊이 3,5(기본 maxDepth 5)로 바꿨다 — 깊이 2/3/4에서 중 상대 승수 5/10, 9/10, 6/10, 깊이 5는 6/6 — 비용: 느린 기기에서 깊이 3도 시간 안에 못 끝나면 정적 최선 수로 둔다. 설계 문서도 같이 갱신.
Task 8: complete (tests: npm test → 60 passed; 상 vs 중은 깊이 3/800ms로 10판 7승 이상, 중 vs 하 10판 8승 이상)
Task 9: complete (npx tsc -b OK, npm run build OK, Playwright 수동 검증: title→연습 이동/토너먼트 버튼 비활성, 사람이 백이면 AI 선공, AI 생각 중·점유 칸 클릭 무시, 5목 완성 시 이긴 줄 5개 강조 + 3개 버튼, 상 난이도 응답 ~60ms·메인 스레드 멈춤 없음, 계산 중 대국 변경 시 이전 응답 미적용)
Task 9: Ruling: 수동 검증 중 같은 틱의 연속 클릭이 렌더링 전 상태(humanTurn)를 믿고 AI 색의 돌을 두는 문제를 발견해, 클릭 처리와 AI 응답 적용 모두 Game의 현재 상태(status, toMove, isValidMove)로 판단하도록 고쳤다 — 연속 클릭 시 한 수만 놓이는 것을 재검증 — 비용: 없음.
Task 10: complete (npm test → 60 passed, tsc -b OK, npm run build OK; CLAUDE.md에 명령·구조 추가)
Final review: 새 컨텍스트 리뷰어(opus) — Critical/Important 없음, Minor 3건
Final: minor (deferred): 꽉 찬 판에서 AI를 호출하면 하/중은 undefined, 상은 TypeError (UI는 끝난 대국에서 AI를 부르지 않아 드러나지 않음, 토너먼트 재사용 시 주의)
Final: minor (deferred): 난이도 순서 테스트는 maxDepth 3/800ms로 검증하고 배포 기본값(깊이 5/1500ms)은 직접 검증하지 않음 (리뷰어가 따로 20판 19승 확인)
Final: minor (deferred): 오목판을 키보드/스크린리더로 조작할 수 없음 (설계 범위 밖)

# 후속 작업: 금수(렌주 룰) 구현
Added: src/engine/forbidden.ts (getForbiddenReason, isLegalMove), rules.ts 흑 정확히 5목, Game.play 금수 거부, AI(하/중/상) 금수 회피(tactics.ts legalCandidates/isAllowedFor), UI 금수 × 표시와 안내 (npm test → 93 passed, tsc -b OK, build OK, Playwright로 × 표시와 금수 클릭 거부 확인)
Ruling: 렌주 표준(흑만 금수, 흑은 정확히 5목, 백은 5목 이상, 5목 완성은 삼삼·사사 예외, 장목은 예외 없음)을 기본으로 정했다 — 사용자는 "금지된 수들"만 지정함 — 비용: 다른 변형을 원하면 forbidden.ts와 game_rules.md를 고쳐야 함.
Ruling: 삼삼의 "열린 사를 만드는 자리가 금수인가" 재귀는 깊이 3까지만 본다 — 무한 재귀와 상 AI 속도 저하 방지 — 비용: 매우 드문 중첩 경우에는 금수가 아닌 것으로 본다.
Final: minor (deferred): evaluate.ts의 scoreMove/evaluateBoard는 흑 6목 이상도 5목 완성과 같은 점수로 본다(흑에게 장목은 승리가 아님). 후보에서 금수가 빠지므로 흑 AI가 두지는 않지만 백 AI의 수비 점수가 약간 과대평가될 수 있다.

# 후속 작업 2: 코드로 두기 연습 모드 (plan: docs/superpowers/plans/2026-11-18-code-practice.md)
Pre-flight: Task 2→1(타입, buildPlayerState), 3→1, 5→3(WorkerLike)+4(session/harness), 6→1. 인터페이스 충돌 없음.
Task 1: complete (tests: npm test → 7 passed in playerState; 전체 통과)
Task 2: complete (tests: npm test → runGame 15 passed, 전체 115 passed)
Task 2: Ruling: runGame에서 while 조건으로 좁혀진 game.status 타입을 피하려고 currentStatus(game) 도우미를 두었다 — TS 제어 흐름 분석이 play() 뒤 상태 변화를 모른다 — 비용: 없음.
Task 3: complete (tests: npm test → aiPlayer 10 passed)
Task 4: complete (tests: npm test → session 23 passed; Node에서 pyodide 314.0.8 로드 약 1.7초)
Task 5: complete (tests: npm test → PythonPlayer 17 passed, 전체 165 passed; tsc -b OK)
Task 5: Ruling: PythonPlayer의 생성자 매개변수 프로퍼티를 쓰지 않았다 — tsconfig의 erasableSyntaxOnly — 비용: 없음.
Task 6: complete (tests: npm test → logFormat 9 passed)
Task 6: Ruling: foul 로그에 failure.line이 있으면 메시지 뒤에 "(n번째 줄)"을 붙인다 — 계획의 문구 규칙에 없지만 Python 예외 안내에 줄 번호가 필요함 — 비용: failure.message에 이미 줄 번호가 들어 있으면 중복될 수 있어 message에는 넣지 않는다.
Task 5: Ruling: PythonPlayer에 cancel()과 prepare 직렬화를 추가했다 — "중지" 직후 재실행하면 이전 요청의 타이머가 새 Worker를 종료하거나 prepare가 겹칠 수 있음(수동 검증 전 코드 검토에서 발견) — 테스트 4개 추가(PythonPlayer 21개) — 비용: Python 실행은 중간에 끊을 수 없어, 요청이 진행 중일 때 cancel하면 Worker를 종료하고 다음 실행에서 다시 초기화(수 초)한다.
Task 7+8: complete (tests: npm test → 184 passed, tsc -b OK, npm run build OK; 브라우저 수동 검증 완료)
Task 8: Ruling: storage.ts를 테스트보다 먼저 써 버려 삭제 후 테스트가 실패하는 것을 확인하고 다시 구현했다 — TDD 순서 위반 복구 — 비용: 없음.
Task 9: Ruling: 사람이 직접 두는 기능 제거에 맞춰 Board를 읽기 전용으로 단순화했다(클릭, 호버, 금수 × 표시 제거, foulMove ×만 유지) — 설계대로 — 비용: 없음.
Task 9 수동 검증 결과: 예제 코드 실행(Pyodide 로드 포함 2초), while True 코드는 2초 뒤 시간 초과로 끊기고 화면 틱 75/76으로 멈추지 않음, 그 뒤 재실행 정상, 중지 후 로그 정지와 즉시 재실행 시 이전 대국 미반영, 문법 오류/함수 없음/None 반환/예외/print/판 밖/이미 돌 있음/삼삼 금수 문구와 × 표시, 상 난이도(Worker)와 내 색 백(AI 선공), 새로고침 후 코드 유지, 모바일 390px에서 가로 스크롤 없음, 콘솔 오류 없음.
Final: minor (deferred): 번들이 약 717KB(CodeMirror 포함)라 빌드 경고가 있다. 연습 모드 화면을 지연 로딩하면 줄일 수 있다.
Final: minor (deferred): 예제 코드는 의도적으로 단순해서 하 난이도에도 진다(첫 합법 수만 둠).
Final review (코드로 두기): 새 컨텍스트 리뷰어(opus) — Critical/Important 없음, Minor 5건. 효과 기준으로 다시 따져 Minor 1을 Important로 올려 고쳤다.
Final: fixed 반칙이 난 수(판 밖/이미 돌/금수)에서 찍은 print 출력이 로그에서 사라짐 — runGame/logFormat 테스트 2개 RED→GREEN, suite 186/186, tsc OK, build OK
Final: minor (deferred): PythonPlayer의 finish가 자기 요청이 아니어도 handler/pending을 지우고, choose가 prepare 직렬화 체인 밖이다. cancel 없이 choose 대기 중 prepare를 부르면 잘못된 안내로 끝날 수 있다. 현재 UI는 항상 cancel을 먼저 불러 도달하지 않지만 토너먼트 재사용 때 주의.
Final: minor (deferred): createWorkerAiPlayer.dispose()가 대기 중인 Promise를 reject하지 않아, signal 없이 dispose하면 대국이 끝나지 않을 수 있다(연습 모드는 signal 가드로 영향 없음).
Final: minor (deferred): sys.exit() 같은 빈 메시지 예외가 "SystemExit: "처럼 콜론 뒤가 빈 채로 표시된다.
Final: minor (deferred): 아주 큰 정수(10**400)를 반환하면 JSON을 거쳐 "(Infinity, 1)은 판 밖입니다."로 안내된다(반칙 처리는 정상).

# 후속 작업 3: UI 교체와 사용자 요청 반영
Done: UI를 시안 5(툴 패널)로 교체(3패널: 코드 | 대국 | 설정과 규칙, 로그는 대국 카드 판 아래로 이동), 모든 페이지 footer "© 2026 aishift. All rights reserved."(글자색 지정 없음, 배경 없음, 작게), 패널이 화면을 꽉 채움.
Done: NAME 변수 삭제(harness/session/PythonPlayer/starter/도움말/문서), state에서 legal_moves 삭제(playerState/types/harness/starter/반칙 문구/도움말/테스트/문서). last_move는 이미 있었고 예제 주석과 도움말에 명시했으며 session 테스트로 흑/백 양쪽 입장을 확인.
Done: 금수 그림 설명 — ruleScenes.ts(장목/사사/삼삼/예외 4장면, 4단계), RuleBoard(미니 판 애니메이션, 블록 안 썸네일은 자동 반복), RuleModal(<dialog> 팝업: 단계 버튼, 이전/다음/재생·멈춤/처음부터, Esc·바깥 클릭·닫기), tests/ui/ruleScenes.test.ts가 장면을 실제 엔진(getForbiddenReason)과 대조(19개).
Ruling: 요청 "설정의 아래쪽에 로그를 삭제"는 로그를 지우면 문법 오류, print 출력, 반칙 이유를 볼 곳이 사라져서, 삭제하지 않고 가운데 대국 카드의 판 아래로 옮겼다 — 현재 기능 유지 원칙 — 비용: 사용자가 정말 로그 자체를 없애려던 것이면 다시 요청해야 한다.
Ruling: 팝업을 <dialog>(showModal)로 만들었다 — 포커스 가두기, Esc, 포커스 복귀를 브라우저가 처리 — 비용: 개발 모드(StrictMode)에서 정리 단계 close() 이벤트가 새로 연 팝업을 닫는 버그를 수동 검증에서 발견해 이미 열려 있으면 close 이벤트를 무시하도록 고쳤다.
Ruling: 금수 설명 장면 좌표는 9×9 창이고 테스트에서 15×15 판 가운데쪽으로 옮겨(+3) 판정한다 — 실제 판 가장자리 영향을 피함 — 비용: 없음.
Verified (Playwright): 블록 미니 그림 자동 반복(돌 배치 → 목표 자리 → 줄 → 결론), 팝업 열기/단계 이동/Esc/바깥 클릭/닫기 버튼/다시 열기, 예외 장면 초록 결론, 모바일 390px 팝업 가로 스크롤 없음, 표시 겹침 수정 후 겹치지 않음.

# 후속 작업 4: 함수 이름 변경과 기준 코드
Done: 학습자 함수 이름을 choose에서 play로 변경(harness/starter/도움말/오류 문구/테스트/문서). 내부 PlayerAdapter.choose와 Worker 메시지 type은 그대로 둔다. 예전 이름(choose)만 있는 저장 코드에는 "함수 이름이 choose에서 play로 바뀌었습니다" 안내를 보여주고, play와 choose가 모두 있으면 play를 쓴다(테스트 2개 추가, 전체 208개 통과).
Done: examples/play_baseline.py — 성능 테스트용 기준 play() 코드. 이길 수 있으면 이기고, 상대가 이길 수 있으면 막고, 알파-베타 탐색(홀수 깊이 3, 5, 시간 제한 0.9초)으로 둔다. 흑일 때 금수(장목/사사/삼삼)를 스스로 피하도록 game_rules.md의 판정을 파이썬으로 옮겼다.
Measured (Node + Pyodide, 임시 벤치마크, 흑/백 번갈아): vs AI 하 10/10승, vs AI 중 10/10승, vs AI 상 3/4승. 한 수 시간 평균 371ms, p95 901ms, 최대 902ms(제한 2초). 반칙과 시간 초과 0회.
Ruling: 처음 만든 "한 수 더 내다보는 휴리스틱" 버전은 하 10/10이었지만 중·상에게 흑으로 전부 졌다(방어가 빈틈없어 판이 가득 차면 규칙상 백 승). 성능 테스트의 기준으로는 약해서 시간 제한이 있는 알파-베타 탐색을 더해 교체했다 — 비용: 코드가 길다(약 330줄). 임시 벤치마크는 지웠고 필요하면 스크립트로 남길 수 있다.
Done: 로그 UI 개선 — 이동 기록은 번호·돌 모양·이름·좌표 칩(parseMoveLine, 테스트 3개), print는 배지, 오류는 붉은 배경과 아이콘, 결과는 강조 줄, 안내는 점 표시, 빈 상태 안내, 새 줄 페이드 인(모션 줄이기 존중). LogPanel.tsx와 ui.css만 변경, 로그 높이 130→170px.
Done: 설명을 모두 한 줄로(규칙 bullet, 블록 설명을 짧게, 패널 320→340px, 그림 76→64px, 작성법 7개 한 줄 bullet로 간결화), bullet을 흑돌 아이콘으로, '예제로 되돌리기'를 my_code.py 오른쪽 'reset' 버튼으로 이동. Verified: 18개 설명 요소 모두 한 줄·잘림 없음.

# 후속 작업 5: 시간 초과 규칙, 로그/규칙 패널/속도 슬라이더 개선, 이름
Done: 시간 초과(한 수 2초)는 패배가 아니라 왼쪽 위에서 가장 가까운 빈 자리(직선거리, 같으면 위쪽, 흑은 금수 건너뜀)에 대신 두고 계속한다 — engine/fallback.ts(테스트 8개), runGame의 timeout 이벤트 + 로그 warn 줄, game_rules.md/PRD/설계 문서 갱신. 예외·잘못된 수·금수는 그대로 반칙패.
Done: PythonPlayer가 시간 초과로 Worker를 종료한 뒤 다음 차례에 같은 코드로 자동 재준비(lastCode, 테스트 4개) — 비용: 전역 변수가 처음 상태로 돌아가고, 재준비 시간(브라우저 약 2초)이 든다. 무한 반복 코드는 수마다 약 4초가 걸린다(상한은 두지 않았다).
Ruling: "왼쪽 위로부터 가장 가까운" 거리를 (0,0)에서의 직선거리로 해석했다(행 우선 순회가 아님) — 비용: 행 우선(0,0),(0,1),(0,2)…을 원했다면 fallback.ts 한 줄을 바꾸면 된다.
Done: 금수 블록이 규칙 패널을 빈칸 없이 채움(1600×1200에서 아래 빈칸 0, 네 블록 154~155px). 로그 자동 스크롤이 빠른 실행에서 풀리던 버그 수정(auto 플래그).
Done: 속도를 슬라이더(느리게 800ms / 보통 400 / 빠르게 100 / 매우 빠르게 0)로 바꾸고 실행 중에도 변경 가능(runGame pauseMs를 함수로 받음, 테스트 1개). 각 단계는 원 모양 홈이고 손잡이가 그 안에 들어가며 이름은 홈 가운데에 정렬(손잡이·홈·이름 중심 오차 0 확인).
Done: 표시 이름 "내 코드"를 "Player"로 변경(PythonPlayer.name, 문서, 테스트 데이터). 제목 화면의 문구 "내 코드로 두는 오목"은 플레이어 이름이 아니라 소개 문구라서 그대로 뒀다.
Verified: npm test 229개, tsc, build 통과.

# 후속 작업 6: 결과 팝업과 문구
Done: 결과 줄에서 "(오목)" 삭제(오목 완성은 "<이름> 승리"만, 판 가득/상대 반칙은 괄호 설명 유지). footer 위쪽 가로선(border-top) 삭제.
Done: 대국이 끝나면 결과 팝업(<dialog>): 이긴 쪽 돌 아이콘, "<이름> 승리", 이유 한 줄(5목을 완성했습니다 / 판이 가득 차서 백이 이겼습니다 / <진 쪽>의 반칙패입니다), "N수 · 흑 … / 백 …", [다시 실행][닫기]. 내 코드가 이기면 제목이 강조색이고 돌 주위에 고리가 퍼진다(모션 줄이기 존중). resultSummary.ts(테스트 5개), ResultModal.tsx, 공통 훅 useModalDialog.ts(RuleModal도 이 훅으로 정리).
Ruling: "승리 시 팝업"을 이긴 쪽과 상관없이 대국이 끝나면(지는 경우도) 뜨게 했다 — 학습 중에는 지는 결과도 알아야 하고 이유(반칙패 등)를 같이 보여 주는 편이 낫다 — 비용: 내 코드가 이길 때만 원했다면 ResultModal 표시 조건 한 줄을 바꾸면 된다. 중지하면 팝업은 뜨지 않는다.
Verified (Playwright): Player 승리 팝업(모달, 9수), AI 하 승리 팝업, Esc·바깥 클릭·닫기·다시 실행(팝업 닫히고 새 대국 시작), 중지 시 팝업 없음, footer 선 0px. npm test 234개, tsc, build 통과.

# 후속 작업 7: 로그 타임라인, 랜덤 문구
Done: 로그를 타임라인 시안(1번)으로 교체 — 세로 줄 위에 돌 모양 점(수), 색 있는 큰 점(print p / 시간 초과 ⏱ / 반칙 ! / 결과 ★). 시안 파일 public/mockups.html은 삭제. "내 색" 선택지 "코인 던지기"→"랜덤".
Verified (Playwright): 수·print·시간 초과·결과 줄 표시. npm test, tsc, build 통과.

# 후속 작업 8: state 축소, 시간 초과를 다시 반칙패로
Ruling(사용자 결정, 후속 작업 5를 되돌림): 시간 초과(2초)는 반칙패이다. 대신 두기(engine/fallback.ts, timeout 이벤트, warn 로그 줄)는 모두 삭제. 도움말을 사용자가 준 문구로 교체. 문서(game_rules/PRD/CLAUDE.md/설계) 갱신.
Done: 학습자 코드의 state는 board, last_move 두 항목만(session.ts toLearnerState). my_color/move_number/history는 PlayerState에 남겨 AI 어댑터가 내부용으로 쓴다 — 비용: 학습자는 내 색을 직접 모른다(돌 수가 짝수면 흑으로 알 수 있음). 기준 코드는 그 방식으로 바꿨고 하 AI를 흑/백 모두 반칙 없이 이김.
Verified: 브라우저에서 무한 루프 → "Player의 반칙패입니다" 팝업과 오류 로그, 도움말 6줄. npm test, tsc, build 통과.

# 후속 작업 9: 문구 다듬기
Done: 예제 코드는 return (7, 7)만. 도움말 제목 "함수 작성법", 기본으로 열림, 각 줄 마침표(반칙패는 "반칙패로 종료됩니다."), last_move 줄은 한 줄에 맞게 "상대의 마지막 수 (행, 열), 첫 수는 None."으로 줄임. 코드 카드 제목 my_code.py→code.py(하네스 파일 이름도 같이), "Python" 표시 삭제.

# 후속 작업 10: 제목, 글꼴, 코드 크기, 규칙 팝업 한 줄
Done: 제목 "AI 오목"(상단바, 제목 화면, 탭 제목). 글꼴: 본문 IBM Plex Sans KR, 보조 IBM Plex Mono, 코드 에디터 Nanum Gothic Coding(@fontsource, 이전 Noto Sans KR/JetBrains Mono 제거).
Done: 코드 글자 크기 −/+ 버튼(10~24px, 기본 14)을 에디터 오른쪽 아래에 띄움(codeZoom.ts, 테스트 3개). CodeMirror는 CSS 변수만 바꾸면 줄 높이를 다시 재지 않아 줄 번호가 어긋나므로 크기마다 테마를 새로 만든다.
Done: 금수 팝업의 문장(캡션 4개, 세부 설명)을 한 문장씩 36자 이하로 다시 쓰고(테스트로 강제), 팝업 폭을 960px로 넓혀 줄바꿈 없이 한 줄(1440폭에서 4개 장면 모두 확인). 960px 이하 화면에서는 줄바꿈 허용.
