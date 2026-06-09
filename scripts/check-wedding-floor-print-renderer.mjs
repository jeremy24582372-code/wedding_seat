import assert from 'node:assert/strict';
import { buildWeddingFloorPrintHTML } from '../src/utils/floorPrintHTMLBuilder.js';
import { buildWeddingFloorLayoutModel } from '../src/utils/weddingFloorPrintLayout.js';

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
    guest('g5', '自訂貴賓<&">', '長輩貴賓', 't3'),
    guest('g6', '黃雅婷', '新娘親友', 't3'),
    guest('g7', '鄭工程師', '同事', 't3'),
    guest('g8', '謝嘉宇', '新郎親友', 't3'),
    guest('g9', '未分配測試', '其他', null),
  ],
  tables: [
    table('main', '主桌', ['g1', 'g2']),
    table('t2', '2桌', ['g3', 'g4']),
    table('t3', '3桌', ['g5', 'g6', 'g7', 'g8']),
    table('t10', '10桌', []),
  ],
  tablePositions: {},
  unassignedGuestIds: ['g9'],
  partyRows: [
    { id: 'p1', sourceName: '王小明', category: '新郎親友', tableLabel: '主桌', headcount: 1, guestIds: ['g1'] },
  ],
  guestGroups: [],
  seatingRules: {},
  lockedAssignments: {},
};

function countMatches(source, pattern) {
  return source.match(pattern)?.length ?? 0;
}

const model = buildWeddingFloorLayoutModel(sampleState, {
  date: new Date(2026, 5, 8),
});
const html = buildWeddingFloorPrintHTML(sampleState, {
  date: new Date(2026, 5, 8),
});
const canonicalAnnotationCount = [
  ...(model.mainTable ? [model.mainTable] : []),
  ...model.regularTablePages.flatMap(page => page.tables),
].reduce((sum, tableLayout) => sum + tableLayout.annotationRecords.length, 0);
const overviewAnnotationCount = [
  ...(model.mainTable ? [model.mainTable] : []),
  ...model.regularTablePages.flatMap(page => page.tables),
].reduce((sum, tableLayout) => (
  sum + tableLayout.annotationRecords.filter(annotation => annotation.overviewPlacement).length
), 0);
const detailAnnotationCount = model.detailTables.reduce((sum, tableLayout) => (
  sum + tableLayout.annotationRecords.filter(annotation => annotation.detailPlacement).length
), 0);
const expectedRenderedAnnotationCount = overviewAnnotationCount + detailAnnotationCount;
const expectedSeatDotCount = model.pages.reduce((sum, page) => (
  sum + page.tableInstances.reduce((pageSum, instance) => pageSum + instance.seats.length, 0)
), 0);

assert.match(html, /Jeremy &amp; Yuri/);
assert.match(html, /婚 禮 桌 次 位 置 圖/);
assert.match(html, /WEDDING SEATING CHART/);
assert.match(html, /主桌 \/ 舞台/);
assert.match(html, /wfp-annotation-table--main/);
assert.match(html, /wfp-regular-grid/);
assert.match(html, /wfp-page--detail/);
assert.match(html, /桌次詳圖/);
assert.match(html, /座位圖例/);
assert.match(html, /完整桌次名單/);
assert.match(html, /未分配賓客/);
assert.match(html, /長輩貴賓/);
assert.match(html, /自訂貴賓&lt;&amp;&quot;&gt;/);
assert.match(html, />陳美麗特別長姓名</);
assert.match(html, />自訂貴賓&lt;&amp;&quot;&gt;</);
assert.match(html, /@page \{ size: A4 portrait; margin: 0; \}/);
assert.doesNotMatch(html, /viewBox="0 0 1850 2400"/);
assert.doesNotMatch(html, /wfp-regular-names/);
assert.doesNotMatch(html, /wfp-regular-name/);
assert.doesNotMatch(html, /\.\.\./);
assert.equal(canonicalAnnotationCount, 8, 'Sample occupied guest count should drive annotation count');
assert.equal(countMatches(html, /class="wfp-seat-label\b/g), expectedRenderedAnnotationCount, 'Rendered seat-label count must equal overview + detail annotation placements');
assert.equal(countMatches(html, /class="wfp-seat-connector\b/g), expectedRenderedAnnotationCount, 'Rendered connector count must equal rendered seat-label count');
assert.equal(countMatches(html, /class="wfp-seat-dot\b/g), expectedSeatDotCount, 'Rendered seat-dot count must equal rendered table instance seats');
assert.equal(countMatches(html, /class="wfp-page wfp-page--detail"/g), model.detailPages.length, 'Rendered detail page count must match layout model');
assert.equal(countMatches(html, /data-guest-id="g9"/g), 0, 'Unassigned guests must not render seat labels or connectors');

console.log('Wedding floor print renderer checks passed');
