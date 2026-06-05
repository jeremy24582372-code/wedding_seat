// Maximum guests per table — enforced in all drag-drop and state operations
export const MAX_SEATS = 10;

// Default number of tables to create on first load
export const DEFAULT_TABLE_COUNT = 10;

// Guest category definitions with CSS token references
export const CATEGORIES = [
  { id: '新郎親友', label: '新郎親友', token: '--color-cat-groom' },
  { id: '新娘親友', label: '新娘親友', token: '--color-cat-bride' },
  { id: '共同朋友', label: '共同朋友', token: '--color-cat-mutual' },
  { id: '同事',     label: '同事',     token: '--color-cat-colleague' },
  { id: '其他',     label: '其他',     token: '--color-cat-other' },
];

export const DEFAULT_CATEGORY = '其他';

const CATEGORY_ALIASES = {
  男方親友: '新郎親友',
  女方親友: '新娘親友',
};

const BUILTIN_CATEGORY_VISUALS = {
  新郎親友: {
    color: 'var(--color-cat-groom)',
    background: 'var(--color-cat-groom-bg)',
    printColor: '#6b5ce7',
    floorBorder: '#6b5ce7',
    floorBackground: 'rgba(107,92,231,0.18)',
  },
  新娘親友: {
    color: 'var(--color-cat-bride)',
    background: 'var(--color-cat-bride-bg)',
    printColor: '#d9567a',
    floorBorder: '#c2255c',
    floorBackground: 'rgba(194,37,92,0.18)',
  },
  共同朋友: {
    color: 'var(--color-cat-mutual)',
    background: 'var(--color-cat-mutual-bg)',
    printColor: '#3aaa6e',
    floorBorder: '#2f9e44',
    floorBackground: 'rgba(47,158,68,0.18)',
  },
  同事: {
    color: 'var(--color-cat-colleague)',
    background: 'var(--color-cat-colleague-bg)',
    printColor: '#c49a2a',
    floorBorder: '#c49a2a',
    floorBackground: 'rgba(196,154,42,0.18)',
  },
  其他: {
    color: 'var(--color-cat-other)',
    background: 'var(--color-cat-other-bg)',
    printColor: '#888888',
    floorBorder: '#777777',
    floorBackground: 'rgba(100,100,100,0.10)',
  },
};

const CUSTOM_CATEGORY_VISUALS = [
  { printColor: '#1f7a8c', floorBorder: '#1f7a8c', floorBackground: 'rgba(31,122,140,0.18)' },
  { printColor: '#8a5a00', floorBorder: '#8a5a00', floorBackground: 'rgba(138,90,0,0.18)' },
  { printColor: '#7b3f98', floorBorder: '#7b3f98', floorBackground: 'rgba(123,63,152,0.18)' },
  { printColor: '#b44b32', floorBorder: '#b44b32', floorBackground: 'rgba(180,75,50,0.18)' },
  { printColor: '#2f6f4e', floorBorder: '#2f6f4e', floorBackground: 'rgba(47,111,78,0.18)' },
  { printColor: '#546a7b', floorBorder: '#546a7b', floorBackground: 'rgba(84,106,123,0.18)' },
];

export function normalizeCategory(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return DEFAULT_CATEGORY;
  return CATEGORY_ALIASES[raw] ?? raw;
}

export function isBuiltinCategory(category) {
  return CATEGORIES.some(cat => cat.id === normalizeCategory(category));
}

function hashCategory(category) {
  let hash = 0;
  const normalized = normalizeCategory(category);
  for (let i = 0; i < normalized.length; i += 1) {
    hash = ((hash << 5) - hash + normalized.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function getCategoryVisual(category) {
  const normalized = normalizeCategory(category);
  const builtin = BUILTIN_CATEGORY_VISUALS[normalized];
  if (builtin) {
    return {
      id: normalized,
      label: normalized,
      isBuiltin: true,
      ...builtin,
    };
  }

  const fallback = CUSTOM_CATEGORY_VISUALS[hashCategory(normalized) % CUSTOM_CATEGORY_VISUALS.length];
  return {
    id: normalized,
    label: normalized,
    isBuiltin: false,
    color: fallback.printColor,
    background: fallback.floorBackground,
    ...fallback,
  };
}

export function buildCategoryOptions(guests = []) {
  const builtinIds = new Set(CATEGORIES.map(cat => cat.id));
  const customCategories = Array.from(new Set(
    guests
      .map(g => normalizeCategory(g?.category))
      .filter(cat => cat && !builtinIds.has(cat))
  )).sort((a, b) => a.localeCompare(b, 'zh-Hant'));

  return [
    ...CATEGORIES,
    ...customCategories.map(cat => ({ id: cat, label: cat, custom: true })),
  ];
}

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
