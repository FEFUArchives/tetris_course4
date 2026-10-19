import Phaser from 'phaser';
import {
  ROWS, LINES_PER_PHASE, MAX_PHASE, MIN_PLAYABLE_ROWS,
  INITIAL_FALL_MS, MIN_FALL_MS, SPEED_FACTOR, SOFT_DROP_MS,
  LOCK_DELAY_MS, MAX_LOCK_RESETS, LINE_POINTS, WALL_OFFSETS,
  SOFT_DROP_POINTS, HARD_DROP_POINTS,
} from '../config';
import { SHAPES, createPiece, rotateShape, type Matrix, type Piece, type PieceType } from './pieces';
import { createEmptyRows, fitsOnBoard, getDropY, clearFullRows, type Board } from './board';
import { drawBoard } from './renderer';
import { element, GameUI, type GameStats } from '../ui/GameUI';

const KEY_ACTIONS: Record<string, string> = {
  ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'rotate',
  Space: 'drop', KeyC: 'hold', ShiftLeft: 'hold', ShiftRight: 'hold',
};

export class GameScene extends Phaser.Scene {
  private graphics!: Phaser.GameObjects.Graphics;
  private board: Board = [];
  private ui = new GameUI();
  private active!: Piece;
  private bag: PieceType[] = [];
  private next!: PieceType;
  private held: PieceType | null = null;
  private canHold = true;
  private score = 0;
  private lines = 0;
  private elapsed = 0;
  private level = 1;
  private lastSecond = -1;
  private fallTime = 0;
  private lockTime = 0;
  private lockResets = 0;
  private paused = false;
  private finished = false;
  private downKey!: Phaser.Input.Keyboard.Key;

  constructor() { super('GameScene'); }

  create(): void {
    this.graphics = this.add.graphics();
    const keyboard = this.input.keyboard;
    if (!keyboard) throw new Error('Keyboard input is unavailable.');
    this.downKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
    keyboard.addCapture(['LEFT', 'RIGHT', 'UP', 'DOWN', 'SPACE']);
    keyboard.on('keydown', this.onKey, this);

    const pause = () => this.togglePause();
    const restart = () => this.resetGame();
    const hold = () => this.hold();
    const touch = (event: Event) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-action]');
      if (button) this.action(button.dataset.action ?? '');
    };
    const blur = () => { if (!this.finished && !this.paused) this.togglePause(); };
    element('pause').addEventListener('click', pause);
    element('restart').addEventListener('click', restart);
    element('hold-button').addEventListener('click', hold);
    document.querySelector('.touch-controls')?.addEventListener('click', touch);
    this.game.events.on(Phaser.Core.Events.BLUR, blur);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      keyboard.off('keydown', this.onKey, this);
      element('pause').removeEventListener('click', pause);
      element('restart').removeEventListener('click', restart);
      element('hold-button').removeEventListener('click', hold);
      document.querySelector('.touch-controls')?.removeEventListener('click', touch);
      this.game.events.off(Phaser.Core.Events.BLUR, blur);
      this.ui.destroy();
    });
    this.resetGame();
  }

  update(_time: number, delta: number): void {
    if (this.paused || this.finished) return;
    this.elapsed += delta;
    const seconds = Math.floor(this.elapsed / 1000);
    if (seconds !== this.lastSecond) {
      this.lastSecond = seconds;
      this.ui.updateTimer(seconds);
    }
    const soft = this.downKey.isDown;
    const interval = soft ? SOFT_DROP_MS : Math.max(MIN_FALL_MS, INITIAL_FALL_MS * SPEED_FACTOR ** (this.level - 1));
    this.fallTime += delta;
    while (this.fallTime >= interval) {
      this.fallTime -= interval;
      if (!(soft ? this.softDrop() : this.move(0, 1))) break;
    }
    if (!this.fits(this.active.shape, this.active.x, this.active.y + 1)) {
      this.lockTime += delta;
      if (this.lockTime >= LOCK_DELAY_MS) this.lockPiece();
    } else {
      this.lockTime = 0;
    }
  }

  private get topRow(): number { return Math.min(this.level - 1, ROWS - MIN_PLAYABLE_ROWS); }

  private advancePhase(): void {
    const previousTop = this.topRow;
    this.level += 1;
    if (this.topRow > previousTop) {
      // The removed row becomes ceiling; a settled block there ends the game.
      if (this.board[previousTop].some(cell => cell !== null)) this.finished = true;
      const firstOccupiedRow = this.active.shape.findIndex(row => row.some(Boolean));
      this.active.y = Math.max(this.active.y, this.topRow - firstOccupiedRow);
      if (!this.fits(this.active.shape, this.active.x, this.active.y)) this.finished = true;
    }
    this.refreshUI();
    this.drawBoard();
    if (this.finished) return;
    this.ui.showPhase(this.level, this.topRow > previousTop);
  }

  private resetGame(): void {
    this.board = createEmptyRows(ROWS);
    this.bag = [];
    this.held = null;
    this.canHold = true;
    this.score = 0;
    this.lines = 0;
    this.elapsed = 0;
    this.level = 1;
    this.ui.reset();
    this.lastSecond = -1;
    this.paused = false;
    this.finished = false;
    this.next = this.takeFromBag();
    this.spawnNext();
    this.refreshUI();
  }

  private takeFromBag(): PieceType {
    if (!this.bag.length) {
      this.bag = Phaser.Utils.Array.Shuffle(Object.keys(SHAPES) as PieceType[]);
    }
    return this.bag.pop()!;
  }

  private spawnNext(): void {
    const type = this.next;
    this.next = this.takeFromBag();
    this.spawn(type);
  }

  private spawn(type: PieceType): void {
    this.active = createPiece(type, this.topRow);
    this.fallTime = 0;
    this.lockTime = 0;
    this.lockResets = 0;
    if (!this.fits(this.active.shape, this.active.x, this.active.y)) this.finished = true;
    this.refreshUI();
    this.drawBoard();
  }

  private fits(shape: Matrix, x: number, y: number): boolean {
    return fitsOnBoard(this.board, shape, x, y, this.topRow);
  }

  private move(dx: number, dy: number): boolean {
    const piece = this.active;
    if (!this.fits(piece.shape, piece.x + dx, piece.y + dy)) return false;
    const wasGrounded = !this.fits(piece.shape, piece.x, piece.y + 1);
    piece.x += dx;
    piece.y += dy;
    if (dx !== 0 && wasGrounded) this.resetLockDelay();
    this.drawBoard();
    return true;
  }

  private resetLockDelay(): void {
    if (this.lockResets >= MAX_LOCK_RESETS) return;
    this.lockTime = 0;
    this.lockResets += 1;
  }

  private rotate(): void {
    if (this.active.type === 'O') return;
    const { shape, x, y } = this.active;
    const rotated = rotateShape(shape);
    for (const offset of WALL_OFFSETS) {
      if (!this.fits(rotated, x + offset, y)) continue;
      const wasGrounded = !this.fits(shape, x, y + 1);
      this.active.shape = rotated;
      this.active.x += offset;
      if (wasGrounded) this.resetLockDelay();
      this.drawBoard();
      return;
    }
  }

  private softDrop(): boolean {
    if (!this.move(0, 1)) return false;
    this.score += SOFT_DROP_POINTS;
    this.refreshStats();
    return true;
  }

  private drop(): void {
    const y = getDropY(this.board, this.active, this.topRow);
    this.score += (y - this.active.y) * HARD_DROP_POINTS;
    this.active.y = y;
    this.lockPiece();
  }

  private lockPiece(): void {
    const { shape, x, y, type } = this.active;
    let aboveBoard = false;
    shape.forEach((row, dy) => row.forEach((cell, dx) => {
      if (!cell) return;
      if (y + dy < this.topRow) aboveBoard = true;
      else this.board[y + dy][x + dx] = type;
    }));
    if (aboveBoard) {
      this.finished = true;
      this.refreshUI();
      this.drawBoard();
      return;
    }
    const { board, cleared } = clearFullRows(this.board, this.topRow);
    this.score += LINE_POINTS[cleared] * this.level;
    this.lines += cleared;
    this.board = board;
    this.canHold = true;
    this.spawnNext();
    while (!this.finished && this.level < MAX_PHASE && this.lines >= this.level * LINES_PER_PHASE) {
      this.advancePhase();
    }
  }

  private hold(): void {
    if (this.paused || this.finished || !this.canHold) return;
    const current = this.active.type;
    const previous = this.held;
    this.held = current;
    this.canHold = false;
    if (previous) this.spawn(previous);
    else this.spawnNext();
  }

  private togglePause(): void {
    if (this.finished) return;
    this.paused = !this.paused;
    this.refreshUI();
  }

  private onKey(event: KeyboardEvent): void {
    // Space always drops a piece, including when a button has focus.
    if (event.code === 'Space') event.preventDefault();
    if (event.repeat && !['ArrowLeft', 'ArrowRight'].includes(event.code)) return;
    if (event.code === 'KeyP' || event.code === 'Escape') this.togglePause();
    else if (event.code === 'KeyR') this.resetGame();
    else {
      this.action(KEY_ACTIONS[event.code] ?? '');
    }
  }

  private action(action: string): void {
    if (this.paused || this.finished) return;
    switch (action) {
      case 'left': this.move(-1, 0); break;
      case 'right': this.move(1, 0); break;
      case 'rotate': this.rotate(); break;
      case 'drop': this.drop(); break;
      case 'hold': this.hold(); break;
      case 'down': this.softDrop(); break;
    }
  }

  private get stats(): GameStats {
    return { score: this.score, level: this.level, lines: this.lines, topRow: this.topRow };
  }

  private refreshStats(): void {
    this.ui.updateStats(this.stats);
  }

  private refreshUI(): void {
    this.ui.update({
      ...this.stats, held: this.held, next: this.next, canHold: this.canHold,
      paused: this.paused, finished: this.finished,
    });
  }

  private drawBoard(): void {
    drawBoard(this.graphics, this.board, this.active, this.topRow, this.finished);
  }
}
