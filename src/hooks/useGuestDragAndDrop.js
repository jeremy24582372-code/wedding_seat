import { useCallback, useEffect, useMemo, useState } from 'react';
import { PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { moveGuestByDropTarget, resolveDropTarget } from '../utils/dndDrop';
import { createCenterOnPointerModifier } from '../utils/dndOverlay';

export function useGuestDragAndDrop({
  state,
  getGuestById,
  moveGuestWithLockPrompt,
  swapGuestsWithLockPrompt,
  toast,
}) {
  const [activeGuestId, setActiveGuestId] = useState(null);
  const activeGuest = useMemo(
    () => activeGuestId ? getGuestById(activeGuestId) : null,
    [activeGuestId, getGuestById]
  );
  const lastPointer = useMemo(() => ({ current: { x: 0, y: 0 } }), []);

  useEffect(() => {
    const track = (event) => {
      lastPointer.current = { x: event.clientX, y: event.clientY };
    };
    window.addEventListener('pointermove', track, { passive: true });
    window.addEventListener('pointerup', track, { passive: true });
    return () => {
      window.removeEventListener('pointermove', track);
      window.removeEventListener('pointerup', track);
    };
  }, [lastPointer]);

  // Modifier array for DragOverlay — keeps ghost centred on cursor
  const dragOverlayModifiers = useMemo(
    () => [createCenterOnPointerModifier(lastPointer)],
    [lastPointer]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const handleDragStart = useCallback(({ active }) => {
    setActiveGuestId(active.id);
  }, []);

  const handleDragEnd = useCallback(({ active, over }) => {
    setActiveGuestId(null);

    const dropTarget = resolveDropTarget({
      over,
      pointer: lastPointer.current,
      elementsFromPoint: document.elementsFromPoint.bind(document),
    });

    moveGuestByDropTarget({
      guestId: active.id,
      dropTarget,
      tables: state.tables,
      moveGuest: moveGuestWithLockPrompt,
      swapGuests: swapGuestsWithLockPrompt,
      toast,
    });
  }, [lastPointer, moveGuestWithLockPrompt, state.tables, swapGuestsWithLockPrompt, toast]);

  const handleDragCancel = useCallback(() => {
    setActiveGuestId(null);
  }, []);

  return {
    activeGuest,
    sensors,
    handleDragStart,
    handleDragEnd,
    handleDragCancel,
    dragOverlayModifiers,
  };
}
