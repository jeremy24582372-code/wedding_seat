import { MAX_SEATS } from './constants.js';

export const REGULAR_OVERVIEW_ANNOTATION_LIMIT = MAX_SEATS;
export const DETAIL_TABLES_PER_PAGE = 0;

export const SEAT_LOCAL_SECTORS = {
  0: 'top',
  1: 'top-right',
  2: 'right',
  3: 'right',
  4: 'bottom-right',
  5: 'bottom',
  6: 'bottom-left',
  7: 'left',
  8: 'left',
  9: 'top-left',
};

export const LABEL_DISTANCE_LIMITS = {
  main: {
    edgeMax: 4,
    centerMax: 14,
    connectorMax: 8,
  },
  regular: {
    edgeMax: 3,
    centerMax: 11,
    connectorMax: 8,
  },
};

const MAIN_OVERVIEW_GEOMETRY = {
  mode: 'main-overview',
  groupBox: { x: 27, y: 62, width: 130, height: 50 },
  tableCenter: { diameter: 24 },
  seatOrbitRadius: 20,
  dotDiameter: 6.2,
  labelGap: 1.2,
  label: {
    minWidth: 11,
    maxWidth: 23,
    minHeight: 5.8,
    maxHeight: 8,
    minFontPt: 6.2,
    maxFontPt: 8,
    maxCharsPerLine: 6,
    paddingX: 1.2,
    paddingY: 0.8,
  },
};

const REGULAR_OVERVIEW_GEOMETRY = {
  mode: 'regular-overview',
  tableCenter: { diameter: 12.8 },
  seatOrbitRadius: 10.5,
  dotDiameter: 4.8,
  labelGap: 0.8,
  label: {
    minWidth: 8,
    maxWidth: 17,
    minHeight: 4.2,
    maxHeight: 6.6,
    minFontPt: 5.5,
    maxFontPt: 7,
    maxCharsPerLine: 5,
    paddingX: 0.8,
    paddingY: 0.45,
  },
};

function roundMm(value) {
  return Number(value.toFixed(3));
}

function withCenter(geometry, groupBox) {
  return {
    ...geometry,
    groupBox,
    center: {
      x: groupBox.x + groupBox.width / 2,
      y: groupBox.y + groupBox.height / 2,
      diameter: geometry.tableCenter.diameter,
    },
  };
}

function seatPointForIndex(geometry, seatIndex) {
  const angle = -Math.PI / 2 + (2 * Math.PI * seatIndex) / MAX_SEATS;
  return {
    x: roundMm(geometry.center.x + geometry.seatOrbitRadius * Math.cos(angle)),
    y: roundMm(geometry.center.y + geometry.seatOrbitRadius * Math.sin(angle)),
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

function fitLabelText(name, geometry, compact = false) {
  const config = geometry.label;
  const maxCharsPerLine = compact
    ? Math.max(3, config.maxCharsPerLine - 1)
    : config.maxCharsPerLine;
  const lines = splitNameLines(name, maxCharsPerLine);
  const longestLineLength = Math.max(...lines.map(line => Array.from(line).length), 1);
  const horizontalPadding = compact ? config.paddingX * 0.72 : config.paddingX;
  const verticalPadding = compact ? config.paddingY * 0.72 : config.paddingY;
  const maxWidth = compact ? config.maxWidth * 0.88 : config.maxWidth;
  const maxHeight = compact ? config.maxHeight * 0.92 : config.maxHeight;
  const estimatedFont = (maxWidth - horizontalPadding * 2) / (longestLineLength * 0.36);
  const fontSizePt = Math.max(
    config.minFontPt,
    Math.min(config.maxFontPt, estimatedFont)
  );
  const width = Math.min(
    maxWidth,
    Math.max(config.minWidth, longestLineLength * fontSizePt * 0.36 + horizontalPadding * 2)
  );
  const height = Math.min(
    maxHeight,
    Math.max(config.minHeight, lines.length * fontSizePt * 0.36 * 1.08 + verticalPadding * 2)
  );

  return {
    lines,
    fontSizePt: roundMm(fontSizePt),
    width: roundMm(width),
    height: roundMm(height),
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
    x: roundMm(position.x),
    y: roundMm(position.y),
    width: roundMm(width),
    height: roundMm(height),
  };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
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

function placementDistance(seatPoint, labelBox) {
  const nearest = nearestPointOnBox(seatPoint, labelBox);
  const center = labelCenter(labelBox);

  return {
    edgeDistance: roundMm(Math.hypot(nearest.x - seatPoint.x, nearest.y - seatPoint.y)),
    centerDistance: roundMm(Math.hypot(center.x - seatPoint.x, center.y - seatPoint.y)),
  };
}

function connectorForPlacement(seatPoint, labelBox) {
  const nearest = nearestPointOnBox(seatPoint, labelBox);

  return {
    fromX: seatPoint.x,
    fromY: seatPoint.y,
    toX: roundMm(nearest.x),
    toY: roundMm(nearest.y),
    bendPoints: [],
    length: roundMm(Math.hypot(nearest.x - seatPoint.x, nearest.y - seatPoint.y)),
  };
}

function boxesOverlap(a, b, padding = 0.35) {
  return !(
    a.x + a.width + padding <= b.x ||
    b.x + b.width + padding <= a.x ||
    a.y + a.height + padding <= b.y ||
    b.y + b.height + padding <= a.y
  );
}

function buildPlacement({ seat, pageNumber, geometry, tableKind, compact }) {
  const sector = SEAT_LOCAL_SECTORS[seat.seatIndex] ?? 'right';
  const seatPoint = seatPointForIndex(geometry, seat.seatIndex);
  const textFit = fitLabelText(seat.guest.name, geometry, compact);
  const labelBox = labelBoxForSector(seatPoint, textFit, sector, geometry.labelGap);
  const distance = placementDistance(seatPoint, labelBox);
  const limits = LABEL_DISTANCE_LIMITS[tableKind] ?? LABEL_DISTANCE_LIMITS.regular;
  const connector = connectorForPlacement(seatPoint, labelBox);

  return {
    pageNumber,
    seatPoint,
    labelBox,
    connector,
    side: sector,
    localSector: sector,
    slotIndex: seat.seatIndex,
    slotName: `${sector}-${seat.seatIndex + 1}`,
    textFit,
    compactMode: compact,
    distance: {
      ...distance,
      connectorLength: connector.length,
      edgeMax: limits.edgeMax,
      centerMax: limits.centerMax,
      connectorMax: limits.connectorMax,
      withinLimit:
        distance.edgeDistance <= limits.edgeMax &&
        distance.centerDistance <= limits.centerMax &&
        connector.length <= limits.connectorMax,
    },
  };
}

function buildLocalPlacements(occupiedSeats, pageNumber, geometry, tableKind) {
  let compact = false;
  let placements = occupiedSeats.map(seat =>
    buildPlacement({ seat, pageNumber, geometry, tableKind, compact })
  );
  const hasCollision = placements.some((placement, index) =>
    placements.some((other, otherIndex) =>
      otherIndex > index && boxesOverlap(placement.labelBox, other.labelBox)
    )
  );

  if (hasCollision) {
    compact = true;
    placements = occupiedSeats.map(seat =>
      buildPlacement({ seat, pageNumber, geometry, tableKind, compact })
    );
  }

  return new Map(placements.map((placement, index) => [
    occupiedSeats[index].guest.id,
    placement,
  ]));
}

function createTableInstance({ tableLayout, pageNumber, mode, groupBox, geometry, placements }) {
  return {
    tableId: tableLayout.id,
    tableLabel: tableLayout.label,
    mode,
    groupBox,
    tableCenter: {
      x: geometry.center.x,
      y: geometry.center.y,
      diameter: geometry.center.diameter,
    },
    seats: tableLayout.seats.map(seat => ({
      seatIndex: seat.seatIndex,
      seatNumber: seat.seatNumber,
      isEmpty: seat.isEmpty,
      guestId: seat.guest?.id ?? null,
      seatPoint: seatPointForIndex(geometry, seat.seatIndex),
      dotDiameter: geometry.dotDiameter,
    })),
    annotationGuestIds: placements ? [...placements.keys()] : [],
    pageNumber,
  };
}

function getOccupiedSeats(tableLayout) {
  return (tableLayout?.seats ?? [])
    .map((seat, seatIndex) => ({
      ...seat,
      seatIndex: seat.seatIndex ?? seatIndex,
    }))
    .filter(seat => seat.guest?.id);
}

function buildAnnotationRecords({ tableLayout, occupiedSeats, overviewPlacements }) {
  return occupiedSeats.map(seat => ({
    guestId: seat.guest.id,
    guestName: seat.guest.name,
    category: seat.guest.category,
    tableId: tableLayout.id,
    tableLabel: tableLayout.label,
    seatIndex: seat.seatIndex,
    seatNumber: seat.seatNumber,
    overviewPlacement: overviewPlacements?.get(seat.guest.id) ?? null,
    detailPlacement: null,
  }));
}

export function getRegularTableOverviewGroupBox(indexWithinPage, pageKind = 'first') {
  const col = indexWithinPage % 4;
  const row = Math.floor(indexWithinPage / 4);
  const gridTop = pageKind === 'first' ? 111 : 31;

  return {
    x: roundMm(col * (38.5 + 10)),
    y: roundMm(gridTop + row * (24.4 + 4)),
    width: 38.5,
    height: 24.4,
  };
}

export function getDetailTableGroupBox(indexWithinPage) {
  const col = indexWithinPage % 2;
  const row = Math.floor(indexWithinPage / 2);

  return {
    x: roundMm(col * (88 + 8)),
    y: roundMm(31 + row * (116 + 9)),
    width: 88,
    height: 116,
  };
}

export function getMainTableOverviewGroupBox() {
  return { ...MAIN_OVERVIEW_GEOMETRY.groupBox };
}

export function buildSeatAnnotations(tableLayout, options = {}) {
  const tableKind = options.tableKind ?? 'regular';
  const occupiedSeats = getOccupiedSeats(tableLayout);
  const overviewGroupBox = options.overviewGroupBox ?? (
    tableKind === 'main'
      ? MAIN_OVERVIEW_GEOMETRY.groupBox
      : getRegularTableOverviewGroupBox(0)
  );
  const overviewGeometry = withCenter(
    tableKind === 'main' ? MAIN_OVERVIEW_GEOMETRY : REGULAR_OVERVIEW_GEOMETRY,
    overviewGroupBox
  );
  const overviewPlacements = buildLocalPlacements(
    occupiedSeats,
    options.overviewPageNumber ?? 1,
    overviewGeometry,
    tableKind
  );
  const annotationRecords = buildAnnotationRecords({
    tableLayout,
    occupiedSeats,
    overviewPlacements,
  });

  return {
    annotationRecords,
    needsDetailPage: false,
    detailPageNumber: null,
    overviewMode: 'overview-annotated',
    overviewTableInstance: createTableInstance({
      tableLayout,
      pageNumber: options.overviewPageNumber ?? 1,
      mode: 'overview-annotated',
      groupBox: overviewGroupBox,
      geometry: overviewGeometry,
      placements: overviewPlacements,
    }),
    detailTableInstance: null,
  };
}
