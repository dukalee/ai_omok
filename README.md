# CODE OMOK

Python으로 `play(state)` 함수를 작성해 AI와 오목을 두는 웹 앱입니다.
브라우저에서 코드를 쓰고 실행하면 내 코드가 흑 또는 백이 되어 AI(하/중/상)와 자동으로 대국합니다.

> 연습 모드, 튜토리얼, 로그인/회원가입, 관리자 화면, 토너먼트(대진, 진행, 중단, 삭제)가 구현되어 있습니다. 대전 시뮬레이션 다시 보기(착수 기록 재생)는 아직 없습니다.

## 실행

```bash
npm install
npm run dev      # 개발 서버
npm test         # 테스트 (Vitest)
npm run build    # 타입 검사와 프로덕션 빌드
```

처음 실행할 때 Python(Pyodide)을 CDN에서 불러오므로 인터넷 연결이 필요합니다.

## play 함수 작성법

```python
def play(state):
    return (7, 7)   # 둘 자리 (행, 열)
```

- `state["board"]`: 15×15 판. `0` 빈 칸, `1` 나의 돌, `2` 상대의 돌
- `state["last_move"]`: 상대가 둔 마지막 수 `(행, 열)`. 첫 수는 `None`
- `state["my_last_move"]`: 내가 마지막으로 둔 수 `(행, 열)`. 내 첫 수는 `None`
- `state["my_color"]`: 내 돌의 색. `"black"`(흑, 선공) 또는 `"white"`(백)
- 규칙을 어기는 수(금수 포함)를 두거나 2초 안에 못 두면 반칙패입니다.
- 전역 변수는 한 판 동안 유지됩니다.

기준 예제는 `examples/play_baseline.py`에 있습니다.

## 규칙 요약

- 15×15 판, 흑이 먼저 둡니다. 흑백은 랜덤으로 정합니다.
- 흑은 정확히 5목일 때만 이기고, 백은 5목 이상이면 이깁니다. 판이 가득 차면 백이 이깁니다.
- 흑에게만 금수(장목, 사사, 삼삼)가 있습니다. 자세한 내용은 `game_rules.md`를 보세요.

## 구성

| 폴더 | 내용 |
| --- | --- |
| `src/engine` | 오목 규칙 엔진 (React 무관) |
| `src/ai` | 상대 AI 하/중/상 |
| `src/runner` | 대국 진행, 반칙 처리, 로그 문구 |
| `src/python` | 학습자 Python 실행 (Pyodide, Web Worker) |
| `src/ui` | React 화면 |
| `tests` | 단위 테스트 |

React, Vite, TypeScript로 만들었습니다. 더 자세한 설명은 `CLAUDE.md`, `PRD.md`를 참고하세요.
