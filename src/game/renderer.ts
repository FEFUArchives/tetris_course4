import type Phaser from 'phaser';
import { COLUMNS, ROWS, CELL_SIZE, BOARD_WIDTH, BOARD_HEIGHT } from '../config';
import { getDropY, type Board } from './board';
import { COLORS, type Piece } from './pieces';

export function drawBoard(g: Phaser.GameObjects.Graphics, board: Board, active: Piece, topRow: number, finished: boolean): void {
  g.clear();
  g.lineStyle(1, 0x25364a, 0.55);
  const ceilingY = topRow * CELL_SIZE;
  for (let x = 1; x < COLUMNS; x++) g.lineBetween(x * CELL_SIZE, ceilingY, x * CELL_SIZE, BOARD_HEIGHT);
  for (let y = topRow + 1; y < ROWS; y++) g.lineBetween(0, y * CELL_SIZE, BOARD_WIDTH, y * CELL_SIZE);
  board.forEach((row, y) => row.forEach((cell, x) => {
    if (cell) drawCell(g, x, y, COLORS[cell]);
  }));
  if (topRow > 0) {
    g.fillStyle(0x0b121c, 1);
    g.fillRect(0, 0, BOARD_WIDTH, ceilingY);
    g.lineStyle(2, 0x7dd9ba, 0.8);
    g.lineBetween(0, ceilingY, BOARD_WIDTH, ceilingY);
  }
  if (finished) return;
  const ghostY = getDropY(board, active, topRow);
  active.shape.forEach((row, dy) => row.forEach((cell, dx) => {
    if (!cell) return;
    if (ghostY > active.y) drawCell(g, active.x + dx, ghostY + dy, COLORS[active.type], true);
    drawCell(g, active.x + dx, active.y + dy, COLORS[active.type]);
  }));
}

function drawCell(g: Phaser.GameObjects.Graphics, x: number, y: number, color: number, ghost = false): void {
  if (y < 0) return;
  const px = x * CELL_SIZE + 2;
  const py = y * CELL_SIZE + 2;
  const size = CELL_SIZE - 4;
  if (ghost) {
    g.fillStyle(color, 0.06);
    g.fillRoundedRect(px, py, size, size, 3);
    g.lineStyle(1, color, 0.35);
    g.strokeRoundedRect(px + .5, py + .5, size - 1, size - 1, 3);
  } else {
    g.fillStyle(color, 1);
    g.fillRoundedRect(px, py, size, size, 3);
    g.lineStyle(1, 0xffffff, 0.25);
    g.lineBetween(px + 3, py + 1, px + size - 3, py + 1);
    g.lineStyle(2, 0x000000, 0.13);
    g.lineBetween(px + 3, py + size - 1, px + size - 3, py + size - 1);
  }
}
