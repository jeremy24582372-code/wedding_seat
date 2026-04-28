import { useRef, useState, useEffect, useCallback } from 'react';
import TableZone from './TableZone';
import './FloorPlan.css';
import { CANVAS_WIDTH, CANVAS_HEIGHT, defaultTablePosition } from '../utils/constants';

/**
 * FloorPlan — A large, pannable canvas where tables can be freely dragged.
 *
 * Two independent drag systems coexist:
 *  1. Table repositioning — handled here via pointer events on the drag-handle.
 *     We use pointer events (not dnd-kit) to avoid conflicting with guest DnD.
 *  2. Guest assignment — handled by dnd-kit in App.jsx (TableZone is a droppable).
 *
 * @param {object[]}  tables           - Array of table objects
 * @param {object}    guests           - All guest objects keyed by id
 * @param {object}    positions        - { [tableId]: { x, y } } — canvas coordinates
 * @param {function}  onUpdatePosition - (tableId, { x, y }) => void
 * @param {function}  onMoveOut        - (guestId) => void — move guest back to pool
 * @param {function}  onRename         - (tableId, label) => void
 * @param {function}  onRemove         - (tableId) => void
 */
export default function FloorPlan({
  tables,
  guests,
  positions,
  onUpdatePosition,
  onMoveOut,
  onRename,
  onRemove,
  onEdit,
  onDelete,
}) {
  const canvasRef = useRef(null);

  // ── Canvas pan state ──────────────────────────────────────────
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(0.85);
  const panStart = useRef(null);   // { x, y, panX, panY }

  // ── Table drag state ──────────────────────────────────────────
  // tableDrag.current: { tableId, startX, startY, origX, origY, pointerId,
  //                      dragGroup: string[], originals: {[id]:{x,y}}, hasMoved: bool }
  const tableDrag = useRef(null);
  const [draggingTableId, setDraggingTableId] = useState(null);
  const [livePos, setLivePos] = useState(null); // live { x, y } of primary dragged table
  // Mirror of tableDrag.current.dragGroup / .originals stored as state so
  // getLivePosForTable can compute positions during render without touching the ref.
  const [dragGroupState, setDragGroupState]       = useState([]);
  const [dragOriginalsState, setDragOriginalsState] = useState({});

  // ── Multi-select state ────────────────────────────────────────
  const [selectedTableIds, setSelectedTableIds] = useState(new Set());

  // ── Inline rename state ───────────────────────────────────────
  const [renamingTableId, setRenamingTableId] = useState(null);
  const [renameDraft, setRenameDraft]         = useState('');
  const renameInputRef = useRef(null);

  // Resolve position: use stored or compute default
  const getPos = useCallback((table, index) => {
    return positions?.[table.id] ?? defaultTablePosition(index);
  }, [positions]);

  // ── Canvas pan — MMB or Space+drag ───────────────────────────
  const handleCanvasPointerDown = useCallback((e) => {
    // Middle button OR space key held
    if (e.button === 1 || e.spaceDown) {
      e.preventDefault();
      panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
      canvasRef.current?.setPointerCapture(e.pointerId);
      canvasRef.current?.classList.add('floor-plan__canvas--panning');
    }
  }, [pan]);

  const handleCanvasPointerMove = useCallback((e) => {
    if (panStart.current) {
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      setPan({ x: panStart.current.panX + dx, y: panStart.current.panY + dy });
    }
  }, []);

  const handleCanvasPointerUp = useCallback((e) => {
    if (panStart.current) {
      panStart.current = null;
      canvasRef.current?.releasePointerCapture(e.pointerId);
      canvasRef.current?.classList.remove('floor-plan__canvas--panning');
    }
  }, []);

  // Zoom with wheel
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.06 : 0.06;
    setZoom(z => Math.min(2, Math.max(0.3, z + delta)));
  }, []);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  // Reset view
  const handleResetView = () => { setPan({ x: 0, y: 0 }); setZoom(0.85); };

  // ── Rename helpers ────────────────────────────────────────────
  const startRename = useCallback((e, table) => {
    // Stop propagation so the pointerdown drag handler doesn't fire
    e.stopPropagation();
    e.preventDefault();
    setRenamingTableId(table.id);
    setRenameDraft(table.label);
    // Focus on next tick after element mounts
    requestAnimationFrame(() => renameInputRef.current?.select());
  }, []);

  const commitRename = useCallback((tableId) => {
    const trimmed = renameDraft.trim();
    if (trimmed) onRename(tableId, trimmed);
    setRenamingTableId(null);
  }, [renameDraft, onRename]);

  const cancelRename = useCallback((table) => {
    setRenameDraft(table.label);
    setRenamingTableId(null);
  }, []);

  const handleRenameKeyDown = useCallback((e, tableId, table) => {
    if (e.key === 'Enter')  { e.preventDefault(); commitRename(tableId); }
    if (e.key === 'Escape') { e.preventDefault(); cancelRename(table); }
  }, [commitRename, cancelRename]);

  // ── Table drag handle ─────────────────────────────────────────
  /**
   * Called when user clicks the drag-handle on a table.
   * We track pointer events globally on the canvas wrapper to avoid
   * losing the pointer when moving fast.
   */
  const handleTableDragStart = useCallback((e, tableId, index) => {
    e.stopPropagation();
    e.preventDefault();
    const orig = getPos(tables.find(t => t.id === tableId), index);

    // Determine which tables move: if this table is in the selection, drag the
    // whole group; otherwise, drag only this table (don't change selection).
    const dragGroup = selectedTableIds.has(tableId)
      ? [...selectedTableIds]
      : [tableId];

    // Snapshot original positions for every table in the drag group.
    const originals = {};
    dragGroup.forEach(tid => {
      const t   = tables.find(tt => tt.id === tid);
      const idx = tables.findIndex(tt => tt.id === tid);
      if (t) originals[tid] = getPos(t, idx);
    });

    tableDrag.current = {
      tableId,
      startX: e.clientX,
      startY: e.clientY,
      origX: orig.x,
      origY: orig.y,
      pointerId: e.pointerId,
      dragGroup,
      originals,
      hasMoved: false,
    };
    // Mirror into state so getLivePosForTable can read during render without ref access.
    setDragGroupState(dragGroup);
    setDragOriginalsState(originals);
    setDraggingTableId(tableId);
    setLivePos({ x: orig.x, y: orig.y });
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [getPos, tables, selectedTableIds]);

  const handleTableDragMove = useCallback((e) => {
    if (!tableDrag.current) return;
    const rawDx = e.clientX - tableDrag.current.startX;
    const rawDy = e.clientY - tableDrag.current.startY;
    if (Math.abs(rawDx) > 4 || Math.abs(rawDy) > 4) tableDrag.current.hasMoved = true;
    const dx = rawDx / zoom;
    const dy = rawDy / zoom;
    const { origX, origY } = tableDrag.current;
    const newX = Math.max(0, Math.min(CANVAS_WIDTH  - 280, origX + dx));
    const newY = Math.max(0, Math.min(CANVAS_HEIGHT - 320, origY + dy));
    setLivePos({ x: newX, y: newY });
  }, [zoom]);

  const handleTableDragEnd = useCallback((e) => {
    if (!tableDrag.current) return;
    const { tableId, startX, startY, dragGroup, originals, hasMoved } = tableDrag.current;

    if (!hasMoved) {
      // Treat as a click → toggle selection
      if (e.shiftKey || e.ctrlKey || e.metaKey) {
        setSelectedTableIds(prev => {
          const next = new Set(prev);
          next.has(tableId) ? next.delete(tableId) : next.add(tableId);
          return next;
        });
      } else {
        // Exclusive select, or deselect if already sole selection
        setSelectedTableIds(prev =>
          prev.size === 1 && prev.has(tableId) ? new Set() : new Set([tableId])
        );
      }
      tableDrag.current = null;
      setDraggingTableId(null);
      setLivePos(null);
      setDragGroupState([]);
      setDragOriginalsState({});
      return;
    }

    // Real drag → commit positions for all tables in the group
    const dx = (e.clientX - startX) / zoom;
    const dy = (e.clientY - startY) / zoom;
    dragGroup.forEach(tid => {
      const orig = originals[tid];
      if (!orig) return;
      const newX = Math.max(0, Math.min(CANVAS_WIDTH  - 280, orig.x + dx));
      const newY = Math.max(0, Math.min(CANVAS_HEIGHT - 320, orig.y + dy));
      onUpdatePosition(tid, { x: newX, y: newY });
    });

    tableDrag.current = null;
    setDraggingTableId(null);
    setLivePos(null);
    setDragGroupState([]);
    setDragOriginalsState({});
  }, [zoom, onUpdatePosition]);

  /**
   * Compute the live (in-drag) canvas position for any table in the current drag group.
   * Returns null if the table is not being dragged.
   * Reads only from state (draggingTableId, livePos, dragGroupState, dragOriginalsState)
   * — never from refs — so it is safe to call during render.
   */
  function getLivePosForTable(tableId) {
    if (!draggingTableId || !livePos) return null;
    if (!dragGroupState.includes(tableId)) return null;
    if (tableId === draggingTableId) return livePos;
    // Apply the same visual delta as the primary dragged table
    const primaryOrig = dragOriginalsState[draggingTableId];
    const otherOrig   = dragOriginalsState[tableId];
    if (!primaryOrig || !otherOrig) return null;
    const dx = livePos.x - primaryOrig.x;
    const dy = livePos.y - primaryOrig.y;
    return {
      x: Math.max(0, Math.min(CANVAS_WIDTH  - 280, otherOrig.x + dx)),
      y: Math.max(0, Math.min(CANVAS_HEIGHT - 320, otherOrig.y + dy)),
    };
  }

  return (
    <div className="floor-plan" id="floor-plan">
      {/* ── Controls overlay ─────────────────────────── */}
      <div className="floor-plan__controls" aria-label="場地視圖控制">
        <button
          className="floor-plan__ctrl-btn"
          onClick={() => setZoom(z => Math.min(2, z + 0.1))}
          title="放大"
          aria-label="放大"
        >＋</button>
        <button
          className="floor-plan__ctrl-btn"
          onClick={() => setZoom(z => Math.max(0.3, z - 0.1))}
          title="縮小"
          aria-label="縮小"
        >－</button>
        <button
          className="floor-plan__ctrl-btn"
          onClick={handleResetView}
          title="重置視角"
          aria-label="重置視角"
        >⌂</button>
        <span className="floor-plan__zoom-label">{Math.round(zoom * 100)}%</span>
      </div>

      {/* ── Legend ───────────────────────────────────── */}
      <div className="floor-plan__legend" aria-label="圖例">
        <span className="floor-plan__legend-tip">🖱 中鍵拖曳平移 · 滾輪縮放</span>
        <span className="floor-plan__legend-tip">⠿ 拖曳桌名移動桌次</span>
      </div>

      {/* ── Scrollable viewport ───────────────────────── */}
      <div
        className="floor-plan__viewport"
        ref={canvasRef}
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={handleCanvasPointerMove}
        onPointerUp={handleCanvasPointerUp}
      >
        {/* Transformed canvas — click on background to deselect all tables */}
        <div
          className="floor-plan__canvas"
          style={{
            width: CANVAS_WIDTH,
            height: CANVAS_HEIGHT,
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
          }}
          onClick={(e) => {
            // Deselect all only when clicking the true canvas background
            // (not inside any table wrapper) and no modifier keys are held.
            if (!e.shiftKey && !e.ctrlKey && !e.metaKey &&
                !e.target.closest('.floor-plan__table-wrapper')) {
              setSelectedTableIds(new Set());
            }
          }}
        >
          {/* ── Room label ── */}
          <div className="floor-plan__room-label">婚宴廳</div>

          {/* ── Stage / Head table indicator ── */}
          <div className="floor-plan__stage">
            <span>♡ 主桌 / 舞台</span>
          </div>

          {/* ── Tables ── */}
          {/* Legend tip for multi-select */}
          {selectedTableIds.size > 0 && (
            <div className="floor-plan__select-tip">
              已選 {selectedTableIds.size} 桌｜拖曳任一選取桌次可一起移動｜點擊空白處取消選取
            </div>
          )}

          {tables.map((table, index) => {
            const liveForTable = getLivePosForTable(table.id);
            const isDragging   = !!liveForTable;
            const isSelected   = selectedTableIds.has(table.id);
            const pos          = liveForTable ?? getPos(table, index);

            return (
              <div
                key={table.id}
                className={[
                  'floor-plan__table-wrapper',
                  isDragging ? 'floor-plan__table-wrapper--dragging' : '',
                  isSelected ? 'floor-plan__table-wrapper--selected' : '',
                ].filter(Boolean).join(' ')}
                style={{
                  left: pos.x,
                  top: pos.y,
                  position: 'absolute',
                  zIndex: isDragging ? 100 : isSelected ? 10 : 1,
                }}
                onClick={(e) => {
                  // Shift/Ctrl/Meta + click anywhere on the card → multi-select toggle
                  if (e.shiftKey || e.ctrlKey || e.metaKey) {
                    e.stopPropagation();
                    setSelectedTableIds(prev => {
                      const next = new Set(prev);
                      next.has(table.id) ? next.delete(table.id) : next.add(table.id);
                      return next;
                    });
                  }
                }}
              >
                {/* Drag handle — sits above the table diagram */}
                <div
                  className="floor-plan__drag-handle"
                  onPointerDown={(e) => {
                    // Don't start dragging when clicking the rename input or label
                    if (e.target.closest('.floor-plan__rename-input, .floor-plan__drag-label')) return;
                    handleTableDragStart(e, table.id, index);
                  }}
                  onPointerMove={handleTableDragMove}
                  onPointerUp={handleTableDragEnd}
                  onPointerCancel={handleTableDragEnd}
                  title="拖曳 ⠿ 圖示移動此桌"
                  aria-label={`移動 ${table.label}`}
                >
                  <span className="floor-plan__drag-icon" style={{ flexShrink: 0 }}>⠿</span>
                  {renamingTableId === table.id ? (
                    <input
                      ref={renameInputRef}
                      className="floor-plan__rename-input"
                      value={renameDraft}
                      onChange={e => setRenameDraft(e.target.value)}
                      onBlur={() => commitRename(table.id)}
                      onKeyDown={e => handleRenameKeyDown(e, table.id, table)}
                      onPointerDown={e => e.stopPropagation()}
                      maxLength={16}
                      aria-label="重新命名桌次"
                    />
                  ) : (
                    <span
                      className="floor-plan__drag-label floor-plan__drag-label--editable"
                      onClick={e => startRename(e, table)}
                      onPointerDown={e => e.stopPropagation()}
                      title="點擊改名"
                    >
                      {table.label}
                      <span className="floor-plan__edit-hint">✎</span>
                    </span>
                  )}
                </div>

                {/* The circular table diagram */}
                <TableZone
                  table={table}
                  guests={guests}
                  onMoveOut={onMoveOut}
                  onRename={onRename}
                  onRemove={onRemove}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
