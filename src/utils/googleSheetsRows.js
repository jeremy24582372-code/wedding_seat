import { normalizeCategory } from './constants.js';
import { normalizeHeadcountWithDiagnostics } from './partyRows.js';

export function hasSheetHeadcountField(row) {
  return (
    Object.prototype.hasOwnProperty.call(row, 'headcount') ||
    Object.prototype.hasOwnProperty.call(row, '人數')
  );
}

export function normalizeSheetGuestRow(row) {
  const hasHeadcount = hasSheetHeadcountField(row);
  const rawHeadcount = row.headcount ?? row['人數'];
  const headcountDiagnostic = normalizeHeadcountWithDiagnostics(rawHeadcount, { hasField: hasHeadcount });

  return {
    name: String(row.name || row['姓名'] || '').trim(),
    category: normalizeCategory(row.category ?? row['關係分類'] ?? row['關係']),
    tableLabel: String(row.tableLabel ?? row.table ?? row['桌次'] ?? '').trim(),
    headcount: headcountDiagnostic.value,
    _sourceHeadcountRaw: headcountDiagnostic.rawValue,
    _sourceHeadcountStatus: headcountDiagnostic.status,
    _sourceHeadcountMessage: headcountDiagnostic.message,
    _sourceMissingHeadcount: headcountDiagnostic.status === 'missing',
    // Legacy optional field; current source sheets do not need it.
    diet: String(row.diet || row['飲食'] || '').trim(),
  };
}

export function normalizeSheetGuestRows(rows) {
  return (rows ?? [])
    .map(normalizeSheetGuestRow)
    .filter(guest => guest.name.length > 0);
}
