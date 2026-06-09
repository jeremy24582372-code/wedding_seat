import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  MAX_SEATS,
  defaultTablePosition,
  getCategoryVisual,
  normalizeCategory,
} from './constants.js';

export const FLOOR_DESIGN_PAGE = {
  unit: 'mm',
  width: 210,
  height: 297,
  orientation: 'portrait',
};

export const FLOOR_DESIGN_CONTENT_FRAME = {
  x: 14,
  y: 62,
  width: 182,
  height: 188,
};

export const FLOOR_DESIGN_SOURCE_TABLE_GEOMETRY = {
  // Mirrors the existing canvas/table coordinate contract used by the legacy export.
  centerOffset: { x: 130, y: 130 },
  footprintRadius: 150,
  seatOrbitRadius: 108,
  seatRadius: 26,
};

const SIGNATURE_VERSION = 'floor-design-layout-v1';
const MIN_FIT_EXTENT = 1;

function round(value, precision = 3) {
  return Number(value.toFixed(precision));
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function normalizePositiveNumber(value, fallback) {
  return isFiniteNumber(value) && value > 0 ? value : fallback;
}

function normalizeFrame(frame = FLOOR_DESIGN_CONTENT_FRAME) {
  return {
    x: isFiniteNumber(frame.x) ? frame.x : FLOOR_DESIGN_CONTENT_FRAME.x,
    y: isFiniteNumber(frame.y) ? frame.y : FLOOR_DESIGN_CONTENT_FRAME.y,
    width: normalizePositiveNumber(frame.width, FLOOR_DESIGN_CONTENT_FRAME.width),
    height: normalizePositiveNumber(frame.height, FLOOR_DESIGN_CONTENT_FRAME.height),
  };
}

function normalizePoint(value) {
  if (!value || !isFiniteNumber(value.x) || !isFiniteNumber(value.y)) {
    return null;
  }

  return {
    x: value.x,
    y: value.y,
  };
}

function resolveTablePosition(table, originalIndex, tablePositions) {
  const storedPosition = table?.id ? normalizePoint(tablePositions?.[table.id]) : null;
  if (storedPosition) {
    return {
      topLeft: storedPosition,
      positionSource: 'stored',
      usedDefaultPosition: false,
    };
  }

  return {
    topLeft: defaultTablePosition(originalIndex),
    positionSource: 'default',
    usedDefaultPosition: true,
  };
}

function resolveTableEntries(state, tableGeometry) {
  const tables = Array.isArray(state?.tables) ? state.tables : [];
  const guests = Array.isArray(state?.guests) ? state.guests : [];
  const tablePositions = state?.tablePositions ?? {};
  const guestById = new Map(guests.map(guest => [guest.id, guest]));

  return tables.map((table, originalIndex) => {
    const resolved = resolveTablePosition(table, originalIndex, tablePositions);
    const center = {
      x: resolved.topLeft.x + tableGeometry.centerOffset.x,
      y: resolved.topLeft.y + tableGeometry.centerOffset.y,
    };
    const rawGuestIds = Array.isArray(table?.guestIds) ? table.guestIds : [];
    const seats = Array.from({ length: MAX_SEATS }, (_, seatIndex) => {
      const guestId = rawGuestIds[seatIndex] ?? null;
      const guest = guestId ? guestById.get(guestId) ?? null : null;
      const category = guest ? normalizeCategory(guest.category) : null;
      const categoryVisual = category ? getCategoryVisual(category) : null;

      return {
        seatIndex,
        seatNumber: seatIndex + 1,
        guestId: guest?.id ?? null,
        guestName: guest?.name ?? null,
        category,
        categoryVisual: categoryVisual
          ? {
            id: categoryVisual.id,
            label: categoryVisual.label,
            printColor: categoryVisual.printColor,
            floorBorder: categoryVisual.floorBorder,
            floorBackground: categoryVisual.floorBackground,
            isBuiltin: categoryVisual.isBuiltin,
          }
          : null,
        isEmpty: !guest,
      };
    });

    return {
      id: table?.id ?? `table-${originalIndex + 1}`,
      label: String(table?.label ?? '').trim(),
      originalIndex,
      table,
      sourceTopLeft: resolved.topLeft,
      sourceCenter: center,
      positionSource: resolved.positionSource,
      usedDefaultPosition: resolved.usedDefaultPosition,
      seats,
      occupancy: seats.filter(seat => !seat.isEmpty).length,
      capacity: MAX_SEATS,
    };
  });
}

function buildBounds(points, padding = 0) {
  if (points.length === 0) {
    return {
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      minX: 0,
      minY: 0,
      maxX: 0,
      maxY: 0,
      center: { x: 0, y: 0 },
    };
  }

  const minX = Math.min(...points.map(point => point.x)) - padding;
  const minY = Math.min(...points.map(point => point.y)) - padding;
  const maxX = Math.max(...points.map(point => point.x)) + padding;
  const maxY = Math.max(...points.map(point => point.y)) + padding;

  return {
    x: round(minX),
    y: round(minY),
    width: round(maxX - minX),
    height: round(maxY - minY),
    minX: round(minX),
    minY: round(minY),
    maxX: round(maxX),
    maxY: round(maxY),
    center: {
      x: round((minX + maxX) / 2),
      y: round((minY + maxY) / 2),
    },
  };
}

function buildCentroid(points) {
  if (points.length === 0) {
    return { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 };
  }

  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
  };
}

function breathePoint(point, centroid, breathingScale) {
  return {
    x: centroid.x + (point.x - centroid.x) * breathingScale,
    y: centroid.y + (point.y - centroid.y) * breathingScale,
  };
}

function buildPositionTransform({
  contentFrame,
  sourceCentroid,
  sourceCenters,
  tableGeometry,
  breathingScale,
}) {
  const breathedCenters = sourceCenters.map(point =>
    breathePoint(point, sourceCentroid, breathingScale)
  );
  const sourceCenterBoundingBox = buildBounds(sourceCenters);
  const sourceBoundingBox = buildBounds(sourceCenters, tableGeometry.footprintRadius);
  const breathedSourceBoundingBox = buildBounds(breathedCenters, tableGeometry.footprintRadius);
  const fitSourceWidth = Math.max(breathedSourceBoundingBox.width, MIN_FIT_EXTENT);
  const fitSourceHeight = Math.max(breathedSourceBoundingBox.height, MIN_FIT_EXTENT);
  const scale = sourceCenters.length > 0
    ? Math.min(contentFrame.width / fitSourceWidth, contentFrame.height / fitSourceHeight)
    : 1;
  const frameCenter = {
    x: contentFrame.x + contentFrame.width / 2,
    y: contentFrame.y + contentFrame.height / 2,
  };
  const translate = {
    x: frameCenter.x - breathedSourceBoundingBox.center.x * scale,
    y: frameCenter.y - breathedSourceBoundingBox.center.y * scale,
  };

  return {
    sourceCenterBoundingBox,
    sourceBoundingBox,
    breathedSourceBoundingBox,
    breathedCenters,
    transform: {
      type: 'uniform-scale-translate',
      scaleX: round(scale, 6),
      scaleY: round(scale, 6),
      scalePxToMm: round(scale, 6),
      translateX: round(translate.x, 6),
      translateY: round(translate.y, 6),
      sourceCentroid: {
        x: round(sourceCentroid.x),
        y: round(sourceCentroid.y),
      },
      breathingScale: round(breathingScale, 6),
      sourceCenterOffset: { ...tableGeometry.centerOffset },
      sourceFootprintRadius: tableGeometry.footprintRadius,
    },
  };
}

function transformBreathedPoint(point, transform) {
  return {
    x: point.x * transform.scalePxToMm + transform.translateX,
    y: point.y * transform.scalePxToMm + transform.translateY,
  };
}

function seatPointForIndex(center, radius, seatIndex) {
  const angle = -Math.PI / 2 + (2 * Math.PI * seatIndex) / MAX_SEATS;
  return {
    x: center.x + radius * Math.cos(angle),
    y: center.y + radius * Math.sin(angle),
  };
}

function buildSeatDots(table, printCenter, transform, tableGeometry) {
  const printSeatOrbitRadius = tableGeometry.seatOrbitRadius * transform.scalePxToMm;
  const printSeatRadius = tableGeometry.seatRadius * transform.scalePxToMm;

  return table.seats.map(seat => {
    const sourceSeatPoint = seatPointForIndex(
      table.sourceCenter,
      tableGeometry.seatOrbitRadius,
      seat.seatIndex
    );
    const printSeatPoint = seatPointForIndex(printCenter, printSeatOrbitRadius, seat.seatIndex);

    return {
      seatIndex: seat.seatIndex,
      seatNumber: seat.seatNumber,
      guestId: seat.guestId,
      isEmpty: seat.isEmpty,
      sourcePoint: {
        x: round(sourceSeatPoint.x),
        y: round(sourceSeatPoint.y),
      },
      printPoint: {
        x: round(printSeatPoint.x),
        y: round(printSeatPoint.y),
      },
      dotRadius: round(printSeatRadius),
      categoryVisual: seat.categoryVisual,
    };
  });
}

function buildRelativePositionSignature(sourceCenter, printCenter, sourceCentroid, printCentroid) {
  const sourceDx = sourceCenter.x - sourceCentroid.x;
  const sourceDy = sourceCenter.y - sourceCentroid.y;
  const printDx = printCenter.x - printCentroid.x;
  const printDy = printCenter.y - printCentroid.y;

  return {
    sourceDx: round(sourceDx),
    sourceDy: round(sourceDy),
    sourceDistance: round(Math.hypot(sourceDx, sourceDy)),
    printDx: round(printDx),
    printDy: round(printDy),
    printDistance: round(Math.hypot(printDx, printDy)),
  };
}

function buildLayoutSignature({ sourceCanvas, contentFrame, positionTransform, tables }) {
  const tableSignature = tables
    .map(table => [
      table.id,
      table.positionSource,
      `${table.sourcePosition.centerX},${table.sourcePosition.centerY}`,
      `${table.printPosition.centerX},${table.printPosition.centerY}`,
    ].join('@'))
    .join('|');

  return [
    SIGNATURE_VERSION,
    `canvas:${sourceCanvas.width}x${sourceCanvas.height}`,
    `frame:${contentFrame.x},${contentFrame.y},${contentFrame.width},${contentFrame.height}`,
    `scale:${positionTransform.scalePxToMm}`,
    `breathing:${positionTransform.breathingScale}`,
    tableSignature,
  ].join('::');
}

export function buildFloorDesignLayoutModel(state, options = {}) {
  const contentFrame = normalizeFrame(options.contentFrame);
  const tableGeometry = {
    ...FLOOR_DESIGN_SOURCE_TABLE_GEOMETRY,
    ...(options.tableGeometry ?? {}),
  };
  const breathingScale = normalizePositiveNumber(options.breathingScale, 1);
  const sourceCanvas = {
    unit: 'px',
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
  };
  const tableEntries = resolveTableEntries(state, tableGeometry);
  const sourceCenters = tableEntries.map(table => table.sourceCenter);
  const sourceCentroid = buildCentroid(sourceCenters);
  const {
    sourceCenterBoundingBox,
    sourceBoundingBox,
    breathedSourceBoundingBox,
    breathedCenters,
    transform,
  } = buildPositionTransform({
    contentFrame,
    sourceCentroid,
    sourceCenters,
    tableGeometry,
    breathingScale,
  });
  const printCentroidPoint = transformBreathedPoint(
    breathePoint(sourceCentroid, sourceCentroid, breathingScale),
    transform
  );
  const printCentroid = {
    x: round(printCentroidPoint.x),
    y: round(printCentroidPoint.y),
  };
  const printTableRadius = tableGeometry.footprintRadius * transform.scalePxToMm;

  const tables = tableEntries.map((table, index) => {
    const printCenterPoint = transformBreathedPoint(breathedCenters[index], transform);
    const printCenter = {
      x: round(printCenterPoint.x),
      y: round(printCenterPoint.y),
    };
    const printRadius = round(printTableRadius);

    return {
      id: table.id,
      label: table.label,
      originalIndex: table.originalIndex,
      positionSource: table.positionSource,
      usedDefaultPosition: table.usedDefaultPosition,
      sourcePosition: {
        x: round(table.sourceTopLeft.x),
        y: round(table.sourceTopLeft.y),
        centerX: round(table.sourceCenter.x),
        centerY: round(table.sourceCenter.y),
      },
      printPosition: {
        x: round(printCenter.x - printRadius),
        y: round(printCenter.y - printRadius),
        centerX: printCenter.x,
        centerY: printCenter.y,
        radius: printRadius,
        diameter: round(printRadius * 2),
      },
      relativePositionSignature: buildRelativePositionSignature(
        table.sourceCenter,
        printCenter,
        sourceCentroid,
        printCentroid
      ),
      seats: table.seats,
      seatDots: buildSeatDots(table, printCenter, transform, tableGeometry),
      occupancy: table.occupancy,
      capacity: table.capacity,
    };
  });

  const model = {
    page: { ...FLOOR_DESIGN_PAGE },
    sourceCanvas,
    contentFrame,
    sourceCenterBoundingBox,
    sourceBoundingBox,
    breathedSourceBoundingBox,
    positionTransform: transform,
    breathingScale: transform.breathingScale,
    sourceCentroid: {
      x: round(sourceCentroid.x),
      y: round(sourceCentroid.y),
    },
    printCentroid,
    tables,
    warnings: [],
  };

  return {
    ...model,
    layoutSignature: buildLayoutSignature(model),
  };
}
