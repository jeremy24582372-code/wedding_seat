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
import {
  DETAIL_TABLES_PER_PAGE,
  REGULAR_OVERVIEW_ANNOTATION_LIMIT,
  buildSeatAnnotations,
  getDetailTableGroupBox,
  getMainTableOverviewGroupBox,
  getRegularTableOverviewGroupBox,
} from './weddingFloorSeatAnnotations.js';

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
        seatIndex: index,
        seatNumber: index + 1,
        guestId: null,
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
        seatIndex: index,
        seatNumber: index + 1,
        guestId: null,
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
      seatIndex: index,
      seatNumber: index + 1,
      guestId,
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

function tableNeedsRegularDetailPage(table) {
  return (
    table.occupancy > REGULAR_OVERVIEW_ANNOTATION_LIMIT ||
    table.guests.some(guest => String(guest.name ?? '').trim().length > 8) ||
    table.overflowGuestIds.length > 0
  );
}

function buildDetailAssignments(regularTablePages, startPageNumber) {
  const detailCandidates = regularTablePages
    .flatMap(page => page.tables)
    .filter(tableNeedsRegularDetailPage);
  const assignments = new Map();
  const detailPages = [];

  for (let offset = 0; offset < detailCandidates.length; offset += DETAIL_TABLES_PER_PAGE) {
    const pageNumber = startPageNumber + detailPages.length;
    const tableIds = detailCandidates
      .slice(offset, offset + DETAIL_TABLES_PER_PAGE)
      .map((table, indexWithinPage) => {
        assignments.set(table.id, {
          pageNumber,
          indexWithinPage,
          groupBox: getDetailTableGroupBox(indexWithinPage),
        });
        return table.id;
      });

    detailPages.push({
      pageNumber,
      kind: 'detail',
      capacity: DETAIL_TABLES_PER_PAGE,
      tableIds,
      tables: [],
      tableInstances: [],
    });
  }

  return { assignments, detailPages };
}

function annotateMainTable(mainTable) {
  if (!mainTable) return null;

  const annotationLayout = buildSeatAnnotations(mainTable, {
    tableKind: 'main',
    overviewPageNumber: 1,
    overviewGroupBox: getMainTableOverviewGroupBox(),
  });

  return {
    ...mainTable,
    ...annotationLayout,
  };
}

function annotateRegularTablePages(regularTablePages, detailAssignments) {
  return regularTablePages.map(page => {
    const tables = page.tables.map((table, indexWithinPage) => {
      const detailAssignment = detailAssignments.get(table.id);
      const annotationLayout = buildSeatAnnotations(table, {
        tableKind: 'regular',
        overviewPageNumber: page.pageNumber,
        overviewGroupBox: getRegularTableOverviewGroupBox(indexWithinPage, page.kind),
        forceDetail: Boolean(detailAssignment),
        detailPageNumber: detailAssignment?.pageNumber,
        detailGroupBox: detailAssignment?.groupBox,
      });

      return {
        ...table,
        ...annotationLayout,
      };
    });

    return {
      ...page,
      tables,
      overviewTables: tables.filter(table => !table.needsDetailPage),
      detailTables: tables.filter(table => table.needsDetailPage),
      needsDetailPage: tables.some(table => table.needsDetailPage),
    };
  });
}

function hydrateDetailPages(detailPages, annotatedRegularTablePages) {
  const tableById = new Map(
    annotatedRegularTablePages
      .flatMap(page => page.tables)
      .map(table => [table.id, table])
  );

  return detailPages.map(page => {
    const tables = page.tableIds
      .map(tableId => tableById.get(tableId))
      .filter(Boolean);

    return {
      ...page,
      tables,
      tableInstances: tables
        .map(table => table.detailTableInstance)
        .filter(Boolean),
      needsDetailPage: tables.length > 0,
    };
  });
}

function buildOverviewProtectedRegions(pageKind) {
  const regions = [
    { id: 'content-safe-area', x: 0, y: 0, width: 184, height: 281, kind: 'safe-area' },
    { id: 'floral-top-left', x: 0, y: 0, width: 44, height: 38, kind: 'floral' },
    { id: 'floral-top-right', x: 144, y: 0, width: 40, height: 34, kind: 'floral' },
    { id: 'floral-bottom-left', x: 0, y: 235, width: 48, height: 46, kind: 'floral' },
    { id: 'floral-bottom-right', x: 135, y: 232, width: 49, height: 49, kind: 'floral' },
  ];

  if (pageKind === 'first') {
    regions.push(
      { id: 'header', x: 0, y: 0, width: 184, height: 44, kind: 'header' },
      { id: 'stage-ribbon', x: 48, y: 49, width: 88, height: 10, kind: 'stage' },
      { id: 'main-table-band', x: 27, y: 62, width: 130, height: 50, kind: 'main-table' },
      { id: 'legend', x: 22, y: 256, width: 140, height: 17, kind: 'legend' },
      { id: 'warning-strip', x: 0, y: 277, width: 184, height: 6, kind: 'warning' }
    );
  } else {
    regions.push(
      { id: 'compact-header', x: 0, y: 0, width: 184, height: 18, kind: 'header' },
      { id: 'continuation-label', x: 0, y: 21, width: 184, height: 7, kind: 'page-label' }
    );
  }

  return regions;
}

function buildDetailProtectedRegions() {
  return [
    { id: 'content-safe-area', x: 0, y: 0, width: 184, height: 273, kind: 'safe-area' },
    { id: 'detail-header', x: 0, y: 0, width: 184, height: 20, kind: 'header' },
    { id: 'detail-footer', x: 0, y: 272, width: 184, height: 8, kind: 'page-footer' },
  ];
}

function buildLayoutPages(mainTable, regularTablePages, detailPages) {
  const overviewPages = regularTablePages.map(page => ({
    pageNumber: page.pageNumber,
    kind: 'overview',
    chartKind: page.kind,
    protectedRegions: buildOverviewProtectedRegions(page.kind),
    tableInstances: [
      ...(page.kind === 'first' && mainTable?.overviewTableInstance
        ? [mainTable.overviewTableInstance]
        : []),
      ...page.tables
        .map(table => table.overviewTableInstance)
        .filter(Boolean),
    ],
  }));

  const pages = detailPages.map(page => ({
    pageNumber: page.pageNumber,
    kind: 'detail',
    protectedRegions: buildDetailProtectedRegions(),
    tableInstances: page.tableInstances,
  }));

  return [...overviewPages, ...pages];
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
  const { assignments: detailAssignments, detailPages: rawDetailPages } = buildDetailAssignments(
    regularTablePages,
    regularTablePages.length + 1
  );
  const annotatedMainTable = annotateMainTable(mainTable);
  const annotatedRegularTablePages = annotateRegularTablePages(regularTablePages, detailAssignments);
  const detailPages = hydrateDetailPages(rawDetailPages, annotatedRegularTablePages);
  const annotatedRegularTables = annotatedRegularTablePages.flatMap(page => page.tables);
  const overviewTables = [
    ...(annotatedMainTable ? [annotatedMainTable] : []),
    ...annotatedRegularTablePages.flatMap(page => page.overviewTables),
  ];
  const detailTables = annotatedRegularTablePages.flatMap(page => page.detailTables);
  const pages = buildLayoutPages(annotatedMainTable, annotatedRegularTablePages, detailPages);
  const legendItems = buildLegendItems(guests);
  const fullGuestIndex = buildFullGuestIndex(annotatedMainTable, annotatedRegularTables, unassignedGuests);
  const chartPageCount = annotatedRegularTablePages.length + detailPages.length;
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
      regularTableCount: annotatedRegularTables.length,
    },
    mainTable: annotatedMainTable,
    regularTablePages: annotatedRegularTablePages,
    overviewTables,
    detailTables,
    detailPages,
    needsDetailPage: detailTables.length > 0,
    pages,
    legendItems,
    categoryVisuals: buildCategoryVisuals(legendItems),
    fullGuestIndex,
    unassignedGuests,
    warnings,
  };
}
