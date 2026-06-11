import { useCallback, useEffect, useRef, useState } from 'react';

function normalizeWheelDelta(delta, deltaMode, pageSize) {
  if (deltaMode === 1) return delta * 16;
  if (deltaMode === 2) return delta * pageSize;
  return delta;
}

export function useFloorPlanViewport() {
  const viewportRef = useRef(null);
  const [zoom, setZoom] = useState(0.85);

  const resetView = useCallback(() => {
    setZoom(0.85);
    requestAnimationFrame(() => {
      viewportRef.current?.scrollTo({ left: 0, top: 0 });
    });
  }, []);

  const zoomIn = useCallback(() => {
    setZoom(value => Math.min(2, value + 0.1));
  }, []);

  const zoomOut = useCallback(() => {
    setZoom(value => Math.max(0.3, value - 0.1));
  }, []);

  const handleWheel = useCallback((event) => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    event.preventDefault();
    const deltaX = normalizeWheelDelta(event.deltaX, event.deltaMode, viewport.clientWidth);
    const deltaY = normalizeWheelDelta(event.deltaY, event.deltaMode, viewport.clientHeight);

    if (event.shiftKey && deltaX === 0) {
      viewport.scrollLeft += deltaY;
      return;
    }

    viewport.scrollLeft += deltaX;
    viewport.scrollTop += deltaY;
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;

    viewport.addEventListener('wheel', handleWheel, { passive: false });
    return () => viewport.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  return {
    viewportRef,
    zoom,
    zoomIn,
    zoomOut,
    resetView,
  };
}
