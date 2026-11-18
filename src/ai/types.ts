import type { Board, Color, Move } from '../engine/types'

/** 판 상태와 자신의 색을 받아 둘 자리를 반환한다. */
export type AI = (board: Board, color: Color) => Move

export type Difficulty = 'easy' | 'medium' | 'hard'
