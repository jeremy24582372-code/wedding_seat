import assert from 'node:assert/strict';
import { buildCsvExportRows } from '../src/utils/csvExportBuilder.js';
import { buildFloorDesignSvgExport } from '../src/utils/floorDesignImageExport.js';
import { buildFloorDesignPromptExport } from '../src/utils/floorDesignPromptBuilder.js';
import { buildFloorDesignLayoutModel } from '../src/utils/floorDesignLayoutModel.js';
import {
  buildFloorPrintHTML,
  buildLegacyFloorPrintHTML,
  buildWeddingFloorPrintHTML,
} from '../src/utils/floorPrintHTMLBuilder.js';
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
      tableId: 'main',
      partyId: 'p1',
      partyRole: 'primary',
    },
    {
      id: 'g2',
      name: '王小明 同行1',
      category: '新郎親友',
      diet: '素食',
      source: 'import',
      tableId: 'main',
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
    {
      id: 'g4',
      name: '自訂貴賓<&">',
      category: '長輩貴賓',
      diet: '',
      source: 'manual',
      tableId: null,
      partyId: null,
      partyRole: 'primary',
    },
  ],
  tables: [
    {
      id: 'main',
      label: '主桌',
      seats: 10,
      guestIds: ['g1', 'g2'],
    },
    {
      id: 't2',
      label: '2桌',
      seats: 10,
      guestIds: [],
    },
  ],
  tablePositions: {
    main: { x: 100, y: 220 },
    t2: { x: 420, y: 220 },
  },
  unassignedGuestIds: ['g3', 'g4'],
  partyRows: [
    {
      id: 'p1',
      sourceName: '王小明',
      category: '新郎親友',
      tableLabel: '主桌',
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

const floorSeatLabelState = {
  guests: [
    {
      id: 'f1',
      name: '主桌貴賓',
      category: '新郎親友',
      diet: '',
      source: 'import',
      tableId: 'main',
      partyId: 'fp1',
      partyRole: 'primary',
    },
    {
      id: 'f2',
      name: '主桌同行',
      category: '新娘親友',
      diet: '',
      source: 'import',
      tableId: 'main',
      partyId: 'fp1',
      partyRole: 'companion',
    },
    {
      id: 'f3',
      name: '總覽左',
      category: '共同朋友',
      diet: '',
      source: 'manual',
      tableId: 't2',
      partyId: null,
      partyRole: 'primary',
    },
    {
      id: 'f4',
      name: '總覽右',
      category: '同事',
      diet: '',
      source: 'manual',
      tableId: 't2',
      partyId: null,
      partyRole: 'primary',
    },
    {
      id: 'f5',
      name: '總覽下',
      category: '其他',
      diet: '',
      source: 'manual',
      tableId: 't2',
      partyId: null,
      partyRole: 'primary',
    },
    {
      id: 'f6',
      name: '自訂貴賓<&">',
      category: '長輩貴賓',
      diet: '',
      source: 'manual',
      tableId: 't3',
      partyId: null,
      partyRole: 'primary',
    },
    {
      id: 'f7',
      name: '詳圖二',
      category: '新郎親友',
      diet: '',
      source: 'manual',
      tableId: 't3',
      partyId: null,
      partyRole: 'primary',
    },
    {
      id: 'f8',
      name: '詳圖三',
      category: '新娘親友',
      diet: '',
      source: 'manual',
      tableId: 't3',
      partyId: null,
      partyRole: 'primary',
    },
    {
      id: 'f9',
      name: '詳圖四',
      category: '共同朋友',
      diet: '',
      source: 'manual',
      tableId: 't3',
      partyId: null,
      partyRole: 'primary',
    },
    {
      id: 'f10',
      name: '未分配測試',
      category: '其他',
      diet: '',
      source: 'manual',
      tableId: null,
      partyId: null,
      partyRole: 'primary',
    },
  ],
  tables: [
    {
      id: 'main',
      label: '主桌',
      seats: 10,
      guestIds: ['f1', 'f2'],
    },
    {
      id: 't2',
      label: '2桌',
      seats: 10,
      guestIds: ['f3', null, 'f4', null, null, 'f5'],
    },
    {
      id: 't3',
      label: '3桌',
      seats: 10,
      guestIds: ['f6', 'f7', 'f8', 'f9'],
    },
    {
      id: 't4',
      label: '4桌',
      seats: 10,
      guestIds: [],
    },
  ],
  tablePositions: {},
  unassignedGuestIds: ['f10'],
  partyRows: [
    {
      id: 'fp1',
      sourceName: '主桌貴賓',
      category: '新郎親友',
      tableLabel: '主桌',
      headcount: 2,
      guestIds: ['f1', 'f2'],
      source: 'import',
    },
  ],
  guestGroups: [],
  seatingRules: {},
  lockedAssignments: {},
  lastSaved: '2026-06-08T12:00:00.000Z',
};

function countMatches(source, pattern) {
  return source.match(pattern)?.length ?? 0;
}

function assertNoUnknownSvgNamedEntities(svg) {
  const allowedNames = new Set(['amp', 'lt', 'gt', 'quot', 'apos']);
  const names = [...svg.matchAll(/&([A-Za-z][A-Za-z0-9.-]*);/g)].map(match => match[1]);
  const unknownNames = names.filter(name => !allowedNames.has(name));

  assert.deepEqual(
    unknownNames,
    [],
    `Standalone SVG must not contain undefined XML named entities: ${unknownNames.join(', ')}`
  );
}

function sorted(values) {
  return [...values].sort((a, b) => String(a).localeCompare(String(b)));
}

function extractRenderedGuestIds(html, className) {
  const guestIds = [];
  const pattern = new RegExp(`class="${className}\\b[^"]*"[^>]*data-guest-id="([^"]+)"`, 'g');
  let match = pattern.exec(html);

  while (match) {
    guestIds.push(match[1]);
    match = pattern.exec(html);
  }

  return guestIds;
}

function checkCsvContract() {
  const rows = buildCsvExportRows(sampleState);
  assert.equal(rows.length, sampleState.guests.length, 'CSV row count must equal guest count');

  const primary = rows.find(row => row.姓名 === '王小明');
  assert.equal(primary.桌次, '主桌');
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
  assert.equal(backup.guests.length, 4);
  assert.equal(backup.tables.length, 2);
  assert.equal(backup.partyRows.length, 1);
  assert.equal(backup.guestGroups.length, 1);
  assert.equal(backup.lockedAssignments.g1, true);
  assert.equal(backup.seatingRules.fillStrategy, 'balanced');
}

function checkPrintHtmlContract() {
  const html = buildPrintHTML(sampleState);
  assert.match(html, /實際人數：4 位/);
  assert.match(html, /共 2 桌/);
  assert.match(html, /王小明/);
  assert.match(html, /王小明 同行1/);
  assert.match(html, /陳美麗/);
  assert.match(html, /自訂貴賓&lt;&amp;&quot;&gt;/);
  assert.match(html, /群組：王家同行/);
  assert.match(html, /已鎖定/);
  assert.match(html, /尚未分配座位（2 位）/);

  const emptyHtml = buildPrintHTML(emptyState);
  assert.match(emptyHtml, /實際人數：0 位/);
}

function checkFloorPrintHtmlContract() {
  const options = { date: new Date(2026, 5, 8) };
  const html = buildFloorPrintHTML(floorSeatLabelState, options);
  const directWeddingHtml = buildWeddingFloorPrintHTML(floorSeatLabelState, options);
  const floorDesignModel = buildFloorDesignLayoutModel(floorSeatLabelState);
  const occupiedGuestIds = floorDesignModel.tables
    .flatMap(table => table.seats)
    .filter(seat => !seat.isEmpty)
    .map(seat => seat.guestId);
  const annotationGuestIds = floorDesignModel.tables
    .flatMap(table => table.seatLabels)
    .map(label => label.guestId);
  const labelGuestIds = extractRenderedGuestIds(html, 'wfp-seat-label');
  const connectorGuestIds = extractRenderedGuestIds(html, 'wfp-seat-connector');
  const renderedLabelCount = countMatches(html, /class="wfp-seat-label\b/g);
  const renderedConnectorCount = countMatches(html, /class="wfp-seat-connector\b/g);
  const expectedConnectorCount = floorDesignModel.tables.reduce(
    (sum, table) => sum + table.seatLabels.filter(label => label.connector.length > 0.01).length,
    0
  );
  const seatDotCount = countMatches(html, /class="wfp-seat-dot\b/g);
  assert.equal(html, directWeddingHtml, 'Official floor export must use the wedding print renderer');

  assert.match(html, /Jeremy &amp; Yuri/);
  assert.match(html, /婚 禮 桌 次 位 置 圖/);
  assert.match(html, /WEDDING SEATING CHART/);
  assert.match(html, /實際人數：10 位/);
  assert.match(html, /共 4 桌/);
  assert.match(html, /來源筆數：1 筆/);
  assert.match(html, /主桌 \/ 舞台/);
  assert.match(html, /class="wfp-design-svg"/);
  assert.match(html, /class="wfp-design-stage"/);
  assert.match(html, /class="wfp-design-table wfp-design-table--main"/);
  assert.ok(
    html.includes(`data-layout-signature="${floorDesignModel.layoutSignature}"`),
    'Official floor export must embed the source-position layout signature'
  );
  assert.match(html, /座位圖例/);
  assert.match(html, /完整桌次名單/);
  assert.match(html, /未分配賓客/);
  assert.match(html, /未分配測試/);
  assert.match(html, /長輩貴賓/);
  assert.match(html, /自訂貴賓&lt;&amp;&quot;&gt;/);
  assert.doesNotMatch(html, /自訂貴賓<&">/);
  assert.doesNotMatch(html, /viewBox="0 0 1850 2400"/);
  assert.doesNotMatch(html, /class="wfp-regular-grid"/);
  assert.doesNotMatch(html, /class="wfp-regular-names"/);
  assert.doesNotMatch(html, /class="wfp-regular-name"/);
  assert.doesNotMatch(html, /wfp-page--detail/);
  assert.doesNotMatch(html, /wfp-detail-reference/);
  assert.doesNotMatch(html, /完整座位標註見第/);

  assert.equal(
    annotationGuestIds.length,
    occupiedGuestIds.length,
    'Occupied guest count must equal canonical annotation count'
  );
  assert.deepEqual(
    sorted(annotationGuestIds),
    sorted(occupiedGuestIds),
    'Canonical annotation guest IDs must match occupied guests'
  );
  assert.equal(
    renderedLabelCount,
    annotationGuestIds.length,
    'Total rendered name label count must equal annotation count'
  );
  assert.equal(
    labelGuestIds.length,
    annotationGuestIds.length,
    'Rendered name label data-guest-id count must equal annotation count'
  );
  assert.deepEqual(
    sorted(labelGuestIds),
    sorted(annotationGuestIds),
    'Rendered name label guest IDs must match annotations'
  );
  assert.equal(
    renderedConnectorCount,
    expectedConnectorCount,
    'Total rendered connector count must equal nearby micro-leader count'
  );
  assert.equal(
    connectorGuestIds.length,
    expectedConnectorCount,
    'Rendered connector data-guest-id count must equal nearby micro-leader count'
  );
  assert.deepEqual(
    sorted(connectorGuestIds),
    sorted(floorDesignModel.tables.flatMap(table => table.seatLabels)
      .filter(label => label.connector.length > 0.01)
      .map(label => label.guestId)),
    'Rendered connector guest IDs must match nearby micro-leaders'
  );
  assert.ok(
    seatDotCount > annotationGuestIds.length,
    'Empty seats must render only seat dots, not name labels'
  );
  assert.equal(
    countMatches(html, /data-guest-id="f10"/g),
    0,
    'Unassigned guests must be listed without seat labels or connectors'
  );

  const legacyHtml = buildLegacyFloorPrintHTML(floorSeatLabelState);
  assert.match(legacyHtml, /viewBox="0 0 1850 2400"/, 'Legacy coordinate renderer must remain explicitly named');
  assert.match(html, /2桌/);

  const emptyHtml = buildFloorPrintHTML(emptyState);
  assert.match(emptyHtml, /實際人數：0 位/);
  assert.match(emptyHtml, /Jeremy &amp; Yuri/);
}

function checkFloorDesignExportContract() {
  const svgArtifact = buildFloorDesignSvgExport(floorSeatLabelState, {
    date: new Date(2026, 5, 8),
  });
  const promptArtifact = buildFloorDesignPromptExport(floorSeatLabelState, {
    date: new Date(2026, 5, 8),
  });
  const model = svgArtifact.layoutModel;

  assert.equal(svgArtifact.fileNames.png, '婚禮桌次設計圖_2026-06-08.png');
  assert.equal(svgArtifact.fileNames.svg, '婚禮桌次設計圖_2026-06-08.svg');
  assert.equal(promptArtifact.fileName, '婚禮桌次AI生成提示詞_2026-06-08.txt');
  assert.equal(
    promptArtifact.layoutSignature,
    svgArtifact.layoutSignature,
    'AI prompt must use the same source-position layout signature as image export'
  );
  assert.ok(
    svgArtifact.svg.includes(`data-layout-signature="${model.layoutSignature}"`),
    'Design SVG export must embed the source-position layout signature'
  );
  assert.match(svgArtifact.svg, /class="wfp-design-svg"/);
  assert.match(svgArtifact.svg, /viewBox="0 0 210 297"/);
  assert.match(svgArtifact.svg, /&#9829;/);
  assertNoUnknownSvgNamedEntities(svgArtifact.svg);
  assert.doesNotMatch(svgArtifact.svg, /viewBox="0 0 1850 2400"/);
  assert.doesNotMatch(svgArtifact.svg, /wfp-detail-reference/);
  assert.doesNotMatch(svgArtifact.svg, /完整座位標註見第/);
  assert.match(promptArtifact.prompt, /preserve exact table layout and relative positions from the attached reference image/);
  assert.match(promptArtifact.prompt, /keep all names close to their corresponding seat dots/);
  assert.match(promptArtifact.prompt, /do not invent, remove, or rename guests/);
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
checkFloorDesignExportContract();
checkPrintWindowOneShotGuard();

console.log('Phase 4 export contract checks passed');
