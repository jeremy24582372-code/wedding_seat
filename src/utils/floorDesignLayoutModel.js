import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  MAX_SEATS,
  defaultTablePosition,
  getCategoryVisual,
  normalizeCategory,
} from './constants.js';
import {
  LABEL_DISTANCE_LIMITS,
  SEAT_LOCAL_SECTORS,
} from './weddingFloorSeatAnnotations.js';

export const FLOOR_DESIGN_PAGE = {
  unit: 'mm',
  width: 210,
  height: 297,
  orientation: 'portrait',
};

export const FLOOR_DESIGN_CONTENT_FRAME = {
  x: 14,
  y: 78,
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

function splitNameLines(name, maxCharsPerLine) {
  const chars = Array.from(String(name ?? '').trim());
  if (chars.length === 0) return [''];
  if (chars.length <= maxCharsPerLine) return [chars.join('')];

  const splitAt = Math.ceil(chars.length / 2);
  return [
    chars.slice(0, splitAt).join(''),
    chars.slice(splitAt).join(''),
  ].filter(Boolean);
}

function fitFloorDesignLabel(name, tableKind, compact = false) {
  const isMain = tableKind === 'main';
  const config = isMain
    ? {
      minWidth: 11,
      maxWidth: compact ? 20 : 23,
      minHeight: 5.8,
      maxHeight: 8,
      minFontPt: 6.2,
      maxFontPt: 8,
      maxCharsPerLine: compact ? 5 : 6,
      paddingX: compact ? 0.9 : 1.2,
      paddingY: compact ? 0.6 : 0.8,
    }
    : {
      minWidth: 8,
      maxWidth: compact ? 15 : 17,
      minHeight: 4.2,
      maxHeight: 6.6,
      minFontPt: 5.5,
      maxFontPt: 7,
      maxCharsPerLine: compact ? 4 : 5,
      paddingX: compact ? 0.55 : 0.8,
      paddingY: compact ? 0.32 : 0.45,
    };
  const lines = splitNameLines(name, config.maxCharsPerLine);
  const longestLineLength = Math.max(...lines.map(line => Array.from(line).length), 1);
  const estimatedFont = (config.maxWidth - config.paddingX * 2) / (longestLineLength * 0.36);
  const fontSizePt = Math.max(config.minFontPt, Math.min(config.maxFontPt, estimatedFont));
  const width = Math.min(
    config.maxWidth,
    Math.max(config.minWidth, longestLineLength * fontSizePt * 0.36 + config.paddingX * 2)
  );
  const height = Math.min(
    config.maxHeight,
    Math.max(config.minHeight, lines.length * fontSizePt * 0.36 * 1.08 + config.paddingY * 2)
  );

  return {
    lines,
    fontSizePt: round(fontSizePt),
    width: round(width),
    height: round(height),
    compact,
  };
}

function labelBoxForSector(seatPoint, textFit, sector, gap) {
  const { width, height } = textFit;
  const horizontalCenter = seatPoint.x - width / 2;
  const verticalCenter = seatPoint.y - height / 2;
  const positions = {
    top: {
      x: horizontalCenter,
      y: seatPoint.y - gap - height,
    },
    'top-right': {
      x: seatPoint.x + gap,
      y: seatPoint.y - gap - height,
    },
    right: {
      x: seatPoint.x + gap,
      y: verticalCenter,
    },
    'bottom-right': {
      x: seatPoint.x + gap,
      y: seatPoint.y + gap,
    },
    bottom: {
      x: horizontalCenter,
      y: seatPoint.y + gap,
    },
    'bottom-left': {
      x: seatPoint.x - gap - width,
      y: seatPoint.y + gap,
    },
    left: {
      x: seatPoint.x - gap - width,
      y: verticalCenter,
    },
    'top-left': {
      x: seatPoint.x - gap - width,
      y: seatPoint.y - gap - height,
    },
  };
  const position = positions[sector] ?? positions.right;

  return {
    x: round(position.x),
    y: round(position.y),
    width: round(width),
    height: round(height),
  };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function clampLabelBoxToFrame(labelBox, frame) {
  return {
    ...labelBox,
    x: round(clamp(labelBox.x, frame.x, frame.x + frame.width - labelBox.width)),
    y: round(clamp(labelBox.y, frame.y, frame.y + frame.height - labelBox.height)),
  };
}

function nearestPointOnBox(point, box) {
  return {
    x: clamp(point.x, box.x, box.x + box.width),
    y: clamp(point.y, box.y, box.y + box.height),
  };
}

function labelCenter(labelBox) {
  return {
    x: labelBox.x + labelBox.width / 2,
    y: labelBox.y + labelBox.height / 2,
  };
}

function distanceMetrics(seatPoint, labelBox) {
  const nearest = nearestPointOnBox(seatPoint, labelBox);
  const center = labelCenter(labelBox);
  const connectorLength = Math.hypot(nearest.x - seatPoint.x, nearest.y - seatPoint.y);

  return {
    nearestPoint: {
      x: round(nearest.x),
      y: round(nearest.y),
    },
    edgeDistance: round(connectorLength),
    centerDistance: round(Math.hypot(center.x - seatPoint.x, center.y - seatPoint.y)),
    connectorLength: round(connectorLength),
  };
}

function labelBoxesOverlap(a, b, padding = 0.25) {
  return !(
    a.x + a.width + padding <= b.x ||
    b.x + b.width + padding <= a.x ||
    a.y + a.height + padding <= b.y ||
    b.y + b.height + padding <= a.y
  );
}

function isExplicitMainTableLabel(label) {
  const normalized = String(label ?? '').trim();
  return normalized === '主桌' || normalized.includes('主桌');
}

function isMainTableLabel(label, hasExplicitMainTable = false) {
  const normalized = String(label ?? '').trim();
  return isExplicitMainTableLabel(label) || (!hasExplicitMainTable && normalized === '1桌');
}

function buildSeatLabels(table, seatDots, contentFrame, hasExplicitMainTable, compact = false) {
  const tableKind = isMainTableLabel(table.label, hasExplicitMainTable) ? 'main' : 'regular';
  const gap = tableKind === 'main' ? 1.2 : 0.8;
  const limits = LABEL_DISTANCE_LIMITS[tableKind] ?? LABEL_DISTANCE_LIMITS.regular;

  return table.seats
    .filter(seat => !seat.isEmpty)
    .map(seat => {
      const seatDot = seatDots.find(dot => dot.seatIndex === seat.seatIndex);
      const sector = SEAT_LOCAL_SECTORS[seat.seatIndex] ?? 'right';
      const textFit = fitFloorDesignLabel(seat.guestName, tableKind, compact);
      const labelBox = clampLabelBoxToFrame(
        labelBoxForSector(seatDot.printPoint, textFit, sector, gap),
        contentFrame
      );
      const distance = distanceMetrics(seatDot.printPoint, labelBox);

      return {
        guestId: seat.guestId,
        guestName: seat.guestName,
        tableId: table.id,
        tableLabel: table.label,
        seatIndex: seat.seatIndex,
        seatNumber: seat.seatNumber,
        localSector: sector,
        labelBox,
        textFit,
        seatPoint: seatDot.printPoint,
        connector: {
          fromX: seatDot.printPoint.x,
          fromY: seatDot.printPoint.y,
          toX: distance.nearestPoint.x,
          toY: distance.nearestPoint.y,
          bendPoints: [],
          length: distance.connectorLength,
        },
        distance: {
          edgeDistance: distance.edgeDistance,
          centerDistance: distance.centerDistance,
          connectorLength: distance.connectorLength,
          edgeMax: limits.edgeMax,
          centerMax: limits.centerMax,
          connectorMax: limits.connectorMax,
          withinLimit:
            distance.edgeDistance <= limits.edgeMax &&
            distance.centerDistance <= limits.centerMax &&
            distance.connectorLength <= limits.connectorMax,
        },
        compactMode: compact,
        categoryVisual: seat.categoryVisual,
      };
    });
}

function buildCompactAwareSeatLabels(table, seatDots, contentFrame, hasExplicitMainTable) {
  const labels = buildSeatLabels(table, seatDots, contentFrame, hasExplicitMainTable, false);
  const hasCollision = labels.some((label, index) =>
    labels.some((other, otherIndex) =>
      otherIndex > index && labelBoxesOverlap(label.labelBox, other.labelBox)
    )
  );

  return hasCollision ? buildSeatLabels(table, seatDots, contentFrame, hasExplicitMainTable, true) : labels;
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
  const hasExplicitMainTable = tableEntries.some(table => isExplicitMainTableLabel(table.label));

  const tables = tableEntries.map((table, index) => {
    const printCenterPoint = transformBreathedPoint(breathedCenters[index], transform);
    const printCenter = {
      x: round(printCenterPoint.x),
      y: round(printCenterPoint.y),
    };
    const printRadius = round(printTableRadius);

    const seatDots = buildSeatDots(table, printCenter, transform, tableGeometry);
    const seatLabels = buildCompactAwareSeatLabels(
      table,
      seatDots,
      contentFrame,
      hasExplicitMainTable
    );

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
      seatDots,
      seatLabels,
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
