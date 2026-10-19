import { COLUMNS, ROWS } from '../config';
import type { Matrix, Piece, PieceType } from './pieces';

export type Board = (PieceType | null)[][];

export function createEmptyRows(count: number): Board {
  return Array.from({ length: count }, () => Array<PieceType | null>(COLUMNS).fill(null));
}

export function fitsOnBoard(board: Board, shape: Matrix, x: number, y: number, topRow: number): boolean {
  return shape.every((row, dy) => row.every((cell, dx) => {
    if (!cell) return true;
    const column = x + dx;
    const line = y + dy;
    return column >= 0 && column < COLUMNS && line >= topRow && line < ROWS && board[line][column] === null;
  }));
}

// Одна и та же позиция используется для тени и мгновенного сброса.
export function getDropY(board: Board, piece: Piece, topRow: number): number {
  let y = piece.y;
  while (fitsOnBoard(board, piece.shape, piece.x, y + 1, topRow)) y += 1;
  return y;
}

export function clearFullRows(board: Board, topRow: number): { board: Board; cleared: number } {
  const remaining = board.slice(topRow).filter(row => row.some(cell => cell === null));
  const cleared = ROWS - topRow - remaining.length;
  return { board: [...createEmptyRows(topRow + cleared), ...remaining], cleared };
}
