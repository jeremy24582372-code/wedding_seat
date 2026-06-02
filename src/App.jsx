import { useState, useRef, useEffect } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  MeasuringStrategy,
} from '@dnd-kit/core';

import './App.css';
import AppShell from './components/AppShell';
import DashboardHome from './components/DashboardHome';
import GuestDashboard from './components/GuestDashboard';
import GroupManager from './components/GroupManager';
import Toolbar from './components/Toolbar';
import UnassignedPool from './components/UnassignedPool';
import FloorPlan from './components/FloorPlan';
import GuestCard from './components/GuestCard';
import AddGuestModal from './components/AddGuestModal';
import AutoSeatRulesModal from './components/AutoSeatRulesModal';
import ToastContainer from './components/Toast';

import { useSeatingState } from './hooks/useSeatingState';
import { useGoogleSheets } from './hooks/useGoogleSheets';
import { useExport } from './hooks/useExport';
import { syncToGoogleSheets, useFirebaseStatus } from './hooks/useFirebase';
import { useToast } from './hooks/useToast';
import { createAutoSeatPreview } from './utils/autoSeatPlanner';

/**
 * Find which table + seat a guest currently occupies.
 * Returns null if guest is in the unassigned pool.
 */
function findGuestSeat(tables, guestId) {
  for (const t of tables) {
    const idx = t.guestIds.indexOf(guestId);
    if (idx !== -1) return { tableId: t.id, seatIndex: idx };
  }
  return null;
}

export default function App() {
  const {
    state,
    fbReady,
    stats,
    getGuestById,
    addGuest,
    updateGuest,
    removeGuest,
    moveGuest,
    swapGuestsBetweenSeats,
    addTable,
    removeTable,
    renameTable,
    importGuests,
    applyAutoSeatPlan,
    createGuestGroup,
    updateGuestGroup,
    removeGuestFromGroup,
    removeGuestGroup,
    toggleGuestLock,
    toggleGroupLock,
    updateTablePosition,
  } = useSeatingState();

  const { fetchGuests, loading: importLoading } = useGoogleSheets();
  const { exportJSON, exportCSV, exportPDF, exportFloorPDF } = useExport(state);
  const firebaseStatus = useFirebaseStatus();
  const { toasts, toast } = useToast();

  const floorPlanRef = useRef(null);

  // Drag state
  const [activeGuestId, setActiveGuestId] = useState(null);
  const activeGuest = activeGuestId ? getGuestById(activeGuestId) : null;

  // Modal state
  const [showAddGuest, setShowAddGuest] = useState(false);
  const [editingGuest, setEditingGuest] = useState(null); // Guest object being edited
  const [showAutoSeatRules, setShowAutoSeatRules] = useState(false);
  const [autoSeatPreview, setAutoSeatPreview] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [lastImportSummary, setLastImportSummary] = useState(null);

  const handleOpenEdit = (guest) => setEditingGuest(guest);
  const handleCloseEdit = () => setEditingGuest(null);
  const handleOpenAutoSeat = () => {
    setAutoSeatPreview(null);
    setShowAutoSeatRules(true);
  };
  const handleCloseAutoSeat = () => {
    setAutoSeatPreview(null);
    setShowAutoSeatRules(false);
  };

  const handleCreateAutoSeatPreview = (rules) => {
    const preview = createAutoSeatPreview(state, rules);
    setAutoSeatPreview(preview);

    if (preview.summary.candidateMoveCount === 0 && preview.summary.createdTableCount === 0) {
      toast.info('目前沒有可套用的自動排座建議');
    } else {
      toast.success(`已產生預覽：建議安排 ${preview.summary.candidateMoveCount} 位`);
    }
  };

  const handleApplyAutoSeatPreview = () => {
    if (!autoSeatPreview) {
      toast.warn('請先產生自動排座預覽');
      return;
    }

    const result = applyAutoSeatPlan(autoSeatPreview.plan);
    if (!result.success) {
      toast.warn(result.reason ?? '無法套用自動排座預覽');
      return;
    }

    toast.success(`已套用自動排座：安排 ${autoSeatPreview.summary.candidateMoveCount} 位`);
    handleCloseAutoSeat();
    setActiveTab('seating');
  };

  const confirmLockedManualMove = (guestIds) => {
    const lockedGuests = guestIds
      .map(id => getGuestById(id))
      .filter(guest => guest && state.lockedAssignments?.[guest.id]);
    if (lockedGuests.length === 0) return true;

    const names = lockedGuests.map(guest => guest.name).join('、');
    return window.confirm(`「${names}」已鎖定座位。仍要手動移動或交換嗎？`);
  };

  const moveGuestWithLockPrompt = (guestId, targetTableId, seatIndex = null) => {
    if (!confirmLockedManualMove([guestId])) {
      toast.info('已保留鎖定座位');
      return { success: false, reason: '鎖定座位未移動' };
    }
    return moveGuest(guestId, targetTableId, seatIndex);
  };

  const swapGuestsWithLockPrompt = (fromTableId, fromSeatIndex, toTableId, toSeatIndex) => {
    const fromGuestId = state.tables.find(table => table.id === fromTableId)?.guestIds?.[fromSeatIndex];
    const toGuestId = state.tables.find(table => table.id === toTableId)?.guestIds?.[toSeatIndex];
    if (!confirmLockedManualMove([fromGuestId, toGuestId].filter(Boolean))) {
      toast.info('已保留鎖定座位');
      return;
    }
    swapGuestsBetweenSeats(fromTableId, fromSeatIndex, toTableId, toSeatIndex);
  };

  // ─────────────────────────────────────────────────────────────
  // KEY FIX: Track exact pointer position on every move/up event.
  // dnd-kit's collision detection is inaccurate inside a CSS-
  // transformed container (scale + translate). We bypass it entirely
  // by using document.elementsFromPoint at drop time instead.
  // ─────────────────────────────────────────────────────────────
  const lastPointer = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const track = (e) => {
      lastPointer.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener('pointermove', track, { passive: true });
    window.addEventListener('pointerup', track, { passive: true });
    return () => {
      window.removeEventListener('pointermove', track);
      window.removeEventListener('pointerup', track);
    };
  }, []);

  // DnD sensors — 8px activation distance prevents accidental drags
  // and conflicts with the table-repositioning pointer handler.
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  // --- Import handler ---
  const handleImport = async () => {
    try {
      const guests = await fetchGuests();
      if (guests) {
        if (guests.length === 0) {
          toast.info('來源試算表沒有可匯入的賓客');
          return;
        }

        const missingHeadcountRows = guests.filter(g => g._sourceMissingHeadcount).length;

        const {
          added,
          updated = 0,
          skipped,
          assigned = 0,
          createdTables = 0,
          unassignedDueToFullTables = 0,
        } = importGuests(guests);

        setLastImportSummary({
          added,
          updated,
          skipped,
          assigned,
          createdTables,
          unassignedDueToFullTables,
          sourceRows: guests.length,
          missingHeadcountRows,
          importedAt: new Date().toISOString(),
        });

        const details = [];
        if (assigned > 0) details.push(`依桌次安排 ${assigned} 位`);
        if (createdTables > 0) details.push(`新增 ${createdTables} 張桌次`);
        if (unassignedDueToFullTables > 0) {
          details.push(`${unassignedDueToFullTables} 位因桌次已滿保留未分配`);
        }
        const suffix = details.length > 0 ? `（${details.join('，')}）` : '';
        const updatedText = updated > 0 ? `，更新 ${updated} 筆既有來源` : '';

        if (added === 0 && updated === 0 && details.length === 0) {
          toast.info(`沒有新增資料${skipped > 0 ? `，略過 ${skipped} 筆重複來源` : ''}`);
        } else if (added === 0) {
          toast.success(`已更新 ${updated} 筆既有來源${skipped > 0 ? `，略過 ${skipped} 筆重複來源` : ''}${suffix}`);
        } else if (skipped > 0) {
          toast.success(`新增 ${added} 位座位需求${updatedText}，略過 ${skipped} 筆重複來源${suffix}`);
        } else {
          toast.success(`已匯入 ${added} 位座位需求${updatedText}${suffix}`);
        }

        if (missingHeadcountRows > 0) {
          toast.warn(`匯入來源有 ${missingHeadcountRows} 筆未回傳「人數」欄，已暫以 1 位處理；請重新部署 Apps Script。`);
        }
      }
    } catch (err) {
      toast.error(`匯入失敗：${err?.message ?? '未知錯誤'}`);
    }
  };

  // --- Sync to Google Sheets handler ---
  const handleSyncSheets = async () => {
    const sheetsUrl = import.meta.env.VITE_SHEETS_URL;
    toast.info('正在同步至 Google Sheets…');
    const result = await syncToGoogleSheets(state, sheetsUrl);
    if (!result.success) {
      toast.error(`同步失敗：${result.error ?? '未知錯誤'}`);
      throw new Error(result.error ?? '未知錯誤');
    } else {
      toast.success('已成功同步至 Google Sheets');
    }
    return result;
  };

  // --- DnD handlers ---
  const handleDragStart = ({ active }) => {
    setActiveGuestId(active.id);
  };

  /**
   * Walk the element stack at (clientX, clientY) and return the first
   * element that carries seat data attributes. Works correctly even when
   * the seat elements live inside a CSS-transformed canvas.
   */
  function findSeatAtPointer(clientX, clientY) {
    const elements = document.elementsFromPoint(clientX, clientY);
    for (const el of elements) {
      const tableId = el.getAttribute('data-table-id');
      const seatIndex = el.getAttribute('data-seat-index');
      if (tableId && seatIndex !== null) {
        return {
          tableId,
          seatIndex: parseInt(seatIndex, 10),
          isEmpty: el.getAttribute('data-seat-empty') === 'true',
        };
      }
    }
    return null;
  }

  const handleDragEnd = ({ active, over }) => {
    setActiveGuestId(null);
    const guestId = active.id;

    // ── Primary: dnd-kit's collision detection (MeasuringStrategy.Always keeps
    //    droppable rects current even under CSS transform + scale)
    if (over) {
      const targetTableId = over.data?.current?.tableId ?? null;
      const seatIndex = over.data?.current?.seatIndex ?? null;
      const isEmpty = over.data?.current?.isEmpty ?? true;
      console.log('[DnD] over →', over.id, '| seatIndex:', seatIndex, '| isEmpty:', isEmpty);

      if (!isEmpty) {
        // Seat is occupied → swap atomically
        const from = findGuestSeat(state.tables, guestId);
        if (from) {
          swapGuestsWithLockPrompt(from.tableId, from.seatIndex, targetTableId, seatIndex);
        } else {
          toast.warn('此座位已有人；請拖到空位，或先移出原賓客。');
        }
        return;
      }
      const result = moveGuestWithLockPrompt(guestId, targetTableId, seatIndex);
      if (!result.success) {
        console.warn('[DnD] moveGuest rejected:', result.reason);
        toast.warn(result.reason ?? '無法放入此桌');
      }
      return;
    }

    // ── Fallback: elementFromPoint (handles edge cases when over is null) ──
    const hit = findSeatAtPointer(lastPointer.current.x, lastPointer.current.y);
    if (!hit) return;
    console.log('[DnD] elementFromPoint fallback →', hit);

    if (!hit.isEmpty) {
      // Seat is occupied → swap atomically
      const from = findGuestSeat(state.tables, guestId);
      if (from) {
        swapGuestsWithLockPrompt(from.tableId, from.seatIndex, hit.tableId, hit.seatIndex);
      } else {
        toast.warn('此座位已有人；請拖到空位，或先移出原賓客。');
      }
      return;
    }
    const result = moveGuestWithLockPrompt(guestId, hit.tableId, hit.seatIndex);
    if (!result.success) {
      console.warn('[DnD] moveGuest rejected:', result.reason);
      toast.warn(result.reason ?? '無法放入此桌');
    }
  };

  const handleDragCancel = () => {
    setActiveGuestId(null);
  };

  // Show loading overlay until Firebase has responded
  if (!fbReady) {
    return (
      <div className="fb-loading" role="status" aria-label="載入中">
        <span className="fb-loading__spinner" />
        <p>連線中…</p>
      </div>
    );
  }

  const plannerTabs = [
    { id: 'overview', label: '總覽', meta: `${stats.assignedSeats}/${stats.seatTotal}` },
    { id: 'guests', label: '賓客', meta: `${stats.partyTotal} 筆` },
    { id: 'groups', label: '群組', meta: `${state.guestGroups?.length ?? 0} 組` },
    { id: 'seating', label: '座位圖', meta: `${state.tables.length} 桌` },
  ];

  return (
    <>
      {/* Add Guest Modal */}
      {showAddGuest && (
        <AddGuestModal
          onAdd={addGuest}
          onClose={() => setShowAddGuest(false)}
        />
      )}

      {/* Edit Guest Modal */}
      {editingGuest && (
        <AddGuestModal
          initialGuest={editingGuest}
          onUpdate={updateGuest}
          onClose={handleCloseEdit}
        />
      )}

      {showAutoSeatRules && (
        <AutoSeatRulesModal
          initialRules={state.seatingRules}
          preview={autoSeatPreview}
          onPreview={handleCreateAutoSeatPreview}
          onApply={handleApplyAutoSeatPreview}
          onDraftChange={() => setAutoSeatPreview(null)}
          onClose={handleCloseAutoSeat}
        />
      )}

      {/* Global toast notifications */}
      <ToastContainer toasts={toasts} onDismiss={toast.dismiss} />

      {/* Main DnD context — manages GUEST drag-and-drop only */}
      <DndContext
        sensors={sensors}
        measuring={{
          droppable: {
            strategy: MeasuringStrategy.Always,
          },
        }}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <AppShell
          activeTab={activeTab}
          tabs={plannerTabs}
          onTabChange={setActiveTab}
          firebaseStatus={firebaseStatus}
          lastSaved={state.lastSaved}
        >
          {/* Firebase connection status badge */}
          <div className={`firebase-status firebase-status--${firebaseStatus}`} title={
            firebaseStatus === 'connected' ? 'Firebase 已連線' :
              firebaseStatus === 'disconnected' ? 'Firebase 斷線中' :
                '未設定 Firebase'
          }>
            <span className="firebase-status__dot" />
            <span className="firebase-status__label">
              {firebaseStatus === 'connected' ? 'Firebase 已連線' :
                firebaseStatus === 'disconnected' ? 'Firebase 斷線' :
                  '本機模式'}
            </span>
          </div>

          {activeTab === 'overview' ? (
            <DashboardHome
              state={state}
              stats={stats}
              firebaseStatus={firebaseStatus}
              lastSaved={state.lastSaved}
              importLoading={importLoading}
              onImport={handleImport}
              onOpenAddGuest={() => setShowAddGuest(true)}
              onGoToSeats={() => setActiveTab('seating')}
              onExportPDF={() => exportPDF(floorPlanRef)}
              onSyncSheets={handleSyncSheets}
            />
          ) : activeTab === 'guests' ? (
            <GuestDashboard
              state={state}
              stats={stats}
              importSummary={lastImportSummary}
              importLoading={importLoading}
              onImport={handleImport}
              onOpenAddGuest={() => setShowAddGuest(true)}
              onGoToSeats={() => setActiveTab('seating')}
              onEditGuest={handleOpenEdit}
              onDeleteGuest={removeGuest}
            />
          ) : activeTab === 'groups' ? (
            <GroupManager
              state={state}
              onCreateGroup={createGuestGroup}
              onUpdateGroup={updateGuestGroup}
              onRemoveGuestFromGroup={removeGuestFromGroup}
              onRemoveGuestGroup={removeGuestGroup}
              onToggleGuestLock={toggleGuestLock}
              onToggleGroupLock={toggleGroupLock}
              onGoToSeats={() => setActiveTab('seating')}
            />
          ) : (
            <div className="planner-workspace seating-workspace">
              {/* Toolbar */}
              <Toolbar
                stats={stats}
                lastSaved={state.lastSaved}
                onImport={handleImport}
                onAddTable={addTable}
                onOpenAddGuest={() => setShowAddGuest(true)}
                onOpenAutoSeat={handleOpenAutoSeat}
                onExportJSON={exportJSON}
                onExportCSV={exportCSV}
                onExportPDF={() => exportPDF(floorPlanRef)}
                onExportFloorPDF={exportFloorPDF}
                onSyncSheets={handleSyncSheets}
                importLoading={importLoading}
              />

              <section className="seating-workspace__statusbar" aria-label="座位圖操作提示">
                <div className="seating-workspace__status-copy">
                  <strong>座位圖工作區</strong>
                  <span>拖曳賓客到空位；滿桌可交換座位，點擊已安排座位可移回未分配。</span>
                </div>
                <div className="seating-workspace__status-metrics" aria-label="座位圖統計">
                  <span><b>{stats.unassignedSeats}</b> 未分配</span>
                  <span><b>{state.tables.filter(t => t.guestIds.filter(Boolean).length >= 10).length}</b> 滿桌</span>
                  <span><b>{state.partyRows?.length ?? 0}</b> 來源列</span>
                </div>
              </section>

              {/* App body */}
              <div className="app-layout seating-workspace__layout">
                {/* Left sidebar — unassigned guests */}
                <div className="app-sidebar">
                  <UnassignedPool
                    guests={state.guests}
                    unassignedIds={state.unassignedGuestIds}
                    onMoveToUnassigned={(guestId) => moveGuestWithLockPrompt(guestId, null)}
                    lockedAssignments={state.lockedAssignments ?? {}}
                    onEdit={handleOpenEdit}
                    onDelete={removeGuest}
                  />
                </div>

                {/* Main area — Floor Plan canvas */}
                <main className="app-main" ref={floorPlanRef} id="tables-area">
                  {state.tables.length === 0 ? (
                    <div className="app-empty-tables">
                      <p>尚無桌次</p>
                      <button
                        className="btn btn-primary"
                        onClick={addTable}
                      >
                        新增第一張桌
                      </button>
                    </div>
                  ) : (
                    <FloorPlan
                      tables={state.tables}
                      guests={state.guests}
                      positions={state.tablePositions ?? {}}
                      onUpdatePosition={updateTablePosition}
                      onMoveOut={(guestId) => moveGuestWithLockPrompt(guestId, null)}
                      onRename={renameTable}
                      onRemove={removeTable}
                      onEdit={handleOpenEdit}
                      onDelete={removeGuest}
                      onAddTable={addTable}
                      lockedAssignments={state.lockedAssignments ?? {}}
                    />
                  )}
                </main>
              </div>
            </div>
          )}
        </AppShell>

        {/* Drag overlay — the "ghost" card following the cursor */}
        <DragOverlay dropAnimation={{
          duration: 180,
          easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
        }}>
          {activeGuest ? (
            <GuestCard
              guest={activeGuest}
              className="guest-card-drag-overlay"
              locked={Boolean(state.lockedAssignments?.[activeGuest.id])}
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </>
  );
}
