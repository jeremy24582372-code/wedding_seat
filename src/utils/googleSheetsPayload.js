export function buildGoogleSheetsPayload(state) {
  const tableLabelMap = {};
  const guestTableLabelMap = {};
  const guestById = {};

  (state.tables ?? []).forEach(t => {
    tableLabelMap[t.id] = t.label;
    (t.guestIds ?? []).filter(Boolean).forEach(guestId => {
      guestTableLabelMap[guestId] = t.label;
    });
  });

  (state.guests ?? []).forEach(g => {
    guestById[g.id] = g;
  });

  const partyGuestIds = new Set();
  const partyRows = (state.partyRows ?? [])
    .filter(row => String(row.sourceName ?? '').trim().length > 0)
    .map(row => {
      const guestIds = (row.guestIds ?? []).filter(guestId => guestById[guestId]);
      guestIds.forEach(guestId => partyGuestIds.add(guestId));

      const primaryGuest = guestIds
        .map(guestId => guestById[guestId])
        .find(g => g.partyRole === 'primary') ?? guestById[guestIds[0]];

      return {
        name: String(row.sourceName).trim(),
        category: row.category || primaryGuest?.category || '其他',
        diet: primaryGuest?.diet || '',
        source: row.source || 'import',
        headcount: row.headcount || guestIds.length || 1,
        tableLabel: summarizePartyTableLabels(guestIds, guestTableLabelMap),
      };
    });

  const manualRows = (state.guests ?? [])
    .filter(g => !partyGuestIds.has(g.id))
    .filter(g => String(g.name ?? '').trim().length > 0)
    .map(g => ({
      name:       String(g.name).trim(),
      category:   g.category || '其他',
      diet:       g.diet || '',
      source:     g.source || '',
      headcount:  1,
      tableLabel: guestTableLabelMap[g.id] ?? (g.tableId ? (tableLabelMap[g.tableId] ?? '') : ''),
    }));

  return [...partyRows, ...manualRows];
}

function summarizePartyTableLabels(guestIds, guestTableLabelMap) {
  const assignedLabels = guestIds
    .map(guestId => guestTableLabelMap[guestId])
    .filter(Boolean);
  const unassignedCount = guestIds.length - assignedLabels.length;
  const uniqueLabels = Array.from(new Set(assignedLabels));

  if (uniqueLabels.length === 1 && unassignedCount === 0) return uniqueLabels[0];
  if (uniqueLabels.length === 0) return '';

  const parts = [...uniqueLabels];
  if (unassignedCount > 0) parts.push(`未分配${unassignedCount}位`);
  return parts.join(' / ');
}
