import { useMemo, useState } from 'react';

export default function GroupMemberPicker({
  allGuests,
  currentGuestIds,
  tableById,
  onAddMember,
}) {
  const [search, setSearch] = useState('');
  const [selectedGuestIds, setSelectedGuestIds] = useState([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const eligibleGuests = useMemo(() => {
    const currentIds = new Set(currentGuestIds ?? []);
    return (allGuests ?? []).filter(guest => !currentIds.has(guest.id));
  }, [allGuests, currentGuestIds]);

  const availableGuests = useMemo(() => {
    const query = search.trim().toLowerCase();
    return eligibleGuests
      .filter(guest => {
        if (!query) return true;
        const tableLabel = guest.tableId ? tableById.get(guest.tableId)?.label ?? '' : '未分配';
        return `${guest.name} ${guest.category} ${guest.diet ?? ''} ${tableLabel}`.toLowerCase().includes(query);
      })
      .slice(0, 40);
  }, [eligibleGuests, search, tableById]);

  const eligibleGuestIds = useMemo(
    () => new Set(eligibleGuests.map(guest => guest.id)),
    [eligibleGuests]
  );
  const selectedValues = selectedGuestIds.filter(guestId => eligibleGuestIds.has(guestId));
  const selectedValueSet = new Set(selectedValues);
  const hasEligibleGuests = eligibleGuests.length > 0;

  const toggleGuest = (guestId, checked) => {
    setSelectedGuestIds(prev => {
      if (!checked) return prev.filter(id => id !== guestId);
      return Array.from(new Set([...prev, guestId]));
    });
  };

  const selectVisibleGuests = () => {
    setSelectedGuestIds(prev => Array.from(new Set([
      ...prev,
      ...availableGuests.map(guest => guest.id),
    ])));
  };

  const closeOnOutsideBlur = (event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setDropdownOpen(false);
    }
  };

  const handleAdd = () => {
    if (selectedValues.length === 0) return;
    onAddMember(selectedValues);
    setSelectedGuestIds([]);
    setSearch('');
    setDropdownOpen(false);
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
        <div className="group-card__member-menu-field">
          <span>可加入成員</span>
          <div className="group-card__member-menu" onBlur={closeOnOutsideBlur}>
            <button
              type="button"
              className="group-card__member-menu-trigger"
              onClick={() => setDropdownOpen(open => !open)}
              disabled={!hasEligibleGuests}
              aria-expanded={dropdownOpen}
              aria-haspopup="true"
            >
              <span>{selectedValues.length > 0 ? `已選 ${selectedValues.length} 位` : '選擇要加入的賓客'}</span>
              <span aria-hidden="true">▾</span>
            </button>
            {dropdownOpen ? (
              <div className="group-card__member-menu-popover">
                <div className="group-card__member-menu-actions">
                  <button type="button" onClick={selectVisibleGuests} disabled={availableGuests.length === 0}>
                    全選顯示
                  </button>
                  <button type="button" onClick={() => setSelectedGuestIds([])} disabled={selectedValues.length === 0}>
                    清除
                  </button>
                </div>
                <div className="group-card__member-checklist">
                  {availableGuests.length > 0 ? availableGuests.map(guest => (
                    <label className="group-card__member-check-option" key={guest.id}>
                      <input
                        type="checkbox"
                        checked={selectedValueSet.has(guest.id)}
                        onChange={event => toggleGuest(guest.id, event.target.checked)}
                      />
                      <span className="group-card__member-check-text">
                        <strong>{guest.name}</strong>
                        <small>
                          {guest.category} · {guest.tableId ? tableById.get(guest.tableId)?.label : '未分配'}
                        </small>
                      </span>
                    </label>
                  )) : (
                    <small className="group-card__member-menu-empty">
                      {hasEligibleGuests ? '沒有符合搜尋的賓客。' : '目前沒有其他可加入的賓客。'}
                    </small>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <button type="button" onClick={handleAdd} disabled={selectedValues.length === 0}>
        {selectedValues.length > 0 ? `加入 ${selectedValues.length} 位` : '加入成員'}
      </button>
      {!hasEligibleGuests ? (
        <small>目前沒有其他可加入的賓客。</small>
      ) : null}
    </div>
  );
}
