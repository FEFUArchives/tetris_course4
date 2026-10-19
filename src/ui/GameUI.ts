import { COLUMNS, ROWS, LINES_PER_PHASE, MAX_PHASE, PHASE_NOTICE_MS } from '../config';
import { SHAPES, COLORS, type PieceType } from '../game/pieces';

export interface GameStats {
  score: number;
  level: number;
  lines: number;
  topRow: number;
}

interface GameViewState extends GameStats {
  held: PieceType | null;
  next: PieceType;
  canHold: boolean;
  paused: boolean;
  finished: boolean;
}

export function element<T extends HTMLElement = HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing UI element: ${id}`);
  return node as T;
}

export class GameUI {
  private phaseAnimation: Animation | null = null;

  updateTimer(seconds: number): void {
    element('timer').textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  }

  reset(): void {
    this.destroy();
    this.updateTimer(0);
  }

  destroy(): void {
    this.phaseAnimation?.cancel();
    this.phaseAnimation = null;
  }

  showPhase(level: number, shrunk: boolean): void {
    element('phase-title').textContent = `ФАЗА ${level}`;
    element('phase-description').textContent = shrunk
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

  updateStats(state: GameStats): void {
    element('score').textContent = state.score.toLocaleString('ru-RU');
    element('level').textContent = String(state.level).padStart(2, '0');
    element('lines').textContent = String(state.lines);
    const isFinalPhase = state.level >= MAX_PHASE;
    const progress = isFinalPhase ? LINES_PER_PHASE : state.lines % LINES_PER_PHASE;
    const remaining = LINES_PER_PHASE - progress;
    element('phase-label').textContent = isFinalPhase ? 'Максимальная фаза' : 'До следующей фазы';
    element('phase-lines').hidden = isFinalPhase;
    element('phase-lines').textContent = `${remaining} линий`;
    element('level-progress').style.width = `${progress / LINES_PER_PHASE * 100}%`;
    element('board-size').textContent = `${COLUMNS} × ${ROWS - state.topRow}`;
  }

  update(state: GameViewState): void {
    if (state.finished) this.phaseAnimation?.cancel();
    else if (state.paused) this.phaseAnimation?.pause();
    else if (this.phaseAnimation?.playState === 'paused') this.phaseAnimation.play();
    this.updateStats(state);
    this.drawPreview('hold-preview', state.held);
    this.drawPreview('next-preview', state.next);
    element('hold-note').hidden = state.canHold;
    element('hold-note').textContent = state.canHold ? '' : 'Доступен после сброса';
    element<HTMLButtonElement>('hold-button').disabled = !state.canHold || state.paused || state.finished;
    element<HTMLButtonElement>('pause').disabled = state.finished;
    element('pause-label').textContent = state.paused ? 'Продолжить' : 'Пауза';
    element('pause-icon').textContent = state.paused ? '▷' : 'Ⅱ';
    element('status').textContent = state.finished ? 'Игра окончена' : state.paused ? 'На паузе' : 'Игра идёт';
    element('status-dot').classList.toggle('inactive', state.paused || state.finished);
    element('board-overlay').hidden = !state.paused && !state.finished;
    element('overlay-title').textContent = state.finished ? 'Игра окончена' : 'Пауза';
    element('overlay-description').textContent = state.finished ? `Счёт: ${state.score.toLocaleString('ru-RU')}. Нажми R для новой игры` : 'Нажми P или «Продолжить»';
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
}
