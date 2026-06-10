/**
 * DragOverlay modifier factory — keeps the ghost token centred on the
 * **live pointer position**, not the centre of the original draggable element.
 *
 * Why a factory?
 *   The modifier needs access to a continuously-updated pointer coordinate.
 *   We pass a stable pointer source that is kept in sync via window pointermove
 *   events (already tracked in useGuestDragAndDrop). This avoids relying on
 *   `activatorEvent` (stale due to PointerSensor activation distance) and
 *   eliminates the offset that occurs when the user clicks the edge of a
 *   wide GuestCard but the small circular DragGuestToken appears at the
 *   card's centre.
 *
 * How it works:
 *   DragOverlay positions itself at activeNodeRect + transform.
 *   We override the transform so that:
 *     overlayCenter = activeNodeRect.xy + result.xy + overlaySize/2 = pointer
 *   Solving for result gives a single, pointer-driven position.
 */

/**
 * Creates a dnd-kit modifier that pins the DragOverlay centre to the pointer.
 *
 * @param {Function|{ current: { x: number, y: number } }} pointerSource
 *   A getter or stable mutable store updated with { x: clientX, y: clientY }.
 * @returns {Function} dnd-kit modifier
 */
export function createCenterOnPointerModifier(pointerSource) {
  return ({ activeNodeRect, overlayNodeRect }) => {
    if (!activeNodeRect || !overlayNodeRect) {
      return { x: 0, y: 0, scaleX: 1, scaleY: 1 };
    }

    const pointer = typeof pointerSource === 'function'
      ? pointerSource()
      : pointerSource?.current;
    if (!pointer) {
      return { x: 0, y: 0, scaleX: 1, scaleY: 1 };
    }

    // DragOverlay renders at:
    //   left = activeNodeRect.left + transform.x
    //   top  = activeNodeRect.top  + transform.y
    //
    // Overlay centre:
    //   cx = activeNodeRect.left + transform.x + overlayNodeRect.width  / 2
    //   cy = activeNodeRect.top  + transform.y + overlayNodeRect.height / 2
    //
    // We want cx === pointer.x  and  cy === pointer.y, so:
    return {
      x: pointer.x - activeNodeRect.left - overlayNodeRect.width / 2,
      y: pointer.y - activeNodeRect.top - overlayNodeRect.height / 2,
      scaleX: 1,
      scaleY: 1,
    };
  };
}
