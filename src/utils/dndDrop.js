export function findGuestSeat(tables, guestId) {
  for (const table of tables ?? []) {
    const seatIndex = table.guestIds?.indexOf(guestId) ?? -1;
    if (seatIndex !== -1) return { tableId: table.id, seatIndex };
  }
  return null;
}

export function findSeatDropTarget(elements) {
  for (const element of elements ?? []) {
    // Skip elements inside a visibility-hidden subtree (e.g. the hidden
    // seat-actions panel that overflows into adjacent seats).
    if (element && typeof element.checkVisibility === 'function') {
      if (!element.checkVisibility({ checkVisibilityCSS: true })) continue;
    }

    const candidate = typeof element?.closest === 'function'
      ? element.closest('[data-table-id][data-seat-index]')
      : element;
    if (typeof candidate?.getAttribute !== 'function') continue;

    const tableId = candidate.getAttribute('data-table-id');
    const seatIndexValue = candidate.getAttribute('data-seat-index');
    if (!tableId || seatIndexValue === null) continue;

    const seatIndex = Number.parseInt(seatIndexValue, 10);
    if (!Number.isInteger(seatIndex)) continue;

    return {
      tableId,
      seatIndex,
      isEmpty: candidate.getAttribute('data-seat-empty') === 'true',
    };
  }
  return null;
}

export function resolveDropTarget({ over, pointer, elementsFromPoint }) {
  if (pointer && typeof elementsFromPoint === 'function') {
    const pointerTarget = findSeatDropTarget(elementsFromPoint(pointer.x, pointer.y));
    if (pointerTarget) return pointerTarget;
  }

  const data = over?.data?.current;
  if (data && Object.hasOwn(data, 'tableId')) {
    const rawSeatIndex = data.seatIndex ?? null;
    const seatIndex = Number.isInteger(rawSeatIndex) ? rawSeatIndex : null;
    return {
      tableId: data.tableId ?? null,
      seatIndex,
      isEmpty: data.isEmpty !== false,
    };
  }

  return null;
}

export function moveGuestByDropTarget({
  guestId,
  dropTarget,
  tables,
  moveGuest,
  swapGuests,
  toast,
}) {
  if (!dropTarget) return { handled: false, success: false, reason: '沒有放置目標' };

  if (!dropTarget.isEmpty) {
    const from = findGuestSeat(tables, guestId);
    if (!from) {
      toast?.warn?.('此座位已有人；請拖到空位，或先移出原賓客。');
      return { handled: true, success: false, action: 'blocked-swap' };
    }

    const result = swapGuests(from.tableId, from.seatIndex, dropTarget.tableId, dropTarget.seatIndex);
    return {
      handled: true,
      success: result?.success !== false,
      action: 'swap',
      result,
    };
  }

  const result = moveGuest(guestId, dropTarget.tableId, dropTarget.seatIndex);
  if (!result.success) {
    toast?.warn?.(result.reason ?? '無法放入此桌');
  }
  return { handled: true, success: result.success, action: 'move', result };
}
