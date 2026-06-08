import { getCategoryVisual, normalizeCategory } from './constants.js';
import { getGroupPreferenceLabel } from './guestGroups.js';

export function formatExportDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function getPartyForGuest(state, guestId) {
  return (state?.partyRows ?? []).find(row => (row.guestIds ?? []).includes(guestId)) ?? null;
}

export function getGuestGroupsForGuest(state, guestId) {
  return (state?.guestGroups ?? []).filter(group => (group.guestIds ?? []).includes(guestId));
}

export function formatGuestGroupNames(state, guestId) {
  return getGuestGroupsForGuest(state, guestId)
    .map(group => group.name)
    .filter(Boolean)
    .join('、');
}

export function formatGuestGroupPreferences(state, guestId) {
  const labels = getGuestGroupsForGuest(state, guestId)
    .map(group => getGroupPreferenceLabel(group.preference))
    .filter(Boolean);
  return Array.from(new Set(labels)).join('、');
}

export function isGuestLockedForExport(state, guestId) {
  if (state?.lockedAssignments?.[guestId] === true) return true;
  return getGuestGroupsForGuest(state, guestId).some(group => group.locked === true);
}

export function formatGuestLockStatus(state, guestId) {
  return isGuestLockedForExport(state, guestId) ? '已鎖定' : '未鎖定';
}

export function buildGuestContextLabel(state, guestId) {
  const parts = [];
  const groupNames = formatGuestGroupNames(state, guestId);
  if (groupNames) parts.push(`群組：${groupNames}`);
  if (isGuestLockedForExport(state, guestId)) parts.push('已鎖定');
  return parts.join(' / ');
}

export function buildGuestExportRows(state) {
  if (!state) return [];

  const tableMap = Object.fromEntries((state.tables ?? []).map(table => [table.id, table.label]));

  return (state.guests ?? []).map(guest => {
    const party = getPartyForGuest(state, guest.id);

    return {
      姓名: guest.name,
      來源姓名: party?.sourceName ?? guest.name,
      人數: party?.headcount ?? 1,
      同行角色: guest.partyId ? (guest.partyRole === 'companion' ? '同行' : '主要') : '單人',
      關係分類: normalizeCategory(guest.category),
      飲食: guest.diet || '',
      桌次: guest.tableId ? tableMap[guest.tableId] || '未知' : '未分配',
      群組名稱: formatGuestGroupNames(state, guest.id),
      群組偏好: formatGuestGroupPreferences(state, guest.id),
      鎖定狀態: formatGuestLockStatus(state, guest.id),
    };
  });
}

export function guestDot(category) {
  const color = getCategoryVisual(category).printColor;
  return `<span class="dot" style="background:${color}"></span>`;
}
