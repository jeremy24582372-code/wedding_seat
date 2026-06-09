import assert from 'node:assert/strict';
import { createAutoSeatPreview } from '../src/utils/autoSeatPlanner.js';
import { buildGuestDashboardModel } from '../src/utils/guestDashboard.js';
import {
  appendGuestToGroup,
  ensurePartyGuestGroups,
  findGuestGroupConflicts,
} from '../src/utils/guestGroups.js';
import { normalizeSheetGuestRows } from '../src/utils/googleSheetsRows.js';
import { emptySeats } from '../src/utils/seatingHelpers.js';

function seatArray(...ids) {
  return Array.from({ length: 10 }, (_, index) => ids[index] ?? null);
}

function makeGuest(id, patch = {}) {
  return {
    id,
    name: id,
    category: '新郎親友',
    diet: '',
    source: 'import',
    tableId: null,
    partyId: null,
    partyRole: 'primary',
    ...patch,
  };
}

function makeState(patch = {}) {
  return {
    guests: [],
    tables: [],
    unassignedGuestIds: [],
    tablePositions: {},
    partyRows: [],
    guestGroups: [],
    seatingRules: {},
    lockedAssignments: {},
    lastSaved: null,
    ...patch,
  };
}

{
  const state = makeState({
    guests: [
      makeGuest('main', { name: '主桌長輩', tableId: 't1' }),
      makeGuest('guest', { name: '待排賓客' }),
    ],
    tables: [
      { id: 't1', label: '1桌', seats: 10, guestIds: seatArray('main') },
      { id: 't2', label: '2桌', seats: 10, guestIds: emptySeats() },
    ],
    unassignedGuestIds: ['guest'],
  });

  const preview = createAutoSeatPreview(state, {
    respectExistingAssignments: false,
    keepGroupsTogether: true,
    preferFillIncompleteTables: true,
    fillStrategy: 'balanced',
    maxPerCategoryPerTable: {},
  });

  const mainTable = preview.plan.nextState.tables.find(table => table.id === 't1');
  const secondTable = preview.plan.nextState.tables.find(table => table.id === 't2');
  assert.equal(mainTable.guestIds[0], 'main', 'main-table guest must remain seated when respectExistingAssignments=false');
  assert.equal(secondTable.guestIds.includes('guest'), true, 'auto-seat should place ordinary guests outside 1桌');
  assert.equal(preview.moves.some(move => move.guestId === 'main'), false, 'main-table guest must not appear in moves');
  assert.equal(
    preview.blocked.some(item => item.id === 'main-table-protection'),
    true,
    'preview should explain main-table protection when existing assignments are not respected'
  );
}

{
  const state = makeState({
    guests: [
      makeGuest('a', { name: '已安排成員', tableId: 't2' }),
      makeGuest('b', { name: '需分開成員' }),
    ],
    tables: [
      { id: 't1', label: '主桌', seats: 10, guestIds: emptySeats() },
      { id: 't2', label: '2桌', seats: 10, guestIds: seatArray('a') },
      { id: 't3', label: '3桌', seats: 10, guestIds: emptySeats() },
    ],
    unassignedGuestIds: ['b'],
    guestGroups: [{ id: 'separate', name: '需分開', guestIds: ['a', 'b'], preference: 'separate', locked: false, notes: '' }],
  });

  const preview = createAutoSeatPreview(state, {
    respectExistingAssignments: true,
    keepGroupsTogether: true,
    preferFillIncompleteTables: true,
    fillStrategy: 'balanced',
    maxPerCategoryPerTable: {},
  });

  const move = preview.moves.find(item => item.guestId === 'b');
  assert.equal(move?.toTableId, 't3', 'separate group member should avoid the table that already contains the grouped guest');
}

{
  const groups = [
    { id: 'g1', name: '同桌群組', guestIds: ['guest'], preference: 'same-table', locked: false, notes: '' },
    { id: 'g2', name: '分開群組', guestIds: ['guest'], preference: 'separate', locked: false, notes: '' },
  ];
  const guests = [makeGuest('guest', { name: '重複賓客' })];
  const conflicts = findGuestGroupConflicts(groups, guests);
  assert.equal(conflicts.length, 1, 'same guest in multiple groups should be detected');
  assert.deepEqual(conflicts[0].groupNames, ['同桌群組', '分開群組']);

  const preview = createAutoSeatPreview(makeState({
    guests,
    tables: [
      { id: 't1', label: '1桌', seats: 10, guestIds: emptySeats() },
      { id: 't2', label: '2桌', seats: 10, guestIds: emptySeats() },
    ],
    unassignedGuestIds: ['guest'],
    guestGroups: groups,
  }));

  assert.equal(preview.moves.some(move => move.guestId === 'guest'), false);
  assert.equal(preview.plan.nextState.unassignedGuestIds.includes('guest'), true);
  assert.equal(preview.blocked.some(item => item.id === 'group-conflict:guest'), true);
}

{
  const groups = [
    {
      id: 'manual',
      name: '既有群組',
      guestIds: ['a'],
      sourcePartyId: null,
      preference: 'same-table',
      locked: true,
      notes: '',
    },
  ];
  const appended = appendGuestToGroup(groups, 'manual', 'b', ['a', 'b', 'c'], { a: true, b: true });
  assert.deepEqual(appended[0].guestIds, ['a', 'b'], 'existing group should support adding a new member');
  assert.equal(appended[0].locked, true, 'locked group should stay locked when the added member is locked too');

  const duplicate = appendGuestToGroup(appended, 'manual', 'b', ['a', 'b', 'c'], { a: true, b: true });
  assert.deepEqual(duplicate[0].guestIds, ['a', 'b'], 'adding an existing member should not duplicate guestIds');
}

{
  const existingGroups = [
    {
      id: 'party-group',
      name: '林家同行',
      guestIds: ['p1', 'p2', 'extra'],
      sourcePartyId: 'party-1',
      preference: 'same-table',
      locked: false,
      notes: '',
    },
  ];
  const partyRows = [
    {
      id: 'party-1',
      sourceName: '林家',
      category: '新郎親友',
      tableLabel: '',
      headcount: 2,
      guestIds: ['p1', 'p2'],
      source: 'import',
    },
  ];
  const reconciled = ensurePartyGuestGroups(existingGroups, partyRows, ['p1', 'p2', 'extra'], {});
  assert.deepEqual(
    reconciled[0].guestIds,
    ['p1', 'p2', 'extra'],
    'auto party groups should preserve manually added members during import reconciliation'
  );
}

{
  const rows = normalizeSheetGuestRows([
    { 姓名: '缺欄' },
    { 姓名: '非法', 人數: 'abc' },
    { 姓名: '小於一', 人數: '0' },
    { 姓名: '非整數', 人數: '2.5' },
    { 姓名: '太多', 人數: '12' },
  ]);

  assert.deepEqual(
    rows.map(row => row._sourceHeadcountStatus),
    ['missing', 'invalid', 'below-min', 'non-integer', 'truncated']
  );
  assert.deepEqual(rows.map(row => row.headcount), [1, 1, 1, 2, 10]);

  const issueCounts = rows.reduce((acc, row) => {
    acc[row._sourceHeadcountStatus] = (acc[row._sourceHeadcountStatus] ?? 0) + 1;
    return acc;
  }, {});
  const model = buildGuestDashboardModel(makeState(), {
    headcountDiagnostics: rows.map(row => ({
      name: row.name,
      rawValue: row._sourceHeadcountRaw,
      normalizedValue: row.headcount,
      status: row._sourceHeadcountStatus,
      message: row._sourceHeadcountMessage,
    })),
    headcountIssueCounts: issueCounts,
  });

  assert.equal(model.quality.items[0].label, '匯入人數需確認');
  assert.match(model.quality.items[0].detail, /缺少 1 筆/);
  assert.match(model.quality.items[0].detail, /超過 10 已截斷 1 筆/);
}

console.log('Phase 3 auto-seat and group semantics smoke passed.');
