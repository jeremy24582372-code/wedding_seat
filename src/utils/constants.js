// Maximum guests per table — enforced in all drag-drop and state operations
export const MAX_SEATS = 10;

// Default number of tables to create on first load
export const DEFAULT_TABLE_COUNT = 10;

// Guest category definitions with CSS token references
export const CATEGORIES = [
  { id: '男方親友', label: '男方親友', token: '--color-cat-groom' },
  { id: '女方親友', label: '女方親友', token: '--color-cat-bride' },
  { id: '共同朋友', label: '共同朋友', token: '--color-cat-mutual' },
  { id: '同事',     label: '同事',     token: '--color-cat-colleague' },
  { id: '其他',     label: '其他',     token: '--color-cat-other' },
];

// localStorage key for persisting app state
export const STORAGE_KEY = 'wedding-seating-v1';

// Debounce delay for auto-save (ms)
export const AUTOSAVE_DEBOUNCE_MS = 500;

// Floor-plan canvas dimensions (px) — portrait orientation to match venue layout
// Grid: 5 columns × 6 rows
export const CANVAS_WIDTH  = 1850;
export const CANVAS_HEIGHT = 2400;

/**
 * Compute default table position for index i.
 * Lays out tables in a 5-column × 6-row portrait grid.
 */
export function defaultTablePosition(index) {
  const col = index % 5;
  const row = Math.floor(index / 5);
  return {
    x: 80 + col * 340,
    y: 80 + row * 370,
  };
}
