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
import Toolbar from './components/Toolbar';
import UnassignedPool from './components/UnassignedPool';
import FloorPlan from './components/FloorPlan';
import GuestCard from './components/GuestCard';
import AddGuestModal from './components/AddGuestModal';
import ToastContainer from './components/Toast';

import { useSeatingState } from './hooks/useSeatingState';
import { useGoogleSheets } from './hooks/useGoogleSheets';
import { useExport } from './hooks/useExport';
import { syncToGoogleSheets, useFirebaseStatus } from './hooks/useFirebase';
import { useToast } from './hooks/useToast';

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

  const handleOpenEdit = (guest) => setEditingGuest(guest);
  const handleCloseEdit = () => setEditingGuest(null);

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
    window.addEventListener('pointerup',   track, { passive: true });
    return () => {
      window.removeEventListener('pointermove', track);
      window.removeEventListener('pointerup',   track);
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
        importGuests(guests);
        toast.success(`已匯入 ${guests.length} 位賓客`);
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
    } else {
      toast.success('已成功同步至 Google Sheets');
    }
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
      const tableId   = el.getAttribute('data-table-id');
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
      const seatIndex     = over.data?.current?.seatIndex ?? null;
      const isEmpty       = over.data?.current?.isEmpty ?? true;
      console.log('[DnD] over →', over.id, '| seatIndex:', seatIndex, '| isEmpty:', isEmpty);

      if (!isEmpty) {
        // Seat is occupied → swap atomically
        const from = findGuestSeat(state.tables, guestId);
        if (from) {
          swapGuestsBetweenSeats(from.tableId, from.seatIndex, targetTableId, seatIndex);
        }
        return;
      }
      const result = moveGuest(guestId, targetTableId, seatIndex);
      if (!result.success) console.warn('[DnD] moveGuest rejected:', result.reason);
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
        swapGuestsBetweenSeats(from.tableId, from.seatIndex, hit.tableId, hit.seatIndex);
      }
      return;
    }
    const result = moveGuest(guestId, hit.tableId, hit.seatIndex);
    if (!result.success) console.warn('[DnD] moveGuest rejected:', result.reason);
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
        <div id="root-layout">
          {/* Firebase connection status badge */}
          <div className={`firebase-status firebase-status--${firebaseStatus}`} title={
            firebaseStatus === 'connected'    ? 'Firebase 已連線' :
            firebaseStatus === 'disconnected' ? 'Firebase 斷線中' :
                                               '未設定 Firebase'
          }>
            <span className="firebase-status__dot" />
            <span className="firebase-status__label">
              {firebaseStatus === 'connected'    ? 'Firebase 已連線' :
               firebaseStatus === 'disconnected' ? 'Firebase 斷線' :
                                                  '本機模式'}
            </span>
          </div>
          {/* Toolbar */}
          <Toolbar
            stats={stats}
            lastSaved={state.lastSaved}
            onImport={handleImport}
            onAddTable={addTable}
            onOpenAddGuest={() => setShowAddGuest(true)}
            onExportJSON={exportJSON}
            onExportCSV={exportCSV}
            onExportPDF={() => exportPDF(floorPlanRef)}
            onExportFloorPDF={exportFloorPDF}
            onSyncSheets={handleSyncSheets}
            importLoading={importLoading}
          />

          {/* App body */}
          <div className="app-layout">
            {/* Left sidebar — unassigned guests */}
            <div className="app-sidebar">
              <UnassignedPool
                guests={state.guests}
                unassignedIds={state.unassignedGuestIds}
                onMoveToUnassigned={(guestId) => moveGuest(guestId, null)}
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
                  onMoveOut={(guestId) => moveGuest(guestId, null)}
                  onRename={renameTable}
                  onRemove={removeTable}
                  onEdit={handleOpenEdit}
                  onDelete={removeGuest}
                />
              )}
            </main>
          </div>
        </div>

        {/* Drag overlay — the "ghost" card following the cursor */}
        <DragOverlay dropAnimation={{
          duration: 180,
          easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
        }}>
          {activeGuest ? (
            <GuestCard
              guest={activeGuest}
              className="guest-card-drag-overlay"
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </>
  );
}
