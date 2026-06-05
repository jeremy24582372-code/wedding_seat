import assert from 'node:assert/strict';
import { buildCsvExportRows } from '../src/utils/csvExportBuilder.js';
import { buildFloorPrintHTML } from '../src/utils/floorPrintHTMLBuilder.js';
import { buildJsonBackup } from '../src/utils/jsonExportBuilder.js';
import { buildPrintHTML } from '../src/utils/printHTMLBuilder.js';
import { openPrintDocument } from '../src/utils/printWindow.js';

const sampleState = {
  guests: [
    {
      id: 'g1',
      name: '王小明',
      category: '新郎親友',
      diet: '',
      source: 'import',
      tableId: 't1',
      partyId: 'p1',
      partyRole: 'primary',
    },
    {
      id: 'g2',
      name: '王小明 同行1',
      category: '新郎親友',
      diet: '素食',
      source: 'import',
      tableId: 't1',
      partyId: 'p1',
      partyRole: 'companion',
    },
    {
      id: 'g3',
      name: '陳美麗',
      category: '新娘親友',
      diet: '',
      source: 'manual',
      tableId: null,
      partyId: null,
      partyRole: 'primary',
    },
  ],
  tables: [
    {
      id: 't1',
      label: '2桌',
      seats: 10,
      guestIds: ['g1', 'g2'],
    },
  ],
  tablePositions: {
    t1: { x: 100, y: 220 },
  },
  unassignedGuestIds: ['g3'],
  partyRows: [
    {
      id: 'p1',
      sourceName: '王小明',
      category: '新郎親友',
      tableLabel: '2桌',
      headcount: 2,
      guestIds: ['g1', 'g2'],
      source: 'import',
    },
  ],
  guestGroups: [
    {
      id: 'grp1',
      name: '王家同行',
      guestIds: ['g1', 'g2'],
      sourcePartyId: 'p1',
      preference: 'same-table',
      locked: true,
      notes: '',
    },
  ],
  seatingRules: {
    fillStrategy: 'balanced',
    respectExistingAssignments: true,
  },
  lockedAssignments: {
    g1: true,
  },
  lastSaved: '2026-06-04T12:00:00.000Z',
};

const emptyState = {
  guests: [],
  tables: [],
  tablePositions: {},
  unassignedGuestIds: [],
  partyRows: [],
  guestGroups: [],
  seatingRules: {},
  lockedAssignments: {},
  lastSaved: null,
};

function checkCsvContract() {
  const rows = buildCsvExportRows(sampleState);
  assert.equal(rows.length, sampleState.guests.length, 'CSV row count must equal guest count');

  const primary = rows.find(row => row.姓名 === '王小明');
  assert.equal(primary.桌次, '2桌');
  assert.equal(primary.來源姓名, '王小明');
  assert.equal(primary.人數, 2);
  assert.equal(primary.同行角色, '主要');
  assert.equal(primary.群組名稱, '王家同行');
  assert.equal(primary.群組偏好, '同桌優先');
  assert.equal(primary.鎖定狀態, '已鎖定');

  const unassigned = rows.find(row => row.姓名 === '陳美麗');
  assert.equal(unassigned.桌次, '未分配');
  assert.equal(unassigned.群組名稱, '');
  assert.equal(unassigned.鎖定狀態, '未鎖定');

  assert.deepEqual(buildCsvExportRows(emptyState), [], 'Empty state CSV should not crash');
}

function checkJsonContract() {
  const backup = buildJsonBackup(sampleState);
  assert.equal(backup.guests.length, 3);
  assert.equal(backup.tables.length, 1);
  assert.equal(backup.partyRows.length, 1);
  assert.equal(backup.guestGroups.length, 1);
  assert.equal(backup.lockedAssignments.g1, true);
  assert.equal(backup.seatingRules.fillStrategy, 'balanced');
}

function checkPrintHtmlContract() {
  const html = buildPrintHTML(sampleState);
  assert.match(html, /實際人數：3 位/);
  assert.match(html, /共 1 桌/);
  assert.match(html, /王小明/);
  assert.match(html, /王小明 同行1/);
  assert.match(html, /陳美麗/);
  assert.match(html, /群組：王家同行/);
  assert.match(html, /已鎖定/);
  assert.match(html, /尚未分配座位（1 位）/);

  const emptyHtml = buildPrintHTML(emptyState);
  assert.match(emptyHtml, /實際人數：0 位/);
}

function checkFloorPrintHtmlContract() {
  const html = buildFloorPrintHTML(sampleState);
  assert.match(html, /婚禮桌次位置圖/);
  assert.match(html, /實際人數：3 位/);
  assert.match(html, /共 1 桌/);
  assert.match(html, /2桌/);
  assert.match(html, /viewBox="0 0 1850 2400"/);

  const emptyHtml = buildFloorPrintHTML(emptyState);
  assert.match(emptyHtml, /實際人數：0 位/);
}

function checkPrintWindowOneShotGuard() {
  const originalWindow = globalThis.window;
  const originalAlert = globalThis.alert;
  const originalConsoleError = console.error;

  const timers = [];
  const handlers = {};
  let printCount = 0;
  let alertCount = 0;
  const written = [];

  globalThis.alert = () => {
    alertCount += 1;
  };
  console.error = () => {};
  globalThis.window = {
    open: () => ({
      focus: () => {},
      print: () => {
        printCount += 1;
      },
      addEventListener: (type, handler) => {
        handlers[type] = handler;
      },
      document: {
        write: content => written.push(content),
        close: () => {},
      },
    }),
    setTimeout: callback => {
      timers.push(callback);
      return timers.length;
    },
  };

  try {
    openPrintDocument({
      html: '<!doctype html><title>test</title>',
      popupMessage: 'popup blocked',
      failureMessage: 'print failed',
      logLabel: 'test print',
    });

    assert.equal(written.length, 1, 'print document should be written once');
    assert.equal(typeof handlers.load, 'function', 'load handler should be registered');
    handlers.load();
    timers.forEach(callback => callback());
    assert.equal(printCount, 1, 'load and fallback timers must still print once');
    assert.equal(alertCount, 0, 'successful print setup should not alert');
  } finally {
    globalThis.window = originalWindow;
    globalThis.alert = originalAlert;
    console.error = originalConsoleError;
  }
}

checkCsvContract();
checkJsonContract();
checkPrintHtmlContract();
checkFloorPrintHtmlContract();
checkPrintWindowOneShotGuard();

console.log('Phase 4 export contract checks passed');
