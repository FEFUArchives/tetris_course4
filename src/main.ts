import './style.css';
import { createGame } from './game/config';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Game container is missing.');

app.innerHTML = `
  <div class="shell">
    <header class="header">
      <a class="brand" href="./" aria-label="Тетрис — главная"><span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i><i></i></span>тетрис<span class="brand-dot">.</span></a>
      <span class="edition">КЛАССИКА / 01</span>
    </header>
    <section class="game-layout" aria-label="Тетрис">
      <aside class="left-sidebar">
        <section class="timer-card">
          <div class="eyebrow"><span class="tiny-clock" aria-hidden="true">◷</span> ВРЕМЯ ИГРЫ</div>
          <div id="timer" class="timer">00:00</div>
          <div class="phase-countdown"><span id="phase-label">До следующей фазы</span><strong id="phase-timer"></strong></div>
          <div class="status"><span id="status-dot" class="status-dot"></span><span id="status">Игра идёт</span></div>
        </section>
        <div class="controls">
          <button id="pause" class="button button-primary" type="button"><span id="pause-icon" aria-hidden="true">Ⅱ</span><span id="pause-label">Пауза</span><kbd>P</kbd></button>
          <button id="restart" class="button" type="button"><span aria-hidden="true">↻</span>Рестарт<kbd>R</kbd></button>
          <button id="hold-button" class="button" type="button"><span aria-hidden="true">⇄</span>В карман<kbd>C</kbd></button>
        </div>
        <section class="help">
          <h2 class="eyebrow">КАК ИГРАТЬ</h2>
          <div class="help-row"><span><kbd>←</kbd> <kbd>→</kbd></span><span>Двигать</span></div>
          <div class="help-row"><span><kbd>↑</kbd></span><span>Повернуть</span></div>
          <div class="help-row"><span><kbd>↓</kbd></span><span>Ускорить</span></div>
          <div class="help-row"><span><kbd class="space-key">Пробел</kbd></span><span>Сбросить вниз</span></div>
          <div class="help-row"><span><kbd>C</kbd></span><span>В карман</span></div>
        </section>
      </aside>
      <div class="board-column">
        <div class="board-heading"><span class="eyebrow">ИГРОВОЕ ПОЛЕ</span><span id="board-size">10 × 20</span></div>
        <div class="board-frame">
          <div id="game" aria-label="Игровое поле тетриса"></div>
          <div id="phase-notice" class="phase-notice" role="status" aria-live="polite"><strong id="phase-title"></strong><span id="phase-description"></span></div>
          <div id="board-overlay" class="board-overlay" hidden><span class="overlay-symbol" aria-hidden="true">Ⅱ</span><h1 id="overlay-title">Пауза</h1><p id="overlay-description">Нажми P, чтобы продолжить</p></div>
        </div>
        <div class="touch-controls" aria-label="Управление на сенсорном экране">
          <button type="button" data-action="left" aria-label="Влево">←</button>
          <button type="button" data-action="rotate" aria-label="Повернуть">↻</button>
          <button type="button" data-action="right" aria-label="Вправо">→</button>
          <button type="button" data-action="down" aria-label="Вниз">↓</button>
          <button type="button" data-action="drop" aria-label="Сбросить вниз">⤓</button>
        </div>
      </div>
      <aside class="right-sidebar">
        <section class="panel preview-panel"><div class="panel-heading"><h2 class="eyebrow">КАРМАН</h2><kbd>C</kbd></div><div id="hold-preview" class="piece-preview" aria-label="Карман пуст"></div><p id="hold-note" class="panel-note" hidden></p></section>
        <section class="panel preview-panel"><h2 class="eyebrow">СЛЕДУЮЩАЯ</h2><div id="next-preview" class="piece-preview" aria-label="Следующая фигура"></div></section>
        <section class="panel stats-panel"><h2 class="eyebrow">СТАТИСТИКА</h2><div class="score-stat"><span>Счёт</span><strong id="score">0</strong></div><div class="stat-row"><span>Фаза</span><strong id="level">01</strong></div><div class="stat-row"><span>Линии</span><strong id="lines">0</strong></div><div class="level-track"><div id="level-progress"></div></div></section>
      </aside>
    </section>
  </div>
`;

createGame('game');
