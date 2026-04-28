import { useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useLocalStorage } from './useLocalStorage';
import { MAX_SEATS, DEFAULT_TABLE_COUNT, STORAGE_KEY } from '../utils/constants';

/** Build an empty fixed-length seat array */
function emptySeats() {
  return Array(MAX_SEATS).fill(null);
}

/** Build the initial app state: 10 empty tables, no guests */
function buildInitialState() {
  const tables = Array.from({ length: DEFAULT_TABLE_COUNT }, (_, i) => ({
    id: uuidv4(),
    label: `桌 ${i + 1}`,
    seats: MAX_SEATS,
    guestIds: emptySeats(), // fixed-length: null = empty seat
  }));

  return {
    guests: [],
    tables,
    unassignedGuestIds: [],
    tablePositions: {},   // { [tableId]: { x, y } } — free-form floor plan coords
    lastSaved: null,
  };
}

/**
 * Core seating state management.
 * All mutations auto-save to localStorage via useLocalStorage.
 */
export function useSeatingState() {
  const [state, setState] = useLocalStorage(STORAGE_KEY, buildInitialState());

  // --- Guest operations ---

  const addGuest = useCallback((guestData) => {
    const newGuest = {
      id: uuidv4(),
      name: guestData.name.trim(),
      category: guestData.category || '其他',
      note: guestData.note?.trim() || '',
      tableId: null,
    };
    setState(prev => ({
      ...prev,
      guests: [...prev.guests, newGuest],
      unassignedGuestIds: [...prev.unassignedGuestIds, newGuest.id],
      lastSaved: new Date().toISOString(),
    }));
  }, [setState]);

  const removeGuest = useCallback((guestId) => {
    setState(prev => {
      const guest = prev.guests.find(g => g.id === guestId);
      if (!guest) return prev;

      const updatedTables = prev.tables.map(t => ({
        ...t,
        // Use map→null to preserve fixed-length seat array (filter would shorten it)
        guestIds: t.guestIds.map(id => (id === guestId ? null : id)),
      }));

      return {
        ...prev,
        guests: prev.guests.filter(g => g.id !== guestId),
        tables: updatedTables,
        unassignedGuestIds: prev.unassignedGuestIds.filter(id => id !== guestId),
        lastSaved: new Date().toISOString(),
      };
    });
  }, [setState]);

  /**
   * Move a guest to a target table or back to unassigned pool.
   * @param {string} guestId
   * @param {string|null} targetTableId - null = move to unassigned
   * @returns {{ success: boolean, reason?: string }}
   */
  // Ref to safely pass result OUT of setState's functional updater.
  // Needed because React 18 concurrent mode batches setState — the closure
  // variable would always read the stale initial value { success: false }.
  const moveResultRef = useRef({ success: false });

  /**
   * Move a guest to a target table (at a specific seat index) or back to unassigned pool.
   * @param {string}      guestId
   * @param {string|null} targetTableId - null = move to unassigned
   * @param {number|null} seatIndex     - specific seat slot (0~MAX_SEATS-1); null = first empty
   * @returns {{ success: boolean, reason?: string }}
   */
  const moveGuest = useCallback((guestId, targetTableId, seatIndex = null) => {
    moveResultRef.current = { success: false };

    setState(prev => {
      const guest = prev.guests.find(g => g.id === guestId);
      if (!guest) {
        moveResultRef.current = { success: false, reason: '賓客不存在' };
        return prev;
      }

      // Remove guest from current location (clear their slot)
      const updatedTables = prev.tables.map(t => ({
        ...t,
        guestIds: t.guestIds.map(id => (id === guestId ? null : id)),
      }));
      let updatedUnassigned = prev.unassignedGuestIds.filter(id => id !== guestId);

      // Place guest at target
      if (targetTableId !== null) {
        const targetTable = prev.tables.find(t => t.id === targetTableId);
        if (!targetTable) {
          moveResultRef.current = { success: false, reason: '桌次不存在' };
          return prev;
        }

        // Work on the already-updated table array
        const tableIdx = updatedTables.findIndex(t => t.id === targetTableId);
        const seats = [...updatedTables[tableIdx].guestIds];

        if (seatIndex !== null) {
          // Specific seat requested
          if (seats[seatIndex] !== null && seats[seatIndex] !== guestId) {
            moveResultRef.current = { success: false, reason: '該座位已有人' };
            return prev;
          }
          seats[seatIndex] = guestId;
        } else {
          // Find first empty slot
          const emptyIdx = seats.indexOf(null);
          if (emptyIdx === -1) {
            moveResultRef.current = { success: false, reason: `${targetTable.label} 已滿 (${MAX_SEATS} 人)` };
            return prev;
          }
          seats[emptyIdx] = guestId;
        }

        updatedTables[tableIdx] = { ...updatedTables[tableIdx], guestIds: seats };
      } else {
        updatedUnassigned = [...updatedUnassigned, guestId];
      }

      moveResultRef.current = { success: true };
      return {
        ...prev,
        guests: prev.guests.map(g =>
          g.id === guestId ? { ...g, tableId: targetTableId } : g
        ),
        tables: updatedTables,
        unassignedGuestIds: updatedUnassigned,
        lastSaved: new Date().toISOString(),
      };
    });

    return moveResultRef.current;
  }, [setState]);

  /**
   * Swap two seats within the same table.
   */
  const swapSeatsInTable = useCallback((tableId, fromIndex, toIndex) => {
    setState(prev => {
      const tableIdx = prev.tables.findIndex(t => t.id === tableId);
      if (tableIdx === -1) return prev;

      const guestIds = [...prev.tables[tableIdx].guestIds];
      // Swap the two slots
      [guestIds[fromIndex], guestIds[toIndex]] = [guestIds[toIndex], guestIds[fromIndex]];

      const updatedTables = prev.tables.map((t, i) =>
        i === tableIdx ? { ...t, guestIds } : t
      );

      return { ...prev, tables: updatedTables, lastSaved: new Date().toISOString() };
    });
  }, [setState]);

  /**
   * Atomically swap two guest seats — works for same-table AND cross-table.
   * Either slot may be null (empty). Handles guest.tableId bookkeeping too.
   *
   * @param {string} fromTableId
   * @param {number} fromSeatIndex
   * @param {string} toTableId
   * @param {number} toSeatIndex
   */
  const swapGuestsBetweenSeats = useCallback((fromTableId, fromSeatIndex, toTableId, toSeatIndex) => {
    setState(prev => {
      const tables = prev.tables.map(t => ({ ...t, guestIds: [...t.guestIds] }));

      const fromIdx = tables.findIndex(t => t.id === fromTableId);
      const toIdx   = tables.findIndex(t => t.id === toTableId);
      if (fromIdx === -1 || toIdx === -1) return prev;

      const fromGuestId = tables[fromIdx].guestIds[fromSeatIndex];
      const toGuestId   = tables[toIdx].guestIds[toSeatIndex];

      // Swap seat slots
      tables[fromIdx].guestIds[fromSeatIndex] = toGuestId;
      tables[toIdx].guestIds[toSeatIndex]     = fromGuestId;

      // Update guest.tableId bookkeeping (only when cross-table)
      let guests = prev.guests;
      if (fromTableId !== toTableId) {
        guests = prev.guests.map(g => {
          if (g.id === fromGuestId) return { ...g, tableId: toTableId };
          if (g.id === toGuestId)   return { ...g, tableId: fromTableId };
          return g;
        });
      }

      return { ...prev, guests, tables, lastSaved: new Date().toISOString() };
    });
  }, [setState]);

  // --- Table operations ---

  const addTable = useCallback(() => {
    setState(prev => {
      const nextNum = prev.tables.length + 1;
      const newTable = {
        id: uuidv4(),
        label: `桌 ${nextNum}`,
        seats: MAX_SEATS,
        guestIds: emptySeats(),
      };
      return { ...prev, tables: [...prev.tables, newTable], lastSaved: new Date().toISOString() };
    });
  }, [setState]);

  const removeTable = useCallback((tableId) => {
    setState(prev => {
      const table = prev.tables.find(t => t.id === tableId);
      if (!table) return prev;

      // Move all guests in this table back to unassigned (filter out nulls)
      const releasedIds = table.guestIds.filter(Boolean);
      const updatedGuests = prev.guests.map(g =>
        releasedIds.includes(g.id) ? { ...g, tableId: null } : g
      );

      return {
        ...prev,
        guests: updatedGuests,
        tables: prev.tables.filter(t => t.id !== tableId),
        unassignedGuestIds: [...prev.unassignedGuestIds, ...releasedIds],
        lastSaved: new Date().toISOString(),
      };
    });
  }, [setState]);

  const renameTable = useCallback((tableId, newLabel) => {
    setState(prev => ({
      ...prev,
      tables: prev.tables.map(t =>
        t.id === tableId ? { ...t, label: newLabel.trim() || t.label } : t
      ),
      lastSaved: new Date().toISOString(),
    }));
  }, [setState]);

  /**
   * Update an existing guest's editable fields (name, category, note).
   * Preserves the guest's current seat assignment.
   */
  const updateGuest = useCallback((guestId, patch) => {
    setState(prev => ({
      ...prev,
      guests: prev.guests.map(g =>
        g.id === guestId
          ? {
              ...g,
              name:     patch.name?.trim()     ?? g.name,
              category: patch.category         ?? g.category,
              note:     patch.note?.trim()     ?? g.note,
            }
          : g
      ),
      lastSaved: new Date().toISOString(),
    }));
  }, [setState]);

  /**
   * Bulk import guests — merges new guests without losing existing seating.
   * Guests matched by name+category are skipped; new ones added to unassigned.
   */
  const importGuests = useCallback((guestList) => {
    setState(prev => {
      const existingKeys = new Set(prev.guests.map(g => `${g.name}|${g.category}`));
      const newGuests = guestList
        .filter(g => !existingKeys.has(`${g.name}|${g.category}`))
        .map(g => ({
          id: uuidv4(),
          name: g.name.trim(),
          category: g.category || '其他',
          note: g.note?.trim() || '',
          tableId: null,
        }));

      return {
        ...prev,
        guests: [...prev.guests, ...newGuests],
        unassignedGuestIds: [...prev.unassignedGuestIds, ...newGuests.map(g => g.id)],
        lastSaved: new Date().toISOString(),
      };
    });
  }, [setState]);

  /** Persist a table's floor-plan position */
  const updateTablePosition = useCallback((tableId, pos) => {
    setState(prev => ({
      ...prev,
      tablePositions: { ...prev.tablePositions, [tableId]: pos },
      lastSaved: new Date().toISOString(),
    }));
  }, [setState]);

  const resetAll = useCallback(() => {
    setState(buildInitialState());
  }, [setState]);

  // --- Derived helpers ---
  const getGuestById = useCallback((id) => state.guests.find(g => g.id === id), [state.guests]);
  const getTableById = useCallback((id) => state.tables.find(t => t.id === id), [state.tables]);

  const stats = {
    total: state.guests.length,
    assigned: state.guests.filter(g => g.tableId !== null).length,
    unassigned: state.unassignedGuestIds.length,
  };

  return {
    state,
    stats,
    getGuestById,
    getTableById,
    addGuest,
    updateGuest,
    removeGuest,
    moveGuest,
    swapSeatsInTable,
    swapGuestsBetweenSeats,
    addTable,
    removeTable,
    renameTable,
    importGuests,
    updateTablePosition,
    resetAll,
  };
}
