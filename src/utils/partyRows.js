import { MAX_SEATS, normalizeCategory } from './constants.js';

export const PARTY_ROLE_PRIMARY = 'primary';
export const PARTY_ROLE_COMPANION = 'companion';

export function normalizeHeadcount(value) {
  const raw = typeof value === 'string' ? value.trim() : value;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return 1;

  const whole = Math.floor(parsed);
  if (whole < 1) return 1;
  if (whole > MAX_SEATS) return MAX_SEATS;
  return whole;
}

export function normalizePartyRole(value) {
  return value === PARTY_ROLE_COMPANION ? PARTY_ROLE_COMPANION : PARTY_ROLE_PRIMARY;
}

export function buildCompanionName(sourceName, companionIndex) {
  return `${sourceName} 同行${companionIndex}`;
}

export function normalizePartyRows(partyRows = []) {
  return (partyRows ?? [])
    .map(row => {
      const id = String(row?.id ?? '').trim();
      const sourceName = String(row?.sourceName ?? '').trim();
      if (!id || !sourceName) return null;

      const guestIds = Array.isArray(row?.guestIds)
        ? row.guestIds.map(guestId => String(guestId ?? '').trim()).filter(Boolean)
        : [];

      return {
        id,
        sourceName,
        category: normalizeCategory(row?.category),
        tableLabel: String(row?.tableLabel ?? '').trim(),
        headcount: normalizeHeadcount(row?.headcount),
        guestIds,
        source: row?.source === 'manual' ? 'manual' : 'import',
      };
    })
    .filter(Boolean);
}
