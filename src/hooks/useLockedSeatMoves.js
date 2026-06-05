import { useCallback } from 'react';

export function useLockedSeatMoves({
  state,
  getGuestById,
  moveGuest,
  swapGuestsBetweenSeats,
  toast,
}) {
  const confirmLockedManualMove = useCallback((guestIds) => {
    const lockedGuests = guestIds
      .map(id => getGuestById(id))
      .filter(guest => guest && state.lockedAssignments?.[guest.id]);
    if (lockedGuests.length === 0) return true;

    const names = lockedGuests.map(guest => guest.name).join('、');
    return window.confirm(`「${names}」已鎖定座位。仍要手動移動或交換嗎？`);
  }, [getGuestById, state.lockedAssignments]);

  const moveGuestWithLockPrompt = useCallback((guestId, targetTableId, seatIndex = null) => {
    if (!confirmLockedManualMove([guestId])) {
      toast.info('已保留鎖定座位');
      return { success: false, reason: '鎖定座位未移動' };
    }
    return moveGuest(guestId, targetTableId, seatIndex);
  }, [confirmLockedManualMove, moveGuest, toast]);

  const swapGuestsWithLockPrompt = useCallback((fromTableId, fromSeatIndex, toTableId, toSeatIndex) => {
    const fromGuestId = state.tables.find(table => table.id === fromTableId)?.guestIds?.[fromSeatIndex];
    const toGuestId = state.tables.find(table => table.id === toTableId)?.guestIds?.[toSeatIndex];
    if (!confirmLockedManualMove([fromGuestId, toGuestId].filter(Boolean))) {
      toast.info('已保留鎖定座位');
      return { success: false, reason: '鎖定座位未交換' };
    }
    swapGuestsBetweenSeats(fromTableId, fromSeatIndex, toTableId, toSeatIndex);
    return { success: true };
  }, [confirmLockedManualMove, state.tables, swapGuestsBetweenSeats, toast]);

  return {
    moveGuestWithLockPrompt,
    swapGuestsWithLockPrompt,
  };
}
