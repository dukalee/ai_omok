export type Color = 1 | 2 // 1: 흑, 2: 백
export type Cell = 0 | Color // 0: 빈 칸
export type Board = Cell[][]

export interface Move {
  row: number
  col: number
}

export const BOARD_SIZE = 15
