import { v4 as uuidv4 } from 'uuid';
import { MAX_SEATS, normalizeCategory } from './constants.js';

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
  const existingNames = new Set((prev.guests ?? []).map(g => g.name));

  const patchedGuests = (prev.guests ?? []).map(existing => {
    const incoming = incomingByName.get(existing.name);
    if (!incoming) return existing;

    const nextCategory = incoming.category?.trim()
      ? normalizeCategory(incoming.category)
      : existing.category;
    const nextDiet = incoming.diet?.trim()
      ? incoming.diet.trim()
      : existing.diet;

    if (nextCategory !== existing.category || nextDiet !== existing.diet) {
      return { ...existing, category: nextCategory, diet: nextDiet };
    }
    return existing;
  });

  const newGuests = [];
  incomingGuests.forEach(g => {
    if (existingNames.has(g.name)) {
      result.skipped += 1;
      return;
    }

    newGuests.push({
      id:       uuidv4(),
      name:     g.name,
      category: normalizeCategory(g.category),
      diet:     g.diet?.trim() || '',
      tableId:  null,
      source:   'import',
    });
    result.added += 1;
  });

  const guests = [...patchedGuests, ...newGuests];
  const guestByName = new Map(guests.map(g => [g.name, g]));
  const tables = (prev.tables ?? []).map(t => ({
    ...t,
    guestIds: Array.from({ length: MAX_SEATS }, (_, i) => t.guestIds?.[i] ?? null),
  }));

  incomingGuests.forEach(incoming => {
    const tableLabel = getIncomingTableLabel(incoming);
    if (!tableLabel) return;

    const guest = guestByName.get(incoming.name);
    if (!guest) return;

    const table = ensureImportTable(tables, tableLabel, result);
    if (!table) return;

    removeGuestFromTableSeats(tables, guest.id);
    const seatIndex = table.guestIds.indexOf(null);
    if (seatIndex === -1) {
      result.unassignedDueToFullTables += 1;
      return;
    }

    table.guestIds[seatIndex] = guest.id;
    result.assigned += 1;
  });

  const derived = deriveGuestTableState(guests, tables);

  return {
    result,
    nextState: {
      ...prev,
      guests:             derived.guests,
      tables,
      unassignedGuestIds: derived.unassignedGuestIds,
      lastSaved:          new Date().toISOString(),
    },
  };
}
