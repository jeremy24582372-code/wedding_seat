import { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  MeasuringStrategy,
  pointerWithin,
} from '@dnd-kit/core';

import './App.css';
import AppShell from './components/AppShell';
import DashboardHome from './components/DashboardHome';
import GuestDashboard from './components/GuestDashboard';
import GroupManager from './components/GroupManager';
import Toolbar from './components/Toolbar';
import UnassignedPool from './components/UnassignedPool';
import FloorPlan from './components/FloorPlan';
import DragGuestToken from './components/DragGuestToken';
import AddGuestModal from './components/AddGuestModal';
import AutoSeatRulesModal from './components/AutoSeatRulesModal';
import ToastContainer from './components/Toast';

import { useSeatingState } from './hooks/useSeatingState';
import { useGoogleSheets } from './hooks/useGoogleSheets';
import { useExport } from './hooks/useExport';
import { syncToGoogleSheets, useFirebaseStatus } from './hooks/useFirebase';
import { useToast } from './hooks/useToast';
import { useAutoSeatFlow } from './hooks/useAutoSeatFlow';
import { useGuestDragAndDrop } from './hooks/useGuestDragAndDrop';
import { useGuestImportFlow } from './hooks/useGuestImportFlow';
import { useLockedSeatMoves } from './hooks/useLockedSeatMoves';

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
    addGuestToGroup,
    removeGuestFromGroup,
    removeGuestGroup,
    toggleGuestLock,
    toggleGroupLock,
    updateTablePosition,
    saveNow,
  } = useSeatingState();

  const { fetchGuests, loading: importLoading } = useGoogleSheets();
  const {
    exportJSON,
    exportCSV,
    exportPDF,
    exportFloorPDF,
    exportFloorDesignSVG,
    exportFloorDesignPNG,
    exportFloorDesignPrompt,
  } = useExport(state);
  const firebaseStatus = useFirebaseStatus();
  const { toasts, toast } = useToast();

  // Modal state
  const [showAddGuest, setShowAddGuest] = useState(false);
  const [editingGuest, setEditingGuest] = useState(null); // Guest object being edited
  const [activeTab, setActiveTab] = useState('overview');

  const handleOpenEdit = (guest) => setEditingGuest(guest);
  const handleCloseEdit = () => setEditingGuest(null);
  const { lastImportSummary, handleImport } = useGuestImportFlow({
    fetchGuests,
    importGuests,
    toast,
  });

  const {
    showAutoSeatRules,
    autoSeatPreview,
    handleOpenAutoSeat,
    handleCloseAutoSeat,
    handleCreateAutoSeatPreview,
    handleApplyAutoSeatPreview,
    clearAutoSeatPreview,
  } = useAutoSeatFlow({
    state,
    applyAutoSeatPlan,
    setActiveTab,
    toast,
  });

  const { moveGuestWithLockPrompt, swapGuestsWithLockPrompt } = useLockedSeatMoves({
    state,
    getGuestById,
    moveGuest,
    swapGuestsBetweenSeats,
    toast,
  });

  const {
    activeGuest,
    sensors,
    handleDragStart,
    handleDragEnd,
    handleDragCancel,
    dragOverlayModifiers,
  } = useGuestDragAndDrop({
    state,
    getGuestById,
    moveGuestWithLockPrompt,
    swapGuestsWithLockPrompt,
    toast,
  });

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

  // --- Manual Firebase save handler ---
  const handleManualSave = async () => {
    if (firebaseStatus === 'unconfigured') {
      toast.warning('本機模式，無法儲存至 Firebase');
      return;
    }
    try {
      await saveNow();
      toast.success('已手動儲存至 Firebase');
    } catch (err) {
      toast.error(`手動儲存失敗：${err.message}`);
    }
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
          onDraftChange={clearAutoSeatPreview}
          onClose={handleCloseAutoSeat}
        />
      )}

      {/* Global toast notifications */}
      <ToastContainer toasts={toasts} onDismiss={toast.dismiss} />

      {/* Main DnD context — manages GUEST drag-and-drop only */}
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
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
          onManualSave={handleManualSave}
        >
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
              onExportPDF={exportPDF}
              onExportFloorPDF={exportFloorPDF}
              onExportFloorDesignPNG={exportFloorDesignPNG}
              onExportFloorDesignPrompt={exportFloorDesignPrompt}
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
              onAddGuestToGroup={addGuestToGroup}
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
                onExportPDF={exportPDF}
                onExportFloorPDF={exportFloorPDF}
                onExportFloorDesignSVG={exportFloorDesignSVG}
                onExportFloorDesignPNG={exportFloorDesignPNG}
                onExportFloorDesignPrompt={exportFloorDesignPrompt}
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
                    lockedAssignments={state.lockedAssignments ?? {}}
                    onEdit={handleOpenEdit}
                    onDelete={removeGuest}
                  />
                </div>

                {/* Main area — Floor Plan canvas */}
                <main className="app-main" id="tables-area">
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
        <DragOverlay
          adjustScale={false}
          modifiers={dragOverlayModifiers}
          dropAnimation={{
            duration: 180,
            easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
          }}
        >
          {activeGuest ? (
            <DragGuestToken
              guest={activeGuest}
              locked={Boolean(state.lockedAssignments?.[activeGuest.id])}
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </>
  );
}
