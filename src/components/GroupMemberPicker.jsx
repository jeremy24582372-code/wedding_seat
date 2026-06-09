import { useMemo, useState } from 'react';

export default function GroupMemberPicker({
  allGuests,
  currentGuestIds,
  tableById,
  onAddMember,
}) {
  const [search, setSearch] = useState('');
  const [selectedGuestId, setSelectedGuestId] = useState('');

  const availableGuests = useMemo(() => {
    const currentIds = new Set(currentGuestIds ?? []);
    const query = search.trim().toLowerCase();
    return (allGuests ?? [])
      .filter(guest => {
        if (currentIds.has(guest.id)) return false;
        if (!query) return true;
        const tableLabel = guest.tableId ? tableById.get(guest.tableId)?.label ?? '' : '未分配';
        return `${guest.name} ${guest.category} ${guest.diet ?? ''} ${tableLabel}`.toLowerCase().includes(query);
      })
      .slice(0, 40);
  }, [allGuests, currentGuestIds, search, tableById]);

  const selectedIsAvailable = availableGuests.some(guest => guest.id === selectedGuestId);
  const selectedValue = selectedIsAvailable ? selectedGuestId : '';

  const handleAdd = () => {
    if (!selectedValue) return;
    onAddMember(selectedValue);
    setSelectedGuestId('');
    setSearch('');
  };

  return (
    <div className="group-card__add-member" aria-label="加入群組成員">
      <div className="group-card__add-member-fields">
        <label>
          <span>搜尋新成員</span>
          <input
            type="search"
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="姓名、分類、桌次或飲食"
          />
        </label>
        <label>
          <span>可加入成員</span>
          <select
            value={selectedValue}
            onChange={event => setSelectedGuestId(event.target.value)}
            disabled={availableGuests.length === 0}
          >
            <option value="">選擇要加入的賓客</option>
            {availableGuests.map(guest => (
              <option key={guest.id} value={guest.id}>
                {guest.name} · {guest.category} · {guest.tableId ? tableById.get(guest.tableId)?.label : '未分配'}
              </option>
            ))}
          </select>
        </label>
      </div>
      <button type="button" onClick={handleAdd} disabled={!selectedValue}>
        加入成員
      </button>
      {availableGuests.length === 0 ? (
        <small>目前沒有其他可加入的賓客。</small>
      ) : null}
    </div>
  );
}
