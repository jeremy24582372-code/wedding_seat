import assert from 'node:assert/strict';
import { applyGuestImport } from '../src/utils/importGuests.js';
import { buildGoogleSheetsPayload } from '../src/utils/googleSheetsPayload.js';
import {
  createNextTableLabel,
  normalizeSeatingStateFromFirebase,
  removeTableFromState,
} from '../src/utils/seatingIntegrity.js';

const seatArray = (...ids) => Array.from({ length: 10 }, (_, index) => ids[index] ?? null);

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

assert.equal(
  createNextTableLabel([
    { label: '1桌' },
    { label: '2桌' },
    { label: '4桌' },
    { label: '主桌' },
  ]),
  '3桌',
  'addTable should reuse the first unused N桌 label'
);

{
  const prev = {
    guests: [makeGuest('g1', { tableId: 't1' }), makeGuest('g2', { tableId: 't1' }), makeGuest('g3', { tableId: 't2' })],
    tables: [
      { id: 't1', label: '1桌', seats: 10, guestIds: seatArray('g1', 'g2', 'g2', 'missing') },
      { id: 't2', label: '2桌', seats: 10, guestIds: seatArray('g3') },
    ],
    unassignedGuestIds: ['g2'],
    tablePositions: { t1: { x: 10, y: 20 }, t2: { x: 30, y: 40 } },
    lockedAssignments: { g1: true, g2: true, g3: true, missing: true },
    guestGroups: [{ id: 'grp', name: '測試群組', guestIds: ['g1', 'g3', 'missing'], preference: 'same-table', locked: true, notes: '' }],
    partyRows: [],
    seatingRules: {},
    lastSaved: '2026-06-04T00:00:00.000Z',
  };

  const next = removeTableFromState(prev, 't1');
  assert.deepEqual(next.tables.map(table => table.id), ['t2']);
  assert.deepEqual(next.unassignedGuestIds.sort(), ['g1', 'g2']);
  assert.equal(next.guests.find(guest => guest.id === 'g1').tableId, null);
  assert.equal(next.guests.find(guest => guest.id === 'g2').tableId, null);
  assert.equal(next.guests.find(guest => guest.id === 'g3').tableId, 't2');
  assert.deepEqual(next.lockedAssignments, { g3: true });
  assert.deepEqual(next.tablePositions, { t2: { x: 30, y: 40 } });
  assert.deepEqual(next.guestGroups[0].guestIds, ['g1', 'g3']);
}

{
  const malformed = {
    guests: Object.fromEntries(Array.from({ length: 12 }, (_, index) => [index, makeGuest(`g${index + 1}`)])),
    tables: {
      0: {
        id: 't1',
        label: '1桌',
        seats: 20,
        guestIds: {
          0: 'g1',
          1: 'g2',
          2: 'g3',
          3: 'g4',
          4: 'g5',
          5: 'g6',
          6: 'g7',
          7: 'g8',
          8: 'g9',
          9: 'g10',
          10: 'g11',
          11: 'missing',
        },
      },
      1: {
        id: 't2',
        label: '2桌',
        seats: 10,
        guestIds: { 0: 'g1', 1: 'g12' },
      },
    },
    unassignedGuestIds: ['g11', 'missing', 'g11'],
    tablePositions: { t1: { x: 10, y: 20 }, stale: { x: 1, y: 1 } },
    lockedAssignments: { g1: true, g11: true, missing: true },
    partyRows: { 0: { id: 'p1', sourceName: 'g11', category: '新郎親友', headcount: 2, guestIds: ['g11', 'missing'], source: 'import' } },
    guestGroups: { 0: { id: 'grp', name: '測試', guestIds: ['g1', 'missing'], preference: 'same-table', locked: true, notes: '' } },
    seatingRules: {},
    lastSaved: '2026-06-04T00:00:00.000Z',
  };

  const normalized = normalizeSeatingStateFromFirebase(malformed);
  assert.equal(normalized.tables[0].guestIds.filter(Boolean).length, 10);
  assert.equal(normalized.tables[0].seats, 10);
  assert.deepEqual(normalized.tables[1].guestIds.filter(Boolean), ['g12']);
  assert.equal(normalized.guests.find(guest => guest.id === 'g1').tableId, 't1');
  assert.equal(normalized.guests.find(guest => guest.id === 'g11').tableId, null);
  assert.deepEqual(normalized.unassignedGuestIds, ['g11']);
  assert.deepEqual(normalized.tablePositions, { t1: { x: 10, y: 20 } });
  assert.deepEqual(normalized.lockedAssignments, { g1: true });
  assert.deepEqual(normalized.partyRows[0].guestIds, ['g11']);
  assert.equal(normalized.partyRows[0].headcount, 1);
  assert.deepEqual(normalized.guestGroups[0].guestIds, ['g1']);
}

{
  const { nextState, result } = applyGuestImport(
    {
      guests: [],
      tables: [{ id: 't1', label: '1桌', seats: 10, guestIds: seatArray() }],
      unassignedGuestIds: [],
      tablePositions: {},
      partyRows: [],
      guestGroups: [],
      lockedAssignments: {},
      seatingRules: {},
      lastSaved: null,
    },
    [
      { name: '王小明', category: '新郎親友', headcount: 1 },
      { name: '王小明', category: '新郎親友', headcount: 1 },
      { name: '林小美', category: '新娘親友', tableLabel: '1桌', headcount: 2 },
    ]
  );

  assert.equal(result.added, 3);
  assert.equal(result.skipped, 1);
  assert.equal(result.sourceDuplicateRows, 1);
  assert.equal(result.updated, 0);
  assert.equal(nextState.guests.length, 3);

  const repeated = applyGuestImport(nextState, [
    { name: '王小明', category: '共同朋友', headcount: 1 },
    { name: '林小美', category: '新娘親友', tableLabel: '1桌', headcount: 1 },
  ]);
  assert.equal(repeated.result.updated, 2);
  assert.equal(repeated.result.sourceDuplicateRows, 0);
  assert.equal(repeated.nextState.guests.length, 2);
}

{
  const payload = buildGoogleSheetsPayload({
    guests: [
      makeGuest('g1', { name: '來源主賓', partyId: 'p1', tableId: 't1' }),
      makeGuest('g2', { name: '來源主賓 同行1', partyId: 'p1', partyRole: 'companion', tableId: 't1' }),
    ],
    tables: [{ id: 't1', label: '1桌', seats: 10, guestIds: seatArray('g1', 'g2') }],
    partyRows: [{ id: 'p1', sourceName: '來源主賓', category: '新郎親友', tableLabel: '1桌', headcount: 2, guestIds: ['g1', 'g2'], source: 'import' }],
  });

  assert.deepEqual(Object.keys(payload[0]).sort(), ['category', 'diet', 'name', 'tableLabel'].sort());
  assert.equal(Object.hasOwn(payload[0], 'headcount'), false);
  assert.equal(Object.hasOwn(payload[0], '人數'), false);
  assert.equal(Object.hasOwn(payload[0], 'source'), false);
}

console.log('Phase 1 data integrity smoke passed.');
