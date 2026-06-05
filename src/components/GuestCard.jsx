import { useState, useRef, useEffect, useCallback } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import './GuestCard.css';
import { getCategoryVisual } from '../utils/constants';
import LockBadge from './LockBadge';

/**
 * Draggable guest card.
 * Props:
 *   guest     — { id, name, category, diet }
 *   onRemove  — () => void  (right-click: move back to unassigned)
 *   onEdit    — (guest) => void  (pencil icon click: open edit modal)
 *   onDelete  — (guestId) => void  (trash icon: permanently delete with 2-step confirm)
 *   compact   — bool (smaller variant used inside TableZone)
 *   className — optional visual variant, e.g. drag overlay
 */
export default function GuestCard({ guest, onRemove, onEdit, onDelete, compact = false, className = '', locked = false }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: guest.id,
    data: { guestId: guest.id, tableId: guest.tableId },
  });

  const categoryVisual = getCategoryVisual(guest.category);
  const partyLabel = guest.partyId
    ? guest.partyRole === 'companion' ? '同行' : '主要'
    : '';

  const style = {
    transform: CSS.Translate.toString(transform),
    '--guest-cat-color': categoryVisual.color,
    '--guest-cat-bg': categoryVisual.background,
  };

  // ── 二次確認刪除狀態 ────────────────────────────────────────────
  const [pendingDelete, setPendingDelete] = useState(false);
  const resetTimer = useRef(null);

  useEffect(() => () => clearTimeout(resetTimer.current), []);

  const handleDeleteClick = useCallback((e) => {
    e.stopPropagation();
    e.preventDefault();

    if (!pendingDelete) {
      // 第一次點擊 → 進入待確認狀態
      setPendingDelete(true);
      // 3 秒後自動還原
      clearTimeout(resetTimer.current);
      resetTimer.current = setTimeout(() => setPendingDelete(false), 3000);
    } else {
      // 第二次點擊 → 真正刪除
      clearTimeout(resetTimer.current);
      setPendingDelete(false);
      onDelete?.(guest.id);
    }
  }, [pendingDelete, onDelete, guest.id]);

  // 離開 card hover 時取消待確認（若 3 秒 timer 已在跑則保留）
  const handleMouseLeave = useCallback(() => {
    if (pendingDelete) {
      clearTimeout(resetTimer.current);
      resetTimer.current = setTimeout(() => setPendingDelete(false), 1200);
    }
  }, [pendingDelete]);

  const handleEditClick = (e) => {
    e.stopPropagation();
    e.preventDefault();
    onEdit?.(guest);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={[
        'guest-card',
        compact ? 'guest-card--compact' : '',
        isDragging ? 'guest-card--dragging' : '',
        guest.partyId ? 'guest-card--party' : '',
        guest.partyRole === 'companion' ? 'guest-card--companion' : '',
        locked ? 'guest-card--locked' : '',
        className,
      ].join(' ')}
      {...listeners}
      {...attributes}
      onContextMenu={(e) => {
        e.preventDefault();
        onRemove?.();
      }}
      onMouseLeave={handleMouseLeave}
      title={`${guest.name}｜${categoryVisual.label}${guest.diet ? `｜飲食: ${guest.diet}` : ''}\n右鍵移回未分配`}
    >
      {/* Category color bar */}
      <span
        className="guest-card__cat-bar"
        aria-label={categoryVisual.label}
      />

      <div className="guest-card__body">
        <span className="guest-card__name">{guest.name}</span>
        {!compact && guest.diet && (
          <span className="guest-card__note">{guest.diet}</span>
        )}
        {compact && guest.diet && (
          <span className="guest-card__note guest-card__note--dot" title={guest.diet}>註</span>
        )}
      </div>

      {!compact && (
        <span
          className="guest-card__cat-badge"
        >
          {categoryVisual.label}
        </span>
      )}
      {partyLabel && (
        <span className={`guest-card__party-badge${compact ? ' guest-card__party-badge--compact' : ''}`}>
          {partyLabel}
        </span>
      )}
      <LockBadge locked={locked} compact={compact} />

      {/* Action buttons — visible on hover, suppresses drag */}
      <div className="guest-card__actions">
        {/* Edit button */}
        {onEdit && (
          <button
            className="guest-card__action-btn guest-card__edit-btn"
            onClick={handleEditClick}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label={`編輯 ${guest.name}`}
            title="編輯賓客資料"
            tabIndex={0}
          >
            編
          </button>
        )}

        {/* Delete button — two-step confirm */}
        {onDelete && (
          <button
            className={`guest-card__action-btn guest-card__delete-btn${pendingDelete ? ' guest-card__delete-btn--confirm' : ''}`}
            onClick={handleDeleteClick}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label={pendingDelete ? `確認刪除 ${guest.name}` : `刪除 ${guest.name}`}
            title={pendingDelete ? '再按一次確認刪除' : '刪除賓客'}
            tabIndex={0}
          >
            {pendingDelete ? '確認' : '刪'}
          </button>
        )}
      </div>
    </div>
  );
}
