import { MAX_SEATS, normalizeCategory } from './constants.js';

export const PARTY_ROLE_PRIMARY = 'primary';
export const PARTY_ROLE_COMPANION = 'companion';

export function normalizeHeadcountWithDiagnostics(value, options = {}) {
  const hasField = options.hasField !== false;
  const rawValue = value;
  const rawText = String(value ?? '').trim();

  if (!hasField || rawText === '') {
    return {
      value: 1,
      rawValue,
      status: 'missing',
      message: '未提供人數，已暫以 1 位處理。',
    };
  }

  const parsed = Number(rawText);
  if (!Number.isFinite(parsed)) {
    return {
      value: 1,
      rawValue,
      status: 'invalid',
      message: '人數不是有效數字，已暫以 1 位處理。',
    };
  }

  if (parsed < 1) {
    return {
      value: 1,
      rawValue,
      status: 'below-min',
      message: '人數小於 1，已暫以 1 位處理。',
    };
  }

  if (parsed > MAX_SEATS) {
    return {
      value: MAX_SEATS,
      rawValue,
      status: 'truncated',
      message: `人數超過每桌 ${MAX_SEATS} 位上限，已截斷為 ${MAX_SEATS} 位。`,
    };
  }

  if (!Number.isInteger(parsed)) {
    return {
      value: Math.floor(parsed),
      rawValue,
      status: 'non-integer',
      message: '人數不是整數，已取整數位數處理。',
    };
  }

  return {
    value: parsed,
    rawValue,
    status: 'ok',
    message: '',
  };
}

export function normalizeHeadcount(value) {
  return normalizeHeadcountWithDiagnostics(value).value;
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
