/** "함수 작성법" 안내. 연습과 튜토리얼 화면이 함께 쓴다. */
export default function FunctionHelp() {
  return (
    <details className="help" open>
      <summary>함수 작성법</summary>
      <ul className="help-body">
        <li>
          <code>state["board"]</code> 게임판 (0 빈 칸 · 1 나의 돌 · 2 상대의 돌).
        </li>
        <li>
          <code>state["last_move"]</code> 상대의 마지막 수 (행, 열), 첫 수는 <code>None</code>.
        </li>
        <li>
          <code>state["my_last_move"]</code> 내가 마지막으로 둔 수 (행, 열), 첫 수는 <code>None</code>.
        </li>
        <li>
          <code>state["my_color"]</code> 내 돌의 색, <code>"black"</code>(흑, 선공) 또는 <code>"white"</code>(백).
        </li>
        <li>다음에 둘 자리를 (행, 열)로 반환합니다.</li>
        <li>규칙을 어기는 수(금수)를 두면 반칙패로 종료됩니다.</li>
        <li>2초 안에 못 두면 반칙패로 종료됩니다.</li>
        <li>전역 변수는 게임이 진행되는 동안 유지됩니다.</li>
      </ul>
    </details>
  )
}
