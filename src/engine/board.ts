import { BOARD_SIZE } from './types'
import type { Board, Color, Move } from './types'

export function createBoard(): Board {
  return Array.from({ length: BOARD_SIZE }, () => Array<0>(BOARD_SIZE).fill(0))
}

export function cloneBoard(board: Board): Board {
  return board.map((row) => row.slice())
}

export function isInside(move: Move): boolean {
  return (
    Number.isInteger(move.row) &&
    Number.isInteger(move.col) &&
    move.row >= 0 &&
    move.row < BOARD_SIZE &&
    move.col >= 0 &&
    move.col < BOARD_SIZE
  )
}

export function isValidMove(board: Board, move: Move): boolean {
  return isInside(move) && board[move.row][move.col] === 0
}

export function placeStone(board: Board, move: Move, color: Color): void {
  if (!isValidMove(board, move)) {
    throw new Error(`둘 수 없는 칸입니다: (${move.row}, ${move.col})`)
  }
  board[move.row][move.col] = color
}

export function removeStone(board: Board, move: Move): void {
  board[move.row][move.col] = 0
}

export function isBoardFull(board: Board): boolean {
  return board.every((row) => row.every((cell) => cell !== 0))
}
