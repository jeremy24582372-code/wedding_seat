import assert from 'node:assert/strict';
import {
  FIRST_PAGE_REGULAR_TABLE_CAPACITY,
  CONTINUATION_PAGE_TABLE_CAPACITY,
  buildWeddingFloorLayoutModel,
  parseWeddingTableNumber,
} from '../src/utils/weddingFloorPrintLayout.js';
import {
  REGULAR_OVERVIEW_ANNOTATION_LIMIT,
  buildSeatAnnotations,
} from '../src/utils/weddingFloorSeatAnnotations.js';
import { escHtml, formatExportDate } from '../src/utils/exportShared.js';

function makeGuest(id, name, category, tableId = null) {
  return {
    id,
    name,
    category,
    diet: '',
    source: 'import',
    tableId,
    partyId: null,
    partyRole: 'primary',
  };
}

function makeTable(id, label, guestIds = []) {
  return {
    id,
    label,
    seats: 10,
    guestIds,
  };
}

function checkLocalDateFormatting() {
  assert.equal(
    formatExportDate(new Date(2026, 0, 2, 0, 5, 0)),
    '2026-01-02',
    'Export date must use local calendar fields, not UTC slicing'
  );
}

function checkHtmlEscapeContract() {
  assert.equal(escHtml('<王&">'), '&lt;王&amp;&quot;&gt;');
}

function checkMainTablePriority() {
  const state = {
    guests: [
      makeGuest('g1', '主桌賓客', '新郎親友', 'main'),
      makeGuest('g2', '一桌賓客', '新娘親友', 'one'),
    ],
    tables: [
      makeTable('one', '1桌', ['g2']),
      makeTable('main', '主桌', ['g1']),
    ],
    unassignedGuestIds: [],
    partyRows: [],
  };

  const model = buildWeddingFloorLayoutModel(state, {
    date: new Date(2026, 5, 8),
  });

  assert.equal(model.mainTable.id, 'main', 'Exact 主桌 label must outrank 1桌');
  assert.equal(model.regularTablePages[0].tables[0].label, '1桌');

  const containsMain = buildWeddingFloorLayoutModel({
    ...state,
    tables: [
      makeTable('one', '1桌', ['g2']),
      makeTable('main', '新人主桌A', ['g1']),
    ],
  });
  assert.equal(containsMain.mainTable.id, 'main', 'Label containing 主桌 must be selected');

  const numberMain = buildWeddingFloorLayoutModel({
    ...state,
    tables: [
      makeTable('one', '1桌', ['g2']),
      makeTable('two', '2桌', []),
    ],
  });
  assert.equal(numberMain.mainTable.id, 'one', '1桌 must be the main table when no 主桌 label exists');

  const fallbackMain = buildWeddingFloorLayoutModel({
    ...state,
    tables: [
      makeTable('vip', 'VIP桌', []),
      makeTable('family', '親友桌', []),
    ],
  });
  assert.equal(fallbackMain.mainTable.id, 'vip', 'First table is fallback main table');
}

function checkNaturalSorting() {
  assert.equal(parseWeddingTableNumber('第12桌'), 12);
  assert.equal(parseWeddingTableNumber('０７桌'), 7);
  assert.equal(parseWeddingTableNumber('VIP桌'), null);

  const state = {
    guests: [],
    tables: [
      makeTable('main', '主桌'),
      makeTable('t10', '10桌'),
      makeTable('custom-a', '親友桌'),
      makeTable('t2', '2桌'),
      makeTable('custom-b', 'VIP桌'),
      makeTable('t3', '3桌'),
    ],
    unassignedGuestIds: [],
    partyRows: [],
  };

  const model = buildWeddingFloorLayoutModel(state);
  const labels = model.regularTablePages[0].tables.map(table => table.label);
  assert.deepEqual(labels, ['2桌', '3桌', '10桌', '親友桌', 'VIP桌']);
}

function checkPagination() {
  const regularTables = Array.from({ length: 41 }, (_, index) =>
    makeTable(`t${index + 2}`, `${index + 2}桌`)
  );
  const model = buildWeddingFloorLayoutModel({
    guests: [],
    tables: [makeTable('main', '主桌'), ...regularTables],
    unassignedGuestIds: [],
    partyRows: [],
  });

  assert.equal(model.regularTablePages.length, 3);
  assert.equal(model.regularTablePages[0].tables.length, FIRST_PAGE_REGULAR_TABLE_CAPACITY);
  assert.equal(model.regularTablePages[1].tables.length, CONTINUATION_PAGE_TABLE_CAPACITY);
  assert.equal(model.regularTablePages[2].tables.length, 2);
  assert.equal(model.regularTablePages[1].tables[0].label, '21桌');
  assert.equal(model.meta.chartPageCount, 3);
}

function checkGuestAccountingAndWarnings() {
  const guests = Array.from({ length: 11 }, (_, index) =>
    makeGuest(`g${index + 1}`, `賓客${index + 1}`, index === 10 ? '自訂親友' : '共同朋友', 'main')
  );
  guests.push(makeGuest('unassigned', '未分配<&">', '自訂親友', null));

  const model = buildWeddingFloorLayoutModel({
    guests,
    tables: [
      makeTable('main', '主桌', guests.slice(0, 11).map(guest => guest.id)),
    ],
    unassignedGuestIds: ['unassigned'],
    partyRows: [{ id: 'p1', sourceName: '賓客1', headcount: 1, guestIds: ['g1'] }],
  });

  assert.equal(model.meta.guestCount, guests.length);
  assert.equal(model.mainTable.seats.length, 10);
  assert.equal(model.mainTable.occupancy, 10);
  assert.equal(model.meta.assignedGuestCount, 10);
  assert.equal(model.meta.unassignedGuestCount, 2);
  assert.ok(model.warnings.some(warning => warning.code === 'table-overflow'));
  assert.ok(model.warnings.some(warning => warning.code === 'unassigned-guests'));
  assert.ok(model.unassignedGuests.some(guest => guest.id === 'g11'));
  assert.ok(model.unassignedGuests.some(guest => guest.id === 'unassigned'));
}

function checkLegendAndFullIndex() {
  const state = {
    guests: [
      makeGuest('g1', '王小明', '新郎親友', 'main'),
      makeGuest('g2', '陳美麗', '長輩貴賓', 't2'),
      makeGuest('g3', '林同事', '同事', 't2'),
      makeGuest('g4', '共同好友', '共同朋友', 't2'),
      makeGuest('g5', '新娘好友', '新娘親友', 't2'),
    ],
    tables: [
      makeTable('main', '主桌', ['g1']),
      makeTable('t2', '2桌', ['g2', 'g3', 'g4', 'g5']),
    ],
    unassignedGuestIds: [],
    partyRows: [],
  };

  const model = buildWeddingFloorLayoutModel(state);
  const customLegend = model.legendItems.find(item => item.id === '長輩貴賓');
  assert.ok(customLegend, 'Custom guest category must appear in legend');
  assert.equal(customLegend.isBuiltin, false);
  assert.equal(model.categoryVisuals['長輩貴賓'].label, '長輩貴賓');

  const regularIndex = model.fullGuestIndex.find(section => section.tableLabel === '2桌');
  assert.equal(regularIndex.guests.length, 4);
  assert.equal(model.regularTablePages[0].tables[0].requiresFullIndex, true);
  assert.equal(model.regularTablePages[0].tables[0].displayNameplates.length, 0);
}

function assertPoint(point, label) {
  assert.equal(typeof point?.x, 'number', `${label} must have numeric x`);
  assert.equal(typeof point?.y, 'number', `${label} must have numeric y`);
}

function assertBox(box, label) {
  assertPoint(box, label);
  assert.equal(typeof box?.width, 'number', `${label} must have numeric width`);
  assert.equal(typeof box?.height, 'number', `${label} must have numeric height`);
  assert.ok(box.width > 0, `${label} width must be positive`);
  assert.ok(box.height > 0, `${label} height must be positive`);
}

function assertConnector(connector, label) {
  assert.equal(typeof connector?.fromX, 'number', `${label} connector must have fromX`);
  assert.equal(typeof connector?.fromY, 'number', `${label} connector must have fromY`);
  assert.equal(typeof connector?.toX, 'number', `${label} connector must have toX`);
  assert.equal(typeof connector?.toY, 'number', `${label} connector must have toY`);
  assert.ok(Array.isArray(connector.bendPoints), `${label} connector must expose bendPoints`);
}

function assertPlacement(placement, label) {
  assertPoint(placement?.seatPoint, `${label} seatPoint`);
  assertBox(placement?.labelBox, `${label} labelBox`);
  assertConnector(placement?.connector, label);
  assert.ok(
    ['top', 'top-right', 'right', 'bottom-right', 'bottom', 'bottom-left', 'left', 'top-left'].includes(placement.side),
    `${label} side must be a local seat sector`
  );
  assert.equal(typeof placement.slotIndex, 'number', `${label} slotIndex must be numeric`);
  assert.equal(placement.detailPlacement, undefined, `${label} placement must not nest detail placement`);
  assert.ok(placement.distance?.withinLimit, `${label} label must remain near its seat dot`);
  assert.ok(placement.connector.length <= placement.distance.connectorMax, `${label} connector must be a micro leader`);
}

function allTableLayouts(model) {
  return [
    model.mainTable,
    ...model.regularTablePages.flatMap(page => page.tables),
  ].filter(Boolean);
}

function checkSeatAnnotationContract() {
  const mainGuests = Array.from({ length: 10 }, (_, index) =>
    makeGuest(`m${index + 1}`, `主桌${index + 1}`, index % 2 === 0 ? '新郎親友' : '新娘親友', 'main')
  );
  const overviewGuests = [
    makeGuest('o1', '總覽上', '共同朋友', 't2'),
    makeGuest('o2', '總覽左', '同事', 't2'),
    makeGuest('o3', '總覽下', '其他', 't2'),
  ];
  const crowdedGuests = Array.from({ length: REGULAR_OVERVIEW_ANNOTATION_LIMIT }, (_, index) =>
    makeGuest(`d${index + 1}`, `滿桌長姓名${index + 1}`, '新郎親友', 't3')
  );
  const state = {
    guests: [...mainGuests, ...overviewGuests, ...crowdedGuests],
    tables: [
      makeTable('main', '主桌', mainGuests.map(guest => guest.id)),
      makeTable('t2', '2桌', ['o1', 'o2', null, null, null, 'o3']),
      makeTable('t3', '3桌', crowdedGuests.map(guest => guest.id)),
    ],
    unassignedGuestIds: [],
    partyRows: [],
  };

  const model = buildWeddingFloorLayoutModel(state);
  const annotationGuestIds = new Set();

  allTableLayouts(model).forEach(table => {
    const occupiedSeats = table.seats.filter(seat => seat.guest);
    const occupiedSeatIndexes = new Set(occupiedSeats.map(seat => seat.seatIndex));
    const annotationSeatIndexes = new Set(table.annotationRecords.map(annotation => annotation.seatIndex));

    assert.equal(
      table.annotationRecords.length,
      occupiedSeats.length,
      `${table.label} annotation count must equal occupied seat count`
    );
    assert.deepEqual(annotationSeatIndexes, occupiedSeatIndexes, `${table.label} must not annotate empty seats`);

    table.annotationRecords.forEach(annotation => {
      assert.ok(annotation.guestId, `${table.label} annotation must have guestId`);
      assert.ok(annotation.guestName, `${table.label} annotation must have guestName`);
      assert.equal(typeof annotation.seatIndex, 'number', `${table.label} annotation must have seatIndex`);
      assert.ok(
        annotation.overviewPlacement && !annotation.detailPlacement,
        `${table.label} annotation must have an overview seat-local placement only`
      );
      assertPlacement(annotation.overviewPlacement, `${table.label}/${annotation.guestName} overview`);
      annotationGuestIds.add(annotation.guestId);
    });
  });

  const validOccupiedGuestIds = new Set(
    allTableLayouts(model)
      .flatMap(table => table.seats)
      .filter(seat => seat.guest)
      .map(seat => seat.guest.id)
  );
  assert.deepEqual(annotationGuestIds, validOccupiedGuestIds, 'PDF-wide annotation guest IDs must match occupied guests');

  const mainSides = new Set(model.mainTable.annotationRecords.map(annotation => annotation.overviewPlacement.side));
  assert.ok(mainSides.has('top'), 'Main table annotations must support top slots');
  assert.ok(mainSides.has('left'), 'Main table annotations must support left slots');
  assert.ok(mainSides.has('right'), 'Main table annotations must support right slots');
  assert.ok(mainSides.has('bottom'), 'Main table annotations must support bottom slots');

  const overviewTable = model.regularTablePages[0].tables.find(table => table.id === 't2');
  assert.equal(overviewTable.needsDetailPage, false, 'A safe 3-guest regular table can stay annotated on overview');
  assert.equal(overviewTable.annotationRecords.length, overviewTable.occupancy);
  assert.ok(
    overviewTable.annotationRecords.every(annotation => annotation.overviewPlacement && !annotation.detailPlacement),
    'Overview-annotated regular table must give every occupied guest an overview placement'
  );
  assert.equal(
    overviewTable.annotationRecords.find(annotation => annotation.guestId === 'o3').seatIndex,
    5,
    'Annotation seatIndex must follow table.guestIds position instead of compacting by guest order'
  );

  const crowdedTable = model.regularTablePages[0].tables.find(table => table.id === 't3');
  assert.equal(crowdedTable.needsDetailPage, false, 'Full regular tables must stay annotated on overview');
  assert.ok(
    crowdedTable.annotationRecords.every(annotation => annotation.overviewPlacement && !annotation.detailPlacement),
    'Every occupied guest must keep an overview seat-local label'
  );
  assert.equal(model.detailTables.length, 0, 'Detail tables must not be generated for label overflow');
  assert.equal(model.detailPages.length, 0, 'Detail pages must not be generated for label overflow');
  assert.ok(model.pages.every(page => page.kind !== 'detail'), 'Layout pages must not include detail pages');
  assert.equal(model.needsDetailPage, false, 'Top-level detail flag must stay false');

  const directHelperResult = buildSeatAnnotations(crowdedTable, { tableKind: 'regular' });
  assert.equal(directHelperResult.needsDetailPage, false, 'Standalone helper must not fall back to detail pages');
  assert.ok(
    directHelperResult.annotationRecords.every(annotation => annotation.overviewPlacement && !annotation.detailPlacement),
    'Standalone helper must produce deterministic overview placements'
  );
}

checkLocalDateFormatting();
checkHtmlEscapeContract();
checkMainTablePriority();
checkNaturalSorting();
checkPagination();
checkGuestAccountingAndWarnings();
checkLegendAndFullIndex();
checkSeatAnnotationContract();

console.log('Wedding floor PDF layout model checks passed');
