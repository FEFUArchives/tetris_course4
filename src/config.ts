// Размеры поля и клетки в пикселях.
export const COLUMNS = 10;
export const ROWS = 20;
export const CELL_SIZE = 32;
export const BOARD_WIDTH = COLUMNS * CELL_SIZE;
export const BOARD_HEIGHT = ROWS * CELL_SIZE;

// Количество очищенных линий для перехода к следующей фазе.
export const LINES_PER_PHASE = 10;
// После этой фазы игра продолжается без дальнейшего усложнения.
export const MAX_PHASE = 10;
// Минимальная высота поля после уменьшения.
export const MIN_PLAYABLE_ROWS = 8;
// Длительность надписи при переходе фазы в миллисекундах.
export const PHASE_NOTICE_MS = 2200;

// Интервалы автоматического падения в миллисекундах.
export const INITIAL_FALL_MS = 850;
export const MIN_FALL_MS = 90;
// Каждая фаза сокращает интервал падения на 10%.
export const SPEED_FACTOR = 0.9;

// Мягкое падение и задержка фиксации фигуры (миллисекунды).
export const SOFT_DROP_MS = 40;
export const LOCK_DELAY_MS = 450;
export const MAX_LOCK_RESETS = 15;

// Очки за линии и за одну клетку ускоренного падения.
export const LINE_POINTS = [0, 100, 300, 500, 800];
export const SOFT_DROP_POINTS = 1;
export const HARD_DROP_POINTS = 2;
// Горизонтальные сдвиги, проверяемые при повороте у препятствия.
export const WALL_OFFSETS = [0, -1, 1, -2, 2];
