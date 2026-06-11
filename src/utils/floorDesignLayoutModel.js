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

const SIGNATURE_VERSION = 'floor-design-layout-v4';
const MIN_FIT_EXTENT = 1;
const DEFAULT_MIN_TABLE_GAP_MM = 4;
const DEFAULT_GUEST_NAME_FONT_SCALE = 1;
const MIN_GUEST_NAME_FONT_SCALE = 0.7;
const MAX_GUEST_NAME_FONT_SCALE = 1.4;
const AXIS_LANE_EPSILON_MM = 0.5;

function round(value, precision = 3) {
  return Number(value.toFixed(precision));
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function normalizePositiveNumber(value, fallback) {
  return isFiniteNumber(value) && value > 0 ? value : fallback;
}

function normalizeNonNegativeNumber(value, fallback) {
  return isFiniteNumber(value) && value >= 0 ? value : fallback;
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

function buildPositionTransform({
  contentFrame,
  sourceCentroid,
  sourceCenters,
  tableGeometry,
}) {
  const sourceCenterBoundingBox = buildBounds(sourceCenters);
  const sourceBoundingBox = buildBounds(sourceCenters, tableGeometry.footprintRadius);
  const fitSourceWidth = Math.max(CANVAS_WIDTH, MIN_FIT_EXTENT);
  const fitSourceHeight = Math.max(CANVAS_HEIGHT, MIN_FIT_EXTENT);
  const scale = Math.min(contentFrame.width / fitSourceWidth, contentFrame.height / fitSourceHeight);
  const frameCenter = {
    x: contentFrame.x + contentFrame.width / 2,
    y: contentFrame.y + contentFrame.height / 2,
  };
  const translate = {
    x: frameCenter.x - CANVAS_WIDTH / 2 * scale,
    y: frameCenter.y - CANVAS_HEIGHT / 2 * scale,
  };

  return {
    sourceCenterBoundingBox,
    sourceBoundingBox,
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
      breathingScale: 1,
      sourceCenterOffset: { ...tableGeometry.centerOffset },
      sourceFootprintRadius: tableGeometry.footprintRadius,
    },
  };
}

function transformPoint(point, transform) {
  return {
    x: point.x * transform.scalePxToMm + transform.translateX,
    y: point.y * transform.scalePxToMm + transform.translateY,
  };
}

function clampCenterToFrame(center, radius, frame) {
  return {
    x: clamp(center.x, frame.x + radius, frame.x + frame.width - radius),
    y: clamp(center.y, frame.y + radius, frame.y + frame.height - radius),
  };
}

function groupAxisLanes(values, epsilon = AXIS_LANE_EPSILON_MM) {
  const sorted = values
    .map((value, index) => ({ value, index }))
    .sort((a, b) => a.value - b.value || a.index - b.index);
  const lanes = [];

  sorted.forEach(item => {
    const last = lanes[lanes.length - 1];
    if (!last || Math.abs(item.value - last.value) > epsilon) {
      lanes.push({
        value: item.value,
        indexes: [item.index],
      });
      return;
    }

    last.indexes.push(item.index);
    last.value = last.indexes.reduce((sum, index) => sum + values[index], 0) / last.indexes.length;
  });

  return lanes;
}

function enforceAxisLaneSpacing(values, radius, axisMin, axisMax, minGapMm) {
  // Use a proportional epsilon: tables within ~50% of the seat-orbit radius
  // are considered in the same column/row. This tolerates canvas positioning
  // noise where the user aligned tables "roughly" but not pixel-perfect.
  const laneEpsilon = Math.max(AXIS_LANE_EPSILON_MM, radius * 0.5);
  const lanes = groupAxisLanes(values, laneEpsilon);
  const minCenter = axisMin + radius;
  const maxCenter = axisMax - radius;
  const targetDistance = radius * 2 + minGapMm;
  const laneValues = new Array(values.length);
  const anchor = round((minCenter + maxCenter) / 2);

  if (lanes.length === 0) {
    return {
      values: laneValues,
      laneCount: 0,
      requestedGapMm: minGapMm,
      actualMinimumGapMm: null,
      baseMinimumGapMm: null,
      expansionScale: 1,
      anchor,
      movedNegativeCount: 0,
      movedPositiveCount: 0,
      satisfied: true,
    };
  }

  const basePositions = lanes.map(lane => clamp(lane.value, minCenter, maxCenter));
  const baseMinimumCenterDistance = basePositions.length > 1
    ? Math.min(...basePositions.slice(1).map((value, index) => value - basePositions[index]))
    : null;
  const n = lanes.length;

  // Place lanes with exactly the requested spacing, centered in the frame.
  // This ensures gap between every pair of adjacent lanes = exactly minGapMm.
  // Only fall back to even distribution when the frame is too small to fit.
  let positions;
  if (n === 1) {
    positions = [anchor];
  } else {
    const totalSpan = (n - 1) * targetDistance;
    const startPos = anchor - totalSpan / 2;

    if (startPos >= minCenter && startPos + totalSpan <= maxCenter) {
      // Block fits: center it with exactly the requested gap.
      positions = lanes.map((_, i) => startPos + i * targetDistance);
    } else {
      // Block doesn't fit: spread evenly across the full available range.
      // The actual gap will be smaller than requested.
      const availableSpan = maxCenter - minCenter;
      const evenSpacing = availableSpan / (n - 1);
      positions = lanes.map((_, i) => minCenter + i * evenSpacing);
    }
  }

  const movementDeltas = positions.map((value, index) => value - basePositions[index]);

  lanes.forEach((lane, laneIndex) => {
    lane.indexes.forEach(index => {
      laneValues[index] = round(positions[laneIndex]);
    });
  });

  const actualMinimumGapMm = positions.length > 1
    ? round(Math.min(...positions.slice(1).map((value, index) =>
      value - positions[index] - radius * 2
    )))
    : null;

  return {
    values: laneValues,
    laneCount: lanes.length,
    requestedGapMm: minGapMm,
    actualMinimumGapMm,
    baseMinimumGapMm: baseMinimumCenterDistance === null
      ? null
      : round(baseMinimumCenterDistance - radius * 2),
    expansionScale: 1,
    anchor,
    movedNegativeCount: movementDeltas.filter(delta => delta < -0.01).length,
    movedPositiveCount: movementDeltas.filter(delta => delta > 0.01).length,
    satisfied: actualMinimumGapMm === null || actualMinimumGapMm >= minGapMm - 0.01,
  };
}

/**
 * Chain-push spreading: ensures adjacent sorted lane positions are at least
 * targetDistance apart within [minCenter, maxCenter]. Forward pass pushes
 * right, backward pass pulls back if the last position overflows.
 */
function chainSpreadLanes(positions, targetDistance, minCenter, maxCenter) {
  const n = positions.length;
  if (n <= 1) return positions;

  // Forward pass
  for (let i = 1; i < n; i += 1) {
    const minPos = positions[i - 1] + targetDistance;
    if (positions[i] < minPos) positions[i] = minPos;
  }

  // Backward pass if overflow
  if (positions[n - 1] > maxCenter) {
    positions[n - 1] = maxCenter;
    for (let i = n - 2; i >= 0; i -= 1) {
      const maxPos = positions[i + 1] - targetDistance;
      if (positions[i] > maxPos) positions[i] = maxPos;
      if (positions[i] < minCenter) positions[i] = minCenter;
    }
  }

  return positions;
}

function solveTableCenters(baseCenters, radius, frame, minHorizontalGapMm, minVerticalGapMm) {
  const clampedCenters = baseCenters.map(center => clampCenterToFrame(center, radius, frame));
  const horizontal = enforceAxisLaneSpacing(
    clampedCenters.map(center => center.x),
    radius,
    frame.x,
    frame.x + frame.width,
    minHorizontalGapMm
  );
  const vertical = enforceAxisLaneSpacing(
    clampedCenters.map(center => center.y),
    radius,
    frame.y,
    frame.y + frame.height,
    minVerticalGapMm
  );

  return {
    centers: clampedCenters.map((_, index) => ({
      x: horizontal.values[index],
      y: vertical.values[index],
    })),
    horizontal,
    vertical,
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

function fitFloorDesignLabel(name, tableKind, compact = false, fontScale = DEFAULT_GUEST_NAME_FONT_SCALE) {
  const isMain = tableKind === 'main';
  const baseConfig = isMain
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
      minWidth: compact ? 7.2 : 8,
      maxWidth: compact ? 13.5 : 17,
      minHeight: 4.2,
      maxHeight: 6.6,
      minFontPt: 5.5,
      maxFontPt: 7,
      maxCharsPerLine: compact ? 4 : 5,
      paddingX: compact ? 0.55 : 0.8,
      paddingY: compact ? 0.32 : 0.45,
    };
  const scale = clamp(fontScale, MIN_GUEST_NAME_FONT_SCALE, MAX_GUEST_NAME_FONT_SCALE);
  const config = {
    ...baseConfig,
    minWidth: baseConfig.minWidth * scale,
    maxWidth: baseConfig.maxWidth * scale,
    minHeight: baseConfig.minHeight * scale,
    maxHeight: baseConfig.maxHeight * scale,
    minFontPt: baseConfig.minFontPt * scale,
    maxFontPt: baseConfig.maxFontPt * scale,
    paddingX: baseConfig.paddingX * scale,
    paddingY: baseConfig.paddingY * scale,
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

function labelBoxIntersectsTable(labelBox, table, padding = 0.8) {
  const center = {
    x: table.printPosition.centerX,
    y: table.printPosition.centerY,
  };
  const nearest = nearestPointOnBox(center, labelBox);
  const distance = Math.hypot(nearest.x - center.x, nearest.y - center.y);
  return distance < table.printPosition.radius + padding;
}

function evaluateLayoutSpacing(tables) {
  let minimumTableGapMm = Number.POSITIVE_INFINITY;
  let crossTableLabelCollisions = 0;
  let labelTableCollisions = 0;

  for (let firstIndex = 0; firstIndex < tables.length; firstIndex += 1) {
    const first = tables[firstIndex];

    for (let secondIndex = firstIndex + 1; secondIndex < tables.length; secondIndex += 1) {
      const second = tables[secondIndex];
      const centerDistance = Math.hypot(
        first.printPosition.centerX - second.printPosition.centerX,
        first.printPosition.centerY - second.printPosition.centerY
      );
      // Use seatOrbitRadius (visible seat ring) for gap measurement,
      // not footprintRadius (which includes label bleed area).
      const r1 = first.printPosition.seatOrbitRadius ?? first.printPosition.radius;
      const r2 = second.printPosition.seatOrbitRadius ?? second.printPosition.radius;
      const tableGap = centerDistance - r1 - r2;
      minimumTableGapMm = Math.min(minimumTableGapMm, tableGap);

      first.seatLabels.forEach(firstLabel => {
        second.seatLabels.forEach(secondLabel => {
          if (labelBoxesOverlap(firstLabel.labelBox, secondLabel.labelBox, 0.6)) {
            crossTableLabelCollisions += 1;
          }
        });
        if (labelBoxIntersectsTable(firstLabel.labelBox, second)) {
          labelTableCollisions += 1;
        }
      });
      second.seatLabels.forEach(secondLabel => {
        if (labelBoxIntersectsTable(secondLabel.labelBox, first)) {
          labelTableCollisions += 1;
        }
      });
    }
  }

  return {
    minimumTableGapMm: Number.isFinite(minimumTableGapMm) ? round(minimumTableGapMm) : null,
    crossTableLabelCollisions,
    labelTableCollisions,
    collisionCount: crossTableLabelCollisions + labelTableCollisions,
  };
}

function isMainTableLabel(label, hasExplicitMainTable = false) {
  const normalized = String(label ?? '').trim();
  return isExplicitMainTableLabel(label) || (hasExplicitMainTable && normalized === '主桌');
}

function buildSeatLabels(
  table,
  seatDots,
  contentFrame,
  hasExplicitMainTable,
  guestNameFontScale,
  compact = false
) {
  const tableKind = isMainTableLabel(table.label, hasExplicitMainTable) ? 'main' : 'regular';
  const gap = tableKind === 'main' ? 1.2 : 0.8;
  const limits = LABEL_DISTANCE_LIMITS[tableKind] ?? LABEL_DISTANCE_LIMITS.regular;

  return table.seats
    .filter(seat => !seat.isEmpty)
    .map(seat => {
      const seatDot = seatDots.find(dot => dot.seatIndex === seat.seatIndex);
      const sector = SEAT_LOCAL_SECTORS[seat.seatIndex] ?? 'right';
      const textFit = fitFloorDesignLabel(seat.guestName, tableKind, compact, guestNameFontScale);
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

function buildCompactAwareSeatLabels(
  table,
  seatDots,
  contentFrame,
  hasExplicitMainTable,
  guestNameFontScale
) {
  const labels = buildSeatLabels(
    table,
    seatDots,
    contentFrame,
    hasExplicitMainTable,
    guestNameFontScale,
    false
  );
  const hasCollision = labels.some((label, index) =>
    labels.some((other, otherIndex) =>
      otherIndex > index && labelBoxesOverlap(label.labelBox, other.labelBox)
    )
  );

  return hasCollision
    ? buildSeatLabels(
      table,
      seatDots,
      contentFrame,
      hasExplicitMainTable,
      guestNameFontScale,
      true
    )
    : labels;
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

function buildLayoutSignature({
  sourceCanvas,
  contentFrame,
  positionTransform,
  guestNameFontScale,
  showTableOccupancy,
  tables,
}) {
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
    'mode:source-position',
    `canvas:${sourceCanvas.width}x${sourceCanvas.height}`,
    `frame:${contentFrame.x},${contentFrame.y},${contentFrame.width},${contentFrame.height}`,
    `scale:${positionTransform.scalePxToMm}`,
    `gapX:${positionTransform.minHorizontalTableGapMm}`,
    `gapY:${positionTransform.minVerticalTableGapMm}`,
    `nameScale:${guestNameFontScale}`,
    `showCount:${showTableOccupancy}`,
    tableSignature,
  ].join('::');
}

export function buildFloorDesignLayoutModel(state, options = {}) {
  const contentFrame = normalizeFrame(options.contentFrame);
  const legacyMinTableGapMm = normalizeNonNegativeNumber(options.minTableGapMm, DEFAULT_MIN_TABLE_GAP_MM);
  const minHorizontalTableGapMm = normalizeNonNegativeNumber(
    options.minHorizontalTableGapMm ?? options.minTableGapXmm ?? options.minTableGapMm,
    legacyMinTableGapMm
  );
  const minVerticalTableGapMm = normalizeNonNegativeNumber(
    options.minVerticalTableGapMm ?? options.minTableGapYmm ?? options.minTableGapMm,
    legacyMinTableGapMm
  );
  const minTableGapMm = Math.min(minHorizontalTableGapMm, minVerticalTableGapMm);
  const guestNameFontScale = clamp(
    normalizePositiveNumber(options.guestNameFontScale, DEFAULT_GUEST_NAME_FONT_SCALE),
    MIN_GUEST_NAME_FONT_SCALE,
    MAX_GUEST_NAME_FONT_SCALE
  );
  const showTableOccupancy = options.showTableOccupancy !== false;
  const autoSpacing = options.autoSpacing !== false;

  const tableGeometry = {
    ...FLOOR_DESIGN_SOURCE_TABLE_GEOMETRY,
    ...(options.tableGeometry ?? {}),
  };
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
    transform,
  } = buildPositionTransform({
    contentFrame,
    sourceCentroid,
    sourceCenters,
    tableGeometry,
  });
  const printTableRadius = tableGeometry.footprintRadius * transform.scalePxToMm;
  // Use seat-orbit radius for spacing calculations — this is the visible ring of
  // seat dots that the user perceives as "the table". The footprint radius is larger
  // (includes label bleed) and would make gap=0 still show negative values.
  const printSpacingRadius = tableGeometry.seatOrbitRadius * transform.scalePxToMm;
  const basePrintCenters = sourceCenters.map(center => transformPoint(center, transform));
  const spacingSolution = autoSpacing
    ? solveTableCenters(
      basePrintCenters,
      printSpacingRadius,
      contentFrame,
      minHorizontalTableGapMm,
      minVerticalTableGapMm
    )
    : {
      centers: basePrintCenters,
      horizontal: enforceAxisLaneSpacing(
        basePrintCenters.map(center => center.x),
        printSpacingRadius,
        contentFrame.x,
        contentFrame.x + contentFrame.width,
        0
      ),
      vertical: enforceAxisLaneSpacing(
        basePrintCenters.map(center => center.y),
        printSpacingRadius,
        contentFrame.y,
        contentFrame.y + contentFrame.height,
        0
      ),
    };
  const printCenters = spacingSolution.centers;
  const hasExplicitMainTable = tableEntries.some(table => isExplicitMainTableLabel(table.label));
  const printCentroid = buildCentroid(printCenters);

  const tables = tableEntries.map((table, index) => {
    const printCenterPoint = printCenters[index];
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
      hasExplicitMainTable,
      guestNameFontScale
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
        seatOrbitRadius: round(printSpacingRadius),
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
    layoutMode: 'source-position',
    autoSpacing,
    minTableGapMm,
    minHorizontalTableGapMm,
    minVerticalTableGapMm,
    guestNameFontScale,
    showTableOccupancy,
    axisSpacing: {
      horizontal: spacingSolution.horizontal,
      vertical: spacingSolution.vertical,
    },
    positionTransform: {
      ...transform,
      minTableGapMm,
      minHorizontalTableGapMm,
      minVerticalTableGapMm,
    },
    breathingScale: 1,
    sourceCentroid: {
      x: round(sourceCentroid.x),
      y: round(sourceCentroid.y),
    },
    printCentroid: {
      x: round(printCentroid.x),
      y: round(printCentroid.y),
    },
    tables,
    warnings: [],
  };

  model.spacingMetrics = {
    ...evaluateLayoutSpacing(tables),
    minimumHorizontalTableGapMm: spacingSolution.horizontal.actualMinimumGapMm,
    minimumVerticalTableGapMm: spacingSolution.vertical.actualMinimumGapMm,
  };
  const unresolved = model.spacingMetrics.collisionCount > 0 ||
    !spacingSolution.horizontal.satisfied ||
    !spacingSolution.vertical.satisfied;
  model.warnings = unresolved
    ? [{
      code: 'floor-design-spacing-limit',
      message: 'A4 頁面空間不足，無法在維持桌子大小與欄列對齊下完全滿足目前間距；請降低水平／垂直間距或調整互動畫布桌位。',
    }]
    : [];

  return {
    ...model,
    layoutSignature: buildLayoutSignature(model),
  };
}
