import { useState, useMemo } from 'react';
import GuestCard from './GuestCard';
import './UnassignedPool.css';
import { CATEGORIES } from '../utils/constants';
import { useDroppable } from '@dnd-kit/core';

/**
 * Sidebar panel: staging area for unassigned guests.
 * Props:
 *   guests            — Guest[] (all guests)
 *   unassignedIds     — string[] (IDs of unassigned guests)
 *   onMoveToUnassigned — (guestId) => void
 */
export default function UnassignedPool({ guests, unassignedIds, onEdit, onDelete }) {
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');

  // This zone is always droppable (moving guests back to unassigned)
  const { setNodeRef, isOver } = useDroppable({
    id: 'unassigned-pool',
    data: { tableId: null },
  });

  const unassignedGuests = useMemo(() => {
    return unassignedIds
      .map(id => guests.find(g => g.id === id))
      .filter(Boolean)
      .filter(g => {
        const matchSearch = g.name.includes(search) || (g.diet ?? '').includes(search);
        const matchCat = filterCat ? g.category === filterCat : true;
        return matchSearch && matchCat;
      });
  }, [guests, unassignedIds, search, filterCat]);

  return (
    <aside className="unassigned-pool">
      {/* Title */}
      <div className="unassigned-pool__header">
        <h2 className="unassigned-pool__title">未分配賓客</h2>
        <span className="unassigned-pool__count">{unassignedIds.length} 人</span>
      </div>

      {/* Filters */}
      <div className="unassigned-pool__filters">
        <input
          className="unassigned-pool__search"
          type="text"
          placeholder="搜尋姓名或飲食需求…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          aria-label="搜尋賓客"
        />
        <select
          className="unassigned-pool__cat-filter"
          value={filterCat}
          onChange={e => setFilterCat(e.target.value)}
          aria-label="篩選分類"
        >
          <option value="">全部分類</option>
          {CATEGORIES.map(cat => (
            <option key={cat.id} value={cat.id}>{cat.label}</option>
          ))}
        </select>
      </div>

      {/* Drop zone + guest list */}
      <div
        ref={setNodeRef}
        className={`unassigned-pool__body ${isOver ? 'unassigned-pool__body--drop-active' : ''}`}
        id="unassigned-drop-zone"
      >
        {unassignedGuests.length === 0 ? (
          <div className="unassigned-pool__empty">
            {unassignedIds.length === 0
              ? '🎉 所有賓客已分配桌次！'
              : '沒有符合條件的賓客'}
          </div>
        ) : (
          <div className="unassigned-pool__list">
            {unassignedGuests.map(guest => (
              <GuestCard
                key={guest.id}
                guest={guest}
                onRemove={undefined} // already unassigned, no remove action
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
