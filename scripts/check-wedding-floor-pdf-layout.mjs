import assert from 'node:assert/strict';
import {
  FIRST_PAGE_REGULAR_TABLE_CAPACITY,
  CONTINUATION_PAGE_TABLE_CAPACITY,
  buildWeddingFloorLayoutModel,
  parseWeddingTableNumber,
} from '../src/utils/weddingFloorPrintLayout.js';
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

checkLocalDateFormatting();
checkHtmlEscapeContract();
checkMainTablePriority();
checkNaturalSorting();
checkPagination();
checkGuestAccountingAndWarnings();
checkLegendAndFullIndex();

console.log('Wedding floor PDF layout model checks passed');
