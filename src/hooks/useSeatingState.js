import { useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { MAX_SEATS, normalizeCategory } from '../utils/constants';
import { applyGuestImport } from '../utils/importGuests.js';
import { PARTY_ROLE_PRIMARY } from '../utils/partyRows.js';
import {
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
import {
  createNextTableLabel,
  removeTableFromState,
} from '../utils/seatingIntegrity.js';
import { emptySeats } from '../utils/seatingHelpers.js';
import { usePersistedSeatingStore } from './usePersistedSeatingStore.js';
import { buildInitialState, computeGuestMove, validateTableCapacity } from '../utils/seatingStateCore.js';

/**
 * Core seating state management backed by Firebase Realtime Database.
 * Firebase is the single source of truth — all mutations auto-save with debounce.
 */
export function useSeatingState() {
  const { state, stateRef, setState, fbReady } = usePersistedSeatingStore();

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
  }, [setState, stateRef]);

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
      const newTable = {
        id: uuidv4(),
        label: createNextTableLabel(prev.tables),
        seats: MAX_SEATS,
        guestIds: emptySeats(),
      };
      return { ...prev, tables: [...prev.tables, newTable], lastSaved: new Date().toISOString() };
    });
  }, [setState]);

  const removeTable = useCallback((tableId) => {
    setState(prev => removeTableFromState(prev, tableId));
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
      sourceDuplicateRows: 0,
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
  }, [setState, stateRef]);

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
