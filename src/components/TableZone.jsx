import { useState, useRef, useEffect } from 'react';
import { useDroppable } from '@dnd-kit/core';
import './TableZone.css';
import { MAX_SEATS } from '../utils/constants';

const CATEGORY_CLASS = {
  '男方親友': 'cat-groom',
  '女方親友': 'cat-bride',
  '共同朋友': 'cat-mutual',
  '同事':     'cat-colleague',
  '其他':     'cat-other',
};

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
function SeatSlot({ tableId, seatIndex, guest, onMoveOut, onEdit, onDelete, cx, cy, seatR }) {
  const isEmpty = !guest;
  // Always register as droppable (even occupied) so dnd-kit tracks it;
  // actual accept/reject logic is in handleDragEnd via elementFromPoint.
  const { setNodeRef, isOver } = useDroppable({
    id: `${tableId}:seat:${seatIndex}`,
    data: { tableId, seatIndex, isEmpty }, // isEmpty passed for accurate drop validation
  });

  const catClass = guest ? (CATEGORY_CLASS[guest.category] ?? 'cat-other') : '';

  const style = {
    left:   cx - seatR,
    top:    cy - seatR,
    width:  seatR * 2,
    height: seatR * 2,
    position: 'absolute',
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

  return (
    <button
      ref={setNodeRef}
      className={`table-zone__seat table-zone__seat--filled ${catClass}`}
      style={style}
      onClick={() => onMoveOut(guest.id)}
      title={`${guest.name}（${guest.category}）${guest.note ? '\n' + guest.note : ''}\n點擊移回未分配`}
      aria-label={`${guest.name}，點擊移回未分配`}
      {...dataAttrs}
    >
      <span className="table-zone__seat-name" style={{ pointerEvents: 'none' }}>{guest.name}</span>

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
              ✏️
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
    </button>
  );
}

export default function TableZone({ table, guests, onMoveOut, onRename, onRemove, onEdit, onDelete }) {
  const filledCount = table.guestIds.filter(Boolean).length;
  const isFull      = filledCount >= MAX_SEATS;

  // Inline rename (double-click on centre label)
  const [editing, setEditing]       = useState(false);
  const [labelDraft, setLabelDraft] = useState(table.label);
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

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
        isFull ? 'table-zone--full' : '',
      ].filter(Boolean).join(' ')}
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
          className="table-zone__remove-btn"
          onClick={() => onRemove(table.id)}
          title="刪除此桌（賓客移回未分配）"
          aria-label={`刪除 ${table.label}`}
        >
          ✕ 刪除
        </button>
        {isFull && <span className="table-zone__full-badge">已滿桌</span>}
      </footer>
    </article>
  );
}
