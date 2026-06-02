import { v4 as uuidv4 } from 'uuid';
import { MAX_SEATS, normalizeCategory } from './constants.js';
import {
  buildCompanionName,
  normalizeHeadcount,
  normalizePartyRole,
  normalizePartyRows,
  PARTY_ROLE_COMPANION,
  PARTY_ROLE_PRIMARY,
} from './partyRows.js';
import {
  ensurePartyGuestGroups,
  normalizeLockedAssignmentsForGuests,
} from './guestGroups.js';

function emptySeats() {
  return Array(MAX_SEATS).fill(null);
}

export function normalizeImportedTableLabel(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';

  const compact = raw.replace(/\s+/g, '');
  const upper = compact.toUpperCase();
  if (['-', '--', 'NA', 'N/A', '無', '無桌次', '未安排', '未分配'].includes(upper)) {
    return '';
  }

  const numericMatch =
    compact.match(/^(\d+)$/) ??
    compact.match(/^第?(\d+)桌$/) ??
    compact.match(/^桌(\d+)$/);

  if (numericMatch) return `${Number(numericMatch[1])}桌`;
  return raw;
}

function tableMatchKey(label) {
  return normalizeImportedTableLabel(label).replace(/\s+/g, '').toLowerCase();
}

function getIncomingTableLabel(guest) {
  return normalizeImportedTableLabel(guest?.tableLabel ?? guest?.table ?? guest?.['桌次']);
}

function getIncomingHeadcount(guest) {
  return normalizeHeadcount(guest?.headcount ?? guest?.['人數']);
}

function ensureImportTable(tables, label, result) {
  const normalizedLabel = normalizeImportedTableLabel(label);
  if (!normalizedLabel) return null;

  const key = tableMatchKey(normalizedLabel);
  const existing = tables.find(t => tableMatchKey(t.label) === key);
  if (existing) return existing;

  const table = {
    id: uuidv4(),
    label: normalizedLabel,
    seats: MAX_SEATS,
    guestIds: emptySeats(),
  };
  tables.push(table);
  result.createdTables += 1;
  return table;
}

function removeGuestFromTableSeats(tables, guestId) {
  tables.forEach(table => {
    table.guestIds = table.guestIds.map(id => (id === guestId ? null : id));
  });
}

function removeGuestsFromTableSeats(tables, guestIds) {
  const ids = new Set(guestIds);
  tables.forEach(table => {
    table.guestIds = table.guestIds.map(id => (ids.has(id) ? null : id));
  });
}

function deriveGuestTableState(guests, tables) {
  const tableIdByGuestId = new Map();
  tables.forEach(table => {
    table.guestIds.forEach(guestId => {
      if (guestId) tableIdByGuestId.set(guestId, table.id);
    });
  });

  const nextGuests = guests.map(g => ({
    ...g,
    tableId: tableIdByGuestId.get(g.id) ?? null,
  }));

  return {
    guests: nextGuests,
    unassignedGuestIds: nextGuests
      .filter(g => g.tableId == null)
      .map(g => g.id),
  };
}

export function applyGuestImport(prev, guestList) {
  const result = {
    added: 0,
    updated: 0,
    skipped: 0,
    assigned: 0,
    createdTables: 0,
    unassignedDueToFullTables: 0,
  };

  const incomingByName = new Map();
  (guestList ?? []).forEach(g => {
    const name = g.name?.trim();
    if (!name) return;
    if (incomingByName.has(name)) {
      result.skipped += 1;
      return;
    }
    incomingByName.set(name, { ...g, name });
  });
  const incomingGuests = Array.from(incomingByName.values());

  const tables = (prev.tables ?? []).map(t => ({
    ...t,
    guestIds: Array.from({ length: MAX_SEATS }, (_, i) => t.guestIds?.[i] ?? null),
  }));
  let guests = (prev.guests ?? []).map(g => ({
    ...g,
    category: normalizeCategory(g.category),
    diet: g.diet ?? g.note ?? '',
    tableId: g.tableId ?? null,
    partyId: g.partyId ?? null,
    partyRole: normalizePartyRole(g.partyRole),
  }));
  let partyRows = normalizePartyRows(prev.partyRows);

  const getPartyGuests = (partyId, partyGuestIds = []) => {
    const orderedIds = [
      ...partyGuestIds,
      ...guests.filter(g => g.partyId === partyId).map(g => g.id),
    ];
    const seen = new Set();
    return orderedIds
      .filter(id => {
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      })
      .map(id => guests.find(g => g.id === id))
      .filter(Boolean);
  };

  const patchGuest = (guestId, patch) => {
    guests = guests.map(g => (g.id === guestId ? { ...g, ...patch } : g));
  };

  const deleteGuestIds = (guestIds) => {
    const removeIds = new Set(guestIds);
    if (removeIds.size === 0) return;
    guests = guests.filter(g => !removeIds.has(g.id));
    removeGuestsFromTableSeats(tables, removeIds);
  };

  incomingGuests.forEach(incoming => {
    const sourceName = incoming.name;
    const category = normalizeCategory(incoming.category);
    const diet = incoming.diet?.trim() || '';
    const headcount = getIncomingHeadcount(incoming);
    const tableLabel = getIncomingTableLabel(incoming);

    const existingParty = partyRows.find(row => row.sourceName === sourceName);
    const existingPrimary = guests.find(g => g.name === sourceName);
    const partyId = existingParty?.id ?? existingPrimary?.partyId ?? uuidv4();
    const existingPartyGuests = getPartyGuests(partyId, existingParty?.guestIds);
    const isExistingSource = Boolean(existingParty || existingPrimary);

    let primaryGuest = existingPartyGuests.find(g => g.partyRole === PARTY_ROLE_PRIMARY)
      ?? existingPartyGuests.find(g => g.name === sourceName)
      ?? existingPrimary;

    if (primaryGuest) {
      patchGuest(primaryGuest.id, {
        name: sourceName,
        category,
        diet,
        source: 'import',
        partyId,
        partyRole: PARTY_ROLE_PRIMARY,
      });
    } else {
      primaryGuest = {
        id: uuidv4(),
        name: sourceName,
        category,
        diet,
        tableId: null,
        source: 'import',
        partyId,
        partyRole: PARTY_ROLE_PRIMARY,
      };
      guests = [...guests, primaryGuest];
      result.added += 1;
    }

    const refreshedPartyGuests = getPartyGuests(partyId, existingParty?.guestIds);
    const companionGuests = refreshedPartyGuests
      .filter(g => g.id !== primaryGuest.id)
      .sort((a, b) => {
        const aIndex = existingParty?.guestIds?.indexOf(a.id) ?? -1;
        const bIndex = existingParty?.guestIds?.indexOf(b.id) ?? -1;
        return aIndex - bIndex;
      });

    const desiredCompanionCount = headcount - 1;
    const keptCompanions = companionGuests.slice(0, desiredCompanionCount);
    const removedCompanions = companionGuests.slice(desiredCompanionCount);
    deleteGuestIds(removedCompanions.map(g => g.id));

    for (let i = keptCompanions.length + 1; i <= desiredCompanionCount; i += 1) {
      const companion = {
        id: uuidv4(),
        name: buildCompanionName(sourceName, i),
        category,
        diet,
        tableId: null,
        source: 'import',
        partyId,
        partyRole: PARTY_ROLE_COMPANION,
      };
      guests = [...guests, companion];
      keptCompanions.push(companion);
      result.added += 1;
    }

    keptCompanions.forEach((companion, index) => {
      patchGuest(companion.id, {
        name: buildCompanionName(sourceName, index + 1),
        category,
        diet,
        source: 'import',
        partyId,
        partyRole: PARTY_ROLE_COMPANION,
      });
    });

    const partyGuestIds = [primaryGuest.id, ...keptCompanions.map(g => g.id)];
    const partyRow = {
      id: partyId,
      sourceName,
      category,
      tableLabel,
      headcount,
      guestIds: partyGuestIds,
      source: 'import',
    };
    partyRows = [
      ...partyRows.filter(row => row.id !== partyId && row.sourceName !== sourceName),
      partyRow,
    ];

    if (isExistingSource) result.updated += 1;

    if (!tableLabel) return;

    const table = ensureImportTable(tables, tableLabel, result);
    if (!table) return;

    partyGuestIds.forEach(guestId => removeGuestFromTableSeats(tables, guestId));

    partyGuestIds.forEach(guestId => {
      const seatIndex = table.guestIds.indexOf(null);
      if (seatIndex === -1) {
        result.unassignedDueToFullTables += 1;
        return;
      }

      table.guestIds[seatIndex] = guestId;
      result.assigned += 1;
    });
  });

  const derived = deriveGuestTableState(guests, tables);
  const validGuestIds = new Set(derived.guests.map(g => g.id));
  const lockedAssignments = normalizeLockedAssignmentsForGuests(prev.lockedAssignments, validGuestIds);
  const normalizedPartyRows = partyRows
    .map(row => ({
      ...row,
      guestIds: row.guestIds.filter(guestId => validGuestIds.has(guestId)),
    }))
    .filter(row => row.guestIds.length > 0)
    .map(row => ({
      ...row,
      headcount: row.guestIds.length,
    }));

  return {
    result,
    nextState: {
      ...prev,
      guests:             derived.guests,
      tables,
      unassignedGuestIds: derived.unassignedGuestIds,
      partyRows:          normalizedPartyRows,
      guestGroups:        ensurePartyGuestGroups(prev.guestGroups, normalizedPartyRows, validGuestIds, lockedAssignments),
      lockedAssignments,
      lastSaved:          new Date().toISOString(),
    },
  };
}
