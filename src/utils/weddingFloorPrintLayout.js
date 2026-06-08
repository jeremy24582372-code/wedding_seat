import {
  MAX_SEATS,
  buildCategoryOptions,
  getCategoryVisual,
  normalizeCategory,
} from './constants.js';
import {
  buildGuestContextLabel,
  formatExportDate,
  isGuestLockedForExport,
} from './exportShared.js';

export const FIRST_PAGE_REGULAR_TABLE_CAPACITY = 19;
export const CONTINUATION_PAGE_TABLE_CAPACITY = 20;

function normalizeLabel(value) {
  return String(value ?? '').trim();
}

function normalizeDigits(value) {
  return normalizeLabel(value).replace(/[０-９]/g, digit =>
    String.fromCharCode(digit.charCodeAt(0) - 0xfee0)
  );
}

export function parseWeddingTableNumber(label) {
  const normalized = normalizeDigits(label);
  const exactMatch = normalized.match(/^第?\s*(\d+)\s*桌?$/u);
  if (exactMatch) return Number(exactMatch[1]);

  const tableMatch = normalized.match(/第?\s*(\d+)\s*桌/u);
  return tableMatch ? Number(tableMatch[1]) : null;
}

function detectMainTableEntry(tableEntries) {
  return (
    tableEntries.find(entry => entry.label === '主桌') ??
    tableEntries.find(entry => entry.label.includes('主桌')) ??
    tableEntries.find(entry => parseWeddingTableNumber(entry.label) === 1) ??
    tableEntries[0] ??
    null
  );
}

function compareRegularTables(a, b) {
  const numberA = parseWeddingTableNumber(a.label);
  const numberB = parseWeddingTableNumber(b.label);
  const hasNumberA = numberA !== null;
  const hasNumberB = numberB !== null;

  if (hasNumberA && hasNumberB && numberA !== numberB) {
    return numberA - numberB;
  }
  if (hasNumberA && !hasNumberB) return -1;
  if (!hasNumberA && hasNumberB) return 1;
  return a.originalIndex - b.originalIndex;
}

function buildGuestById(guests) {
  const guestById = new Map();
  guests.forEach(guest => {
    if (guest?.id && !guestById.has(guest.id)) {
      guestById.set(guest.id, guest);
    }
  });
  return guestById;
}

function toCategoryVisual(category) {
  const visual = getCategoryVisual(category);
  return {
    id: visual.id,
    label: visual.label,
    printColor: visual.printColor,
    floorBorder: visual.floorBorder,
    floorBackground: visual.floorBackground,
    isBuiltin: visual.isBuiltin,
  };
}

function buildGuestLayoutSummary(state, guest, seatNumber = null) {
  const category = normalizeCategory(guest.category);

  return {
    id: guest.id,
    name: guest.name ?? '',
    category,
    categoryVisual: toCategoryVisual(category),
    tableId: guest.tableId ?? null,
    seatNumber,
    contextLabel: buildGuestContextLabel(state, guest.id),
    locked: isGuestLockedForExport(state, guest.id),
  };
}

function buildTableLayout({
  state,
  tableEntry,
  guestById,
  assignedGuestIds,
  warnings,
}) {
  if (!tableEntry) return null;

  const { table, label, originalIndex } = tableEntry;
  const rawGuestIds = Array.isArray(table.guestIds) ? table.guestIds : [];
  const overflowGuestIds = rawGuestIds.slice(MAX_SEATS).filter(Boolean);

  if (overflowGuestIds.length > 0) {
    warnings.push({
      code: 'table-overflow',
      message: `${label || `第 ${originalIndex + 1} 桌`} 超過 ${MAX_SEATS} 個座位，匯出版型只會建立 ${MAX_SEATS} 個座位並標記資料需檢查。`,
      tableId: table.id,
      tableLabel: label,
      overflowGuestIds,
    });
  }

  const seats = Array.from({ length: MAX_SEATS }, (_, index) => {
    const guestId = rawGuestIds[index] ?? null;
    if (!guestId) {
      return {
        seatNumber: index + 1,
        guest: null,
        isEmpty: true,
      };
    }

    const guest = guestById.get(guestId);
    if (!guest) {
      warnings.push({
        code: 'missing-guest-reference',
        message: `${label || '未命名桌次'} 第 ${index + 1} 位引用不存在的賓客 ID。`,
        tableId: table.id,
        tableLabel: label,
        guestId,
      });
      return {
        seatNumber: index + 1,
        guest: null,
        missingGuestId: guestId,
        isEmpty: true,
      };
    }

    if (assignedGuestIds.has(guestId)) {
      warnings.push({
        code: 'duplicate-guest-reference',
        message: `${guest.name ?? guestId} 在桌次資料中出現超過一次，請回到座位圖檢查。`,
        tableId: table.id,
        tableLabel: label,
        guestId,
      });
    }

    assignedGuestIds.add(guestId);

    return {
      seatNumber: index + 1,
      guest: buildGuestLayoutSummary(state, guest, index + 1),
      isEmpty: false,
    };
  });

  const occupiedSeats = seats.filter(seat => seat.guest);
  const displayNameplates = occupiedSeats.length <= 3
    ? occupiedSeats.map(seat => seat.guest)
    : [];
  const hasLongName = occupiedSeats.some(seat => String(seat.guest.name).length > 6);

  return {
    id: table.id,
    label,
    originalIndex,
    table,
    tableNumber: parseWeddingTableNumber(label),
    seats,
    guests: occupiedSeats.map(seat => seat.guest),
    occupancy: occupiedSeats.length,
    capacity: MAX_SEATS,
    isFull: occupiedSeats.length >= MAX_SEATS,
    displayNameplates,
    requiresFullIndex: occupiedSeats.length > displayNameplates.length || hasLongName || overflowGuestIds.length > 0,
    overflowGuestIds,
  };
}

function paginateRegularTables(regularTables) {
  const pages = [
    {
      pageNumber: 1,
      kind: 'first',
      capacity: FIRST_PAGE_REGULAR_TABLE_CAPACITY,
      tables: regularTables.slice(0, FIRST_PAGE_REGULAR_TABLE_CAPACITY),
    },
  ];

  for (
    let offset = FIRST_PAGE_REGULAR_TABLE_CAPACITY;
    offset < regularTables.length;
    offset += CONTINUATION_PAGE_TABLE_CAPACITY
  ) {
    pages.push({
      pageNumber: pages.length + 1,
      kind: 'continuation',
      capacity: CONTINUATION_PAGE_TABLE_CAPACITY,
      tables: regularTables.slice(offset, offset + CONTINUATION_PAGE_TABLE_CAPACITY),
    });
  }

  return pages;
}

function buildLegendItems(guests) {
  return buildCategoryOptions(guests).map(category => ({
    id: category.id,
    label: category.label,
    isBuiltin: category.custom !== true,
    used: guests.some(guest => normalizeCategory(guest.category) === category.id),
    visual: toCategoryVisual(category.id),
  }));
}

function buildCategoryVisuals(legendItems) {
  return Object.fromEntries(
    legendItems.map(item => [item.id, item.visual])
  );
}

function buildUnassignedGuests(state, guests, guestById, assignedGuestIds, warnings) {
  const explicitIds = Array.isArray(state?.unassignedGuestIds) ? state.unassignedGuestIds : [];
  const explicitGuests = [];
  const seen = new Set();

  explicitIds.forEach(guestId => {
    const guest = guestById.get(guestId);
    if (!guest) return;
    if (seen.has(guestId)) return;
    seen.add(guestId);
    explicitGuests.push(guest);
  });

  const derivedGuests = guests.filter(guest => {
    if (!guest?.id || seen.has(guest.id)) return false;
    return !assignedGuestIds.has(guest.id) || guest.tableId === null;
  });

  const unassignedGuests = [...explicitGuests, ...derivedGuests]
    .filter(guest => !assignedGuestIds.has(guest.id))
    .map(guest => buildGuestLayoutSummary(state, guest));

  if (unassignedGuests.length > 0) {
    warnings.push({
      code: 'unassigned-guests',
      message: `尚有 ${unassignedGuests.length} 位賓客未分配座位，PDF 必須列出完整名單。`,
      guestIds: unassignedGuests.map(guest => guest.id),
    });
  }

  return unassignedGuests;
}

function buildFullGuestIndex(mainTable, regularTables, unassignedGuests) {
  const sections = [];

  if (mainTable) {
    sections.push({
      sectionType: 'main-table',
      tableId: mainTable.id,
      tableLabel: mainTable.label,
      occupancy: mainTable.occupancy,
      capacity: mainTable.capacity,
      guests: mainTable.guests,
    });
  }

  regularTables.forEach(table => {
    sections.push({
      sectionType: 'regular-table',
      tableId: table.id,
      tableLabel: table.label,
      occupancy: table.occupancy,
      capacity: table.capacity,
      guests: table.guests,
    });
  });

  if (unassignedGuests.length > 0) {
    sections.push({
      sectionType: 'unassigned',
      tableId: null,
      tableLabel: '未分配賓客',
      occupancy: unassignedGuests.length,
      capacity: null,
      guests: unassignedGuests,
    });
  }

  return sections;
}

export function buildWeddingFloorLayoutModel(state, options = {}) {
  const guests = Array.isArray(state?.guests) ? state.guests : [];
  const tables = Array.isArray(state?.tables) ? state.tables : [];
  const tableEntries = tables.map((table, originalIndex) => ({
    table,
    originalIndex,
    label: normalizeLabel(table?.label),
  }));
  const warnings = [];
  const guestById = buildGuestById(guests);
  const assignedGuestIds = new Set();
  const mainTableEntry = detectMainTableEntry(tableEntries);

  if (tables.length === 0) {
    warnings.push({
      code: 'no-tables',
      message: '目前沒有任何桌次，PDF 只能輸出未分配賓客與圖例。',
    });
  }

  const mainTable = buildTableLayout({
    state,
    tableEntry: mainTableEntry,
    guestById,
    assignedGuestIds,
    warnings,
  });

  const regularTables = tableEntries
    .filter(entry => entry.table?.id !== mainTableEntry?.table?.id)
    .sort(compareRegularTables)
    .map(entry => buildTableLayout({
      state,
      tableEntry: entry,
      guestById,
      assignedGuestIds,
      warnings,
    }))
    .filter(Boolean);

  const unassignedGuests = buildUnassignedGuests(state, guests, guestById, assignedGuestIds, warnings);
  const regularTablePages = paginateRegularTables(regularTables);
  const legendItems = buildLegendItems(guests);
  const fullGuestIndex = buildFullGuestIndex(mainTable, regularTables, unassignedGuests);
  const chartPageCount = regularTablePages.length;
  const requiresFullGuestIndex = fullGuestIndex.some(section => section.guests.length > 0);

  return {
    meta: {
      exportDate: formatExportDate(options.date ?? new Date()),
      tableCount: tables.length,
      partyRowCount: Array.isArray(state?.partyRows) ? state.partyRows.length : 0,
      guestCount: guests.length,
      assignedGuestCount: assignedGuestIds.size,
      unassignedGuestCount: unassignedGuests.length,
      chartPageCount,
      pageCount: chartPageCount + (requiresFullGuestIndex ? 1 : 0),
      regularTableCount: regularTables.length,
    },
    mainTable,
    regularTablePages,
    legendItems,
    categoryVisuals: buildCategoryVisuals(legendItems),
    fullGuestIndex,
    unassignedGuests,
    warnings,
  };
}
