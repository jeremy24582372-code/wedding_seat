import { useRef, useState, useEffect, useCallback } from 'react';
import TableZone from './TableZone';
import './FloorPlan.css';
import { CANVAS_WIDTH, CANVAS_HEIGHT, defaultTablePosition } from '../utils/constants';

// ── Alignment constants ────────────────────────────────────────────────────
const GRID_SIZE       = 40;   // matches dot-grid background-size
const SNAP_THRESHOLD  = 12;   // px — snap zone around each grid line
const GUIDE_THRESHOLD = 8;    // px — smart guide detection tolerance
const TABLE_W         = 280;  // approximate table card width
const TABLE_H         = 320;  // approximate table card height (handle + zone)

/** Snap a value to the nearest grid line if within SNAP_THRESHOLD. */
function snapToGrid(value) {
  const snapped = Math.round(value / GRID_SIZE) * GRID_SIZE;
  return Math.abs(value - snapped) < SNAP_THRESHOLD ? snapped : value;
}

/**
 * Compute smart guide lines for the primary dragging table vs all other tables.
 * Returns guide line canvas coordinates + snapped position if within tolerance.
 *
 * Guide types checked per axis:
 *   Vertical guides (X):  left=left, right=right, center=center, left=right, right=left
 *   Horizontal guides (Y): top=top, bottom=bottom, center=center, top=bottom, bottom=top
 *
 * @param {number}   dragX          Raw X of dragging table
 * @param {number}   dragY          Raw Y of dragging table
 * @param {{x,y}[]} otherPositions  Positions of non-dragging tables
 * @returns {{ h: number[], v: number[], snappedX: number, snappedY: number }}
 */
function computeGuidesAndSnap(dragX, dragY, otherPositions) {
  const dragL  = dragX,              dragR  = dragX + TABLE_W, dragCX = dragX + TABLE_W / 2;
  const dragT  = dragY,              dragB  = dragY + TABLE_H, dragCY = dragY + TABLE_H / 2;

  const hLines = new Set();
  const vLines = new Set();
  let snappedX = dragX, snappedY = dragY;
  let xSnapped = false, ySnapped = false;

  for (const pos of otherPositions) {
    const oL  = pos.x,              oR  = pos.x + TABLE_W, oCX = pos.x + TABLE_W / 2;
    const oT  = pos.y,              oB  = pos.y + TABLE_H, oCY = pos.y + TABLE_H / 2;

    // ── Vertical guides (compare X) ──
    if (!xSnapped) {
      const vChecks = [
        { dv: dragCX, ov: oCX, snap: oCX - TABLE_W / 2 },
        { dv: dragL,  ov: oL,  snap: oL                 },
        { dv: dragR,  ov: oR,  snap: oR - TABLE_W       },
        { dv: dragL,  ov: oR,  snap: oR                 },
        { dv: dragR,  ov: oL,  snap: oL - TABLE_W       },
      ];
      for (const { dv, ov, snap } of vChecks) {
        if (Math.abs(dv - ov) <= GUIDE_THRESHOLD) {
          vLines.add(ov);
          snappedX = snap;
          xSnapped = true;
          break;
        }
      }
    }

    // ── Horizontal guides (compare Y) ──
    if (!ySnapped) {
      const hChecks = [
        { dv: dragCY, ov: oCY, snap: oCY - TABLE_H / 2 },
        { dv: dragT,  ov: oT,  snap: oT                 },
        { dv: dragB,  ov: oB,  snap: oB - TABLE_H       },
        { dv: dragT,  ov: oB,  snap: oB                 },
        { dv: dragB,  ov: oT,  snap: oT - TABLE_H       },
      ];
      for (const { dv, ov, snap } of hChecks) {
        if (Math.abs(dv - ov) <= GUIDE_THRESHOLD) {
          hLines.add(ov);
          snappedY = snap;
          ySnapped = true;
          break;
        }
      }
    }

    if (xSnapped && ySnapped) break;
  }

  return {
    h: [...hLines],
    v: [...vLines],
    snappedX,
    snappedY,
    xSnapped,
    ySnapped,
  };
}

/**
 * FloorPlan — A large, pannable canvas where tables can be freely dragged.
 *
 * Two independent drag systems coexist:
 *  1. Table repositioning — handled here via pointer events on the drag-handle.
 *     We use pointer events (not dnd-kit) to avoid conflicting with guest DnD.
 *  2. Guest assignment — handled by dnd-kit in App.jsx (TableZone is a droppable).
 *
 * Alignment features:
 *  - Snap-to-Grid: tables snap to 40px grid on drag (toggle in controls)
 *  - Smart Guides: orange dashed guide lines appear when edges/centres align
 *  - Left-click pan: click empty canvas background and drag to pan
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
  const panStart = useRef(null); // { x, y, panX, panY, hasMoved }
  // Ref to block canvas onClick deselect when pan just finished with movement
  const panMovedRef = useRef(false);

  // ── Table drag state ──────────────────────────────────────────
  const tableDrag = useRef(null);
  const [draggingTableId, setDraggingTableId] = useState(null);
  const [livePos, setLivePos] = useState(null);
  const [dragGroupState, setDragGroupState]         = useState([]);
  const [dragOriginalsState, setDragOriginalsState] = useState({});
  // Stores the latest snapped positions for ALL tables in the drag group (guide+grid applied)
  const livePosGroupRef = useRef({});

  // ── Multi-select state ────────────────────────────────────────
  const [selectedTableIds, setSelectedTableIds] = useState(new Set());

  // ── Snap & Guide state ────────────────────────────────────────
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [guides, setGuides] = useState({ h: [], v: [] });

  // ── Inline rename state ───────────────────────────────────────
  const [renamingTableId, setRenamingTableId] = useState(null);
  const [renameDraft, setRenameDraft]         = useState('');
  const renameInputRef = useRef(null);

  // Resolve position: use stored or compute default
  const getPos = useCallback((table, index) => {
    return positions?.[table.id] ?? defaultTablePosition(index);
  }, [positions]);

  // ── Canvas pan ────────────────────────────────────────────────
  // Panning is triggered by:
  //   • Middle mouse button (button === 1)
  //   • Left click on empty canvas background (button === 0, not over a table)
  const handleCanvasPointerDown = useCallback((e) => {
    const isMiddleBtn      = e.button === 1;
    const isLeftBackground = e.button === 0 && !e.target.closest(
      '.floor-plan__table-wrapper, .floor-plan__ctrl-btn, .floor-plan__legend'
    );

    if (isMiddleBtn || isLeftBackground) {
      e.preventDefault();
      panMovedRef.current = false;
      panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
      canvasRef.current?.setPointerCapture(e.pointerId);
      canvasRef.current?.classList.add('floor-plan__canvas--panning');
    }
  }, [pan]);

  const handleCanvasPointerMove = useCallback((e) => {
    if (!panStart.current) return;
    const dx = e.clientX - panStart.current.x;
    const dy = e.clientY - panStart.current.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) panMovedRef.current = true;
    setPan({ x: panStart.current.panX + dx, y: panStart.current.panY + dy });
  }, []);

  const handleCanvasPointerUp = useCallback((e) => {
    if (!panStart.current) return;
    panStart.current = null;
    canvasRef.current?.releasePointerCapture(e.pointerId);
    canvasRef.current?.classList.remove('floor-plan__canvas--panning');
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
    e.stopPropagation();
    e.preventDefault();
    setRenamingTableId(table.id);
    setRenameDraft(table.label);
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
  const handleTableDragStart = useCallback((e, tableId, index) => {
    e.stopPropagation();
    e.preventDefault();
    const orig = getPos(tables.find(t => t.id === tableId), index);

    const dragGroup = selectedTableIds.has(tableId)
      ? [...selectedTableIds]
      : [tableId];

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
    const { origX, origY, originals, dragGroup } = tableDrag.current;

    let rawX = Math.max(0, Math.min(CANVAS_WIDTH  - TABLE_W, origX + dx));
    let rawY = Math.max(0, Math.min(CANVAS_HEIGHT - TABLE_H, origY + dy));

    // Collect positions of tables NOT in the drag group
    const otherPositions = tables
      .filter(t => !dragGroup.includes(t.id))
      .map(t => {
        const idx = tables.findIndex(tt => tt.id === t.id);
        return positions?.[t.id] ?? defaultTablePosition(idx);
      });

    // ── Smart guides + guide snap ──────────────────────────────
    const { h: hGuides, v: vGuides, snappedX, snappedY, xSnapped, ySnapped } =
      computeGuidesAndSnap(rawX, rawY, otherPositions);

    let finalX = xSnapped ? snappedX : rawX;
    let finalY = ySnapped ? snappedY : rawY;

    // ── Grid snap (lower priority — only when no guide snap on that axis) ──
    if (snapEnabled) {
      if (!xSnapped) finalX = snapToGrid(finalX);
      if (!ySnapped) finalY = snapToGrid(finalY);
    }

    // ── Record final snapped positions for ALL tables in the drag group ──
    // (used by handleTableDragEnd to commit exactly what the user sees)
    const snapDx = finalX - origX;
    const snapDy = finalY - origY;
    const groupSnapshot = {};
    dragGroup.forEach(tid => {
      const orig = originals[tid];
      if (!orig) return;
      groupSnapshot[tid] = {
        x: Math.max(0, Math.min(CANVAS_WIDTH  - TABLE_W, orig.x + snapDx)),
        y: Math.max(0, Math.min(CANVAS_HEIGHT - TABLE_H, orig.y + snapDy)),
      };
    });
    livePosGroupRef.current = groupSnapshot;

    setGuides({ h: hGuides, v: vGuides });
    setLivePos({ x: finalX, y: finalY });
  }, [zoom, snapEnabled, tables, positions]);

  const handleTableDragEnd = useCallback((e) => {
    if (!tableDrag.current) return;
    const { tableId, dragGroup, hasMoved } = tableDrag.current;

    // Clear guides regardless of whether we moved
    setGuides({ h: [], v: [] });

    if (!hasMoved) {
      // Treat as a click → toggle selection
      if (e.shiftKey || e.ctrlKey || e.metaKey) {
        setSelectedTableIds(prev => {
          const next = new Set(prev);
          next.has(tableId) ? next.delete(tableId) : next.add(tableId);
          return next;
        });
      } else {
        setSelectedTableIds(prev =>
          prev.size === 1 && prev.has(tableId) ? new Set() : new Set([tableId])
        );
      }
      tableDrag.current = null;
      setDraggingTableId(null);
      setLivePos(null);
      setDragGroupState([]);
      setDragOriginalsState({});
      livePosGroupRef.current = {};
      return;
    }

    // Real drag → commit the exact positions already computed (with guide+grid snap)
    // from the last handleTableDragMove call, stored in livePosGroupRef.
    const snapshot = livePosGroupRef.current;
    dragGroup.forEach(tid => {
      const pos = snapshot[tid];
      if (pos) onUpdatePosition(tid, pos);
    });

    tableDrag.current = null;
    setDraggingTableId(null);
    setLivePos(null);
    setDragGroupState([]);
    setDragOriginalsState({});
    livePosGroupRef.current = {};
  }, [onUpdatePosition]);

  /**
   * Compute the live (in-drag) canvas position for any table in the current drag group.
   * Reads only from state — safe to call during render.
   */
  function getLivePosForTable(tableId) {
    if (!draggingTableId || !livePos) return null;
    if (!dragGroupState.includes(tableId)) return null;
    if (tableId === draggingTableId) return livePos;
    const primaryOrig = dragOriginalsState[draggingTableId];
    const otherOrig   = dragOriginalsState[tableId];
    if (!primaryOrig || !otherOrig) return null;
    const dx = livePos.x - primaryOrig.x;
    const dy = livePos.y - primaryOrig.y;
    return {
      x: Math.max(0, Math.min(CANVAS_WIDTH  - TABLE_W, otherOrig.x + dx)),
      y: Math.max(0, Math.min(CANVAS_HEIGHT - TABLE_H, otherOrig.y + dy)),
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
        <div className="floor-plan__ctrl-divider" />
        <button
          className={`floor-plan__ctrl-btn${snapEnabled ? ' floor-plan__ctrl-btn--active' : ''}`}
          onClick={() => setSnapEnabled(s => !s)}
          title={snapEnabled ? '停用格線吸附' : '啟用格線吸附'}
          aria-label={snapEnabled ? '停用格線吸附' : '啟用格線吸附'}
          aria-pressed={snapEnabled}
        >⊞</button>
        <span className="floor-plan__zoom-label">{Math.round(zoom * 100)}%</span>
      </div>

      {/* ── Legend ───────────────────────────────────── */}
      <div className="floor-plan__legend" aria-label="圖例">
        <span className="floor-plan__legend-tip">左鍵拖曳平移 · 中鍵拖曳 · 滾輪縮放</span>
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
        {/* Transformed canvas */}
        <div
          className="floor-plan__canvas"
          style={{
            width: CANVAS_WIDTH,
            height: CANVAS_HEIGHT,
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
          }}
          onClick={(e) => {
            // Skip deselect if we just finished a pan drag
            if (panMovedRef.current) {
              panMovedRef.current = false;
              return;
            }
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

          {/* ── Smart guide lines SVG overlay ── */}
          {(guides.h.length > 0 || guides.v.length > 0) && (
            <svg
              className="floor-plan__guide-overlay"
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              aria-hidden="true"
            >
              {guides.h.map((y, i) => (
                <line
                  key={`h-${i}-${y}`}
                  x1={0} y1={y} x2={CANVAS_WIDTH} y2={y}
                  className="floor-plan__guide-line"
                />
              ))}
              {guides.v.map((x, i) => (
                <line
                  key={`v-${i}-${x}`}
                  x1={x} y1={0} x2={x} y2={CANVAS_HEIGHT}
                  className="floor-plan__guide-line"
                />
              ))}
            </svg>
          )}

          {/* ── Multi-select tip ── */}
          {selectedTableIds.size > 0 && (
            <div className="floor-plan__select-tip">
              已選 {selectedTableIds.size} 桌｜拖曳任一選取桌次可一起移動｜點擊空白處取消選取
            </div>
          )}

          {/* ── Tables ── */}
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
