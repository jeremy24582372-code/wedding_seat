import { useState, useCallback, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { saveStateToFirebase, useFirebaseListener } from './useFirebase';
import { db } from '../firebase';
import { MAX_SEATS, DEFAULT_TABLE_COUNT, AUTOSAVE_DEBOUNCE_MS } from '../utils/constants';

/** Build an empty fixed-length seat array */
function emptySeats() {
  return Array(MAX_SEATS).fill(null);
}

/** Build the initial app state: default tables, no guests */
function buildInitialState() {
  const tables = Array.from({ length: DEFAULT_TABLE_COUNT }, (_, i) => ({
    id:       uuidv4(),
    label:    `${i + 1}桌`,
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

function computeGuestMove(prev, guestId, targetTableId, seatIndex = null) {
  const guest = prev.guests.find(g => g.id === guestId);
  if (!guest) {
    return { nextState: prev, result: { success: false, reason: '賓客不存在' } };
  }

  // Clear the guest from any previous seat before evaluating the target.
  // The transition remains pure; callers decide whether to commit nextState.
  const updatedTables = prev.tables.map(t => ({
    ...t,
    guestIds: t.guestIds.map(id => (id === guestId ? null : id)),
  }));
  let updatedUnassigned = prev.unassignedGuestIds.filter(id => id !== guestId);

  if (targetTableId !== null) {
    const tableIdx = updatedTables.findIndex(t => t.id === targetTableId);
    if (tableIdx === -1) {
      return { nextState: prev, result: { success: false, reason: '桌次不存在' } };
    }

    const seats = [...updatedTables[tableIdx].guestIds];

    if (seatIndex !== null) {
      if (!Number.isInteger(seatIndex) || seatIndex < 0 || seatIndex >= MAX_SEATS) {
        return { nextState: prev, result: { success: false, reason: '座位不存在' } };
      }

      if (seats[seatIndex] !== null && seats[seatIndex] !== guestId) {
        return { nextState: prev, result: { success: false, reason: '該座位已有人' } };
      }
      seats[seatIndex] = guestId;
    } else {
      const emptyIdx = seats.indexOf(null);
      if (emptyIdx === -1) {
        return {
          nextState: prev,
          result: { success: false, reason: `${updatedTables[tableIdx].label} 已滿 (${MAX_SEATS} 人)` },
        };
      }
      seats[emptyIdx] = guestId;
    }

    updatedTables[tableIdx] = { ...updatedTables[tableIdx], guestIds: seats };
  } else {
    updatedUnassigned = [...updatedUnassigned, guestId];
  }

  return {
    nextState: {
      ...prev,
      guests: prev.guests.map(g =>
        g.id === guestId ? { ...g, tableId: targetTableId } : g
      ),
      tables:             updatedTables,
      unassignedGuestIds: updatedUnassigned,
      lastSaved:          new Date().toISOString(),
    },
    result: { success: true },
  };
}

/**
 * Core seating state management backed by Firebase Realtime Database.
 * Firebase is the single source of truth — all mutations auto-save with debounce.
 */
export function useSeatingState() {
  const [state, setStateRaw] = useState(buildInitialState);
  const stateRef = useRef(state);
  // Debounced Firebase save
  const saveTimer = useRef(null);
  const pendingState = useRef(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

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

  const scheduleFirebaseSave = useCallback((next) => {
    pendingState.current = next;

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveStateToFirebase(next).catch(err =>
        console.error('[useSeatingState] Firebase save failed:', err)
      );
      saveTimer.current = null;
      pendingState.current = null;
    }, AUTOSAVE_DEBOUNCE_MS);
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
    const prev = stateRef.current;
    const next = typeof valueOrUpdater === 'function' ? valueOrUpdater(prev) : valueOrUpdater;

    if (Object.is(next, prev)) return next;

    stateRef.current = next;
    scheduleFirebaseSave(next);
    setStateRaw(next);
    return next;
  }, [scheduleFirebaseSave]);

  // When Firebase is unconfigured (db === null), subscribeToState is a no-op and
  // never calls our callback — fbReady would stay false forever. Initialise to
  // true immediately when db is null so the app renders in local-only mode.
  // (Avoids calling setState synchronously inside an effect — react-hooks/set-state-in-effect)
  const [fbReady, setFbReady] = useState(() => !db);

  // Subscribe to Firebase — loads initial state and reacts to external changes
  useFirebaseListener((fbData) => {
    if (!fbData) {
      // No data in Firebase yet — keep the local initial state and mark ready
      setFbReady(true);
      return;
    }

    // ─── 防止 Firebase 舊資料回滾本地較新的狀態 ──────────────────────────────
    // 當 debounce 尚未寫入 Firebase 時，Firebase listener 可能收到「比本地還舊」
    // 的快照，若直接覆蓋 stateRef 會導致剛匯入的賓客消失，下次匯入誤判無重複。
    const localLastSaved  = stateRef.current.lastSaved;
    const remoteLastSaved = fbData.lastSaved ?? null;
    if (
      localLastSaved &&
      remoteLastSaved &&
      new Date(remoteLastSaved) < new Date(localLastSaved)
    ) {
      // Firebase 資料較舊 — 等待 debounce 把本地狀態寫上去後再同步
      // 仍要標記 fbReady，避免 UI 永久 loading
      setFbReady(true);
      return;
    }

    // Normalise: Firebase drops null values in arrays; restore them
    const normalisedTables = (fbData.tables ?? []).map(t => ({
      ...t,
      guestIds: Array.from({ length: MAX_SEATS }, (_, i) => t.guestIds?.[i] ?? null),
    }));

    // Firebase also drops null on object fields (e.g. guest.tableId becomes undefined).
    // Normalise back to null so strict equality checks (tableId !== null) work correctly.
    // Legacy normalization: old records stored dietary info in `note`; migrate to `diet`.
    const normalisedGuests = (fbData.guests ?? []).map(g => ({
      ...g,
      tableId: g.tableId ?? null,
      // 舊資料無 source 欄位時，預設為 'manual'（保守策略，避免回寫遺漏）
      source:  g.source ?? 'manual',
      // 舊資料 note → diet 遷移（防止舊備份資料的飲食欄位消失）
      diet:    g.diet ?? g.note ?? '',
    }));

    const nextState = {
      guests:             normalisedGuests,
      tables:             normalisedTables,
      unassignedGuestIds: fbData.unassignedGuestIds ?? [],
      tablePositions:     fbData.tablePositions     ?? {},
      lastSaved:          fbData.lastSaved          ?? null,
    };

    stateRef.current = nextState;
    setStateRaw(nextState);
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
      source:   'manual', // 手動新增 → 允許回寫 Google Sheets
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

  const moveGuest = useCallback((guestId, targetTableId, seatIndex = null) => {
    const { nextState, result } = computeGuestMove(
      stateRef.current,
      guestId,
      targetTableId,
      seatIndex
    );

    if (result.success) setState(nextState);
    return result;
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
        label:    `${nextNum}桌`,
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
    setState(prev => {
      const trimmed = newLabel.trim();
      // Guard: don't allow renaming to a label already used by another table
      const duplicate = trimmed && prev.tables.some(
        t => t.id !== tableId && t.label === trimmed
      );
      return {
        ...prev,
        tables: prev.tables.map(t =>
          t.id === tableId
            ? { ...t, label: (!trimmed || duplicate) ? t.label : trimmed }
            : t
        ),
        lastSaved: new Date().toISOString(),
      };
    });
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
    // Use a ref to capture stats out of the setState updater
    const statsRef = { added: 0, skipped: 0 };

    setState(prev => {
      // Build lookup for existing guests by name+category key.
      // This includes ALL guests — unassigned AND those already seated at tables —
      // so anyone already in the seating chart is also skipped.
      const existingKeyMap = new Map(
        prev.guests.map(g => [`${g.name}|${g.category}`, g])
      );

      const newGuests = [];
      // For guests that already exist, patch their diet if the incoming value
      // is non-empty and differs from what's stored (covers the case where
      // dietary info was added to the source sheet after the first import).
      const patchedGuests = prev.guests.map(existing => {
        const matchKey = `${existing.name}|${existing.category}`;
        const incoming = guestList.find(g => {
          const cat = (g.category || '').trim() || '其他';
          return `${g.name.trim()}|${cat}` === matchKey;
        });
        if (incoming && incoming.diet?.trim() && incoming.diet.trim() !== existing.diet) {
          return { ...existing, diet: incoming.diet.trim() };
        }
        return existing;
      });

      // Normalise category BEFORE dedup comparison so the key matches
      // how data is stored in Firebase (empty string → '其他').
      guestList.forEach(g => {
        const cat = (g.category || '').trim() || '其他';
        if (!existingKeyMap.has(`${g.name.trim()}|${cat}`)) {
          newGuests.push({
            id:       uuidv4(),
            name:     g.name.trim(),
            category: cat,
            diet:     g.diet?.trim() || '',
            tableId:  null,
            source:   'import', // 從 Google Sheets 匯入 → 不回寫
          });
        }
      });

      statsRef.added   = newGuests.length;
      statsRef.skipped = guestList.length - newGuests.length;

      return {
        ...prev,
        guests:             [...patchedGuests, ...newGuests],
        unassignedGuestIds: [...prev.unassignedGuestIds, ...newGuests.map(g => g.id)],
        lastSaved:          new Date().toISOString(),
      };
    });

    return statsRef; // { added, skipped }
  }, [setState]);

  const resetAll = useCallback(() => {
    setState(buildInitialState());
  }, [setState]);

  // ─── Derived helpers ─────────────────────────────────────────────────────────

  const getGuestById = useCallback((id) => state.guests.find(g => g.id === id), [state.guests]);
  const getTableById = useCallback((id) => state.tables.find(t => t.id === id), [state.tables]);

  const stats = {
    total:      state.guests.length,
    // Use != null (not !==) to catch both null and undefined (Firebase omits null fields)
    assigned:   state.guests.filter(g => g.tableId != null).length,
    // Derive unassigned from guests array (same source as `assigned`) to stay consistent
    // during Firebase sync. unassignedGuestIds may lag one tick behind guests in edge cases.
    unassigned: state.guests.filter(g => g.tableId == null).length,
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
