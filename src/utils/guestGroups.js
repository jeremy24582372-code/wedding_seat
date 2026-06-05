import { v4 as uuidv4 } from 'uuid';

export const GROUP_PREFERENCES = [
  { id: 'same-table', label: '同桌優先' },
  { id: 'nearby', label: '鄰近即可' },
  { id: 'separate', label: '分開安排' },
];

const GROUP_PREFERENCE_IDS = new Set(GROUP_PREFERENCES.map(item => item.id));
const DEFAULT_GROUP_PREFERENCE = 'same-table';

function uniqueValidGuestIds(guestIds, validGuestIds) {
  const valid = validGuestIds ? new Set(validGuestIds) : null;
  const seen = new Set();
  return (guestIds ?? [])
    .map(id => String(id ?? '').trim())
    .filter(id => {
      if (!id || seen.has(id)) return false;
      if (valid && !valid.has(id)) return false;
      seen.add(id);
      return true;
    });
}

export function normalizeGroupPreference(value) {
  return GROUP_PREFERENCE_IDS.has(value) ? value : DEFAULT_GROUP_PREFERENCE;
}

export function getGroupPreferenceLabel(value) {
  return GROUP_PREFERENCES.find(item => item.id === value)?.label ?? '同桌優先';
}

export function findGuestGroupConflicts(groups = [], guests = []) {
  const guestNameById = new Map((guests ?? []).map(guest => [guest.id, guest.name]));
  const memberships = new Map();

  (groups ?? []).forEach(group => {
    (group.guestIds ?? []).forEach(guestId => {
      const id = String(guestId ?? '').trim();
      if (!id) return;
      const current = memberships.get(id) ?? [];
      current.push({
        groupId: group.id,
        groupName: group.name,
        preference: normalizeGroupPreference(group.preference),
      });
      memberships.set(id, current);
    });
  });

  return Array.from(memberships.entries())
    .filter(([, groupRefs]) => groupRefs.length > 1)
    .map(([guestId, groupRefs]) => ({
      guestId,
      guestName: guestNameById.get(guestId) ?? '未知賓客',
      groupIds: groupRefs.map(group => group.groupId),
      groupNames: groupRefs.map(group => group.groupName),
      preferences: groupRefs.map(group => group.preference),
    }));
}

export function syncGuestGroupLocks(groups, lockedAssignments = {}) {
  return (groups ?? []).map(group => ({
    ...group,
    locked: group.guestIds.length > 0 && group.guestIds.every(id => lockedAssignments[id] === true),
  }));
}

export function normalizeGuestGroups(value = [], validGuestIds = null, lockedAssignments = {}) {
  if (!Array.isArray(value)) return [];

  const groups = value
    .map(group => {
      const guestIds = uniqueValidGuestIds(group?.guestIds, validGuestIds);
      if (guestIds.length === 0) return null;

      const sourcePartyId = String(group?.sourcePartyId ?? '').trim() || null;
      const name = String(group?.name ?? '').trim() || '未命名群組';
      const notes = String(group?.notes ?? '').trim().slice(0, 200);

      return {
        id: String(group?.id ?? '').trim() || uuidv4(),
        name: name.slice(0, 100),
        guestIds,
        sourcePartyId,
        preference: normalizeGroupPreference(group?.preference),
        locked: group?.locked === true,
        notes,
      };
    })
    .filter(Boolean);

  return syncGuestGroupLocks(groups, lockedAssignments);
}

export function normalizeLockedAssignmentsForGuests(value = {}, validGuestIds = null) {
  const valid = validGuestIds ? new Set(validGuestIds) : null;
  return Object.entries(value ?? {}).reduce((acc, [guestId, locked]) => {
    const id = String(guestId ?? '').trim();
    if (!id || locked !== true) return acc;
    if (valid && !valid.has(id)) return acc;
    acc[id] = true;
    return acc;
  }, {});
}

export function ensurePartyGuestGroups(existingGroups, partyRows, validGuestIds, lockedAssignments = {}) {
  const valid = new Set(validGuestIds ?? []);
  const normalizedExisting = normalizeGuestGroups(existingGroups, valid, lockedAssignments);
  const autoPartyIds = new Set(
    (partyRows ?? [])
      .filter(row => (row.guestIds ?? []).filter(id => valid.has(id)).length > 1)
      .map(row => row.id)
  );

  const manualGroups = normalizedExisting.filter(group =>
    !group.sourcePartyId || !autoPartyIds.has(group.sourcePartyId)
  );
  const existingByPartyId = new Map(
    normalizedExisting
      .filter(group => group.sourcePartyId)
      .map(group => [group.sourcePartyId, group])
  );

  const partyGroups = (partyRows ?? [])
    .map(row => {
      const guestIds = uniqueValidGuestIds(row.guestIds, valid);
      if (guestIds.length <= 1) return null;

      const existing = existingByPartyId.get(row.id);
      return {
        id: existing?.id ?? uuidv4(),
        name: existing?.name ?? `${row.sourceName} 同行`,
        guestIds,
        sourcePartyId: row.id,
        preference: existing?.preference ?? DEFAULT_GROUP_PREFERENCE,
        locked: existing?.locked === true,
        notes: existing?.notes ?? '',
      };
    })
    .filter(Boolean);

  return normalizeGuestGroups([...manualGroups, ...partyGroups], valid, lockedAssignments);
}
