import { useState, useRef } from 'react';
import './Toolbar.css';

/**
 * Top toolbar: import, add table, add guest, export, stats.
 * Props:
 *   stats           — { total, assigned, unassigned }
 *   lastSaved       — ISO string | null
 *   onImport        — () => Promise<void>
 *   onAddTable      — () => void
 *   onOpenAddGuest  — () => void
 *   onExportJSON    — () => void
 *   onExportCSV     — () => void
 *   onExportPDF     — () => void
 *   onExportFloorPDF — () => void
 *   onSyncSheets    — () => Promise<void>   (同步回寫 Google Sheets)
 *   importLoading   — bool
 */
export default function Toolbar({
  stats,
  lastSaved,
  onImport,
  onAddTable,
  onOpenAddGuest,
  onExportJSON,
  onExportCSV,
  onExportPDF,
  onExportFloorPDF,
  onSyncSheets,
  importLoading,
}) {
  const [exportOpen, setExportOpen] = useState(false);
  const [syncState, setSyncState] = useState('idle'); // 'idle' | 'syncing' | 'success' | 'error'
  const exportRef = useRef(null);
  const syncTimerRef = useRef(null);

  const handleSyncSheets = async () => {
    setSyncState('syncing');
    try {
      await onSyncSheets();
      setSyncState('success');
    } catch {
      setSyncState('error');
    } finally {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
      syncTimerRef.current = setTimeout(() => setSyncState('idle'), 3000);
    }
  };

  const syncLabel = {
    idle:    '↗️ 同步到試算表',
    syncing: '同步中…',
    success: '✓ 同步完成',
    error:   '⚠️ 同步失敗',
  }[syncState];

  const handleExportClick = (fn) => {
    fn();
    setExportOpen(false);
  };

  const formatSaved = (iso) => {
    if (!iso) return null;
    const d = new Date(iso);
    return d.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <header className="toolbar" role="banner">
      {/* Brand */}
      <div className="toolbar__brand">
        <span className="toolbar__logo">💍</span>
        <h1 className="toolbar__title">排座位幫手</h1>
      </div>

      {/* Stats */}
      <div className="toolbar__stats" aria-label="賓客統計">
        <div className="toolbar__stat">
          <span className="toolbar__stat-num">{stats.total}</span>
          <span className="toolbar__stat-label">總賓客</span>
        </div>
        <div className="toolbar__stat-divider" />
        <div className="toolbar__stat">
          <span className="toolbar__stat-num toolbar__stat-num--accent">{stats.assigned}</span>
          <span className="toolbar__stat-label">已分配</span>
        </div>
        <div className="toolbar__stat-divider" />
        <div className="toolbar__stat">
          <span className="toolbar__stat-num toolbar__stat-num--muted">{stats.unassigned}</span>
          <span className="toolbar__stat-label">未分配</span>
        </div>
      </div>

      {/* Actions */}
      <div className="toolbar__actions">
        {/* Import */}
        <button
          className="btn btn-secondary toolbar__btn"
          onClick={onImport}
          disabled={importLoading}
          id="btn-import-sheets"
          aria-label="從 Google Sheets 匯入賓客"
        >
          {importLoading ? '匯入中…' : '📥 匯入名單'}
        </button>

        {/* Add guest */}
        <button
          className="btn btn-secondary toolbar__btn"
          onClick={onOpenAddGuest}
          id="btn-add-guest"
          aria-label="手動新增賓客"
        >
          ＋ 新增賓客
        </button>

        {/* Add table */}
        <button
          className="btn btn-secondary toolbar__btn"
          onClick={onAddTable}
          id="btn-add-table"
          aria-label="新增桌次"
        >
          🪑 新增桌次
        </button>

        {/* Sync to Google Sheets */}
        <button
          className={`btn toolbar__btn toolbar__btn--sync ${
            syncState === 'success' ? 'btn-success' :
            syncState === 'error'   ? 'btn-danger'  :
            'btn-sync'
          }`}
          onClick={handleSyncSheets}
          disabled={syncState === 'syncing'}
          id="btn-sync-sheets"
          aria-label="同步排位結果到 Google Sheets"
        >
          {syncLabel}
        </button>

        {/* Export dropdown */}
        <div className="toolbar__export-wrapper" ref={exportRef}>
          <button
            className="btn btn-primary toolbar__btn"
            onClick={() => setExportOpen(v => !v)}
            id="btn-export"
            aria-haspopup="true"
            aria-expanded={exportOpen}
          >
            📤 匯出 ▾
          </button>
          {exportOpen && (
            <div className="toolbar__export-menu" role="menu">
              <button
                className="toolbar__export-item"
                onClick={() => handleExportClick(onExportJSON)}
                role="menuitem"
                id="btn-export-json"
              >
                📄 匯出 JSON
              </button>
              <button
                className="toolbar__export-item"
                onClick={() => handleExportClick(onExportCSV)}
                role="menuitem"
                id="btn-export-csv"
              >
                📊 匯出 Excel
              </button>
              <button
                className="toolbar__export-item"
                onClick={() => handleExportClick(onExportPDF)}
                role="menuitem"
                id="btn-export-pdf"
              >
                🖨️ 座位清單 PDF
              </button>
              <button
                className="toolbar__export-item"
                onClick={() => handleExportClick(onExportFloorPDF)}
                role="menuitem"
                id="btn-export-floor-pdf"
              >
                🗺️ 桌次圖 PDF
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Last saved */}
      {lastSaved && (
        <div className="toolbar__saved" aria-live="polite">
          ✓ 已自動儲存 {formatSaved(lastSaved)}
        </div>
      )}
    </header>
  );
}
