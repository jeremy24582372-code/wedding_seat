import { useCallback, useEffect, useRef, useState } from 'react';

const PAN_EXCLUSION_SELECTOR = [
  '.floor-plan__table-wrapper',
  '.floor-plan__ctrl-btn',
  '.floor-plan__legend',
  '.floor-plan__mode-panel',
].join(', ');

export function useFloorPlanViewport({ onBackgroundClick }) {
  const canvasRef = useRef(null);
  const panStart = useRef(null);
  const panMovedRef = useRef(false);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(0.85);

  const handleCanvasPointerDown = useCallback((event) => {
    const isMiddleButton = event.button === 1;
    const isLeftBackground =
      event.button === 0 && !event.target.closest(PAN_EXCLUSION_SELECTOR);

    if (!isMiddleButton && !isLeftBackground) return;

    event.preventDefault();
    panMovedRef.current = false;
    panStart.current = {
      x: event.clientX,
      y: event.clientY,
      panX: pan.x,
      panY: pan.y,
    };
    canvasRef.current?.setPointerCapture(event.pointerId);
    canvasRef.current?.classList.add('floor-plan__canvas--panning');
  }, [pan.x, pan.y]);

  const handleCanvasPointerMove = useCallback((event) => {
    if (!panStart.current) return;

    const dx = event.clientX - panStart.current.x;
    const dy = event.clientY - panStart.current.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) panMovedRef.current = true;

    setPan({
      x: panStart.current.panX + dx,
      y: panStart.current.panY + dy,
    });
  }, []);

  const handleCanvasPointerUp = useCallback((event) => {
    if (!panStart.current) return;

    panStart.current = null;
    if (canvasRef.current?.hasPointerCapture?.(event.pointerId)) {
      canvasRef.current.releasePointerCapture(event.pointerId);
    }
    canvasRef.current?.classList.remove('floor-plan__canvas--panning');
  }, []);

  const handleWheel = useCallback((event) => {
    event.preventDefault();
    const delta = event.deltaY > 0 ? -0.06 : 0.06;
    setZoom(value => Math.min(2, Math.max(0.3, value + delta)));
  }, []);

  useEffect(() => {
    const element = canvasRef.current;
    if (!element) return undefined;

    element.addEventListener('wheel', handleWheel, { passive: false });
    return () => element.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  const handleCanvasClick = useCallback((event) => {
    if (panMovedRef.current) {
      panMovedRef.current = false;
      return;
    }

    if (
      !event.shiftKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.target.closest('.floor-plan__table-wrapper')
    ) {
      onBackgroundClick();
    }
  }, [onBackgroundClick]);

  const resetView = useCallback(() => {
    setPan({ x: 0, y: 0 });
    setZoom(0.85);
  }, []);

  const zoomIn = useCallback(() => {
    setZoom(value => Math.min(2, value + 0.1));
  }, []);

  const zoomOut = useCallback(() => {
    setZoom(value => Math.max(0.3, value - 0.1));
  }, []);

  return {
    canvasRef,
    pan,
    zoom,
    zoomIn,
    zoomOut,
    resetView,
    handleCanvasClick,
    handleCanvasPointerDown,
    handleCanvasPointerMove,
    handleCanvasPointerUp,
  };
}
