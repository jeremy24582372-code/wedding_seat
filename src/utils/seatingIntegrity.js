import { MAX_SEATS, normalizeCategory } from './constants.js';
import { normalizeLockedAssignments, normalizeSeatingRules } from './autoSeatPlanner.js';
import { normalizeGuestGroups, normalizeLockedAssignmentsForGuests } from './guestGroups.js';
import { normalizePartyRole, normalizePartyRows } from './partyRows.js';
import { emptySeats } from './seatingHelpers.js';

function normalizeId(value) {
  return String(value ?? '').trim();
}

function listValues(value) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value)
    .sort(([left], [right]) => Number(left) - Number(right))
    .map(([, item]) => item);
}

function uniqueIds(values, validGuestIds = null) {
  const valid = validGuestIds ? new Set(validGuestIds) : null;
  const seen = new Set();
  return (values ?? [])
    .map(normalizeId)
    .filter(id => {
      if (!id || seen.has(id)) return false;
      if (valid && !valid.has(id)) return false;
      seen.add(id);
      return true;
    });
}

function orderedSeatEntries(guestIds) {
  return Object.entries(guestIds ?? {})
    .map(([index, guestId]) => ({
      index: Number(index),
      guestId: normalizeId(guestId),
    }))
    .filter(entry => Number.isInteger(entry.index) && entry.guestId)
    .sort((a, b) => a.index - b.index);
}

function buildGuestTableMap(tables) {
  const tableIdByGuestId = new Map();
  (tables ?? []).forEach(table => {
    (table.guestIds ?? []).forEach(guestId => {
      if (guestId) tableIdByGuestId.set(guestId, table.id);
    });
  });
  return tableIdByGuestId;
}

function normalizeGuestRecords(guests) {
  const seenGuestIds = new Set();
  return listValues(guests)
    .map(guest => {
      const id = normalizeId(guest?.id);
      if (!id || seenGuestIds.has(id)) return null;
      seenGuestIds.add(id);

      return {
        ...guest,
        id,
        name: String(guest?.name ?? '').trim(),
        tableId: guest?.tableId ?? null,
        category: normalizeCategory(guest?.category),
        source: guest?.source ?? 'manual',
        diet: guest?.diet ?? guest?.note ?? '',
        partyId: guest?.partyId ?? null,
        partyRole: normalizePartyRole(guest?.partyRole),
        nameEdited: guest?.nameEdited === true, // Preserve user-locked companion names; fallback false for old data
      };
    })
    .filter(guest => guest && guest.name);
}

function normalizeTableRecords(tables, validGuestIds) {
  const assignedGuestIds = new Set();
  const releasedGuestIds = [];

  const normalizedTables = listValues(tables)
    .map(table => {
      const id = normalizeId(table?.id);
      const label = String(table?.label ?? '').trim();
      if (!id || !label) return null;

      const seats = emptySeats();
      orderedSeatEntries(table?.guestIds).forEach(({ index, guestId }) => {
        if (!validGuestIds.has(guestId)) return;
        if (assignedGuestIds.has(guestId)) return;

        if (index >= 0 && index < MAX_SEATS && seats[index] === null) {
          seats[index] = guestId;
          assignedGuestIds.add(guestId);
          return;
        }

        releasedGuestIds.push(guestId);
      });

      return {
        ...table,
        id,
        label,
        seats: MAX_SEATS,
        guestIds: seats,
      };
    })
    .filter(Boolean);

  return {
    tables: normalizedTables,
    assignedGuestIds,
    releasedGuestIds: uniqueIds(releasedGuestIds, validGuestIds),
  };
}

function normalizeUnassignedGuestIds(rawIds, guests, assignedGuestIds, extraReleasedIds = []) {
  const validGuestIds = new Set((guests ?? []).map(guest => guest.id));
  const allUnassignedCandidates = [
    ...(rawIds ?? []),
    ...extraReleasedIds,
    ...guests
      .filter(guest => !assignedGuestIds.has(guest.id))
      .map(guest => guest.id),
  ];

  return uniqueIds(allUnassignedCandidates, validGuestIds)
    .filter(guestId => !assignedGuestIds.has(guestId));
}

function normalizeTablePositions(positions, validTableIds) {
  const valid = new Set(validTableIds);
  return Object.entries(positions ?? {}).reduce((acc, [tableId, position]) => {
    if (!valid.has(tableId)) return acc;
    const x = Number(position?.x);
    const y = Number(position?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return acc;
    acc[tableId] = { x, y };
    return acc;
  }, {});
}

function normalizePartyRowsForGuests(partyRows, validGuestIds) {
  const valid = new Set(validGuestIds);
  return normalizePartyRows(listValues(partyRows))
    .map(row => ({
      ...row,
      guestIds: uniqueIds(row.guestIds, valid),
    }))
    .filter(row => row.guestIds.length > 0)
    .map(row => ({
      ...row,
      headcount: row.guestIds.length,
    }));
}

export function createNextTableLabel(tables = []) {
  const usedNumbers = new Set(
    (tables ?? [])
      .map(table => String(table?.label ?? '').replace(/\s+/g, '').match(/^(\d+)桌$/)?.[1])
      .filter(Boolean)
      .map(Number)
      .filter(number => Number.isInteger(number) && number > 0)
  );

  let nextNumber = 1;
  while (usedNumbers.has(nextNumber)) nextNumber += 1;
  return `${nextNumber}桌`;
}

export function normalizeSeatingStateFromFirebase(fbData) {
  const guests = normalizeGuestRecords(fbData?.guests);
  const validGuestIds = new Set(guests.map(guest => guest.id));
  const { tables, assignedGuestIds, releasedGuestIds } = normalizeTableRecords(
    fbData?.tables,
    validGuestIds
  );
  const tableIdByGuestId = buildGuestTableMap(tables);
  const normalizedGuests = guests.map(guest => ({
    ...guest,
    tableId: tableIdByGuestId.get(guest.id) ?? null,
  }));
  const released = new Set(releasedGuestIds);
  const lockedAssignments = normalizeLockedAssignmentsForGuests(
    normalizeLockedAssignments(fbData?.lockedAssignments),
    validGuestIds
  );
  released.forEach(guestId => {
    delete lockedAssignments[guestId];
  });
  const partyRows = normalizePartyRowsForGuests(fbData?.partyRows, validGuestIds);

  return {
    guests: normalizedGuests,
    tables,
    unassignedGuestIds: normalizeUnassignedGuestIds(
      fbData?.unassignedGuestIds,
      normalizedGuests,
      assignedGuestIds,
      releasedGuestIds
    ),
    tablePositions: normalizeTablePositions(
      fbData?.tablePositions,
      tables.map(table => table.id)
    ),
    partyRows,
    guestGroups: normalizeGuestGroups(listValues(fbData?.guestGroups), validGuestIds, lockedAssignments),
    seatingRules: normalizeSeatingRules(fbData?.seatingRules),
    lockedAssignments,
    lastSaved: fbData?.lastSaved ?? null,
  };
}

export function removeTableFromState(prev, tableId) {
  const table = (prev.tables ?? []).find(item => item.id === tableId);
  if (!table) return prev;

  const validGuestIds = new Set((prev.guests ?? []).map(guest => guest.id));
  const releasedGuestIds = uniqueIds(table.guestIds, validGuestIds);
  const released = new Set(releasedGuestIds);
  const remainingTables = (prev.tables ?? []).filter(item => item.id !== tableId);
  const tableIdByGuestId = buildGuestTableMap(remainingTables);
  const stillAssigned = new Set(tableIdByGuestId.keys());
  const lockedAssignments = Object.entries(prev.lockedAssignments ?? {}).reduce((acc, [guestId, locked]) => {
    if (locked === true && validGuestIds.has(guestId) && !released.has(guestId)) {
      acc[guestId] = true;
    }
    return acc;
  }, {});
  const tablePositions = { ...(prev.tablePositions ?? {}) };
  delete tablePositions[tableId];

  return {
    ...prev,
    guests: (prev.guests ?? []).map(guest => ({
      ...guest,
      tableId: tableIdByGuestId.get(guest.id) ?? (released.has(guest.id) ? null : (guest.tableId ?? null)),
    })),
    tables: remainingTables,
    unassignedGuestIds: uniqueIds(
      [...(prev.unassignedGuestIds ?? []), ...releasedGuestIds],
      validGuestIds
    ).filter(guestId => !stillAssigned.has(guestId)),
    tablePositions,
    lockedAssignments,
    guestGroups: normalizeGuestGroups(prev.guestGroups, validGuestIds, lockedAssignments),
    lastSaved: new Date().toISOString(),
  };
}
