export function buildGoogleSheetsPayload(state) {
  const tableLabelMap = {};
  const guestTableLabelMap = {};

  (state.tables ?? []).forEach(t => {
    tableLabelMap[t.id] = t.label;
    (t.guestIds ?? []).filter(Boolean).forEach(guestId => {
      guestTableLabelMap[guestId] = t.label;
    });
  });

  return (state.guests ?? [])
    .filter(g => String(g.name ?? '').trim().length > 0)
    .map(g => ({
      name:       String(g.name).trim(),
      category:   g.category || '其他',
      diet:       g.diet || '',
      source:     g.source || '',
      tableLabel: guestTableLabelMap[g.id] ?? (g.tableId ? (tableLabelMap[g.tableId] ?? '') : ''),
    }));
}
