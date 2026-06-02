import { v4 as uuidv4 } from 'uuid';
import { CATEGORIES, MAX_SEATS, defaultTablePosition, normalizeCategory } from './constants.js';
import { normalizeGuestGroups } from './guestGroups.js';

export const DEFAULT_SEATING_RULES = {
  fillStrategy: 'balanced',
  respectExistingAssignments: true,
  maxPerCategoryPerTable: {},
  preferFillIncompleteTables: true,
  keepGroupsTogether: true,
};

const FILL_STRATEGIES = new Set(['balanced', 'category-first', 'keep-existing']);

function emptySeats() {
  return Array(MAX_SEATS).fill(null);
}

function normalizeTableLabelKey(label) {
  return String(label ?? '').trim().replace(/\s+/g, '').toLowerCase();
}

function isMainTableForAutoSeat(table) {
  const label = normalizeTableLabelKey(table?.label);
  if (!label) return false;
  if (label === '主桌' || label.includes('主桌')) return true;

  const numericMatch =
    label.match(/^第?(\d+)桌$/) ??
    label.match(/^桌(\d+)$/) ??
    label.match(/^(\d+)$/);

  return numericMatch ? Number(numericMatch[1]) === 1 : false;
}

export function normalizeSeatingRules(rules = {}) {
  const maxPerCategoryPerTable = {};
  const incomingMax = rules?.maxPerCategoryPerTable ?? {};

  Object.entries(incomingMax).forEach(([rawCategory, rawValue]) => {
    const category = normalizeCategory(rawCategory);
    const value = Number(rawValue);
    if (!category || !Number.isFinite(value)) return;
    const whole = Math.floor(value);
    if (whole >= 1 && whole <= MAX_SEATS) {
      maxPerCategoryPerTable[category] = whole;
    }
  });

  const fillStrategy = FILL_STRATEGIES.has(rules?.fillStrategy)
    ? rules.fillStrategy
    : DEFAULT_SEATING_RULES.fillStrategy;

  return {
    fillStrategy,
    respectExistingAssignments: rules?.respectExistingAssignments !== false,
    maxPerCategoryPerTable,
    preferFillIncompleteTables: rules?.preferFillIncompleteTables !== false,
    keepGroupsTogether: rules?.keepGroupsTogether !== false,
  };
}

export function normalizeLockedAssignments(value = {}) {
  return Object.entries(value ?? {}).reduce((acc, [guestId, locked]) => {
    const id = String(guestId ?? '').trim();
    if (id && locked === true) acc[id] = true;
    return acc;
  }, {});
}

export function buildAutoSeatFingerprint(state, rulesArg = state?.seatingRules) {
  const rules = normalizeSeatingRules(rulesArg);
  const lockedAssignments = normalizeLockedAssignments(state?.lockedAssignments);

  return JSON.stringify({
    rules,
    lockedAssignments,
    guests: (state?.guests ?? []).map(guest => ({
      id: guest.id,
      category: normalizeCategory(guest.category),
      partyId: guest.partyId ?? null,
      tableId: guest.tableId ?? null,
    })),
    tables: (state?.tables ?? []).map(table => ({
      id: table.id,
      label: table.label,
      seats: table.seats ?? MAX_SEATS,
      guestIds: normalizeSeatArray(table.guestIds),
    })),
    partyRows: (state?.partyRows ?? []).map(row => ({
      id: row.id,
      tableLabel: String(row.tableLabel ?? '').trim(),
      guestIds: row.guestIds ?? [],
    })),
    guestGroups: normalizeGuestGroups(
      state?.guestGroups,
      (state?.guests ?? []).map(guest => guest.id),
      lockedAssignments
    ).map(group => ({
      id: group.id,
      guestIds: group.guestIds,
      preference: group.preference,
      locked: group.locked,
    })),
  });
}

export function createAutoSeatPreview(state, rulesArg = state?.seatingRules) {
  const rules = normalizeSeatingRules(rulesArg);
  const lockedAssignments = normalizeLockedAssignments(state?.lockedAssignments);
  const tables = (state?.tables ?? []).map(table => ({
    ...table,
    seats: table.seats ?? MAX_SEATS,
    guestIds: normalizeSeatArray(table.guestIds),
  }));
  let guests = deriveGuestTableState(state?.guests ?? [], tables);
  const originalTableByGuestId = new Map(guests.map(guest => [guest.id, guest.tableId ?? null]));
  const guestById = new Map(guests.map(guest => [guest.id, guest]));
  tables.forEach(table => {
    table._categorySnapshot = table.guestIds
      .map(guestId => guestById.get(guestId)?.category)
      .filter(Boolean)
      .map(normalizeCategory);
  });
  const tableByLabel = buildTableLabelMap(tables);
  const blocked = [];
  const createdTables = [];
  const moves = [];

  if (guests.length === 0) {
    return buildPreviewResult({
      state,
      rules,
      tables,
      guests,
      createdTables,
      moves,
      blocked: [{
        id: 'empty-state',
        sourceName: '目前名單',
        guestNames: [],
        reason: '尚未有可安排的賓客，請先匯入或新增賓客。',
      }],
    });
  }

  const lockedUnassigned = guests.filter(guest =>
    lockedAssignments[guest.id] && guest.tableId == null
  );
  lockedUnassigned.forEach(guest => {
    blocked.push({
      id: `locked:${guest.id}`,
      sourceName: guest.name,
      guestNames: [guest.name],
      reason: '此座位已鎖定且目前未分配，自動排座不會移動。',
    });
  });

  const candidateIds = new Set(guests
    .filter(guest => !lockedAssignments[guest.id])
    .filter(guest => rules.respectExistingAssignments ? guest.tableId == null : true)
    .map(guest => guest.id));

  if (!rules.respectExistingAssignments) {
    tables.forEach(table => {
      table.guestIds = table.guestIds.map(guestId =>
        guestId && candidateIds.has(guestId) ? null : guestId
      );
    });
    guests = guests.map(guest =>
      candidateIds.has(guest.id) ? { ...guest, tableId: null } : guest
    );
  }

  const groups = buildCandidateGroups({
    state,
    guests,
    guestById,
    candidateIds,
    rules,
    originalTableByGuestId,
    tableByLabel,
  });

  groups.forEach(group => {
    const placement = findPlacementTable({ group, tables, rules });
    let targetTable = placement.table;

    if (!targetTable && placement.canCreateTable && group.guestIds.length <= MAX_SEATS) {
      const nextTable = buildNextTable(tables);
      if (canPlaceGroupOnTable(nextTable, group, rules).ok) {
        tables.push(nextTable);
        createdTables.push({ id: nextTable.id, label: nextTable.label });
        targetTable = nextTable;
      }
    }

    if (!targetTable) {
      blocked.push({
        id: group.id,
        sourceName: group.sourceName,
        guestNames: group.guestIds.map(guestId => guestById.get(guestId)?.name).filter(Boolean),
        reason: placement.reason ?? '沒有符合規則且有足夠空位的桌次。',
      });
      return;
    }

    placeGroup(targetTable, group);
    guests = guests.map(guest =>
      group.guestIds.includes(guest.id)
        ? { ...guest, tableId: targetTable.id }
        : guest
    );

    group.guestIds.forEach(guestId => {
      const fromTableId = originalTableByGuestId.get(guestId) ?? null;
      if (fromTableId !== targetTable.id) {
        moves.push({
          guestId,
          guestName: guestById.get(guestId)?.name ?? '未知賓客',
          fromTableId,
          fromTableLabel: findTableLabel(state?.tables ?? [], fromTableId),
          toTableId: targetTable.id,
          toTableLabel: targetTable.label,
          sourceName: group.sourceName,
        });
      }
    });
  });

  return buildPreviewResult({
    state,
    rules,
    tables,
    guests,
    createdTables,
    moves,
    blocked,
  });
}

function buildPreviewResult({ state, rules, tables, guests, createdTables, moves, blocked }) {
  const cleanTables = tables.map(stripTableRuntimeFields);
  const unassignedGuestIds = guests
    .filter(guest => guest.tableId == null)
    .map(guest => guest.id);
  const nextTablePositions = { ...(state?.tablePositions ?? {}) };

  createdTables.forEach(table => {
    const tableIndex = tables.findIndex(item => item.id === table.id);
    nextTablePositions[table.id] = defaultTablePosition(tableIndex);
  });

  const nextState = {
    ...state,
    guests,
    tables: cleanTables,
    unassignedGuestIds,
    tablePositions: nextTablePositions,
    seatingRules: rules,
    lockedAssignments: normalizeLockedAssignments(state?.lockedAssignments),
  };

  const plan = {
    rules,
    nextState,
    sourceFingerprint: buildAutoSeatFingerprint(state, rules),
    createdAt: new Date().toISOString(),
  };

  return {
    plan,
    rules,
    moves,
    blocked,
    createdTables,
    summary: {
      candidateMoveCount: moves.length,
      createdTableCount: createdTables.length,
      blockedCount: blocked.length,
      unassignedAfterCount: unassignedGuestIds.length,
    },
  };
}

function stripTableRuntimeFields(table) {
  const cleanTable = { ...table };
  delete cleanTable._categorySnapshot;
  return cleanTable;
}

function normalizeSeatArray(guestIds = []) {
  return Array.from({ length: MAX_SEATS }, (_, index) => guestIds?.[index] ?? null);
}

function deriveGuestTableState(guests, tables) {
  const tableIdByGuestId = new Map();
  tables.forEach(table => {
    table.guestIds.forEach(guestId => {
      if (guestId) tableIdByGuestId.set(guestId, table.id);
    });
  });

  return guests.map(guest => ({
    ...guest,
    category: normalizeCategory(guest.category),
    tableId: tableIdByGuestId.get(guest.id) ?? null,
  }));
}

function buildCandidateGroups({ state, guests, guestById, candidateIds, rules, originalTableByGuestId, tableByLabel }) {
  const seen = new Set();
  const groups = [];
  let groupContextByGuestId = new Map();

  if (rules.keepGroupsTogether) {
    const normalizedGroups = normalizeGuestGroups(state?.guestGroups, guests.map(guest => guest.id), state?.lockedAssignments);

    normalizedGroups
      .filter(group => group.preference === 'same-table')
      .forEach(group => {
        const fullGroupIds = group.guestIds.filter(guestId => guestById.has(guestId));
        const groupIds = fullGroupIds.filter(guestId => candidateIds.has(guestId));
        if (groupIds.length === 0) return;
        groupIds.forEach(guestId => seen.add(guestId));

        groups.push(buildGroup({
          id: `guest-group:${group.id}`,
          sourceName: group.name,
          guestIds: groupIds,
          guestById,
          preferredTableIds: buildPreferredTableIdsFromGuestIds(fullGroupIds, state, originalTableByGuestId),
          anchorTableIds: buildPreferredTableIdsFromGuestIds(
            fullGroupIds.filter(guestId => !candidateIds.has(guestId)),
            state,
            originalTableByGuestId
          ),
        }));
      });

    groupContextByGuestId = buildIndividualGroupContexts({
      groups: normalizedGroups,
      candidateIds,
      guestById,
      originalTableByGuestId,
      state,
    });

    (state?.partyRows ?? []).forEach(row => {
      const groupIds = (row.guestIds ?? []).filter(guestId => candidateIds.has(guestId));
      if (groupIds.length === 0) return;
      const ungroupedIds = groupIds.filter(guestId => !seen.has(guestId));
      if (ungroupedIds.length === 0) return;
      groupIds.forEach(guestId => seen.add(guestId));

      groups.push(buildGroup({
        id: `party:${row.id}`,
        sourceName: row.sourceName,
        guestIds: ungroupedIds,
        guestById,
        preferredTableIds: buildPreferredTableIds(row, state, originalTableByGuestId, tableByLabel),
        anchorTableIds: buildPreferredTableIdsFromGuestIds(
          (row.guestIds ?? []).filter(guestId => !candidateIds.has(guestId)),
          state,
          originalTableByGuestId
        ),
      }));
    });
  }

  guests.forEach(guest => {
    if (!candidateIds.has(guest.id) || seen.has(guest.id)) return;
    const groupContext = groupContextByGuestId.get(guest.id);
    groups.push(buildGroup({
      id: `guest:${guest.id}`,
      sourceName: formatIndividualGroupSourceName(guest.name, groupContext),
      guestIds: [guest.id],
      guestById,
      preferredTableIds: groupContext?.preferredTableIds ?? [],
      anchorTableIds: [],
      separateFromGuestIds: groupContext?.separateFromGuestIds ?? [],
    }));
  });

  return groups.sort((a, b) => {
    if (b.guestIds.length !== a.guestIds.length) return b.guestIds.length - a.guestIds.length;
    return a.sourceName.localeCompare(b.sourceName, 'zh-Hant');
  });
}

function buildGroup({
  id,
  sourceName,
  guestIds,
  guestById,
  preferredTableIds,
  anchorTableIds = [],
  separateFromGuestIds = [],
}) {
  const categories = guestIds.map(guestId => normalizeCategory(guestById.get(guestId)?.category));
  return {
    id,
    sourceName,
    guestIds,
    categories,
    primaryCategory: categories[0] ?? CATEGORIES[0].id,
    preferredTableIds,
    anchorTableIds,
    separateFromGuestIds,
  };
}

function mergeGroupContext(current = {}, patch = {}) {
  return {
    preferredTableIds: Array.from(new Set([
      ...(current.preferredTableIds ?? []),
      ...(patch.preferredTableIds ?? []),
    ])),
    separateFromGuestIds: Array.from(new Set([
      ...(current.separateFromGuestIds ?? []),
      ...(patch.separateFromGuestIds ?? []),
    ])),
    sourceNames: Array.from(new Set([
      ...(current.sourceNames ?? []),
      ...(patch.sourceNames ?? []),
    ])),
  };
}

function buildIndividualGroupContexts({ groups, candidateIds, guestById, originalTableByGuestId, state }) {
  const contexts = new Map();

  groups
    .filter(group => group.preference === 'nearby' || group.preference === 'separate')
    .forEach(group => {
      const fullGroupIds = group.guestIds.filter(guestId => guestById.has(guestId));
      const candidateGroupIds = fullGroupIds.filter(guestId => candidateIds.has(guestId));
      if (candidateGroupIds.length === 0) return;

      const assignedGroupIds = fullGroupIds.filter(guestId => !candidateIds.has(guestId));
      const anchorTableIds = buildPreferredTableIdsFromGuestIds(assignedGroupIds, state, originalTableByGuestId);

      candidateGroupIds.forEach(guestId => {
        const context = {
          preferredTableIds: anchorTableIds,
          separateFromGuestIds: group.preference === 'separate'
            ? fullGroupIds.filter(id => id !== guestId)
            : [],
          sourceNames: [group.name],
        };
        contexts.set(guestId, mergeGroupContext(contexts.get(guestId), context));
      });
    });

  return contexts;
}

function formatIndividualGroupSourceName(guestName, context) {
  if (!context?.sourceNames?.length) return guestName;
  return `${guestName}（${context.sourceNames.join('、')}）`;
}

function buildPreferredTableIds(row, state, originalTableByGuestId, tableByLabel) {
  const ids = [];
  const targetLabel = normalizeTableLabelKey(row.tableLabel);
  const targetTable = targetLabel ? tableByLabel.get(targetLabel) : null;
  if (targetTable) ids.push(targetTable.id);

  (row.guestIds ?? []).forEach(guestId => {
    const tableId = originalTableByGuestId.get(guestId);
    if (tableId) ids.push(tableId);
  });

  const validTableIds = new Set((state?.tables ?? []).map(table => table.id));
  return Array.from(new Set(ids.filter(id => validTableIds.has(id))));
}

function buildPreferredTableIdsFromGuestIds(guestIds, state, originalTableByGuestId) {
  const validTableIds = new Set((state?.tables ?? []).map(table => table.id));
  const ids = guestIds
    .map(guestId => originalTableByGuestId.get(guestId))
    .filter(id => id && validTableIds.has(id));
  return Array.from(new Set(ids));
}

function buildTableLabelMap(tables) {
  return new Map(tables.map(table => [
    normalizeTableLabelKey(table.label),
    table,
  ]));
}

function findPlacementTable({ group, tables, rules }) {
  if (group.guestIds.length > MAX_SEATS) {
    return {
      table: null,
      canCreateTable: false,
      reason: `同行組合共 ${group.guestIds.length} 位，超過每桌 ${MAX_SEATS} 位上限。`,
    };
  }

  const fitResults = tables.map(table => ({
    table,
    fit: canPlaceGroupOnTable(table, group, rules),
  }));
  let eligible = fitResults
    .filter(item => item.fit.ok)
    .filter(item => !isMainTableForAutoSeat(item.table))
    .map(item => item.table);

  if (group.anchorTableIds.length > 0) {
    const anchorResults = fitResults.filter(item => group.anchorTableIds.includes(item.table.id));
    eligible = eligible.filter(table => group.anchorTableIds.includes(table.id));

    if (eligible.length === 0) {
      const capacityReason = anchorResults.find(item => !item.fit.ok)?.fit.reason;
      const reservedReason = anchorResults.some(item => item.fit.ok && isMainTableForAutoSeat(item.table))
        ? `${formatTableLabels(anchorResults.map(item => item.table))} 為主桌，不納入自動排座。`
        : null;

      return {
        table: null,
        canCreateTable: false,
        reason: capacityReason ?? reservedReason ?? '同行已有成員在其他桌，沒有可補入的同桌空位。',
      };
    }
  }

  if (eligible.length === 0) {
    const firstReason = fitResults.find(item => item.fit.reason)?.fit.reason;
    return {
      table: null,
      canCreateTable: true,
      reason: firstReason,
    };
  }

  eligible.sort((a, b) => compareTablesForGroup(a, b, group, rules));
  return { table: eligible[0], canCreateTable: false, reason: null };
}

function canPlaceGroupOnTable(table, group, rules) {
  const freeSeats = table.guestIds.filter(guestId => !guestId).length;
  if (freeSeats < group.guestIds.length) {
    return { ok: false, reason: `${table.label} 剩餘 ${freeSeats} 位，不足以保留同行同桌。` };
  }

  if ((group.separateFromGuestIds ?? []).some(guestId => table.guestIds.includes(guestId))) {
    return { ok: false, reason: `${table.label} 已有同一群組中標記為分開安排的成員。` };
  }

  const categoryLimits = rules.maxPerCategoryPerTable ?? {};
  if (Object.keys(categoryLimits).length === 0) return { ok: true };

  const categoryCounts = countCategoriesForTable(table, group);
  for (const [category, limit] of Object.entries(categoryLimits)) {
    if ((categoryCounts.get(category) ?? 0) > limit) {
      return { ok: false, reason: `${table.label} 的「${category}」會超過每桌 ${limit} 位上限。` };
    }
  }

  return { ok: true };
}

function countCategoriesForTable(table, group) {
  const counts = new Map();
  (table._categorySnapshot ?? []).forEach(category => {
    counts.set(category, (counts.get(category) ?? 0) + 1);
  });
  group.categories.forEach(category => {
    counts.set(category, (counts.get(category) ?? 0) + 1);
  });
  return counts;
}

function formatTableLabels(tables) {
  return Array.from(new Set(tables.map(table => table.label).filter(Boolean))).join('、') || '指定桌次';
}

function compareTablesForGroup(a, b, group, rules) {
  const aRank = tableRank(a, group, rules);
  const bRank = tableRank(b, group, rules);
  for (let i = 0; i < aRank.length; i += 1) {
    if (aRank[i] !== bRank[i]) return aRank[i] - bRank[i];
  }
  return String(a.label).localeCompare(String(b.label), 'zh-Hant');
}

function tableRank(table, group, rules) {
  const occupied = table.guestIds.filter(Boolean).length;
  const preferred = group.preferredTableIds.includes(table.id) ? 0 : 1;
  const partialRank = rules.preferFillIncompleteTables
    ? occupied > 0 && occupied < (table.seats ?? MAX_SEATS)
      ? 0
      : 1
    : 0;
  const sameCategoryCount = (table._categorySnapshot ?? [])
    .filter(category => category === group.primaryCategory).length;

  if (rules.fillStrategy === 'category-first') {
    return [preferred, -sameCategoryCount, partialRank, occupied];
  }

  if (rules.fillStrategy === 'keep-existing') {
    return [preferred, partialRank, -occupied];
  }

  return [preferred, partialRank, occupied];
}

function placeGroup(table, group) {
  group.guestIds.forEach((guestId, index) => {
    const seatIndex = table.guestIds.indexOf(null);
    if (seatIndex !== -1) table.guestIds[seatIndex] = guestId;
    table._categorySnapshot = [
      ...(table._categorySnapshot ?? []),
      group.categories[index],
    ].filter(Boolean);
  });
}

function buildNextTable(tables) {
  const usedNumbers = new Set(tables
    .map(table => String(table.label ?? '').match(/^(\d+)桌$/)?.[1])
    .filter(Boolean)
    .map(Number));
  let nextNumber = tables.length + 1;
  while (nextNumber === 1 || usedNumbers.has(nextNumber)) nextNumber += 1;

  return {
    id: uuidv4(),
    label: `${nextNumber}桌`,
    seats: MAX_SEATS,
    guestIds: emptySeats(),
  };
}

function findTableLabel(tables, tableId) {
  if (!tableId) return '未分配';
  return tables.find(table => table.id === tableId)?.label ?? '未知桌次';
}
