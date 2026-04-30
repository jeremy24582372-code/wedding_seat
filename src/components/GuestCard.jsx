import { useState, useRef, useCallback } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import './GuestCard.css';

// Maps category ID to CSS token
const CAT_TOKENS = {
  '男方親友': 'var(--color-cat-groom)',
  '女方親友': 'var(--color-cat-bride)',
  '共同朋友': 'var(--color-cat-mutual)',
  '同事':     'var(--color-cat-colleague)',
  '其他':     'var(--color-cat-other)',
};

/**
 * Draggable guest card.
 * Props:
 *   guest     — { id, name, category, diet }
 *   onRemove  — () => void  (right-click: move back to unassigned)
 *   onEdit    — (guest) => void  (pencil icon click: open edit modal)
 *   onDelete  — (guestId) => void  (trash icon: permanently delete with 2-step confirm)
 *   compact   — bool (smaller variant used inside TableZone)
 */
export default function GuestCard({ guest, onRemove, onEdit, onDelete, compact = false }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: guest.id,
    data: { guestId: guest.id, tableId: guest.tableId },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
  };

  const catColor = CAT_TOKENS[guest.category] || CAT_TOKENS['其他'];

  // ── 二次確認刪除狀態 ────────────────────────────────────────────
  const [pendingDelete, setPendingDelete] = useState(false);
  const resetTimer = useRef(null);

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
      ].join(' ')}
      {...listeners}
      {...attributes}
      onContextMenu={(e) => {
        e.preventDefault();
        onRemove?.();
      }}
      onMouseLeave={handleMouseLeave}
      title={`${guest.name}｜${guest.category}${guest.diet ? `｜飲食: ${guest.diet}` : ''}\n右鍵 → 移回未分配`}
    >
      {/* Category color bar */}
      <span
        className="guest-card__cat-bar"
        style={{ background: catColor }}
        aria-label={guest.category}
      />

      <div className="guest-card__body">
        <span className="guest-card__name">{guest.name}</span>
        {!compact && guest.diet && (
          <span className="guest-card__note">{guest.diet}</span>
        )}
        {compact && guest.diet && (
          <span className="guest-card__note guest-card__note--dot" title={guest.diet}>●</span>
        )}
      </div>

      {!compact && (
        <span
          className="guest-card__cat-badge"
          style={{ color: catColor }}
        >
          {guest.category}
        </span>
      )}

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
            ✏️
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
            {pendingDelete ? '確認？' : '🗑️'}
          </button>
        )}
      </div>
    </div>
  );
}
