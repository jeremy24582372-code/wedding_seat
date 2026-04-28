import { useState, useCallback, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { saveStateToFirebase, useFirebaseListener } from './useFirebase';
import { MAX_SEATS, DEFAULT_TABLE_COUNT, AUTOSAVE_DEBOUNCE_MS } from '../utils/constants';

/** Build an empty fixed-length seat array */
function emptySeats() {
  return Array(MAX_SEATS).fill(null);
}

/** Build the initial app state: default tables, no guests */
function buildInitialState() {
  const tables = Array.from({ length: DEFAULT_TABLE_COUNT }, (_, i) => ({
    id:       uuidv4(),
    label:    `桌 ${i + 1}`,
    seats:    MAX_SEATS,
    guestIds: emptySeats(),
  }));

  return {
    guests:            [],
    tables,
    unassignedGuestIds: [],
    tablePositions:    {},
    lastSaved:         null,
  };
}

/**
 * Core seating state management backed by Firebase Realtime Database.
 * Firebase is the single source of truth — all mutations auto-save with debounce.
 */
export function useSeatingState() {
  const [state, setStateRaw] = useState(buildInitialState);
  const [fbReady, setFbReady] = useState(false); // true once first Firebase load completes

  // Debounced Firebase save
  const saveTimer = useRef(null);
  const pendingState = useRef(null);

  const flushToFirebase = useCallback(() => {
    if (saveTimer.current && pendingState.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
      saveStateToFirebase(pendingState.current).catch(err =>
        console.error('[useSeatingState] Firebase flush failed:', err)
      );
      pendingState.current = null;
    }
  }, []);

  // Flush on tab hide / close
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') flushToFirebase(); };
    const onUnload = () => flushToFirebase();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('beforeunload', onUnload);
    return () => {
      flushToFirebase();
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('beforeunload', onUnload);
    };
  }, [flushToFirebase]);

  /**
   * Replace local state and schedule a debounced Firebase write.
   * Accepts a next-state value or a functional updater (same API as useState).
   */
  const setState = useCallback((valueOrUpdater) => {
    setStateRaw(prev => {
      const next = typeof valueOrUpdater === 'function' ? valueOrUpdater(prev) : valueOrUpdater;
      pendingState.current = next;

      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        saveStateToFirebase(next).catch(err =>
          console.error('[useSeatingState] Firebase save failed:', err)
        );
        saveTimer.current = null;
        pendingState.current = null;
      }, AUTOSAVE_DEBOUNCE_MS);

      return next;
    });
  }, []);

  // Subscribe to Firebase — loads initial state and reacts to external changes
  useFirebaseListener((fbData) => {
    if (!fbData) {
      // No data in Firebase yet — keep the local initial state and mark ready
      setFbReady(true);
      return;
    }

    // Normalise: Firebase drops null values in arrays; restore them
    const normalisedTables = (fbData.tables ?? []).map(t => ({
      ...t,
      guestIds: Array.from({ length: MAX_SEATS }, (_, i) => t.guestIds?.[i] ?? null),
    }));

    setStateRaw({
      guests:             fbData.guests            ?? [],
      tables:             normalisedTables,
      unassignedGuestIds: fbData.unassignedGuestIds ?? [],
      tablePositions:     fbData.tablePositions     ?? {},
      lastSaved:          fbData.lastSaved          ?? null,
    });
    setFbReady(true);
  });

  // ─── Guest operations ───────────────────────────────────────────────────────

  const addGuest = useCallback((guestData) => {
    const newGuest = {
      id:       uuidv4(),
      name:     guestData.name.trim(),
      category: guestData.category || '其他',
      diet:     guestData.diet?.trim() || '',
      tableId:  null,
    };
    setState(prev => ({
      ...prev,
      guests:             [...prev.guests, newGuest],
      unassignedGuestIds: [...prev.unassignedGuestIds, newGuest.id],
      lastSaved:          new Date().toISOString(),
    }));
  }, [setState]);

  const removeGuest = useCallback((guestId) => {
    setState(prev => {
      const guest = prev.guests.find(g => g.id === guestId);
      if (!guest) return prev;

      return {
        ...prev,
        guests:  prev.guests.filter(g => g.id !== guestId),
        tables:  prev.tables.map(t => ({
          ...t,
          guestIds: t.guestIds.map(id => (id === guestId ? null : id)),
        })),
        unassignedGuestIds: prev.unassignedGuestIds.filter(id => id !== guestId),
        lastSaved: new Date().toISOString(),
      };
    });
  }, [setState]);

  const updateGuest = useCallback((guestId, patch) => {
    setState(prev => ({
      ...prev,
      guests: prev.guests.map(g =>
        g.id === guestId
          ? {
              ...g,
              name:     patch.name?.trim()  ?? g.name,
              category: patch.category      ?? g.category,
              diet:     patch.diet?.trim()  ?? g.diet,
            }
          : g
      ),
      lastSaved: new Date().toISOString(),
    }));
  }, [setState]);

  // Ref to pass result out of setState's functional updater
  const moveResultRef = useRef({ success: false });

  const moveGuest = useCallback((guestId, targetTableId, seatIndex = null) => {
    moveResultRef.current = { success: false };

    setState(prev => {
      const guest = prev.guests.find(g => g.id === guestId);
      if (!guest) {
        moveResultRef.current = { success: false, reason: '賓客不存在' };
        return prev;
      }

      // Clear current seat
      const updatedTables = prev.tables.map(t => ({
        ...t,
        guestIds: t.guestIds.map(id => (id === guestId ? null : id)),
      }));
      let updatedUnassigned = prev.unassignedGuestIds.filter(id => id !== guestId);

      if (targetTableId !== null) {
        const tableIdx = updatedTables.findIndex(t => t.id === targetTableId);
        if (tableIdx === -1) {
          moveResultRef.current = { success: false, reason: '桌次不存在' };
          return prev;
        }

        const seats = [...updatedTables[tableIdx].guestIds];

        if (seatIndex !== null) {
          if (seats[seatIndex] !== null && seats[seatIndex] !== guestId) {
            moveResultRef.current = { success: false, reason: '該座位已有人' };
            return prev;
          }
          seats[seatIndex] = guestId;
        } else {
          const emptyIdx = seats.indexOf(null);
          if (emptyIdx === -1) {
            moveResultRef.current = { success: false, reason: `${updatedTables[tableIdx].label} 已滿 (${MAX_SEATS} 人)` };
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
        tables:             updatedTables,
        unassignedGuestIds: updatedUnassigned,
        lastSaved:          new Date().toISOString(),
      };
    });

    return moveResultRef.current;
  }, [setState]);

  const swapSeatsInTable = useCallback((tableId, fromIndex, toIndex) => {
    setState(prev => {
      const tableIdx = prev.tables.findIndex(t => t.id === tableId);
      if (tableIdx === -1) return prev;

      const guestIds = [...prev.tables[tableIdx].guestIds];
      [guestIds[fromIndex], guestIds[toIndex]] = [guestIds[toIndex], guestIds[fromIndex]];

      return {
        ...prev,
        tables: prev.tables.map((t, i) => i === tableIdx ? { ...t, guestIds } : t),
        lastSaved: new Date().toISOString(),
      };
    });
  }, [setState]);

  const swapGuestsBetweenSeats = useCallback((fromTableId, fromSeatIndex, toTableId, toSeatIndex) => {
    setState(prev => {
      const tables  = prev.tables.map(t => ({ ...t, guestIds: [...t.guestIds] }));
      const fromIdx = tables.findIndex(t => t.id === fromTableId);
      const toIdx   = tables.findIndex(t => t.id === toTableId);
      if (fromIdx === -1 || toIdx === -1) return prev;

      const fromGuestId = tables[fromIdx].guestIds[fromSeatIndex];
      const toGuestId   = tables[toIdx].guestIds[toSeatIndex];

      tables[fromIdx].guestIds[fromSeatIndex] = toGuestId;
      tables[toIdx].guestIds[toSeatIndex]     = fromGuestId;

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

  // ─── Table operations ────────────────────────────────────────────────────────

  const addTable = useCallback(() => {
    setState(prev => {
      const nextNum  = prev.tables.length + 1;
      const newTable = {
        id:       uuidv4(),
        label:    `桌 ${nextNum}`,
        seats:    MAX_SEATS,
        guestIds: emptySeats(),
      };
      return { ...prev, tables: [...prev.tables, newTable], lastSaved: new Date().toISOString() };
    });
  }, [setState]);

  const removeTable = useCallback((tableId) => {
    setState(prev => {
      const table = prev.tables.find(t => t.id === tableId);
      if (!table) return prev;

      const releasedIds = table.guestIds.filter(Boolean);
      return {
        ...prev,
        guests:             prev.guests.map(g => releasedIds.includes(g.id) ? { ...g, tableId: null } : g),
        tables:             prev.tables.filter(t => t.id !== tableId),
        unassignedGuestIds: [...prev.unassignedGuestIds, ...releasedIds],
        lastSaved:          new Date().toISOString(),
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

  const updateTablePosition = useCallback((tableId, pos) => {
    setState(prev => ({
      ...prev,
      tablePositions: { ...prev.tablePositions, [tableId]: pos },
      lastSaved:      new Date().toISOString(),
    }));
  }, [setState]);

  /**
   * Bulk import guests — merges without losing existing seating.
   * Matched by name+category; new ones added to unassigned.
   */
  const importGuests = useCallback((guestList) => {
    setState(prev => {
      const existingKeys = new Set(prev.guests.map(g => `${g.name}|${g.category}`));
      const newGuests = guestList
        .filter(g => !existingKeys.has(`${g.name}|${g.category}`))
        .map(g => ({
          id:       uuidv4(),
          name:     g.name.trim(),
          category: g.category || '其他',
          diet:     g.diet?.trim() || '',
          tableId:  null,
        }));

      return {
        ...prev,
        guests:             [...prev.guests, ...newGuests],
        unassignedGuestIds: [...prev.unassignedGuestIds, ...newGuests.map(g => g.id)],
        lastSaved:          new Date().toISOString(),
      };
    });
  }, [setState]);

  const resetAll = useCallback(() => {
    setState(buildInitialState());
  }, [setState]);

  // ─── Derived helpers ─────────────────────────────────────────────────────────

  const getGuestById = useCallback((id) => state.guests.find(g => g.id === id), [state.guests]);
  const getTableById = useCallback((id) => state.tables.find(t => t.id === id), [state.tables]);

  const stats = {
    total:      state.guests.length,
    assigned:   state.guests.filter(g => g.tableId !== null).length,
    unassigned: state.unassignedGuestIds.length,
  };

  return {
    state,
    fbReady,
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
