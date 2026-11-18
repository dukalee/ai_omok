/**
 * Pyodide 안에서 학습자 코드를 불러오고 play(state)를 호출하는 Python 하네스.
 * 결과는 모두 JSON 문자열로 돌려줘서 JS ↔ Python 객체 변환 문제를 피한다.
 */
export const HARNESS_PY = String.raw`
import json
import sys
import io

_FILE = "code.py"
_ns = None
_MAX_STDOUT = 2000


def _clip(text):
    if len(text) > _MAX_STDOUT:
        return text[:_MAX_STDOUT] + "…(이하 생략)"
    return text


def _fail(kind, message, line=None, stdout=""):
    return json.dumps(
        {"ok": False, "kind": kind, "message": message, "line": line, "stdout": _clip(stdout)},
        ensure_ascii=False,
    )


def _line_of(exc):
    # 학습자 파일(code.py)에서 가장 깊은 줄 번호
    line = None
    tb = exc.__traceback__
    while tb is not None:
        if tb.tb_frame.f_code.co_filename == _FILE:
            line = tb.tb_lineno
        tb = tb.tb_next
    return line


def _missing_message(ns):
    # 예전 이름(choose)으로 저장된 코드를 쓰는 학습자에게 이름이 바뀌었음을 알려 준다
    if callable(ns.get("choose")):
        return "함수 이름이 choose에서 play로 바뀌었습니다. def play(state): 로 고쳐 주세요."
    return "play(state) 함수가 없습니다. def play(state): 로 만들어 주세요."


def omok_load(code):
    global _ns
    _ns = {"__name__": "player"}
    old = sys.stdout
    sys.stdout = io.StringIO()
    try:
        exec(compile(code, _FILE, "exec"), _ns)
    except SyntaxError as e:
        return _fail("syntax", "문법 오류: " + str(e.msg), e.lineno)
    except BaseException as e:
        return _fail("exception", type(e).__name__ + ": " + str(e), _line_of(e))
    finally:
        sys.stdout = old
    if not callable(_ns.get("play")):
        return _fail("missing-function", _missing_message(_ns))
    return json.dumps({"ok": True})


def omok_choose(state_json):
    fn = _ns.get("play") if _ns else None
    if not callable(fn):
        return _fail("missing-function", _missing_message(_ns or {}))
    state = json.loads(state_json)
    if state["last_move"] is not None:
        state["last_move"] = tuple(state["last_move"])

    buf = io.StringIO()
    old = sys.stdout
    sys.stdout = buf
    try:
        result = fn(state)
    except BaseException as e:
        sys.stdout = old
        return _fail(
            "exception", type(e).__name__ + ": " + str(e), _line_of(e), buf.getvalue()
        )
    finally:
        sys.stdout = old
    out = buf.getvalue()

    valid = (
        isinstance(result, (tuple, list))
        and len(result) == 2
        and all(isinstance(v, int) and not isinstance(v, bool) for v in result)
    )
    if not valid:
        shown = repr(result)
        if len(shown) > 80:
            shown = shown[:80] + "…"
        return _fail(
            "bad-return",
            "play()는 (행, 열) 형태로 반환해야 하는데 " + shown + "을(를) 반환했습니다.",
            None,
            out,
        )
    return json.dumps(
        {"ok": True, "move": [result[0], result[1]], "stdout": _clip(out)},
        ensure_ascii=False,
    )
`
