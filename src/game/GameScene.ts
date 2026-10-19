import Phaser from 'phaser';
import {
  LINES_PER_PHASE, MAX_PHASE, MIN_PLAYABLE_ROWS, PHASE_NOTICE_MS,
  INITIAL_FALL_MS, MIN_FALL_MS, SPEED_FACTOR,
} from '../config';

const COLUMNS = 10;
const ROWS = 20;
const CELL_SIZE = 32;
export const BOARD_WIDTH = COLUMNS * CELL_SIZE;
export const BOARD_HEIGHT = ROWS * CELL_SIZE;
const SOFT_DROP_MS = 40;
const LOCK_DELAY_MS = 450;
const MAX_LOCK_RESETS = 15;
const LINE_POINTS = [0, 100, 300, 500, 800];
const WALL_OFFSETS = [0, -1, 1, -2, 2];

type Matrix = number[][];
type PieceType = 'I' | 'J' | 'L' | 'O' | 'S' | 'T' | 'Z';
interface Piece { type: PieceType; shape: Matrix; x: number; y: number }
const SHAPES: Record<PieceType, Matrix> = {
  I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
  J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
  L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
  O: [[1, 1], [1, 1]],
  S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
  T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
  Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
};
const COLORS: Record<PieceType, number> = {
  I: 0x6ccbdd, J: 0x709ee8, L: 0xeab375, O: 0xe5cc77,
  S: 0x7dd9ba, T: 0xb59bdf, Z: 0xdf8594,
};

function element<T extends HTMLElement = HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing UI element: ${id}`);
  return node as T;
}

export class GameScene extends Phaser.Scene {
  private graphics!: Phaser.GameObjects.Graphics;
  private board: (PieceType | null)[][] = [];
  private active!: Piece;
  private bag: PieceType[] = [];
  private next!: PieceType;
  private held: PieceType | null = null;
  private canHold = true;
  private score = 0;
  private lines = 0;
  private elapsed = 0;
  private level = 1;
  private phaseAnimation: Animation | null = null;
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
      this.phaseAnimation?.cancel();
    });
    this.resetGame();
  }

  update(_time: number, delta: number): void {
    if (this.paused || this.finished) return;
    this.elapsed += delta;
    const seconds = Math.floor(this.elapsed / 1000);
    if (seconds !== this.lastSecond) {
      this.lastSecond = seconds;
      element('timer').textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    }
    const soft = this.downKey.isDown;
    const interval = soft ? SOFT_DROP_MS : Math.max(MIN_FALL_MS, INITIAL_FALL_MS * SPEED_FACTOR ** (this.level - 1));
    this.fallTime += delta;
    while (this.fallTime >= interval) {
      this.fallTime -= interval;
      if (!this.move(0, 1)) break;
      if (soft) { this.score += 1; this.refreshStats(); }
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
    element('phase-title').textContent = `ФАЗА ${this.level}`;
    element('phase-description').textContent = this.topRow > previousTop
      ? 'Поле меньше · скорость выше'
      : 'Скорость выше';
    this.phaseAnimation?.cancel();
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.phaseAnimation = element('phase-notice').animate([
      { opacity: 0, transform: reducedMotion ? 'none' : 'scale(1.3) translateY(8px)', offset: 0 },
      { opacity: 1, transform: 'none', offset: 0.08 },
      { opacity: 1, transform: 'none', offset: 0.4 },
      { opacity: 0, transform: reducedMotion ? 'none' : 'scale(1.03) translateY(-10px)', offset: 1 },
    ], { duration: PHASE_NOTICE_MS, easing: 'ease-out' });
  }

  private resetGame(): void {
    this.board = Array.from({ length: ROWS }, () => Array<PieceType | null>(COLUMNS).fill(null));
    this.bag = [];
    this.held = null;
    this.canHold = true;
    this.score = 0;
    this.lines = 0;
    this.elapsed = 0;
    this.level = 1;
    this.phaseAnimation?.cancel();
    this.phaseAnimation = null;
    this.lastSecond = -1;
    this.paused = false;
    this.finished = false;
    this.next = this.takeFromBag();
    this.spawnNext();
    element('timer').textContent = '00:00';
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
    const shape = SHAPES[type].map(row => [...row]);
    this.active = { type, shape, x: Math.floor((COLUMNS - shape.length) / 2), y: this.topRow };
    this.fallTime = 0;
    this.lockTime = 0;
    this.lockResets = 0;
    if (!this.fits(shape, this.active.x, this.active.y)) this.finished = true;
    this.refreshUI();
    this.drawBoard();
  }

  private fits(shape: Matrix, x: number, y: number): boolean {
    return shape.every((row, dy) => row.every((cell, dx) => {
      if (!cell) return true;
      const column = x + dx;
      const line = y + dy;
      return column >= 0 && column < COLUMNS && line >= this.topRow && line < ROWS && this.board[line][column] === null;
    }));
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
    const rotated = shape[0].map((_, column) => shape.map(row => row[column]).reverse());
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

  private drop(): void {
    let distance = 0;
    while (this.fits(this.active.shape, this.active.x, this.active.y + 1)) {
      this.active.y += 1;
      distance += 1;
    }
    this.score += distance * 2;
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
    const remaining = this.board.slice(this.topRow).filter(row => row.some(cell => cell === null));
    const cleared = ROWS - this.topRow - remaining.length;
    this.score += LINE_POINTS[cleared] * this.level;
    this.lines += cleared;
    this.board = [
      ...Array.from({ length: this.topRow + cleared }, () => Array<PieceType | null>(COLUMNS).fill(null)),
      ...remaining,
    ];
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
      const actions: Record<string, string> = {
        ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'rotate',
        Space: 'drop', KeyC: 'hold', ShiftLeft: 'hold', ShiftRight: 'hold',
      };
      this.action(actions[event.code] ?? '');
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
      case 'down':
        if (this.move(0, 1)) { this.score += 1; this.refreshStats(); }
        break;
    }
  }

  private refreshStats(): void {
    element('score').textContent = this.score.toLocaleString('ru-RU');
    element('level').textContent = String(this.level).padStart(2, '0');
    element('lines').textContent = String(this.lines);
    const isFinalPhase = this.level >= MAX_PHASE;
    const progress = isFinalPhase ? LINES_PER_PHASE : this.lines % LINES_PER_PHASE;
    const remaining = LINES_PER_PHASE - progress;
    element('phase-label').textContent = isFinalPhase ? 'Максимальная фаза' : 'До следующей фазы';
    element('phase-lines').hidden = isFinalPhase;
    element('phase-lines').textContent = `${remaining} л.`;
    element('level-progress').style.width = `${progress / LINES_PER_PHASE * 100}%`;
    element('board-size').textContent = `${COLUMNS} × ${ROWS - this.topRow}`;
  }

  private refreshUI(): void {
    if (this.finished) this.phaseAnimation?.cancel();
    else if (this.paused) this.phaseAnimation?.pause();
    else if (this.phaseAnimation?.playState === 'paused') this.phaseAnimation.play();
    this.refreshStats();
    this.drawPreview('hold-preview', this.held);
    this.drawPreview('next-preview', this.next);
    element('hold-note').hidden = this.canHold;
    element('hold-note').textContent = this.canHold ? '' : 'Доступен после сброса';
    element<HTMLButtonElement>('hold-button').disabled = !this.canHold || this.paused || this.finished;
    element<HTMLButtonElement>('pause').disabled = this.finished;
    element('pause-label').textContent = this.paused ? 'Продолжить' : 'Пауза';
    element('pause-icon').textContent = this.paused ? '▷' : 'Ⅱ';
    element('status').textContent = this.finished ? 'Игра окончена' : this.paused ? 'На паузе' : 'Игра идёт';
    element('status-dot').classList.toggle('inactive', this.paused || this.finished);
    element('board-overlay').hidden = !this.paused && !this.finished;
    element('overlay-title').textContent = this.finished ? 'Игра окончена' : 'Пауза';
    element('overlay-description').textContent = this.finished ? `Счёт: ${this.score.toLocaleString('ru-RU')}. Нажми R для новой игры` : 'Нажми P или «Продолжить»';
  }

  private drawPreview(id: string, type: PieceType | null): void {
    const container = element(id);
    container.replaceChildren();
    container.setAttribute('aria-label', type ? `Фигура ${type}` : 'Карман пуст');
    if (!type) {
      const empty = document.createElement('span');
      empty.className = 'empty-pocket';
      empty.textContent = 'Пока пусто';
      container.append(empty);
      return;
    }
    const shape = SHAPES[type].filter(row => row.some(Boolean));
    const grid = document.createElement('div');
    grid.className = 'preview-grid';
    grid.style.gridTemplateColumns = `repeat(${shape[0].length}, 1fr)`;
    grid.style.setProperty('--piece-color', `#${COLORS[type].toString(16).padStart(6, '0')}`);
    shape.flat().forEach(cell => {
      const block = document.createElement('span');
      block.className = `preview-cell${cell ? ' filled' : ''}`;
      grid.append(block);
    });
    container.append(grid);
  }

  private drawBoard(): void {
    const g = this.graphics;
    g.clear();
    g.lineStyle(1, 0x25364a, 0.55);
    const ceilingY = this.topRow * CELL_SIZE;
    for (let x = 1; x < COLUMNS; x++) g.lineBetween(x * CELL_SIZE, ceilingY, x * CELL_SIZE, BOARD_HEIGHT);
    for (let y = this.topRow + 1; y < ROWS; y++) g.lineBetween(0, y * CELL_SIZE, BOARD_WIDTH, y * CELL_SIZE);
    this.board.forEach((row, y) => row.forEach((cell, x) => {
      if (cell) this.drawCell(x, y, COLORS[cell]);
    }));
    if (this.topRow > 0) {
      g.fillStyle(0x0b121c, 1);
      g.fillRect(0, 0, BOARD_WIDTH, ceilingY);
      g.lineStyle(2, 0x7dd9ba, 0.8);
      g.lineBetween(0, ceilingY, BOARD_WIDTH, ceilingY);
    }
    if (this.finished) return;
    let ghostY = this.active.y;
    while (this.fits(this.active.shape, this.active.x, ghostY + 1)) ghostY += 1;
    this.active.shape.forEach((row, dy) => row.forEach((cell, dx) => {
      if (!cell) return;
      if (ghostY > this.active.y) this.drawCell(this.active.x + dx, ghostY + dy, COLORS[this.active.type], true);
      this.drawCell(this.active.x + dx, this.active.y + dy, COLORS[this.active.type]);
    }));
  }

  private drawCell(x: number, y: number, color: number, ghost = false): void {
    if (y < 0) return;
    const g = this.graphics;
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
}
