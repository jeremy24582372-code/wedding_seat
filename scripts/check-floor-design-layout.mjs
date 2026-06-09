import assert from 'node:assert/strict';
import { defaultTablePosition } from '../src/utils/constants.js';
import { buildFloorDesignLayoutModel } from '../src/utils/floorDesignLayoutModel.js';

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
    assert.ok(
      Math.abs(ratio - expected) < 1e-9,
      `${label} pair ${index} changed relative table distance ratio`
    );
  });
}

function assertTablesInsideContentFrame(model) {
  const frame = model.contentFrame;

  model.tables.forEach(table => {
    assert.ok(
      table.printPosition.x >= frame.x - 0.001,
      `${table.label} print left must stay inside content frame`
    );
    assert.ok(
      table.printPosition.y >= frame.y - 0.001,
      `${table.label} print top must stay inside content frame`
    );
    assert.ok(
      table.printPosition.x + table.printPosition.diameter <= frame.x + frame.width + 0.001,
      `${table.label} print right must stay inside content frame`
    );
    assert.ok(
      table.printPosition.y + table.printPosition.diameter <= frame.y + frame.height + 0.001,
      `${table.label} print bottom must stay inside content frame`
    );
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
  const model = buildFloorDesignLayoutModel(state);

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
  assert.match(model.layoutSignature, /floor-design-layout-v1/);
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

function checkBreathingKeepsRelativeSpacing() {
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
  const model = buildFloorDesignLayoutModel(state, { breathingScale: 1.18 });

  assert.equal(model.breathingScale, 1.18);
  assert.equal(model.positionTransform.scaleX, model.positionTransform.scaleY);
  assertAllPairScaleFactorsMatch(model, 'breathing model');
  assertTablesInsideContentFrame(model);
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
  table.seatDots.forEach(dot => {
    assert.equal(typeof dot.printPoint.x, 'number');
    assert.equal(typeof dot.printPoint.y, 'number');
  });
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
checkBreathingKeepsRelativeSpacing();
checkSeatDotsAndGuestPayloadStayAttachedToTables();
checkEmptyStateDoesNotCrash();

console.log('Floor design source-position layout checks passed');
