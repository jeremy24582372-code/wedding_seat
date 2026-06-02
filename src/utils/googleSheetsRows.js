import { normalizeCategory } from './constants.js';
import { normalizeHeadcount } from './partyRows.js';

export function hasSheetHeadcountField(row) {
  return (
    Object.prototype.hasOwnProperty.call(row, 'headcount') ||
    Object.prototype.hasOwnProperty.call(row, '人數')
  );
}

export function normalizeSheetGuestRow(row) {
  const hasHeadcount = hasSheetHeadcountField(row);

  return {
    name: String(row.name || row['姓名'] || '').trim(),
    category: normalizeCategory(row.category ?? row['關係分類'] ?? row['關係']),
    tableLabel: String(row.tableLabel ?? row.table ?? row['桌次'] ?? '').trim(),
    headcount: normalizeHeadcount(row.headcount ?? row['人數']),
    _sourceMissingHeadcount: !hasHeadcount,
    // Legacy optional field; current source sheets do not need it.
    diet: String(row.diet || row['飲食'] || '').trim(),
  };
}

export function normalizeSheetGuestRows(rows) {
  return (rows ?? [])
    .map(normalizeSheetGuestRow)
    .filter(guest => guest.name.length > 0);
}
