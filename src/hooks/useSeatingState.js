import { useState, useCallback, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { saveStateToFirebase, useFirebaseListener } from './useFirebase';
import { db } from '../firebase';
import { MAX_SEATS, DEFAULT_TABLE_COUNT, AUTOSAVE_DEBOUNCE_MS, normalizeCategory } from '../utils/constants';
import { applyGuestImport } from '../utils/importGuests.js';
import { normalizePartyRole, normalizePartyRows, PARTY_ROLE_PRIMARY } from '../utils/partyRows.js';
import {
  DEFAULT_SEATING_RULES,
  buildAutoSeatFingerprint,
  normalizeLockedAssignments,
  normalizeSeatingRules,
} from '../utils/autoSeatPlanner.js';
import {
  normalizeGuestGroups,
  normalizeGroupPreference,
  normalizeLockedAssignmentsForGuests,
  syncGuestGroupLocks,
} from '../utils/guestGroups.js';

/** Build an empty fixed-length seat array */
function emptySeats() {
  return Array(MAX_SEATS).fill(null);
}

/** Build the initial app state: default tables, no guests */
function buildInitialState() {
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

function validateTableCapacity(tables) {
  return (tables ?? []).every(table =>
    (table.guestIds ?? []).filter(Boolean).length <= MAX_SEATS
  );
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
      tables: updatedTables,
      unassignedGuestIds: updatedUnassigned,
      lastSaved: new Date().toISOString(),
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
    const localLastSaved = stateRef.current.lastSaved;
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
      category: normalizeCategory(g.category),
      // 舊資料無 source 欄位時，預設為 'manual'（保守策略，避免回寫遺漏）
      source: g.source ?? 'manual',
      // 舊資料 note → diet 遷移（防止舊備份資料的飲食欄位消失）
      diet: g.diet ?? g.note ?? '',
      partyId: g.partyId ?? null,
      partyRole: normalizePartyRole(g.partyRole),
    }));

    const lockedAssignments = normalizeLockedAssignmentsForGuests(
      normalizeLockedAssignments(fbData.lockedAssignments),
      normalisedGuests.map(guest => guest.id)
    );
    const nextState = {
      guests: normalisedGuests,
      tables: normalisedTables,
      unassignedGuestIds: fbData.unassignedGuestIds ?? [],
      tablePositions: fbData.tablePositions ?? {},
      partyRows: normalizePartyRows(fbData.partyRows),
      guestGroups: normalizeGuestGroups(fbData.guestGroups, normalisedGuests.map(guest => guest.id), lockedAssignments),
      seatingRules: normalizeSeatingRules(fbData.seatingRules),
      lockedAssignments,
      lastSaved: fbData.lastSaved ?? null,
    };

    stateRef.current = nextState;
    setStateRaw(nextState);
    setFbReady(true);
  });

  // ─── Guest operations ───────────────────────────────────────────────────────

  const addGuest = useCallback((guestData) => {
    const newGuest = {
      id: uuidv4(),
      name: guestData.name.trim(),
      category: normalizeCategory(guestData.category),
      diet: guestData.diet?.trim() || '',
      tableId: null,
      source: 'manual', // 手動新增 → 允許回寫 Google Sheets
      partyId: null,
      partyRole: PARTY_ROLE_PRIMARY,
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
      const validGuestIds = prev.guests
        .filter(g => g.id !== guestId)
        .map(g => g.id);
      const lockedAssignments = normalizeLockedAssignmentsForGuests(prev.lockedAssignments, validGuestIds);

      return {
        ...prev,
        guests: prev.guests.filter(g => g.id !== guestId),
        tables: prev.tables.map(t => ({
          ...t,
          guestIds: t.guestIds.map(id => (id === guestId ? null : id)),
        })),
        unassignedGuestIds: prev.unassignedGuestIds.filter(id => id !== guestId),
        partyRows: (prev.partyRows ?? [])
          .map(row => {
            const guestIds = row.guestIds.filter(id => id !== guestId);
            return { ...row, guestIds, headcount: guestIds.length };
          })
          .filter(row => row.guestIds.length > 0),
        guestGroups: normalizeGuestGroups(
          (prev.guestGroups ?? []).map(group => ({
            ...group,
            guestIds: group.guestIds.filter(id => id !== guestId),
          })),
          validGuestIds,
          lockedAssignments
        ),
        lockedAssignments,
        lastSaved: new Date().toISOString(),
      };
    });
  }, [setState]);

  const updateGuest = useCallback((guestId, patch) => {
    setState(prev => {
      const current = prev.guests.find(g => g.id === guestId);
      if (!current) return prev;

      const nextName = patch.name?.trim() ?? current.name;
      const nextCategory = patch.category !== undefined ? normalizeCategory(patch.category) : current.category;
      const nextDiet = patch.diet?.trim() ?? current.diet;

      return {
        ...prev,
        guests: prev.guests.map(g =>
          g.id === guestId
            ? {
              ...g,
              name: nextName,
              category: nextCategory,
              diet: nextDiet,
            }
            : g
        ),
        partyRows: (prev.partyRows ?? []).map(row =>
          row.id === current.partyId && current.partyRole === PARTY_ROLE_PRIMARY
            ? {
              ...row,
              sourceName: nextName,
              category: nextCategory,
            }
            : row
        ),
        lastSaved: new Date().toISOString(),
      };
    });
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
      const tables = prev.tables.map(t => ({ ...t, guestIds: [...t.guestIds] }));
      const fromIdx = tables.findIndex(t => t.id === fromTableId);
      const toIdx = tables.findIndex(t => t.id === toTableId);
      if (fromIdx === -1 || toIdx === -1) return prev;

      const fromGuestId = tables[fromIdx].guestIds[fromSeatIndex];
      const toGuestId = tables[toIdx].guestIds[toSeatIndex];

      tables[fromIdx].guestIds[fromSeatIndex] = toGuestId;
      tables[toIdx].guestIds[toSeatIndex] = fromGuestId;

      let guests = prev.guests;
      if (fromTableId !== toTableId) {
        guests = prev.guests.map(g => {
          if (g.id === fromGuestId) return { ...g, tableId: toTableId };
          if (g.id === toGuestId) return { ...g, tableId: fromTableId };
          return g;
        });
      }

      return { ...prev, guests, tables, lastSaved: new Date().toISOString() };
    });
  }, [setState]);

  // ─── Table operations ────────────────────────────────────────────────────────

  const addTable = useCallback(() => {
    setState(prev => {
      const nextNum = prev.tables.length + 1;
      const newTable = {
        id: uuidv4(),
        label: `${nextNum}桌`,
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

      const releasedIds = table.guestIds.filter(Boolean);
      return {
        ...prev,
        guests: prev.guests.map(g => releasedIds.includes(g.id) ? { ...g, tableId: null } : g),
        tables: prev.tables.filter(t => t.id !== tableId),
        unassignedGuestIds: [...prev.unassignedGuestIds, ...releasedIds],
        lastSaved: new Date().toISOString(),
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
      lastSaved: new Date().toISOString(),
    }));
  }, [setState]);

  /**
   * Bulk import guests — dedup by name only (trimmed, case-sensitive).
   * Covers guests in the unassigned pool AND those already seated at tables.
   * Patches import-managed fields and applies incoming table labels when present.
   * Returns counts so the caller can show an accurate toast.
   */
  const importGuests = useCallback((guestList) => {
    let importResult = {
      added: 0,
      updated: 0,
      skipped: 0,
      assigned: 0,
      createdTables: 0,
      unassignedDueToFullTables: 0,
    };

    setState(prev => {
      const { nextState, result } = applyGuestImport(prev, guestList);
      importResult = result;
      return nextState;
    });

    return importResult;
  }, [setState]);

  const applyAutoSeatPlan = useCallback((plan) => {
    if (!plan?.nextState) {
      return { success: false, reason: '沒有可套用的自動排座預覽' };
    }

    const currentFingerprint = buildAutoSeatFingerprint(stateRef.current, plan.rules);
    if (currentFingerprint !== plan.sourceFingerprint) {
      return { success: false, reason: '座位資料已變更，請重新產生預覽。' };
    }

    const nextState = {
      ...plan.nextState,
      seatingRules: normalizeSeatingRules(plan.rules),
      lockedAssignments: normalizeLockedAssignments(plan.nextState.lockedAssignments),
      guestGroups: normalizeGuestGroups(
        plan.nextState.guestGroups,
        plan.nextState.guests.map(guest => guest.id),
        plan.nextState.lockedAssignments
      ),
      lastSaved: new Date().toISOString(),
    };

    if (!validateTableCapacity(nextState.tables)) {
      return { success: false, reason: `自動排座結果超過每桌 ${MAX_SEATS} 位限制，已取消套用。` };
    }

    setState(nextState);
    return { success: true };
  }, [setState]);

  const createGuestGroup = useCallback((groupInput) => {
    setState(prev => {
      const validGuestIds = prev.guests.map(guest => guest.id);
      const guestIds = Array.from(new Set(groupInput.guestIds ?? []))
        .filter(guestId => validGuestIds.includes(guestId));
      if (guestIds.length === 0) return prev;

      const nextGroups = normalizeGuestGroups([
        ...(prev.guestGroups ?? []),
        {
          id: uuidv4(),
          name: groupInput.name?.trim() || `群組 ${((prev.guestGroups ?? []).length + 1)}`,
          guestIds,
          sourcePartyId: null,
          preference: normalizeGroupPreference(groupInput.preference),
          locked: false,
          notes: groupInput.notes?.trim() ?? '',
        },
      ], validGuestIds, prev.lockedAssignments);

      return {
        ...prev,
        guestGroups: nextGroups,
        lastSaved: new Date().toISOString(),
      };
    });
  }, [setState]);

  const updateGuestGroup = useCallback((groupId, patch) => {
    setState(prev => {
      const validGuestIds = prev.guests.map(guest => guest.id);
      const nextGroups = normalizeGuestGroups(
        (prev.guestGroups ?? []).map(group => {
          if (group.id !== groupId) return group;
          return {
            ...group,
            ...patch,
            name: patch.name !== undefined ? patch.name : group.name,
            preference: patch.preference !== undefined
              ? normalizeGroupPreference(patch.preference)
              : group.preference,
          };
        }),
        validGuestIds,
        prev.lockedAssignments
      );

      return {
        ...prev,
        guestGroups: nextGroups,
        lastSaved: new Date().toISOString(),
      };
    });
  }, [setState]);

  const removeGuestFromGroup = useCallback((groupId, guestId) => {
    setState(prev => ({
      ...prev,
      guestGroups: normalizeGuestGroups(
        (prev.guestGroups ?? []).map(group =>
          group.id === groupId
            ? { ...group, guestIds: group.guestIds.filter(id => id !== guestId) }
            : group
        ),
        prev.guests.map(guest => guest.id),
        prev.lockedAssignments
      ),
      lastSaved: new Date().toISOString(),
    }));
  }, [setState]);

  const removeGuestGroup = useCallback((groupId) => {
    setState(prev => ({
      ...prev,
      guestGroups: (prev.guestGroups ?? []).filter(group => group.id !== groupId),
      lastSaved: new Date().toISOString(),
    }));
  }, [setState]);

  const toggleGuestLock = useCallback((guestId, locked) => {
    setState(prev => {
      const guestExists = prev.guests.some(guest => guest.id === guestId);
      if (!guestExists) return prev;

      const lockedAssignments = { ...(prev.lockedAssignments ?? {}) };
      if (locked) lockedAssignments[guestId] = true;
      else delete lockedAssignments[guestId];

      return {
        ...prev,
        lockedAssignments,
        guestGroups: syncGuestGroupLocks(prev.guestGroups, lockedAssignments),
        lastSaved: new Date().toISOString(),
      };
    });
  }, [setState]);

  const toggleGroupLock = useCallback((groupId, locked) => {
    setState(prev => {
      const targetGroup = (prev.guestGroups ?? []).find(group => group.id === groupId);
      if (!targetGroup) return prev;

      const validGuestIds = new Set(prev.guests.map(guest => guest.id));
      const lockedAssignments = { ...(prev.lockedAssignments ?? {}) };
      targetGroup.guestIds
        .filter(guestId => validGuestIds.has(guestId))
        .forEach(guestId => {
          if (locked) lockedAssignments[guestId] = true;
          else delete lockedAssignments[guestId];
        });

      return {
        ...prev,
        lockedAssignments,
        guestGroups: syncGuestGroupLocks(
          (prev.guestGroups ?? []).map(group =>
            group.id === groupId ? { ...group, locked } : group
          ),
          lockedAssignments
        ),
        lastSaved: new Date().toISOString(),
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
    total: state.guests.length,
    partyTotal: (state.partyRows ?? []).length,
    seatTotal: state.guests.length,
    // Use != null (not !==) to catch both null and undefined (Firebase omits null fields)
    assigned: state.guests.filter(g => g.tableId != null).length,
    assignedSeats: state.guests.filter(g => g.tableId != null).length,
    // Derive unassigned from guests array (same source as `assigned`) to stay consistent
    // during Firebase sync. unassignedGuestIds may lag one tick behind guests in edge cases.
    unassigned: state.guests.filter(g => g.tableId == null).length,
    unassignedSeats: state.guests.filter(g => g.tableId == null).length,
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
    applyAutoSeatPlan,
    createGuestGroup,
    updateGuestGroup,
    removeGuestFromGroup,
    removeGuestGroup,
    toggleGuestLock,
    toggleGroupLock,
    updateTablePosition,
    resetAll,
  };
}
