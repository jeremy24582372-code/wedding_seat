import { useCallback, useEffect, useRef, useState } from 'react';

const AUTO_SCROLL_EDGE = 72;
const AUTO_SCROLL_MAX_SPEED = 24;

function isAdditiveSelectionEvent(event) {
  return event.shiftKey || event.ctrlKey || event.metaKey;
}

function getContentPoint(event, viewport) {
  const viewportRect = viewport.getBoundingClientRect();
  return {
    x: event.clientX - viewportRect.left + viewport.scrollLeft,
    y: event.clientY - viewportRect.top + viewport.scrollTop,
  };
}

function normalizeRect(start, end) {
  return {
    left: Math.min(start.x, end.x),
    top: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
}

function rectanglesIntersect(selectionRect, tableRect) {
  return !(
    tableRect.right < selectionRect.left ||
    tableRect.left > selectionRect.right ||
    tableRect.bottom < selectionRect.top ||
    tableRect.top > selectionRect.bottom
  );
}

function getAutoScrollDelta(pointerPosition, viewportStart, viewportEnd) {
  if (pointerPosition < viewportStart + AUTO_SCROLL_EDGE) {
    const intensity = Math.min(1, (viewportStart + AUTO_SCROLL_EDGE - pointerPosition) / AUTO_SCROLL_EDGE);
    return -Math.ceil(AUTO_SCROLL_MAX_SPEED * intensity);
  }

  if (pointerPosition > viewportEnd - AUTO_SCROLL_EDGE) {
    const intensity = Math.min(1, (pointerPosition - (viewportEnd - AUTO_SCROLL_EDGE)) / AUTO_SCROLL_EDGE);
    return Math.ceil(AUTO_SCROLL_MAX_SPEED * intensity);
  }

  return 0;
}

export function useFloorPlanSelection({ viewportRef }) {
  const [selectedTableIds, setSelectedTableIds] = useState(() => new Set());
  const [selectionRect, setSelectionRect] = useState(null);
  const selectionDragRef = useRef(null);
  const autoScrollFrameRef = useRef(null);

  const clearSelectedTables = useCallback(() => {
    setSelectedTableIds(new Set());
  }, []);

  const updateTableSelection = useCallback((tableId, additive = false) => {
    setSelectedTableIds(prev => {
      if (additive) {
        const next = new Set(prev);
        next.has(tableId) ? next.delete(tableId) : next.add(tableId);
        return next;
      }

      return prev.size === 1 && prev.has(tableId)
        ? new Set()
        : new Set([tableId]);
    });
  }, []);

  const selectTableFromPointer = useCallback((event, tableId) => {
    updateTableSelection(tableId, isAdditiveSelectionEvent(event));
  }, [updateTableSelection]);

  const handleTableWrapperPointerDown = useCallback((event, tableId) => {
    if (event.button !== 0 || !isAdditiveSelectionEvent(event)) return;

    event.stopPropagation();
    event.preventDefault();
    updateTableSelection(tableId, true);
  }, [updateTableSelection]);

  const handleTableWrapperClickCapture = useCallback((event) => {
    if (!isAdditiveSelectionEvent(event)) return;

    event.stopPropagation();
    event.preventDefault();
  }, []);

  const updateSelectionFromPointer = useCallback((pointerClient) => {
    const selectionDrag = selectionDragRef.current;
    const viewport = viewportRef.current;
    if (!selectionDrag || !viewport) return;

    selectionDrag.pointerClient = pointerClient;
    const currentContent = getContentPoint(pointerClient, viewport);
    const nextSelectionRect = normalizeRect(selectionDrag.startContent, currentContent);
    const selectionContentRect = {
      left: nextSelectionRect.left,
      top: nextSelectionRect.top,
      right: nextSelectionRect.left + nextSelectionRect.width,
      bottom: nextSelectionRect.top + nextSelectionRect.height,
    };
    const viewportRect = viewport.getBoundingClientRect();
    const nextSelectedTableIds = new Set(selectionDrag.baseSelection);

    viewport.querySelectorAll('.floor-plan__table-wrapper[data-table-id]').forEach(element => {
      const tableClientRect = element.getBoundingClientRect();
      const tableContentRect = {
        left: tableClientRect.left - viewportRect.left + viewport.scrollLeft,
        top: tableClientRect.top - viewportRect.top + viewport.scrollTop,
        right: tableClientRect.right - viewportRect.left + viewport.scrollLeft,
        bottom: tableClientRect.bottom - viewportRect.top + viewport.scrollTop,
      };

      if (rectanglesIntersect(selectionContentRect, tableContentRect)) {
        nextSelectedTableIds.add(element.dataset.tableId);
      }
    });

    setSelectionRect(nextSelectionRect);
    setSelectedTableIds(nextSelectedTableIds);
  }, [viewportRef]);

  const stopAutoScroll = useCallback(() => {
    if (autoScrollFrameRef.current !== null) {
      cancelAnimationFrame(autoScrollFrameRef.current);
      autoScrollFrameRef.current = null;
    }
  }, []);

  const runAutoScroll = useCallback(function autoScrollStep() {
    const selectionDrag = selectionDragRef.current;
    const viewport = viewportRef.current;
    if (!selectionDrag?.hasMoved || !selectionDrag.pointerClient || !viewport) {
      stopAutoScroll();
      return;
    }

    const viewportRect = viewport.getBoundingClientRect();
    const scrollLeft = getAutoScrollDelta(
      selectionDrag.pointerClient.clientX,
      viewportRect.left,
      viewportRect.right
    );
    const scrollTop = getAutoScrollDelta(
      selectionDrag.pointerClient.clientY,
      viewportRect.top,
      viewportRect.bottom
    );
    if (scrollLeft === 0 && scrollTop === 0) {
      stopAutoScroll();
      return;
    }

    const previousLeft = viewport.scrollLeft;
    const previousTop = viewport.scrollTop;

    viewport.scrollBy({ left: scrollLeft, top: scrollTop });
    if (viewport.scrollLeft === previousLeft && viewport.scrollTop === previousTop) {
      stopAutoScroll();
      return;
    }

    updateSelectionFromPointer(selectionDrag.pointerClient);
    autoScrollFrameRef.current = requestAnimationFrame(autoScrollStep);
  }, [stopAutoScroll, updateSelectionFromPointer, viewportRef]);

  const startAutoScroll = useCallback(() => {
    if (autoScrollFrameRef.current !== null) return;
    autoScrollFrameRef.current = requestAnimationFrame(runAutoScroll);
  }, [runAutoScroll]);

  const handleCanvasPointerDown = useCallback((event) => {
    if (
      event.button !== 0 ||
      event.target.closest('.floor-plan__table-wrapper')
    ) {
      return;
    }

    const viewport = viewportRef.current;
    if (!viewport) return;

    event.preventDefault();
    const additive = isAdditiveSelectionEvent(event);
    const startContent = getContentPoint(event, viewport);

    selectionDragRef.current = {
      pointerId: event.pointerId,
      startClient: { x: event.clientX, y: event.clientY },
      startContent,
      pointerClient: { clientX: event.clientX, clientY: event.clientY },
      baseSelection: additive ? new Set(selectedTableIds) : new Set(),
      additive,
      hasMoved: false,
    };

    if (!additive) clearSelectedTables();
    setSelectionRect(null);
    viewport.setPointerCapture(event.pointerId);
  }, [clearSelectedTables, selectedTableIds, viewportRef]);

  const handleCanvasPointerMove = useCallback((event) => {
    const selectionDrag = selectionDragRef.current;
    const viewport = viewportRef.current;
    if (!selectionDrag || !viewport || selectionDrag.pointerId !== event.pointerId) return;

    const pointerClient = { clientX: event.clientX, clientY: event.clientY };
    const dx = pointerClient.clientX - selectionDrag.startClient.x;
    const dy = pointerClient.clientY - selectionDrag.startClient.y;
    if (!selectionDrag.hasMoved && Math.abs(dx) <= 3 && Math.abs(dy) <= 3) return;

    selectionDrag.hasMoved = true;
    updateSelectionFromPointer(pointerClient);
    startAutoScroll();
  }, [startAutoScroll, updateSelectionFromPointer, viewportRef]);

  const handleCanvasPointerUp = useCallback((event) => {
    const selectionDrag = selectionDragRef.current;
    const viewport = viewportRef.current;
    if (!selectionDrag || !viewport || selectionDrag.pointerId !== event.pointerId) return;

    if (!selectionDrag.hasMoved && !selectionDrag.additive) clearSelectedTables();
    if (viewport.hasPointerCapture?.(event.pointerId)) {
      viewport.releasePointerCapture(event.pointerId);
    }

    stopAutoScroll();
    selectionDragRef.current = null;
    setSelectionRect(null);
  }, [clearSelectedTables, stopAutoScroll, viewportRef]);

  useEffect(() => stopAutoScroll, [stopAutoScroll]);

  return {
    selectedTableIds,
    selectionRect,
    clearSelectedTables,
    selectTableFromPointer,
    handleTableWrapperPointerDown,
    handleTableWrapperClickCapture,
    handleCanvasPointerDown,
    handleCanvasPointerMove,
    handleCanvasPointerUp,
  };
}
