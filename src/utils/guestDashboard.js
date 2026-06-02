import { MAX_SEATS, normalizeCategory } from './constants.js';

const STATUS_PRIORITY = {
  split: 0,
  partial: 1,
  'target-conflict': 2,
  unassigned: 3,
  assigned: 4,
};

export function buildGuestDashboardModel(state, importSummary = null) {
  const guests = state.guests ?? [];
  const tables = state.tables ?? [];
  const partyRows = state.partyRows ?? [];

  const guestById = new Map(guests.map(guest => [guest.id, guest]));
  const tableById = new Map(tables.map(table => [table.id, table]));
  const partyGuestIds = new Set();

  const rows = partyRows.map(row => {
    const guestIds = (row.guestIds ?? []).filter(guestId => guestById.has(guestId));
    guestIds.forEach(guestId => partyGuestIds.add(guestId));
    return buildPartyRow(row, guestIds, guestById, tableById);
  }).filter(Boolean);

  guests
    .filter(guest => !partyGuestIds.has(guest.id))
    .forEach(guest => rows.push(buildManualRow(guest, tableById)));

  rows.sort((a, b) => {
    const statusDiff = (STATUS_PRIORITY[a.status] ?? 9) - (STATUS_PRIORITY[b.status] ?? 9);
    if (statusDiff !== 0) return statusDiff;
    return a.sourceName.localeCompare(b.sourceName, 'zh-Hant');
  });

  const tableSummaries = tables.map(table => {
    const occupied = (table.guestIds ?? []).filter(Boolean).length;
    return {
      id: table.id,
      label: table.label,
      occupied,
      seats: table.seats ?? MAX_SEATS,
      state: occupied >= (table.seats ?? MAX_SEATS)
        ? 'full'
        : occupied === 0
          ? 'empty'
          : 'available',
    };
  });

  return {
    rows,
    tableSummaries,
    quality: buildQualitySummary(rows, importSummary),
  };
}

function buildPartyRow(row, guestIds, guestById, tableById) {
  const units = guestIds.map(guestId => buildSeatUnit(guestById.get(guestId), tableById));
  const headcount = Number(row.headcount);
  const issues = [];

  const invalidHeadcount = !Number.isInteger(headcount) || headcount < 1 || headcount > MAX_SEATS;
  if (invalidHeadcount) {
    issues.push({
      level: 'danger',
      label: '人數非法',
      detail: `${row.sourceName} 的人數不是 1-${MAX_SEATS} 的整數，請重新匯入或修正來源資料。`,
    });
  }

  if (units.length !== headcount) {
    issues.push({
      level: 'warning',
      label: '人數與座位不一致',
      detail: `${row.sourceName} 標示 ${row.headcount} 位，但目前展開 ${units.length} 個座位單位。`,
    });
  }

  const base = buildAssignmentSummary(units, row.tableLabel);
  appendAssignmentIssues(issues, base, row.sourceName);
  appendCategoryIssue(issues, row.category, row.sourceName);

  return {
    id: row.id,
    type: 'party',
    sourceName: row.sourceName,
    category: normalizeCategory(row.category),
    source: row.source ?? 'import',
    headcount: invalidHeadcount ? units.length : headcount,
    tableLabel: row.tableLabel ?? '',
    units,
    ...base,
    issues,
    searchText: buildSearchText(row.sourceName, row.category, row.tableLabel, units),
  };
}

function buildManualRow(guest, tableById) {
  const units = [buildSeatUnit(guest, tableById)];
  const issues = [];
  const base = buildAssignmentSummary(units, '');
  appendAssignmentIssues(issues, base, guest.name);
  appendCategoryIssue(issues, guest.category, guest.name);

  return {
    id: `manual:${guest.id}`,
    type: 'manual',
    sourceName: guest.name,
    category: normalizeCategory(guest.category),
    source: guest.source ?? 'manual',
    headcount: 1,
    tableLabel: '',
    units,
    ...base,
    issues,
    searchText: buildSearchText(guest.name, guest.category, '', units),
  };
}

function buildSeatUnit(guest, tableById) {
  const table = guest?.tableId ? tableById.get(guest.tableId) : null;
  return {
    id: guest.id,
    name: guest.name,
    category: normalizeCategory(guest.category),
    diet: guest.diet ?? '',
    role: guest.partyRole === 'companion' ? '同行' : '主要',
    tableId: guest.tableId ?? null,
    tableLabel: table?.label ?? '',
    status: table ? '已分配' : '未分配',
    guest,
  };
}

function buildAssignmentSummary(units, targetTableLabel) {
  const assignedUnits = units.filter(unit => unit.tableId);
  const unassignedCount = units.length - assignedUnits.length;
  const assignedLabels = Array.from(new Set(assignedUnits.map(unit => unit.tableLabel).filter(Boolean)));
  const target = String(targetTableLabel ?? '').trim();
  const targetAssignedCount = target
    ? assignedUnits.filter(unit => normalizeLabel(unit.tableLabel) === normalizeLabel(target)).length
    : 0;
  const splitParty = assignedLabels.length > 1;
  const targetConflict = Boolean(target) && targetAssignedCount < units.length;

  const status = splitParty
    ? 'split'
    : unassignedCount === units.length
      ? 'unassigned'
      : unassignedCount > 0
        ? 'partial'
        : targetConflict
          ? 'target-conflict'
          : 'assigned';

  return {
    assignedCount: assignedUnits.length,
    unassignedCount,
    assignedLabels,
    targetConflict,
    splitParty,
    status,
    tableSummary: formatTableSummary(assignedLabels, unassignedCount),
  };
}

function appendAssignmentIssues(issues, summary, sourceName) {
  if (summary.targetConflict) {
    issues.push({
      level: 'warning',
      label: '指定桌次未完整安置',
      detail: `${sourceName} 沒有完整安排到指定桌次，可能是桌次容量不足或後續手動調整。`,
    });
  }

  if (summary.splitParty) {
    issues.push({
      level: 'warning',
      label: '同行被拆桌',
      detail: `${sourceName} 的座位分散在 ${summary.assignedLabels.join('、')}，請確認是否接受拆桌。`,
    });
  }

  if (summary.unassignedCount > 0) {
    issues.push({
      level: 'notice',
      label: '仍有未分配座位',
      detail: `${sourceName} 尚有 ${summary.unassignedCount} 位未安排桌次。`,
    });
  }
}

function appendCategoryIssue(issues, category, sourceName) {
  const normalized = normalizeCategory(category);
  if (!normalized || normalized === '其他') {
    issues.push({
      level: 'notice',
      label: '分類需確認',
      detail: `${sourceName} 使用「其他」或空分類，建議在正式匯出前確認。`,
    });
  }
}

function buildQualitySummary(rows, importSummary) {
  const items = rows.flatMap(row => row.issues.map(issue => ({
    ...issue,
    rowId: row.id,
    sourceName: row.sourceName,
  })));

  if (importSummary?.skipped > 0 || importSummary?.updated > 0) {
    items.unshift({
      level: importSummary.skipped > 0 ? 'notice' : 'info',
      label: '重複匯入摘要',
      detail: [
        importSummary.skipped > 0 ? `略過 ${importSummary.skipped} 筆重複來源` : '',
        importSummary.updated > 0 ? `更新 ${importSummary.updated} 筆既有來源` : '',
      ].filter(Boolean).join('，'),
      rowId: 'import-summary',
      sourceName: '最近一次匯入',
    });
  }

  const counts = items.reduce((acc, item) => {
    acc[item.level] = (acc[item.level] ?? 0) + 1;
    return acc;
  }, { danger: 0, warning: 0, notice: 0, info: 0 });

  return {
    items,
    counts,
    totalIssueCount: items.length,
    hasBlockingIssue: counts.danger > 0 || counts.warning > 0,
    lastImportSummary: importSummary,
  };
}

function formatTableSummary(labels, unassignedCount) {
  const parts = [...labels];
  if (unassignedCount > 0) parts.push(`未分配 ${unassignedCount} 位`);
  return parts.length > 0 ? parts.join(' / ') : '未分配';
}

function buildSearchText(sourceName, category, tableLabel, units) {
  return [
    sourceName,
    category,
    tableLabel,
    ...units.flatMap(unit => [unit.name, unit.diet, unit.tableLabel, unit.role]),
  ].filter(Boolean).join(' ').toLowerCase();
}

function normalizeLabel(label) {
  return String(label ?? '').replace(/\s+/g, '').toLowerCase();
}
