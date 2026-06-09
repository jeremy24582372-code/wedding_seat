import { MAX_SEATS } from './constants.js';

export const REGULAR_OVERVIEW_ANNOTATION_LIMIT = 3;
export const DETAIL_TABLES_PER_PAGE = 4;

const SIDE_SLOT_ORDER = {
  0: ['top', 'corner', 'right', 'left', 'bottom'],
  1: ['left', 'corner', 'top', 'bottom', 'right'],
  2: ['left', 'corner', 'top', 'bottom', 'right'],
  3: ['left', 'corner', 'bottom', 'top', 'right'],
  4: ['left', 'corner', 'bottom', 'top', 'right'],
  5: ['bottom', 'corner', 'right', 'left', 'top'],
  6: ['right', 'corner', 'bottom', 'top', 'left'],
  7: ['right', 'corner', 'bottom', 'top', 'left'],
  8: ['right', 'corner', 'top', 'bottom', 'left'],
  9: ['right', 'corner', 'top', 'bottom', 'left'],
};

const MAIN_OVERVIEW_GEOMETRY = {
  mode: 'main-overview',
  groupBox: { x: 27, y: 62, width: 130, height: 50 },
  tableCenter: { diameter: 24 },
  seatOrbitRadius: 20,
  dotDiameter: 6.2,
  labelGap: 1.2,
  sideSlotCounts: { left: 4, right: 4, top: 1, bottom: 1, corner: 4 },
  labelBoxes: {
    side: { width: 28, height: 7 },
    horizontal: { width: 24, height: 7 },
  },
  labelLane: 'inside',
  inset: 6,
};

const REGULAR_OVERVIEW_GEOMETRY = {
  mode: 'regular-overview',
  tableCenter: { diameter: 12.8 },
  seatOrbitRadius: 10.5,
  dotDiameter: 4.8,
  labelGap: 0.8,
  sideSlotCounts: { left: 3, right: 3, top: 1, bottom: 1, corner: 4 },
  labelBoxes: {
    side: { width: 16, height: 4.8 },
    horizontal: { width: 18, height: 4.8 },
  },
  labelLane: 'outside',
  laneGap: 2.2,
};

const DETAIL_GEOMETRY = {
  mode: 'detail',
  tableCenter: { diameter: 26 },
  seatOrbitRadius: 25,
  dotDiameter: 6,
  labelGap: 1.2,
  sideSlotCounts: { left: 4, right: 4, top: 1, bottom: 1, corner: 4 },
  labelBoxes: {
    side: { width: 28, height: 7 },
    horizontal: { width: 24, height: 7 },
  },
  labelLane: 'inside',
  inset: 4,
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

function slotY(geometry, slotCount, labelHeight, slotIndex) {
  const gap = geometry.labelGap;
  const totalHeight = slotCount * labelHeight + Math.max(0, slotCount - 1) * gap;
  return roundMm(geometry.center.y - totalHeight / 2 + slotIndex * (labelHeight + gap));
}

function slotX(geometry, slotCount, labelWidth, slotIndex) {
  const gap = geometry.labelGap;
  const totalWidth = slotCount * labelWidth + Math.max(0, slotCount - 1) * gap;
  return roundMm(geometry.center.x - totalWidth / 2 + slotIndex * (labelWidth + gap));
}

function sideLabelSize(geometry, side) {
  if (side === 'left' || side === 'right') return geometry.labelBoxes.side;
  return geometry.labelBoxes.horizontal;
}

function labelBoxForSide(geometry, side, slotIndex) {
  const groupBox = geometry.groupBox;
  const slotCount = geometry.sideSlotCounts[side] ?? 0;
  const size = sideLabelSize(geometry, side);
  const inset = geometry.inset ?? 0;
  const laneGap = geometry.laneGap ?? 0;

  if (side === 'left') {
    return {
      x: roundMm(geometry.labelLane === 'outside'
        ? groupBox.x - laneGap - size.width
        : groupBox.x + inset),
      y: slotY(geometry, slotCount, size.height, slotIndex),
      width: size.width,
      height: size.height,
    };
  }

  if (side === 'right') {
    return {
      x: roundMm(geometry.labelLane === 'outside'
        ? groupBox.x + groupBox.width + laneGap
        : groupBox.x + groupBox.width - inset - size.width),
      y: slotY(geometry, slotCount, size.height, slotIndex),
      width: size.width,
      height: size.height,
    };
  }

  if (side === 'top') {
    return {
      x: slotX(geometry, slotCount, size.width, slotIndex),
      y: roundMm(geometry.labelLane === 'outside'
        ? groupBox.y - laneGap - size.height
        : groupBox.y + inset),
      width: size.width,
      height: size.height,
    };
  }

  if (side === 'bottom') {
    return {
      x: slotX(geometry, slotCount, size.width, slotIndex),
      y: roundMm(geometry.labelLane === 'outside'
        ? groupBox.y + groupBox.height + laneGap
        : groupBox.y + groupBox.height - inset - size.height),
      width: size.width,
      height: size.height,
    };
  }

  const cornerPositions = [
    { x: groupBox.x + inset, y: groupBox.y + inset, name: 'top-left' },
    { x: groupBox.x + groupBox.width - inset - size.width, y: groupBox.y + inset, name: 'top-right' },
    { x: groupBox.x + inset, y: groupBox.y + groupBox.height - inset - size.height, name: 'bottom-left' },
    { x: groupBox.x + groupBox.width - inset - size.width, y: groupBox.y + groupBox.height - inset - size.height, name: 'bottom-right' },
  ];
  const position = cornerPositions[slotIndex % cornerPositions.length];

  return {
    x: roundMm(position.x),
    y: roundMm(position.y),
    width: size.width,
    height: size.height,
    slotName: position.name,
  };
}

function connectorForPlacement(seatPoint, labelBox, side) {
  const labelCenterY = labelBox.y + labelBox.height / 2;
  const labelCenterX = labelBox.x + labelBox.width / 2;
  let toX = labelCenterX;
  let toY = labelCenterY;

  if (side === 'left') toX = labelBox.x + labelBox.width;
  if (side === 'right') toX = labelBox.x;
  if (side === 'top') toY = labelBox.y + labelBox.height;
  if (side === 'bottom') toY = labelBox.y;

  return {
    fromX: seatPoint.x,
    fromY: seatPoint.y,
    toX: roundMm(toX),
    toY: roundMm(toY),
    bendPoints: [],
  };
}

function allocatePlacement({ seatIndex, pageNumber, geometry, usedSlots }) {
  const seatPoint = seatPointForIndex(geometry, seatIndex);
  const preferredSides = SIDE_SLOT_ORDER[seatIndex] ?? ['right', 'left', 'top', 'bottom', 'corner'];

  for (const side of preferredSides) {
    const slotCount = geometry.sideSlotCounts[side] ?? 0;
    const used = usedSlots[side] ?? 0;
    if (used >= slotCount) continue;

    usedSlots[side] = used + 1;
    const labelBox = labelBoxForSide(geometry, side, used);
    return {
      pageNumber,
      seatPoint,
      labelBox,
      connector: connectorForPlacement(seatPoint, labelBox, side),
      side,
      slotIndex: used,
      slotName: labelBox.slotName ?? `${side}-${used + 1}`,
    };
  }

  return null;
}

function buildPlacements(occupiedSeats, pageNumber, geometry) {
  const usedSlots = {};
  const placements = new Map();

  for (const seat of occupiedSeats) {
    const placement = allocatePlacement({
      seatIndex: seat.seatIndex,
      pageNumber,
      geometry,
      usedSlots,
    });

    if (!placement) return null;
    placements.set(seat.guest.id, placement);
  }

  return placements;
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

function isNameTooLongForOverview(name) {
  return String(name ?? '').trim().length > 8;
}

function shouldRegularTableUseDetail(tableLayout, overviewAnnotationLimit) {
  const occupiedSeats = getOccupiedSeats(tableLayout);
  return (
    occupiedSeats.length > overviewAnnotationLimit ||
    occupiedSeats.some(seat => isNameTooLongForOverview(seat.guest.name)) ||
    (tableLayout?.overflowGuestIds?.length ?? 0) > 0
  );
}

function buildAnnotationRecords({ tableLayout, occupiedSeats, overviewPlacements, detailPlacements }) {
  return occupiedSeats.map(seat => ({
    guestId: seat.guest.id,
    guestName: seat.guest.name,
    category: seat.guest.category,
    tableId: tableLayout.id,
    tableLabel: tableLayout.label,
    seatIndex: seat.seatIndex,
    seatNumber: seat.seatNumber,
    overviewPlacement: overviewPlacements?.get(seat.guest.id) ?? null,
    detailPlacement: detailPlacements?.get(seat.guest.id) ?? null,
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
  const overviewAnnotationLimit = options.overviewAnnotationLimit ?? REGULAR_OVERVIEW_ANNOTATION_LIMIT;
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
  const initialNeedsDetailPage = tableKind === 'regular'
    ? shouldRegularTableUseDetail(tableLayout, overviewAnnotationLimit) || options.forceDetail === true
    : options.forceDetail === true;

  let overviewPlacements = null;
  if (!initialNeedsDetailPage || tableKind === 'main') {
    overviewPlacements = buildPlacements(
      occupiedSeats,
      options.overviewPageNumber ?? 1,
      overviewGeometry
    );
  }

  const overviewFailed = occupiedSeats.length > 0 && !overviewPlacements && tableKind === 'regular';
  const needsDetailPage = initialNeedsDetailPage || overviewFailed;
  const resolvedDetailPageNumber = needsDetailPage
    ? options.detailPageNumber ?? options.overviewPageNumber ?? 1
    : null;
  const detailGroupBox = needsDetailPage
    ? options.detailGroupBox ?? getDetailTableGroupBox(0)
    : null;
  const detailGeometry = detailGroupBox ? withCenter(DETAIL_GEOMETRY, detailGroupBox) : null;
  const detailPlacements = detailGeometry
    ? buildPlacements(occupiedSeats, resolvedDetailPageNumber, detailGeometry)
    : null;
  const annotationRecords = buildAnnotationRecords({
    tableLayout,
    occupiedSeats,
    overviewPlacements: needsDetailPage && tableKind === 'regular' ? null : overviewPlacements,
    detailPlacements,
  });
  const overviewMode = needsDetailPage && tableKind === 'regular'
    ? 'overview-summary'
    : 'overview-annotated';

  return {
    annotationRecords,
    needsDetailPage,
    detailPageNumber: resolvedDetailPageNumber,
    overviewMode,
    overviewTableInstance: createTableInstance({
      tableLayout,
      pageNumber: options.overviewPageNumber ?? 1,
      mode: overviewMode,
      groupBox: overviewGroupBox,
      geometry: overviewGeometry,
      placements: needsDetailPage && tableKind === 'regular' ? null : overviewPlacements,
    }),
    detailTableInstance: detailGeometry
      ? createTableInstance({
        tableLayout,
        pageNumber: options.detailPageNumber,
        mode: 'detail',
        groupBox: detailGroupBox,
        geometry: detailGeometry,
        placements: detailPlacements,
      })
      : null,
  };
}
