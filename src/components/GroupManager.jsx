import { useDeferredValue, useMemo, useState } from 'react';
import GroupCard from './GroupCard';
import { GROUP_PREFERENCES, findGuestGroupConflicts } from '../utils/guestGroups';
import './GroupManager.css';

export default function GroupManager({
  state,
  onCreateGroup,
  onUpdateGroup,
  onRemoveGuestFromGroup,
  onRemoveGuestGroup,
  onToggleGuestLock,
  onToggleGroupLock,
  onGoToSeats,
}) {
  const [name, setName] = useState('');
  const [preference, setPreference] = useState('same-table');
  const [notes, setNotes] = useState('');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const deferredSearch = useDeferredValue(search);

  const guestById = useMemo(() => new Map(state.guests.map(guest => [guest.id, guest])), [state.guests]);
  const tableById = useMemo(() => new Map(state.tables.map(table => [table.id, table])), [state.tables]);
  const visibleGuests = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    return state.guests.filter(guest => {
      if (!query) return true;
      const tableLabel = guest.tableId ? tableById.get(guest.tableId)?.label ?? '' : '未分配';
      return `${guest.name} ${guest.category} ${guest.diet ?? ''} ${tableLabel}`.toLowerCase().includes(query);
    });
  }, [state.guests, tableById, deferredSearch]);

  const lockedCount = Object.keys(state.lockedAssignments ?? {}).length;
  const autoGroupCount = (state.guestGroups ?? []).filter(group => group.sourcePartyId).length;
  const groupConflicts = useMemo(
    () => findGuestGroupConflicts(state.guestGroups ?? [], state.guests ?? []),
    [state.guestGroups, state.guests]
  );

  const toggleSelected = (guestId) => {
    setSelectedIds(prev =>
      prev.includes(guestId) ? prev.filter(id => id !== guestId) : [...prev, guestId]
    );
  };

  const handleCreate = () => {
    if (selectedIds.length === 0) return;
    onCreateGroup({
      name,
      guestIds: selectedIds,
      preference,
      notes,
    });
    setName('');
    setNotes('');
    setSelectedIds([]);
  };

  return (
    <main className="group-manager" aria-label="群組與鎖定">
      <section className="group-manager__header">
        <div>
          <p className="group-manager__kicker">群組關聯</p>
          <h2 className="group-manager__title">管理同行群組、排座偏好與鎖定座位。</h2>
        </div>
        <div className="group-manager__actions">
          <button className="btn btn-secondary" type="button" onClick={onGoToSeats}>
            座位圖
          </button>
        </div>
      </section>

      <section className="group-manager__metric-grid" aria-label="群組統計">
        <Metric label="群組數" value={(state.guestGroups ?? []).length} note={`${autoGroupCount} 組由人數自動建立`} />
        <Metric label="鎖定座位" value={lockedCount} note="auto-seat 不會移動" />
        <Metric label="同桌優先" value={(state.guestGroups ?? []).filter(group => group.preference === 'same-table').length} note="會進入自動排座分組" />
        <Metric label="分開安排" value={(state.guestGroups ?? []).filter(group => group.preference === 'separate').length} note="auto-seat 會避免同桌" />
        <Metric label="群組衝突" value={groupConflicts.length} note="同一賓客多重歸屬" />
      </section>

      {groupConflicts.length > 0 && (
        <section className="group-manager__conflicts" aria-label="群組衝突">
          <div className="group-manager__section-head">
            <div>
              <p className="group-manager__kicker">需整理</p>
              <h3>同一賓客出現在多個群組</h3>
            </div>
          </div>
          <ul>
            {groupConflicts.slice(0, 6).map(conflict => (
              <li key={conflict.guestId}>
                <strong>{conflict.guestName}</strong>
                <span>{conflict.groupNames.join('、')}</span>
              </li>
            ))}
          </ul>
          {groupConflicts.length > 6 ? (
            <p>另有 {groupConflicts.length - 6} 位賓客也有群組衝突。</p>
          ) : null}
        </section>
      )}

      <section className="group-manager__create" aria-label="建立群組">
        <div className="group-manager__section-head">
          <div>
            <p className="group-manager__kicker">手動建立</p>
            <h3>選取賓客建立群組</h3>
          </div>
          <button className="btn btn-primary" type="button" onClick={handleCreate} disabled={selectedIds.length === 0}>
            建立群組
          </button>
        </div>
        <div className="group-manager__create-grid">
          <label>
            <span>群組名稱</span>
            <input value={name} onChange={event => setName(event.target.value)} placeholder="例如主桌家人、同事 A 桌" />
          </label>
          <label>
            <span>偏好</span>
            <select value={preference} onChange={event => setPreference(event.target.value)}>
              {GROUP_PREFERENCES.map(item => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
          </label>
          <label>
            <span>備註</span>
            <input value={notes} onChange={event => setNotes(event.target.value)} placeholder="選填" />
          </label>
        </div>
        <div className="group-manager__guest-picker">
          <input
            type="search"
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="搜尋姓名、分類、桌次或飲食"
            aria-label="搜尋可加入群組的賓客"
          />
          <div className="group-manager__guest-list">
            {visibleGuests.map(guest => (
              <label className="group-manager__guest-option" key={guest.id}>
                <input
                  type="checkbox"
                  checked={selectedIds.includes(guest.id)}
                  onChange={() => toggleSelected(guest.id)}
                />
                <span>
                  <strong>{guest.name}</strong>
                  <small>{guest.category} · {guest.tableId ? tableById.get(guest.tableId)?.label : '未分配'}</small>
                </span>
              </label>
            ))}
          </div>
        </div>
      </section>

      <section className="group-manager__list" aria-label="現有群組">
        {(state.guestGroups ?? []).length === 0 ? (
          <div className="group-manager__empty">目前沒有群組；匯入人數大於 1 的來源列後會自動建立同行群組。</div>
        ) : (
          state.guestGroups.map(group => (
            <GroupCard
              key={group.id}
              group={group}
              guestById={guestById}
              tableById={tableById}
              lockedAssignments={state.lockedAssignments ?? {}}
              onUpdateGroup={onUpdateGroup}
              onRemoveGuest={onRemoveGuestFromGroup}
              onRemoveGroup={onRemoveGuestGroup}
              onToggleGroupLock={onToggleGroupLock}
              onToggleGuestLock={onToggleGuestLock}
            />
          ))
        )}
      </section>
    </main>
  );
}

function Metric({ label, value, note }) {
  return (
    <article className="group-manager__metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}
