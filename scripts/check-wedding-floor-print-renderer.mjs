import assert from 'node:assert/strict';
import { buildFloorDesignLayoutModel } from '../src/utils/floorDesignLayoutModel.js';
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
    guest('g1a', '一桌賓客', '新郎親友', 't1'),
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
    table('t1', '1桌', ['g1a']),
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

const floorDesignModel = buildFloorDesignLayoutModel(sampleState);
const html = buildWeddingFloorPrintHTML(sampleState, {
  date: new Date(2026, 5, 8),
});
const expectedRenderedAnnotationCount = floorDesignModel.tables.reduce(
  (sum, tableLayout) => sum + tableLayout.seatLabels.length,
  0
);
const expectedRenderedConnectorCount = floorDesignModel.tables.reduce(
  (sum, tableLayout) => (
    sum + tableLayout.seatLabels.filter(label => label.connector.length > 0.01).length
  ),
  0
);
const expectedSeatDotCount = floorDesignModel.tables.reduce(
  (sum, tableLayout) => sum + tableLayout.seatDots.length,
  0
);

assert.match(html, /Jeremy &amp; Yuri/);
assert.match(html, /婚 禮 桌 次 位 置 圖/);
assert.match(html, /WEDDING SEATING CHART/);
assert.match(html, /aria-label="舞台"/, 'Stage ribbon accessibility label must use 舞台 only');
assert.match(html, />舞台</, 'Stage ribbon visible text must use 舞台 only');
assert.doesNotMatch(html, /主桌\s*\/\s*舞台/, 'Stage ribbon must not include legacy stage copy');
assert.match(html, /class="wfp-design-svg"/);
assert.match(html, /font-size: 19\.5px;/, 'Couple heading must stay below the previous oversized export');
assert.match(html, /font-size: 9\.4px;/, 'Chinese title must stay below the previous oversized export');
assert.match(html, /font-size: 5\.6px;/, 'English subtitle must stay below the previous oversized export');
assert.match(html, /\.wfp-design-stage-text\s*\{[\s\S]*?font-size: 6\.2px;/, 'Stage label must stay compact');
assert.match(html, /font-size: 3\.2px;/, 'Regular table labels must stay compact');
assert.match(html, /\.wfp-design-legend-title\s*\{[\s\S]*?font-size: 5px;/, 'Legend title must stay compact');
assert.match(html, /\.wfp-design-legend-text\s*\{[\s\S]*?font-size: 3\.8px;/, 'Legend item text must stay compact');
assert.match(html, /class="wfp-design-legend-list" transform="translate\(49 283\)"/, 'Legend list must stay below the expanded content frame');
assert.doesNotMatch(html, /--wfp-label-font-size:[^;"']+pt/, 'Seat labels must not emit pt units inside the SVG viewBox');
assert.match(html, /--wfp-label-font-size:2\.\d+px/, 'Seat labels must render at compact SVG user-unit size');
assert.match(html, /font-size="2\.\d+"/, 'Seat label text must include a compact presentation fallback');
assert.match(html, /class="wfp-design-stage"/);
assert.match(html, /class="wfp-design-table wfp-design-table--main"/);
assert.equal(
  countMatches(html, /class="wfp-design-table wfp-design-table--main"/g),
  1,
  'Only the explicit main table should use main table styling'
);
assert.match(
  html,
  /class="wfp-design-table wfp-design-table--regular"[\s\S]*?data-table-id="t1"[\s\S]*?data-table-label="1桌"/,
  '1桌 must use regular styling when an explicit 主桌 exists'
);
assert.match(html, /class="wfp-design-main-medallion"/);
assert.ok(
  html.includes(`data-layout-signature="${floorDesignModel.layoutSignature}"`),
  'Rendered SVG must expose the source-position layout signature'
);
assert.match(html, /座位圖例/);
assert.match(html, /完整桌次名單/);
assert.match(html, /未分配賓客/);
assert.match(html, /長輩貴賓/);
assert.match(html, /自訂貴賓&lt;&amp;&quot;&gt;/);
assert.match(html, />陳美麗特別長姓名</);
assert.match(html, />自訂貴賓&lt;&amp;&quot;&gt;</);
assert.match(html, /@page \{ size: A4 portrait; margin: 0; \}/);
assert.doesNotMatch(html, /viewBox="0 0 1850 2400"/);
assert.doesNotMatch(html, /class="wfp-regular-grid"/);
assert.doesNotMatch(html, /class="wfp-regular-names"/);
assert.doesNotMatch(html, /class="wfp-regular-name"/);
assert.doesNotMatch(html, /wfp-page--detail/);
assert.doesNotMatch(html, /wfp-detail-reference/);
assert.doesNotMatch(html, /完整座位標註見第/);
assert.doesNotMatch(html, /\.\.\./);
assert.equal(countMatches(html, /class="wfp-seat-label\b/g), expectedRenderedAnnotationCount, 'Rendered seat-label count must equal source-position seat labels');
assert.equal(countMatches(html, /class="wfp-seat-connector\b/g), expectedRenderedConnectorCount, 'Rendered connector count must equal nearby micro-leader count');
assert.equal(countMatches(html, /class="wfp-seat-dot\b/g), expectedSeatDotCount, 'Rendered seat-dot count must equal rendered table instance seats');
assert.equal(countMatches(html, /class="wfp-page wfp-page--detail"/g), 0, 'Renderer must not output detail pages');
assert.equal(countMatches(html, /data-guest-id="g9"/g), 0, 'Unassigned guests must not render seat labels or connectors');

console.log('Wedding floor print renderer checks passed');
