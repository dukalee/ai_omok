import type { Game } from '../engine/game'
import type { Board, Color } from '../engine/types'
import type { PlayerState } from './types'

const colorName = (c: Color): 'black' | 'white' => (c === 1 ? 'black' : 'white')

/** color가 둘 차례일 때 학습자 코드에 넘길 상태. 호출마다 새로 만든 복사본이다. */
export function buildPlayerState(game: Game, color: Color): PlayerState {
  const board = game.board.map((row) => row.map((cell) => (cell === 0 ? 0 : cell === color ? 1 : 2)))

  const history = game.history.map((h) => ({
    color: colorName(h.color),
    move: [h.move.row, h.move.col] as [number, number],
  }))
  const last = game.history[game.history.length - 1]
  const mine = [...game.history].reverse().find((h) => h.color === color)

  return {
    board,
    my_color: colorName(color),
    move_number: game.history.length,
    last_move: last ? [last.move.row, last.move.col] : null,
    my_last_move: mine ? [mine.move.row, mine.move.col] : null,
    history,
  }
}

/** 내 관점의 판(1 내 돌, 2 상대 돌)을 state.my_color 기준 절대 색 판(1 흑, 2 백)으로 되돌린다. */
export function toAbsoluteBoard(state: PlayerState): Board {
  const mine: Color = state.my_color === 'black' ? 1 : 2
  const theirs: Color = mine === 1 ? 2 : 1
  return state.board.map((row) => row.map((cell) => (cell === 0 ? 0 : cell === 1 ? mine : theirs)))
}
