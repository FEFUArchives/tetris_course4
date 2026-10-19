import { COLUMNS } from '../config';

export type Matrix = number[][];
export type PieceType = 'I' | 'J' | 'L' | 'O' | 'S' | 'T' | 'Z';
export interface Piece { type: PieceType; shape: Matrix; x: number; y: number }
export const SHAPES: Record<PieceType, Matrix> = {
  I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
  J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
  L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
  O: [[1, 1], [1, 1]],
  S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
  T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
  Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
};
export const COLORS: Record<PieceType, number> = {
  I: 0x6ccbdd, J: 0x709ee8, L: 0xeab375, O: 0xe5cc77,
  S: 0x7dd9ba, T: 0xb59bdf, Z: 0xdf8594,
};

export function createPiece(type: PieceType, topRow: number): Piece {
  const shape = SHAPES[type].map(row => [...row]);
  return { type, shape, x: Math.floor((COLUMNS - shape.length) / 2), y: topRow };
}

export function rotateShape(shape: Matrix): Matrix {
  return shape[0].map((_, column) => shape.map(row => row[column]).reverse());
}
