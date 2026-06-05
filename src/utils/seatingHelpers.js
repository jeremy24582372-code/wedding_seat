import { MAX_SEATS, normalizeCategory } from './constants.js';

export function emptySeats() {
  return Array(MAX_SEATS).fill(null);
}

export function normalizeSeatArray(guestIds = []) {
  return Array.from({ length: MAX_SEATS }, (_, index) => guestIds?.[index] ?? null);
}

export function deriveGuestTableState(guests = [], tables = [], options = {}) {
  const tableIdByGuestId = new Map();

  (tables ?? []).forEach(table => {
    (table.guestIds ?? []).forEach(guestId => {
      if (guestId && !tableIdByGuestId.has(guestId)) {
        tableIdByGuestId.set(guestId, table.id);
      }
    });
  });

  const nextGuests = (guests ?? []).map(guest => ({
    ...guest,
    category: options.normalizeCategories ? normalizeCategory(guest.category) : guest.category,
    tableId: tableIdByGuestId.get(guest.id) ?? null,
  }));

  return {
    guests: nextGuests,
    unassignedGuestIds: nextGuests
      .filter(guest => guest.tableId == null)
      .map(guest => guest.id),
    tableIdByGuestId,
  };
}
