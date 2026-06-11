import { useRef, useState, useCallback } from 'react';
import TableZone from './TableZone';
import './FloorPlan.css';
import { CANVAS_WIDTH, CANVAS_HEIGHT, defaultTablePosition } from '../utils/constants';
import { useFloorPlanSelection } from '../hooks/useFloorPlanSelection';
import { useFloorPlanTableDrag } from '../hooks/useFloorPlanTableDrag';
import { useFloorPlanViewport } from '../hooks/useFloorPlanViewport';

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
  onAddTable,
  lockedAssignments = {},
}) {
  // ── Inline rename state ───────────────────────────────────────
  const [renamingTableId, setRenamingTableId] = useState(null);
  const [renameDraft, setRenameDraft]         = useState('');
  const renameInputRef = useRef(null);
  const [tableLockState, setTableLockState] = useState({ locked: false, version: 0 });
  const tablesLocked = tableLockState.locked;
  const tableLockVersion = tableLockState.version;

  const toggleTablesLocked = useCallback(() => {
    setTableLockState(current => {
      const locked = !current.locked;
      return {
        locked,
        version: locked ? current.version + 1 : current.version,
      };
    });
  }, []);

  // Resolve position: use stored or compute default
  const getPos = useCallback((table, index) => {
    return table ? positions?.[table.id] ?? defaultTablePosition(index) : defaultTablePosition(index);
  }, [positions]);

  const {
    selectedTableIds,
    clearSelectedTables,
    selectTableFromPointer,
    handleTableWrapperClick,
  } = useFloorPlanSelection();

  const {
    canvasRef,
    pan,
    zoom,
    zoomIn,
    zoomOut,
    resetView,
    handleCanvasClick,
    handleCanvasPointerDown,
    handleCanvasPointerMove,
    handleCanvasPointerUp,
  } = useFloorPlanViewport({ onBackgroundClick: clearSelectedTables });

  const {
    guides,
    guidesEnabled,
    snapEnabled,
    setGuidesEnabled,
    setSnapEnabled,
    getLivePosForTable,
    handleTableDragStart,
    handleTableDragMove,
    handleTableDragEnd,
  } = useFloorPlanTableDrag({
    tables,
    positions,
    zoom,
    selectedTableIds,
    getPos,
    onUpdatePosition,
    onSelectTableFromPointer: selectTableFromPointer,
  });

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

  return (
    <div className="floor-plan" id="floor-plan">
      {/* ── Controls overlay ─────────────────────────── */}
      <div className="floor-plan__controls floor-plan__control-panel" aria-label="場地視圖控制">
        <div className="floor-plan__control-group" aria-label="縮放與視角">
          <button
            className="floor-plan__ctrl-btn"
            onClick={zoomIn}
            title="放大"
            aria-label="放大"
          >＋</button>
          <button
            className="floor-plan__ctrl-btn"
            onClick={zoomOut}
            title="縮小"
            aria-label="縮小"
          >－</button>
          <button
            className="floor-plan__ctrl-btn"
            onClick={resetView}
            title="重置視角"
            aria-label="重置視角"
          >⌂</button>
        </div>
        <div className="floor-plan__control-group" aria-label="吸附與輔助線">
          <button
            className={`floor-plan__ctrl-btn${snapEnabled ? ' floor-plan__ctrl-btn--active' : ''}`}
            onClick={() => setSnapEnabled(s => !s)}
            title={snapEnabled ? '停用格線吸附' : '啟用格線吸附'}
            aria-label={snapEnabled ? '停用格線吸附' : '啟用格線吸附'}
            aria-pressed={snapEnabled}
          >格</button>
          <button
            className={`floor-plan__ctrl-btn${guidesEnabled ? ' floor-plan__ctrl-btn--active' : ''}`}
            onClick={() => setGuidesEnabled(s => !s)}
            title={guidesEnabled ? '停用智慧輔助線' : '啟用智慧輔助線'}
            aria-label={guidesEnabled ? '停用智慧輔助線' : '啟用智慧輔助線'}
            aria-pressed={guidesEnabled}
          >線</button>
        </div>
        <div className="floor-plan__control-group" aria-label="桌子鎖定">
          <button
            className={`floor-plan__ctrl-btn${tablesLocked ? ' floor-plan__ctrl-btn--active' : ''}`}
            onClick={toggleTablesLocked}
            title={tablesLocked ? '解鎖桌子位置' : '鎖定桌子位置'}
            aria-label={tablesLocked ? '解鎖桌子位置' : '鎖定桌子位置'}
            aria-pressed={tablesLocked}
          >鎖</button>
        </div>
        {onAddTable && (
          <button
            className="floor-plan__ctrl-btn floor-plan__ctrl-btn--wide"
            onClick={onAddTable}
            disabled={tablesLocked}
            title={tablesLocked ? '桌子已鎖定，請先解鎖再加桌' : '新增桌次'}
            aria-label={tablesLocked ? '桌子已鎖定，請先解鎖再加桌' : '新增桌次'}
          >
            加桌
          </button>
        )}
        <span className="floor-plan__zoom-label">{Math.round(zoom * 100)}%</span>
      </div>

      <div className="floor-plan__mode-panel" aria-label="畫布模式狀態">
        <span className={`floor-plan__mode-chip${snapEnabled ? ' floor-plan__mode-chip--active' : ''}`}>
          格線吸附 {snapEnabled ? '開' : '關'}
        </span>
        <span className={`floor-plan__mode-chip${guidesEnabled ? ' floor-plan__mode-chip--active' : ''}`}>
          輔助線 {guidesEnabled ? '開' : '關'}
        </span>
        <span className={`floor-plan__mode-chip${tablesLocked ? ' floor-plan__mode-chip--active' : ''}`}>
          桌子鎖定 {tablesLocked ? '開' : '關'}
        </span>
      </div>

      {/* ── Legend ───────────────────────────────────── */}
      <div className="floor-plan__legend" aria-label="圖例">
        <span className="floor-plan__legend-tip">空白處拖曳平移 · 滾輪縮放</span>
        <span className="floor-plan__legend-tip">
          {tablesLocked ? '桌子已鎖定 · 不能移動或刪桌 · 可安心拖曳賓客' : '桌名拖曳移桌 · 多選可一起移動'}
        </span>
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
          onClick={handleCanvasClick}
        >
          {/* ── Room label ── */}
          <div className="floor-plan__room-label">婚宴廳</div>

          {/* ── Stage / Head table indicator ── */}
          <div className="floor-plan__stage">
            <span>舞台</span>
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
              已選 {selectedTableIds.size} 桌｜拖曳任一選取桌次可一起移動
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
                  tablesLocked ? 'floor-plan__table-wrapper--locked' : '',
                ].filter(Boolean).join(' ')}
                style={{
                  left: pos.x,
                  top: pos.y,
                  position: 'absolute',
                  zIndex: isDragging ? 100 : isSelected ? 10 : 1,
                }}
                onClick={(event) => handleTableWrapperClick(event, table.id)}
              >
                {/* Drag handle — sits above the table diagram */}
                <div
                  className="floor-plan__drag-handle"
                  onPointerDown={(e) => {
                    if (e.target.closest('.floor-plan__rename-input, .floor-plan__drag-label')) return;
                    if (tablesLocked) {
                      e.stopPropagation();
                      e.preventDefault();
                      return;
                    }
                    handleTableDragStart(e, table.id, index);
                  }}
                  onPointerMove={handleTableDragMove}
                  onPointerUp={handleTableDragEnd}
                  onPointerCancel={handleTableDragEnd}
                  title={tablesLocked ? '桌子位置已鎖定' : '拖曳桌名列移動此桌'}
                  aria-label={tablesLocked ? `${table.label} 位置已鎖定` : `移動 ${table.label}`}
                >
                  <span className="floor-plan__drag-icon" style={{ flexShrink: 0 }}>
                    {tablesLocked ? '鎖' : '拖'}
                  </span>
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
                      onClick={e => {
                        // Let modifier-key clicks bubble up to the wrapper's multi-select handler
                        if (e.shiftKey || e.ctrlKey || e.metaKey) return;
                        startRename(e, table);
                      }}
                      onPointerDown={e => e.stopPropagation()}
                      title="點擊改名"
                    >
                      {table.label}
                      <span className="floor-plan__edit-hint">改</span>
                    </span>
                  )}
                </div>

                {/* The circular table diagram */}
                <TableZone
                  table={table}
                  guests={guests}
                  lockedAssignments={lockedAssignments}
                  onMoveOut={onMoveOut}
                  onRename={onRename}
                  onRemove={onRemove}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  tableLocked={tablesLocked}
                  tableLockVersion={tableLockVersion}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
