// Длительность фазы в миллисекундах: 15_000 для проверки, 60_000 для минуты.
export const PHASE_DURATION_MS = 15_000;
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
