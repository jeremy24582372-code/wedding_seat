import { v4 as uuidv4 } from 'uuid';
import { AUTOSAVE_DEBOUNCE_MS, DEFAULT_TABLE_COUNT, MAX_SEATS } from './constants';
import { DEFAULT_SEATING_RULES } from './autoSeatPlanner';
import { emptySeats } from './seatingHelpers';

export { AUTOSAVE_DEBOUNCE_MS };

export function buildInitialState() {
  const tables = Array.from({ length: DEFAULT_TABLE_COUNT }, (_, i) => ({
    id: uuidv4(),
    label: `${i + 1}桌`,
    seats: MAX_SEATS,
    guestIds: emptySeats(),
  }));

  return {
    guests: [],
    tables,
    unassignedGuestIds: [],
    tablePositions: {},
    partyRows: [],
    guestGroups: [],
    seatingRules: DEFAULT_SEATING_RULES,
    lockedAssignments: {},
    lastSaved: null,
  };
}

export function validateTableCapacity(tables) {
  return (tables ?? []).every(table =>
    (table.guestIds ?? []).filter(Boolean).length <= MAX_SEATS
  );
}

export function computeGuestMove(prev, guestId, targetTableId, seatIndex = null) {
  const guest = prev.guests.find(g => g.id === guestId);
  if (!guest) {
    return { nextState: prev, result: { success: false, reason: '賓客不存在' } };
  }

  const updatedTables = prev.tables.map(table => ({
    ...table,
    guestIds: table.guestIds.map(id => (id === guestId ? null : id)),
  }));
  let updatedUnassigned = prev.unassignedGuestIds.filter(id => id !== guestId);

  if (targetTableId !== null) {
    const tableIndex = updatedTables.findIndex(table => table.id === targetTableId);
    if (tableIndex === -1) {
      return { nextState: prev, result: { success: false, reason: '桌次不存在' } };
    }

    const seats = [...updatedTables[tableIndex].guestIds];

    if (seatIndex !== null) {
      if (!Number.isInteger(seatIndex) || seatIndex < 0 || seatIndex >= MAX_SEATS) {
        return { nextState: prev, result: { success: false, reason: '座位不存在' } };
      }

      if (seats[seatIndex] !== null && seats[seatIndex] !== guestId) {
        return { nextState: prev, result: { success: false, reason: '該座位已有人' } };
      }
      seats[seatIndex] = guestId;
    } else {
      const emptyIndex = seats.indexOf(null);
      if (emptyIndex === -1) {
        return {
          nextState: prev,
          result: { success: false, reason: `${updatedTables[tableIndex].label} 已滿 (${MAX_SEATS} 人)` },
        };
      }
      seats[emptyIndex] = guestId;
    }

    updatedTables[tableIndex] = { ...updatedTables[tableIndex], guestIds: seats };
  } else {
    updatedUnassigned = [...updatedUnassigned, guestId];
  }

  return {
    nextState: {
      ...prev,
      guests: prev.guests.map(g =>
        g.id === guestId ? { ...g, tableId: targetTableId } : g
      ),
      tables: updatedTables,
      unassignedGuestIds: updatedUnassigned,
      lastSaved: new Date().toISOString(),
    },
    result: { success: true },
  };
}
