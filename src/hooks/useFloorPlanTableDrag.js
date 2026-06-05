import { useCallback, useRef, useState } from 'react';
import { CANVAS_HEIGHT, CANVAS_WIDTH, defaultTablePosition } from '../utils/constants';

const GRID_SIZE = 40;
const SNAP_THRESHOLD = 12;
const GUIDE_THRESHOLD = 8;
const TABLE_WIDTH = 280;
const TABLE_HEIGHT = 320;

function snapToGrid(value) {
  const snapped = Math.round(value / GRID_SIZE) * GRID_SIZE;
  return Math.abs(value - snapped) < SNAP_THRESHOLD ? snapped : value;
}

function computeGuidesAndSnap(dragX, dragY, otherPositions) {
  const dragLeft = dragX;
  const dragRight = dragX + TABLE_WIDTH;
  const dragCenterX = dragX + TABLE_WIDTH / 2;
  const dragTop = dragY;
  const dragBottom = dragY + TABLE_HEIGHT;
  const dragCenterY = dragY + TABLE_HEIGHT / 2;

  const hLines = new Set();
  const vLines = new Set();
  let snappedX = dragX;
  let snappedY = dragY;
  let xSnapped = false;
  let ySnapped = false;

  for (const position of otherPositions) {
    const otherLeft = position.x;
    const otherRight = position.x + TABLE_WIDTH;
    const otherCenterX = position.x + TABLE_WIDTH / 2;
    const otherTop = position.y;
    const otherBottom = position.y + TABLE_HEIGHT;
    const otherCenterY = position.y + TABLE_HEIGHT / 2;

    if (!xSnapped) {
      const verticalChecks = [
        { dragValue: dragCenterX, otherValue: otherCenterX, snap: otherCenterX - TABLE_WIDTH / 2 },
        { dragValue: dragLeft, otherValue: otherLeft, snap: otherLeft },
        { dragValue: dragRight, otherValue: otherRight, snap: otherRight - TABLE_WIDTH },
        { dragValue: dragLeft, otherValue: otherRight, snap: otherRight },
        { dragValue: dragRight, otherValue: otherLeft, snap: otherLeft - TABLE_WIDTH },
      ];

      for (const { dragValue, otherValue, snap } of verticalChecks) {
        if (Math.abs(dragValue - otherValue) <= GUIDE_THRESHOLD) {
          vLines.add(otherValue);
          snappedX = snap;
          xSnapped = true;
          break;
        }
      }
    }

    if (!ySnapped) {
      const horizontalChecks = [
        { dragValue: dragCenterY, otherValue: otherCenterY, snap: otherCenterY - TABLE_HEIGHT / 2 },
        { dragValue: dragTop, otherValue: otherTop, snap: otherTop },
        { dragValue: dragBottom, otherValue: otherBottom, snap: otherBottom - TABLE_HEIGHT },
        { dragValue: dragTop, otherValue: otherBottom, snap: otherBottom },
        { dragValue: dragBottom, otherValue: otherTop, snap: otherTop - TABLE_HEIGHT },
      ];

      for (const { dragValue, otherValue, snap } of horizontalChecks) {
        if (Math.abs(dragValue - otherValue) <= GUIDE_THRESHOLD) {
          hLines.add(otherValue);
          snappedY = snap;
          ySnapped = true;
          break;
        }
      }
    }

    if (xSnapped && ySnapped) break;
  }

  return {
    h: [...hLines],
    v: [...vLines],
    snappedX,
    snappedY,
    xSnapped,
    ySnapped,
  };
}

function clampTablePosition(position) {
  return {
    x: Math.max(0, Math.min(CANVAS_WIDTH - TABLE_WIDTH, position.x)),
    y: Math.max(0, Math.min(CANVAS_HEIGHT - TABLE_HEIGHT, position.y)),
  };
}

export function useFloorPlanTableDrag({
  tables,
  positions,
  zoom,
  selectedTableIds,
  getPos,
  onUpdatePosition,
  onSelectTableFromPointer,
}) {
  const tableDrag = useRef(null);
  const livePosGroupRef = useRef({});
  const [draggingTableId, setDraggingTableId] = useState(null);
  const [livePos, setLivePos] = useState(null);
  const [dragGroupState, setDragGroupState] = useState([]);
  const [dragOriginalsState, setDragOriginalsState] = useState({});
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [guidesEnabled, setGuidesEnabled] = useState(true);
  const [guides, setGuides] = useState({ h: [], v: [] });

  const resetDragState = useCallback(() => {
    tableDrag.current = null;
    livePosGroupRef.current = {};
    setDraggingTableId(null);
    setLivePos(null);
    setDragGroupState([]);
    setDragOriginalsState({});
  }, []);

  const handleTableDragStart = useCallback((event, tableId, index) => {
    event.stopPropagation();
    event.preventDefault();

    const table = tables.find(item => item.id === tableId);
    const origin = getPos(table, index);
    const dragGroup = selectedTableIds.has(tableId)
      ? [...selectedTableIds]
      : [tableId];
    const originals = {};

    dragGroup.forEach(id => {
      const groupTable = tables.find(item => item.id === id);
      const groupIndex = tables.findIndex(item => item.id === id);
      if (groupTable) originals[id] = getPos(groupTable, groupIndex);
    });

    tableDrag.current = {
      tableId,
      startX: event.clientX,
      startY: event.clientY,
      origX: origin.x,
      origY: origin.y,
      pointerId: event.pointerId,
      dragGroup,
      originals,
      hasMoved: false,
    };

    setDragGroupState(dragGroup);
    setDragOriginalsState(originals);
    setDraggingTableId(tableId);
    setLivePos({ x: origin.x, y: origin.y });
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [getPos, selectedTableIds, tables]);

  const handleTableDragMove = useCallback((event) => {
    if (!tableDrag.current) return;

    const rawDx = event.clientX - tableDrag.current.startX;
    const rawDy = event.clientY - tableDrag.current.startY;
    if (Math.abs(rawDx) > 4 || Math.abs(rawDy) > 4) {
      tableDrag.current.hasMoved = true;
    }

    const dx = rawDx / zoom;
    const dy = rawDy / zoom;
    const { origX, origY, originals, dragGroup } = tableDrag.current;
    const rawPosition = clampTablePosition({ x: origX + dx, y: origY + dy });

    const otherPositions = tables
      .filter(table => !dragGroup.includes(table.id))
      .map(table => {
        const index = tables.findIndex(item => item.id === table.id);
        return positions?.[table.id] ?? defaultTablePosition(index);
      });

    const {
      h: hGuides,
      v: vGuides,
      snappedX,
      snappedY,
      xSnapped,
      ySnapped,
    } = guidesEnabled
      ? computeGuidesAndSnap(rawPosition.x, rawPosition.y, otherPositions)
      : {
        h: [],
        v: [],
        snappedX: rawPosition.x,
        snappedY: rawPosition.y,
        xSnapped: false,
        ySnapped: false,
      };

    let finalX = xSnapped ? snappedX : rawPosition.x;
    let finalY = ySnapped ? snappedY : rawPosition.y;

    if (snapEnabled) {
      if (!xSnapped) finalX = snapToGrid(finalX);
      if (!ySnapped) finalY = snapToGrid(finalY);
    }

    const snapDx = finalX - origX;
    const snapDy = finalY - origY;
    const groupSnapshot = {};

    dragGroup.forEach(id => {
      const origin = originals[id];
      if (!origin) return;
      groupSnapshot[id] = clampTablePosition({
        x: origin.x + snapDx,
        y: origin.y + snapDy,
      });
    });
    livePosGroupRef.current = groupSnapshot;

    setGuides(guidesEnabled ? { h: hGuides, v: vGuides } : { h: [], v: [] });
    setLivePos({ x: finalX, y: finalY });
  }, [guidesEnabled, positions, snapEnabled, tables, zoom]);

  const handleTableDragEnd = useCallback((event) => {
    if (!tableDrag.current) return;

    const { tableId, dragGroup, hasMoved, pointerId } = tableDrag.current;
    if (event.currentTarget?.hasPointerCapture?.(pointerId)) {
      event.currentTarget.releasePointerCapture(pointerId);
    }

    setGuides({ h: [], v: [] });

    if (!hasMoved) {
      onSelectTableFromPointer(event, tableId);
      resetDragState();
      return;
    }

    const snapshot = livePosGroupRef.current;
    dragGroup.forEach(id => {
      const position = snapshot[id];
      if (position) onUpdatePosition(id, position);
    });

    resetDragState();
  }, [onSelectTableFromPointer, onUpdatePosition, resetDragState]);

  const getLivePosForTable = useCallback((tableId) => {
    if (!draggingTableId || !livePos) return null;
    if (!dragGroupState.includes(tableId)) return null;
    if (tableId === draggingTableId) return livePos;

    const primaryOrigin = dragOriginalsState[draggingTableId];
    const tableOrigin = dragOriginalsState[tableId];
    if (!primaryOrigin || !tableOrigin) return null;

    return clampTablePosition({
      x: tableOrigin.x + livePos.x - primaryOrigin.x,
      y: tableOrigin.y + livePos.y - primaryOrigin.y,
    });
  }, [dragGroupState, dragOriginalsState, draggingTableId, livePos]);

  return {
    guides,
    guidesEnabled,
    snapEnabled,
    setGuidesEnabled,
    setSnapEnabled,
    getLivePosForTable,
    handleTableDragStart,
    handleTableDragMove,
    handleTableDragEnd,
  };
}
