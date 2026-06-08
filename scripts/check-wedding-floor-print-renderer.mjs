import assert from 'node:assert/strict';
import { buildWeddingFloorPrintHTML } from '../src/utils/floorPrintHTMLBuilder.js';

function guest(id, name, category, tableId = null) {
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

function table(id, label, guestIds = []) {
  return {
    id,
    label,
    seats: 10,
    guestIds,
  };
}

const sampleState = {
  guests: [
    guest('g1', '王小明', '新郎親友', 'main'),
    guest('g2', '陳美麗特別長姓名', '新娘親友', 'main'),
    guest('g3', '共同好友', '共同朋友', 't2'),
    guest('g4', '林同事', '同事', 't2'),
    guest('g5', '自訂貴賓<&">', '長輩貴賓', null),
  ],
  tables: [
    table('main', '主桌', ['g1', 'g2']),
    table('t2', '2桌', ['g3', 'g4']),
    table('t10', '10桌', []),
  ],
  tablePositions: {},
  unassignedGuestIds: ['g5'],
  partyRows: [
    { id: 'p1', sourceName: '王小明', category: '新郎親友', tableLabel: '主桌', headcount: 1, guestIds: ['g1'] },
  ],
  guestGroups: [],
  seatingRules: {},
  lockedAssignments: {},
};

const html = buildWeddingFloorPrintHTML(sampleState, {
  date: new Date(2026, 5, 8),
});

assert.match(html, /Jeremy &amp; Yuri/);
assert.match(html, /婚 禮 桌 次 位 置 圖/);
assert.match(html, /WEDDING SEATING CHART/);
assert.match(html, /主桌 \/ 舞台/);
assert.match(html, /wfp-main-table/);
assert.match(html, /wfp-regular-grid/);
assert.match(html, /座位圖例/);
assert.match(html, /完整桌次名單/);
assert.match(html, /未分配賓客/);
assert.match(html, /長輩貴賓/);
assert.match(html, /自訂貴賓&lt;&amp;&quot;&gt;/);
assert.match(html, /@page \{ size: A4 portrait; margin: 0; \}/);
assert.doesNotMatch(html, /viewBox="0 0 1850 2400"/);

console.log('Wedding floor print renderer checks passed');
