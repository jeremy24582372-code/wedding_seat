import assert from 'node:assert/strict';
import { buildFloorDesignSvgExport } from '../src/utils/floorDesignImageExport.js';
import {
  FLOOR_DESIGN_PROMPT_REQUIRED_PHRASES,
  buildFloorDesignPromptExport,
} from '../src/utils/floorDesignPromptBuilder.js';

const DISTANCE_RATIO_TOLERANCE = 0.01;
const SVG_ALLOWED_NAMED_ENTITIES = new Set(['amp', 'lt', 'gt', 'quot', 'apos']);

function guest(id, name, category, tableId = null) {
  return {
    id,
    name,
    category,
    diet: '',
    source: 'manual',
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

const exportState = {
  guests: [
    guest('g-main-1', '主桌貴賓', '新郎親友', 'main'),
    guest('g-main-2', '新人家人', '新娘親友', 'main'),
    guest('g-1-1', '一桌賓客', '新郎親友', 't1'),
    guest('g-2-1', '共同好友', '共同朋友', 't10'),
    guest('g-2-2', '林同事', '同事', 't10'),
    guest('g-3-1', '自訂貴賓<&">', '長輩貴賓', 't2'),
    guest('g-unassigned', '未分配測試', '其他', null),
  ],
  tables: [
    table('t10', '10桌', ['g-2-1', 'g-2-2']),
    table('main', '主桌', ['g-main-1', 'g-main-2']),
    table('t1', '1桌', ['g-1-1']),
    table('t2', '2桌', ['g-3-1']),
  ],
  tablePositions: {
    t10: { x: 1420, y: 360 },
    main: { x: 280, y: 1200 },
    t1: { x: 760, y: 1100 },
    t2: { x: 1040, y: 1960 },
  },
  unassignedGuestIds: ['g-unassigned'],
  partyRows: [
    {
      id: 'p-main',
      sourceName: '主桌貴賓',
      category: '新郎親友',
      tableLabel: '主桌',
      headcount: 1,
      guestIds: ['g-main-1'],
      source: 'manual',
    },
  ],
  guestGroups: [],
  seatingRules: {},
  lockedAssignments: {},
  lastSaved: '2026-06-10T08:00:00.000Z',
};

function countMatches(source, pattern) {
  return source.match(pattern)?.length ?? 0;
}

function sorted(values) {
  return [...values].sort((a, b) => String(a).localeCompare(String(b)));
}

function assertNoUnknownSvgNamedEntities(svg) {
  const names = [...svg.matchAll(/&([A-Za-z][A-Za-z0-9.-]*);/g)].map(match => match[1]);
  const unknownNames = names.filter(name => !SVG_ALLOWED_NAMED_ENTITIES.has(name));

  assert.deepEqual(
    unknownNames,
    [],
    `Standalone SVG must not contain undefined XML named entities: ${unknownNames.join(', ')}`
  );
}

function distance(a, b, prefix) {
  return Math.hypot(
    a[`${prefix}Position`].centerX - b[`${prefix}Position`].centerX,
    a[`${prefix}Position`].centerY - b[`${prefix}Position`].centerY
  );
}

function assertAllPairScaleFactorsMatch(model) {
  const ratios = [];

  for (let i = 0; i < model.tables.length; i += 1) {
    for (let j = i + 1; j < model.tables.length; j += 1) {
      const sourceDistance = distance(model.tables[i], model.tables[j], 'source');
      const printDistance = distance(model.tables[i], model.tables[j], 'print');
      if (sourceDistance > 0) ratios.push(printDistance / sourceDistance);
    }
  }

  assert.ok(ratios.length > 0, 'Export fixture must have table pairs to compare');
  const expected = ratios[0];
  ratios.forEach((ratio, index) => {
    const relativeError = Math.abs(ratio - expected) / expected;
    assert.ok(
      relativeError <= DISTANCE_RATIO_TOLERANCE,
      `Export pair ${index} changed relative table distance ratio by ${relativeError}`
    );
  });
}

function checkSvgExportContract() {
  const artifact = buildFloorDesignSvgExport(exportState, {
    date: new Date(2026, 5, 10),
  });
  const { svg, layoutModel } = artifact;
  const occupiedGuestIds = layoutModel.tables
    .flatMap(tableLayout => tableLayout.seats)
    .filter(seat => !seat.isEmpty)
    .map(seat => seat.guestId);
  const labelGuestIds = layoutModel.tables
    .flatMap(tableLayout => tableLayout.seatLabels)
    .map(label => label.guestId);
  const expectedConnectorCount = layoutModel.tables.reduce(
    (sum, tableLayout) => sum + tableLayout.seatLabels.filter(label => label.connector.length > 0.01).length,
    0
  );

  assert.equal(artifact.fileNames.png, '婚禮桌次設計圖_2026-06-10.png');
  assert.equal(artifact.fileNames.svg, '婚禮桌次設計圖_2026-06-10.svg');
  assert.equal(artifact.layoutSignature, layoutModel.layoutSignature);
  assert.deepEqual(
    layoutModel.tables.map(tableLayout => tableLayout.id),
    ['t10', 'main', 't1', 't2'],
    'SVG export must preserve source table order and must not sort into a fixed grid'
  );
  assert.ok(
    layoutModel.tables.every(tableLayout => tableLayout.positionSource === 'stored'),
    'Stored tablePositions must be the SVG export source of truth'
  );
  assert.equal(layoutModel.contentFrame.y, 78, 'Design content frame must start below the stage ribbon');
  assert.equal(
    layoutModel.contentFrame.y + layoutModel.contentFrame.height,
    266,
    'Design content frame must extend closer to the compact legend'
  );
  assertAllPairScaleFactorsMatch(layoutModel);

  assert.match(svg, /class="wfp-design-svg"/);
  assert.match(svg, /viewBox="0 0 210 297"/);
  assert.ok(
    svg.includes(`data-layout-signature="${layoutModel.layoutSignature}"`),
    'SVG export must embed the source-position layout signature'
  );
  assert.match(svg, /Jeremy &amp; Yuri/);
  assert.match(svg, /&#9829;/);
  assertNoUnknownSvgNamedEntities(svg);
  assert.match(svg, /aria-label="舞台"/, 'Stage ribbon accessibility label must use 舞台 only');
  assert.match(svg, />舞台</, 'Stage ribbon visible text must use 舞台 only');
  assert.doesNotMatch(svg, /主桌\s*\/\s*舞台/, 'Stage ribbon must not include legacy stage copy');
  assert.match(svg, /font-size: 19\.5px;/, 'Couple heading must stay below the previous oversized export');
  assert.match(svg, /font-size: 9\.4px;/, 'Chinese title must stay below the previous oversized export');
  assert.match(svg, /font-size: 5\.6px;/, 'English subtitle must stay below the previous oversized export');
  assert.match(svg, /\.wfp-design-stage-text\s*\{[\s\S]*?font-size: 6\.2px;/, 'Stage label must stay compact');
  assert.match(svg, /font-size: 3\.2px;/, 'Regular table labels must stay compact');
  assert.match(svg, /\.wfp-design-legend-title\s*\{[\s\S]*?font-size: 5px;/, 'Legend title must stay compact');
  assert.match(svg, /\.wfp-design-legend-text\s*\{[\s\S]*?font-size: 3\.8px;/, 'Legend item text must stay compact');
  assert.match(svg, /class="wfp-design-legend-list" transform="translate\(49 283\)"/, 'Legend list must stay below the expanded content frame');
  assert.doesNotMatch(svg, /--wfp-label-font-size:[^;"']+pt/, 'Seat labels must not emit pt units inside the SVG viewBox');
  assert.match(svg, /--wfp-label-font-size:2\.\d+px/, 'Seat labels must render at compact SVG user-unit size');
  assert.match(svg, /font-size="2\.\d+"/, 'Seat label text must include a compact presentation fallback');
  assert.match(svg, /座位圖例/);
  assert.equal(
    countMatches(svg, /class="wfp-design-table wfp-design-table--main"/g),
    1,
    'Only the explicit main table should use main table styling'
  );
  assert.match(
    svg,
    /class="wfp-design-table wfp-design-table--regular"[\s\S]*?data-table-id="t1"[\s\S]*?data-table-label="1桌"/,
    '1桌 must use regular styling when an explicit 主桌 exists'
  );
  assert.match(svg, /長輩貴賓/);
  assert.match(svg, /自訂貴賓/);
  assert.match(svg, /&lt;&amp;&quot;&gt;/);
  assert.doesNotMatch(svg, /自訂貴賓<&">/);
  assert.doesNotMatch(svg, /viewBox="0 0 1850 2400"/);
  assert.doesNotMatch(svg, /wfp-detail-reference/);
  assert.doesNotMatch(svg, /完整座位標註見第/);
  assert.doesNotMatch(svg, /wfp-page--detail/);

  assert.equal(
    countMatches(svg, /class="wfp-seat-label\b/g),
    occupiedGuestIds.length,
    'SVG export must render one name label per occupied guest'
  );
  assert.equal(
    countMatches(svg, /class="wfp-seat-connector\b/g),
    expectedConnectorCount,
    'SVG export must render only nearby micro-leaders'
  );
  assert.equal(
    countMatches(svg, /class="wfp-seat-dot\b/g),
    layoutModel.tables.length * 10,
    'SVG export must render all empty and occupied seat dots'
  );
  assert.deepEqual(
    sorted(labelGuestIds),
    sorted(occupiedGuestIds),
    'SVG canonical labels must match occupied guest IDs'
  );
  layoutModel.tables.flatMap(tableLayout => tableLayout.seatLabels).forEach(label => {
    assert.ok(label.distance.withinLimit, `${label.guestName} label must stay near its seat dot`);
    assert.ok(label.connector.length <= label.distance.connectorMax, `${label.guestName} connector must not become long`);
  });

  return artifact;
}

function checkPromptContract(svgArtifact) {
  const promptArtifact = buildFloorDesignPromptExport(exportState, {
    date: new Date(2026, 5, 10),
  });
  const prompt = promptArtifact.prompt;

  assert.equal(promptArtifact.fileName, '婚禮桌次AI生成提示詞_2026-06-10.txt');
  assert.equal(
    promptArtifact.layoutSignature,
    svgArtifact.layoutSignature,
    'Prompt and SVG export must be built from the same layout model signature'
  );
  FLOOR_DESIGN_PROMPT_REQUIRED_PHRASES.forEach(phrase => {
    assert.ok(prompt.includes(phrase), `Prompt must include required phrase: ${phrase}`);
  });
  assert.match(prompt, /10桌/);
  assert.match(prompt, /主桌/);
  assert.match(prompt, /2桌/);
  assert.match(prompt, /自訂貴賓<&">/);
  assert.match(prompt, /Unassigned guests must remain in the exported guest list only/);
  assert.doesNotMatch(prompt, /完整座位標註見第/);
}

const svgArtifact = checkSvgExportContract();
checkPromptContract(svgArtifact);

console.log('Floor design image and prompt export checks passed');
