import assert from 'node:assert/strict';
import { defaultTablePosition } from '../src/utils/constants.js';
import { buildFloorDesignLayoutModel } from '../src/utils/floorDesignLayoutModel.js';

const DISTANCE_RATIO_TOLERANCE = 0.01;

function makeGuest(id, name, category, tableId = null) {
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

function makeTable(id, label, guestIds = []) {
  return {
    id,
    label,
    seats: 10,
    guestIds,
  };
}

function distance(a, b, prefix) {
  return Math.hypot(
    a[`${prefix}Position`].centerX - b[`${prefix}Position`].centerX,
    a[`${prefix}Position`].centerY - b[`${prefix}Position`].centerY
  );
}

function assertAllPairScaleFactorsMatch(model, label) {
  const ratios = [];

  for (let i = 0; i < model.tables.length; i += 1) {
    for (let j = i + 1; j < model.tables.length; j += 1) {
      const sourceDistance = distance(model.tables[i], model.tables[j], 'source');
      const printDistance = distance(model.tables[i], model.tables[j], 'print');
      if (sourceDistance > 0) {
        ratios.push(printDistance / sourceDistance);
      }
    }
  }

  assert.ok(ratios.length > 0, `${label} must have table pairs to compare`);
  const expected = ratios[0];
  ratios.forEach((ratio, index) => {
    const relativeError = Math.abs(ratio - expected) / expected;
    assert.ok(
      relativeError <= DISTANCE_RATIO_TOLERANCE,
      `${label} pair ${index} changed relative table distance ratio by ${relativeError}`
    );
  });
}

function assertTablesInsideContentFrame(model) {
  const frame = model.contentFrame;

  function assertRectInsideFrame(rect, label) {
    assert.ok(
      rect.x >= frame.x - 0.001,
      `${label} left must stay inside content frame`
    );
    assert.ok(
      rect.y >= frame.y - 0.001,
      `${label} top must stay inside content frame`
    );
    assert.ok(
      rect.x + rect.width <= frame.x + frame.width + 0.001,
      `${label} right must stay inside content frame`
    );
    assert.ok(
      rect.y + rect.height <= frame.y + frame.height + 0.001,
      `${label} bottom must stay inside content frame`
    );
  }

  model.tables.forEach(table => {
    assertRectInsideFrame({
      x: table.printPosition.x,
      y: table.printPosition.y,
      width: table.printPosition.diameter,
      height: table.printPosition.diameter,
    }, `${table.label} print footprint`);

    table.seatDots.forEach(dot => {
      assertRectInsideFrame({
        x: dot.printPoint.x - dot.dotRadius,
        y: dot.printPoint.y - dot.dotRadius,
        width: dot.dotRadius * 2,
        height: dot.dotRadius * 2,
      }, `${table.label} seat ${dot.seatNumber}`);
    });

    table.seatLabels.forEach(label => {
      assertRectInsideFrame(label.labelBox, `${table.label} ${label.guestName} label`);
    });
  });
}

function checkStoredPositionsRemainSourceOfTruth() {
  const state = {
    guests: [
      makeGuest('g1', '主桌賓客', '新郎親友', 'main'),
      makeGuest('g2', '二桌賓客', '新娘親友', 't2'),
      makeGuest('g3', '十桌賓客', '共同朋友', 't10'),
      makeGuest('g4', '五桌賓客', '其他', 't5'),
    ],
    tables: [
      makeTable('t10', '10桌', ['g3']),
      makeTable('main', '主桌', ['g1']),
      makeTable('t5', '5桌', ['g4']),
      makeTable('t2', '2桌', ['g2']),
    ],
    tablePositions: {
      t10: { x: 1450, y: 300 },
      main: { x: 240, y: 1180 },
      t5: { x: 1060, y: 2020 },
      t2: { x: 760, y: 820 },
    },
    unassignedGuestIds: [],
    partyRows: [],
  };
  const model = buildFloorDesignLayoutModel(state, { autoSpacing: false });

  assert.deepEqual(
    model.tables.map(table => table.id),
    ['t10', 'main', 't5', 't2'],
    'Layout model must preserve input table order and must not sort into a fixed grid'
  );
  assert.equal(Object.hasOwn(model, 'regularTablePages'), false, 'Source-position model must not expose regularTablePages');
  assert.equal(model.sourceCanvas.width, 1850);
  assert.equal(model.sourceCanvas.height, 2400);

  model.tables.forEach(table => {
    assert.equal(table.positionSource, 'stored', `${table.label} must use stored tablePositions`);
    assert.equal(table.usedDefaultPosition, false, `${table.label} must not fallback when stored position exists`);
    assert.notDeepEqual(
      { x: table.sourcePosition.x, y: table.sourcePosition.y },
      defaultTablePosition(table.originalIndex),
      `${table.label} stored position must not be overwritten by defaultTablePosition`
    );
  });

  assertAllPairScaleFactorsMatch(model, 'stored position model');
  assertTablesInsideContentFrame(model);
  assert.match(model.layoutSignature, /floor-design-layout-v4/);
  assert.match(model.layoutSignature, /mode:source-position/);
  assert.match(model.layoutSignature, /t10@stored/);
}

function checkDefaultFallbackOnlyWhenMissing() {
  const state = {
    guests: [],
    tables: [
      makeTable('a', 'A桌'),
      makeTable('b', 'B桌'),
    ],
    tablePositions: {
      a: { x: 900, y: 1000 },
    },
    unassignedGuestIds: [],
    partyRows: [],
  };
  const model = buildFloorDesignLayoutModel(state);
  const storedTable = model.tables.find(table => table.id === 'a');
  const fallbackTable = model.tables.find(table => table.id === 'b');

  assert.equal(storedTable.positionSource, 'stored');
  assert.equal(fallbackTable.positionSource, 'default');
  assert.deepEqual(
    { x: fallbackTable.sourcePosition.x, y: fallbackTable.sourcePosition.y },
    defaultTablePosition(1),
    'Missing tablePositions entry must use defaultTablePosition(index)'
  );
}

function checkCanvasMappingKeepsFixedTableSize() {
  const state = {
    guests: [],
    tables: [
      makeTable('west', '西側桌'),
      makeTable('north', '北側桌'),
      makeTable('east', '東側桌'),
      makeTable('south', '南側桌'),
    ],
    tablePositions: {
      west: { x: 220, y: 1100 },
      north: { x: 820, y: 240 },
      east: { x: 1420, y: 1100 },
      south: { x: 820, y: 1920 },
    },
    unassignedGuestIds: [],
    partyRows: [],
  };
  const tight = buildFloorDesignLayoutModel(state, { minTableGapMm: 0 });
  const spacious = buildFloorDesignLayoutModel(state, { minTableGapMm: 16 });

  assert.equal(tight.breathingScale, 1);
  assert.equal(spacious.breathingScale, 1);
  assert.equal(tight.positionTransform.scaleX, tight.positionTransform.scaleY);
  assert.equal(spacious.positionTransform.scalePxToMm, tight.positionTransform.scalePxToMm);
  assert.deepEqual(
    spacious.tables.map(table => table.printPosition.radius),
    tight.tables.map(table => table.printPosition.radius),
    'Changing minimum spacing must not resize tables'
  );
  assert.deepEqual(
    spacious.tables.flatMap(table => table.seatDots.map(dot => dot.dotRadius)),
    tight.tables.flatMap(table => table.seatDots.map(dot => dot.dotRadius)),
    'Changing minimum spacing must not resize seat dots'
  );
  assertTablesInsideContentFrame(tight);
  assertTablesInsideContentFrame(spacious);
}

function checkSeatDotsAndGuestPayloadStayAttachedToTables() {
  const state = {
    guests: [
      makeGuest('g1', '王小明', '新郎親友', 'main'),
      makeGuest('g2', '陳美麗', '新娘親友', 'main'),
    ],
    tables: [
      makeTable('main', '主桌', ['g1', 'g2']),
    ],
    tablePositions: {
      main: { x: 1000, y: 1200 },
    },
    unassignedGuestIds: [],
    partyRows: [],
  };
  const model = buildFloorDesignLayoutModel(state);
  const table = model.tables[0];

  assert.equal(table.seats.length, 10);
  assert.equal(table.seatDots.length, 10);
  assert.equal(table.occupancy, 2);
  assert.equal(table.seatDots[0].guestId, 'g1');
  assert.equal(table.seatDots[1].guestId, 'g2');
  assert.equal(table.seatDots[2].isEmpty, true);
  assert.equal(table.seatLabels.length, 2, 'Only occupied seats should receive labels');
  assert.deepEqual(
    table.seatLabels.map(label => label.guestId),
    ['g1', 'g2'],
    'Seat labels must stay attached to occupied guests'
  );
  table.seatDots.forEach(dot => {
    assert.equal(typeof dot.printPoint.x, 'number');
    assert.equal(typeof dot.printPoint.y, 'number');
  });
  table.seatLabels.forEach(label => {
    assert.ok(label.distance.withinLimit, `${label.guestName} label must stay close to the seat dot`);
    assert.ok(label.distance.edgeDistance <= label.distance.edgeMax, `${label.guestName} edge distance too large`);
    assert.ok(label.distance.centerDistance <= label.distance.centerMax, `${label.guestName} center distance too large`);
    assert.ok(label.connector.length <= label.distance.connectorMax, `${label.guestName} connector too long`);
    assert.ok(
      ['top', 'top-right', 'right', 'bottom-right', 'bottom', 'bottom-left', 'left', 'top-left'].includes(label.localSector),
      `${label.guestName} must use a local label sector`
    );
  });
}

function checkCrowdedTablesStillUseNearbyLabels() {
  const guests = Array.from({ length: 10 }, (_, index) =>
    makeGuest(`g${index + 1}`, `長姓名賓客${index + 1}`, index % 2 === 0 ? '新郎親友' : '新娘親友', 't1')
  );
  const model = buildFloorDesignLayoutModel({
    guests,
    tables: [
      makeTable('t1', '2桌', guests.map(guest => guest.id)),
    ],
    tablePositions: {
      t1: { x: 700, y: 900 },
    },
    unassignedGuestIds: [],
    partyRows: [],
  });
  const table = model.tables[0];

  assert.equal(table.seatLabels.length, 10, 'A full table must still render one nearby label per occupied seat');
  assert.equal(Object.hasOwn(model, 'detailPages'), false, 'Source-position model must not use detail pages for labels');
  table.seatLabels.forEach(label => {
    assert.ok(label.distance.withinLimit, `${label.guestName} must not be pushed into a remote label lane`);
    assert.ok(label.textFit.lines.length <= 2, `${label.guestName} should fit into at most two lines`);
  });
}

function checkOneTableUsesRegularLabelsWhenExplicitMainExists() {
  const model = buildFloorDesignLayoutModel({
    guests: [
      makeGuest('main-guest', '主桌賓客', '新郎親友', 'main'),
      makeGuest('one-guest', '一桌賓客', '新娘親友', 't1'),
    ],
    tables: [
      makeTable('main', '主桌', ['main-guest']),
      makeTable('t1', '1桌', ['one-guest']),
    ],
    tablePositions: {
      main: { x: 620, y: 720 },
      t1: { x: 920, y: 980 },
    },
    unassignedGuestIds: [],
    partyRows: [],
  });
  const oneTable = model.tables.find(table => table.label === '1桌');
  const oneLabel = oneTable.seatLabels.find(label => label.guestId === 'one-guest');

  assert.ok(oneLabel, '1桌 fixture must render the occupied guest label');
  assert.ok(
    oneLabel.textFit.fontSizePt <= 7,
    '1桌 must use regular label sizing when an explicit 主桌 exists'
  );
}

function checkOneTableUsesRegularLabelsWithoutExplicitMain() {
  const model = buildFloorDesignLayoutModel({
    guests: [
      makeGuest('one-guest', '一桌賓客', '新娘親友', 't1'),
    ],
    tables: [
      makeTable('t1', '1桌', ['one-guest']),
    ],
    tablePositions: {
      t1: { x: 620, y: 720 },
    },
    unassignedGuestIds: [],
    partyRows: [],
  });
  const oneTable = model.tables[0];
  const oneLabel = oneTable.seatLabels.find(label => label.guestId === 'one-guest');

  assert.ok(oneLabel, '1桌 fixture must render the occupied guest label');
  assert.ok(
    oneLabel.textFit.fontSizePt <= 7,
    '1桌 must use regular label sizing even when there is no explicit 主桌'
  );
}

function checkAxisSpacingPreservesRowsAndColumns() {
  const state = {
    guests: [],
    tables: [
      makeTable('t11', '11桌'),
      makeTable('t12', '12桌'),
      makeTable('t13', '13桌'),
      makeTable('t14', '14桌'),
    ],
    tablePositions: {
      t11: { x: 670, y: 870 },
      t12: { x: 970, y: 870 },
      t13: { x: 670, y: 1170 },
      t14: { x: 970, y: 1170 },
    },
    unassignedGuestIds: [],
    partyRows: [],
  };
  const tight = buildFloorDesignLayoutModel(state, {
    minHorizontalTableGapMm: 0,
    minVerticalTableGapMm: 0,
  });
  const spacious = buildFloorDesignLayoutModel(state, {
    minHorizontalTableGapMm: 12,
    minVerticalTableGapMm: 12,
  });
  const tightById = Object.fromEntries(tight.tables.map(table => [table.id, table]));
  const byId = Object.fromEntries(spacious.tables.map(table => [table.id, table]));

  assert.equal(
    byId.t12.printPosition.centerX,
    byId.t14.printPosition.centerX,
    'Tables that share the same source X axis must stay on the same print X axis'
  );
  assert.equal(
    byId.t11.printPosition.centerY,
    byId.t12.printPosition.centerY,
    'Tables that share the same source Y axis must stay on the same print Y axis'
  );
  assert.equal(
    byId.t13.printPosition.centerY,
    byId.t14.printPosition.centerY,
    'Lower row tables that share the same source Y axis must stay aligned'
  );
  assert.ok(
    byId.t11.printPosition.centerX < tightById.t11.printPosition.centerX,
    'Increasing horizontal spacing must move left-side tables left instead of pinning them'
  );
  assert.ok(
    byId.t12.printPosition.centerX > tightById.t12.printPosition.centerX,
    'Increasing horizontal spacing must move right-side tables right'
  );
  assert.ok(
    byId.t11.printPosition.centerY < tightById.t11.printPosition.centerY,
    'Increasing vertical spacing must move upper-row tables upward'
  );
  assert.ok(
    byId.t13.printPosition.centerY > tightById.t13.printPosition.centerY,
    'Increasing vertical spacing must move lower-row tables downward'
  );
  assert.ok(
    spacious.axisSpacing.horizontal.movedNegativeCount > 0 &&
      spacious.axisSpacing.horizontal.movedPositiveCount > 0,
    'Horizontal spacing must expand both sides from the chart center'
  );
  assert.ok(
    spacious.axisSpacing.vertical.movedNegativeCount > 0 &&
      spacious.axisSpacing.vertical.movedPositiveCount > 0,
    'Vertical spacing must expand both sides from the chart center'
  );
  assert.deepEqual(
    spacious.tables.map(table => table.printPosition.radius),
    tight.tables.map(table => table.printPosition.radius),
    'Axis spacing must not resize tables'
  );
  assert.ok(spacious.spacingMetrics.minimumHorizontalTableGapMm >= 12);
  assert.ok(spacious.spacingMetrics.minimumVerticalTableGapMm >= 12);
}

function checkAutoSpacingPreservesCanvasTopology() {
  const guests = Array.from({ length: 16 }, (_, index) =>
    makeGuest(
      `spacing-${index + 1}`,
      `桌距賓客${index + 1}`,
      index % 2 === 0 ? '新郎親友' : '新娘親友',
      index < 8 ? 'a' : 'b'
    )
  );
  const state = {
    guests,
    tables: [
      makeTable('a', '2桌', guests.slice(0, 8).map(guest => guest.id)),
      makeTable('b', '3桌', guests.slice(8).map(guest => guest.id)),
    ],
    tablePositions: {
      a: { x: 700, y: 900 },
      b: { x: 900, y: 900 },
    },
    unassignedGuestIds: [],
    partyRows: [],
  };
  const tight = buildFloorDesignLayoutModel(state, {
    minHorizontalTableGapMm: 0,
    minVerticalTableGapMm: 0,
  });
  const spacious = buildFloorDesignLayoutModel(state, {
    minHorizontalTableGapMm: 16,
    minVerticalTableGapMm: 0,
  });
  const disabled = buildFloorDesignLayoutModel(state, {
    autoSpacing: false,
    minHorizontalTableGapMm: 12,
    minVerticalTableGapMm: 12,
  });

  assert.deepEqual(
    spacious.tables.map(table => table.id),
    ['a', 'b'],
    'Auto spacing must preserve the interactive canvas table order'
  );
  assert.deepEqual(
    spacious.tables.map(table => table.sourcePosition),
    tight.tables.map(table => table.sourcePosition),
    'Changing export spacing must not modify interactive canvas source positions'
  );
  assert.ok(
    spacious.spacingMetrics.minimumHorizontalTableGapMm >= 16,
    'Resolved export must satisfy the requested horizontal table gap when A4 has enough room'
  );
  assert.equal(disabled.breathingScale, 1, 'Disabling auto spacing must preserve the requested base scale');
  assert.equal(disabled.autoSpacing, false);
  assert.equal(spacious.positionTransform.scalePxToMm, tight.positionTransform.scalePxToMm);
  assert.deepEqual(
    spacious.tables.map(table => table.printPosition.radius),
    tight.tables.map(table => table.printPosition.radius),
    'Auto spacing must move table centers without changing table sizes'
  );
  assert.notDeepEqual(
    spacious.tables.map(table => table.printPosition),
    tight.tables.map(table => table.printPosition),
    'A larger minimum table gap must visibly move table centers'
  );
  assertTablesInsideContentFrame(spacious);
}

function checkEmptyStateDoesNotCrash() {
  const model = buildFloorDesignLayoutModel({
    guests: [],
    tables: [],
    tablePositions: {},
    unassignedGuestIds: [],
    partyRows: [],
  });

  assert.deepEqual(model.tables, []);
  assert.equal(model.positionTransform.type, 'uniform-scale-translate');
  assert.equal(model.breathingScale, 1);
}

checkStoredPositionsRemainSourceOfTruth();
checkDefaultFallbackOnlyWhenMissing();
checkCanvasMappingKeepsFixedTableSize();
checkSeatDotsAndGuestPayloadStayAttachedToTables();
checkCrowdedTablesStillUseNearbyLabels();
checkOneTableUsesRegularLabelsWhenExplicitMainExists();
checkOneTableUsesRegularLabelsWithoutExplicitMain();
checkAxisSpacingPreservesRowsAndColumns();
checkAutoSpacingPreservesCanvasTopology();
checkEmptyStateDoesNotCrash();

console.log('Floor design source-position layout checks passed');
