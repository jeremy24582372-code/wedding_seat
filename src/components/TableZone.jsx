import { useState, useRef, useEffect } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import './TableZone.css';
import { MAX_SEATS, getCategoryVisual } from '../utils/constants';
import LockBadge from './LockBadge';

/**
 * Calculate the (x, y) position of a seat on a circle.
 * index 0 starts at the top (12 o'clock), goes clockwise.
 */
function seatPosition(index, total, radius) {
  const angle = (2 * Math.PI * index) / total - Math.PI / 2;
  return {
    x: radius * Math.cos(angle),
    y: radius * Math.sin(angle),
  };
}

// ── Per-seat droppable slot ──────────────────────────────────────
// SeatSlot needs its own confirm state, so we isolate it.
function SeatSlot({ tableId, seatIndex, guest, locked, onMoveOut, onEdit, onDelete, cx, cy, seatR }) {
  const isEmpty = !guest;
  // Always register as droppable (even occupied) so dnd-kit tracks it;
  // actual accept/reject logic is in handleDragEnd via elementFromPoint.
  const { setNodeRef: setDroppableNodeRef, isOver } = useDroppable({
    id: `${tableId}:seat:${seatIndex}`,
    data: { tableId, seatIndex, isEmpty }, // isEmpty passed for accurate drop validation
  });
  const {
    attributes,
    listeners,
    setNodeRef: setDraggableNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: guest?.id ?? `${tableId}:seat:${seatIndex}:empty`,
    data: { guestId: guest?.id ?? null, tableId, seatIndex },
    disabled: isEmpty,
  });
  const draggableListeners = listeners ?? {};
  const draggableAttributes = attributes ?? {};
  const setNodeRef = (node) => {
    setDroppableNodeRef(node);
    setDraggableNodeRef(node);
  };

  const categoryVisual = guest ? getCategoryVisual(guest.category) : null;
  const partyLabel = guest?.partyId
    ? guest.partyRole === 'companion' ? '同行座位' : '主要座位'
    : '';

  const style = {
    left:   cx - seatR,
    top:    cy - seatR,
    width:  seatR * 2,
    height: seatR * 2,
    position: 'absolute',
    transform: CSS.Translate.toString(transform),
    ...(categoryVisual
      ? {
        '--seat-cat-border': categoryVisual.floorBorder,
        '--seat-cat-bg': categoryVisual.floorBackground,
      }
      : {}),
  };

  // data-* attrs are used by elementFromPoint in handleDragEnd
  const dataAttrs = {
    'data-table-id':  tableId,
    'data-seat-index': String(seatIndex),
    'data-seat-empty': isEmpty ? 'true' : 'false',
  };

  // ── Seat-level delete confirm state ──
  const [pendingDelete, setPendingDelete] = useState(false);
  const resetTimer = useRef(null);

  useEffect(() => () => clearTimeout(resetTimer.current), []);

  const handleSeatDeleteClick = (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (!pendingDelete) {
      setPendingDelete(true);
      clearTimeout(resetTimer.current);
      resetTimer.current = setTimeout(() => setPendingDelete(false), 3000);
    } else {
      clearTimeout(resetTimer.current);
      setPendingDelete(false);
      onDelete?.(guest.id);
    }
  };

  if (isEmpty) {
    return (
      <div
        ref={setNodeRef}
        className={`table-zone__seat table-zone__seat--empty${isOver ? ' table-zone__seat--over' : ''}`}
        style={style}
        aria-label={`座位 ${seatIndex + 1}（空）`}
        {...dataAttrs}
      >
        <span className="table-zone__seat-num" style={{ pointerEvents: 'none' }}>{seatIndex + 1}</span>
      </div>
    );
  }

  const handleFilledSeatKeyDown = (e) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onMoveOut(guest.id);
    }
  };

  return (
    <div
      ref={setNodeRef}
      className={[
        'table-zone__seat',
        'table-zone__seat--filled',
        isOver ? 'table-zone__seat--swap-target' : '',
        guest.partyId ? 'table-zone__seat--party' : '',
        guest.partyRole === 'companion' ? 'table-zone__seat--companion' : '',
        locked ? 'table-zone__seat--locked' : '',
        isDragging ? 'table-zone__seat--dragging' : '',
      ].filter(Boolean).join(' ')}
      style={style}
      {...draggableListeners}
      {...draggableAttributes}
      onClick={() => onMoveOut(guest.id)}
      title={`${guest.name}（${categoryVisual.label}）${partyLabel ? '\n' + partyLabel : ''}${guest.diet ? '\n飲食: ' + guest.diet : ''}\n點擊移回未分配`}
      aria-label={`${guest.name}，${partyLabel || categoryVisual.label}，點擊移回未分配`}
      {...dataAttrs}
      role="button"
      tabIndex={0}
      onKeyDown={handleFilledSeatKeyDown}
    >
      <span className="table-zone__seat-name" style={{ pointerEvents: 'none' }}>{guest.name}</span>
      {partyLabel && (
        <span className="table-zone__seat-party" aria-hidden="true">
          {guest.partyRole === 'companion' ? '同' : '主'}
        </span>
      )}
      <span className="table-zone__seat-lock">
        <LockBadge locked={locked} compact />
      </span>

      {/* Seat action overlay: edit + delete */}
      {(onEdit || onDelete) && (
        <span className="table-zone__seat-actions">
          {onEdit && (
            <span
              className="table-zone__seat-btn"
              onClick={(e) => { e.stopPropagation(); onEdit(guest); }}
              onPointerDown={(e) => e.stopPropagation()}
              title="編輯賓客資料"
              role="button"
              aria-label={`編輯 ${guest.name}`}
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onEdit(guest); } }}
            >
              編
            </span>
          )}
          {onDelete && (
            <span
              className={`table-zone__seat-btn table-zone__seat-delete${pendingDelete ? ' table-zone__seat-delete--confirm' : ''}`}
              onClick={handleSeatDeleteClick}
              onPointerDown={(e) => e.stopPropagation()}
              title={pendingDelete ? '再按一次確認刪除' : '刪除賓客'}
              role="button"
              aria-label={pendingDelete ? `確認刪除 ${guest.name}` : `刪除 ${guest.name}`}
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSeatDeleteClick(e); }}
            >
              {pendingDelete ? '!' : '×'}
            </span>
          )}
        </span>
      )}
    </div>
  );
}

export default function TableZone({ table, guests, lockedAssignments = {}, onMoveOut, onRename, onRemove, onEdit, onDelete }) {
  const filledCount = table.guestIds.filter(Boolean).length;
  const isFull      = filledCount >= MAX_SEATS;
  const remainingSeats = Math.max(0, MAX_SEATS - filledCount);
  const isAlmostFull = remainingSeats > 0 && remainingSeats <= 2;

  // Inline rename (double-click on centre label)
  const [editing, setEditing]       = useState(false);
  const [labelDraft, setLabelDraft] = useState(table.label);
  const inputRef = useRef(null);
  const [pendingRemove, setPendingRemove] = useState(false);
  const removeResetTimer = useRef(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  useEffect(() => () => clearTimeout(removeResetTimer.current), []);

  const commitRename = () => {
    setEditing(false);
    const trimmed = labelDraft.trim();
    if (trimmed && trimmed !== table.label) onRename(table.id, trimmed);
    else setLabelDraft(table.label);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter')  commitRename();
    if (e.key === 'Escape') { setLabelDraft(table.label); setEditing(false); }
  };

  const handleRemoveClick = () => {
    if (filledCount === 0) {
      onRemove(table.id);
      return;
    }

    if (!pendingRemove) {
      setPendingRemove(true);
      clearTimeout(removeResetTimer.current);
      removeResetTimer.current = setTimeout(() => setPendingRemove(false), 4000);
      return;
    }

    clearTimeout(removeResetTimer.current);
    setPendingRemove(false);
    onRemove(table.id);
  };

  // Layout constants
  const SIZE       = 260;
  const CENTER     = SIZE / 2;
  const TABLE_R    = 72;
  const SEAT_ORBIT = 108;
  const SEAT_R     = 26;

  return (
    <article
      className={[
        'table-zone',
        isFull ? 'table-zone--full table-zone--locked' : '',
        isAlmostFull ? 'table-zone--almost-full' : '',
      ].filter(Boolean).join(' ')}
      data-full={isFull ? 'true' : 'false'}
      aria-label={`${table.label}，${filledCount}/${MAX_SEATS} 人${isFull ? '，已滿桌' : ''}`}
    >
      {/* ── Circular diagram ── */}
      <div
        className="table-zone__diagram"
        id={`table-drop-${table.id}`}
        style={{ width: SIZE, height: SIZE }}
      >
        {/* SVG background elements */}
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="table-zone__svg"
          aria-hidden="true"
        >
          {/* Table surface */}
          <circle
            cx={CENTER} cy={CENTER} r={TABLE_R}
            className="table-zone__surface"
          />
          {/* Seat orbit guide ring */}
          <circle
            cx={CENTER} cy={CENTER} r={SEAT_ORBIT}
            fill="none"
            stroke="var(--color-border)"
            strokeWidth="1"
            strokeDasharray="3 5"
            opacity="0.4"
          />
        </svg>

        {/* ── Seat slots (HTML layer for interaction) ── */}
        {Array.from({ length: MAX_SEATS }).map((_, i) => {
          const { x, y } = seatPosition(i, MAX_SEATS, SEAT_ORBIT);
          const guestId  = table.guestIds[i];
          const guest    = guestId ? guests.find(g => g.id === guestId) : null;

          return (
            <SeatSlot
              key={i}
              tableId={table.id}
              seatIndex={i}
              guest={guest}
              locked={Boolean(guest && lockedAssignments?.[guest.id])}
              onMoveOut={onMoveOut}
              onEdit={onEdit}
              onDelete={onDelete}
              cx={CENTER + x}
              cy={CENTER + y}
              seatR={SEAT_R}
            />
          );
        })}

        {/* ── Table centre label ── */}
        <div
          className="table-zone__center-label"
          style={{ width: TABLE_R * 2, height: TABLE_R * 2, left: CENTER - TABLE_R, top: CENTER - TABLE_R }}
        >
          {editing ? (
            <input
              ref={inputRef}
              className="table-zone__rename-input"
              value={labelDraft}
              onChange={e => setLabelDraft(e.target.value)}
              onBlur={commitRename}
              onKeyDown={handleKeyDown}
              maxLength={12}
              aria-label="重新命名桌次"
            />
          ) : (
            <span
              className="table-zone__label"
              onDoubleClick={() => setEditing(true)}
              title="雙擊重新命名"
            >
              {table.label}
            </span>
          )}
          <span className="table-zone__count">
            {filledCount}/{MAX_SEATS}
          </span>
        </div>
      </div>

      {/* ── Controls ── */}
      <footer className="table-zone__footer">
        <button
          className={`table-zone__remove-btn${pendingRemove ? ' table-zone__remove-btn--confirm' : ''}`}
          onClick={handleRemoveClick}
          title={
            filledCount === 0
              ? '刪除此空桌'
              : pendingRemove
                ? `再按一次確認，將 ${filledCount} 位賓客移回未分配`
                : `此桌有 ${filledCount} 位賓客，需二次確認`
          }
          aria-label={
            filledCount === 0
              ? `刪除空桌 ${table.label}`
              : pendingRemove
                ? `確認刪除 ${table.label}，釋放 ${filledCount} 位賓客`
                : `刪除 ${table.label}，此桌有 ${filledCount} 位賓客，需二次確認`
          }
        >
          {filledCount > 0 && pendingRemove ? `確認釋放 ${filledCount} 位` : '刪除此桌'}
        </button>
        {isFull && <span className="table-zone__full-badge">已滿 · 10 人</span>}
        {isAlmostFull && <span className="table-zone__almost-full-badge">剩 {remainingSeats} 位</span>}
      </footer>
    </article>
  );
}
