"""오목 play(state) 기준 코드 (성능 테스트용)

전략
  1. 내가 이길 수 있으면 이긴다.
  2. 상대가 한 수로 이길 수 있으면 막는다.
  3. 후보 칸마다 "내 공격 점수 + 상대 수비 점수"를 매겨 가장 좋은 수를 미리 정해 둔다.
  4. 남은 시간 안에서 알파-베타 탐색(홀수 깊이 3, 5)으로 몇 수 앞을 내다보고,
     시간이 모자라면 마지막으로 끝낸 깊이의 최선 수(또는 3번에서 정한 수)를 쓴다.

규칙 준수
  - 흑일 때는 금수(장목, 사사, 삼삼) 자리를 스스로 피한다.
    금수 자리에 두면 반칙패이기 때문이다. 판정은 game_rules.md의 규칙을 그대로 옮겼다.
  - 탐색 중에도 흑 쪽의 금수 자리는 후보에서 뺀다. (상대가 흑이면 상대 쪽도 뺀다)

시간
  한 수는 2초 안에 끝나야 한다. 이 코드는 TIME_LIMIT 초가 지나면 탐색을 멈추고
  그때까지 얻은 최선 수를 돌려준다. (느린 컴퓨터를 고려해 2초보다 훨씬 작게 잡았다)
"""

import time

N = 15
DIRS = ((0, 1), (1, 0), (1, 1), (1, -1))

TIME_LIMIT = 0.9        # 한 수에 쓸 최대 탐색 시간(초). 제한 2초보다 넉넉히 작게
SEARCH_DEPTHS = (3, 5)  # 홀수 깊이만 쓴다 (짝수 깊이는 평가가 한쪽으로 치우친다)
BRANCH = 10             # 탐색 노드마다 살펴볼 상위 후보 수
ATTACK_WEIGHT = 1.1     # 공격 점수 가중치 (같은 위협이면 막기보다 내 공격을 우선)
WIN = 1000000
INF = 10 ** 9


# ───────────────────────── 기본 도우미 ─────────────────────────

def pattern_score(length, open_ends):
    """연속된 돌의 길이와 열린 끝의 수로 점수를 낸다."""
    if length >= 5:
        return 100000
    if open_ends == 0:
        return 0
    if length == 4:
        return 10000 if open_ends == 2 else 1000
    if length == 3:
        return 500 if open_ends == 2 else 100
    if length == 2:
        return 50 if open_ends == 2 else 5
    return 1


def score_move(board, r, c, who):
    """빈 칸 (r, c)에 who가 두었을 때 네 방향 연결 점수의 합. 판은 바꾸지 않는다."""
    total = 0
    for dr, dc in DIRS:
        length = 1
        rr, cc = r + dr, c + dc
        while 0 <= rr < N and 0 <= cc < N and board[rr][cc] == who:
            length += 1
            rr += dr
            cc += dc
        open_ends = 1 if (0 <= rr < N and 0 <= cc < N and board[rr][cc] == 0) else 0
        rr, cc = r - dr, c - dc
        while 0 <= rr < N and 0 <= cc < N and board[rr][cc] == who:
            length += 1
            rr -= dr
            cc -= dc
        if 0 <= rr < N and 0 <= cc < N and board[rr][cc] == 0:
            open_ends += 1
        total += pattern_score(length, open_ends)
    return total


def makes_five(board, r, c, who, who_is_black):
    """who가 (r, c)에 두면 이기는가. 흑은 정확히 5개, 백은 5개 이상이어야 이긴다.
    (r, c)가 비어 있든 이미 who의 돌이 놓여 있든 같은 결과이다."""
    for dr, dc in DIRS:
        length = 1
        rr, cc = r + dr, c + dc
        while 0 <= rr < N and 0 <= cc < N and board[rr][cc] == who:
            length += 1
            rr += dr
            cc += dc
        rr, cc = r - dr, c - dc
        while 0 <= rr < N and 0 <= cc < N and board[rr][cc] == who:
            length += 1
            rr -= dr
            cc -= dc
        if (length == 5) if who_is_black else (length >= 5):
            return True
    return False


def candidates(board):
    """이미 놓인 돌 주변 2칸 이내의 빈 칸. 판이 비어 있으면 한가운데."""
    near = set()
    has_stone = False
    for r in range(N):
        row = board[r]
        for c in range(N):
            if row[c] == 0:
                continue
            has_stone = True
            for dr in range(-2, 3):
                for dc in range(-2, 3):
                    nr, nc = r + dr, c + dc
                    if 0 <= nr < N and 0 <= nc < N and board[nr][nc] == 0:
                        near.add((nr, nc))
    if not has_stone:
        return [(7, 7)]
    return list(near)


# ───────────────────── 흑 금수 판정 (game_rules.md) ─────────────────────
# 착수 지점을 가운데로 두고 양쪽 5칸씩 읽은 한 줄(11칸)로 판정한다.
# 줄의 값: 0 빈 칸, 1 금수를 따지는 쪽(흑)의 돌, 그 밖은 막힌 칸

REACH = 5
CENTER = 5
MAX_DEPTH = 3   # "열린 사를 만드는 자리가 다시 금수인가"를 따지는 재귀의 최대 깊이


def read_line(board, r, c, dr, dc, who):
    line = []
    for k in range(-REACH, REACH + 1):
        rr, cc = r + dr * k, c + dc * k
        if 0 <= rr < N and 0 <= cc < N:
            v = board[rr][cc]
            line.append(1 if v == who else (0 if v == 0 else 3))
        else:
            line.append(3)
    return line


def run_of(line, i):
    start = end = i
    while start > 0 and line[start - 1] == 1:
        start -= 1
    while end < len(line) - 1 and line[end + 1] == 1:
        end += 1
    return start, end


def run_len_center(line):
    s, e = run_of(line, CENTER)
    return e - s + 1


def completions(line):
    """돌 하나만 더 두면 착수 지점을 포함한 정확히 다섯 개가 되는 빈 칸들"""
    found = set()
    for q in range(len(line)):
        if line[q] != 0:
            continue
        line[q] = 1
        s, e = run_of(line, q)
        if e - s + 1 == 5 and s <= CENTER <= e:
            found.add(q)
        line[q] = 0
    return found


def four_count(line):
    found = completions(line)
    if not found:
        return 0
    s, e = run_of(line, CENTER)
    if e - s + 1 == 4 and (s - 1) in found and (e + 1) in found:
        return 1   # 양쪽이 열린 연속 네 개(열린 사)는 하나로 센다
    return len(found)


def is_straight_four(line):
    s, e = run_of(line, CENTER)
    if e - s + 1 != 4:
        return False
    found = completions(line)
    return (s - 1) in found and (e + 1) in found


def has_open_three(board, r, c, dr, dc, line, who, depth):
    for q in range(len(line)):
        if line[q] != 0:
            continue
        nxt = line[:]
        nxt[q] = 1
        if not is_straight_four(nxt):
            continue
        qr, qc = r + dr * (q - CENTER), c + dc * (q - CENTER)
        if depth < MAX_DEPTH and forbidden_reason(board, qr, qc, who, depth + 1) is not None:
            continue   # 열린 사를 만드는 자리가 금수이면 그 삼은 열린 삼이 아니다
        return True
    return False


def forbidden_reason(board, r, c, who, depth=0):
    """who(흑)가 빈 칸 (r, c)에 둘 때 걸리는 금수. 금수가 아니면 None. 판은 되돌려 놓는다."""
    board[r][c] = who
    try:
        lines = [(dr, dc, read_line(board, r, c, dr, dc, who)) for dr, dc in DIRS]
        if any(run_len_center(line) >= 6 for _, _, line in lines):
            return "overline"
        if any(run_len_center(line) == 5 for _, _, line in lines):
            return None   # 정확히 5목이 완성되면 삼삼, 사사여도 금수가 아니다
        fours = [four_count(line) for _, _, line in lines]
        if sum(fours) >= 2:
            return "double-four"
        threes = 0
        for i, (dr, dc, line) in enumerate(lines):
            if fours[i] > 0:
                continue
            if has_open_three(board, r, c, dr, dc, line, who, depth):
                threes += 1
        return "double-three" if threes >= 2 else None
    finally:
        board[r][c] = 0


# ───────────────────────── 판 평가 ─────────────────────────

def tempo_score(length, open_ends, mover):
    """mover(이번에 둘 차례인 쪽)인지를 반영한 연결 점수.
    둘 차례인 쪽의 4목은 바로 5목을 완성하고, 아닌 쪽의 열린 4는 막을 수 없다."""
    if length >= 5:
        return 100000
    if open_ends == 0:
        return 0
    if length == 4:
        if mover:
            return 95000
        return 90000 if open_ends == 2 else 1500
    if length == 3 and open_ends == 2:
        return 5000 if mover else 500
    return pattern_score(length, open_ends)


def evaluate(board, mover):
    """mover 관점의 판 전체 평가값: (내 연결 점수 합) - (상대 연결 점수 합)"""
    totals = [0, 0, 0]
    threes = [0, 0, 0]
    fours = [0, 0, 0]
    for r in range(N):
        row = board[r]
        for c in range(N):
            cell = row[c]
            if cell == 0:
                continue
            for dr, dc in DIRS:
                pr, pc = r - dr, c - dc
                prev_in = 0 <= pr < N and 0 <= pc < N
                if prev_in and board[pr][pc] == cell:
                    continue   # 줄의 시작 돌에서만 한 번 센다
                length = 0
                rr, cc = r, c
                while 0 <= rr < N and 0 <= cc < N and board[rr][cc] == cell:
                    length += 1
                    rr += dr
                    cc += dc
                open_ends = (1 if prev_in and board[pr][pc] == 0 else 0) + (
                    1 if (0 <= rr < N and 0 <= cc < N and board[rr][cc] == 0) else 0
                )
                totals[cell] += tempo_score(length, open_ends, cell == mover)
                if length == 3 and open_ends == 2:
                    threes[cell] += 1
                if length == 4 and open_ends >= 1:
                    fours[cell] += 1
    for who in (1, 2):
        if threes[who] >= 2 or (fours[who] >= 1 and threes[who] >= 1):
            totals[who] += 60000 if who == mover else 55000   # 포크(동시에 둘 이상의 위협)
    return totals[mover] - totals[3 - mover]


# ───────────────────────── 한 수 고르기 ─────────────────────────

class _Timeout(Exception):
    pass


def play(state):
    started = time.time()
    deadline = started + TIME_LIMIT

    board = state["board"]          # 1 내 돌, 2 상대 돌 (항상 내 관점)
    me, opp = 1, 2
    # 내 색은 state에 없으니 판에 놓인 돌의 수로 안다: 흑이 먼저 두므로 돌이 짝수 개이면 내가 흑
    stones = sum(1 for row in board for cell in row if cell)
    me_black = stones % 2 == 0
    opp_black = not me_black

    def black_side(side):
        """side(1 또는 2)가 흑이면 True"""
        return me_black if side == me else opp_black

    def ordered_moves(side, limit):
        """side가 둘 수 있는 후보를 점수순으로 최대 limit개 (흑이면 금수는 건너뛴다)"""
        other = 3 - side
        ranked = sorted(
            (
                (score_move(board, r, c, side) * ATTACK_WEIGHT + score_move(board, r, c, other), r, c)
                for r, c in candidates(board)
            ),
            reverse=True,
        )
        check = black_side(side)
        moves = []
        for s, r, c in ranked:
            if check and forbidden_reason(board, r, c, side) is not None:
                continue
            moves.append((r, c))
            if len(moves) == limit:
                break
        return moves

    cands = candidates(board)

    # 1) 내가 이길 수 있으면 이긴다 (정확히 5목이면 금수가 아니다)
    for r, c in cands:
        if makes_five(board, r, c, me, me_black):
            return (r, c)

    # 2) 상대가 한 수로 이길 수 있으면 막는다 (내가 둘 수 있는 자리일 때)
    for r, c in cands:
        if makes_five(board, r, c, opp, opp_black):
            if not (me_black and forbidden_reason(board, r, c, me) is not None):
                return (r, c)

    # 3) 탐색이 끝나지 못할 때를 위한 기본 수: 점수가 가장 높은 후보
    root_moves = ordered_moves(me, BRANCH + 2)
    if not root_moves:
        # 후보가 모두 금수이면 판 전체에서 둘 수 있는 첫 빈 칸을 찾는다
        for r in range(N):
            for c in range(N):
                if board[r][c] == 0 and not (me_black and forbidden_reason(board, r, c, me) is not None):
                    return (r, c)
        return (7, 7)
    best = root_moves[0]
    if len(root_moves) == 1:
        return best

    # 4) 알파-베타 탐색 (negamax). side가 둘 차례일 때의 값을 돌려준다.
    def search(depth, alpha, beta, side):
        if time.time() > deadline:
            raise _Timeout()
        if depth == 0:
            return evaluate(board, side)
        moves = ordered_moves(side, BRANCH)
        if not moves:
            return 0
        other = 3 - side
        side_is_black = black_side(side)
        value = -INF
        for r, c in moves:
            board[r][c] = side
            try:
                if makes_five(board, r, c, side, side_is_black):
                    score = WIN + depth
                else:
                    score = -search(depth - 1, -beta, -alpha, other)
            finally:
                board[r][c] = 0
            if score > value:
                value = score
            if value > alpha:
                alpha = value
            if alpha >= beta:
                break
        return value

    try:
        for depth in SEARCH_DEPTHS:
            alpha = -INF
            iteration_best = root_moves[0]
            for r, c in root_moves:
                board[r][c] = me
                try:
                    score = -search(depth - 1, -INF, -alpha, opp)
                finally:
                    board[r][c] = 0
                if score > alpha:
                    alpha = score
                    iteration_best = (r, c)
            best = iteration_best   # 이 깊이를 끝까지 마쳤을 때만 갱신한다
            # 다음 깊이에서는 이번 최선 수를 먼저 살펴 가지치기를 돕는다
            root_moves.remove(best)
            root_moves.insert(0, best)
    except _Timeout:
        pass   # 시간이 다 되었으면 마지막으로 끝낸 깊이의 최선 수를 쓴다

    return best
