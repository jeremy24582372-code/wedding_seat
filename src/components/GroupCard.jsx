import { useMemo, useState } from 'react';
import { getCategoryVisual } from '../utils/constants';
import { GROUP_PREFERENCES, getGroupPreferenceLabel } from '../utils/guestGroups';
import GroupMemberPicker from './GroupMemberPicker';
import LockBadge from './LockBadge';

export default function GroupCard({
  group,
  allGuests,
  guestById,
  tableById,
  lockedAssignments,
  onUpdateGroup,
  onAddMember,
  onRemoveGuest,
  onRemoveGroup,
  onToggleGroupLock,
  onToggleGuestLock,
}) {
  const [confirmRemove, setConfirmRemove] = useState(false);

  const members = useMemo(
    () => group.guestIds.map(id => guestById.get(id)).filter(Boolean),
    [group.guestIds, guestById]
  );
  const lockedCount = members.filter(guest => lockedAssignments?.[guest.id]).length;
  const tableLabels = Array.from(new Set(
    members.map(guest => guest.tableId ? tableById.get(guest.tableId)?.label : '未分配')
  )).filter(Boolean);

  const commitName = (value) => {
    const trimmed = value.trim();
    if (trimmed && trimmed !== group.name) onUpdateGroup(group.id, { name: trimmed });
  };

  const commitNotes = (value) => {
    if (value !== (group.notes ?? '')) onUpdateGroup(group.id, { notes: value });
  };

  const handleRemoveGroup = () => {
    if (!confirmRemove) {
      setConfirmRemove(true);
      return;
    }
    setConfirmRemove(false);
    onRemoveGroup(group.id);
  };

  return (
    <article className={`group-card${group.locked ? ' group-card--locked' : ''}`}>
      <header className="group-card__header">
        <div className="group-card__title-block">
          <input
            key={`${group.id}:name:${group.name}`}
            className="group-card__name"
            defaultValue={group.name}
            onBlur={event => commitName(event.currentTarget.value)}
            onKeyDown={event => {
              if (event.key === 'Enter') event.currentTarget.blur();
              if (event.key === 'Escape') {
                event.currentTarget.value = group.name;
                event.currentTarget.blur();
              }
            }}
            aria-label="群組名稱"
          />
          <span>{members.length} 位 · {getGroupPreferenceLabel(group.preference)}</span>
        </div>
        <div className="group-card__header-actions">
          <LockBadge locked={group.locked} />
          <button type="button" onClick={() => onToggleGroupLock(group.id, !group.locked)}>
            {group.locked ? '解除群組鎖定' : '鎖定全組'}
          </button>
          <button
            type="button"
            className={confirmRemove ? 'group-card__danger group-card__danger--confirm' : 'group-card__danger'}
            onClick={handleRemoveGroup}
          >
            {confirmRemove ? '確認解除' : '解除群組'}
          </button>
        </div>
      </header>

      <div className="group-card__meta">
        <label>
          <span>偏好</span>
          <select
            value={group.preference}
            onChange={event => onUpdateGroup(group.id, { preference: event.target.value })}
          >
            {GROUP_PREFERENCES.map(item => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
        </label>
        <div className="group-card__table-state">
          <span>目前桌次</span>
          <strong>{tableLabels.length > 0 ? tableLabels.join('、') : '未分配'}</strong>
        </div>
        <div className="group-card__table-state">
          <span>鎖定</span>
          <strong>{lockedCount}/{members.length}</strong>
        </div>
      </div>

      <div className="group-card__members">
        {members.map(guest => {
          const visual = getCategoryVisual(guest.category);
          const locked = Boolean(lockedAssignments?.[guest.id]);
          return (
            <div className="group-card__member" key={guest.id}>
              <span
                className="group-card__member-dot"
                style={{ '--member-color': visual.color }}
                aria-hidden="true"
              />
              <div>
                <strong>{guest.name}</strong>
                <small>{visual.label} · {guest.tableId ? tableById.get(guest.tableId)?.label : '未分配'}</small>
              </div>
              <LockBadge locked={locked} compact />
              <button type="button" onClick={() => onToggleGuestLock(guest.id, !locked)}>
                {locked ? '解鎖' : '鎖定'}
              </button>
              <button type="button" onClick={() => onRemoveGuest(group.id, guest.id)}>
                拆出
              </button>
            </div>
          );
        })}
      </div>

      <GroupMemberPicker
        allGuests={allGuests}
        currentGuestIds={group.guestIds}
        tableById={tableById}
        onAddMember={guestIds => onAddMember(group.id, guestIds)}
      />

      <label className="group-card__notes">
        <span>備註</span>
        <textarea
          key={`${group.id}:notes:${group.notes ?? ''}`}
          defaultValue={group.notes ?? ''}
          onBlur={event => commitNotes(event.currentTarget.value)}
          maxLength={200}
          placeholder="例如長輩同桌、朋友希望靠近、需分開安排"
        />
      </label>
    </article>
  );
}
